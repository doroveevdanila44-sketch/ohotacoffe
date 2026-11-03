import { and, desc, eq } from 'drizzle-orm';
import type { CreateOrderInput, Order, OrderStatus, PaymentMethod, PaymentStatus } from '@kbs/shared';
import { ORDER_STATUS_TITLE, rub } from '@kbs/shared';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { orders, users } from '../db/schema';
import type { CatalogService } from './catalog';
import { notifyUser } from './notify';
import { enqueue } from './outbox';
import { PricingError, deliveryFee, priceLines } from './pricing';
import type { YooKassa } from './yookassa';

type OrderRow = typeof orders.$inferSelect;

export const orderNumber = (seq: number) => String(1000 + seq);

export function toOrder(r: OrderRow): Order {
  return {
    id: r.id,
    number: orderNumber(r.seq),
    status: r.status as OrderStatus,
    paymentMethod: r.paymentMethod as PaymentMethod,
    paymentStatus: r.paymentStatus as PaymentStatus,
    lines: r.lines as Order['lines'],
    subtotal: r.subtotal,
    deliveryFee: r.deliveryFee,
    total: r.total,
    delivery: r.delivery as Order['delivery'],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Какие переходы статусов разрешены из внутреннего приложения. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ['new', 'cancelled'],
  new: ['accepted', 'cooking', 'on_the_way', 'ready_for_pickup', 'done', 'cancelled'],
  accepted: ['cooking', 'on_the_way', 'ready_for_pickup', 'done', 'cancelled'],
  cooking: ['on_the_way', 'ready_for_pickup', 'done', 'cancelled'],
  on_the_way: ['done', 'cancelled'],
  ready_for_pickup: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};

export class OrderError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
    public code = 'order_error',
  ) {
    super(message);
  }
}

export class OrdersService {
  constructor(
    private readonly db: Db,
    private readonly cfg: Config,
    private readonly catalog: CatalogService,
    private readonly yookassa: YooKassa | null,
  ) {}

  /**
   * Создаёт заказ. Цены пересчитываются на сервере. Повторный запрос с тем же
   * clientRequestId вернёт уже созданный заказ (например, если пропала связь).
   */
  async create(userId: string, input: CreateOrderInput): Promise<{ order: Order; paymentUrl: string | null }> {
    const [dup] = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.clientRequestId, input.clientRequestId)));
    if (dup) return { order: toOrder(dup), paymentUrl: await this.paymentUrlFor(dup) };

    if (input.paymentMethod === 'online' && !this.yookassa) {
      throw new OrderError('Онлайн-оплата пока недоступна. Выберите оплату при получении.', 422, 'online_disabled');
    }
    if (input.delivery.type === 'pickup' && !this.cfg.pickupPoints.some((p) => p.id === input.delivery.pickupPointId)) {
      throw new PricingError('Пункт самовывоза не найден', 'pickup_not_found');
    }

    const lines = priceLines(input.lines, this.catalog);
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const fee = deliveryFee(subtotal, input.delivery.type, rub(this.cfg.FREE_DELIVERY_FROM_RUB), rub(this.cfg.DELIVERY_FEE_RUB));
    const total = subtotal + fee;
    const online = input.paymentMethod === 'online';

    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new OrderError('Пользователь не найден', 401);

    const row = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(orders)
        .values({
          userId,
          clientRequestId: input.clientRequestId,
          status: online ? 'awaiting_payment' : 'new',
          paymentMethod: input.paymentMethod,
          paymentStatus: online ? 'pending' : 'not_required',
          phone: user.phone,
          customerName: user.name,
          lines,
          delivery: {
            type: input.delivery.type,
            address: input.delivery.type === 'delivery' ? input.delivery.address : null,
            pickupPointId: input.delivery.type === 'pickup' ? input.delivery.pickupPointId : null,
            comment: input.delivery.comment || null,
          },
          subtotal,
          deliveryFee: fee,
          total,
        })
        .returning();
      // Заказ с оплатой при получении сразу уходит в 1С и во внутреннее приложение.
      // Онлайн-заказ уходит после подтверждения оплаты (см. markPaid).
      if (!online) await this.afterConfirmed(tx, created!);
      return created!;
    });

    let paymentUrl: string | null = null;
    if (online) {
      const payment = await this.yookassa!.createPayment({
        orderId: row.id,
        orderNumber: orderNumber(row.seq),
        amount: total,
        returnUrl: `${this.cfg.PUBLIC_URL}/pay/return?order=${row.id}`,
        phone: row.phone,
        lines,
        deliveryFee: fee,
      });
      await this.db.update(orders).set({ yookassaPaymentId: payment.id }).where(eq(orders.id, row.id));
      paymentUrl = payment.confirmation?.confirmation_url ?? null;
    }
    return { order: toOrder(row), paymentUrl };
  }

  private async paymentUrlFor(r: OrderRow): Promise<string | null> {
    if (r.paymentStatus !== 'pending' || !r.yookassaPaymentId || !this.yookassa) return null;
    const p = await this.yookassa.getPayment(r.yookassaPaymentId).catch(() => null);
    return p?.status === 'pending' ? (p.confirmation?.confirmation_url ?? null) : null;
  }

  private async afterConfirmed(tx: Pick<Db, 'insert'>, o: OrderRow) {
    await enqueue(tx, 'onec.order', { orderId: o.id });
    await enqueue(tx, 'internal.webhook', { event: 'order.created', data: toOrder(o) });
    await notifyUser(tx, o.userId, {
      kind: 'order',
      title: `Заказ ${orderNumber(o.seq)} оформлен`,
      body: o.paymentMethod === 'online' ? 'Оплата прошла, начинаем собирать заказ' : 'Скоро свяжемся с вами для подтверждения',
      refId: o.id,
    });
  }

  /**
   * Проверка платежа. Статус берётся из API ЮKassa по id, а не из тела вебхука,
   * поэтому поддельный вебхук ничего не изменит.
   */
  async syncPayment(paymentId: string): Promise<Order | null> {
    if (!this.yookassa) return null;
    const p = await this.yookassa.getPayment(paymentId);
    const orderId = p.metadata?.orderId;
    if (!orderId) return null;
    return this.db.transaction(async (tx) => {
      const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
      if (!o || o.yookassaPaymentId !== p.id) return null;
      if (o.paymentStatus !== 'pending') return toOrder(o);
      if (p.status === 'succeeded') {
        if (Math.round(Number(p.amount.value) * 100) !== o.total) throw new Error('Сумма платежа не совпадает с заказом');
        const [u] = await tx
          .update(orders)
          .set({ paymentStatus: 'succeeded', status: 'new', updatedAt: new Date() })
          .where(eq(orders.id, o.id))
          .returning();
        await this.afterConfirmed(tx, u!);
        return toOrder(u!);
      }
      if (p.status === 'canceled') {
        const [u] = await tx
          .update(orders)
          .set({ paymentStatus: 'canceled', status: 'cancelled', updatedAt: new Date() })
          .where(eq(orders.id, o.id))
          .returning();
        return toOrder(u!);
      }
      return toOrder(o);
    });
  }

  async listForUser(userId: string, limit = 50): Promise<Order[]> {
    const rows = await this.db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(limit);
    return rows.map(toOrder);
  }

  async getForUser(userId: string, id: string): Promise<Order | null> {
    const [r] = await this.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
    if (!r) return null;
    if (r.paymentStatus === 'pending' && r.yookassaPaymentId) {
      // Пользователь вернулся из оплаты раньше вебхука: проверим статус сразу.
      return (await this.syncPayment(r.yookassaPaymentId).catch(() => null)) ?? toOrder(r);
    }
    return toOrder(r);
  }

  async retryPayment(userId: string, id: string): Promise<string | null> {
    const [r] = await this.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
    if (!r) throw new OrderError('Заказ не найден', 404);
    return this.paymentUrlFor(r);
  }

  /** Отмена клиентом: только пока заказ не взят в работу. */
  async cancelByUser(userId: string, id: string): Promise<Order> {
    const [r] = await this.db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
    if (!r) throw new OrderError('Заказ не найден', 404);
    if (!['awaiting_payment', 'new'].includes(r.status) || r.paymentStatus === 'succeeded') {
      throw new OrderError('Заказ уже готовится. Позвоните нам, чтобы отменить.', 409, 'cannot_cancel');
    }
    return this.setStatus(id, 'cancelled', 'client');
  }

  /** Смена статуса из внутреннего приложения или 1С. Клиент получает push. */
  async setStatus(id: string, status: OrderStatus, by: 'internal' | 'client' = 'internal'): Promise<Order> {
    return this.db.transaction(async (tx) => {
      const [r] = await tx.select().from(orders).where(eq(orders.id, id)).for('update');
      if (!r) throw new OrderError('Заказ не найден', 404);
      const from = r.status as OrderStatus;
      if (from === status) return toOrder(r);
      if (!TRANSITIONS[from].includes(status)) {
        throw new OrderError(`Нельзя перевести заказ из «${ORDER_STATUS_TITLE[from]}» в «${ORDER_STATUS_TITLE[status]}»`, 409, 'bad_transition');
      }
      const [u] = await tx.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id)).returning();
      const order = toOrder(u!);
      await enqueue(tx, 'internal.webhook', { event: 'order.status_changed', data: { ...order, changedBy: by } });
      if (by === 'internal') {
        await notifyUser(tx, u!.userId, {
          kind: 'order',
          title: `Заказ ${order.number}: ${ORDER_STATUS_TITLE[status].toLowerCase()}`,
          body: statusText(status, this.cfg.DELIVERY_ETA),
          refId: id,
        });
      }
      return order;
    });
  }

  async listAll(opts: { status?: OrderStatus; since?: Date; limit: number }): Promise<Order[]> {
    const conds = [];
    if (opts.status) conds.push(eq(orders.status, opts.status));
    const rows = await this.db
      .select()
      .from(orders)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(opts.limit);
    return rows.filter((r) => !opts.since || r.updatedAt >= opts.since).map(toOrder);
  }

  async getById(id: string) {
    const [r] = await this.db.select().from(orders).where(eq(orders.id, id));
    return r ? { order: toOrder(r), phone: r.phone, customerName: r.customerName, onecRef: r.onecRef } : null;
  }
}

function statusText(s: OrderStatus, eta: string): string {
  switch (s) {
    case 'accepted':
      return 'Мы приняли заказ и скоро начнём готовить';
    case 'cooking':
      return 'Бариста уже готовит ваш заказ';
    case 'on_the_way':
      return `Курьер выехал, будет примерно через ${eta}`;
    case 'ready_for_pickup':
      return 'Можно забирать';
    case 'done':
      return 'Спасибо! Ждём вас снова';
    case 'cancelled':
      return 'Если это ошибка, позвоните нам';
    default:
      return '';
  }
}
