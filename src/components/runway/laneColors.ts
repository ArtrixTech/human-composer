import type { CSSProperties } from "react";

import type { DayLaneType } from "../../types";

export interface LaneColorSet {
  accent: string;
  muted: string;
}

/** Distinct hues for focus lanes — stable assignment by sort index among focus lanes. */
export const FOCUS_LANE_PALETTE: LaneColorSet[] = [
  { accent: "#6366f1", muted: "rgba(99, 102, 241, 0.14)" },
  { accent: "#0ea5e9", muted: "rgba(14, 165, 233, 0.14)" },
  { accent: "#10b981", muted: "rgba(16, 185, 129, 0.14)" },
  { accent: "#f59e0b", muted: "rgba(245, 158, 11, 0.14)" },
  { accent: "#ec4899", muted: "rgba(236, 72, 153, 0.14)" },
  { accent: "#8b5cf6", muted: "rgba(139, 92, 246, 0.14)" },
  { accent: "#14b8a6", muted: "rgba(20, 184, 166, 0.14)" },
  { accent: "#f97316", muted: "rgba(249, 115, 22, 0.14)" },
];

const LANE_COLORS_PREF_KEY = "hc-lane-colors-enabled";

export function readLaneColorsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(LANE_COLORS_PREF_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

export function writeLaneColorsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LANE_COLORS_PREF_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function focusLanePaletteIndex(laneId: string, indexAmongFocus: number): number {
  if (indexAmongFocus >= 0) return indexAmongFocus % FOCUS_LANE_PALETTE.length;
  let hash = 0;
  for (let i = 0; i < laneId.length; i++) {
    hash = (hash * 31 + laneId.charCodeAt(i)) >>> 0;
  }
  return hash % FOCUS_LANE_PALETTE.length;
}

export function laneColorStyle(
  laneType: DayLaneType,
  paletteIndex: number | null,
  enabled: boolean,
): CSSProperties | undefined {
  if (!enabled || laneType !== "focus" || paletteIndex === null) return undefined;
  const set = FOCUS_LANE_PALETTE[paletteIndex % FOCUS_LANE_PALETTE.length];
  return {
    "--lane-accent": set.accent,
    "--lane-accent-muted": set.muted,
  } as CSSProperties;
}

export function buildFocusLaneColorIndex(
  lanes: Array<{ id: string; laneType: DayLaneType; sortOrder: number }>,
): Map<string, number> {
  const map = new Map<string, number>();
  const focus = lanes
    .filter((l) => l.laneType === "focus")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  focus.forEach((lane, index) => map.set(lane.id, index));
  return map;
}
