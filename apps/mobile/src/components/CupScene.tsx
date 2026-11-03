import { useEffect, useRef } from 'react';

/** Фото кружки для раздела меню: файл, отношение сторон, высота, сдвиг (у кружек с ручкой). */
const PHOTO: Record<string, [string, number, number, number, number]> = {
  classic: ['mug1', 0.8578, 196, 0.2, 0.09],
  author: ['mug2', 0.8875, 196, 0.2, 0.09],
  cold: ['mug3', 1.2875, 212, 0.14, 0],
  tea: ['mug6', 0.9484, 196, 0.22, 0.09],
  lemonade: ['mug5', 1.2469, 212, 0.12, 0],
};
const photoOf = (presentation: string | null | undefined) => PHOTO[presentation ?? ''] ?? PHOTO.classic!;

export const scaleOf = (ml: number) => (ml <= 250 ? 0.78 : ml <= 350 ? 0.92 : 1.08);
const cupTop = (presentation: string | null | undefined, ml: number) => {
  const ph = photoOf(presentation);
  const t0 = 232 - ph[2] * (1 - ph[3]);
  return Math.round(236 - (236 - t0) * scaleOf(ml));
};

export type FxKind = 'st' | 'cube' | 'dots';
export interface Fx {
  id: number;
  kind: FxKind;
  color: string;
}

/** Какую анимацию показать при добавке: по названию из 1С. */
export function fxFor(title: string): Omit<Fx, 'id'> | null {
  const t = title.toLowerCase();
  if (t.includes('сахар')) return { kind: 'cube', color: '#ffffff' };
  if (t.includes('корица')) return { kind: 'dots', color: '#b5602a' };
  if (t.includes('мёд') || t.includes('мед')) return { kind: 'st', color: '#f0b030' };
  if (t.includes('сироп')) return { kind: 'st', color: '#d6335a' };
  if (t.includes('молок')) return { kind: 'st', color: '#ffffff' };
  if (t.includes('топпинг')) return { kind: 'dots', color: '#4b2a1b' };
  if (t.includes('маршмел')) return { kind: 'cube', color: '#ffe3ee' };
  if (t.includes('лимон')) return { kind: 'cube', color: '#ffd21f' };
  if (t.includes('морожен')) return { kind: 'cube', color: '#dff1ff' };
  if (t.includes('шот') || t.includes('эспрессо')) return { kind: 'st', color: '#2a170d' };
  return null;
}

function FxLayer({ fx, top }: { fx: Fx; top: number }) {
  if (fx.kind === 'st') return <path className="fx-st" d={`M180 20V${top + 6}`} stroke={fx.color} strokeWidth={7} strokeLinecap="round" fill="none" />;
  if (fx.kind === 'cube')
    return <rect className="fx-drop" x={172 + ((fx.id * 7) % 11) - 5} y={top - 12} width={14} height={14} rx={3} fill={fx.color} stroke="rgba(0,0,0,.18)" />;
  return (
    <>
      {Array.from({ length: 14 }, (_, k) => (
        <circle key={k} className="fx-drop" cx={158 + ((fx.id * 13 + k * 17) % 44)} cy={top - 6} r={2.4} fill={fx.color} style={{ animationDelay: `${((k * 37) % 40) / 100}s` }} />
      ))}
    </>
  );
}

/** Кружка над меню: плавает, при «В корзину» в неё льётся напиток. */
export function CupScene({
  name,
  presentation,
  color,
  ml,
  state,
  fx,
}: {
  name: string;
  presentation: string | null | undefined;
  color: string;
  ml: number;
  state: 'idle' | 'brewing' | 'done';
  fx: Fx[];
}) {
  const ph = photoOf(presentation);
  const H = ph[2];
  const W = Math.round(H / ph[1]);
  const top = cupTop(presentation, ml);
  const svg = useRef<SVGSVGElement>(null);
  // Перезапуск анимации струи при каждом наливе.
  useEffect(() => {
    if (state === 'brewing' && svg.current) void svg.current.getBoundingClientRect();
  }, [state]);
  return (
    <div className="stage">
      <svg ref={svg} viewBox="0 44 360 218" role="img" aria-label={name} className={state === 'idle' ? '' : state} style={{ ['--l' as string]: color }}>
        <path className="stm" d={`M180 0V${top}`} stroke={color} strokeWidth={8} strokeLinecap="round" fill="none" />
        <g className="cupg" style={{ transformOrigin: '180px 236px', transform: `scale(${scaleOf(ml)})` }}>
          <g className="flt">
            <image href={`img/${ph[0]}.webp`} x={Math.round(180 - W / 2 + W * ph[4])} y={232 - H} width={W} height={H} preserveAspectRatio="xMidYMid meet" />
          </g>
        </g>
        <g>
          {fx.map((f) => (
            <g key={f.id}>
              <FxLayer fx={f} top={top} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
