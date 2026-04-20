import { useSyncExternalStore } from 'react';

/**
 * Detects whether the app is running inside an Android app wrapper (any
 * third-party WebView-to-APK service such as GoNative, Appsgeyser, WebIntoApp,
 * MobiLoud, etc., or a TWA / installed PWA on Android).
 *
 * Third-party WebView wrappers don't let us inject a custom User-Agent token,
 * so the primary detection channel is a **URL query parameter** set on the
 * app's start URL:
 *
 *   Configure the third-party platform to load:   https://<site>/?app=android
 *
 * On the first load we persist the flag to localStorage so every subsequent
 * navigation (including deep links) is detected correctly.
 *
 * Fallback channels:
 *   • TWA — document.referrer starts with "android-app://"
 *   • Installed PWA on Android — display-mode: standalone + Android UA
 *   • Legacy WebView — UA contains the "RDSWAApp" token (kept for future
 *     native builds that do control the UA)
 */

const STORAGE_KEY = 'rdswa_platform_android';

function computePlatform(): { isAndroidApp: boolean; isAndroid: boolean; channel: 'url-param' | 'storage' | 'webview' | 'twa' | 'pwa' | 'none' } {
  if (typeof navigator === 'undefined') {
    return { isAndroidApp: false, isAndroid: false, channel: 'none' };
  }
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);

  // ── 1. URL query param (primary — works with any third-party WebView wrapper) ──
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const app = params.get('app');
      if (app === 'android' || app === '1') {
        try { window.localStorage.setItem(STORAGE_KEY, '1'); } catch { /* storage blocked */ }
        return { isAndroidApp: true, isAndroid: true, channel: 'url-param' };
      }

      // ── 2. Persisted flag from a previous URL-param load ──
      try {
        if (window.localStorage.getItem(STORAGE_KEY) === '1') {
          return { isAndroidApp: true, isAndroid: true, channel: 'storage' };
        }
      } catch { /* storage blocked */ }
    } catch { /* malformed URL */ }
  }

  // ── 3. Legacy WebView UA token (for any future native build) ──
  if (/RDSWAApp/i.test(ua)) return { isAndroidApp: true, isAndroid: true, channel: 'webview' };

  // ── 4. TWA (Trusted Web Activity) ──
  if (typeof document !== 'undefined' && document.referrer?.startsWith('android-app://')) {
    return { isAndroidApp: true, isAndroid: true, channel: 'twa' };
  }

  // ── 5. Installed PWA on Android ──
  if (
    isAndroid &&
    typeof window !== 'undefined' &&
    window.matchMedia?.('(display-mode: standalone)').matches
  ) {
    return { isAndroidApp: true, isAndroid: true, channel: 'pwa' };
  }

  return { isAndroidApp: false, isAndroid, channel: 'none' };
}

const snapshot = computePlatform();
const subscribe = () => () => {};
const getSnapshot = () => snapshot;

export function usePlatform() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useIsAndroidApp(): boolean {
  return usePlatform().isAndroidApp;
}
