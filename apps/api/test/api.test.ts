import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { INTERNAL_KEY, setup } from './helpers';

type Ctx = Awaited<ReturnType<typeof setup>>;
let ctx: Ctx | null = null;
afterEach(async () => {
  await ctx?.app.close();
  ctx = null;
});

const cappuccinoLine = {
  productId: 'it-menu-classic-01',
  variantId: 'ch-menu-classic-01-2',
  qty: 2,
  modifiers: [
    { addonId: 'it-add-milk', qty: 1 },
    { addonId: 'it-add-syrup', qty: 1, flavorId: 'ch-motif-1' },
  ],
};

describe('каталог и настройки', () => {
  it('отдаёт меню, каталог, настройки и фото', async () => {
    ctx = await setup();
    const { app } = ctx;
    const settings = (await app.inject('/v1/settings')).json();
    expect(settings.freeDeliveryFrom).toBe(250000);
    expect(settings.pickupPoints).toHaveLength(2);

    const menu = (await app.inject('/v1/menu')).json();
    expect(menu.categories.map((c: { id: string }) => c.id)).toEqual(['classic', 'author', 'cold', 'tea', 'lemonade']);
    const capp = menu.drinks.find((d: { id: string }) => d.id === 'it-menu-classic-01');
    expect(capp.variants.map((v: { ml: number }) => v.ml)).toEqual([250, 350, 450]);
    const perCat = (id: string) => menu.drinks.filter((d: { categoryId: string }) => d.categoryId === id).length;
    expect(['classic', 'author', 'cold', 'tea', 'lemonade'].map(perCat)).toEqual([13, 6, 10, 7, 5]);
    expect(menu.addons.find((a: { id: string }) => a.id === 'it-add-milk').priceByMl).toEqual({ '250': 6000, '350': 9000, '450': 12000 });
    expect(menu.syrupBrands.length).toBeGreaterThan(0);

    const catalog = (await app.inject('/v1/catalog')).json();
    expect(catalog.products.length).toBeGreaterThanOrEqual(20);
    const withImage = catalog.products.find((p: { image: string | null }) => p.image);
    expect(withImage.image).toMatch(/^https:\/\/api\.example\.ru\/media\//);
    const img = await app.inject(new URL(withImage.image).pathname);
    expect(img.statusCode).toBe(200);
    expect((await app.inject('/media/..%2Fpackage.json')).statusCode).toBe(404);

    expect((await app.inject('/legal/privacy')).body).toContain('152-ФЗ');
  });
});

describe('вход по SMS', () => {
  it('выдаёт токен, ограничивает попытки, пускает номер для проверки сторов с 0000', async () => {
    ctx = await setup();
    const { app, sms } = ctx;
    const noConsent = await app.inject({ method: 'POST', url: '/v1/auth/request-code', payload: { phone: '89001112233' } });
    expect(noConsent.statusCode).toBe(400);

    const r = await app.inject({ method: 'POST', url: '/v1/auth/request-code', payload: { phone: '8 (900) 111-22-33', consent: true } });
    expect(r.statusCode).toBe(200);
    expect(sms.sent[0]!.phone).toBe('+79001112233');
    const again = await app.inject({ method: 'POST', url: '/v1/auth/request-code', payload: { phone: '+79001112233', consent: true } });
    expect(again.statusCode).toBe(429);

    const bad = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { phone: '+79001112233', code: sms.lastCode() === '0000' ? '1111' : '0000' } });
    expect(bad.statusCode).toBe(400);
    const ok = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { phone: '+79001112233', code: sms.lastCode() } });
    expect(ok.json().isNew).toBe(true);
    const me = await app.inject({ url: '/v1/me', headers: { authorization: `Bearer ${ok.json().token}` } });
    expect(me.json()).toMatchObject({ phone: '+79001112233', bonus: 12 });

    await app.inject({ method: 'POST', url: '/v1/auth/request-code', payload: { phone: '+79990000000', consent: true } });
    expect(sms.sent).toHaveLength(1);
    const review = await app.inject({ method: 'POST', url: '/v1/auth/verify', payload: { phone: '+79990000000', code: '0000' } });
    expect(review.statusCode).toBe(200);

    expect((await app.inject('/v1/me')).statusCode).toBe(401);
  });
});

describe('заказ', () => {
  it('считает цену на сервере, пишет в 1С и во внутреннее приложение, не дублирует', async () => {
    ctx = await setup();
    const { app, login, drain, onec, hooks, uuid } = ctx;
    const h = await login();
    const clientRequestId = uuid();
    const payload = {
      lines: [cappuccinoLine, { productId: 'it-lavazza', qty: 1 }],
      delivery: { type: 'delivery', address: 'ул. Ленинская, 1', comment: 'Домофон 12' },
      paymentMethod: 'cash',
      clientRequestId,
    };
    const res = await app.inject({ method: 'POST', url: '/v1/orders', headers: h, payload });
    expect(res.statusCode).toBe(201);
    const { order } = res.json();
    // Капучино 350 мл 200 ₽ + молоко 90 ₽ + сироп 25 ₽ = 315 ₽ × 2, плюс Lavazza 690 ₽.
    expect(order.subtotal).toBe(132000);
    expect(order.deliveryFee).toBe(25000);
    expect(order.total).toBe(157000);
    expect(order.lines[0].modifiers[1].title).toContain('Шоколад');

    const dup = await app.inject({ method: 'POST', url: '/v1/orders', headers: h, payload });
    expect(dup.json().order.id).toBe(order.id);

    await drain();
    expect(onec.orders).toHaveLength(1);
    const sent = onec.orders[0]!;
    expect(sent.number).toBe(order.number);
    expect(sent.total).toBe(1570);
    expect(sent.lines.map((l) => [l.itemRef, l.qty, l.price])).toEqual([
      ['it-menu-classic-01', 2, 200],
      ['it-add-milk', 2, 90],
      ['it-add-syrup', 2, 25],
      ['it-lavazza', 1, 690],
    ]);
    expect(sent.comment).toContain('Доставка 250');

    const hook = hooks.find((x) => x.event === 'order.created')!;
    const expected = createHmac('sha256', 'whsec').update(JSON.stringify(hook.body)).digest('hex');
    expect(hook.signature).toBe(`sha256=${expected}`);

    const free = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      headers: h,
      payload: { ...payload, lines: [{ productId: 'it-lavazza', qty: 4 }], clientRequestId: uuid() },
    });
    expect(free.json().order.deliveryFee).toBe(0);
  });

  it('повторяет запись в 1С, если она была недоступна', async () => {
    ctx = await setup();
    const { app, login, drain, onec, deps, uuid } = ctx;
    const h = await login();
    onec.failNext = 2;
    await app.inject({
      method: 'POST',
      url: '/v1/orders',
      headers: h,
      payload: { lines: [{ productId: 'it-lavazza', qty: 1 }], delivery: { type: 'pickup', pickupPointId: 'shop' }, paymentMethod: 'card_on_delivery', clientRequestId: uuid() },
    });
    await drain();
    expect(onec.orders).toHaveLength(0);
    for (let i = 0; i < 2; i++) {
      await deps.db.execute(sql`update outbox set next_run_at = now() where done_at is null`);
      await drain();
    }
    expect(onec.orders).toHaveLength(1);
    expect(onec.orders[0]!.pickupPoint).toContain('Кофейная лавка');
  });

  it('проверяет данные корзины', async () => {
    ctx = await setup();
    const { app, login, uuid } = ctx;
    const h = await login();
    const base = { delivery: { type: 'pickup', pickupPointId: 'shop' }, paymentMethod: 'cash' };
    const noVariant = await app.inject({ method: 'POST', url: '/v1/orders', headers: h, payload: { ...base, clientRequestId: uuid(), lines: [{ productId: 'it-menu-classic-01', qty: 1 }] } });
    expect(noVariant.statusCode).toBe(422);
    const noFlavor = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      headers: h,
      payload: { ...base, clientRequestId: uuid(), lines: [{ ...cappuccinoLine, modifiers: [{ addonId: 'it-add-syrup', qty: 1 }] }] },
    });
    expect(noFlavor.json().message).toContain('вкус');
    const online = await app.inject({ method: 'POST', url: '/v1/orders', headers: h, payload: { ...base, paymentMethod: 'online', clientRequestId: uuid(), lines: [{ productId: 'it-lavazza', qty: 1 }] } });
    expect(online.statusCode).toBe(422);
    const noAddress = await app.inject({ method: 'POST', url: '/v1/orders', headers: h, payload: { delivery: { type: 'delivery' }, paymentMethod: 'cash', clientRequestId: uuid(), lines: [{ productId: 'it-lavazza', qty: 1 }] } });
    expect(noAddress.json().message).toBe('Укажите адрес доставки');
  });

  it('онлайн-оплата ЮKassa: заказ уходит в 1С только после оплаты', async () => {
    const payments = new Map<string, { id: string; status: string; amount: { value: string }; metadata: Record<string, string> }>();
    const yooFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/payments') && init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        expect(new Headers(init.headers).get('Idempotence-Key')).toBe(`order-${body.metadata.orderId}`);
        const p = { id: `pay-${payments.size + 1}`, status: 'pending', paid: false, amount: body.amount, metadata: body.metadata, confirmation: { type: 'redirect', confirmation_url: 'https://yoomoney.ru/checkout/x' } };
        payments.set(p.id, p);
        return Response.json(p);
      }
      const id = url.split('/').pop()!;
      return Response.json(payments.get(id));
    };
    ctx = await setup({ YOOKASSA_SHOP_ID: '1', YOOKASSA_SECRET_KEY: 'test_x' }, yooFetch);
    const { app, login, drain, onec, uuid } = ctx;
    const h = await login();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      headers: h,
      payload: { lines: [{ productId: 'it-lavazza', qty: 1 }], delivery: { type: 'pickup', pickupPointId: 'shop' }, paymentMethod: 'online', clientRequestId: uuid() },
    });
    const { order, paymentUrl } = res.json();
    expect(order.status).toBe('awaiting_payment');
    expect(paymentUrl).toContain('yoomoney');
    await drain();
    expect(onec.orders).toHaveLength(0);

    payments.get('pay-1')!.status = 'succeeded';
    const wh = await app.inject({ method: 'POST', url: '/webhooks/yookassa', payload: { event: 'payment.succeeded', object: { id: 'pay-1' } } });
    expect(wh.statusCode).toBe(200);
    await drain();
    expect(onec.orders).toHaveLength(1);
    expect(onec.orders[0]!.paid).toBe(true);
    const after = (await app.inject({ url: `/v1/orders/${order.id}`, headers: h })).json();
    expect(after).toMatchObject({ status: 'new', paymentStatus: 'succeeded' });
  });
});

describe('внутреннее приложение', () => {
  it('меняет статусы заказа и ремонта, клиент получает уведомления и push', async () => {
    ctx = await setup();
    const { app, login, drain, push, onec, uuid } = ctx;
    const h = await login();
    await app.inject({ method: 'POST', url: '/v1/me/devices', headers: h, payload: { token: 'device-token-123', platform: 'ios' } });
    await app.inject({ method: 'POST', url: '/v1/me/devices', headers: h, payload: { token: 'dead-token-123', platform: 'android' } });
    const { order } = (
      await app.inject({
        method: 'POST',
        url: '/v1/orders',
        headers: h,
        payload: { lines: [{ productId: 'it-lavazza', qty: 1 }], delivery: { type: 'pickup', pickupPointId: 'shop' }, paymentMethod: 'cash', clientRequestId: uuid() },
      })
    ).json();

    const ik = { 'x-api-key': INTERNAL_KEY };
    expect((await app.inject({ url: '/internal/v1/orders' })).statusCode).toBe(401);
    const list = (await app.inject({ url: '/internal/v1/orders?status=new', headers: ik })).json();
    expect(list.items).toHaveLength(1);

    const st = await app.inject({ method: 'POST', url: `/internal/v1/orders/${order.id}/status`, headers: ik, payload: { status: 'ready_for_pickup' } });
    expect(st.json().status).toBe('ready_for_pickup');
    const back = await app.inject({ method: 'POST', url: `/internal/v1/orders/${order.id}/status`, headers: ik, payload: { status: 'new' } });
    expect(back.statusCode).toBe(409);

    const cancel = await app.inject({ method: 'POST', url: `/v1/orders/${order.id}/cancel`, headers: h });
    expect(cancel.statusCode).toBe(409);

    const repair = (
      await app.inject({ method: 'POST', url: '/v1/repairs', headers: h, payload: { model: 'DeLonghi Magnifica S', problem: 'Не греет воду', pickupAddress: 'ул. Ленинская, 1', clientRequestId: uuid() } })
    ).json();
    expect(repair.estimateMin).toBe(350000);
    const upd = await app.inject({
      method: 'PATCH',
      url: `/internal/v1/repairs/${repair.id}`,
      headers: ik,
      payload: { stage: 'diagnostics', masterName: 'Алексей', services: [{ title: 'Замена ТЭНа', price: 450000, state: 'pending' }] },
    });
    expect(upd.json()).toMatchObject({ stage: 'diagnostics', master: { name: 'Алексей' } });

    await drain();
    expect(onec.repairs).toHaveLength(1);
    const notes = (await app.inject({ url: '/v1/notifications', headers: h })).json();
    expect(notes.items.map((n: { title: string }) => n.title)).toEqual(
      expect.arrayContaining([expect.stringContaining('готов к выдаче'), expect.stringContaining('диагностика')]),
    );
    expect(push.sent.filter((p) => p.token === 'device-token-123').length).toBe(notes.items.length);
    // Недействительный токен удалён после первой отправки.
    expect(push.sent.filter((p) => p.token === 'dead-token-123').length).toBe(1);

    const health = (await app.inject({ url: '/internal/v1/health', headers: ik })).json();
    expect(health).toMatchObject({ onec: 'ok', outbox: { pending: 0 } });
  });
});

describe('аккаунт', () => {
  it('удаляется по запросу пользователя', async () => {
    ctx = await setup();
    const { app, login } = ctx;
    const h = await login();
    await app.inject({ method: 'PATCH', url: '/v1/me', headers: h, payload: { name: 'Константин', city: 'Елизово' } });
    expect((await app.inject({ url: '/v1/me', headers: h })).json().name).toBe('Константин');
    expect((await app.inject({ method: 'DELETE', url: '/v1/me', headers: h })).statusCode).toBe(204);
    expect((await app.inject({ url: '/v1/me', headers: h })).statusCode).toBe(401);
  });
});
