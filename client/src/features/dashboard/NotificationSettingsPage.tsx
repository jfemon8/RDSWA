import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Loader2, Bell, Mail, Smartphone, BellOff, Clock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { useState, useEffect } from 'react';
import { useWebPush } from '@/hooks/useWebPush';
import { useToast } from '@/components/ui/Toast';

interface NotifPrefs {
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
  digestFrequency: 'none' | 'daily' | 'weekly';
  dnd: boolean;
}

const defaultPrefs: NotifPrefs = {
  email: true,
  sms: false,
  push: true,
  inApp: true,
  digestFrequency: 'daily',
  dnd: false,
};

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotifPrefs>(defaultPrefs);
  const webPush = useWebPush();
  const pushSupported = webPush.supported;

  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/preferences');
      return data.data as NotifPrefs;
    },
  });

  useEffect(() => {
    if (data) setPrefs(data);
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<NotifPrefs>) => api.patch('/notifications/preferences', updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  const toggleField = (field: keyof NotifPrefs) => {
    const newVal = !prefs[field];
    setPrefs((p) => ({ ...p, [field]: newVal }));
    updateMutation.mutate({ [field]: newVal });
  };

  /** Toggles the actual browser push subscription in addition to the server preference. */
  const togglePush = async () => {
    const turningOn = !prefs.push;
    if (turningOn) {
      const ok = await webPush.subscribe();
      if (!ok) {
        toast.error(webPush.error || 'Could not enable push notifications');
        return;
      }
      toast.success('Push notifications enabled');
    } else {
      await webPush.unsubscribe();
      toast.success('Push notifications disabled');
    }
    setPrefs((p) => ({ ...p, push: turningOn }));
    updateMutation.mutate({ push: turningOn });
  };

  const setDigest = (freq: NotifPrefs['digestFrequency']) => {
    setPrefs((p) => ({ ...p, digestFrequency: freq }));
    updateMutation.mutate({ digestFrequency: freq });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <BlurText text="Notification Settings" className="text-2xl sm:text-3xl font-bold" delay={50} />
      </div>

      <div className="space-y-4">
        {/* Channels */}
        <FadeIn delay={0} direction="up" distance={20}>
          <div className="bg-card border rounded-lg p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notification Channels
            </h2>
            <div className="space-y-3">
              <ToggleRow
                icon={<Bell className="h-4 w-4" />}
                label="In-App Notifications"
                description="Show notifications inside the app"
                checked={prefs.inApp}
                onChange={() => toggleField('inApp')}
              />
              <ToggleRow
                icon={<Mail className="h-4 w-4" />}
                label="Email Notifications"
                description="Receive notification emails"
                checked={prefs.email}
                onChange={() => toggleField('email')}
              />
              {pushSupported ? (
                <>
                  <ToggleRow
                    icon={<Smartphone className="h-4 w-4" />}
                    label="Push Notifications"
                    description={
                      webPush.subscribed
                        ? 'This device is subscribed to web push'
                        : webPush.permission === 'denied'
                          ? 'Blocked by browser — re-enable in site settings'
                          : 'Receive push notifications in this browser'
                    }
                    checked={prefs.push && webPush.subscribed}
                    onChange={togglePush}
                    disabled={webPush.busy}
                  />
                  {webPush.error && (
                    <div className="flex items-start gap-2 text-[11px] text-amber-600 dark:text-amber-400 ml-7">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{webPush.error}</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground ml-7">
                  This browser does not support push notifications.
                </p>
              )}
            </div>
          </div>
        </FadeIn>

        {/* Email Digest */}
        <FadeIn delay={0.05} direction="up" distance={20}>
          <div className="bg-card border rounded-lg p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4" /> Email Digest
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Receive a summary of notifications instead of individual emails
            </p>
            <div className="flex gap-2">
              {(['none', 'daily', 'weekly'] as const).map((freq) => (
                <button
                  key={freq}
                  onClick={() => setDigest(freq)}
                  className={`px-4 py-2 rounded-md text-sm capitalize transition-colors ${
                    prefs.digestFrequency === freq
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>
        </FadeIn>

        {/* DND */}
        <FadeIn delay={0.1} direction="up" distance={20}>
          <div className="bg-card border rounded-lg p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <BellOff className="h-4 w-4" /> Do Not Disturb
            </h2>
            <ToggleRow
              icon={<BellOff className="h-4 w-4" />}
              label="Enable DND"
              description="Pause all notifications except critical system alerts"
              checked={prefs.dnd}
              onChange={() => toggleField('dnd')}
            />
            <AnimatePresence>
              {prefs.dnd && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs text-amber-600 dark:text-amber-400 mt-2"
                >
                  DND is active — you won't receive any notifications.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </FadeIn>

        {/* Save status */}
        <AnimatePresence>
          {updateMutation.isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm text-muted-foreground flex items-center gap-2"
            >
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{icon}</span>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}
