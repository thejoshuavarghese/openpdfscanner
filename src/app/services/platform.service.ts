import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class PlatformService {
  readonly isNative = Capacitor.isNativePlatform();
  readonly platform = Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

  /**
   * Returns true when running inside Tauri desktop shell.
   * Tauri exposes window.__TAURI__ at runtime.
   */
  get isTauri(): boolean {
    return !!(window as any).__TAURI__;
  }

  get isWeb(): boolean {
    return !this.isNative && !this.isTauri;
  }

  /**
   * On native (Capacitor), use Camera plugin.
   * On web/desktop, fall back to <input type="file">.
   */
  get supportsNativeCamera(): boolean {
    return this.isNative;
  }
}
