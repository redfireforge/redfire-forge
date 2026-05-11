import { useState, useCallback, useMemo, useEffect } from 'react';
import type { MapperSource } from './types';
import type { JsonTreeNode } from '../../utils/jsonTreeModel';
import { buildJsonTree } from '../../utils/jsonTreeModel';
import SourceTreeNode from './SourceTreeNode';

interface SourcePanelProps {
  sources: MapperSource[];
  activeSourceId: string;
  sourceSampleOverrides: Record<string, unknown>;
  onSourceChange: (sourceId: string) => void;
  onDragStart: (path: string, sourceId: string) => void;
  onSourceSampleChange: (sourceId: string, data: unknown) => void;
  onFetchSample?: () => Promise<void>;
  canFetch?: boolean;
  fetchError?: string | null;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export default function SourcePanel({
  sources,
  activeSourceId,
  sourceSampleOverrides,
  onSourceChange,
  onDragStart,
  onSourceSampleChange,
  onFetchSample,
  canFetch = false,
  fetchError,
  searchInputRef,
}: SourcePanelProps) {
  const [search, setSearch] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['__root__']));
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    setPasteMode(false);
    setPasteText('');
    setPasteError(null);
  }, [activeSourceId]);

  const activeSource = sources.find((s) => s.id === activeSourceId) ?? sources[0];

  const effectiveSampleData = sourceSampleOverrides[activeSourceId] ?? activeSource?.sampleData;

  const tree: JsonTreeNode | null = useMemo(() => {
    if (!effectiveSampleData) return null;
    try {
      const data = typeof effectiveSampleData === 'string'
        ? JSON.parse(effectiveSampleData)
        : effectiveSampleData;
      return buildJsonTree(data, '', '');
    } catch {
      return null;
    }
  }, [effectiveSampleData]);

  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
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
      const parsed = JSON.parse(trimmed);
      onSourceSampleChange(activeSourceId, parsed);
      setPasteError(null);
      setPasteMode(false);
      setPasteText('');
    } catch (e) {
      setPasteError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, [pasteText, activeSourceId, onSourceSampleChange]);

  const handleFetchSample = useCallback(async () => {
    if (!onFetchSample) return;
    setFetching(true);
    try {
      await onFetchSample();
    } finally {
      setFetching(false);
    }
  }, [onFetchSample]);

  const togglePasteMode = useCallback(() => {
    setPasteMode((prev) => !prev);
    setPasteError(null);
    if (!pasteMode && effectiveSampleData) {
      try {
        const data = typeof effectiveSampleData === 'string'
          ? JSON.parse(effectiveSampleData)
          : effectiveSampleData;
        setPasteText(JSON.stringify(data, null, 2));
      } catch {
        setPasteText('');
      }
    }
  }, [pasteMode, effectiveSampleData]);

  return (
    <div className="dm-panel dm-panel--source">
      <div className="dm-panel-header">
        <span className="dm-panel-title">Source</span>
        <div className="dm-panel-actions">
          <button
            className={`dm-btn-icon ${pasteMode ? 'dm-btn-icon--active' : ''}`}
            onClick={togglePasteMode}
            title={pasteMode ? 'Switch to tree view' : 'Paste JSON'}
          >
            {pasteMode ? '🌳' : '📋'}
          </button>
          {canFetch && (
            <button
              className="dm-btn-icon"
              onClick={handleFetchSample}
              disabled={fetching}
              title="Fetch live sample"
            >
              {fetching ? '⏳' : '🔄'}
            </button>
          )}
          {!pasteMode && (
            <>
              <button className="dm-btn-icon" onClick={handleExpandAll} title="Expand all">⊞</button>
              <button className="dm-btn-icon" onClick={handleCollapseAll} title="Collapse all">⊟</button>
            </>
          )}
        </div>
      </div>

      {sources.length > 1 && (
        <div className="dm-source-tabs">
          {sources.map((s) => (
            <button
              key={s.id}
              className={`dm-source-tab ${s.id === activeSourceId ? 'dm-source-tab--active' : ''}`}
              onClick={() => onSourceChange(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {pasteMode ? (
        <div className="dm-paste-container">
          <textarea
            className="dm-paste-textarea"
            value={pasteText}
            onChange={(e) => { setPasteText(e.target.value); setPasteError(null); }}
            placeholder='Paste JSON here, e.g. {"name": "Alice", "age": 30}'
            spellCheck={false}
          />
          {pasteError && <div className="dm-paste-error">{pasteError}</div>}
          <div className="dm-paste-actions">
            <button className="dm-paste-btn dm-paste-btn--apply" onClick={handlePasteSubmit}>
              Apply
            </button>
            <button className="dm-paste-btn dm-paste-btn--cancel" onClick={() => { setPasteMode(false); setPasteError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="dm-search-bar">
            <input
              ref={searchInputRef}
              type="text"
              className="dm-search-input"
              placeholder="Search fields…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="dm-search-clear" onClick={() => setSearch('')}>×</button>
            )}
          </div>

          {fetchError && <div className="dm-paste-error">{fetchError}</div>}

          <div className="dm-tree-container">
            {tree ? (
              <SourceTreeNode
                node={tree}
                depth={0}
                search={search}
                onDragStart={onDragStart}
                sourceId={activeSourceId}
                expandedPaths={expandedPaths}
                onToggle={handleToggle}
              />
            ) : (
              <div className="dm-empty-state">
                No sample data.
                <br />
                Paste JSON or fetch a sample to populate the source tree.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
