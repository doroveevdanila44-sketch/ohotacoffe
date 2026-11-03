import { create } from 'zustand';

export type Tab = 'home' | 'catalog' | 'coffee' | 'machine' | 'cart' | 'profile';

export type Overlay =
  | { type: 'category'; id: string }
  | { type: 'product'; id: string }
  | { type: 'notifications' }
  | { type: 'login'; reason?: string; then?: 'checkout' | 'repair' | null }
  | { type: 'editProfile' }
  | { type: 'syrup' };

interface Ui {
  tab: Tab;
  tabNonce: number;
  overlays: Overlay[];
  toastText: string;
  toastNonce: number;
  /** Действие, которое нужно выполнить после входа. */
  afterLogin: 'checkout' | 'repair' | null;
  /** Открыть заказ из ссылки (возврат из оплаты, push). */
  focusOrderId: string | null;
  repairStep: 'form' | 'est' | 'track';
  splash: boolean;
  setSplash: (v: boolean) => void;
  setRepairStep: (s: 'form' | 'est' | 'track') => void;
  setTab: (t: Tab) => void;
  open: (o: Overlay) => void;
  close: (type?: Overlay['type']) => void;
  closeAll: () => void;
  toast: (t: string) => void;
  setAfterLogin: (a: Ui['afterLogin']) => void;
  setFocusOrder: (id: string | null) => void;
}

export const useUi = create<Ui>()((set) => ({
  tab: 'home',
  tabNonce: 0,
  overlays: [],
  toastText: '',
  toastNonce: 0,
  afterLogin: null,
  focusOrderId: null,
  repairStep: 'form',
  splash: true,
  setSplash: (splash) => set({ splash }),
  setRepairStep: (repairStep) => set({ repairStep }),
  setTab: (tab) => set((s) => ({ tab, tabNonce: s.tabNonce + 1, overlays: [] })),
  open: (o) => set((s) => ({ overlays: [...s.overlays.filter((x) => x.type !== o.type), o] })),
  close: (type) =>
    set((s) => ({ overlays: type ? s.overlays.filter((x) => x.type !== type) : s.overlays.slice(0, -1) })),
  closeAll: () => set({ overlays: [] }),
  toast: (toastText) => set((s) => ({ toastText, toastNonce: s.toastNonce + 1 })),
  setAfterLogin: (afterLogin) => set({ afterLogin }),
  setFocusOrder: (focusOrderId) => set({ focusOrderId }),
}));

export const toast = (t: string) => useUi.getState().toast(t);
