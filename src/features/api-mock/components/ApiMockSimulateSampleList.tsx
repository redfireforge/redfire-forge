import type { ApiMockSimulationResultV1, ApiMockSimulationSampleV1 } from '../../../shared/api-mock/contracts';
import { capturedRequestPath } from '../apiMockJournalActions';
import { isAutoRouteSample, simulateSampleBadge } from './apiMockSimulateModalHelpers';

export function ApiMockSimulateSampleList({
  adHocId,
  samples,
  filteredSamples,
  firstPersistedIdx,
  firstAutoIdx,
  selectedSampleId,
  resultBySample,
  filter,
  setFilter,
  passedCount,
  conflictCount,
  onSelectSample,
  onRemoveSample,
}: {
  adHocId: string;
  samples: ApiMockSimulationSampleV1[];
  filteredSamples: ApiMockSimulationSampleV1[];
  firstPersistedIdx: number;
  firstAutoIdx: number;
  selectedSampleId: string;
  resultBySample: Record<string, ApiMockSimulationResultV1>;
  filter: string;
  setFilter: (value: string) => void;
  passedCount: number;
  conflictCount: number;
  onSelectSample: (sample: ApiMockSimulationSampleV1) => void;
  onRemoveSample: (id: string) => void;
}) {
  return (
    <aside className="am-sim-samples" data-testid="api-mock-sim-samples">
      <div className="am-panel-head">
        <span className="am-panel-title">Samples</span>
        <span className="am-count-badge">{samples.length}</span>
      </div>
      <div style={{ padding: 8 }}>
        <input
          className="am-search"
          placeholder="Filter samples…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          aria-label="Filter samples"
        />
      </div>
      {filteredSamples.map((s, idx) => {
        const r = resultBySample[s.id];
        const badge = simulateSampleBadge(r);
        const isAdHoc = s.id === adHocId;
        return (
          <div key={s.id}>
            {isAdHoc && (
              <div className="am-sim-sample-section" data-testid="api-mock-sim-section-scratch">Scratch pad</div>
            )}
            {!isAdHoc && !isAutoRouteSample(s.id) && idx === firstPersistedIdx && (
              <div className="am-sim-sample-section" data-testid="api-mock-sim-section-saved">Saved samples</div>
            )}
            {isAutoRouteSample(s.id) && idx === firstAutoIdx && (
              <div className="am-sim-sample-section" data-testid="api-mock-sim-section-from-rules">
                From rules
                <span className="am-sim-sample-section-note">Suggested probes — not saved</span>
              </div>
            )}
            <div
              className={`am-sim-sample${selectedSampleId === s.id ? ' active' : ''}`}
              data-testid={`api-mock-sim-sample-${s.id}`}
            >
              <button
                type="button"
                className="am-sim-sample-btn"
                onClick={() => onSelectSample(s)}
              >
                <div className="am-row">
                  <span className="am-sim-sample-name">{s.name}</span>
                  <span className="am-spacer" />
                  {badge && (
                    <span
                      className={`am-badge ${badge === 'PASS' ? 'success' : badge === 'CONFLICT' ? 'warning' : 'danger'}`}
                      data-testid={badge === 'FAIL' ? 'api-mock-sim-sample-fail' : undefined}
                    >{badge}</span>
                  )}
                </div>
                <div className="am-hint am-mono">
                  {isAdHoc
                    ? 'Editable draft — try any method/path'
                    : `${s.request.method} ${capturedRequestPath(s.request)}`}
                </div>
                {r?.preview?.stateAfter != null && r.preview.responseMode === 'state' && (
                  <span className="am-chip" data-testid="api-mock-sim-sample-state">
                    {r.preview.stateBefore || '(empty)'} → {r.preview.stateAfter || '(empty)'}
                  </span>
                )}
              </button>
              {!isAdHoc && (
                <button
                  type="button"
                  className="am-sim-sample-remove"
                  aria-label={`Remove sample ${s.name}`}
                  data-testid={`api-mock-sim-sample-remove-${s.id}`}
                  onClick={e => { e.stopPropagation(); onRemoveSample(s.id); }}
                >×</button>
              )}
            </div>
          </div>
        );
      })}
      <div className="am-panel-foot">
        <span className="am-faint">{passedCount} passed · {conflictCount} conflict{conflictCount === 1 ? '' : 's'}</span>
      </div>
    </aside>
  );
}
