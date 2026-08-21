import { useEffect, useMemo, useState } from 'react';
import {
  EXPIRES_MONTHS,
  EXPIRES_WEEKDAYS,
  buildCalendarCells,
  hourOptions,
  minuteOptions,
  partsFromIso,
  partsToIso,
  sameDay,
  setCalendarDay,
  setCalendarTime,
  shiftMonth,
  type ExpiresParts,
} from '../apiMockExpiresCalendar';
import { ChevronLeftIcon, ChevronRightIcon } from './ApiMockIcons';

interface Props {
  value?: string;
  onApply: (iso: string | undefined) => void;
  onClose: () => void;
  style?: React.CSSProperties;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function ApiMockExpiresCalendarPopover({ value, onApply, onClose, style }: Props) {
  const [draft, setDraft] = useState<ExpiresParts>(() => partsFromIso(value));
  const today = useMemo(() => partsFromIso(undefined), []);
  const cells = useMemo(() => buildCalendarCells(draft.year, draft.month), [draft.year, draft.month]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="am-expires-popover"
      role="dialog"
      aria-label="Choose expiry date"
      data-testid="api-mock-expires-calendar"
      style={style}
    >
      <div className="am-expires-cal-head">
        <button
          type="button"
          className="am-icon-btn"
          aria-label="Previous month"
          data-testid="api-mock-expires-cal-prev"
          onClick={() => setDraft(p => shiftMonth(p, -1))}
        >
          <ChevronLeftIcon size={15} />
        </button>
        <div className="am-expires-cal-title">{EXPIRES_MONTHS[draft.month]} {draft.year}</div>
        <button
          type="button"
          className="am-icon-btn"
          aria-label="Next month"
          data-testid="api-mock-expires-cal-next"
          onClick={() => setDraft(p => shiftMonth(p, 1))}
        >
          <ChevronRightIcon size={15} />
        </button>
      </div>

      <div className="am-expires-cal-weekdays">
        {EXPIRES_WEEKDAYS.map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="am-expires-cal-grid">
        {cells.map(cell => {
          const selected = sameDay(draft, cell);
          const isToday = sameDay(today, cell);
          return (
            <button
              key={cell.key}
              type="button"
              className={`am-expires-cal-day${cell.inMonth ? '' : ' outside'}${selected ? ' selected' : ''}${isToday ? ' today' : ''}`}
              aria-label={`${EXPIRES_MONTHS[cell.month]} ${cell.day}, ${cell.year}`}
              aria-pressed={selected}
              onClick={() => setDraft(p => setCalendarDay(p, cell))}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      <div className="am-expires-cal-time">
        <span className="am-expires-cal-time-label">Time</span>
        <select
          className="am-input am-expires-cal-select"
          aria-label="Hour"
          data-testid="api-mock-expires-cal-hour"
          value={draft.hour}
          onChange={e => setDraft(p => setCalendarTime(p, Number(e.target.value), p.minute))}
        >
          {hourOptions().map(h => <option key={h} value={h}>{pad2(h)}</option>)}
        </select>
        <span className="am-expires-cal-colon" aria-hidden="true">:</span>
        <select
          className="am-input am-expires-cal-select"
          aria-label="Minute"
          data-testid="api-mock-expires-cal-minute"
          value={draft.minute}
          onChange={e => setDraft(p => setCalendarTime(p, p.hour, Number(e.target.value)))}
        >
          {minuteOptions().map(m => <option key={m} value={m}>{pad2(m)}</option>)}
        </select>
      </div>

      <div className="am-expires-cal-footer">
        <button
          type="button"
          className="am-btn small ghost"
          data-testid="api-mock-expires-cal-clear"
          onClick={() => onApply(undefined)}
        >
          Clear
        </button>
        <button
          type="button"
          className="am-btn small ghost"
          data-testid="api-mock-expires-cal-today"
          onClick={() => setDraft(partsFromIso(undefined))}
        >
          Today
        </button>
        <span className="am-spacer" />
        <button type="button" className="am-btn small ghost" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="am-btn small primary"
          data-testid="api-mock-expires-cal-apply"
          onClick={() => onApply(partsToIso(draft))}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
