import type { MappingTrace } from '@shared/components/data-mapper/utils/mappingTrace';
import { formatTraceValue, isTraceError } from '@shared/components/data-mapper/utils/mappingTrace';

interface MappingTraceOverlayProps {
  traces: MappingTrace[];
  nodeLabel: string;
  onClose: () => void;
}

export default function MappingTraceOverlay({
  traces,
  nodeLabel,
  onClose,
}: MappingTraceOverlayProps) {
  const passCount = traces.filter((t) => !isTraceError(t)).length;
  const failCount = traces.length - passCount;

  return (
    <div className="mapper-trace-overlay" data-testid="mapper-trace-overlay">
      <div className="mapper-trace-overlay-backdrop" onClick={onClose} />
      <div className="mapper-trace-overlay-panel">
        <div className="mapper-trace-overlay-header">
          <h3>Mapping Traces — {nodeLabel}</h3>
          <div className="mapper-trace-overlay-summary">
            <span className="mapper-trace-badge mapper-trace-badge--pass">{passCount} passed</span>
            <span className="mapper-trace-badge mapper-trace-badge--fail">{failCount} failed</span>
          </div>
        </div>
        <div className="mapper-trace-overlay-body">
          <table className="mapper-trace-table">
            <thead>
              <tr>
                <th>Target Path</th>
                <th>Source</th>
                <th>Value</th>
                <th>Status</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {traces.map((t) => {
                const hasError = isTraceError(t);
                return (
                  <tr key={t.mappingId} className={hasError ? 'mapper-trace-row--error' : ''}>
                    <td className="mapper-trace-cell--path">{t.targetPath}</td>
                    <td className="mapper-trace-cell--source">{t.sourcePath}</td>
                    <td className="mapper-trace-cell--value" title={formatTraceValue(t.targetValue)}>
                      {t.expression ? (
                        <span className="mapper-trace-expr" title={t.expression}>ƒx {formatTraceValue(t.targetValue)}</span>
                      ) : (
                        formatTraceValue(t.targetValue)
                      )}
                    </td>
                    <td className="mapper-trace-cell--status">
                      {hasError ? (
                        <span className="mapper-trace-status mapper-trace-status--fail" title={t.error}>✗</span>
                      ) : (
                        <span className="mapper-trace-status mapper-trace-status--pass">✓</span>
                      )}
                    </td>
                    <td className="mapper-trace-cell--duration">{t.durationMs !== undefined ? `${t.durationMs.toFixed(2)}ms` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mapper-trace-overlay-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
