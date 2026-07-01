import { describe, it, expect } from 'vitest';
import type { Microservice } from '../types';
import { buildEnvVarMap, extractHost, httpToWsUrl, joinBaseAndPath } from './envVarUtils';

function makeSvc(overrides: Partial<Microservice> = {}): Microservice {
  return {
    id: 'svc-1',
    name: 'orders-service',
    baseUrls: { 'env-local': 'https://api.example.com' },
    ...overrides,
  };
}

describe('httpToWsUrl', () => {
  it('converts https to wss', () => {
    expect(httpToWsUrl('https://api.example.com')).toBe('wss://api.example.com');
  });

  it('converts http to ws', () => {
    expect(httpToWsUrl('http://localhost:8080')).toBe('ws://localhost:8080');
  });

  it('returns input unchanged when no http scheme', () => {
    expect(httpToWsUrl('api.example.com')).toBe('api.example.com');
  });
});

describe('extractHost', () => {
  it('extracts host from https URL', () => {
    expect(extractHost('https://api.example.com/v1')).toBe('api.example.com');
  });

  it('extracts host:port from http URL', () => {
    expect(extractHost('http://localhost:9876')).toBe('localhost:9876');
  });

  it('falls back for host without scheme', () => {
    expect(extractHost('api.example.com/path')).toBe('api.example.com');
  });
});

describe('joinBaseAndPath', () => {
  it('joins base and path', () => {
    expect(joinBaseAndPath('https://api.example.com', '/graphql')).toBe('https://api.example.com/graphql');
  });

  it('avoids double slashes when base ends with slash', () => {
    expect(joinBaseAndPath('https://api.example.com/', '/graphql')).toBe('https://api.example.com/graphql');
  });

  it('adds leading slash when path omits it', () => {
    expect(joinBaseAndPath('https://api.example.com', 'graphql')).toBe('https://api.example.com/graphql');
  });
});

describe('buildEnvVarMap', () => {
  it('builds universal vars from HTTP base URL', () => {
    const map = buildEnvVarMap(makeSvc(), 'env-local', 'http', 'local');
    expect(map).toEqual({
      baseUrl: 'https://api.example.com',
      host: 'api.example.com',
      envName: 'local',
      svcName: 'orders-service',
    });
  });

  it('derives websocket vars from HTTP when protocolEndpoints missing', () => {
    const map = buildEnvVarMap(makeSvc(), 'env-local', 'websocket', 'local');
    expect(map.wsBaseUrl).toBe('wss://api.example.com');
    expect(map.baseUrl).toBe('https://api.example.com');
  });

  it('uses explicit websocket protocolEndpoints over HTTP derivation', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        websocket: {
          'env-local': { baseUrl: 'wss://ws.example.com' },
        },
      },
    });
    const map = buildEnvVarMap(svc, 'env-local', 'websocket', 'local');
    expect(map.wsBaseUrl).toBe('wss://ws.example.com');
  });

  it('falls back sseUrl to HTTP base URL', () => {
    const map = buildEnvVarMap(makeSvc(), 'env-local', 'sse', 'local');
    expect(map.sseUrl).toBe('https://api.example.com');
  });

  it('uses explicit SSE protocolEndpoints', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        sse: {
          'env-local': { baseUrl: 'https://events.example.com' },
        },
      },
    });
    const map = buildEnvVarMap(svc, 'env-local', 'sse', 'local');
    expect(map.sseUrl).toBe('https://events.example.com');
  });

  it('builds graphqlUrl with default /graphql path', () => {
    const map = buildEnvVarMap(makeSvc(), 'env-local', 'graphql', 'local');
    expect(map.graphqlUrl).toBe('https://api.example.com/graphql');
  });

  it('uses explicit graphql base and path from protocolEndpoints', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        graphql: {
          'env-local': { baseUrl: 'https://gql.example.com', path: '/v1/query' },
        },
      },
    });
    const map = buildEnvVarMap(svc, 'env-local', 'graphql', 'local');
    expect(map.graphqlUrl).toBe('https://gql.example.com/v1/query');
  });

  it('falls back graphqlUrl to HTTP base when only path is stored', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        graphql: {
          'env-local': { baseUrl: '', path: '/v1/graphql' },
        },
      },
    });
    const map = buildEnvVarMap(svc, 'env-local', 'graphql', 'local');
    expect(map.graphqlUrl).toBe('https://api.example.com/v1/graphql');
  });

  it('omits grpcHost when not explicitly configured', () => {
    const map = buildEnvVarMap(makeSvc(), 'env-local', 'grpc', 'local');
    expect(map.grpcHost).toBeUndefined();
  });

  it('includes grpcHost only when explicitly configured', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        grpc: {
          'env-local': { baseUrl: 'grpc.example.com:50051', tls: true },
        },
      },
    });
    const map = buildEnvVarMap(svc, 'env-local', 'grpc', 'local');
    expect(map.grpcHost).toBe('grpc.example.com:50051');
    expect(map.grpcPort).toBe('50051');
  });

  it('omits baseUrl and host when env has no HTTP base URL', () => {
    const svc = makeSvc({ baseUrls: {} });
    const map = buildEnvVarMap(svc, 'env-local', 'http', 'local');
    expect(map.baseUrl).toBeUndefined();
    expect(map.host).toBeUndefined();
    expect(map.envName).toBe('local');
    expect(map.svcName).toBe('orders-service');
  });

  it('returns only envName and svcName when svc is undefined', () => {
    const map = buildEnvVarMap(undefined, 'env-local', 'websocket', 'local');
    expect(map).toEqual({ envName: 'local' });
  });

  it('trims whitespace from values', () => {
    const svc = makeSvc({
      name: '  orders  ',
      baseUrls: { 'env-local': '  https://api.example.com  ' },
      protocolEndpoints: {
        websocket: {
          'env-local': { baseUrl: '  wss://ws.example.com  ' },
        },
      },
    });
    const map = buildEnvVarMap(svc, 'env-local', 'websocket', '  staging  ');
    expect(map.baseUrl).toBe('https://api.example.com');
    expect(map.wsBaseUrl).toBe('wss://ws.example.com');
    expect(map.envName).toBe('staging');
    expect(map.svcName).toBe('orders');
  });

  it('omits envName when envName is whitespace only', () => {
    const map = buildEnvVarMap(makeSvc(), 'env-local', 'http', '   ');
    expect(map.envName).toBeUndefined();
  });

  it('omits wsBaseUrl when neither explicit nor HTTP base exists', () => {
    const map = buildEnvVarMap(makeSvc({ baseUrls: {} }), 'env-local', 'websocket');
    expect(map.wsBaseUrl).toBeUndefined();
  });

  it('omits sseUrl when no HTTP or explicit SSE endpoint exists', () => {
    const map = buildEnvVarMap(makeSvc({ baseUrls: {} }), 'env-local', 'sse');
    expect(map.sseUrl).toBeUndefined();
  });

  it('omits host when extractHost returns empty string', () => {
    const map = buildEnvVarMap(makeSvc({ baseUrls: { 'env-local': 'https://' } }), 'env-local', 'http', 'local');
    expect(map.baseUrl).toBe('https://');
    expect(map.host).toBeUndefined();
  });
});
