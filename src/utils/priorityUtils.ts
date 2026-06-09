import type { PriorityLevel } from "../types";

export const PRIORITY_ORDER: PriorityLevel[] = ["H", "M", "L"];

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  H: "高",
  M: "中",
  L: "低",
};

export function nextPriority(current: PriorityLevel): PriorityLevel {
  if (current === "L") return "M";
  if (current === "M") return "H";
  return "L";
}

export function prioritySortKey(p: PriorityLevel): number {
  if (p === "H") return 0;
  if (p === "M") return 1;
  return 2;
}

export function priorityClassName(p: PriorityLevel): string {
  return `priority--${p.toLowerCase()}`;
}
