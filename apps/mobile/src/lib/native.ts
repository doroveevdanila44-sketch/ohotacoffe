import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Browser } from '@capacitor/browser';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

export const tap = () => {
  if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
};

export const openUrl = (url: string) => {
  if (url.startsWith('tel:') || url.startsWith('mailto:')) {
    window.location.href = url;
    return;
  }
  void Browser.open({ url, presentationStyle: 'popover', toolbarColor: '#7a2cf5' });
};

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
