import { useCallback, createContext, useContext, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}

const variantStyles = {
  danger: {
    icon: 'bg-red-100 dark:bg-red-900/30 text-red-600',
    button: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    icon: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600',
    button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  },
  info: {
    icon: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
    button: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {state && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm"
              onClick={() => handleClose(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="fixed inset-0 z-[201] flex items-center justify-center p-4"
            >
              <div className="bg-card border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 pb-0">
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${variantStyles[state.options.variant || 'danger'].icon}`}
                    >
                      <AlertTriangle className="h-5 w-5" />
                    </motion.div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {state.options.title || 'Are you sure?'}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleClose(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {state.options.message}
                  </p>
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-5 pb-5">
                  <button
                    onClick={() => handleClose(false)}
                    className="flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    {state.options.cancelLabel || 'Cancel'}
                  </button>
                  <motion.button
                    onClick={() => handleClose(true)}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm ${variantStyles[state.options.variant || 'danger'].button}`}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    {state.options.confirmLabel || 'Confirm'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
