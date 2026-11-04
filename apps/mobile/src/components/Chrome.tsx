import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';
import { Icon, type IconName } from './Icons';
import { isNative } from '../lib/native';
import { cartCount, useCart } from '../store/cart';
import { useUi, type Tab } from '../store/ui';
import { tap } from '../lib/native';

const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'home', icon: 'home', label: 'Главная' },
  { id: 'catalog', icon: 'grid', label: 'Каталог' },
  { id: 'coffee', icon: 'cup', label: 'Заказать кофе' },
  { id: 'machine', icon: 'mach', label: 'Ремонт кофемашины' },
  { id: 'cart', icon: 'bag', label: 'Корзина' },
  { id: 'profile', icon: 'user', label: 'Профиль' },
];

export function TabBar() {
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  const n = useCart((s) => cartCount(s.lines));
  return (
    <nav className="tabbar" aria-label="Навигация">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={tab === t.id ? 'on' : ''}
          aria-label={t.label}
          aria-current={tab === t.id ? 'page' : undefined}
          onClick={() => {
            if (tab !== t.id) tap();
            setTab(t.id);
          }}
        >
          <Icon name={t.icon} />
          {t.id === 'cart' ? <i className={`badge${n ? ' on' : ''}`}>{n}</i> : null}
        </button>
      ))}
    </nav>
  );
}

/** Заставка «Охота кофе»: зелёный верх, фиолетовый низ, полоса загрузки. */
export function Splash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [minPassed, setMinPassed] = useState(false);
  const [hide, setHide] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinPassed(true), 1200);
    const max = setTimeout(() => setHide(true), 2600);
    return () => (clearTimeout(t), clearTimeout(max));
  }, []);
  useEffect(() => {
    if (ready && minPassed) setHide(true);
  }, [ready, minPassed]);
  useEffect(() => {
    if (!hide) return;
    useUi.getState().setSplash(false);
    onDone();
    const t = setTimeout(() => setGone(true), 250);
    return () => clearTimeout(t);
  }, [hide]); // eslint-disable-line react-hooks/exhaustive-deps
  if (gone) return null;
  return (
    <div id="splash" className={hide ? 'hide' : ''} aria-label="Охота кофе" onClick={() => minPassed && setHide(true)}>
      <div className="top" />
      <div className="word">
        Охота
        <br />
        кофе
      </div>
      <div className="bar">
        <i />
      </div>
    </div>
  );
}

export function OfflineBadge() {
  const [off, setOff] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOff(false);
    const of = () => setOff(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', of);
    return () => (window.removeEventListener('online', on), window.removeEventListener('offline', of));
  }, []);
  return off ? <div className="offline">Нет интернета</div> : null;
}

const GREEN = '#c1e503';
const VIOLET = '#7a2cf5';
const GREY = '#f3f3f5';

/**
 * Цвет верхней части экрана (у динамика и острова) совпадает с тем, что сейчас под ней:
 * на заставке зелёный, у шапки экрана цвет шапки, после прокрутки цвет фона экрана.
 */
export function SystemBar() {
  const tab = useUi((s) => s.tab);
  const step = useUi((s) => s.repairStep);
  const splash = useUi((s) => s.splash);
  const key = `${tab}:${step}`;
  // «Шапка ушла за край» запоминается вместе с экраном, чтобы не тянуться с прошлого экрана.
  const [scrolled, setScrolled] = useState({ key: '', over: false, moved: false });
  const over = scrolled.key === key && scrolled.over;
  // Как в Telegram: когда экран прокручен, верх становится прозрачным, а контент уходит под часы и остров.
  const moved = scrolled.key === key && scrolled.moved;
  const prevKey = useRef(key);
  const animate = prevKey.current === key;
  useEffect(() => {
    prevKey.current = key;
  });

  useLayoutEffect(() => {
    const check = (el: Element | null) => {
      const hero = el?.querySelector('.cfhero, .rhero');
      const bar = document.querySelector('.sysbar') as HTMLElement | null;
      const v = !!hero && !!bar && hero.getBoundingClientRect().bottom <= bar.offsetHeight + 1;
      const m = (el as HTMLElement | null)?.scrollTop ? (el as HTMLElement).scrollTop > 2 : false;
      setScrolled((x) => (x.key === key && x.over === v && x.moved === m ? x : { key, over: v, moved: m }));
    };
    const onScroll = (e: Event) => {
      const el = e.target as HTMLElement;
      if (el.classList?.contains('screen') && el.classList.contains('active')) check(el);
    };
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    check(document.querySelector('.screen.active'));
    return () => document.removeEventListener('scroll', onScroll, { capture: true });
  }, [key]);

  let color = GREY;
  if (splash) color = GREEN;
  else if (tab === 'coffee') color = over ? VIOLET : GREEN;
  else if (tab === 'machine') color = step === 'form' ? (over ? GREEN : VIOLET) : GREEN;

  useLayoutEffect(() => {
    // Safari красит верх экрана по theme-color и по фону html/body, поэтому задаём все три.
    // iOS в режиме «На экране Домой» перечитывает цвет, только если тег заменить целиком.
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    const old = document.querySelector('meta[name="theme-color"]');
    if (old) old.replaceWith(meta);
    else document.head.appendChild(meta);
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
  }, [color]);
  // Цвет значков статус-бара и навигации (iOS и Android) подстраивается под цвет под ними.
  const bottom = splash ? VIOLET : tab === 'coffee' ? VIOLET : tab === 'machine' && step === 'form' ? GREEN : tab === 'machine' ? GREEN : GREY;
  useEffect(() => {
    if (!isNative) return;
    const style = (c: string) => (c === VIOLET ? SystemBarsStyle.Dark : SystemBarsStyle.Light);
    void SystemBars.setStyle({ bar: SystemBarType.StatusBar, style: style(color) }).catch(() => undefined);
    void SystemBars.setStyle({ bar: SystemBarType.NavigationBar, style: style(bottom) }).catch(() => undefined);
  }, [color, bottom]);

  // Цвет задаётся прямо в разметке: он меняется в том же кадре, что и экран под ним.
  return (
    <div className={`sysbar${moved ? ' moved' : ''}${animate ? ' anim' : ''}`} style={{ ['--sb' as string]: color }} aria-hidden="true">
      <i className="sb-c" />
      <i className="sb-g" />
    </div>
  );
}
