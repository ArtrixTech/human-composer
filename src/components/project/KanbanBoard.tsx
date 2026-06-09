import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import * as api from "../../api/tauri";
import type { Action, Branch, PriorityLevel } from "../../types";
import { orderTasksInColumn } from "../../layout/kanbanLayout";
import { KANBAN_COLUMN_WIDTH } from "../../layout/kanbanTokens";
import { useAppStore } from "../../store/appStore";
import { nextPriority } from "./taskUtils";
import { ActionCard } from "./ActionCard";
import { AddActionCard } from "./AddActionCard";
import { KanbanEdges } from "./KanbanEdges";
import { OutcomeColumnHeader } from "./OutcomeColumnHeader";
import { useBlockConnections } from "./useBlockConnections";
import "./KanbanBoard.css";

function KanbanColumn({
  branch,
  tasks,
  columnIndex,
  columnCount,
  graph,
  topRecommendationId,
  connecting,
  highlightTarget,
  onMoveColumn,
  onRename,
  onArchive,
  onDelete,
  onAddTask,
  onSelect,
  onStart,
  onComplete,
  onPause,
  onArchiveTask,
  onCyclePriority,
  onRemoveDependency,
  onPortPointerDown,
}: {
  branch: Branch;
  tasks: Action[];
  columnIndex: number;
  columnCount: number;
  graph: NonNullable<ReturnType<typeof useAppStore.getState>["graph"]>;
  topRecommendationId: string | null;
  connecting: boolean;
  highlightTarget: string | null;
  onMoveColumn: (branchId: string, direction: "left" | "right") => void;
  onRename: (branchId: string, name: string) => void;
  onArchive: (branchId: string) => void;
  onDelete: (branchId: string) => void;
  onAddTask: (branchId: string, title: string) => void;
  onSelect: (taskId: string) => void;
  onStart: (taskId: string) => void;
  onComplete: (taskId: string) => void;
  onPause: (taskId: string) => void;
  onArchiveTask: (taskId: string) => void;
  onCyclePriority: (taskId: string, current: PriorityLevel) => void;
  onRemoveDependency: (taskId: string, dependsOnId: string) => void;
  onPortPointerDown: (taskId: string, e: React.PointerEvent) => void;
}) {
  const { setNodeRef } = useDroppable({
    id: `column-${branch.id}`,
    data: { type: "column", branchId: branch.id },
  });

  const allInBranch = graph.actions.filter(
    (t) => t.branchId === branch.id && t.status !== "inbox",
  );
  const done = allInBranch.filter((t) => t.status === "done").length;
  const progress = allInBranch.length > 0 ? `${done}/${allInBranch.length}` : undefined;
  const taskIds = tasks.map((t) => t.id);

  return (
    <div ref={setNodeRef} className="kanban-column" style={{ width: KANBAN_COLUMN_WIDTH }}>
      <OutcomeColumnHeader
        label={branch.name}
        branchId={branch.id}
        progress={progress}
        taskCount={allInBranch.length}
        canMoveLeft={columnIndex > 0}
        canMoveRight={columnIndex < columnCount - 1}
        onMoveLeft={() => onMoveColumn(branch.id, "left")}
        onMoveRight={() => onMoveColumn(branch.id, "right")}
        onRename={onRename}
        onArchive={onArchive}
        onDelete={onDelete}
      />
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="kanban-column__cards">
          {tasks.map((task) => {
            const depCount = graph.dependencies.filter(
              (d) => d.taskId === task.id || d.dependsOnTaskId === task.id,
            ).length;
            const upstreamDeps = graph.dependencies
              .filter((d) => d.taskId === task.id)
              .map((d) => {
                const dep = graph.actions.find((t) => t.id === d.dependsOnTaskId);
                return dep ? { id: dep.id, title: dep.title } : null;
              })
              .filter((d): d is { id: string; title: string } => d !== null);

            return (
              <ActionCard
                key={task.id}
                task={task}
                branchId={branch.id}
                isRecommended={task.id === topRecommendationId}
                dependencyCount={depCount}
                upstreamDeps={upstreamDeps}
                connecting={connecting}
                highlightIn={highlightTarget === task.id}
                onSelect={onSelect}
                onStart={onStart}
                onComplete={onComplete}
                onPause={onPause}
                onArchive={onArchiveTask}
                onCyclePriority={onCyclePriority}
                onRemoveDependency={onRemoveDependency}
                onPortPointerDown={onPortPointerDown}
              />
            );
          })}
        </div>
      </SortableContext>
      <AddActionCard onAdd={(title) => onAddTask(branch.id, title)} />
    </div>
  );
}

export function KanbanBoard({
  onConnectingChange,
}: {
  onConnectingChange?: (connecting: boolean) => void;
}) {
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
  const reorderBranchTasks = useAppStore((s) => s.reorderBranchTasks);
  const archiveTask = useAppStore((s) => s.archiveTask);
  const setTaskPriority = useAppStore((s) => s.setTaskPriority);

  const boardRef = useRef<HTMLDivElement>(null);
  const [addingBranch, setAddingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const sortedBranches = useMemo(
    () => (graph ? [...graph.outcomes].sort((a, b) => a.sortOrder - b.sortOrder) : []),
    [graph?.outcomes],
  );

  const tasksByBranch = useMemo(() => {
    if (!graph) return new Map<string, Action[]>();
    const map = new Map<string, Action[]>();
    for (const branch of sortedBranches) {
      const branchTasks = graph.actions.filter(
        (t) =>
          t.branchId === branch.id &&
          t.status !== "inbox" &&
          (!hideDoneTasks || t.status !== "done"),
      );
      map.set(branch.id, orderTasksInColumn(branchTasks, graph.dependencies));
    }
    return map;
  }, [graph, sortedBranches, hideDoneTasks]);

  const visibleTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (const tasks of tasksByBranch.values()) {
      for (const t of tasks) ids.add(t.id);
    }
    return ids;
  }, [tasksByBranch]);

  const existingPairs = useMemo(() => {
    const pairs = new Set<string>();
    if (!graph) return pairs;
    for (const dep of graph.dependencies) {
      pairs.add(`${dep.taskId}:${dep.dependsOnTaskId}`);
    }
    return pairs;
  }, [graph?.dependencies]);

  const handleConnect = useCallback(
    (targetId: string, sourceId: string) => {
      void api.addDependency(targetId, sourceId).then(() => refreshAll());
    },
    [refreshAll],
  );

  const { edges, previewPath, highlightTarget, connecting, startDrag, remeasure } =
    useBlockConnections({
      boardRef,
      dependencies: graph?.dependencies ?? [],
      visibleTaskIds,
      existingPairs,
      onConnect: handleConnect,
      onConnectingChange,
    });

  useEffect(() => {
    const id = requestAnimationFrame(() => remeasure());
    return () => cancelAnimationFrame(id);
  }, [tasksByBranch, sortedBranches, remeasure]);

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

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!graph || connecting) return;
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current as { branchId?: string; taskId?: string } | undefined;
      const sourceBranchId = activeData?.branchId;
      const activeId = String(active.id);
      if (!sourceBranchId) return;

      const overData = over.data.current as { branchId?: string; taskId?: string } | undefined;
      let targetBranchId = overData?.branchId;
      if (!targetBranchId && String(over.id).startsWith("column-")) {
        targetBranchId = String(over.id).slice("column-".length);
      }
      if (!targetBranchId) return;

      if (sourceBranchId !== targetBranchId) {
        void api.assignTaskToBranch(activeId, targetBranchId).then(async () => {
          await refreshAll();
          const targetTasks = tasksByBranch.get(targetBranchId!) ?? [];
          const nextIds = [...targetTasks.map((t) => t.id), activeId];
          await reorderBranchTasks(targetBranchId!, nextIds);
        });
        return;
      }

      const tasks = tasksByBranch.get(targetBranchId) ?? [];
      const ids = tasks.map((t) => t.id);
      const oldIndex = ids.indexOf(activeId);
      const overId = overData?.taskId ?? String(over.id);
      const newIndex = ids.indexOf(overId);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        void reorderBranchTasks(targetBranchId, arrayMove(ids, oldIndex, newIndex));
      }
    },
    [graph, connecting, tasksByBranch, refreshAll, reorderBranchTasks],
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

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div ref={boardRef} className="kanban-board">
        {sortedBranches.map((branch, columnIndex) => (
          <KanbanColumn
            key={branch.id}
            branch={branch}
            tasks={tasksByBranch.get(branch.id) ?? []}
            columnIndex={columnIndex}
            columnCount={sortedBranches.length}
            graph={graph}
            topRecommendationId={topRecommendationId}
            connecting={connecting}
            highlightTarget={highlightTarget}
            onMoveColumn={moveColumn}
            onRename={(id, name) => void renameBranch(id, name)}
            onArchive={(id) => void archiveBranch(id)}
            onDelete={(id) => void deleteBranch(id)}
            onAddTask={(id, title) => void addBranchTask(id, title)}
            onSelect={(taskId) => selectTask(taskId)}
            onStart={(taskId) => {
              if (!activeProjectId) return;
              void activateTask(taskId, activeProjectId);
            }}
            onComplete={(taskId) => {
              if (!activeProjectId) return;
              void completeTask(taskId, activeProjectId);
            }}
            onPause={(taskId) => {
              if (!activeProjectId) return;
              void pauseTask(taskId, activeProjectId);
            }}
            onArchiveTask={(taskId) => void archiveTask(taskId, activeProjectId ?? undefined)}
            onCyclePriority={(taskId, current) => void setTaskPriority(taskId, nextPriority(current))}
            onRemoveDependency={(taskId, dependsOnId) => {
              void api.removeDependency(taskId, dependsOnId).then(() => refreshAll());
            }}
            onPortPointerDown={startDrag}
          />
        ))}
        <KanbanEdges edges={edges} previewPath={previewPath} />
      </div>
    </DndContext>
  );
}
