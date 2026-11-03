import { SignJWT, importPKCS8 } from 'jose';
import type { Config } from '../config';

export interface PushSender {
  readonly enabled: boolean;
  send(token: string, msg: { title: string; body: string; data?: Record<string, string> }): Promise<'ok' | 'invalid_token'>;
}

/**
 * Firebase Cloud Messaging HTTP v1. Один канал для Android и iOS
 * (в Firebase загружается APNs-ключ Apple). Ключ сервисного аккаунта берётся из окружения.
 */
export class FcmPush implements PushSender {
  readonly enabled = true;
  private token: { value: string; exp: number } | null = null;

  constructor(
    private readonly projectId: string,
    private readonly clientEmail: string,
    private readonly privateKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.exp > Date.now() + 60_000) return this.token.value;
    const key = await importPKCS8(this.privateKey.replace(/\\n/g, '\n'), 'RS256');
    const now = Math.floor(Date.now() / 1000);
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(this.clientEmail)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);
    const res = await this.fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error('FCM: не удалось получить access token');
    this.token = { value: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }

  async send(token: string, msg: { title: string; body: string; data?: Record<string, string> }) {
    const res = await this.fetchImpl(`https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await this.accessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: msg.data ?? {},
          apns: { payload: { aps: { sound: 'default' } } },
          android: { priority: 'high', notification: { color: '#7b4fd6' } },
        },
      }),
    });
    if (res.ok) return 'ok' as const;
    const text = await res.text();
    if (res.status === 404 || text.includes('UNREGISTERED') || text.includes('INVALID_ARGUMENT')) return 'invalid_token' as const;
    throw new Error(`FCM ${res.status}: ${text.slice(0, 300)}`);
  }
}

export class NoopPush implements PushSender {
  readonly enabled = false;
  async send() {
    return 'ok' as const;
  }
}

export function createPush(cfg: Config): PushSender {
  return cfg.FCM_PROJECT_ID && cfg.FCM_CLIENT_EMAIL && cfg.FCM_PRIVATE_KEY
    ? new FcmPush(cfg.FCM_PROJECT_ID, cfg.FCM_CLIENT_EMAIL, cfg.FCM_PRIVATE_KEY)
    : new NoopPush();
}
