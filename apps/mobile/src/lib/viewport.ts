/**
 * Высота приложения. В режиме «На экране Домой» iOS 26 может занижать CSS-высоту страницы
 * (100%, 100dvh, fixed) на высоту выреза: снизу остаётся пустая полоса, а нижняя панель и заставка
 * не доходят до низа. Поэтому там высота берётся как максимум из всех источников: innerHeight,
 * visualViewport и реального размера экрана. В обычном браузере и в приложении из магазина
 * ничего не меняется (там работает 100dvh).
 */
export function initViewportHeight() {
  const root = document.documentElement;
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if (!standalone) return;
  const apply = () => {
    const portrait = window.innerHeight >= window.innerWidth;
    if (!portrait) return root.style.removeProperty('--app-h');
    const full = Math.max(window.innerHeight, window.visualViewport?.height ?? 0, window.screen.height, window.screen.width);
    root.style.setProperty('--app-h', `${full}px`);
  };
  apply();
  window.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 250));
  // iOS иногда отдаёт правильные размеры не сразу после запуска.
  setTimeout(apply, 300);
  setTimeout(apply, 1200);
}
