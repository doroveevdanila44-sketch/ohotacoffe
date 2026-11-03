import type { OrderLine, OrderLineInput } from '@kbs/shared';
import type { CatalogService } from './catalog';

export class PricingError extends Error {
  statusCode = 422;
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/**
 * Пересчитывает корзину по актуальным ценам каталога. Цены с телефона не принимаются:
 * сервер сам берёт цену варианта, добавок и проверяет остатки.
 */
export function priceLines(input: OrderLineInput[], catalog: CatalogService): OrderLine[] {
  const snap = catalog.get();
  const flavorTitle = new Map<string, string>();
  for (const b of snap.syrupBrands) for (const f of b.flavors) flavorTitle.set(f.id, `${f.title} (${b.title})`);

  return input.map((l) => {
    const p = catalog.product(l.productId);
    if (!p) throw new PricingError('Товар больше не продаётся. Обновите корзину.', 'product_not_found');

    let unit = p.price;
    let variantTitle: string | null = null;
    let ml: number | null = null;
    if (p.variants.length) {
      const v = p.variants.find((x) => x.id === l.variantId);
      if (!v) throw new PricingError(`Выберите вариант для «${p.title}»`, 'variant_required');
      if (v.stock !== null && v.stock !== undefined && v.stock < l.qty) {
        throw new PricingError(`«${p.title}, ${v.title}»: в наличии ${v.stock} шт.`, 'out_of_stock');
      }
      unit = v.price;
      variantTitle = v.title;
      ml = v.ml ?? null;
    } else {
      if (l.variantId) throw new PricingError(`У «${p.title}» нет вариантов`, 'variant_unexpected');
      if (p.stock !== null && p.stock < l.qty) {
        throw new PricingError(`«${p.title}»: в наличии ${p.stock} шт.`, 'out_of_stock');
      }
    }

    if (l.modifiers.length && p.kind !== 'menu') {
      throw new PricingError('Добавки доступны только для напитков', 'modifiers_not_allowed');
    }
    const modifiers = l.modifiers.map((m) => {
      const a = catalog.addon(m.addonId);
      if (!a) throw new PricingError('Добавка больше недоступна', 'addon_not_found');
      if (m.qty > a.maxQty) throw new PricingError(`«${a.title}»: не больше ${a.maxQty}`, 'addon_qty');
      let title = a.title;
      if (a.needsFlavor) {
        const ft = m.flavorId ? flavorTitle.get(m.flavorId) : undefined;
        if (!ft) throw new PricingError('Выберите вкус сиропа', 'flavor_required');
        title = `${a.title}: ${ft}`;
      }
      const byMl = ml !== null ? a.priceByMl?.[String(ml)] : undefined;
      const unitPrice = byMl ?? a.price;
      return { addonId: a.id, title, qty: m.qty, flavorId: a.needsFlavor ? m.flavorId : null, unitPrice };
    });

    const lineUnit = unit + modifiers.reduce((s, m) => s + m.unitPrice * m.qty, 0);
    return {
      productId: p.id,
      variantId: l.variantId,
      title: p.title,
      variantTitle,
      qty: l.qty,
      unitPrice: lineUnit,
      modifiers,
      total: lineUnit * l.qty,
    };
  });
}

export function deliveryFee(subtotal: number, type: 'delivery' | 'pickup', freeFrom: number, fee: number) {
  if (type === 'pickup') return 0;
  return subtotal >= freeFrom ? 0 : fee;
}
