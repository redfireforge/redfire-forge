import { describe, it, expect } from 'vitest';
import type { Microservice } from '../../../shared/types';
import {
  applyAuthProfile,
  applySaveGraphqlPath,
  applySaveProtocolEndpoint,
  applyToggleGrpcTls,
  updateMicroserviceById,
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
