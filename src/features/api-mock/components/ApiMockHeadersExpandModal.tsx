import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import {
  findTextExpandMatches,
  formatTextExpandCount,
  isNestedApiMockExpandPortal,
  nextTextExpandMatch,
  resolveApiMockExpandPortal,
} from './apiMockTextExpand';
import {
  countNamedHeaderRows,
  createHeaderDraftRow,
  findHeaderRowMatches,
  headerRowsToText,
  headerTextToRows,
  type HeaderDraftRow,
} from './apiMockHeadersExpand';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, RedoIcon, TrashIcon, UndoIcon } from './ApiMockIcons';

interface Props {
  title: string;
  value: string;
  readOnly?: boolean;
  placeholder?: string;
  onApply?: (value: string) => void;
  onClose: () => void;
}

const HISTORY_CAP = 40;

type HeadersView = 'raw' | 'table';

/**
 * Headers editor popup: Raw (`Name: value` lines) and Table (one row per header).
 * Nests inside Rule Simulation's request pane when that host is mounted.
 */
export function ApiMockHeadersExpandModal({
  title,
  value,
  readOnly = false,
  placeholder,
  onApply,
  onClose,
}: Props) {
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [view, setView] = useState<HeadersView>('table');
  const [draft, setDraft] = useState(value);
  const [rows, setRows] = useState<HeaderDraftRow[]>(() => headerTextToRows(value));
  const [past, setPast] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);

  const rawMatches = useMemo(() => findTextExpandMatches(draft, query), [draft, query]);
  const tableMatches = useMemo(() => findHeaderRowMatches(rows, query), [rows, query]);
  const matches = view === 'raw' ? rawMatches : tableMatches;
  const namedCount = countNamedHeaderRows(rows);
  const statsLabel = `${namedCount} ${namedCount === 1 ? 'header' : 'headers'}`;

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
  }, [query, draft, view]);

  const selectRawMatch = (index: number) => {
    const el = editorRef.current;
    const needle = query.trim();
    const start = rawMatches[index];
    if (!el || !needle || start == null) return;
    el.focus();
    el.setSelectionRange(start, start + needle.length);
  };

  const selectTableMatch = (index: number) => {
    const id = rows[tableMatches[index]]?.id;
    if (!id) return;
    rowRefs.current.get(id)?.scrollIntoView({ block: 'nearest' });
  };

  const goMatch = (direction: 1 | -1) => {
    const next = nextTextExpandMatch(matchIndex, matches.length, direction);
    setMatchIndex(next);
    if (view === 'raw') selectRawMatch(next);
    else selectTableMatch(next);
  };

  const commitDraft = (next: string) => {
    if (next === draft) return;
    setPast(prev => [...prev.slice(-(HISTORY_CAP - 1)), draft]);
    setFuture([]);
    setDraft(next);
  };

  const commitRows = (next: HeaderDraftRow[]) => {
    setRows(next);
    commitDraft(headerRowsToText(next));
  };

  const showView = (next: HeadersView) => {
    if (next === view) return;
    if (next === 'raw') setDraft(headerRowsToText(rows));
    else setRows(headerTextToRows(draft));
    setView(next);
  };

  const undo = () => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [draft, ...f]);
    setDraft(prev);
    if (view === 'table') setRows(headerTextToRows(prev));
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(f => f.slice(1));
    setPast(p => [...p, draft]);
    setDraft(next);
    if (view === 'table') setRows(headerTextToRows(next));
  };

  const updateRow = (id: string, patch: Partial<Pick<HeaderDraftRow, 'name' | 'value'>>) => {
    commitRows(rows.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows(prev => [...prev, createHeaderDraftRow()]);
  };

  const removeRow = (id: string) => {
    commitRows(rows.length <= 1 ? [createHeaderDraftRow()] : rows.filter(r => r.id !== id));
  };

  const portalTarget = resolveApiMockExpandPortal();
  const nested = isNestedApiMockExpandPortal(portalTarget);

  const modal = (
    <AppModalFrame
      title={
        <div className="am-modal-title-block">
          <div className="am-modal-title">{title}</div>
          <div className="am-modal-subtitle">
            {readOnly
              ? 'Read-only preview — switch Raw and Table without changing the field'
              : 'Edit as a table or as raw lines, then Apply to write the headers back'}
          </div>
        </div>
      }
      onClose={onClose}
      dialogClassName="modal am-studio-modal am-text-expand-modal am-headers-expand-modal"
      overlayClassName={`am-text-expand-overlay${nested ? ' am-text-expand-overlay--nested' : ''}`}
      bodyClassName="am-studio-modal-body am-text-expand-body"
      footerClassName="am-studio-modal-footer"
      showExpandButton={false}
      closeOnOverlayClick={false}
      controlsClassName="am-text-expand-header-controls"
      dialogTestId="api-mock-headers-expand-modal"
      headerActions={
        <div className="api-mock-root am-in-modal am-text-expand-search-cluster" data-testid="api-mock-headers-expand-search-cluster">
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
            aria-label="Search headers"
            data-testid="api-mock-headers-expand-search"
          />
          <span className="am-text-expand-count" data-testid="api-mock-headers-expand-count">
            {formatTextExpandCount(matchIndex, matches.length)}
          </span>
          <button
            type="button"
            className="am-icon-btn"
            onClick={() => goMatch(-1)}
            disabled={matches.length === 0}
            data-testid="api-mock-headers-expand-prev"
            aria-label="Previous match"
          >
            <ChevronUpIcon size={13} />
          </button>
          <button
            type="button"
            className="am-icon-btn"
            onClick={() => goMatch(1)}
            disabled={matches.length === 0}
            data-testid="api-mock-headers-expand-next"
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
            <button type="button" className="am-btn" onClick={onClose} data-testid="api-mock-headers-expand-close">Close</button>
          ) : (
            <>
              <button type="button" className="am-btn" onClick={onClose} data-testid="api-mock-headers-expand-close">Cancel</button>
              <button
                type="button"
                className="am-btn primary"
                onClick={() => { onApply?.(view === 'table' ? headerRowsToText(rows) : draft); onClose(); }}
                data-testid="api-mock-headers-expand-apply"
              >Apply</button>
            </>
          )}
        </div>
      }
    >
      <div className="api-mock-root am-in-modal am-text-expand-fill">
        <div className="am-text-expand-chrome">
          <div className="am-text-expand-meta">
            <span className={`am-badge${namedCount ? ' success' : ''}`} data-testid="api-mock-headers-expand-badge">
              {namedCount ? statsLabel : 'Empty'}
            </span>
            <span className="am-text-expand-stats" data-testid="api-mock-headers-expand-stats">{statsLabel}</span>
          </div>
          <div className="am-text-expand-actions">
            {!readOnly && (
              <div className="am-text-expand-history">
                <button type="button" className="am-btn small" onClick={undo} disabled={past.length === 0} data-testid="api-mock-headers-expand-undo" title="Undo">
                  <UndoIcon size={13} /> Undo
                </button>
                <button type="button" className="am-btn small" onClick={redo} disabled={future.length === 0} data-testid="api-mock-headers-expand-redo" title="Redo">
                  <RedoIcon size={13} /> Redo
                </button>
              </div>
            )}
            <div className="am-segmented" role="group" aria-label="Headers view">
              <button
                type="button"
                className={view === 'raw' ? 'active' : ''}
                onClick={() => showView('raw')}
                data-testid="api-mock-headers-expand-view-raw"
                aria-pressed={view === 'raw'}
              >
                Raw
              </button>
              <button
                type="button"
                className={view === 'table' ? 'active' : ''}
                onClick={() => showView('table')}
                data-testid="api-mock-headers-expand-view-table"
                aria-pressed={view === 'table'}
              >
                Table
              </button>
            </div>
            {!readOnly && view === 'table' && (
              <button type="button" className="am-btn small" onClick={addRow} data-testid="api-mock-headers-expand-add">
                <PlusIcon size={13} /> Add header
              </button>
            )}
          </div>
        </div>
        {view === 'raw' ? (
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
              data-testid="api-mock-headers-expand-editor"
            />
          </div>
        ) : (
          <div className="am-headers-expand-table" data-testid="api-mock-headers-expand-table">
            <div className="am-headers-expand-head">
              <span>Name</span>
              <span>Value</span>
              <span />
            </div>
            {rows.map((row, index) => {
              const matchPos = tableMatches.indexOf(index);
              const isMatch = matchPos >= 0;
              const isActive = isMatch && matchPos === matchIndex;
              return (
                <div
                  key={row.id}
                  ref={el => {
                    if (el) rowRefs.current.set(row.id, el);
                    else rowRefs.current.delete(row.id);
                  }}
                  className={[
                    'am-headers-expand-row',
                    isMatch ? 'is-match' : '',
                    isActive ? 'is-active-match' : '',
                  ].filter(Boolean).join(' ')}
                  data-testid={`api-mock-headers-expand-row-${row.id}`}
                >
                  <input
                    className="am-input mono"
                    value={row.name}
                    onChange={e => updateRow(row.id, { name: e.target.value })}
                    placeholder="X-Tenant"
                    readOnly={readOnly}
                    aria-label="Header name"
                    data-testid={`api-mock-headers-expand-name-${row.id}`}
                  />
                  <input
                    className="am-input mono"
                    value={row.value}
                    onChange={e => updateRow(row.id, { value: e.target.value })}
                    placeholder="acme-eu"
                    readOnly={readOnly}
                    aria-label="Header value"
                    data-testid={`api-mock-headers-expand-value-${row.id}`}
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      className="am-icon-btn"
                      onClick={() => removeRow(row.id)}
                      aria-label="Remove header"
                      data-testid={`api-mock-headers-expand-remove-${row.id}`}
                    >
                      <TrashIcon size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppModalFrame>
  );

  return createPortal(modal, portalTarget);
}
