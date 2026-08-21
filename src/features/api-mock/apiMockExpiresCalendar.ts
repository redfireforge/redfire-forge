export const EXPIRES_WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
export const EXPIRES_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export interface ExpiresParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface ExpiresCalendarCell {
  year: number;
  month: number;
  day: number;
  inMonth: boolean;
  key: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function clampDay(year: number, month: number, day: number): number {
  return Math.min(Math.max(1, day), daysInMonth(year, month));
}

export function partsFromDate(d: Date): ExpiresParts {
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
}

export function partsFromIso(iso?: string, fallback: Date = new Date()): ExpiresParts {
  if (!iso) return partsFromDate(fallback);
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? partsFromDate(fallback) : partsFromDate(d);
}

export function partsToDate(parts: ExpiresParts): Date {
  return new Date(parts.year, parts.month, parts.day, parts.hour, parts.minute, 0, 0);
}

export function partsToIso(parts: ExpiresParts): string {
  return partsToDate(parts).toISOString();
}

export function partsToLocalDatetime(parts: ExpiresParts): string {
  return `${parts.year}-${pad2(parts.month + 1)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function sameDay(a: ExpiresParts, b: Pick<ExpiresParts, 'year' | 'month' | 'day'>): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function shiftMonth(parts: ExpiresParts, delta: number): ExpiresParts {
  const raw = parts.month + delta;
  const year = parts.year + Math.floor(raw / 12);
  const month = ((raw % 12) + 12) % 12;
  return { ...parts, year, month, day: clampDay(year, month, parts.day) };
}

export function setCalendarDay(parts: ExpiresParts, cell: Pick<ExpiresCalendarCell, 'year' | 'month' | 'day'>): ExpiresParts {
  return { ...parts, year: cell.year, month: cell.month, day: cell.day };
}

export function setCalendarTime(parts: ExpiresParts, hour: number, minute: number): ExpiresParts {
  return {
    ...parts,
    hour: Math.min(23, Math.max(0, hour)),
    minute: Math.min(59, Math.max(0, minute)),
  };
}

/** Sunday-start 6×7 grid, including leading/trailing days from adjacent months. */
export function buildCalendarCells(year: number, month: number): ExpiresCalendarCell[] {
  const firstDow = new Date(year, month, 1).getDay();
  const count = daysInMonth(year, month);
  const prevCount = daysInMonth(year, month - 1);
  const prev = shiftMonth({ year, month, day: 1, hour: 0, minute: 0 }, -1);
  const next = shiftMonth({ year, month, day: 1, hour: 0, minute: 0 }, 1);
  const cells: ExpiresCalendarCell[] = [];

  for (let i = firstDow - 1; i >= 0; i -= 1) {
    const day = prevCount - i;
    cells.push({ year: prev.year, month: prev.month, day, inMonth: false, key: `${prev.year}-${prev.month}-${day}` });
  }
  for (let day = 1; day <= count; day += 1) {
    cells.push({ year, month, day, inMonth: true, key: `${year}-${month}-${day}` });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    const day = nextDay;
    cells.push({ year: next.year, month: next.month, day, inMonth: false, key: `${next.year}-${next.month}-${day}` });
    nextDay += 1;
  }
  return cells;
}

export function hourOptions(): number[] {
  return Array.from({ length: 24 }, (_, i) => i);
}

export function minuteOptions(): number[] {
  return Array.from({ length: 60 }, (_, i) => i);
}

export function expiresPopoverAnchor(
  rect: { left: number; bottom: number } | undefined,
  viewportWidth: number,
  width = 312,
): { top: number; left: number } {
  const left = Math.min(Math.max(12, rect?.left ?? 12), Math.max(12, viewportWidth - width - 12));
  return { top: (rect?.bottom ?? 4) + 8, left };
}
