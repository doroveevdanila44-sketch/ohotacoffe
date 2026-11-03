import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from './app';
import { loadConfig } from './config';

/**
 * Демо-режим на Vercel: тот же сервер внутри одной функции, 1С заменена демо-данными,
 * SMS не отправляются (код входа подставляется автоматически).
 * База: DATABASE_URL (например, Neon из Vercel Marketplace). Если не задана, база живёт в памяти
 * функции и сбрасывается при её перезапуске, для показа этого достаточно.
 * Для боевого запуска используйте docker-compose.yml.
 */
let appPromise: ReturnType<typeof buildApp> | null = null;

function getApp() {
  appPromise ??= (async () => {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
    const cfg = loadConfig({
      NODE_ENV: 'test',
      ONEC_MODE: 'mock',
      DATABASE_URL: process.env.DATABASE_URL || 'pglite:memory',
      PUBLIC_URL: host ? `https://${host}/api` : 'http://localhost:3000/api',
      MEDIA_BASE_URL: '/media',
      CATALOG_CONFIG: 'apps/api/config/catalog.json',
      SMS_PROVIDER: 'console',
      DEMO_LOGIN: '1',
      JWT_SECRET: process.env.JWT_SECRET ?? 'demo-secret-change-me-demo-secret-change-me',
    } as NodeJS.ProcessEnv);
    return buildApp({ cfg, logger: { level: 'warn' }, background: false });
  })();
  appPromise.catch(() => (appPromise = null));
  return appPromise;
}

async function readBody(req: IncomingMessage & { body?: unknown }): Promise<string | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return chunks.length ? Buffer.concat(chunks).toString() : undefined;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const { app } = await getApp();
    // Vercel присылает исходный путь /api/...; при переписывании маршрута путь приходит в ?path=
    const u = new URL(req.url ?? '/', 'http://x');
    const p = u.searchParams.get('path');
    let path: string;
    if (p !== null) {
      u.searchParams.delete('path');
      path = '/' + p;
    } else path = u.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
    const qs = u.searchParams.toString();

    const headers = { ...req.headers } as Record<string, string>;
    delete headers['content-length'];
    const r = await app.inject({
      method: req.method as 'GET',
      url: path + (qs ? `?${qs}` : ''),
      headers,
      payload: await readBody(req),
    });
    res.statusCode = r.statusCode;
    for (const [k, v] of Object.entries(r.headers)) if (v !== undefined && k !== 'content-length') res.setHeader(k, v as string);
    res.end(r.rawPayload);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'internal', message: 'Демо-сервер не запустился. Попробуйте обновить страницу.' }));
  }
}
