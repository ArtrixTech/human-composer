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

export function DayRunway() {
  const runwaySnapshot = useAppStore((s) => s.runwaySnapshot);
  const loading = useAppStore((s) => s.loading);
  const addLaneOpen = useAppStore((s) => s.addLaneOpen);
  const setAddLaneOpen = useAppStore((s) => s.setAddLaneOpen);
  const createProject = useAppStore((s) => s.createProject);
  const moveBetweenLanes = useAppStore((s) => s.moveBetweenLanes);
  const reorderLaneTasks = useAppStore((s) => s.reorderLaneTasks);

  const [dragging, setDragging] = useState<TodayTaskContext | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as {
      task: TodayTaskContext;
      laneId?: string;
    };
    setDragging(data.task);
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDragging(null);
    if (!over) return;

    const taskData = active.data.current as {
      task: TodayTaskContext;
      laneId?: string;
    };
    const overData = over.data.current as {
      laneId?: string;
      taskId?: string;
    };

    const taskId = taskData.task.task.id;

    if (overData.laneId) {
      if (taskData.laneId && taskData.laneId !== overData.laneId) {
        void moveBetweenLanes(taskId, taskData.laneId, overData.laneId);
        return;
      }
      if (taskData.laneId === overData.laneId && overData.taskId) {
        const lane = runwaySnapshot?.lanes.find((l) => l.lane.id === overData.laneId);
        if (!lane) return;
        const ids = lane.tasks.map((t) => t.task.id);
        const fromIdx = ids.indexOf(taskId);
        const toIdx = ids.indexOf(overData.taskId);
        if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
          const next = [...ids];
          next.splice(fromIdx, 1);
          next.splice(toIdx, 0, taskId);
          void reorderLaneTasks(overData.laneId, next);
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
        <p>暂无任务 — 创建项目并添加任务后即可在此查看今日安排</p>
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
            isPending={dragging.task.status === "pending"}
          />
        ) : null}
      </DragOverlay>
      {addLaneOpen && <AddLaneDialog onClose={() => setAddLaneOpen(false)} />}
    </DndContext>
  );
}
