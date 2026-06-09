import type { BlockEdge } from "./useBlockConnections";

export function KanbanEdges({
  edges,
  previewPath,
}: {
  edges: BlockEdge[];
  previewPath: string | null;
}) {
  return (
    <svg className="kanban-edges" aria-hidden>
      <defs>
        <marker
          id="kanban-block-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth={6}
          markerHeight={6}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255, 255, 255, 0.3)" />
        </marker>
      </defs>
      {edges.map((edge) => (
        <path
          key={edge.id}
          className="kanban-edges__path"
          d={edge.path}
          markerEnd="url(#kanban-block-arrow)"
        />
      ))}
      {previewPath && <path className="kanban-edges__path kanban-edges__path--preview" d={previewPath} />}
    </svg>
  );
}
