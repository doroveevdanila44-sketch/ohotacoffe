import { useEffect } from 'react';
import { IconSprite } from './components/Icons';
import { OfflineBadge, Splash, SystemBar, TabBar } from './components/Chrome';
import { Toast } from './components/common';
import { useCatalog, useMenu, useSettings } from './lib/queries';
import { hideSplash } from './native';
import { Cart } from './screens/Cart';
import { Catalog, CategoryPanel, ProductPanel } from './screens/Catalog';
import { Coffee } from './screens/Coffee';
import { Home } from './screens/Home';
import { LoginPanel } from './screens/Login';
import { NotificationsPanel } from './screens/Notifications';
import { EditProfileSheet, Profile } from './screens/Profile';
import { RepairScreen } from './screens/Repair';
import { useUi } from './store/ui';

export function App() {
  const tab = useUi((s) => s.tab);
  const overlays = useUi((s) => s.overlays);
  const catalog = useCatalog();
  useMenu();
  useSettings();
  const ready = !!catalog.data || catalog.isError;

  const find = <T extends (typeof overlays)[number]['type']>(t: T) => overlays.find((o) => o.type === t) as Extract<(typeof overlays)[number], { type: T }> | undefined;
  const category = find('category');
  const product = find('product');
  const login = find('login');

  useEffect(() => {
    // Нативная заставка уступает место анимированной сразу после первой отрисовки.
    requestAnimationFrame(() => hideSplash());
  }, []);

  return (
    <div className="app" id="app">
      <IconSprite />
      <Home active={tab === 'home'} />
      <Catalog active={tab === 'catalog'} />
      <Coffee active={tab === 'coffee'} />
      <RepairScreen active={tab === 'machine'} />
      <Cart active={tab === 'cart'} />
      <Profile active={tab === 'profile'} />

      <CategoryPanel id={category?.id ?? null} />
      <ProductPanel id={product?.id ?? null} />
      <NotificationsPanel open={!!find('notifications')} />
      <LoginPanel open={!!login} reason={login?.reason} />
      <EditProfileSheet open={!!find('editProfile')} />

      <SystemBar />
      <TabBar />
      <Toast />
      <OfflineBadge />
      <Splash ready={ready} onDone={() => undefined} />
    </div>
  );
}
