import { describe, it, expect } from 'vitest';
import type { Microservice } from '../../../shared/types';
import {
  buildActiveTabHeaderMap,
  buildGraphqlGlobalEnvMap,
  buildGraphqlSchemaHeaders,
  resolveGraphqlEndpointProtocolStatus,
} from './graphqlStudioEnvUtils';

const svc: Microservice = {
  id: 'svc-1',
  name: 'orders',
  baseUrls: { e1: 'https://api.example.com' },
  protocolEndpoints: {
    graphql: { e1: { baseUrl: 'https://gql.example.com', path: '/v1' } },
  },
};

describe('buildGraphqlGlobalEnvMap', () => {
  it('builds from selected service and env', () => {
    const map = buildGraphqlGlobalEnvMap(svc, 'e1', undefined, 'local', 'orders');
    expect(map.graphqlUrl).toBe('https://gql.example.com/v1');
    expect(map.envName).toBe('local');
  });

  it('falls back to legacy resolvedBaseUrl props', () => {
    const map = buildGraphqlGlobalEnvMap(undefined, undefined, 'https://legacy.test', 'dev', 'svc');
    expect(map.baseUrl).toBe('https://legacy.test');
  });

  it('returns empty map when no context', () => {
    expect(buildGraphqlGlobalEnvMap(undefined, undefined, undefined, undefined, undefined)).toEqual({});
  });
});

describe('resolveGraphqlEndpointProtocolStatus', () => {
  it('returns explicit when graphql endpoint configured', () => {
    expect(resolveGraphqlEndpointProtocolStatus(svc, 'e1')).toBe('explicit');
  });

  it('returns undefined without selection', () => {
    expect(resolveGraphqlEndpointProtocolStatus(undefined, undefined)).toBeUndefined();
  });
});

describe('buildActiveTabHeaderMap', () => {
  it('maps enabled headers only', () => {
    const map = buildActiveTabHeaderMap([
      { id: '1', key: 'Authorization', value: 'Bearer x', enabled: true },
      { id: '2', key: 'X-Off', value: 'nope', enabled: false },
      { id: '3', key: '  ', value: 'skip', enabled: true },
    ]);
    expect(map).toEqual({ Authorization: 'Bearer x' });
  });
});

describe('buildGraphqlSchemaHeaders', () => {
  it('merges auth headers and resolves variables', () => {
    const headers = buildGraphqlSchemaHeaders(
      { type: 'bearer', token: 'secret' },
      { 'X-Custom': '{{envName}}' },
      null,
      { envName: 'staging' },
    );
    expect(headers.Authorization).toContain('secret');
    expect(headers['X-Custom']).toBe('staging');
  });
});
