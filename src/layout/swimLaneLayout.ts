import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";

import type { Branch, Task, TaskDependency } from "../types";

const LANE_HEIGHT = 148;
const LANE_LABEL_WIDTH = 112;
const NODE_WIDTH = 196;
const NODE_HEIGHT = 64;
const LANE_PADDING_X = 24;

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

export function buildSwimLaneLayout(
  branches: Branch[],
  tasks: Task[],
  dependencies: TaskDependency[],
): LayoutResult {
  const branchTasks = branches.map((branch) =>
    tasks.filter((t) => t.branchId === branch.id && t.status !== "inbox"),
  );

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  branches.forEach((branch, branchIndex) => {
    const laneY = branchIndex * LANE_HEIGHT;

    nodes.push({
      id: `lane-${branch.id}`,
      type: "laneLabel",
      position: { x: 0, y: laneY + 28 },
      data: { label: branch.name },
      draggable: false,
      selectable: false,
    });

    const tasksInLane = branchTasks[branchIndex];
    let maxX = LANE_LABEL_WIDTH + LANE_PADDING_X;

    if (tasksInLane.length > 0) {
      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 56, marginx: 0, marginy: 0 });

      tasksInLane.forEach((task) => {
        g.setNode(task.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
      });

      const sorted = [...tasksInLane].sort((a, b) => a.sortOrder - b.sortOrder);
      for (let i = 0; i < sorted.length - 1; i++) {
        g.setEdge(sorted[i].id, sorted[i + 1].id);
        edges.push({
          id: `seq-${sorted[i].id}-${sorted[i + 1].id}`,
          source: sorted[i].id,
          target: sorted[i + 1].id,
          type: "sequential",
        });
      }

      dagre.layout(g);

      tasksInLane.forEach((task) => {
        const pos = g.node(task.id);
        const x = LANE_LABEL_WIDTH + LANE_PADDING_X + (pos?.x ?? 0) - NODE_WIDTH / 2;
        maxX = Math.max(maxX, x + NODE_WIDTH + 24);
        nodes.push({
          id: task.id,
          type: "task",
          position: {
            x,
            y: laneY + 12 + (pos?.y ?? 0) - NODE_HEIGHT / 2,
          },
          data: { task, branchName: branch.name },
        });
      });
    }

    nodes.push({
      id: `add-${branch.id}`,
      type: "addTask",
      position: { x: maxX, y: laneY + 28 },
      data: { branchId: branch.id },
      draggable: false,
    });
  });

  dependencies.forEach((dep) => {
    const sourceExists = nodes.some((n) => n.id === dep.dependsOnTaskId);
    const targetExists = nodes.some((n) => n.id === dep.taskId);
    if (!sourceExists || !targetExists) return;

    const sameBranch = tasks.find((t) => t.id === dep.taskId)?.branchId
      === tasks.find((t) => t.id === dep.dependsOnTaskId)?.branchId;

    if (sameBranch) return;

    edges.push({
      id: `block-${dep.dependsOnTaskId}-${dep.taskId}`,
      source: dep.dependsOnTaskId,
      target: dep.taskId,
      type: "blocking",
    });
  });

  return { nodes, edges };
}

export const layoutMetrics = {
  laneHeight: LANE_HEIGHT,
  laneCount: (branches: Branch[]) => Math.max(branches.length, 1),
};
