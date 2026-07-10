/**
 * @vitest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Microservice } from '../../../shared/types';
import { useGrpcStudioPageEnvContext } from './useGrpcStudioPageEnvContext';

const selectedSvc: Microservice = {
  id: 'svc-1',
  name: 'Echo',
  baseUrls: { dev: 'https://echo.dev' },
  authProfileIds: { dev: 'auth-profile-1' },
  protocolEndpoints: {
    grpc: {
      dev: { baseUrl: 'grpc.dev:50051' },
    },
  },
};

describe('useGrpcStudioPageEnvContext coverage gaps', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds env map from selected service and environment id', () => {
    const { result } = renderHook(() => useGrpcStudioPageEnvContext({
      selectedSvc,
      selectedEnvId: 'dev',
      envName: 'Development',
    }));

    expect(result.current.envVarMap.grpcHost).toBe('grpc.dev:50051');
    expect(result.current.pageDefaults.target).toBe('grpc.dev:50051');
    expect(result.current.endpointProtocolStatus).toBeTruthy();
    expect(result.current.defaultAuthProfileId).toBe('auth-profile-1');
  });

  it('uses legacy env map when service selectors are unavailable', () => {
    const { result } = renderHook(() => useGrpcStudioPageEnvContext({
      resolvedBaseUrl: 'localhost:50051',
      envName: 'Local',
      svcName: 'Echo',
    }));

    expect(result.current.envVarMap.grpcHost).toBe('localhost:50051');
    expect(result.current.workspaceDefaults.grpcHost).toBe('localhost:50051');
    expect(result.current.workspaceDefaults.envName).toBe('Local');
    expect(result.current.endpointProtocolStatus).toBeUndefined();
    expect(result.current.defaultAuthProfileId).toBeNull();
  });

  it('merges workspaceDefaultsOverride over legacy defaults', () => {
    const { result } = renderHook(() => useGrpcStudioPageEnvContext({
      resolvedBaseUrl: 'localhost:50051',
      envName: 'Local',
      svcName: 'Echo',
      workspaceDefaultsOverride: { grpcHost: 'override:50051', customKey: 'x' },
    }));

    expect(result.current.workspaceDefaults.grpcHost).toBe('override:50051');
    expect(result.current.workspaceDefaults.customKey).toBe('x');
    expect(result.current.workspaceDefaults.envName).toBe('Local');
  });

  it('returns null defaultAuthProfileId when env id is missing', () => {
    const { result } = renderHook(() => useGrpcStudioPageEnvContext({
      selectedSvc,
      selectedEnvId: undefined,
    }));

    expect(result.current.defaultAuthProfileId).toBeNull();
  });
});
