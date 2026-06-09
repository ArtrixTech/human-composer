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
import { buildSwimLaneLayout, layoutMetrics } from "../../layout/swimLaneLayout";
import { useAppStore } from "../../store/appStore";
import { BlockingEdge, BlockingEdgeMarker, SequentialEdge } from "./CustomEdges";
import { ActionNode, AddTaskNode, type ActionNodeData } from "./ActionNode";
import { LaneLabelNode } from "./LaneLabelNode";
import "./DAGCanvas.css";

const nodeTypes = {
  action: ActionNode,
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
  const hideDoneTasks = useAppStore((s) => s.hideDoneTasks);
  const refreshAll = useAppStore((s) => s.refreshAll);
  const selectTask = useAppStore((s) => s.selectTask);
  const completeTask = useAppStore((s) => s.completeTask);
  const activateTask = useAppStore((s) => s.activateTask);
  const addBranchTask = useAppStore((s) => s.addBranchTask);
  const createBranch = useAppStore((s) => s.createBranch);
  const renameBranch = useAppStore((s) => s.renameBranch);

  const layout = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    return buildSwimLaneLayout(
      graph.outcomes,
      graph.actions,
      graph.dependencies,
      hideDoneTasks,
    );
  }, [graph, hideDoneTasks]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);
  const [addingBranch, setAddingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedBranches, setArchivedBranches] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    if (!showArchived || !activeProjectId) {
      setArchivedBranches([]);
      return;
    }
    void api.listArchivedBranches(activeProjectId).then((branches) => {
      setArchivedBranches(branches.map((b) => ({ id: b.id, name: b.name })));
    });
  }, [showArchived, activeProjectId, graph?.outcomes.length]);

  useEffect(() => {
    setNodes(
      layout.nodes.map((node) => {
        if (node.type === "action") {
          const data = node.data as ActionNodeData;
          const depCount =
            graph?.dependencies.filter(
              (d) => d.taskId === data.task.id || d.dependsOnTaskId === data.task.id,
            ).length ?? 0;
          return {
            ...node,
            data: {
              ...data,
              dependencyCount: depCount,
              isRecommended: data.task.id === topRecommendationId,
              onSelect: (taskId: string) => selectTask(taskId),
              onStart: (taskId: string) => {
                if (!activeProjectId) return;
                void activateTask(taskId, activeProjectId);
              },
              onComplete: (taskId: string) => void completeTask(taskId, activeProjectId!),
              onPause: (taskId: string) => {
                if (!activeProjectId) return;
                void api.setTaskStatus(activeProjectId, taskId, "ready").then(() => refreshAll());
              },
            },
          };
        }
        if (node.type === "laneLabel") {
          const branchId = (node.data as { branchId: string }).branchId;
          return {
            ...node,
            data: {
              ...node.data,
              onRename: (name: string) => void renameBranch(branchId, name),
              onArchive: () => {
                if (!activeProjectId) return;
                void api.archiveBranch(activeProjectId, branchId).then(() => refreshAll());
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
    graph,
    setNodes,
    setEdges,
    activeProjectId,
    refreshAll,
    selectTask,
    completeTask,
    activateTask,
    addBranchTask,
    renameBranch,
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

  if (graph.outcomes.length === 0) {
    return (
      <div className="dag-empty dag-empty--guide">
        <h3>开始编排你的项目</h3>
        <p>创建第一个目标来组织行动</p>
        {addingBranch ? (
          <div className="dag-empty__form">
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
          <button type="button" className="dag-empty__cta" onClick={() => setAddingBranch(true)}>
            + 创建第一个目标
          </button>
        )}
      </div>
    );
  }

  const canvasHeight = layoutMetrics.laneCount(graph.outcomes) * layoutMetrics.laneHeight;

  return (
    <div className="dag-canvas">
      <div className="dag-canvas__toolbar">
        {addingBranch ? (
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
        ) : (
          <>
            <button type="button" onClick={() => setAddingBranch(true)}>
              + 新目标
            </button>
            <button type="button" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "隐藏归档" : "归档目标"}
            </button>
          </>
        )}
      </div>
      {showArchived && archivedBranches.length > 0 && (
        <div className="dag-canvas__archived">
          {archivedBranches.map((branch) => (
            <div key={branch.id} className="dag-canvas__archived-item">
              <span>{branch.name}</span>
              <button
                type="button"
                onClick={() => {
                  if (!activeProjectId) return;
                  void api
                    .unarchiveBranch(activeProjectId, branch.id)
                    .then(() => refreshAll());
                }}
              >
                恢复
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="dag-canvas__lanes" style={{ height: canvasHeight }}>
        {graph.outcomes.map((branch, i) => (
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
