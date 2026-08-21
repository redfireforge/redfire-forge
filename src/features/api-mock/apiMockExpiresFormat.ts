import type { ApiMockBehaviorV1 } from '../../shared/api-mock/contracts';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local `datetime-local` value (`YYYY-MM-DDTHH:MM`) from an ISO timestamp. */
export function toDatetimeLocal(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Human expiry label used in the Timing field and eligibility summary. */
export function formatExpiresDisplay(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}  ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function commitLocalDatetime(raw: string, onChange: (iso: string | undefined) => void): void {
  if (!raw.trim()) { onChange(undefined); return; }
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) onChange(d.toISOString());
}

export function formatTimingSpread(delayMs: number, jitterMs: number): string {
  return `${delayMs}±${jitterMs} ms`;
}

export function formatEligibilitySummary(behavior: ApiMockBehaviorV1): string {
  const limit = behavior.maxMatches == null ? 'Unlimited matches' : `Limit ${behavior.maxMatches}`;
  const expires = behavior.expiresAt
    ? `Expires ${formatExpiresDisplay(behavior.expiresAt) || behavior.expiresAt}`
    : 'Never expires';
  const probability = behavior.probability == null || behavior.probability >= 1
    ? 'Always eligible'
    : `P=${behavior.probability}`;
  return `${limit} · ${expires} · ${probability}`;
}
