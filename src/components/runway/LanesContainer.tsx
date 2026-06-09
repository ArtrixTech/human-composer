import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import type { DayLaneSnapshot, TaskDependency } from "../../types";
import { useAppStore } from "../../store/appStore";
import { LaneRow } from "./LaneRow";
import { sortLanesForDisplay } from "./runwayTaskUtils";

export function LanesContainer({
  lanes,
  dependencies = [],
}: {
  lanes: DayLaneSnapshot[];
  dependencies?: TaskDependency[];
  suggestedClaimTaskId?: string | null;
}) {
  const setAddLaneOpen = useAppStore((s) => s.setAddLaneOpen);
  const sortedLanes = sortLanesForDisplay(lanes);
  const laneSortIds = sortedLanes.map((l) => `lane-${l.lane.id}`);

  if (lanes.length === 0) {
    return (
      <section className="lanes-container lanes-container--empty">
        <p>暂无泳道 — 点击「+ 泳道」开始安排</p>
        <button type="button" className="lanes-container__cta" onClick={() => setAddLaneOpen(true)}>
          + 创建第一条泳道
        </button>
      </section>
    );
  }

  return (
    <section className="lanes-container">
      <SortableContext items={laneSortIds} strategy={verticalListSortingStrategy}>
        {sortedLanes.map((lane) => (
          <LaneRow key={lane.lane.id} laneSnapshot={lane} dependencies={dependencies} />
        ))}
      </SortableContext>
    </section>
  );
}
