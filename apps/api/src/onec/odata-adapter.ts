import { readFileSync } from 'node:fs';
import { OneCHttp, type OneCHttpOptions } from './http-client';
import type {
  OneCAdapter,
  OneCCatalog,
  OneCCharacteristic,
  OneCGroup,
  OneCItem,
  OneCOrder,
  OneCPrice,
  OneCRepairRequest,
  OneCStock,
} from './types';
import { OneCError } from './types';

/**
 * Настройки стандартного интерфейса OData. Имена объектов и реквизитов отличаются
 * в разных конфигурациях 1С (УТ 11, Розница, УНФ), поэтому всё вынесено в config/onec-odata.json.
 */
export interface ODataMapping {
  items: {
    entity: string;
    fields: {
      ref: string;
      code: string;
      title: string;
      parent: string;
      isFolder: string;
      deleted: string;
      article?: string;
      description?: string;
      unit?: string;
    };
    /** Брать только эти группы и их подгруппы (Ref_Key). Пусто: весь справочник. */
    rootGroupRefs: string[];
    /** Реквизит товара, по которому ищутся характеристики (Ref_Key или ВидНоменклатуры_Key). */
    characteristicsOwnerField: string;
  };
  characteristics: {
    enabled: boolean;
    entity: string;
    fields: { ref: string; title: string; owner: string; deleted: string };
  };
  prices: {
    entity: string;
    sliceLast: boolean;
    priceTypeField: string;
    priceTypeRef: string;
    fields: { item: string; char: string; price: string };
  };
  stock: {
    enabled: boolean;
    entity: string;
    warehouseField: string;
    warehouseRefs: string[];
    fields: { item: string; char: string; qty: string };
  };
  order: {
    enabled: boolean;
    entity: string;
    /** Провести документ после записи. */
    post: boolean;
    template: Record<string, unknown>;
    linesField: string;
    lineTemplate: Record<string, unknown>;
  };
  repair: {
    enabled: boolean;
    entity: string;
    post: boolean;
    template: Record<string, unknown>;
  };
}

const EMPTY_REF = '00000000-0000-0000-0000-000000000000';
const nullRef = (v: unknown): string | null => (typeof v === 'string' && v && v !== EMPTY_REF ? v : null);

export function loadODataMapping(path: string): ODataMapping {
  return JSON.parse(readFileSync(path, 'utf8')) as ODataMapping;
}

/** Подставляет {{поле}} в шаблон. Если строка целиком плейсхолдер, сохраняет тип (число, null). */
export function renderTemplate(tpl: unknown, vars: Record<string, unknown>): unknown {
  if (typeof tpl === 'string') {
    const whole = tpl.match(/^\{\{(\w+)\}\}$/);
    if (whole) return vars[whole[1]!] ?? null;
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''));
  }
  if (Array.isArray(tpl)) return tpl.map((x) => renderTemplate(x, vars));
  if (tpl && typeof tpl === 'object') {
    return Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, renderTemplate(v, vars)]));
  }
  return tpl;
}

const odataGuid = (ref: string) => `guid'${ref}'`;

export class ODataAdapter implements OneCAdapter {
  readonly name = 'odata';
  private readonly http: OneCHttp;

  constructor(
    opts: OneCHttpOptions,
    private readonly map: ODataMapping,
  ) {
    this.http = new OneCHttp(opts);
  }

  private async list(path: string, query: Record<string, string>): Promise<Record<string, unknown>[]> {
    const page = 5000;
    const out: Record<string, unknown>[] = [];
    for (let skip = 0; ; skip += page) {
      const qs = new URLSearchParams({ $format: 'json', ...query, $top: String(page), $skip: String(skip) });
      const res = await this.http.request<{ value?: Record<string, unknown>[] }>('GET', `${encodeURI(path)}?${qs}`);
      const rows = res?.value ?? [];
      out.push(...rows);
      if (rows.length < page) break;
    }
    return out;
  }

  async ping() {
    await this.http.request('GET', `${encodeURI(this.map.items.entity)}?$format=json&$top=1`);
  }

  async fetchCatalog(): Promise<OneCCatalog> {
    const m = this.map;
    const f = m.items.fields;
    const select = [f.ref, f.code, f.title, f.parent, f.isFolder, f.deleted, f.article, f.description, f.unit]
      .concat(m.items.characteristicsOwnerField !== f.ref ? [m.items.characteristicsOwnerField] : [])
      .filter(Boolean)
      .join(',');
    const rows = await this.list(m.items.entity, { $filter: `${f.deleted} eq false`, $select: select });

    const groups: OneCGroup[] = [];
    const rawItems: { item: OneCItem; ownerRef: string | null }[] = [];
    for (const r of rows) {
      const ref = String(r[f.ref]);
      const base = { ref, code: String(r[f.code] ?? '').trim(), title: String(r[f.title] ?? '').trim() };
      if (r[f.isFolder]) {
        groups.push({ ...base, parentRef: nullRef(r[f.parent]) });
      } else {
        rawItems.push({
          item: {
            ...base,
            article: f.article ? (r[f.article] as string) || null : null,
            groupRef: nullRef(r[f.parent]),
            description: f.description ? (r[f.description] as string) || null : null,
            unit: null,
            characteristics: [],
          },
          ownerRef: nullRef(r[m.items.characteristicsOwnerField]),
        });
      }
    }

    // Ограничение по корневым группам (например, только «Магазин» и «Кофейня»).
    let allowed: Set<string> | null = null;
    if (m.items.rootGroupRefs.length) {
      allowed = new Set(m.items.rootGroupRefs);
      let grew = true;
      while (grew) {
        grew = false;
        for (const g of groups) if (g.parentRef && allowed.has(g.parentRef) && !allowed.has(g.ref)) (allowed.add(g.ref), (grew = true));
      }
    }
    const items = rawItems.filter((x) => !allowed || (x.item.groupRef && allowed.has(x.item.groupRef)));

    if (m.characteristics.enabled) {
      const c = m.characteristics.fields;
      const chars = await this.list(m.characteristics.entity, {
        $filter: `${c.deleted} eq false`,
        $select: [c.ref, c.title, c.owner].join(','),
      });
      const byOwner = new Map<string, OneCCharacteristic[]>();
      for (const ch of chars) {
        const owner = nullRef(ch[c.owner]);
        if (!owner) continue;
        const list = byOwner.get(owner) ?? [];
        list.push({ ref: String(ch[c.ref]), title: String(ch[c.title] ?? '').trim() });
        byOwner.set(owner, list);
      }
      for (const x of items) x.item.characteristics = (x.ownerRef && byOwner.get(x.ownerRef)) || [];
    }

    const p = m.prices;
    const priceCond = `${p.priceTypeField} eq ${odataGuid(p.priceTypeRef)}`;
    const priceRows = p.sliceLast
      ? await this.list(`${p.entity}/SliceLast(Condition='${priceCond}')`, {})
      : await this.list(p.entity, { $filter: priceCond });
    const prices: OneCPrice[] = priceRows
      .map((r) => ({ itemRef: String(r[p.fields.item]), charRef: nullRef(r[p.fields.char]), price: Number(r[p.fields.price]) }))
      .filter((x) => Number.isFinite(x.price));

    let stock: OneCStock[] = [];
    if (m.stock.enabled) {
      const s = m.stock;
      const cond = s.warehouseRefs.length
        ? `(Condition='${s.warehouseRefs.map((w) => `${s.warehouseField} eq ${odataGuid(w)}`).join(' or ')}')`
        : '';
      const rowsS = await this.list(`${s.entity}/Balance${cond}`, {});
      const sum = new Map<string, OneCStock>();
      for (const r of rowsS) {
        const itemRef = String(r[s.fields.item]);
        const charRef = nullRef(r[s.fields.char]);
        const key = `${itemRef}|${charRef ?? ''}`;
        const cur = sum.get(key) ?? { itemRef, charRef, qty: 0 };
        cur.qty += Number(r[s.fields.qty]) || 0;
        sum.set(key, cur);
      }
      stock = [...sum.values()];
    }

    return { groups, items: items.map((x) => x.item), prices, stock };
  }

  private async createDocument(entity: string, body: unknown, post: boolean): Promise<string> {
    const created = await this.http.request<Record<string, unknown>>('POST', `${encodeURI(entity)}?$format=json`, body);
    const ref = nullRef(created?.Ref_Key);
    if (!ref) throw new OneCError('1С не вернула Ref_Key созданного документа', undefined, false);
    if (post) {
      await this.http.request('POST', `${encodeURI(entity)}(${odataGuid(ref)})/Post?PostingModeOperational=false`);
    }
    return ref;
  }

  async createOrder(order: OneCOrder) {
    const o = this.map.order;
    if (!o.enabled) throw new OneCError('Запись заказов в 1С выключена в onec-odata.json', undefined, false);
    const lines = order.lines.map((l, i) =>
      renderTemplate(o.lineTemplate, {
        lineNumber: String(i + 1),
        itemRef: l.itemRef,
        charRef: l.charRef ?? EMPTY_REF,
        qty: l.qty,
        price: l.price,
        sum: l.sum,
        title: l.title,
      }),
    );
    const body = renderTemplate(o.template, {
      date: order.date.slice(0, 19),
      number: order.number,
      externalId: order.externalId,
      phone: order.phone,
      customerName: order.customerName ?? '',
      address: order.address ?? '',
      pickupPoint: order.pickupPoint ?? '',
      deliveryType: order.deliveryType === 'delivery' ? 'Доставка' : 'Самовывоз',
      paymentMethod: { card_on_delivery: 'Картой при получении', cash: 'Наличными', online: 'Онлайн (ЮKassa)' }[order.paymentMethod],
      paid: order.paid,
      comment: order.comment,
      total: order.total,
    }) as Record<string, unknown>;
    body[o.linesField] = lines;
    return { ref: await this.createDocument(o.entity, body, o.post) };
  }

  async createRepair(repair: OneCRepairRequest) {
    const r = this.map.repair;
    if (!r.enabled) return null;
    const body = renderTemplate(r.template, {
      date: repair.date.slice(0, 19),
      number: repair.number,
      externalId: repair.externalId,
      phone: repair.phone,
      customerName: repair.customerName ?? '',
      model: repair.model,
      problem: repair.problem ?? '',
      pickupAddress: repair.pickupAddress ?? '',
    });
    return { ref: await this.createDocument(r.entity, body, r.post) };
  }

  async getBonusBalance() {
    // Программы лояльности в типовых конфигурациях устроены по-разному; бонусы отдаёт HTTP-сервис.
    return null;
  }
}
