import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import { CustomSelect } from '../../../shared/components/CustomSelect';
import { normalizeRequest } from '../../../shared/api-mock/requestNormalization';
import { simulateSingle, simulateBatch } from '../../../shared/api-mock/simulation';
import { capturedRequestPath } from '../apiMockJournalActions';
import { PlayIcon, DownloadIcon } from './ApiMockIcons';
import type {
  ApiMockServerDefinitionV1,
  ApiMockSimulationResultV1,
  ApiMockSimulationSampleV1,
} from '../../../shared/api-mock/contracts';
import {
  SIMULATE_METHOD_OPTIONS,
  SIMULATE_SEED_HELP,
  annotateSimulatePass,
  reannotateSimulatePass,
  buildAutoRouteSamples,
  capturedHeadersFromText,
  createSavedSimulationSample,
  lowercaseHeaderMap,
  downloadSimulationTrace,
  headersToText,
  isAutoRouteSample,
  mergeSimulateSamples,
  outcomeBadge,
  parseSimulateHeaderLines,
  simulationTraceFilename,
  simulationTraceNoticePreview,
  suggestedSimulateSampleName,
} from './apiMockSimulateModalHelpers';
import { ApiMockExpandableText } from './ApiMockExpandableText';
import { ApiMockSimulateAssertionsTable } from './ApiMockSimulateAssertionsTable';
import { ApiMockSimulateRenderedPane } from './ApiMockSimulateRenderedPane';

interface Props {
  server: ApiMockServerDefinitionV1;
  initialPath?: string;
  initialMethod?: string;
  initialSampleId?: string;
  onSaveSample?: (sample: ApiMockSimulationSampleV1) => void;
  onUpdateSample?: (sample: ApiMockSimulationSampleV1) => void;
  onClose: () => void;
}

type ResultTab = 'trace' | 'request' | 'rendered' | 'assertions';
type MainPane = 'request' | 'results';

export function ApiMockSimulateModal({ server, initialPath = '/', initialMethod = 'GET', initialSampleId, onSaveSample, onUpdateSample, onClose }: Props) {
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
  const [mainPane, setMainPane] = useState<MainPane>('request');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [localSaved, setLocalSaved] = useState<ApiMockSimulationSampleV1[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [focusSavedName, setFocusSavedName] = useState(false);
  const [exportNotice, setExportNotice] = useState<{ filename: string; preview: string } | null>(null);
  const adHocDraftRef = useRef({
    method: initialMethod,
    path: initialPath,
    headers: '',
    body: '',
    clientCertSubject: '',
  });

  const persistedSamples: ApiMockSimulationSampleV1[] = useMemo(
    () => mergeSimulateSamples(server.samples, localSaved),
    [server.samples, localSaved],
  );

  const autoFromRoutes: ApiMockSimulationSampleV1[] = useMemo(
    () => (persistedSamples.length > 0 ? [] : buildAutoRouteSamples(server.routes)),
    [persistedSamples.length, server.routes],
  );

  const allNonAdHoc: ApiMockSimulationSampleV1[] = useMemo(
    () => [...persistedSamples, ...autoFromRoutes],
    [persistedSamples, autoFromRoutes],
  );

  useEffect(() => {
    if (!focusSavedName) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
    setFocusSavedName(false);
  }, [focusSavedName]);

  useEffect(() => {
    if (selectedSampleId !== adHocId) return;
    adHocDraftRef.current = { method, path, headers, body, clientCertSubject };
  }, [selectedSampleId, method, path, headers, body, clientCertSubject]);

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
        headers: capturedHeadersFromText(headers),
        body: body || null,
        bodyTruncated: false,
        receivedAt: new Date().toISOString(),
      },
    },
    ...allNonAdHoc.filter(s => !dismissedIds.has(s.id)),
  ], [allNonAdHoc, dismissedIds, method, path, headers, body]);

  const removeSample = useCallback((id: string) => {
    setDismissedIds(prev => new Set(prev).add(id));
    setResultBySample(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (selectedSampleId === id) {
      const draft = adHocDraftRef.current;
      setMethod(draft.method);
      setPath(draft.path);
      setHeaders(draft.headers);
      setBody(draft.body);
      setClientCertSubject(draft.clientCertSubject);
      setSelectedSampleId(adHocId);
    }
  }, [selectedSampleId]);

  const filteredSamples = samples.filter(s => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q)
      || capturedRequestPath(s.request).toLowerCase().includes(q);
  });
  const firstPersistedIdx = filteredSamples.findIndex(s => s.id !== adHocId && !isAutoRouteSample(s.id));
  const firstAutoIdx = filteredSamples.findIndex(s => isAutoRouteSample(s.id));

  const buildSample = (sample: ApiMockSimulationSampleV1): ApiMockSimulationSampleV1 => {
    const captured = sample.id === adHocId
      ? normalizeRequest({
        method,
        url: path || '/',
        headers: parseSimulateHeaderLines(headers),
        body: body || null,
        clientCertSubject: clientCertSubject.trim() || undefined,
      }).captured
      : { ...sample.request, headers: lowercaseHeaderMap(sample.request.headers) };
    return { id: sample.id, name: sample.name, request: captured, expected: sample.expected };
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
    const res = annotateSimulatePass(built, simulateSingle(built, simInput));
    setResultBySample(prev => ({ ...prev, [sample.id]: res }));
    setTab('trace');
    setMainPane('results');
  };

  const runAll = () => {
    // Sequential batch so state / sequence / match counts advance across samples (virtual).
    const built = samples.map(buildSample);
    const results = simulateBatch(built, { ...simInput, sequentialBatch: true });
    const next: Record<string, ApiMockSimulationResultV1> = {};
    for (let i = 0; i < built.length; i++) next[built[i].id] = annotateSimulatePass(built[i], results[i]);
    setResultBySample(next);
    setTab('trace');
    setMainPane('results');
  };

  const exportTrace = () => {
    const results = Object.values(resultBySample);
    downloadSimulationTrace(server.id, seed, results);
    setExportNotice({
      filename: simulationTraceFilename(seed),
      preview: simulationTraceNoticePreview(server.id, seed, results.length),
    });
  };

  const patchSelectedExpected = (patch: Partial<NonNullable<ApiMockSimulationSampleV1['expected']>>) => {
    const current = persistedSamples.find(s => s.id === selectedSampleId)
      ?? localSaved.find(s => s.id === selectedSampleId);
    if (!current || current.id === adHocId) return;
    const next = {
      ...current,
      expected: {
        outcome: current.expected?.outcome ?? 'matched',
        ...current.expected,
        ...patch,
      },
    };
    setLocalSaved(prev => {
      const i = prev.findIndex(s => s.id === next.id);
      if (i < 0) return [...prev, next];
      const copy = [...prev];
      copy[i] = next;
      return copy;
    });
    onUpdateSample?.(next);
    setResultBySample(prev => {
      const current = prev[next.id];
      if (!current) return prev;
      return { ...prev, [next.id]: reannotateSimulatePass(next, current) };
    });
  };

  const selectSample = (sample: ApiMockSimulationSampleV1) => {
    setSelectedSampleId(sample.id);
    setMainPane('request');
    if (sample.id === adHocId) {
      const draft = adHocDraftRef.current;
      setMethod(draft.method);
      setPath(draft.path);
      setHeaders(draft.headers);
      setBody(draft.body);
      setClientCertSubject(draft.clientCertSubject);
      return;
    }
    setMethod(sample.request.method);
    setPath(capturedRequestPath(sample.request));
    setHeaders(headersToText(sample.request.headers));
    setBody(typeof sample.request.body === 'string' ? sample.request.body : '');
    setClientCertSubject(sample.request.clientCertSubject ?? '');
  };

  const editInAdhoc = () => {
    setSelectedSampleId(adHocId);
    setMainPane('request');
  };

  const suggestedSampleName = suggestedSimulateSampleName(method, path || '/');

  const saveAsSample = () => {
    const adhoc = samples.find(s => s.id === adHocId) ?? samples[0];
    const built = buildSample(adhoc);
    const sample = createSavedSimulationSample(
      suggestedSampleName,
      built.request,
      resultBySample[adHocId],
    );
    setLocalSaved(prev => [...prev, sample]);
    onSaveSample?.(sample);
    if (resultBySample[adHocId]) setResultBySample(prev => ({ ...prev, [sample.id]: resultBySample[adHocId] }));
    setSelectedSampleId(sample.id);
    setMainPane('request');
    setFocusSavedName(true);
  };

  const renameSavedSample = (name: string) => {
    setLocalSaved(prev => prev.map(s => (s.id === selectedSampleId ? { ...s, name } : s)));
    const current = persistedSamples.find(s => s.id === selectedSampleId)
      ?? localSaved.find(s => s.id === selectedSampleId);
    if (current) onUpdateSample?.({ ...current, name });
  };

  const result = resultBySample[selectedSampleId] ?? null;
  const trace = result?.trace;
  const hasAnyResult = Object.keys(resultBySample).length > 0;
  const selectedHasResult = Boolean(result && trace);
  const showResultsPane = mainPane === 'results' && selectedHasResult;
  const showRequestForm = !showResultsPane;
  const selectedIsAdHoc = selectedSampleId === adHocId;
  const requestReadOnly = !selectedIsAdHoc;
  const selectedIsFromRules = isAutoRouteSample(selectedSampleId);
  const selectedSample = samples.find(s => s.id === selectedSampleId);
  const winnerId = trace?.policyDecision.selectedRouteId;
  const passedCount = Object.values(resultBySample).filter(r => r.passed === true).length;
  const conflictCount = Object.values(resultBySample).filter(r => r.outcome === 'ambiguous' && r.passed !== true).length;

  const routeLabel = (id?: string) => {
    const r = id ? server.routes.find(x => x.id === id) : undefined;
    return r ? `${r.method} ${r.path.value}` : (id ?? '—');
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
      showExpandButton={false}
      headerActions={
        <div className="api-mock-root am-in-modal am-modal-toolbar">
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
              const badge = !r ? null
                : r.passed === true ? 'PASS'
                  : r.outcome === 'ambiguous' ? 'CONFLICT'
                    : r.passed === false ? 'FAIL'
                      : 'PASS';
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
                      onClick={() => selectSample(s)}
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
                        onClick={e => { e.stopPropagation(); removeSample(s.id); }}
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

          <section
            className={`am-sim-main${showResultsPane ? ' am-sim-main--results' : ' am-sim-main--request'}`}
            data-testid="api-mock-sim-main"
          >
            {hasAnyResult && (
              <div className="am-sim-view-toggle am-segmented" role="tablist" aria-label="Simulation view">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!showResultsPane}
                  className={!showResultsPane ? 'active' : ''}
                  data-testid="api-mock-sim-view-request"
                  onClick={() => setMainPane('request')}
                >
                  Request
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={showResultsPane}
                  className={showResultsPane ? 'active' : ''}
                  disabled={!selectedHasResult}
                  data-testid="api-mock-sim-view-results"
                  onClick={() => setMainPane('results')}
                >
                  Results
                </button>
              </div>
            )}
            {showRequestForm && requestReadOnly && (
              <p className="am-sim-run-hint" data-testid="api-mock-sim-readonly-hint">
                {selectedIsFromRules
                  ? <>
                      Suggested from the <strong>{selectedSample?.name ?? 'rule'}</strong> mock —
                      this was never saved. Run simulation to see the trace, or{' '}
                      <strong>Edit in Ad-hoc</strong> to change the request.
                    </>
                  : <>
                      This saved sample is read-only here. Run simulation to see the trace, or{' '}
                      <strong>Edit in Ad-hoc</strong> to change the request.
                    </>}
              </p>
            )}
            {showRequestForm && (
              <div className={`am-form-grid am-sim-adhoc-form${requestReadOnly ? ' am-sim-adhoc-form--readonly' : ''}`}>
                <div className="am-form-row">
                  <div className="am-form-label">Method</div>
                  <div className="am-form-control">
                    <CustomSelect
                      value={method}
                      onChange={setMethod}
                      options={SIMULATE_METHOD_OPTIONS}
                      className="am-cs"
                      aria-label="Simulate method"
                      data-testid="api-mock-simulate-method"
                      disabled={requestReadOnly}
                    />
                  </div>
                </div>
                <div className="am-form-row">
                  <div className="am-form-label">Path</div>
                  <div className="am-form-control">
                    <input
                      className="am-input wide mono"
                      value={path}
                      onChange={e => setPath(e.target.value)}
                      placeholder="/users/42?active=true"
                      data-testid="api-mock-simulate-path"
                      readOnly={requestReadOnly}
                    />
                  </div>
                </div>
                <div className="am-form-row am-form-row--tall">
                  <div className="am-form-label">Headers</div>
                  <div className="am-form-control">
                    <textarea
                      className="am-textarea am-textarea--compact"
                      value={headers}
                      onChange={e => setHeaders(e.target.value)}
                      placeholder={'X-Tenant: acme\nAuthorization: Bearer …'}
                      data-testid="api-mock-simulate-headers"
                      readOnly={requestReadOnly}
                    />
                  </div>
                </div>
                <div className="am-form-row am-form-row--tall">
                  <div className="am-form-label">Body</div>
                  <div className="am-form-control">
                    <ApiMockExpandableText
                      label="Request body"
                      value={body}
                      onChange={setBody}
                      placeholder='{"name":"Alice"}'
                      testId="api-mock-simulate-body"
                      multiline
                      className="am-textarea--compact"
                      readOnly={requestReadOnly}
                    />
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
                      readOnly={requestReadOnly}
                    />
                  </div>
                </div>
                {selectedIsAdHoc ? (
                  <div className="am-form-row">
                    <div className="am-form-label">Keep this request</div>
                    <div className="am-form-control am-form-control-stack">
                      <button
                        type="button"
                        className="am-btn primary"
                        onClick={saveAsSample}
                        data-testid="api-mock-simulate-save-sample"
                      >
                        Save as sample
                      </button>
                      <span className="am-hint">Stores method, path, headers, and body under Saved samples. Name it after saving.</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {!selectedIsFromRules && (
                      <div className="am-form-row">
                        <div className="am-form-label">Sample name</div>
                        <div className="am-form-control">
                          <input
                            ref={nameInputRef}
                            className="am-input wide"
                            value={selectedSample?.name ?? ''}
                            onChange={e => renameSavedSample(e.target.value)}
                            placeholder="Health check — happy path"
                            aria-label="Sample name"
                            data-testid="api-mock-simulate-sample-name"
                          />
                        </div>
                      </div>
                    )}
                    <div className="am-form-row">
                      <div className="am-form-label">Change this request</div>
                      <div className="am-form-control am-form-control-stack">
                        <button
                          type="button"
                          className="am-btn primary"
                          onClick={editInAdhoc}
                          data-testid="api-mock-sim-edit-adhoc"
                        >
                          Edit in Ad-hoc
                        </button>
                        <span className="am-hint">Copies this probe into the scratch pad so you can change method, path, or headers.</span>
                      </div>
                    </div>
                  </>
                )}
                <div className="am-form-row am-form-row--tall">
                  <div className="am-form-label">Replay seed</div>
                  <div className="am-form-control am-form-control-stack">
                    <label className="am-seed-field">
                      <input
                        className="am-input mono"
                        value={seed}
                        onChange={e => setSeed(e.target.value || '0')}
                        aria-label="Replay seed"
                        title={SIMULATE_SEED_HELP}
                        data-testid="api-mock-simulate-seed"
                      />
                    </label>
                    <span className="am-hint">{SIMULATE_SEED_HELP}</span>
                  </div>
                </div>
              </div>
            )}

            {!showRequestForm && (
              <div className="am-sr-only">
                <CustomSelect value={method} onChange={setMethod} options={SIMULATE_METHOD_OPTIONS} className="am-cs" aria-label="Simulate method" data-testid="api-mock-simulate-method" />
                <input value={path} onChange={e => setPath(e.target.value)} data-testid="api-mock-simulate-path" />
                <textarea value={headers} onChange={e => setHeaders(e.target.value)} data-testid="api-mock-simulate-headers" />
                <textarea value={body} onChange={e => setBody(e.target.value)} data-testid="api-mock-simulate-body" />
                <input value={clientCertSubject} onChange={e => setClientCertSubject(e.target.value)} data-testid="api-mock-simulate-cert-subject" />
                <input value={seed} onChange={e => setSeed(e.target.value || '0')} aria-label="Replay seed" data-testid="api-mock-simulate-seed" />
              </div>
            )}

            {showRequestForm && (
              <p className="am-sim-run-hint">Run simulation to open Results — Decision trace, normalized request, and assertions.</p>
            )}

            {showResultsPane && (
            <>
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
                  data-testid={`api-mock-sim-tab-${id}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

              <div className="am-sim-result" data-testid="api-mock-simulate-result">
                {tab === 'trace' && (
                  <div className="am-sim-trace-split">
                    <div className="am-detail-pane">
                      <div className="am-row" style={{ marginBottom: 10 }}>
                        <span className={`am-method ${(trace.normalizedRequest?.method || method || 'get').toLowerCase()}`}>
                          {trace.normalizedRequest?.method || method}
                        </span>
                        <strong className="am-route-title">{trace.normalizedRequest?.path || path}</strong>
                        <span className="am-spacer" />
                        <span
                          className={`am-badge ${outcomeBadge(result.outcome)}`}
                          data-testid="api-mock-sim-outcome"
                        >{result.outcome.toUpperCase()}</span>
                        {result.preview?.fault && result.preview.fault !== 'none' && (
                          <span className="am-badge warning" data-testid="api-mock-sim-fault-badge">FAULT: {result.preview.fault}</span>
                        )}
                      </div>

                      <div className="am-section-heading">Candidates evaluated ({trace.candidates.length})</div>
                      {trace.candidates.map(c => {
                        const route = server.routes.find(r => r.id === c.routeId);
                        return (
                          <div
                            key={c.routeId}
                            className={`am-candidate${c.routeId === winnerId ? ' winner' : ''}`}
                            data-testid={`api-mock-sim-candidate-${c.routeId}`}
                          >
                            <div className="am-candidate-head">
                              <span className={`am-matcher-result ${c.overallMatch ? 'pass' : 'fail'}`}>{c.overallMatch ? '✓' : '×'}</span>
                              {route ? (
                                <>
                                  <span className={`am-method ${route.method.toLowerCase()}`}>{route.method}</span>
                                  <strong className="am-route-title">{route.path.value}</strong>
                                </>
                              ) : (
                                <strong className="am-route-title">{routeLabel(c.routeId)}</strong>
                              )}
                              <span className="am-badge">Priority {c.priority}</span>
                              <span className="am-spacer" />
                              {c.routeId === winnerId
                                ? <span className="am-badge success" data-testid="api-mock-sim-winner">Winner</span>
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

                      {trace.policyDecision.specificityBreakdown && trace.policyDecision.specificityBreakdown.length > 0 && (
                        <div data-testid="api-mock-sim-specificity">
                          <div className="am-section-heading">Specificity</div>
                          {trace.policyDecision.specificityBreakdown.map(row => (
                            <div
                              key={row.routeId}
                              className="am-predicate"
                              data-testid={`api-mock-sim-specificity-${row.routeId}`}
                            >
                              <strong className="am-route-title">{routeLabel(row.routeId)}</strong>
                              <span className="am-badge info">{row.score}</span>
                              <span className="am-mono">
                                {row.components.map(c => `${c.source} +${c.weight}`).join(' · ')}
                              </span>
                            </div>
                          ))}
                        </div>
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
                          { n: 3, title: 'Apply selection policy', hint: [
                            `${trace.policyDecision.policy}; equal-priority ${trace.policyDecision.equalPriorityPolicy}.`,
                            trace.policyDecision.specificityBreakdown?.length
                              ? trace.policyDecision.specificityBreakdown
                                .map(row => `${routeLabel(row.routeId)} ${row.score}`)
                                .join(' · ')
                              : null,
                          ].filter(Boolean).join(' '), badge: winnerId ? 'Winner' : result.outcome },
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
                          <span className="am-badge info" title={String(step.badge)}>{String(step.badge)}</span>
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
                  <div className="am-editor-body am-sim-fill-pane">
                    <pre className="am-code-block am-sim-fill-code" data-testid="api-mock-sim-normalized">{JSON.stringify(trace.normalizedRequest ?? { method, path }, null, 2)}</pre>
                  </div>
                )}

                {tab === 'rendered' && (
                  <ApiMockSimulateRenderedPane result={result} />
                )}

                {tab === 'assertions' && (
                  <div className="am-editor-body">
                    <ApiMockSimulateAssertionsTable
                      expected={samples.find(s => s.id === selectedSampleId)?.expected}
                      result={result}
                      winnerId={winnerId}
                      canEdit={!selectedIsAdHoc && !selectedIsFromRules}
                      onPatchExpected={patchSelectedExpected}
                    />
                  </div>
                )}
                {exportNotice && (
                  <div className="am-notice" data-testid="api-mock-sim-export-confirm">
                    <div className="am-mono" data-testid="api-mock-sim-export-filename">{exportNotice.filename}</div>
                    <pre className="am-code-block" data-testid="api-mock-sim-export-preview">{exportNotice.preview}</pre>
                  </div>
                )}
              </div>
            </>
            )}
          </section>
        </div>
      </div>
    </AppModalFrame>
  );
}
