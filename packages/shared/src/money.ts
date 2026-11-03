/**
 * Все суммы в системе хранятся в копейках (целые числа), чтобы не было ошибок округления.
 */
export type Kopecks = number;

export const rub = (rubles: number): Kopecks => Math.round(rubles * 100);

/** 1250 → «1 250 ₽», 12550 копеек → «125,50 ₽» */
export function formatMoney(kop: Kopecks): string {
  const rubles = kop / 100;
  const hasKop = kop % 100 !== 0;
  const s = rubles.toLocaleString('ru-RU', {
    minimumFractionDigits: hasKop ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${s.replace(/\s/g, ' ')} ₽`;
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
