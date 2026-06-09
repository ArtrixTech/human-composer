import type { PriorityLevel } from "../../types";
import { PRIORITY_LABELS, PRIORITY_ORDER, priorityClassName } from "../../utils/priorityUtils";
import "./PriorityPicker.css";

export function PriorityPicker({
  value,
  onChange,
  size = "sm",
}: {
  value: PriorityLevel;
  onChange: (p: PriorityLevel) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className={`priority-picker priority-picker--${size}`} role="group" aria-label="优先级">
      {PRIORITY_ORDER.map((p) => (
        <button
          key={p}
          type="button"
          className={`priority-picker__btn ${priorityClassName(p)}${value === p ? " priority-picker__btn--active" : ""}`}
          onClick={() => onChange(p)}
        >
          {p} {PRIORITY_LABELS[p]}
        </button>
      ))}
    </div>
  );
}
