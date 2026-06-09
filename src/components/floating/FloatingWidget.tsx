import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

import type { Branch, BranchSuggestion, DayRunwaySnapshot, TodayTaskContext } from "../../types";
import * as api from "../../api/tauri";
import { formatMinutesTotal } from "../runway/taskBlockUtils";
import { ExternalTaskDialog } from "../runway/ExternalTaskDialog";
import { buildFocusLaneColorIndex } from "../runway/laneColors";
import { sortLanesForDisplay } from "../runway/runwayTaskUtils";
import { FloatingLaneRow } from "./FloatingLaneRow";
import { FLOATING_WIDTH } from "./floatingSize";
import "./FloatingWidget.css";

type FooterPhase = "typing" | "picking";

interface PickProjectGroup {
  projectId: string;
  projectName: string;
  branches: Branch[];
}

async function resolveProjectId(): Promise<string | null> {
  try {
    const snap = await api.getAppSnapshot();
    if (snap.projectId) return snap.projectId;
  } catch {
    /* fallback */
  }
  const projects = await api.listProjects();
  return projects[0]?.id ?? null;
}

export function FloatingWidget() {
  const [snapshot, setSnapshot] = useState<DayRunwaySnapshot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<FooterPhase>("typing");
  const [pickGroups, setPickGroups] = useState<PickProjectGroup[]>([]);
  const [createProjectId, setCreateProjectId] = useState<string | null>(null);
  const [outcomeSuggestion, setBranchSuggestion] = useState<BranchSuggestion | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [delegateTarget, setDelegateTarget] = useState<{
    ctx: TodayTaskContext;
    laneId: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const lanes = sortLanesForDisplay(snapshot?.lanes ?? []);
  const focusColorIndex = buildFocusLaneColorIndex(
    lanes.map((l) => ({
      id: l.lane.id,
      laneType: l.lane.laneType,
      sortOrder: l.lane.sortOrder,
    })),
  );
  const laneCount = lanes.length;
  const recommendations = snapshot?.recommendations ?? [];

  const syncWindowSize = async () => {
    const el = contentRef.current;
    if (!el) return;
    const height = Math.ceil(el.getBoundingClientRect().height);
    if (height <= 0) return;
    await getCurrentWindow().setSize(new LogicalSize(FLOATING_WIDTH, height));
  };

  useEffect(() => {
    if (phase !== "picking") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipAssign();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  useEffect(() => {
    void api.getDayRunwaySnapshot().then(setSnapshot);
    const unsubs: Promise<() => void>[] = [];
    unsubs.push(listen<DayRunwaySnapshot>("runway-updated", (e) => setSnapshot(e.payload)));
    unsubs.push(listen<DayRunwaySnapshot>("today-updated", (e) => setSnapshot(e.payload)));
    unsubs.push(
      listen("floating-focus-input", () => {
        void resize(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }),
    );
    unsubs.push(
      listen("floating-toggle-expand", () => {
        setExpanded((prev) => {
          if (prev) resetPick();
          return !prev;
        });
      }),
    );
    return () => {
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  useLayoutEffect(() => {
    void syncWindowSize();
  }, [expanded, laneCount, phase, snapshot, lanes, recommendations]);

  const showFeedback = (msg: string) => {
    void api.showFloatingNotice(msg);
  };

  const resetPick = () => {
    setPhase("typing");
    setPickGroups([]);
    setCreateProjectId(null);
    setBranchSuggestion(null);
    setPendingTaskId(null);
  };

  const resize = (next: boolean) => {
    setExpanded(next);
    if (!next) resetPick();
  };

  const dateStr = snapshot
    ? new Date(snapshot.date + "T12:00:00").toLocaleDateString("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    : "";
  const finishHint = snapshot?.timeBudget.estimatedFinishTime
    ? `预计 ${snapshot.timeBudget.estimatedFinishTime} 收工`
    : null;

  const complete = async (ctx: TodayTaskContext) => {
    await api.completeTask(ctx.action.id, ctx.projectId);
    setSnapshot(await api.getDayRunwaySnapshot());
    showFeedback("已完成");
  };

  const postpone = async (ctx: TodayTaskContext, laneId: string) => {
    await api.postponeTask(ctx.action.id, laneId, ctx.projectId);
    setSnapshot(await api.getDayRunwaySnapshot());
    showFeedback("已标记稍后");
  };

  const openDelegate = (ctx: TodayTaskContext, laneId: string) => {
    setDelegateTarget({ ctx, laneId });
  };

  const refreshSnapshot = async () => {
    setSnapshot(await api.getDayRunwaySnapshot());
  };

  const claim = async (taskId: string, laneId: string, projectId: string) => {
    await api.claimTask(taskId, laneId, projectId);
    setSnapshot(await api.getDayRunwaySnapshot());
  };

  const markExternalDone = async (ctx: TodayTaskContext) => {
    await api.completeExternalTask(ctx.action.id, ctx.projectId);
    setSnapshot(await api.getDayRunwaySnapshot());
  };

  const startCreate = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const projectId = await resolveProjectId();
    if (!projectId) {
      showFeedback("无可用项目");
      return;
    }
    const result = await api.createTask(projectId, trimmed);
    setTitle("");
    const projects = await api.listProjects();
    const groups: PickProjectGroup[] = [];
    for (const project of projects) {
      const graph = await api.getProjectGraph(project.id);
      if (graph.outcomes.length === 0) continue;
      groups.push({
        projectId: project.id,
        projectName: project.name,
        branches: graph.outcomes,
      });
    }
    setPickGroups(groups);
    setCreateProjectId(projectId);
    setBranchSuggestion(result.outcomeSuggestion ?? null);
    setPendingTaskId(result.action.id);
    setPhase("picking");
    void resize(true);
  };

  const assignBranch = async (branchId: string, branchName: string, projectName: string) => {
    if (!pendingTaskId) return;
    await api.assignTaskToBranch(pendingTaskId, branchId);
    resetPick();
    setSnapshot(await api.getDayRunwaySnapshot());
    showFeedback(`已分配到 ${projectName} · ${branchName}`);
    inputRef.current?.focus();
  };

  const skipAssign = () => {
    resetPick();
    showFeedback("已加入 Inbox");
    inputRef.current?.focus();
  };

  const openMainApp = () => void api.showMainWindow();

  const laneRowProps = {
    recommendations,
    onComplete: (ctx: TodayTaskContext) => void complete(ctx),
    onPostpone: (ctx: TodayTaskContext, laneId: string) => void postpone(ctx, laneId),
    onClaim: (taskId: string, laneId: string, projectId: string) => void claim(taskId, laneId, projectId),
    onDelegate: openDelegate,
    onMarkExternalDone: (ctx: TodayTaskContext) => void markExternalDone(ctx),
    onReview: openMainApp,
  };

  const delegateDialog = delegateTarget ? (
    <ExternalTaskDialog
      ctx={delegateTarget.ctx}
      laneId={delegateTarget.laneId}
      onClose={() => {
        setDelegateTarget(null);
        void refreshSnapshot();
      }}
    />
  ) : null;

  return (
    <>
      <div className="floating-shell">
        {!expanded ? (
          <div ref={contentRef} className="floating floating--collapsed">
            <div
              className="floating__collapsed-lanes"
              data-tauri-drag-region="deep"
              onDoubleClick={openMainApp}
              title="双击打开主窗口"
            >
              {lanes.map((lane) => (
                <FloatingLaneRow
                  key={lane.lane.id}
                  laneSnapshot={lane}
                  variant="compact"
                  focusColorIndex={focusColorIndex.get(lane.lane.id) ?? null}
                  {...laneRowProps}
                />
              ))}
              {snapshot && lanes.length === 0 && (
                <p className="floating__lane-empty floating__lane-empty--collapsed">暂无泳道</p>
              )}
            </div>
            <button
              type="button"
              className="floating__expand-btn"
              title="展开"
              aria-label="展开"
              onClick={() => void resize(true)}
            >
              <ChevronDown size={14} />
            </button>
          </div>
        ) : (
          <div ref={contentRef} className="floating floating--expanded">
            <header className="floating__header">
              <div
                className="floating__header-meta floating__drag-zone"
                data-tauri-drag-region="deep"
                onDoubleClick={openMainApp}
                title="双击打开主窗口"
              >
                <span>{dateStr}</span>
                {finishHint && <span className="floating__header-budget">{finishHint}</span>}
                {snapshot?.timeBudget.remainingMinutes != null &&
                  snapshot.timeBudget.remainingMinutes > 0 && (
                    <span className="floating__header-budget">
                      剩余 {formatMinutesTotal(snapshot.timeBudget.remainingMinutes)}
                    </span>
                  )}
              </div>
              <div className="floating__header-actions">
                <button type="button" onClick={openMainApp} title="打开主窗口">
                  <ExternalLink size={14} />
                </button>
                <button type="button" className="floating__collapse" onClick={() => void resize(false)}>
                  —
                </button>
              </div>
            </header>

            <div className="floating__lanes">
              {lanes.map((lane) => (
                <FloatingLaneRow
                  key={lane.lane.id}
                  laneSnapshot={lane}
                  variant="comfortable"
                  focusColorIndex={focusColorIndex.get(lane.lane.id) ?? null}
                  {...laneRowProps}
                />
              ))}
              {snapshot && lanes.length === 0 && (
                <p className="floating__lane-empty floating__lane-empty--page">暂无泳道</p>
              )}
            </div>

            <footer className="floating__footer">
              {phase === "picking" ? (
                <div className="floating__pick">
                  <p className="floating__pick-label">选择目标</p>
                  <div className="floating__pick-groups">
                    {pickGroups.map((group) => (
                      <section key={group.projectId} className="floating__pick-group">
                        <h4
                          className={`floating__pick-project ${group.projectId === createProjectId ? "floating__pick-project--source" : ""}`}
                        >
                          {group.projectName}
                          {group.projectId === createProjectId && (
                            <span className="floating__pick-project-tag">当前</span>
                          )}
                        </h4>
                        <div className="floating__pick-chips">
                          {group.branches.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              className={
                                outcomeSuggestion?.branchId === b.id &&
                                group.projectId === createProjectId
                                  ? "floating__pick-chip floating__pick-chip--suggested"
                                  : "floating__pick-chip"
                              }
                              onClick={() => void assignBranch(b.id, b.name, group.projectName)}
                            >
                              {b.name}
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                  <button type="button" className="floating__pick-skip" onClick={skipAssign}>
                    跳过（仅 Inbox）
                  </button>
                </div>
              ) : (
                <input
                  ref={inputRef}
                  placeholder="快速添加…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void startCreate();
                  }}
                />
              )}
            </footer>
          </div>
        )}
      </div>
      {delegateDialog}
    </>
  );
}
