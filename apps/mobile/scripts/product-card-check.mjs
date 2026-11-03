// Карточка товара есть у каждого товара: открывается по нажатию на карточку в ленте,
// у товаров с вкусами описание идёт после вкусов, у остальных есть кнопка «В корзину».
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
const WEB = (process.env.WEB_URL ?? 'http://127.0.0.1:4173') + '/';
const API = process.env.API_URL ?? 'http://localhost:8080';
const catalog = await (await fetch(API + '/v1/catalog')).json();
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true })).newPage();
await p.goto(WEB); await p.waitForTimeout(3800);
let bad = 0;
for (const prod of catalog.products) {
  await p.evaluate(() => document.querySelector('.tabbar button[aria-label="Главная"]').click());
  await p.fill('.search input', prod.title); await p.waitForTimeout(250);
  // нажимаем на саму карточку (не на кнопки)
  const opened = await p.evaluate((t) => { const c = [...document.querySelectorAll('#s-home .card')].find((x) => x.querySelector('.name')?.textContent === t); if (!c) return false; c.querySelector('.name').click(); return true; }, prod.title);
  await p.waitForTimeout(350);
  const r = await p.evaluate(() => {
    const panel = document.querySelector('.brand.open'); if (!panel) return null;
    const boxes = [...panel.querySelectorAll('.box')];
    const variantsBox = boxes.find((b) => b.querySelector('.fl .step'));
    const about = boxes.find((b) => b.querySelector('h3')?.textContent === 'О товаре');
    const addBtn = panel.querySelector('.fl .step .p');
    return { hasAbout: !!about, aboutText: about?.querySelector('p')?.textContent?.length ?? 0, canAdd: !!addBtn, order: variantsBox && about ? (variantsBox.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING ? 'вкусы, затем описание' : 'описание раньше вкусов') : 'без вкусов' };
  });
  const problems = [];
  if (!opened || !r) problems.push('карточка не открылась');
  else {
    if (!r.hasAbout || r.aboutText < 20) problems.push('нет описания');
    if (!r.canAdd) problems.push('нельзя добавить в корзину');
    if (prod.hasVariants && r.order !== 'вкусы, затем описание') problems.push('описание не после вкусов');
  }
  if (problems.length) { bad++; console.log('❌', prod.title, problems.join('; ')); }
  await p.evaluate(() => document.querySelector('.brand.open .round')?.click()); await p.waitForTimeout(150);
}
console.log(`товаров проверено: ${catalog.products.length}, проблем: ${bad}`);
if (bad) process.exitCode = 1;
await b.close();
