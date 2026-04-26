import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ConsoleLine } from '../../../requests/hooks/useResponseCache';
import type { WorkflowRunStepSummary } from '../../hooks/useWorkflowRunCache';
import { type ConsoleRunBehavior, saveConsoleRunBehavior } from '../../utils/workflowSessionStorage';

function TimelineStep({ step, depth = 0 }: { step: WorkflowRunStepSummary; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = step.childSteps && step.childSteps.length > 0;

  return (
    <>
      <div
        className={`wf-timeline-item${hasChildren ? ' wf-timeline-item-expandable' : ''}`}
        style={depth > 0 ? { paddingLeft: `${depth * 20}px` } : undefined}
        onClick={hasChildren ? () => setExpanded(prev => !prev) : undefined}
        role={hasChildren ? 'button' : undefined}
      >
        <div className={`wf-timeline-dot wf-timeline-dot-${step.state}`} />
        <div className="wf-timeline-content">
          <span className="wf-timeline-label">
            {hasChildren && <span className="wf-timeline-expand-icon">{expanded ? '▾' : '▸'}</span>}
            {step.label}
            {step.childWorkflowName && (
              <span className="wf-timeline-child-name"> → {step.childWorkflowName}</span>
            )}
          </span>
          <span className={`wf-timeline-badge wf-timeline-badge-${step.state}`}>
            {step.childSteps
              ? `${step.childSteps.length} step${step.childSteps.length !== 1 ? 's' : ''}${step.childDurationMs != null ? ` · ${step.childDurationMs.toFixed(0)}ms` : ''}${(step.childAttempt ?? 0) > 0 ? ` · attempt ${(step.childAttempt ?? 0) + 1}` : ''}`
              : step.state === 'skipped' ? 'SKIPPED' : `${step.statusCode ?? '—'}${step.responseTimeMs != null ? ` · ${step.responseTimeMs}ms` : ''}`
            }
          </span>
          {step.error && <div className="wf-timeline-error">{step.error}</div>}
        </div>
      </div>
      {expanded && step.childSteps?.map((child, i) => (
        <TimelineStep key={i} step={child} depth={depth + 1} />
      ))}
    </>
  );
}

const prefixClass: Record<string, string> = {
  '*': 'wf-cl-info',
  '>': 'wf-cl-out',
  '<': 'wf-cl-in',
  '#': 'wf-cl-extract',
  '!': 'wf-cl-error',
  '---': 'wf-cl-separator',
  '': 'wf-cl-plain',
};

const prefixIcon: Record<string, string> = {
  '*': '●',
  '>': '→',
  '<': '←',
  '#': '⬡',
  '!': '✗',
  '---': '',
  '': '',
};

function fmtTime(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as Intl.DateTimeFormatOptions);
}

type PanelMode = 'docked' | 'maximized' | 'floating';

const CONSOLE_MODE_KEY = 'wf-console-default-mode';

function loadDefaultMode(): PanelMode {
  const stored = localStorage.getItem(CONSOLE_MODE_KEY);
  if (stored === 'docked' || stored === 'maximized' || stored === 'floating') return stored;
  return 'docked';
}

const MIN_DOCKED_H = 80;
const MAX_DOCKED_H = 600;
const DEFAULT_DOCKED_H = 200;
const MIN_FLOAT_W = 320;
const MIN_FLOAT_H = 180;

interface Props {
  lines: ConsoleLine[];
  onClear: () => void;
  onClose: () => void;
  stepSummaries?: WorkflowRunStepSummary[];
  runBehavior: ConsoleRunBehavior;
  onRunBehaviorChange: (b: ConsoleRunBehavior) => void;
}

function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="wf-console-match">{part}</mark>
      : part
  );
}

export default function WorkflowConsolePanel({ lines, onClear, onClose, stepSummaries = [], runBehavior, onRunBehaviorChange }: Props) {
  const [mode, setMode] = useState<PanelMode>(loadDefaultMode);
  const [dockedHeight, setDockedHeight] = useState(DEFAULT_DOCKED_H);
  const [viewMode, setViewMode] = useState<'log' | 'timeline'>('log');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lineRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());

  // ── Floating state ──
  const [floatPos, setFloatPos] = useState(() => ({
    x: Math.round(window.innerWidth * 0.15),
    y: Math.round(window.innerHeight * 0.1),
  }));
  const [floatSize, setFloatSize] = useState(() => ({
    w: Math.max(MIN_FLOAT_W, Math.round(window.innerWidth * 0.45)),
    h: Math.max(MIN_FLOAT_H, Math.round(window.innerHeight * 0.8)),
  }));

  // ── Auto-scroll ──
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Re-enable auto-scroll when a new run starts (separator line appears in append mode)
  const prevLinesLenRef = useRef(lines.length);
  useEffect(() => {
    if (lines.length > prevLinesLenRef.current) {
      // Check if the newly added lines include a separator (new run marker)
      for (let i = prevLinesLenRef.current; i < lines.length; i++) {
        if (lines[i].prefix === '---') {
          autoScrollRef.current = true;
          break;
        }
      }
    }
    prevLinesLenRef.current = lines.length;
  }, [lines]);

  useEffect(() => {
    if (autoScrollRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [lines.length]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    autoScrollRef.current = atBottom;
  };

  // ── Docked resize (drag top edge) ──
  const dockedDragRef = useRef<{ startY: number; startH: number } | null>(null);

  const onDockedResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dockedDragRef.current = { startY: e.clientY, startH: dockedHeight };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [dockedHeight]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dockedDragRef.current) return;
      const delta = dockedDragRef.current.startY - e.clientY;
      setDockedHeight(Math.max(MIN_DOCKED_H, Math.min(MAX_DOCKED_H, dockedDragRef.current.startH + delta)));
    };
    const onUp = () => {
      if (dockedDragRef.current) {
        dockedDragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Floating drag (title bar) ──
  const floatDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onFloatDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    e.preventDefault();
    floatDragRef.current = { startX: e.clientX, startY: e.clientY, origX: floatPos.x, origY: floatPos.y };
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, [floatPos]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!floatDragRef.current) return;
      const dx = e.clientX - floatDragRef.current.startX;
      const dy = e.clientY - floatDragRef.current.startY;
      setFloatPos({ x: Math.max(0, floatDragRef.current.origX + dx), y: Math.max(0, floatDragRef.current.origY + dy) });
    };
    const onUp = () => {
      if (floatDragRef.current) {
        floatDragRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Floating resize (bottom-right corner) ──
  const floatResizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  const onFloatResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    floatResizeRef.current = { startX: e.clientX, startY: e.clientY, origW: floatSize.w, origH: floatSize.h };
    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
  }, [floatSize]);

  // ── Floating resize (right edge — horizontal only) ──
  const floatEdgeResizeRef = useRef<{ startX: number; origW: number } | null>(null);

  const onRightEdgeResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    floatEdgeResizeRef.current = { startX: e.clientX, origW: floatSize.w };
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [floatSize]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (floatResizeRef.current) {
        const dx = e.clientX - floatResizeRef.current.startX;
        const dy = e.clientY - floatResizeRef.current.startY;
        setFloatSize({
          w: Math.max(MIN_FLOAT_W, floatResizeRef.current.origW + dx),
          h: Math.max(MIN_FLOAT_H, floatResizeRef.current.origH + dy),
        });
      } else if (floatEdgeResizeRef.current) {
        const dx = e.clientX - floatEdgeResizeRef.current.startX;
        setFloatSize(prev => ({
          ...prev,
          w: Math.max(MIN_FLOAT_W, floatEdgeResizeRef.current!.origW + dx),
        }));
      }
    };
    const onUp = () => {
      if (floatResizeRef.current || floatEdgeResizeRef.current) {
        floatResizeRef.current = null;
        floatEdgeResizeRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Mode actions ──
  const setAsDefault = (m: PanelMode) => {
    localStorage.setItem(CONSOLE_MODE_KEY, m);
  };

  // ── Search ──
  const matchIndices = useMemo(() => {
    if (!searchQuery) return [] as number[];
    const q = searchQuery.toLowerCase();
    const indices: number[] = [];
    lines.forEach((l, i) => { if (l.text.toLowerCase().includes(q)) indices.push(i); });
    return indices;
  }, [lines, searchQuery]);

  const matchCount = matchIndices.length;

  // Reset current match when query or matches change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset search position on new query
    setCurrentMatchIdx(0);
  }, [searchQuery]);

  // Scroll to current match
  useEffect(() => {
    if (matchCount === 0) return;
    const lineIdx = matchIndices[currentMatchIdx];
    const el = lineRefsMap.current.get(lineIdx);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const rootClass = `wf-console-panel wf-console-${mode}`;
  const rootStyle: React.CSSProperties =
    mode === 'docked' ? { height: dockedHeight } :
    mode === 'floating' ? { left: floatPos.x, top: floatPos.y, width: floatSize.w, height: floatSize.h } :
    {};

  return (
    <div className={rootClass} style={rootStyle}>
      {mode === 'docked' && (
        <div className="wf-console-resize-handle" onMouseDown={onDockedResizeStart} />
      )}

      <div
        className="wf-console-header"
        onMouseDown={mode === 'floating' ? onFloatDragStart : undefined}
        style={mode === 'floating' ? { cursor: 'grab' } : undefined}
      >
        <span className="wf-console-title">Console</span>
        <span className="wf-console-count">{lines.length} line{lines.length !== 1 ? 's' : ''}</span>
        <div className="wf-console-view-toggle">
          <button type="button" className={`wf-console-view-btn ${viewMode === 'log' ? 'wf-console-view-btn-active' : ''}`} onClick={() => setViewMode('log')} title="Log view">
            Log
          </button>
          <button type="button" className={`wf-console-view-btn ${viewMode === 'timeline' ? 'wf-console-view-btn-active' : ''}`} onClick={() => setViewMode('timeline')} title="Timeline view" disabled={stepSummaries.length === 0}>
            Timeline
          </button>
        </div>
        <div className="wf-console-actions">
          <button type="button" className={`wf-console-action-btn${searchOpen ? ' wf-console-action-btn-active' : ''}`} onClick={toggleSearch} title="Search console">
            Search
          </button>
          <button type="button" className="wf-console-action-btn" onClick={onClear} title="Clear console">
            Clear
          </button>
          <button
            type="button"
            className={`wf-console-run-toggle${runBehavior === 'clear' ? ' wf-console-run-toggle-on' : ''}`}
            onClick={() => {
              const next = runBehavior === 'clear' ? 'append' : 'clear';
              onRunBehaviorChange(next);
              saveConsoleRunBehavior(next);
            }}
            title={runBehavior === 'clear'
              ? 'Auto-clear is ON: console clears before each run. Click to keep logs across runs.'
              : 'Append mode: logs accumulate across runs. Click to auto-clear before each run.'}
          >
            {runBehavior === 'clear' ? '● Auto-clear' : '○ Append'}
          </button>
          <span className="wf-console-actions-sep" />
          <select
            className="wf-console-mode-select"
            value={mode}
            onChange={(e) => {
              const m = e.target.value as PanelMode;
              setMode(m);
              setAsDefault(m);
            }}
            title="Console display mode (saved as default)"
          >
            <option value="docked">⬓ Bottom</option>
            <option value="floating">⧉ Floating</option>
            <option value="maximized">⬜ Full Screen</option>
          </select>
          <button type="button" className="wf-console-action-btn" onClick={onClose} title="Close console">
            ✕
          </button>
        </div>
      </div>
      {searchOpen && (
        <div className="wf-console-search-bar">
          <input
            ref={searchInputRef}
            className="wf-console-search-input"
            type="text"
            placeholder="Search console…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') toggleSearch();
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); goNextMatch(); }
              if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); goPrevMatch(); }
            }}
          />
          {searchQuery && (
            <span className="wf-console-search-count">
              {matchCount > 0 ? `${currentMatchIdx + 1}/${matchCount}` : 'No matches'}
            </span>
          )}
          <button type="button" className="wf-console-action-btn" onClick={goPrevMatch} title="Previous match (Shift+Enter)" disabled={matchCount === 0}>
            ▲
          </button>
          <button type="button" className="wf-console-action-btn" onClick={goNextMatch} title="Next match (Enter)" disabled={matchCount === 0}>
            ▼
          </button>
          <button type="button" className="wf-console-action-btn" onClick={toggleSearch} title="Close search">
            ✕
          </button>
        </div>
      )}
      <div className="wf-console-body" ref={containerRef} onScroll={handleScroll}>
        {viewMode === 'timeline' && stepSummaries.length > 0 ? (
          <div className="wf-timeline">
            {stepSummaries.map((step, i) => (
              <TimelineStep key={i} step={step} />
            ))}
          </div>
        ) : lines.length === 0 ? (
          <div className="wf-console-empty">Run a Quick Test to see activity logs</div>
        ) : (
          lines.map((line, i) => {
            const cls = prefixClass[line.prefix] ?? 'wf-cl-plain';
            const icon = prefixIcon[line.prefix] ?? '';
            const time = fmtTime(line.ts);
            const isMatch = searchQuery && matchIndices.includes(i);
            const isCurrent = isMatch && matchIndices[currentMatchIdx] === i;
            return (
              <div
                key={i}
                ref={(el) => { if (el) lineRefsMap.current.set(i, el); else lineRefsMap.current.delete(i); }}
                className={`wf-cl-line ${cls}${isCurrent ? ' wf-cl-line-current-match' : isMatch ? ' wf-cl-line-match' : ''}`}
              >
                {time && <span className="wf-cl-ts">{time}</span>}
                {icon && <span className="wf-cl-icon">{icon}</span>}
                <span className="wf-cl-text">{searchQuery ? highlightMatches(line.text, searchQuery) : line.text}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {mode === 'floating' && (
        <>
          <div className="wf-console-float-edge-right" onMouseDown={onRightEdgeResizeStart} />
          <div className="wf-console-float-grip" onMouseDown={onFloatResizeStart} />
        </>
      )}
    </div>
  );
}
