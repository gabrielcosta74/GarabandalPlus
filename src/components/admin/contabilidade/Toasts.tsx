"use client";

import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

import { cx } from './ui';

type ToastTone = 'success' | 'error' | 'info';

type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration: number;
};

type ToastInput = Omit<Toast, 'id' | 'duration' | 'tone'> & { tone?: ToastTone; duration?: number };

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastTone, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-emerald-600' },
  error: { icon: AlertCircle, className: 'text-rose-600' },
  info: { icon: Info, className: 'text-sky-600' },
};

/** Small dark toasts, bottom-centre, stacked; actions such as "Desfazer". */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts(list => list.filter(t => t.id !== id)), []);

  const push = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    const toast: Toast = { tone: 'success', duration: input.action ? 6000 : 3500, ...input, id };
    // Keep the stack short: at most three on screen.
    setToasts(list => [...list.slice(-2), toast]);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map(toast => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />)}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [paused, toast.id, toast.duration, onDismiss]);

  const { icon: Icon, className } = ICONS[toast.tone];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className="lg-float pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-full py-2.5 pl-5 pr-2 text-zinc-900"
    >
      <Icon className={cx('h-5 w-5 shrink-0', className)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{toast.title}</p>
        {toast.description && <p className="truncate text-[13px] text-zinc-500">{toast.description}</p>}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={() => { toast.action!.onClick(); onDismiss(toast.id); }}
          className="h-8 shrink-0 cursor-pointer rounded-full px-3 text-sm font-semibold text-emerald-700 transition-colors duration-200 hover:bg-zinc-900/[0.06] hover:text-emerald-800"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-zinc-400 transition-colors duration-200 hover:bg-zinc-900/[0.08] hover:text-zinc-900"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
