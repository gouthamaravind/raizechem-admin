import type { CapacitorConfig } from '@capacitor/cli';

const liveReloadUrl = process.env.CAPACITOR_LIVE_RELOAD_URL;

const config: CapacitorConfig = {
  appId: 'com.raizechem.field',
  appName: 'RaizeChem Field',
  webDir: 'dist',
};

if (liveReloadUrl) {
  config.server = {
    url: liveReloadUrl,
    cleartext: liveReloadUrl.startsWith('http://'),
  };
}

export default config;
