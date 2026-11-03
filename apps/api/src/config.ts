import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(8080),
  HOST: z.string().default('0.0.0.0'),
  /** Публичный адрес сервера, нужен для возврата из ЮKassa и ссылок на фото. */
  PUBLIC_URL: z.string().url().default('http://localhost:8080'),
  /** postgres://… для боевой базы. pglite:memory или pglite:./data для локальной разработки. */
  DATABASE_URL: z.string().default('pglite:./.data/pglite'),
  JWT_SECRET: z.string().min(32).default('dev-secret-change-me-dev-secret-change-me'),
  CORS_ORIGINS: z.string().default('capacitor://localhost,http://localhost,https://localhost,http://localhost:5173,http://localhost:4173'),

  /* ---------- 1С ---------- */
  /** mock: демо-данные; odata: стандартный интерфейс OData; http: HTTP-сервис 1С по нашему контракту. */
  ONEC_MODE: z.enum(['mock', 'odata', 'http']).default('mock'),
  ONEC_BASE_URL: z.string().default(''),
  ONEC_USER: z.string().default(''),
  ONEC_PASSWORD: z.string().default(''),
  ONEC_TIMEOUT_MS: z.coerce.number().int().default(20000),
  ONEC_SYNC_INTERVAL_MIN: z.coerce.number().int().min(1).default(10),
  /** Записывать заказы и заявки на ремонт в 1С. */
  ONEC_WRITE_ORDERS: bool.default(true),
  /** Файл соответствия объектов 1С для режима OData. */
  ONEC_ODATA_MAPPING: z.string().default('config/onec-odata.json'),
  /** Файл соответствия групп 1С разделам приложения и оформления карточек. */
  CATALOG_CONFIG: z.string().default('config/catalog.json'),
  /** Откуда брать фото товаров: по умолчанию папка media этого сервера. */
  MEDIA_BASE_URL: z.string().default(''),

  /* ---------- ЮKassa ---------- */
  YOOKASSA_SHOP_ID: z.string().default(''),
  YOOKASSA_SECRET_KEY: z.string().default(''),
  /** Передавать чек по 54-ФЗ через ЮKassa (если подключены облачные чеки). */
  YOOKASSA_SEND_RECEIPT: bool.default(false),
  /** Код ставки НДС для чека ЮKassa: 1 без НДС, 2 0%, 4 20% и т.д. */
  YOOKASSA_VAT_CODE: z.coerce.number().int().default(1),

  /* ---------- SMS ---------- */
  SMS_PROVIDER: z.enum(['console', 'smsru']).default('console'),
  /** Только для демо: вход одним запросом под выдуманным пользователем. В бою выключен. */
  DEMO_LOGIN: z.enum(['0', '1']).default('0'),
  SMSRU_API_ID: z.string().default(''),
  SMS_SENDER: z.string().default(''),
  /** Номера для проверки App Store / Google Play: код всегда 0000. Через запятую. */
  REVIEW_PHONES: z.string().default(''),

  /* ---------- Внутреннее приложение компании ---------- */
  INTERNAL_API_KEY: z.string().default(''),
  INTERNAL_WEBHOOK_URL: z.string().default(''),
  INTERNAL_WEBHOOK_SECRET: z.string().default(''),

  /* ---------- Push (Firebase Cloud Messaging, работает и для iOS) ---------- */
  FCM_PROJECT_ID: z.string().default(''),
  FCM_CLIENT_EMAIL: z.string().default(''),
  FCM_PRIVATE_KEY: z.string().default(''),

  /* ---------- Магазин ---------- */
  FREE_DELIVERY_FROM_RUB: z.coerce.number().default(2500),
  DELIVERY_FEE_RUB: z.coerce.number().default(250),
  DELIVERY_ETA: z.string().default('15 минут'),
  PICKUP_POINTS: z
    .string()
    .default(
      '[{"id":"shop","title":"Магазин","address":"пер. имени Заварицкого А.Н., 11, строение 8","hours":"Пн–Пт 10:00–18:00, Сб 11:00–16:00, Вс выходной"},{"id":"coffee","title":"Чайная лавка и кофейня","address":"ул. Топоркова, 8, ТЦ «Армат Центр», модуль 1, линия 3","hours":"Пн–Вс 9:00–20:00"}]',
    ),
  SUPPORT_PHONE: z.string().default('+7 991 393-44-03'),
  WORKING_HOURS: z.string().default('Магазин: Пн–Пт 10:00–18:00, Сб 11:00–16:00, Вс выходной. Кофейня: ежедневно 9:00–20:00'),
  LEGAL_OPERATOR: z.string().default('[Наименование оператора, ИНН, ОГРНИП/ОГРН]'),
  LEGAL_EMAIL: z.string().default('[email для обращений]'),
});

export type Config = z.infer<typeof EnvSchema> & {
  pickupPoints: { id: string; title: string; address: string; hours?: string }[];
  reviewPhones: string[];
  onlinePaymentEnabled: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.parse(env);
  if (parsed.NODE_ENV === 'production') {
    const problems: string[] = [];
    if (parsed.JWT_SECRET.startsWith('dev-secret')) problems.push('JWT_SECRET');
    if (!parsed.INTERNAL_API_KEY) problems.push('INTERNAL_API_KEY');
    if (parsed.SMS_PROVIDER === 'console') problems.push('SMS_PROVIDER (в бою нужен smsru)');
    if (parsed.DATABASE_URL.startsWith('pglite:')) problems.push('DATABASE_URL (в бою нужен PostgreSQL)');
    if (problems.length) throw new Error(`Не заданы обязательные настройки для production: ${problems.join(', ')}`);
  }
  return {
    ...parsed,
    pickupPoints: JSON.parse(parsed.PICKUP_POINTS),
    reviewPhones: parsed.REVIEW_PHONES.split(',').map((s) => s.trim()).filter(Boolean),
    onlinePaymentEnabled: !!(parsed.YOOKASSA_SHOP_ID && parsed.YOOKASSA_SECRET_KEY),
  };
}
