/**
 * Единый формат обмена с 1С. Его отдаёт HTTP-сервис 1С (см. docs/1c-http-service.md),
 * и к нему же приводятся данные стандартного интерфейса OData.
 * Цены в рублях (как в 1С), в копейки переводит сервер.
 */
export interface OneCGroup {
  ref: string;
  code: string;
  parentRef: string | null;
  title: string;
}

export interface OneCCharacteristic {
  ref: string;
  title: string;
}

export interface OneCItem {
  ref: string;
  code: string;
  article: string | null;
  title: string;
  groupRef: string | null;
  description: string | null;
  unit: string | null;
  characteristics: OneCCharacteristic[];
}

export interface OneCPrice {
  itemRef: string;
  charRef: string | null;
  price: number;
}

export interface OneCStock {
  itemRef: string;
  charRef: string | null;
  qty: number;
}

export interface OneCCatalog {
  groups: OneCGroup[];
  items: OneCItem[];
  prices: OneCPrice[];
  stock: OneCStock[];
}

export interface OneCOrderLine {
  itemRef: string;
  charRef: string | null;
  title: string;
  qty: number;
  price: number;
  sum: number;
}

export interface OneCOrder {
  /** Наш номер заказа, по нему заказ ищут в 1С. */
  number: string;
  externalId: string;
  date: string;
  phone: string;
  customerName: string | null;
  deliveryType: 'delivery' | 'pickup';
  address: string | null;
  pickupPoint: string | null;
  paymentMethod: 'card_on_delivery' | 'cash' | 'online';
  paid: boolean;
  comment: string;
  lines: OneCOrderLine[];
  total: number;
}

export interface OneCRepairRequest {
  number: string;
  externalId: string;
  date: string;
  phone: string;
  customerName: string | null;
  model: string;
  problem: string | null;
  pickupAddress: string | null;
}

export interface OneCAdapter {
  readonly name: string;
  fetchCatalog(): Promise<OneCCatalog>;
  /** Возвращает ссылку на созданный документ в 1С. */
  createOrder(order: OneCOrder): Promise<{ ref: string }>;
  /** Возвращает ссылку на заявку или null, если запись заявок в 1С не настроена. */
  createRepair(repair: OneCRepairRequest): Promise<{ ref: string } | null>;
  /** Бонусный баланс клиента по телефону, если в 1С ведётся программа лояльности. */
  getBonusBalance(phone: string): Promise<number | null>;
  ping(): Promise<void>;
}

export class OneCError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = true,
  ) {
    super(message);
    this.name = 'OneCError';
  }
}
