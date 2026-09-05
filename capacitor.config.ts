import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.openscanner.app',
  appName: 'Open PDF Scanner',
  webDir: 'dist/open-pdf-scanner/browser',
  plugins: {
    Camera: {
      // iOS: add NSCameraUsageDescription + NSPhotoLibraryUsageDescription in Info.plist
    },
  },
};

export default config;
