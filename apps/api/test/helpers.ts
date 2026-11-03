import { randomUUID } from 'node:crypto';
import { loadConfig } from '../src/config';
import { buildApp } from '../src/app';
import { MockAdapter } from '../src/onec/mock-adapter';
import type { PushSender } from '../src/services/push';

export const INTERNAL_KEY = 'internal-test-key-internal-test-key';

export class MemorySms {
  sent: { phone: string; text: string }[] = [];
  async send(phone: string, text: string) {
    this.sent.push({ phone, text });
  }
  lastCode() {
    return this.sent.at(-1)?.text.match(/\d{4}/)?.[0] ?? '';
  }
}

export class MemoryPush implements PushSender {
  readonly enabled = true;
  sent: { token: string; title: string }[] = [];
  async send(token: string, msg: { title: string }) {
    this.sent.push({ token, title: msg.title });
    return token.startsWith('dead') ? ('invalid_token' as const) : ('ok' as const);
  }
}

export async function setup(env: Record<string, string> = {}, fetchImpl?: typeof fetch) {
  const cfg = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'pglite:memory',
    INTERNAL_API_KEY: INTERNAL_KEY,
    INTERNAL_WEBHOOK_URL: 'https://internal.example/hook',
    INTERNAL_WEBHOOK_SECRET: 'whsec',
    PUBLIC_URL: 'https://api.example.ru',
    REVIEW_PHONES: '+79990000000',
    ...env,
  });
  const onec = new MockAdapter();
  const sms = new MemorySms();
  const push = new MemoryPush();
  const hooks: { event: string; signature: string; body: unknown }[] = [];
  const fetchStub: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith('https://internal.example')) {
      const h = new Headers(init?.headers);
      hooks.push({ event: h.get('X-KBS-Event')!, signature: h.get('X-KBS-Signature')!, body: JSON.parse(String(init?.body)) });
      return new Response('ok');
    }
    if (fetchImpl) return fetchImpl(input, init);
    throw new Error(`unexpected fetch ${url}`);
  };
  const { app, deps } = await buildApp({ cfg, onec, sms, push, fetchImpl: fetchStub, logger: false, background: false });

  async function login(phone = '+79001112233') {
    await app.inject({ method: 'POST', url: '/v1/auth/request-code', payload: { phone, consent: true } });
    const res = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { phone, code: sms.lastCode() } });
    const token = res.json().token as string;
    return { authorization: `Bearer ${token}` };
  }

  /** Прогоняет очередь, пока в ней есть готовые события. */
  async function drain() {
    while ((await deps.outbox.tick()) > 0);
  }

  return { app, deps, cfg, onec, sms, push, hooks, login, drain, uuid: randomUUID };
}
