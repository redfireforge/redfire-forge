import { useState, useRef, useMemo, useEffect, useCallback } from 'react';

interface ValidationResponsePreviewProps {
  responsePreviewJson: string;
  isPending: boolean;
}

export default function ValidationResponsePreview({ responsePreviewJson, isPending }: ValidationResponsePreviewProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [responseSearchTerm, setResponseSearchTerm] = useState('');
  const [responseSearchIndex, setResponseSearchIndex] = useState(-1);
  const responseTextareaRef = useRef<HTMLTextAreaElement>(null);

  const responseSearchMatches = useMemo(() => {
    if (!responseSearchTerm || !responsePreviewJson) return [];
    const lower = responseSearchTerm.toLowerCase();
    const text = responsePreviewJson.toLowerCase();
    const matches: number[] = [];
    let idx = 0;
    while (idx < text.length) {
      const found = text.indexOf(lower, idx);
      if (found < 0) break;
      matches.push(found);
      idx = found + 1;
    }
    return matches;
  }, [responseSearchTerm, responsePreviewJson]);

  useEffect(() => {
    setResponseSearchIndex(-1);
  }, [responseSearchTerm]);

  const focusResponseMatch = useCallback((index: number) => {
    if (responseSearchMatches.length === 0) return;
    const wrapped = ((index % responseSearchMatches.length) + responseSearchMatches.length) % responseSearchMatches.length;
    setResponseSearchIndex(wrapped);
    const el = responseTextareaRef.current;
    if (el) {
      const start = responseSearchMatches[wrapped];
      el.focus();
      el.setSelectionRange(start, start + responseSearchTerm.length);
      const linesBefore = responsePreviewJson.slice(0, start).split('\n').length - 1;
      el.scrollTop = linesBefore * 16 - el.clientHeight / 2;
    }
  }, [responseSearchMatches, responseSearchTerm, responsePreviewJson]);

  return (
    <div className={`validation-response-preview ${isPending ? 'validation-response-preview--pending' : ''} ${collapsed ? 'validation-response-preview--collapsed' : ''}`}>
      <div
        className="validation-response-preview-header"
        onClick={() => setCollapsed(c => !c)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed(c => !c); } }}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand sample response' : 'Collapse sample response'}
      >
        <span className="validation-response-preview-toggle">{collapsed ? '▶' : '▼'}</span>
        <span className="validation-response-preview-title">
          {isPending ? 'Fetched response (pending apply)' : 'Current sample response'}
        </span>
        <span className="validation-response-preview-meta">
          {(responsePreviewJson.length / 1024).toFixed(1)} KB
        </span>
      </div>
      {!collapsed && (
        <>
          <div className="validation-response-preview-search">
            <input
              type="text"
              className="validation-response-preview-search-input"
              placeholder="Search response…"
              value={responseSearchTerm}
              onChange={(e) => setResponseSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (responseSearchMatches.length > 0) {
                    const next = responseSearchIndex < 0
                      ? (e.shiftKey ? responseSearchMatches.length - 1 : 0)
                      : responseSearchIndex + (e.shiftKey ? -1 : 1);
                    focusResponseMatch(next);
                  }
                } else if (e.key === 'Escape' && responseSearchTerm) {
                  e.preventDefault();
                  setResponseSearchTerm('');
                }
              }}
              aria-label="Search sample response"
            />
            {responseSearchTerm && (
              <span className="validation-response-preview-search-count">
                {responseSearchMatches.length === 0
                  ? 'No matches'
                  : responseSearchIndex < 0
                    ? `${responseSearchMatches.length} match${responseSearchMatches.length === 1 ? '' : 'es'}`
                    : `${responseSearchIndex + 1} / ${responseSearchMatches.length}`}
              </span>
            )}
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => focusResponseMatch(responseSearchIndex < 0 ? responseSearchMatches.length - 1 : responseSearchIndex - 1)}
              disabled={responseSearchMatches.length === 0}
              title="Previous match (Shift+Enter)"
              aria-label="Previous match"
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => focusResponseMatch(responseSearchIndex < 0 ? 0 : responseSearchIndex + 1)}
              disabled={responseSearchMatches.length === 0}
              title="Next match (Enter)"
              aria-label="Next match"
            >
              ↓
            </button>
            {responseSearchTerm && (
              <button
                type="button"
                className="btn btn-xs"
                onClick={() => setResponseSearchTerm('')}
                title="Clear search (Esc)"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <textarea
            ref={responseTextareaRef}
            className="validation-response-preview-textarea"
            value={responsePreviewJson}
            readOnly
            rows={8}
            aria-label={isPending ? 'Fetched response preview' : 'Current sample response'}
          />
        </>
      )}
    </div>
  );
}
