import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { deviceStorage } from '../lib/storage';

export interface CartModifier {
  addonId: string;
  qty: number;
  flavorId: string | null;
}

export interface CartLine {
  key: string;
  productId: string;
  variantId: string | null;
  qty: number;
  modifiers: CartModifier[];
  /** Название на момент добавления, если товар пропадёт из каталога. */
  title: string;
}

export interface Checkout {
  mode: 'delivery' | 'pickup';
  address: string;
  comment: string;
  pickupPointId: string | null;
  pay: 'card_on_delivery' | 'cash' | 'online';
}

interface CartState {
  lines: CartLine[];
  favs: string[];
  checkout: Checkout;
  add: (l: Omit<CartLine, 'key' | 'qty'>, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  toggleFav: (id: string) => void;
  setCheckout: (p: Partial<Checkout>) => void;
}

export const lineKey = (l: Pick<CartLine, 'productId' | 'variantId' | 'modifiers'>) =>
  [l.productId, l.variantId ?? '', ...l.modifiers.map((m) => `${m.addonId}:${m.qty}:${m.flavorId ?? ''}`).sort()].join('|');

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      favs: [],
      checkout: { mode: 'delivery', address: '', comment: '', pickupPointId: null, pay: 'card_on_delivery' },
      add: (l, qty = 1) =>
        set((s) => {
          const key = lineKey(l);
          const ex = s.lines.find((x) => x.key === key);
          return {
            lines: ex ? s.lines.map((x) => (x.key === key ? { ...x, qty: Math.min(50, x.qty + qty) } : x)) : [...s.lines, { ...l, key, qty }],
          };
        }),
      setQty: (key, qty) =>
        set((s) => ({ lines: qty > 0 ? s.lines.map((x) => (x.key === key ? { ...x, qty: Math.min(50, qty) } : x)) : s.lines.filter((x) => x.key !== key) })),
      clear: () => set({ lines: [] }),
      toggleFav: (id) => set((s) => ({ favs: s.favs.includes(id) ? s.favs.filter((x) => x !== id) : [...s.favs, id] })),
      setCheckout: (p) => set((s) => ({ checkout: { ...s.checkout, ...p } })),
    }),
    { name: 'cart', storage: deviceStorage, version: 1 },
  ),
);

export const cartCount = (lines: CartLine[]) => lines.reduce((a, l) => a + l.qty, 0);
