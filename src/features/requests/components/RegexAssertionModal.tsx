import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react';
import { buildJsonTree, getAllLeafPaths, nodeMatchesSearch } from '../../../shared/utils/jsonTreeModel';
import type { JsonTreeNode } from '../../../shared/utils/jsonTreeModel';
import type { FetchErrorDetail } from '../../../shared/components/data-mapper/types';
import { typeColor, getValuePreview, ChevronIcon } from '../../../shared/components/jsonTreeShared';
import FullPanelModal from '../../../shared/components/FullPanelModal';
import FetchErrorBanner from '../../../shared/components/data-mapper/FetchErrorBanner';
import { PATTERN_LIBRARY, testPattern, resolveValue, type PatternEntry } from './regexAssertionUtils';
export type { MatchResult } from './regexAssertionUtils';

export interface RegexAssertionResult {
  jsonPath: string;
  pattern: string;
  patternName?: string;
}

interface Props {
  initialJsonPath?: string;
  initialPattern?: string;
  sampleJson?: string;
  onFetchSampleResponse?: () => void | Promise<void>;
  fetchingResponse?: boolean;
  fetchError?: FetchErrorDetail | null;
  onApply: (result: RegexAssertionResult) => void;
  onClose: () => void;
}

const CATEGORIES = [...new Set(PATTERN_LIBRARY.map(p => p.category))];

/* ── Tree Node (click-to-select, no checkboxes) ────── */

interface PickerNodeProps {
  node: JsonTreeNode;
  depth: number;
  selectedPath: string;
  onSelect: (path: string) => void;
  searchTerm: string;
  expandAll?: boolean;
  mappedPaths?: Set<string>;
  selectOnDoubleClick?: boolean;
}

export const PickerNode = memo(function PickerNode({ node, depth, selectedPath, onSelect, searchTerm, expandAll, mappedPaths, selectOnDoubleClick }: PickerNodeProps) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const hasChildren = node.children && node.children.length > 0;

  const matchesSelf = useMemo(() => {
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    return (node.key || '').toLowerCase().includes(lower)
      || (node.path || '').toLowerCase().includes(lower)
      || (node.type !== 'object' && node.type !== 'array' && String(node.value ?? '').toLowerCase().includes(lower));
  }, [node, searchTerm]);

  const hasMatchingDescendant = useMemo(() => {
    if (!searchTerm) return true;
    return nodeMatchesSearch(node, searchTerm);
  }, [node, searchTerm]);

  const effectiveExpanded = useMemo(() => {
    if (searchTerm && hasMatchingDescendant) return true;
    if (manualExpanded !== null) return manualExpanded;
    if (expandAll === true) return true;
    if (expandAll === false) return depth < 1;
    return depth < 2;
  }, [searchTerm, hasMatchingDescendant, manualExpanded, expandAll, depth]);

  const valuePreview = useMemo(
    () => getValuePreview(node.type, node.value, node.children?.length || 0, 50),
    [node],
  );

  const color = useMemo(() => typeColor(node.type), [node.type]);

  if (searchTerm && !hasMatchingDescendant) return null;

  const isSelected = node.path === selectedPath;
  const isHighlighted = searchTerm && matchesSelf;
  const isMapped = mappedPaths ? mappedPaths.has(node.path.startsWith('$') ? node.path : `$.${node.path}`) : false;

  return (
    <div className="ram-tree-node">
      <div
        className={`ram-tree-row ${isSelected ? 'ram-tree-selected' : ''} ${isHighlighted ? 'search-hit' : ''} ${isMapped ? 'ram-tree-mapped' : ''}`}
        style={{ paddingLeft: depth * 18 + 8 }}
        onClick={selectOnDoubleClick ? undefined : () => { if (node.path) onSelect(node.path); }}
        onDoubleClick={selectOnDoubleClick ? () => { if (node.path) onSelect(node.path); } : undefined}
      >
        {hasChildren ? (
          <span
            className={`jt-toggle ${effectiveExpanded ? '' : 'jt-toggle--collapsed'}`}
            onClick={(e) => { e.stopPropagation(); setManualExpanded(!effectiveExpanded); }}
          >
            <ChevronIcon />
          </span>
        ) : (
          <span className="jt-toggle-spacer" />
        )}
        <span className="jt-key">{node.key}</span>
        <span className="jt-colon">:</span>
        <span className="json-tree-value" style={{ color }}>{valuePreview}</span>
        {node.path && <span className="json-tree-path">{node.path}</span>}
        {isMapped && <span className="emm-mapped-check" title="Mapped">✓</span>}
      </div>
      {hasChildren && effectiveExpanded && (
        <div className="json-tree-children">
          {node.children!.map((child, i) => (
            <PickerNode
              key={`${child.path}-${i}`}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              searchTerm={searchTerm}
              expandAll={expandAll}
              mappedPaths={mappedPaths}
              selectOnDoubleClick={selectOnDoubleClick}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/* ── Main Modal ─────────────────────────────────────── */

export default function RegexAssertionModal({
  initialJsonPath, initialPattern, sampleJson: externalJson,
  onFetchSampleResponse, fetchingResponse, fetchError,
  onApply, onClose,
}: Props) {
  const [jsonPath, setJsonPath] = useState(initialJsonPath || '');
  const [pattern, setPattern] = useState(initialPattern || '');
  const [patternName, setPatternName] = useState('');
  const [sampleJson, setSampleJson] = useState(externalJson || '');
  const [treeSearch, setTreeSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showPatternLibrary, setShowPatternLibrary] = useState(false);

  const prevExternalRef = useRef(externalJson);
  useEffect(() => {
    if (externalJson && externalJson !== prevExternalRef.current) {
       
      setSampleJson(externalJson);
    }
    prevExternalRef.current = externalJson;
  }, [externalJson]);

  const { parsedTree, parseError } = useMemo(() => {
    if (!sampleJson.trim()) return { parsedTree: null, parseError: null };
    try {
      const obj = JSON.parse(sampleJson);
      return { parsedTree: buildJsonTree(obj, '(root)', ''), parseError: null };
    } catch (e) {
      return { parsedTree: null, parseError: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [sampleJson]);

  const leafCount = useMemo(() => parsedTree ? getAllLeafPaths(parsedTree).length : 0, [parsedTree]);

  const resolvedValue = useMemo(() => resolveValue(sampleJson, jsonPath), [sampleJson, jsonPath]);

  const matchResult = useMemo(() => {
    if (!pattern || resolvedValue === undefined) return null;
    return testPattern(pattern, resolvedValue);
  }, [pattern, resolvedValue]);

  const handleSelectPath = useCallback((path: string) => {
    const prefix = path.startsWith('$') ? path : `$.${path}`;
    setJsonPath(prefix);
  }, []);

  const handleSelectPattern = useCallback((entry: PatternEntry) => {
    setPattern(entry.pattern);
    setPatternName(entry.name);
    setShowPatternLibrary(false);
  }, []);

  const handleApply = () => {
    onApply({ jsonPath, pattern, patternName: patternName || undefined });
  };

  const filteredPatterns = activeCategory
    ? PATTERN_LIBRARY.filter(p => p.category === activeCategory)
    : PATTERN_LIBRARY;

  return (
    <FullPanelModal
      title="Regex Assertion Builder"
      onClose={onClose}
      footer={(
        <>
          <button className="btn btn-cancel" onClick={onClose}>Close</button>
          <button className="btn btn-accent" onClick={handleApply} disabled={!jsonPath || !pattern}>
            Apply Assertion
          </button>
        </>
      )}
    >
          {/* Left: JSON Tree picker */}
          <div className="ram-left">
            <div className="ram-section-title">
              <span>JSON Response</span>
              {parsedTree && <span className="ram-leaf-count">{leafCount} fields</span>}
            </div>

            {onFetchSampleResponse && (
              <div className="ram-fetch-row">
                <button
                  type="button"
                  className="btn btn-sm btn-accent"
                  onClick={() => void onFetchSampleResponse()}
                  disabled={fetchingResponse}
                >
                  {fetchingResponse ? 'Fetching...' : 'Fetch Response'}
                </button>
                {fetchError && <FetchErrorBanner error={fetchError} />}
              </div>
            )}

            {!parsedTree && (
              <textarea
                className="body-editor ram-json-textarea"
                value={sampleJson}
                onChange={(e) => setSampleJson(e.target.value)}
                placeholder="Paste sample JSON response here to browse fields..."
                rows={12}
              />
            )}
            {parseError && <div className="jpb-error">Parse error: {parseError}</div>}

            {parsedTree && (
              <>
                <div className="ram-tree-controls">
                  <input
                    value={treeSearch}
                    onChange={(e) => setTreeSearch(e.target.value)}
                    placeholder="Search fields..."
                    className="ram-search-input"
                  />
                  <button className="btn btn-xs" onClick={() => setSampleJson('')} title="Clear JSON">Clear</button>
                </div>
                <div className="ram-tree-container">
                  <PickerNode
                    node={parsedTree}
                    depth={0}
                    selectedPath={jsonPath.replace(/^\$\.?/, '')}
                    onSelect={handleSelectPath}
                    searchTerm={treeSearch}
                    expandAll
                  />
                </div>
              </>
            )}
          </div>

          {/* Right: Pattern + Preview */}
          <div className="ram-right">
            {/* JSONPath */}
            <div className="ram-field-group">
              <label className="ram-label">JSONPath</label>
              <input
                className="ram-input"
                value={jsonPath}
                onChange={(e) => setJsonPath(e.target.value)}
                placeholder="$.offers[0].offerName  or  $.offers"
              />
              {jsonPath && resolvedValue !== undefined && (
                <div className="ram-resolved-value">
                  <span className="ram-resolved-label">Value:</span>
                  <code className="ram-resolved-code">
                    {resolvedValue.length > 200 ? resolvedValue.slice(0, 200) + '...' : resolvedValue}
                  </code>
                </div>
              )}
              {jsonPath && resolvedValue === undefined && sampleJson.trim() && (
                <div className="ram-resolved-value ram-resolved-missing">
                  Path not found in sample JSON
                </div>
              )}
            </div>

            {/* Pattern */}
            <div className="ram-field-group">
              <label className="ram-label">
                Regex Pattern
                <button
                  className="btn btn-xs btn-accent ram-lib-btn"
                  onClick={() => setShowPatternLibrary(!showPatternLibrary)}
                >
                  {showPatternLibrary ? 'Hide Library' : 'Pattern Library'}
                </button>
              </label>
              <div className="ram-pattern-input-row">
                <span className="assertion-regex-slash">/</span>
                <input
                  className="ram-input ram-pattern-input"
                  value={pattern}
                  onChange={(e) => { setPattern(e.target.value); setPatternName(''); }}
                  placeholder="e.g. Connected Access"
                />
                <span className="assertion-regex-slash">/</span>
              </div>
              {patternName && (
                <div className="ram-pattern-name-tag">{patternName}</div>
              )}
            </div>

            {/* Pattern Library */}
            {showPatternLibrary && (
              <div className="ram-library">
                <div className="ram-library-cats">
                  <button
                    className={`btn btn-xs ${!activeCategory ? 'btn-active' : ''}`}
                    onClick={() => setActiveCategory(null)}
                  >All</button>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      className={`btn btn-xs ${activeCategory === cat ? 'btn-active' : ''}`}
                      onClick={() => setActiveCategory(cat)}
                    >{cat}</button>
                  ))}
                </div>
                <div className="ram-library-list">
                  {filteredPatterns.map((entry, i) => (
                    <div
                      key={i}
                      className="ram-library-item"
                      onClick={() => handleSelectPattern(entry)}
                    >
                      <div className="ram-library-item-name">{entry.name}</div>
                      <div className="ram-library-item-desc">{entry.description}</div>
                      {entry.pattern && (
                        <code className="ram-library-item-pattern">/{entry.pattern}/</code>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Preview */}
            {pattern && resolvedValue !== undefined && matchResult && (
              <div className={`ram-preview ${matchResult.matches ? 'ram-preview-pass' : 'ram-preview-fail'}`}>
                <div className="ram-preview-header">
                  <span className={`ram-preview-badge ${matchResult.matches ? 'badge-pass' : 'badge-fail'}`}>
                    {matchResult.valid ? (matchResult.matches ? 'MATCH' : 'NO MATCH') : 'INVALID REGEX'}
                  </span>
                  {!matchResult.valid && 'error' in matchResult && (
                    <span className="ram-preview-error">{matchResult.error}</span>
                  )}
                </div>
                {matchResult.valid && matchResult.matchDetails && (
                  <div className="ram-preview-detail">
                    Matched: <code>"{matchResult.matchDetails[0]}"</code>
                    {matchResult.matchDetails.index !== undefined && (
                      <span> at position {matchResult.matchDetails.index}</span>
                    )}
                  </div>
                )}
                {matchResult.valid && !matchResult.matches && (
                  <div className="ram-preview-detail">
                    Pattern <code>/{pattern}/</code> does not match the resolved value.
                  </div>
                )}
              </div>
            )}

            {/* Hint when no JSON */}
            {!sampleJson.trim() && (
              <div className="ram-hint">
                Paste a sample JSON response on the left to browse fields and preview matches.
              </div>
            )}
          </div>

    </FullPanelModal>
  );
}
