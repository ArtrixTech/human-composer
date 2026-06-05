import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, Clock, ExternalLink, Play } from "lucide-react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

import type { Branch, BranchSuggestion, DayRunwaySnapshot, TodayTaskContext } from "../../types";
import * as api from "../../api/tauri";
import {
  findFirstClaimable,
  isFocusActive,
  isExternalActive,
} from "../runway/runwayTaskUtils";
import { formatMinutesTotal } from "../runway/taskBlockUtils";
import { ExternalTaskDialog } from "../runway/ExternalTaskDialog";
import "./FloatingWidget.css";

function focusActiveTasks(snapshot: DayRunwaySnapshot | null): TodayTaskContext[] {
  if (!snapshot) return [];
  return snapshot.lanes.flatMap((l) => l.tasks.filter((t) => isFocusActive(t)));
}

type LaneState = "active" | "review" | "claimable" | "external" | "idle";

function laneState(
  lane: DayRunwaySnapshot["lanes"][0],
  claimableTaskId: string | null,
): { state: LaneState; task: TodayTaskContext | null } {
  const focusActive = lane.tasks.find((t) => isFocusActive(t));
  if (focusActive) return { state: "active", task: focusActive };

  const review = lane.tasks.find((t) => t.task.externalStatus === "needs_review");
  if (review) return { state: "review", task: review };

  const external = lane.tasks.find(
    (t) => isExternalActive(t) && t.task.externalStatus === "delegated",
  );
  if (external) return { state: "external", task: external };

  const claimable = lane.tasks.find(
    (t) => t.task.status === "ready" && t.task.id === claimableTaskId,
  );
  if (claimable) return { state: "claimable", task: claimable };

  return { state: "idle", task: null };
}

const STATE_LABEL: Record<LaneState, string> = {
  active: "进行中",
  review: "待审核",
  claimable: "可领取",
  external: "外部执行",
  idle: "空闲",
};

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
  const [branchSuggestion, setBranchSuggestion] = useState<BranchSuggestion | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [delegateTarget, setDelegateTarget] = useState<{
    ctx: TodayTaskContext;
    laneId: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return () => {
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2000);
  };

  const resetPick = () => {
    setPhase("typing");
    setPickGroups([]);
    setCreateProjectId(null);
    setBranchSuggestion(null);
    setPendingTaskId(null);
  };

  const resize = async (next: boolean) => {
    setExpanded(next);
    const win = getCurrentWindow();
    if (next) {
      await win.setSize(new LogicalSize(320, phase === "picking" ? 460 : 420));
    } else {
      await win.setSize(new LogicalSize(300, 52));
      resetPick();
    }
  };

  const actives = focusActiveTasks(snapshot);
  const primary = actives[0];
  const primaryLane = snapshot?.lanes.find((l) =>
    l.tasks.some((t) => primary && t.task.id === primary.task.id),
  );
  const claimable = snapshot ? findFirstClaimable(snapshot) : null;
  const claimableTaskId = claimable?.ctx.task.id ?? null;
  const needsReviewCount =
    snapshot?.lanes
      .flatMap((l) => l.tasks)
      .filter((t) => t.task.externalStatus === "needs_review").length ?? 0;

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
    await api.completeTask(ctx.task.id, ctx.projectId);
    setSnapshot(await api.getDayRunwaySnapshot());
    if (!expanded) void resize(true);
  };

  const postpone = async (ctx: TodayTaskContext, laneId: string) => {
    await api.postponeTask(ctx.task.id, laneId, ctx.projectId);
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
    await api.completeExternalTask(ctx.task.id, ctx.projectId);
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
      if (graph.branches.length === 0) continue;
      groups.push({
        projectId: project.id,
        projectName: project.name,
        branches: graph.branches,
      });
    }
    setPickGroups(groups);
    setCreateProjectId(projectId);
    setBranchSuggestion(result.branchSuggestion ?? null);
    setPendingTaskId(result.task.id);
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

  if (!expanded) {
    const label = primary?.task.title ?? claimable?.ctx.task.title ?? "选择任务…";
    const laneName = primaryLane?.lane.name ?? claimable?.laneId
      ? snapshot?.lanes.find((l) => l.lane.id === claimable?.laneId)?.lane.name
      : undefined;
    const dotClass = primary
      ? "floating__dot--active"
      : claimable
        ? "floating__dot--claimable"
        : needsReviewCount > 0
          ? "floating__dot--review"
          : "floating__dot--idle";

    return (
      <>
        <div className="floating floating--collapsed">
          <div className="floating__drag-zone" data-tauri-drag-region="deep">
            <span className={`floating__dot ${dotClass}`} />
            <div className="floating__collapsed-main">
              <span className="floating__task-name">{label}</span>
              {laneName && <span className="floating__lane-name">{laneName}</span>}
            </div>
            {needsReviewCount > 0 && (
              <span className="floating__badge">{needsReviewCount}</span>
            )}
          </div>
          {primary && primaryLane && (
            <div className="floating__quick-actions">
              <button
                type="button"
                className="floating__icon-btn floating__icon-btn--done"
                title="完成"
                aria-label="完成"
                onClick={() => void complete(primary)}
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                className="floating__icon-btn floating__icon-btn--postpone"
                title="稍后再做"
                aria-label="稍后"
                onClick={() => void postpone(primary, primaryLane.lane.id)}
              >
                <Clock size={14} />
              </button>
              {primary.task.taskType === "normal" && primaryLane.lane.laneType !== "watch" && (
                <button
                  type="button"
                  className="floating__icon-btn floating__icon-btn--delegate"
                  title="委派外部执行"
                  aria-label="委派"
                  onClick={() => openDelegate(primary, primaryLane.lane.id)}
                >
                  <Bot size={14} />
                </button>
              )}
            </div>
          )}
          {!primary && claimable && (
            <button
              type="button"
              className="floating__icon-btn floating__icon-btn--claim"
              title="领取"
              aria-label="领取"
              onClick={() =>
                void claim(claimable.ctx.task.id, claimable.laneId, claimable.ctx.projectId)
              }
            >
              <Play size={14} />
            </button>
          )}
          <button type="button" className="floating__icon-btn" onClick={() => void resize(true)}>
            <ChevronDown size={14} />
          </button>
        </div>
        {delegateTarget && (
          <ExternalTaskDialog
            ctx={delegateTarget.ctx}
            laneId={delegateTarget.laneId}
            onClose={() => {
              setDelegateTarget(null);
              void refreshSnapshot();
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="floating floating--expanded">
      <header className="floating__header">
        <div className="floating__header-meta floating__drag-zone" data-tauri-drag-region="deep">
          <span>{dateStr}</span>
          {finishHint && <span className="floating__header-budget">{finishHint}</span>}
          {snapshot?.timeBudget.remainingMinutes != null && snapshot.timeBudget.remainingMinutes > 0 && (
            <span className="floating__header-budget">
              剩余 {formatMinutesTotal(snapshot.timeBudget.remainingMinutes)}
            </span>
          )}
        </div>
        <div className="floating__header-actions">
          <button type="button" onClick={() => void api.showMainWindow()} title="打开主窗口">
            <ExternalLink size={14} />
          </button>
          <button type="button" className="floating__collapse" onClick={() => void resize(false)}>
            —
          </button>
        </div>
      </header>

      <div className="floating__lanes">
        {snapshot?.lanes.map((lane) => {
          const { state, task } = laneState(lane, claimableTaskId);
          const isWatch = lane.lane.laneType === "watch";
          return (
            <section
              key={lane.lane.id}
              className={`floating__lane floating__lane--${isWatch ? "watch" : "focus"} floating__lane--${state}`}
            >
              <div className="floating__lane-header">
                <span className="floating__lane-name">{lane.lane.name}</span>
                <span className="floating__lane-state">{STATE_LABEL[state]}</span>
              </div>
              {task ? (
                <div className="floating__lane-row">
                  <span className="floating__lane-task">{task.task.title}</span>
                  {state === "active" && (
                    <div className="floating__lane-actions floating__quick-actions">
                      <button
                        type="button"
                        className="floating__icon-btn floating__icon-btn--done"
                        title="完成"
                        aria-label="完成"
                        onClick={() => void complete(task)}
                      >
                        <Check size={14} />
                      </button>
                      {!isWatch && (
                        <button
                          type="button"
                          className="floating__icon-btn floating__icon-btn--postpone"
                          title="稍后再做"
                          aria-label="稍后"
                          onClick={() => void postpone(task, lane.lane.id)}
                        >
                          <Clock size={14} />
                        </button>
                      )}
                      {!isWatch && task.task.taskType === "normal" && (
                        <button
                          type="button"
                          className="floating__icon-btn floating__icon-btn--delegate"
                          title="委派外部执行"
                          aria-label="委派"
                          onClick={() => openDelegate(task, lane.lane.id)}
                        >
                          <Bot size={14} />
                        </button>
                      )}
                    </div>
                  )}
                  {state === "claimable" && (
                    <button
                      type="button"
                      className="floating__cta floating__cta--claim"
                      onClick={() => void claim(task.task.id, lane.lane.id, task.projectId)}
                    >
                      领取
                    </button>
                  )}
                  {state === "external" && (
                    <button type="button" className="floating__cta floating__cta--ghost" onClick={() => void markExternalDone(task)}>
                      标记完成
                    </button>
                  )}
                  {state === "review" && (
                    <button type="button" className="floating__cta floating__cta--review" onClick={() => void api.showMainWindow()}>
                      审核
                    </button>
                  )}
                </div>
              ) : (
                <p className="floating__lane-empty">暂无任务</p>
              )}
            </section>
          );
        })}
      </div>

      {snapshot && snapshot.lanes.length === 0 && (
        <p className="floating__lane-empty floating__lane-empty--page">暂无泳道</p>
      )}

      <footer className="floating__footer">
        {phase === "picking" ? (
          <div className="floating__pick">
            <p className="floating__pick-label">选择支线</p>
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
                          branchSuggestion?.branchId === b.id &&
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
        {feedback && <p className="floating__feedback">{feedback}</p>}
      </footer>

      {delegateTarget && (
        <ExternalTaskDialog
          ctx={delegateTarget.ctx}
          laneId={delegateTarget.laneId}
          onClose={() => {
            setDelegateTarget(null);
            void refreshSnapshot();
          }}
        />
      )}
    </div>
  );
}
