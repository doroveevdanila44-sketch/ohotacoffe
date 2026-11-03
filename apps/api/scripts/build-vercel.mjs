// Собирает демо-сервер для Vercel в /api/index.mjs (корень репозитория) и копирует фото в веб-версию.
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
// Вшиваем всё, кроме баз данных: PGlite хранит рядом файлы wasm, pg подключается только при DATABASE_URL.
void pkg;
const external = ['@electric-sql/pglite', 'pg', 'pg-native'];

await build({
  entryPoints: [resolve(root, 'apps/api/src/vercel.ts')],
  outfile: resolve(root, 'api/index.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external,
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  logLevel: 'info',
});

mkdirSync(resolve(root, 'apps/mobile/public/media'), { recursive: true });
cpSync(resolve(root, 'apps/api/media'), resolve(root, 'apps/mobile/public/media'), { recursive: true });
