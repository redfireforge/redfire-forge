/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cancelGrpcCall,
  clearGrpcCallRegistry,
  getGrpcCallEntry,
  markGrpcCallCancelled,
  markGrpcCallCompleted,
  registerGrpcCall,
  removeGrpcCallEntry,
  tryRegisterGrpcCall,
} from './callRegistry.js';

describe('callRegistry coverage gaps', () => {
  beforeEach(() => {
    clearGrpcCallRegistry();
  });

  it('registerGrpcCall returns abort controller for new requestId', () => {
    const { abortController, signal } = registerGrpcCall('req-register', 'tab-a');
    expect(signal.aborted).toBe(false);
    expect(abortController).toBe(getGrpcCallEntry('req-register')?.abortController);
  });

  it('registerGrpcCall throws when requestId is already active', () => {
    registerGrpcCall('req-dup');
    expect(() => registerGrpcCall('req-dup')).toThrow(/already in use/i);
  });

  it('reuses requestId after prior entry was completed', () => {
    tryRegisterGrpcCall('req-reuse');
    markGrpcCallCompleted('req-reuse');
    const second = tryRegisterGrpcCall('req-reuse');
    expect(second.ok).toBe(true);
  });

  it('markGrpcCallCancelled updates active entry status', () => {
    tryRegisterGrpcCall('req-cancel-mark');
    markGrpcCallCancelled('req-cancel-mark');
    expect(getGrpcCallEntry('req-cancel-mark')?.status).toBe('cancelled');
  });

  it('removeGrpcCallEntry deletes registry entry', () => {
    tryRegisterGrpcCall('req-remove');
    removeGrpcCallEntry('req-remove');
    expect(getGrpcCallEntry('req-remove')).toBeUndefined();
  });

  it('cancelGrpcCall returns not_found for unknown requestId', () => {
    expect(cancelGrpcCall('missing')).toBe('not_found');
  });
});
