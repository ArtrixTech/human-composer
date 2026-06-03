import type { Task, TaskDependency } from "../../types";

export function blockerTitles(
  taskId: string,
  tasks: Task[],
  dependencies: TaskDependency[],
): string[] {
  return dependencies
    .filter((d) => d.taskId === taskId)
    .map((d) => tasks.find((t) => t.id === d.dependsOnTaskId)?.title)
    .filter((t): t is string => Boolean(t));
}

export function blockedCount(taskId: string, dependencies: TaskDependency[]): number {
  return dependencies.filter((d) => d.dependsOnTaskId === taskId).length;
}

export function nextPriority(current: number | null): number | null {
  if (current == null) return 1;
  if (current >= 5) return null;
  return current + 1;
}

export function formatEstimate(minutes: number | null): string {
  if (minutes == null || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}
