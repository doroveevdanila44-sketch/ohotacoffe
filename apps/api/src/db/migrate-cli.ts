import { loadConfig } from '../config';
import { openDb } from './client';

// openDb применяет миграции при подключении.
const cfg = loadConfig();
const h = await openDb(cfg.DATABASE_URL);
await h.close();
console.log('Миграции применены');
