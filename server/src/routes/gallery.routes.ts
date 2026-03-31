import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { auditLog } from '../middlewares/audit.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiResponse } from '../utils/ApiResponse';
import { ApiError } from '../utils/ApiError';
import { Album, Photo } from '../models';
import { UserRole } from '@rdswa/shared';

const router = Router();

// List albums
router.get('/albums', asyncHandler(async (_req, res) => {
  const albums = await Album.find({ isDeleted: false })
    .populate('createdBy', 'name avatar')
    .sort({ createdAt: -1 });
  ApiResponse.success(res, albums);
}));

// Get album with photos
router.get('/albums/:id', asyncHandler(async (req, res) => {
  const album = await Album.findOne({ _id: req.params.id, isDeleted: false })
    .populate('createdBy', 'name avatar')
    .populate('event', 'title');
  if (!album) throw ApiError.notFound('Album not found');
  const photos = await Photo.find({ album: album._id, isDeleted: false })
    .populate('uploadedBy', 'name avatar')
    .sort({ createdAt: -1 });
  ApiResponse.success(res, { album, photos });
}));

// Create album (Admin+ only)
router.post('/albums', authenticate(), authorize(UserRole.ADMIN), auditLog('album.create', 'albums'), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const album = await Album.create({ ...req.body, createdBy: req.user._id });
  ApiResponse.created(res, album, 'Album created');
}));

// Update album (Admin+ only)
router.patch('/albums/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('album.update', 'albums'), asyncHandler(async (req, res) => {
  const album = await Album.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { $set: req.body },
    { new: true }
  );
  if (!album) throw ApiError.notFound('Album not found');
  ApiResponse.success(res, album, 'Album updated');
}));

// Delete album (Admin+ only)
router.delete('/albums/:id', authenticate(), authorize(UserRole.ADMIN), auditLog('album.delete', 'albums'), asyncHandler(async (req, res) => {
  const album = await Album.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );
  if (!album) throw ApiError.notFound('Album not found');
  ApiResponse.success(res, null, 'Album deleted');
}));

// Upload photos to album
router.post('/albums/:id/photos', authenticate(), authorize(UserRole.MODERATOR), asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const album = await Album.findOne({ _id: req.params.id, isDeleted: false });
  if (!album) throw ApiError.notFound('Album not found');

  const photosData = Array.isArray(req.body) ? req.body : [req.body];
  const photos = await Photo.insertMany(
    photosData.map((p: any) => ({
      album: album._id,
      url: p.url,
      thumbnail: p.thumbnail,
      caption: p.caption,
      taggedUsers: p.taggedUsers || [],
      uploadedBy: req.user!._id,
    }))
  );

  album.photoCount += photos.length;
  await album.save();

  ApiResponse.created(res, photos, 'Photos uploaded');
}));

// Delete photo (Admin+ only)
router.delete('/photos/:id', authenticate(), authorize(UserRole.ADMIN), asyncHandler(async (req, res) => {
  const photo = await Photo.findOneAndUpdate(
    { _id: req.params.id, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );
  if (!photo) throw ApiError.notFound('Photo not found');
  await Album.findByIdAndUpdate(photo.album, { $inc: { photoCount: -1 } });
  ApiResponse.success(res, null, 'Photo deleted');
}));

export default router;
