import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import type { AppSnapshot, DayRunwaySnapshot } from "../types";
import { getFirstActiveTask, useAppStore } from "../store/appStore";

export function useGraphSync() {
  const selectTodayView = useAppStore((s) => s.selectTodayView);
  const applySnapshot = useAppStore((s) => s.applySnapshot);
  const applyRunwaySnapshot = useAppStore((s) => s.applyRunwaySnapshot);
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const completeActive = useAppStore((s) => s.completeTask);
  const runwaySnapshot = useAppStore((s) => s.runwaySnapshot);

  useEffect(() => {
    const unsubs: Array<Promise<() => void>> = [];

    unsubs.push(
      listen<AppSnapshot>("graph-updated", (event) => {
        void applySnapshot(event.payload);
      }),
    );
    unsubs.push(
      listen<DayRunwaySnapshot>("runway-updated", (event) => {
        applyRunwaySnapshot(event.payload);
      }),
    );
    unsubs.push(
      listen<DayRunwaySnapshot>("today-updated", (event) => {
        applyRunwaySnapshot(event.payload);
      }),
    );
    unsubs.push(listen("shortcut-command-palette", () => setCommandOpen(true)));
    unsubs.push(listen("shortcut-quick-add", () => setCommandOpen(true)));
    unsubs.push(listen("main-show-today", () => void selectTodayView()));
    unsubs.push(
      listen("shortcut-complete-task", () => {
        const active = getFirstActiveTask();
        if (active) void completeActive(active.task.id, active.projectId);
      }),
    );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const state = useAppStore.getState();
        if (state.detailOpen) state.setDetailOpen(false);
        else if (state.commandOpen) state.setCommandOpen(false);
        else if (state.addLaneOpen) state.setAddLaneOpen(false);
        else if (state.recommendPrompt) state.dismissRecommend();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [applySnapshot, applyRunwaySnapshot, setCommandOpen, completeActive, selectTodayView]);

  return runwaySnapshot;
}
