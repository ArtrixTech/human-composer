import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';

export type BranchLaneNodeType = Node<
  { label: string; branchIndex: number; branchId: string },
  'branchLane'
>;

function BranchLaneNode({ data }: NodeProps<BranchLaneNodeType>) {
  return (
    <div className={`branch-lane${data.branchIndex % 2 === 0 ? ' branch-lane--even' : ''}`}>
      <span className="branch-lane__label">{data.label}</span>
    </div>
  );
}

export default memo(BranchLaneNode);
