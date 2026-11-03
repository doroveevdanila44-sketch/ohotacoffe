import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const appRoot = () => document.getElementById('app') ?? document.body;
import { Icon } from './Icons';
import { useUi } from '../store/ui';

export function Spinner() {
  return <div className="spin" />;
}

export function Loading() {
  return (
    <div className="loading">
      <Spinner />
    </div>
  );
}

export function Toast() {
  const text = useUi((s) => s.toastText);
  const nonce = useUi((s) => s.toastNonce);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!nonce) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 1700);
    return () => clearTimeout(t);
  }, [nonce]);
  return (
    <div className={`toast glass${on ? ' on' : ''}`} role="status">
      <Icon name="check" />
      <span>{text}</span>
    </div>
  );
}

export function Stepper({ qty, onChange, alwaysMinus }: { qty: number; onChange: (d: number) => void; alwaysMinus?: boolean }) {
  return (
    <div className="step">
      {qty > 0 || alwaysMinus ? (
        <>
          <button className="m" aria-label="Меньше" onClick={() => onChange(-1)}>
            <Icon name="minus" />
          </button>
          <b>{qty}</b>
        </>
      ) : null}
      <button className={`p${qty ? ' fill' : ''}`} aria-label="Больше" onClick={() => onChange(1)}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

/** Боковая панель поверх экрана (раздел каталога, вкусы, уведомления). */
export function Panel({ open, title, onBack, children, label }: { open: boolean; title: ReactNode; onBack: () => void; children: ReactNode; label?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open && ref.current) ref.current.scrollTop = 0;
  }, [open]);
  return (
    <section ref={ref} className={`brand${open ? ' open' : ''}`} aria-label={label} aria-hidden={!open}>
      <div className="bw">
        <div className="btop">
          <button className="glass round" aria-label="Назад" onClick={onBack}>
            <Icon name="chev" />
          </button>
          <h2>{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

/** Нижний лист (выбор сиропа, редактирование профиля). */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 320);
    return () => clearTimeout(t);
  }, [open]);
  if (!mounted) return null;
  return createPortal(
    <div className={`shw${shown ? ' open' : ''}`}>
      <div className="shb" onClick={onClose} />
      <div className="sheet" role="dialog">
        <div className="grab" />
        {children}
      </div>
    </div>,
    appRoot(),
  );
}

export function Confirm({
  title,
  text,
  ok,
  danger,
  onOk,
  onCancel,
}: {
  title: string;
  text: string;
  ok: string;
  danger?: boolean;
  onOk: () => void;
  onCancel: () => void;
}) {
  return createPortal(
    <div className="dlg" onClick={onCancel}>
      <div className="box" onClick={(e) => e.stopPropagation()} role="alertdialog">
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="row">
          <button className="bt gh" onClick={onCancel}>
            Отмена
          </button>
          <button className={`bt${danger ? ' dan' : ''}`} onClick={onOk}>
            {ok}
          </button>
        </div>
      </div>
    </div>,
    appRoot(),
  );
}

export function Info({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return createPortal(
    <div className="dlg" onClick={onClose}>
      <div className="box" onClick={(e) => e.stopPropagation()} role="dialog">
        <h3>{title}</h3>
        <p>{text}</p>
        <div className="row">
          <button className="bt" onClick={onClose}>
            Понятно
          </button>
        </div>
      </div>
    </div>,
    appRoot(),
  );
}

/** Общий «тик» для смены строк под ценой: один таймер на всё приложение. */
const subs = new Set<(n: number) => void>();
let ticker: ReturnType<typeof setInterval> | null = null;
export function useTick(ms = 400) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    subs.add(setNow);
    if (!ticker) ticker = setInterval(() => subs.forEach((f) => f(Date.now())), ms);
    return () => {
      subs.delete(setNow);
      if (!subs.size && ticker) {
        clearInterval(ticker);
        ticker = null;
      }
    };
  }, [ms]);
  return now;
}

/** Число колонок ленты: 2 на телефоне, 3 на внутреннем экране iPhone Fold и планшете, 4 на широком. */
export function useColumns() {
  const get = () => (window.innerWidth >= 1000 ? 4 : window.innerWidth >= 600 ? 3 : 2);
  const [n, setN] = useState(get);
  useEffect(() => {
    const f = () => setN(get());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return n;
}
