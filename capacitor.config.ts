import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thecong.face',
  appName: 'face',
  webDir: 'out',
  server: {
    url: 'http://172.16.15.175:3001', // ✅ IP thật của máy bạn
    cleartext: true,
  },
};

export default config;
