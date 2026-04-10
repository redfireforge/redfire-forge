import { useState, useMemo, useCallback, useEffect, memo, Component } from 'react';
import type { ExpectedField, SelectiveMode } from '../types';
import type { ReactNode, ErrorInfo } from 'react';

interface JsonNode {
  key: string;
  path: string;
  value: unknown;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  children?: JsonNode[];
}

function buildTree(obj: unknown, parentPath: string, parentKey: string): JsonNode {
  if (obj === null || obj === undefined) {
    return { key: parentKey, path: parentPath, value: null, type: 'null' };
  }
  if (Array.isArray(obj)) {
    return {
      key: parentKey,
      path: parentPath,
      value: obj,
      type: 'array',
      children: obj.map((item, i) => buildTree(item, parentPath ? `${parentPath}[${i}]` : `[${i}]`, `[${i}]`)),
    };
  }
  if (typeof obj === 'object') {
    return {
      key: parentKey,
      path: parentPath,
      value: obj,
      type: 'object',
      children: Object.entries(obj as Record<string, unknown>).map(([k, v]) =>
        buildTree(v, parentPath ? `${parentPath}.${k}` : k, k)
      ),
    };
  }
  return {
    key: parentKey,
    path: parentPath,
    value: obj,
    type: typeof obj as 'string' | 'number' | 'boolean',
  };
}

function getAllLeafPaths(node: JsonNode): string[] {
  if (!node.children || node.children.length === 0) return [node.path];
  return node.children.flatMap(getAllLeafPaths);
}

function getAllPaths(node: JsonNode): string[] {
  const paths = [node.path];
  if (node.children) {
    for (const child of node.children) {
      paths.push(...getAllPaths(child));
    }
  }
  return paths.filter(Boolean);
}

function nodeMatchesSearch(node: JsonNode, term: string): boolean {
  try {
    if (!term) return true;
    const lower = term.toLowerCase();
    if ((node.key || '').toLowerCase().includes(lower)) return true;
    if ((node.path || '').toLowerCase().includes(lower)) return true;
    if (node.type !== 'object' && node.type !== 'array' && String(node.value ?? '').toLowerCase().includes(lower)) return true;
    if (node.children) return node.children.some((c) => nodeMatchesSearch(c, term));
  } catch { /* ignore search errors */ }
  return false;
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

interface ErrorBoundaryState { hasError: boolean; error: Error | null }
class TreeErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('JsonPathBuilder tree error:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16, color: '#f87171' }}>
          Tree rendering error. Try clearing the search or re-pasting JSON.
          <button style={{ marginLeft: 8 }} onClick={() => this.setState({ hasError: false, error: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface TreeNodeProps {
  node: JsonNode;
  selectedPaths: Set<string>;
  onToggle: (path: string, allDescendants: string[]) => void;
  depth: number;
  searchTerm: string;
}

const TreeNode = memo(function TreeNode({ node, selectedPaths, onToggle, depth, searchTerm }: TreeNodeProps) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const hasChildren = node.children && node.children.length > 0;

  const matchesSelf = useMemo(() => {
    try {
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      return (node.key || '').toLowerCase().includes(lower)
        || (node.path || '').toLowerCase().includes(lower)
        || (node.type !== 'object' && node.type !== 'array' && String(node.value ?? '').toLowerCase().includes(lower));
    } catch { return false; }
  }, [node, searchTerm]);

  const hasMatchingDescendant = useMemo(() => {
    if (!searchTerm) return true;
    return nodeMatchesSearch(node, searchTerm);
  }, [node, searchTerm]);

  // Auto-expand when search matches a descendant, otherwise use default/manual
  const expanded = useMemo(() => {
    if (searchTerm && hasMatchingDescendant) return true;
    if (manualExpanded !== null) return manualExpanded;
    return depth < 2;
  }, [searchTerm, hasMatchingDescendant, manualExpanded, depth]);

  const allDescendantPaths = useMemo(() => getAllPaths(node).filter(Boolean), [node]);
  const leafPaths = useMemo(() => getAllLeafPaths(node), [node]);

  const allSelected = leafPaths.length > 0 && leafPaths.every((p) => selectedPaths.has(p));
  const someSelected = leafPaths.some((p) => selectedPaths.has(p));
  const isLeaf = !hasChildren;
  const isChecked = isLeaf ? selectedPaths.has(node.path) : allSelected;
  const isIndeterminate = !isLeaf && someSelected && !allSelected;

  const valuePreview = useMemo(() => {
    if (node.type === 'object') return `{ ${node.children?.length || 0} keys }`;
    if (node.type === 'array') return `[ ${node.children?.length || 0} items ]`;
    if (node.type === 'string') return `"${String(node.value).length > 60 ? String(node.value).slice(0, 60) + '...' : node.value}"`;
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

  const isHighlighted = searchTerm && matchesSelf;

  const checkRef = useCallback((el: HTMLInputElement | null) => {
    if (el) el.indeterminate = isIndeterminate;
  }, [isIndeterminate]);

  // Hide nodes that don't match search — MUST be after all hooks
  if (searchTerm && !hasMatchingDescendant) return null;

  return (
    <div className="json-tree-node">
      <div
        className={`json-tree-row ${isChecked ? 'selected' : ''} ${isHighlighted ? 'search-hit' : ''}`}
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        {hasChildren ? (
          <span className="json-tree-toggle" onClick={() => setManualExpanded(!expanded)}>
            {expanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className="json-tree-toggle-spacer" />
        )}

        <input
          type="checkbox"
          className="json-tree-check"
          checked={isChecked}
          ref={checkRef}
          onChange={() => onToggle(node.path, allDescendantPaths)}
        />

        <span className="json-tree-key">{node.key}</span>
        <span className="json-tree-colon">:</span>
        <span className="json-tree-value" style={{ color: typeColor }}>{valuePreview}</span>

        {node.path && (
          <span className="json-tree-path">{node.path}</span>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="json-tree-children">
          {node.children!.map((child, i) => (
            <TreeNode
              key={`${child.path}-${i}`}
              node={child}
              selectedPaths={selectedPaths}
              onToggle={onToggle}
              depth={depth + 1}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
});

function RulesTable({ expectedFields }: { expectedFields: ExpectedField[] }) {
  const { columns, rows } = useMemo(() => {
    // Split each path into row prefix + field name
    const parsed = expectedFields.map((f) => {
      const lastDot = f.jsonPath.lastIndexOf('.');
      if (lastDot === -1) return { rowKey: '(root)', field: f.jsonPath, value: f.expectedValue };
      return { rowKey: f.jsonPath.slice(0, lastDot), field: f.jsonPath.slice(lastDot + 1), value: f.expectedValue };
    });

    const colSet = new Set<string>();
    const rowMap = new Map<string, Map<string, string>>();

    for (const { rowKey, field, value } of parsed) {
      colSet.add(field);
      if (!rowMap.has(rowKey)) rowMap.set(rowKey, new Map());
      rowMap.get(rowKey)!.set(field, value);
    }

    const columns = Array.from(colSet);
    const rows = Array.from(rowMap.entries()).map(([key, fields]) => ({ key, fields }));
    return { columns, rows };
  }, [expectedFields]);

  if (columns.length === 0) return null;

  return (
    <div className="jpb-table-wrapper">
      <table className="jpb-rules-table">
        <thead>
          <tr>
            <th className="jpb-table-row-header">Path</th>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="jpb-table-row-header"><code>{row.key}</code></td>
              {columns.map((col) => {
                const val = row.fields.get(col);
                return (
                  <td key={col}>
                    {val !== undefined ? (
                      <code className="jpb-table-val">{val.length > 40 ? val.slice(0, 40) + '...' : val}</code>
                    ) : (
                      <span className="jpb-table-empty">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ValidationPatch {
  selectiveMode?: SelectiveMode;
  expectedFields?: ExpectedField[];
  excludedPaths?: string[];
}

interface Props {
  sampleJson: string;
  onSampleJsonChange: (json: string) => void;
  selectiveMode: SelectiveMode;
  expectedFields: ExpectedField[];
  excludedPaths: string[];
  onUpdate: (patch: ValidationPatch) => void;
  onFetchSample?: () => void;
  fetchingResponse?: boolean;
  fetchError?: string | null;
}

export default function JsonPathBuilder({
  sampleJson,
  onSampleJsonChange,
  selectiveMode,
  expectedFields,
  excludedPaths,
  onUpdate,
  onFetchSample,
  fetchingResponse,
  fetchError,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 150);
  const [rulesView, setRulesView] = useState<'list' | 'table'>('list');

  const { parsedTree, parseError } = useMemo(() => {
    if (!sampleJson.trim()) return { parsedTree: null, parseError: null };
    try {
      const obj = JSON.parse(sampleJson);
      return { parsedTree: buildTree(obj, '', '(root)'), parseError: null };
    } catch (e) {
      return { parsedTree: null, parseError: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [sampleJson]);

  // For include mode: selected paths are the expectedFields jsonPaths
  // For exclude mode: selected paths are the excludedPaths
  const selectedPaths = useMemo(() => {
    if (selectiveMode === 'include') {
      return new Set(expectedFields.map((f) => f.jsonPath));
    }
    return new Set(excludedPaths);
  }, [selectiveMode, expectedFields, excludedPaths]);

  const getValueAtPath = useCallback((path: string): string => {
    if (!sampleJson.trim()) return '';
    try {
      const obj = JSON.parse(sampleJson);
      const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
      let current: unknown = obj;
      for (const part of parts) {
        if (current == null || typeof current !== 'object') return '';
        current = (current as Record<string, unknown>)[part];
      }
      return JSON.stringify(current);
    } catch {
      return '';
    }
  }, [sampleJson]);

  const handleToggle = useCallback((path: string, allDescendants: string[]) => {
    if (!parsedTree) return;

    function findLeafPaths(node: JsonNode): string[] {
      if (!node.children || node.children.length === 0) return [node.path];
      return node.children.flatMap(findLeafPaths);
    }

    function findNode(node: JsonNode, targetPath: string): JsonNode | null {
      if (node.path === targetPath) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, targetPath);
          if (found) return found;
        }
      }
      return null;
    }

    const targetNode = findNode(parsedTree, path);
    const leafPaths = targetNode ? findLeafPaths(targetNode) : [path];

    if (selectiveMode === 'include') {
      const currentPaths = new Set(expectedFields.map((f) => f.jsonPath));
      const allLeafSelected = leafPaths.every((p) => currentPaths.has(p));

      let newFields: ExpectedField[];
      if (allLeafSelected) {
        const toRemove = new Set(leafPaths);
        newFields = expectedFields.filter((f) => !toRemove.has(f.jsonPath));
      } else {
        newFields = [...expectedFields];
        for (const lp of leafPaths) {
          if (!currentPaths.has(lp)) {
            newFields.push({ jsonPath: lp, expectedValue: getValueAtPath(lp) });
          }
        }
      }
      onUpdate({ expectedFields: newFields });
    } else {
      const currentExcluded = new Set(excludedPaths);
      const allDescendantSet = new Set(allDescendants.filter(Boolean));
      const allExcluded = leafPaths.every((p) => currentExcluded.has(p));

      let newExcluded: string[];
      if (allExcluded) {
        newExcluded = excludedPaths.filter((p) => !allDescendantSet.has(p));
      } else {
        const combined = new Set([...excludedPaths, ...leafPaths]);
        newExcluded = Array.from(combined);
      }

      const allLeaves = getAllLeafPaths(parsedTree);
      const excludedSet = new Set(newExcluded);
      const fields = allLeaves
        .filter((p) => !excludedSet.has(p))
        .map((p) => ({ jsonPath: p, expectedValue: getValueAtPath(p) }));

      onUpdate({ excludedPaths: newExcluded, expectedFields: fields });
    }
  }, [parsedTree, selectiveMode, expectedFields, excludedPaths, getValueAtPath, onUpdate]);

  const selectAll = () => {
    if (!parsedTree) return;
    const allLeaves = getAllLeafPaths(parsedTree);
    if (selectiveMode === 'include') {
      onUpdate({ expectedFields: allLeaves.map((p) => ({ jsonPath: p, expectedValue: getValueAtPath(p) })) });
    } else {
      onUpdate({ excludedPaths: allLeaves, expectedFields: [] });
    }
  };

  const deselectAll = () => {
    if (!parsedTree) return;
    const allLeaves = getAllLeafPaths(parsedTree);
    if (selectiveMode === 'include') {
      onUpdate({ expectedFields: [] });
    } else {
      onUpdate({ excludedPaths: [], expectedFields: allLeaves.map((p) => ({ jsonPath: p, expectedValue: getValueAtPath(p) })) });
    }
  };

  const leafCount = useMemo(() => parsedTree ? getAllLeafPaths(parsedTree).length : 0, [parsedTree]);

  // Leaf paths that match the current search
  const matchedLeafPaths = useMemo(() => {
    if (!parsedTree || !debouncedSearch) return [];
    const allLeaves = getAllLeafPaths(parsedTree);
    return allLeaves.filter((p) => {
      const lower = debouncedSearch.toLowerCase();
      return p.toLowerCase().includes(lower);
    });
  }, [parsedTree, debouncedSearch]);

  const selectMatched = () => {
    if (!parsedTree || matchedLeafPaths.length === 0) return;
    if (selectiveMode === 'include') {
      const currentPaths = new Set(expectedFields.map((f) => f.jsonPath));
      const newFields = [...expectedFields];
      for (const p of matchedLeafPaths) {
        if (!currentPaths.has(p)) {
          newFields.push({ jsonPath: p, expectedValue: getValueAtPath(p) });
        }
      }
      onUpdate({ expectedFields: newFields });
    } else {
      const combined = new Set([...excludedPaths, ...matchedLeafPaths]);
      const newExcluded = Array.from(combined);
      const excludedSet = new Set(newExcluded);
      const allLeaves = getAllLeafPaths(parsedTree);
      const fields = allLeaves.filter((p) => !excludedSet.has(p)).map((p) => ({ jsonPath: p, expectedValue: getValueAtPath(p) }));
      onUpdate({ excludedPaths: newExcluded, expectedFields: fields });
    }
  };

  const deselectMatched = () => {
    if (!parsedTree || matchedLeafPaths.length === 0) return;
    const toRemove = new Set(matchedLeafPaths);
    if (selectiveMode === 'include') {
      onUpdate({ expectedFields: expectedFields.filter((f) => !toRemove.has(f.jsonPath)) });
    } else {
      const newExcluded = excludedPaths.filter((p) => !toRemove.has(p));
      const excludedSet = new Set(newExcluded);
      const allLeaves = getAllLeafPaths(parsedTree);
      const fields = allLeaves.filter((p) => !excludedSet.has(p)).map((p) => ({ jsonPath: p, expectedValue: getValueAtPath(p) }));
      onUpdate({ excludedPaths: newExcluded, expectedFields: fields });
    }
  };

  return (
    <div className="json-path-builder">
      {/* Two-column layout: sample JSON on left, tree selector on right */}
      <div className={`jpb-columns ${parsedTree ? '' : 'jpb-single-column'}`}>
        {/* Left column: Sample JSON */}
        <div className="jpb-left">
          <div className="jpb-sample-header">
            <label>Paste a sample JSON response</label>
            <div className="jpb-sample-actions">
              {onFetchSample && (
                <button
                  className="btn btn-sm btn-accent"
                  onClick={onFetchSample}
                  disabled={fetchingResponse}
                >
                  {fetchingResponse ? 'Fetching...' : 'Fetch Response'}
                </button>
              )}
              {sampleJson.trim() && (
                <button className="btn btn-sm" onClick={() => {
                  try { onSampleJsonChange(JSON.stringify(JSON.parse(sampleJson), null, 2)); } catch {}
                }}>Prettify</button>
              )}
            </div>
          </div>
          <textarea
            className="body-editor jpb-textarea"
            value={sampleJson}
            onChange={(e) => onSampleJsonChange(e.target.value)}
            placeholder='Paste JSON here, or click "Fetch Response" to auto-populate from your API'
          />
          {parseError && <div className="jpb-error">Parse error: {parseError}</div>}
          {fetchError && <div className="jpb-error">Fetch error: {fetchError}</div>}
        </div>

        {/* Right column: Selection tree */}
        {parsedTree && (
          <div className="jpb-right">
            <div className="jpb-controls">
              <div className="jpb-bulk-actions">
                <button className="btn btn-sm" onClick={selectAll}>Select All</button>
                <button className="btn btn-sm" onClick={deselectAll}>Deselect All</button>
              </div>
              <span className="jpb-stats">
                {selectedPaths.size} / {leafCount} fields selected
              </span>
            </div>

            <div className="jpb-mode-hint">
              Check fields you want to validate. Only checked fields will be compared.
            </div>

            <div className="jpb-search">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search fields..."
              />
              {debouncedSearch && matchedLeafPaths.length > 0 && (
                <div className="jpb-search-actions">
                  <button className="btn btn-sm btn-accent" onClick={selectMatched}>
                    Select Matched ({matchedLeafPaths.length})
                  </button>
                  <button className="btn btn-sm" onClick={deselectMatched}>
                    Deselect Matched
                  </button>
                </div>
              )}
            </div>

            <div className="json-tree-container">
              <TreeErrorBoundary>
                <TreeNode
                  node={parsedTree}
                  selectedPaths={selectedPaths}
                  onToggle={handleToggle}
                  depth={0}
                  searchTerm={debouncedSearch}
                />
              </TreeErrorBoundary>
            </div>
          </div>
        )}
      </div>

      {/* Generated rules (full width below) */}
      {parsedTree && (
        <>
          <div className="jpb-summary">
            <div className="kv-header">
              <div className="kv-header-left">
                <span>GENERATED VALIDATION RULES ({expectedFields.length})</span>
                {expectedFields.length > 0 && (
                  <div className="jpb-view-toggle">
                    <button className={`btn btn-xs ${rulesView === 'list' ? 'btn-active' : ''}`} onClick={() => setRulesView('list')}>List</button>
                    <button className={`btn btn-xs ${rulesView === 'table' ? 'btn-active' : ''}`} onClick={() => setRulesView('table')}>Table</button>
                  </div>
                )}
              </div>
            </div>
            {expectedFields.length === 0 && (
              <div className="empty-hint">
                {selectiveMode === 'include'
                  ? 'Click fields in the tree above to add validation rules.'
                  : 'All fields are currently excluded.'}
              </div>
            )}

            {/* List view */}
            {expectedFields.length > 0 && rulesView === 'list' && (
              <div className="jpb-field-list">
                {expectedFields.slice(0, 50).map((f, i) => (
                  <div key={i} className="jpb-field-row">
                    <code className="jpb-field-path">{f.jsonPath}</code>
                    <span className="jpb-field-eq">=</span>
                    <code className="jpb-field-value">{f.expectedValue.length > 80 ? f.expectedValue.slice(0, 80) + '...' : f.expectedValue}</code>
                    {selectiveMode === 'include' && (
                      <button className="btn btn-sm btn-danger" onClick={() => {
                        onUpdate({ expectedFields: expectedFields.filter((_, j) => j !== i) });
                      }}>×</button>
                    )}
                  </div>
                ))}
                {expectedFields.length > 50 && (
                  <div className="empty-hint">...and {expectedFields.length - 50} more</div>
                )}
              </div>
            )}

            {/* Table view */}
            {expectedFields.length > 0 && rulesView === 'table' && (
              <RulesTable expectedFields={expectedFields} />
            )}

            {selectiveMode === 'include' && (
              <div className="jpb-manual-add">
                <button className="btn btn-sm" onClick={() => {
                  onUpdate({ expectedFields: [...expectedFields, { jsonPath: '', expectedValue: '' }] });
                }}>+ Add Manual Rule</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Fallback: manual fields when no sample JSON */}
      {!parsedTree && !sampleJson.trim() && (
        <div className="jpb-manual-fallback">
          <div className="kv-header"><span>VALIDATION RULES (manual)</span></div>
          {expectedFields.map((f, i) => (
            <div key={i} className="kv-row">
              <input
                value={f.jsonPath}
                onChange={(e) => {
                  const next = [...expectedFields];
                  next[i] = { ...next[i], jsonPath: e.target.value };
                  onUpdate({ expectedFields: next });
                }}
                placeholder="JSON Path (e.g. data.id)"
              />
              <input
                value={f.expectedValue}
                onChange={(e) => {
                  const next = [...expectedFields];
                  next[i] = { ...next[i], expectedValue: e.target.value };
                  onUpdate({ expectedFields: next });
                }}
                placeholder="Expected value"
              />
              <button className="btn btn-sm btn-danger" onClick={() => {
                onUpdate({ expectedFields: expectedFields.filter((_, j) => j !== i) });
              }}>×</button>
            </div>
          ))}
          <button className="btn btn-sm" onClick={() => {
            onUpdate({ expectedFields: [...expectedFields, { jsonPath: '', expectedValue: '' }] });
          }}>+ Add Field</button>
        </div>
      )}
    </div>
  );
}
