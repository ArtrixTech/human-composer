import type { DayLaneSnapshot, RecommendedTask } from "../../types";
import { findLaneClaimableOptions, getLaneState } from "../runway/runwayTaskUtils";

export const FLOATING_WIDTH = 300;
export const COLLAPSED_ROW_H = 36;
const EXPANDED_HEADER_H = 52;
const EXPANDED_FOOTER_H = 48;
const EXPANDED_FOOTER_PICKING_EXTRA = 40;
const EXPANDED_ROW_H = 44;
const EXPANDED_CLAIMABLE_ROW_H = 52;
const EXPANDED_EMPTY_LANE_H = 48;

export function computeCollapsedHeight(laneCount: number): number {
  return Math.max(laneCount, 1) * COLLAPSED_ROW_H;
}

export function computeExpandedHeight(
  lanes: DayLaneSnapshot[],
  recommendations: RecommendedTask[],
  phase: "typing" | "picking",
): number {
  const footerExtra = phase === "picking" ? EXPANDED_FOOTER_PICKING_EXTRA : 0;
  if (lanes.length === 0) {
    return EXPANDED_HEADER_H + EXPANDED_EMPTY_LANE_H + EXPANDED_FOOTER_H + footerExtra;
  }

  const lanesHeight = lanes.reduce((sum, lane) => {
    const { state } = getLaneState(lane);
    const options = findLaneClaimableOptions(lane, recommendations);
    if (state === "claimable" && options.length > 0) {
      return sum + EXPANDED_CLAIMABLE_ROW_H;
    }
    return sum + EXPANDED_ROW_H;
  }, 0);

  return EXPANDED_HEADER_H + lanesHeight + EXPANDED_FOOTER_H + footerExtra;
}

export function computeFloatingSize(
  expanded: boolean,
  laneCount: number,
  phase: "typing" | "picking",
  lanes: DayLaneSnapshot[] = [],
  recommendations: RecommendedTask[] = [],
): { width: number; height: number } {
  if (!expanded) {
    return { width: FLOATING_WIDTH, height: computeCollapsedHeight(laneCount) };
  }
  return {
    width: FLOATING_WIDTH,
    height: computeExpandedHeight(lanes, recommendations, phase),
  };
}
