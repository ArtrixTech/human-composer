import { useEffect, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Task } from '../../types';
import { useStore } from '../../store/useStore';
import { buildFlowData } from './layout';
import BranchLaneNode from './nodes/BranchLaneNode';
import TaskNode from './nodes/TaskNode';
import AddTaskNode from './nodes/AddTaskNode';

interface DAGCanvasProps {
  onSelectTask: (task: Task) => void;
}

const nodeTypes: NodeTypes = {
  taskNode: TaskNode,
  branchLane: BranchLaneNode,
  addTaskNode: AddTaskNode,
};

export default function DAGCanvas({ onSelectTask }: DAGCanvasProps) {
  const { branches, tasks, dependencies } = useStore();

  const { rawNodes, rawEdges } = useMemo(() => {
    const { nodes, edges } = buildFlowData(branches, tasks, dependencies);
    return {
      rawNodes: nodes.map((n) =>
        n.type === 'taskNode'
          ? { ...n, data: { ...n.data, onSelect: onSelectTask } }
          : n,
      ),
      rawEdges: edges,
    };
  }, [branches, tasks, dependencies, onSelectTask]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rawNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  useEffect(() => {
    setNodes(rawNodes);
  }, [rawNodes, setNodes]);

  useEffect(() => {
    setEdges(rawEdges);
  }, [rawEdges, setEdges]);

  return (
    <div className="dag-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{ type: 'smoothstep', animated: false }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={28}
          size={1}
          color="rgba(255,255,255,0.04)"
        />
        <Controls
          showInteractive={false}
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        />
      </ReactFlow>
    </div>
  );
}
