import { useEffect } from "react";

import { CommandPalette } from "../command/CommandPalette";
import { DetailPanel } from "../detail/DetailPanel";
import { DAGCanvas } from "../dag/DAGCanvas";
import { InboxPanel } from "../inbox/InboxPanel";
import { RecommendPrompt } from "../recommend/RecommendPrompt";
import { ToastContainer } from "../toast/ToastContainer";
import { TodayView } from "../today/TodayView";
import { ProjectHeader } from "./ProjectHeader";
import { Sidebar } from "./Sidebar";
import { TitleBar } from "./TitleBar";
import { useGraphSync } from "../../hooks/useGraphSync";
import { useAppStore } from "../../store/appStore";
import "./AppShell.css";

export function AppShell() {
  const initialize = useAppStore((s) => s.initialize);
  const error = useAppStore((s) => s.error);
  const loading = useAppStore((s) => s.loading);
  const currentView = useAppStore((s) => s.currentView);
  const graph = useAppStore((s) => s.graph);

  useGraphSync();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <div className="app-shell">
      <TitleBar />
      <div className="app-shell__body">
        <Sidebar />
        <main className="app-shell__main">
          {error && <div className="app-shell__error">{error}</div>}
          {loading && !graph && currentView === "project" ? (
            <div className="app-shell__loading">加载中…</div>
          ) : currentView === "today" ? (
            <TodayView />
          ) : (
            <>
              <ProjectHeader />
              <div className="app-shell__workspace">
                <DAGCanvas />
                <DetailPanel />
              </div>
              <InboxPanel />
            </>
          )}
        </main>
      </div>
      <ToastContainer />
      <RecommendPrompt />
      <CommandPalette />
    </div>
  );
}
