import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { WorkflowIterationTrace, TraceCaptureLevel } from '../../../shared/types';
import ConsoleLogLine from '../../../shared/components/ConsoleLogLine';
import type { LogLine } from '../../../shared/utils/consoleLogUtils';
import { reconstructLogLines } from '../utils/reconstructLogLines';
import { buildAggregateSummary } from '../utils/buildAggregateSummary';
import { inferCaptureLevel } from '../utils/inferCaptureLevel';
import type { WorkflowExecutionTrace } from '../../../shared/types';
import { isSampledIteration } from '../utils/sampledIterations';
import { type PanelMode, loadPanelMode, savePanelMode } from '../../../shared/utils/panelMode';
import { useFloatingPanel } from '../../../shared/hooks/useFloatingPanel';
import { CustomSelect } from '../../../shared/components/CustomSelect';

const RE_CONSOLE_MODE_KEY = 're-console-default-mode';

interface Props {
  trace: WorkflowExecutionTrace;
  iteration: WorkflowIterationTrace | undefined;
  captureLevel?: TraceCaptureLevel;
  onNodeSelect?: (nodeId: string) => void;
  onClose: () => void;
}

export default function ResultsExplorerConsolePanel({
  trace,
  iteration,
  captureLevel,
  onNodeSelect,
  onClose,
}: Props) {
  const [mode, setMode] = useState<PanelMode>(() => loadPanelMode(RE_CONSOLE_MODE_KEY));
  const {
    dockedHeight, floatPos, floatSize,
    onDockedResizeStart, onFloatDragStart, onFloatResizeStart, onRightEdgeResizeStart,
  } = useFloatingPanel({ defaultDockedHeight: 220 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [nodeFilter, setNodeFilter] = useState<string>('');
  const [nodeFilterOpen, setNodeFilterOpen] = useState(false);
  const nodeFilterRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lineRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());

  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveLevel = captureLevel ?? inferCaptureLevel(trace);
  const isMinimal = effectiveLevel === 'minimal';
  const includeHttpBodies = effectiveLevel === 'full' || effectiveLevel === 'debug';

  const isAggregate = !iteration;

  // Build log lines from structured trace data
  const logLines = useMemo<LogLine[]>(() => {
    if (isMinimal) {
      if (iteration) {
        const errorEvents = iteration.events.filter(e => e.state === 'fail');
        if (errorEvents.length === 0) return [];
        return reconstructLogLines(
          { ...iteration, events: errorEvents },
          { nodeFilter: nodeFilter || undefined, includeHttpBodies: false, preferRawLogs: false },
        );
      }
      return buildAggregateSummary(trace);
    }
    if (iteration) {
      return reconstructLogLines(iteration, {
        nodeFilter: nodeFilter || undefined,
        includeHttpBodies,
        preferRawLogs: effectiveLevel === 'debug',
      });
    }
    // Aggregate mode: compact summary instead of full log dump
    return buildAggregateSummary(trace);
  }, [iteration, isMinimal, nodeFilter, includeHttpBodies, effectiveLevel, trace]);

  // Unique nodes for filter dropdown, ordered by workflow snapshot position
  const nodeOptions = useMemo(() => {
    const iters = iteration ? [iteration] : trace.iterations.filter(isSampledIteration);
    const seen = new Map<string, string>();
    for (const iter of iters) {
      for (const event of iter.events) {
        if (!seen.has(event.nodeId)) {
          seen.set(event.nodeId, event.nodeLabel || event.nodeId);
        }
      }
    }
    const snapshotNodes = (trace.workflowSnapshot?.nodes ?? []) as { id: string }[];
    const orderMap = new Map(snapshotNodes.map((n, i) => [n.id, i]));
    return Array.from(seen.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
  }, [iteration, trace.iterations, trace.workflowSnapshot?.nodes]);

  // Search: match indices
  const matchIndices = useMemo(() => {
    if (!searchQuery) return [] as number[];
    const q = searchQuery.toLowerCase();
    const indices: number[] = [];
    logLines.forEach((l, i) => {
      if (l.text.toLowerCase().includes(q) || l.nodeLabel?.toLowerCase().includes(q)) indices.push(i);
    });
    return indices;
  }, [logLines, searchQuery]);

  const matchSet = useMemo(() => new Set(matchIndices), [matchIndices]);
  const matchCount = matchIndices.length;

  // Close node filter dropdown on click outside
  useEffect(() => {
    if (!nodeFilterOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (nodeFilterRef.current && !nodeFilterRef.current.contains(e.target as Node)) {
        setNodeFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [nodeFilterOpen]);

  useEffect(() => {
    setCurrentMatchIdx(0);
  }, [searchQuery]);

  // Scroll to current match
  useEffect(() => {
    if (matchCount === 0) return;
    const lineIdx = matchIndices[currentMatchIdx];
    const el = lineRefsMap.current.get(lineIdx);
    if (el?.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentMatchIdx, matchIndices, matchCount]);

  const goNextMatch = () => {
    if (matchCount === 0) return;
    setCurrentMatchIdx(prev => (prev + 1) % matchCount);
  };
  const goPrevMatch = () => {
    if (matchCount === 0) return;
    setCurrentMatchIdx(prev => (prev - 1 + matchCount) % matchCount);
  };

  const toggleSearch = () => {
    setSearchOpen(prev => {
      if (!prev) setTimeout(() => searchInputRef.current?.focus(), 0);
      else { setSearchQuery(''); setCurrentMatchIdx(0); }
      return !prev;
    });
  };

  // Auto-scroll to first error when opening
  const hasScrolledToError = useRef(false);
  useEffect(() => {
    if (hasScrolledToError.current || !containerRef.current) return;
    const firstErrorIdx = logLines.findIndex(l => l.prefix === '!' || l.prefix === 'error');
    if (firstErrorIdx >= 0) {
      const errorEl = containerRef.current.children[firstErrorIdx] as HTMLElement | undefined;
      if (errorEl?.scrollIntoView) errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hasScrolledToError.current = true;
    }
  }, [logLines]);

  useEffect(() => {
    hasScrolledToError.current = false;
  }, [iteration?.index]);

  const setAsDefault = (m: PanelMode) => savePanelMode(RE_CONSOLE_MODE_KEY, m);

  const handleLineClick = useCallback((nodeId?: string) => {
    if (nodeId && onNodeSelect) {
      onNodeSelect(nodeId);
    }
  }, [onNodeSelect]);

  const rootClass = `re-console-panel re-console-${mode}`;
  const rootStyle: React.CSSProperties =
    mode === 'docked' ? { height: dockedHeight } :
    mode === 'floating' ? { left: floatPos.x, top: floatPos.y, width: floatSize.w, height: floatSize.h } :
    {};

  // Shared header content
  const renderHeader = () => (
    <div
      className="re-console-header"
      onMouseDown={mode === 'floating' ? onFloatDragStart : undefined}
      style={mode === 'floating' ? { cursor: 'grab' } : undefined}
    >
      <span className="re-console-title">Console</span>
      <span className="re-console-header-level" data-testid="console-header-level" title={`Trace level: ${effectiveLevel}`}>
        {effectiveLevel}
      </span>
      <span className="re-console-count">{logLines.length} line{logLines.length !== 1 ? 's' : ''}</span>

      {/* Node filter */}
      {!isAggregate && nodeOptions.length > 1 && (
        <div className="re-console-node-filter-wrap" ref={nodeFilterRef}>
          <button
            type="button"
            className={`re-console-node-filter-btn${nodeFilter ? ' active' : ''}`}
            onClick={() => setNodeFilterOpen(prev => !prev)}
            data-testid="console-node-filter"
          >
            <span className="re-console-nf-label">
              {nodeFilter ? nodeOptions.find(n => n.id === nodeFilter)?.label ?? 'All nodes' : 'All nodes'}
            </span>
            <span className="re-console-nf-chevron">{nodeFilterOpen ? '▲' : '▼'}</span>
          </button>
          {nodeFilterOpen && (
            <div className="re-console-node-filter-menu" data-testid="console-node-filter-menu">
              <button
                type="button"
                className={`re-console-nf-item${!nodeFilter ? ' selected' : ''}`}
                onClick={() => { setNodeFilter(''); setNodeFilterOpen(false); }}
              >
                All nodes
              </button>
              {nodeOptions.map(n => (
                <button
                  key={n.id}
                  type="button"
                  className={`re-console-nf-item${nodeFilter === n.id ? ' selected' : ''}`}
                  onClick={() => { setNodeFilter(n.id); setNodeFilterOpen(false); }}
                >
                  {n.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="re-console-actions">
        <button
          type="button"
          className={`re-console-action-btn${searchOpen ? ' re-console-action-btn-active' : ''}`}
          onClick={toggleSearch}
          title="Search console"
        >
          Search
        </button>
        <span className="re-console-actions-sep" />
        <CustomSelect
          className="re-console-mode-select"
          value={mode}
          onChange={(v) => {
            const m = v as PanelMode;
            setMode(m);
            setAsDefault(m);
          }}
          options={[
            { value: 'docked', label: '⬓ Bottom' },
            { value: 'floating', label: '⧉ Floating' },
            { value: 'maximized', label: '⬜ Full Screen' },
          ]}
          aria-label="Console display mode (saved as default)"
          size="sm"
        />
      </div>
    </div>
  );

  const renderCloseButton = () => (
    <button
      type="button"
      className="re-console-close-btn"
      onClick={onClose}
      title="Close console (⌘J)"
      aria-label="Close console"
      data-testid="results-console-close-btn"
    >
      ✕
    </button>
  );

  // Search bar
  const renderSearchBar = () => searchOpen && (
    <div className="re-console-search-bar">
      <input
        ref={searchInputRef}
        className="re-console-search-input"
        type="text"
        placeholder="Search console…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') toggleSearch();
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); goNextMatch(); }
          if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); goPrevMatch(); }
        }}
        data-testid="console-search"
      />
      {searchQuery && (
        <span className="re-console-search-count">
          {matchCount > 0 ? `${currentMatchIdx + 1}/${matchCount}` : 'No matches'}
        </span>
      )}
      <button type="button" className="re-console-action-btn" onClick={goPrevMatch} title="Previous match (Shift+Enter)" disabled={matchCount === 0}>
        ▲
      </button>
      <button type="button" className="re-console-action-btn" onClick={goNextMatch} title="Next match (Enter)" disabled={matchCount === 0}>
        ▼
      </button>
      <button type="button" className="re-console-action-btn" onClick={toggleSearch} title="Close search">
        ✕
      </button>
    </div>
  );

  if (isMinimal && logLines.length === 0) {
    return (
      <div className={rootClass} style={rootStyle} data-testid="results-console-panel">
        {renderCloseButton()}
        {mode === 'docked' && <div className="re-console-resize-handle" onMouseDown={onDockedResizeStart} />}
        {renderHeader()}
        <div className="re-console-body re-console-disabled" data-testid="results-console-disabled">
          <div className="re-console-disabled-msg">
            No errors captured. Minimal trace only records failures.
            <br />
            <span className="re-console-disabled-hint">Use Standard or higher trace level for full console output.</span>
          </div>
        </div>
        {mode === 'floating' && (
          <>
            <div className="re-console-float-edge-right" onMouseDown={onRightEdgeResizeStart} />
            <div className="re-console-float-grip" onMouseDown={onFloatResizeStart} />
          </>
        )}
      </div>
    );
  }

  // (No early return for aggregate — logLines handles it)

  return (
    <div className={rootClass} style={rootStyle} data-testid="results-console-panel">
      {renderCloseButton()}
      {mode === 'docked' && (
        <div className="re-console-resize-handle" onMouseDown={onDockedResizeStart} />
      )}

      {renderHeader()}
      {renderSearchBar()}

      <div className="re-console-body" ref={containerRef} data-testid="results-console-body">
        {logLines.length === 0 ? (
          <div className="re-console-empty">
            {isAggregate ? 'No events recorded across iterations' : 'No events recorded for this iteration'}
          </div>
        ) : (
          logLines.map((line, i) => {
            const isMatch = searchQuery && matchSet.has(i);
            const isCurrent = isMatch && matchIndices[currentMatchIdx] === i;
            return (
              <ConsoleLogLine
                key={i}
                line={line}
                searchQuery={searchQuery || undefined}
                isMatch={!!isMatch}
                isCurrentMatch={!!isCurrent}
                onClick={line.nodeId ? () => handleLineClick(line.nodeId) : undefined}
                lineRef={(el) => { if (el) lineRefsMap.current.set(i, el); else lineRefsMap.current.delete(i); }}
              />
            );
          })
        )}
      </div>

      {/* Trace level indicator */}
      <div className="re-console-footer">
        <span className="re-console-level-badge" data-testid="console-level-badge">
          {effectiveLevel}
        </span>
        {effectiveLevel === 'standard' && (
          <span className="re-console-level-hint">Use Full or Debug trace for request/response bodies</span>
        )}
      </div>

      {mode === 'floating' && (
        <>
          <div className="re-console-float-edge-right" onMouseDown={onRightEdgeResizeStart} />
          <div className="re-console-float-grip" onMouseDown={onFloatResizeStart} />
        </>
      )}
    </div>
  );
}
