import type { TodayTaskContext } from "../../types";

export function CompletedBar({
  completed,
  listOnly = false,
}: {
  completed: TodayTaskContext[];
  listOnly?: boolean;
}) {
  if (completed.length === 0) return null;

  if (!listOnly) return null;

  return (
    <ul className="completed-bar__list completed-bar__list--inline">
      {completed.map((item) => (
        <li key={item.action.id}>
          <span className="completed-bar__title">{item.action.title}</span>
          <span className="completed-bar__meta">
            {item.projectName}
            {item.outcomeName ? ` · ${item.outcomeName}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
