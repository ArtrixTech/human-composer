import type { LaneTier } from "../types";

export const LANE_TIER_ORDER: LaneTier[] = ["T1", "T2", "T3", "T4"];

export const LANE_TIER_LABELS: Record<LaneTier, string> = {
  T1: "主线",
  T2: "副线",
  T3: "次要",
  T4: "可选",
};

export function laneTierSortKey(tier: LaneTier): number {
  if (tier === "T1") return 0;
  if (tier === "T2") return 1;
  if (tier === "T3") return 2;
  return 3;
}

export function laneTierClassName(tier: LaneTier): string {
  return `tier-${tier.toLowerCase()}`;
}
