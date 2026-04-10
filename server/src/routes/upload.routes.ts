import { Router } from 'express';
import multer from 'multer';
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
}

function uploadToCloudinary(
  buffer: Buffer,
  options: UploadOptions
): Promise<{ url: string; publicId: string; width?: number; height?: number; bytes?: number; format?: string; duration?: number }> {
  return new Promise((resolve, reject) => {
    const uploadOpts: Record<string, any> = {
      folder: `rdswa/${options.folder}`,
      resource_type: options.resourceType || 'image',
    };

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

    // Chunked upload for large files (videos can be up to 100 MB)
    if (buffer.length > 10 * 1024 * 1024) {
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

export default router;
