/** @deprecated Use inline heavy-load badge in RunwayHeader. Kept for any external imports. */
export function FocusHealthIndicator({ focusLaneCount }: { focusLaneCount: number }) {
  if (focusLaneCount < 3) return null;
  return <span className="runway-header__heavy">高负荷</span>;
}
