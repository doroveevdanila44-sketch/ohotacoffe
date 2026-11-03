import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { Addon, Product } from '@kbs/shared';
import { CupScene, fxFor, type Fx } from '../components/CupScene';
import { Loading, Sheet } from '../components/common';
import { money } from '../lib/format';
import { tap } from '../lib/native';
import { useMenu } from '../lib/queries';
import type { CartModifier } from '../store/cart';
import { useCart } from '../store/cart';
import { toast } from '../store/ui';

const WORD: Record<string, string> = { tea: 'чай', lemonade: 'лимонад' };
const defaultSize = (d: Product) => (d.variants.length === 3 ? 1 : 0);

export function Coffee({ active }: { active: boolean }) {
  const { data, isPending, isError, refetch } = useMenu();
  const add = useCart((s) => s.add);
  const [catId, setCatId] = useState<string | null>(null);
  const [drinkId, setDrinkId] = useState<string | null>(null);
  const [si, setSi] = useState(0);
  const [mods, setMods] = useState<Record<string, number>>({});
  const [flavors, setFlavors] = useState<string[]>([]);
  const [brew, setBrew] = useState<'idle' | 'brewing' | 'done'>('idle');
  const [fx, setFx] = useState<Fx[]>([]);
  const [syrOpen, setSyrOpen] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const cats = data?.categories ?? [];
  const cat = cats.find((c) => c.id === catId) ?? cats[0];
  const drinks = useMemo(() => (data?.drinks ?? []).filter((d) => d.categoryId === cat?.id), [data, cat]);
  const drink = drinks.find((d) => d.id === drinkId) ?? drinks[0];
  const variant = drink?.variants[Math.min(si, (drink?.variants.length ?? 1) - 1)];
  const ml = variant?.ml ?? null;
  const addons = data?.addons ?? [];
  const syrupAddon = addons.find((a) => a.needsFlavor);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const resetBrew = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setBrew('idle');
  };

  const addonPrice = (a: Addon) => (ml !== null ? a.priceByMl?.[String(ml)] : undefined) ?? a.price;

  const pick = (d: Product) => {
    resetBrew();
    setDrinkId(d.id);
    setSi(defaultSize(d));
  };

  const fire = (title: string) => {
    const f = fxFor(title);
    if (!f) return;
    const item = { ...f, id: Date.now() + Math.random() };
    setFx((x) => [...x, item]);
    timers.current.push(setTimeout(() => setFx((x) => x.filter((y) => y.id !== item.id)), 1500));
  };

  const toggle = (a: Addon) => {
    resetBrew();
    if (a.needsFlavor) return setSyrOpen(true);
    const q = mods[a.id] ?? 0;
    const next = a.maxQty > 1 ? (q + 1) % (a.maxQty + 1) : q ? 0 : 1;
    setMods((m) => {
      const n = { ...m };
      if (next) n[a.id] = next;
      else delete n[a.id];
      return n;
    });
    if (next > q) fire(a.title);
    tap();
  };

  const extras = addons.reduce((s, a) => s + (a.needsFlavor ? flavors.length : (mods[a.id] ?? 0)) * addonPrice(a), 0);
  const price = (variant?.price ?? drink?.price ?? 0) + extras;
  const nExtra = Object.values(mods).reduce((a, b) => a + b, 0) + flavors.length;

  const toCart = () => {
    if (!drink) return;
    const modifiers: CartModifier[] = [
      ...Object.entries(mods).map(([addonId, qty]) => ({ addonId, qty, flavorId: null })),
      ...(syrupAddon ? flavors.map((f) => ({ addonId: syrupAddon.id, qty: 1, flavorId: f })) : []),
    ];
    add({ productId: drink.id, variantId: variant?.id ?? null, modifiers, title: drink.title });
    tap();
    toast(`Добавлено: ${drink.title}`);
    resetBrew();
    requestAnimationFrame(() => {
      setBrew('brewing');
      timers.current.push(
        setTimeout(() => {
          setBrew('done');
          timers.current.push(setTimeout(() => setBrew('idle'), 2600));
        }, 3600),
      );
    });
  };

  if (!data) {
    return (
      <section className={`screen${active ? ' active' : ''}`} id="s-coffee">
        <div className="mach cf">
          {isPending ? <Loading /> : null}
          {isError ? (
            <div className="box" style={{ textAlign: 'center' }}>
              <p className="fe">Не удалось загрузить меню</p>
              <button className="bt" onClick={() => refetch()}>
                Повторить
              </button>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className={`screen${active ? ' active' : ''}`} id="s-coffee">
      <div className="mach cf">
        <div className="cfhero">
          <h1 className="cft">
            Самый вкусный <span>{WORD[cat?.presentation ?? ''] ?? 'кофе'}</span>
            <br />
            <span>через 15 минут</span>
          </h1>
          {drink ? <CupScene name={drink.title} presentation={cat?.presentation} color={drink.color ?? '#6a3b24'} ml={ml ?? 250} state={brew} fx={fx} /> : null}
        </div>
        <nav className="cfc">
          {cats.map((c) => (
            <button
              key={c.id}
              className={c.id === cat?.id ? 'on' : ''}
              onClick={() => {
                setCatId(c.id);
                const first = data.drinks.find((d) => d.categoryId === c.id);
                if (first) pick(first);
              }}
            >
              {c.title}
            </button>
          ))}
        </nav>
        {drink ? (
          <div className="cfs">
            <div className="cfi">
              <h2>{drink.title}</h2>
            </div>
            <div className="cfsz">
              {drink.variants.map((v, i) => (
                <button
                  key={v.id}
                  className={v.id === variant?.id ? 'on' : ''}
                  onClick={() => {
                    resetBrew();
                    setSi(i);
                  }}
                >
                  {v.title}
                </button>
              ))}
            </div>
            <div className="cfbt">
              <div className="cfpr">
                <b>{money(price)}</b>
                <small>{drink.note ?? (nExtra ? `С добавками: ${nExtra}` : '')}</small>
              </div>
              <button onClick={toCart}>В корзину</button>
            </div>
          </div>
        ) : null}
        <div className="box" style={{ marginTop: 14 }}>
          <h3>Меню</h3>
          <div className="cfw">
            {drinks.map((d, k) => (
              <Fragment key={d.id}>
                {d.rowBreak && k ? <i className="cfbr" /> : null}
                <button className={`cfk${d.id === drink?.id ? ' on' : ''}`} onClick={() => pick(d)}>
                  {d.title}
                </button>
              </Fragment>
            ))}
          </div>
        </div>
        <div className="box">
          <h3>Добавки</h3>
          <div className="ads">
            {addons.map((a) => {
              const p = addonPrice(a);
              if (a.needsFlavor)
                return (
                  <button key={a.id} className={flavors.length ? 'on' : ''} onClick={() => toggle(a)}>
                    {a.title}
                    <b>{flavors.length ? `· ${flavors.length} · +${money(flavors.length * p)}` : `+${money(p)}`}</b>
                  </button>
                );
              const q = mods[a.id] ?? 0;
              return (
                <button key={a.id} className={q ? 'on' : ''} onClick={() => toggle(a)}>
                  {a.title}
                  <b>{a.maxQty > 1 && q ? `× ${q}` : p ? `+${money(p)}` : 'бесплатно'}</b>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <SyrupSheet
        open={syrOpen}
        selected={flavors}
        max={syrupAddon?.maxQty ?? 3}
        onToggle={(f) => setFlavors((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]))}
        onClose={() => {
          setSyrOpen(false);
          if (flavors.length) fire(syrupAddon?.title ?? 'сироп');
        }}
      />
    </section>
  );
}

function SyrupSheet({ open, selected, max, onToggle, onClose }: { open: boolean; selected: string[]; max: number; onToggle: (id: string) => void; onClose: () => void }) {
  const brands = useMenu().data?.syrupBrands ?? [];
  const [brand, setBrand] = useState<string | null>(null);
  const b = brands.find((x) => x.id === brand) ?? brands[0];
  return (
    <Sheet open={open} onClose={onClose}>
      <h3>Выберите сироп</h3>
      <div className="cfw">
        {brands.map((x) => (
          <button key={x.id} className={`cfk${x.id === b?.id ? ' on' : ''}`} onClick={() => setBrand(x.id)}>
            {x.title.replace(/^Сиропы\s+/i, '')}
          </button>
        ))}
      </div>
      <div className="syg">
        {b?.flavors.map((f) => (
          <button
            key={f.id}
            className={`syf${selected.includes(f.id) ? ' on' : ''}`}
            onClick={() => {
              if (!selected.includes(f.id) && selected.length >= max) return toast(`Не больше ${max} сиропов`);
              onToggle(f.id);
              tap();
            }}
          >
            <span>{f.title}</span>
          </button>
        ))}
      </div>
      <button className="bt" style={{ marginTop: 14 }} onClick={onClose}>
        Готово
      </button>
    </Sheet>
  );
}
