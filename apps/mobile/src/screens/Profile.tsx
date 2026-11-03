import { useEffect, useState } from 'react';
import { ORDER_STATUS_TITLE, type Order, type User } from '@kbs/shared';
import { Icon } from '../components/Icons';
import { Confirm, Sheet, Spinner } from '../components/common';
import { api } from '../lib/api';
import { dateTime, formatPhone, money } from '../lib/format';
import { openUrl, telHref } from '../lib/native';
import { queryClient, useCatalog, useMe, useOrders, useSettings } from '../lib/queries';
import { unregisterPush } from '../native';
import { useCart } from '../store/cart';
import { useSession } from '../store/session';
import { toast, useUi } from '../store/ui';

const ACTIVE = new Set(['awaiting_payment', 'new', 'accepted', 'cooking', 'on_the_way', 'ready_for_pickup']);
const stepOf = (o: Order) =>
  ['awaiting_payment', 'new', 'accepted'].includes(o.status) ? 0 : ['cooking', 'on_the_way'].includes(o.status) ? 1 : 2;

export function Profile({ active }: { active: boolean }) {
  const token = useSession((s) => s.token);
  const logout = useSession((s) => s.logout);
  const me = useMe();
  const orders = useOrders(active).data ?? [];
  const settings = useSettings().data;
  const products = useCatalog().data?.products ?? [];
  const { favs, toggleFav } = useCart();
  const { open, setTab } = useUi();
  const [ask, setAsk] = useState<'logout' | 'delete' | null>(null);
  const [allOrders, setAllOrders] = useState(false);
  const [busy, setBusy] = useState(false);

  const favItems = products.filter((p) => favs.includes(p.id));
  const shown = allOrders ? orders : orders.filter((o) => ACTIVE.has(o.status)).concat(orders.filter((o) => !ACTIVE.has(o.status)).slice(0, 1));

  const doLogout = async () => {
    setAsk(null);
    await unregisterPush();
    logout();
    queryClient.removeQueries({ queryKey: ['/v1/me'] });
    queryClient.removeQueries({ queryKey: ['/v1/orders'] });
    queryClient.removeQueries({ queryKey: ['/v1/repairs'] });
    queryClient.removeQueries({ queryKey: ['/v1/notifications'] });
  };

  const doDelete = async () => {
    setBusy(true);
    try {
      await api('/v1/me', { method: 'DELETE' });
      await doLogout();
      toast('Аккаунт удалён');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
      setAsk(null);
    }
  };

  return (
    <section className={`screen${active ? ' active' : ''}`} id="s-profile">
      <div className="mach">
        <h1>Профиль</h1>
        <p className="ord">Ваши данные и бонусы</p>
        {!token ? (
          <div className="box" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div className="av" style={{ margin: '0 auto 12px' }}>
              <Icon name="user" />
            </div>
            <div className="mname">Войдите по номеру телефона</div>
            <div className="msub">Чтобы оформлять заказы, следить за ремонтом и копить бонусы</div>
            <button className="bt" onClick={() => open({ type: 'login' })}>
              Войти
            </button>
          </div>
        ) : (
          <>
            <button className="box pf" style={{ width: '100%', textAlign: 'left' }} onClick={() => open({ type: 'editProfile' })}>
              <div className="av">{(me.data?.name ?? '?')[0]?.toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div className="nm">{me.data?.name ?? 'Добавьте имя'}</div>
                <div className="ln">
                  {me.data ? formatPhone(me.data.phone) : ''}
                  {me.data?.city ? (
                    <>
                      <br />
                      {me.data.city}
                    </>
                  ) : null}
                </div>
              </div>
              <Icon name="chev" />
            </button>
            {orders.length ? (
              <div className="box">
                <h3>Мои заказы</h3>
                {shown.map((o) => (
                  <OrderRow key={o.id} o={o} pickupTitle={settings?.pickupPoints.find((p) => p.id === o.delivery.pickupPointId)?.title} />
                ))}
                {orders.length > shown.length || allOrders ? (
                  <button className="lnk" onClick={() => setAllOrders(!allOrders)}>
                    {allOrders ? 'Свернуть' : `Все заказы (${orders.length})`}
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="box bon">
              <div>
                <b>{me.data?.bonus ?? 0}</b>
                <span>бонусов на счёте</span>
              </div>
              <Icon name="heart" />
            </div>
          </>
        )}
        <div className="box">
          <h3>Избранное</h3>
          {favItems.length ? (
            favItems.map((p) => (
              <div className="fv" key={p.id}>
                {p.image ? <img src={p.image} alt="" /> : null}
                <div className="n">
                  {p.title}
                  <small>{money(p.price)}</small>
                </div>
                <button aria-label="Убрать из избранного" onClick={() => toggleFav(p.id)}>
                  <Icon name="heart" />
                </button>
              </div>
            ))
          ) : (
            <p className="fe">Здесь будут товары, которые вы отметили сердечком.</p>
          )}
        </div>
        <div className="box" style={{ paddingTop: 6, paddingBottom: 6 }}>
          <button className="rw" onClick={() => setTab('machine')}>
            Ремонт кофемашины
            <Icon name="chev" />
          </button>
          {settings ? (
            <button className="rw" onClick={() => openUrl(telHref(settings.supportPhone))}>
              <span>
                Позвонить нам
                <small>
                  {settings.supportPhone} · {settings.workingHours}
                </small>
              </span>
              <Icon name="phone" />
            </button>
          ) : null}
          {settings ? (
            <button className="rw" onClick={() => openUrl(settings.privacyUrl)}>
              Политика конфиденциальности
              <Icon name="chev" />
            </button>
          ) : null}
          {settings ? (
            <button className="rw" onClick={() => openUrl(settings.termsUrl)}>
              Условия использования
              <Icon name="chev" />
            </button>
          ) : null}
          {token ? (
            <>
              <button className="rw" onClick={() => setAsk('logout')}>
                Выйти
                <Icon name="chev" />
              </button>
              <button className="rw red" onClick={() => setAsk('delete')}>
                {busy ? <Spinner /> : 'Удалить аккаунт'}
              </button>
            </>
          ) : null}
        </div>
      </div>
      {ask === 'logout' ? <Confirm title="Выйти из аккаунта?" text="Корзина и избранное останутся на телефоне." ok="Выйти" onOk={doLogout} onCancel={() => setAsk(null)} /> : null}
      {ask === 'delete' ? (
        <Confirm
          title="Удалить аккаунт?"
          text="Удалим профиль, бонусы и историю в приложении. Заказы останутся в учёте магазина без ваших данных. Это действие нельзя отменить."
          ok="Удалить"
          danger
          onOk={doDelete}
          onCancel={() => setAsk(null)}
        />
      ) : null}
    </section>
  );
}

function OrderRow({ o, pickupTitle }: { o: Order; pickupTitle?: string }) {
  const live = ACTIVE.has(o.status);
  const st = stepOf(o);
  const qty = o.lines.reduce((a, l) => a + l.qty, 0);
  const focus = useUi((s) => s.focusOrderId);
  const setFocus = useUi((s) => s.setFocusOrder);
  useEffect(() => {
    if (focus === o.id) {
      void queryClient.invalidateQueries({ queryKey: ['/v1/orders'] });
      setFocus(null);
    }
  }, [focus, o.id, setFocus]);
  return (
    <div className="ordl">
      <div className="hd">
        Заказ {o.number}
        <span>{dateTime(o.createdAt)}</span>
      </div>
      <div className={`chip2${live ? (o.status === 'awaiting_payment' ? ' warn' : '') : ' off'}`}>
        <i />
        {ORDER_STATUS_TITLE[o.status]}
      </div>
      {live && o.status !== 'awaiting_payment' ? (
        <div className="segs">
          {[0, 1, 2].map((k) => (
            <i key={k} className={k < st ? 'g' : k === st ? 'v' : ''} />
          ))}
        </div>
      ) : null}
      <div className="msub" style={{ marginTop: 8 }}>
        {qty} шт. · {money(o.total)} · {o.delivery.type === 'delivery' ? 'доставка' : `самовывоз: ${pickupTitle ?? ''}`}
      </div>
    </div>
  );
}

export function EditProfileSheet({ open }: { open: boolean }) {
  const close = useUi((s) => s.close);
  const me = useMe().data;
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName(me?.name ?? '');
      setCity(me?.city ?? '');
    }
  }, [open, me]);
  const save = async () => {
    setBusy(true);
    try {
      const u = await api<User>('/v1/me', { method: 'PATCH', body: { ...(name.trim() ? { name: name.trim() } : {}), city: city.trim() } });
      queryClient.setQueryData(['/v1/me'], u);
      close('editProfile');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={() => close('editProfile')}>
      <h3>Мои данные</h3>
      <label className="lb">Имя</label>
      <input className="fi" value={name} maxLength={80} autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
      <label className="lb">Город</label>
      <input className="fi" value={city} maxLength={80} placeholder="Петропавловск-Камчатский" onChange={(e) => setCity(e.target.value)} />
      <button className="bt" disabled={busy} onClick={save}>
        {busy ? <Spinner /> : 'Сохранить'}
      </button>
    </Sheet>
  );
}
