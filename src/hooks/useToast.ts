import { useState, useCallback, useRef, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
  createdAt: number;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
}

export interface ToastActions {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const scheduleRemoval = useCallback((id: string, duration: number) => {
    const timeout = setTimeout(() => {
      removeToast(id);
    }, duration);
    timeoutsRef.current.set(id, timeout);
  }, [removeToast]);

  const pauseToast = useCallback((id: string) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
  }, []);

  const resumeToast = useCallback((id: string) => {
    const toast = toasts.find(t => t.id === id);
    if (!toast) return;
    const elapsed = Date.now() - toast.createdAt;
    const remaining = Math.max(1500, toast.duration - elapsed);
    scheduleRemoval(id, remaining);
  }, [toasts, scheduleRemoval]);

  const addToast = useCallback((type: ToastType, message: string, options?: ToastOptions) => {
    const id = Math.random().toString(36).slice(2);
    const duration = options?.duration ?? DEFAULT_DURATION[type];
    const newToast: Toast = {
      id,
      type,
      message,
      title: options?.title,
      duration,
      createdAt: Date.now(),
    };
    setToasts(prev => [...prev, newToast]);
    scheduleRemoval(id, duration);
  }, [scheduleRemoval]);

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(t => clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, []);

  const toast: ToastActions = {
    success: (message, options) => addToast('success', message, options),
    error: (message, options) => addToast('error', message, options),
    warning: (message, options) => addToast('warning', message, options),
    info: (message, options) => addToast('info', message, options),
  };

  return { toasts, toast, removeToast, pauseToast, resumeToast };
}
