import { rub, type Addon, type Category, type CategoryKind, type Product, type Variant } from '@kbs/shared';
import type { OneCCatalog, OneCGroup, OneCItem } from '../onec/types';
import type { CatalogConfig, CatalogSnapshot, CategoryRule, SyrupBrand } from './catalog-types';

/** «350 мл» → 350, «0,7 л» → 700, «18 г» → null */
export function parseMl(title: string): number | null {
  const ml = title.match(/(\d+(?:[.,]\d+)?)\s*мл/i);
  if (ml) return Math.round(parseFloat(ml[1]!.replace(',', '.')));
  const l = title.match(/(\d+(?:[.,]\d+)?)\s*л\b/i);
  if (l) return Math.round(parseFloat(l[1]!.replace(',', '.')) * 1000);
  return null;
}

interface BuildOptions {
  mediaBaseUrl: string;
}

/**
 * Превращает выгрузку 1С в каталог приложения: раскладывает товары по разделам
 * (по правилам config/catalog.json), подставляет цены, остатки и оформление.
 * Товары без цены не показываются.
 */
export function buildSnapshot(src: OneCCatalog, cfg: CatalogConfig, opts: BuildOptions): CatalogSnapshot {
  const groupByRef = new Map(src.groups.map((g) => [g.ref, g]));
  const matchesRule = (g: OneCGroup, keys: string[]) =>
    keys.some((k) => k === g.ref || k === g.code || k.toLowerCase() === g.title.toLowerCase());

  /** Для каждой группы 1С находим правило раздела, учитывая вложенность. */
  const resolveRule = (groupRef: string | null, rules: CategoryRule[]): CategoryRule | null => {
    let cur = groupRef ? groupByRef.get(groupRef) : undefined;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.ref)) {
      seen.add(cur.ref);
      const rule = rules.find((r) => matchesRule(cur!, r.groups));
      if (rule) return rule;
      cur = cur.parentRef ? groupByRef.get(cur.parentRef) : undefined;
    }
    return null;
  };
  const isAddonGroup = (groupRef: string | null) =>
    !!resolveRule(groupRef, [{ id: 'addons', title: '', groups: cfg.addons.groups }]);

  const priceOf = new Map<string, number>();
  for (const p of src.prices) priceOf.set(`${p.itemRef}|${p.charRef ?? ''}`, p.price);
  const stockOf = new Map<string, number>();
  for (const s of src.stock) stockOf.set(`${s.itemRef}|${s.charRef ?? ''}`, (stockOf.get(`${s.itemRef}|${s.charRef ?? ''}`) ?? 0) + s.qty);
  const hasStockData = src.stock.length > 0;

  const media = (file: string | undefined | null) => {
    if (!file) return null;
    if (/^https?:\/\//.test(file)) return file;
    return `${opts.mediaBaseUrl.replace(/\/+$/, '')}/${file.replace(/^\/+/, '')}`;
  };

  const variantsOf = (it: OneCItem): Variant[] => {
    const base = priceOf.get(`${it.ref}|`);
    return it.characteristics
      .map((c): Variant | null => {
        const price = priceOf.get(`${it.ref}|${c.ref}`) ?? base;
        if (price === undefined) return null;
        const stock = hasStockData ? (stockOf.get(`${it.ref}|${c.ref}`) ?? 0) : null;
        return { id: c.ref, title: c.title, price: rub(price), ml: parseMl(c.title), stock };
      })
      .filter((v): v is Variant => v !== null);
  };

  const categories: Category[] = [];
  const products: Product[] = [];
  const addons: Addon[] = [];

  const pushCategories = (rules: CategoryRule[], kind: CategoryKind) =>
    rules.forEach((r, i) =>
      categories.push({
        id: r.id,
        parentId: null,
        title: r.title,
        kind,
        sort: i + 1,
        presentation: r.presentation ?? null,
        images: (r.images ?? []).map((x) => media(x)!).filter(Boolean),
      }),
    );
  pushCategories(cfg.shop, 'shop');
  pushCategories(cfg.menu, 'menu');

  for (const it of src.items) {
    const ex = cfg.products[it.code] ?? {};
    if (ex.hidden) continue;

    if (isAddonGroup(it.groupRef)) {
      const rule = cfg.addons.items[it.code] ?? {};
      const variants = variantsOf(it);
      const base = priceOf.get(`${it.ref}|`);
      const priceByMl = variants.length
        ? Object.fromEntries(variants.filter((v) => v.ml).map((v) => [String(v.ml), v.price]))
        : null;
      const price = base !== undefined ? rub(base) : (variants[0]?.price ?? null);
      if (price === null) continue;
      addons.push({
        id: it.ref,
        title: rule.title ?? it.title,
        price,
        priceByMl,
        maxQty: rule.maxQty ?? 1,
        needsFlavor: !!rule.needsFlavor,
        sort: rule.sort ?? 100,
      });
      continue;
    }

    const shopRule = resolveRule(it.groupRef, cfg.shop);
    const menuRule = shopRule ? null : resolveRule(it.groupRef, cfg.menu);
    const rule = shopRule ?? menuRule;
    if (!rule) continue;
    const kind: CategoryKind = shopRule ? 'shop' : 'menu';

    // Напитки готовятся под заказ: остатки для них не учитываем.
    const variants = variantsOf(it).map((v) => (kind === 'menu' ? { ...v, stock: null } : v));
    const basePrice = priceOf.get(`${it.ref}|`);
    const price = variants.length ? Math.min(...variants.map((v) => v.price)) : basePrice !== undefined ? rub(basePrice) : null;
    if (price === null) continue;

    const stock = !hasStockData || kind === 'menu'
      ? null
      : variants.length
        ? variants.reduce((a, v) => a + (v.stock ?? 0), 0)
        : (stockOf.get(`${it.ref}|`) ?? 0);

    const title = ex.title ?? it.title;
    const feedIdx = cfg.feed.indexOf(it.code);
    products.push({
      id: it.ref,
      code: it.code,
      title,
      subtitle: ex.subtitle ?? '',
      description: it.description || ex.description || '',
      categoryId: rule.id,
      kind,
      price,
      oldPrice: ex.oldPrice ? rub(ex.oldPrice) : null,
      image: media(ex.image),
      imageRatio: ex.imageRatio ?? null,
      stock,
      facts: ex.facts ?? [],
      hasVariants: kind === 'shop' && variants.length > 0,
      variants,
      searchText: [title, ex.subtitle, ex.keywords, it.article, it.code].filter(Boolean).join(' ').toLowerCase(),
      featured: feedIdx >= 0 ? feedIdx : null,
      color: ex.color ?? null,
      rowBreak: !!ex.rowBreak,
      note: ex.note ?? null,
    });
  }

  // Картинки разделов магазина по умолчанию: первые три товара раздела.
  for (const c of categories) {
    if (c.kind !== 'shop' || c.images.length) continue;
    c.images = products.filter((p) => p.categoryId === c.id && p.image).slice(0, 3).map((p) => p.image!);
  }

  const syrupBrands: SyrupBrand[] = cfg.syrupsCategory
    ? products
        .filter((p) => p.categoryId === cfg.syrupsCategory && p.variants.length)
        .map((p) => ({
          id: p.id,
          title: p.title.replace(/^Сиропы\s+/i, ''),
          flavors: p.variants.map((v) => ({ id: v.id, title: v.title })),
        }))
    : [];

  addons.sort((a, b) => a.sort - b.sort);
  return { categories, products, addons, syrupBrands, updatedAt: new Date().toISOString() };
}
