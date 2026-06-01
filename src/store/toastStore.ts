import { create } from "zustand";

export interface ToastItem {
  id: string;
  message: string;
  undo?: () => Promise<void>;
  actionLabel?: string;
  onAction?: () => Promise<void>;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `toast-${++counter}`;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 2500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
