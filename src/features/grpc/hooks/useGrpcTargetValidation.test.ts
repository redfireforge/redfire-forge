/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGrpcTargetValidation } from './useGrpcTargetValidation';

describe('useGrpcTargetValidation', () => {
  it('validates resolved env var targets', () => {
    const { result } = renderHook(() => useGrpcTargetValidation({
      target: '',
      fallbackTarget: '{{grpcHost}}',
      envVarMap: { grpcHost: 'localhost:50051' },
      tlsMode: 'disabled',
    }));
    expect(result.current.ok).toBe(true);
    expect(result.current.normalized).toBe('localhost:50051');
    expect(result.current.usingFallback).toBe(true);
  });

  it('fails when env vars are unresolved', () => {
    const { result } = renderHook(() => useGrpcTargetValidation({
      target: '{{missing}}',
      envVarMap: {},
    }));
    expect(result.current.ok).toBe(false);
    expect(result.current.message).toMatch(/Resolve \{\{missing\}\}/i);
  });

  it('fails with env-manager hint when grpcHost is missing (Phase 9D)', () => {
    const { result } = renderHook(() => useGrpcTargetValidation({
      target: '{{grpcHost}}',
      envVarMap: {},
    }));
    expect(result.current.ok).toBe(false);
    expect(result.current.message).toMatch(/Environment Manager/i);
  });

  it('preserves escaped interpolation literals (Phase 9B grammar)', () => {
    const { result } = renderHook(() => useGrpcTargetValidation({
      target: String.raw`\{{grpcHost}}`,
      envVarMap: { grpcHost: 'localhost:50051' },
    }));
    expect(result.current.resolvedTarget).toBe(String.raw`\{{grpcHost}}`);
    expect(result.current.ok).toBe(false);
  });

  it('fails when profile target uses invalid grpcHost without tab override (Phase 9D)', () => {
    const { result } = renderHook(() => useGrpcTargetValidation({
      target: '',
      envVarMap: { grpcHost: 'http://bad:50051' },
      connectionId: 'profile-1',
      profiles: [{
        id: 'profile-1',
        name: 'Orders',
        target: '{{grpcHost}}',
        tlsMode: 'disabled',
      }],
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));
    expect(result.current.ok).toBe(false);
    expect(result.current.message).toMatch(/Environment Manager/i);
  });

  it('fails when merged env variables form a cycle (Phase 9E)', () => {
    const { result } = renderHook(() => useGrpcTargetValidation({
      target: '{{grpcHost}}',
      envVarMap: {
        grpcHost: '{{apiHost}}',
        apiHost: '{{grpcHost}}',
      },
    }));
    expect(result.current.ok).toBe(false);
    expect(result.current.message).toMatch(/Circular variable reference:/);
    expect(result.current.message).toMatch(/grpcHost/);
    expect(result.current.message).toMatch(/apiHost/);
    expect(result.current.diagnostic?.code).toBe('grpc.interpolation.cycle');
    expect(result.current.diagnostic?.tokenPath).toContain('grpcHost');
    expect(result.current.diagnostic?.tokenPath).toContain('apiHost');
    expect(result.current.diagnostic?.tokenPath!.length).toBeGreaterThanOrEqual(3);
  });

  it('returns sanitized diagnostic for missing grpcHost (Phase 9G)', () => {
    const { result } = renderHook(() => useGrpcTargetValidation({
      target: '{{grpcHost}}',
      envVarMap: { bearerToken: 'secret-bearer-value' },
    }));
    expect(result.current.ok).toBe(false);
    expect(result.current.diagnostic?.code).toBe('grpc.interpolation.missing_token');
    expect(result.current.message).not.toMatch(/secret-bearer-value/);
  });

  it('includes tls mode in ready message', () => {
    const { result } = renderHook(() => useGrpcTargetValidation({
      target: 'localhost:50051',
      envVarMap: {},
      tlsMode: 'mtls',
    }));
    expect(result.current.ok).toBe(true);
    expect(result.current.message).toMatch(/mTLS transport enabled/i);
  });

  it('merges workspace defaults below active environment', () => {
    const { result } = renderHook(() => useGrpcTargetValidation({
      target: '{{grpcHost}}',
      workspaceDefaults: { grpcHost: 'workspace:50051' },
      envVarMap: { grpcHost: 'env:50051' },
    }));
    expect(result.current.ok).toBe(true);
    expect(result.current.normalized).toBe('env:50051');
  });
});
