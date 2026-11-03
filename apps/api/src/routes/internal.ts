import { timingSafeEqual } from 'node:crypto';
import { desc, isNull, isNotNull, and, like } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { OrderStatus, RepairStage } from '@kbs/shared';
import { outbox } from '../db/schema';
import type { AppDeps } from './context';

const orderStatus = z.enum(['awaiting_payment', 'new', 'accepted', 'cooking', 'on_the_way', 'ready_for_pickup', 'done', 'cancelled']);
const repairStage = z.enum(['new', 'accepted', 'diagnostics', 'approval', 'repair', 'testing', 'ready', 'returned', 'cancelled']);

/**
 * API для внутреннего приложения компании. Доступ по заголовку X-Api-Key.
 * Документация: docs/internal-api.md
 */
export function internalRoutes(app: FastifyInstance, deps: AppDeps) {
  const key = Buffer.from(deps.cfg.INTERNAL_API_KEY);

  app.register(async (r) => {
    r.addHook('onRequest', async (req, reply) => {
      const got = Buffer.from(String(req.headers['x-api-key'] ?? ''));
      if (!key.length || got.length !== key.length || !timingSafeEqual(got, key)) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
    });

    r.get('/orders', async (req) => {
      const q = z
        .object({ status: orderStatus.optional(), since: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(500).default(100) })
        .parse(req.query);
      return { items: await deps.orders.listAll(q) };
    });

    r.get<{ Params: { id: string } }>('/orders/:id', async (req, reply) => {
      const o = await deps.orders.getById(z.string().uuid().parse(req.params.id));
      return o ?? reply.code(404).send({ error: 'not_found' });
    });

    r.post<{ Params: { id: string } }>('/orders/:id/status', async (req) => {
      const body = z.object({ status: orderStatus }).parse(req.body);
      return deps.orders.setStatus(z.string().uuid().parse(req.params.id), body.status as OrderStatus);
    });

    r.get('/repairs', async (req) => {
      const q = z.object({ stage: repairStage.optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
      return { items: await deps.repairs.listAll({ stage: q.stage as RepairStage | undefined, limit: q.limit }) };
    });

    r.patch<{ Params: { id: string } }>('/repairs/:id', async (req) => {
      const body = z
        .object({
          stage: repairStage.optional(),
          note: z.string().max(500).nullable().optional(),
          services: z
            .array(z.object({ title: z.string().min(1), price: z.number().int().min(0), state: z.enum(['done', 'in_progress', 'pending']) }))
            .optional(),
          total: z.number().int().min(0).nullable().optional(),
          readyBy: z.string().datetime({ offset: true }).nullable().optional(),
          masterName: z.string().max(80).nullable().optional(),
          serial: z.string().max(80).nullable().optional(),
        })
        .parse(req.body);
      return deps.repairs.update(z.string().uuid().parse(req.params.id), body as Parameters<typeof deps.repairs.update>[1]);
    });

    r.post('/catalog/sync', async () => {
      await deps.catalog.sync();
      const s = deps.catalog.get();
      return { ok: true, products: s.products.length, updatedAt: s.updatedAt };
    });

    r.get('/health', async () => {
      const onec = await deps.onec
        .ping()
        .then(() => 'ok')
        .catch((e: Error) => e.message);
      const failed = await deps.db
        .select()
        .from(outbox)
        .where(and(isNotNull(outbox.doneAt), like(outbox.lastError, 'СТОП:%')))
        .orderBy(desc(outbox.id))
        .limit(20);
      const pending = await deps.db.select({ id: outbox.id, topic: outbox.topic, attempts: outbox.attempts, lastError: outbox.lastError }).from(outbox).where(isNull(outbox.doneAt)).limit(100);
      return {
        onec,
        catalog: { lastSyncAt: deps.catalog.lastSyncAt, lastError: deps.catalog.lastError },
        outbox: { pending: pending.length, pendingItems: pending, failed },
      };
    });
  }, { prefix: '/internal/v1' });
}
