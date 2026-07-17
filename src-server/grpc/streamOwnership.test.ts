/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { assertStreamTabOwnership } from './streamOwnership.js';
import type { GrpcStreamRegistryEntry } from './streamRegistry.js';

function makeEntry(overrides: Partial<GrpcStreamRegistryEntry> = {}): GrpcStreamRegistryEntry {
  return {
    streamId: 'stream-1',
    tabId: 'tab-a',
    requestId: 'req-1',
    callType: 'server_streaming',
    descriptorKey: 'desc-1',
    requestTypeName: 'echo.StreamRequest',
    status: 'active',
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
    sequence: 0,
    transport: {
      callType: 'server_streaming',
      write: () => undefined,
      endWrites: () => undefined,
      cancel: () => undefined,
    },
    sseClients: new Map(),
    ...overrides,
  };
}

describe('streamOwnership', () => {
  it('returns not_found when entry is missing', () => {
    expect(assertStreamTabOwnership(undefined, 'tab-a')).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('returns tab_mismatch when tabId differs', () => {
    expect(assertStreamTabOwnership(makeEntry(), 'tab-b')).toEqual({
      ok: false,
      reason: 'tab_mismatch',
    });
  });

  it('returns entry when tabId matches', () => {
    const entry = makeEntry();
    expect(assertStreamTabOwnership(entry, 'tab-a')).toEqual({
      ok: true,
      entry,
    });
  });
});
