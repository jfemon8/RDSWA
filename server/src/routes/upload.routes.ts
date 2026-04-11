import { Router } from 'express';
import multer from 'multer';
import https from 'https';
import { authenticate } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { cloudinary } from '../config/cloudinary';
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
// Accepts image/video/audio/pdf/generic files for chat.
// - Video: up to 50 MB
// - Everything else (image / audio / pdf / file): up to 10 MB
// Multer's hard limit is set to the largest allowed (50 MB); the route handler
// re-validates the per-kind cap after derive once the MIME is known.
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
  /**
   * Original filename — when provided, Cloudinary uses it as the public_id
   * base via use_filename + unique_filename. Critical for raw uploads (PDF,
   * Word, Excel) so the delivered URL ends with the proper extension —
   * without this, raw URLs are opaque hashes and browsers can't infer the
   * MIME type, causing PDFs to download as binary blobs.
   */
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

    // Only apply image-optimization transforms for `image` resource type.
    // Video/raw uploads should pass through untouched.
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

    // Chunked upload for any file >1MB. Chunked is more reliable on slow
    // connections (the original 10MB threshold left medium PDFs vulnerable
    // to single-shot timeout failures).
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
// POST /upload/avatar — Profile picture (2MB max)
// Optimized: auto-crop to 256x256, auto format/quality
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
// POST /upload/image — General image (5MB max)
// Optimized: max 1920px width, auto format/quality
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
// POST /upload/document — Document/file (10MB max)
// No image transforms, uploaded as raw resource
// ──────────────────────────────────────────────
router.post('/document', authenticate(), handleMulter(docUpload, '10MB'), asyncHandler(async (req, res) => {
  ensureCloudinary();
  if (!req.file) throw ApiError.badRequest('No file provided');

  const isImage = req.file.mimetype.startsWith('image/');
  const result = await uploadToCloudinary(req.file.buffer, {
    folder: 'documents',
    resourceType: isImage ? 'image' : 'raw',
    // Pass originalName for raw uploads so URL keeps the file extension
    // (e.g. report.pdf instead of an opaque hash).
    originalName: isImage ? undefined : req.file.originalname,
  });

  ApiResponse.success(res, {
    url: result.url,
    publicId: result.publicId,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    originalName: req.file.originalname,
  }, 'Document uploaded');
}));

// ──────────────────────────────────────────────
// POST /upload/chat-media — Chat attachments (100 MB max)
// Routes video/audio → Cloudinary 'video' resource_type,
//   image → 'image', pdf/other → 'raw'.
// The caller receives the full attachment payload ready to
// drop into the message's attachments[] array.
// ──────────────────────────────────────────────
router.post('/chat-media', authenticate(), handleMulter(chatMediaUpload, '50MB'), asyncHandler(async (req, res) => {
  ensureCloudinary();
  if (!req.file) throw ApiError.badRequest('No file provided');

  const { kind, resourceType } = deriveChatKind(req.file.mimetype);

  // Per-kind size enforcement: only video gets the 50 MB cap; everything else
  // is capped at 10 MB. Multer already rejected anything > 50 MB.
  if (kind !== 'video' && req.file.size > CHAT_OTHER_MAX_BYTES) {
    throw ApiError.badRequest(`File too large. ${kind} attachments are limited to 10 MB.`);
  }

  const result = await uploadToCloudinary(req.file.buffer, {
    folder: 'chat',
    resourceType,
    // Raw uploads (PDF + generic files) need use_filename so the delivered
    // URL ends with the original extension. Without this, browsers download
    // PDFs as opaque binary blobs with hash filenames.
    originalName: resourceType === 'raw' ? req.file.originalname : undefined,
  });

  ApiResponse.success(res, {
    kind,
    url: result.url,
    publicId: result.publicId,
    resourceType,
    name: req.file.originalname,
    mimeType: req.file.mimetype,
    size: result.bytes ?? req.file.size,
    width: result.width,
    height: result.height,
    duration: result.duration,
  }, 'Media uploaded');
}));

// ──────────────────────────────────────────────
// GET /upload/proxy — Proxy a Cloudinary file with proper headers
//
// Cloudinary serves `raw` resources with Content-Type: application/octet-stream
// regardless of the actual file type. This forces browsers to download files
// as opaque binary blobs (e.g. PDFs become unnamed hash files instead of
// previewing inline). The proxy refetches the file and re-serves it with the
// correct Content-Type and filename, enabling inline preview and proper
// downloads for any attachment kind.
//
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

router.get('/proxy', authenticate(true), (req, res, next) => {
  try {
    const rawUrl = String(req.query.url || '');
    const inline = req.query.inline !== 'false'; // default inline
    const downloadName = String(req.query.name || '').replace(/[\r\n"]/g, '').trim();

    if (!rawUrl) {
      return next(ApiError.badRequest('url query parameter is required'));
    }

    // SSRF protection: only allow our own Cloudinary cloud as upstream.
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return next(ApiError.badRequest('Invalid url'));
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') {
      return next(ApiError.badRequest('Only Cloudinary URLs are allowed'));
    }
    const cloudName = env.CLOUDINARY_CLOUD_NAME || '';
    if (cloudName && !parsed.pathname.startsWith(`/${cloudName}/`)) {
      return next(ApiError.badRequest('Cloudinary URL belongs to a different cloud'));
    }

    // Derive content type from the URL extension or fall back to upstream's header.
    const pathname = parsed.pathname.toLowerCase();
    const extMatch = pathname.match(/\.([a-z0-9]{1,8})(?:$|\?)/);
    const ext = extMatch?.[1] || '';
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';

    // Sensible default filename: prefer query.name, else last URL segment.
    const lastSeg = decodeURIComponent(parsed.pathname.split('/').pop() || 'download');
    const filename = downloadName || lastSeg;

    https
      .get(rawUrl, (upstream) => {
        if (!upstream.statusCode || upstream.statusCode >= 400) {
          upstream.resume();
          return next(new ApiError(upstream.statusCode || 502, 'Upstream fetch failed'));
        }

        // Override Content-Type so browsers preview PDFs/images inline instead
        // of treating them as octet-stream downloads.
        res.setHeader('Content-Type', mime);
        if (upstream.headers['content-length']) {
          res.setHeader('Content-Length', upstream.headers['content-length']);
        }
        const disposition = inline ? 'inline' : 'attachment';
        // Use both `filename` (legacy) and `filename*` (RFC 5987) for unicode support.
        const encoded = encodeURIComponent(filename);
        res.setHeader(
          'Content-Disposition',
          `${disposition}; filename="${filename.replace(/"/g, '')}"; filename*=UTF-8''${encoded}`,
        );
        // Cache for an hour — Cloudinary URLs are versioned so they're effectively immutable.
        res.setHeader('Cache-Control', 'private, max-age=3600');

        upstream.pipe(res);
      })
      .on('error', (err) => {
        console.error('[Upload Proxy] Upstream error:', err);
        next(new ApiError(502, 'Upstream fetch failed'));
      });
  } catch (err) {
    next(err);
  }
});

export default router;
