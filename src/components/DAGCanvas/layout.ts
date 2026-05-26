import type { Edge, Node } from '@xyflow/react';
import type { Branch, Task } from '../../types';

export const LANE_HEIGHT = 130;
export const LANE_GAP = 1;
export const TASK_WIDTH = 210;
export const TASK_HEIGHT = 84;
export const TASK_STEP_X = 270;
export const TASK_START_X = 168;
const LANE_PADDING_Y = (LANE_HEIGHT - TASK_HEIGHT) / 2;

export function buildFlowData(
  branches: Branch[],
  tasks: Task[],
  dependencies: [string, string][],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const activeBranches = branches.filter((b) => !b.archived);

  activeBranches.forEach((branch, branchIndex) => {
    const branchY = branchIndex * (LANE_HEIGHT + LANE_GAP);
    const branchTasks = tasks
      .filter((t) => t.branch_id === branch.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const laneWidth = Math.max(
      TASK_START_X + branchTasks.length * TASK_STEP_X + 100,
      900,
    );

    nodes.push({
      id: `lane-${branch.id}`,
      type: 'branchLane',
      position: { x: 0, y: branchY },
      data: { label: branch.name, branchIndex, branchId: branch.id },
      style: { width: laneWidth, height: LANE_HEIGHT },
      selectable: false,
      draggable: false,
      zIndex: 0,
    });

    branchTasks.forEach((task, taskIndex) => {
      nodes.push({
        id: task.id,
        type: 'taskNode',
        position: {
          x: TASK_START_X + taskIndex * TASK_STEP_X,
          y: branchY + LANE_PADDING_Y,
        },
        data: { task },
        zIndex: 2,
        style: { width: TASK_WIDTH },
      });

      if (taskIndex > 0) {
        const prev = branchTasks[taskIndex - 1];
        edges.push({
          id: `seq-${prev.id}-${task.id}`,
          source: prev.id,
          target: task.id,
          type: 'smoothstep',
          style: { stroke: 'rgba(255,255,255,0.14)', strokeWidth: 1.5 },
          zIndex: 1,
        });
      }
    });

    // Add-task node at end of each branch
    nodes.push({
      id: `add-task-${branch.id}`,
      type: 'addTaskNode',
      position: {
        x: TASK_START_X + branchTasks.length * TASK_STEP_X,
        y: branchY + LANE_PADDING_Y,
      },
      data: { branchId: branch.id },
      zIndex: 2,
      style: { width: TASK_WIDTH },
    });
  });

  // Cross-branch dependency edges
  const taskSet = new Set(tasks.filter((t) => t.branch_id !== null).map((t) => t.id));
  dependencies.forEach(([taskId, dependsOnId]) => {
    if (taskSet.has(taskId) && taskSet.has(dependsOnId)) {
      edges.push({
        id: `dep-${dependsOnId}-${taskId}`,
        source: dependsOnId,
        target: taskId,
        type: 'smoothstep',
        style: {
          stroke: 'rgba(251,146,60,0.65)',
          strokeWidth: 1.5,
          strokeDasharray: '5 3',
        },
        zIndex: 1,
        label: '🔒',
        labelStyle: { fontSize: 10 },
        labelBgStyle: { fill: 'transparent' },
      });
    }
  });

  return { nodes, edges };
}
