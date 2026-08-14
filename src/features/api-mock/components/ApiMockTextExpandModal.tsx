import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppModalFrame from '../../../shared/components/AppModalFrame';
import {
  findTextExpandMatches,
  formatTextExpandCount,
  nextTextExpandMatch,
  prettyPrintJsonBody,
} from './apiMockTextExpand';

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
  const pretty = prettyPrintJsonBody(draft);

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

  const modal = (
    <AppModalFrame
      title={title}
      onClose={onClose}
      dialogClassName="modal am-studio-modal am-text-expand-modal"
      overlayClassName="am-text-expand-overlay"
      bodyClassName="am-studio-modal-body am-text-expand-body"
      footerClassName="am-studio-modal-footer"
      showExpandButton={false}
      closeOnOverlayClick={false}
      dialogTestId="api-mock-text-expand-modal"
      headerActions={
        <div className="api-mock-root am-in-modal am-modal-toolbar am-text-expand-toolbar">
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
          <span className="am-faint" data-testid="api-mock-text-expand-count">
            {formatTextExpandCount(matchIndex, matches.length)}
          </span>
          <button type="button" className="am-btn small" onClick={() => goMatch(-1)} disabled={matches.length === 0} data-testid="api-mock-text-expand-prev" aria-label="Previous match">▲</button>
          <button type="button" className="am-btn small" onClick={() => goMatch(1)} disabled={matches.length === 0} data-testid="api-mock-text-expand-next" aria-label="Next match">▼</button>
          {!readOnly && (
            <>
              <button type="button" className="am-btn small" onClick={undo} disabled={past.length === 0} data-testid="api-mock-text-expand-undo">Undo</button>
              <button type="button" className="am-btn small" onClick={redo} disabled={future.length === 0} data-testid="api-mock-text-expand-redo">Redo</button>
              <button
                type="button"
                className="am-btn small"
                onClick={() => { if (pretty) commitDraft(pretty); }}
                disabled={!pretty}
                data-testid="api-mock-text-expand-pretty"
              >Pretty-print JSON</button>
            </>
          )}
        </div>
      }
      footer={
        <div
          className="api-mock-root am-in-modal am-modal-toolbar am-text-expand-footer"
          style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', marginLeft: 'auto', flexWrap: 'nowrap' }}
        >
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
    </AppModalFrame>
  );

  return createPortal(modal, document.body);
}
