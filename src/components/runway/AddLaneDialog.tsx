import { useEffect, useState } from "react";

import type { DayLaneType } from "../../types";
import { useAppStore } from "../../store/appStore";

export function AddLaneDialog({ onClose }: { onClose: () => void }) {
  const createLane = useAppStore((s) => s.createLane);
  const runwaySnapshot = useAppStore((s) => s.runwaySnapshot);
  const [laneType, setLaneType] = useState<DayLaneType>("focus");
  const focusCount =
    runwaySnapshot?.lanes.filter((l) => l.lane.laneType === "focus").length ?? 0;
  const watchCount =
    runwaySnapshot?.lanes.filter((l) => l.lane.laneType === "watch").length ?? 0;
  const defaultName = laneType === "focus" ? `专注线 ${focusCount + 1}` : `等待线 ${watchCount + 1}`;
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    setName(laneType === "focus" ? `专注线 ${focusCount + 1}` : `等待线 ${watchCount + 1}`);
  }, [laneType, focusCount, watchCount]);

  const submit = () => {
    if (!name.trim()) return;
    void createLane(name.trim(), laneType).then(onClose);
  };

  return (
    <div
      className="add-lane-dialog__backdrop"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="add-lane-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-lane-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="add-lane-title">新建泳道</h3>
        <input
          placeholder="泳道名称"
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <div className="add-lane-dialog__types">
          <label>
            <input
              type="radio"
              checked={laneType === "focus"}
              onChange={() => setLaneType("focus")}
            />
            🎯 专注
          </label>
          <label>
            <input
              type="radio"
              checked={laneType === "watch"}
              onChange={() => setLaneType("watch")}
            />
            ⏳ 等待
          </label>
        </div>
        <p className="add-lane-dialog__hint">
          专注 = 需要你主动投入注意力 · 等待 = 已委派给外部执行
        </p>
        <div className="add-lane-dialog__actions">
          <button type="button" className="add-lane-dialog__cancel" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="add-lane-dialog__submit"
            disabled={!name.trim()}
            onClick={submit}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}
