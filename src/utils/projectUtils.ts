import type { PriorityLevel } from "../types";

export const PROJECT_COLORS = [
  "#f97316",
  "#5e6ad2",
  "#22c55e",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#eab308",
] as const;

export const PROJECT_ICONS = [
  "folder",
  "rocket",
  "target",
  "zap",
  "flask",
  "palette",
  "chart",
  "wrench",
] as const;

export type ProjectIconKey = (typeof PROJECT_ICONS)[number];

const EMOJI_TO_KEY: Record<string, ProjectIconKey> = {
  "📁": "folder",
  "🚀": "rocket",
  "🎯": "target",
  "⚡": "zap",
  "🔬": "flask",
  "🎨": "palette",
  "📊": "chart",
  "🛠️": "wrench",
  "🛠": "wrench",
};

export function normalizeProjectIcon(icon: string): ProjectIconKey {
  if ((PROJECT_ICONS as readonly string[]).includes(icon)) {
    return icon as ProjectIconKey;
  }
  return EMOJI_TO_KEY[icon] ?? "folder";
}

export function projectPriorityClass(p: PriorityLevel): string {
  return `project-priority--${p.toLowerCase()}`;
}
