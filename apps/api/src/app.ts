import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { ZodError } from 'zod';
import type { Config } from './config';
import { openDb, type DbHandle } from './db/client';
import { createOneCAdapter } from './onec';
import type { OneCAdapter } from './onec/types';
import { AuthService } from './services/auth';
import { CatalogService, loadCatalogConfig } from './services/catalog';
import { OrdersService } from './services/orders';
import { OutboxWorker } from './services/outbox';
import { createPush, type PushSender } from './services/push';
import { RepairsService } from './services/repairs';
import { createSms, type SmsSender } from './services/sms';
import { YooKassa } from './services/yookassa';
import type { AppDeps } from './routes/context';
import { internalRoutes } from './routes/internal';
import { publicRoutes } from './routes/public';
import { userRoutes } from './routes/user';

export interface BuildOptions {
  cfg: Config;
  onec?: OneCAdapter;
  sms?: SmsSender;
  push?: PushSender;
  fetchImpl?: typeof fetch;
  logger?: FastifyServerOptions['logger'];
  /** false: не запускать фоновые таймеры (для тестов). */
  background?: boolean;
}

export async function buildApp(opts: BuildOptions) {
  const { cfg } = opts;
  const app = Fastify({
    logger: opts.logger ?? (cfg.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : true),
    trustProxy: true,
    bodyLimit: 256 * 1024,
  });

  const handle: DbHandle = await openDb(cfg.DATABASE_URL);
  const db = handle.db;
  const onec = opts.onec ?? createOneCAdapter(cfg);
  const mediaBase = cfg.MEDIA_BASE_URL || `${cfg.PUBLIC_URL}/media`;
  const catalog = new CatalogService(db, onec, loadCatalogConfig(cfg.CATALOG_CONFIG), mediaBase, app.log);
  const yookassa = cfg.onlinePaymentEnabled
    ? new YooKassa({
        shopId: cfg.YOOKASSA_SHOP_ID,
        secretKey: cfg.YOOKASSA_SECRET_KEY,
        sendReceipt: cfg.YOOKASSA_SEND_RECEIPT,
        vatCode: cfg.YOOKASSA_VAT_CODE,
        fetchImpl: opts.fetchImpl,
      })
    : null;
  const deps: AppDeps = {
    cfg,
    db,
    onec,
    catalog,
    auth: new AuthService(db, cfg, opts.sms ?? createSms(cfg, app.log)),
    orders: new OrdersService(db, cfg, catalog, yookassa),
    repairs: new RepairsService(db),
    outbox: new OutboxWorker(db, cfg, onec, opts.push ?? createPush(cfg), catalog, app.log, opts.fetchImpl),
  };

  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } });
  await app.register(cors, {
    origin: cfg.CORS_ORIGINS.split(',').map((s) => s.trim()),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });
  await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return reply.code(400).send({ error: 'validation', message: first?.message ?? 'Проверьте данные', issues: err.issues });
    }
    const e = err as Error & { statusCode?: number; code?: string };
    const status = e.statusCode ?? 500;
    if (status >= 500) req.log.error({ err }, 'Ошибка запроса');
    return reply.code(status).send({
      error: status >= 500 ? 'internal' : (e.code ?? 'error'),
      message: status >= 500 ? 'Что-то пошло не так. Попробуйте ещё раз.' : e.message,
    });
  });

  publicRoutes(app, deps);
  userRoutes(app, deps);
  internalRoutes(app, deps);

  await catalog.init();
  if (opts.background !== false) {
    catalog.start(cfg.ONEC_SYNC_INTERVAL_MIN);
    deps.outbox.start();
  }

  app.addHook('onClose', async () => {
    catalog.stop();
    deps.outbox.stop();
    await handle.close();
  });

  return { app, deps };
}
