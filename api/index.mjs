import { createRequire } from 'module'; const require = createRequire(import.meta.url);
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// apps/api/src/app.ts
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";

// apps/api/src/db/client.ts
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// apps/api/src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  authCodes: () => authCodes,
  catalogSnapshot: () => catalogSnapshot,
  devices: () => devices,
  notifications: () => notifications,
  orders: () => orders,
  outbox: () => outbox,
  repairs: () => repairs,
  users: () => users
});
import { sql } from "drizzle-orm";
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
  primaryKey
} from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(),
  name: text("name"),
  city: text("city"),
  /** Ссылка на партнёра/клиента в 1С, если найден. */
  onecRef: text("onec_ref"),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
var authCodes = pgTable("auth_codes", {
  phone: text("phone").primaryKey(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  consentAt: timestamp("consent_at", { withTimezone: true })
});
var orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seq: serial("seq").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    clientRequestId: uuid("client_request_id").notNull(),
    status: text("status").notNull(),
    paymentMethod: text("payment_method").notNull(),
    paymentStatus: text("payment_status").notNull(),
    yookassaPaymentId: text("yookassa_payment_id"),
    phone: text("phone").notNull(),
    customerName: text("customer_name"),
    lines: jsonb("lines").notNull(),
    delivery: jsonb("delivery").notNull(),
    subtotal: integer("subtotal").notNull(),
    deliveryFee: integer("delivery_fee").notNull(),
    total: integer("total").notNull(),
    onecRef: text("onec_ref"),
    onecSyncedAt: timestamp("onec_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("orders_client_request_uq").on(t.userId, t.clientRequestId),
    index("orders_user_idx").on(t.userId, t.createdAt),
    index("orders_status_idx").on(t.status)
  ]
);
var repairs = pgTable(
  "repairs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seq: serial("seq").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    clientRequestId: uuid("client_request_id").notNull(),
    phone: text("phone").notNull(),
    model: text("model").notNull(),
    serial: text("serial"),
    problem: text("problem"),
    pickupAddress: text("pickup_address"),
    stage: text("stage").notNull(),
    history: jsonb("history").notNull().default(sql`'[]'::jsonb`),
    services: jsonb("services").notNull().default(sql`'[]'::jsonb`),
    estimateMin: integer("estimate_min").notNull(),
    estimateMax: integer("estimate_max").notNull(),
    total: integer("total"),
    readyBy: timestamp("ready_by", { withTimezone: true }),
    masterName: text("master_name"),
    onecRef: text("onec_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("repairs_client_request_uq").on(t.userId, t.clientRequestId),
    index("repairs_user_idx").on(t.userId, t.createdAt)
  ]
);
var outbox = pgTable(
  "outbox",
  {
    id: serial("id").primaryKey(),
    topic: text("topic").notNull(),
    payload: jsonb("payload").notNull(),
    attempts: integer("attempts").notNull().default(0),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastError: text("last_error"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("outbox_due_idx").on(t.doneAt, t.nextRunAt)]
);
var devices = pgTable(
  "devices",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [primaryKey({ columns: [t.userId, t.token] })]
);
var notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    refId: text("ref_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)]
);
var catalogSnapshot = pgTable("catalog_snapshot", {
  id: integer("id").primaryKey(),
  data: jsonb("data").$type().notNull(),
  source: text("source").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow()
});

// apps/api/src/db/client.ts
var here = dirname(fileURLToPath(import.meta.url));
var migrationsFolder = [resolve(here, "../../drizzle"), resolve(here, "../drizzle"), resolve(process.cwd(), "drizzle"), resolve(process.cwd(), "apps/api/drizzle")].find(
  (p) => existsSync(p)
) ?? resolve(process.cwd(), "drizzle");
async function openDb(url) {
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle: drizzle2 } = await import("drizzle-orm/pglite");
    const { migrate: migrate2 } = await import("drizzle-orm/pglite/migrator");
    const target = url.slice("pglite:".length);
    const client = target === "memory" || target === "" ? new PGlite() : (mkdirSync(target, { recursive: true }), new PGlite(target));
    const db2 = drizzle2(client, { schema: schema_exports });
    await migrate2(db2, { migrationsFolder });
    return { db: db2, close: () => client.close() };
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const pool = new Pool({ connectionString: url, max: 10 });
  const db = drizzle(pool, { schema: schema_exports });
  await migrate(db, { migrationsFolder });
  return { db, close: () => pool.end() };
}

// apps/api/src/onec/index.ts
import { resolve as resolve2 } from "node:path";

// apps/api/src/onec/types.ts
var OneCError = class extends Error {
  constructor(message, status, retryable = true) {
    super(message);
    this.status = status;
    this.retryable = retryable;
    this.name = "OneCError";
  }
  status;
  retryable;
};

// apps/api/src/onec/http-client.ts
var OneCHttp = class {
  constructor(opts) {
    this.opts = opts;
    if (!opts.baseUrl) throw new Error("ONEC_BASE_URL \u043D\u0435 \u0437\u0430\u0434\u0430\u043D");
    this.auth = "Basic " + Buffer.from(`${opts.user}:${opts.password}`, "utf8").toString("base64");
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }
  opts;
  auth;
  fetchImpl;
  url(path) {
    const base = this.opts.baseUrl.replace(/\/+$/, "");
    return `${base}/${path.replace(/^\/+/, "")}`;
  }
  async request(method, path, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.opts.timeoutMs);
    let res;
    try {
      res = await this.fetchImpl(this.url(path), {
        method,
        headers: {
          Authorization: this.auth,
          Accept: "application/json",
          ...body !== void 0 ? { "Content-Type": "application/json; charset=utf-8" } : {}
        },
        body: body !== void 0 ? JSON.stringify(body) : void 0,
        signal: ctrl.signal
      });
    } catch (e) {
      throw new OneCError(`1\u0421 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430: ${e.message}`);
    } finally {
      clearTimeout(timer);
    }
    const text2 = await res.text();
    if (!res.ok) {
      const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
      throw new OneCError(`1\u0421 \u043E\u0442\u0432\u0435\u0442\u0438\u043B\u0430 ${res.status}: ${text2.slice(0, 500)}`, res.status, retryable);
    }
    if (!text2) return void 0;
    try {
      return JSON.parse(text2);
    } catch {
      throw new OneCError(`1\u0421 \u0432\u0435\u0440\u043D\u0443\u043B\u0430 \u043D\u0435 JSON: ${text2.slice(0, 200)}`);
    }
  }
};

// apps/api/src/onec/http-adapter.ts
var HttpServiceAdapter = class {
  name = "http";
  http;
  constructor(opts) {
    this.http = new OneCHttp(opts);
  }
  async ping() {
    await this.http.request("GET", "ping");
  }
  async fetchCatalog() {
    const data = await this.http.request("GET", "catalog");
    if (!data || !Array.isArray(data.items)) throw new OneCError("HTTP-\u0441\u0435\u0440\u0432\u0438\u0441 1\u0421 \u0432\u0435\u0440\u043D\u0443\u043B \u043A\u0430\u0442\u0430\u043B\u043E\u0433 \u0431\u0435\u0437 items", void 0, false);
    return {
      groups: data.groups ?? [],
      items: data.items.map((i) => ({ ...i, characteristics: i.characteristics ?? [] })),
      prices: data.prices ?? [],
      stock: data.stock ?? []
    };
  }
  async createOrder(order) {
    const res = await this.http.request("POST", "orders", order);
    if (!res?.ref) throw new OneCError("HTTP-\u0441\u0435\u0440\u0432\u0438\u0441 1\u0421 \u043D\u0435 \u0432\u0435\u0440\u043D\u0443\u043B ref \u0437\u0430\u043A\u0430\u0437\u0430", void 0, false);
    return { ref: res.ref };
  }
  async createRepair(repair) {
    const res = await this.http.request("POST", "repairs", repair);
    return res?.ref ? { ref: res.ref } : null;
  }
  async getBonusBalance(phone) {
    try {
      const res = await this.http.request("GET", `bonus?phone=${encodeURIComponent(phone)}`);
      return typeof res?.balance === "number" ? res.balance : null;
    } catch (e) {
      if (e instanceof OneCError && e.status === 404) return null;
      throw e;
    }
  }
};

// apps/api/src/onec/mock-adapter.ts
import { randomUUID } from "node:crypto";

// apps/api/src/onec/mock-catalog.json
var mock_catalog_default = {
  groups: [
    {
      ref: "g-shop",
      code: "SHOP",
      parentRef: null,
      title: "\u041C\u0430\u0433\u0430\u0437\u0438\u043D"
    },
    {
      ref: "g-menu",
      code: "MENU",
      parentRef: null,
      title: "\u041A\u043E\u0444\u0435\u0439\u043D\u044F"
    },
    {
      ref: "g-shop-ground",
      code: "SHOP-GROUND",
      parentRef: "g-shop",
      title: "\u041C\u043E\u043B\u043E\u0442\u044B\u0439 \u043A\u043E\u0444\u0435"
    },
    {
      ref: "g-shop-beans",
      code: "SHOP-BEANS",
      parentRef: "g-shop",
      title: "\u041A\u043E\u0444\u0435 \u0432 \u0437\u0451\u0440\u043D\u0430\u0445"
    },
    {
      ref: "g-shop-drip",
      code: "SHOP-DRIP",
      parentRef: "g-shop",
      title: "\u0414\u0440\u0438\u043F-\u043A\u043E\u0444\u0435"
    },
    {
      ref: "g-shop-instant",
      code: "SHOP-INSTANT",
      parentRef: "g-shop",
      title: "\u0420\u0430\u0441\u0442\u0432\u043E\u0440\u0438\u043C\u044B\u0439 \u043A\u043E\u0444\u0435"
    },
    {
      ref: "g-shop-tea",
      code: "SHOP-TEA",
      parentRef: "g-shop",
      title: "\u0427\u0430\u0439"
    },
    {
      ref: "g-shop-syrups",
      code: "SHOP-SYRUPS",
      parentRef: "g-shop",
      title: "\u0421\u0438\u0440\u043E\u043F\u044B"
    },
    {
      ref: "g-menu-classic",
      code: "MENU-CLASSIC",
      parentRef: "g-menu",
      title: "\u041A\u043B\u0430\u0441\u0441\u0438\u043A\u0430"
    },
    {
      ref: "g-menu-author",
      code: "MENU-AUTHOR",
      parentRef: "g-menu",
      title: "\u0410\u0432\u0442\u043E\u0440\u0441\u043A\u0438\u0439 \u043A\u043E\u0444\u0435"
    },
    {
      ref: "g-menu-cold",
      code: "MENU-COLD",
      parentRef: "g-menu",
      title: "\u0425\u043E\u043B\u043E\u0434\u043D\u044B\u0435 \u043D\u0430\u043F\u0438\u0442\u043A\u0438"
    },
    {
      ref: "g-menu-tea",
      code: "MENU-TEA",
      parentRef: "g-menu",
      title: "\u0427\u0430\u0439"
    },
    {
      ref: "g-menu-lemonade",
      code: "MENU-LEMONADE",
      parentRef: "g-menu",
      title: "\u041B\u0438\u043C\u043E\u043D\u0430\u0434\u044B"
    },
    {
      ref: "g-menu-addons",
      code: "MENU-ADDONS",
      parentRef: "g-menu",
      title: "\u0414\u043E\u0431\u0430\u0432\u043A\u0438"
    }
  ],
  items: [
    {
      ref: "it-lavazza",
      code: "lavazza",
      article: null,
      title: "Lavazza Tales of Roma",
      groupRef: "g-shop-ground",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-tasty",
      code: "tasty",
      article: null,
      title: "Tasty Coffee Drip \xAB\u0411\u044D\u0440\u0440\u0438\xBB",
      groupRef: "g-shop-drip",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-lavrossa",
      code: "lavrossa",
      article: null,
      title: "Lavazza Qualit\xE0 Rossa",
      groupRef: "g-shop-ground",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-sbmix",
      code: "sbmix",
      article: null,
      title: "Starbucks Premium Mix",
      groupRef: "g-shop-instant",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-osulloc",
      code: "osulloc",
      article: null,
      title: "Osulloc, 10 \u0432\u043A\u0443\u0441\u043E\u0432",
      groupRef: "g-shop-tea",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-sbcaramel",
      code: "sbcaramel",
      article: null,
      title: "Starbucks Caramel",
      groupRef: "g-shop-ground",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-ceylon",
      code: "ceylon",
      article: null,
      title: "Special Tea Selection",
      groupRef: "g-shop-tea",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-motif",
      code: "motif",
      article: null,
      title: "\u0421\u0438\u0440\u043E\u043F\u044B Motif",
      groupRef: "g-shop-syrups",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-motif-1",
          title: "\u0428\u043E\u043A\u043E\u043B\u0430\u0434"
        },
        {
          ref: "ch-motif-2",
          title: "\u041A\u043E\u0440\u0438\u0446\u0430-\u0431\u0430\u0431\u043A\u0430"
        },
        {
          ref: "ch-motif-3",
          title: "\u0424\u0438\u0441\u0442\u0430\u0448\u043A\u0430"
        },
        {
          ref: "ch-motif-4",
          title: "\u0412\u0430\u043D\u0438\u043B\u044C"
        }
      ]
    },
    {
      ref: "it-island",
      code: "island",
      article: null,
      title: "Drip Coffee, Island",
      groupRef: "g-shop-drip",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-sbmocha",
      code: "sbmocha",
      article: null,
      title: "Starbucks Mocha",
      groupRef: "g-shop-ground",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-lam",
      code: "lam",
      article: null,
      title: "\u0421\u0438\u0440\u043E\u043F\u044B lam",
      groupRef: "g-shop-syrups",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-lam-1",
          title: "\u041A\u0430\u0448\u0442\u0430\u043D \u0441 \u043F\u0440\u0430\u043B\u0438\u043D\u0435"
        },
        {
          ref: "ch-lam-2",
          title: "\u0412\u0430\u043D\u0438\u043B\u044C"
        },
        {
          ref: "ch-lam-3",
          title: "\u0422\u0435\u0441\u0442\u043E \u0434\u043B\u044F \u043F\u0435\u0447\u0435\u043D\u044C\u044F"
        }
      ]
    },
    {
      ref: "it-hugging",
      code: "hugging",
      article: null,
      title: "Hugging Drip, \u0430\u0441\u0441\u043E\u0440\u0442\u0438",
      groupRef: "g-shop-drip",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-pukka",
      code: "pukka",
      article: null,
      title: "Pukka Organic Selection",
      groupRef: "g-shop-tea",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-barinoff",
      code: "barinoff",
      article: null,
      title: "\u0421\u0438\u0440\u043E\u043F\u044B Barinoff",
      groupRef: "g-shop-syrups",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-barinoff-1",
          title: "\u0412\u0438\u0448\u043D\u044F"
        },
        {
          ref: "ch-barinoff-2",
          title: "\u041B\u0435\u0441\u043D\u044B\u0435 \u044F\u0433\u043E\u0434\u044B"
        },
        {
          ref: "ch-barinoff-3",
          title: "\u041B\u0435\u0441\u043D\u043E\u0439 \u043E\u0440\u0435\u0445"
        },
        {
          ref: "ch-barinoff-4",
          title: "\u041C\u044F\u0442\u0430"
        },
        {
          ref: "ch-barinoff-5",
          title: "\u0417\u0435\u043B\u0451\u043D\u043E\u0435 \u044F\u0431\u043B\u043E\u043A\u043E"
        },
        {
          ref: "ch-barinoff-6",
          title: "\u041A\u0430\u0440\u0430\u043C\u0435\u043B\u044C"
        },
        {
          ref: "ch-barinoff-7",
          title: "\u0410\u0440\u0431\u0443\u0437"
        },
        {
          ref: "ch-barinoff-8",
          title: "\u041C\u0430\u043B\u0438\u043D\u0430"
        },
        {
          ref: "ch-barinoff-9",
          title: "\u041C\u043E\u0445\u0438\u0442\u043E"
        },
        {
          ref: "ch-barinoff-10",
          title: "\u041B\u0430\u0439\u043C"
        },
        {
          ref: "ch-barinoff-11",
          title: "\u041A\u043B\u0443\u0431\u043D\u0438\u043A\u0430"
        },
        {
          ref: "ch-barinoff-12",
          title: "\u0412\u0430\u043D\u0438\u043B\u044C"
        }
      ]
    },
    {
      ref: "it-monin",
      code: "monin",
      article: null,
      title: "\u0421\u0438\u0440\u043E\u043F\u044B Monin",
      groupRef: "g-shop-syrups",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-monin-1",
          title: "\u041C\u0430\u043D\u0433\u043E"
        },
        {
          ref: "ch-monin-2",
          title: "\u041C\u0438\u043D\u0434\u0430\u043B\u044C (\u043E\u0440\u0448\u0430\u0434)"
        },
        {
          ref: "ch-monin-3",
          title: "\u0422\u0440\u0438\u043F\u043B \u0441\u0435\u043A \u043A\u044E\u0440\u0430\u0441\u0430\u043E"
        },
        {
          ref: "ch-monin-4",
          title: "\u041A\u0430\u0440\u0438\u0431\u0441\u043A\u0438\u0439 \u0440\u043E\u043C"
        },
        {
          ref: "ch-monin-5",
          title: "\u041F\u0438\u043D\u0430 \u043A\u043E\u043B\u0430\u0434\u0430"
        },
        {
          ref: "ch-monin-6",
          title: "\u041A\u043B\u0443\u0431\u043D\u0438\u043A\u0430"
        },
        {
          ref: "ch-monin-7",
          title: "\u0412\u0430\u043D\u0438\u043B\u044C"
        },
        {
          ref: "ch-monin-8",
          title: "\u041A\u0430\u0440\u0430\u043C\u0435\u043B\u044C"
        },
        {
          ref: "ch-monin-9",
          title: "\u041B\u0435\u0441\u043D\u043E\u0439 \u043E\u0440\u0435\u0445"
        },
        {
          ref: "ch-monin-10",
          title: "\u0428\u043E\u043A\u043E\u043B\u0430\u0434"
        },
        {
          ref: "ch-monin-11",
          title: "\u041C\u044F\u0442\u0430"
        },
        {
          ref: "ch-monin-12",
          title: "\u041A\u043E\u043A\u043E\u0441"
        }
      ]
    },
    {
      ref: "it-lavbarista",
      code: "lavbarista",
      article: null,
      title: "Lavazza Barista Perfetto",
      groupRef: "g-shop-beans",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-tastyespresso",
      code: "tastyespresso",
      article: null,
      title: "Tasty Coffee Espresso",
      groupRef: "g-shop-beans",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-routin",
      code: "routin",
      article: null,
      title: "\u0421\u0438\u0440\u043E\u043F\u044B 1883 Routin",
      groupRef: "g-shop-syrups",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-routin-1",
          title: "\u041A\u0430\u0440\u0430\u043C\u0435\u043B\u044C"
        },
        {
          ref: "ch-routin-2",
          title: "\u0412\u0430\u043D\u0438\u043B\u044C"
        },
        {
          ref: "ch-routin-3",
          title: "\u041C\u0430\u043B\u0438\u043D\u0430"
        }
      ]
    },
    {
      ref: "it-lavoro",
      code: "lavoro",
      article: null,
      title: "Lavazza Qualit\xE0 Oro",
      groupRef: "g-shop-beans",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-maccoffee",
      code: "maccoffee",
      article: null,
      title: "MacCoffee Original 3 \u0432 1",
      groupRef: "g-shop-instant",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-classic-01",
      code: "MENU-CLASSIC-01",
      article: null,
      title: "\u041A\u0430\u043F\u0443\u0447\u0438\u043D\u043E",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-classic-01-1",
          title: "250 \u043C\u043B"
        },
        {
          ref: "ch-menu-classic-01-2",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-classic-02",
      code: "MENU-CLASSIC-02",
      article: null,
      title: "\u041B\u0430\u0442\u0442\u0435",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-classic-02-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-classic-03",
      code: "MENU-CLASSIC-03",
      article: null,
      title: "\u0420\u0430\u0444",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-classic-03-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-classic-04",
      code: "MENU-CLASSIC-04",
      article: null,
      title: "\u0424\u043B\u044D\u0442 \u0443\u0430\u0439\u0442",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-classic-05",
      code: "MENU-CLASSIC-05",
      article: null,
      title: "\u042D\u0441\u043F\u0440\u0435\u0441\u0441\u043E",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-classic-06",
      code: "MENU-CLASSIC-06",
      article: null,
      title: "\u0414\u0432\u043E\u0439\u043D\u043E\u0439 \u044D\u0441\u043F\u0440\u0435\u0441\u0441\u043E",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-classic-07",
      code: "MENU-CLASSIC-07",
      article: null,
      title: "\u0410\u043C\u0435\u0440\u0438\u043A\u0430\u043D\u043E",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-classic-07-1",
          title: "250 \u043C\u043B"
        },
        {
          ref: "ch-menu-classic-07-2",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-classic-08",
      code: "MENU-CLASSIC-08",
      article: null,
      title: "\u0424\u0438\u043B\u044C\u0442\u0440",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-classic-08-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-classic-09",
      code: "MENU-CLASSIC-09",
      article: null,
      title: "\u041C\u043E\u043A\u0430\u0447\u0438\u043D\u043E",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-classic-09-1",
          title: "250 \u043C\u043B"
        },
        {
          ref: "ch-menu-classic-09-2",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-classic-10",
      code: "MENU-CLASSIC-10",
      article: null,
      title: "\u041A\u0430\u043A\u0430\u043E",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-classic-10-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-classic-11",
      code: "MENU-CLASSIC-11",
      article: null,
      title: "\u0413\u043E\u0440\u044F\u0447\u0438\u0439 \u0448\u043E\u043A\u043E\u043B\u0430\u0434",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-classic-11-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-classic-12",
      code: "MENU-CLASSIC-12",
      article: null,
      title: "\u0413\u043E\u0440\u044F\u0447\u0438\u0439 \u0448\u043E\u043A\u043E\u043B\u0430\u0434 \u0431\u0435\u0437 \u0441\u0430\u0445\u0430\u0440\u0430",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-classic-12-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-classic-13",
      code: "MENU-CLASSIC-13",
      article: null,
      title: "\u041C\u0430\u0442\u0447\u0430 \u043B\u0430\u0442\u0442\u0435",
      groupRef: "g-menu-classic",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-classic-13-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-author-01",
      code: "MENU-AUTHOR-01",
      article: null,
      title: "\u041B\u0430\u0432\u0430\u043D\u0434\u043E\u0432\u044B\u0439 \u0440\u0430\u0444",
      groupRef: "g-menu-author",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-author-01-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-author-02",
      code: "MENU-AUTHOR-02",
      article: null,
      title: "\u0420\u0430\u0444 \u0420\u0430\u0444\u0430\u044D\u043B\u043B\u043E",
      groupRef: "g-menu-author",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-author-02-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-author-03",
      code: "MENU-AUTHOR-03",
      article: null,
      title: "\u0410\u0440\u0430\u0445\u0438\u0441\u043E\u0432\u044B\u0439 \u0440\u0430\u0444",
      groupRef: "g-menu-author",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-author-03-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-author-04",
      code: "MENU-AUTHOR-04",
      article: null,
      title: "\u041C\u0430\u0441\u043A\u0430\u0440\u043F\u043E\u043D\u0435 Cream",
      groupRef: "g-menu-author",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-author-04-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-author-05",
      code: "MENU-AUTHOR-05",
      article: null,
      title: "\u041A\u0430\u043F\u0443\u0447\u0438\u043D\u043E \u0431\u0435\u043B\u044C\u0433\u0438\u0439\u0441\u043A\u0430\u044F \u0432\u0430\u0444\u043B\u044F",
      groupRef: "g-menu-author",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-author-05-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-author-06",
      code: "MENU-AUTHOR-06",
      article: null,
      title: "\u0426\u0438\u0442\u0440\u0443\u0441\u043E\u0432\u044B\u0439 \u0430\u043C\u0435\u0440\u0438\u043A\u0430\u043D\u043E",
      groupRef: "g-menu-author",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-cold-01",
      code: "MENU-COLD-01",
      article: null,
      title: "\u041C\u0430\u0442\u0447\u0430 \u043B\u0430\u0442\u0442\u0435",
      groupRef: "g-menu-cold",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-cold-02",
      code: "MENU-COLD-02",
      article: null,
      title: "\u0410\u0439\u0441 \u043B\u0430\u0442\u0442\u0435",
      groupRef: "g-menu-cold",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-cold-03",
      code: "MENU-COLD-03",
      article: null,
      title: "\u0424\u0440\u0430\u043F\u043F\u0435",
      groupRef: "g-menu-cold",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-cold-04",
      code: "MENU-COLD-04",
      article: null,
      title: "\u0424\u0440\u0430\u043F\u043F\u0443\u0447\u0438\u043D\u043E \u0448\u043E\u043A\u043E\u043B\u0430\u0434",
      groupRef: "g-menu-cold",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-cold-05",
      code: "MENU-COLD-05",
      article: null,
      title: "\u0424\u0440\u0430\u043F\u043F\u0443\u0447\u0438\u043D\u043E \u0432\u0438\u0448\u043D\u044F",
      groupRef: "g-menu-cold",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-cold-06",
      code: "MENU-COLD-06",
      article: null,
      title: "\u0411\u0430\u043C\u0431\u043B",
      groupRef: "g-menu-cold",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-cold-07",
      code: "MENU-COLD-07",
      article: null,
      title: "\u0411\u0430\u043D\u0430\u043D\u0430 \u0430\u0439\u0441",
      groupRef: "g-menu-cold",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-cold-08",
      code: "MENU-COLD-08",
      article: null,
      title: "\u041A\u043E\u043B\u0434 \u0431\u0440\u044E",
      groupRef: "g-menu-cold",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-cold-09",
      code: "MENU-COLD-09",
      article: null,
      title: "\u041A\u043B\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0433\u043B\u044F\u0441se",
      groupRef: "g-menu-cold",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-cold-10",
      code: "MENU-COLD-10",
      article: null,
      title: "\u0424\u0438\u0440\u043C\u0435\u043D\u043D\u044B\u0439 \u0433\u043B\u044F\u0441se",
      groupRef: "g-menu-cold",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-tea-01",
      code: "MENU-TEA-01",
      article: null,
      title: "\u041E\u0431\u043B\u0435\u043F\u0438\u0445\u0430, \u0438\u043C\u0431\u0438\u0440\u044C",
      groupRef: "g-menu-tea",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-tea-01-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-tea-02",
      code: "MENU-TEA-02",
      article: null,
      title: "\u041C\u0430\u043B\u0438\u043D\u0430",
      groupRef: "g-menu-tea",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-tea-02-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-tea-03",
      code: "MENU-TEA-03",
      article: null,
      title: "\u0424\u0435\u0439\u0445\u043E\u0430, \u0435\u043B\u043E\u0432\u044B\u0435 \u0438\u0433\u043E\u043B\u043A\u0438",
      groupRef: "g-menu-tea",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-tea-03-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-tea-04",
      code: "MENU-TEA-04",
      article: null,
      title: "\u0425\u0432\u043E\u0439\u043D\u044B\u0439 \u0447\u0430\u0439",
      groupRef: "g-menu-tea",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-tea-04-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-tea-05",
      code: "MENU-TEA-05",
      article: null,
      title: "\u041C\u0430\u0441\u0430\u043B\u0430",
      groupRef: "g-menu-tea",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-tea-05-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-tea-06",
      code: "MENU-TEA-06",
      article: null,
      title: "\u041A\u043E\u043D\u0441\u0442\u0440\u0443\u043A\u0442\u043E\u0440",
      groupRef: "g-menu-tea",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-menu-tea-06-1",
          title: "350 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-menu-tea-07",
      code: "MENU-TEA-07",
      article: null,
      title: "\u0425\u043E\u043B\u043E\u0434\u043D\u044B\u0439 \u0447\u0430\u0439",
      groupRef: "g-menu-tea",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-lemonade-01",
      code: "MENU-LEMONADE-01",
      article: null,
      title: "\u0413\u043E\u043B\u0443\u0431\u043E\u0435 \u043D\u0435\u0431\u043E",
      groupRef: "g-menu-lemonade",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-lemonade-02",
      code: "MENU-LEMONADE-02",
      article: null,
      title: "\u041C\u0430\u043B\u0438\u043D\u0430, \u043C\u044F\u0442\u0430",
      groupRef: "g-menu-lemonade",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-lemonade-03",
      code: "MENU-LEMONADE-03",
      article: null,
      title: "\u0412\u0438\u043D\u043E\u0433\u0440\u0430\u0434",
      groupRef: "g-menu-lemonade",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-lemonade-04",
      code: "MENU-LEMONADE-04",
      article: null,
      title: "\u041C\u043E\u0445\u0438\u0442\u043E",
      groupRef: "g-menu-lemonade",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-menu-lemonade-05",
      code: "MENU-LEMONADE-05",
      article: null,
      title: "\u0422\u0440\u043E\u043F\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043C\u043E\u0445\u0438\u0442\u043E",
      groupRef: "g-menu-lemonade",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-add-sugar",
      code: "ADD-SUGAR",
      article: null,
      title: "\u0421\u0430\u0445\u0430\u0440",
      groupRef: "g-menu-addons",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-add-cinnamon",
      code: "ADD-CINNAMON",
      article: null,
      title: "\u041A\u043E\u0440\u0438\u0446\u0430",
      groupRef: "g-menu-addons",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-add-shot",
      code: "ADD-SHOT",
      article: null,
      title: "\u0428\u043E\u0442 \u044D\u0441\u043F\u0440\u0435\u0441\u0441\u043E \u0438\u043B\u0438 \u043C\u0430\u0442\u0447\u0430",
      groupRef: "g-menu-addons",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-add-syrup",
      code: "ADD-SYRUP",
      article: null,
      title: "\u0421\u0438\u0440\u043E\u043F",
      groupRef: "g-menu-addons",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-add-topping",
      code: "ADD-TOPPING",
      article: null,
      title: "\u0422\u043E\u043F\u043F\u0438\u043D\u0433",
      groupRef: "g-menu-addons",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-add-honey",
      code: "ADD-HONEY",
      article: null,
      title: "\u041C\u0451\u0434",
      groupRef: "g-menu-addons",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-add-marsh",
      code: "ADD-MARSH",
      article: null,
      title: "\u041C\u0430\u0440\u0448\u043C\u0435\u043B\u043B\u043E\u0443",
      groupRef: "g-menu-addons",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-add-lemon",
      code: "ADD-LEMON",
      article: null,
      title: "\u041B\u0438\u043C\u043E\u043D",
      groupRef: "g-menu-addons",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    },
    {
      ref: "it-add-milk",
      code: "ADD-MILK",
      article: null,
      title: "\u0410\u043B\u044C\u0442\u0435\u0440\u043D\u0430\u0442\u0438\u0432\u043D\u043E\u0435 \u043C\u043E\u043B\u043E\u043A\u043E",
      groupRef: "g-menu-addons",
      description: null,
      unit: "\u0448\u0442",
      characteristics: [
        {
          ref: "ch-add-milk-250",
          title: "250 \u043C\u043B"
        },
        {
          ref: "ch-add-milk-350",
          title: "350 \u043C\u043B"
        },
        {
          ref: "ch-add-milk-450",
          title: "450 \u043C\u043B"
        }
      ]
    },
    {
      ref: "it-add-icecream",
      code: "ADD-ICECREAM",
      article: null,
      title: "\u0428\u0430\u0440\u0438\u043A \u043C\u043E\u0440\u043E\u0436\u0435\u043D\u043E\u0433\u043E",
      groupRef: "g-menu-addons",
      description: null,
      unit: "\u0448\u0442",
      characteristics: []
    }
  ],
  prices: [
    {
      itemRef: "it-lavazza",
      charRef: null,
      price: 690
    },
    {
      itemRef: "it-tasty",
      charRef: null,
      price: 640
    },
    {
      itemRef: "it-lavrossa",
      charRef: null,
      price: 590
    },
    {
      itemRef: "it-sbmix",
      charRef: null,
      price: 790
    },
    {
      itemRef: "it-osulloc",
      charRef: null,
      price: 2790
    },
    {
      itemRef: "it-sbcaramel",
      charRef: null,
      price: 1650
    },
    {
      itemRef: "it-ceylon",
      charRef: null,
      price: 1190
    },
    {
      itemRef: "it-motif",
      charRef: null,
      price: 1490
    },
    {
      itemRef: "it-island",
      charRef: null,
      price: 890
    },
    {
      itemRef: "it-sbmocha",
      charRef: null,
      price: 1650
    },
    {
      itemRef: "it-lam",
      charRef: null,
      price: 2190
    },
    {
      itemRef: "it-hugging",
      charRef: null,
      price: 1290
    },
    {
      itemRef: "it-pukka",
      charRef: null,
      price: 2990
    },
    {
      itemRef: "it-barinoff",
      charRef: null,
      price: 590
    },
    {
      itemRef: "it-monin",
      charRef: null,
      price: 1090
    },
    {
      itemRef: "it-lavbarista",
      charRef: null,
      price: 2890
    },
    {
      itemRef: "it-tastyespresso",
      charRef: null,
      price: 2590
    },
    {
      itemRef: "it-routin",
      charRef: null,
      price: 1190
    },
    {
      itemRef: "it-lavoro",
      charRef: null,
      price: 790
    },
    {
      itemRef: "it-maccoffee",
      charRef: null,
      price: 26
    },
    {
      itemRef: "it-menu-classic-01",
      charRef: "ch-menu-classic-01-1",
      price: 170
    },
    {
      itemRef: "it-menu-classic-01",
      charRef: "ch-menu-classic-01-2",
      price: 200
    },
    {
      itemRef: "it-menu-classic-02",
      charRef: "ch-menu-classic-02-1",
      price: 220
    },
    {
      itemRef: "it-menu-classic-03",
      charRef: "ch-menu-classic-03-1",
      price: 255
    },
    {
      itemRef: "it-menu-classic-07",
      charRef: "ch-menu-classic-07-1",
      price: 140
    },
    {
      itemRef: "it-menu-classic-07",
      charRef: "ch-menu-classic-07-2",
      price: 160
    },
    {
      itemRef: "it-menu-classic-08",
      charRef: "ch-menu-classic-08-1",
      price: 240
    },
    {
      itemRef: "it-menu-classic-09",
      charRef: "ch-menu-classic-09-1",
      price: 140
    },
    {
      itemRef: "it-menu-classic-09",
      charRef: "ch-menu-classic-09-2",
      price: 160
    },
    {
      itemRef: "it-menu-classic-10",
      charRef: "ch-menu-classic-10-1",
      price: 190
    },
    {
      itemRef: "it-menu-classic-11",
      charRef: "ch-menu-classic-11-1",
      price: 210
    },
    {
      itemRef: "it-menu-classic-12",
      charRef: "ch-menu-classic-12-1",
      price: 190
    },
    {
      itemRef: "it-menu-classic-13",
      charRef: "ch-menu-classic-13-1",
      price: 240
    },
    {
      itemRef: "it-menu-author-01",
      charRef: "ch-menu-author-01-1",
      price: 280
    },
    {
      itemRef: "it-menu-author-02",
      charRef: "ch-menu-author-02-1",
      price: 280
    },
    {
      itemRef: "it-menu-author-03",
      charRef: "ch-menu-author-03-1",
      price: 280
    },
    {
      itemRef: "it-menu-author-04",
      charRef: "ch-menu-author-04-1",
      price: 280
    },
    {
      itemRef: "it-menu-author-05",
      charRef: "ch-menu-author-05-1",
      price: 240
    },
    {
      itemRef: "it-menu-tea-01",
      charRef: "ch-menu-tea-01-1",
      price: 190
    },
    {
      itemRef: "it-menu-tea-02",
      charRef: "ch-menu-tea-02-1",
      price: 190
    },
    {
      itemRef: "it-menu-tea-03",
      charRef: "ch-menu-tea-03-1",
      price: 190
    },
    {
      itemRef: "it-menu-tea-04",
      charRef: "ch-menu-tea-04-1",
      price: 190
    },
    {
      itemRef: "it-menu-tea-05",
      charRef: "ch-menu-tea-05-1",
      price: 190
    },
    {
      itemRef: "it-menu-tea-06",
      charRef: "ch-menu-tea-06-1",
      price: 190
    },
    {
      itemRef: "it-add-sugar",
      charRef: null,
      price: 0
    },
    {
      itemRef: "it-add-cinnamon",
      charRef: null,
      price: 0
    },
    {
      itemRef: "it-add-shot",
      charRef: null,
      price: 60
    },
    {
      itemRef: "it-add-syrup",
      charRef: null,
      price: 25
    },
    {
      itemRef: "it-add-topping",
      charRef: null,
      price: 35
    },
    {
      itemRef: "it-add-honey",
      charRef: null,
      price: 35
    },
    {
      itemRef: "it-add-marsh",
      charRef: null,
      price: 35
    },
    {
      itemRef: "it-add-lemon",
      charRef: null,
      price: 10
    },
    {
      itemRef: "it-add-milk",
      charRef: "ch-add-milk-250",
      price: 60
    },
    {
      itemRef: "it-add-milk",
      charRef: "ch-add-milk-350",
      price: 90
    },
    {
      itemRef: "it-add-milk",
      charRef: "ch-add-milk-450",
      price: 120
    },
    {
      itemRef: "it-add-icecream",
      charRef: null,
      price: 60
    }
  ],
  stock: [
    {
      itemRef: "it-lavazza",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-tasty",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-lavrossa",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-sbmix",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-osulloc",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-sbcaramel",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-ceylon",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-motif",
      charRef: "ch-motif-1",
      qty: 8
    },
    {
      itemRef: "it-motif",
      charRef: "ch-motif-2",
      qty: 8
    },
    {
      itemRef: "it-motif",
      charRef: "ch-motif-3",
      qty: 8
    },
    {
      itemRef: "it-motif",
      charRef: "ch-motif-4",
      qty: 8
    },
    {
      itemRef: "it-island",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-sbmocha",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-lam",
      charRef: "ch-lam-1",
      qty: 8
    },
    {
      itemRef: "it-lam",
      charRef: "ch-lam-2",
      qty: 8
    },
    {
      itemRef: "it-lam",
      charRef: "ch-lam-3",
      qty: 8
    },
    {
      itemRef: "it-hugging",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-pukka",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-barinoff",
      charRef: "ch-barinoff-1",
      qty: 8
    },
    {
      itemRef: "it-barinoff",
      charRef: "ch-barinoff-2",
      qty: 8
    },
    {
      itemRef: "it-barinoff",
      charRef: "ch-barinoff-3",
      qty: 8
    },
    {
      itemRef: "it-barinoff",
      charRef: "ch-barinoff-4",
      qty: 8
    },
    {
      itemRef: "it-barinoff",
      charRef: "ch-barinoff-5",
      qty: 8
    },
    {
      itemRef: "it-barinoff",
      charRef: "ch-barinoff-6",
      qty: 8
    },
    {
      itemRef: "it-barinoff",
      charRef: "ch-barinoff-7",
      qty: 8
    },
    {
      itemRef: "it-barinoff",
      charRef: "ch-barinoff-8",
      qty: 8
    },
    {
      itemRef: "it-barinoff",
      charRef: "ch-barinoff-9",
      qty: 8
    },
    {
      itemRef: "it-barinoff",
      charRef: "ch-barinoff-10",
      qty: 8
    },
    {
      itemRef: "it-barinoff",
      charRef: "ch-barinoff-11",
      qty: 8
    },
    {
      itemRef: "it-barinoff",
      charRef: "ch-barinoff-12",
      qty: 8
    },
    {
      itemRef: "it-monin",
      charRef: "ch-monin-1",
      qty: 8
    },
    {
      itemRef: "it-monin",
      charRef: "ch-monin-2",
      qty: 8
    },
    {
      itemRef: "it-monin",
      charRef: "ch-monin-3",
      qty: 8
    },
    {
      itemRef: "it-monin",
      charRef: "ch-monin-4",
      qty: 8
    },
    {
      itemRef: "it-monin",
      charRef: "ch-monin-5",
      qty: 8
    },
    {
      itemRef: "it-monin",
      charRef: "ch-monin-6",
      qty: 8
    },
    {
      itemRef: "it-monin",
      charRef: "ch-monin-7",
      qty: 8
    },
    {
      itemRef: "it-monin",
      charRef: "ch-monin-8",
      qty: 8
    },
    {
      itemRef: "it-monin",
      charRef: "ch-monin-9",
      qty: 8
    },
    {
      itemRef: "it-monin",
      charRef: "ch-monin-10",
      qty: 8
    },
    {
      itemRef: "it-monin",
      charRef: "ch-monin-11",
      qty: 8
    },
    {
      itemRef: "it-monin",
      charRef: "ch-monin-12",
      qty: 8
    },
    {
      itemRef: "it-lavbarista",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-tastyespresso",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-routin",
      charRef: "ch-routin-1",
      qty: 8
    },
    {
      itemRef: "it-routin",
      charRef: "ch-routin-2",
      qty: 8
    },
    {
      itemRef: "it-routin",
      charRef: "ch-routin-3",
      qty: 8
    },
    {
      itemRef: "it-lavoro",
      charRef: null,
      qty: 12
    },
    {
      itemRef: "it-maccoffee",
      charRef: null,
      qty: 12
    }
  ]
};

// apps/api/src/onec/mock-adapter.ts
var MockAdapter = class {
  name = "mock";
  orders = [];
  repairs = [];
  /** Для тестов: сколько следующих записей заказа завершить ошибкой. */
  failNext = 0;
  async ping() {
  }
  async fetchCatalog() {
    return structuredClone(mock_catalog_default);
  }
  async createOrder(order) {
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error("1\u0421 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 (\u0442\u0435\u0441\u0442)");
    }
    this.orders.push(order);
    return { ref: randomUUID() };
  }
  async createRepair(repair) {
    this.repairs.push(repair);
    return { ref: randomUUID() };
  }
  async getBonusBalance() {
    return 12;
  }
};

// apps/api/src/onec/odata-adapter.ts
import { readFileSync } from "node:fs";
var EMPTY_REF = "00000000-0000-0000-0000-000000000000";
var nullRef = (v) => typeof v === "string" && v && v !== EMPTY_REF ? v : null;
function loadODataMapping(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function renderTemplate(tpl, vars) {
  if (typeof tpl === "string") {
    const whole = tpl.match(/^\{\{(\w+)\}\}$/);
    if (whole) return vars[whole[1]] ?? null;
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
  }
  if (Array.isArray(tpl)) return tpl.map((x) => renderTemplate(x, vars));
  if (tpl && typeof tpl === "object") {
    return Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, renderTemplate(v, vars)]));
  }
  return tpl;
}
var odataGuid = (ref) => `guid'${ref}'`;
var ODataAdapter = class {
  constructor(opts, map) {
    this.map = map;
    this.http = new OneCHttp(opts);
  }
  map;
  name = "odata";
  http;
  async list(path, query) {
    const page2 = 5e3;
    const out = [];
    for (let skip = 0; ; skip += page2) {
      const qs = new URLSearchParams({ $format: "json", ...query, $top: String(page2), $skip: String(skip) });
      const res = await this.http.request("GET", `${encodeURI(path)}?${qs}`);
      const rows = res?.value ?? [];
      out.push(...rows);
      if (rows.length < page2) break;
    }
    return out;
  }
  async ping() {
    await this.http.request("GET", `${encodeURI(this.map.items.entity)}?$format=json&$top=1`);
  }
  async fetchCatalog() {
    const m = this.map;
    const f = m.items.fields;
    const select = [f.ref, f.code, f.title, f.parent, f.isFolder, f.deleted, f.article, f.description, f.unit].concat(m.items.characteristicsOwnerField !== f.ref ? [m.items.characteristicsOwnerField] : []).filter(Boolean).join(",");
    const rows = await this.list(m.items.entity, { $filter: `${f.deleted} eq false`, $select: select });
    const groups = [];
    const rawItems = [];
    for (const r of rows) {
      const ref = String(r[f.ref]);
      const base = { ref, code: String(r[f.code] ?? "").trim(), title: String(r[f.title] ?? "").trim() };
      if (r[f.isFolder]) {
        groups.push({ ...base, parentRef: nullRef(r[f.parent]) });
      } else {
        rawItems.push({
          item: {
            ...base,
            article: f.article ? r[f.article] || null : null,
            groupRef: nullRef(r[f.parent]),
            description: f.description ? r[f.description] || null : null,
            unit: null,
            characteristics: []
          },
          ownerRef: nullRef(r[m.items.characteristicsOwnerField])
        });
      }
    }
    let allowed = null;
    if (m.items.rootGroupRefs.length) {
      allowed = new Set(m.items.rootGroupRefs);
      let grew = true;
      while (grew) {
        grew = false;
        for (const g of groups) if (g.parentRef && allowed.has(g.parentRef) && !allowed.has(g.ref)) allowed.add(g.ref), grew = true;
      }
    }
    const items = rawItems.filter((x) => !allowed || x.item.groupRef && allowed.has(x.item.groupRef));
    if (m.characteristics.enabled) {
      const c = m.characteristics.fields;
      const chars = await this.list(m.characteristics.entity, {
        $filter: `${c.deleted} eq false`,
        $select: [c.ref, c.title, c.owner].join(",")
      });
      const byOwner = /* @__PURE__ */ new Map();
      for (const ch of chars) {
        const owner = nullRef(ch[c.owner]);
        if (!owner) continue;
        const list = byOwner.get(owner) ?? [];
        list.push({ ref: String(ch[c.ref]), title: String(ch[c.title] ?? "").trim() });
        byOwner.set(owner, list);
      }
      for (const x of items) x.item.characteristics = x.ownerRef && byOwner.get(x.ownerRef) || [];
    }
    const p = m.prices;
    const priceCond = `${p.priceTypeField} eq ${odataGuid(p.priceTypeRef)}`;
    const priceRows = p.sliceLast ? await this.list(`${p.entity}/SliceLast(Condition='${priceCond}')`, {}) : await this.list(p.entity, { $filter: priceCond });
    const prices = priceRows.map((r) => ({ itemRef: String(r[p.fields.item]), charRef: nullRef(r[p.fields.char]), price: Number(r[p.fields.price]) })).filter((x) => Number.isFinite(x.price));
    let stock = [];
    if (m.stock.enabled) {
      const s = m.stock;
      const cond = s.warehouseRefs.length ? `(Condition='${s.warehouseRefs.map((w) => `${s.warehouseField} eq ${odataGuid(w)}`).join(" or ")}')` : "";
      const rowsS = await this.list(`${s.entity}/Balance${cond}`, {});
      const sum = /* @__PURE__ */ new Map();
      for (const r of rowsS) {
        const itemRef = String(r[s.fields.item]);
        const charRef = nullRef(r[s.fields.char]);
        const key = `${itemRef}|${charRef ?? ""}`;
        const cur = sum.get(key) ?? { itemRef, charRef, qty: 0 };
        cur.qty += Number(r[s.fields.qty]) || 0;
        sum.set(key, cur);
      }
      stock = [...sum.values()];
    }
    return { groups, items: items.map((x) => x.item), prices, stock };
  }
  async createDocument(entity, body, post) {
    const created = await this.http.request("POST", `${encodeURI(entity)}?$format=json`, body);
    const ref = nullRef(created?.Ref_Key);
    if (!ref) throw new OneCError("1\u0421 \u043D\u0435 \u0432\u0435\u0440\u043D\u0443\u043B\u0430 Ref_Key \u0441\u043E\u0437\u0434\u0430\u043D\u043D\u043E\u0433\u043E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", void 0, false);
    if (post) {
      await this.http.request("POST", `${encodeURI(entity)}(${odataGuid(ref)})/Post?PostingModeOperational=false`);
    }
    return ref;
  }
  async createOrder(order) {
    const o = this.map.order;
    if (!o.enabled) throw new OneCError("\u0417\u0430\u043F\u0438\u0441\u044C \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u0432 1\u0421 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0430 \u0432 onec-odata.json", void 0, false);
    const lines = order.lines.map(
      (l, i) => renderTemplate(o.lineTemplate, {
        lineNumber: String(i + 1),
        itemRef: l.itemRef,
        charRef: l.charRef ?? EMPTY_REF,
        qty: l.qty,
        price: l.price,
        sum: l.sum,
        title: l.title
      })
    );
    const body = renderTemplate(o.template, {
      date: order.date.slice(0, 19),
      number: order.number,
      externalId: order.externalId,
      phone: order.phone,
      customerName: order.customerName ?? "",
      address: order.address ?? "",
      pickupPoint: order.pickupPoint ?? "",
      deliveryType: order.deliveryType === "delivery" ? "\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430" : "\u0421\u0430\u043C\u043E\u0432\u044B\u0432\u043E\u0437",
      paymentMethod: { card_on_delivery: "\u041A\u0430\u0440\u0442\u043E\u0439 \u043F\u0440\u0438 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0438", cash: "\u041D\u0430\u043B\u0438\u0447\u043D\u044B\u043C\u0438", online: "\u041E\u043D\u043B\u0430\u0439\u043D (\u042EKassa)" }[order.paymentMethod],
      paid: order.paid,
      comment: order.comment,
      total: order.total
    });
    body[o.linesField] = lines;
    return { ref: await this.createDocument(o.entity, body, o.post) };
  }
  async createRepair(repair) {
    const r = this.map.repair;
    if (!r.enabled) return null;
    const body = renderTemplate(r.template, {
      date: repair.date.slice(0, 19),
      number: repair.number,
      externalId: repair.externalId,
      phone: repair.phone,
      customerName: repair.customerName ?? "",
      model: repair.model,
      problem: repair.problem ?? "",
      pickupAddress: repair.pickupAddress ?? ""
    });
    return { ref: await this.createDocument(r.entity, body, r.post) };
  }
  async getBonusBalance() {
    return null;
  }
};

// apps/api/src/onec/index.ts
function createOneCAdapter(cfg) {
  const http = {
    baseUrl: cfg.ONEC_BASE_URL,
    user: cfg.ONEC_USER,
    password: cfg.ONEC_PASSWORD,
    timeoutMs: cfg.ONEC_TIMEOUT_MS
  };
  switch (cfg.ONEC_MODE) {
    case "odata":
      return new ODataAdapter(http, loadODataMapping(resolve2(process.cwd(), cfg.ONEC_ODATA_MAPPING)));
    case "http":
      return new HttpServiceAdapter(http);
    default:
      return new MockAdapter();
  }
}

// apps/api/src/services/auth.ts
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
var CODE_TTL_MS = 5 * 6e4;
var RESEND_AFTER_MS = 6e4;
var MAX_ATTEMPTS = 5;
var AuthError = class extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
  statusCode;
};
var AuthService = class {
  constructor(db, cfg, sms) {
    this.db = db;
    this.cfg = cfg;
    this.sms = sms;
    this.key = new TextEncoder().encode(cfg.JWT_SECRET);
  }
  db;
  cfg;
  sms;
  key;
  hash(phone, code) {
    return createHash("sha256").update(`${phone}:${code}:${this.cfg.JWT_SECRET}`).digest("hex");
  }
  /** Отправляет код. В режиме разработки возвращает его, чтобы не ждать SMS. */
  async requestCode(phone) {
    const [prev] = await this.db.select().from(authCodes).where(eq(authCodes.phone, phone));
    const now = Date.now();
    if (prev && now - prev.sentAt.getTime() < RESEND_AFTER_MS) {
      throw new AuthError("\u041A\u043E\u0434 \u0443\u0436\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C \u043C\u043E\u0436\u043D\u043E \u0447\u0435\u0440\u0435\u0437 \u043C\u0438\u043D\u0443\u0442\u0443.", 429);
    }
    const isReview = this.cfg.reviewPhones.includes(phone);
    const code = isReview ? "0000" : String(randomInt(0, 1e4)).padStart(4, "0");
    const row = {
      phone,
      codeHash: this.hash(phone, code),
      attempts: 0,
      expiresAt: new Date(now + CODE_TTL_MS),
      sentAt: new Date(now),
      consentAt: new Date(now)
    };
    await this.db.insert(authCodes).values(row).onConflictDoUpdate({ target: authCodes.phone, set: row });
    if (!isReview) await this.sms.send(phone, `\u041E\u0445\u043E\u0442\u0430 \u043A\u043E\u0444\u0435: \u043A\u043E\u0434 \u0432\u0445\u043E\u0434\u0430 ${code}. \u041D\u0438\u043A\u043E\u043C\u0443 \u0435\u0433\u043E \u043D\u0435 \u0441\u043E\u043E\u0431\u0449\u0430\u0439\u0442\u0435.`);
    const exposeCode = this.cfg.NODE_ENV !== "production" && this.cfg.SMS_PROVIDER === "console";
    return { resendIn: RESEND_AFTER_MS / 1e3, ...exposeCode ? { devCode: code } : {} };
  }
  async verifyCode(phone, code) {
    const [row] = await this.db.select().from(authCodes).where(eq(authCodes.phone, phone));
    if (!row || row.expiresAt.getTime() < Date.now()) throw new AuthError("\u041A\u043E\u0434 \u0443\u0441\u0442\u0430\u0440\u0435\u043B. \u0417\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u0435 \u043D\u043E\u0432\u044B\u0439.");
    if (row.attempts >= MAX_ATTEMPTS) throw new AuthError("\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043F\u043E\u043F\u044B\u0442\u043E\u043A. \u0417\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u0435 \u043D\u043E\u0432\u044B\u0439 \u043A\u043E\u0434.", 429);
    const ok = timingSafeEqual(Buffer.from(row.codeHash), Buffer.from(this.hash(phone, code)));
    if (!ok) {
      await this.db.update(authCodes).set({ attempts: row.attempts + 1 }).where(eq(authCodes.phone, phone));
      throw new AuthError("\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043A\u043E\u0434");
    }
    await this.db.delete(authCodes).where(eq(authCodes.phone, phone));
    let [user] = await this.db.select().from(users).where(eq(users.phone, phone));
    let isNew = false;
    if (!user) {
      [user] = await this.db.insert(users).values({ phone, consentAt: row.consentAt ?? /* @__PURE__ */ new Date() }).returning();
      isNew = true;
    }
    const token = await new SignJWT({ phone }).setProtectedHeader({ alg: "HS256" }).setSubject(user.id).setIssuedAt().setExpirationTime("90d").sign(this.key);
    return { token, userId: user.id, isNew };
  }
  /** Возвращает id пользователя или null. Удалённый пользователь не проходит. */
  async verifyToken(token) {
    try {
      const { payload } = await jwtVerify(token, this.key, { algorithms: ["HS256"] });
      if (!payload.sub) return null;
      const [u] = await this.db.select({ id: users.id, phone: users.phone }).from(users).where(eq(users.id, payload.sub));
      return u ? { userId: u.id, phone: u.phone } : null;
    } catch {
      return null;
    }
  }
};

// apps/api/src/services/catalog.ts
import { readFileSync as readFileSync2 } from "node:fs";
import { resolve as resolve3 } from "node:path";
import { eq as eq2 } from "drizzle-orm";

// packages/shared/src/money.ts
var rub = (rubles) => Math.round(rubles * 100);

// packages/shared/src/types.ts
var ORDER_STATUS_TITLE = {
  awaiting_payment: "\u041E\u0436\u0438\u0434\u0430\u0435\u0442 \u043E\u043F\u043B\u0430\u0442\u044B",
  new: "\u0417\u0430\u043A\u0430\u0437 \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D",
  accepted: "\u0417\u0430\u043A\u0430\u0437 \u043F\u0440\u0438\u043D\u044F\u0442",
  cooking: "\u0413\u043E\u0442\u043E\u0432\u0438\u043C",
  on_the_way: "\u041A\u0443\u0440\u044C\u0435\u0440 \u0432 \u043F\u0443\u0442\u0438",
  ready_for_pickup: "\u0413\u043E\u0442\u043E\u0432 \u043A \u0432\u044B\u0434\u0430\u0447\u0435",
  done: "\u0417\u0430\u043A\u0430\u0437 \u043F\u043E\u043B\u0443\u0447\u0435\u043D",
  cancelled: "\u0417\u0430\u043A\u0430\u0437 \u043E\u0442\u043C\u0435\u043D\u0451\u043D"
};
var REPAIR_STAGES = [
  { id: "accepted", title: "\u041F\u0440\u0438\u043D\u044F\u0442\u0430", text: "\u041F\u0440\u0438\u043D\u044F\u043B\u0438 \u043C\u0430\u0448\u0438\u043D\u0443 \u0432 \u0441\u0435\u0440\u0432\u0438\u0441-\u0446\u0435\u043D\u0442\u0440\u0435 \u0438 \u043E\u0444\u043E\u0440\u043C\u0438\u043B\u0438 \u0437\u0430\u043A\u0430\u0437" },
  { id: "diagnostics", title: "\u0414\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0430", text: "\u041C\u0430\u0441\u0442\u0435\u0440 \u0438\u0449\u0435\u0442 \u043F\u0440\u0438\u0447\u0438\u043D\u0443 \u043D\u0435\u0438\u0441\u043F\u0440\u0430\u0432\u043D\u043E\u0441\u0442\u0438" },
  { id: "approval", title: "\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435", text: "\u0421\u043E\u0433\u043B\u0430\u0441\u0443\u0435\u043C \u0441 \u0432\u0430\u043C\u0438 \u0441\u043C\u0435\u0442\u0443 \u0440\u0435\u043C\u043E\u043D\u0442\u0430" },
  { id: "repair", title: "\u0420\u0435\u043C\u043E\u043D\u0442", text: "\u041C\u0435\u043D\u044F\u0435\u043C \u0434\u0435\u0442\u0430\u043B\u0438 \u0438 \u043E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u0435\u043C \u043C\u0430\u0448\u0438\u043D\u0443" },
  { id: "testing", title: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430", text: "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u043F\u0440\u043E\u0433\u043E\u043D \u043F\u0435\u0440\u0435\u0434 \u0432\u044B\u0434\u0430\u0447\u0435\u0439" },
  { id: "ready", title: "\u0413\u043E\u0442\u043E\u0432\u0430 \u043A \u0432\u044B\u0434\u0430\u0447\u0435", text: "\u041F\u043E\u0437\u0432\u043E\u043D\u0438\u043C \u0438 \u043F\u0440\u0438\u0448\u043B\u0451\u043C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435 \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438" }
];

// packages/shared/src/schemas.ts
import { z } from "zod";
var phoneSchema = z.string().transform((s) => s.replace(/[^\d+]/g, "")).transform((s) => s.startsWith("8") && s.length === 11 ? `+7${s.slice(1)}` : s).transform((s) => s.startsWith("7") && s.length === 11 ? `+${s}` : s).refine((s) => /^\+7\d{10}$/.test(s), "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043D\u043E\u043C\u0435\u0440 \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 +7 900 000-00-00");
var requestCodeSchema = z.object({
  phone: phoneSchema,
  /** Согласие на обработку персональных данных (152-ФЗ). */
  consent: z.literal(true)
});
var verifyCodeSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{4}$/)
});
var orderModifierSchema = z.object({
  addonId: z.string().min(1),
  qty: z.number().int().min(1).max(5).default(1),
  /** Для сиропа: id вкуса (вариант товара-сиропа). */
  flavorId: z.string().min(1).nullable().default(null)
});
var orderLineInputSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).nullable().default(null),
  qty: z.number().int().min(1).max(50),
  modifiers: z.array(orderModifierSchema).max(20).default([])
});
var createOrderSchema = z.object({
  lines: z.array(orderLineInputSchema).min(1).max(100),
  delivery: z.object({
    type: z.enum(["delivery", "pickup"]),
    address: z.string().trim().max(300).nullable().default(null),
    pickupPointId: z.string().nullable().default(null),
    comment: z.string().trim().max(500).nullable().default(null)
  }),
  paymentMethod: z.enum(["card_on_delivery", "cash", "online"]),
  /** Ключ идемпотентности с клиента: повторная отправка не создаст второй заказ. */
  clientRequestId: z.string().uuid()
}).refine((o) => o.delivery.type !== "delivery" || (o.delivery.address?.length ?? 0) >= 5, {
  message: "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0430\u0434\u0440\u0435\u0441 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438",
  path: ["delivery", "address"]
}).refine((o) => o.delivery.type !== "pickup" || !!o.delivery.pickupPointId, {
  message: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0443\u043D\u043A\u0442 \u0441\u0430\u043C\u043E\u0432\u044B\u0432\u043E\u0437\u0430",
  path: ["delivery", "pickupPointId"]
});
var createRepairSchema = z.object({
  model: z.string().trim().min(2).max(120),
  problem: z.string().trim().max(1e3).nullable().default(null),
  pickupAddress: z.string().trim().max(300).nullable().default(null),
  clientRequestId: z.string().uuid()
});
var updateMeSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  city: z.string().trim().max(80).optional()
});
var deviceSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(["ios", "android", "web"])
});

// packages/shared/src/repair.ts
function estimateRepair(problem) {
  const p = (problem ?? "").toLowerCase();
  const rules = [
    [/накип|декальцин|очист|чист/, 1500, 3e3],
    [/теч|протека|лужа|капа/, 2500, 6e3],
    [/не греет|холодн|тэн|нагрев|термоблок/, 3500, 9e3],
    [/помп|насос|не кач|не подаёт|не подает|давлен/, 3e3, 8e3],
    [/жернов|кофемолк|не мелет|молка/, 2500, 7e3],
    [/капучин|молок|пена|вспен/, 1500, 4e3],
    [/ошибк|не включ|плат|электрон|дисплей/, 3e3, 12e3]
  ];
  const hit = rules.find(([re]) => re.test(p));
  return hit ? { min: rub(hit[1]), max: rub(hit[2]) } : { min: rub(1500), max: rub(8e3) };
}
var DIAGNOSTICS_PRICE = rub(800);

// apps/api/src/services/catalog-build.ts
function parseMl(title) {
  const ml = title.match(/(\d+(?:[.,]\d+)?)\s*мл/i);
  if (ml) return Math.round(parseFloat(ml[1].replace(",", ".")));
  const l = title.match(/(\d+(?:[.,]\d+)?)\s*л\b/i);
  if (l) return Math.round(parseFloat(l[1].replace(",", ".")) * 1e3);
  return null;
}
function buildSnapshot(src, cfg, opts) {
  const groupByRef = new Map(src.groups.map((g) => [g.ref, g]));
  const matchesRule = (g, keys) => keys.some((k) => k === g.ref || k === g.code || k.toLowerCase() === g.title.toLowerCase());
  const resolveRule = (groupRef, rules) => {
    let cur = groupRef ? groupByRef.get(groupRef) : void 0;
    const seen = /* @__PURE__ */ new Set();
    while (cur && !seen.has(cur.ref)) {
      seen.add(cur.ref);
      const rule = rules.find((r) => matchesRule(cur, r.groups));
      if (rule) return rule;
      cur = cur.parentRef ? groupByRef.get(cur.parentRef) : void 0;
    }
    return null;
  };
  const isAddonGroup = (groupRef) => !!resolveRule(groupRef, [{ id: "addons", title: "", groups: cfg.addons.groups }]);
  const priceOf = /* @__PURE__ */ new Map();
  for (const p of src.prices) priceOf.set(`${p.itemRef}|${p.charRef ?? ""}`, p.price);
  const stockOf = /* @__PURE__ */ new Map();
  for (const s of src.stock) stockOf.set(`${s.itemRef}|${s.charRef ?? ""}`, (stockOf.get(`${s.itemRef}|${s.charRef ?? ""}`) ?? 0) + s.qty);
  const hasStockData = src.stock.length > 0;
  const media = (file) => {
    if (!file) return null;
    if (/^https?:\/\//.test(file)) return file;
    return `${opts.mediaBaseUrl.replace(/\/+$/, "")}/${file.replace(/^\/+/, "")}`;
  };
  const variantsOf = (it) => {
    const base = priceOf.get(`${it.ref}|`);
    return it.characteristics.map((c) => {
      const price = priceOf.get(`${it.ref}|${c.ref}`) ?? base;
      if (price === void 0) return null;
      const stock = hasStockData ? stockOf.get(`${it.ref}|${c.ref}`) ?? 0 : null;
      return { id: c.ref, title: c.title, price: rub(price), ml: parseMl(c.title), stock };
    }).filter((v) => v !== null);
  };
  const categories = [];
  const products = [];
  const addons = [];
  const pushCategories = (rules, kind) => rules.forEach(
    (r, i) => categories.push({
      id: r.id,
      parentId: null,
      title: r.title,
      kind,
      sort: i + 1,
      presentation: r.presentation ?? null,
      images: (r.images ?? []).map((x) => media(x)).filter(Boolean)
    })
  );
  pushCategories(cfg.shop, "shop");
  pushCategories(cfg.menu, "menu");
  for (const it of src.items) {
    const ex = cfg.products[it.code] ?? {};
    if (ex.hidden) continue;
    if (isAddonGroup(it.groupRef)) {
      const rule2 = cfg.addons.items[it.code] ?? {};
      const variants2 = variantsOf(it);
      const base = priceOf.get(`${it.ref}|`);
      const priceByMl = variants2.length ? Object.fromEntries(variants2.filter((v) => v.ml).map((v) => [String(v.ml), v.price])) : null;
      const price2 = base !== void 0 ? rub(base) : variants2[0]?.price ?? null;
      if (price2 === null) continue;
      addons.push({
        id: it.ref,
        title: rule2.title ?? it.title,
        price: price2,
        priceByMl,
        maxQty: rule2.maxQty ?? 1,
        needsFlavor: !!rule2.needsFlavor,
        sort: rule2.sort ?? 100
      });
      continue;
    }
    const shopRule = resolveRule(it.groupRef, cfg.shop);
    const menuRule = shopRule ? null : resolveRule(it.groupRef, cfg.menu);
    const rule = shopRule ?? menuRule;
    if (!rule) continue;
    const kind = shopRule ? "shop" : "menu";
    const variants = variantsOf(it).map((v) => kind === "menu" ? { ...v, stock: null } : v);
    const basePrice = priceOf.get(`${it.ref}|`);
    const price = variants.length ? Math.min(...variants.map((v) => v.price)) : basePrice !== void 0 ? rub(basePrice) : null;
    if (price === null) continue;
    const stock = !hasStockData || kind === "menu" ? null : variants.length ? variants.reduce((a, v) => a + (v.stock ?? 0), 0) : stockOf.get(`${it.ref}|`) ?? 0;
    const title = ex.title ?? it.title;
    const feedIdx = cfg.feed.indexOf(it.code);
    products.push({
      id: it.ref,
      code: it.code,
      title,
      subtitle: ex.subtitle ?? "",
      description: it.description ?? "",
      categoryId: rule.id,
      kind,
      price,
      oldPrice: ex.oldPrice ? rub(ex.oldPrice) : null,
      image: media(ex.image),
      imageRatio: ex.imageRatio ?? null,
      stock,
      facts: ex.facts ?? [],
      hasVariants: kind === "shop" && variants.length > 0,
      variants,
      searchText: [title, ex.subtitle, ex.keywords, it.article, it.code].filter(Boolean).join(" ").toLowerCase(),
      featured: feedIdx >= 0 ? feedIdx : null,
      color: ex.color ?? null,
      rowBreak: !!ex.rowBreak,
      note: ex.note ?? null
    });
  }
  for (const c of categories) {
    if (c.kind !== "shop" || c.images.length) continue;
    c.images = products.filter((p) => p.categoryId === c.id && p.image).slice(0, 3).map((p) => p.image);
  }
  const syrupBrands = cfg.syrupsCategory ? products.filter((p) => p.categoryId === cfg.syrupsCategory && p.variants.length).map((p) => ({
    id: p.id,
    title: p.title.replace(/^Сиропы\s+/i, ""),
    flavors: p.variants.map((v) => ({ id: v.id, title: v.title }))
  })) : [];
  addons.sort((a, b) => a.sort - b.sort);
  return { categories, products, addons, syrupBrands, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}

// apps/api/src/services/catalog.ts
function loadCatalogConfig(path) {
  return JSON.parse(readFileSync2(resolve3(process.cwd(), path), "utf8"));
}
var CatalogService = class {
  constructor(db, onec, cfg, mediaBaseUrl, log) {
    this.db = db;
    this.onec = onec;
    this.cfg = cfg;
    this.mediaBaseUrl = mediaBaseUrl;
    this.log = log;
  }
  db;
  onec;
  cfg;
  mediaBaseUrl;
  log;
  snapshot = null;
  productIndex = /* @__PURE__ */ new Map();
  addonIndex = /* @__PURE__ */ new Map();
  timer = null;
  syncing = null;
  lastError = null;
  lastSyncAt = null;
  setSnapshot(s) {
    this.snapshot = s;
    this.productIndex = new Map(s.products.map((p) => [p.id, p]));
    this.addonIndex = new Map(s.addons.map((a) => [a.id, a]));
  }
  /** Загружает последний снимок из БД, затем пробует обновить из 1С. */
  async init() {
    const [row] = await this.db.select().from(catalogSnapshot).where(eq2(catalogSnapshot.id, 1));
    if (row) {
      this.setSnapshot(row.data);
      this.lastSyncAt = row.syncedAt;
    }
    await this.sync().catch(() => void 0);
  }
  start(intervalMin) {
    this.stop();
    this.timer = setInterval(() => void this.sync().catch(() => void 0), intervalMin * 6e4);
    this.timer.unref();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  sync() {
    if (this.syncing) return this.syncing;
    this.syncing = (async () => {
      const started = Date.now();
      try {
        const raw = await this.onec.fetchCatalog();
        const snap = buildSnapshot(raw, this.cfg, { mediaBaseUrl: this.mediaBaseUrl });
        if (!snap.products.length) throw new Error("\u0412 \u0432\u044B\u0433\u0440\u0443\u0437\u043A\u0435 1\u0421 \u043D\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u0442\u043E\u0432\u0430\u0440\u0430 \u0441 \u0446\u0435\u043D\u043E\u0439: \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 config/catalog.json");
        await this.db.insert(catalogSnapshot).values({ id: 1, data: snap, source: this.onec.name }).onConflictDoUpdate({ target: catalogSnapshot.id, set: { data: snap, source: this.onec.name, syncedAt: /* @__PURE__ */ new Date() } });
        this.setSnapshot(snap);
        this.lastSyncAt = /* @__PURE__ */ new Date();
        this.lastError = null;
        this.log.info({ products: snap.products.length, ms: Date.now() - started }, "\u041A\u0430\u0442\u0430\u043B\u043E\u0433 1\u0421 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D");
      } catch (e) {
        this.lastError = e.message;
        this.log.error({ err: e }, "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430 1\u0421");
        throw e;
      } finally {
        this.syncing = null;
      }
    })();
    return this.syncing;
  }
  get() {
    if (!this.snapshot) throw Object.assign(new Error("\u041A\u0430\u0442\u0430\u043B\u043E\u0433 \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D \u0438\u0437 1\u0421"), { statusCode: 503 });
    return this.snapshot;
  }
  product(id) {
    return this.productIndex.get(id);
  }
  addon(id) {
    return this.addonIndex.get(id);
  }
};

// apps/api/src/services/orders.ts
import { and as and2, desc, eq as eq4 } from "drizzle-orm";

// apps/api/src/services/outbox.ts
import { createHmac } from "node:crypto";
import { and, eq as eq3, sql as sql2 } from "drizzle-orm";
async function enqueue(db, topic, payload) {
  await db.insert(outbox).values({ topic, payload });
}
var MAX_ATTEMPTS2 = 25;
var backoffMs = (attempt) => Math.min(3e4 * 2 ** (attempt - 1), 60 * 6e4);
var OutboxWorker = class {
  constructor(db, cfg, onec, push, catalog, log, fetchImpl = fetch) {
    this.db = db;
    this.cfg = cfg;
    this.onec = onec;
    this.push = push;
    this.catalog = catalog;
    this.log = log;
    this.fetchImpl = fetchImpl;
  }
  db;
  cfg;
  onec;
  push;
  catalog;
  log;
  fetchImpl;
  timer = null;
  running = false;
  start(intervalMs = 3e3) {
    this.stop();
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref();
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  /** Обрабатывает пачку готовых событий. Возвращает число обработанных. */
  async tick() {
    if (this.running) return 0;
    this.running = true;
    try {
      const res = await this.db.execute(sql2`
        update ${outbox} set locked_until = now() + interval '2 minutes'
        where id in (
          select id from ${outbox}
          where done_at is null and next_run_at <= now() and (locked_until is null or locked_until < now())
          order by id limit 20 for update skip locked
        )
        returning id, topic, payload, attempts`);
      const rows = res.rows;
      for (const row of rows) await this.handle(row);
      return rows.length;
    } catch (e) {
      this.log.error({ err: e }, "\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043E\u0447\u0435\u0440\u0435\u0434\u0438");
      return 0;
    } finally {
      this.running = false;
    }
  }
  async handle(row) {
    const attempt = row.attempts + 1;
    try {
      await this.process(row.topic, row.payload);
      await this.db.update(outbox).set({ doneAt: /* @__PURE__ */ new Date(), attempts: attempt, lastError: null, lockedUntil: null }).where(eq3(outbox.id, row.id));
    } catch (e) {
      const err = e;
      const permanent = e instanceof OneCError && !e.retryable || attempt >= MAX_ATTEMPTS2;
      this.log.warn({ id: row.id, topic: row.topic, attempt, err: err.message, permanent }, "\u0421\u043E\u0431\u044B\u0442\u0438\u0435 \u043E\u0447\u0435\u0440\u0435\u0434\u0438 \u043D\u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043E");
      await this.db.update(outbox).set({
        attempts: attempt,
        lastError: (permanent ? "\u0421\u0422\u041E\u041F: " : "") + err.message.slice(0, 1e3),
        nextRunAt: new Date(Date.now() + backoffMs(attempt)),
        lockedUntil: null,
        ...permanent ? { doneAt: /* @__PURE__ */ new Date() } : {}
      }).where(eq3(outbox.id, row.id));
    }
  }
  async process(topic, payload) {
    switch (topic) {
      case "onec.order":
        return this.sendOrderTo1C(payload.orderId);
      case "onec.repair":
        return this.sendRepairTo1C(payload.repairId);
      case "internal.webhook":
        return this.sendWebhook(payload);
      case "push":
        return this.sendPush(payload);
    }
  }
  async sendOrderTo1C(orderId) {
    if (!this.cfg.ONEC_WRITE_ORDERS) return;
    const [o] = await this.db.select().from(orders).where(eq3(orders.id, orderId));
    if (!o || o.onecRef) return;
    const lines = o.lines;
    const pickup = this.cfg.pickupPoints.find((p) => p.id === o.delivery.pickupPointId);
    const delivery = o.delivery;
    const oneLines = [];
    const commentParts = [];
    for (const l of lines) {
      const base = l.unitPrice - l.modifiers.reduce((s, m) => s + m.unitPrice * m.qty, 0);
      oneLines.push({ itemRef: l.productId, charRef: l.variantId, title: l.title, qty: l.qty, price: base / 100, sum: base * l.qty / 100 });
      for (const m of l.modifiers) {
        const addon = this.catalog.addon(m.addonId);
        oneLines.push({
          itemRef: m.addonId,
          charRef: null,
          title: m.title,
          qty: m.qty * l.qty,
          price: m.unitPrice / 100,
          sum: m.unitPrice * m.qty * l.qty / 100
        });
        if (m.flavorId || !addon) commentParts.push(`${l.title}: ${m.title}`);
      }
    }
    if (o.deliveryFee) commentParts.push(`\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430 ${o.deliveryFee / 100} \u20BD`);
    if (delivery.comment) commentParts.push(`\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439: ${delivery.comment}`);
    const number = String(1e3 + o.seq);
    const { ref } = await this.onec.createOrder({
      number,
      externalId: o.id,
      date: o.createdAt.toISOString(),
      phone: o.phone,
      customerName: o.customerName,
      deliveryType: delivery.type,
      address: delivery.address,
      pickupPoint: pickup ? `${pickup.title}, ${pickup.address}` : null,
      paymentMethod: o.paymentMethod,
      paid: o.paymentStatus === "succeeded",
      comment: commentParts.join("; "),
      lines: oneLines,
      total: o.total / 100
    });
    await this.db.update(orders).set({ onecRef: ref, onecSyncedAt: /* @__PURE__ */ new Date() }).where(eq3(orders.id, orderId));
  }
  async sendRepairTo1C(repairId) {
    if (!this.cfg.ONEC_WRITE_ORDERS) return;
    const [r] = await this.db.select().from(repairs).where(eq3(repairs.id, repairId));
    if (!r || r.onecRef) return;
    const res = await this.onec.createRepair({
      number: `\u0420-${1e3 + r.seq}`,
      externalId: r.id,
      date: r.createdAt.toISOString(),
      phone: r.phone,
      customerName: null,
      model: r.model,
      problem: r.problem,
      pickupAddress: r.pickupAddress
    });
    if (res) await this.db.update(repairs).set({ onecRef: res.ref }).where(eq3(repairs.id, repairId));
  }
  async sendWebhook(p) {
    if (!this.cfg.INTERNAL_WEBHOOK_URL) return;
    const body = JSON.stringify({ event: p.event, data: p.data, sentAt: (/* @__PURE__ */ new Date()).toISOString() });
    const sig = createHmac("sha256", this.cfg.INTERNAL_WEBHOOK_SECRET).update(body).digest("hex");
    const res = await this.fetchImpl(this.cfg.INTERNAL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-KBS-Event": p.event, "X-KBS-Signature": `sha256=${sig}` },
      body,
      signal: AbortSignal.timeout(15e3)
    });
    if (!res.ok) throw new Error(`\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0435\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B\u043E ${res.status}`);
  }
  async sendPush(p) {
    if (!this.push.enabled) return;
    const list = await this.db.select().from(devices).where(eq3(devices.userId, p.userId));
    for (const d of list) {
      const r = await this.push.send(d.token, { title: p.title, body: p.body, data: p.data });
      if (r === "invalid_token") {
        await this.db.delete(devices).where(and(eq3(devices.userId, d.userId), eq3(devices.token, d.token)));
      }
    }
  }
};

// apps/api/src/services/notify.ts
async function notifyUser(db, userId, n) {
  if (!userId) return;
  await db.insert(notifications).values({ userId, kind: n.kind, title: n.title, body: n.body, refId: n.refId ?? null });
  await enqueue(db, "push", {
    userId,
    title: n.title,
    body: n.body,
    data: { kind: n.kind, ...n.refId ? { refId: n.refId } : {} }
  });
}

// apps/api/src/services/pricing.ts
var PricingError = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
  code;
  statusCode = 422;
};
function priceLines(input, catalog) {
  const snap = catalog.get();
  const flavorTitle = /* @__PURE__ */ new Map();
  for (const b of snap.syrupBrands) for (const f of b.flavors) flavorTitle.set(f.id, `${f.title} (${b.title})`);
  return input.map((l) => {
    const p = catalog.product(l.productId);
    if (!p) throw new PricingError("\u0422\u043E\u0432\u0430\u0440 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435 \u043F\u0440\u043E\u0434\u0430\u0451\u0442\u0441\u044F. \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u0435 \u043A\u043E\u0440\u0437\u0438\u043D\u0443.", "product_not_found");
    let unit = p.price;
    let variantTitle = null;
    let ml = null;
    if (p.variants.length) {
      const v = p.variants.find((x) => x.id === l.variantId);
      if (!v) throw new PricingError(`\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0434\u043B\u044F \xAB${p.title}\xBB`, "variant_required");
      if (v.stock !== null && v.stock !== void 0 && v.stock < l.qty) {
        throw new PricingError(`\xAB${p.title}, ${v.title}\xBB: \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438 ${v.stock} \u0448\u0442.`, "out_of_stock");
      }
      unit = v.price;
      variantTitle = v.title;
      ml = v.ml ?? null;
    } else {
      if (l.variantId) throw new PricingError(`\u0423 \xAB${p.title}\xBB \u043D\u0435\u0442 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432`, "variant_unexpected");
      if (p.stock !== null && p.stock < l.qty) {
        throw new PricingError(`\xAB${p.title}\xBB: \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438 ${p.stock} \u0448\u0442.`, "out_of_stock");
      }
    }
    if (l.modifiers.length && p.kind !== "menu") {
      throw new PricingError("\u0414\u043E\u0431\u0430\u0432\u043A\u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u043D\u0430\u043F\u0438\u0442\u043A\u043E\u0432", "modifiers_not_allowed");
    }
    const modifiers = l.modifiers.map((m) => {
      const a = catalog.addon(m.addonId);
      if (!a) throw new PricingError("\u0414\u043E\u0431\u0430\u0432\u043A\u0430 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430", "addon_not_found");
      if (m.qty > a.maxQty) throw new PricingError(`\xAB${a.title}\xBB: \u043D\u0435 \u0431\u043E\u043B\u044C\u0448\u0435 ${a.maxQty}`, "addon_qty");
      let title = a.title;
      if (a.needsFlavor) {
        const ft = m.flavorId ? flavorTitle.get(m.flavorId) : void 0;
        if (!ft) throw new PricingError("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u043A\u0443\u0441 \u0441\u0438\u0440\u043E\u043F\u0430", "flavor_required");
        title = `${a.title}: ${ft}`;
      }
      const byMl = ml !== null ? a.priceByMl?.[String(ml)] : void 0;
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
      total: lineUnit * l.qty
    };
  });
}
function deliveryFee(subtotal, type, freeFrom, fee) {
  if (type === "pickup") return 0;
  return subtotal >= freeFrom ? 0 : fee;
}

// apps/api/src/services/orders.ts
var orderNumber = (seq) => String(1e3 + seq);
function toOrder(r) {
  return {
    id: r.id,
    number: orderNumber(r.seq),
    status: r.status,
    paymentMethod: r.paymentMethod,
    paymentStatus: r.paymentStatus,
    lines: r.lines,
    subtotal: r.subtotal,
    deliveryFee: r.deliveryFee,
    total: r.total,
    delivery: r.delivery,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString()
  };
}
var TRANSITIONS = {
  awaiting_payment: ["new", "cancelled"],
  new: ["accepted", "cooking", "on_the_way", "ready_for_pickup", "done", "cancelled"],
  accepted: ["cooking", "on_the_way", "ready_for_pickup", "done", "cancelled"],
  cooking: ["on_the_way", "ready_for_pickup", "done", "cancelled"],
  on_the_way: ["done", "cancelled"],
  ready_for_pickup: ["done", "cancelled"],
  done: [],
  cancelled: []
};
var OrderError = class extends Error {
  constructor(message, statusCode = 400, code = "order_error") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
  statusCode;
  code;
};
var OrdersService = class {
  constructor(db, cfg, catalog, yookassa) {
    this.db = db;
    this.cfg = cfg;
    this.catalog = catalog;
    this.yookassa = yookassa;
  }
  db;
  cfg;
  catalog;
  yookassa;
  /**
   * Создаёт заказ. Цены пересчитываются на сервере. Повторный запрос с тем же
   * clientRequestId вернёт уже созданный заказ (например, если пропала связь).
   */
  async create(userId, input) {
    const [dup] = await this.db.select().from(orders).where(and2(eq4(orders.userId, userId), eq4(orders.clientRequestId, input.clientRequestId)));
    if (dup) return { order: toOrder(dup), paymentUrl: await this.paymentUrlFor(dup) };
    if (input.paymentMethod === "online" && !this.yookassa) {
      throw new OrderError("\u041E\u043D\u043B\u0430\u0439\u043D-\u043E\u043F\u043B\u0430\u0442\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043E\u043F\u043B\u0430\u0442\u0443 \u043F\u0440\u0438 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0438.", 422, "online_disabled");
    }
    if (input.delivery.type === "pickup" && !this.cfg.pickupPoints.some((p) => p.id === input.delivery.pickupPointId)) {
      throw new PricingError("\u041F\u0443\u043D\u043A\u0442 \u0441\u0430\u043C\u043E\u0432\u044B\u0432\u043E\u0437\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", "pickup_not_found");
    }
    const lines = priceLines(input.lines, this.catalog);
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const fee = deliveryFee(subtotal, input.delivery.type, rub(this.cfg.FREE_DELIVERY_FROM_RUB), rub(this.cfg.DELIVERY_FEE_RUB));
    const total = subtotal + fee;
    const online = input.paymentMethod === "online";
    const [user] = await this.db.select().from(users).where(eq4(users.id, userId));
    if (!user) throw new OrderError("\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", 401);
    const row = await this.db.transaction(async (tx) => {
      const [created] = await tx.insert(orders).values({
        userId,
        clientRequestId: input.clientRequestId,
        status: online ? "awaiting_payment" : "new",
        paymentMethod: input.paymentMethod,
        paymentStatus: online ? "pending" : "not_required",
        phone: user.phone,
        customerName: user.name,
        lines,
        delivery: {
          type: input.delivery.type,
          address: input.delivery.type === "delivery" ? input.delivery.address : null,
          pickupPointId: input.delivery.type === "pickup" ? input.delivery.pickupPointId : null,
          comment: input.delivery.comment || null
        },
        subtotal,
        deliveryFee: fee,
        total
      }).returning();
      if (!online) await this.afterConfirmed(tx, created);
      return created;
    });
    let paymentUrl = null;
    if (online) {
      const payment = await this.yookassa.createPayment({
        orderId: row.id,
        orderNumber: orderNumber(row.seq),
        amount: total,
        returnUrl: `${this.cfg.PUBLIC_URL}/pay/return?order=${row.id}`,
        phone: row.phone,
        lines,
        deliveryFee: fee
      });
      await this.db.update(orders).set({ yookassaPaymentId: payment.id }).where(eq4(orders.id, row.id));
      paymentUrl = payment.confirmation?.confirmation_url ?? null;
    }
    return { order: toOrder(row), paymentUrl };
  }
  async paymentUrlFor(r) {
    if (r.paymentStatus !== "pending" || !r.yookassaPaymentId || !this.yookassa) return null;
    const p = await this.yookassa.getPayment(r.yookassaPaymentId).catch(() => null);
    return p?.status === "pending" ? p.confirmation?.confirmation_url ?? null : null;
  }
  async afterConfirmed(tx, o) {
    await enqueue(tx, "onec.order", { orderId: o.id });
    await enqueue(tx, "internal.webhook", { event: "order.created", data: toOrder(o) });
    await notifyUser(tx, o.userId, {
      kind: "order",
      title: `\u0417\u0430\u043A\u0430\u0437 ${orderNumber(o.seq)} \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D`,
      body: o.paymentMethod === "online" ? "\u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u043E\u0448\u043B\u0430, \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u043C \u0441\u043E\u0431\u0438\u0440\u0430\u0442\u044C \u0437\u0430\u043A\u0430\u0437" : "\u0421\u043A\u043E\u0440\u043E \u0441\u0432\u044F\u0436\u0435\u043C\u0441\u044F \u0441 \u0432\u0430\u043C\u0438 \u0434\u043B\u044F \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F",
      refId: o.id
    });
  }
  /**
   * Проверка платежа. Статус берётся из API ЮKassa по id, а не из тела вебхука,
   * поэтому поддельный вебхук ничего не изменит.
   */
  async syncPayment(paymentId) {
    if (!this.yookassa) return null;
    const p = await this.yookassa.getPayment(paymentId);
    const orderId = p.metadata?.orderId;
    if (!orderId) return null;
    return this.db.transaction(async (tx) => {
      const [o] = await tx.select().from(orders).where(eq4(orders.id, orderId)).for("update");
      if (!o || o.yookassaPaymentId !== p.id) return null;
      if (o.paymentStatus !== "pending") return toOrder(o);
      if (p.status === "succeeded") {
        if (Math.round(Number(p.amount.value) * 100) !== o.total) throw new Error("\u0421\u0443\u043C\u043C\u0430 \u043F\u043B\u0430\u0442\u0435\u0436\u0430 \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441 \u0437\u0430\u043A\u0430\u0437\u043E\u043C");
        const [u] = await tx.update(orders).set({ paymentStatus: "succeeded", status: "new", updatedAt: /* @__PURE__ */ new Date() }).where(eq4(orders.id, o.id)).returning();
        await this.afterConfirmed(tx, u);
        return toOrder(u);
      }
      if (p.status === "canceled") {
        const [u] = await tx.update(orders).set({ paymentStatus: "canceled", status: "cancelled", updatedAt: /* @__PURE__ */ new Date() }).where(eq4(orders.id, o.id)).returning();
        return toOrder(u);
      }
      return toOrder(o);
    });
  }
  async listForUser(userId, limit = 50) {
    const rows = await this.db.select().from(orders).where(eq4(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(limit);
    return rows.map(toOrder);
  }
  async getForUser(userId, id) {
    const [r] = await this.db.select().from(orders).where(and2(eq4(orders.id, id), eq4(orders.userId, userId)));
    if (!r) return null;
    if (r.paymentStatus === "pending" && r.yookassaPaymentId) {
      return await this.syncPayment(r.yookassaPaymentId).catch(() => null) ?? toOrder(r);
    }
    return toOrder(r);
  }
  async retryPayment(userId, id) {
    const [r] = await this.db.select().from(orders).where(and2(eq4(orders.id, id), eq4(orders.userId, userId)));
    if (!r) throw new OrderError("\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", 404);
    return this.paymentUrlFor(r);
  }
  /** Отмена клиентом: только пока заказ не взят в работу. */
  async cancelByUser(userId, id) {
    const [r] = await this.db.select().from(orders).where(and2(eq4(orders.id, id), eq4(orders.userId, userId)));
    if (!r) throw new OrderError("\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", 404);
    if (!["awaiting_payment", "new"].includes(r.status) || r.paymentStatus === "succeeded") {
      throw new OrderError("\u0417\u0430\u043A\u0430\u0437 \u0443\u0436\u0435 \u0433\u043E\u0442\u043E\u0432\u0438\u0442\u0441\u044F. \u041F\u043E\u0437\u0432\u043E\u043D\u0438\u0442\u0435 \u043D\u0430\u043C, \u0447\u0442\u043E\u0431\u044B \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u044C.", 409, "cannot_cancel");
    }
    return this.setStatus(id, "cancelled", "client");
  }
  /** Смена статуса из внутреннего приложения или 1С. Клиент получает push. */
  async setStatus(id, status, by = "internal") {
    return this.db.transaction(async (tx) => {
      const [r] = await tx.select().from(orders).where(eq4(orders.id, id)).for("update");
      if (!r) throw new OrderError("\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", 404);
      const from = r.status;
      if (from === status) return toOrder(r);
      if (!TRANSITIONS[from].includes(status)) {
        throw new OrderError(`\u041D\u0435\u043B\u044C\u0437\u044F \u043F\u0435\u0440\u0435\u0432\u0435\u0441\u0442\u0438 \u0437\u0430\u043A\u0430\u0437 \u0438\u0437 \xAB${ORDER_STATUS_TITLE[from]}\xBB \u0432 \xAB${ORDER_STATUS_TITLE[status]}\xBB`, 409, "bad_transition");
      }
      const [u] = await tx.update(orders).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(orders.id, id)).returning();
      const order = toOrder(u);
      await enqueue(tx, "internal.webhook", { event: "order.status_changed", data: { ...order, changedBy: by } });
      if (by === "internal") {
        await notifyUser(tx, u.userId, {
          kind: "order",
          title: `\u0417\u0430\u043A\u0430\u0437 ${order.number}: ${ORDER_STATUS_TITLE[status].toLowerCase()}`,
          body: statusText(status, this.cfg.DELIVERY_ETA),
          refId: id
        });
      }
      return order;
    });
  }
  async listAll(opts) {
    const conds = [];
    if (opts.status) conds.push(eq4(orders.status, opts.status));
    const rows = await this.db.select().from(orders).where(conds.length ? and2(...conds) : void 0).orderBy(desc(orders.createdAt)).limit(opts.limit);
    return rows.filter((r) => !opts.since || r.updatedAt >= opts.since).map(toOrder);
  }
  async getById(id) {
    const [r] = await this.db.select().from(orders).where(eq4(orders.id, id));
    return r ? { order: toOrder(r), phone: r.phone, customerName: r.customerName, onecRef: r.onecRef } : null;
  }
};
function statusText(s, eta) {
  switch (s) {
    case "accepted":
      return "\u041C\u044B \u043F\u0440\u0438\u043D\u044F\u043B\u0438 \u0437\u0430\u043A\u0430\u0437 \u0438 \u0441\u043A\u043E\u0440\u043E \u043D\u0430\u0447\u043D\u0451\u043C \u0433\u043E\u0442\u043E\u0432\u0438\u0442\u044C";
    case "cooking":
      return "\u0411\u0430\u0440\u0438\u0441\u0442\u0430 \u0443\u0436\u0435 \u0433\u043E\u0442\u043E\u0432\u0438\u0442 \u0432\u0430\u0448 \u0437\u0430\u043A\u0430\u0437";
    case "on_the_way":
      return `\u041A\u0443\u0440\u044C\u0435\u0440 \u0432\u044B\u0435\u0445\u0430\u043B, \u0431\u0443\u0434\u0435\u0442 \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u043E \u0447\u0435\u0440\u0435\u0437 ${eta}`;
    case "ready_for_pickup":
      return "\u041C\u043E\u0436\u043D\u043E \u0437\u0430\u0431\u0438\u0440\u0430\u0442\u044C";
    case "done":
      return "\u0421\u043F\u0430\u0441\u0438\u0431\u043E! \u0416\u0434\u0451\u043C \u0432\u0430\u0441 \u0441\u043D\u043E\u0432\u0430";
    case "cancelled":
      return "\u0415\u0441\u043B\u0438 \u044D\u0442\u043E \u043E\u0448\u0438\u0431\u043A\u0430, \u043F\u043E\u0437\u0432\u043E\u043D\u0438\u0442\u0435 \u043D\u0430\u043C";
    default:
      return "";
  }
}

// apps/api/src/services/push.ts
import { SignJWT as SignJWT2, importPKCS8 } from "jose";
var FcmPush = class {
  constructor(projectId, clientEmail, privateKey, fetchImpl = fetch) {
    this.projectId = projectId;
    this.clientEmail = clientEmail;
    this.privateKey = privateKey;
    this.fetchImpl = fetchImpl;
  }
  projectId;
  clientEmail;
  privateKey;
  fetchImpl;
  enabled = true;
  token = null;
  async accessToken() {
    if (this.token && this.token.exp > Date.now() + 6e4) return this.token.value;
    const key = await importPKCS8(this.privateKey.replace(/\\n/g, "\n"), "RS256");
    const now = Math.floor(Date.now() / 1e3);
    const assertion = await new SignJWT2({ scope: "https://www.googleapis.com/auth/firebase.messaging" }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(this.clientEmail).setAudience("https://oauth2.googleapis.com/token").setIssuedAt(now).setExpirationTime(now + 3600).sign(key);
    const res = await this.fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
    });
    const data = await res.json();
    if (!data.access_token) throw new Error("FCM: \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C access token");
    this.token = { value: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1e3 };
    return this.token.value;
  }
  async send(token, msg) {
    const res = await this.fetchImpl(`https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: msg.data ?? {},
          apns: { payload: { aps: { sound: "default" } } },
          android: { priority: "high", notification: { color: "#7b4fd6" } }
        }
      })
    });
    if (res.ok) return "ok";
    const text2 = await res.text();
    if (res.status === 404 || text2.includes("UNREGISTERED") || text2.includes("INVALID_ARGUMENT")) return "invalid_token";
    throw new Error(`FCM ${res.status}: ${text2.slice(0, 300)}`);
  }
};
var NoopPush = class {
  enabled = false;
  async send() {
    return "ok";
  }
};
function createPush(cfg) {
  return cfg.FCM_PROJECT_ID && cfg.FCM_CLIENT_EMAIL && cfg.FCM_PRIVATE_KEY ? new FcmPush(cfg.FCM_PROJECT_ID, cfg.FCM_CLIENT_EMAIL, cfg.FCM_PRIVATE_KEY) : new NoopPush();
}

// apps/api/src/services/repairs.ts
import { and as and3, desc as desc2, eq as eq5 } from "drizzle-orm";
var repairNumber = (seq) => `\u0420-${1e3 + seq}`;
function toRepair(r) {
  return {
    id: r.id,
    number: repairNumber(r.seq),
    model: r.model,
    serial: r.serial,
    problem: r.problem,
    stage: r.stage,
    history: r.history,
    services: r.services,
    estimateMin: r.estimateMin,
    estimateMax: r.estimateMax,
    total: r.total,
    readyBy: r.readyBy?.toISOString() ?? null,
    master: r.masterName ? { name: r.masterName } : null,
    pickupAddress: r.pickupAddress,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString()
  };
}
var STAGE_ORDER = ["new", "accepted", "diagnostics", "approval", "repair", "testing", "ready", "returned"];
var RepairsService = class {
  constructor(db) {
    this.db = db;
  }
  db;
  async create(userId, input) {
    const [dup] = await this.db.select().from(repairs).where(and3(eq5(repairs.userId, userId), eq5(repairs.clientRequestId, input.clientRequestId)));
    if (dup) return toRepair(dup);
    const [user] = await this.db.select().from(users).where(eq5(users.id, userId));
    if (!user) throw new OrderError("\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", 401);
    const est = estimateRepair(input.problem);
    return this.db.transaction(async (tx) => {
      const [r] = await tx.insert(repairs).values({
        userId,
        clientRequestId: input.clientRequestId,
        phone: user.phone,
        model: input.model,
        problem: input.problem,
        pickupAddress: input.pickupAddress,
        stage: "new",
        history: [{ stage: "new", at: (/* @__PURE__ */ new Date()).toISOString(), note: null }],
        estimateMin: est.min,
        estimateMax: est.max
      }).returning();
      const repair = toRepair(r);
      await enqueue(tx, "onec.repair", { repairId: r.id });
      await enqueue(tx, "internal.webhook", { event: "repair.created", data: { ...repair, phone: user.phone, customerName: user.name } });
      await notifyUser(tx, userId, {
        kind: "repair",
        title: `\u0417\u0430\u044F\u0432\u043A\u0430 ${repair.number} \u043F\u0440\u0438\u043D\u044F\u0442\u0430`,
        body: "\u041F\u043E\u0437\u0432\u043E\u043D\u0438\u043C, \u0447\u0442\u043E\u0431\u044B \u0434\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C\u0441\u044F, \u043A\u043E\u0433\u0434\u0430 \u0437\u0430\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0448\u0438\u043D\u0443",
        refId: r.id
      });
      return repair;
    });
  }
  async listForUser(userId) {
    const rows = await this.db.select().from(repairs).where(eq5(repairs.userId, userId)).orderBy(desc2(repairs.createdAt)).limit(50);
    return rows.map(toRepair);
  }
  async getForUser(userId, id) {
    const [r] = await this.db.select().from(repairs).where(and3(eq5(repairs.id, id), eq5(repairs.userId, userId)));
    return r ? toRepair(r) : null;
  }
  async listAll(opts) {
    const rows = await this.db.select().from(repairs).where(opts.stage ? eq5(repairs.stage, opts.stage) : void 0).orderBy(desc2(repairs.createdAt)).limit(opts.limit);
    return rows.map(toRepair);
  }
  /** Обновление из внутреннего приложения: этап, смета, мастер, срок. */
  async update(id, patch) {
    return this.db.transaction(async (tx) => {
      const [r] = await tx.select().from(repairs).where(eq5(repairs.id, id)).for("update");
      if (!r) throw new OrderError("\u0417\u0430\u044F\u0432\u043A\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430", 404);
      const history = [...r.history];
      const stageChanged = patch.stage && patch.stage !== r.stage;
      if (stageChanged) {
        const from = r.stage;
        if (from === "returned" || from === "cancelled") throw new OrderError("\u0417\u0430\u044F\u0432\u043A\u0430 \u0437\u0430\u043A\u0440\u044B\u0442\u0430", 409, "closed");
        if (patch.stage !== "cancelled" && STAGE_ORDER.indexOf(patch.stage) < STAGE_ORDER.indexOf(from)) {
          throw new OrderError("\u041D\u0435\u043B\u044C\u0437\u044F \u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u043D\u0430 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u044D\u0442\u0430\u043F", 409, "bad_transition");
        }
        history.push({ stage: patch.stage, at: (/* @__PURE__ */ new Date()).toISOString(), note: patch.note ?? null });
      }
      const [u] = await tx.update(repairs).set({
        ...patch.stage ? { stage: patch.stage } : {},
        history,
        ...patch.services ? { services: patch.services } : {},
        ...patch.total !== void 0 ? { total: patch.total } : {},
        ...patch.readyBy !== void 0 ? { readyBy: patch.readyBy ? new Date(patch.readyBy) : null } : {},
        ...patch.masterName !== void 0 ? { masterName: patch.masterName } : {},
        ...patch.serial !== void 0 ? { serial: patch.serial } : {},
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq5(repairs.id, id)).returning();
      const repair = toRepair(u);
      await enqueue(tx, "internal.webhook", { event: "repair.updated", data: repair });
      if (stageChanged) {
        const st = REPAIR_STAGES.find((s) => s.id === patch.stage);
        await notifyUser(tx, u.userId, {
          kind: "repair",
          title: `${repair.model}: ${st?.title.toLowerCase() ?? (patch.stage === "returned" ? "\u0432\u044B\u0434\u0430\u043D\u0430" : "\u0437\u0430\u044F\u0432\u043A\u0430 \u043E\u0442\u043C\u0435\u043D\u0435\u043D\u0430")}`,
          body: patch.note || st?.text || "",
          refId: id
        });
      }
      return repair;
    });
  }
};

// apps/api/src/services/sms.ts
var ConsoleSms = class {
  constructor(log) {
    this.log = log;
  }
  log;
  async send(phone, text2) {
    this.log.warn({ phone, text: text2 }, "SMS (\u0440\u0435\u0436\u0438\u043C console, \u0440\u0435\u0430\u043B\u044C\u043D\u0430\u044F \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0430 \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0430)");
  }
};
var SmsRu = class {
  constructor(apiId, from, fetchImpl = fetch) {
    this.apiId = apiId;
    this.from = from;
    this.fetchImpl = fetchImpl;
    if (!apiId) throw new Error("SMSRU_API_ID \u043D\u0435 \u0437\u0430\u0434\u0430\u043D");
  }
  apiId;
  from;
  fetchImpl;
  async send(phone, text2) {
    const qs = new URLSearchParams({ api_id: this.apiId, to: phone.replace("+", ""), msg: text2, json: "1" });
    if (this.from) qs.set("from", this.from);
    const res = await this.fetchImpl(`https://sms.ru/sms/send?${qs}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.status !== "OK") {
      throw new Error(`SMS \u043D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E: ${data?.status_text ?? res.status}`);
    }
  }
};
function createSms(cfg, log) {
  return cfg.SMS_PROVIDER === "smsru" ? new SmsRu(cfg.SMSRU_API_ID, cfg.SMS_SENDER) : new ConsoleSms(log);
}

// apps/api/src/services/yookassa.ts
var API = "https://api.yookassa.ru/v3";
var money = (kop) => ({ value: (kop / 100).toFixed(2), currency: "RUB" });
var YooKassa = class {
  constructor(opts) {
    this.opts = opts;
    this.auth = "Basic " + Buffer.from(`${opts.shopId}:${opts.secretKey}`).toString("base64");
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }
  opts;
  auth;
  fetchImpl;
  async call(method, path, body, idempotenceKey) {
    const res = await this.fetchImpl(`${API}${path}`, {
      method,
      headers: {
        Authorization: this.auth,
        "Content-Type": "application/json",
        ...idempotenceKey ? { "Idempotence-Key": idempotenceKey } : {}
      },
      body: body ? JSON.stringify(body) : void 0
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`\u042EKassa ${res.status}: ${data.description ?? "\u043E\u0448\u0438\u0431\u043A\u0430"}`);
    return data;
  }
  /**
   * Создаёт платёж с подтверждением через страницу ЮKassa (карта, СБП, SberPay, T-Pay).
   * Чек 54-ФЗ передаётся, если включён YOOKASSA_SEND_RECEIPT.
   */
  createPayment(p) {
    const receipt = this.opts.sendReceipt ? {
      customer: { phone: p.phone.replace("+", "") },
      items: [
        ...p.lines.map((l) => ({
          description: [l.title, l.variantTitle].filter(Boolean).join(", ").slice(0, 128),
          quantity: String(l.qty),
          amount: money(l.unitPrice),
          vat_code: this.opts.vatCode,
          payment_subject: "commodity",
          payment_mode: "full_payment"
        })),
        ...p.deliveryFee ? [
          {
            description: "\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430",
            quantity: "1",
            amount: money(p.deliveryFee),
            vat_code: this.opts.vatCode,
            payment_subject: "service",
            payment_mode: "full_payment"
          }
        ] : []
      ]
    } : void 0;
    return this.call(
      "POST",
      "/payments",
      {
        amount: money(p.amount),
        capture: true,
        confirmation: { type: "redirect", return_url: p.returnUrl },
        description: `\u0417\u0430\u043A\u0430\u0437 ${p.orderNumber} \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \xAB\u041E\u0445\u043E\u0442\u0430 \u043A\u043E\u0444\u0435\xBB`,
        metadata: { orderId: p.orderId },
        ...receipt ? { receipt } : {}
      },
      `order-${p.orderId}`
    );
  }
  getPayment(id) {
    return this.call("GET", `/payments/${encodeURIComponent(id)}`);
  }
};

// apps/api/src/routes/internal.ts
import { timingSafeEqual as timingSafeEqual2 } from "node:crypto";
import { desc as desc3, isNull, isNotNull, and as and4, like } from "drizzle-orm";
import { z as z2 } from "zod";
var orderStatus = z2.enum(["awaiting_payment", "new", "accepted", "cooking", "on_the_way", "ready_for_pickup", "done", "cancelled"]);
var repairStage = z2.enum(["new", "accepted", "diagnostics", "approval", "repair", "testing", "ready", "returned", "cancelled"]);
function internalRoutes(app, deps) {
  const key = Buffer.from(deps.cfg.INTERNAL_API_KEY);
  app.register(async (r) => {
    r.addHook("onRequest", async (req, reply) => {
      const got = Buffer.from(String(req.headers["x-api-key"] ?? ""));
      if (!key.length || got.length !== key.length || !timingSafeEqual2(got, key)) {
        return reply.code(401).send({ error: "unauthorized" });
      }
    });
    r.get("/orders", async (req) => {
      const q = z2.object({ status: orderStatus.optional(), since: z2.coerce.date().optional(), limit: z2.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
      return { items: await deps.orders.listAll(q) };
    });
    r.get("/orders/:id", async (req, reply) => {
      const o = await deps.orders.getById(z2.string().uuid().parse(req.params.id));
      return o ?? reply.code(404).send({ error: "not_found" });
    });
    r.post("/orders/:id/status", async (req) => {
      const body = z2.object({ status: orderStatus }).parse(req.body);
      return deps.orders.setStatus(z2.string().uuid().parse(req.params.id), body.status);
    });
    r.get("/repairs", async (req) => {
      const q = z2.object({ stage: repairStage.optional(), limit: z2.coerce.number().int().min(1).max(500).default(100) }).parse(req.query);
      return { items: await deps.repairs.listAll({ stage: q.stage, limit: q.limit }) };
    });
    r.patch("/repairs/:id", async (req) => {
      const body = z2.object({
        stage: repairStage.optional(),
        note: z2.string().max(500).nullable().optional(),
        services: z2.array(z2.object({ title: z2.string().min(1), price: z2.number().int().min(0), state: z2.enum(["done", "in_progress", "pending"]) })).optional(),
        total: z2.number().int().min(0).nullable().optional(),
        readyBy: z2.string().datetime({ offset: true }).nullable().optional(),
        masterName: z2.string().max(80).nullable().optional(),
        serial: z2.string().max(80).nullable().optional()
      }).parse(req.body);
      return deps.repairs.update(z2.string().uuid().parse(req.params.id), body);
    });
    r.post("/catalog/sync", async () => {
      await deps.catalog.sync();
      const s = deps.catalog.get();
      return { ok: true, products: s.products.length, updatedAt: s.updatedAt };
    });
    r.get("/health", async () => {
      const onec = await deps.onec.ping().then(() => "ok").catch((e) => e.message);
      const failed = await deps.db.select().from(outbox).where(and4(isNotNull(outbox.doneAt), like(outbox.lastError, "\u0421\u0422\u041E\u041F:%"))).orderBy(desc3(outbox.id)).limit(20);
      const pending = await deps.db.select({ id: outbox.id, topic: outbox.topic, attempts: outbox.attempts, lastError: outbox.lastError }).from(outbox).where(isNull(outbox.doneAt)).limit(100);
      return {
        onec,
        catalog: { lastSyncAt: deps.catalog.lastSyncAt, lastError: deps.catalog.lastError },
        outbox: { pending: pending.length, pendingItems: pending, failed }
      };
    });
  }, { prefix: "/internal/v1" });
}

// apps/api/src/routes/public.ts
import { createReadStream, existsSync as existsSync2, statSync } from "node:fs";
import { extname, resolve as resolve4, sep } from "node:path";

// apps/api/src/routes/pages.ts
var esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
var page = (title, body, head = "") => `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>${head}
<style>body{font:16px/1.55 -apple-system,system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 20px 60px;color:#1d3308}
h1{font-size:24px;color:#7b4fd6}h2{font-size:18px;margin-top:28px}a{color:#7b4fd6}.btn{display:inline-block;background:#8bcb45;color:#1d3308;padding:14px 22px;border-radius:14px;text-decoration:none;font-weight:700}</style>
</head><body>${body}</body></html>`;
function privacyHtml(cfg) {
  const op = esc(cfg.LEGAL_OPERATOR);
  const mail = esc(cfg.LEGAL_EMAIL);
  return page(
    "\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445",
    `<h1>\u041F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445</h1>
<p>\u041F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \xAB\u041E\u0445\u043E\u0442\u0430 \u043A\u043E\u0444\u0435\xBB. \u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445: ${op}. \u041A\u043E\u043D\u0442\u0430\u043A\u0442 \u0434\u043B\u044F \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u0439: ${mail}, \u0442\u0435\u043B\u0435\u0444\u043E\u043D ${esc(cfg.SUPPORT_PHONE)}.</p>
<h2>\u041A\u0430\u043A\u0438\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043C\u044B \u043E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u043C</h2>
<p>\u041D\u043E\u043C\u0435\u0440 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430, \u0438\u043C\u044F \u0438 \u0433\u043E\u0440\u043E\u0434 (\u0435\u0441\u043B\u0438 \u0432\u044B \u0438\u0445 \u0443\u043A\u0430\u0437\u0430\u043B\u0438), \u0430\u0434\u0440\u0435\u0441 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438, \u0441\u043E\u0441\u0442\u0430\u0432 \u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u0437\u0430\u043A\u0430\u0437\u043E\u0432, \u0437\u0430\u044F\u0432\u043A\u0438 \u043D\u0430 \u0440\u0435\u043C\u043E\u043D\u0442 \u043A\u043E\u0444\u0435\u043C\u0430\u0448\u0438\u043D, \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0438\u0434\u0435\u043D\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u043E\u0440 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430 \u0434\u043B\u044F push-\u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439.</p>
<h2>\u0417\u0430\u0447\u0435\u043C</h2>
<p>\u0427\u0442\u043E\u0431\u044B \u0432\u0445\u043E\u0434\u0438\u0442\u044C \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043F\u043E SMS-\u043A\u043E\u0434\u0443, \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0442\u044C \u0438 \u0434\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0442\u044C \u0437\u0430\u043A\u0430\u0437\u044B, \u0432\u0435\u0441\u0442\u0438 \u0440\u0435\u043C\u043E\u043D\u0442 \u0442\u0435\u0445\u043D\u0438\u043A\u0438, \u043D\u0430\u0447\u0438\u0441\u043B\u044F\u0442\u044C \u0431\u043E\u043D\u0443\u0441\u044B \u0438 \u0441\u043E\u043E\u0431\u0449\u0430\u0442\u044C \u043E \u0441\u0442\u0430\u0442\u0443\u0441\u0435 \u0437\u0430\u043A\u0430\u0437\u0430. \u0414\u0430\u043D\u043D\u044B\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u044E\u0442\u0441\u044F \u0432 \u0443\u0447\u0451\u0442\u043D\u0443\u044E \u0441\u0438\u0441\u0442\u0435\u043C\u0443 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438 (1\u0421) \u0438 \u0432\u043E \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044E\u044E \u0441\u0438\u0441\u0442\u0435\u043C\u0443 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0438 \u0437\u0430\u043A\u0430\u0437\u043E\u0432.</p>
<h2>\u041F\u043B\u0430\u0442\u0435\u0436\u0438</h2>
<p>\u041E\u043D\u043B\u0430\u0439\u043D-\u043E\u043F\u043B\u0430\u0442\u0443 \u043F\u0440\u043E\u0432\u043E\u0434\u0438\u0442 \u042EKassa (\u041E\u041E\u041E \u041D\u041A\u041E \xAB\u042E\u041C\u0430\u043D\u0438\xBB). \u0414\u0430\u043D\u043D\u044B\u0435 \u043A\u0430\u0440\u0442\u044B \u0432\u0432\u043E\u0434\u044F\u0442\u0441\u044F \u043D\u0430 \u0441\u0442\u043E\u0440\u043E\u043D\u0435 \u042EKassa, \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0438 \u043D\u0430\u0448\u0438 \u0441\u0435\u0440\u0432\u0435\u0440\u044B \u0438\u0445 \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0430\u044E\u0442 \u0438 \u043D\u0435 \u0445\u0440\u0430\u043D\u044F\u0442.</p>
<h2>\u0421\u0440\u043E\u043A\u0438 \u0445\u0440\u0430\u043D\u0435\u043D\u0438\u044F</h2>
<p>\u0414\u0430\u043D\u043D\u044B\u0435 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430 \u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u0434\u043E \u0435\u0433\u043E \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044F. \u0421\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u043E \u0437\u0430\u043A\u0430\u0437\u0430\u0445 \u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 \u0441\u0440\u043E\u043A\u0430, \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0437\u0430\u043A\u043E\u043D\u043E\u0434\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u043C \u043E \u0431\u0443\u0445\u0433\u0430\u043B\u0442\u0435\u0440\u0441\u043A\u043E\u043C \u0438 \u043D\u0430\u043B\u043E\u0433\u043E\u0432\u043E\u043C \u0443\u0447\u0451\u0442\u0435.</p>
<h2>\u0412\u0430\u0448\u0438 \u043F\u0440\u0430\u0432\u0430</h2>
<p>\u0412\u044B \u043C\u043E\u0436\u0435\u0442\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0434\u0430\u043D\u043D\u044B\u0435 \u0432 \u043F\u0440\u043E\u0444\u0438\u043B\u0435, \u043E\u0442\u043E\u0437\u0432\u0430\u0442\u044C \u0441\u043E\u0433\u043B\u0430\u0441\u0438\u0435 \u0438 \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u043F\u0440\u044F\u043C\u043E \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438: \u041F\u0440\u043E\u0444\u0438\u043B\u044C, \u0437\u0430\u0442\u0435\u043C \xAB\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442\xBB. \u0422\u0430\u043A\u0436\u0435 \u043C\u043E\u0436\u043D\u043E \u043D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u043D\u0430 ${mail}.</p>
<p>\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u0432\u0435\u0434\u0451\u0442\u0441\u044F \u0432 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0438 \u0441 \u0424\u0435\u0434\u0435\u0440\u0430\u043B\u044C\u043D\u044B\u043C \u0437\u0430\u043A\u043E\u043D\u043E\u043C \u2116 152-\u0424\u0417 \xAB\u041E \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445\xBB. \u0414\u0430\u043D\u043D\u044B\u0435 \u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u043D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430\u0445 \u0432 \u0420\u043E\u0441\u0441\u0438\u0439\u0441\u043A\u043E\u0439 \u0424\u0435\u0434\u0435\u0440\u0430\u0446\u0438\u0438.</p>`
  );
}
function termsHtml(cfg) {
  return page(
    "\u0423\u0441\u043B\u043E\u0432\u0438\u044F \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F",
    `<h1>\u0423\u0441\u043B\u043E\u0432\u0438\u044F \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F</h1>
<p>\u041F\u0440\u043E\u0434\u0430\u0432\u0435\u0446: ${esc(cfg.LEGAL_OPERATOR)}. \u0417\u0430\u043A\u0430\u0437\u044B \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u044E\u0442\u0441\u044F \u0447\u0435\u0440\u0435\u0437 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \xAB\u041E\u0445\u043E\u0442\u0430 \u043A\u043E\u0444\u0435\xBB, \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0430 \u043F\u043E \u041F\u0435\u0442\u0440\u043E\u043F\u0430\u0432\u043B\u043E\u0432\u0441\u043A\u0443-\u041A\u0430\u043C\u0447\u0430\u0442\u0441\u043A\u043E\u043C\u0443 \u0438 \u0415\u043B\u0438\u0437\u043E\u0432\u043E.</p>
<p>\u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430 \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u0430 \u043E\u0442 ${cfg.FREE_DELIVERY_FROM_RUB} \u20BD, \u0438\u043D\u0430\u0447\u0435 ${cfg.DELIVERY_FEE_RUB} \u20BD. \u0420\u0435\u0436\u0438\u043C \u0440\u0430\u0431\u043E\u0442\u044B: ${esc(cfg.WORKING_HOURS)}.</p>
<p>\u0421\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u0440\u0435\u043C\u043E\u043D\u0442\u0430 \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u043F\u0440\u0435\u0434\u0432\u0430\u0440\u0438\u0442\u0435\u043B\u044C\u043D\u0430\u044F. \u0418\u0442\u043E\u0433\u043E\u0432\u0443\u044E \u0441\u043C\u0435\u0442\u0443 \u043C\u0430\u0441\u0442\u0435\u0440 \u0441\u043E\u0433\u043B\u0430\u0441\u0443\u0435\u0442 \u0441 \u0432\u0430\u043C\u0438 \u043F\u043E\u0441\u043B\u0435 \u0434\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0438.</p>
<p>\u0412\u043E\u043F\u0440\u043E\u0441\u044B: ${esc(cfg.SUPPORT_PHONE)}, ${esc(cfg.LEGAL_EMAIL)}.</p>`
  );
}
function returnHtml(orderId) {
  const deep = `kambarshop://order/${orderId}`;
  return page(
    "\u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u043C\u0441\u044F \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435",
    `<h1>\u0421\u043F\u0430\u0441\u0438\u0431\u043E!</h1><p>\u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u043C \u0432\u0430\u0441 \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \xAB\u041E\u0445\u043E\u0442\u0430 \u043A\u043E\u0444\u0435\xBB.</p><p><a class="btn" href="${deep}">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435</a></p>`,
    `<script>setTimeout(function(){location.href=${JSON.stringify(deep)}},300)</script>`
  );
}

// apps/api/src/routes/public.ts
var MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif"
};
function publicRoutes(app, deps) {
  const { cfg, catalog } = deps;
  const mediaDir = resolve4(process.cwd(), "media");
  app.get("/health", async () => ({
    ok: true,
    catalog: { loaded: !!catalog.lastSyncAt, lastSyncAt: catalog.lastSyncAt, lastError: catalog.lastError, source: deps.onec.name }
  }));
  app.get("/v1/settings", async () => ({
    freeDeliveryFrom: rub(cfg.FREE_DELIVERY_FROM_RUB),
    deliveryFee: rub(cfg.DELIVERY_FEE_RUB),
    deliveryEta: cfg.DELIVERY_ETA,
    pickupPoints: cfg.pickupPoints,
    onlinePaymentEnabled: cfg.onlinePaymentEnabled,
    supportPhone: cfg.SUPPORT_PHONE,
    workingHours: cfg.WORKING_HOURS,
    privacyUrl: `${cfg.PUBLIC_URL}/legal/privacy`,
    termsUrl: `${cfg.PUBLIC_URL}/legal/terms`
  }));
  app.get("/v1/catalog", async (_req, reply) => {
    const s = catalog.get();
    reply.header("Cache-Control", "public, max-age=60");
    return {
      categories: s.categories.filter((c) => c.kind === "shop"),
      products: s.products.filter((p) => p.kind === "shop"),
      updatedAt: s.updatedAt
    };
  });
  app.get("/v1/menu", async (_req, reply) => {
    const s = catalog.get();
    reply.header("Cache-Control", "public, max-age=60");
    return {
      categories: s.categories.filter((c) => c.kind === "menu"),
      drinks: s.products.filter((p) => p.kind === "menu"),
      addons: s.addons,
      syrupBrands: s.syrupBrands
    };
  });
  app.get("/media/*", async (req, reply) => {
    const file = resolve4(mediaDir, req.params["*"]);
    if (!file.startsWith(mediaDir + sep) || !existsSync2(file) || !statSync(file).isFile()) {
      return reply.code(404).send({ error: "not_found" });
    }
    reply.header("Content-Type", MIME[extname(file).toLowerCase()] ?? "application/octet-stream");
    reply.header("Cache-Control", "public, max-age=604800, immutable");
    return reply.send(createReadStream(file));
  });
  app.get("/legal/privacy", async (_req, reply) => reply.type("text/html; charset=utf-8").send(privacyHtml(cfg)));
  app.get("/legal/terms", async (_req, reply) => reply.type("text/html; charset=utf-8").send(termsHtml(cfg)));
  app.get("/pay/return", async (req, reply) => {
    const id = (req.query.order ?? "").replace(/[^0-9a-f-]/gi, "");
    return reply.type("text/html; charset=utf-8").send(returnHtml(id));
  });
}

// apps/api/src/routes/user.ts
import { and as and5, desc as desc4, eq as eq6, isNull as isNull2 } from "drizzle-orm";
import { z as z3 } from "zod";

// apps/api/src/routes/context.ts
function requireUser(deps) {
  return async (req, reply) => {
    const h = req.headers.authorization;
    const token = h?.startsWith("Bearer ") ? h.slice(7) : null;
    const user = token ? await deps.auth.verifyToken(token) : null;
    if (!user) return reply.code(401).send({ error: "unauthorized", message: "\u0412\u043E\u0439\u0434\u0438\u0442\u0435 \u043F\u043E \u043D\u043E\u043C\u0435\u0440\u0443 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430" });
    req.user = user;
  };
}

// apps/api/src/routes/user.ts
function userRoutes(app, deps) {
  const { db, auth, onec } = deps;
  const authed = { preHandler: requireUser(deps) };
  const bonusCache = /* @__PURE__ */ new Map();
  async function bonusFor(phone) {
    const c = bonusCache.get(phone);
    if (c && Date.now() - c.at < 5 * 6e4) return c.value;
    const v = await Promise.race([
      onec.getBonusBalance(phone).catch(() => null),
      new Promise((r) => setTimeout(() => r(null), 3e3))
    ]);
    const value = v ?? c?.value ?? 0;
    bonusCache.set(phone, { value, at: Date.now() });
    return value;
  }
  app.post("/v1/auth/request-code", { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } }, async (req) => {
    const body = requestCodeSchema.parse(req.body);
    return auth.requestCode(body.phone);
  });
  app.post("/v1/auth/verify", { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } }, async (req) => {
    const body = verifyCodeSchema.parse(req.body);
    return auth.verifyCode(body.phone, body.code);
  });
  app.get("/v1/me", authed, async (req) => {
    const [u] = await db.select().from(users).where(eq6(users.id, req.user.userId));
    return { id: u.id, phone: u.phone, name: u.name, city: u.city, bonus: await bonusFor(u.phone) };
  });
  app.patch("/v1/me", authed, async (req) => {
    const body = updateMeSchema.parse(req.body);
    const [u] = await db.update(users).set({ ...body.name !== void 0 ? { name: body.name } : {}, ...body.city !== void 0 ? { city: body.city || null } : {} }).where(eq6(users.id, req.user.userId)).returning();
    return { id: u.id, phone: u.phone, name: u.name, city: u.city, bonus: await bonusFor(u.phone) };
  });
  app.delete("/v1/me", authed, async (req, reply) => {
    const userId = req.user.userId;
    await db.transaction(async (tx) => {
      await tx.update(orders).set({ customerName: null }).where(eq6(orders.userId, userId));
      await tx.delete(users).where(eq6(users.id, userId));
      await enqueue(tx, "internal.webhook", { event: "user.deleted", data: { userId, phone: req.user.phone } });
    });
    return reply.code(204).send();
  });
  app.post("/v1/me/devices", authed, async (req, reply) => {
    const body = deviceSchema.parse(req.body);
    await db.insert(devices).values({ userId: req.user.userId, token: body.token, platform: body.platform }).onConflictDoUpdate({ target: [devices.userId, devices.token], set: { platform: body.platform, updatedAt: /* @__PURE__ */ new Date() } });
    return reply.code(204).send();
  });
  app.delete("/v1/me/devices", authed, async (req, reply) => {
    const body = z3.object({ token: z3.string() }).parse(req.body);
    await db.delete(devices).where(and5(eq6(devices.userId, req.user.userId), eq6(devices.token, body.token)));
    return reply.code(204).send();
  });
  app.get("/v1/notifications", authed, async (req) => {
    const rows = await db.select().from(notifications).where(eq6(notifications.userId, req.user.userId)).orderBy(desc4(notifications.createdAt)).limit(100);
    return {
      items: rows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        kind: n.kind,
        refId: n.refId,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString()
      })),
      unread: rows.filter((n) => !n.readAt).length
    };
  });
  app.post("/v1/notifications/read", authed, async (req, reply) => {
    await db.update(notifications).set({ readAt: /* @__PURE__ */ new Date() }).where(and5(eq6(notifications.userId, req.user.userId), isNull2(notifications.readAt)));
    return reply.code(204).send();
  });
  app.post("/v1/orders", authed, async (req, reply) => {
    const body = createOrderSchema.parse(req.body);
    const res = await deps.orders.create(req.user.userId, body);
    return reply.code(201).send(res);
  });
  app.get("/v1/orders", authed, async (req) => ({ items: await deps.orders.listForUser(req.user.userId) }));
  app.get("/v1/orders/:id", authed, async (req, reply) => {
    const o = await deps.orders.getForUser(req.user.userId, z3.string().uuid().parse(req.params.id));
    return o ?? reply.code(404).send({ error: "not_found", message: "\u0417\u0430\u043A\u0430\u0437 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D" });
  });
  app.post("/v1/orders/:id/pay", authed, async (req) => ({
    paymentUrl: await deps.orders.retryPayment(req.user.userId, z3.string().uuid().parse(req.params.id))
  }));
  app.post(
    "/v1/orders/:id/cancel",
    authed,
    async (req) => deps.orders.cancelByUser(req.user.userId, z3.string().uuid().parse(req.params.id))
  );
  app.post("/v1/repairs", authed, async (req, reply) => {
    const body = createRepairSchema.parse(req.body);
    return reply.code(201).send(await deps.repairs.create(req.user.userId, body));
  });
  app.get("/v1/repairs", authed, async (req) => ({ items: await deps.repairs.listForUser(req.user.userId) }));
  app.get("/v1/repairs/:id", authed, async (req, reply) => {
    const r = await deps.repairs.getForUser(req.user.userId, z3.string().uuid().parse(req.params.id));
    return r ?? reply.code(404).send({ error: "not_found", message: "\u0417\u0430\u044F\u0432\u043A\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430" });
  });
  app.post("/webhooks/yookassa", async (req, reply) => {
    const body = z3.object({ event: z3.string(), object: z3.object({ id: z3.string() }).passthrough() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send();
    if (body.data.event.startsWith("payment.")) {
      await deps.orders.syncPayment(body.data.object.id);
    }
    return reply.code(200).send({ ok: true });
  });
}

// apps/api/src/app.ts
async function buildApp(opts) {
  const { cfg } = opts;
  const app = Fastify({
    logger: opts.logger ?? (cfg.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : true),
    trustProxy: true,
    bodyLimit: 256 * 1024
  });
  const handle = await openDb(cfg.DATABASE_URL);
  const db = handle.db;
  const onec = opts.onec ?? createOneCAdapter(cfg);
  const mediaBase = cfg.MEDIA_BASE_URL || `${cfg.PUBLIC_URL}/media`;
  const catalog = new CatalogService(db, onec, loadCatalogConfig(cfg.CATALOG_CONFIG), mediaBase, app.log);
  const yookassa = cfg.onlinePaymentEnabled ? new YooKassa({
    shopId: cfg.YOOKASSA_SHOP_ID,
    secretKey: cfg.YOOKASSA_SECRET_KEY,
    sendReceipt: cfg.YOOKASSA_SEND_RECEIPT,
    vatCode: cfg.YOOKASSA_VAT_CODE,
    fetchImpl: opts.fetchImpl
  }) : null;
  const deps = {
    cfg,
    db,
    onec,
    catalog,
    auth: new AuthService(db, cfg, opts.sms ?? createSms(cfg, app.log)),
    orders: new OrdersService(db, cfg, catalog, yookassa),
    repairs: new RepairsService(db),
    outbox: new OutboxWorker(db, cfg, onec, opts.push ?? createPush(cfg), catalog, app.log, opts.fetchImpl)
  };
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } });
  await app.register(cors, {
    origin: cfg.CORS_ORIGINS.split(",").map((s) => s.trim()),
    methods: ["GET", "POST", "PATCH", "DELETE"]
  });
  await app.register(rateLimit, { global: true, max: 300, timeWindow: "1 minute" });
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return reply.code(400).send({ error: "validation", message: first?.message ?? "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0434\u0430\u043D\u043D\u044B\u0435", issues: err.issues });
    }
    const e = err;
    const status = e.statusCode ?? 500;
    if (status >= 500) req.log.error({ err }, "\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u0430");
    return reply.code(status).send({
      error: status >= 500 ? "internal" : e.code ?? "error",
      message: status >= 500 ? "\u0427\u0442\u043E-\u0442\u043E \u043F\u043E\u0448\u043B\u043E \u043D\u0435 \u0442\u0430\u043A. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437." : e.message
    });
  });
  publicRoutes(app, deps);
  userRoutes(app, deps);
  internalRoutes(app, deps);
  await catalog.init();
  if (opts.background !== false) {
    catalog.start(cfg.ONEC_SYNC_INTERVAL_MIN);
    deps.outbox.start();
  }
  app.addHook("onClose", async () => {
    catalog.stop();
    deps.outbox.stop();
    await handle.close();
  });
  return { app, deps };
}

// apps/api/src/config.ts
import "dotenv/config";
import { z as z4 } from "zod";
var bool = z4.enum(["true", "false", "1", "0", ""]).optional().transform((v) => v === "true" || v === "1");
var EnvSchema = z4.object({
  NODE_ENV: z4.enum(["development", "test", "production"]).default("development"),
  PORT: z4.coerce.number().int().default(8080),
  HOST: z4.string().default("0.0.0.0"),
  /** Публичный адрес сервера, нужен для возврата из ЮKassa и ссылок на фото. */
  PUBLIC_URL: z4.string().url().default("http://localhost:8080"),
  /** postgres://… для боевой базы. pglite:memory или pglite:./data для локальной разработки. */
  DATABASE_URL: z4.string().default("pglite:./.data/pglite"),
  JWT_SECRET: z4.string().min(32).default("dev-secret-change-me-dev-secret-change-me"),
  CORS_ORIGINS: z4.string().default("capacitor://localhost,http://localhost,https://localhost,http://localhost:5173,http://localhost:4173"),
  /* ---------- 1С ---------- */
  /** mock: демо-данные; odata: стандартный интерфейс OData; http: HTTP-сервис 1С по нашему контракту. */
  ONEC_MODE: z4.enum(["mock", "odata", "http"]).default("mock"),
  ONEC_BASE_URL: z4.string().default(""),
  ONEC_USER: z4.string().default(""),
  ONEC_PASSWORD: z4.string().default(""),
  ONEC_TIMEOUT_MS: z4.coerce.number().int().default(2e4),
  ONEC_SYNC_INTERVAL_MIN: z4.coerce.number().int().min(1).default(10),
  /** Записывать заказы и заявки на ремонт в 1С. */
  ONEC_WRITE_ORDERS: bool.default(true),
  /** Файл соответствия объектов 1С для режима OData. */
  ONEC_ODATA_MAPPING: z4.string().default("config/onec-odata.json"),
  /** Файл соответствия групп 1С разделам приложения и оформления карточек. */
  CATALOG_CONFIG: z4.string().default("config/catalog.json"),
  /** Откуда брать фото товаров: по умолчанию папка media этого сервера. */
  MEDIA_BASE_URL: z4.string().default(""),
  /* ---------- ЮKassa ---------- */
  YOOKASSA_SHOP_ID: z4.string().default(""),
  YOOKASSA_SECRET_KEY: z4.string().default(""),
  /** Передавать чек по 54-ФЗ через ЮKassa (если подключены облачные чеки). */
  YOOKASSA_SEND_RECEIPT: bool.default(false),
  /** Код ставки НДС для чека ЮKassa: 1 без НДС, 2 0%, 4 20% и т.д. */
  YOOKASSA_VAT_CODE: z4.coerce.number().int().default(1),
  /* ---------- SMS ---------- */
  SMS_PROVIDER: z4.enum(["console", "smsru"]).default("console"),
  SMSRU_API_ID: z4.string().default(""),
  SMS_SENDER: z4.string().default(""),
  /** Номера для проверки App Store / Google Play: код всегда 0000. Через запятую. */
  REVIEW_PHONES: z4.string().default(""),
  /* ---------- Внутреннее приложение компании ---------- */
  INTERNAL_API_KEY: z4.string().default(""),
  INTERNAL_WEBHOOK_URL: z4.string().default(""),
  INTERNAL_WEBHOOK_SECRET: z4.string().default(""),
  /* ---------- Push (Firebase Cloud Messaging, работает и для iOS) ---------- */
  FCM_PROJECT_ID: z4.string().default(""),
  FCM_CLIENT_EMAIL: z4.string().default(""),
  FCM_PRIVATE_KEY: z4.string().default(""),
  /* ---------- Магазин ---------- */
  FREE_DELIVERY_FROM_RUB: z4.coerce.number().default(2500),
  DELIVERY_FEE_RUB: z4.coerce.number().default(250),
  DELIVERY_ETA: z4.string().default("15 \u043C\u0438\u043D\u0443\u0442"),
  PICKUP_POINTS: z4.string().default(
    '[{"id":"shop","title":"\u041A\u043E\u0444\u0435\u0439\u043D\u0430\u044F \u043B\u0430\u0432\u043A\u0430","address":"\u041F\u0435\u0442\u0440\u043E\u043F\u0430\u0432\u043B\u043E\u0432\u0441\u043A-\u041A\u0430\u043C\u0447\u0430\u0442\u0441\u043A\u0438\u0439"},{"id":"elizovo","title":"\u041C\u0430\u0433\u0430\u0437\u0438\u043D","address":"\u0415\u043B\u0438\u0437\u043E\u0432\u043E"}]'
  ),
  SUPPORT_PHONE: z4.string().default("+7 900 689-18-24"),
  WORKING_HOURS: z4.string().default("\u041F\u043D\u2013\u041F\u0442 10:00\u201318:00, \u0421\u0431 11:00\u201314:00, \u0412\u0441 \u0432\u044B\u0445\u043E\u0434\u043D\u043E\u0439"),
  LEGAL_OPERATOR: z4.string().default("[\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u0430, \u0418\u041D\u041D, \u041E\u0413\u0420\u041D\u0418\u041F/\u041E\u0413\u0420\u041D]"),
  LEGAL_EMAIL: z4.string().default("[email \u0434\u043B\u044F \u043E\u0431\u0440\u0430\u0449\u0435\u043D\u0438\u0439]")
});
function loadConfig(env = process.env) {
  const parsed = EnvSchema.parse(env);
  if (parsed.NODE_ENV === "production") {
    const problems = [];
    if (parsed.JWT_SECRET.startsWith("dev-secret")) problems.push("JWT_SECRET");
    if (!parsed.INTERNAL_API_KEY) problems.push("INTERNAL_API_KEY");
    if (parsed.SMS_PROVIDER === "console") problems.push("SMS_PROVIDER (\u0432 \u0431\u043E\u044E \u043D\u0443\u0436\u0435\u043D smsru)");
    if (parsed.DATABASE_URL.startsWith("pglite:")) problems.push("DATABASE_URL (\u0432 \u0431\u043E\u044E \u043D\u0443\u0436\u0435\u043D PostgreSQL)");
    if (problems.length) throw new Error(`\u041D\u0435 \u0437\u0430\u0434\u0430\u043D\u044B \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0434\u043B\u044F production: ${problems.join(", ")}`);
  }
  return {
    ...parsed,
    pickupPoints: JSON.parse(parsed.PICKUP_POINTS),
    reviewPhones: parsed.REVIEW_PHONES.split(",").map((s) => s.trim()).filter(Boolean),
    onlinePaymentEnabled: !!(parsed.YOOKASSA_SHOP_ID && parsed.YOOKASSA_SECRET_KEY)
  };
}

// apps/api/src/vercel.ts
var appPromise = null;
function getApp() {
  appPromise ??= (async () => {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
    const cfg = loadConfig({
      NODE_ENV: "test",
      ONEC_MODE: "mock",
      DATABASE_URL: process.env.DATABASE_URL || "pglite:memory",
      PUBLIC_URL: host ? `https://${host}/api` : "http://localhost:3000/api",
      MEDIA_BASE_URL: "/media",
      CATALOG_CONFIG: "apps/api/config/catalog.json",
      SMS_PROVIDER: "console",
      JWT_SECRET: process.env.JWT_SECRET ?? "demo-secret-change-me-demo-secret-change-me"
    });
    return buildApp({ cfg, logger: { level: "warn" }, background: false });
  })();
  appPromise.catch(() => appPromise = null);
  return appPromise;
}
async function readBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return void 0;
  if (req.body !== void 0 && req.body !== null) {
    return typeof req.body === "string" ? req.body : Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? Buffer.concat(chunks).toString() : void 0;
}
async function handler(req, res) {
  try {
    const { app } = await getApp();
    const u = new URL(req.url ?? "/", "http://x");
    const p = u.searchParams.get("path");
    let path;
    if (p !== null) {
      u.searchParams.delete("path");
      path = "/" + p;
    } else path = u.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
    const qs = u.searchParams.toString();
    const headers = { ...req.headers };
    delete headers["content-length"];
    const r = await app.inject({
      method: req.method,
      url: path + (qs ? `?${qs}` : ""),
      headers,
      payload: await readBody(req)
    });
    res.statusCode = r.statusCode;
    for (const [k, v] of Object.entries(r.headers)) if (v !== void 0 && k !== "content-length") res.setHeader(k, v);
    res.end(r.rawPayload);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "internal", message: "\u0414\u0435\u043C\u043E-\u0441\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u0437\u0430\u043F\u0443\u0441\u0442\u0438\u043B\u0441\u044F. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443." }));
  }
}
export {
  handler as default
};
