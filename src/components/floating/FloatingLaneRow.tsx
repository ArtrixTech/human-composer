import { Bot, Check, Clock } from "lucide-react";

import type { DayLaneSnapshot, RecommendedTask, TodayTaskContext } from "../../types";
import {
  findLaneClaimableOptions,
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
}: FloatingLaneRowProps) {
  const { state, task } = getLaneState(laneSnapshot);
  const claimableOptions =
    state === "claimable" ? findLaneClaimableOptions(laneSnapshot, recommendations) : [];
  const isWatch = laneSnapshot.lane.laneType === "watch";
  const laneId = laneSnapshot.lane.id;

  return (
    <section
      className={`floating__lane-row floating__lane-row--${variant} floating__lane-row--${isWatch ? "watch" : "focus"} floating__lane-row--${state}`}
    >
      <div className="floating__lane-row-main">
        <span className="floating__lane-row-name">{laneSnapshot.lane.name}</span>
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
        {state === "external" && task && (
          <button
            type="button"
            className={variant === "compact" ? "floating__icon-btn" : "floating__cta floating__cta--ghost"}
            title="标记完成"
            onClick={() => onMarkExternalDone(task)}
          >
            {variant === "compact" ? <Check size={14} /> : "标记完成"}
          </button>
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
