import { and, desc, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createOrderSchema,
  createRepairSchema,
  deviceSchema,
  requestCodeSchema,
  updateMeSchema,
  verifyCodeSchema,
  type AppNotification,
  type User,
} from '@kbs/shared';
import { devices, notifications, orders, users } from '../db/schema';
import { enqueue } from '../services/outbox';
import { requireUser, type AppDeps } from './context';

export function userRoutes(app: FastifyInstance, deps: AppDeps) {
  const { db, auth, onec } = deps;
  const authed = { preHandler: requireUser(deps) };
  const bonusCache = new Map<string, { value: number; at: number }>();

  async function bonusFor(phone: string): Promise<number> {
    const c = bonusCache.get(phone);
    if (c && Date.now() - c.at < 5 * 60_000) return c.value;
    const v = await Promise.race([
      onec.getBonusBalance(phone).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 3000)),
    ]);
    const value = v ?? c?.value ?? 0;
    bonusCache.set(phone, { value, at: Date.now() });
    return value;
  }

  /* ---------- вход по SMS ---------- */
  app.post('/v1/auth/request-code', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req) => {
    const body = requestCodeSchema.parse(req.body);
    return auth.requestCode(body.phone);
  });

  app.post('/v1/auth/verify', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req) => {
    const body = verifyCodeSchema.parse(req.body);
    return auth.verifyCode(body.phone, body.code);
  });

  /* ---------- профиль ---------- */
  app.get('/v1/me', authed, async (req): Promise<User> => {
    const [u] = await db.select().from(users).where(eq(users.id, req.user!.userId));
    return { id: u!.id, phone: u!.phone, name: u!.name, city: u!.city, bonus: await bonusFor(u!.phone) };
  });

  app.patch('/v1/me', authed, async (req): Promise<User> => {
    const body = updateMeSchema.parse(req.body);
    const [u] = await db
      .update(users)
      .set({ ...(body.name !== undefined ? { name: body.name } : {}), ...(body.city !== undefined ? { city: body.city || null } : {}) })
      .where(eq(users.id, req.user!.userId))
      .returning();
    return { id: u!.id, phone: u!.phone, name: u!.name, city: u!.city, bonus: await bonusFor(u!.phone) };
  });

  /** Удаление аккаунта (требование App Store и Google Play). История заказов остаётся обезличенной для бухучёта. */
  app.delete('/v1/me', authed, async (req, reply) => {
    const userId = req.user!.userId;
    await db.transaction(async (tx) => {
      await tx.update(orders).set({ customerName: null }).where(eq(orders.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
      await enqueue(tx, 'internal.webhook', { event: 'user.deleted', data: { userId, phone: req.user!.phone } });
    });
    return reply.code(204).send();
  });

  app.post('/v1/me/devices', authed, async (req, reply) => {
    const body = deviceSchema.parse(req.body);
    await db
      .insert(devices)
      .values({ userId: req.user!.userId, token: body.token, platform: body.platform })
      .onConflictDoUpdate({ target: [devices.userId, devices.token], set: { platform: body.platform, updatedAt: new Date() } });
    return reply.code(204).send();
  });

  app.delete('/v1/me/devices', authed, async (req, reply) => {
    const body = z.object({ token: z.string() }).parse(req.body);
    await db.delete(devices).where(and(eq(devices.userId, req.user!.userId), eq(devices.token, body.token)));
    return reply.code(204).send();
  });

  /* ---------- уведомления ---------- */
  app.get('/v1/notifications', authed, async (req): Promise<{ items: AppNotification[]; unread: number }> => {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.user!.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(100);
    return {
      items: rows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        kind: n.kind as AppNotification['kind'],
        refId: n.refId,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      unread: rows.filter((n) => !n.readAt).length,
    };
  });

  app.post('/v1/notifications/read', authed, async (req, reply) => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, req.user!.userId), isNull(notifications.readAt)));
    return reply.code(204).send();
  });

  /* ---------- заказы ---------- */
  app.post('/v1/orders', authed, async (req, reply) => {
    const body = createOrderSchema.parse(req.body);
    const res = await deps.orders.create(req.user!.userId, body);
    return reply.code(201).send(res);
  });

  app.get('/v1/orders', authed, async (req) => ({ items: await deps.orders.listForUser(req.user!.userId) }));

  app.get<{ Params: { id: string } }>('/v1/orders/:id', authed, async (req, reply) => {
    const o = await deps.orders.getForUser(req.user!.userId, z.string().uuid().parse(req.params.id));
    return o ?? reply.code(404).send({ error: 'not_found', message: 'Заказ не найден' });
  });

  app.post<{ Params: { id: string } }>('/v1/orders/:id/pay', authed, async (req) => ({
    paymentUrl: await deps.orders.retryPayment(req.user!.userId, z.string().uuid().parse(req.params.id)),
  }));

  app.post<{ Params: { id: string } }>('/v1/orders/:id/cancel', authed, async (req) =>
    deps.orders.cancelByUser(req.user!.userId, z.string().uuid().parse(req.params.id)),
  );

  /* ---------- ремонт ---------- */
  app.post('/v1/repairs', authed, async (req, reply) => {
    const body = createRepairSchema.parse(req.body);
    return reply.code(201).send(await deps.repairs.create(req.user!.userId, body));
  });

  app.get('/v1/repairs', authed, async (req) => ({ items: await deps.repairs.listForUser(req.user!.userId) }));

  app.get<{ Params: { id: string } }>('/v1/repairs/:id', authed, async (req, reply) => {
    const r = await deps.repairs.getForUser(req.user!.userId, z.string().uuid().parse(req.params.id));
    return r ?? reply.code(404).send({ error: 'not_found', message: 'Заявка не найдена' });
  });

  /* ---------- вебхук ЮKassa ---------- */
  app.post('/webhooks/yookassa', async (req, reply) => {
    const body = z
      .object({ event: z.string(), object: z.object({ id: z.string() }).passthrough() })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send();
    if (body.data.event.startsWith('payment.')) {
      await deps.orders.syncPayment(body.data.object.id);
    }
    return reply.code(200).send({ ok: true });
  });
}
