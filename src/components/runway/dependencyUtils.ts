import type { TaskDependency, TodayTaskContext } from "../../types";

export function buildBlockerMap(
  dependencies: TaskDependency[],
  tasksById: Map<string, TodayTaskContext>,
): Map<string, string[]> {
  const blockers = new Map<string, string[]>();
  for (const dep of dependencies) {
    if (!tasksById.has(dep.dependsOnTaskId)) continue;
    const upstream = tasksById.get(dep.dependsOnTaskId)!;
    if (upstream.task.status === "done") continue;
    const list = blockers.get(dep.taskId) ?? [];
    list.push(upstream.task.title);
    blockers.set(dep.taskId, list);
  }
  return blockers;
}

export function hasDependencyEdge(
  dependencies: TaskDependency[],
  fromTaskId: string,
  toTaskId: string,
): boolean {
  return dependencies.some(
    (d) => d.dependsOnTaskId === fromTaskId && d.taskId === toTaskId,
  );
}
