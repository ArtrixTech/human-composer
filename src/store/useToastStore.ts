import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  undoFn?: () => Promise<void>;
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, undoFn?: () => Promise<void>) => void;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, undoFn) => {
    const id = String(++counter);
    set((s) => ({ toasts: [...s.toasts, { id, message, undoFn }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
