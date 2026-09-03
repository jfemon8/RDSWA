import { Router } from 'express';
import multer from 'multer';
import https from 'https';
import { authenticate } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { cloudinary } from '../config/cloudinary';
import { decodeMultipartFilename } from '../utils/filename';
import { env } from '../config/env';

const router = Router();

// ── Guard: Ensure Cloudinary is configured ──
function ensureCloudinary() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw ApiError.internal('File upload service is not configured. Please set Cloudinary credentials.');
  }
}

// ── File filters ──
const imageFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only JPEG, PNG, GIF, and WebP images are allowed'));
  }
};

const documentFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'File type not allowed. Accepted: JPEG, PNG, GIF, WebP, PDF, Word, Excel'));
  }
};

// ── Multer instances ──
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
}).single('file');

const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('file');

const docUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).single('file');

// ── Chat media upload ──
// Video may reach 50 MB and everything else 10 MB, so multer caps at 50 MB and the route re-validates per kind.
const CHAT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const CHAT_OTHER_MAX_BYTES = 10 * 1024 * 1024;
const chatMediaFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Reject executables and script types — everything else is allowed.
  const blocked = [
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-sh',
    'application/x-bat',
    'application/x-executable',
    'application/vnd.microsoft.portable-executable',
  ];
  if (blocked.includes(file.mimetype)) {
    cb(new ApiError(400, 'Executable files are not allowed'));
    return;
  }
  cb(null, true);
};
const chatMediaUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: chatMediaFilter,
  limits: { fileSize: CHAT_VIDEO_MAX_BYTES },
}).single('file');

// ── Cloudinary upload helper ──
interface UploadOptions {
  folder: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  transformation?: Record<string, any>[];
  /** Original filename used as the Cloudinary public_id base, so raw URLs keep a real extension instead of an opaque hash. */
  originalName?: string;
}

function uploadToCloudinary(
  buffer: Buffer,
  options: UploadOptions
): Promise<{ url: string; publicId: string; width?: number; height?: number; bytes?: number; format?: string; duration?: number }> {
  return new Promise((resolve, reject) => {
    const uploadOpts: Record<string, any> = {
      folder: `rdswa/${options.folder}`,
      resource_type: options.resourceType || 'image',
      // Per-call timeout matches the global SDK config — needed because some
      // SDK versions don't honor the global timeout for upload_stream.
      timeout: 180_000,
    };

    // Preserve original filename so raw URLs keep the file extension.
    if (options.originalName) {
      uploadOpts.use_filename = true;
      uploadOpts.unique_filename = true;
    }

    // Only image resources get optimization transforms, video and raw pass through untouched.
    if (uploadOpts.resource_type === 'image') {
      const transforms = options.transformation ? [...options.transformation] : [];
      transforms.push({
        fetch_format: 'auto',
        quality: 'auto:good',
      });
      uploadOpts.transformation = transforms;
    } else if (options.transformation) {
      uploadOpts.transformation = options.transformation;
    }

    // Chunk anything over 1MB, since single-shot uploads time out on slow connections.
    if (buffer.length > 1 * 1024 * 1024) {
      uploadOpts.chunk_size = 6 * 1024 * 1024;
    }

    const stream = cloudinary.uploader.upload_stream(
      uploadOpts,
      (error, result) => {
        if (error || !result) {
          console.error('[Cloudinary Upload Error]', error);
          return reject(error || new Error('Upload failed'));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          format: result.format,
          duration: (result as any).duration,
        });
      }
    );
    stream.end(buffer);
  });
}

/** Canonical extension per MIME type, so extension-less uploads still get a suffix Cloudinary and browsers can use. */
const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'weba',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/** Keep an existing sane extension, otherwise append the canonical one for the file's MIME type. */
function ensureExtension(filename: string, mimeType: string): string {
  if (!filename) return filename;
  // Strip a trailing dot ("name.") so "name." + "pdf" becomes "name.pdf",
  // not "name..pdf".
  const trimmed = filename.replace(/\.+$/, '');
  if (/\.[a-zA-Z0-9]{1,8}$/.test(trimmed)) return trimmed;
  const m = (mimeType || '').toLowerCase();
  // Skip when we genuinely don't know the type — appending "octetstream"
  // (the subtype fallback) is worse than no extension at all.
  if (!m || m === 'application/octet-stream' || m === 'binary/octet-stream') {
    return trimmed;
  }
  let ext = EXT_BY_MIME[m];
  if (!ext) {
    const sub = m.split('/').pop() || '';
    ext = sub.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8);
  }
  if (!ext) return trimmed;
  return `${trimmed}.${ext}`;
}

/** Best-effort MIME detection from a buffer's leading bytes, for legacy files whose URL and Content-Type say nothing. */
function sniffMagic(buf: Buffer): string | null {
  if (!buf || buf.length < 4) return null;
  // PDF — `%PDF`
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf';
  // PNG — 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  // JPEG — FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // GIF — "GIF8"
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  // WebP — RIFF....WEBP
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  // SVG — text starting with `<?xml` or `<svg`
  if (buf.length >= 5) {
    const head = buf.slice(0, Math.min(buf.length, 64)).toString('utf8').trim().toLowerCase();
    if (head.startsWith('<?xml') && head.includes('<svg')) return 'image/svg+xml';
    if (head.startsWith('<svg')) return 'image/svg+xml';
  }
  // ZIP container (includes DOCX/XLSX/PPTX) — `PK\x03\x04`
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'application/zip';
  // Legacy OLE (DOC/XLS/PPT) — D0 CF 11 E0
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return 'application/msword';
  // MP4 / MOV — `ftyp` box marker at offset 4
  if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    // brand at offsets 8-11 — "qt  " → mov, otherwise treat as mp4
    if (buf[8] === 0x71 && buf[9] === 0x74) return 'video/quicktime';
    return 'video/mp4';
  }
  // WebM / Matroska — 1A 45 DF A3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm';
  // MP3 — ID3 tag or frame sync (FF Ex/Fx)
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return 'audio/mpeg';
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  // WAV — RIFF....WAVE
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45
  ) {
    return 'audio/wav';
  }
  return null;
}

/** Derive the chat attachment kind + Cloudinary resource_type from the file's MIME. */
function deriveChatKind(mime: string): {
  kind: 'image' | 'video' | 'audio' | 'pdf' | 'file';
  resourceType: 'image' | 'video' | 'raw';
} {
  if (mime.startsWith('image/')) return { kind: 'image', resourceType: 'image' };
  if (mime.startsWith('video/')) return { kind: 'video', resourceType: 'video' };
  // Cloudinary treats audio as a 'video' resource type.
  if (mime.startsWith('audio/')) return { kind: 'audio', resourceType: 'video' };
  if (mime === 'application/pdf') return { kind: 'pdf', resourceType: 'raw' };
  return { kind: 'file', resourceType: 'raw' };
}

// ── Multer error wrapper ──
function handleMulter(upload: any, maxSizeLabel: string) {
  return (req: any, res: any, next: any) => {
    upload(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ApiError(400, `File size exceeds the ${maxSizeLabel} limit`));
        }
        return next(new ApiError(400, err.message));
      }
      if (err) return next(err);
      next();
    });
  };
}

// ──────────────────────────────────────────────
// POST /upload/avatar — profile picture, 2MB max, auto-cropped to 256x256.
// ──────────────────────────────────────────────
router.post('/avatar', authenticate(), handleMulter(avatarUpload, '2MB'), asyncHandler(async (req, res) => {
  ensureCloudinary();
  if (!req.file) throw ApiError.badRequest('No file provided');

  const result = await uploadToCloudinary(req.file.buffer, {
    folder: 'avatars',
    transformation: [
      { width: 256, height: 256, crop: 'fill', gravity: 'face' },
    ],
  });

  ApiResponse.success(res, {
    url: result.url,
    publicId: result.publicId,
  }, 'Avatar uploaded');
}));

// ──────────────────────────────────────────────
// POST /upload/image — general image, 5MB max, capped at 1920px wide.
// ──────────────────────────────────────────────
router.post('/image', authenticate(), handleMulter(imageUpload, '5MB'), asyncHandler(async (req, res) => {
  ensureCloudinary();
  if (!req.file) throw ApiError.badRequest('No file provided');

  const folder = (req.query.folder as string) || 'images';
  const result = await uploadToCloudinary(req.file.buffer, {
    folder,
    transformation: [
      { width: 1920, crop: 'limit' },
    ],
  });

  ApiResponse.success(res, {
    url: result.url,
    publicId: result.publicId,
    width: result.width,
    height: result.height,
  }, 'Image uploaded');
}));

// ──────────────────────────────────────────────
// POST /upload/document — document or file, 10MB max, stored as a raw resource.
// ──────────────────────────────────────────────
router.post('/document', authenticate(), handleMulter(docUpload, '10MB'), asyncHandler(async (req, res) => {
  ensureCloudinary();
  if (!req.file) throw ApiError.badRequest('No file provided');

  const isImage = req.file.mimetype.startsWith('image/');
  // Append the canonical extension for bare names like "report" so the URL and stored filename stay usable.
  const filename = ensureExtension(decodeMultipartFilename(req.file.originalname), req.file.mimetype);
  const result = await uploadToCloudinary(req.file.buffer, {
    folder: 'documents',
    resourceType: isImage ? 'image' : 'raw',
    // Pass originalName for raw uploads so the URL keeps the file extension.
    originalName: isImage ? undefined : filename,
  });

  ApiResponse.success(res, {
    url: result.url,
    publicId: result.publicId,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    originalName: filename,
  }, 'Document uploaded');
}));

// ──────────────────────────────────────────────
// POST /upload/chat-media — chat attachments, routed to the matching Cloudinary resource type and returned ready for attachments[].
// ──────────────────────────────────────────────
router.post('/chat-media', authenticate(), handleMulter(chatMediaUpload, '50MB'), asyncHandler(async (req, res) => {
  ensureCloudinary();
  if (!req.file) throw ApiError.badRequest('No file provided');

  const { kind, resourceType } = deriveChatKind(req.file.mimetype);

  // Only video gets the 50 MB cap, since multer already rejected anything larger.
  if (kind !== 'video' && req.file.size > CHAT_OTHER_MAX_BYTES) {
    throw ApiError.badRequest(`File too large. ${kind} attachments are limited to 10 MB.`);
  }

  // Same auto-extension treatment as documents, so raw chat files download with a sensible name.
  const filename = ensureExtension(decodeMultipartFilename(req.file.originalname), req.file.mimetype);
  const result = await uploadToCloudinary(req.file.buffer, {
    folder: 'chat',
    resourceType,
    // Raw uploads need use_filename so the delivered URL keeps the original extension.
    originalName: resourceType === 'raw' ? filename : undefined,
  });

  ApiResponse.success(res, {
    kind,
    url: result.url,
    publicId: result.publicId,
    resourceType,
    name: filename,
    mimeType: req.file.mimetype,
    size: result.bytes ?? req.file.size,
    width: result.width,
    height: result.height,
    duration: result.duration,
  }, 'Media uploaded');
}));

// ──────────────────────────────────────────────
// GET /upload/proxy — re-serve a Cloudinary file with the right Content-Type so raw PDFs preview instead of downloading as blobs.
// Query: ?url=<cloudinaryUrl>&name=<filename>&inline=true|false
// ──────────────────────────────────────────────
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

router.get('/proxy', authenticate(true), asyncHandler(async (req, res) => {
  const rawUrl = String(req.query.url || '');
  const inline = req.query.inline !== 'false'; // default inline
  const downloadName = String(req.query.name || '').replace(/[\r\n"]/g, '').trim();

  if (!rawUrl) throw ApiError.badRequest('url query parameter is required');

  // SSRF protection: only allow our own Cloudinary cloud as upstream.
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw ApiError.badRequest('Invalid url');
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') {
    throw ApiError.badRequest('Only Cloudinary URLs are allowed');
  }
  const cloudName = env.CLOUDINARY_CLOUD_NAME || '';
  if (cloudName && !parsed.pathname.startsWith(`/${cloudName}/`)) {
    throw ApiError.badRequest('Cloudinary URL belongs to a different cloud');
  }

  // First-pass MIME guess from the URL extension, which may be empty for legacy raw uploads.
  const pathname = parsed.pathname.toLowerCase();
  const extMatch = pathname.match(/\.([a-z0-9]{1,8})(?:$|\?)/);
  const urlExt = extMatch?.[1] || '';
  const mimeFromUrl = MIME_BY_EXT[urlExt] || '';

  // Sensible default filename: prefer query.name, else last URL segment.
  const lastSeg = decodeURIComponent(parsed.pathname.split('/').pop() || 'download');
  const initialFilename = downloadName || lastSeg;

  // Buffer the first bytes before piping so the file type can be sniffed when nothing else declares it.
  await new Promise<void>((resolve, reject) => {
    const httpsReq = https.get(rawUrl, (upstream) => {
      if (!upstream.statusCode || upstream.statusCode >= 400) {
        upstream.resume();
        reject(new ApiError(upstream.statusCode || 502, 'Upstream fetch failed'));
        return;
      }

      const upstreamMime = String(upstream.headers['content-type'] || '')
        .split(';')[0]
        .trim()
        .toLowerCase();

      // SNIFF_LEN bytes is the most any magic-byte check needs, and piping resumes once headers are out.
      const SNIFF_LEN = 16;
      let buffered = Buffer.alloc(0);
      let headersSent = false;

      const flushHeadersAndBuffer = () => {
        if (headersSent) return;
        headersSent = true;

        // Resolve MIME by URL extension, then upstream header, then magic bytes, treating octet-stream as unknown.
        let finalMime = mimeFromUrl;
        const isUnknown = (m: string) =>
          !m || m === 'application/octet-stream' || m === 'binary/octet-stream';
        if (isUnknown(finalMime) && !isUnknown(upstreamMime)) {
          finalMime = upstreamMime;
        }
        if (isUnknown(finalMime)) {
          const sniffed = sniffMagic(buffered);
          if (sniffed) finalMime = sniffed;
        }
        if (!finalMime) finalMime = 'application/octet-stream';

        // Append the canonical extension when the stored name lacks one, since browsers honour the Unicode filename*.
        const finalFilename = ensureExtension(initialFilename, finalMime);

        res.setHeader('Content-Type', finalMime);
        if (upstream.headers['content-length']) {
          res.setHeader('Content-Length', upstream.headers['content-length']);
        }
        const disposition = inline ? 'inline' : 'attachment';
        // Node rejects non-Latin-1 header bytes, so this ASCII fallback pairs with the full Unicode filename*.
        const asciiFallback =
          finalFilename
            .replace(/[^\x20-\x7E]/g, '_')
            .replace(/["\\]/g, '_')
            .trim() || 'download';
        const encoded = encodeURIComponent(finalFilename);
        res.setHeader(
          'Content-Disposition',
          `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`,
        );
        // Cache for an hour — Cloudinary URLs are versioned and effectively immutable.
        res.setHeader('Cache-Control', 'private, max-age=3600');

        if (buffered.length > 0) res.write(buffered);
      };

      upstream.on('data', (chunk: Buffer) => {
        if (!headersSent) {
          buffered = Buffer.concat([buffered, chunk]);
          if (buffered.length >= SNIFF_LEN) flushHeadersAndBuffer();
        } else {
          // Backpressure: pause upstream when the response can't keep up.
          if (!res.write(chunk)) {
            upstream.pause();
            res.once('drain', () => upstream.resume());
          }
        }
      });
      upstream.on('end', () => {
        // Short responses (< SNIFF_LEN bytes) reach `end` before we've
        // flushed — do it now with whatever we buffered.
        if (!headersSent) flushHeadersAndBuffer();
        res.end();
        resolve();
      });
      upstream.on('error', (err) => {
        console.error('[Upload Proxy] Upstream stream error:', err);
        if (!headersSent) reject(new ApiError(502, 'Upstream fetch failed'));
        else { res.end(); resolve(); }
      });
    });
    httpsReq.on('error', (err) => {
      console.error('[Upload Proxy] Upstream error:', err);
      reject(new ApiError(502, 'Upstream fetch failed'));
    });
  });
}));

export default router;
