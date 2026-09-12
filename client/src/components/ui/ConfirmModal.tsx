import { useCallback, createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Info, X, Trash2, Shield, Pencil, type LucideIcon } from 'lucide-react';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

/** `primary` follows the site's brand tokens; the rest carry their own semantic colour. */
type ModalVariant = 'danger' | 'warning' | 'info' | 'primary';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ModalVariant;
  /** Overrides the variant's default glyph. */
  icon?: LucideIcon;
  /** Optional text the user must type to enable confirmation, for bulk or irreversible actions. */
  requireTypeToConfirm?: string;
}

/** A modal that asks for a value rather than a yes/no, replacing `window.prompt`. */
export interface PromptOptions {
  title?: string;
  message?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  /** Blocks confirmation until something is typed. */
  required?: boolean;
  variant?: ModalVariant;
  /** Overrides the variant's default glyph. */
  icon?: LucideIcon;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Resolves with the typed value, or null when the user backs out. */
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}

export function usePrompt() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('usePrompt must be used within ConfirmProvider');
  return ctx.prompt;
}

const variantStyles = {
  danger: {
    iconBg: 'bg-gradient-to-br from-red-500 to-rose-600 text-white',
    iconRing: 'ring-red-500/20 dark:ring-red-500/30',
    iconGlow: 'shadow-[0_0_40px_-8px_rgba(239,68,68,0.6)]',
    button: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white shadow-lg shadow-red-600/25',
    accent: 'from-red-500/10 via-rose-500/5 to-transparent',
    ring: 'ring-red-500/20',
    Icon: Trash2,
  },
  warning: {
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
    iconRing: 'ring-amber-500/20 dark:ring-amber-500/30',
    iconGlow: 'shadow-[0_0_40px_-8px_rgba(245,158,11,0.6)]',
    button: 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-600/25',
    accent: 'from-amber-500/10 via-orange-500/5 to-transparent',
    ring: 'ring-amber-500/20',
    Icon: AlertTriangle,
  },
  info: {
    iconBg: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white',
    iconRing: 'ring-sky-500/20 dark:ring-sky-500/30',
    iconGlow: 'shadow-[0_0_40px_-8px_rgba(14,165,233,0.6)]',
    button: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-lg shadow-sky-600/25',
    accent: 'from-sky-500/10 via-blue-500/5 to-transparent',
    ring: 'ring-sky-500/20',
    Icon: Info,
  },
  primary: {
    iconBg: 'bg-primary text-primary-foreground',
    iconRing: 'ring-primary/20 dark:ring-primary/30',
    iconGlow: 'shadow-lg shadow-primary/40',
    button: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25',
    accent: 'from-primary/10 via-primary/5 to-transparent',
    ring: 'ring-primary/20',
    Icon: Pencil,
  },
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
    | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void }
    | null
  >(null);
  const [typedText, setTypedText] = useState('');
  const [inputValue, setInputValue] = useState('');

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setTypedText('');
      setState({ kind: 'confirm', options, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      setInputValue(options.defaultValue || '');
      setState({ kind: 'prompt', options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    if (state?.kind === 'prompt') state.resolve(result ? inputValue.trim() : null);
    else state?.resolve(result);
    setState(null);
    setTypedText('');
    setInputValue('');
  };

  useBodyScrollLock(!!state);

  const promptOptions = state?.kind === 'prompt' ? state.options : null;
  const typeToConfirm = state?.kind === 'confirm' ? state.options.requireTypeToConfirm : undefined;
  const typeMatches = !typeToConfirm || typedText.trim() === typeToConfirm.trim();
  // A prompt that demands a value keeps its confirm button locked until one is typed.
  const canSubmit = typeMatches && (!promptOptions?.required || inputValue.trim().length > 0);
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        // Enter submits a single-line prompt the way the native dialog did, but never a text area mid-typing.
        const target = e.target as HTMLElement | null;
        const inSingleLinePrompt = !!promptOptions && !promptOptions.multiline && target?.tagName === 'INPUT';
        if (!inSingleLinePrompt && target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        if (canSubmit) {
          e.preventDefault();
          handleClose(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, canSubmit]);

  // A prompt asks for input rather than warning about anything, so it wears the site's own colours.
  const variant = state?.options.variant || (promptOptions ? 'primary' : 'danger');
  const styles = variantStyles[variant];
  const Icon = state?.options.icon || styles.Icon;
  const isDestructive = variant === 'danger';

  return (
    <ConfirmContext.Provider value={{ confirm, prompt }}>
      {children}
      <AnimatePresence>
        {state && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md"
              onClick={() => handleClose(false)}
              aria-hidden="true"
            />

            {/* Modal: bottom sheet on mobile, centered on desktop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-modal-title"
              aria-describedby="confirm-modal-message"
              className="fixed inset-x-0 bottom-0 sm:inset-0 z-[201] flex justify-center sm:items-center sm:p-4 pointer-events-none"
            >
              <motion.div
                initial={{ y: '100%', opacity: 0, scale: 0.94 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: '100%', opacity: 0, scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                className={`relative bg-card/95 backdrop-blur-xl border border-border/60 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-h-[90vh] overflow-y-auto pointer-events-auto ring-1 ${styles.ring} ${
                  promptOptions?.multiline ? 'sm:max-w-2xl' : 'sm:max-w-md'
                }`}
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
              >
                <div className={`pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${styles.accent} rounded-t-3xl`} aria-hidden="true" />

                {/* Drag handle (mobile only) */}
                <div className="relative flex justify-center pt-2.5 sm:hidden">
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>

                <button
                  onClick={() => handleClose(false)}
                  className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="relative flex justify-center pt-6 sm:pt-8 pb-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -12 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}
                    className="relative"
                  >
                    {isDestructive && (
                      <motion.div
                        className="absolute inset-0 rounded-2xl bg-red-500/30"
                        animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                        aria-hidden="true"
                      />
                    )}
                    <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center ring-4 ${styles.iconRing} ${styles.iconBg} ${styles.iconGlow}`}>
                      <Icon className="h-8 w-8" strokeWidth={2.25} />
                    </div>
                  </motion.div>
                </div>

                <div className="relative px-5 sm:px-7 pb-5 text-center">
                  <motion.h3
                    id="confirm-modal-title"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-lg sm:text-xl font-bold text-foreground mb-2 tracking-tight"
                  >
                    {state.options.title || (promptOptions ? 'Enter a value' : 'Are you sure?')}
                  </motion.h3>
                  <motion.p
                    id="confirm-modal-message"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="text-sm text-muted-foreground leading-relaxed"
                  >
                    {state.options.message}
                  </motion.p>

                  {/* Prompt input, which is what replaces `window.prompt` across the app. */}
                  {promptOptions && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-4 text-left"
                    >
                      {promptOptions.label && (
                        <label htmlFor="prompt-modal-input" className="block text-xs font-medium text-muted-foreground mb-1.5">
                          {promptOptions.label}
                        </label>
                      )}
                      {promptOptions.multiline ? (
                        <textarea
                          id="prompt-modal-input"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          placeholder={promptOptions.placeholder}
                          rows={7}
                          autoFocus
                          className="w-full px-3 py-2.5 border border-border rounded-lg bg-background text-sm leading-relaxed resize-y min-h-[9rem] max-h-[50vh] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      ) : (
                        <input
                          id="prompt-modal-input"
                          type="text"
                          value={inputValue}
                          onChange={(e) => setInputValue(e.target.value)}
                          placeholder={promptOptions.placeholder}
                          autoFocus
                          className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      )}
                    </motion.div>
                  )}

                  {/* Type-to-confirm input for high-stakes actions */}
                  {typeToConfirm && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-4 text-left"
                    >
                      <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                        <Shield className="h-3 w-3" />
                        Type <span className="font-mono font-bold text-foreground px-1.5 py-0.5 bg-muted rounded">{typeToConfirm}</span> to confirm
                      </label>
                      <input
                        type="text"
                        value={typedText}
                        onChange={(e) => setTypedText(e.target.value)}
                        autoFocus
                        className={`w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono focus:outline-none focus:ring-2 transition-colors ${
                          typeMatches && typedText
                            ? 'border-green-500 focus:ring-green-500/30'
                            : 'border-border focus:ring-primary/30'
                        }`}
                        placeholder={typeToConfirm}
                      />
                    </motion.div>
                  )}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 px-5 sm:px-7 pb-5 sm:pb-6"
                >
                  <button
                    onClick={() => handleClose(false)}
                    className="flex-1 px-4 py-2.5 sm:py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-accent transition-all"
                  >
                    {state.options.cancelLabel || 'Cancel'}
                  </button>
                  <motion.button
                    onClick={() => handleClose(true)}
                    disabled={!canSubmit}
                    whileHover={canSubmit ? { scale: 1.02 } : {}}
                    whileTap={canSubmit ? { scale: 0.97 } : {}}
                    className={`flex-1 px-4 py-2.5 sm:py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${styles.button}`}
                  >
                    {state.options.confirmLabel || 'Confirm'}
                  </motion.button>
                </motion.div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
