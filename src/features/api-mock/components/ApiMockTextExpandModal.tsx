import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import {
  findTextExpandMatches,
  formatJsonBody,
  formatTextExpandCount,
  nextTextExpandMatch,
  textExpandStats,
} from './apiMockTextExpand';
import { ChevronDownIcon, ChevronUpIcon, RedoIcon, UndoIcon } from './ApiMockIcons';

interface Props {
  title: string;
  value: string;
  readOnly?: boolean;
  placeholder?: string;
  onApply?: (value: string) => void;
  onClose: () => void;
}

const HISTORY_CAP = 40;

/**
 * Full-text viewer/editor for cramped Body fields (Simulate request body and
 * Match body expected/schema). Portaled so it stacks above Rule Simulation.
 */
export function ApiMockTextExpandModal({ title, value, readOnly = false, placeholder, onApply, onClose }: Props) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);

  const matches = useMemo(() => findTextExpandMatches(draft, query), [draft, query]);
  const formatted = useMemo(() => formatJsonBody(draft), [draft]);
  const stats = useMemo(() => textExpandStats(draft), [draft]);
  const pretty = formatted?.pretty ?? null;
  const minified = formatted?.minified ?? null;
  const prettyActive = Boolean(pretty && pretty === draft);
  const minifyActive = Boolean(minified && minified === draft);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'f') return;
      if (!searchRef.current) return;
      e.preventDefault();
      searchRef.current.focus();
      searchRef.current.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setMatchIndex(0);
  }, [query, draft]);

  const selectMatch = (index: number) => {
    const el = editorRef.current;
    const needle = query.trim();
    if (!el || !needle || matches.length === 0) return;
    const start = matches[index] ?? 0;
    el.focus();
    el.setSelectionRange(start, start + needle.length);
  };

  const goMatch = (direction: 1 | -1) => {
    const next = nextTextExpandMatch(matchIndex, matches.length, direction);
    setMatchIndex(next);
    selectMatch(next);
  };

  const commitDraft = (next: string) => {
    if (next === draft) return;
    setPast(prev => [...prev.slice(-(HISTORY_CAP - 1)), draft]);
    setFuture([]);
    setDraft(next);
  };

  const undo = () => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [draft, ...f]);
    setDraft(prev);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(f => f.slice(1));
    setPast(p => [...p, draft]);
    setDraft(next);
  };

  const jsonBadge = !draft.trim()
    ? { label: 'Empty', kind: '' }
    : formatted
      ? { label: 'JSON', kind: 'success' }
      : { label: 'Not JSON', kind: 'warning' };

  const modal = (
    <AppModalFrame
      title={
        <div className="am-modal-title-block">
          <div className="am-modal-title">{title}</div>
          <div className="am-modal-subtitle">
            {readOnly
              ? 'Read-only preview — search the full value without changing the field'
              : 'Search and format here, then Apply to write the value back to the field'}
          </div>
        </div>
      }
      onClose={onClose}
      dialogClassName="modal am-studio-modal am-text-expand-modal"
      overlayClassName="am-text-expand-overlay"
      bodyClassName="am-studio-modal-body am-text-expand-body"
      footerClassName="am-studio-modal-footer"
      showExpandButton={false}
      closeOnOverlayClick={false}
      dialogTestId="api-mock-text-expand-modal"
      headerActions={
        <div className="api-mock-root am-in-modal am-text-expand-search-cluster" data-testid="api-mock-text-expand-search-cluster">
          <input
            ref={searchRef}
            className="am-input am-text-expand-search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              goMatch(e.shiftKey ? -1 : 1);
            }}
            placeholder="Search…"
            aria-label="Search body text"
            data-testid="api-mock-text-expand-search"
          />
          <span className="am-text-expand-count" data-testid="api-mock-text-expand-count">
            {formatTextExpandCount(matchIndex, matches.length)}
          </span>
          <button
            type="button"
            className="am-icon-btn"
            onClick={() => goMatch(-1)}
            disabled={matches.length === 0}
            data-testid="api-mock-text-expand-prev"
            aria-label="Previous match"
          >
            <ChevronUpIcon size={13} />
          </button>
          <button
            type="button"
            className="am-icon-btn"
            onClick={() => goMatch(1)}
            disabled={matches.length === 0}
            data-testid="api-mock-text-expand-next"
            aria-label="Next match"
          >
            <ChevronDownIcon size={13} />
          </button>
        </div>
      }
      footer={
        <div className="api-mock-root am-in-modal am-modal-toolbar am-text-expand-footer">
          <span className="am-text-expand-hint">⌘F search · Esc close</span>
          {readOnly ? (
            <button type="button" className="am-btn" onClick={onClose} data-testid="api-mock-text-expand-close">Close</button>
          ) : (
            <>
              <button type="button" className="am-btn" onClick={onClose} data-testid="api-mock-text-expand-close">Cancel</button>
              <button
                type="button"
                className="am-btn primary"
                onClick={() => { onApply?.(draft); onClose(); }}
                data-testid="api-mock-text-expand-apply"
              >Apply</button>
            </>
          )}
        </div>
      }
    >
      <div className="api-mock-root am-in-modal am-text-expand-fill">
        <div className="am-text-expand-chrome">
          <div className="am-text-expand-meta">
            <span
              className={`am-badge${jsonBadge.kind ? ` ${jsonBadge.kind}` : ''}`}
              data-testid="api-mock-text-expand-json-badge"
            >
              {jsonBadge.label}
            </span>
            <span className="am-text-expand-stats" data-testid="api-mock-text-expand-stats">
              {stats.lines} {stats.lines === 1 ? 'line' : 'lines'}
              {' · '}
              {stats.chars.toLocaleString()} {stats.chars === 1 ? 'char' : 'chars'}
            </span>
          </div>
          {!readOnly && (
            <div className="am-text-expand-actions">
              <div className="am-text-expand-history">
                <button
                  type="button"
                  className="am-btn small"
                  onClick={undo}
                  disabled={past.length === 0}
                  data-testid="api-mock-text-expand-undo"
                  title="Undo"
                >
                  <UndoIcon size={13} /> Undo
                </button>
                <button
                  type="button"
                  className="am-btn small"
                  onClick={redo}
                  disabled={future.length === 0}
                  data-testid="api-mock-text-expand-redo"
                  title="Redo"
                >
                  <RedoIcon size={13} /> Redo
                </button>
              </div>
              <div className="am-segmented" role="group" aria-label="JSON format">
                <button
                  type="button"
                  className={prettyActive ? 'active' : ''}
                  onClick={() => { if (pretty) commitDraft(pretty); }}
                  disabled={!pretty || prettyActive}
                  data-testid="api-mock-text-expand-pretty"
                  title="Pretty-print JSON"
                  aria-label="Pretty-print JSON"
                  aria-pressed={prettyActive}
                >
                  Pretty
                </button>
                <button
                  type="button"
                  className={minifyActive ? 'active' : ''}
                  onClick={() => { if (minified) commitDraft(minified); }}
                  disabled={!minified || minifyActive}
                  data-testid="api-mock-text-expand-minify"
                  title="Collapse JSON to one line"
                  aria-label="Collapse JSON to one line"
                  aria-pressed={minifyActive}
                >
                  One line
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="am-text-expand-editor-shell">
          <textarea
            ref={editorRef}
            className="am-textarea mono am-textarea--expand am-text-expand-editor"
            value={draft}
            onChange={e => commitDraft(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            spellCheck={false}
            aria-label={title}
            data-testid="api-mock-text-expand-editor"
          />
        </div>
      </div>
    </AppModalFrame>
  );

  return createPortal(modal, document.body);
}
