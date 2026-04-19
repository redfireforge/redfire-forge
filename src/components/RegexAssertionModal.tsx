import { useState, useMemo, useCallback, memo } from 'react';
import { buildTree, getAllLeafPaths, nodeMatchesSearch } from '../utils/jsonPathTreeUtils';
import type { JsonNode } from '../utils/jsonPathTreeUtils';

export interface RegexAssertionResult {
  jsonPath: string;
  pattern: string;
  patternName?: string;
}

interface Props {
  initialJsonPath?: string;
  initialPattern?: string;
  sampleJson?: string;
  onApply: (result: RegexAssertionResult) => void;
  onClose: () => void;
}

/* ── Pattern Library ────────────────────────────────── */

interface PatternEntry {
  name: string;
  pattern: string;
  description: string;
  category: string;
}

export const PATTERN_LIBRARY: PatternEntry[] = [
  // Text
  { name: 'Contains text',        pattern: '',                      description: 'Matches if the value contains the given text (fill in after selecting)',  category: 'Text' },
  { name: 'Starts with',          pattern: '^',                     description: 'Value starts with a prefix (append your text)',                           category: 'Text' },
  { name: 'Ends with',            pattern: '$',                     description: 'Value ends with a suffix (prepend your text before $)',                    category: 'Text' },
  { name: 'Exact match',          pattern: '^your_value$',          description: 'Exact string equality',                                                   category: 'Text' },
  { name: 'Not empty',            pattern: '.+',                    description: 'At least one character',                                                  category: 'Text' },
  // Identifiers
  { name: 'UUID v4',              pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', description: 'Standard UUID v4 format', category: 'Identifiers' },
  { name: 'Numeric ID',           pattern: '^\\d+$',                description: 'Integer-only ID',                                                        category: 'Identifiers' },
  { name: 'Alphanumeric code',    pattern: '^[A-Za-z0-9]+$',       description: 'Letters and digits only',                                                 category: 'Identifiers' },
  // Formats
  { name: 'Email address',        pattern: '^[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}$', description: 'Basic email format',                                       category: 'Formats' },
  { name: 'URL (http/https)',     pattern: '^https?://',            description: 'Starts with http:// or https://',                                         category: 'Formats' },
  { name: 'ISO date (YYYY-MM-DD)',pattern: '^\\d{4}-\\d{2}-\\d{2}', description: 'Date in ISO format',                                                     category: 'Formats' },
  { name: 'ISO datetime',         pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}', description: 'ISO 8601 datetime',                                        category: 'Formats' },
  { name: 'Phone (US)',           pattern: '^\\+?1?[-.\\s]?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}$', description: 'US phone number',                    category: 'Formats' },
  // Numbers
  { name: 'Positive integer',     pattern: '^[1-9]\\d*$',          description: 'Greater than zero, no decimals',                                          category: 'Numbers' },
  { name: 'Decimal number',       pattern: '^-?\\d+\\.\\d+$',      description: 'Has decimal point',                                                       category: 'Numbers' },
  { name: 'Boolean (true/false)', pattern: '^(true|false)$',        description: 'Literal true or false',                                                   category: 'Numbers' },
  // Arrays (serialized)
  { name: 'Array contains value', pattern: '',                      description: 'Checks if serialized array contains text (fill in value)',                 category: 'Arrays' },
  { name: 'Array is non-empty',   pattern: '^\\[.+\\]$',           description: 'Serialized array with at least one element',                              category: 'Arrays' },
];

const CATEGORIES = [...new Set(PATTERN_LIBRARY.map(p => p.category))];

/* ── Tree Node (click-to-select, no checkboxes) ────── */

interface PickerNodeProps {
  node: JsonNode;
  depth: number;
  selectedPath: string;
  onSelect: (path: string) => void;
  searchTerm: string;
}

const PickerNode = memo(function PickerNode({ node, depth, selectedPath, onSelect, searchTerm }: PickerNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
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
    return expanded;
  }, [searchTerm, hasMatchingDescendant, expanded]);

  const valuePreview = useMemo(() => {
    if (node.type === 'object') return `{ ${node.children?.length || 0} keys }`;
    if (node.type === 'array') return `[ ${node.children?.length || 0} items ]`;
    if (node.type === 'string') {
      const s = String(node.value);
      return `"${s.length > 50 ? s.slice(0, 50) + '...' : s}"`;
    }
    if (node.type === 'null') return 'null';
    return String(node.value);
  }, [node]);

  const typeColor = useMemo(() => {
    switch (node.type) {
      case 'string': return '#22c55e';
      case 'number': return '#3b82f6';
      case 'boolean': return '#f59e0b';
      case 'null': return '#94a3b8';
      default: return 'var(--text-muted)';
    }
  }, [node.type]);

  if (searchTerm && !hasMatchingDescendant) return null;

  const isSelected = node.path === selectedPath;
  const isHighlighted = searchTerm && matchesSelf;

  return (
    <div className="ram-tree-node">
      <div
        className={`ram-tree-row ${isSelected ? 'ram-tree-selected' : ''} ${isHighlighted ? 'search-hit' : ''}`}
        style={{ paddingLeft: depth * 18 + 8 }}
        onClick={() => { if (node.path) onSelect(node.path); }}
      >
        {hasChildren ? (
          <span
            className="json-tree-toggle"
            onClick={(e) => { e.stopPropagation(); setExpanded(!effectiveExpanded); }}
          >
            {effectiveExpanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className="json-tree-toggle-spacer" />
        )}
        <span className="json-tree-key">{node.key}</span>
        <span className="json-tree-colon">:</span>
        <span className="json-tree-value" style={{ color: typeColor }}>{valuePreview}</span>
        {node.path && <span className="json-tree-path">{node.path}</span>}
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
            />
          ))}
        </div>
      )}
    </div>
  );
});

/* ── Value resolver ─────────────────────────────────── */

export function resolveValue(json: string, path: string): string | undefined {
  if (!json || !path) return undefined;
  try {
    const obj = JSON.parse(json);
    const normalized = path.replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1');
    const parts = normalized.split('.').filter(Boolean);
    let current: unknown = obj;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    if (current === undefined) return undefined;
    return typeof current === 'string' ? current : JSON.stringify(current);
  } catch {
    return undefined;
  }
}

/* ── Main Modal ─────────────────────────────────────── */

export default function RegexAssertionModal({ initialJsonPath, initialPattern, sampleJson: externalJson, onApply, onClose }: Props) {
  const [jsonPath, setJsonPath] = useState(initialJsonPath || '');
  const [pattern, setPattern] = useState(initialPattern || '');
  const [patternName, setPatternName] = useState('');
  const [sampleJson, setSampleJson] = useState(externalJson || '');
  const [treeSearch, setTreeSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showPatternLibrary, setShowPatternLibrary] = useState(false);

  const { parsedTree, parseError } = useMemo(() => {
    if (!sampleJson.trim()) return { parsedTree: null, parseError: null };
    try {
      const obj = JSON.parse(sampleJson);
      return { parsedTree: buildTree(obj, '', '(root)'), parseError: null };
    } catch (e) {
      return { parsedTree: null, parseError: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [sampleJson]);

  const leafCount = useMemo(() => parsedTree ? getAllLeafPaths(parsedTree).length : 0, [parsedTree]);

  const resolvedValue = useMemo(() => resolveValue(sampleJson, jsonPath), [sampleJson, jsonPath]);

  const matchResult = useMemo(() => {
    if (!pattern || resolvedValue === undefined) return null;
    try {
      const re = new RegExp(pattern);
      const matches = re.test(resolvedValue);
      const matchDetails = resolvedValue.match(re);
      return { valid: true, matches, matchDetails };
    } catch (e) {
      return { valid: false, matches: false, error: e instanceof Error ? e.message : 'Invalid regex' };
    }
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
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal ram-modal">
        {/* Header */}
        <div className="ram-header">
          <h3>Regex Assertion Builder</h3>
          <button className="btn btn-xs" onClick={onClose}>×</button>
        </div>

        <div className="ram-body">
          {/* Left: JSON Tree picker */}
          <div className="ram-left">
            <div className="ram-section-title">
              <span>JSON Response</span>
              {parsedTree && <span className="ram-leaf-count">{leafCount} fields</span>}
            </div>

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
        </div>

        {/* Footer */}
        <div className="ram-footer">
          <button className="btn btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-accent"
            onClick={handleApply}
            disabled={!jsonPath || !pattern}
          >
            Apply Assertion
          </button>
        </div>
      </div>
    </div>
  );
}
