// Проверка вёрстки на линейке iPhone и Android (размеры, вырезы, режим «Домой»).
// Запуск: поднять сервер и npm run preview -w @kbs/mobile, затем node apps/mobile/scripts/layout-check.mjs (нужен playwright).
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs';
// ширина, высота экрана, верх, низ (безопасные зоны), название
const D = [
  [375, 667, 20, 0, 'SE 2/3'], [375, 812, 44, 34, '12/13 mini'], [390, 844, 47, 34, '12/13/14'],
  [393, 852, 59, 34, '15/16'], [402, 874, 62, 34, '16 Pro/17'], [430, 932, 59, 34, '15 Plus/16 Plus'],
  [440, 956, 62, 34, '16/17 Pro Max'], [320, 568, 20, 0, 'SE 1 (320)'], [744, 1000, 24, 20, 'складной iPhone, внутр.'],
  // Android: 3-кнопочная навигация (низ 48), жесты (0-24), вырезы (верх 24-48)
  [320, 568, 24, 0, 'Android 320x568'], [360, 640, 24, 48, 'Android 360x640 кнопки'], [360, 780, 32, 0, 'Android 360x780 жесты'],
  [384, 854, 40, 24, 'Android 384x854'], [393, 851, 48, 24, 'Pixel 7 393x851'], [412, 915, 48, 24, 'Pixel 8 Pro/S24 412x915'],
  [344, 882, 32, 24, 'Z Fold обложка 344x882'], [673, 841, 32, 24, 'Z Fold внутр. 673x841'], [800, 1280, 24, 48, 'планшет 800x1280'],
  [852, 393, 24, 0, 'телефон альбомно 852x393'],
];
const b = await chromium.launch(); const bad = []; fs.mkdirSync('/home/claude/work/shots/mx', { recursive: true });
for (const [w, h, sat, sab, name] of D) {
  for (const standalone of (name.startsWith('Android') || name.startsWith('Pixel') || name.startsWith('Z Fold') || name.startsWith('планшет') || name.startsWith('телефон') ? [false] : [false, true])) {
    const vh = standalone && sat > 24 ? h - sat : h; // в режиме «Домой» iOS считает страницу короче экрана
    const ctx = await b.newContext({ viewport: { width: w, height: vh }, screen: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: w < 700 && h > w });
    const p = await ctx.newPage();
    await p.addInitScript(({ st, sat, sab }) => {
      if (st) Object.defineProperty(navigator, 'standalone', { get: () => true });
      document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = `:root{--safe-area-inset-top:${sat}px !important;--safe-area-inset-bottom:${sab}px !important}`; document.head.appendChild(s); });
    }, { st: standalone, sat, sab });
    await p.goto('http://127.0.0.1:4173/'); await p.waitForTimeout(500);
    const splashH = await p.evaluate(() => Math.round(document.querySelector('#splash').getBoundingClientRect().height));
    await p.waitForTimeout(3500);
    const res = {};
    for (const [tab, label] of [['home', 'Главная'], ['coffee', 'Заказать кофе'], ['machine', 'Ремонт кофемашины'], ['cart', 'Корзина'], ['profile', 'Профиль']]) {
      await p.evaluate((l) => document.querySelector(`.tabbar button[aria-label="${l}"]`).click(), label); await p.waitForTimeout(350); await p.evaluate(() => { document.scrollingElement.scrollTop = 0; });
      res[tab] = await p.evaluate(() => {
        const g = (s) => document.querySelector(s).getBoundingClientRect();
        const scr = document.querySelector('.screen.active'); 
        const wide = [...scr.querySelectorAll('h1,h2,.hello,.cft,.rt,.ordbtn,.promo,.hero,.box')].filter((e) => !e.closest('.track')).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).length;
        const btn = document.querySelector('#s-coffee .cfbt button'); const heroRt = document.querySelector('#s-machine h1'); return { cfBtnBottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null, appBottom: Math.round(g('.app').bottom), tabBottom: Math.round(g('.tabbar').bottom), tabTop: Math.round(g('.tabbar').top), sysbarH: Math.round(g('.sysbar').height), hOverflow: document.documentElement.scrollWidth > innerWidth + 1, clippedX: wide };
      });
    }
    const exp = { app: h, tabBottom: h - sab - (h <= 700 ? 10 : 14), sys: Math.max(sat, 4) };
    const problems = [];
    if (splashH !== h) problems.push(`заставка ${splashH}≠${h}`);
    for (const [t, r] of Object.entries(res)) {
      if (r.appBottom !== h) problems.push(`${t}: app до ${r.appBottom}≠${h}`);
      if (r.tabBottom !== exp.tabBottom) problems.push(`${t}: панель до ${r.tabBottom}≠${exp.tabBottom}`);
      if (r.sysbarH !== exp.sys) problems.push(`${t}: полоса ${r.sysbarH}≠${exp.sys}`);
      if (t === 'coffee' && h > w && r.cfBtnBottom > r.tabTop + 2) problems.push(`coffee: кнопка «В корзину» под панелью (${r.cfBtnBottom}>${r.tabTop})`);
      if (r.hOverflow) problems.push(`${t}: горизонтальная прокрутка`);
      if (r.clippedX) problems.push(`${t}: ${r.clippedX} блоков выходят за край`);
    }
    console.log((name + (standalone ? ' [Домой]' : ' [Safari]')).padEnd(34), `${w}x${h}`, problems.length ? '❌ ' + problems.join('; ') : '✓');
    if (problems.length) bad.push(name);
    if (true) {
      for (const [tab, label] of [['coffee', 'Заказать кофе'], ['machine', 'Ремонт кофемашины'], ['home', 'Главная']]) { await p.evaluate((l) => document.querySelector(`.tabbar button[aria-label="${l}"]`).click(), label); await p.waitForTimeout(300); await p.screenshot({ path: `/home/claude/work/shots/mx/${w}x${h}-${tab}${standalone ? '-s' : ''}.png` }); }
    }
    await ctx.close();
  }
}
console.log(bad.length ? 'ПРОБЛЕМЫ: ' + [...new Set(bad)].join(', ') : 'ВСЕ УСТРОЙСТВА В ПОРЯДКЕ');
await b.close();
