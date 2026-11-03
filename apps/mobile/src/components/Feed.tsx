import { useEffect, useMemo, useState } from 'react';
import type { Product } from '@kbs/shared';
import { Icon } from './Icons';
import { useColumns, useTick } from './common';
import { money } from '../lib/format';
import { tap } from '../lib/native';
import { useCart } from '../store/cart';
import { toast, useUi } from '../store/ui';

function Card({ p, i }: { p: Product; i: number }) {
  const fav = useCart((s) => s.favs.includes(p.id));
  const toggleFav = useCart((s) => s.toggleFav);
  const add = useCart((s) => s.add);
  const open = useUi((s) => s.open);
  const [done, setDone] = useState(false);
  const now = useTick();
  const n = p.facts.length;
  const k = n ? Math.floor((now + i * 900) / 3300) % n : -1;
  const disc = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const soldOut = !p.hasVariants && p.stock === 0;

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1000);
    return () => clearTimeout(t);
  }, [done]);

  const onAdd = () => {
    if (p.hasVariants) return open({ type: 'product', id: p.id });
    add({ productId: p.id, variantId: null, modifiers: [], title: p.title });
    tap();
    setDone(true);
    toast('Добавлено в корзину');
  };

  return (
    <article className="card" style={{ animationDelay: `${Math.min(i, 12) * 60}ms` }}>
      <div
        className={`ph${p.image ? '' : ' noimg'}`}
        style={p.image ? { aspectRatio: String(p.imageRatio ?? 0.8) } : undefined}
        onClick={() => p.hasVariants && open({ type: 'product', id: p.id })}
      >
        {p.image ? <img src={p.image} alt={p.title} loading="lazy" draggable={false} /> : 'Охота кофе'}
        {disc ? <span className="disc">-{disc}%</span> : null}
        {soldOut ? <span className="oos">Нет в наличии</span> : null}
        <button
          className={`fav${fav ? ' on' : ''}`}
          aria-label="В избранное"
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(p.id);
            tap();
          }}
        >
          <Icon name="heart" />
        </button>
        {p.hasVariants ? (
          <button className="add" aria-label="Выбрать вкус" onClick={(e) => (e.stopPropagation(), onAdd())}>
            <Icon name="chev" />
          </button>
        ) : (
          <button className={`add${done ? ' done' : ''}`} aria-label="В корзину" disabled={soldOut} onClick={(e) => (e.stopPropagation(), onAdd())}>
            <Icon name="plus" className="pl" />
            <Icon name="check" className="ok" />
          </button>
        )}
      </div>
      <div className="pr">
        <b className="price">{p.hasVariants && p.variants.some((v) => v.price !== p.price) ? `от ${money(p.price)}` : money(p.price)}</b>
        {p.oldPrice ? <span className="was">обычно {money(p.oldPrice)}</span> : null}
      </div>
      <h4 className="name" style={{ marginBottom: 0, fontWeight: 500 }}>
        {p.title}
      </h4>
      {p.subtitle ? <p className="sub">{p.subtitle}</p> : null}
      {n ? (
        <p className="info" style={{ marginBottom: 0 }}>
          {p.facts.map((t, j) => (
            <span key={j} className={j === k ? 'on' : ''}>
              {t}
            </span>
          ))}
        </p>
      ) : null}
    </article>
  );
}

/** Лента в стиле Pinterest: карточка уходит в самую короткую колонку. */
export function Feed({ items, style }: { items: Product[]; style?: React.CSSProperties }) {
  const cols = useColumns();
  const split = useMemo(() => {
    const out: { p: Product; i: number }[][] = Array.from({ length: cols }, () => []);
    const h = new Array<number>(cols).fill(0);
    items.forEach((p, i) => {
      let c = 0;
      for (let j = 1; j < cols; j++) if (h[j]! < h[c]!) c = j;
      h[c]! += 1 / (p.imageRatio ?? 0.8) + 0.62;
      out[c]!.push({ p, i });
    });
    return out;
  }, [items, cols]);
  return (
    <div className="feed" style={style}>
      {split.map((col, c) => (
        <div className="col" key={c}>
          {col.map(({ p, i }) => (
            <Card key={p.id} p={p} i={i} />
          ))}
        </div>
      ))}
    </div>
  );
}
