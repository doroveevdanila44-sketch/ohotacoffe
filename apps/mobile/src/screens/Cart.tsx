import { useEffect, useMemo, useState } from 'react';
import type { Order } from '@kbs/shared';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Icon } from '../components/Icons';
import { Confirm, Spinner, Stepper } from '../components/common';
import { api } from '../lib/api';
import { goods, money, uuid } from '../lib/format';
import { openUrl } from '../lib/native';
import { lineView } from '../lib/pricing';
import { invalidateUser, queryClient, useIndex, useSettings } from '../lib/queries';
import { cartCount, useCart } from '../store/cart';
import { useSession } from '../store/session';
import { toast, useUi } from '../store/ui';

type View = { kind: 'cart' } | { kind: 'paying'; order: Order; url: string | null } | { kind: 'done'; order: Order };

const PAY = [
  { id: 'card_on_delivery', title: 'Картой при получении', sub: 'Курьеру или в точке самовывоза' },
  { id: 'cash', title: 'Наличными при получении', sub: null },
  { id: 'online', title: 'Онлайн в приложении', sub: 'Банковская карта, СБП, SberPay, T-Pay' },
] as const;

export function Cart({ active }: { active: boolean }) {
  const settings = useSettings().data;
  const idx = useIndex();
  const { lines, setQty, checkout, setCheckout, clear } = useCart();
  const token = useSession((s) => s.token);
  const { setTab, open, afterLogin, setAfterLogin, focusOrderId, setFocusOrder } = useUi();
  const [view, setView] = useState<View>({ kind: 'cart' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [addrErr, setAddrErr] = useState(false);
  const [askCancel, setAskCancel] = useState(false);

  const views = lines.map((l) => ({ l, v: lineView(l, idx.products, idx.addons, idx.flavors, idx.cats) }));
  const sum = views.reduce((s, x) => s + x.v.unit * x.l.qty, 0);
  const freeFrom = settings?.freeDeliveryFrom ?? 250000;
  const del = checkout.mode === 'delivery';
  const fee = del && sum < freeFrom ? (settings?.deliveryFee ?? 25000) : 0;
  const points = settings?.pickupPoints ?? [];
  const pickupId = checkout.pickupPointId ?? points[0]?.id ?? null;
  const pays = PAY.filter((p) => p.id !== 'online' || settings?.onlinePaymentEnabled);
  const pay = pays.some((p) => p.id === checkout.pay) ? checkout.pay : 'card_on_delivery';

  const payload = useMemo(
    () => ({
      lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty, modifiers: l.modifiers })),
      delivery: {
        type: checkout.mode,
        address: del ? checkout.address.trim() : null,
        pickupPointId: del ? null : pickupId,
        comment: checkout.comment.trim() || null,
      },
      paymentMethod: pay,
    }),
    [lines, checkout, del, pickupId, pay],
  );
  // Один и тот же заказ при повторном нажатии (пропала связь) не создастся дважды.
  const clientRequestId = useMemo(() => uuid(), [JSON.stringify(payload)]); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (order: Order) => {
    clear();
    invalidateUser();
    setView({ kind: 'done', order });
    document.getElementById('s-cart')?.scrollTo({ top: 0 });
  };

  const submit = async () => {
    setErr(null);
    if (del && checkout.address.trim().length < 5) {
      setAddrErr(true);
      document.getElementById('cAddr')?.focus();
      return;
    }
    if (!useSession.getState().token) {
      setAfterLogin('checkout');
      open({ type: 'login', reason: 'Войдите по номеру телефона, чтобы оформить заказ' });
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ order: Order; paymentUrl: string | null }>('/v1/orders', { method: 'POST', body: { ...payload, clientRequestId } });
      if (r.order.paymentStatus === 'pending') {
        setView({ kind: 'paying', order: r.order, url: r.paymentUrl });
        if (r.paymentUrl) openUrl(r.paymentUrl);
      } else finish(r.order);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Вход выполнен из корзины: продолжаем оформление.
  useEffect(() => {
    if (afterLogin === 'checkout' && token) {
      setAfterLogin(null);
      void submit();
    }
  }, [afterLogin, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Возврат из оплаты: проверяем статус заказа.
  const payingId = view.kind === 'paying' ? view.order.id : null;
  const checkPayment = async () => {
    if (!payingId) return;
    try {
      const o = await api<Order>(`/v1/orders/${payingId}`);
      if (o.paymentStatus === 'succeeded') {
        void Browser.close().catch(() => undefined);
        finish(o);
      } else if (o.paymentStatus === 'canceled') {
        setView({ kind: 'cart' });
        setErr('Оплата не прошла. Заказ отменён, товары остались в корзине.');
        void queryClient.invalidateQueries({ queryKey: ['/v1/orders'] });
      } else setView((v) => (v.kind === 'paying' ? { ...v, order: o } : v));
    } catch {
      /* проверим при следующем возврате */
    }
  };
  useEffect(() => {
    if (!payingId) return;
    const subs = [
      CapApp.addListener('appStateChange', (s) => s.isActive && void checkPayment()),
      Browser.addListener('browserFinished', () => void checkPayment()),
    ];
    const t = setInterval(() => void checkPayment(), 5000);
    return () => {
      clearInterval(t);
      subs.forEach((p) => void p.then((h) => h.remove()));
    };
  }, [payingId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (focusOrderId && focusOrderId === payingId) {
      setFocusOrder(null);
      void checkPayment();
    }
  }, [focusOrderId, payingId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active && view.kind === 'done') setView({ kind: 'cart' });
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const retryPay = async () => {
    if (!payingId) return;
    setBusy(true);
    try {
      const r = await api<{ paymentUrl: string | null }>(`/v1/orders/${payingId}/pay`, { method: 'POST' });
      if (r.paymentUrl) openUrl(r.paymentUrl);
      else await checkPayment();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    setAskCancel(false);
    if (!payingId) return;
    try {
      await api(`/v1/orders/${payingId}/cancel`, { method: 'POST' });
      void queryClient.invalidateQueries({ queryKey: ['/v1/orders'] });
      setView({ kind: 'cart' });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <section className={`screen${active ? ' active' : ''}`} id="s-cart">
      <div className="mach">
        {view.kind === 'done' ? (
          <>
            <div className="ok">
              <div className="okc">
                <Icon name="check" />
              </div>
              <h1>Заказ {view.order.number} оформлен</h1>
              <p>
                {view.order.delivery.type === 'delivery'
                  ? `Привезём примерно через ${settings?.deliveryEta ?? '15 минут'} после подтверждения.`
                  : `Соберём заказ в точке «${points.find((p) => p.id === view.order.delivery.pickupPointId)?.title ?? 'самовывоза'}».`}
              </p>
              <p style={{ marginTop: 10 }}>Следите за статусом в профиле, пришлём уведомление.</p>
            </div>
            <button className="bt" onClick={() => setTab('profile')}>
              Открыть профиль
            </button>
            <button className="bt gh" onClick={() => setTab('home')}>
              На главную
            </button>
          </>
        ) : view.kind === 'paying' ? (
          <>
            <h1>Оплата заказа</h1>
            <p className="ord">Заказ {view.order.number} · {money(view.order.total)}</p>
            <div className="box">
              <div className="oc">
                <div className="live">
                  <i />
                  Ожидаем оплату
                </div>
              </div>
              <div className="msub">Оплатите заказ на странице ЮKassa. После оплаты вернитесь в приложение, статус обновится сам.</div>
              {err ? <div className="err">{err}</div> : null}
            </div>
            <button className="bt" disabled={busy} onClick={retryPay}>
              {busy ? <Spinner /> : 'Перейти к оплате'}
            </button>
            <button className="bt gh" onClick={() => setAskCancel(true)}>
              Отменить заказ
            </button>
            {askCancel ? (
              <Confirm title="Отменить заказ?" text="Товары останутся в корзине." ok="Отменить" danger onOk={cancelOrder} onCancel={() => setAskCancel(false)} />
            ) : null}
          </>
        ) : (
          <>
            <h1>Корзина</h1>
            <p className="ord">{lines.length ? goods(cartCount(lines)) : ''}</p>
            {!lines.length ? (
              <div className="box" style={{ textAlign: 'center', padding: '32px 16px' }}>
                <p style={{ margin: '0 0 14px', color: 'var(--muted)', fontSize: 15.5 }}>В корзине пока пусто</p>
                <button className="bt" style={{ marginTop: 0 }} onClick={() => setTab('home')}>
                  Перейти к товарам
                </button>
              </div>
            ) : (
              <>
                <div className="box">
                  {views.map(({ l, v }) => (
                    <div className="ci" key={l.key}>
                      {v.mug ? (
                        <div className="mug" style={{ ['--c' as string]: v.color ?? '#b9825a' }}>
                          <img src={v.mug} alt="" />
                        </div>
                      ) : v.image ? (
                        <img src={v.image} alt="" />
                      ) : (
                        <div className="sw" style={{ background: v.color ?? '#e7e4ea' }} />
                      )}
                      <div className="n">
                        {v.title}
                        <small>
                          {v.sub}
                          {v.unit ? ` · ${money(v.unit)}` : ''}
                        </small>
                      </div>
                      <Stepper qty={l.qty} alwaysMinus onChange={(d) => setQty(l.key, l.qty + d)} />
                    </div>
                  ))}
                </div>
                <div className="box" style={{ padding: 6 }}>
                  <div className="tg">
                    <button className={del ? 'on' : ''} onClick={() => setCheckout({ mode: 'delivery' })}>
                      Доставка
                    </button>
                    <button className={del ? '' : 'on'} onClick={() => setCheckout({ mode: 'pickup' })}>
                      Самовывоз
                    </button>
                  </div>
                </div>
                {del ? (
                  <div className="box">
                    <h3>Доставка</h3>
                    <div className="msub">{sum >= freeFrom ? 'Доставка бесплатная' : `Добавьте ещё ${money(freeFrom - sum)} до бесплатной доставки`}</div>
                    <div className="fr">
                      <i style={{ width: `${Math.min(100, (sum / freeFrom) * 100)}%` }} />
                    </div>
                    <label className="lb" htmlFor="cAddr">
                      Адрес
                    </label>
                    <input
                      className="fi"
                      id="cAddr"
                      placeholder="Город, улица, дом, квартира"
                      autoComplete="street-address"
                      value={checkout.address}
                      onChange={(e) => (setCheckout({ address: e.target.value }), setAddrErr(false))}
                    />
                    <div className={`er${addrErr ? ' show' : ''}`}>Укажите адрес доставки</div>
                    <label className="lb" htmlFor="cCom">
                      Комментарий курьеру
                    </label>
                    <textarea
                      className="fi"
                      id="cCom"
                      placeholder="Домофон не работает, позвоните за 5 минут"
                      maxLength={500}
                      value={checkout.comment}
                      onChange={(e) => setCheckout({ comment: e.target.value })}
                    />
                  </div>
                ) : (
                  <div className="box">
                    <h3>Где забрать</h3>
                    {points.map((p) => (
                      <button key={p.id} className={`opt${p.id === pickupId ? ' on' : ''}`} onClick={() => setCheckout({ pickupPointId: p.id })}>
                        <i />
                        <span>
                          {p.title}
                          <small>{p.address}</small>
                          {p.hours ? <small>{p.hours}</small> : null}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="box">
                  <h3>Оплата</h3>
                  {pays.map((p) => (
                    <button key={p.id} className={`opt${p.id === pay ? ' on' : ''}`} onClick={() => setCheckout({ pay: p.id })}>
                      <i />
                      <span>
                        {p.title}
                        {p.sub ? <small>{p.sub}</small> : null}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="box">
                  <button className="bt gh" style={{ marginTop: 0 }} onClick={() => toast('Списание бонусов скоро появится')}>
                    Списать бонусы
                  </button>
                  <div style={{ height: 12 }} />
                  <div className="row2">
                    <span>Товары</span>
                    <span>{money(sum)}</span>
                  </div>
                  <div className="row2">
                    <span>Доставка</span>
                    <span>{del ? (fee ? money(fee) : 'Бесплатно') : 'Самовывоз'}</span>
                  </div>
                  <div className="row2 t">
                    <span>Итого</span>
                    <b>{money(sum + fee)}</b>
                  </div>
                </div>
                {err ? <div className="err">{err}</div> : null}
                <button className="bt" disabled={busy || views.some((x) => !x.v.available)} onClick={submit}>
                  {busy ? <Spinner /> : pay === 'online' ? 'Перейти к оплате' : 'Заказать'}
                </button>
                {views.some((x) => !x.v.available) ? <p className="nt">Уберите из корзины товары, которых нет в продаже.</p> : null}
                <p className="nt">
                  Нажимая «{pay === 'online' ? 'Перейти к оплате' : 'Заказать'}», вы соглашаетесь с{' '}
                  <a style={{ color: 'var(--v)' }} onClick={() => settings && openUrl(settings.termsUrl)}>
                    условиями
                  </a>
                  .
                </p>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
