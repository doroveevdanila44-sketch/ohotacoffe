/**
 * Верх приложения не должен «пружинить» и сдвигать экран при протяжке вниз.
 * CSS (overscroll-behavior: none) закрывает современные iOS и Android, этот перехват страхует остальные случаи:
 * тянем вниз на самом верху или вверх в самом низу прокручиваемого блока, и сдвиг гасится.
 */
function scrollableAncestor(el: Element | null): HTMLElement | null {
  while (el && el !== document.body) {
    const h = el as HTMLElement;
    const oy = getComputedStyle(h).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && h.scrollHeight > h.clientHeight + 1) return h;
    el = el.parentElement;
  }
  return null;
}

export function initNoBounce() {
  let y0 = 0;
  let x0 = 0;
  document.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      y0 = t.clientY;
      x0 = t.clientX;
    },
    { passive: true },
  );
  document.addEventListener(
    'touchmove',
    (e) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) return;
      const dy = t.clientY - y0;
      const dx = t.clientX - x0;
      if (Math.abs(dx) > Math.abs(dy)) return; // горизонтальные ленты не трогаем
      const target = e.target as Element | null;
      if (target?.closest('input, textarea, select')) return;
      const sc = scrollableAncestor(target);
      if (!sc) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      const atTop = sc.scrollTop <= 0;
      const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
      if ((atTop && dy > 0) || (atBottom && dy < 0)) {
        if (e.cancelable) e.preventDefault();
      }
    },
    { passive: false },
  );
}
