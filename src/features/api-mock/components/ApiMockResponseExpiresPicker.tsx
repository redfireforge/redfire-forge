import { useCallback, useRef, useState } from 'react';

function toDatetimeLocal(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatExpiresDisplay(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ApiMockResponseExpiresPicker({ value, onChange }: { value?: string; onChange: (iso: string | undefined) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = useCallback(() => {
    setDraft(toDatetimeLocal(value));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [value]);

  const commitDraft = useCallback(() => {
    setEditing(false);
    if (!draft.trim()) { onChange(undefined); return; }
    const d = new Date(draft);
    if (!Number.isNaN(d.getTime())) onChange(d.toISOString());
  }, [draft, onChange]);

  const setRelative = useCallback((ms: number) => {
    onChange(new Date(Date.now() + ms).toISOString());
  }, [onChange]);

  const display = formatExpiresDisplay(value);

  return (
    <div className="am-expires-picker" data-testid="api-mock-variant-expires-at">
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
        >
          {display || <span className="am-muted">Not set</span>}
        </button>
      )}
      <div className="am-expires-actions">
        <button type="button" className="am-btn small ghost" onClick={() => setRelative(60 * 60 * 1000)} title="1 hour from now">+1h</button>
        <button type="button" className="am-btn small ghost" onClick={() => setRelative(24 * 60 * 60 * 1000)} title="24 hours from now">+24h</button>
        <button type="button" className="am-btn small ghost" onClick={() => setRelative(7 * 24 * 60 * 60 * 1000)} title="7 days from now">+7d</button>
        {value && (
          <button type="button" className="am-btn small ghost am-expires-clear" onClick={() => onChange(undefined)} title="Clear expiry">Clear</button>
        )}
      </div>
    </div>
  );
}
