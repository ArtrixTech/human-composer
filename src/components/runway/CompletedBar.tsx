import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { TodayTaskContext } from "../../types";
import { formatMinutesTotal } from "./taskBlockUtils";

export function CompletedBar({ completed }: { completed: TodayTaskContext[] }) {
  const [showList, setShowList] = useState(false);
  const completedMinutes = completed.reduce(
    (sum, c) => sum + (c.task.estimatedMinutes ?? 30),
    0,
  );

  if (completed.length === 0) return null;

  return (
    <footer className="completed-bar">
      <button
        type="button"
        className="completed-bar__summary"
        onClick={() => setShowList(!showList)}
        aria-expanded={showList}
      >
        <span>✓ 已完成 {completed.length} 项 ({formatMinutesTotal(completedMinutes)})</span>
        <ChevronDown size={14} className={showList ? "completed-bar__chevron--open" : ""} />
      </button>
      {showList && (
        <ul className="completed-bar__list">
          {completed.map((item) => (
            <li key={item.task.id}>
              {item.task.title}
              <span>
                {item.projectName}
                {item.branchName ? ` · ${item.branchName}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </footer>
  );
}
