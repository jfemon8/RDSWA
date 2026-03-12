import { AnimatePresence, motion } from 'motion/react';

export function FieldError({ message }: { message?: string }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.2 }}
          className="text-xs text-red-500 mt-1"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
