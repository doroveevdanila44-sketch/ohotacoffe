import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Config } from '../config';
import type { Db } from '../db/client';
import type { OneCAdapter } from '../onec/types';
import type { AuthService } from '../services/auth';
import type { CatalogService } from '../services/catalog';
import type { OrdersService } from '../services/orders';
import type { OutboxWorker } from '../services/outbox';
import type { RepairsService } from '../services/repairs';

export interface AppDeps {
  cfg: Config;
  db: Db;
  onec: OneCAdapter;
  catalog: CatalogService;
  auth: AuthService;
  orders: OrdersService;
  repairs: RepairsService;
  outbox: OutboxWorker;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: { userId: string; phone: string };
  }
}

export function requireUser(deps: AppDeps) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const h = req.headers.authorization;
    const token = h?.startsWith('Bearer ') ? h.slice(7) : null;
    const user = token ? await deps.auth.verifyToken(token) : null;
    if (!user) return reply.code(401).send({ error: 'unauthorized', message: 'Войдите по номеру телефона' });
    req.user = user;
  };
}
