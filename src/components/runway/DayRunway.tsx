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
import { BacklogPool } from "./BacklogPool";
import { CarryOverBanner } from "./CarryOverBanner";
import { CompletedBar } from "./CompletedBar";
import { LanesContainer } from "./LanesContainer";
import { NowStrip } from "./NowStrip";
import { RunwayHeader } from "./RunwayHeader";
import { TaskBlockPreview } from "./TaskBlockPreview";

export function DayRunway() {
  const runwaySnapshot = useAppStore((s) => s.runwaySnapshot);
  const loading = useAppStore((s) => s.loading);
  const addLaneOpen = useAppStore((s) => s.addLaneOpen);
  const setAddLaneOpen = useAppStore((s) => s.setAddLaneOpen);
  const createProject = useAppStore((s) => s.createProject);
  const moveBetweenLanes = useAppStore((s) => s.moveBetweenLanes);
  const assignToLane = useAppStore((s) => s.assignToLane);
  const removeFromLane = useAppStore((s) => s.removeFromLane);
  const reorderLaneTasks = useAppStore((s) => s.reorderLaneTasks);

  const [dragging, setDragging] = useState<TodayTaskContext | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as {
      task: TodayTaskContext;
      laneId?: string;
      backlog?: boolean;
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
      backlog?: boolean;
    };
    const overData = over.data.current as {
      laneId?: string;
      backlog?: boolean;
      taskId?: string;
    };

    const taskId = taskData.task.task.id;

    if (overData.backlog && taskData.laneId) {
      void removeFromLane(taskId, taskData.laneId);
      return;
    }

    if (overData.laneId) {
      if (taskData.backlog) {
        void assignToLane(taskId, overData.laneId);
        return;
      }
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
        <NowStrip snapshot={runwaySnapshot} />
        {runwaySnapshot.carryOverCount > 0 && (
          <CarryOverBanner count={runwaySnapshot.carryOverCount} />
        )}
        <LanesContainer
          lanes={runwaySnapshot.lanes as DayLaneSnapshot[]}
          dependencies={runwaySnapshot.dependencies ?? []}
        />
        <BacklogPool items={runwaySnapshot.backlog} />
        <CompletedBar completed={runwaySnapshot.completedToday} />
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
