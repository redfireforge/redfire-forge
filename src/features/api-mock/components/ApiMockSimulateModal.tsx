import { useCallback, useMemo, useState } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { normalizeRequest } from '../../../shared/api-mock/requestNormalization';
import { simulateSingle, simulateBatch } from '../../../shared/api-mock/simulation';
import { capturedRequestPath } from '../apiMockJournalActions';
import { concreteMockPath } from '../apiMockPageHelpers';
import { PlayIcon, DownloadIcon } from './ApiMockIcons';
import type {
  ApiMockServerDefinitionV1,
  ApiMockSimulationResultV1,
  ApiMockSimulationSampleV1,
  ApiMockCapturedRequestV1,
} from '../../../shared/api-mock/contracts';

interface Props {
  server: ApiMockServerDefinitionV1;
  initialPath?: string;
  initialMethod?: string;
  initialSampleId?: string;
  onClose: () => void;
}

type ResultTab = 'trace' | 'request' | 'rendered' | 'assertions';

const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => ({ value: m, label: m }));

function headersToText(headers: Record<string, string | string[]>): string {
  return Object.entries(headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
}

function outcomeBadge(outcome: string): string {
  if (outcome === 'matched') return 'success';
  if (outcome === 'ambiguous') return 'warning';
  if (outcome === 'fault') return 'warning';
  return 'danger';
}

/**
 * Mockup 04 Rule Simulation — samples sidebar + decision trace / request / response / assertions.
 */
export function ApiMockSimulateModal({ server, initialPath = '/', initialMethod = 'GET', initialSampleId, onClose }: Props) {
  const adHocId = 'adhoc';
  const seededSample = initialSampleId
    ? (server.samples ?? []).find(s => s.id === initialSampleId)
    : undefined;
  const seededMethod = seededSample?.request.method && seededSample.request.method !== 'ANY'
    ? seededSample.request.method
    : initialMethod;
  const [method, setMethod] = useState(seededMethod);
  const [path, setPath] = useState(initialPath);
  const [headers, setHeaders] = useState(seededSample ? headersToText(seededSample.request.headers) : '');
  const [body, setBody] = useState(typeof seededSample?.request.body === 'string' ? seededSample.request.body : '');
  const [clientCertSubject, setClientCertSubject] = useState(seededSample?.request.clientCertSubject ?? '');
  const [seed, setSeed] = useState(() => String(Math.floor(Math.random() * 90000) + 10000));
  const [filter, setFilter] = useState('');
  const [selectedSampleId, setSelectedSampleId] = useState(initialSampleId ?? adHocId);
  const [resultBySample, setResultBySample] = useState<Record<string, ApiMockSimulationResultV1>>({});
  const [tab, setTab] = useState<ResultTab>('trace');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  const allNonAdHoc: ApiMockSimulationSampleV1[] = useMemo(() => {
    const saved = server.samples ?? [];
    if (saved.length > 0) return saved;
    return server.routes.slice(0, 5).map((r) => ({
      id: `auto-${r.id}`,
      name: r.name || `${r.method} ${r.path.value}`,
      routeId: r.id,
      request: {
        method: r.method === 'ANY' ? 'GET' : r.method,
        path: concreteMockPath(r.path.value),
        rawPath: concreteMockPath(r.path.value),
        query: {},
        cookies: {},
        headers: {},
        body: null,
        bodyTruncated: false,
        receivedAt: new Date().toISOString(),
      } satisfies ApiMockCapturedRequestV1,
      expected: { outcome: 'matched' as const, routeId: r.id },
    }));
  }, [server.samples, server.routes]);

  const samples: ApiMockSimulationSampleV1[] = useMemo(() => [
    {
      id: adHocId,
      name: 'Ad-hoc request',
      request: {
        method,
        path: path || '/',
        rawPath: path || '/',
        query: {},
        cookies: {},
        headers: {},
        body: body || null,
        bodyTruncated: false,
        receivedAt: new Date().toISOString(),
      },
    },
    ...allNonAdHoc.filter(s => !dismissedIds.has(s.id)),
  ], [allNonAdHoc, dismissedIds, method, path, body]);

  const removeSample = useCallback((id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
    setResultBySample(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (selectedSampleId === id) setSelectedSampleId(adHocId);
  }, [selectedSampleId]);

  const filteredSamples = samples.filter(s => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q)
      || capturedRequestPath(s.request).toLowerCase().includes(q);
  });

  const buildSample = (sample: ApiMockSimulationSampleV1): ApiMockSimulationSampleV1 => {
    let captured = sample.request;
    if (sample.id === adHocId) {
      const headerMap: Record<string, string> = {};
      for (const line of headers.split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) headerMap[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      }
      captured = normalizeRequest({
        method,
        url: path || '/',
        headers: headerMap,
        body: body || null,
        clientCertSubject: clientCertSubject.trim() || undefined,
      }).captured;
    }
    return { id: sample.id, name: sample.name, request: captured, expected: sample.expected };
  };

  const annotatePass = (sample: ApiMockSimulationSampleV1, res: ApiMockSimulationResultV1): ApiMockSimulationResultV1 => {
    // Trust the engine when it already evaluated expectations (includes bodyContains / bodyExact).
    if (typeof res.passed === 'boolean') return res;
    if (sample.expected) {
      const body = res.renderedResponse?.body ?? '';
      const expectedOk =
        (!sample.expected.outcome || sample.expected.outcome === res.outcome)
        && (!sample.expected.routeId || sample.expected.routeId === res.trace.policyDecision.selectedRouteId)
        && (!sample.expected.responseId || sample.expected.responseId === res.preview?.selectedResponseId)
        && (sample.expected.status == null || sample.expected.status === res.renderedResponse?.status)
        && (sample.expected.bodyContains == null || body.includes(sample.expected.bodyContains))
        && (sample.expected.bodyExact == null || body === sample.expected.bodyExact);
      return { ...res, passed: expectedOk };
    }
    return {
      ...res,
      passed: res.outcome === 'matched' || res.outcome === 'unmatched' || res.outcome === 'fault'
        ? true
        : res.outcome !== 'ambiguous',
    };
  };

  const simInput = {
    routes: server.routes,
    settings: server.settings,
    basePath: server.basePath,
    variables: server.variables,
    seed,
  };

  const run = () => {
    const sample = samples.find(s => s.id === selectedSampleId) ?? samples[0];
    const built = buildSample(sample);
    const res = annotatePass(built, simulateSingle(built, simInput));
    setResultBySample(prev => ({ ...prev, [sample.id]: res }));
    setTab('trace');
  };

  const runAll = () => {
    // Sequential batch so state / sequence / match counts advance across samples (virtual).
    const built = samples.map(buildSample);
    const results = simulateBatch(built, { ...simInput, sequentialBatch: true });
    const next: Record<string, ApiMockSimulationResultV1> = {};
    for (let i = 0; i < built.length; i++) next[built[i].id] = annotatePass(built[i], results[i]);
    setResultBySample(next);
    setTab('trace');
  };

  const exportTrace = () => {
    const payload = {
      serverId: server.id,
      seed,
      generation: 'draft',
      results: Object.values(resultBySample),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-mock-sim-trace-${seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectSample = (sample: ApiMockSimulationSampleV1) => {
    setSelectedSampleId(sample.id);
    if (sample.id !== adHocId) {
      setMethod(sample.request.method);
      setPath(capturedRequestPath(sample.request));
      setHeaders(headersToText(sample.request.headers));
      setBody(typeof sample.request.body === 'string' ? sample.request.body : '');
      setClientCertSubject(sample.request.clientCertSubject ?? '');
    }
  };

  const result = resultBySample[selectedSampleId] ?? null;
  const trace = result?.trace;
  const winnerId = trace?.policyDecision.selectedRouteId;
  const passedCount = Object.values(resultBySample).filter(r => r.passed === true).length;
  const conflictCount = Object.values(resultBySample).filter(r => r.outcome === 'ambiguous' && r.passed !== true).length;

  const routeLabel = (id?: string) => {
    if (!id) return '—';
    const r = server.routes.find(x => x.id === id);
    return r ? `${r.method} ${r.path.value}` : id;
  };

  return (
    <AppModalFrame
      title={
        <div className="am-modal-title-block">
          <div className="am-modal-title">Rule Simulation</div>
          <div className="am-modal-subtitle">
            Evaluate samples against {server.name} without opening a listener or mutating state
          </div>
        </div>
      }
      onClose={onClose}
      dialogClassName="modal am-studio-modal"
      bodyClassName="am-studio-modal-body"
      footerClassName="am-studio-modal-footer"
      headerActions={
        <div className="api-mock-root am-in-modal am-modal-toolbar">
          <label className="am-seed-field">
            seed
            <input
              className="am-input mono"
              value={seed}
              onChange={e => setSeed(e.target.value || '0')}
              aria-label="Simulation seed"
              data-testid="api-mock-simulate-seed"
            />
          </label>
          <button
            className="am-btn"
            onClick={exportTrace}
            disabled={Object.keys(resultBySample).length === 0}
            data-testid="api-mock-simulate-export"
          ><DownloadIcon size={13} /> Export trace</button>
          <button className="am-btn" onClick={runAll} data-testid="api-mock-simulate-run-all">Run {samples.length} samples</button>
          <button className="am-btn primary" onClick={run} data-testid="api-mock-simulate-run"><PlayIcon size={13} /> Run simulation</button>
        </div>
      }
      footer={
        <div className="api-mock-root am-in-modal am-modal-toolbar" style={{ width: '100%' }}>
          <span className="am-badge success">Side-effect-free</span>
          <span className="am-badge">Draft generation</span>
          {Object.keys(resultBySample).length > 0 && (
            <span className="am-faint" data-testid="api-mock-simulate-summary">
              {passedCount} passed · {conflictCount} conflict{conflictCount === 1 ? '' : 's'}
            </span>
          )}
          <span className="am-spacer" />
          <button className="am-btn" onClick={onClose} data-testid="api-mock-simulate-close">Close</button>
        </div>
      }
    >
      <div className="api-mock-root am-in-modal am-simulate-workspace" data-testid="api-mock-simulate-workspace">
        <div className="am-sim-layout">
          <aside className="am-sim-samples">
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
            {filteredSamples.map(s => {
              const r = resultBySample[s.id];
              const badge = !r ? null
                : r.passed === true ? 'PASS'
                  : r.outcome === 'ambiguous' ? 'CONFLICT'
                    : r.passed === false ? 'FAIL'
                      : 'PASS';
              return (
                <div
                  key={s.id}
                  className={`am-sim-sample${selectedSampleId === s.id ? ' active' : ''}`}
                  data-testid={`api-mock-sim-sample-${s.id}`}
                >
                  <button
                    type="button"
                    className="am-sim-sample-btn"
                    onClick={() => selectSample(s)}
                  >
                    <div className="am-row">
                      <span className="am-sim-sample-name">{s.name}</span>
                      <span className="am-spacer" />
                      {badge && <span className={`am-badge ${badge === 'PASS' ? 'success' : badge === 'CONFLICT' ? 'warning' : 'danger'}`}>{badge}</span>}
                    </div>
                    <div className="am-hint am-mono">{s.request.method} {capturedRequestPath(s.request)}</div>
                  </button>
                  {s.id !== adHocId && (
                    <button
                      type="button"
                      className="am-sim-sample-remove"
                      aria-label={`Remove sample ${s.name}`}
                      data-testid={`api-mock-sim-sample-remove-${s.id}`}
                      onClick={e => { e.stopPropagation(); removeSample(s.id); }}
                    >×</button>
                  )}
                </div>
              );
            })}
            <div className="am-panel-foot">
              <span className="am-faint">{passedCount} passed · {conflictCount} conflict{conflictCount === 1 ? '' : 's'}</span>
            </div>
          </aside>

          <section className="am-sim-main">
            {selectedSampleId === adHocId && (
              <div className="am-form-grid am-sim-adhoc-form">
                <div className="am-form-row">
                  <div className="am-form-label">Method</div>
                  <div className="am-form-control">
                    <CustomSelect value={method} onChange={setMethod} options={METHOD_OPTIONS} className="am-cs" aria-label="Simulate method" data-testid="api-mock-simulate-method" />
                  </div>
                </div>
                <div className="am-form-row">
                  <div className="am-form-label">Path</div>
                  <div className="am-form-control">
                    <input className="am-input wide mono" value={path} onChange={e => setPath(e.target.value)} placeholder="/users/42?active=true" data-testid="api-mock-simulate-path" />
                  </div>
                </div>
                <div className="am-form-row am-form-row--tall">
                  <div className="am-form-label">Headers</div>
                  <div className="am-form-control">
                    <textarea className="am-textarea am-textarea--compact" value={headers} onChange={e => setHeaders(e.target.value)} placeholder={'X-Tenant: acme\nAuthorization: Bearer …'} data-testid="api-mock-simulate-headers" />
                  </div>
                </div>
                <div className="am-form-row am-form-row--tall">
                  <div className="am-form-label">Body</div>
                  <div className="am-form-control">
                    <textarea className="am-textarea am-textarea--compact" value={body} onChange={e => setBody(e.target.value)} placeholder='{"name":"Alice"}' data-testid="api-mock-simulate-body" />
                  </div>
                </div>
                <div className="am-form-row">
                  <div className="am-form-label">Client cert subject</div>
                  <div className="am-form-control">
                    <input
                      className="am-input wide mono"
                      value={clientCertSubject}
                      onChange={e => setClientCertSubject(e.target.value)}
                      placeholder="CN=client-name"
                      aria-label="Simulate client certificate subject"
                      data-testid="api-mock-simulate-cert-subject"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Keep controls mounted for non-adhoc so tests can still fill path when needed */}
            {selectedSampleId !== adHocId && (
              <div className="am-sr-only">
                <CustomSelect value={method} onChange={setMethod} options={METHOD_OPTIONS} className="am-cs" aria-label="Simulate method" data-testid="api-mock-simulate-method" />
                <input value={path} onChange={e => setPath(e.target.value)} data-testid="api-mock-simulate-path" />
                <textarea value={headers} onChange={e => setHeaders(e.target.value)} data-testid="api-mock-simulate-headers" />
                <textarea value={body} onChange={e => setBody(e.target.value)} data-testid="api-mock-simulate-body" />
                <input value={clientCertSubject} onChange={e => setClientCertSubject(e.target.value)} data-testid="api-mock-simulate-cert-subject" />
              </div>
            )}

            <div className="am-builder-tabs" role="tablist" aria-label="Simulation result sections">
              {([
                ['trace', 'Decision trace'],
                ['request', 'Normalized request'],
                ['rendered', 'Rendered response'],
                ['assertions', 'Assertions'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={`am-builder-tab${tab === id ? ' active' : ''}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {!result || !trace ? (
              <div className="am-sim-empty-hint">
                <p>Configure the sample and click <strong>Run simulation</strong>.</p>
                <p>Evaluation is side-effect-free — no listener or journal writes. Virtual state, sequence, delay, and faults mirror the live runtime in the preview.</p>
              </div>
            ) : (
              <div data-testid="api-mock-simulate-result" style={{ minHeight: 0, overflow: 'auto', flex: 1 }}>
                {tab === 'trace' && (
                  <div className="am-sim-trace-split">
                    <div className="am-detail-pane">
                      <div className="am-row" style={{ marginBottom: 10 }}>
                        <span className={`am-method ${(trace.normalizedRequest?.method || method || 'get').toLowerCase()}`}>
                          {trace.normalizedRequest?.method || method}
                        </span>
                        <strong className="am-mono">{trace.normalizedRequest?.path || path}</strong>
                        <span className="am-spacer" />
                        <span className={`am-badge ${outcomeBadge(result.outcome)}`}>{result.outcome.toUpperCase()}</span>
                        {result.preview?.fault && result.preview.fault !== 'none' && (
                          <span className="am-badge warning" data-testid="api-mock-sim-fault-badge">FAULT: {result.preview.fault}</span>
                        )}
                      </div>

                      <div className="am-section-heading">Candidates evaluated ({trace.candidates.length})</div>
                      {trace.candidates.map(c => {
                        const route = server.routes.find(r => r.id === c.routeId);
                        return (
                          <div key={c.routeId} className={`am-candidate${c.routeId === winnerId ? ' winner' : ''}`}>
                            <div className="am-candidate-head">
                              <span className={`am-matcher-result ${c.overallMatch ? 'pass' : 'fail'}`}>{c.overallMatch ? '✓' : '×'}</span>
                              <strong>{routeLabel(c.routeId)}</strong>
                              <span className="am-badge">Priority {c.priority}</span>
                              <span className="am-spacer" />
                              {c.routeId === winnerId
                                ? <span className="am-badge success">Winner</span>
                                : !c.pathMatch ? <span className="am-badge danger">Path failed</span>
                                  : !c.methodMatch ? <span className="am-badge danger">Method failed</span>
                                    : !c.overallMatch ? <span className="am-badge warning">Conditions failed</span>
                                      : null}
                            </div>
                            <div className="am-predicate">
                              <span className={`am-matcher-result ${c.methodMatch ? 'pass' : 'fail'}`}>{c.methodMatch ? '✓' : '×'}</span>
                              <span>Method</span>
                              <span className="am-mono">{c.methodMatch ? 'match' : 'miss'}</span>
                              <span className="am-muted">—</span>
                            </div>
                            <div className="am-predicate">
                              <span className={`am-matcher-result ${c.pathMatch ? 'pass' : 'fail'}`}>{c.pathMatch ? '✓' : '×'}</span>
                              <span>Path</span>
                              <span className="am-mono">{route?.path.value ?? '—'}</span>
                              <span className="am-muted">—</span>
                            </div>
                            {c.predicateResults.map(pr => (
                              <div key={pr.predicateId} className="am-predicate">
                                <span className={`am-matcher-result ${pr.passed ? 'pass' : 'fail'}`}>{pr.passed ? '✓' : '×'}</span>
                                <span>{pr.source}</span>
                                <span className="am-mono">{pr.reason || pr.operator}</span>
                                <span className="am-muted">—</span>
                              </div>
                            ))}
                          </div>
                        );
                      })}

                      {trace.nearMisses.length > 0 && (
                        <>
                          <div className="am-section-heading">Near misses</div>
                          <div className="am-notice warning">
                            <span>{trace.nearMisses.map(nm => nm.routeName).join(', ')} matched method/path but failed conditions.</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="am-detail-pane">
                      <div className="am-section-heading">Selection timeline</div>
                      {(() => {
                        const p = result.preview;
                        const variantHint = !winnerId
                          ? 'No winning rule.'
                          : [
                            p?.responseMode ? `${p.responseMode} mode` : null,
                            p?.selectedResponseName || p?.selectedResponseId || 'variant',
                            p?.sequenceIndex != null ? `index ${p.sequenceIndex}` : null,
                            p?.eligibilityFallback ? `fallback (${p.eligibilityReason ?? 'ineligible'})` : null,
                          ].filter(Boolean).join(' · ');
                        const stateHint = p?.transitionApplied
                          ? `Virtual transition "${p.stateBefore || '(empty)'}" → "${p.stateAfter || '(empty)'}" (not applied to live server).`
                          : p?.responseMode === 'state'
                            ? `State guard on "${p.stateBefore || '(empty)'}" — no transition on this variant.`
                            : 'Delay/fault previewed; live scenario state unchanged.';
                        const faultHint = !p || p.fault === 'none'
                          ? 'Normal HTTP delivery preview.'
                          : p.faultTimeline.map(s => `t+${s.atMs}ms ${s.label}`).join(' · ');
                        return [
                          { n: 1, title: 'Normalize request', hint: 'Decoded path, lower-cased header names, preserved repeated query values.', badge: 'ok' },
                          { n: 2, title: `Evaluate ${server.routes.filter(r => r.enabled).length} enabled rules`, hint: `${trace.policyDecision.matchedCount} matched · ${trace.nearMisses.length} near miss · prefilter rejected the rest.`, badge: 'ok' },
                          { n: 3, title: 'Apply selection policy', hint: `${trace.policyDecision.policy}; equal-priority ${trace.policyDecision.equalPriorityPolicy}.`, badge: winnerId ? 'Winner' : result.outcome },
                          { n: 4, title: 'Select response', hint: variantHint, badge: p?.selectedResponseId ?? result.renderedResponse?.status ?? '—' },
                          { n: 5, title: 'Virtual delay', hint: p ? `base ${p.baseDelayMs} ms · jitter ${p.jitterAppliedMs >= 0 ? '+' : ''}${p.jitterAppliedMs} ms` : '—', badge: p ? `${p.virtualDelayMs} ms` : '0 ms' },
                          { n: 6, title: p?.fault && p.fault !== 'none' ? `Fault: ${p.fault}` : 'Delivery', hint: faultHint, badge: p?.fault && p.fault !== 'none' ? 'fault' : 'http' },
                          { n: 7, title: 'State / counters', hint: stateHint, badge: p?.transitionApplied ? 'virtual' : 'unchanged' },
                        ];
                      })().map(step => (
                        <div key={step.n} className="am-trace-step" data-testid={`api-mock-sim-timeline-${step.n}`}>
                          <span className="am-trace-num">{step.n}</span>
                          <div>
                            <strong>{step.title}</strong>
                            <div className="am-hint">{step.hint}</div>
                          </div>
                          <span className="am-badge info">{String(step.badge)}</span>
                        </div>
                      ))}
                      <div className="am-notice" style={{ marginTop: 10 }}>
                        <span>No live listener, journal, socket, timer, or server state mutation. Preview mirrors runtime selection, delay, faults, and virtual transitions.</span>
                      </div>
                      {winnerId && (
                        <div className={`am-notice ${result.outcome === 'matched' ? '' : result.outcome === 'ambiguous' ? 'warning' : result.outcome === 'fault' ? 'warning' : 'danger'}`} style={{ marginTop: 8 }}>
                          <span>
                            <strong>{result.outcome.toUpperCase()}</strong>
                            {' → '}
                            <span className="am-mono">{server.routes.find(r => r.id === winnerId)?.name ?? winnerId}</span>
                            {result.preview?.selectedResponseName && (
                              <> · <span className="am-mono">{result.preview.selectedResponseName}</span></>
                            )}
                            {' · '}{trace.policyDecision.matchedCount} candidate match{trace.policyDecision.matchedCount === 1 ? '' : 'es'}
                          </span>
                        </div>
                      )}
                      {!winnerId && (
                        <div className={`am-notice ${result.outcome === 'matched' ? '' : result.outcome === 'ambiguous' ? 'warning' : 'danger'}`} style={{ marginTop: 8 }}>
                          <span>
                            <strong>{result.outcome.toUpperCase()}</strong>
                            {' · '}{trace.policyDecision.matchedCount} candidate match{trace.policyDecision.matchedCount === 1 ? '' : 'es'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === 'request' && (
                  <div className="am-editor-body">
                    <pre className="am-code-block">{JSON.stringify(trace.normalizedRequest ?? { method, path }, null, 2)}</pre>
                  </div>
                )}

                {tab === 'rendered' && (
                  <div className="am-editor-body" data-testid="api-mock-sim-rendered">
                    {result.renderedResponse ? (
                      <>
                        <div className="am-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                          <span className={`am-badge ${result.preview?.httpCompleted === false ? 'danger' : result.renderedResponse.status < 400 ? 'success' : 'warning'}`}>
                            {result.preview?.httpCompleted === false ? '—' : result.renderedResponse.status}
                          </span>
                          <span className="am-badge">{result.renderedResponse.contentType ?? result.renderedResponse.headers?.['content-type']?.[0] ?? '—'}</span>
                          {result.preview && (
                            <span className="am-badge info" data-testid="api-mock-sim-virtual-delay">
                              Virtual delay {result.preview.virtualDelayMs} ms
                            </span>
                          )}
                          {result.preview?.fault && result.preview.fault !== 'none' && (
                            <span className="am-badge warning">FAULT: {result.preview.fault}</span>
                          )}
                        </div>
                        {result.preview?.httpCompleted === false ? (
                          <div className="am-notice warning" style={{ marginTop: 10 }}>
                            <span>No HTTP body would reach the client — connection-level fault ({result.preview.fault}).</span>
                          </div>
                        ) : (
                          <pre className="am-code-block" style={{ marginTop: 10 }} data-testid="api-mock-sim-rendered-body">
                            {result.renderedResponse.body ?? ''}
                          </pre>
                        )}
                        {result.preview?.faultTimeline && result.preview.faultTimeline.length > 0 && result.preview.fault !== 'none' && (
                          <div style={{ marginTop: 12 }}>
                            <div className="am-section-heading">Fault timeline (virtual)</div>
                            {result.preview.faultTimeline.map((step, i) => (
                              <div key={`${step.atMs}-${i}`} className="am-hint am-mono">t+{step.atMs}ms — {step.label}</div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="am-muted">No response rendered for this outcome.</div>
                    )}
                  </div>
                )}

                {tab === 'assertions' && (
                  <div className="am-editor-body">
                    <table className="am-data-table" aria-label="Simulation assertions">
                      <thead>
                        <tr><th>Expectation</th><th>Expected</th><th>Actual</th><th>Result</th></tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const expected = samples.find(s => s.id === selectedSampleId)?.expected;
                          const body = result.renderedResponse?.body ?? '';
                          const actualStatus = result.preview?.httpCompleted === false
                            ? undefined
                            : result.renderedResponse?.status;
                          const row = (ok: boolean | undefined, label: string) => (
                            ok == null
                              ? <span className="am-badge">{label}</span>
                              : <span className={`am-badge ${ok ? 'success' : 'danger'}`}>{ok ? 'Pass' : 'Fail'}</span>
                          );
                          return (
                            <>
                              <tr>
                                <td>Outcome</td>
                                <td>{expected?.outcome ?? '—'}</td>
                                <td>{result.outcome}</td>
                                <td>{row(expected?.outcome ? expected.outcome === result.outcome : undefined, '—')}</td>
                              </tr>
                              <tr>
                                <td>Rule</td>
                                <td>{expected?.routeId ?? '—'}</td>
                                <td>{winnerId ?? '—'}</td>
                                <td>{row(expected?.routeId ? expected.routeId === winnerId : undefined, '—')}</td>
                              </tr>
                              <tr>
                                <td>Response</td>
                                <td>{expected?.responseId ?? '—'}</td>
                                <td>{result.preview?.selectedResponseId ?? '—'}</td>
                                <td>{row(expected?.responseId ? expected.responseId === result.preview?.selectedResponseId : undefined, '—')}</td>
                              </tr>
                              <tr>
                                <td>Status</td>
                                <td>{expected?.status ?? '—'}</td>
                                <td>{actualStatus ?? '—'}</td>
                                <td>{row(expected?.status == null ? undefined : expected.status === actualStatus, '—')}</td>
                              </tr>
                              <tr>
                                <td>Body contains</td>
                                <td>{expected?.bodyContains ?? '—'}</td>
                                <td>{expected?.bodyContains ? (body.includes(expected.bodyContains) ? 'yes' : 'no') : '—'}</td>
                                <td>{row(expected?.bodyContains == null ? undefined : body.includes(expected.bodyContains), '—')}</td>
                              </tr>
                              <tr>
                                <td>Body exact</td>
                                <td>{expected?.bodyExact ?? '—'}</td>
                                <td>{expected?.bodyExact == null ? '—' : (body === expected.bodyExact ? 'yes' : 'no')}</td>
                                <td>{row(expected?.bodyExact == null ? undefined : body === expected.bodyExact, '—')}</td>
                              </tr>
                              <tr>
                                <td>Fault</td>
                                <td>—</td>
                                <td>{result.preview?.fault ?? 'none'}</td>
                                <td>{row(undefined, '—')}</td>
                              </tr>
                              <tr>
                                <td>Virtual delay</td>
                                <td>—</td>
                                <td>{result.preview?.virtualDelayMs ?? 0} ms</td>
                                <td>{row(undefined, '—')}</td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppModalFrame>
  );
}
