import { useEffect, useRef } from "react";

import type { TaskDependency, TodayTaskContext } from "../../types";
import { buildBlockerMap, hasDependencyEdge } from "./dependencyUtils";
import { DependencyConnector } from "./DependencyConnector";
import { ExternalTaskBlock } from "./ExternalTaskBlock";
import { TaskBlock } from "./TaskBlock";
import { isExternalActive, findFirstClaimableIndex } from "./runwayTaskUtils";

export function LaneTrack({
  laneId,
  tasks,
  isWatch,
  dependencies = [],
}: {
  laneId: string;
  tasks: TodayTaskContext[];
  isWatch: boolean;
  dependencies?: TaskDependency[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const firstReadyIdx = findFirstClaimableIndex(tasks);
  const tasksById = new Map(tasks.map((t) => [t.task.id, t]));
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
  }, [tasks.length]);

  return (
    <div className="lane-track" ref={trackRef} role="list">
      {tasks.map((ctx, idx) => {
        const isExternal = isExternalActive(ctx);
        const isPending = ctx.task.status === "pending";
        const prevTask = idx > 0 ? tasks[idx - 1] : null;
        const showConnector =
          prevTask != null && hasDependencyEdge(dependencies, prevTask.task.id, ctx.task.id);

        const block = isExternal ? (
          <ExternalTaskBlock key={ctx.task.id} ctx={ctx} laneId={laneId} />
        ) : (
          <TaskBlock
            key={ctx.task.id}
            ctx={ctx}
            laneId={laneId}
            showClaim={idx === firstReadyIdx && ctx.task.status === "ready"}
            isActive={ctx.task.status === "active"}
            isPending={isPending}
            isWatch={isWatch}
            blockerTitles={blockerMap.get(ctx.task.id) ?? []}
          />
        );

        return (
          <div key={ctx.task.id} className="lane-track__item" role="listitem">
            {idx > 0 && <DependencyConnector visible={showConnector} />}
            {block}
          </div>
        );
      })}
      {tasks.length === 0 && <div className="lane-track__empty">拖拽任务到此处</div>}
    </div>
  );
}
