import { v2 as cloudinary } from 'cloudinary';
import { env } from './env';

if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
    // Raise the 60s default to 180s, since slow links receive the file but time out on the response and log spurious 499s.
    timeout: 180_000,
  });
}

export { cloudinary };
