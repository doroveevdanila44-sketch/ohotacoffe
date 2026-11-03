import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  serial,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import type { CatalogSnapshot } from '../services/catalog-types';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull().unique(),
  name: text('name'),
  city: text('city'),
  /** Ссылка на партнёра/клиента в 1С, если найден. */
  onecRef: text('onec_ref'),
  consentAt: timestamp('consent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authCodes = pgTable('auth_codes', {
  phone: text('phone').primaryKey(),
  codeHash: text('code_hash').notNull(),
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  consentAt: timestamp('consent_at', { withTimezone: true }),
});

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seq: serial('seq').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    clientRequestId: uuid('client_request_id').notNull(),
    status: text('status').notNull(),
    paymentMethod: text('payment_method').notNull(),
    paymentStatus: text('payment_status').notNull(),
    yookassaPaymentId: text('yookassa_payment_id'),
    phone: text('phone').notNull(),
    customerName: text('customer_name'),
    lines: jsonb('lines').notNull(),
    delivery: jsonb('delivery').notNull(),
    subtotal: integer('subtotal').notNull(),
    deliveryFee: integer('delivery_fee').notNull(),
    total: integer('total').notNull(),
    onecRef: text('onec_ref'),
    onecSyncedAt: timestamp('onec_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('orders_client_request_uq').on(t.userId, t.clientRequestId),
    index('orders_user_idx').on(t.userId, t.createdAt),
    index('orders_status_idx').on(t.status),
  ],
);

export const repairs = pgTable(
  'repairs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seq: serial('seq').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    clientRequestId: uuid('client_request_id').notNull(),
    phone: text('phone').notNull(),
    model: text('model').notNull(),
    serial: text('serial'),
    problem: text('problem'),
    pickupAddress: text('pickup_address'),
    stage: text('stage').notNull(),
    history: jsonb('history').notNull().default(sql`'[]'::jsonb`),
    services: jsonb('services').notNull().default(sql`'[]'::jsonb`),
    estimateMin: integer('estimate_min').notNull(),
    estimateMax: integer('estimate_max').notNull(),
    total: integer('total'),
    readyBy: timestamp('ready_by', { withTimezone: true }),
    masterName: text('master_name'),
    onecRef: text('onec_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('repairs_client_request_uq').on(t.userId, t.clientRequestId),
    index('repairs_user_idx').on(t.userId, t.createdAt),
  ],
);

/** Очередь исходящих событий: запись в 1С и вебхуки во внутреннее приложение с повторами. */
export const outbox = pgTable(
  'outbox',
  {
    id: serial('id').primaryKey(),
    topic: text('topic').notNull(),
    payload: jsonb('payload').notNull(),
    attempts: integer('attempts').notNull().default(0),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastError: text('last_error'),
    doneAt: timestamp('done_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('outbox_due_idx').on(t.doneAt, t.nextRunAt)],
);

export const devices = pgTable(
  'devices',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    platform: text('platform').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.token] })],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    refId: text('ref_id'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

/** Последний снимок каталога из 1С. Приложение читает его, а не 1С напрямую. */
export const catalogSnapshot = pgTable('catalog_snapshot', {
  id: integer('id').primaryKey(),
  data: jsonb('data').$type<CatalogSnapshot>().notNull(),
  source: text('source').notNull(),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
});
