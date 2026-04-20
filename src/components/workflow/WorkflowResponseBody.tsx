import { memo, useMemo, useState, useEffect } from 'react';
import type { JsonNode } from '../../utils/jsonPathTreeUtils';
import { buildTree, getAllLeafPaths, nodeMatchesSearch } from '../../utils/jsonPathTreeUtils';

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Escape HTML then highlight case-insensitive matches (for request / meta block). */
function highlightPlainText(text: string, term: string): string {
  const esc = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const t = term.trim();
  if (!t) return esc;
  try {
    const re = new RegExp(`(${escapeRegExp(t)})`, 'gi');
    return esc.replace(re, '<mark class="wf-resp-search-hit">$1</mark>');
  } catch {
    return esc;
  }
}

export function splitWorkflowResponseDetail(body: string): { meta: string; jsonText: string | null } {
  const marker = '\nResponse body:\n';
  const i = body.indexOf(marker);
  if (i === -1) return { meta: body, jsonText: null };
  return {
    meta: body.slice(0, i).trimEnd(),
    jsonText: body.slice(i + marker.length).trim(),
  };
}

const ReadOnlyTreeNode = memo(function ReadOnlyTreeNode({
  node,
  depth,
  searchTerm,
}: {
  node: JsonNode;
  depth: number;
  searchTerm: string;
}) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const hasChildren = node.children && node.children.length > 0;

  const matchesSelf = useMemo(() => {
    try {
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      return (
        (node.key || '').toLowerCase().includes(lower) ||
        (node.path || '').toLowerCase().includes(lower) ||
        (node.type !== 'object' &&
          node.type !== 'array' &&
          String(node.value ?? '')
            .toLowerCase()
            .includes(lower))
      );
    } catch {
      return false;
    }
  }, [node, searchTerm]);

  const hasMatchingDescendant = useMemo(
    () => !searchTerm || nodeMatchesSearch(node, searchTerm),
    [node, searchTerm],
  );

  const expanded = useMemo(() => {
    if (searchTerm && hasMatchingDescendant) return true;
    if (manualExpanded !== null) return manualExpanded;
    return depth < 2;
  }, [searchTerm, hasMatchingDescendant, manualExpanded, depth]);

  const valuePreview = useMemo(() => {
    if (node.type === 'object') return `{ ${node.children?.length || 0} keys }`;
    if (node.type === 'array') return `[ ${node.children?.length || 0} items ]`;
    if (node.type === 'string')
      return `"${String(node.value).length > 80 ? String(node.value).slice(0, 80) + '…' : node.value}"`;
    if (node.type === 'null') return 'null';
    return String(node.value);
  }, [node]);

  const typeColor = useMemo(() => {
    switch (node.type) {
      case 'string':
        return '#22c55e';
      case 'number':
        return '#3b82f6';
      case 'boolean':
        return '#f59e0b';
      case 'null':
        return '#94a3b8';
      default:
        return 'var(--text-muted)';
    }
  }, [node.type]);

  const isHighlighted = !!(searchTerm && matchesSelf);

  if (searchTerm && !hasMatchingDescendant) return null;

  return (
    <div className="json-tree-node">
      <div
        className={`json-tree-row ${isHighlighted ? 'search-hit' : ''}`}
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        {hasChildren ? (
          <span
            className="json-tree-toggle"
            role="button"
            tabIndex={0}
            onClick={() => setManualExpanded(!expanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setManualExpanded(!expanded);
              }
            }}
          >
            {expanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className="json-tree-toggle-spacer" />
        )}
        <span className="json-tree-readonly-spacer" aria-hidden />
        <span className="json-tree-key">{node.key}</span>
        <span className="json-tree-colon">:</span>
        <span className="json-tree-value" style={{ color: typeColor }}>
          {valuePreview}
        </span>
        {node.path && <span className="json-tree-path">{node.path}</span>}
      </div>
      {hasChildren && expanded && (
        <div className="json-tree-children">
          {node.children!.map((child, idx) => (
            <ReadOnlyTreeNode
              key={`${child.path}-${idx}`}
              node={child}
              depth={depth + 1}
              searchTerm={searchTerm}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/** Count leaf nodes that match search (paths + values), same rules as Validation JSON tree. */
function countLeafMatchesInTree(root: JsonNode, term: string): number {
  if (!term.trim()) return getAllLeafPaths(root).length;
  let c = 0;
  function walk(nd: JsonNode): void {
    const isLeaf = !nd.children?.length;
    if (isLeaf) {
      if (nodeMatchesSearch(nd, term)) c += 1;
    } else {
      nd.children!.forEach(walk);
    }
  }
  walk(root);
  return c;
}

interface Props {
  body: string;
}

export default function WorkflowResponseBody({ body }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);

  const { meta, jsonText } = useMemo(() => splitWorkflowResponseDetail(body), [body]);

  const parsedTree = useMemo(() => {
    if (!jsonText?.trim()) return { tree: null as JsonNode | null, parseError: null as string | null };
    try {
      const obj = JSON.parse(jsonText);
      return { tree: buildTree(obj, '', '(root)'), parseError: null };
    } catch (e) {
      return {
        tree: null,
        parseError: e instanceof Error ? e.message : 'Invalid JSON',
      };
    }
  }, [jsonText]);

  const matchSummary = useMemo(() => {
    const t = debouncedSearch.trim();
    if (!t) return null;
    let n = 0;
    try {
      const re = new RegExp(escapeRegExp(t), 'gi');
      const metaMatches = meta.match(re);
      n += metaMatches?.length ?? 0;
    } catch {
      /* ignore */
    }
    if (parsedTree.tree) {
      n += countLeafMatchesInTree(parsedTree.tree, t);
    } else if (jsonText) {
      try {
        const re = new RegExp(escapeRegExp(t), 'gi');
        const jm = jsonText.match(re);
        n += jm?.length ?? 0;
      } catch {
        /* ignore */
      }
    }
    return n;
  }, [debouncedSearch, meta, parsedTree, jsonText]);

  const metaHtml = useMemo(
    () => ({ __html: highlightPlainText(meta, debouncedSearch) }),
    [meta, debouncedSearch],
  );

  const fallbackBodyHtml = useMemo(
    () => ({ __html: highlightPlainText(body, debouncedSearch) }),
    [body, debouncedSearch],
  );

  const rawJsonHighlighted = useMemo(() => {
    if (!jsonText || !parsedTree.parseError) return null;
    return { __html: highlightPlainText(jsonText, debouncedSearch) };
  }, [jsonText, parsedTree.parseError, debouncedSearch]);

  return (
    <div className="wf-resp-body">
      <div className="wf-resp-toolbar">
        <input
          type="search"
          className="results-search wf-resp-search-input"
          placeholder="Search response, keys, paths, values…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSearchTerm('');
          }}
          aria-label="Search response"
        />
        {debouncedSearch.trim() ? (
          <span className="wf-resp-search-count" aria-live="polite">
            {matchSummary !== null ? `${matchSummary} match${matchSummary === 1 ? '' : 'es'}` : '—'}
          </span>
        ) : (
          <span className="wf-resp-search-hint">Same idea as Results → search; filters JSON tree paths.</span>
        )}
      </div>

      {jsonText === null ? (
        <div
          className="wf-resp-meta wf-resp-meta--only"
          dangerouslySetInnerHTML={fallbackBodyHtml}
        />
      ) : (
        <>
          <div className="wf-resp-section">
            <div className="wf-resp-section-label">Request &amp; validation</div>
            <div className="wf-resp-meta" dangerouslySetInnerHTML={metaHtml} />
          </div>
          <div className="wf-resp-section">
            <div className="wf-resp-section-label">Response body</div>
            {parsedTree.tree ? (
              <div className="json-tree-container wf-resp-json-tree">
                <ReadOnlyTreeNode node={parsedTree.tree} depth={0} searchTerm={debouncedSearch} />
              </div>
            ) : (
              <>
                {rawJsonHighlighted ? (
                  <pre className="wf-resp-raw-fallback" dangerouslySetInnerHTML={rawJsonHighlighted} />
                ) : (
                  <pre className="wf-resp-raw-fallback">{jsonText}</pre>
                )}
                {parsedTree.parseError && (
                  <p className="wf-resp-parse-note" role="note">
                    Could not parse as JSON ({parsedTree.parseError}). Showing raw text with search highlight.
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
