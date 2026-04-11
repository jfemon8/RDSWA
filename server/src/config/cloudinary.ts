import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
    // Default 60s is too short for slow connections (e.g. local dev in BD).
    // Cloudinary often receives the file but the response packet times out;
    // 180s eliminates the spurious 499s without affecting fast networks.
    timeout: 180_000,
  });
}

export { cloudinary };
