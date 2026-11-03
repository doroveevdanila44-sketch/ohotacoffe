// Собирает сервер в один файл dist/server.mjs. Пакет @kbs/shared вшивается в сборку,
// остальные зависимости берутся из node_modules.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((d) => d !== '@kbs/shared');

await build({
  entryPoints: ['src/server.ts', 'src/db/migrate-cli.ts', 'src/scripts/sync-1c.ts'],
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external,
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  logLevel: 'info',
});
