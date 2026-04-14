import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface UserEventQrProps {
  eventId: string;
  userId: string;
  size?: number;
  className?: string;
}

/**
 * Generates a per-user QR code for event check-in.
 * Encodes: `RDSWA:CHECKIN:{eventId}:{userId}` — domain-independent.
 */
export default function UserEventQr({ eventId, userId, size = 200, className = '' }: UserEventQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const payload = `RDSWA:CHECKIN:${eventId}:${userId}`;
    QRCode.toDataURL(payload, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [eventId, userId, size]);

  if (!dataUrl) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.img
      src={dataUrl}
      alt="Check-in QR Code"
      className={`border rounded-lg ${className}`}
      style={{ width: size, height: size }}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    />
  );
}
