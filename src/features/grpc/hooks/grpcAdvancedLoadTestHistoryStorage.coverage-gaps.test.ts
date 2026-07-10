/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GRPC_LOAD_TEST_HISTORY_STORAGE_KEY,
  readPersistedLoadTestHistoryByTab,
  writePersistedLoadTestHistoryByTab,
} from './grpcAdvancedLoadTestHistoryStorage';

describe('grpcAdvancedLoadTestHistoryStorage coverage gaps', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns empty history when localStorage is unavailable', () => {
    vi.stubGlobal('window', undefined);
    expect(readPersistedLoadTestHistoryByTab()).toEqual({});
    expect(() => writePersistedLoadTestHistoryByTab({ 'tab-1': [] })).not.toThrow();
  });

  it('returns empty history for missing, invalid, or corrupt payloads', () => {
    expect(readPersistedLoadTestHistoryByTab()).toEqual({});

    localStorage.setItem(GRPC_LOAD_TEST_HISTORY_STORAGE_KEY, JSON.stringify({
      version: 2,
      tabHistory: { 'tab-1': [] },
      updatedAt: Date.now(),
    }));
    expect(readPersistedLoadTestHistoryByTab()).toEqual({});

    localStorage.setItem(GRPC_LOAD_TEST_HISTORY_STORAGE_KEY, '{not-json');
    expect(readPersistedLoadTestHistoryByTab()).toEqual({});
  });

  it('round-trips valid history envelopes', () => {
    const tabHistory = {
      'tab-1': [{
        summary: { runId: 'run-1', kind: 'grpc_load_test_summary' },
        source: { tabId: 'tab-1', capturedAt: '2026-07-01T00:00:00.000Z' },
      }],
    };
    writePersistedLoadTestHistoryByTab(tabHistory as never);
    expect(readPersistedLoadTestHistoryByTab()).toEqual(tabHistory);
  });

  it('swallows localStorage write failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => writePersistedLoadTestHistoryByTab({ 'tab-1': [] } as never)).not.toThrow();
  });
});
