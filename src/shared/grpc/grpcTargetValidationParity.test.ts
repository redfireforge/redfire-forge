/**
 * Phase 9D — UI and server target validation message parity.
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGrpcTargetValidation } from '../../features/grpc/hooks/useGrpcTargetValidation';
import { validateGrpcStatusAddress } from './requestValidation';
import { validatePhase1UnaryCallRequest } from './requestValidation';
import { FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import { resolveTabConnectionWithEnv } from '../../features/grpc/hooks/grpcStudioSessionHelpers';

describe('grpcTargetValidation UI/server parity (Phase 9D)', () => {
  it('missing grpcHost produces identical messages in UI and status validation', () => {
    const { result } = renderHook(() => useGrpcTargetValidation({
      target: '{{grpcHost}}',
      envVarMap: {},
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    const serverIssues = validateGrpcStatusAddress('{{grpcHost}}');
    expect(result.current.ok).toBe(false);
    expect(serverIssues).toHaveLength(1);
    expect(result.current.message).toBe(serverIssues[0]!.message);
    expect(result.current.message).toContain('Environment Manager');
  });

  it('illegal scheme produces identical messages in UI and call validation', () => {
    const address = 'https://localhost:50051';
    const { result } = renderHook(() => useGrpcTargetValidation({
      target: address,
      envVarMap: {},
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    const serverIssues = validatePhase1UnaryCallRequest({
      ...FIXTURE_UNARY_CALL_REQUEST,
      target: { address, tlsMode: 'disabled' },
    }).filter((issue) => issue.field === 'target.address');

    expect(result.current.ok).toBe(false);
    expect(serverIssues).toHaveLength(1);
    expect(result.current.message).toBe(serverIssues[0]!.message);
    expect(result.current.message).toContain('URL scheme');
  });

  it('invalid grpcHost env value matches execute preflight message for profile targets', () => {
    const profiles = [{
      id: 'profile-1',
      name: 'Orders',
      target: '{{grpcHost}}',
      tlsMode: 'disabled' as const,
    }];
    const envVarMap = { grpcHost: 'http://bad:50051' };

    const { result } = renderHook(() => useGrpcTargetValidation({
      target: '',
      envVarMap,
      connectionId: 'profile-1',
      profiles,
      pageDefaults: { target: 'localhost:50051', tlsMode: 'disabled' },
    }));

    const resolution = resolveTabConnectionWithEnv(
      { target: '', connectionId: 'profile-1', tlsMode: 'disabled' },
      envVarMap,
      profiles,
      { target: 'localhost:50051', tlsMode: 'disabled' },
    );

    expect(result.current.ok).toBe(false);
    expect(resolution.targetValidation.valid).toBe(false);
    if (!resolution.targetValidation.valid) {
      expect(result.current.message).toBe(resolution.targetValidation.reason);
    }
    expect(result.current.message).toContain('Environment Manager');
  });
});
