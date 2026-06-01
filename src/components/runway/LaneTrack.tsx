import type { TaskDependency, TodayTaskContext } from "../../types";
import { buildBlockerMap, hasDependencyEdge } from "./dependencyUtils";
import { DependencyConnector } from "./DependencyConnector";
import { ExternalTaskBlock } from "./ExternalTaskBlock";
import { TaskBlock } from "./TaskBlock";

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
  const firstReadyIdx = tasks.findIndex((t) => t.task.status === "ready");
  const tasksById = new Map(tasks.map((t) => [t.task.id, t]));
  const blockerMap = buildBlockerMap(dependencies, tasksById);

  return (
    <div className="lane-track">
      {tasks.map((ctx, idx) => {
        const isExternal =
          ctx.task.taskType === "external" ||
          ctx.task.externalStatus === "delegated" ||
          ctx.task.externalStatus === "needs_review";
        const isPending = ctx.task.status === "pending";
        const prevTask = idx > 0 ? tasks[idx - 1] : null;
        const showConnector =
          prevTask != null &&
          hasDependencyEdge(dependencies, prevTask.task.id, ctx.task.id);

        const block = isExternal || isWatch ? (
          <ExternalTaskBlock key={ctx.task.id} ctx={ctx} laneId={laneId} />
        ) : (
          <TaskBlock
            key={ctx.task.id}
            ctx={ctx}
            laneId={laneId}
            showClaim={idx === firstReadyIdx && ctx.task.status === "ready"}
            isActive={ctx.task.status === "active"}
            isPending={isPending}
            blockerTitles={blockerMap.get(ctx.task.id) ?? []}
          />
        );

        return (
          <div key={ctx.task.id} className="lane-track__item">
            {idx > 0 && <DependencyConnector visible={showConnector} />}
            {block}
          </div>
        );
      })}
      {tasks.length === 0 && <div className="lane-track__empty">拖拽任务到此处</div>}
    </div>
  );
}
