import { useEffect, useRef, useState } from 'react';
import { useUi } from '../store/ui';

const SLIDES = [
  { cls: 's-hands', img: 'hands', title: ['Кофе для', 'каждого'], small: 'Индивидуальный подбор' },
  { cls: 's-train', img: 'train', title: ['Привозим', 'со всего света'], small: null },
  { cls: 's-pink', img: 'pink', title: ['Кофемашина', 'сломалась?'], small: 'Поможем с ремонтом', tab: 'machine' as const },
];

/** Карусель баннеров: листается пальцем, сама меняется раз в 8 секунд, бесконечная. */
export function Hero({ active }: { active: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState(0);
  const userUntil = useRef(0);
  const setTab = useUi((s) => s.setTab);
  const N = SLIDES.length;

  useEffect(() => {
    const el = track.current!;
    let jump: ReturnType<typeof setTimeout>;
    const W = () => el.clientWidth;
    const onScroll = () => {
      const i = Math.round(el.scrollLeft / W());
      setCur(i % N);
      clearTimeout(jump);
      jump = setTimeout(() => {
        if (Math.round(el.scrollLeft / W()) >= N) {
          el.style.scrollSnapType = 'none';
          el.scrollLeft = 0;
          requestAnimationFrame(() => (el.style.scrollSnapType = ''));
        }
      }, 140);
    };
    const hold = () => (userUntil.current = Date.now() + 7000);
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('touchstart', hold, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', hold);
      clearTimeout(jump);
    };
  }, [N]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      const el = track.current;
      if (!el || document.hidden || Date.now() < userUntil.current) return;
      el.scrollTo({ left: (Math.round(el.scrollLeft / el.clientWidth) + 1) * el.clientWidth, behavior: 'smooth' });
    }, 8000);
    return () => clearInterval(t);
  }, [active]);

  const slides = [...SLIDES, SLIDES[0]!];
  return (
    <section className="hero" aria-label="Акции и новости">
      <div className="track" ref={track}>
        {slides.map((s, i) => (
          <div className={`slide ${s.cls}`} key={i} aria-hidden={i === N} onClick={() => s.tab && setTab(s.tab)}>
            <img src={`img/${s.img}.webp`} alt="" draggable={false} />
            <div className="copy">
              <h2>
                {s.title[0]}
                <br />
                {s.title[1]}
              </h2>
              {s.small ? <small>{s.small}</small> : null}
            </div>
          </div>
        ))}
      </div>
      <div className="dots">
        {SLIDES.map((_, k) => (
          <button
            key={k}
            className={k === cur ? 'on' : ''}
            aria-label={`Слайд ${k + 1}`}
            onClick={() => {
              userUntil.current = Date.now() + 7000;
              const el = track.current!;
              el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' });
            }}
          />
        ))}
      </div>
    </section>
  );
}
