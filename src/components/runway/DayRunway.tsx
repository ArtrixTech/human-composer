import "./DayRunway.css";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";

import type { DayLaneSnapshot, TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";
import { AddLaneDialog } from "./AddLaneDialog";
import { LanesContainer } from "./LanesContainer";
import { RunwayHeader } from "./RunwayHeader";
import { TaskBlockPreview } from "./TaskBlockPreview";
import {
  normalizeLaneOrder,
  normalizeLaneTaskOrder,
  sortLanesForDisplay,
} from "./runwayTaskUtils";

export function DayRunway() {
  const runwaySnapshot = useAppStore((s) => s.runwaySnapshot);
  const loading = useAppStore((s) => s.loading);
  const addLaneOpen = useAppStore((s) => s.addLaneOpen);
  const setAddLaneOpen = useAppStore((s) => s.setAddLaneOpen);
  const createProject = useAppStore((s) => s.createProject);
  const moveBetweenLanes = useAppStore((s) => s.moveBetweenLanes);
  const reorderLaneTasks = useAppStore((s) => s.reorderLaneTasks);
  const reorderLanes = useAppStore((s) => s.reorderLanes);

  const [dragging, setDragging] = useState<TodayTaskContext | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as {
      type?: string;
      task?: TodayTaskContext;
    };
    if (data?.type === "lane" || !data?.task) return;
    setDragging(data.task);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDragging(null);
    if (!over || !runwaySnapshot) return;

    const activeData = active.data.current as {
      type?: string;
      laneId?: string;
      task?: TodayTaskContext;
    };

    if (activeData?.type === "lane" && activeData.laneId) {
      const overId = String(over.id);
      if (!overId.startsWith("lane-")) return;
      const overLaneId = overId.slice("lane-".length);
      const laneIds = sortLanesForDisplay(
        runwaySnapshot.lanes as DayLaneSnapshot[],
      ).map((l) => l.lane.id);
      const fromIdx = laneIds.indexOf(activeData.laneId);
      const toIdx = laneIds.indexOf(overLaneId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
      const next = [...laneIds];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, activeData.laneId);
      void reorderLanes(
        normalizeLaneOrder(runwaySnapshot.lanes as DayLaneSnapshot[], next),
      );
      return;
    }

    const taskData = activeData as {
      task: TodayTaskContext;
      laneId?: string;
    };
    const overData = over.data.current as {
      laneId?: string;
      taskId?: string;
    };

    if (!taskData.task) return;
    const taskId = taskData.task.action.id;

    if (overData.laneId) {
      if (taskData.laneId && taskData.laneId !== overData.laneId) {
        void moveBetweenLanes(taskId, taskData.laneId, overData.laneId);
        return;
      }
      if (taskData.laneId === overData.laneId && overData.taskId) {
        const lane = runwaySnapshot.lanes.find((l) => l.lane.id === overData.laneId);
        if (!lane) return;
        const ids = lane.actions.map((t) => t.action.id);
        const fromIdx = ids.indexOf(taskId);
        const toIdx = ids.indexOf(overData.taskId);
        if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
          const next = [...ids];
          next.splice(fromIdx, 1);
          next.splice(toIdx, 0, taskId);
          void reorderLaneTasks(
            overData.laneId,
            normalizeLaneTaskOrder(lane.actions, next),
          );
        }
      }
    }
  };

  if (loading && !runwaySnapshot) {
    return <div className="day-runway day-runway--loading">加载今日安排…</div>;
  }

  if (!runwaySnapshot) {
    return (
      <div className="day-runway day-runway--empty">
        <p>暂无行动 — 创建项目并添加行动后即可在此查看今日安排</p>
        <button
          type="button"
          className="day-runway__cta"
          onClick={() => {
            const name = window.prompt("项目名称");
            if (name?.trim()) void createProject(name.trim());
          }}
        >
          创建项目
        </button>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="day-runway">
        <RunwayHeader snapshot={runwaySnapshot} onAddLane={() => setAddLaneOpen(true)} />
        <LanesContainer
          lanes={runwaySnapshot.lanes as DayLaneSnapshot[]}
          dependencies={runwaySnapshot.dependencies ?? []}
        />
      </div>
      <DragOverlay>
        {dragging ? (
          <TaskBlockPreview
            ctx={dragging}
            isPending={dragging.action.status === "pending"}
          />
        ) : null}
      </DragOverlay>
      {addLaneOpen && <AddLaneDialog onClose={() => setAddLaneOpen(false)} />}
    </DndContext>
  );
}
