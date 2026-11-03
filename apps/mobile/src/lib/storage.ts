import { Preferences } from '@capacitor/preferences';
import { createJSONStorage } from 'zustand/middleware';

/** Хранилище на устройстве: UserDefaults на iOS, SharedPreferences на Android, localStorage в браузере. */
export const deviceStorage = createJSONStorage(() => ({
  getItem: async (k: string) => (await Preferences.get({ key: k })).value,
  setItem: (k: string, v: string) => Preferences.set({ key: k, value: v }),
  removeItem: (k: string) => Preferences.remove({ key: k }),
}));

export async function readCache<T>(key: string): Promise<T | undefined> {
  try {
    const { value } = await Preferences.get({ key: `cache:${key}` });
    return value ? (JSON.parse(value) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writeCache(key: string, data: unknown) {
  void Preferences.set({ key: `cache:${key}`, value: JSON.stringify(data) }).catch(() => undefined);
}
