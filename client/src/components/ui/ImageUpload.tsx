import { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';

interface ImageUploadProps {
  /** Current image URL */
  value?: string;
  /** Called with uploaded image URL */
  onChange: (url: string) => void;
  /** Upload endpoint type */
  type?: 'avatar' | 'image' | 'document';
  /** Cloudinary folder (for image type) */
  folder?: string;
  /** Label text */
  label?: string;
  /** Custom class for the container */
  className?: string;
  /** Show as circular (for avatars) */
  circular?: boolean;
  /** Accept mime types */
  accept?: string;
}

const SIZE_LIMITS = {
  avatar: { bytes: 2 * 1024 * 1024, label: '2MB' },
  image: { bytes: 5 * 1024 * 1024, label: '5MB' },
  document: { bytes: 10 * 1024 * 1024, label: '10MB' },
};

export default function ImageUpload({
  value,
  onChange,
  type = 'image',
  folder,
  label,
  className = '',
  circular = false,
  accept = 'image/jpeg,image/png,image/gif,image/webp',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const limit = SIZE_LIMITS[type];

  const handleFile = async (file: File) => {
    setError('');
    setProgress(0);

    // Client-side size validation
    if (file.size > limit.bytes) {
      setError(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds ${limit.label} limit`);
      return;
    }

    // Client-side type validation for images
    if (type !== 'document') {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Only JPEG, PNG, GIF, and WebP images are allowed');
        return;
      }
    }

    const formData = new FormData();
    formData.append('file', file);

    const endpoint = type === 'avatar' ? '/upload/avatar'
      : type === 'document' ? '/upload/document'
      : `/upload/image${folder ? `?folder=${folder}` : ''}`;

    setUploading(true);
    try {
      const { data } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      onChange(data.data.url);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className={className}>
      {label && <p className="text-xs text-muted-foreground mb-1.5">{label}</p>}
      <input ref={fileRef} type="file" accept={accept} onChange={handleChange} className="hidden" />

      <AnimatePresence mode="wait">
        {value ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`relative inline-block ${circular ? 'rounded-full' : 'rounded-lg'} overflow-hidden border-2 border-dashed border-primary/20`}
          >
            <img
              src={value}
              alt=""
              className={`object-cover ${circular ? 'h-24 w-24 rounded-full' : 'h-32 w-full max-w-xs'}`}
            />
            {/* Always-visible action buttons. Previously hidden with
                `sm:opacity-0 sm:group-hover:opacity-100`, but the parent
                never had the `group` class, so on desktop the hover never
                triggered and the buttons were permanently invisible.
                Keep them visible with a strong backdrop + ring so they
                read clearly against any image underneath. */}
            <div className="absolute top-1.5 right-1.5 flex gap-1.5">
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => fileRef.current?.click()}
                className="p-2 bg-white/95 dark:bg-black/80 backdrop-blur-sm rounded-full text-foreground shadow-md ring-1 ring-black/10 dark:ring-white/20 hover:bg-white dark:hover:bg-black transition-colors"
                title="Change image"
                aria-label="Change image"
              >
                <Upload className="h-3.5 w-3.5" />
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onChange('')}
                className="p-2 bg-white/95 dark:bg-black/80 backdrop-blur-sm rounded-full text-destructive shadow-md ring-1 ring-black/10 dark:ring-white/20 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                title="Remove image"
                aria-label="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => !uploading && fileRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors overflow-hidden
              hover:border-primary/50 hover:bg-primary/5
              ${circular ? 'h-24 w-24 rounded-full p-2' : 'h-32'}
              ${error ? 'border-red-400' : 'border-muted-foreground/30'}
            `}
          >
            {uploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                {progress > 0 && !circular && (
                  <p className="text-[10px] text-primary font-medium">{progress}%</p>
                )}
                {/* Progress bar */}
                <motion.div
                  className="absolute bottom-0 left-0 h-0.5 bg-primary"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </>
            ) : (
              <>
                <ImageIcon className={`text-muted-foreground/40 ${circular ? 'h-6 w-6' : 'h-8 w-8'}`} />
                {!circular && (
                  <p className="text-xs text-muted-foreground text-center">
                    Click or drag to upload<br />
                    <span className="text-[10px]">Max {limit.label}</span>
                  </p>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs text-red-500 mt-1"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
