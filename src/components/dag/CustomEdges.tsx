import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

export function SequentialEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: "var(--border-default)",
        strokeWidth: 1.5,
      }}
    />
  );
}

export function BlockingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: "var(--accent)",
        strokeWidth: 1.5,
        strokeDasharray: "6 4",
        opacity: 0.7,
      }}
      markerEnd="url(#blocking-arrow)"
    />
  );
}

export function BlockingEdgeMarker() {
  return (
    <defs>
      <marker
        id="blocking-arrow"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth={6}
        markerHeight={6}
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" opacity={0.7} />
      </marker>
    </defs>
  );
}
