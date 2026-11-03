import pino from 'pino';
import { loadConfig } from '../config';
import { openDb } from '../db/client';
import { createOneCAdapter } from '../onec';
import { CatalogService, loadCatalogConfig } from '../services/catalog';

/** Ручная проверка связи с 1С и выгрузки каталога: npm run sync:1c -w apps/api */
const cfg = loadConfig();
const log = pino({ level: 'info' });
const h = await openDb(cfg.DATABASE_URL);
const onec = createOneCAdapter(cfg);
const catalog = new CatalogService(h.db, onec, loadCatalogConfig(cfg.CATALOG_CONFIG), cfg.MEDIA_BASE_URL || `${cfg.PUBLIC_URL}/media`, log);
try {
  await onec.ping();
  log.info(`1С (${onec.name}) отвечает`);
  await catalog.sync();
  const s = catalog.get();
  log.info({ categories: s.categories.length, products: s.products.length, addons: s.addons.length }, 'Каталог загружен');
  for (const c of s.categories) {
    log.info(`  ${c.kind} ${c.title}: ${s.products.filter((p) => p.categoryId === c.id).length}`);
  }
} catch (e) {
  log.error(e);
  process.exitCode = 1;
} finally {
  await h.close();
}
