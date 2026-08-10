import { describe, expect, it } from 'vitest';
import {
  getServerGrpcMockRuntimeRegistry,
  resetServerGrpcMockRuntimeRegistryForTests,
} from './grpcMockServerRuntimeBridge.js';

describe('grpcMockServerRuntimeBridge', () => {
  it('returns a singleton registry until reset is called', () => {
    resetServerGrpcMockRuntimeRegistryForTests();

    const first = getServerGrpcMockRuntimeRegistry();
    const second = getServerGrpcMockRuntimeRegistry();

    expect(second).toBe(first);
  });

  it('creates a fresh registry after reset', () => {
    resetServerGrpcMockRuntimeRegistryForTests();
    const first = getServerGrpcMockRuntimeRegistry();

    resetServerGrpcMockRuntimeRegistryForTests();
    const next = getServerGrpcMockRuntimeRegistry();

    expect(next).not.toBe(first);
  });
});
