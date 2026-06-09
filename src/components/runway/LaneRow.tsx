import { useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, GripVertical, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { DayLaneSnapshot, TaskDependency } from "../../types";
import { useAppStore } from "../../store/appStore";
import { laneColorStyle } from "./laneColors";
import { LaneTrack } from "./LaneTrack";
import { partitionLaneTasks } from "./runwayTaskUtils";

const VISIBLE_CAP = 7;

export function LaneRow({
  laneSnapshot,
  dependencies = [],
  focusColorIndex = null,
}: {
  laneSnapshot: DayLaneSnapshot;
  dependencies?: TaskDependency[];
  focusColorIndex?: number | null;
}) {
  const closeLane = useAppStore((s) => s.closeLane);
  const renameLane = useAppStore((s) => s.renameLane);
  const laneColorsEnabled = useAppStore((s) => s.laneColorsEnabled);
  const [collapsed, setCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(laneSnapshot.lane.name);
  const [confirmClose, setConfirmClose] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);

  const sortableId = `lane-${laneSnapshot.lane.id}`;

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    data: { type: "lane", laneId: laneSnapshot.lane.id },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: sortableId,
    data: { laneId: laneSnapshot.lane.id },
  });

  useEffect(() => {
    setName(laneSnapshot.lane.name);
  }, [laneSnapshot.lane.name]);

  const isWatch = laneSnapshot.lane.laneType === "watch";
  const needsReview = laneSnapshot.actions.some((t) => t.action.externalStatus === "needs_review");
  const { focus, external } = partitionLaneTasks(laneSnapshot.actions);
  const hiddenCount = Math.max(0, focus.length - VISIBLE_CAP);
  const displayFocus =
    showAllTasks || focus.length <= VISIBLE_CAP ? focus : focus.slice(0, VISIBLE_CAP);
  const sortableTaskIds = [...displayFocus, ...external].map((t) => t.action.id);

  const onRename = () => {
    if (name.trim() && name !== laneSnapshot.lane.name) {
      void renameLane(laneSnapshot.lane.id, name.trim());
    }
    setEditing(false);
  };

  const onClose = () => {
    if (laneSnapshot.actions.length === 0) {
      void closeLane(laneSnapshot.lane.id);
      return;
    }
    setConfirmClose(true);
  };

  const stats = [
    `${laneSnapshot.completedCount}/${laneSnapshot.totalCount}`,
    laneSnapshot.estimatedFinishTime ? `~${laneSnapshot.estimatedFinishTime}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const colorStyle = laneColorStyle(
    laneSnapshot.lane.laneType,
    focusColorIndex,
    laneColorsEnabled,
  );
  const sectionStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...colorStyle,
  };
  const hasLaneColor = Boolean(colorStyle);

  return (
    <section
      ref={setSortableRef}
      style={sectionStyle}
      className={`lane-section lane-section--${laneSnapshot.lane.laneType}${hasLaneColor ? " lane-section--colored" : ""}${isOver ? " lane-section--over" : ""}${isDragging ? " lane-section--dragging" : ""}`}
    >
      <div className="lane-section__header">
        <button
          type="button"
          className="lane-section__drag"
          aria-label="拖拽调整泳道顺序"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>

        {editing ? (
          <input
            className="lane-section__name-input"
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
          <div className="lane-section__name-wrap">
            {hasLaneColor && <span className="lane-section__color-dot" aria-hidden />}
            <button
              type="button"
              className="lane-section__name"
              onDoubleClick={() => setEditing(true)}
            >
              {laneSnapshot.lane.name}
            </button>
            {needsReview && <span className="lane-section__review-dot" title="待审核" />}
            <button
              type="button"
              className="lane-section__rename"
              aria-label="重命名泳道"
              onClick={() => setEditing(true)}
            >
              <Pencil size={11} />
            </button>
          </div>
        )}

        <span className="lane-section__stats">{stats}</span>

        <div className="lane-section__actions">
          <button
            type="button"
            className="lane-section__collapse"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "展开" : "折叠"}
            aria-expanded={!collapsed}
          >
            <ChevronDown size={14} className={collapsed ? "lane-section__chevron--collapsed" : ""} />
          </button>
          <button type="button" className="lane-section__close" onClick={onClose} aria-label="关闭泳道">
            <X size={14} />
          </button>
        </div>
      </div>

      {confirmClose && (
        <div className="lane-section__confirm">
          <span>确认关闭？行动将合并到其他泳道</span>
          <button type="button" onClick={() => setConfirmClose(false)}>
            取消
          </button>
          <button
            type="button"
            className="lane-section__confirm-yes"
            onClick={() => {
              setConfirmClose(false);
              void closeLane(laneSnapshot.lane.id);
            }}
          >
            确认
          </button>
        </div>
      )}

      <div
        ref={setDropRef}
        className={`lane-section__body${collapsed ? " lane-section__body--collapsed" : ""}`}
      >
        <SortableContext items={sortableTaskIds} strategy={horizontalListSortingStrategy}>
          <LaneTrack
            laneId={laneSnapshot.lane.id}
            focusTasks={displayFocus}
            externalTasks={external}
            isWatch={isWatch}
            dependencies={dependencies}
          />
        </SortableContext>
        {!collapsed && hiddenCount > 0 && !showAllTasks && (
          <button type="button" className="lane-section__more" onClick={() => setShowAllTasks(true)}>
            +{hiddenCount} 项
          </button>
        )}
      </div>
    </section>
  );
}
