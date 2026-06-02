import type { DayLaneSnapshot, TaskDependency } from "../../types";
import { useAppStore } from "../../store/appStore";
import { LaneRow } from "./LaneRow";

export function LanesContainer({
  lanes,
  dependencies = [],
}: {
  lanes: DayLaneSnapshot[];
  dependencies?: TaskDependency[];
  suggestedClaimTaskId?: string | null;
}) {
  const backlogCount = useAppStore((s) => s.runwaySnapshot?.backlog.length ?? 0);
  const setAddLaneOpen = useAppStore((s) => s.setAddLaneOpen);

  if (lanes.length === 0) {
    return (
      <section className="lanes-container lanes-container--empty">
        <p>
          {backlogCount > 0
            ? `暂无泳道 — 下方待分配区有 ${backlogCount} 项任务可拖入泳道`
            : "暂无泳道 — 点击「+ 泳道」开始安排"}
        </p>
        <button type="button" className="lanes-container__cta" onClick={() => setAddLaneOpen(true)}>
          + 创建第一条泳道
        </button>
      </section>
    );
  }

  return (
    <section className="lanes-container">
      {lanes.map((lane) => (
        <LaneRow key={lane.lane.id} laneSnapshot={lane} dependencies={dependencies} />
      ))}
    </section>
  );
}
