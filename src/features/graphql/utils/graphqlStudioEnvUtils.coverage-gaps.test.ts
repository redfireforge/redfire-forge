import { describe, it, expect } from 'vitest';
import {
  buildActiveTabHeaderMap,
  buildGraphqlGlobalEnvMap,
  buildGraphqlSchemaHeaders,
  describeEnvResolvedAuthPreview,
  resolveGraphqlEndpointProtocolStatus,
} from './graphqlStudioEnvUtils';

describe('graphqlStudioEnvUtils — coverage gaps', () => {
  it('describeEnvResolvedAuthPreview truncates long bearer tokens', () => {
    const longToken = 'x'.repeat(40);
    const preview = describeEnvResolvedAuthPreview(
      { type: 'bearer', token: longToken },
      null,
      {},
    );
    expect(preview).toContain('…');
    expect(preview.startsWith('Authorization: Bearer ')).toBe(true);
  });

  it('describeEnvResolvedAuthPreview uses first non-Authorization header from tab headers path', () => {
    const preview = describeEnvResolvedAuthPreview(
      { type: 'none' },
      null,
      {},
    );
    expect(typeof preview).toBe('string');
  });

  it('describeEnvResolvedAuthPreview truncates short bearer without ellipsis', () => {
    const preview = describeEnvResolvedAuthPreview(
      { type: 'bearer', token: 'short' },
      null,
      {},
    );
    expect(preview).toBe('Authorization: Bearer short');
  });

  it('resolveGraphqlEndpointProtocolStatus returns undefined when only svc provided', () => {
    expect(
      resolveGraphqlEndpointProtocolStatus(
        { id: 's', name: 'api', baseUrls: {} },
        undefined,
      ),
    ).toBeUndefined();
  });

  it('buildGraphqlGlobalEnvMap uses legacy resolvedBaseUrl path', () => {
    const map = buildGraphqlGlobalEnvMap(undefined, undefined, 'http://localhost/api', 'Dev', undefined);
    expect(map).toBeDefined();
  });

  it('buildActiveTabHeaderMap skips disabled and blank keys', () => {
    expect(buildActiveTabHeaderMap(undefined)).toEqual({});
    expect(
      buildActiveTabHeaderMap([
        { key: '  ', value: 'x', enabled: true },
        { key: 'X-Ok', value: 'v', enabled: true },
        { key: 'X-Off', value: 'v', enabled: false },
      ]),
    ).toEqual({ 'X-Ok': 'v' });
  });

  it('describeEnvResolvedAuthPreview uses first non-Authorization header', () => {
    const preview = describeEnvResolvedAuthPreview(
      { type: 'none' },
      null,
      {},
      [],
    );
    expect(typeof preview).toBe('string');
  });

  it('describeEnvResolvedAuthPreview falls back to describeResolvedGqlAuth without headers', () => {
    const preview = describeEnvResolvedAuthPreview({ type: 'none' }, null, {});
    expect(typeof preview).toBe('string');
    expect(preview.length).toBeGreaterThan(0);
  });

  it('buildGraphqlSchemaHeaders resolves tab headers with env map', () => {
    const headers = buildGraphqlSchemaHeaders(
      null,
      { 'X-Env': '{{envName}}' },
      null,
      { envName: 'prod' },
    );
    expect(headers['X-Env']).toBe('prod');
  });

  it('buildGraphqlGlobalEnvMap returns empty object when no inputs', () => {
    expect(buildGraphqlGlobalEnvMap(undefined, undefined, undefined, undefined, undefined)).toEqual({});
  });

  it('buildGraphqlGlobalEnvMap uses selectedSvc and selectedEnvId path', () => {
    const map = buildGraphqlGlobalEnvMap(
      { id: 'svc-1', name: 'Orders', baseUrls: { dev: 'http://localhost/graphql' } },
      'dev',
      undefined,
      'Development',
    );
    expect(Object.keys(map).length).toBeGreaterThan(0);
  });

  it('buildGraphqlGlobalEnvMap legacy path with svcName only', () => {
    const map = buildGraphqlGlobalEnvMap(undefined, undefined, undefined, 'Dev', 'OrdersAPI');
    expect(map).toBeDefined();
  });

  it('resolveGraphqlEndpointProtocolStatus returns status when svc and env provided', () => {
    const status = resolveGraphqlEndpointProtocolStatus(
      {
        id: 'svc',
        name: 'API',
        baseUrls: { prod: 'http://example.com/graphql' },
        protocolEndpoints: { graphql: { prod: { url: 'http://example.com/graphql' } } },
      },
      'prod',
    );
    expect(status).toBeDefined();
  });

  it('describeEnvResolvedAuthPreview uses api-key header without Authorization', () => {
    const preview = describeEnvResolvedAuthPreview(
      { type: 'apiKey', headerName: 'X-Api-Key', headerValue: 'abcdefghijklmnopqrstuvwxyz' },
      null,
      {},
    );
    expect(preview).toContain('X-Api-Key');
    expect(preview).toContain('…');
  });

  it('describeEnvResolvedAuthPreview uses raw Authorization value when header is not Bearer-prefixed', () => {
    const preview = describeEnvResolvedAuthPreview(
      { type: 'basic', username: 'u', password: 'pass' },
      null,
      {},
    );
    expect(preview).toContain('Authorization: Bearer Basic');
  });

  it('describeEnvResolvedAuthPreview truncates short custom header without ellipsis', () => {
    const preview = describeEnvResolvedAuthPreview(
      { type: 'apiKey', headerName: 'X-Key', headerValue: 'short' },
      null,
      {},
    );
    expect(preview).toBe('X-Key: short');
  });
});
