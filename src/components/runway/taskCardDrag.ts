import type { PointerEvent as ReactPointerEvent } from "react";

/** Prevent drag activation when interacting with action buttons inside a card. */
export function stopCardDrag(e: ReactPointerEvent) {
  e.stopPropagation();
}
