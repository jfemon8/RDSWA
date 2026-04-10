import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';

/**
 * Convert a URL-safe base64 VAPID key into the Uint8Array PushManager expects.
 * Browsers reject keys with the "-" and "_" characters the server returns.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  // Explicitly back the view with a fresh ArrayBuffer so TS accepts it as
  // BufferSource for PushManager.subscribe (which rejects SharedArrayBuffer).
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export interface WebPushState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  busy: boolean;
  error: string | null;
}

/**
 * Manages the browser's Push subscription state and keeps it in sync with the
 * backend. Callers get a subscribe/unsubscribe pair and a state object that
 * reflects whether the active service worker has a live PushSubscription.
 */
export function useWebPush() {
  const supported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  const [state, setState] = useState<WebPushState>({
    supported,
    permission: supported ? Notification.permission : 'unsupported',
    subscribed: false,
    busy: false,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState((s) => ({
        ...s,
        permission: Notification.permission,
        subscribed: !!sub,
      }));
    } catch (err) {
      setState((s) => ({ ...s, error: (err as Error).message }));
    }
  }, [supported]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!supported) return false;
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      // Ensure browser permission first.
      if (Notification.permission === 'default') {
        const perm = await Notification.requestPermission();
        setState((s) => ({ ...s, permission: perm }));
        if (perm !== 'granted') {
          setState((s) => ({ ...s, busy: false, error: 'Permission denied' }));
          return false;
        }
      } else if (Notification.permission === 'denied') {
        setState((s) => ({ ...s, busy: false, error: 'Notifications blocked in browser settings' }));
        return false;
      }

      // Fetch the server's public VAPID key.
      const { data } = await api.get('/notifications/push/vapid-key');
      const publicKey: string | null = data?.data?.publicKey || null;
      if (!publicKey) {
        setState((s) => ({ ...s, busy: false, error: 'Push notifications not configured on server' }));
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      // If we already have a subscription that matches the current key, reuse it.
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error('Subscription returned incomplete data');
      }
      await api.post('/notifications/push/subscribe', {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });

      setState((s) => ({ ...s, busy: false, subscribed: true, permission: Notification.permission }));
      return true;
    } catch (err: any) {
      setState((s) => ({ ...s, busy: false, error: err?.message || 'Failed to subscribe' }));
      return false;
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return false;
    setState((s) => ({ ...s, busy: true, error: null }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const { endpoint } = sub;
        await sub.unsubscribe();
        // Best-effort: tell the backend to drop the stored subscription.
        try {
          await api.delete('/notifications/push/unsubscribe', { data: { endpoint } });
        } catch {
          /* ignore — browser unsubscribe is what matters */
        }
      }
      setState((s) => ({ ...s, busy: false, subscribed: false }));
      return true;
    } catch (err: any) {
      setState((s) => ({ ...s, busy: false, error: err?.message || 'Failed to unsubscribe' }));
      return false;
    }
  }, [supported]);

  return { ...state, subscribe, unsubscribe, refresh };
}
