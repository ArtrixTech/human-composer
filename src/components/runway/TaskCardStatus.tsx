export type TaskCardStatusKind =
  | "active"
  | "claimable"
  | "pending"
  | "queued"
  | "external"
  | "review";

const STATUS_LABEL: Partial<Record<TaskCardStatusKind, string>> = {
  active: "进行中",
  claimable: "可领取",
  pending: "等待",
  external: "外部",
  review: "待审核",
};

export function TaskCardStatus({ kind }: { kind: TaskCardStatusKind }) {
  const label = STATUS_LABEL[kind];

  return (
    <span className={`task-card__status task-card__status--${kind}`}>
      <span className={`task-card__dot task-card__dot--${kind}`} aria-hidden="true" />
      {label && <span className="task-card__badge">{label}</span>}
    </span>
  );
}
