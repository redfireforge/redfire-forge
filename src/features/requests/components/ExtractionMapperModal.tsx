import { useState, useCallback, useMemo, useRef } from 'react';
import type { Extraction } from '../../../shared/types';
import { buildTree, suggestedVariableNameFromJsonPath } from '../utils/jsonPathTreeUtils';
import { PickerNode } from './RegexAssertionModal';
import type { ExtractionFetchSampleProps } from './ExtractionPathPickerModal';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import FullPanelModal from '../../../shared/components/FullPanelModal';

interface Props {
  /** Current extractions (shown as pre-selected in right panel). */
  existingExtractions: Extraction[];
  /** Sample JSON response body. */
  sampleResponseBody?: string;
  /** Fetch Response controls. */
  fetchSample: ExtractionFetchSampleProps;
  /** Called with the merged extractions on Apply. */
  onApply: (extractions: Extraction[]) => void;
  onClose: () => void;
}

/** Pending extraction being built in the right panel. */
interface MappedExtraction extends Extraction {
  /** Whether this came from the existing extractions (vs. newly picked). */
  existing?: boolean;
  /** Whether any field was changed from the original (only relevant for existing rows). */
  changed?: boolean;
}

/**
 * @deprecated Use `DataMapperModal` with `createExtractionAdapter` instead.
 * This component will be removed once all call sites are migrated (Phase 3 wiring).
 */
export default function ExtractionMapperModal({
  existingExtractions,
  sampleResponseBody,
  fetchSample,
  onApply,
  onClose,
}: Props) {
  // Right-panel selections: start with existing extractions
  const [mappings, setMappings] = useState<MappedExtraction[]>(
    () => existingExtractions.map(e => ({ ...e, existing: true })),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);
  const [expandAll, setExpandAll] = useState(true);
  // Incrementing key forces PickerNode tree to remount, resetting all manualExpanded states
  const [treeKey, setTreeKey] = useState(0);
  // Track which extraction row is active (focused) — double-click tree populates this row's expression
  const [activeRowIdx, setActiveRowIdx] = useState<number | null>(null);
  // Ref to expression inputs for programmatic focus after tree selection
  const exprInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  // Build tree from sample response
  const { parsedTree, parseError, responseSize } = useMemo(() => {
    if (!sampleResponseBody?.trim()) return { parsedTree: null, parseError: null as string | null, responseSize: 0 };
    try {
      const obj = JSON.parse(sampleResponseBody);
      return {
        parsedTree: buildTree(obj, '', '(root)'),
        parseError: null,
        responseSize: sampleResponseBody.length,
      };
    } catch (e) {
      return { parsedTree: null, parseError: e instanceof Error ? e.message : 'Invalid JSON', responseSize: 0 };
    }
  }, [sampleResponseBody]);

  // Set of expressions already mapped
  const mappedPaths = useMemo(
    () => new Set(mappings.map(m => m.expression)),
    [mappings],
  );

  // Snapshot of original extraction values for change detection
  const originalExtractionsRef = useRef(
    new Map(existingExtractions.map((e, i) => [i, { name: e.name, expression: e.expression, fallback: e.fallback }])),
  );

  /** Update a mapping field, marking existing rows as changed when values differ from original */
  const updateMapping = useCallback((idx: number, patch: Partial<MappedExtraction>) => {
    setMappings(prev => prev.map((m, i) => {
      if (i !== idx) return m;
      const updated = { ...m, ...patch };
      if (updated.existing) {
        const orig = originalExtractionsRef.current.get(idx);
        updated.changed = orig
          ? updated.name !== orig.name || updated.expression !== orig.expression || updated.fallback !== orig.fallback
          : false;
      }
      return updated;
    }));
  }, []);

  /** Double-click a tree node → populate active row's expression, or add new row */
  const handleTreeSelect = useCallback((path: string) => {
    const expr = path.startsWith('$') ? path : `$.${path}`;
    const suggested = suggestedVariableNameFromJsonPath(expr);
    if (activeRowIdx !== null && activeRowIdx < mappings.length) {
      // Populate the active row — use updateMapping so change detection works
      updateMapping(activeRowIdx, { expression: expr, name: mappings[activeRowIdx].name || suggested || '' });
    } else {
      // No active row — create a new one and activate it
      setMappings(prev => {
        const newIdx = prev.length;
        setActiveRowIdx(newIdx);
        return [...prev, { name: suggested || '', source: 'body', expression: expr, fallback: '' }];
      });
    }
  }, [activeRowIdx, mappings, updateMapping]);

  /** Add a blank extraction row */
  const addExtraction = useCallback(() => {
    setMappings(prev => {
      const newIdx = prev.length;
      setActiveRowIdx(newIdx);
      return [...prev, { name: '', source: 'body', expression: '', fallback: '' }];
    });
    // Focus the new expression input after render
    setTimeout(() => {
      const input = exprInputRefs.current.get(mappings.length);
      if (input) input.focus();
    }, 50);
  }, [mappings.length]);

  /** Remove a mapping */
  const removeMapping = useCallback((idx: number) => {
    setMappings(prev => prev.filter((_, i) => i !== idx));
    setActiveRowIdx(prev => {
      if (prev === null) return null;
      if (prev === idx) return null;
      if (prev > idx) return prev - 1;
      return prev;
    });
  }, []);

  /** Apply and close */
  const handleApply = useCallback(() => {
    // Strip internal flags
    const cleaned: Extraction[] = mappings.map(({ existing: _, changed: _c, ...rest }) => rest);
    onApply(cleaned);
  }, [mappings, onApply]);

  const newCount = mappings.filter(m => !m.existing).length;
  const changedCount = mappings.filter(m => m.existing && m.changed).length;

  // selectedPath for tree highlighting — show all mapped paths

  return (
    <FullPanelModal
      title="Extraction Mapper"
      onClose={onClose}
      footer={(
        <>
          <div className="emm-footer-hint">
            <span className="emm-legend">
              <span className="emm-legend-dot emm-legend-new" />New
              <span className="emm-legend-dot emm-legend-changed" />Changed
              <span className="emm-legend-dot emm-legend-untouched" />Untouched
            </span>
            {activeRowIdx !== null && activeRowIdx < mappings.length
              ? <> · Row <strong>{activeRowIdx + 1}</strong> active — double-click a response field</>
              : null
            }
          </div>
          <div className="emm-footer-actions">
            <button type="button" className="btn btn-cancel" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-accent" onClick={handleApply}>
              Apply {mappings.length} Extraction{mappings.length !== 1 ? 's' : ''}
              {newCount > 0 && ` (${newCount} new)`}
              {changedCount > 0 && ` (${changedCount} changed)`}
            </button>
          </div>
        </>
      )}
    >
        <div className="emm-fetch-bar">
          <button
            type="button"
            className="btn btn-sm btn-accent"
            onClick={() => void fetchSample.onFetch()}
            disabled={fetchSample.fetching}
          >
            {fetchSample.fetching ? 'Fetching…' : '⚡ Fetch Response'}
          </button>
          {fetchSample.host && (
            <>
              <label className="ext-host-toggle">
                <input
                  type="checkbox"
                  checked={fetchSample.host.enabled}
                  onChange={(e) => fetchSample.host!.setEnabled(e.target.checked)}
                />
                Host Override
              </label>
              {fetchSample.host.enabled && (
                <input
                  className="ext-host-input"
                  value={fetchSample.host.override}
                  onChange={(e) => fetchSample.host!.setOverride(e.target.value)}
                  placeholder={fetchSample.host.resolvedBaseUrl || 'https://api.example.com'}
                />
              )}
            </>
          )}
          {fetchSample.host && !fetchSample.host.enabled && fetchSample.host.resolvedBaseUrl && (
            <span className="emm-resolved-url">
              Target: <code>{fetchSample.host.resolvedBaseUrl}</code>
            </span>
          )}
          {responseSize > 0 && (
            <span className="emm-size-badge">
              {responseSize > 1024 ? `${(responseSize / 1024).toFixed(1)} KB` : `${responseSize} B`}
            </span>
          )}
        </div>
        {fetchSample.error && (
          <div className="ext-fetch-error">{fetchSample.error}</div>
        )}

        {/* ── Split panels ── */}
        <div className="emm-panels">
          {/* Left: JSON tree */}
          <div className="emm-left">
            <div className="emm-panel-header">
              <span className="emm-panel-title">Response Body</span>
              {parsedTree && (
                <div className="emm-tree-controls">
                  <button
                    type="button"
                    className="jt-expand-collapse-btn"
                    onClick={() => { setExpandAll(true); setTreeKey(k => k + 1); }}
                  >Expand All</button>
                  <button
                    type="button"
                    className="jt-expand-collapse-btn"
                    onClick={() => { setExpandAll(false); setTreeKey(k => k + 1); }}
                  >Collapse All</button>
                  <input
                    className="emm-search"
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search keys…"
                  />
                </div>
              )}
            </div>
            <div className="emm-tree-scroll">
              {!parsedTree && !parseError && (
                <div className="emm-empty-tree">
                  Click <strong>⚡ Fetch Response</strong> to load the response body.
                </div>
              )}
              {parseError && (
                <div className="ext-fetch-error">Parse error: {parseError}</div>
              )}
              {parsedTree && (
                <PickerNode
                  key={treeKey}
                  node={parsedTree}
                  depth={0}
                  selectedPath=""
                  onSelect={handleTreeSelect}
                  searchTerm={debouncedSearch}
                  expandAll={expandAll}
                  mappedPaths={mappedPaths}
                  selectOnDoubleClick
                />
              )}
            </div>
          </div>

          {/* Right: Selected extractions */}
          <div className="emm-right">
            <div className="emm-panel-header">
              <span className="emm-panel-title">
                Extractions
                {mappings.length > 0 && <span className="emm-count-badge">{mappings.length}</span>}
              </span>
              <button
                type="button"
                className="btn btn-xs emm-add-btn"
                onClick={addExtraction}
                title="Add extraction"
                aria-label="Add extraction"
              >
                + Add
              </button>
            </div>
            <div className="emm-mappings-scroll">
              {mappings.length === 0 && (
                <div className="emm-empty-mappings">
                  Click <strong>+ Add</strong> to create an extraction, then double-click a response field to set the path.
                </div>
              )}
              {mappings.map((m, i) => (
                <div
                  key={`${m.expression}-${i}`}
                  className={`emm-mapping-row${m.existing && !m.changed ? ' emm-untouched' : ''}${m.existing && m.changed ? ' emm-changed' : ''}${!m.existing ? ' emm-new' : ''}${activeRowIdx === i ? ' emm-active' : ''}`}
                  onClick={() => setActiveRowIdx(i)}
                >
                  <div className="emm-mapping-top">
                    <input
                      className="emm-var-input"
                      value={m.name}
                      onChange={(e) => updateMapping(i, { name: e.target.value.replace(/[{}]/g, '') })}
                      onFocus={() => setActiveRowIdx(i)}
                      placeholder="variableName"
                      aria-label="Variable name"
                    />
                    <button
                      type="button"
                      className="emm-remove-btn"
                      onClick={(e) => { e.stopPropagation(); removeMapping(i); }}
                      title="Remove"
                      aria-label={`Remove extraction ${i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                  <div className="emm-mapping-expr">
                    <input
                      className="emm-expr-input"
                      ref={(el) => { if (el) exprInputRefs.current.set(i, el); else exprInputRefs.current.delete(i); }}
                      value={m.expression}
                      onChange={(e) => updateMapping(i, { expression: e.target.value })}
                      onFocus={() => setActiveRowIdx(i)}
                      placeholder="$.path.to.field (or double-click response)"
                      aria-label="JSON path expression"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

    </FullPanelModal>
  );
}
