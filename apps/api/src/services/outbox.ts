import { createHmac } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { devices, orders, outbox, repairs } from '../db/schema';
import { OneCError, type OneCAdapter, type OneCOrder } from '../onec/types';
import type { PushSender } from './push';
import type { CatalogService } from './catalog';
import type { OrderLine } from '@kbs/shared';

export type OutboxTopic = 'onec.order' | 'onec.repair' | 'internal.webhook' | 'push';

export interface OutboxPayloads {
  'onec.order': { orderId: string };
  'onec.repair': { repairId: string };
  'internal.webhook': { event: string; data: unknown };
  push: { userId: string; title: string; body: string; data?: Record<string, string> };
}

type Tx = Pick<Db, 'insert'>;

export async function enqueue<T extends OutboxTopic>(db: Tx, topic: T, payload: OutboxPayloads[T]) {
  await db.insert(outbox).values({ topic, payload });
}

const MAX_ATTEMPTS = 25;
const backoffMs = (attempt: number) => Math.min(30_000 * 2 ** (attempt - 1), 60 * 60_000);

/**
 * Обработчик очереди. Запись в 1С и вебхуки не теряются, если 1С или внутреннее
 * приложение временно недоступны: событие повторяется с растущей паузой до 25 раз.
 * Строки блокируются через FOR UPDATE SKIP LOCKED, поэтому можно запускать несколько копий сервера.
 */
export class OutboxWorker {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly db: Db,
    private readonly cfg: Config,
    private readonly onec: OneCAdapter,
    private readonly push: PushSender,
    private readonly catalog: CatalogService,
    private readonly log: FastifyBaseLogger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  start(intervalMs = 3000) {
    this.stop();
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Обрабатывает пачку готовых событий. Возвращает число обработанных. */
  async tick(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const res = await this.db.execute<{ id: number; topic: OutboxTopic; payload: unknown; attempts: number }>(sql`
        update ${outbox} set locked_until = now() + interval '2 minutes'
        where id in (
          select id from ${outbox}
          where done_at is null and next_run_at <= now() and (locked_until is null or locked_until < now())
          order by id limit 20 for update skip locked
        )
        returning id, topic, payload, attempts`);
      const rows = (res as unknown as { rows: { id: number; topic: OutboxTopic; payload: unknown; attempts: number }[] }).rows;
      for (const row of rows) await this.handle(row);
      return rows.length;
    } catch (e) {
      this.log.error({ err: e }, 'Ошибка обработки очереди');
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async handle(row: { id: number; topic: OutboxTopic; payload: unknown; attempts: number }) {
    const attempt = row.attempts + 1;
    try {
      await this.process(row.topic, row.payload as never);
      await this.db.update(outbox).set({ doneAt: new Date(), attempts: attempt, lastError: null, lockedUntil: null }).where(eq(outbox.id, row.id));
    } catch (e) {
      const err = e as Error;
      const permanent = (e instanceof OneCError && !e.retryable) || attempt >= MAX_ATTEMPTS;
      this.log.warn({ id: row.id, topic: row.topic, attempt, err: err.message, permanent }, 'Событие очереди не обработано');
      await this.db
        .update(outbox)
        .set({
          attempts: attempt,
          lastError: (permanent ? 'СТОП: ' : '') + err.message.slice(0, 1000),
          nextRunAt: new Date(Date.now() + backoffMs(attempt)),
          lockedUntil: null,
          ...(permanent ? { doneAt: new Date() } : {}),
        })
        .where(eq(outbox.id, row.id));
    }
  }

  private async process<T extends OutboxTopic>(topic: T, payload: OutboxPayloads[T]) {
    switch (topic) {
      case 'onec.order':
        return this.sendOrderTo1C((payload as OutboxPayloads['onec.order']).orderId);
      case 'onec.repair':
        return this.sendRepairTo1C((payload as OutboxPayloads['onec.repair']).repairId);
      case 'internal.webhook':
        return this.sendWebhook(payload as OutboxPayloads['internal.webhook']);
      case 'push':
        return this.sendPush(payload as OutboxPayloads['push']);
    }
  }

  private async sendOrderTo1C(orderId: string) {
    if (!this.cfg.ONEC_WRITE_ORDERS) return;
    const [o] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (!o || o.onecRef) return;
    const lines = o.lines as OrderLine[];
    const pickup = this.cfg.pickupPoints.find((p) => p.id === (o.delivery as { pickupPointId?: string }).pickupPointId);
    const delivery = o.delivery as { type: 'delivery' | 'pickup'; address: string | null; comment: string | null };

    // Напиток и каждая добавка уходят отдельными строками: так их видит 1С и склад.
    const oneLines: OneCOrder['lines'] = [];
    const commentParts: string[] = [];
    for (const l of lines) {
      const base = l.unitPrice - l.modifiers.reduce((s, m) => s + m.unitPrice * m.qty, 0);
      oneLines.push({ itemRef: l.productId, charRef: l.variantId, title: l.title, qty: l.qty, price: base / 100, sum: (base * l.qty) / 100 });
      for (const m of l.modifiers) {
        const addon = this.catalog.addon(m.addonId);
        oneLines.push({
          itemRef: m.addonId,
          charRef: null,
          title: m.title,
          qty: m.qty * l.qty,
          price: m.unitPrice / 100,
          sum: (m.unitPrice * m.qty * l.qty) / 100,
        });
        if (m.flavorId || !addon) commentParts.push(`${l.title}: ${m.title}`);
      }
    }
    if (o.deliveryFee) commentParts.push(`Доставка ${o.deliveryFee / 100} ₽`);
    if (delivery.comment) commentParts.push(`Комментарий: ${delivery.comment}`);

    const number = String(1000 + o.seq);
    const { ref } = await this.onec.createOrder({
      number,
      externalId: o.id,
      date: o.createdAt.toISOString(),
      phone: o.phone,
      customerName: o.customerName,
      deliveryType: delivery.type,
      address: delivery.address,
      pickupPoint: pickup ? `${pickup.title}, ${pickup.address}` : null,
      paymentMethod: o.paymentMethod as OneCOrder['paymentMethod'],
      paid: o.paymentStatus === 'succeeded',
      comment: commentParts.join('; '),
      lines: oneLines,
      total: o.total / 100,
    });
    await this.db.update(orders).set({ onecRef: ref, onecSyncedAt: new Date() }).where(eq(orders.id, orderId));
  }

  private async sendRepairTo1C(repairId: string) {
    if (!this.cfg.ONEC_WRITE_ORDERS) return;
    const [r] = await this.db.select().from(repairs).where(eq(repairs.id, repairId));
    if (!r || r.onecRef) return;
    const res = await this.onec.createRepair({
      number: `Р-${1000 + r.seq}`,
      externalId: r.id,
      date: r.createdAt.toISOString(),
      phone: r.phone,
      customerName: null,
      model: r.model,
      problem: r.problem,
      pickupAddress: r.pickupAddress,
    });
    if (res) await this.db.update(repairs).set({ onecRef: res.ref }).where(eq(repairs.id, repairId));
  }

  private async sendWebhook(p: OutboxPayloads['internal.webhook']) {
    if (!this.cfg.INTERNAL_WEBHOOK_URL) return;
    const body = JSON.stringify({ event: p.event, data: p.data, sentAt: new Date().toISOString() });
    const sig = createHmac('sha256', this.cfg.INTERNAL_WEBHOOK_SECRET).update(body).digest('hex');
    const res = await this.fetchImpl(this.cfg.INTERNAL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-KBS-Event': p.event, 'X-KBS-Signature': `sha256=${sig}` },
      body,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Внутреннее приложение ответило ${res.status}`);
  }

  private async sendPush(p: OutboxPayloads['push']) {
    if (!this.push.enabled) return;
    const list = await this.db.select().from(devices).where(eq(devices.userId, p.userId));
    for (const d of list) {
      const r = await this.push.send(d.token, { title: p.title, body: p.body, data: p.data });
      if (r === 'invalid_token') {
        await this.db.delete(devices).where(and(eq(devices.userId, d.userId), eq(devices.token, d.token)));
      }
    }
  }
}
