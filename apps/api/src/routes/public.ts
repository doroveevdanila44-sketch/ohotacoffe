import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { AppSettings, CatalogResponse, MenuResponse } from '@kbs/shared';
import { rub } from '@kbs/shared';
import type { AppDeps } from './context';
import { privacyHtml, returnHtml, termsHtml } from './pages';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

export function publicRoutes(app: FastifyInstance, deps: AppDeps) {
  const { cfg, catalog } = deps;
  const mediaDir = resolve(process.cwd(), 'media');

  app.get('/health', async () => ({
    ok: true,
    catalog: { loaded: !!catalog.lastSyncAt, lastSyncAt: catalog.lastSyncAt, lastError: catalog.lastError, source: deps.onec.name },
  }));

  app.get('/v1/settings', async (): Promise<AppSettings> => ({
    freeDeliveryFrom: rub(cfg.FREE_DELIVERY_FROM_RUB),
    deliveryFee: rub(cfg.DELIVERY_FEE_RUB),
    deliveryEta: cfg.DELIVERY_ETA,
    pickupPoints: cfg.pickupPoints,
    onlinePaymentEnabled: cfg.onlinePaymentEnabled,
    supportPhone: cfg.SUPPORT_PHONE,
    workingHours: cfg.WORKING_HOURS,
    privacyUrl: `${cfg.PUBLIC_URL}/legal/privacy`,
    termsUrl: `${cfg.PUBLIC_URL}/legal/terms`,
  }));

  app.get('/v1/catalog', async (_req, reply): Promise<CatalogResponse> => {
    const s = catalog.get();
    reply.header('Cache-Control', 'public, max-age=60');
    return {
      categories: s.categories.filter((c) => c.kind === 'shop'),
      products: s.products.filter((p) => p.kind === 'shop'),
      updatedAt: s.updatedAt,
    };
  });

  app.get('/v1/menu', async (_req, reply): Promise<MenuResponse> => {
    const s = catalog.get();
    reply.header('Cache-Control', 'public, max-age=60');
    return {
      categories: s.categories.filter((c) => c.kind === 'menu'),
      drinks: s.products.filter((p) => p.kind === 'menu'),
      addons: s.addons,
      syrupBrands: s.syrupBrands,
    };
  });

  app.get<{ Params: { '*': string } }>('/media/*', async (req, reply) => {
    const file = resolve(mediaDir, req.params['*']);
    if (!file.startsWith(mediaDir + sep) || !existsSync(file) || !statSync(file).isFile()) {
      return reply.code(404).send({ error: 'not_found' });
    }
    reply.header('Content-Type', MIME[extname(file).toLowerCase()] ?? 'application/octet-stream');
    reply.header('Cache-Control', 'public, max-age=604800, immutable');
    return reply.send(createReadStream(file));
  });

  app.get('/legal/privacy', async (_req, reply) => reply.type('text/html; charset=utf-8').send(privacyHtml(cfg)));
  app.get('/legal/terms', async (_req, reply) => reply.type('text/html; charset=utf-8').send(termsHtml(cfg)));

  /** Сюда ЮKassa возвращает после оплаты. Страница открывает приложение по схеме kambarshop://. */
  app.get<{ Querystring: { order?: string } }>('/pay/return', async (req, reply) => {
    const id = (req.query.order ?? '').replace(/[^0-9a-f-]/gi, '');
    return reply.type('text/html; charset=utf-8').send(returnHtml(id));
  });
}
