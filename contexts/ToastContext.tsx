'use client';

import { ToastStack } from '@/components/Toast';
import type { ToastRecord, ToastVariant } from '@/lib/toastTypes';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type { ToastVariant } from '@/lib/toastTypes';

export type PushToastInput = {
  variant: ToastVariant;
  title: string;
  message?: string;
  /** ms; omit uses default (loading: infinite). */
  duration?: number;
};

type ToastContextValue = {
  push: (input: PushToastInput) => string;
  update: (id: string, patch: Partial<Omit<ToastRecord, 'id'>>) => void;
  dismiss: (id: string) => void;
  info: (title: string, message?: string) => string;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  loading: (title: string, message?: string) => string;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((prev) => prev.filter((x) => x.id !== id));
    },
    [clearTimer],
  );

  const scheduleDismiss = useCallback(
    (id: string, duration: number) => {
      clearTimer(id);
      if (duration <= 0) return;
      const t = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, t);
    },
    [clearTimer, dismiss],
  );

  const push = useCallback(
    (input: PushToastInput): string => {
      const id = genId();
      const record: ToastRecord = {
        id,
        variant: input.variant,
        title: input.title,
        message: input.message,
      };
      setToasts((prev) => [...prev, record]);
      const duration =
        input.duration !== undefined
          ? input.duration
          : input.variant === 'loading'
            ? 0
            : 5200;
      if (duration > 0) {
        scheduleDismiss(id, duration);
      }
      return id;
    },
    [scheduleDismiss],
  );

  const update = useCallback(
    (id: string, patch: Partial<Omit<ToastRecord, 'id'>>) => {
      clearTimer(id);
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch, id } : t)),
      );
      const nextVariant = patch.variant;
      if (nextVariant && nextVariant !== 'loading') {
        scheduleDismiss(id, 5200);
      }
    },
    [clearTimer, scheduleDismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      push,
      update,
      dismiss,
      info: (title, message) => push({ variant: 'info', title, message }),
      success: (title, message) => push({ variant: 'success', title, message }),
      error: (title, message) => push({ variant: 'error', title, message }),
      loading: (title, message) => push({ variant: 'loading', title, message, duration: 0 }),
    }),
    [push, update, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
