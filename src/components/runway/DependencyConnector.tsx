export function DependencyConnector({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="dependency-connector" aria-hidden="true">
      <svg width="20" height="12" viewBox="0 0 20 12" fill="none">
        <path
          d="M0 6H14M14 6L10 2M14 6L10 10"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
