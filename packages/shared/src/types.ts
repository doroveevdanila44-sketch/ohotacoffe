import type { Kopecks } from './money';

/** Разделы каталога: товары магазина, меню кофейни, добавки к напиткам. */
export type CategoryKind = 'shop' | 'menu' | 'addon';

export interface Category {
  id: string;
  parentId: string | null;
  title: string;
  kind: CategoryKind;
  sort: number;
  /** Ключ оформления на клиенте (кружка, слоган). Задаётся в маппинге 1С. */
  presentation?: string | null;
  images: string[];
}

export interface Variant {
  id: string;
  /** «350 мл», «Ваниль», «1 кг» */
  title: string;
  price: Kopecks;
  /** Объём напитка в мл (для размеров и цен добавок). */
  ml?: number | null;
  stock?: number | null;
}

export interface Product {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  description: string;
  categoryId: string;
  kind: CategoryKind;
  price: Kopecks;
  oldPrice: Kopecks | null;
  image: string | null;
  /** Ширина/высота фото, чтобы лента не прыгала при загрузке. */
  imageRatio: number | null;
  stock: number | null;
  /** Короткие строки, которые сменяют друг друга под ценой. */
  facts: string[];
  /** Если true, у товара есть варианты (вкусы, размеры), выбор на отдельном экране. */
  hasVariants: boolean;
  variants: Variant[];
  searchText: string;
  featured: number | null;
  /** Цвет напитка (струйка при приготовлении). */
  color: string | null;
  /** Начать новую строку в меню перед этим напитком (группировка). */
  rowBreak: boolean;
  /** Короткое примечание: «Зелёная или голубая», «Регион Кот-д’Ивуар». */
  note: string | null;
}

export interface Addon {
  id: string;
  title: string;
  /** Цена за единицу. Если задано priceByMl, берётся цена по объёму напитка. */
  price: Kopecks;
  priceByMl: Record<string, Kopecks> | null;
  /** Количество за раз можно увеличивать (сахар: до 3). */
  maxQty: number;
  /** Нужно выбрать вкус из сиропов магазина. */
  needsFlavor: boolean;
  sort: number;
}

export interface MenuResponse {
  categories: Category[];
  drinks: Product[];
  addons: Addon[];
  syrupBrands: { id: string; title: string; flavors: { id: string; title: string }[] }[];
}

export interface CatalogResponse {
  categories: Category[];
  products: Product[];
  updatedAt: string;
}

export interface AppSettings {
  freeDeliveryFrom: Kopecks;
  deliveryFee: Kopecks;
  deliveryEta: string;
  pickupPoints: { id: string; title: string; address: string }[];
  onlinePaymentEnabled: boolean;
  supportPhone: string;
  workingHours: string;
  privacyUrl: string;
  termsUrl: string;
}

export type OrderStatus =
  | 'awaiting_payment'
  | 'new'
  | 'accepted'
  | 'cooking'
  | 'on_the_way'
  | 'ready_for_pickup'
  | 'done'
  | 'cancelled';

export type PaymentMethod = 'card_on_delivery' | 'cash' | 'online';
export type PaymentStatus = 'not_required' | 'pending' | 'succeeded' | 'canceled';

export interface OrderLine {
  productId: string;
  variantId: string | null;
  title: string;
  variantTitle: string | null;
  qty: number;
  unitPrice: Kopecks;
  modifiers: { addonId: string; title: string; qty: number; flavorId: string | null; unitPrice: Kopecks }[];
  total: Kopecks;
}

export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  lines: OrderLine[];
  subtotal: Kopecks;
  deliveryFee: Kopecks;
  total: Kopecks;
  delivery: {
    type: 'delivery' | 'pickup';
    address: string | null;
    pickupPointId: string | null;
    comment: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export type RepairStage =
  | 'new'
  | 'accepted'
  | 'diagnostics'
  | 'approval'
  | 'repair'
  | 'testing'
  | 'ready'
  | 'returned'
  | 'cancelled';

export interface RepairService {
  title: string;
  price: Kopecks;
  state: 'done' | 'in_progress' | 'pending';
}

export interface Repair {
  id: string;
  number: string;
  model: string;
  serial: string | null;
  problem: string | null;
  stage: RepairStage;
  history: { stage: RepairStage; at: string; note: string | null }[];
  services: RepairService[];
  estimateMin: Kopecks;
  estimateMax: Kopecks;
  total: Kopecks | null;
  readyBy: string | null;
  master: { name: string } | null;
  pickupAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  phone: string;
  name: string | null;
  city: string | null;
  bonus: number;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  kind: 'order' | 'repair' | 'promo' | 'bonus';
  refId: string | null;
  readAt: string | null;
  createdAt: string;
}

export const ORDER_STATUS_TITLE: Record<OrderStatus, string> = {
  awaiting_payment: 'Ожидает оплаты',
  new: 'Заказ оформлен',
  accepted: 'Заказ принят',
  cooking: 'Готовим',
  on_the_way: 'Курьер в пути',
  ready_for_pickup: 'Готов к выдаче',
  done: 'Заказ получен',
  cancelled: 'Заказ отменён',
};

export const REPAIR_STAGES: { id: RepairStage; title: string; text: string }[] = [
  { id: 'accepted', title: 'Принята', text: 'Приняли машину в сервис-центре и оформили заказ' },
  { id: 'diagnostics', title: 'Диагностика', text: 'Мастер ищет причину неисправности' },
  { id: 'approval', title: 'Согласование', text: 'Согласуем с вами смету ремонта' },
  { id: 'repair', title: 'Ремонт', text: 'Меняем детали и обслуживаем машину' },
  { id: 'testing', title: 'Проверка', text: 'Тестовый прогон перед выдачей' },
  { id: 'ready', title: 'Готова к выдаче', text: 'Позвоним и пришлём уведомление в приложении' },
];
