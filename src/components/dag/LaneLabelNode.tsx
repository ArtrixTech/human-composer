import type { NodeProps } from "@xyflow/react";

export function LaneLabelNode({ data }: NodeProps) {
  const label = (data as { label: string }).label;
  return <div className="lane-label">{label}</div>;
}
