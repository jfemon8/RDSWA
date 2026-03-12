import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatTime } from '@/lib/date';
import { queryKeys } from '@/lib/queryKeys';
import { Camera, CameraOff, CheckCircle2, XCircle, Loader2, ArrowLeft, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn } from '@/components/reactbits';

export default function CheckInScannerPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [manualId, setManualId] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const { data } = useQuery({
    queryKey: queryKeys.events.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/events/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const event = data?.data;

  const checkinMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/events/${id}/checkin`, { userId, method: scanning ? 'qr' : 'manual' }),
    onSuccess: (_data, userId) => {
      setResult({ success: true, message: `User ${userId} checked in successfully!` });
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(id!) });
      setTimeout(() => setResult(null), 3000);
    },
    onError: (err: any) => {
      setResult({ success: false, message: err.response?.data?.message || 'Check-in failed' });
      setTimeout(() => setResult(null), 3000);
    },
  });

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setStream(mediaStream);
      setScanning(true);
    } catch {
      setResult({ success: false, message: 'Camera access denied or not available' });
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setScanning(false);
  }, [stream]);

  // QR scanning loop using BarcodeDetector API (available in modern browsers)
  useEffect(() => {
    if (!scanning || !videoRef.current || !canvasRef.current) return;

    let animFrame: number;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Check if BarcodeDetector is available
    const hasBarcodeDetector = 'BarcodeDetector' in window;
    let detector: any = null;
    if (hasBarcodeDetector) {
      detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
    }

    const scan = async () => {
      if (!videoRef.current || !ctx || videoRef.current.readyState !== 4) {
        animFrame = requestAnimationFrame(scan);
        return;
      }

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      if (detector) {
        try {
          const barcodes = await detector.detect(canvas);
          if (barcodes.length > 0) {
            const qrData = barcodes[0].rawValue;
            // Extract userId from QR data (URL format: .../checkin?userId=xxx)
            const url = new URL(qrData);
            const userId = url.searchParams.get('userId');
            if (userId && !checkinMutation.isPending) {
              checkinMutation.mutate(userId);
              // Pause scanning briefly
              setTimeout(() => {
                animFrame = requestAnimationFrame(scan);
              }, 3000);
              return;
            }
          }
        } catch {
          // BarcodeDetector error, continue scanning
        }
      }

      animFrame = requestAnimationFrame(scan);
    };

    animFrame = requestAnimationFrame(scan);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [scanning, checkinMutation]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  return (
    <div className="mx-auto py-8 px-4 sm:px-6">
      <FadeIn direction="up">
        <Link to={`/events/${id}`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Event
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Check-In Scanner</h1>
        {event && <p className="text-muted-foreground mb-6">{event.title}</p>}
      </FadeIn>

      {/* Result notification */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            className={`mb-4 p-3 rounded-md text-sm flex items-center gap-2 ${
              result.success
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
            }`}
          >
            {result.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {result.message}
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
            <button
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
            </button>
          </div>

          <div className="relative aspect-video bg-black">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${scanning ? '' : 'hidden'}`}
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
                <Camera className="h-12 w-12 mb-2" />
                <p className="text-sm">Click "Start Scanning" to activate camera</p>
                {!('BarcodeDetector' in window) && (
                  <p className="text-xs mt-2 text-yellow-400">Note: QR scanning requires a supported browser. Use manual check-in as fallback.</p>
                )}
              </div>
            )}

            {scanning && checkinMutation.isPending && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
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
                if (e.key === 'Enter' && manualId) checkinMutation.mutate(manualId);
              }}
            />
            <button
              onClick={() => {
                if (manualId) {
                  checkinMutation.mutate(manualId);
                  setManualId('');
                }
              }}
              disabled={!manualId || checkinMutation.isPending}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {checkinMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
              Check In
            </button>
          </div>
        </div>
      </FadeIn>

      {/* Recent attendance */}
      {event?.attendance && event.attendance.length > 0 && (
        <FadeIn delay={0.3} direction="up">
          <div className="mt-6">
            <h3 className="font-semibold text-sm mb-3">Recent Check-ins ({event.attendance.length})</h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {event.attendance.slice().reverse().slice(0, 20).map((a: any, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span>{a.user?.name || a.user || 'User'}</span>
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
