import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { hydrateCache, queryClient } from './lib/queries';
import { initViewportHeight } from './lib/viewport';
import { preloadCups } from './lib/preload';
import { initNoBounce } from './lib/noBounce';
import { initNative } from './native';
import { useCart } from './store/cart';
import { useSession } from './store/session';
import { DEMO, demoLogin } from './lib/api';
import './styles.css';

async function boot() {
  initViewportHeight();
  preloadCups();
  initNoBounce();
  // Сначала поднимаем сохранённые данные: сессию, корзину и последний каталог.
  await Promise.all([useSession.persist.rehydrate(), useCart.persist.rehydrate(), hydrateCache()]);
  await initNative();
  if (DEMO && !useSession.getState().token) await demoLogin().catch(() => undefined);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  );
}

void boot();
