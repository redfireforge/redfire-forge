import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApiMockDiagnosticV1, ApiMockRouteFolderV1, ApiMockRouteV1, ApiMockSimulationSampleV1 } from '@shared/api-mock/contracts';
import { convertSourceToRule, type SourceRequest, type ConversionOptions } from '@shared/api-mock/sourceToRule';
import {
  batchToRoutes,
  catalogEndpointsToSources,
  parseNativeExport,
  parseOpenApiOperations,
  parseWireMockMappings,
  requestItemsToSources,
  type ParsedImportBatch,
} from '@shared/api-mock/importParsers';
import { previewHarEntries, fixHarSampleExpected, type HarPreviewResult } from '@shared/api-mock/harImport';
import { loadCatalogEntries, loadRequests } from '@shared/utils/storage';
import type { CatalogEndpoint } from '../../catalog/types/catalog';
import type { RequestItem } from '@shared/types/requests';
import { HarEntryPreviewList } from './HarEntryPreviewList';
export type ApiMockImportSourceId = 'curl' | 'catalog' | 'requests' | 'openapi' | 'wiremock' | 'native' | 'har';

interface ImportOptions {
  mode: ImportMode;
  newFolderName?: string;
}
interface Props {
  folders?: ApiMockRouteFolderV1[];
  initialSource?: ApiMockImportSourceId;
  lastNativeExport?: string;
  onImport: (routes: ApiMockRouteV1[], options: ImportOptions, samples?: ApiMockSimulationSampleV1[]) => void;
  onCancel: () => void;
}

type ImportMode = 'merge' | 'replace' | 'copy';
type ImportSource = ApiMockImportSourceId
const SOURCES: Array<{ id: ImportSource; label: string; hint: string }> = [
  { id: 'curl', label: 'cURL command', hint: 'Generate rule and sample' },
  { id: 'openapi', label: 'OpenAPI / Swagger', hint: 'Paste JSON or YAML' },
  { id: 'catalog', label: 'Catalog endpoints', hint: 'Select one or many operations' },
  { id: 'requests', label: 'Requests collection', hint: 'Promote items or folders' },
  { id: 'native', label: 'RedfireForge export', hint: 'Native round-trip' },
  { id: 'wiremock', label: 'WireMock mappings', hint: 'Import stub definitions' },
  { id: 'har', label: 'HAR capture', hint: 'Browser/devtools archive (redacted)' },
];

interface PreviewState {
  routes: ApiMockRouteV1[];
  diagnostics: ApiMockDiagnosticV1[];
  lossReport: string[];
}
interface CatalogPick {
  key: string;
  label: string;
  method: string;
  path: string;
}

interface RequestPick {
  key: string;
  label: string;
  method: string;
  url: string;
  headers: Array<{ key: string; value: string }>;
  body: string;
}
export function ApiMockImportReview({ folders = [], initialSource = 'curl', lastNativeExport, onImport, onCancel }: Props) {
  const [source, setSource] = useState<ImportSource>(initialSource);
  const [curlInput, setCurlInput] = useState('');
  const [pasteInput, setPasteInput] = useState('');
  const [pasteFormatError, setPasteFormatError] = useState('');
  const [mode, setMode] = useState<ImportMode>('merge');
  const [folderSelection, setFolderSelection] = useState(() => folders.length > 0 ? folders[0].id : '__new__');
  const [newFolderName, setNewFolderName] = useState('');
  const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
  const folderRef = useRef<HTMLDivElement>(null);
  const [priority, setPriority] = useState('10');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  // B-2: HAR two-stage flow — previewHarEntries result and per-entry selection
  const [harPreview, setHarPreview] = useState<HarPreviewResult | null>(null);
  const [selectedPositions, setSelectedPositions] = useState<Set<number>>(new Set());
  const [createSamples, setCreateSamples] = useState(true);
  const [catalogPicks, setCatalogPicks] = useState<CatalogPick[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<Set<string>>(new Set());
  const [requestPicks, setRequestPicks] = useState<RequestPick[]>([]);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [loadMessage, setLoadMessage] = useState('');
  const [catalogFilter, setCatalogFilter] = useState('');
  const [requestFilter, setRequestFilter] = useState('');
  const isCreatingFolder = folderSelection === '__new__';
  const folderId = useMemo(() => {
    if (folderSelection === '__new__') return undefined;
    return folderSelection;
  }, [folderSelection]);
  const defaultPriority = parseInt(priority, 10) || 10;
  const folderDisplayLabel = useMemo(() => {
    if (folderSelection === '__new__') return '+ Create new folder';
    return folders.find(f => f.id === folderSelection)?.name ?? '+ Create new folder';
  }, [folderSelection, folders]);

  const filteredCatalogPicks = useMemo(
    () => catalogPicks.filter(p => !catalogFilter || p.label.toLowerCase().includes(catalogFilter) || p.method.toLowerCase().includes(catalogFilter)),
    [catalogPicks, catalogFilter],
  );

  const filteredRequestPicks = useMemo(
    () => requestPicks.filter(p => !requestFilter || p.label.toLowerCase().includes(requestFilter) || p.method.toLowerCase().includes(requestFilter)),
    [requestPicks, requestFilter],
  );

  useEffect(() => { setPreview(null); }, [selectedCatalog, selectedRequests]);

  const prettyFormatPaste = useCallback(() => {
    const raw = pasteInput.trim();
    if (!raw) {
      setPasteFormatError('Paste is empty.');
      return;
    }
    try {
      setPasteInput(JSON.stringify(JSON.parse(raw), null, 2));
      setPasteFormatError('');
    } catch (err) {
      setPasteFormatError(err instanceof Error ? err.message : 'Not valid JSON.');
    }
  }, [pasteInput]);

  useEffect(() => {
    if (!folderDropdownOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!folderRef.current?.contains(e.target as Node)) setFolderDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [folderDropdownOpen]);

  useEffect(() => {
    setPreview(null);
    setHarPreview(null);
    setSelectedPositions(new Set());
    setLoadMessage('');
    setCatalogFilter('');
    setRequestFilter('');
    setPasteFormatError('');
    setCreateSamples(true);
    if (source === 'catalog') {
      void loadCatalogEntries().then(entries => {
        const picks: CatalogPick[] = [];
        const pushEp = (entryId: string, entryName: string, ep: CatalogEndpoint, prefix?: string) => {
          picks.push({
            key: `${entryId}:${ep.id}`,
            label: `${prefix ?? entryName} · ${ep.method} ${ep.path}`,
            method: ep.method,
            path: ep.path,
          });
        };
        for (const entry of entries) {
          for (const ep of entry.endpoints ?? []) pushEp(entry.id, entry.name, ep);
          const walkFolders = (
            nodes: Array<{ name: string; endpoints?: CatalogEndpoint[]; folders?: unknown[] }> | undefined,
            prefix: string,
          ) => {
            for (const node of nodes ?? []) {
              const nextPrefix = `${prefix}/${node.name}`;
              for (const ep of node.endpoints ?? []) pushEp(entry.id, entry.name, ep, nextPrefix);
              walkFolders(node.folders as typeof nodes, nextPrefix);
            }
          };
          walkFolders(entry.folders, entry.name);
        }
        const byKey = new Map(picks.map(p => [p.key, p]));
        setCatalogPicks([...byKey.values()]);
        setSelectedCatalog(new Set());
        setLoadMessage(byKey.size === 0 ? 'No catalog endpoints found.' : `${byKey.size} endpoint(s) available.`);
      }).catch(() => setLoadMessage('Failed to load catalog.'));
    }
    if (source === 'requests') {
      void loadRequests().then(data => {
        const picks: RequestPick[] = [];
        const walkFolder = (reqs: RequestItem[], folders: Array<{ name: string; requests: RequestItem[]; folders?: unknown[] }> | undefined, prefix: string) => {
          for (const r of reqs) {
            picks.push({
              key: r.id,
              label: `${prefix}${r.name}`,
              method: r.method,
              url: r.url,
              headers: (r.headers ?? []).filter(h => h.key).map(h => ({ key: h.key, value: h.value })),
              body: r.body ?? '',
            });
          }
          for (const f of folders ?? []) {
            walkFolder(f.requests ?? [], f.folders as typeof folders, `${prefix}${f.name}/`);
          }
        };
        for (const col of data.collections ?? []) {
          walkFolder(col.requests ?? [], col.folders, `${col.name}/`);
        }
        setRequestPicks(picks);
        setSelectedRequests(new Set());
        setLoadMessage(picks.length === 0 ? 'No requests found.' : `${picks.length} request(s) available.`);
      }).catch(() => setLoadMessage('Failed to load requests.'));
    }
  }, [source]);

  const applyFolderPriority = useCallback((routes: ApiMockRouteV1[]): ApiMockRouteV1[] => (
    routes.map(r => ({
      ...r,
      priority: defaultPriority,
      enabled: false,
      ...(folderId ? { folderId } : {}),
    }))
  ), [defaultPriority, folderId]);

  useEffect(() => {
    setPreview(prev => (prev ? { ...prev, routes: applyFolderPriority(prev.routes) } : prev));
  }, [applyFolderPriority]);

  const handleParseCurl = () => {
    if (!curlInput.trim()) return;
    const parsed = parseCurlToSource(curlInput);
    const opts: ConversionOptions = { sourceKind: 'curl', sourceLabel: 'cURL import' };
    const result = convertSourceToRule(parsed, opts);
    setPreview({
      routes: applyFolderPriority([result.route]),
      diagnostics: result.diagnostics,
      lossReport: [],
    });
  };

  const handleParsePaste = () => {
    if (!pasteInput.trim()) return;

    // B-2: HAR uses the new two-stage flow — run previewHarEntries and show per-entry list.
    if (source === 'har') {
      const result = previewHarEntries(pasteInput);
      setHarPreview(result);
      // Pre-select all accepted entries.
      setSelectedPositions(new Set(result.accepted.map((_, pos) => pos)));
      setPreview(null);
      return;
    }

    const batch = source === 'openapi'
      ? parseOpenApiOperations(pasteInput)
      : source === 'wiremock'
        ? parseWireMockMappings(pasteInput)
        : parseNativeExport(pasteInput);
    const kind = source === 'openapi' ? 'openapi' as const
      : source === 'wiremock' ? 'wiremock' as const
        : 'redfireforge' as const;
    const converted = batchToRoutes(batch, { defaultPriority, folderId, sourceKind: kind });
    const routes = applyFolderPriority(converted.routes).map(r => (
      source === 'wiremock' ? { ...r, enabled: false } : r
    ));
    setPreview({ routes, diagnostics: converted.diagnostics, lossReport: converted.lossReport });
  };

  const handleParseCatalog = () => {
    const selected = catalogPicks.filter(p => selectedCatalog.has(p.key));
    if (selected.length === 0) return;
    const sources = catalogEndpointsToSources(selected);
    const converted = batchToRoutes(
      { sources, diagnostics: [], lossReport: [], label: 'Catalog' },
      { defaultPriority, folderId, sourceKind: 'catalog' },
    );
    setPreview({
      routes: applyFolderPriority(converted.routes),
      diagnostics: converted.diagnostics,
      lossReport: converted.lossReport,
    });
  };

  const handleParseRequests = () => {
    const selected = requestPicks.filter(p => selectedRequests.has(p.key));
    if (selected.length === 0) return;
    const sources = requestItemsToSources(selected.map(p => ({
      method: p.method,
      url: p.url,
      headers: p.headers,
      body: p.body || undefined,
    })));
    const converted = batchToRoutes(
      { sources, diagnostics: [], lossReport: [], label: 'Requests' },
      { defaultPriority, folderId, sourceKind: 'requests' },
    );
    setPreview({
      routes: applyFolderPriority(converted.routes),
      diagnostics: converted.diagnostics,
      lossReport: converted.lossReport,
    });
  };

  const handleConfirm = () => {
    const opts: ImportOptions = { mode };
    if (isCreatingFolder && newFolderName.trim()) {
      opts.newFolderName = newFolderName.trim();
    }

    // B-2: HAR confirm path — convert only user-selected entries.
    if (source === 'har' && harPreview) {
      const chosenSources = harPreview.accepted
        .filter((_, pos) => selectedPositions.has(pos))
        .map(a => a.source);
      if (chosenSources.length === 0) return;
      const filteredBatch: ParsedImportBatch = {
        sources: chosenSources,
        diagnostics: [],
        lossReport: harPreview.truncated ? ['HAR was truncated to the entry cap.'] : [],
        label: 'HAR',
      };
      const converted = batchToRoutes(filteredBatch, { defaultPriority, folderId, sourceKind: 'har' });
      const routes = applyFolderPriority(converted.routes);
      const harSamples = createSamples && converted.samples.length > 0
        ? converted.samples.map((s, i) => fixHarSampleExpected(s, chosenSources[i]))
        : undefined;
      onImport(routes, opts, harSamples);
      return;
    }

    // Non-HAR path (curl, openapi, wiremock, native, catalog, requests)
    if (!preview || preview.routes.length === 0) return;
    onImport(preview.routes, opts);
  };

  const generalizePath = () => {
    if (!preview || preview.routes.length === 0) return;
    const [first, ...rest] = preview.routes;
    const next = first.path.value.replace(/\/\d+/g, '/:id');
    setPreview({
      ...preview,
      routes: [{ ...first, path: { ...first.path, kind: 'parameterized', value: next } }, ...rest],
    });
  };

  const handleHarSelectAll = useCallback(() => {
    if (!harPreview) return;
    setSelectedPositions(new Set(harPreview.accepted.map((_, pos) => pos)));
  }, [harPreview]);

  const handleHarDeselectAll = useCallback(() => setSelectedPositions(new Set()), []);

  const handleHarToggle = useCallback((pos: number) => {
    setSelectedPositions(prev => {
      const next = new Set(prev);
      if (next.has(pos)) next.delete(pos); else next.add(pos);
      return next;
    });
  }, []);

  const primaryRoute = preview?.routes[0] ?? null;
  const harIsParsed = source === 'har' && harPreview !== null;
  const harHasEntries = harIsParsed && !harPreview!.error && harPreview!.accepted.length > 0;

  const destinationFields = (
    <div className="am-form-grid" style={{ marginTop: 10 }}>
      <div className="am-form-row">
        <div className="am-form-label">Folder</div>
        <div className="am-form-control">
          <div className="am-folder-select" ref={folderRef}>
            <button
              type="button"
              className="am-folder-trigger"
              onClick={() => setFolderDropdownOpen(o => !o)}
              data-testid="api-mock-import-folder"
            >
              <span className="am-folder-value">{folderDisplayLabel}</span>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {folderDropdownOpen && (
              <div className="am-folder-menu" data-testid="api-mock-import-folder-menu">
                {folders.map(f => (
                  <button
                    type="button"
                    key={f.id}
                    className={`am-folder-option${folderSelection === f.id ? ' active' : ''}`}
                    onClick={() => { setFolderSelection(f.id); setFolderDropdownOpen(false); }}
                  >
                    {f.name}
                  </button>
                ))}
                {folders.length > 0 && <div className="am-folder-divider" />}
                <button
                  type="button"
                  className={`am-folder-option${folderSelection === '__new__' ? ' active' : ''}`}
                  onClick={() => { setFolderSelection('__new__'); setFolderDropdownOpen(false); }}
                  data-testid="api-mock-import-folder-new"
                >
                  + Create new folder
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {isCreatingFolder && (
        <div className="am-form-row">
          <div className="am-form-label">Name</div>
          <div className="am-form-control">
            <input
              className="am-input"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="New folder name…"
              autoFocus
              data-testid="api-mock-import-new-folder-name"
            />
          </div>
        </div>
      )}
      <div className="am-form-row">
        <div className="am-form-label">Priority</div>
        <div className="am-form-control">
          <input className="am-input num mono" type="number" value={priority} onChange={e => setPriority(e.target.value)} data-testid="api-mock-import-priority" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="api-mock-root api-mock-import-review" data-testid="api-mock-import-review">
      <div className="am-editor-header">
        <span className="am-muted" style={{ fontSize: 11 }}>Mode</span>
        <div className="am-segmented">
          {([
            ['merge', 'Merge'],
            ['replace', 'Replace'],
            ['copy', 'Import as copy'],
          ] as const).map(([m, label]) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)} data-testid={`api-mock-import-mode-${m}`}>{label}</button>
          ))}
        </div>
      </div>
      {mode === 'replace' && (
        <div className="am-notice danger" style={{ margin: '8px 12px 0' }} data-testid="api-mock-import-replace-warning">
          <span>Replace deletes every existing rule on this server and puts the import in their place. Merge and Import as copy do not.</span>
        </div>
      )}

      <div className="am-import-layout">
        <aside className="am-import-sources" data-testid="api-mock-import-sources">
          <div className="am-section-heading">Source</div>
          {SOURCES.map(s => (
            <button
              key={s.id}
              type="button"
              className={`am-source-btn${source === s.id ? ' active' : ''}`}
              onClick={() => setSource(s.id)}
              data-testid={`api-mock-import-source-${s.id}`}
            >
              <strong>{s.label}</strong>
              <small>{s.hint}</small>
            </button>
          ))}
        </aside>

        <div className="am-import-review-pane">
          {source === 'curl' && (
            <>
              <div className="am-section-heading">cURL input</div>
              <textarea
                className="am-textarea"
                rows={5}
                value={curlInput}
                onChange={e => setCurlInput(e.target.value)}
                placeholder="curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{...}'"
                data-testid="api-mock-curl-input"
              />
              {destinationFields}
              <button className="am-btn primary" style={{ marginTop: 8 }} onClick={handleParseCurl} data-testid="api-mock-curl-parse">
                Parse &amp; review
              </button>
            </>
          )}

          {(source === 'openapi' || source === 'wiremock' || source === 'native' || source === 'har') && (
            <div className={`am-import-paste-panel${(preview || harIsParsed) ? ' am-import-paste-panel--reviewed' : ''}`}>
              <div className="am-section-heading">
                {source === 'openapi' ? 'OpenAPI / Swagger'
                  : source === 'wiremock' ? 'WireMock mappings'
                    : source === 'har' ? 'HAR capture'
                      : 'RedfireForge export'}
                <button
                  type="button"
                  className="am-format-badge"
                  disabled={!pasteInput.trim()}
                  title="Pretty-print JSON"
                  aria-label="Pretty format"
                  data-testid="api-mock-import-pretty"
                  onClick={prettyFormatPaste}
                >
                  Pretty format
                </button>
                {pasteFormatError && <span className="am-hint" data-testid="api-mock-import-pretty-error">{pasteFormatError}</span>}
              </div>
              <textarea
                className="am-textarea mono am-textarea--expand"
                rows={16}
                value={pasteInput}
                onChange={e => { setPasteInput(e.target.value); setPasteFormatError(''); }}
                placeholder={source === 'openapi' ? 'Paste OpenAPI 3.x / Swagger JSON or YAML…' : source === 'har' ? 'Paste HAR JSON…' : 'Paste JSON…'}
                data-testid="api-mock-import-paste"
              />
              {source === 'native' && lastNativeExport && (
                <button
                  type="button"
                  className="am-btn small"
                  data-testid="api-mock-import-last-export"
                  onClick={() => { setPasteInput(lastNativeExport); setPasteFormatError(''); }}
                >
                  Use last export
                </button>
              )}
              <label className="am-btn small" style={{ display: 'inline-flex', alignSelf: 'flex-start' }}>
                Choose file
                <input
                  type="file"
                  accept={source === 'openapi' ? '.json,.yaml,.yml,application/json,text/*' : source === 'har' ? '.har,application/json,.json' : 'application/json,.json'}
                  style={{ display: 'none' }}
                  data-testid="api-mock-import-file"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void file.text().then(text => { setPasteInput(text); setPasteFormatError(''); });
                  }}
                />
              </label>
              {destinationFields}
              <button className="am-btn primary" onClick={handleParsePaste} data-testid="api-mock-import-parse">
                Parse &amp; review
              </button>
            </div>
          )}

          {source === 'catalog' && (
            <>
              <div className="am-section-heading">
                Catalog endpoints
                <span className="am-spacer" />
                {catalogPicks.length > 0 && (
                  <span className="am-pick-actions">
                    <button type="button" className="am-btn small ghost" onClick={() => setSelectedCatalog(new Set(filteredCatalogPicks.map(p => p.key)))} data-testid="api-mock-import-catalog-select-all">Select all</button>
                    <button type="button" className="am-btn small ghost" onClick={() => setSelectedCatalog(new Set())}>None</button>
                  </span>
                )}
              </div>
              {loadMessage && <div className="am-muted" style={{ fontSize: 11, marginBottom: 8 }} data-testid="api-mock-import-load-msg">{loadMessage}</div>}
              {catalogPicks.length > 0 && (
                <input className="am-search" placeholder="Filter endpoints…" style={{ marginBottom: 6 }} data-testid="api-mock-import-catalog-filter"
                  onChange={e => {
                    const q = e.target.value.toLowerCase();
                    setCatalogFilter(q);
                  }}
                  value={catalogFilter}
                />
              )}
              <div className="am-pick-list" data-testid="api-mock-import-catalog-list">
                {filteredCatalogPicks.map(p => (
                  <label key={p.key} className={`am-pick-row${selectedCatalog.has(p.key) ? ' selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedCatalog.has(p.key)}
                      onChange={() => {
                        setSelectedCatalog(prev => {
                          const next = new Set(prev);
                          if (next.has(p.key)) next.delete(p.key);
                          else next.add(p.key);
                          return next;
                        });
                      }}
                      data-testid={`api-mock-import-catalog-${p.key}`}
                    />
                    <span className={`am-method-pill ${p.method.toLowerCase()}`}>{p.method}</span>
                    <span className="am-pick-path">{p.path}</span>
                    <span className="am-pick-origin">{p.label.split(' · ')[0]}</span>
                  </label>
                ))}
              </div>
              {selectedCatalog.size > 0 && <div className="am-pick-count">{selectedCatalog.size} selected</div>}
              {destinationFields}
              <button className="am-btn primary" style={{ marginTop: 8 }} onClick={handleParseCatalog} data-testid="api-mock-import-parse" disabled={selectedCatalog.size === 0}>
                Generate review
              </button>
            </>
          )}

          {source === 'requests' && (
            <>
              <div className="am-section-heading">
                Requests collection
                <span className="am-spacer" />
                {requestPicks.length > 0 && (
                  <span className="am-pick-actions">
                    <button type="button" className="am-btn small ghost" onClick={() => setSelectedRequests(new Set(filteredRequestPicks.map(p => p.key)))} data-testid="api-mock-import-requests-select-all">Select all</button>
                    <button type="button" className="am-btn small ghost" onClick={() => setSelectedRequests(new Set())}>None</button>
                  </span>
                )}
              </div>
              {loadMessage && <div className="am-muted" style={{ fontSize: 11, marginBottom: 8 }} data-testid="api-mock-import-load-msg">{loadMessage}</div>}
              {requestPicks.length > 0 && (
                <input className="am-search" placeholder="Filter requests…" style={{ marginBottom: 6 }} data-testid="api-mock-import-requests-filter"
                  onChange={e => setRequestFilter(e.target.value.toLowerCase())}
                  value={requestFilter}
                />
              )}
              <div className="am-pick-list" data-testid="api-mock-import-requests-list">
                {filteredRequestPicks.map(p => (
                  <label key={p.key} className={`am-pick-row${selectedRequests.has(p.key) ? ' selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedRequests.has(p.key)}
                      onChange={() => {
                        setSelectedRequests(prev => {
                          const next = new Set(prev);
                          if (next.has(p.key)) next.delete(p.key);
                          else next.add(p.key);
                          return next;
                        });
                      }}
                      data-testid={`api-mock-import-request-${p.key}`}
                    />
                    <span className={`am-method-pill ${p.method.toLowerCase()}`}>{p.method}</span>
                    <span className="am-pick-path">{p.label}</span>
                  </label>
                ))}
              </div>
              {selectedRequests.size > 0 && <div className="am-pick-count">{selectedRequests.size} selected</div>}
              {destinationFields}
              <button className="am-btn primary" style={{ marginTop: 8 }} onClick={handleParseRequests} data-testid="api-mock-import-parse" disabled={selectedRequests.size === 0}>
                Generate review
              </button>
            </>
          )}

          {/* B-2: HAR per-entry preview */}
          {harIsParsed && (
            <div className="am-import-result am-har-import-result" data-testid="api-mock-import-har-preview">
              {harPreview!.error ? (
                <div className="am-notice danger" data-testid="api-mock-import-har-error">
                  <span>{harPreview!.error}</span>
                </div>
              ) : (
                <>
                  <HarEntryPreviewList
                    preview={harPreview!}
                    selectedIndices={selectedPositions}
                    onToggle={handleHarToggle}
                    onSelectAll={handleHarSelectAll}
                    onDeselectAll={handleHarDeselectAll}
                  />
                  {harHasEntries && (
                    <label
                      className="am-har-samples-toggle"
                      data-testid="api-mock-import-har-samples-toggle"
                    >
                      <input
                        type="checkbox"
                        checked={createSamples}
                        onChange={e => setCreateSamples(e.target.checked)}
                        data-testid="api-mock-import-har-samples-checkbox"
                      />
                      <span>
                        Also create Simulate samples
                        <span className="am-muted" style={{ fontSize: 11, marginLeft: 6 }}>
                          (with expected status from HAR response)
                        </span>
                      </span>
                    </label>
                  )}
                  <div style={{ display: 'flex', marginTop: 12, gap: 8 }}>
                    <button
                      className="am-btn primary"
                      onClick={handleConfirm}
                      data-testid="api-mock-import-confirm"
                      disabled={selectedPositions.size === 0}
                    >
                      Import as draft
                    </button>
                    <button className="am-btn" onClick={onCancel} data-testid="api-mock-import-cancel">Cancel</button>
                  </div>
                  {selectedPositions.size > 0 && (
                    <div className="am-notice" style={{ marginTop: 8 }}>
                      <span>
                        {selectedPositions.size} route{selectedPositions.size !== 1 ? 's' : ''} will be imported as <strong>inactive</strong>.
                        {isCreatingFolder && newFolderName.trim()
                          ? <> New folder: <strong>{newFolderName.trim()}</strong>.</>
                          : folderId
                            ? <> Folder: <strong>{folders.find(f => f.id === folderId)?.name ?? 'New folder'}</strong>.</>
                            : null
                        }
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Non-HAR route preview */}
          {preview && (
            <div className="am-import-result" data-testid="api-mock-import-preview-block">
              {preview.diagnostics.filter(d => d.severity === 'info').map((d, i) => (
                <div key={`info-${i}`} className="am-notice" style={{ marginBottom: 6 }}>
                  <span>{d.message}</span>
                </div>
              ))}
              {preview.diagnostics.some(d => d.severity === 'error' || d.severity === 'warning') && (
                <div className="am-section-heading">Issues</div>
              )}
              {preview.diagnostics.filter(d => d.severity === 'error' || d.severity === 'warning').map((d, i) => (
                <div key={`issue-${i}`} className={`am-notice ${d.severity === 'error' ? 'danger' : 'warning'}`} style={{ marginBottom: 6 }}>
                  <span>{d.message}</span>
                </div>
              ))}
              {preview.lossReport.length > 0 && (
                <div data-testid="api-mock-import-loss">
                  <div className="am-section-heading">Loss report</div>
                  {preview.lossReport.map((line, i) => (
                    <div key={i} className="am-notice warning" style={{ marginBottom: 4 }}>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="am-section-heading">
                Generated route{preview.routes.length > 1 ? `s (${preview.routes.length})` : ''}
                <span className="am-spacer" />
                {preview.routes.length === 1 && (
                  <button type="button" className="am-btn-generalize" onClick={generalizePath} data-testid="api-mock-import-generalize">
                    <span aria-hidden="true">✦</span> Generalize path
                  </button>
                )}
              </div>
              {preview.routes.length === 1 && primaryRoute && (
                <div className="am-form-grid">
                  <div className="am-form-row">
                    <div className="am-form-label">Method</div>
                    <div className="am-form-control"><span className={`am-method ${primaryRoute.method.toLowerCase()}`}>{primaryRoute.method}</span></div>
                  </div>
                  <div className="am-form-row">
                    <div className="am-form-label">Path</div>
                    <div className="am-form-control"><span data-testid="api-mock-import-preview-path">{primaryRoute.path.value}</span></div>
                  </div>
                  <div className="am-form-row">
                    <div className="am-form-label">Priority</div>
                    <div className="am-form-control"><span>P{primaryRoute.priority}</span></div>
                  </div>
                </div>
              )}
              {preview.routes.length > 1 && (
                <ul className="am-import-route-list" data-testid="api-mock-import-route-list">
                  {preview.routes.map(r => (
                    <li key={r.id}>
                      <span className={`am-method-pill ${r.method.toLowerCase()}`}>{r.method}</span>
                      {r.path.value}
                    </li>
                  ))}
                </ul>
              )}
              <div className="am-notice" style={{ marginTop: 10 }}>
                <span>No conflicts with existing routes were analyzed yet — run <strong>Analyze all</strong> after import.</span>
              </div>
              <div style={{ display: 'flex', marginTop: 12, gap: 8 }}>
                <button className="am-btn primary" onClick={handleConfirm} data-testid="api-mock-import-confirm" disabled={preview.routes.length === 0}>
                  Import as draft
                </button>
                <button className="am-btn" onClick={onCancel} data-testid="api-mock-import-cancel">Cancel</button>
              </div>
              <div className="am-notice" style={{ marginTop: 8 }}>
                <span>Imported routes will be <strong>inactive</strong> until you enable them.
                  {isCreatingFolder && newFolderName.trim()
                    ? <> New folder: <strong>{newFolderName.trim()}</strong>.</>
                    : folderId
                      ? <> Folder: <strong>{folders.find(f => f.id === folderId)?.name ?? 'New folder'}</strong>.</>
                      : null
                  }
                </span>
              </div>
            </div>
          )}
        </div>
        <aside className="am-import-preview">
          <div className="am-section-heading">Preview</div>
          {harIsParsed ? (
            <div className="am-muted" style={{ fontSize: 11 }}>
              {harPreview!.error
                ? 'Fix the HAR JSON error to preview routes.'
                : 'Select entries and click Import as draft to create rules.'}
            </div>
          ) : !preview || preview.routes.length === 0 ? (
            <div className="am-muted" style={{ fontSize: 11 }}>Parse a source to preview the generated sample request and default response template.</div>
          ) : (
            preview.routes.map((r, idx) => {
              const resp = r.responses[0];
              const status = resp?.status ?? 200;
              const body = resp?.body.content || '{}';
              const ct = resp?.body.contentType ?? 'application/json';
              const statusClass = status < 300 ? 'success' : status < 500 ? 'warning' : 'danger';
              const statusText = status < 300 ? 'OK' : status < 400 ? 'Redirect' : status < 500 ? 'Client Error' : 'Server Error';
              const pathParts = r.path.value.split(/(\{[^}]+\})/);
              const multi = preview.routes.length > 1;
              return (
                <div key={r.id} className={`am-import-preview-card${idx > 0 ? ' am-import-preview-card--sep' : ''}`}>
                  <div className="am-import-preview-card-head">
                    {multi && <span className="am-import-preview-num">{idx + 1}</span>}
                    <span className={`am-method ${r.method.toLowerCase()}`}>{r.method}</span>
                    <span className="am-import-preview-head-path">
                      {pathParts.map((part, i) =>
                        part.startsWith('{') ? (
                          <span key={i} className="am-import-preview-param">{part}</span>
                        ) : (
                          <span key={i}>{part}</span>
                        )
                      )}
                    </span>
                  </div>
                  <div className="am-import-preview-card-body">
                    <div className="am-import-preview-label">Sample request</div>
                    <div
                      className="am-import-preview-req"
                      data-testid={`api-mock-import-preview-request${multi ? `-${idx}` : ''}`}
                    >
                      <div className="am-import-preview-req-line">
                        <span className={`am-method ${r.method.toLowerCase()}`}>{r.method}</span>
                        <span className="am-import-preview-path">
                          {pathParts.map((part, i) =>
                            part.startsWith('{') ? (
                              <span key={i} className="am-import-preview-param">{part}</span>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )}
                        </span>
                        <span className="am-import-preview-proto">HTTP/1.1</span>
                      </div>
                    </div>
                    <div className="am-import-preview-label" style={{ marginTop: 8 }}>Default response</div>
                    <div
                      className="am-import-preview-resp"
                      data-testid={`api-mock-import-preview-response${multi ? `-${idx}` : ''}`}
                    >
                      <div className="am-import-preview-resp-head">
                        <span className={`am-badge ${statusClass}`}>{status}</span>
                        <span className="am-import-preview-status-text">{statusText}</span>
                        <span className="am-spacer" />
                        <span className="am-import-preview-ct">{ct}</span>
                      </div>
                      <pre className="am-import-preview-body">{body}</pre>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </aside>
      </div>
    </div>
  );
}
function parseCurlToSource(curl: string): SourceRequest {
  const method = curl.match(/-X\s+(\w+)/i)?.[1] ?? 'GET';
  const urlMatch = curl.match(/(?:curl\s+)?(?:-[^\s]+\s+)*['"]?(https?:\/\/[^\s'"]+)/i) ?? curl.match(/['"]?(\/[^\s'"]*)/);
  const rawUrl = urlMatch?.[1] ?? '/';
  let path: string;
  try { path = new URL(rawUrl).pathname; } catch { path = rawUrl.split('?')[0]; }
  const headers: Record<string, string> = {};
  for (const m of curl.matchAll(/-H\s+['"]([^'"]+)['"]/gi)) {
    const [key, ...rest] = m[1].split(':');
    if (key) headers[key.trim()] = rest.join(':').trim();
  }
  const bodyMatch = curl.match(/-d\s+['"]([^'"]*)['"]/i) ?? curl.match(/--data(?:-raw)?\s+['"]([^'"]*)['"]/i);
  const body = bodyMatch?.[1];
  const ct = headers['Content-Type'] || headers['content-type'];

  return { method, path, headers, body, contentType: ct };
}
