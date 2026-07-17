import { describe, it, expect } from 'vitest';
import type { Microservice } from '../../../shared/types';
import {
  applyAuthProfile,
  applySaveGraphqlPath,
  applySaveProtocolEndpoint,
  applyToggleGrpcTls,
  updateMicroserviceById,
  applySetSvcGlobalVar,
  applyDeleteSvcGlobalVar,
  applySetSvcEnvVar,
  applyDeleteSvcEnvVar,
} from './environmentManagerSaveHandlers';

const svcA: Microservice = {
  id: 'svc-a',
  name: 'alpha',
  baseUrls: { e1: 'https://a.example.com' },
  protocolEndpoints: {
    websocket: { e1: { baseUrl: 'wss://ws.example.com' } },
    graphql: { e1: { path: '/graphql' } },
    grpc: { e1: { baseUrl: 'grpc.example.com:50051', tls: false } },
  },
  authProfileIds: { e1: 'auth-1' },
};

const svcB: Microservice = { id: 'svc-b', name: 'beta', baseUrls: {} };

describe('updateMicroserviceById', () => {
  it('updates only the matching microservice', () => {
    const next = updateMicroserviceById([svcA, svcB], 'svc-a', (s) => ({ ...s, name: 'updated' }));
    expect(next[0].name).toBe('updated');
    expect(next[1]).toBe(svcB);
  });
});

describe('applySaveProtocolEndpoint', () => {
  it('reports unchanged when URL matches existing value', () => {
    const result = applySaveProtocolEndpoint([svcA], svcA, 'websocket', 'e1', 'wss://ws.example.com');
    expect(result.changed).toBe(false);
    expect(result.microservices[0].protocolEndpoints?.websocket?.e1?.baseUrl).toBe('wss://ws.example.com');
  });

  it('reports changed when URL differs', () => {
    const result = applySaveProtocolEndpoint([svcA], svcA, 'websocket', 'e1', 'wss://new.example.com');
    expect(result.changed).toBe(true);
  });
});

describe('applySaveGraphqlPath', () => {
  it('preserves path-only graphql endpoint without existing base URL', () => {
    const result = applySaveGraphqlPath([svcA], svcA, 'e1', '/graphql');
    expect(result.changed).toBe(false);
    expect(result.microservices[0].protocolEndpoints?.graphql?.e1?.path).toBe('/graphql');
  });

  it('normalizes blank path to /graphql and reports change from custom path', () => {
    const svc = {
      ...svcA,
      protocolEndpoints: { graphql: { e1: { baseUrl: 'https://gql.example.com', path: '/v1' } } },
    };
    const result = applySaveGraphqlPath([svc], svc, 'e1', '   ');
    expect(result.normalized).toBe('/graphql');
    expect(result.changed).toBe(true);
  });
});

describe('applyToggleGrpcTls', () => {
  it('toggles TLS without existing base URL in patch payload', () => {
    const svc = { ...svcA, protocolEndpoints: { grpc: { e1: { tls: false } } } };
    const result = applyToggleGrpcTls([svc], svc, 'e1', false);
    expect(result.changed).toBe(false);
  });

  it('patches TLS when grpc endpoint has whitespace-only base URL', () => {
    const svc = {
      ...svcA,
      protocolEndpoints: { grpc: { e1: { baseUrl: '   ', tls: false } } },
    };
    const result = applyToggleGrpcTls([svc], svc, 'e1', true);
    expect(result.microservices[0].protocolEndpoints?.grpc?.e1?.tls).toBe(true);
  });

  it('reports TLS change when value differs', () => {
    const result = applyToggleGrpcTls([svcA], svcA, 'e1', true);
    expect(result.changed).toBe(true);
    expect(result.microservices[0].protocolEndpoints?.grpc?.e1?.tls).toBe(true);
  });
});

describe('applyAuthProfile', () => {
  it('leaves unrelated microservices untouched', () => {
    const result = applyAuthProfile([svcA, svcB], svcA, 'e1', 'auth-2');
    expect(result.changed).toBe(true);
    expect(result.microservices[0].authProfileIds?.e1).toBe('auth-2');
    expect(result.microservices[1]).toBe(svcB);
  });

  it('clears auth profile when profileId is undefined', () => {
    const result = applyAuthProfile([svcA], svcA, 'e1', undefined);
    expect(result.changed).toBe(true);
    expect(result.microservices[0].authProfileIds?.e1).toBeUndefined();
  });

  it('reports unchanged when profileId matches existing value', () => {
    const result = applyAuthProfile([svcA], svcA, 'e1', 'auth-1');
    expect(result.changed).toBe(false);
  });
});

describe('applySetSvcGlobalVar', () => {
  it('sets a new global var on the matching service', () => {
    const svc: Microservice = { id: 'svc-a', name: 'alpha', baseUrls: {} };
    const result = applySetSvcGlobalVar([svc], 'svc-a', 'requestId', 'req-001');
    expect(result[0].globalVars?.requestId).toBe('req-001');
  });

  it('does not touch other services', () => {
    const a: Microservice = { id: 'svc-a', name: 'alpha', baseUrls: {} };
    const b: Microservice = { id: 'svc-b', name: 'beta', baseUrls: {} };
    const result = applySetSvcGlobalVar([a, b], 'svc-a', 'k', 'v');
    expect(result[1]).toBe(b);
  });
});

describe('applyDeleteSvcGlobalVar', () => {
  it('removes an existing global var', () => {
    const svc: Microservice = { id: 'svc-a', name: 'alpha', baseUrls: {}, globalVars: { requestId: 'req-001' } };
    const result = applyDeleteSvcGlobalVar([svc], 'svc-a', 'requestId');
    expect(result[0].globalVars?.requestId).toBeUndefined();
  });

  it('clears globalVars entirely when the last key is removed', () => {
    const svc: Microservice = { id: 'svc-a', name: 'alpha', baseUrls: {}, globalVars: { only: 'v' } };
    const result = applyDeleteSvcGlobalVar([svc], 'svc-a', 'only');
    expect(result[0].globalVars).toBeUndefined();
  });

  it('keeps remaining global vars when deleting one of many', () => {
    const svc: Microservice = { id: 'svc-a', name: 'alpha', baseUrls: {}, globalVars: { a: '1', b: '2' } };
    const result = applyDeleteSvcGlobalVar([svc], 'svc-a', 'a');
    expect(result[0].globalVars).toEqual({ b: '2' });
  });
});

describe('applySetSvcEnvVar', () => {
  it('sets an env-scoped override', () => {
    const svc: Microservice = { id: 'svc-a', name: 'alpha', baseUrls: {} };
    const result = applySetSvcEnvVar([svc], 'svc-a', 'env-local', 'requestId', 'req-local');
    expect(result[0].envVars?.['env-local']?.requestId).toBe('req-local');
  });

  it('preserves other env overrides', () => {
    const svc: Microservice = { id: 'svc-a', name: 'alpha', baseUrls: {}, envVars: { 'env-staging': { userId: 'u2' } } };
    const result = applySetSvcEnvVar([svc], 'svc-a', 'env-local', 'requestId', 'req-local');
    expect(result[0].envVars?.['env-staging']?.userId).toBe('u2');
  });
});

describe('applyDeleteSvcEnvVar', () => {
  it('removes an env-scoped override', () => {
    const svc: Microservice = { id: 'svc-a', name: 'alpha', baseUrls: {}, envVars: { 'env-local': { requestId: 'req-001' } } };
    const result = applyDeleteSvcEnvVar([svc], 'svc-a', 'env-local', 'requestId');
    expect(result[0].envVars?.['env-local']?.requestId).toBeUndefined();
  });

  it('drops empty env bucket and clears envVars when last override is removed', () => {
    const svc: Microservice = { id: 'svc-a', name: 'alpha', baseUrls: {}, envVars: { 'env-local': { only: 'v' } } };
    const result = applyDeleteSvcEnvVar([svc], 'svc-a', 'env-local', 'only');
    expect(result[0].envVars).toBeUndefined();
  });

  it('preserves other env buckets when deleting one key', () => {
    const svc: Microservice = {
      id: 'svc-a',
      name: 'alpha',
      baseUrls: {},
      envVars: {
        'env-local': { a: '1', b: '2' },
        'env-staging': { c: '3' },
      },
    };
    const result = applyDeleteSvcEnvVar([svc], 'svc-a', 'env-local', 'a');
    expect(result[0].envVars?.['env-local']).toEqual({ b: '2' });
    expect(result[0].envVars?.['env-staging']).toEqual({ c: '3' });
  });

  it('keeps envVars object when another env bucket still has overrides', () => {
    const svc: Microservice = {
      id: 'svc-a',
      name: 'alpha',
      baseUrls: {},
      envVars: { 'env-local': { only: 'v' }, 'env-staging': { keep: 'yes' } },
    };
    const result = applyDeleteSvcEnvVar([svc], 'svc-a', 'env-local', 'only');
    expect(result[0].envVars).toEqual({ 'env-staging': { keep: 'yes' } });
  });
});
