import { useEffect, useRef } from "react";

import type { TaskDependency, TodayTaskContext } from "../../types";
import { buildBlockerMap, hasDependencyEdge } from "./dependencyUtils";
import { DependencyConnector } from "./DependencyConnector";
import { ExternalTaskBlock } from "./ExternalTaskBlock";
import { TaskBlock } from "./TaskBlock";
import { findFirstClaimableIndex } from "./runwayTaskUtils";

function renderExternalItems(
  tasks: TodayTaskContext[],
  laneId: string,
  dependencies: TaskDependency[],
) {
  return tasks.map((ctx, idx) => {
    const prevTask = idx > 0 ? tasks[idx - 1] : null;
    const showConnector =
      prevTask != null && hasDependencyEdge(dependencies, prevTask.action.id, ctx.action.id);

    return (
      <div key={ctx.action.id} className="lane-track__item" role="listitem">
        {idx > 0 && <DependencyConnector visible={showConnector} />}
        <ExternalTaskBlock ctx={ctx} laneId={laneId} />
      </div>
    );
  });
}

function renderFocusItems(
  tasks: TodayTaskContext[],
  laneId: string,
  isWatch: boolean,
  dependencies: TaskDependency[],
  firstReadyIdx: number,
  blockerMap: Map<string, string[]>,
) {
  return tasks.map((ctx, idx) => {
    const isPending = ctx.action.status === "pending";
    const prevTask = idx > 0 ? tasks[idx - 1] : null;
    const showConnector =
      prevTask != null && hasDependencyEdge(dependencies, prevTask.action.id, ctx.action.id);

    return (
      <div key={ctx.action.id} className="lane-track__item" role="listitem">
        {idx > 0 && <DependencyConnector visible={showConnector} />}
        <TaskBlock
          ctx={ctx}
          laneId={laneId}
          showClaim={idx === firstReadyIdx && ctx.action.status === "ready"}
          isActive={ctx.action.status === "active"}
          isPending={isPending}
          isWatch={isWatch}
          blockerTitles={blockerMap.get(ctx.action.id) ?? []}
        />
      </div>
    );
  });
}

export function LaneTrack({
  laneId,
  focusTasks,
  externalTasks,
  isWatch,
  dependencies = [],
}: {
  laneId: string;
  focusTasks: TodayTaskContext[];
  externalTasks: TodayTaskContext[];
  isWatch: boolean;
  dependencies?: TaskDependency[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const firstReadyIdx = findFirstClaimableIndex(focusTasks);
  const allTasks = [...focusTasks, ...externalTasks];
  const tasksById = new Map(allTasks.map((t) => [t.action.id, t]));
  const blockerMap = buildBlockerMap(dependencies, tasksById);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const cards = Array.from(el.querySelectorAll<HTMLElement>(".task-card"));
      if (cards.length === 0) return;

      const active = document.activeElement;
      const idx = cards.findIndex((c) => c.contains(active) || c === active);
      const next =
        e.key === "ArrowRight"
          ? Math.min(cards.length - 1, idx < 0 ? 0 : idx + 1)
          : Math.max(0, idx <= 0 ? 0 : idx - 1);

      if (next !== idx) {
        e.preventDefault();
        cards[next].focus();
        cards[next].scrollIntoView({ inline: "nearest", block: "nearest" });
      }
    };

    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [allTasks.length]);

  const isEmpty = focusTasks.length === 0 && externalTasks.length === 0;

  return (
    <div className="lane-track-wrap" ref={trackRef}>
      {focusTasks.length > 0 && (
        <div className="lane-track lane-track--focus" role="list">
          {renderFocusItems(
            focusTasks,
            laneId,
            isWatch,
            dependencies,
            firstReadyIdx,
            blockerMap,
          )}
        </div>
      )}
      {externalTasks.length > 0 && (
        <div className="lane-track lane-track--external" role="list" aria-label="外部行动">
          {renderExternalItems(externalTasks, laneId, dependencies)}
        </div>
      )}
      {isEmpty && <div className="lane-track__empty">拖拽行动到此处</div>}
    </div>
  );
}
