import { OneCHttp, type OneCHttpOptions } from './http-client';
import type { OneCAdapter, OneCCatalog, OneCOrder, OneCRepairRequest } from './types';
import { OneCError } from './types';

/**
 * Коннектор к HTTP-сервису 1С. Контракт описан в docs/1c-http-service.md:
 *   GET  {base}/ping
 *   GET  {base}/catalog
 *   POST {base}/orders
 *   POST {base}/repairs
 *   GET  {base}/bonus?phone=+7…
 */
export class HttpServiceAdapter implements OneCAdapter {
  readonly name = 'http';
  private readonly http: OneCHttp;

  constructor(opts: OneCHttpOptions) {
    this.http = new OneCHttp(opts);
  }

  async ping() {
    await this.http.request('GET', 'ping');
  }

  async fetchCatalog(): Promise<OneCCatalog> {
    const data = await this.http.request<Partial<OneCCatalog>>('GET', 'catalog');
    if (!data || !Array.isArray(data.items)) throw new OneCError('HTTP-сервис 1С вернул каталог без items', undefined, false);
    return {
      groups: data.groups ?? [],
      items: data.items.map((i) => ({ ...i, characteristics: i.characteristics ?? [] })),
      prices: data.prices ?? [],
      stock: data.stock ?? [],
    };
  }

  async createOrder(order: OneCOrder) {
    const res = await this.http.request<{ ref?: string }>('POST', 'orders', order);
    if (!res?.ref) throw new OneCError('HTTP-сервис 1С не вернул ref заказа', undefined, false);
    return { ref: res.ref };
  }

  async createRepair(repair: OneCRepairRequest) {
    const res = await this.http.request<{ ref?: string } | null>('POST', 'repairs', repair);
    return res?.ref ? { ref: res.ref } : null;
  }

  async getBonusBalance(phone: string) {
    try {
      const res = await this.http.request<{ balance?: number }>('GET', `bonus?phone=${encodeURIComponent(phone)}`);
      return typeof res?.balance === 'number' ? res.balance : null;
    } catch (e) {
      if (e instanceof OneCError && e.status === 404) return null;
      throw e;
    }
  }
}
