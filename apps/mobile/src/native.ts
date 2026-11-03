import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Keyboard } from '@capacitor/keyboard';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { api } from './lib/api';
import { isNative, platform } from './lib/native';
import { invalidateUser, queryClient } from './lib/queries';
import { useSession } from './store/session';
import { useUi } from './store/ui';

/** Ссылки вида kambarshop://order/<id> и https://…/pay/return?order=<id> */
function handleUrl(url: string) {
  const m = url.match(/order[/=]([0-9a-f-]{36})/i);
  if (m) {
    void Browser.close().catch(() => undefined);
    const ui = useUi.getState();
    ui.setFocusOrder(m[1]!);
    if (ui.tab !== 'cart') ui.setTab('profile');
    void queryClient.invalidateQueries({ queryKey: ['/v1/orders'] });
  }
}

function openFromPush(data: Record<string, unknown> | undefined) {
  const ui = useUi.getState();
  if (data?.kind === 'repair') ui.setTab('machine');
  else if (data?.kind === 'order') ui.setTab('profile');
  else ui.open({ type: 'notifications' });
  invalidateUser();
}

export async function initNative() {
  if (!isNative) return;
  void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);

  void CapApp.addListener('appUrlOpen', (e) => handleUrl(e.url));
  void CapApp.addListener('backButton', ({ canGoBack }) => {
    const ui = useUi.getState();
    if (ui.overlays.length) return ui.close();
    if (ui.tab !== 'home') return ui.setTab('home');
    if (!canGoBack) void CapApp.minimizeApp();
  });
  void CapApp.addListener('resume', () => {
    if (useSession.getState().token) invalidateUser();
  });

  void Keyboard.addListener('keyboardWillShow', () => document.body.classList.add('kb'));
  void Keyboard.addListener('keyboardWillHide', () => document.body.classList.remove('kb'));

  void FirebaseMessaging.addListener('notificationActionPerformed', (e) => openFromPush(e.notification.data as Record<string, unknown>));
  void FirebaseMessaging.addListener('notificationReceived', () => {
    invalidateUser();
  });
  void FirebaseMessaging.addListener('tokenReceived', (e) => void sendToken(e.token));

  const launch = await CapApp.getLaunchUrl().catch(() => undefined);
  if (launch?.url) handleUrl(launch.url);

  if (useSession.getState().token) void registerPush();
}

export function hideSplash() {
  if (isNative) void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined);
}

async function sendToken(token: string) {
  if (!useSession.getState().token) return;
  useSession.getState().setPushToken(token);
  await api('/v1/me/devices', { method: 'POST', body: { token, platform } }).catch(() => undefined);
}

/** Запрашивает разрешение на уведомления и отправляет токен FCM на сервер. */
export async function registerPush() {
  if (!isNative) return;
  try {
    let perm = await FirebaseMessaging.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await FirebaseMessaging.requestPermissions();
    if (perm.receive !== 'granted') return;
    const { token } = await FirebaseMessaging.getToken();
    if (token) await sendToken(token);
  } catch {
    /* без Firebase-конфига (GoogleService-Info.plist / google-services.json) push недоступен */
  }
}

export async function unregisterPush() {
  const t = useSession.getState().pushToken;
  if (t) await api('/v1/me/devices', { method: 'DELETE', body: { token: t } }).catch(() => undefined);
  useSession.getState().setPushToken(null);
}
