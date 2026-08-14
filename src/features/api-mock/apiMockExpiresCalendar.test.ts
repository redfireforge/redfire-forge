import { describe, expect, it } from 'vitest';
import {
  buildCalendarCells,
  clampDay,
  daysInMonth,
  hourOptions,
  minuteOptions,
  partsFromDate,
  partsFromIso,
  partsToIso,
  partsToLocalDatetime,
  sameDay,
  setCalendarDay,
  setCalendarTime,
  shiftMonth,
  expiresPopoverAnchor,
} from './apiMockExpiresCalendar';

describe('apiMockExpiresCalendar', () => {
  it('builds a Sunday-start 42-cell grid for August 2026', () => {
    const cells = buildCalendarCells(2026, 7);
    expect(cells).toHaveLength(42);
    expect(cells[0]).toMatchObject({ day: 26, month: 6, inMonth: false });
    expect(cells[6]).toMatchObject({ day: 1, month: 7, inMonth: true });
    expect(cells[19]).toMatchObject({ day: 14, month: 7, inMonth: true });
    expect(cells[41]).toMatchObject({ day: 5, month: 8, inMonth: false });
  });

  it('clamps days when shifting from a 31-day month into February', () => {
    expect(daysInMonth(2026, 1)).toBe(28);
    expect(clampDay(2026, 1, 31)).toBe(28);
    const shifted = shiftMonth({ year: 2026, month: 0, day: 31, hour: 9, minute: 15 }, 1);
    expect(shifted).toEqual({ year: 2026, month: 1, day: 28, hour: 9, minute: 15 });
    expect(shiftMonth(shifted, -1).month).toBe(0);
    expect(shiftMonth({ year: 2026, month: 0, day: 1, hour: 0, minute: 0 }, -1)).toMatchObject({
      year: 2025, month: 11, day: 1,
    });
  });

  it('parses ISO parts, falls back for empty or invalid, and writes local datetime', () => {
    const fallback = new Date(2026, 7, 14, 16, 2);
    expect(partsFromIso(undefined, fallback)).toEqual(partsFromDate(fallback));
    expect(partsFromIso('not-a-date', fallback)).toEqual(partsFromDate(fallback));
    const iso = new Date(2026, 11, 25, 9, 15).toISOString();
    const parts = partsFromIso(iso);
    expect(partsToLocalDatetime(parts)).toBe('2026-12-25T09:15');
    expect(partsToIso(parts)).toBe(iso);
  });

  it('updates day and clamps time', () => {
    const base = { year: 2026, month: 7, day: 14, hour: 16, minute: 2 };
    expect(setCalendarDay(base, { year: 2026, month: 8, day: 1 })).toMatchObject({
      year: 2026, month: 8, day: 1, hour: 16, minute: 2,
    });
    expect(setCalendarTime(base, 25, -4)).toEqual({ ...base, hour: 23, minute: 0 });
    expect(sameDay(base, { year: 2026, month: 7, day: 14 })).toBe(true);
    expect(sameDay(base, { year: 2026, month: 7, day: 15 })).toBe(false);
    expect(hourOptions()).toHaveLength(24);
    expect(minuteOptions()).toHaveLength(60);
  });

  it('anchors the popover inside the viewport', () => {
    expect(expiresPopoverAnchor(undefined, 1280)).toEqual({ top: 12, left: 12 });
    expect(expiresPopoverAnchor({ left: 40, bottom: 80 }, 1280)).toEqual({ top: 88, left: 40 });
    expect(expiresPopoverAnchor({ left: 1200, bottom: 20 }, 1280).left).toBe(956);
  });
});
