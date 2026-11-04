// Полная проверка перед выпуском: собирает приложение, поднимает сервер с демо-данными и веб-версию,
// прогоняет проверки вёрстки. Выход с кодом 1, если хоть одна не прошла.
// Запуск из корня репозитория: node apps/mobile/scripts/check-all.mjs  (нужен playwright: npx playwright install chromium)
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const env = { ...process.env, API_URL: 'http://localhost:8080', WEB_URL: 'http://127.0.0.1:4173' };
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: 'inherit', cwd: root, env, ...opts });

console.log('Сборка сервера и приложения…');
if (run('npm', ['run', 'build', '-w', '@kbs/api']).status !== 0) process.exit(1);
if (run('npm', ['run', 'build', '-w', '@kbs/mobile'], { env: { ...env, VITE_API_URL: env.API_URL } }).status !== 0) process.exit(1);

// Старый сервер на тех же портах подменил бы данные и дал ложный зелёный результат.
for (const url of [env.API_URL + '/health', env.WEB_URL + '/']) {
  let busy = false;
  try { await fetch(url); busy = true; } catch {}
  if (busy) { console.error(`Порт уже занят (${url}). Остановите старый сервер и повторите, иначе проверка пройдёт на старых данных.`); process.exit(1); }
}
const children = [];
const start = (cmd, args, cwd, extra = {}) => { const c = spawn(cmd, args, { cwd, env: { ...env, ...extra }, stdio: 'ignore' }); children.push(c); return c; };
start('node', ['dist/server.mjs'], resolve(root, 'apps/api'), { DATABASE_URL: 'pglite:memory', NODE_ENV: 'test', PORT: '8080', PUBLIC_URL: env.API_URL, CORS_ORIGINS: env.WEB_URL });
start('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], resolve(root, 'apps/mobile'));

const wait = async (url) => { for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((r) => setTimeout(r, 1000)); } throw new Error('не поднялось: ' + url); };
let failed = false;
try {
  await wait(env.API_URL + '/health'); await wait(env.WEB_URL + '/');
  for (const check of ['layout-check', 'bottom-check', 'coffee-hero-check', 'product-card-check', 'no-bounce-check']) {
    console.log(`\n=== ${check} ===`);
    if (run('node', [`apps/mobile/scripts/${check}.mjs`]).status !== 0) { failed = true; console.log(`ПРОВАЛ: ${check}`); }
  }
} catch (e) { console.error(e.message); failed = true; }
children.forEach((c) => c.kill());
console.log(failed ? '\nПРОВЕРКА НЕ ПРОЙДЕНА' : '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ');
process.exit(failed ? 1 : 0);
