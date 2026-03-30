import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raizechem.field',
  appName: 'RaizeChem Field',
  webDir: 'dist',
  server: {
    url: 'https://3c3f2d47-de20-480f-9a64-bf9a542e34cb.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
