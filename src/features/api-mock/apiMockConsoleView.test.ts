import { describe, expect, it } from 'vitest';
import {
  classifyConsoleLine,
  countConsoleEvents,
  filterConsoleLines,
  formatConsoleLine,
} from './apiMockConsoleView';

const started = { ts: '2026-08-12T00:00:00.000Z', level: 'info', message: 'Started "Mock Server 1" on :4600' };
const stopped = { ts: '2026-08-12T00:00:05.000Z', level: 'info', message: 'Stopped "srv-1"' };
const applied = { ts: '2026-08-12T00:00:08.000Z', level: 'info', message: 'Committed gen 2 for "srv-1"' };
const leveled = { ts: '2026-08-12T00:00:09.000Z', level: 'error', message: 'listener crashed' };
const warned = { level: 'warn', message: 'bind retry' };
const warning = { level: 'warning', message: 'deprecated flag' };
const failed = { message: 'proxy failed to connect' };
const other = { message: 'bare line' };

describe('apiMockConsoleView', () => {
  it('formats lines with and without timestamp/level', () => {
    expect(formatConsoleLine(started)).toContain('Started "Mock Server 1" on :4600');
    expect(formatConsoleLine(started)).toContain('[info]');
    expect(formatConsoleLine(other)).toBe('bare line');
  });

  it('classifies lifecycle, apply, and error lines', () => {
    expect(classifyConsoleLine(started)).toBe('started');
    expect(classifyConsoleLine(stopped)).toBe('stopped');
    expect(classifyConsoleLine(applied)).toBe('applied');
    expect(classifyConsoleLine(leveled)).toBe('error');
    expect(classifyConsoleLine(warned)).toBe('error');
    expect(classifyConsoleLine(warning)).toBe('error');
    expect(classifyConsoleLine(failed)).toBe('error');
    expect(classifyConsoleLine(other)).toBe('other');
    expect(classifyConsoleLine({ message: '' })).toBe('other');
  });

  it('filters by event chip and search query', () => {
    const lines = [started, stopped, applied, leveled, other];
    expect(filterConsoleLines(lines, '', 'all')).toHaveLength(5);
    expect(filterConsoleLines(lines, '', 'started').map(l => l.message)).toEqual([started.message]);
    expect(filterConsoleLines(lines, '', 'stopped')).toEqual([stopped]);
    expect(filterConsoleLines(lines, '', 'applied')).toEqual([applied]);
    expect(filterConsoleLines(lines, '', 'errors')).toEqual([leveled]);
    expect(filterConsoleLines(lines, 'gen 2', 'all')).toEqual([applied]);
    expect(filterConsoleLines(lines, 'missing', 'all')).toEqual([]);
    expect(filterConsoleLines(lines, 'STARTED', 'started')).toEqual([started]);
    expect(filterConsoleLines(lines, 'Started', 'stopped')).toEqual([]);
  });

  it('counts events for filter badges', () => {
    expect(countConsoleEvents([started, started, stopped, applied, leveled, other])).toEqual({
      all: 6,
      started: 2,
      stopped: 1,
      applied: 1,
      errors: 1,
    });
    expect(countConsoleEvents([])).toEqual({ all: 0, started: 0, stopped: 0, applied: 0, errors: 0 });
  });
});
