import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from '../lib/storage';

interface Session {
  token: string | null;
  phone: string | null;
  pushToken: string | null;
  setAuth: (token: string, phone: string) => void;
  setPushToken: (t: string | null) => void;
  logout: () => void;
}

export const useSession = create<Session>()(
  persist(
    (set) => ({
      token: null,
      phone: null,
      pushToken: null,
      setAuth: (token, phone) => set({ token, phone }),
      setPushToken: (pushToken) => set({ pushToken }),
      logout: () => set({ token: null, phone: null }),
    }),
    { name: 'session', storage: deviceStorage },
  ),
);
