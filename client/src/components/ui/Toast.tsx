import { useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />,
  error: <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />,
  info: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
  warning: <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />,
};

const borderColors: Record<ToastType, string> = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  info: 'border-l-blue-500',
  warning: 'border-l-yellow-500',
};

function ToastItem({ toast: t, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  return (
    <ToastPrimitive.Root
      duration={t.duration || 4000}
      onOpenChange={(open) => { if (!open) onRemove(t.id); }}
      asChild
      forceMount
    >
      <motion.li
        layout
        initial={{ opacity: 0, x: 80, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 80, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className={`bg-card border border-l-4 ${borderColors[t.type]} rounded-lg shadow-lg p-4 flex items-start gap-3 w-[360px] max-w-[calc(100vw-2rem)] pointer-events-auto`}
      >
        {icons[t.type]}
        <div className="flex-1 min-w-0">
          <ToastPrimitive.Title className="text-sm font-semibold text-foreground">
            {t.title}
          </ToastPrimitive.Title>
          {t.description && (
            <ToastPrimitive.Description className="text-xs text-muted-foreground mt-0.5">
              {t.description}
            </ToastPrimitive.Description>
          )}
        </div>
        <ToastPrimitive.Close className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <X className="h-4 w-4" />
        </ToastPrimitive.Close>
      </motion.li>
    </ToastPrimitive.Root>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { ...opts, id }]);
  }, []);

  const value: ToastContextValue = {
    toast: addToast,
    success: (title, description) => addToast({ type: 'success', title, description }),
    error: (title, description) => addToast({ type: 'error', title, description }),
    info: (title, description) => addToast({ type: 'info', title, description }),
    warning: (title, description) => addToast({ type: 'warning', title, description }),
  };

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        <ToastPrimitive.Viewport asChild>
          <ol className="fixed top-4 right-4 z-[100] flex flex-col gap-2 list-none m-0 p-0 outline-none">
            <AnimatePresence mode="popLayout">
              {toasts.map((t) => (
                <ToastItem key={t.id} toast={t} onRemove={removeToast} />
              ))}
            </AnimatePresence>
          </ol>
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
