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
  const simpleQty = p ? (lines.find((l) => l.key === `${p.id}|`)?.qty ?? 0) : 0;
  // Особенности, которых нет в тексте описания, показываем плашками, чтобы не дублировать.
  const extraFacts = p ? p.facts.filter((f) => !p.description.includes(f)) : [];
  const samePrice = p ? p.variants.every((v) => v.price === p.variants[0]?.price) : false;

  return (
    <Panel open={!!id} title={p?.title ?? ''} onBack={() => close('product')} label="Карточка товара">
      {p ? (
        <>
          {p.image ? (
            <div className="bimg">
              <img src={p.image} alt="" />
            </div>
          ) : null}
          <div className="box bp">
            <b>{!p.hasVariants ? money(p.price) : samePrice ? money(p.variants[0]?.price ?? p.price) : `от ${money(p.price)}`}</b>
            <span>
              {!p.hasVariants ? null : samePrice ? 'за любой вкус' : 'цена зависит от варианта'}
              {p.subtitle ? (
                <>
                  {p.hasVariants ? <br /> : null}
                  {p.subtitle}
                </>
              ) : null}
            </span>
          </div>
          {p.hasVariants ? (
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
          ) : (
            <div className="box">
              <div className="fl" style={{ padding: 0 }}>
                <div className="n">
                  {p.stock === 0 ? 'Нет в наличии' : 'В корзину'}
                  {p.stock != null && p.stock > 0 && p.stock <= 5 ? <small>Осталось {p.stock} шт.</small> : null}
                </div>
                {p.stock === 0 && !simpleQty ? null : (
                  <Stepper
                    qty={simpleQty}
                    onChange={(d) => {
                      if (d > 0) {
                        if (p.stock != null && simpleQty >= p.stock) return toast(`В наличии ${p.stock} шт.`);
                        add({ productId: p.id, variantId: null, modifiers: [], title: p.title });
                        tap();
                        toast('Добавлено в корзину');
                      } else setQty(`${p.id}|`, simpleQty - 1);
                    }}
                  />
                )}
              </div>
            </div>
          )}
          {p.description || extraFacts.length ? (
            <div className="box">
              <h3>О товаре</h3>
              {p.description ? (
                <p className="fe" style={{ margin: 0, color: 'var(--ink)', fontSize: 15, lineHeight: 1.45 }}>
                  {p.description}
                </p>
              ) : null}
              {extraFacts.length ? (
                <div className="facts">
                  {extraFacts.map((f) => (
                    <span key={f}>{f}</span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </Panel>
  );
}
