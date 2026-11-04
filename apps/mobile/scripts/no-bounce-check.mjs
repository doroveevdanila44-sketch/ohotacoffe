// Проверка: верх приложения не пружинит при протяжке вниз, обычная прокрутка не ломается.
import {chromium,devices} from 'playwright';
const b=await chromium.launch();const ctx=await b.newContext({...devices['iPhone 14'],hasTouch:true});const p=await ctx.newPage();
await p.goto((process.env.WEB_URL ?? 'http://127.0.0.1:4173') + '/');await p.waitForTimeout(4500);
const r=await p.evaluate(()=>new Promise(res=>{
  const sc=document.querySelector('.screen.active');const el=sc.querySelector('article')||sc;
  const mk=(type,y)=>new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[new Touch({identifier:1,target:el,clientX:200,clientY:y})]});
  const out={};
  // протяжка вверх (обычный скролл вниз) в середине: не должна блокироваться
  sc.scrollTop=300;
  el.dispatchEvent(mk('touchstart',500));let e1=mk('touchmove',400);el.dispatchEvent(e1);out.midScrollBlocked=e1.defaultPrevented;
  // вверху тянем вниз: блок
  sc.scrollTop=0;el.dispatchEvent(mk('touchstart',200));let e2=mk('touchmove',320);el.dispatchEvent(e2);out.topPullBlocked=e2.defaultPrevented;
  // вверху тянем вверх (скролл вниз): не блок
  el.dispatchEvent(mk('touchstart',500));let e3=mk('touchmove',400);el.dispatchEvent(e3);out.topScrollDownBlocked=e3.defaultPrevented;
  res(out);
}));
await b.close();
console.log('=== no-bounce-check ===');
const bad = r.midScrollBlocked || !r.topPullBlocked || r.topScrollDownBlocked;
console.log(bad ? 'ПРОБЛЕМА: верх «пружинит» или скролл заблокирован ' + JSON.stringify(r) : 'протяжка вниз на верху гасится, обычный скролл работает, проблем: 0');
process.exit(bad ? 1 : 0);
