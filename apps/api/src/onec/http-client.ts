import { OneCError } from './types';

export interface OneCHttpOptions {
  baseUrl: string;
  user: string;
  password: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

/** Обёртка над fetch с Basic-авторизацией 1С, таймаутом и разбором ошибок. */
export class OneCHttp {
  private readonly auth: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: OneCHttpOptions) {
    if (!opts.baseUrl) throw new Error('ONEC_BASE_URL не задан');
    this.auth = 'Basic ' + Buffer.from(`${opts.user}:${opts.password}`, 'utf8').toString('base64');
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  url(path: string): string {
    const base = this.opts.baseUrl.replace(/\/+$/, '');
    return `${base}/${path.replace(/^\/+/, '')}`;
  }

  async request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(path), {
        method,
        headers: {
          Authorization: this.auth,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (e) {
      throw new OneCError(`1С недоступна: ${(e as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    if (!res.ok) {
      // 4xx (кроме 408/429) означает ошибку в данных: повтор не поможет.
      const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
      throw new OneCError(`1С ответила ${res.status}: ${text.slice(0, 500)}`, res.status, retryable);
    }
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new OneCError(`1С вернула не JSON: ${text.slice(0, 200)}`);
    }
  }
}
