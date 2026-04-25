import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatTime } from '@/lib/date';
import { queryKeys } from '@/lib/queryKeys';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  UserCheck,
  ScanLine,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';

/**
 * QR-based check-in scanner with proper duplicate prevention and feedback
 * lifecycle. Design notes:
 *
 *  - The rAF loop captures state via *refs*, not React state. Reading state
 *    closures inside the loop would freeze the very first values and never
 *    see updates — a classic pitfall that caused the previous version to
 *    keep firing the same QR over and over.
 *  - Per-QR debounce: the same payload within DEBOUNCE_MS is silently
 *    ignored so a card lingering in front of the camera doesn't spam the
 *    server.
 *  - Result-driven cooldown: after a scan, the loop is *paused* until the
 *    feedback toast clears (~RESULT_MS). The user/operator gets a clear
 *    success / warning / error before the next scan can start.
 *  - Three result kinds — success (new check-in), warning (already
 *    approved), error (network/auth/event mismatch). Each has its own
 *    color, icon, and audio cue.
 */

type ResultKind = 'success' | 'warning' | 'error';

interface ScanResult {
  kind: ResultKind;
  message: string;
  user?: {
    name?: string;
    department?: string;
    batch?: number;
    avatar?: string;
  };
}

// Tunables
const DEBOUNCE_MS = 5000; // suppress the SAME QR re-firing within this window
const RESULT_MS = 2000; // how long the success/warning/error toast stays up
const SCAN_INTERVAL_MS = 250; // throttle BarcodeDetector calls

// Lightweight beep without bundling an audio file. Two tones — pleasant for
// success, lower & shorter for warning/error.
function playBeep(kind: ResultKind) {
  try {
    const Ctx =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = kind === 'success' ? 880 : kind === 'warning' ? 520 : 220;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close();
  } catch {
    // Audio is best-effort — never block scanning if it fails.
  }
}

export default function CheckInScannerPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualId, setManualId] = useState('');
  const [busy, setBusy] = useState(false);

  // Refs that the rAF loop reads. State-via-ref avoids stale-closure bugs
  // since the rAF callback is captured once at effect setup.
  const pausedRef = useRef(false);
  const lastQrRef = useRef<{ data: string; at: number } | null>(null);
  const detectorRef = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScanAtRef = useRef(0);

  const { data } = useQuery({
    queryKey: queryKeys.events.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/events/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const event = data?.data;

  const showResult = useCallback((next: ScanResult) => {
    setResult(next);
    playBeep(next.kind);
    // Auto-clear and (if scanner is active) resume the scan loop.
    window.setTimeout(() => {
      setResult(null);
      pausedRef.current = false;
    }, RESULT_MS);
  }, []);

  const checkin = useCallback(
    async (userId: string, method: 'qr' | 'manual') => {
      if (busy) return;
      setBusy(true);
      pausedRef.current = true;
      try {
        const { data } = await api.post(`/events/${id}/checkin`, { userId, method });
        const payload = data?.data || {};
        const u = payload.record?.user;
        const userInfo = u
          ? {
              name: u.name,
              department: u.department,
              batch: u.batch,
              avatar: u.avatar,
            }
          : undefined;
        if (payload.status === 'duplicate') {
          showResult({
            kind: 'warning',
            message: u?.name ? `${u.name} is already checked in` : 'Already checked in',
            user: userInfo,
          });
        } else {
          showResult({
            kind: 'success',
            message: u?.name ? `${u.name} — checked in` : 'Checked in successfully',
            user: userInfo,
          });
        }
        queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(id!) });
      } catch (err: any) {
        const status = err?.response?.status;
        const serverMsg = err?.response?.data?.message;
        let message = serverMsg || 'Check-in failed';
        if (status === 404) message = serverMsg || 'User or event not found';
        else if (status === 403) message = serverMsg || 'You are not allowed to check in users';
        showResult({ kind: 'error', message });
      } finally {
        setBusy(false);
      }
    },
    [busy, id, queryClient, showResult]
  );

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      streamRef.current = mediaStream;
      pausedRef.current = false;
      lastQrRef.current = null;
      setScanning(true);
    } catch {
      showResult({ kind: 'error', message: 'Camera access denied or unavailable' });
    }
  }, [showResult]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (animFrameRef.current != null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    pausedRef.current = false;
    lastQrRef.current = null;
    setScanning(false);
  }, []);

  // QR detection loop using the BarcodeDetector API (Chrome/Edge/Safari 17+).
  useEffect(() => {
    if (!scanning) return;
    if (!videoRef.current || !canvasRef.current) return;

    const hasBarcodeDetector = 'BarcodeDetector' in window;
    if (!hasBarcodeDetector) {
      showResult({
        kind: 'error',
        message: 'QR scanning is not supported in this browser. Use manual check-in.',
      });
      return;
    }

    if (!detectorRef.current) {
      detectorRef.current = new (window as any).BarcodeDetector({
        formats: ['qr_code'],
      });
    }
    const detector = detectorRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const tick = async () => {
      animFrameRef.current = requestAnimationFrame(tick);

      const video = videoRef.current;
      if (
        !video ||
        !ctx ||
        video.readyState !== 4 ||
        pausedRef.current ||
        Date.now() - lastScanAtRef.current < SCAN_INTERVAL_MS
      ) {
        return;
      }
      lastScanAtRef.current = Date.now();

      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const codes = await detector.detect(canvas);
        if (codes.length === 0) return;

        const raw: string = codes[0].rawValue;

        // Per-QR debounce: same payload within DEBOUNCE_MS is silently
        // ignored. Avoids spamming the server when a card lingers in
        // front of the lens.
        const last = lastQrRef.current;
        if (last && last.data === raw && Date.now() - last.at < DEBOUNCE_MS) {
          return;
        }

        // Format: RDSWA:CHECKIN:{eventId}:{userId}
        const parts = raw.split(':');
        if (parts.length !== 4 || parts[0] !== 'RDSWA' || parts[1] !== 'CHECKIN') {
          lastQrRef.current = { data: raw, at: Date.now() };
          pausedRef.current = true;
          showResult({ kind: 'error', message: 'Unrecognized QR code format' });
          return;
        }
        const qrEventId = parts[2];
        const userId = parts[3];

        if (qrEventId !== id) {
          lastQrRef.current = { data: raw, at: Date.now() };
          pausedRef.current = true;
          showResult({ kind: 'error', message: 'This QR is for a different event' });
          return;
        }

        lastQrRef.current = { data: raw, at: Date.now() };
        // Pause is set inside checkin() too, but set here as well so that
        // the very next animation frame doesn't see a stale `paused=false`.
        pausedRef.current = true;
        await checkin(userId, 'qr');
      } catch {
        // Detector glitches happen on low-light frames — keep looping.
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current != null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [scanning, id, checkin, showResult]);

  // Cleanup any lingering camera stream on unmount.
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const onManualSubmit = () => {
    const trimmed = manualId.trim();
    if (!trimmed) return;
    checkin(trimmed, 'manual');
    setManualId('');
  };

  const overlayClass: Record<ResultKind, string> = {
    success: 'bg-green-600/85 text-white',
    warning: 'bg-amber-500/90 text-white',
    error: 'bg-red-600/85 text-white',
  };

  const iconFor = (k: ResultKind) =>
    k === 'success' ? CheckCircle2 : k === 'warning' ? AlertTriangle : XCircle;

  return (
    <div className="container mx-auto py-8">
      <FadeIn direction="up">
        <Link
          to={`/events/${id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Event
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Check-In Scanner</h1>
        {event && <p className="text-muted-foreground mb-6">{event.title}</p>}
      </FadeIn>

      {/* Inline result toast (mirrors the camera overlay for non-scanning flows like manual entry). */}
      <AnimatePresence>
        {result && !scanning && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            className={`mb-4 p-3 rounded-md text-sm flex items-center gap-2 ${
              result.kind === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : result.kind === 'warning'
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}
          >
            {(() => {
              const Icon = iconFor(result.kind);
              return <Icon className="h-4 w-4 shrink-0" />;
            })()}
            <span>{result.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera Scanner */}
      <FadeIn delay={0.1} direction="up">
        <div className="border rounded-xl overflow-hidden bg-card mb-6">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-sm">QR Scanner</h3>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={scanning ? stopCamera : startCamera}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs ${
                scanning
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              {scanning ? (
                <>
                  <CameraOff className="h-3.5 w-3.5" /> Stop
                </>
              ) : (
                <>
                  <Camera className="h-3.5 w-3.5" /> Start Scanning
                </>
              )}
            </motion.button>
          </div>

          <div className="relative aspect-video bg-black overflow-hidden">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${scanning ? '' : 'hidden'}`}
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Center scan reticle */}
            {scanning && !result && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-2xl border-2 border-white/40">
                  <motion.div
                    initial={{ y: -2 }}
                    animate={{ y: '100%' }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', repeatType: 'reverse' }}
                    className="absolute left-2 right-2 top-0 h-0.5 bg-primary/80 shadow-[0_0_8px_rgba(0,0,0,0.4)]"
                  />
                </div>
              </motion.div>
            )}

            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 text-center px-4">
                <ScanLine className="h-12 w-12 mb-2" />
                <p className="text-sm">Click "Start Scanning" to activate the camera</p>
                {!('BarcodeDetector' in window) && (
                  <p className="text-xs mt-2 text-yellow-300">
                    Note: live QR scanning requires Chrome/Edge or Safari 17+. Use manual check-in as fallback.
                  </p>
                )}
              </div>
            )}

            {/* Camera overlay during scanning — busy indicator + result. */}
            {scanning && busy && !result && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-white" />
              </div>
            )}

            <AnimatePresence>
              {scanning && result && (
                <motion.div
                  key="overlay"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className={`absolute inset-0 flex flex-col items-center justify-center text-center px-6 ${overlayClass[result.kind]}`}
                >
                  {(() => {
                    const Icon = iconFor(result.kind);
                    return (
                      <motion.div
                        initial={{ scale: 0.5, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                      >
                        <Icon className="h-16 w-16 mb-3" />
                      </motion.div>
                    );
                  })()}
                  <p className="text-lg font-semibold leading-tight">{result.message}</p>
                  {result.user && (result.user.department || result.user.batch) && (
                    <p className="text-sm opacity-90 mt-1">
                      {[result.user.department, result.user.batch ? `Batch ${result.user.batch}` : null]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </FadeIn>

      {/* Manual Check-in */}
      <FadeIn delay={0.2} direction="up">
        <div className="border rounded-xl p-4 bg-card">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" /> Manual Check-in
          </h3>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              placeholder="Enter User ID"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onManualSubmit();
              }}
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onManualSubmit}
              disabled={!manualId.trim() || busy}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              Check In
            </motion.button>
          </div>
        </div>
      </FadeIn>

      {/* Recent attendance */}
      {event?.attendance && event.attendance.length > 0 && (
        <FadeIn delay={0.3} direction="up">
          <div className="mt-6">
            <h3 className="font-semibold text-sm mb-3">
              Recent Check-ins ({event.attendance.length})
            </h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {event.attendance
                .slice()
                .reverse()
                .slice(0, 20)
                .map((a: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {a.status === 'pending' ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      )}
                      <span>{a.user?.name || a.user || 'User'}</span>
                      {a.status === 'pending' && (
                        <span className="text-[10px] text-amber-600 ml-1">(pending)</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {a.checkedInVia} • {formatTime(a.checkedInAt)}
                    </span>
                  </motion.div>
                ))}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
