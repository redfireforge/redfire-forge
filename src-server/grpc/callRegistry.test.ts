/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cancelGrpcCall,
  clearGrpcCallRegistry,
  getGrpcCallEntry,
  markGrpcCallCompleted,
  tryRegisterGrpcCall,
} from './callRegistry.js';

describe('callRegistry', () => {
  beforeEach(() => {
    clearGrpcCallRegistry();
  });

  it('registers active calls and exposes abort signal', () => {
    const result = tryRegisterGrpcCall('req-1', 'tab-a');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.signal.aborted).toBe(false);
    }
    expect(getGrpcCallEntry('req-1')?.status).toBe('active');
  });

  it('rejects duplicate active requestId', () => {
    expect(tryRegisterGrpcCall('req-dup').ok).toBe(true);
    expect(tryRegisterGrpcCall('req-dup').ok).toBe(false);
  });

  it('allows reusing requestId after completion via cancel idempotency cleanup', () => {
    tryRegisterGrpcCall('req-2');
    expect(cancelGrpcCall('req-2')).toBe('cancelled');
    expect(cancelGrpcCall('req-2')).toBe('already_completed');
    expect(tryRegisterGrpcCall('req-2').ok).toBe(true);
  });

  it('returns tab_mismatch when tabId does not match', () => {
    tryRegisterGrpcCall('req-3', 'tab-a');
    expect(cancelGrpcCall('req-3', 'tab-b')).toBe('tab_mismatch');
  });

  it('requires tabId when call was registered with tab ownership', () => {
    tryRegisterGrpcCall('req-owned', 'tab-a');
    expect(cancelGrpcCall('req-owned')).toBe('tab_mismatch');
    expect(cancelGrpcCall('req-owned', 'tab-a')).toBe('cancelled');
  });

  it('allows cancel without tabId when call has no tab ownership', () => {
    tryRegisterGrpcCall('req-open');
    expect(cancelGrpcCall('req-open')).toBe('cancelled');
  });

  it('does not overwrite cancelled status on late completion', () => {
    tryRegisterGrpcCall('req-late');
    expect(cancelGrpcCall('req-late')).toBe('cancelled');
    markGrpcCallCompleted('req-late');
    expect(getGrpcCallEntry('req-late')?.status).toBe('cancelled');
  });

  it('marks cancelled before abort so status is visible to in-flight handlers', () => {
    tryRegisterGrpcCall('req-status-first');
    const entry = getGrpcCallEntry('req-status-first')!;
    const originalAbort = entry.abortController.abort.bind(entry.abortController);
    entry.abortController.abort = () => {
      expect(entry.status).toBe('cancelled');
      originalAbort();
    };
    expect(cancelGrpcCall('req-status-first')).toBe('cancelled');
  });
});
