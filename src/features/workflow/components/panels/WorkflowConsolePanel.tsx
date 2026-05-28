import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ConsoleLine } from '../../../requests/hooks/useResponseCache';
import type { WorkflowRunStepSummary } from '../../hooks/useWorkflowRunCache';
import { type ConsoleRunBehavior, saveConsoleRunBehavior } from '../../utils/workflowSessionStorage';
import ConsoleLogLine from '../../../../shared/components/ConsoleLogLine';
import { type PanelMode, loadPanelMode, savePanelMode } from '../../../../shared/utils/panelMode';
import { useFloatingPanel } from '../../../../shared/hooks/useFloatingPanel';
import { useCopyToClipboard } from '../../../../shared/hooks/useCopyToClipboard';

type LogLevel = 'all' | 'error' | 'info' | 'request';

const LEVEL_PREFIXES: Record<LogLevel, string[] | null> = {
  all: null,
  error: ['!'],
  info: ['*'],
  request: ['>', '<'],
};

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

const CONSOLE_MODE_KEY = 'wf-console-default-mode';

interface Props {
  lines: ConsoleLine[];
  onClear: () => void;
  onClose: () => void;
  stepSummaries?: WorkflowRunStepSummary[];
  runBehavior: ConsoleRunBehavior;
  onRunBehaviorChange: (b: ConsoleRunBehavior) => void;
}


export default function WorkflowConsolePanel({ lines, onClear, onClose, stepSummaries = [], runBehavior, onRunBehaviorChange }: Props) {
  const [mode, setMode] = useState<PanelMode>(() => loadPanelMode(CONSOLE_MODE_KEY));
  const {
    dockedHeight, floatPos, floatSize,
    onDockedResizeStart, onFloatDragStart, onFloatResizeStart, onRightEdgeResizeStart,
  } = useFloatingPanel({ defaultDockedHeight: 200, floatHeightRatio: 0.8 });
  const [viewMode, setViewMode] = useState<'log' | 'timeline'>('log');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [logLevel, setLogLevel] = useState<LogLevel>('all');
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [copyFeedback, copyLogsToClipboard] = useCopyToClipboard(1500);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lineRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());

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

  // ── Mode actions ──
  const setAsDefault = (m: PanelMode) => savePanelMode(CONSOLE_MODE_KEY, m);

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

  // ── Log level filtering ──
  const filteredLines = useMemo(() => {
    const prefixes = LEVEL_PREFIXES[logLevel];
    if (!prefixes) return lines;
    return lines.filter(l => prefixes.includes(l.prefix) || l.prefix === '---');
  }, [lines, logLevel]);

  // ── Copy to clipboard ──
  const handleCopyLogs = useCallback(() => {
    const text = filteredLines
      .map(l => {
        const ts = l.ts ? new Date(l.ts).toISOString().slice(11, 23) : '';
        return `${ts ? ts + ' ' : ''}${l.prefix ? l.prefix + ' ' : ''}${l.text}`;
      })
      .join('\n');
    void copyLogsToClipboard(text);
  }, [filteredLines, copyLogsToClipboard]);

  // ── Level counts ──
  const levelCounts = useMemo(() => ({
    error: lines.filter(l => l.prefix === '!').length,
    info: lines.filter(l => l.prefix === '*').length,
    request: lines.filter(l => l.prefix === '>' || l.prefix === '<').length,
  }), [lines]);

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

      {/* ── Row 1: Title + window controls ── */}
      <div
        className="wf-console-header"
        onMouseDown={mode === 'floating' ? onFloatDragStart : undefined}
        style={mode === 'floating' ? { cursor: 'grab' } : undefined}
      >
        <span className="wf-console-title">Console</span>
        <span className="wf-console-count">{filteredLines.length}{logLevel !== 'all' ? `/${lines.length}` : ''} line{filteredLines.length !== 1 ? 's' : ''}</span>
        <div className="wf-console-actions">
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
            {runBehavior === 'clear' ? <><svg className="wf-inline-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="6"/></svg> Auto-clear</> : <><svg className="wf-inline-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="6"/></svg> Append</>}
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
      {/* ── Row 2: View toggle + filters + tools ── */}
      <div className="wf-console-toolbar">
        <div className="wf-console-view-toggle">
          <button type="button" className={`wf-console-view-btn ${viewMode === 'log' ? 'wf-console-view-btn-active' : ''}`} onClick={() => setViewMode('log')} title="Log view">
            Log
          </button>
          <button type="button" className={`wf-console-view-btn ${viewMode === 'timeline' ? 'wf-console-view-btn-active' : ''}`} onClick={() => setViewMode('timeline')} title="Timeline view" disabled={stepSummaries.length === 0}>
            Timeline
          </button>
        </div>
        <div className="wf-console-level-filter">
          <button type="button" className={`wf-console-level-btn${logLevel === 'all' ? ' wf-console-level-active' : ''}`} onClick={() => setLogLevel('all')} title="Show all log lines">All</button>
          <button type="button" className={`wf-console-level-btn wf-console-level-error${logLevel === 'error' ? ' wf-console-level-active' : ''}`} onClick={() => setLogLevel('error')} title="Show errors only">
            {levelCounts.error > 0 && <span className="wf-console-level-count">{levelCounts.error}</span>}Errors
          </button>
          <button type="button" className={`wf-console-level-btn wf-console-level-info${logLevel === 'info' ? ' wf-console-level-active' : ''}`} onClick={() => setLogLevel('info')} title="Show info only">Info</button>
          <button type="button" className={`wf-console-level-btn wf-console-level-req${logLevel === 'request' ? ' wf-console-level-active' : ''}`} onClick={() => setLogLevel('request')} title="Show requests only">Requests</button>
        </div>
        <div className="wf-console-tools">
          <button type="button" className={`wf-console-action-btn${searchOpen ? ' wf-console-action-btn-active' : ''}`} onClick={toggleSearch} title="Search console (Cmd+F)">
            <svg className="wf-inline-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242.156a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/></svg>
          </button>
          <button type="button" className={`wf-console-action-btn${showTimestamps ? ' wf-console-action-btn-active' : ''}`} onClick={() => setShowTimestamps(v => !v)} title={showTimestamps ? 'Hide timestamps' : 'Show timestamps'}>
            <svg className="wf-inline-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3.5a.5.5 0 0 0-1 0V8a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 7.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>
          </button>
          <button type="button" className={`wf-console-action-btn${copyFeedback ? ' wf-console-action-btn-active' : ''}`} onClick={handleCopyLogs} title={copyFeedback ? 'Copied!' : 'Copy all logs to clipboard'} disabled={lines.length === 0}>
            {copyFeedback
              ? <svg className="wf-inline-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>
              : <svg className="wf-inline-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>
            }
          </button>
          <button type="button" className="wf-console-action-btn" onClick={onClear} title="Clear console" disabled={lines.length === 0}>
            <svg className="wf-inline-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 1 0v7a.5.5 0 0 1-1 0V5zm3 0a.5.5 0 0 1 1 0v7a.5.5 0 0 1-1 0V5z"/></svg>
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
      <div className={`wf-console-body${showTimestamps ? '' : ' wf-console-hide-ts'}`} ref={containerRef} onScroll={handleScroll}>
        {viewMode === 'timeline' && stepSummaries.length > 0 ? (
          <div className="wf-timeline">
            {stepSummaries.map((step, i) => (
              <TimelineStep key={i} step={step} />
            ))}
          </div>
        ) : lines.length === 0 ? (
          <div className="wf-console-empty">
            <svg className="wf-console-empty-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="6" y="8" width="36" height="32" rx="4" />
              <path d="M14 20l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="22" y1="28" x2="34" y2="28" strokeLinecap="round" />
            </svg>
            <span className="wf-console-empty-title">No activity logs</span>
            <span className="wf-console-empty-hint">Click <strong>Quick Test</strong> or <strong>Debug</strong> to run your workflow and see logs here</span>
          </div>
        ) : filteredLines.length === 0 && logLevel !== 'all' ? (
          <div className="wf-console-empty">
            <span className="wf-console-empty-title">No {logLevel} logs</span>
            <span className="wf-console-empty-hint">
              <button type="button" className="wf-console-empty-link" onClick={() => setLogLevel('all')}>Show all levels</button>
            </span>
          </div>
        ) : (
          filteredLines.map((line) => {
            const origIdx = lines.indexOf(line);
            const isMatch = searchQuery && matchIndices.includes(origIdx);
            const isCurrent = isMatch && matchIndices[currentMatchIdx] === origIdx;
            return (
              <ConsoleLogLine
                key={origIdx}
                line={{ prefix: line.prefix, text: line.text, ts: showTimestamps ? (line.ts ?? 0) : 0 }}
                searchQuery={searchQuery || undefined}
                isMatch={!!isMatch}
                isCurrentMatch={!!isCurrent}
                lineRef={(el) => { if (el) lineRefsMap.current.set(origIdx, el); else lineRefsMap.current.delete(origIdx); }}
              />
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
