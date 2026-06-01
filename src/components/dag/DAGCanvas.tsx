import { useCallback, useEffect, useMemo } from "react";
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
import { buildSwimLaneLayout, layoutMetrics } from "../../layout/swimLaneLayout";
import { useAppStore } from "../../store/appStore";
import { BlockingEdge, BlockingEdgeMarker, SequentialEdge } from "./CustomEdges";
import { AddTaskNode, TaskNode, type TaskNodeData } from "./TaskNode";
import { LaneLabelNode } from "./LaneLabelNode";
import "./DAGCanvas.css";

const nodeTypes = {
  task: TaskNode,
  laneLabel: LaneLabelNode,
  addTask: AddTaskNode,
};

const edgeTypes = {
  sequential: SequentialEdge,
  blocking: BlockingEdge,
};

export function DAGCanvas() {
  const graph = useAppStore((s) => s.graph);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const topRecommendationId = useAppStore((s) => s.topRecommendationId);
  const refreshAll = useAppStore((s) => s.refreshAll);
  const selectTask = useAppStore((s) => s.selectTask);
  const completeTask = useAppStore((s) => s.completeTask);
  const activateTask = useAppStore((s) => s.activateTask);
  const addBranchTask = useAppStore((s) => s.addBranchTask);

  const layout = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    return buildSwimLaneLayout(graph.branches, graph.tasks, graph.dependencies);
  }, [graph]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  useEffect(() => {
    setNodes(
      layout.nodes.map((node) => {
        if (node.type === "task") {
          const data = node.data as TaskNodeData;
          return {
            ...node,
            data: {
              ...data,
              isRecommended: data.task.id === topRecommendationId,
              onSelect: (taskId: string) => selectTask(taskId),
              onStart: (taskId: string) => {
                if (!activeProjectId) return;
                void activateTask(taskId);
              },
              onComplete: (taskId: string) => void completeTask(taskId),
              onPause: (taskId: string) => {
                if (!activeProjectId) return;
                void api.setTaskStatus(activeProjectId, taskId, "ready").then(() => refreshAll());
              },
            },
          };
        }
        if (node.type === "addTask") {
          const branchId = (node.data as { branchId: string }).branchId;
          return {
            ...node,
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
    setNodes,
    setEdges,
    activeProjectId,
    refreshAll,
    selectTask,
    completeTask,
    activateTask,
    addBranchTask,
    topRecommendationId,
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
      <div className="dag-empty">
        <p>选择或创建一个项目以开始编排</p>
      </div>
    );
  }

  const canvasHeight = layoutMetrics.laneCount(graph.branches) * layoutMetrics.laneHeight;

  return (
    <div className="dag-canvas">
      <div className="dag-canvas__lanes" style={{ height: canvasHeight }}>
        {graph.branches.map((branch, i) => (
          <div
            key={branch.id}
            className="lane-background"
            style={{
              top: i * layoutMetrics.laneHeight,
              height: layoutMetrics.laneHeight,
            }}
          />
        ))}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.5}
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
