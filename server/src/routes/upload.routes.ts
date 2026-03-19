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

// ── Cloudinary upload helper ──
interface UploadOptions {
  folder: string;
  resourceType?: 'image' | 'raw' | 'auto';
  transformation?: Record<string, any>[];
}

function uploadToCloudinary(
  buffer: Buffer,
  options: UploadOptions
): Promise<{ url: string; publicId: string; width?: number; height?: number; bytes?: number; format?: string }> {
  return new Promise((resolve, reject) => {
    const uploadOpts: Record<string, any> = {
      folder: `rdswa/${options.folder}`,
      resource_type: options.resourceType || 'image',
    };

    // Build transformation array with optimization
    if (options.resourceType !== 'raw') {
      const transforms = options.transformation ? [...options.transformation] : [];
      transforms.push({
        fetch_format: 'auto',
        quality: 'auto:good',
      });
      uploadOpts.transformation = transforms;
    } else if (options.transformation) {
      uploadOpts.transformation = options.transformation;
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
        });
      }
    );
    stream.end(buffer);
  });
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

export default router;
