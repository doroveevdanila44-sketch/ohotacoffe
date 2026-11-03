import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import type { Config } from '../config';
import type { Db } from '../db/client';
import { authCodes, users } from '../db/schema';
import type { SmsSender } from './sms';

const CODE_TTL_MS = 5 * 60_000;
const RESEND_AFTER_MS = 60_000;
const MAX_ATTEMPTS = 5;

export const DEMO_USER = { id: '00000000-0000-4000-8000-000000000001', phone: '+79145550123', name: 'Олег' };

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
  }
}

export class AuthService {
  private readonly key: Uint8Array;

  constructor(
    private readonly db: Db,
    private readonly cfg: Config,
    private readonly sms: SmsSender,
  ) {
    this.key = new TextEncoder().encode(cfg.JWT_SECRET);
  }

  private hash(phone: string, code: string) {
    return createHash('sha256').update(`${phone}:${code}:${this.cfg.JWT_SECRET}`).digest('hex');
  }

  /** Отправляет код. В режиме разработки возвращает его, чтобы не ждать SMS. */
  async requestCode(phone: string): Promise<{ devCode?: string; resendIn: number }> {
    const [prev] = await this.db.select().from(authCodes).where(eq(authCodes.phone, phone));
    const now = Date.now();
    if (prev && now - prev.sentAt.getTime() < RESEND_AFTER_MS) {
      throw new AuthError('Код уже отправлен. Повторить можно через минуту.', 429);
    }
    const isReview = this.cfg.reviewPhones.includes(phone);
    const code = isReview ? '0000' : String(randomInt(0, 10000)).padStart(4, '0');
    const row = {
      phone,
      codeHash: this.hash(phone, code),
      attempts: 0,
      expiresAt: new Date(now + CODE_TTL_MS),
      sentAt: new Date(now),
      consentAt: new Date(now),
    };
    await this.db.insert(authCodes).values(row).onConflictDoUpdate({ target: authCodes.phone, set: row });
    if (!isReview) await this.sms.send(phone, `Охота кофе: код входа ${code}. Никому его не сообщайте.`);
    const exposeCode = this.cfg.NODE_ENV !== 'production' && this.cfg.SMS_PROVIDER === 'console';
    return { resendIn: RESEND_AFTER_MS / 1000, ...(exposeCode ? { devCode: code } : {}) };
  }

  async verifyCode(phone: string, code: string): Promise<{ token: string; userId: string; isNew: boolean }> {
    const [row] = await this.db.select().from(authCodes).where(eq(authCodes.phone, phone));
    if (!row || row.expiresAt.getTime() < Date.now()) throw new AuthError('Код устарел. Запросите новый.');
    if (row.attempts >= MAX_ATTEMPTS) throw new AuthError('Слишком много попыток. Запросите новый код.', 429);
    const ok = timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(this.hash(phone, code)));
    if (!ok) {
      await this.db.update(authCodes).set({ attempts: row.attempts + 1 }).where(eq(authCodes.phone, phone));
      throw new AuthError('Неверный код');
    }
    await this.db.delete(authCodes).where(eq(authCodes.phone, phone));

    let [user] = await this.db.select().from(users).where(eq(users.phone, phone));
    let isNew = false;
    if (!user) {
      [user] = await this.db.insert(users).values({ phone, consentAt: row.consentAt ?? new Date() }).returning();
      isNew = true;
    }
    const token = await new SignJWT({ phone })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user!.id)
      .setIssuedAt()
      .setExpirationTime('90d')
      .sign(this.key);
    return { token, userId: user!.id, isNew };
  }

  /** Демо: гарантирует, что выдуманный пользователь есть в базе (функции на Vercel не делят память). */
  private async ensureDemoUser() {
    await this.db.insert(users).values({ id: DEMO_USER.id, phone: DEMO_USER.phone, name: DEMO_USER.name, consentAt: new Date() }).onConflictDoNothing();
  }

  async demoLogin(): Promise<{ token: string; userId: string }> {
    if (this.cfg.DEMO_LOGIN !== '1') throw new AuthError('Недоступно', 404);
    await this.ensureDemoUser();
    const token = await new SignJWT({ phone: DEMO_USER.phone })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(DEMO_USER.id)
      .setIssuedAt()
      .setExpirationTime('90d')
      .sign(this.key);
    return { token, userId: DEMO_USER.id };
  }

  /** Возвращает id пользователя или null. Удалённый пользователь не проходит. */
  async verifyToken(token: string): Promise<{ userId: string; phone: string } | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ['HS256'] });
      if (!payload.sub) return null;
      if (this.cfg.DEMO_LOGIN === '1' && payload.sub === DEMO_USER.id) await this.ensureDemoUser();
      const [u] = await this.db.select({ id: users.id, phone: users.phone }).from(users).where(eq(users.id, payload.sub));
      return u ? { userId: u.id, phone: u.phone } : null;
    } catch {
      return null;
    }
  }
}
