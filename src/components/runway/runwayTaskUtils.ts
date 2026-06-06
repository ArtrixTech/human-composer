/**
 * Pure helper functions for interpreting DayRunwaySnapshot task state.
 * These mirror the Rust helpers (is_external_active / is_focus_active) so the
 * frontend routing logic stays in sync with the backend model.
 */

import type {
  DayLaneSnapshot,
  DayRunwaySnapshot,
  RecommendedTask,
  TodayTaskContext,
} from "../../types";

export type LaneState = "active" | "review" | "claimable" | "external" | "idle";

export interface LaneCtx {
  ctx: TodayTaskContext;
  laneId: string;
  laneName: string;
}

/** A task that is actively being worked on by the user (not delegated externally). */
export function isFocusActive(ctx: TodayTaskContext): boolean {
  return (
    ctx.task.status === "active" &&
    !(ctx.task.taskType === "external" &&
      (ctx.task.externalStatus === "delegated" ||
        ctx.task.externalStatus === "needs_review"))
  );
}

/** A task that is externally delegated or awaiting review. */
export function isExternalActive(ctx: TodayTaskContext): boolean {
  return (
    ctx.task.taskType === "external" &&
    (ctx.task.externalStatus === "delegated" ||
      ctx.task.externalStatus === "needs_review")
  );
}

/** Ready task eligible for claim (skips postponed unless fallback). */
export function isClaimCandidate(ctx: TodayTaskContext): boolean {
  return (
    ctx.task.status === "ready" &&
    !ctx.task.postponed &&
    !isExternalActive(ctx)
  );
}

/** Index of the next claimable task in a lane; falls back to first postponed ready. */
export function findFirstClaimableIndex(tasks: TodayTaskContext[]): number {
  const candidate = tasks.findIndex(isClaimCandidate);
  if (candidate >= 0) return candidate;
  return tasks.findIndex(
    (t) => t.task.status === "ready" && !isExternalActive(t),
  );
}

/** All focus-active tasks across all lanes, in lane order. */
export function findFocusActives(snapshot: DayRunwaySnapshot): LaneCtx[] {
  const result: LaneCtx[] = [];
  for (const lane of snapshot.lanes) {
    for (const ctx of lane.tasks) {
      if (isFocusActive(ctx)) {
        result.push({ ctx, laneId: lane.lane.id, laneName: lane.lane.name });
      }
    }
  }
  return result;
}

/** All externally-running or needs-review tasks across all lanes. */
export function findWatchTasks(snapshot: DayRunwaySnapshot): LaneCtx[] {
  const result: LaneCtx[] = [];
  for (const lane of snapshot.lanes) {
    for (const ctx of lane.tasks) {
      if (isExternalActive(ctx)) {
        result.push({ ctx, laneId: lane.lane.id, laneName: lane.lane.name });
      }
    }
  }
  return result;
}

/** Tasks awaiting user review (external completed, not yet approved/reworked). */
export function findNeedsReview(snapshot: DayRunwaySnapshot): LaneCtx[] {
  return findWatchTasks(snapshot).filter(
    (lc) => lc.ctx.task.externalStatus === "needs_review",
  );
}

/**
 * The first ready task the user can claim next.
 * Skips watch lanes — those only hold external tasks.
 */
export function findFirstClaimable(snapshot: DayRunwaySnapshot): LaneCtx | null {
  for (const lane of snapshot.lanes) {
    if (lane.lane.laneType === "watch") continue;
    const idx = findFirstClaimableIndex(lane.tasks);
    if (idx >= 0) {
      return { ctx: lane.tasks[idx], laneId: lane.lane.id, laneName: lane.lane.name };
    }
  }
  return null;
}

/** Ready tasks in a lane eligible for claim. */
export function filterLaneClaimCandidates(lane: DayLaneSnapshot): TodayTaskContext[] {
  if (lane.lane.laneType === "watch") return [];
  return lane.tasks.filter((t) => t.task.status === "ready" && !isExternalActive(t));
}

/** Claimable tasks in a lane sorted by global recommendation order. */
export function findLaneClaimableOptions(
  lane: DayLaneSnapshot,
  recommendations: RecommendedTask[],
): TodayTaskContext[] {
  const candidates = filterLaneClaimCandidates(lane);
  if (candidates.length === 0) return [];

  const orderMap = new Map(recommendations.map((r, i) => [r.task.id, i]));

  return [...candidates].sort((a, b) => {
    const oa = orderMap.get(a.task.id);
    const ob = orderMap.get(b.task.id);
    if (oa !== undefined && ob !== undefined) return oa - ob;
    if (oa !== undefined) return -1;
    if (ob !== undefined) return 1;
    if (!a.task.postponed && b.task.postponed) return -1;
    if (a.task.postponed && !b.task.postponed) return 1;
    return a.task.title.localeCompare(b.task.title, "zh-CN");
  });
}

/** Next claimable task within a single lane (per-lane, not global first). */
export function findLaneClaimable(lane: DayLaneSnapshot): TodayTaskContext | null {
  const idx = findFirstClaimableIndex(lane.tasks);
  return idx >= 0 ? lane.tasks[idx] : null;
}

/** Split lane tasks: focus queue first, external/delegated always last. */
export function partitionLaneTasks(tasks: TodayTaskContext[]): {
  focus: TodayTaskContext[];
  external: TodayTaskContext[];
} {
  const focus: TodayTaskContext[] = [];
  const external: TodayTaskContext[] = [];
  for (const ctx of tasks) {
    if (isExternalActive(ctx)) external.push(ctx);
    else focus.push(ctx);
  }
  return { focus, external };
}

/** Keep external task ids at the end after a drag reorder. */
export function normalizeLaneTaskOrder(
  tasks: TodayTaskContext[],
  orderedIds: string[],
): string[] {
  const externalIds = new Set(
    tasks.filter((t) => isExternalActive(t)).map((t) => t.task.id),
  );
  const focusIds = orderedIds.filter((id) => !externalIds.has(id));
  const extIds = orderedIds.filter((id) => externalIds.has(id));
  return [...focusIds, ...extIds];
}

/** Focus lanes first, watch (external) lanes last for display. */
export function sortLanesForDisplay(lanes: DayLaneSnapshot[]): DayLaneSnapshot[] {
  return [...lanes].sort((a, b) => {
    const aWatch = a.lane.laneType === "watch";
    const bWatch = b.lane.laneType === "watch";
    if (aWatch !== bWatch) return aWatch ? 1 : -1;
    return a.lane.sortOrder - b.lane.sortOrder;
  });
}

/** Pin watch lanes after focus lanes when reordering. */
export function normalizeLaneOrder(
  lanes: DayLaneSnapshot[],
  orderedIds: string[],
): string[] {
  const watchIds = new Set(
    lanes.filter((l) => l.lane.laneType === "watch").map((l) => l.lane.id),
  );
  const focusIds = orderedIds.filter((id) => !watchIds.has(id));
  const watch = orderedIds.filter((id) => watchIds.has(id));
  return [...focusIds, ...watch];
}

/** Resolve the primary actionable task and state for a lane row. */
export function getLaneState(
  lane: DayLaneSnapshot,
): { state: LaneState; task: TodayTaskContext | null } {
  const focusActive = lane.tasks.find((t) => isFocusActive(t));
  if (focusActive) return { state: "active", task: focusActive };

  const review = lane.tasks.find((t) => t.task.externalStatus === "needs_review");
  if (review) return { state: "review", task: review };

  const external = lane.tasks.find(
    (t) => isExternalActive(t) && t.task.externalStatus === "delegated",
  );
  if (external) return { state: "external", task: external };

  const claimable = findLaneClaimable(lane);
  if (claimable) return { state: "claimable", task: claimable };

  return { state: "idle", task: null };
}
