import type { Addon, Product } from '@kbs/shared';
import type { CartLine } from '../store/cart';

export interface LineView {
  title: string;
  sub: string;
  unit: number;
  image: string | null;
  color: string | null;
  available: boolean;
}

/** Цена строки для показа. Окончательно цену считает сервер при оформлении. */
export function lineView(l: CartLine, products: Map<string, Product>, addons: Map<string, Addon>, flavors: Map<string, string>): LineView {
  const p = products.get(l.productId);
  if (!p) return { title: l.title, sub: 'Нет в продаже', unit: 0, image: null, color: null, available: false };
  const v = l.variantId ? p.variants.find((x) => x.id === l.variantId) : undefined;
  if (l.variantId && !v) return { title: p.title, sub: 'Вариант недоступен', unit: 0, image: p.image, color: p.color, available: false };
  const ml = v?.ml ?? null;
  let unit = v?.price ?? p.price;
  const names: string[] = [];
  for (const m of l.modifiers) {
    const a = addons.get(m.addonId);
    if (!a) continue;
    const price = (ml !== null ? a.priceByMl?.[String(ml)] : undefined) ?? a.price;
    unit += price * m.qty;
    const t = a.needsFlavor && m.flavorId ? `${a.title.toLowerCase()} ${flavors.get(m.flavorId)?.toLowerCase() ?? ''}` : a.title.toLowerCase();
    names.push(m.qty > 1 ? `${t} ×${m.qty}` : t);
  }
  const sub = p.kind === 'menu' ? [v?.title, ...names].filter(Boolean).join(' · ') : v ? p.title : p.subtitle;
  return { title: v && p.kind !== 'menu' ? v.title : p.title, sub, unit, image: p.image, color: p.color, available: (v?.stock ?? p.stock) !== 0 };
}
