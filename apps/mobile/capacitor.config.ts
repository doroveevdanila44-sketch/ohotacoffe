import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.kambarshop.app',
  appName: 'Охота кофе',
  webDir: 'dist',
  backgroundColor: '#f3f3f5',
  ios: {
    contentInset: 'never',
    scheme: 'Охота кофе',
    preferredContentMode: 'mobile',
    scrollEnabled: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#7b4fd6',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    Keyboard: {
      resize: 'native' as never,
      resizeOnFullScreen: true,
    },
    FirebaseMessaging: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
