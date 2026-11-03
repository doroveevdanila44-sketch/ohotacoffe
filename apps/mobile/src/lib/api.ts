import { useSession } from '../store/session';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export const DEMO = import.meta.env.VITE_DEMO === '1';

/** Демо-версия: сразу «входим» под выдуманным пользователем, чтобы показать профиль и бонусы. */
let demoPending: Promise<void> | null = null;
export function demoLogin(): Promise<void> {
  demoPending ??= (async () => {
    const phone = '+79145550123';
    const r = await api<{ devCode?: string }>('/v1/auth/request-code', { method: 'POST', body: { phone, consent: true }, noRetry: true });
    const v = await api<{ token: string }>('/v1/auth/verify', { method: 'POST', body: { phone, code: r.devCode ?? '0000' }, noRetry: true });
    useSession.getState().setAuth(v.token, phone);
    await api('/v1/me', { method: 'PATCH', body: { name: 'Олег' }, noRetry: true });
  })().finally(() => {
    demoPending = null;
  });
  return demoPending;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; noRetry?: boolean } = {}): Promise<T> {
  const token = useSession.getState().token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError('Нет связи с сервером. Проверьте интернет.', 0, 'network');
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!res.ok) {
    if (res.status === 401 && token) {
      if (DEMO && !init.noRetry) {
        await demoLogin().catch(() => undefined);
        return api<T>(path, { ...init, noRetry: true });
      }
      useSession.getState().logout();
    }
    throw new ApiError(data.message ?? 'Что-то пошло не так', res.status, data.error ?? 'error');
  }
  return data as T;
}
