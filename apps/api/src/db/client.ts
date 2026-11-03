import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

export type Schema = typeof schema;

/**
 * Общий тип для боевого PostgreSQL (node-postgres) и встроенного PGlite (разработка и тесты).
 * Оба драйвера Drizzle дают одинаковый API запросов.
 */
export type Db = import('drizzle-orm/node-postgres').NodePgDatabase<Schema>;

export interface DbHandle {
  db: Db;
  close: () => Promise<void>;
}

const here = dirname(fileURLToPath(import.meta.url));
/** Папка с SQL-миграциями drizzle. Ищем рядом с исходниками и рядом со сборкой. */
export const migrationsFolder =
  [resolve(here, '../../drizzle'), resolve(here, '../drizzle'), resolve(process.cwd(), 'drizzle')].find((p) =>
    existsSync(p),
  ) ?? resolve(process.cwd(), 'drizzle');

export async function openDb(url: string): Promise<DbHandle> {
  if (url.startsWith('pglite:')) {
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const target = url.slice('pglite:'.length);
    const client =
      target === 'memory' || target === ''
        ? new PGlite()
        : (mkdirSync(target, { recursive: true }), new PGlite(target));
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder });
    return { db: db as unknown as Db, close: () => client.close() };
  }
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const pool = new Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder });
  return { db, close: () => pool.end() };
}
