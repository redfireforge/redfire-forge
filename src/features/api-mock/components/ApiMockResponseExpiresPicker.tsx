import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { expiresPopoverAnchor } from '../apiMockExpiresCalendar';
import { commitLocalDatetime, formatExpiresDisplay, toDatetimeLocal } from '../apiMockExpiresFormat';
import { CalendarIcon } from './ApiMockIcons';
import { ApiMockExpiresCalendarPopover } from './ApiMockExpiresCalendarPopover';

// Re-export so a stale HMR graph that still imports this helper from the picker keeps working.
export { formatExpiresDisplay }; // eslint-disable-line react-refresh/only-export-components

export function ApiMockResponseExpiresPicker({ value, onChange }: { value?: string; onChange: (iso: string | undefined) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const startEdit = useCallback(() => {
    setOpen(false);
    setDraft(toDatetimeLocal(value));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [value]);

  const commitDraft = useCallback(() => {
    setEditing(false);
    commitLocalDatetime(draft, onChange);
  }, [draft, onChange]);

  const openCalendar = useCallback(() => {
    setEditing(false);
    const rect = fieldRef.current?.getBoundingClientRect();
    setAnchor(expiresPopoverAnchor(rect, window.innerWidth));
    setOpen(true);
  }, []);

  const closeCalendar = useCallback(() => setOpen(false), []);

  const applyCalendar = useCallback((iso: string | undefined) => {
    setOpen(false);
    onChange(iso);
  }, [onChange]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (fieldRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const setRelative = useCallback((ms: number) => {
    onChange(new Date(Date.now() + ms).toISOString());
  }, [onChange]);

  const display = formatExpiresDisplay(value);

  return (
    <div className="am-expires-picker" data-testid="api-mock-variant-expires-at">
      <div className="am-expires-field" ref={fieldRef}>
        {editing ? (
          <input
            ref={inputRef}
            className="am-input mono am-expires-input"
            type="text"
            placeholder="YYYY-MM-DDTHH:MM"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={e => { if (e.key === 'Enter') commitDraft(); if (e.key === 'Escape') setEditing(false); }}
          />
        ) : (
          <button
            type="button"
            className="am-expires-display"
            onClick={startEdit}
            title={value ? `ISO: ${value}` : 'Click to set expiry'}
            data-testid="api-mock-expires-display"
          >
            {display || <span className="am-muted">Not set</span>}
          </button>
        )}
        <button
          type="button"
          className={`am-icon-btn am-expires-calendar-btn${open ? ' active' : ''}`}
          title="Pick expiry date"
          aria-label="Pick expiry date"
          aria-expanded={open}
          data-testid="api-mock-expires-calendar-btn"
          onClick={() => { if (open) closeCalendar(); else openCalendar(); }}
        >
          <CalendarIcon size={14} />
        </button>
      </div>
      <div className="am-expires-actions">
        <button type="button" className="am-btn small ghost" onClick={() => setRelative(60 * 60 * 1000)} title="1 hour from now" data-testid="api-mock-expires-quick-1h">+1h</button>
        <button type="button" className="am-btn small ghost" onClick={() => setRelative(24 * 60 * 60 * 1000)} title="24 hours from now" data-testid="api-mock-expires-quick-24h">+24h</button>
        <button type="button" className="am-btn small ghost" onClick={() => setRelative(7 * 24 * 60 * 60 * 1000)} title="7 days from now" data-testid="api-mock-expires-quick-7d">+7d</button>
        {value && (
          <button type="button" className="am-btn small ghost am-expires-clear" onClick={() => onChange(undefined)} title="Clear expiry">Clear</button>
        )}
      </div>
      {open && createPortal(
        <div ref={popoverRef}>
          <ApiMockExpiresCalendarPopover
            value={value}
            onApply={applyCalendar}
            onClose={closeCalendar}
            style={{ top: anchor.top, left: anchor.left }}
          />
        </div>,
        document.querySelector('.api-mock-root') ?? document.body,
      )}
    </div>
  );
}
