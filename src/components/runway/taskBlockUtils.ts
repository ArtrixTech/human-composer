export function blockWidth(minutes: number | null): number {
  const m = minutes ?? 30;
  return Math.max(100, Math.min(320, 100 + (m - 15) * 2));
}

export function formatEstimate(minutes: number | null, pending = false): string {
  const m = minutes ?? 30;
  return pending ? `~${m}m` : `${m}m`;
}

export function formatMinutesTotal(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h > 0) return `${h}h${min > 0 ? `${min}m` : ""}`;
  return `${min}m`;
}
