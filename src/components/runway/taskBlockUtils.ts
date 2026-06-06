export const CARD_WIDTH = 180;
export const CARD_HEIGHT = 68;

export function cardWidth(): number {
  return CARD_WIDTH;
}

/** @deprecated Use cardWidth() — fixed card width, no estimate-based sizing */
export function blockWidth(_minutes: number | null): number {
  return CARD_WIDTH;
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
