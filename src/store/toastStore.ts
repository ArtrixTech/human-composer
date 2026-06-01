import { create } from "zustand";

const DEFAULT_DURATION = 4000;

export interface ToastItem {
  id: string;
  message: string;
  undo?: () => Promise<void>;
  actionLabel?: string;
  onAction?: () => Promise<void>;
  duration: number;
  createdAt: number;
  exiting?: boolean;
  pausedAt?: number;
  remainingMs?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id" | "duration" | "createdAt"> & { duration?: number }) => void;
  dismiss: (id: string) => void;
  pause: (id: string) => void;
  resume: (id: string) => void;
}

let counter = 0;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleDismiss(id: string, ms: number, dismiss: (id: string) => void) {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => dismiss(id), ms);
  timers.set(id, timer);
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  push: (toast) => {
    const id = `toast-${++counter}`;
    const duration = toast.duration ?? DEFAULT_DURATION;
    const item: ToastItem = {
      ...toast,
      id,
      duration,
      createdAt: Date.now(),
    };
    set((s) => ({ toasts: [...s.toasts, item] }));
    scheduleDismiss(id, duration, get().dismiss);
  },

  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 220);
  },

  pause: (id) => {
    const toast = get().toasts.find((t) => t.id === id);
    if (!toast || toast.pausedAt) return;
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
    const elapsed = Date.now() - toast.createdAt;
    const remainingMs = Math.max(0, toast.duration - elapsed);
    set((s) => ({
      toasts: s.toasts.map((t) =>
        t.id === id ? { ...t, pausedAt: Date.now(), remainingMs } : t,
      ),
    }));
  },

  resume: (id) => {
    const toast = get().toasts.find((t) => t.id === id);
    if (!toast?.pausedAt || toast.remainingMs == null) return;
    set((s) => ({
      toasts: s.toasts.map((t) =>
        t.id === id ? { ...t, pausedAt: undefined, createdAt: Date.now(), duration: toast.remainingMs! } : t,
      ),
    }));
    scheduleDismiss(id, toast.remainingMs, get().dismiss);
  },
}));
