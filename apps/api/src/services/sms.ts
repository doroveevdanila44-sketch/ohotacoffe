import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../config';

export interface SmsSender {
  send(phone: string, text: string): Promise<void>;
}

/** Для разработки: код пишется в лог сервера. */
export class ConsoleSms implements SmsSender {
  constructor(private readonly log: FastifyBaseLogger) {}
  async send(phone: string, text: string) {
    this.log.warn({ phone, text }, 'SMS (режим console, реальная отправка выключена)');
  }
}

/** SMS.ru: https://sms.ru/api/send */
export class SmsRu implements SmsSender {
  constructor(
    private readonly apiId: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiId) throw new Error('SMSRU_API_ID не задан');
  }

  async send(phone: string, text: string) {
    const qs = new URLSearchParams({ api_id: this.apiId, to: phone.replace('+', ''), msg: text, json: '1' });
    if (this.from) qs.set('from', this.from);
    const res = await this.fetchImpl(`https://sms.ru/sms/send?${qs}`);
    const data = (await res.json().catch(() => null)) as { status?: string; status_text?: string } | null;
    if (!res.ok || data?.status !== 'OK') {
      throw new Error(`SMS не отправлено: ${data?.status_text ?? res.status}`);
    }
  }
}

export function createSms(cfg: Config, log: FastifyBaseLogger): SmsSender {
  return cfg.SMS_PROVIDER === 'smsru' ? new SmsRu(cfg.SMSRU_API_ID, cfg.SMS_SENDER) : new ConsoleSms(log);
}
