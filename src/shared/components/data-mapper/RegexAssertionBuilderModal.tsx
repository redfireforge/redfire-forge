import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import type { FetchErrorDetail } from './types';
import { buildJsonTree, getAllLeafPaths } from '../../utils/jsonTreeModel';
import FullPanelModal from '../FullPanelModal';
import FetchErrorBanner from './FetchErrorBanner';
import {
  PATTERN_LIBRARY,
  testPattern,
  resolveValue,
  type PatternEntry,
} from '../../../features/requests/components/regexAssertionUtils';
import type { AssertionAdapterResult } from './adapters/assertionAdapter';
import { prettyJson, isValidJson } from '../../utils/helpers';
import { TYPE_LABELS } from './utils/targetTreeHelpers';
import '../../../styles/data-mapper.css';

export type { AssertionAdapterResult };

interface Props {
  initialJsonPath?: string;
  initialPattern?: string;
  sampleJson?: string;
  onFetchSampleResponse?: () => void | Promise<void>;
  fetchingResponse?: boolean;
  fetchError?: FetchErrorDetail | null;
  onSave: (result: AssertionAdapterResult) => void;
  onCancel: () => void;
}

const CATEGORIES = [...new Set(PATTERN_LIBRARY.map(p => p.category))];

function matchesSearch(node: JsonTreeNode, term: string): boolean {
  if (!term) return true;
  const lower = term.toLowerCase();
  if (node.key.toLowerCase().includes(lower)) return true;
  if (node.path.toLowerCase().includes(lower)) return true;
  if (node.type !== 'object' && node.type !== 'array' && String(node.value ?? '').toLowerCase().includes(lower)) return true;
  if (node.children) return node.children.some(c => matchesSearch(c, term));
  return false;
}

interface SelectableTreeNodeProps {
  node: JsonTreeNode;
  depth: number;
  search: string;
  selectedPath: string;
  onSelect: (path: string) => void;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
}

function SelectableTreeNode({
  node, depth, search, selectedPath, onSelect, expandedPaths, onToggle,
}: SelectableTreeNodeProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const isExpanded = expandedPaths.has(node.path || '__root__');
  const isVisible = useMemo(() => matchesSearch(node, search), [node, search]);
  const isLeaf = !hasChildren;
  const isSelected = node.path === selectedPath;

  if (!isVisible) return null;

  const valueStr = isLeaf && node.type !== 'null' ? String(node.value ?? '') : '';
  const truncValue = valueStr.length > 40 ? valueStr.slice(0, 40) + '…' : valueStr;

  return (
    <div className="dm-tree-node-group">
      <div
        className={`dm-tree-node dm-tree-node--source ${isLeaf ? 'dm-tree-node--leaf' : ''} ${isSelected ? 'dm-tree-node--selected' : ''}`}
        style={{ paddingLeft: depth * 16 + 4, cursor: isLeaf ? 'pointer' : undefined }}
        onClick={isLeaf ? () => onSelect(node.path) : undefined}
        data-path={node.path}
        data-testid={isLeaf ? `tree-leaf-${node.path}` : undefined}
      >
        {hasChildren ? (
          <button
            className="dm-tree-toggle"
            onClick={() => onToggle(node.path || '__root__')}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <span className={`dm-chevron ${isExpanded ? 'dm-chevron--open' : ''}`}>▶</span>
          </button>
        ) : (
          <span className="dm-tree-toggle dm-tree-toggle--spacer" />
        )}
        <span className={`dm-type-pill dm-type-pill--${node.type}`}>{TYPE_LABELS[node.type] ?? '?'}</span>
        <span className="dm-node-key">{node.key || '(root)'}</span>
        {isLeaf && truncValue && (
          <span className="dm-node-sample-value" title={valueStr}>{truncValue}</span>
        )}
        {hasChildren && !isExpanded && (
          <span className="dm-node-count">{node.children!.length}</span>
        )}
        {isSelected && <span className="dm-selected-check" title="Selected">✓</span>}
      </div>
      {hasChildren && isExpanded && (
        <div className="dm-tree-children">
          {node.children!.map(child => (
            <SelectableTreeNode
              key={child.path || child.key}
              node={child}
              depth={depth + 1}
              search={search}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RegexAssertionBuilderModal({
  initialJsonPath, initialPattern, sampleJson: externalJson,
  onFetchSampleResponse, fetchingResponse, fetchError,
  onSave, onCancel,
}: Props) {
  const [jsonPath, setJsonPath] = useState(initialJsonPath || '');
  const [pattern, setPattern] = useState(initialPattern || '');
  const [patternName, setPatternName] = useState('');
  const [sampleJson, setSampleJson] = useState(externalJson || '');
  const [treeSearch, setTreeSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showPatternLibrary, setShowPatternLibrary] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['__root__']));
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  const prevExternalRef = useRef(externalJson);
  useEffect(() => {
    if (externalJson !== prevExternalRef.current) {
      setSampleJson(externalJson || '');
    }
    prevExternalRef.current = externalJson;
  }, [externalJson]);

  const { tree, parseError, leafCount } = useMemo(() => {
    if (!sampleJson.trim()) return { tree: null, parseError: null, leafCount: 0 };
    try {
      const obj = JSON.parse(sampleJson);
      const built = buildJsonTree(obj, '', '');
      return { tree: built, parseError: null, leafCount: getAllLeafPaths(built).length };
    } catch (e) {
      return { tree: null, parseError: e instanceof Error ? e.message : 'Invalid JSON', leafCount: 0 };
    }
  }, [sampleJson]);

  const resolvedValue = useMemo(() => resolveValue(sampleJson, jsonPath), [sampleJson, jsonPath]);
  const matchResult = useMemo(() => {
    if (!pattern || resolvedValue === undefined) return null;
    return testPattern(pattern, resolvedValue);
  }, [pattern, resolvedValue]);

  const stripDollar = (p: string) => p.replace(/^\$\.?/, '');

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
    onSave({ jsonPath, pattern, patternName: patternName || undefined });
  };

  const filteredPatterns = activeCategory
    ? PATTERN_LIBRARY.filter(p => p.category === activeCategory)
    : PATTERN_LIBRARY;

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    if (!tree) return;
    const all = new Set<string>();
    const collect = (node: JsonTreeNode) => {
      all.add(node.path || '__root__');
      node.children?.forEach(collect);
    };
    collect(tree);
    setExpandedPaths(all);
  }, [tree]);

  const handleCollapseAll = useCallback(() => {
    setExpandedPaths(new Set(['__root__']));
  }, []);

  const handlePasteSubmit = useCallback(() => {
    const trimmed = pasteText.trim();
    if (!trimmed) { setPasteError('Paste some JSON'); return; }
    try {
      JSON.parse(trimmed);
      setSampleJson(trimmed);
      setPasteError(null);
      setPasteMode(false);
      setPasteText('');
    } catch (e) {
      setPasteError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, [pasteText]);

  const togglePasteMode = useCallback(() => {
    setPasteMode(prev => !prev);
    setPasteError(null);
    if (!pasteMode && sampleJson.trim()) {
      setPasteText(isValidJson(sampleJson) ? prettyJson(sampleJson) : sampleJson);
    }
  }, [pasteMode, sampleJson]);

  useEffect(() => {
    if (tree) handleExpandAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

  return (
    <FullPanelModal
      title="Regex Assertion Builder"
      onClose={onCancel}
      footer={(
        <>
          <button className="btn btn-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-accent"
            onClick={handleApply}
            disabled={!jsonPath || !pattern}
          >
            Apply Assertion
          </button>
        </>
      )}
    >
      {/* Left: JSON Tree with Data Mapper tree nodes */}
      <div className="ram-left">
        <div className="ram-section-title">
          <span>JSON Response</span>
          {tree && <span className="ram-leaf-count">{leafCount} fields</span>}
        </div>

        <div className="dm-panel-actions ram-toolbar">
          <button
            className={`dm-btn-icon ${pasteMode ? 'dm-btn-icon--active' : ''}`}
            onClick={togglePasteMode}
            title={pasteMode ? 'Switch to tree view' : 'Edit JSON'}
          >
            {pasteMode ? '🌳' : '📋'}
          </button>
          {onFetchSampleResponse && (
            <button
              type="button"
              className="dm-btn-icon"
              onClick={() => void onFetchSampleResponse()}
              disabled={fetchingResponse}
              title={fetchingResponse ? 'Fetching...' : 'Fetch Response'}
            >
              {fetchingResponse ? '⏳' : '🔄'}
            </button>
          )}
          {!pasteMode && tree && (
            <>
              <button className="dm-btn-icon" onClick={handleExpandAll} title="Expand all">⊞</button>
              <button className="dm-btn-icon" onClick={handleCollapseAll} title="Collapse all">⊟</button>
            </>
          )}
        </div>

        {fetchError && <FetchErrorBanner error={fetchError} />}

        {pasteMode ? (
          <div className="dm-paste-container">
            <textarea
              className="dm-paste-textarea"
              value={pasteText}
              onChange={e => { setPasteText(e.target.value); setPasteError(null); }}
              placeholder='Paste JSON here, e.g. {"name": "Alice", "age": 30}'
              spellCheck={false}
              data-testid="paste-json"
            />
            {pasteError && <div className="dm-paste-error">{pasteError}</div>}
            <div className="dm-paste-actions">
              <button className="dm-paste-btn dm-paste-btn--apply" onClick={handlePasteSubmit}>Apply</button>
              <button className="dm-paste-btn dm-paste-btn--cancel" onClick={() => { setPasteMode(false); setPasteError(null); }}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {!tree && !parseError && (
              <textarea
                className="body-editor ram-json-textarea"
                value={sampleJson}
                onChange={e => setSampleJson(e.target.value)}
                placeholder="Paste sample JSON response here to browse fields..."
                rows={12}
                data-testid="json-textarea"
              />
            )}
            {parseError && <div className="jpb-error">Parse error: {parseError}</div>}

            {tree && (
              <>
                <div className="dm-search-bar">
                  <input
                    type="text"
                    className="dm-search-input"
                    placeholder="Search fields…"
                    value={treeSearch}
                    onChange={e => setTreeSearch(e.target.value)}
                    data-testid="tree-search"
                  />
                  {treeSearch && (
                    <button className="dm-search-clear" onClick={() => setTreeSearch('')}>×</button>
                  )}
                </div>
                <div className="dm-tree-container ram-tree-container">
                  <SelectableTreeNode
                    node={tree}
                    depth={0}
                    search={treeSearch}
                    selectedPath={stripDollar(jsonPath)}
                    onSelect={handleSelectPath}
                    expandedPaths={expandedPaths}
                    onToggle={handleToggle}
                  />
                </div>
              </>
            )}
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
            onChange={e => setJsonPath(e.target.value)}
            placeholder="$.offers[0].offerName  or  $.offers"
            data-testid="jsonpath-input"
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
              onChange={e => { setPattern(e.target.value); setPatternName(''); }}
              placeholder="e.g. Connected Access"
              data-testid="pattern-input"
            />
            <span className="assertion-regex-slash">/</span>
          </div>
          {patternName && <div className="ram-pattern-name-tag">{patternName}</div>}
        </div>

        {/* Pattern Library */}
        {showPatternLibrary && (
          <div className="ram-library" data-testid="pattern-library">
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
                  data-testid={`pattern-entry-${i}`}
                >
                  <div className="ram-library-item-name">{entry.name}</div>
                  <div className="ram-library-item-desc">{entry.description}</div>
                  {entry.pattern && <code className="ram-library-item-pattern">/{entry.pattern}/</code>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Preview */}
        {pattern && resolvedValue !== undefined && matchResult && (
          <div className={`ram-preview ${matchResult.matches ? 'ram-preview-pass' : 'ram-preview-fail'}`} data-testid="match-preview">
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
                Matched: <code>&quot;{matchResult.matchDetails[0]}&quot;</code>
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

        {!sampleJson.trim() && (
          <div className="ram-hint">
            Paste a sample JSON response on the left to browse fields and preview matches.
          </div>
        )}
      </div>
    </FullPanelModal>
  );
}
