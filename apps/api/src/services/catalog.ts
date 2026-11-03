import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Addon, Product } from '@kbs/shared';
import type { Db } from '../db/client';
import { catalogSnapshot } from '../db/schema';
import type { OneCAdapter } from '../onec/types';
import { buildSnapshot } from './catalog-build';
import type { CatalogConfig, CatalogSnapshot } from './catalog-types';

export function loadCatalogConfig(path: string): CatalogConfig {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as CatalogConfig;
}

/**
 * Каталог в памяти + синхронизация с 1С по расписанию.
 * Если 1С недоступна, приложение продолжает работать на последнем сохранённом снимке.
 */
export class CatalogService {
  private snapshot: CatalogSnapshot | null = null;
  private productIndex = new Map<string, Product>();
  private addonIndex = new Map<string, Addon>();
  private timer: NodeJS.Timeout | null = null;
  private syncing: Promise<void> | null = null;
  lastError: string | null = null;
  lastSyncAt: Date | null = null;

  constructor(
    private readonly db: Db,
    private readonly onec: OneCAdapter,
    private readonly cfg: CatalogConfig,
    private readonly mediaBaseUrl: string,
    private readonly log: FastifyBaseLogger,
  ) {}

  private setSnapshot(s: CatalogSnapshot) {
    this.snapshot = s;
    this.productIndex = new Map(s.products.map((p) => [p.id, p]));
    this.addonIndex = new Map(s.addons.map((a) => [a.id, a]));
  }

  /** Загружает последний снимок из БД, затем пробует обновить из 1С. */
  async init() {
    const [row] = await this.db.select().from(catalogSnapshot).where(eq(catalogSnapshot.id, 1));
    if (row) {
      this.setSnapshot(row.data);
      this.lastSyncAt = row.syncedAt;
    }
    await this.sync().catch(() => undefined);
  }

  start(intervalMin: number) {
    this.stop();
    this.timer = setInterval(() => void this.sync().catch(() => undefined), intervalMin * 60_000);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  sync(): Promise<void> {
    if (this.syncing) return this.syncing;
    this.syncing = (async () => {
      const started = Date.now();
      try {
        const raw = await this.onec.fetchCatalog();
        const snap = buildSnapshot(raw, this.cfg, { mediaBaseUrl: this.mediaBaseUrl });
        if (!snap.products.length) throw new Error('В выгрузке 1С нет ни одного товара с ценой: проверьте config/catalog.json');
        await this.db
          .insert(catalogSnapshot)
          .values({ id: 1, data: snap, source: this.onec.name })
          .onConflictDoUpdate({ target: catalogSnapshot.id, set: { data: snap, source: this.onec.name, syncedAt: new Date() } });
        this.setSnapshot(snap);
        this.lastSyncAt = new Date();
        this.lastError = null;
        this.log.info({ products: snap.products.length, ms: Date.now() - started }, 'Каталог 1С синхронизирован');
      } catch (e) {
        this.lastError = (e as Error).message;
        this.log.error({ err: e }, 'Ошибка синхронизации каталога 1С');
        throw e;
      } finally {
        this.syncing = null;
      }
    })();
    return this.syncing;
  }

  get(): CatalogSnapshot {
    if (!this.snapshot) throw Object.assign(new Error('Каталог ещё не загружен из 1С'), { statusCode: 503 });
    return this.snapshot;
  }

  product(id: string) {
    return this.productIndex.get(id);
  }

  addon(id: string) {
    return this.addonIndex.get(id);
  }
}
