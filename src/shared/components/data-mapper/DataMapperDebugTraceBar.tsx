interface DataMapperDebugTraceBarProps {
  traceCount: number;
  traceErrorCount: number;
}

export default function DataMapperDebugTraceBar({
  traceCount,
  traceErrorCount,
}: DataMapperDebugTraceBarProps) {
  return (
    <div className="dm-debug-bar" role="status" aria-live="polite">
      <span className="dm-debug-bar-label">Debug Overlay</span>
      <span className="dm-debug-bar-stats">
        {traceCount} trace{traceCount !== 1 ? 's' : ''}
        {traceErrorCount > 0 && (
          <span className="dm-debug-bar-errors">
            {' '}
            · {traceErrorCount} error{traceErrorCount !== 1 ? 's' : ''}
          </span>
        )}
      </span>
    </div>
  );
}
