/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Microservice } from '../../../shared/types';
import { useGraphqlStudioEnvMap } from './useGraphqlStudioEnvMap';

const svc: Microservice = {
  id: 'svc-1',
  name: 'orders',
  baseUrls: { e1: 'https://api.example.com' },
  protocolEndpoints: {
    graphql: { e1: { baseUrl: 'https://gql.example.com', path: '/v1' } },
  },
};

describe('useGraphqlStudioEnvMap', () => {
  it('builds globalEnvMap and explicit graphql protocol status', () => {
    const { result } = renderHook(() =>
      useGraphqlStudioEnvMap({
        selectedSvc: svc,
        selectedEnvId: 'e1',
        resolvedBaseUrl: 'https://api.example.com',
        envName: 'local',
        svcName: 'orders',
      }),
    );

    expect(result.current.globalEnvMap.graphqlUrl).toBe('https://gql.example.com/v1');
    expect(result.current.globalEnvMap.envName).toBe('local');
    expect(result.current.endpointProtocolStatus).toBe('explicit');
  });

  it('memoizes results when inputs are unchanged', () => {
    const args = {
      selectedSvc: svc,
      selectedEnvId: 'e1',
      resolvedBaseUrl: 'https://api.example.com',
      envName: 'local',
      svcName: 'orders',
    };
    const { result, rerender } = renderHook((props) => useGraphqlStudioEnvMap(props), {
      initialProps: args,
    });
    const firstMap = result.current.globalEnvMap;
    const firstStatus = result.current.endpointProtocolStatus;
    rerender(args);
    expect(result.current.globalEnvMap).toBe(firstMap);
    expect(result.current.endpointProtocolStatus).toBe(firstStatus);
  });

  it('reports fallback when graphql endpoint is derived from HTTP base', () => {
    const httpOnlySvc: Microservice = {
      id: 'svc-2',
      name: 'catalog',
      baseUrls: { e1: 'https://api.example.com' },
    };
    const { result } = renderHook(() =>
      useGraphqlStudioEnvMap({
        selectedSvc: httpOnlySvc,
        selectedEnvId: 'e1',
        resolvedBaseUrl: 'https://api.example.com',
        envName: 'dev',
        svcName: 'catalog',
      }),
    );

    expect(result.current.globalEnvMap.graphqlUrl).toBe('https://api.example.com/graphql');
    expect(result.current.endpointProtocolStatus).toBe('fallback');
  });
});
