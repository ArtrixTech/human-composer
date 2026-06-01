export function DependencyConnector({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="dependency-connector" aria-hidden="true">
      <span className="dependency-connector__line" />
      <span className="dependency-connector__arrow">→</span>
    </div>
  );
}
