import { describe, it, expect } from 'vitest';
import {
  buildRunnerConsoleEntries,
  buildRunnerExportPayload,
  formatRunnerEventSummary,
  runnerExportFilename,
} from './runnerPanelUtils';
import type { CollectionRunEvent } from '../../../shared/types/graphql';

const itemNames = new Map([['item-1', 'Lesson 8 Health']]);

describe('formatRunnerEventSummary', () => {
  it('summarizes a successful result', () => {
    expect(formatRunnerEventSummary({
      type: 'result',
      itemId: 'item-1',
      latencyMs: 58,
      tests: [],
    })).toBe('Completed in 58ms');
  });

  it('summarizes an error', () => {
    expect(formatRunnerEventSummary({
      type: 'error',
      itemId: 'item-1',
      latencyMs: 40,
      error: { phase: 'http', message: 'HTTP 500' },
    })).toBe('Failed (40ms) — HTTP 500');
  });
});

describe('buildRunnerConsoleEntries', () => {
  it('uses script logs when present', () => {
    const events: CollectionRunEvent[] = [{
      type: 'result',
      itemId: 'item-1',
      logs: [{ level: 'log', message: 'token refreshed', timestamp: 1000 }],
    }];
    const entries = buildRunnerConsoleEntries(events, itemNames);
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('token refreshed');
  });

  it('falls back to run summary when no script logs', () => {
    const events: CollectionRunEvent[] = [{
      type: 'result',
      itemId: 'item-1',
      latencyMs: 58,
      logs: [],
    }];
    const entries = buildRunnerConsoleEntries(events, itemNames);
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('Completed in 58ms');
    expect(entries[0].itemName).toBe('Lesson 8 Health');
  });
});

describe('buildRunnerExportPayload', () => {
  it('includes collection name and summary counts', () => {
    const events: CollectionRunEvent[] = [
      { type: 'result', itemId: 'a' },
      { type: 'error', itemId: 'b', error: { phase: 'http', message: 'fail' } },
      { type: 'start', itemId: 'c' },
    ];
    const payload = buildRunnerExportPayload('New Collection', events);
    expect(payload.collection).toBe('New Collection');
    expect(payload.summary).toEqual({ passed: 1, failed: 1, skipped: 0 });
    expect(payload.events).toBe(events);
    expect(payload.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('runnerExportFilename', () => {
  it('slugifies the collection name', () => {
    expect(runnerExportFilename('New Collection')).toMatch(/^runner-results-new-collection-\d+\.json$/);
  });
});
