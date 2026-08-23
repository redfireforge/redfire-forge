import { describe, it, expect } from 'vitest';
import type { CollectionRunEvent } from '@shared/types/graphql';
import {
  buildRunnerConsoleEntries,
  buildRunnerExportPayload,
  formatRunnerEventSummary,
  isRunnerResultEvent,
  runnerExportFilename,
} from './runnerPanelUtils';

describe('runnerPanelUtils — coverage gaps', () => {
  it('formatRunnerEventSummary covers skip, error, and result branches', () => {
    expect(formatRunnerEventSummary({ type: 'skip', itemId: 'i1' } as CollectionRunEvent)).toBe('Skipped');
    expect(formatRunnerEventSummary({
      type: 'skip',
      itemId: 'i1',
      error: { message: 'preflight' },
    } as CollectionRunEvent)).toContain('preflight');
    expect(formatRunnerEventSummary({
      type: 'error',
      itemId: 'i1',
      latencyMs: 12,
      error: { message: 'boom' },
    } as CollectionRunEvent)).toContain('boom');
    expect(formatRunnerEventSummary({
      type: 'error',
      itemId: 'i1',
    } as CollectionRunEvent)).toBe('Failed');
    expect(formatRunnerEventSummary({
      type: 'result',
      itemId: 'i1',
      latencyMs: 5,
      tests: [{ passed: true }, { passed: false }],
    } as CollectionRunEvent)).toContain('1/2 tests');
    expect(formatRunnerEventSummary({
      type: 'result',
      itemId: 'i1',
    } as CollectionRunEvent)).toContain('—');
  });

  it('buildRunnerConsoleEntries uses logs when present', () => {
    const events: CollectionRunEvent[] = [{
      type: 'result',
      itemId: 'item-1',
      logs: [{ level: 'log', message: 'hello', timestamp: 1 }],
    } as CollectionRunEvent];
    const entries = buildRunnerConsoleEntries(events, new Map([['item-1', 'Health']]));
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('hello');
    expect(entries[0].itemName).toBe('Health');
  });

  it('buildRunnerExportPayload counts result types', () => {
    const events: CollectionRunEvent[] = [
      { type: 'result', itemId: 'a' } as CollectionRunEvent,
      { type: 'error', itemId: 'b' } as CollectionRunEvent,
      { type: 'skip', itemId: 'c' } as CollectionRunEvent,
      { type: 'start', itemId: 'd' } as CollectionRunEvent,
    ];
    const payload = buildRunnerExportPayload('Demo', events);
    expect(payload.summary).toEqual({ passed: 1, failed: 1, skipped: 1 });
    expect(isRunnerResultEvent(events[0])).toBe(true);
    expect(isRunnerResultEvent(events[3])).toBe(false);
  });

  it('runnerExportFilename slugifies collection name', () => {
    expect(runnerExportFilename('My Collection!')).toMatch(/^runner-results-my-collection-\d+\.json$/);
    expect(runnerExportFilename('!!!')).toMatch(/^runner-results-collection-\d+\.json$/);
  });
});
