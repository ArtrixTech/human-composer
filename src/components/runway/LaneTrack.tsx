import type { TaskDependency, TodayTaskContext } from "../../types";
import { buildBlockerMap, hasDependencyEdge } from "./dependencyUtils";
import { DependencyConnector } from "./DependencyConnector";
import { ExternalTaskBlock } from "./ExternalTaskBlock";
import { TaskBlock } from "./TaskBlock";
import { isExternalActive } from "./runwayTaskUtils";

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
  // First claimable ready slot: skip external-active tasks that occupy the active slot
  const firstReadyIdx = tasks.findIndex(
    (t) => t.task.status === "ready" && !isExternalActive(t),
  );
  const tasksById = new Map(tasks.map((t) => [t.task.id, t]));
  const blockerMap = buildBlockerMap(dependencies, tasksById);

  return (
    <div className="lane-track">
      {tasks.map((ctx, idx) => {
        // Route to ExternalTaskBlock only when the task itself is external,
        // not based on the lane type — so normal tasks dragged into a watch lane
        // still render with claim/complete controls.
        const isExternal = isExternalActive(ctx);
        const isPending = ctx.task.status === "pending";
        const prevTask = idx > 0 ? tasks[idx - 1] : null;
        const showConnector =
          prevTask != null &&
          hasDependencyEdge(dependencies, prevTask.task.id, ctx.task.id);

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
