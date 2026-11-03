// Каждый экран прокручивается до низа: последний блок не должен прятаться под нижней панелью.
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const API = process.env.API_URL ?? 'http://localhost:8080';
const j = async (path, init) => (await fetch(API + path, init)).json();
const phone = '+79001112299';
const rc = await j('/v1/auth/request-code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, consent: true }) });
const v = await j('/v1/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: rc.devCode }) });
const session = JSON.stringify({ state: { token: v.token, phone, pushToken: null }, version: 0 });
const devices = [[393, 852, 59, 34, true, 'iPhone 15/16 [Домой]'], [375, 667, 20, 0, false, 'iPhone SE'], [440, 956, 62, 34, true, 'Pro Max [Домой]'], [360, 640, 24, 48, false, 'Android кнопки'], [412, 915, 48, 24, false, 'Android жесты'], [320, 568, 20, 0, false, 'малый 320']];
const b = await chromium.launch(); let bad = 0, total = 0;
for (const [w, h, sat, sab, standalone, name] of devices) {
  const ctx = await b.newContext({ viewport: { width: w, height: standalone ? h - sat : h }, screen: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  await p.addInitScript(({ sat, sab, st, session }) => {
    if (st) Object.defineProperty(navigator, 'standalone', { get: () => true });
    localStorage.setItem('CapacitorStorage.session', session);
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = `:root{--safe-area-inset-top:${sat}px !important;--safe-area-inset-bottom:${sab}px !important}`; document.head.appendChild(s); });
  }, { sat, sab, st: standalone, session });
  await p.goto((process.env.WEB_URL ?? 'http://127.0.0.1:4173') + '/'); await p.waitForTimeout(3800);
  const click = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  const tab = (l) => click(`.tabbar button[aria-label="${l}"]`);
  // наполняем корзину
  await tab('Заказать кофе'); await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { await click('.cfbt button'); await p.waitForTimeout(120); }
  await p.evaluate(() => document.querySelectorAll('.cfc button')[2].click()); await p.waitForTimeout(200); await click('.cfbt button');
  const check = async (label, scrollSel) => {
    await p.waitForTimeout(350);
    const r = await p.evaluate((scrollSel) => {
      const scr = scrollSel ? document.querySelector(scrollSel) : document.querySelector('.screen.active');
      if (!scr) return null;
      scr.scrollTop = scr.scrollHeight;
      const tabTop = document.querySelector('.tabbar').getBoundingClientRect().top;
      let el = scr; while (el.lastElementChild && getComputedStyle(el.lastElementChild).display !== 'none') el = el.lastElementChild;
      // последний содержательный блок: поднимаемся до ближайшего .box/.card/.btn/.bt/.feed .col > *
      const last = el.closest('.box,.bt,.ordbtn,.card,.nt,.cc,.rw,.fv,.empty,.lnk,.btn') || el;
      const bottom = last.getBoundingClientRect().bottom;
      const appH = document.querySelector('.app').getBoundingClientRect().height;
      return { gap: Math.round(tabTop - bottom), scrollable: scr.scrollHeight > scr.clientHeight, below: Math.round(appH - (tabTop + document.querySelector('.tabbar').getBoundingClientRect().height)) };
    }, scrollSel);
    total++;
    if (!r) { console.log(name.padEnd(24), label.padEnd(20), 'нет экрана'); return; }
    const ok = !r.scrollable || r.gap >= 8;
    if (!ok) bad++;
    console.log(name.padEnd(24), label.padEnd(20), ok ? '✓' : '❌', `до панели ${r.gap} пт`, `под панелью ${r.below} пт`);
  };
  await tab('Главная'); await check('Главная');
  await tab('Каталог'); await check('Каталог');
  await tab('Заказать кофе'); await check('Заказать кофе');
  await tab('Ремонт кофемашины'); await check('Ремонт (форма)');
  await tab('Корзина'); await check('Корзина');
  await tab('Профиль'); await check('Профиль');
  // вложенные панели
  await tab('Каталог'); await click('.cc'); await check('Раздел каталога', '.brand.open');
  await tab('Главная'); await click('button[aria-label="Уведомления"]'); await check('Уведомления', '.brand.open');
  await ctx.close();
}
if (bad) process.exitCode = 1;
console.log(`\nпроверено экранов: ${total}, проблем: ${bad}`);
await b.close();
