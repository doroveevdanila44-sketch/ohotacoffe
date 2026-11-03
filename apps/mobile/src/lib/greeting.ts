/** Прилагательные меняются, часть суток берётся из времени устройства. Для «ночи» только женский род. */
const ADJ: [string, string | null][] = [
  ['Доброго', 'Доброй'],
  ['Чумового', 'Чумовой'],
  ['Хорошего', 'Хорошей'],
  ['Замечательного', 'Замечательной'],
  ['Счастливого', 'Счастливой'],
  ['Улётного', 'Улётной'],
  ['Кофейного', 'Кофейной'],
  ['Яркого', 'Яркой'],
  ['Сладкого', 'Сладкой'],
  ['Солнечного', null],
];
const PART = { morning: 'утра', day: 'дня', evening: 'вечера', night: 'ночи' } as const;

const dayPart = (): keyof typeof PART => {
  const h = new Date().getHours();
  return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : h >= 17 && h < 23 ? 'evening' : 'night';
};

let queue: string[] = [];
let last = '';

export function nextGreeting(): string {
  const part = dayPart();
  const night = part === 'night';
  const pool = ADJ.filter((a) => !night || a[1]).map((a) => (night ? a[1]! : a[0]));
  if (!queue.length || queue.some((x) => !pool.includes(x))) queue = pool.slice().sort(() => Math.random() - 0.5);
  let a = queue.pop()!;
  if (a === last) a = queue.length ? queue.pop()! : pool.find((x) => x !== last)!;
  last = a;
  return `${a} ${PART[part]}`;
}
