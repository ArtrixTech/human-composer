import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { useEffect, useState } from "react";

import type { TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";

function BacklogChip({ ctx }: { ctx: TodayTaskContext }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `backlog-${ctx.task.id}`,
    data: { task: ctx, backlog: true },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.5 : 1 }
    : undefined;

  const est = ctx.task.estimatedMinutes ?? 30;

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`backlog-chip${ctx.task.status === "pending" ? " backlog-chip--pending" : ""}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      {ctx.task.title}
      <span className="backlog-chip__est">
        {ctx.task.status === "pending" ? "等待依赖" : `${est}m`}
      </span>
    </button>
  );
}

export function BacklogPool({ items }: { items: TodayTaskContext[] }) {
  const [expanded, setExpanded] = useState(false);
  const assignToLane = useAppStore((s) => s.assignToLane);
  const lanes = useAppStore((s) => s.runwaySnapshot?.lanes ?? []);
  const totalInLanes = lanes.reduce((n, lane) => n + lane.tasks.length, 0);

  useEffect(() => {
    if (items.length > 0 && totalInLanes === 0) {
      setExpanded(true);
    }
  }, [items.length, totalInLanes]);

  const { setNodeRef, isOver } = useDroppable({
    id: "backlog-pool",
    data: { backlog: true },
  });

  if (items.length === 0) return null;

  return (
    <section
      ref={setNodeRef}
      className={`backlog-pool${isOver ? " backlog-pool--over" : ""}`}
    >
      <button
        type="button"
        className="backlog-pool__toggle"
        onClick={() => setExpanded(!expanded)}
      >
        ┄┄ 待分配 ({items.length}项
        {items.some((i) => i.task.status === "ready") &&
        items.some((i) => i.task.status === "pending")
          ? "：就绪+等待依赖"
          : items[0]?.task.status === "pending"
            ? "：等待依赖"
            : "就绪"}
        ) ┄┄ {expanded ? "收起" : "展开"}
      </button>
      <div className={`backlog-pool__items${expanded ? " backlog-pool__items--expanded" : ""}`}>
        {items.map((ctx) => (
          <div key={ctx.task.id} className="backlog-pool__item-row">
            <BacklogChip ctx={ctx} />
            {lanes.length > 0 && (
              <select
                className="backlog-pool__assign"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    void assignToLane(ctx.task.id, e.target.value);
                    e.target.value = "";
                  }
                }}
              >
                <option value="">移入泳道…</option>
                {lanes.map((l) => (
                  <option key={l.lane.id} value={l.lane.id}>
                    {l.lane.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
