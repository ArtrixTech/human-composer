import { Bot, Check, Clock } from "lucide-react";

import type { DayLaneSnapshot, RecommendedTask, TodayTaskContext } from "../../types";
import { useAppStore } from "../../store/appStore";
import { laneColorStyle } from "../runway/laneColors";
import { PRIORITY_LABELS } from "../../utils/priorityUtils";
import {
  findLaneClaimableOptions,
  getLaneExternalTasks,
  getLaneState,
  type LaneState,
} from "../runway/runwayTaskUtils";

const STATE_LABEL: Record<LaneState, string> = {
  active: "进行中",
  review: "待审核",
  claimable: "可领取",
  external: "外部执行",
  idle: "空闲",
};

export interface FloatingLaneRowProps {
  laneSnapshot: DayLaneSnapshot;
  variant: "compact" | "comfortable";
  recommendations: RecommendedTask[];
  onComplete: (ctx: TodayTaskContext) => void;
  onPostpone: (ctx: TodayTaskContext, laneId: string) => void;
  onClaim: (taskId: string, laneId: string, projectId: string) => void;
  onDelegate: (ctx: TodayTaskContext, laneId: string) => void;
  onMarkExternalDone: (ctx: TodayTaskContext) => void;
  onReview: () => void;
  focusColorIndex?: number | null;
}

export function FloatingLaneRow({
  laneSnapshot,
  variant,
  recommendations,
  onComplete,
  onPostpone,
  onClaim,
  onDelegate,
  onMarkExternalDone,
  onReview,
  focusColorIndex = null,
}: FloatingLaneRowProps) {
  const laneColorsEnabled = useAppStore((s) => s.laneColorsEnabled);
  const { state, task } = getLaneState(laneSnapshot);
  const externalTasks = getLaneExternalTasks(laneSnapshot);
  const claimableOptions =
    state === "claimable" ? findLaneClaimableOptions(laneSnapshot, recommendations) : [];
  const isWatch = laneSnapshot.lane.laneType === "watch";
  const laneId = laneSnapshot.lane.id;
  const tier = laneSnapshot.lane.priorityTier;

  const colorStyle = laneColorStyle(laneSnapshot.lane.laneType, focusColorIndex, laneColorsEnabled);
  const hasLaneColor = Boolean(colorStyle);

  return (
    <section
      style={colorStyle}
      className={`floating__lane-row floating__lane-row--${variant} floating__lane-row--${isWatch ? "watch" : "focus"} floating__lane-row--${state} floating__lane-row--priority-${tier.toLowerCase()}${hasLaneColor ? " floating__lane-row--colored" : ""}`}
    >
      <div className="floating__lane-row-main">
        <span className="floating__lane-row-name">
          {laneSnapshot.lane.name}
          {!isWatch && variant === "comfortable" && (
            <span className={`floating__lane-tier floating__lane-tier--${tier.toLowerCase()}`}>
              {PRIORITY_LABELS[tier]}
            </span>
          )}
        </span>
        {variant === "comfortable" && state !== "claimable" && (
          <span className="floating__lane-row-state">{STATE_LABEL[state]}</span>
        )}
        {state === "claimable" && claimableOptions.length > 0 ? (
          <div className="floating__lane-picks" onClick={(e) => e.stopPropagation()}>
            {claimableOptions.map((option, index) => (
              <button
                key={option.action.id}
                type="button"
                className={
                  index === 0
                    ? "floating__lane-pick floating__lane-pick--top"
                    : "floating__lane-pick"
                }
                title={option.action.title}
                onClick={() => onClaim(option.action.id, laneId, option.projectId)}
              >
                {option.action.title}
              </button>
            ))}
          </div>
        ) : state === "external" && externalTasks.length > 0 ? (
          <div className="floating__lane-external-list">
            {externalTasks.map((ext) => (
              <span key={ext.action.id} className="floating__lane-row-task floating__lane-external-item">
                {ext.action.title}
              </span>
            ))}
          </div>
        ) : task ? (
          <span className="floating__lane-row-task">{task.action.title}</span>
        ) : (
          <span className="floating__lane-row-empty">暂无行动</span>
        )}
      </div>
      <div className="floating__lane-row-actions" onClick={(e) => e.stopPropagation()}>
        {state === "active" && task && (
          <div className="floating__quick-actions">
            <button
              type="button"
              className="floating__icon-btn floating__icon-btn--done"
              title="完成"
              aria-label="完成"
              onClick={() => onComplete(task)}
            >
              <Check size={14} />
            </button>
            {!isWatch && (
              <button
                type="button"
                className="floating__icon-btn floating__icon-btn--postpone"
                title="稍后再做"
                aria-label="稍后"
                onClick={() => onPostpone(task, laneId)}
              >
                <Clock size={14} />
              </button>
            )}
            {!isWatch && task.action.taskType === "normal" && (
              <button
                type="button"
                className="floating__icon-btn floating__icon-btn--delegate"
                title="委派外部执行"
                aria-label="委派"
                onClick={() => onDelegate(task, laneId)}
              >
                <Bot size={14} />
              </button>
            )}
          </div>
        )}
        {state === "external" && externalTasks.length > 0 && (
          <div className="floating__external-actions">
            {externalTasks.slice(0, variant === "compact" ? 2 : 4).map((ext) => (
              <button
                key={ext.action.id}
                type="button"
                className={variant === "compact" ? "floating__icon-btn" : "floating__cta floating__cta--ghost"}
                title={`标记完成：${ext.action.title}`}
                onClick={() => onMarkExternalDone(ext)}
              >
                {variant === "compact" ? <Check size={14} /> : "完成"}
              </button>
            ))}
            {externalTasks.length > (variant === "compact" ? 2 : 4) && (
              <span className="floating__lane-row-empty">+{externalTasks.length - (variant === "compact" ? 2 : 4)}</span>
            )}
          </div>
        )}
        {state === "review" && task && (
          <button
            type="button"
            className={
              variant === "compact"
                ? "floating__icon-btn floating__icon-btn--review"
                : "floating__cta floating__cta--review"
            }
            title="审核"
            onClick={onReview}
          >
            {variant === "compact" ? <Check size={14} /> : "审核"}
          </button>
        )}
      </div>
    </section>
  );
}
