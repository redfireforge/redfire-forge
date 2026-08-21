import { useState } from 'react';
import { capturedRequestPath } from '../apiMockJournalActions';
import type { ApiMockSimulationSampleV1, ApiMockTransactionOutcome } from '../../../shared/api-mock/contracts';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { FlaskIcon, TrashIcon } from './ApiMockIcons';

function prettyJsonBody(raw: string): { ok: true; text: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Body is empty.' };
  try {
    return { ok: true, text: JSON.stringify(JSON.parse(trimmed), null, 2) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Not valid JSON.' };
  }
}

const OUTCOMES: Array<{ value: ApiMockTransactionOutcome; label: string }> = [
  { value: 'matched', label: 'Matched' },
  { value: 'unmatched', label: 'Unmatched' },
  { value: 'ambiguous', label: 'Ambiguous' },
  { value: 'proxied', label: 'Proxied' },
  { value: 'fault', label: 'Fault' },
  { value: 'error', label: 'Error' },
];

interface Props {
  samples: ApiMockSimulationSampleV1[];
  attachRouteId?: string;
  onSimulate?: (sample: ApiMockSimulationSampleV1) => void;
  onUpdateSample?: (sample: ApiMockSimulationSampleV1) => void;
  onDeleteSample?: (sampleId: string) => void;
  onTryInRequests?: (sample: ApiMockSimulationSampleV1) => void;
}

export function ApiMockExamplesPanel({
  samples,
  attachRouteId,
  onSimulate,
  onUpdateSample,
  onDeleteSample,
  onTryInRequests,
}: Props) {
  const [prettyErrors, setPrettyErrors] = useState<Record<string, string>>({});

  if (samples.length === 0) {
    return (
      <div className="am-notice" data-testid="api-mock-examples-empty">
        <span>
          Run <strong>Simulate</strong> and click <strong>Save as sample</strong> to keep the
          request — name it after saving. Captured transactions can also be promoted from
          the journal (<strong>Save as example</strong>).
        </span>
      </div>
    );
  }

  return (
    <div className="am-examples-list" data-testid="api-mock-examples-grid">
      {samples.map(sample => (
        <article key={sample.id} className="am-example-card" data-testid={`api-mock-example-${sample.id}`}>
          <div className="am-example-card-head">
            <input
              className="am-input"
              value={sample.name}
              aria-label="Example name"
              data-testid={`api-mock-example-name-${sample.id}`}
              onChange={e => onUpdateSample?.({ ...sample, name: e.target.value })}
            />
            <span className="am-mono am-example-path">{sample.request.method} {capturedRequestPath(sample.request)}</span>
            {!sample.routeId && <span className="am-example-unassociated">Unassociated</span>}
          </div>
          <div className="am-form-grid am-example-expected">
            <div className="am-form-row">
              <div className="am-form-label">Expected outcome</div>
              <div className="am-form-control">
                <CustomSelect
                  value={sample.expected?.outcome ?? 'matched'}
                  onChange={v => onUpdateSample?.({
                    ...sample,
                    expected: { ...sample.expected, outcome: v as ApiMockTransactionOutcome },
                  })}
                  options={OUTCOMES}
                  className="am-cs"
                  aria-label="Expected outcome"
                  data-testid={`api-mock-example-outcome-${sample.id}`}
                />
              </div>
            </div>
            <div className="am-form-row">
              <div className="am-form-label">Expected status</div>
              <div className="am-form-control">
                <input
                  className="am-input"
                  type="number"
                  min={0}
                  max={599}
                  placeholder="200"
                  value={sample.expected?.status ?? ''}
                  aria-label="Expected status"
                  data-testid={`api-mock-example-status-${sample.id}`}
                  onChange={e => {
                    const n = Number(e.target.value);
                    const status = e.target.value === '' || !Number.isInteger(n) || n < 0 || n > 599
                      ? undefined
                      : n;
                    onUpdateSample?.({
                      ...sample,
                      expected: {
                        outcome: sample.expected?.outcome ?? 'matched',
                        ...sample.expected,
                        status,
                      },
                    });
                  }}
                />
              </div>
            </div>
            <div className="am-form-row">
              <div className="am-form-label">Body contains</div>
              <div className="am-form-control">
                <input
                  className="am-input wide"
                  placeholder="optional substring"
                  value={sample.expected?.bodyContains ?? ''}
                  aria-label="Expected body contains"
                  data-testid={`api-mock-example-body-${sample.id}`}
                  onChange={e => onUpdateSample?.({
                    ...sample,
                    expected: {
                      outcome: sample.expected?.outcome ?? 'matched',
                      ...sample.expected,
                      bodyContains: e.target.value || undefined,
                    },
                  })}
                />
              </div>
            </div>
            <div className="am-form-row am-form-row--tall am-example-body-exact-row">
              <div className="am-form-label">Body exact</div>
              <div className="am-form-control am-form-control-stack">
                <div className="am-callback-body-toolbar">
                  <button
                    type="button"
                    className="am-format-badge"
                    disabled={!(sample.expected?.bodyExact ?? '').trim()}
                    title="Pretty-print JSON"
                    aria-label="Pretty format"
                    data-testid={`api-mock-example-body-pretty-${sample.id}`}
                    onClick={() => {
                      const result = prettyJsonBody(sample.expected?.bodyExact ?? '');
                      if (!result.ok) {
                        setPrettyErrors(prev => ({ ...prev, [sample.id]: result.error }));
                        return;
                      }
                      setPrettyErrors(prev => {
                        if (!(sample.id in prev)) return prev;
                        const next = { ...prev };
                        delete next[sample.id];
                        return next;
                      });
                      onUpdateSample?.({
                        ...sample,
                        expected: {
                          outcome: sample.expected?.outcome ?? 'matched',
                          ...sample.expected,
                          bodyExact: result.text,
                        },
                      });
                    }}
                  >
                    Pretty format
                  </button>
                </div>
                <textarea
                  className="am-textarea mono am-example-body-exact-editor"
                  placeholder="optional exact body"
                  value={sample.expected?.bodyExact ?? ''}
                  spellCheck={false}
                  aria-label="Expected body exact"
                  data-testid={`api-mock-example-body-exact-${sample.id}`}
                  onChange={e => {
                    setPrettyErrors(prev => {
                      if (!(sample.id in prev)) return prev;
                      const next = { ...prev };
                      delete next[sample.id];
                      return next;
                    });
                    onUpdateSample?.({
                      ...sample,
                      expected: {
                        outcome: sample.expected?.outcome ?? 'matched',
                        ...sample.expected,
                        bodyExact: e.target.value || undefined,
                      },
                    });
                  }}
                />
                {prettyErrors[sample.id] && (
                  <div className="am-hint am-hint--error" data-testid={`api-mock-example-body-pretty-error-${sample.id}`}>
                    {prettyErrors[sample.id]}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="am-example-actions">
            {onSimulate && (
              <button type="button" className="am-btn small" data-testid={`api-mock-example-simulate-${sample.id}`} onClick={() => onSimulate(sample)}>
                <FlaskIcon size={12} /> Simulate
              </button>
            )}
            {onTryInRequests && (
              <button type="button" className="am-btn small" data-testid={`api-mock-example-try-${sample.id}`} onClick={() => onTryInRequests(sample)}>
                Try in Requests
              </button>
            )}
            {!sample.routeId && attachRouteId && onUpdateSample && (
              <button
                type="button"
                className="am-btn small"
                data-testid={`api-mock-example-attach-${sample.id}`}
                onClick={() => onUpdateSample({
                  ...sample,
                  routeId: attachRouteId,
                  expected: {
                    outcome: sample.expected?.outcome ?? 'matched',
                    ...sample.expected,
                    routeId: attachRouteId,
                  },
                })}
              >
                Attach to this rule
              </button>
            )}
            {onDeleteSample && (
              <button type="button" className="am-btn small" data-testid={`api-mock-example-delete-${sample.id}`} onClick={() => onDeleteSample(sample.id)}>
                <TrashIcon size={12} /> Delete
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
