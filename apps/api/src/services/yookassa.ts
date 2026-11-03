import type { OrderLine } from '@kbs/shared';

export interface YooPayment {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  paid: boolean;
  amount: { value: string; currency: string };
  metadata?: Record<string, string>;
  confirmation?: { type: string; confirmation_url?: string };
}

export interface YooKassaOptions {
  shopId: string;
  secretKey: string;
  sendReceipt: boolean;
  vatCode: number;
  fetchImpl?: typeof fetch;
}

const API = 'https://api.yookassa.ru/v3';
const money = (kop: number) => ({ value: (kop / 100).toFixed(2), currency: 'RUB' });

/** Минимальный клиент API ЮKassa v3: создание платежа и проверка статуса. */
export class YooKassa {
  private readonly auth: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: YooKassaOptions) {
    this.auth = 'Basic ' + Buffer.from(`${opts.shopId}:${opts.secretKey}`).toString('base64');
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown, idempotenceKey?: string): Promise<T> {
    const res = await this.fetchImpl(`${API}${path}`, {
      method,
      headers: {
        Authorization: this.auth,
        'Content-Type': 'application/json',
        ...(idempotenceKey ? { 'Idempotence-Key': idempotenceKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T & { description?: string };
    if (!res.ok) throw new Error(`ЮKassa ${res.status}: ${data.description ?? 'ошибка'}`);
    return data;
  }

  /**
   * Создаёт платёж с подтверждением через страницу ЮKassa (карта, СБП, SberPay, T-Pay).
   * Чек 54-ФЗ передаётся, если включён YOOKASSA_SEND_RECEIPT.
   */
  createPayment(p: {
    orderId: string;
    orderNumber: string;
    amount: number;
    returnUrl: string;
    phone: string;
    lines: OrderLine[];
    deliveryFee: number;
  }): Promise<YooPayment> {
    const receipt = this.opts.sendReceipt
      ? {
          customer: { phone: p.phone.replace('+', '') },
          items: [
            ...p.lines.map((l) => ({
              description: [l.title, l.variantTitle].filter(Boolean).join(', ').slice(0, 128),
              quantity: String(l.qty),
              amount: money(l.unitPrice),
              vat_code: this.opts.vatCode,
              payment_subject: 'commodity',
              payment_mode: 'full_payment',
            })),
            ...(p.deliveryFee
              ? [
                  {
                    description: 'Доставка',
                    quantity: '1',
                    amount: money(p.deliveryFee),
                    vat_code: this.opts.vatCode,
                    payment_subject: 'service',
                    payment_mode: 'full_payment',
                  },
                ]
              : []),
          ],
        }
      : undefined;
    return this.call<YooPayment>(
      'POST',
      '/payments',
      {
        amount: money(p.amount),
        capture: true,
        confirmation: { type: 'redirect', return_url: p.returnUrl },
        description: `Заказ ${p.orderNumber} в приложении «Охота кофе»`,
        metadata: { orderId: p.orderId },
        ...(receipt ? { receipt } : {}),
      },
      `order-${p.orderId}`,
    );
  }

  getPayment(id: string): Promise<YooPayment> {
    return this.call<YooPayment>('GET', `/payments/${encodeURIComponent(id)}`);
  }
}
