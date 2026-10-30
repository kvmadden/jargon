import { useEffect, useState } from 'react';
import { create } from 'zustand';

type ToastVariant = 'default' | 'success' | 'warn' | 'error';

export interface ToastEntry {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ToastState {
  toasts: ToastEntry[];
  push: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: number) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message: string, variant: ToastVariant = 'default') => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2400);
  },
  dismiss: (id: number) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

const dotByVariant: Record<ToastVariant, string> = {
  default: 'bg-accent-jargon',
  success: 'bg-accent-jargon-hi',
  warn: 'bg-accent-vantage',
  error: 'bg-accent-triage',
};

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      className="fixed left-0 right-0 bottom-16 z-50 pointer-events-none flex flex-col items-center gap-2 px-4 safe-bottom"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: ToastEntry }) {
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setExiting(true), 2200);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
      className={`bg-surface-card-hi border border-border-default rounded-lg px-4 py-3 shadow-lg flex items-center gap-3 max-w-[90%] ${
        exiting ? 'animate-slide-down' : 'animate-slide-up'
      }`}
    >
      <span className={`block w-2 h-2 rounded-full shrink-0 ${dotByVariant[toast.variant]}`} />
      <span className="text-sm text-text-primary">{toast.message}</span>
    </div>
  );
}
