import { useMemo, useRef, useEffect } from 'react';
import type { ReactNode, RefObject } from 'react';
import { ChevronIcon } from '../../../shared/components/jsonTreeShared';

export interface JNode {
  key: string;
  value: unknown;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  children?: JNode[];
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildJTree(val: unknown, key: string): JNode {
  if (val === null || val === undefined) return { key, value: null, type: 'null' };
  if (Array.isArray(val)) return { key, value: val, type: 'array', children: val.map((v, i) => buildJTree(v, String(i))) };
  if (typeof val === 'object') return { key, value: val, type: 'object', children: Object.entries(val as Record<string, unknown>).map(([k, v]) => buildJTree(v, k)) };
  return { key, value: val, type: typeof val as 'string' | 'number' | 'boolean' };
}

// eslint-disable-next-line react-refresh/only-export-components
export function nodeMatches(node: JNode, term: string): boolean {
  if (!term) return false;
  const lower = term.toLowerCase();
  if (node.key.toLowerCase().includes(lower)) return true;
  if (node.type !== 'object' && node.type !== 'array' && String(node.value ?? '').toLowerCase().includes(lower)) return true;
  return (node.children ?? []).some(c => nodeMatches(c, term));
}

// eslint-disable-next-line react-refresh/only-export-components
export function collectMatchNodes(node: JNode, term: string, results: JNode[]): void {
  if (!term) return;
  const lower = term.toLowerCase();
  const selfMatch = node.key.toLowerCase().includes(lower) ||
    (node.type !== 'object' && node.type !== 'array' && String(node.value ?? '').toLowerCase().includes(lower));
  if (selfMatch) results.push(node);
  (node.children ?? []).forEach(c => collectMatchNodes(c, term, results));
}

/** Like collectMatchNodes but also records each match's tree path (for ancestor expansion). */
function collectMatchNodesWithPaths(
  node: JNode, term: string, results: { node: JNode; path: string }[], currentPath = '',
): void {
  if (!term) return;
  const lower = term.toLowerCase();
  const selfMatch = node.key.toLowerCase().includes(lower) ||
    (node.type !== 'object' && node.type !== 'array' && String(node.value ?? '').toLowerCase().includes(lower));
  if (selfMatch) results.push({ node, path: currentPath });
  (node.children ?? []).forEach(c =>
    collectMatchNodesWithPaths(c, term, results, `${currentPath}/${c.key}`),
  );
}

/** Compute all ancestor paths for a given tree path (e.g. "/a/b/c" → {"", "/a", "/a/b", "/a/b/c"}). */
function getAncestorPaths(path: string): Set<string> {
  const set = new Set<string>();
  const segments = path.split('/');
  let p = '';
  set.add(p); // root
  for (let i = 1; i < segments.length; i++) {
    p += '/' + segments[i];
    set.add(p);
  }
  return set;
}

function highlightSearch(text: string, search: string): ReactNode {
  if (!search) return text;
  const lower = text.toLowerCase();
  const term = search.toLowerCase();
  const parts: ReactNode[] = [];
  let last = 0;
  let idx = lower.indexOf(term, last);
  while (idx !== -1) {
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(<mark key={idx} className="req-search-highlight">{text.slice(idx, idx + search.length)}</mark>);
    last = idx + search.length;
    idx = lower.indexOf(term, last);
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 0 ? <>{parts}</> : text;
}

function JsonTreeNode({ node, depth, search, activeMatchNode, activeMatchRef, collapsedSet, onToggle, path }: {
  node: JNode; depth: number; search: string;
  activeMatchNode: JNode | null; activeMatchRef: RefObject<HTMLDivElement | null>;
  collapsedSet: Set<string>; onToggle: (path: string) => void; path: string;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const hasMatchDescendant = useMemo(() => search ? nodeMatches(node, search) : false, [node, search]);

  // User's explicit collapse (collapsedSet) always wins.
  // When search is active, auto-expand nodes with matching descendants (unless user collapsed).
  const expanded = !collapsedSet.has(path) && (!search || hasMatchDescendant);

  const lower = search?.toLowerCase() ?? '';
  const keyMatch = lower && node.key.toLowerCase().includes(lower);
  const valStr = node.type !== 'object' && node.type !== 'array' ? String(node.value ?? '') : '';
  const valMatch = lower && valStr.toLowerCase().includes(lower);
  const isSelfMatch = keyMatch || valMatch;
  const isActiveMatch = activeMatchNode === node;

  const renderValue = () => {
    if (node.type === 'object') return <span className="jt-bracket">{expanded ? '{' : `{ ${node.children?.length ?? 0} }`}</span>;
    if (node.type === 'array') return <span className="jt-bracket">{expanded ? '[' : `[ ${node.children?.length ?? 0} ]`}</span>;
    if (node.type === 'string') {
      const txt = `"${node.value}"`;
      return <span className="jt-str">{search ? highlightSearch(txt, search) : txt}</span>;
    }
    if (node.type === 'number') return <span className="jt-num">{search ? highlightSearch(valStr, search) : valStr}</span>;
    if (node.type === 'boolean') return <span className="jt-bool">{valStr}</span>;
    return <span className="jt-null">null</span>;
  };

  const closingBracket = hasChildren && expanded ? (node.type === 'array' ? ']' : '}') : null;

  return (
    <div>
      <div
        ref={isActiveMatch ? activeMatchRef : undefined}
        className={`jt-row ${isActiveMatch ? 'jt-active-match' : isSelfMatch ? 'jt-match' : ''}`}
        style={{ paddingLeft: depth * 18 }}
      >
        {hasChildren ? (
          <span className={`jt-toggle ${expanded ? '' : 'jt-toggle--collapsed'}`} onClick={() => onToggle(path)}>
            <ChevronIcon />
          </span>
        ) : (
          <span className="jt-toggle-spacer" />
        )}
        {depth > 0 && (
          <span className={`jt-key ${keyMatch ? 'jt-key-match' : ''}`}>
            {search ? highlightSearch(`"${node.key}"`, search) : `"${node.key}"`}
          </span>
        )}
        {depth > 0 && <span className="jt-colon">: </span>}
        {renderValue()}
        {!hasChildren && <span className="jt-comma">,</span>}
      </div>
      {hasChildren && expanded && (
        <div className="jt-children">
          {node.children!.map((child, i) => (
            <JsonTreeNode key={`${child.key}-${i}`} node={child} depth={depth + 1}
              search={search} activeMatchNode={activeMatchNode} activeMatchRef={activeMatchRef}
              collapsedSet={collapsedSet} onToggle={onToggle} path={`${path}/${child.key}`} />
          ))}
          <div className="jt-row" style={{ paddingLeft: depth * 18 }}>
            <span className="jt-toggle-spacer" />
            <span className="jt-bracket">{closingBracket}</span>
            <span className="jt-comma">,</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function JsonPreview({ body, error, search, currentMatchIdx = 0, onMatchCountChange, collapsedSet, onToggle, prebuiltTree }: {
  body: string; error?: string; search?: string;
  currentMatchIdx?: number;
  onMatchCountChange?: (count: number) => void;
  collapsedSet: Set<string>; onToggle: (path: string) => void;
  prebuiltTree?: JNode | null;
}) {
  const activeMatchRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => {
    if (prebuiltTree !== undefined) return prebuiltTree;
    if (error || !body) return null;
    try { return buildJTree(JSON.parse(body), ''); } catch { return null; }
  }, [body, error, prebuiltTree]);

  const matchNodesWithPaths = useMemo(() => {
    if (!tree || !search) return [];
    const results: { node: JNode; path: string }[] = [];
    collectMatchNodesWithPaths(tree, search, results);
    return results;
  }, [tree, search]);

  const matchNodes = useMemo(() => matchNodesWithPaths.map(m => m.node), [matchNodesWithPaths]);

  useEffect(() => {
    onMatchCountChange?.(matchNodes.length);
  }, [matchNodes.length, onMatchCountChange]);

  useEffect(() => {
    activeMatchRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentMatchIdx, search]);

  // When navigating to a match, uncollapse its ancestor paths so it becomes visible
  useEffect(() => {
    const active = matchNodesWithPaths[currentMatchIdx];
    if (!active) return;
    const ancestors = getAncestorPaths(active.path);
    ancestors.forEach(p => {
      if (collapsedSet.has(p)) onToggle(p);
    });
  }, [currentMatchIdx, matchNodesWithPaths]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeNode = matchNodes[currentMatchIdx] ?? null;

  if (error) return <div className="req-json-preview-wrapper"><pre className="jt-error">{error}</pre></div>;
  if (!body) return <div className="req-json-preview-wrapper"><pre className="jt-error">(empty response)</pre></div>;
  if (!tree) {
    return (
      <div className="req-json-preview-wrapper">
        <pre className="jt-raw">{body}</pre>
      </div>
    );
  }

  return (
    <div className="req-json-preview-wrapper">
      <div className="jt-tree">
        <JsonTreeNode node={tree} depth={0} search={search ?? ''}
          activeMatchNode={activeNode} activeMatchRef={activeMatchRef}
          collapsedSet={collapsedSet} onToggle={onToggle} path="" />
      </div>
    </div>
  );
}
