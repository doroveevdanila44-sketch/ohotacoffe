// Экран «Заказать кофе»: картинка напитка не налезает на заголовок, заголовок в две строки
// для всех разделов и всех размеров.
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const devices = [[393, 852, 59, 34], [375, 667, 20, 0], [440, 956, 62, 34], [320, 568, 20, 0], [360, 640, 24, 48]];
const b = await chromium.launch(); let bad = 0, n = 0;
for (const [w, h, sat, sab] of devices) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })).newPage();
  await p.addInitScript(({ sat, sab }) => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = `:root{--safe-area-inset-top:${sat}px !important;--safe-area-inset-bottom:${sab}px !important} .flt,.cupg{animation:none !important}`; document.head.appendChild(s); }), { sat, sab });
  await p.goto((process.env.WEB_URL ?? 'http://127.0.0.1:4173') + '/'); await p.waitForTimeout(3800);
  await p.evaluate(() => document.querySelector('.tabbar button[aria-label="Заказать кофе"]').click()); await p.waitForTimeout(400);
  const cats = await p.$$eval('.cfc button', (e) => e.length);
  for (let c = 0; c < cats; c++) {
    await p.evaluate((c) => document.querySelectorAll('.cfc button')[c].click(), c); await p.waitForTimeout(250);
    const sizes = await p.$$eval('.cfsz button', (e) => e.length);
    for (let z = 0; z < sizes; z++) {
      await p.evaluate((z) => document.querySelectorAll('.cfsz button')[z].click(), z); await p.waitForTimeout(150);
      const r = await p.evaluate(() => {
        const t = document.querySelector('.cfhero .cft').getBoundingClientRect(); const i = document.querySelector('.cfhero image').getBoundingClientRect(); const hero = document.querySelector('.cfhero').getBoundingClientRect();
        const el = document.querySelector('.cfhero .cft'); const lines = Math.round(el.offsetHeight / (parseFloat(getComputedStyle(el).fontSize) * 1.0));
        return { gap: Math.round((i.top - t.bottom) * 10) / 10, imgBottomInHero: Math.round((hero.bottom - i.bottom) * 10) / 10, lines, word: document.querySelector('.cfhero .cft').textContent };
      });
      n++;
      if (r.gap < -4 || r.imgBottomInHero < 0 || r.lines > 2) { bad++; console.log(`${w}x${h} раздел ${c + 1} размер ${z + 1}: зазор до заголовка ${r.gap}, низ в рамке ${r.imgBottomInHero}, строк ${r.lines} «${r.word}»`); }
    }
  }
  await p.context().close();
}
if (bad) process.exitCode = 1;
console.log(`проверено сочетаний: ${n}, проблем: ${bad}`);
await b.close();
