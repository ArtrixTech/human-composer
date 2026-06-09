import { useCallback, useEffect, useRef, useState } from "react";

import type { ActionDependency } from "../../types";

export interface PortPoint {
  x: number;
  y: number;
}

export interface TaskPorts {
  taskId: string;
  in: PortPoint;
  out: PortPoint;
}

export interface BlockEdge {
  id: string;
  sourceId: string;
  targetId: string;
  path: string;
}

const BLOCK_STUB = 14;

/** Right-side ports: exit right → vertical bus → enter target from the right. */
function orthogonalBlockPath(x1: number, y1: number, x2: number, y2: number): string {
  const laneX = Math.max(x1, x2) + BLOCK_STUB;
  return `M ${x1} ${y1} H ${laneX} V ${y2} H ${x2}`;
}

function measurePorts(boardEl: HTMLElement): Map<string, TaskPorts> {
  const boardRect = boardEl.getBoundingClientRect();
  const map = new Map<string, TaskPorts>();

  boardEl.querySelectorAll<HTMLElement>("[data-card-id]").forEach((card) => {
    const taskId = card.dataset.cardId;
    if (!taskId) return;
    const inEl = card.querySelector<HTMLElement>('[data-port="block-in"]');
    const outEl = card.querySelector<HTMLElement>('[data-port="block-out"]');
    if (!inEl || !outEl) return;

    const inRect = inEl.getBoundingClientRect();
    const outRect = outEl.getBoundingClientRect();

    map.set(taskId, {
      taskId,
      in: {
        x: inRect.left + inRect.width / 2 - boardRect.left,
        y: inRect.top + inRect.height / 2 - boardRect.top,
      },
      out: {
        x: outRect.left + outRect.width / 2 - boardRect.left,
        y: outRect.top + outRect.height / 2 - boardRect.top,
      },
    });
  });

  return map;
}

export function useBlockConnections({
  boardRef,
  dependencies,
  visibleTaskIds,
  existingPairs,
  onConnect,
  onConnectingChange,
}: {
  boardRef: React.RefObject<HTMLElement | null>;
  dependencies: ActionDependency[];
  visibleTaskIds: Set<string>;
  existingPairs: Set<string>;
  onConnect: (targetId: string, sourceId: string) => void;
  onConnectingChange?: (connecting: boolean) => void;
}) {
  const [ports, setPorts] = useState<Map<string, TaskPorts>>(new Map());
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [highlightTarget, setHighlightTarget] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const dragSourceRef = useRef<string | null>(null);
  const portsRef = useRef(ports);
  const visibleRef = useRef(visibleTaskIds);
  const pairsRef = useRef(existingPairs);
  const onConnectRef = useRef(onConnect);
  const onConnectingChangeRef = useRef(onConnectingChange);

  portsRef.current = ports;
  visibleRef.current = visibleTaskIds;
  pairsRef.current = existingPairs;
  onConnectRef.current = onConnect;
  onConnectingChangeRef.current = onConnectingChange;

  const remeasure = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    setPorts(measurePorts(board));
  }, [boardRef]);

  useEffect(() => {
    remeasure();
    const board = boardRef.current;
    if (!board) return;

    const ro = new ResizeObserver(() => remeasure());
    ro.observe(board);
    window.addEventListener("resize", remeasure);

    const host = board.parentElement;
    host?.addEventListener("scroll", remeasure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", remeasure);
      host?.removeEventListener("scroll", remeasure);
    };
  }, [boardRef, remeasure, dependencies, visibleTaskIds]);

  const edges: BlockEdge[] = [];
  for (const dep of dependencies) {
    if (!visibleTaskIds.has(dep.taskId) || !visibleTaskIds.has(dep.dependsOnTaskId)) {
      continue;
    }
    const source = ports.get(dep.dependsOnTaskId);
    const target = ports.get(dep.taskId);
    if (!source || !target) continue;
    edges.push({
      id: `block-${dep.dependsOnTaskId}-${dep.taskId}`,
      sourceId: dep.dependsOnTaskId,
      targetId: dep.taskId,
      path: orthogonalBlockPath(source.out.x, source.out.y, target.in.x, target.in.y),
    });
  }

  const endDrag = useCallback(() => {
    dragSourceRef.current = null;
    setPreviewPath(null);
    setHighlightTarget(null);
    setConnecting(false);
    onConnectingChangeRef.current?.(false);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
  }, []);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      const board = boardRef.current;
      const sourceId = dragSourceRef.current;
      if (!board || !sourceId) return;

      const boardRect = board.getBoundingClientRect();
      const source = portsRef.current.get(sourceId);
      if (!source) return;

      const cx = e.clientX - boardRect.left;
      const cy = e.clientY - boardRect.top;
      setPreviewPath(orthogonalBlockPath(source.out.x, source.out.y, cx, cy));

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const inPort = el?.closest('[data-port="block-in"]') as HTMLElement | null;
      const targetId = inPort?.dataset.taskId ?? null;
      if (
        targetId &&
        targetId !== sourceId &&
        visibleRef.current.has(targetId) &&
        !pairsRef.current.has(`${targetId}:${sourceId}`)
      ) {
        setHighlightTarget(targetId);
      } else {
        setHighlightTarget(null);
      }
    },
    [boardRef],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      const sourceId = dragSourceRef.current;
      if (!sourceId) {
        endDrag();
        return;
      }

      const el = document.elementFromPoint(e.clientX, e.clientY);
      const inPort = el?.closest('[data-port="block-in"]') as HTMLElement | null;
      const targetId = inPort?.dataset.taskId ?? null;

      if (
        targetId &&
        targetId !== sourceId &&
        visibleRef.current.has(targetId) &&
        !pairsRef.current.has(`${targetId}:${sourceId}`)
      ) {
        onConnectRef.current(targetId, sourceId);
      }
      endDrag();
    },
    [endDrag],
  );

  const startDrag = useCallback(
    (sourceId: string, e: React.PointerEvent) => {
      e.preventDefault();
      dragSourceRef.current = sourceId;
      setConnecting(true);
      onConnectingChangeRef.current?.(true);
      remeasure();

      const board = boardRef.current;
      if (board) {
        const measured = measurePorts(board);
        setPorts(measured);
        const source = measured.get(sourceId);
        if (source) {
          const boardRect = board.getBoundingClientRect();
          const cx = e.clientX - boardRect.left;
          const cy = e.clientY - boardRect.top;
          setPreviewPath(orthogonalBlockPath(source.out.x, source.out.y, cx, cy));
        }
      }

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [boardRef, remeasure, handlePointerMove, handlePointerUp],
  );

  useEffect(() => () => endDrag(), [endDrag]);

  return {
    edges,
    previewPath,
    highlightTarget,
    connecting,
    startDrag,
    remeasure,
  };
}
