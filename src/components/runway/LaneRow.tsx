import { useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { DayLaneSnapshot, TaskDependency } from "../../types";
import { useAppStore } from "../../store/appStore";
import { formatMinutesTotal } from "./taskBlockUtils";
import { LaneTrack } from "./LaneTrack";

const VISIBLE_CAP = 7;

export function LaneRow({
  laneSnapshot,
  dependencies = [],
}: {
  laneSnapshot: DayLaneSnapshot;
  dependencies?: TaskDependency[];
}) {
  const closeLane = useAppStore((s) => s.closeLane);
  const renameLane = useAppStore((s) => s.renameLane);
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(laneSnapshot.lane.name);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);

  useEffect(() => {
    setName(laneSnapshot.lane.name);
  }, [laneSnapshot.lane.name]);

  const { setNodeRef, isOver } = useDroppable({
    id: `lane-${laneSnapshot.lane.id}`,
    data: { laneId: laneSnapshot.lane.id },
  });

  const isWatch = laneSnapshot.lane.laneType === "watch";
  const needsReview = laneSnapshot.tasks.some((t) => t.task.externalStatus === "needs_review");
  const hiddenCount = Math.max(0, laneSnapshot.tasks.length - VISIBLE_CAP);
  const displayTasks =
    showAllTasks || laneSnapshot.tasks.length <= VISIBLE_CAP
      ? laneSnapshot.tasks
      : laneSnapshot.tasks.slice(0, VISIBLE_CAP);

  const pendingMinutes = laneSnapshot.tasks
    .filter((t) => t.task.status === "pending")
    .reduce((sum, t) => sum + (t.task.estimatedMinutes ?? 30), 0);

  const onRename = () => {
    if (name.trim() && name !== laneSnapshot.lane.name) {
      void renameLane(laneSnapshot.lane.id, name.trim());
    }
    setEditing(false);
  };

  const onClose = () => {
    if (laneSnapshot.tasks.length === 0) {
      void closeLane(laneSnapshot.lane.id);
      return;
    }
    setConfirmClose(true);
  };

  return (
    <div
      ref={setNodeRef}
      className={`lane-row lane-row--${laneSnapshot.lane.laneType}${isOver ? " lane-row--over" : ""}`}
    >
      <div className="lane-row__header">
        <span className="lane-row__icon">{isWatch ? "⏳" : "🎯"}</span>
        {editing ? (
          <input
            className="lane-row__name-input"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={onRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRename();
              if (e.key === "Escape") {
                setName(laneSnapshot.lane.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <div className="lane-row__name-wrap">
            <button
              type="button"
              className="lane-row__name"
              onDoubleClick={() => setEditing(true)}
            >
              {laneSnapshot.lane.name}
            </button>
            <button
              type="button"
              className="lane-row__rename"
              aria-label="重命名泳道"
              onClick={() => setEditing(true)}
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
        {needsReview && <span className="lane-row__badge">待审核</span>}
        <span className="lane-row__progress">
          {laneSnapshot.completedCount}/{laneSnapshot.totalCount}
        </span>
        {pendingMinutes > 0 && (
          <span className="lane-row__pending-est">
            待解锁 {formatMinutesTotal(pendingMinutes)}
          </span>
        )}
        {laneSnapshot.estimatedFinishTime && (
          <span className="lane-row__finish">~{laneSnapshot.estimatedFinishTime}</span>
        )}
        <div className="lane-row__actions">
          <button
            type="button"
            className="lane-row__collapse"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "展开" : "折叠"}
            aria-expanded={!collapsed}
          >
            <ChevronDown size={14} className={collapsed ? "lane-row__chevron--collapsed" : ""} />
          </button>
          <button
            type="button"
            className="lane-row__close"
            onClick={onClose}
            aria-label="关闭泳道"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {confirmClose && (
        <div className="lane-row__confirm">
          <span>确认关闭？任务将回到待分配</span>
          <button type="button" onClick={() => setConfirmClose(false)}>
            取消
          </button>
          <button
            type="button"
            className="lane-row__confirm-yes"
            onClick={() => {
              setConfirmClose(false);
              void closeLane(laneSnapshot.lane.id);
            }}
          >
            确认
          </button>
        </div>
      )}

      <div className={`lane-row__body${collapsed ? " lane-row__body--collapsed" : ""}`}>
        <SortableContext
          items={displayTasks.map((t) => t.task.id)}
          strategy={horizontalListSortingStrategy}
        >
          <LaneTrack
            laneId={laneSnapshot.lane.id}
            tasks={displayTasks}
            isWatch={isWatch}
            dependencies={dependencies}
          />
        </SortableContext>
        {!collapsed && hiddenCount > 0 && !showAllTasks && (
          <button
            type="button"
            className="lane-row__more"
            onClick={() => setShowAllTasks(true)}
          >
            +{hiddenCount} 项
          </button>
        )}
      </div>
    </div>
  );
}
