import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import * as api from "../../api/tauri";
import { buildKanbanLayout, COLUMN_WIDTH } from "../../layout/kanbanLayout";
import { useAppStore } from "../../store/appStore";
import { nextPriority } from "./taskUtils";
import { BlockingEdge, BlockingEdgeMarker, SequentialEdge } from "../dag/CustomEdges";
import { AddTaskNode, TaskNode, type TaskNodeData } from "../dag/TaskNode";
import { BranchColumnHeader } from "./BranchColumnHeader";
import "./KanbanBoard.css";

const nodeTypes = {
  task: TaskNode,
  branchHeader: BranchColumnHeader,
  addTask: AddTaskNode,
};

const edgeTypes = {
  sequential: SequentialEdge,
  blocking: BlockingEdge,
};

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

  const layout = useMemo(() => {
    if (!graph) return { nodes: [], edges: [], metrics: { totalWidth: COLUMN_WIDTH, totalHeight: 400, columnCount: 0 } };
    return buildKanbanLayout(graph.branches, graph.tasks, graph.dependencies, hideDoneTasks);
  }, [graph, hideDoneTasks]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);
  const [addingBranch, setAddingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  useEffect(() => {
    if (!graph) return;

    const branchTaskCounts = new Map(
      graph.branches.map((b) => [
        b.id,
        graph.tasks.filter((t) => t.branchId === b.id && t.status !== "inbox").length,
      ]),
    );

    setNodes(
      layout.nodes.map((node) => {
        if (node.type === "task") {
          const data = node.data as TaskNodeData;
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
              onCyclePriority: (taskId: string, current: number | null) => {
                void setTaskPriority(taskId, nextPriority(current));
              },
            },
          };
        }
        if (node.type === "branchHeader") {
          const branchId = (node.data as { branchId: string }).branchId;
          return {
            ...node,
            draggable: true,
            data: {
              ...node.data,
              taskCount: branchTaskCounts.get(branchId) ?? 0,
              onRename: (id: string, name: string) => void renameBranch(id, name),
              onArchive: (id: string) => void archiveBranch(id),
              onDelete: (id: string, count: number) => {
                const name = graph.branches.find((b) => b.id === id)?.name ?? "支线";
                const msg =
                  count > 0
                    ? `删除支线「${name}」及其 ${count} 个任务？`
                    : `删除空支线「${name}」？`;
                if (window.confirm(msg)) void deleteBranch(id);
              },
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
        return node;
      }),
    );
    setEdges(layout.edges);
  }, [
    layout,
    graph,
    setNodes,
    setEdges,
    activeProjectId,
    topRecommendationId,
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

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: { type?: string }) => {
      if (node.type !== "branchHeader" || !graph) return;

      const headers = nodes.filter((n) => n.type === "branchHeader");
      const sorted = [...headers].sort((a, b) => a.position.x - b.position.x);
      const branchIds = sorted.map((n) => (n.data as { branchId: string }).branchId);
      const currentIds = [...graph.branches]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((b) => b.id);

      if (branchIds.join() !== currentIds.join()) {
        void reorderBranches(branchIds);
      } else {
        void refreshAll();
      }
    },
    [nodes, graph, reorderBranches, refreshAll],
  );

  if (!graph) {
    return (
      <div className="kanban-empty">
        <p>选择或创建一个项目以开始编排</p>
      </div>
    );
  }

  if (graph.branches.length === 0) {
    return (
      <div className="kanban-empty">
        <h3>开始编排你的项目</h3>
        <p>创建第一条并行支线来组织任务</p>
        {addingBranch ? (
          <div className="kanban-empty__form">
            <input
              autoFocus
              placeholder="支线名称"
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
            + 创建第一条支线
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="kanban-board"
      style={{
        minWidth: layout.metrics.totalWidth,
        minHeight: layout.metrics.totalHeight,
      }}
    >
      <div
        className="kanban-board__columns-bg"
        style={{ width: layout.metrics.totalWidth }}
      >
        {graph.branches
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((branch) => (
            <div
              key={branch.id}
              className="kanban-board__column-bg"
              style={{ width: COLUMN_WIDTH }}
            />
          ))}
      </div>
      <ReactFlow
        style={{ width: "100%", height: "100%" }}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable
        nodesConnectable
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.35}
        maxZoom={1.25}
        proOptions={{ hideAttribution: true }}
      >
        <BlockingEdgeMarker />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--border-subtle)"
        />
      </ReactFlow>
    </div>
  );
}
