import { useRef, useState } from 'react';
import { Paperclip, Loader2, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '@/lib/api';

const MAX_BYTES = 10 * 1024 * 1024;

/** Mirrors `documentFilter` on the server so the picker can't offer a rejected type. */
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp';

interface DocumentUploadFieldProps {
  /** Uploaded document URL, or '' when nothing is attached yet. */
  value: string;
  /** Filename shown once a document is attached. */
  fileName?: string;
  /** Receives the Cloudinary URL and the server-normalised filename. */
  onUploaded: (url: string, originalName: string) => void;
  onClear: () => void;
  onError?: (message: string) => void;
  className?: string;
}

/** Single-row file picker that uploads to `/upload/document` and shows what is attached. */
export default function DocumentUploadField({
  value,
  fileName,
  onUploaded,
  onClear,
  onError,
  className = '',
}: DocumentUploadFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      onError?.(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds the 10MB limit`);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const { data } = await api.post('/upload/document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded(data.data.url, data.data.originalName);
    } catch (err: any) {
      onError?.(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // Reset so picking the same file twice still fires a change.
          e.target.value = '';
        }}
      />

      <AnimatePresence mode="wait">
        {value ? (
          <motion.div
            key="attached"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-card text-sm"
          >
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="flex-1 min-w-0 truncate text-foreground" title={fileName || value}>
              {fileName || 'Document attached'}
            </span>
            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClear}
              title="Remove document"
              aria-label="Remove document"
              className="p-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </motion.button>
          </motion.div>
        ) : (
          <motion.button
            key="picker"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Upload document"
            className="w-full flex items-center gap-2 px-3 py-1.5 border border-dashed rounded-md bg-card text-sm text-muted-foreground hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="truncate">Upload document (max 10MB)</span>
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
