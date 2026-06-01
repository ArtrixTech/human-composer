export function FocusHealthIndicator({ focusLaneCount }: { focusLaneCount: number }) {
  let label = "专注模式";
  let cls = "focus-health focus-health--single";
  if (focusLaneCount === 2) {
    label = "并行模式";
    cls = "focus-health focus-health--parallel";
  } else if (focusLaneCount >= 3) {
    label = "高负荷";
    cls = "focus-health focus-health--heavy";
  }

  return (
    <span className={cls} title={`${focusLaneCount} 条专注泳道`}>
      {label} ({focusLaneCount}泳道)
    </span>
  );
}
