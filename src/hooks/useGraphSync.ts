import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import type { AppSnapshot, TodaySnapshot } from "../types";
import { useAppStore } from "../store/appStore";

export function useGraphSync() {
  const applySnapshot = useAppStore((s) => s.applySnapshot);
  const applyTodaySnapshot = useAppStore((s) => s.applyTodaySnapshot);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const completeActive = useAppStore((s) => s.completeTask);
  const todaySnapshot = useAppStore((s) => s.todaySnapshot);

  useEffect(() => {
    const unsubs: Array<Promise<() => void>> = [];

    unsubs.push(
      listen<AppSnapshot>("graph-updated", (event) => {
        void applySnapshot(event.payload);
      }),
    );
    unsubs.push(
      listen<TodaySnapshot>("today-updated", (event) => {
        applyTodaySnapshot(event.payload);
      }),
    );
    unsubs.push(listen("shortcut-command-palette", () => setCommandOpen(true)));
    unsubs.push(listen("shortcut-quick-add", () => setCommandOpen(true)));
    unsubs.push(
      listen("shortcut-complete-task", () => {
        const active = useAppStore.getState().todaySnapshot?.activeTask;
        if (active) void completeActive(active.task.id, active.projectId);
      }),
    );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const state = useAppStore.getState();
        if (state.detailOpen) state.setDetailOpen(false);
        else if (state.commandOpen) state.setCommandOpen(false);
        else if (state.recommendPrompt) state.dismissRecommend();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [applySnapshot, applyTodaySnapshot, setCommandOpen, completeActive]);

  return todaySnapshot;
}
