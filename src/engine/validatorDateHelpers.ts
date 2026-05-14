import type { DateReference } from '../shared/types';

export function resolveDate(ref: DateReference): string {
  if (ref.kind === 'fixed') return ref.iso.slice(0, 10);
  const now = new Date();
  if (ref.timezone === 'utc') {
    return now.toISOString().slice(0, 10);
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function toDayString(val: unknown): string | null {
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  if (typeof val === 'number') {
    return new Date(val).toISOString().slice(0, 10);
  }
  return null;
}

export function truncateToUnit(d: Date, precision: 'day' | 'hour' | 'minute' | 'second' | 'millisecond'): number {
  switch (precision) {
    case 'millisecond': return d.getTime();
    case 'second': return Math.floor(d.getTime() / 1000);
    case 'minute': return Math.floor(d.getTime() / 60000);
    case 'hour': return Math.floor(d.getTime() / 3600000);
    case 'day': return Math.floor(d.getTime() / 86400000);
  }
}
