import type { Addon, Category, Product } from '@kbs/shared';

export interface SyrupBrand {
  id: string;
  title: string;
  flavors: { id: string; title: string }[];
}

/** Готовый каталог, собранный из данных 1С и config/catalog.json. Хранится в БД и в памяти. */
export interface CatalogSnapshot {
  categories: Category[];
  products: Product[];
  addons: Addon[];
  syrupBrands: SyrupBrand[];
  updatedAt: string;
}

/** Настройка соответствия групп 1С разделам приложения: config/catalog.json. */
export interface CatalogConfig {
  /** Разделы магазина (вкладка «Каталог» и лента на главной). */
  shop: CategoryRule[];
  /** Разделы меню кофейни (вкладка «Кофе»). */
  menu: CategoryRule[];
  addons: {
    groups: string[];
    /** По коду товара 1С: особые правила добавок. */
    items: Record<string, { maxQty?: number; needsFlavor?: boolean; sort?: number; title?: string }>;
  };
  /** id раздела магазина, из товаров которого берутся вкусы сиропов для напитков. */
  syrupsCategory: string | null;
  /** Порядок «Подборки для вас» на главной: коды товаров 1С. */
  feed: string[];
  /** Оформление карточек по коду товара 1С. */
  products: Record<string, ProductExtras>;
}

export interface CategoryRule {
  id: string;
  title: string;
  /** Код, Ref_Key или точное название группы в 1С. Подгруппы входят автоматически. */
  groups: string[];
  presentation?: string;
  images?: string[];
}

export interface ProductExtras {
  title?: string;
  subtitle?: string;
  image?: string;
  imageRatio?: number;
  facts?: string[];
  keywords?: string;
  oldPrice?: number;
  color?: string;
  rowBreak?: boolean;
  note?: string;
  hidden?: boolean;
}
