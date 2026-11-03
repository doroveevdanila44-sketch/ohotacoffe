import { useMemo } from 'react';
import type { Category, Product } from '@kbs/shared';
import { Feed } from '../components/Feed';
import { Icon } from '../components/Icons';
import { Loading, Panel, Stepper } from '../components/common';
import { goods, money } from '../lib/format';
import { tap } from '../lib/native';
import { useCatalog } from '../lib/queries';
import { useCart } from '../store/cart';
import { toast, useUi } from '../store/ui';

export function Catalog({ active }: { active: boolean }) {
  const { data, isPending } = useCatalog();
  const open = useUi((s) => s.open);
  const byCat = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of data?.products ?? []) m.set(p.categoryId, [...(m.get(p.categoryId) ?? []), p]);
    return m;
  }, [data]);
  const cats = (data?.categories ?? []).filter((c) => byCat.get(c.id)?.length);

  return (
    <section className={`screen${active ? ' active' : ''}`} id="s-catalog">
      <div className="cat">
        <h1>Каталог</h1>
        <p className="ord">{cats.length ? `${cats.length} разделов` : ''}</p>
        {!data && isPending ? <Loading /> : null}
        <div className="catgrid">
          {cats.map((c, i) => (
            <CatCard key={c.id} c={c} items={byCat.get(c.id)!} alt={i % 2 === 1} onClick={() => open({ type: 'category', id: c.id })} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CatCard({ c, items, alt, onClick }: { c: Category; items: Product[]; alt: boolean; onClick: () => void }) {
  const imgs = (c.images.length ? c.images : items.map((p) => p.image).filter((x): x is string => !!x)).slice(0, 3);
  const one = imgs.length === 1;
  return (
    <button className={`cc${one ? ' one' + (alt ? ' alt' : '') : ''}`} onClick={onClick}>
      {one ? <div className="pn" /> : null}
      {imgs.map((src) => (
        <img key={src} src={src} alt="" draggable={false} />
      ))}
      <div className="cl">
        <b>{c.title}</b>
        <span>{goods(items.length)}</span>
      </div>
      <div className="cg">
        <Icon name="chev" />
      </div>
    </button>
  );
}

export function CategoryPanel({ id }: { id: string | null }) {
  const { data } = useCatalog();
  const close = useUi((s) => s.close);
  const c = data?.categories.find((x) => x.id === id);
  const items = useMemo(() => data?.products.filter((p) => p.categoryId === id) ?? [], [data, id]);
  return (
    <Panel open={!!id} title={c?.title ?? ''} onBack={() => close('category')} label="Раздел каталога">
      <p className="csub">{goods(items.length)}</p>
      {id ? <Feed items={items} style={{ padding: '0 0 140px' }} /> : null}
    </Panel>
  );
}

/** Товар с вариантами: вкусы сиропа, вес, объём. */
export function ProductPanel({ id }: { id: string | null }) {
  const { data } = useCatalog();
  const close = useUi((s) => s.close);
  const lines = useCart((s) => s.lines);
  const add = useCart((s) => s.add);
  const setQty = useCart((s) => s.setQty);
  const p = data?.products.find((x) => x.id === id);
  const samePrice = p ? p.variants.every((v) => v.price === p.variants[0]?.price) : false;

  return (
    <Panel open={!!id} title={p?.title ?? ''} onBack={() => close('product')} label="Выбор варианта">
      {p ? (
        <>
          {p.image ? (
            <div className="bimg">
              <img src={p.image} alt="" />
            </div>
          ) : null}
          <div className="box bp">
            <b>{samePrice ? money(p.variants[0]?.price ?? p.price) : `от ${money(p.price)}`}</b>
            <span>
              {samePrice ? 'за любой вкус' : 'цена зависит от варианта'}
              {p.subtitle ? (
                <>
                  <br />
                  {p.subtitle}
                </>
              ) : null}
            </span>
          </div>
          {p.description ? (
            <div className="box">
              <p className="fe" style={{ margin: 0 }}>
                {p.description}
              </p>
            </div>
          ) : null}
          <div className="box">
            {p.variants.map((v) => {
              const key = [p.id, v.id].join('|');
              const q = lines.find((l) => l.key === key)?.qty ?? 0;
              const out = v.stock === 0;
              return (
                <div className="fl" key={v.id}>
                  <div className="n">
                    {v.title}
                    <small>{out ? 'Нет в наличии' : money(v.price)}</small>
                  </div>
                  {out && !q ? null : (
                    <Stepper
                      qty={q}
                      onChange={(d) => {
                        if (d > 0) {
                          if (v.stock != null && q >= v.stock) return toast(`В наличии ${v.stock} шт.`);
                          add({ productId: p.id, variantId: v.id, modifiers: [], title: `${p.title}, ${v.title}` });
                          tap();
                          toast(`Добавлено: ${v.title}`);
                        } else setQty(key, q - 1);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </Panel>
  );
}
