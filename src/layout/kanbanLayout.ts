import type { Edge, Node } from "@xyflow/react";

import type { Branch, Task, TaskDependency } from "../types";
import {
  KANBAN_ADD_TASK_HEIGHT,
  KANBAN_CARD_GAP,
  KANBAN_CARD_HEIGHT,
  KANBAN_CARD_WIDTH,
  KANBAN_COLUMN_GUTTER,
  KANBAN_COLUMN_WIDTH,
  KANBAN_HEADER_HEIGHT,
} from "./kanbanTokens";

export const COLUMN_WIDTH = KANBAN_COLUMN_WIDTH;
export const COLUMN_PADDING = KANBAN_COLUMN_GUTTER;
export const BRANCH_HEADER_WIDTH = KANBAN_CARD_WIDTH;
export const CARD_WIDTH = KANBAN_CARD_WIDTH;
export const CARD_HEIGHT = KANBAN_CARD_HEIGHT;
export const COLUMN_HEADER_HEIGHT = KANBAN_HEADER_HEIGHT;
export const CARD_GAP = KANBAN_CARD_GAP;
const ADD_TASK_HEIGHT = KANBAN_ADD_TASK_HEIGHT;

export interface KanbanLayoutResult {
  nodes: Node[];
  edges: Edge[];
  metrics: {
    totalWidth: number;
    totalHeight: number;
    columnCount: number;
  };
}

function defaultSort(a: Task, b: Task): number {
  const pa = a.priority ?? Number.MAX_SAFE_INTEGER;
  const pb = b.priority ?? Number.MAX_SAFE_INTEGER;
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

export function buildKanbanLayout(
  branches: Branch[],
  tasks: Task[],
  dependencies: TaskDependency[],
  hideDone = false,
): KanbanLayoutResult {
  const sortedBranches = [...branches].sort((a, b) => a.sortOrder - b.sortOrder);
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let maxColumnHeight = COLUMN_HEADER_HEIGHT;

  sortedBranches.forEach((branch, columnIndex) => {
    const columnLeft = columnIndex * COLUMN_WIDTH;
    const contentX = columnLeft + COLUMN_PADDING;
    const branchTasks = tasks.filter(
      (t) =>
        t.branchId === branch.id &&
        t.status !== "inbox" &&
        (!hideDone || t.status !== "done"),
    );

    const allInBranch = tasks.filter((t) => t.branchId === branch.id && t.status !== "inbox");
    const done = allInBranch.filter((t) => t.status === "done").length;
    const progress = allInBranch.length > 0 ? `${done}/${allInBranch.length}` : undefined;

    nodes.push({
      id: `header-${branch.id}`,
      type: "outcomeHeader",
      position: { x: contentX, y: 0 },
      data: {
        label: branch.name,
        branchId: branch.id,
        progress,
        columnIndex,
      },
      draggable: false,
    });

    const ordered = orderTasksInColumn(branchTasks, dependencies);
    ordered.forEach((task, index) => {
      const y = COLUMN_HEADER_HEIGHT + index * (CARD_HEIGHT + CARD_GAP);
      nodes.push({
        id: task.id,
        type: "action",
        position: { x: contentX, y },
        data: { task, outcomeName: branch.name },
      });
    });

    const addY = COLUMN_HEADER_HEIGHT + ordered.length * (CARD_HEIGHT + CARD_GAP) + CARD_GAP;
    nodes.push({
      id: `add-${branch.id}`,
      type: "addTask",
      position: { x: contentX, y: addY },
      data: { branchId: branch.id },
      draggable: false,
    });

    const colHeight = addY + ADD_TASK_HEIGHT;
    maxColumnHeight = Math.max(maxColumnHeight, colHeight);
  });

  const visibleTaskIds = new Set(
    nodes.filter((n) => n.type === "task").map((n) => n.id),
  );

  dependencies.forEach((dep) => {
    if (!visibleTaskIds.has(dep.taskId) || !visibleTaskIds.has(dep.dependsOnTaskId)) {
      return;
    }
    edges.push({
      id: `block-${dep.dependsOnTaskId}-${dep.taskId}`,
      source: dep.dependsOnTaskId,
      target: dep.taskId,
      type: "blocking",
    });
  });

  return {
    nodes,
    edges,
    metrics: {
      totalWidth: Math.max(sortedBranches.length, 1) * COLUMN_WIDTH,
      totalHeight: maxColumnHeight + 24,
      columnCount: sortedBranches.length,
    },
  };
}
