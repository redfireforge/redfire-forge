import { useState, useMemo, useCallback, useEffect } from 'react';
import { buildTree, getAllLeafPaths } from '../utils/jsonPathTreeUtils';
import { getByPath } from '../engine/validator';
import { PickerNode } from './RegexAssertionModal';
import { useDebounce } from '../hooks/useDebounce';

const MAX_MATCH_CHIPS = 32;

function stripExpressionPrefix(expr: string): string {
  return expr.replace(/^\$\.?/, '').trim();
}

function shortenPathDisplay(p: string, max = 46): string {
  if (p.length <= max) return p;
  return `${p.slice(0, 22)}…${p.slice(-18)}`;
}

function hasNumericIndicesInPath(bare: string): boolean {
  return /\[\d+]/.test(bare);
}

export interface ExtractionFetchSampleProps {
  onFetch: () => void | Promise<void>;
  fetching: boolean;
  error: string | null;
  host?: {
    enabled: boolean;
    setEnabled: (v: boolean) => void;
    override: string;
    setOverride: (v: string) => void;
    resolvedBaseUrl: string;
  };
}

interface Props {
  initialExpression: string;
  /** Pre-filled sample body (e.g. from Fetch Response or last validation). */
  initialSampleJson?: string;
  /** Optional: same Fetch Response + host row as Harness → Validation. */
  fetchSample?: ExtractionFetchSampleProps;
  onApply: (expression: string) => void;
  onClose: () => void;
}

function previewExtracted(body: unknown, expression: string): string | undefined {
  if (!expression.trim()) return undefined;
  const raw = getByPath(body, expression);
  if (raw === undefined) return undefined;
  return typeof raw === 'string' ? raw : JSON.stringify(raw);
}

export default function ExtractionPathPickerModal({
  initialExpression,
  initialSampleJson = '',
  fetchSample,
  onApply,
  onClose,
}: Props) {
  const [expression, setExpression] = useState(initialExpression);
  const [sampleJson, setSampleJson] = useState(initialSampleJson);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);

  useEffect(() => {
    setExpression(initialExpression);
  }, [initialExpression]);

  useEffect(() => {
    if (initialSampleJson !== undefined && initialSampleJson !== '') {
      setSampleJson(initialSampleJson);
    }
  }, [initialSampleJson]);

  const { parsedTree, parseError } = useMemo(() => {
    if (!sampleJson.trim()) return { parsedTree: null, parseError: null as string | null };
    try {
      const obj = JSON.parse(sampleJson);
      return { parsedTree: buildTree(obj, '', '(root)'), parseError: null };
    } catch (e) {
      return { parsedTree: null, parseError: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [sampleJson]);

  const leafCount = useMemo(() => (parsedTree ? getAllLeafPaths(parsedTree).length : 0), [parsedTree]);

  const matchedLeafPaths = useMemo(() => {
    if (!parsedTree || !debouncedSearch.trim()) return [];
    const allLeaves = getAllLeafPaths(parsedTree);
    const lower = debouncedSearch.toLowerCase();
    return allLeaves.filter((p) => p.toLowerCase().includes(lower));
  }, [parsedTree, debouncedSearch]);

  const parsedBody = useMemo(() => {
    if (!sampleJson.trim()) return null;
    try {
      return JSON.parse(sampleJson) as unknown;
    } catch {
      return null;
    }
  }, [sampleJson]);

  const preview = useMemo(() => {
    if (!parsedBody || !expression.trim()) return { text: undefined as string | undefined, missing: false };
    const t = previewExtracted(parsedBody, expression);
    return { text: t, missing: t === undefined && sampleJson.trim().length > 0 };
  }, [parsedBody, expression, sampleJson]);

  const selectedBarePath = stripExpressionPrefix(expression);

  const handleSelectPath = useCallback((path: string) => {
    const prefix = path.startsWith('$') ? path : `$.${path}`;
    setExpression(prefix);
  }, []);

  const prettifySample = useCallback(() => {
    try {
      setSampleJson(JSON.stringify(JSON.parse(sampleJson), null, 2));
    } catch { /* keep as-is */ }
  }, [sampleJson]);

  const useFirstMatch = useCallback(() => {
    if (matchedLeafPaths.length === 0) return;
    setExpression(`$.${matchedLeafPaths[0]}`);
  }, [matchedLeafPaths]);

  const clearMatchedPath = useCallback(() => {
    if (matchedLeafPaths.length === 0) return;
    const bare = selectedBarePath;
    if (matchedLeafPaths.some((p) => p === bare)) {
      setExpression('');
    }
  }, [matchedLeafPaths, selectedBarePath]);

  const applyWildcardIndices = useCallback(() => {
    const bare = selectedBarePath;
    if (!bare || !hasNumericIndicesInPath(bare)) return;
    const wild = bare.replace(/\[\d+]/g, '[*]');
    setExpression(`$.${wild}`);
  }, [selectedBarePath]);

  const handleApply = () => {
    onApply(expression.trim());
  };

  const normalizedDisplay = expression.trim()
    ? (expression.trim().startsWith('$') ? expression.trim() : `$.${expression.trim()}`)
    : '';

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal ram-modal epp-path-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ram-header">
          <h3>Pick JSON path (extraction)</h3>
          <button type="button" className="ram-modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="ram-body epp-modal-body">
          {fetchSample && (
            <div className="fetch-host-override-row epp-fetch-row">
              <button
                type="button"
                className="btn btn-sm btn-accent"
                onClick={() => void fetchSample.onFetch()}
                disabled={fetchSample.fetching}
              >
                {fetchSample.fetching ? 'Fetching…' : 'Fetch Response'}
              </button>
              {fetchSample.host && (
                <>
                  <label className="checkbox-label fetch-host-toggle">
                    <input
                      type="checkbox"
                      checked={fetchSample.host.enabled}
                      onChange={(e) => fetchSample.host!.setEnabled(e.target.checked)}
                    />
                    Host Override
                  </label>
                  <input
                    value={fetchSample.host.override}
                    onChange={(e) => fetchSample.host!.setOverride(e.target.value)}
                    placeholder={fetchSample.host.resolvedBaseUrl || 'Enter base URL'}
                    disabled={!fetchSample.host.enabled}
                  />
                  {fetchSample.host.enabled && fetchSample.host.resolvedBaseUrl && !fetchSample.host.override.trim() && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => fetchSample.host!.setOverride(fetchSample.host!.resolvedBaseUrl)}
                      title="Use Settings base URL"
                    >
                      Use Settings
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {fetchSample?.error && (
            <div className="fetch-error-inline">{fetchSample.error}</div>
          )}

          <div className={`jpb-columns ${parsedTree ? '' : 'jpb-single-column'}`}>
            <div className="jpb-left">
              <div className="jpb-sample-header">
                <label>Paste a sample JSON response</label>
                <div className="jpb-sample-actions">
                  {sampleJson.trim() && (
                    <button type="button" className="btn btn-sm" onClick={prettifySample}>
                      Prettify
                    </button>
                  )}
                  {sampleJson.trim() && (
                    <button type="button" className="btn btn-sm" onClick={() => setSampleJson('')} title="Clear sample JSON">
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                className="body-editor jpb-textarea epp-sample-textarea"
                value={sampleJson}
                onChange={(e) => setSampleJson(e.target.value)}
                placeholder='Paste JSON here, or use "Fetch Response" above to load the response body.'
              />
              {parseError && <div className="jpb-error">Parse error: {parseError}</div>}
            </div>

            {parsedTree && (
              <div className="jpb-right">
                <div className="jpb-controls">
                  <div className="jpb-bulk-actions">
                    <button type="button" className="btn btn-sm" onClick={() => setExpression('')} title="Clear selected path">
                      Clear path
                    </button>
                  </div>
                  <span className="jpb-stats">
                    {leafCount} field{leafCount === 1 ? '' : 's'} in tree
                  </span>
                </div>

                <div className="jpb-mode-hint">
                  Click a row or a match chip to set the path. For arrays whose length changes between runs, pick a sample index
                  then use <code>[*]</code> so one expression matches every index.
                </div>

                <div className="jpb-search">
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search keys or paths…"
                  />
                  {debouncedSearch.trim() && matchedLeafPaths.length > 0 && (
                    <div className="jpb-search-actions">
                      <button type="button" className="btn btn-sm btn-accent" onClick={useFirstMatch}>
                        Use first match ({matchedLeafPaths.length})
                      </button>
                      <button type="button" className="btn btn-sm" onClick={clearMatchedPath} title="Clear path if it is one of the matches">
                        Clear if matched
                      </button>
                    </div>
                  )}
                  {debouncedSearch.trim() && matchedLeafPaths.length > 0 && (
                    <div className="epp-match-chips-block">
                      <div className="epp-match-chips-label">
                        Matches
                        <span className="epp-match-chips-count">({matchedLeafPaths.length})</span>
                        — click a path
                      </div>
                      <div className="epp-match-chips" role="list">
                        {matchedLeafPaths.slice(0, MAX_MATCH_CHIPS).map((p) => (
                          <button
                            key={p}
                            type="button"
                            role="listitem"
                            className={`epp-match-chip ${selectedBarePath === p ? 'epp-match-chip-active' : ''}`}
                            title={p}
                            onClick={() => handleSelectPath(p)}
                          >
                            <span className="epp-match-chip-path">{shortenPathDisplay(p)}</span>
                          </button>
                        ))}
                      </div>
                      {matchedLeafPaths.length > MAX_MATCH_CHIPS && (
                        <div className="epp-match-chips-more">
                          +{matchedLeafPaths.length - MAX_MATCH_CHIPS} more — refine search to list them
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {hasNumericIndicesInPath(selectedBarePath) && (
                  <div className="epp-wildcard-row">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={applyWildcardIndices}
                      title="Turn offers[0].x into offers[*].x so array length can change between responses"
                    >
                      Replace numeric indices with [*]
                    </button>
                    <span className="epp-wildcard-hint">Works with any sample index from the tree or chips.</span>
                  </div>
                )}

                <div className="json-tree-container epp-tree-wrap">
                  <PickerNode
                    node={parsedTree}
                    depth={0}
                    selectedPath={selectedBarePath}
                    onSelect={handleSelectPath}
                    searchTerm={debouncedSearch}
                    expandAll
                  />
                </div>
              </div>
            )}
          </div>

          <div className="epp-expression-block">
            <div className="ram-field-group">
              <label className="ram-label">Expression (JSONPath-style)</label>
              <input
                className="ram-input"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                placeholder="$.data.id  or  $.items[*].code"
              />
              <p className="epp-hint">
                Same path rules as validation: <code>$.</code> prefix optional; <code>[*]</code> selects every array element at that step.
                {normalizedDisplay && (
                  <> Normalized: <code>{normalizedDisplay}</code></>
                )}
              </p>
            </div>

            {preview.text !== undefined && (
              <div className="ram-resolved-value">
                <span className="ram-resolved-label">Preview at path:</span>
                <code className="ram-resolved-code">
                  {preview.text.length > 400 ? `${preview.text.slice(0, 400)}…` : preview.text}
                </code>
              </div>
            )}
            {preview.missing && (
              <div className="ram-resolved-value ram-resolved-missing">
                No value at this path in the sample JSON.
              </div>
            )}

            {!sampleJson.trim() && (
              <div className="ram-hint epp-empty-hint">
                Paste JSON on the left or fetch a response, then pick a field or type an expression.
              </div>
            )}
          </div>
        </div>

        <div className="ram-footer">
          <button type="button" className="btn btn-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-accent" onClick={handleApply} disabled={!expression.trim()}>
            Use this path
          </button>
        </div>
      </div>
    </div>
  );
}
