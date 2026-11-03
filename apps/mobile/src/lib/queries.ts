import { useQuery, QueryClient } from '@tanstack/react-query';
import type { AppNotification, AppSettings, CatalogResponse, MenuResponse, Order, Repair, User } from '@kbs/shared';
import { useMemo } from 'react';
import { api } from './api';
import { readCache, writeCache } from './storage';
import { useSession } from '../store/session';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 60_000, refetchOnWindowFocus: true },
  },
});

/** Каталог, меню и настройки кэшируются на устройстве: приложение открывается и без сети. */
const CACHED = ['/v1/settings', '/v1/catalog', '/v1/menu'] as const;

export async function hydrateCache() {
  await Promise.all(
    CACHED.map(async (path) => {
      const data = await readCache(path);
      if (data) queryClient.setQueryData([path], data, { updatedAt: 0 });
    }),
  );
}

const cachedFetch = <T,>(path: string) => async () => {
  const data = await api<T>(path);
  writeCache(path, data);
  return data;
};

export const useSettings = () => useQuery({ queryKey: ['/v1/settings'], queryFn: cachedFetch<AppSettings>('/v1/settings'), staleTime: 10 * 60_000 });
export const useCatalog = () => useQuery({ queryKey: ['/v1/catalog'], queryFn: cachedFetch<CatalogResponse>('/v1/catalog'), staleTime: 5 * 60_000 });
export const useMenu = () => useQuery({ queryKey: ['/v1/menu'], queryFn: cachedFetch<MenuResponse>('/v1/menu'), staleTime: 5 * 60_000 });

const useAuthed = () => !!useSession((s) => s.token);

export const useMe = () => {
  const on = useAuthed();
  return useQuery({ queryKey: ['/v1/me'], queryFn: () => api<User>('/v1/me'), enabled: on });
};
export const useOrders = (live = false) => {
  const on = useAuthed();
  return useQuery({
    queryKey: ['/v1/orders'],
    queryFn: () => api<{ items: Order[] }>('/v1/orders').then((r) => r.items),
    enabled: on,
    refetchInterval: live ? 20_000 : false,
  });
};
export const useRepairs = (live = false) => {
  const on = useAuthed();
  return useQuery({
    queryKey: ['/v1/repairs'],
    queryFn: () => api<{ items: Repair[] }>('/v1/repairs').then((r) => r.items),
    enabled: on,
    refetchInterval: live ? 60_000 : false,
  });
};
export const useNotifications = () => {
  const on = useAuthed();
  return useQuery({
    queryKey: ['/v1/notifications'],
    queryFn: () => api<{ items: AppNotification[]; unread: number }>('/v1/notifications'),
    enabled: on,
    refetchInterval: 60_000,
  });
};

/** Все товары магазина и напитки по id, добавки и названия вкусов сиропов. */
export function useIndex() {
  const catalog = useCatalog().data;
  const menu = useMenu().data;
  return useMemo(() => {
    const products = new Map([...(catalog?.products ?? []), ...(menu?.drinks ?? [])].map((p) => [p.id, p]));
    const addons = new Map((menu?.addons ?? []).map((a) => [a.id, a]));
    const flavors = new Map<string, string>();
    for (const b of menu?.syrupBrands ?? []) for (const f of b.flavors) flavors.set(f.id, f.title);
    return { products, addons, flavors };
  }, [catalog, menu]);
}

export const invalidateUser = () => {
  void queryClient.invalidateQueries({ queryKey: ['/v1/me'] });
  void queryClient.invalidateQueries({ queryKey: ['/v1/orders'] });
  void queryClient.invalidateQueries({ queryKey: ['/v1/repairs'] });
  void queryClient.invalidateQueries({ queryKey: ['/v1/notifications'] });
};
