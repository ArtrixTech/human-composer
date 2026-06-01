import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import type { AppSnapshot } from "../types";
import { useAppStore } from "../store/appStore";

export function useGraphSync() {
  const applySnapshot = useAppStore((s) => s.applySnapshot);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const completeActive = useAppStore((s) => s.completeTask);
  const snapshot = useAppStore((s) => s.snapshot);

  useEffect(() => {
    const unsubs: Array<Promise<() => void>> = [];

    unsubs.push(
      listen<AppSnapshot>("graph-updated", (event) => {
        void applySnapshot(event.payload);
      }),
    );
    unsubs.push(
      listen("shortcut-command-palette", () => setCommandOpen(true)),
    );
    unsubs.push(
      listen("shortcut-quick-add", () => {
        setCommandOpen(true);
      }),
    );
    unsubs.push(
      listen("shortcut-complete-task", () => {
        const activeId = useAppStore.getState().snapshot?.activeTask?.task.id;
        if (activeId) void completeActive(activeId);
      }),
    );

    return () => {
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [applySnapshot, setCommandOpen, completeActive]);

  return snapshot;
}
