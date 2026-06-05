/**
 * Pure helper functions for interpreting DayRunwaySnapshot task state.
 * These mirror the Rust helpers (is_external_active / is_focus_active) so the
 * frontend routing logic stays in sync with the backend model.
 */

import type { DayRunwaySnapshot, TodayTaskContext } from "../../types";

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
