import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import * as api from "../../api/tauri";
import type { PriorityLevel } from "../../types";
import { buildKanbanLayout, COLUMN_WIDTH } from "../../layout/kanbanLayout";
import { useAppStore } from "../../store/appStore";
import { nextPriority } from "./taskUtils";
import { BlockingEdge, BlockingEdgeMarker, SequentialEdge } from "../dag/CustomEdges";
import { ActionNode, AddTaskNode, type ActionNodeData } from "../dag/ActionNode";
import { OutcomeColumnHeader } from "./OutcomeColumnHeader";
import "./KanbanBoard.css";

const nodeTypes = {
  action: ActionNode,
  outcomeHeader: OutcomeColumnHeader,
  addTask: AddTaskNode,
};

const edgeTypes = {
  sequential: SequentialEdge,
  blocking: BlockingEdge,
};

const LOCKED_VIEWPORT = { x: 0, y: 0, zoom: 1 };

export function KanbanBoard() {
  const graph = useAppStore((s) => s.graph);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const topRecommendationId = useAppStore((s) => s.topRecommendationId);
  const hideDoneTasks = useAppStore((s) => s.hideDoneTasks);
  const refreshAll = useAppStore((s) => s.refreshAll);
  const selectTask = useAppStore((s) => s.selectTask);
  const completeTask = useAppStore((s) => s.completeTask);
  const activateTask = useAppStore((s) => s.activateTask);
  const pauseTask = useAppStore((s) => s.pauseTask);
  const addBranchTask = useAppStore((s) => s.addBranchTask);
  const createBranch = useAppStore((s) => s.createBranch);
  const renameBranch = useAppStore((s) => s.renameBranch);
  const archiveBranch = useAppStore((s) => s.archiveBranch);
  const deleteBranch = useAppStore((s) => s.deleteBranch);
  const reorderBranches = useAppStore((s) => s.reorderBranches);
  const archiveTask = useAppStore((s) => s.archiveTask);
  const setTaskPriority = useAppStore((s) => s.setTaskPriority);

  const sortedBranches = useMemo(
    () => (graph ? [...graph.outcomes].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [graph?.outcomes],
  );

  const layout = useMemo(() => {
    if (!graph) {
      return {
        nodes: [],
        edges: [],
        metrics: { totalWidth: COLUMN_WIDTH, totalHeight: 400, columnCount: 0 },
      };
    }
    return buildKanbanLayout(graph.outcomes, graph.actions, graph.dependencies, hideDoneTasks);
  }, [graph, hideDoneTasks]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);
  const [addingBranch, setAddingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  const moveColumn = useCallback(
    (branchId: string, direction: "left" | "right") => {
      if (!graph) return;
      const ids = sortedBranches.map((b) => b.id);
      const idx = ids.indexOf(branchId);
      const swapIdx = direction === "left" ? idx - 1 : idx + 1;
      if (idx < 0 || swapIdx < 0 || swapIdx >= ids.length) return;
      [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];
      void reorderBranches(ids);
    },
    [graph, sortedBranches, reorderBranches],
  );

  useEffect(() => {
    if (!graph) return;

    const branchTaskCounts = new Map(
      graph.outcomes.map((b) => [
        b.id,
        graph.actions.filter((t) => t.branchId === b.id && t.status !== "inbox").length,
      ]),
    );

    const columnIndexByBranch = new Map(sortedBranches.map((b, i) => [b.id, i]));

    setNodes(
      layout.nodes.map((node) => {
        if (node.type === "action") {
          const data = node.data as ActionNodeData;
          const depCount = graph.dependencies.filter(
            (d) => d.taskId === data.task.id || d.dependsOnTaskId === data.task.id,
          ).length;
          return {
            ...node,
            draggable: false,
            data: {
              ...data,
              dependencyCount: depCount,
              isRecommended: data.task.id === topRecommendationId,
              onSelect: (taskId: string) => selectTask(taskId),
              onStart: (taskId: string) => {
                if (!activeProjectId) return;
                void activateTask(taskId, activeProjectId);
              },
              onComplete: (taskId: string) => {
                if (!activeProjectId) return;
                void completeTask(taskId, activeProjectId);
              },
              onPause: (taskId: string) => {
                if (!activeProjectId) return;
                void pauseTask(taskId, activeProjectId);
              },
              onArchive: (taskId: string) => {
                void archiveTask(taskId, activeProjectId ?? undefined);
              },
              onCyclePriority: (taskId: string, current: PriorityLevel) => {
                void setTaskPriority(taskId, nextPriority(current));
              },
              dependencyOptions: graph.actions.filter(
                (t) => t.id !== data.task.id && t.status !== "inbox",
              ),
              onAddDependency: (taskId: string, dependsOnId: string) => {
                void api.addDependency(taskId, dependsOnId).then(() => refreshAll());
              },
            },
          };
        }
        if (node.type === "outcomeHeader") {
          const branchId = (node.data as { branchId: string }).branchId;
          const colIdx = columnIndexByBranch.get(branchId) ?? 0;
          return {
            ...node,
            draggable: false,
            data: {
              ...node.data,
              taskCount: branchTaskCounts.get(branchId) ?? 0,
              canMoveLeft: colIdx > 0,
              canMoveRight: colIdx < sortedBranches.length - 1,
              onMoveLeft: () => moveColumn(branchId, "left"),
              onMoveRight: () => moveColumn(branchId, "right"),
              onRename: (id: string, name: string) => void renameBranch(id, name),
              onArchive: (id: string) => void archiveBranch(id),
              onDelete: (id: string) => void deleteBranch(id),
            },
          };
        }
        if (node.type === "addTask") {
          const branchId = (node.data as { branchId: string }).branchId;
          return {
            ...node,
            draggable: false,
            data: {
              branchId,
              onAdd: (title: string) => void addBranchTask(branchId, title),
            },
          };
        }
        return { ...node, draggable: false };
      }),
    );
    setEdges(layout.edges);
  }, [
    layout,
    graph,
    sortedBranches,
    setNodes,
    setEdges,
    activeProjectId,
    topRecommendationId,
    moveColumn,
    selectTask,
    completeTask,
    activateTask,
    pauseTask,
    addBranchTask,
    renameBranch,
    archiveBranch,
    deleteBranch,
    archiveTask,
    setTaskPriority,
  ]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !activeProjectId) return;
      void api
        .addDependency(connection.target, connection.source)
        .then(() => refreshAll());
    },
    [activeProjectId, refreshAll],
  );

  if (!graph) {
    return (
      <div className="kanban-empty">
        <p>选择或创建一个项目以开始编排</p>
      </div>
    );
  }

  if (graph.outcomes.length === 0) {
    return (
      <div className="kanban-empty">
        <h3>开始编排你的项目</h3>
        <p>创建第一个目标来组织行动</p>
        {addingBranch ? (
          <div className="kanban-empty__form">
            <input
              autoFocus
              placeholder="可衡量的目标，如「登录页可上线」"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newBranchName.trim()) {
                  void createBranch(newBranchName.trim()).then(() => {
                    setAddingBranch(false);
                    setNewBranchName("");
                  });
                }
                if (e.key === "Escape") setAddingBranch(false);
              }}
            />
          </div>
        ) : (
          <button type="button" className="kanban-empty__cta" onClick={() => setAddingBranch(true)}>
            + 创建第一个目标
          </button>
        )}
      </div>
    );
  }

  const { totalWidth, totalHeight } = layout.metrics;

  return (
    <div
      className="kanban-board"
      style={{ width: totalWidth, height: totalHeight }}
    >
      {sortedBranches.map((branch, columnIndex) => (
        <div
          key={branch.id}
          className="kanban-board__column-bg"
          style={{
            left: columnIndex * COLUMN_WIDTH,
            width: COLUMN_WIDTH,
            height: totalHeight,
          }}
        />
      ))}
      <ReactFlow
        width={totalWidth}
        height={totalHeight}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={LOCKED_VIEWPORT}
        minZoom={1}
        maxZoom={1}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable
        proOptions={{ hideAttribution: true }}
      >
        <BlockingEdgeMarker />
      </ReactFlow>
    </div>
  );
}
