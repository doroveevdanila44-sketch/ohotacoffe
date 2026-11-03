import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney } from '@kbs/shared';
import { Feed } from '../components/Feed';
import { Hero } from '../components/Hero';
import { Icon } from '../components/Icons';
import { Loading } from '../components/common';
import { goods } from '../lib/format';
import { nextGreeting } from '../lib/greeting';
import { useCatalog, useMe, useNotifications, useSettings } from '../lib/queries';
import { useUi } from '../store/ui';

export function Home({ active }: { active: boolean }) {
  const catalog = useCatalog();
  const settings = useSettings().data;
  const me = useMe().data;
  const unread = useNotifications().data?.unread ?? 0;
  const { setTab, open } = useUi();
  const tabNonce = useUi((s) => s.tabNonce);
  const [greet, setGreet] = useState(nextGreeting);
  const [cat, setCat] = useState('all');
  const [q, setQ] = useState('');
  const top = useRef<HTMLElement>(null);
  const screen = useRef<HTMLElement>(null);

  // Приветствие меняется при возврате на главную и когда шапка уходит за край экрана.
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) setGreet(nextGreeting());
    if (active && wasActive.current) screen.current?.scrollTo({ top: 0, behavior: 'smooth' });
    wasActive.current = active;
  }, [active, tabNonce]);

  useEffect(() => {
    let away = false;
    const io = new IntersectionObserver(
      (es) => {
        const e = es[es.length - 1]!;
        if (e.intersectionRatio < 0.05) {
          if (!away) {
            away = true;
            setGreet(nextGreeting());
          }
        } else if (e.intersectionRatio > 0.6) away = false;
      },
      { root: screen.current, threshold: [0, 0.05, 0.6, 1] },
    );
    io.observe(top.current!);
    return () => io.disconnect();
  }, []);

  const data = catalog.data;
  const list = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return data.products.filter((p) => (cat === 'all' || p.categoryId === cat) && (!s || p.searchText.includes(s)));
  }, [data, cat, q]);

  const name = me?.name?.split(' ')[0];

  return (
    <main ref={screen} className={`screen${active ? ' active' : ''}`} id="s-home">
      <header className="top" ref={top}>
        <div className="hello">
          <span>{name ? `${greet},` : greet}</span>
          <b>{name ? `${name}!` : 'и вкусного кофе!'}</b>
        </div>
        <div className="actions">
          <button className="glass round" aria-label="Уведомления" onClick={() => open({ type: 'notifications' })}>
            <Icon name="bell" />
            <i className={`badge${unread ? ' on' : ''}`}>{unread}</i>
          </button>
        </div>
      </header>

      <label className="search glass">
        <Icon name="search" />
        <input type="search" placeholder="Найти кофе, сироп, чай" autoComplete="off" enterKeyHint="search" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className={q ? 'show' : ''} aria-label="Очистить" onClick={(e) => (e.preventDefault(), setQ(''))}>
          <Icon name="x" />
        </button>
      </label>

      <div className="bnr">
        <Hero active={active} />
        <section className="promo" aria-label="Бесплатная доставка">
          <img src="img/car.webp" alt="" />
          <div className="pt">
            Доставка бесплатно
            <br />
            от {formatMoney(settings?.freeDeliveryFrom ?? 250000)}
          </div>
          <div className="strip">
            <i />
            <span>Петропавловск-Камчатский, Елизово</span>
            <i />
          </div>
        </section>
      </div>

      <div className="btn2">
        <button className="ordbtn" onClick={() => setTab('coffee')}>
          <Icon name="cup" />
          <span>Заказать готовый кофе</span>
          <Icon name="chev" />
        </button>
        <button className="ordbtn g" onClick={() => setTab('machine')}>
          <Icon name="gear" />
          <span>Починить кофемашину</span>
          <Icon name="chev" />
        </button>
      </div>

      <nav className="cats" aria-label="Каталог">
        {[{ id: 'all', title: 'Всё' }, ...(data?.categories ?? [])].map((c) => (
          <button
            key={c.id}
            className={`chip${cat === c.id ? ' on' : ''}`}
            onClick={(e) => {
              setCat(c.id);
              e.currentTarget.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
            }}
          >
            {c.title}
          </button>
        ))}
      </nav>

      <div className="sec">
        <h3>Подборка для вас</h3>
        <span>{list.length ? goods(list.length) : ''}</span>
      </div>
      {!data && catalog.isPending ? <Loading /> : null}
      {!data && catalog.isError ? (
        <div className="empty show">
          <b>Не удалось загрузить каталог</b>
          {catalog.error.message}
          <button className="btn" style={{ marginTop: 12 }} onClick={() => catalog.refetch()}>
            Повторить
          </button>
        </div>
      ) : null}
      {data && list.length ? <Feed items={list} /> : null}
      {data && !list.length ? (
        <div className="empty show">
          <b>{q ? 'Ничего не нашли' : 'Скоро добавим'}</b>
          {q ? 'Попробуйте другой запрос' : 'В этом разделе пока пусто'}
        </div>
      ) : null}
    </main>
  );
}
