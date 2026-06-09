import type { Action, ActionDependency } from "../types";

/** @deprecated Use Action */
type Task = Action;
/** @deprecated Use ActionDependency */
type TaskDependency = ActionDependency;

function priorityKey(p: Task["priority"]): number {
  if (p === "H") return 0;
  if (p === "M") return 1;
  return 2;
}

function defaultSort(a: Task, b: Task): number {
  const pa = priorityKey(a.priority);
  const pb = priorityKey(b.priority);
  if (pa !== pb) return pa - pb;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.createdAt.localeCompare(b.createdAt);
}

/** Topological order: blockers above blocked tasks. Falls back to defaultSort on cycle. */
export function orderTasksInColumn(tasks: Task[], dependencies: TaskDependency[]): Task[] {
  if (tasks.length === 0) return [];

  const ids = new Set(tasks.map((t) => t.id));
  const inColumnDeps = dependencies.filter(
    (d) => ids.has(d.taskId) && ids.has(d.dependsOnTaskId),
  );

  if (inColumnDeps.length === 0) {
    return [...tasks].sort(defaultSort);
  }

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const t of tasks) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }

  for (const d of inColumnDeps) {
    adj.get(d.dependsOnTaskId)!.push(d.taskId);
    inDegree.set(d.taskId, (inDegree.get(d.taskId) ?? 0) + 1);
  }

  const queue: Task[] = tasks
    .filter((t) => (inDegree.get(t.id) ?? 0) === 0)
    .sort(defaultSort);

  const ordered: Task[] = [];
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  while (queue.length > 0) {
    queue.sort(defaultSort);
    const current = queue.shift()!;
    ordered.push(current);

    for (const nextId of adj.get(current.id) ?? []) {
      const deg = (inDegree.get(nextId) ?? 1) - 1;
      inDegree.set(nextId, deg);
      if (deg === 0) {
        const next = taskById.get(nextId);
        if (next) queue.push(next);
      }
    }
  }

  if (ordered.length !== tasks.length) {
    return [...tasks].sort(defaultSort);
  }

  return ordered;
}
