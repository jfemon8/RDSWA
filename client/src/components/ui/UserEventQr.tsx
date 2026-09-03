import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Loader2, Download } from 'lucide-react';
import { motion } from 'motion/react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface UserEventQrProps {
  eventId: string;
  userId: string;
  /** Printed under the organisation name on the downloaded image. */
  eventTitle?: string;
  size?: number;
  className?: string;
}

const FONT_STACK = '"Noto Sans Bengali", "Segoe UI", Arial, sans-serif';
const SHEET_WIDTH = 760;
const SHEET_PADDING = 48;
const SHEET_QR_SIZE = 600;

/** Split text into lines that fit the given width, so a long title never runs off the sheet. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let line = words[0];

  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

/** Generates a per-user check-in QR encoding the domain-independent `RDSWA:CHECKIN:{eventId}:{userId}`. */
export default function UserEventQr({
  eventId,
  userId,
  eventTitle,
  size = 200,
  className = '',
}: UserEventQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { settings } = useSiteSettings();

  const payload = `RDSWA:CHECKIN:${eventId}:${userId}`;
  const organisation = settings?.siteNameFull || settings?.siteName || '';

  useEffect(() => {
    QRCode.toDataURL(payload, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [payload, size]);

  const downloadQr = async () => {
    setSaving(true);
    try {
      // Re-render at print resolution rather than upscaling the on-screen image.
      const sheetQr = await QRCode.toDataURL(payload, {
        width: SHEET_QR_SIZE,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });

      const image = new Image();
      image.src = sheetQr;
      await image.decode();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const textWidth = SHEET_WIDTH - SHEET_PADDING * 2;

      ctx.font = `bold 34px ${FONT_STACK}`;
      const headerLines = organisation ? wrapText(ctx, organisation, textWidth) : [];
      ctx.font = `24px ${FONT_STACK}`;
      const subHeaderLines = eventTitle ? wrapText(ctx, eventTitle, textWidth) : [];

      const headerHeight = headerLines.length * 44;
      const subHeaderHeight = subHeaderLines.length * 32;
      const gap = headerLines.length || subHeaderLines.length ? 28 : 0;
      canvas.width = SHEET_WIDTH;
      canvas.height =
        SHEET_PADDING * 2 + headerHeight + subHeaderHeight + gap + SHEET_QR_SIZE;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      let y = SHEET_PADDING;
      ctx.fillStyle = '#111827';
      ctx.font = `bold 34px ${FONT_STACK}`;
      for (const line of headerLines) {
        ctx.fillText(line, SHEET_WIDTH / 2, y);
        y += 44;
      }

      ctx.fillStyle = '#4b5563';
      ctx.font = `24px ${FONT_STACK}`;
      for (const line of subHeaderLines) {
        ctx.fillText(line, SHEET_WIDTH / 2, y);
        y += 32;
      }

      y += gap;
      ctx.drawImage(image, (SHEET_WIDTH - SHEET_QR_SIZE) / 2, y, SHEET_QR_SIZE, SHEET_QR_SIZE);

      const slug = (eventTitle || 'event')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `${slug || 'event'}-checkin-qr.png`;
        link.click();
        URL.revokeObjectURL(href);
      }, 'image/png');
    } finally {
      setSaving(false);
    }
  };

  if (!dataUrl) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.img
        src={dataUrl}
        alt="Check-in QR Code"
        className={`border rounded-lg ${className}`}
        style={{ width: size, height: size }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      />
      <motion.button
        type="button"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={downloadQr}
        disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs text-foreground hover:bg-accent disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Download QR
      </motion.button>
    </div>
  );
}
