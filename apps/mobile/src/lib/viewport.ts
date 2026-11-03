/**
 * Высота приложения. В режиме «На экране Домой» iOS иногда считает страницу короче экрана
 * (на высоту выреза), и снизу остаётся пустая полоса. Там берём реальную высоту экрана.
 */
export function initViewportHeight() {
  const root = document.documentElement;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const apply = () => {
    const portrait = window.innerHeight > window.innerWidth;
    const full = Math.max(window.screen.height, window.screen.width);
    if (standalone && portrait && window.innerHeight < full) root.style.setProperty('--app-h', `${full}px`);
    else root.style.removeProperty('--app-h');
  };
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 200));
}
