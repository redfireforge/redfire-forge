import { describe, it, expect } from 'vitest';
import type { Microservice } from '@shared/types';
import {
  getEffectiveEnabledProtocols,
  computeProtocolCompleteness,
  getRowStatus,
  listDeployedEnvRows,
  patchProtocolEndpoints,
  validateProtocolValue,
  stripEnvFromProtocolEndpoints,
  previewGraphqlUrl,
  previewWsFallback,
  resolvePreviewEnvId,
  resolvePreviewEnvName,
  derivedVarSourceLabel,
  hasDerivedVarsForProtocol,
  statusChipLabel,
  graphqlPathForEnv,
  grpcTlsForEnv,
  getResolvedDisplayValue,
  getProtocolEndpoint,
  getExplicitBaseUrl,
  envDisplayName,
} from './protocolEndpointUtils';

function makeSvc(overrides: Partial<Microservice> = {}): Microservice {
  return {
    id: 'svc-1',
    name: 'orders',
    baseUrls: { e1: 'https://api.example.com', e2: 'https://api.staging.com' },
    ...overrides,
  };
}

describe('protocolEndpointUtils', () => {
  it('getEffectiveEnabledProtocols returns empty list for new microservice', () => {
    expect(getEffectiveEnabledProtocols(makeSvc({ baseUrls: {} }))).toEqual([]);
  });

  it('getEffectiveEnabledProtocols derives HTTP from deployed baseUrls for legacy data', () => {
    expect(getEffectiveEnabledProtocols(makeSvc({ baseUrls: { e1: 'https://api.example.com' } })))
      .toEqual(['http']);
  });

  it('getEffectiveEnabledProtocols respects explicit enabledProtocols list', () => {
    expect(getEffectiveEnabledProtocols(makeSvc({ enabledProtocols: ['sse'], baseUrls: { e1: 'https://api' } })))
      .toEqual(['sse']);
  });

  it('getEffectiveEnabledProtocols derives non-HTTP protocols from protocolEndpoints', () => {
    expect(getEffectiveEnabledProtocols(makeSvc({
      baseUrls: {},
      protocolEndpoints: { sse: { e1: { baseUrl: 'https://events.example.com' } } },
    }))).toEqual(['sse']);
  });

  it('lists only deployed environment rows', () => {
    const svc = makeSvc({ baseUrls: { e1: 'http://a' } });
    const rows = listDeployedEnvRows(svc, [{ id: 'e1', name: 'local' }, { id: 'e2', name: 'staging' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('local');
  });

  it('counts HTTP completeness from baseUrls', () => {
    const svc = makeSvc();
    const completeness = computeProtocolCompleteness(svc, 'http', ['e1', 'e2'], false);
    expect(completeness.label).toBe('2/2');
    expect(completeness.tone).toBe('ok');
  });

  it('marks websocket fallback when only HTTP is configured', () => {
    const svc = makeSvc();
    const status = getRowStatus(svc, 'websocket', 'e1');
    expect(status).toBe('fallback');
    const completeness = computeProtocolCompleteness(svc, 'websocket', ['e1', 'e2'], true);
    expect(completeness.tabCountLabel).toBe('fallback');
  });

  it('counts explicit websocket endpoints', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        websocket: {
          e1: { baseUrl: 'wss://ws.example.com' },
        },
      },
    });
    const completeness = computeProtocolCompleteness(svc, 'websocket', ['e1', 'e2'], true);
    expect(completeness.label).toBe('1/2');
    expect(getRowStatus(svc, 'websocket', 'e1')).toBe('explicit');
  });

  it('marks grpc as unresolved without explicit host', () => {
    const svc = makeSvc();
    expect(getRowStatus(svc, 'grpc', 'e1')).toBe('unresolved');
    const completeness = computeProtocolCompleteness(svc, 'grpc', ['e1', 'e2'], false);
    expect(completeness.label).toBe('0/2');
    expect(completeness.tone).toBe('err');
  });

  it('validates protocol-specific URL formats', () => {
    expect(validateProtocolValue('websocket', 'http://bad')).toContain('ws');
    expect(validateProtocolValue('grpc', 'grpc://host:1')).toContain('scheme');
    expect(validateProtocolValue('grpc', 'grpc.example.com')).toContain('host:port');
    expect(validateProtocolValue('grpc', 'grpc.example.com:abc')).toContain('numeric');
    expect(validateProtocolValue('grpc', 'grpc.example.com:70000')).toContain('between 1 and 65535');
    expect(validateProtocolValue('grpc', 'grpc.example.com:50051')).toBeNull();
    expect(validateProtocolValue('sse', 'https://events.example.com')).toBeNull();
  });

  it('patches and removes protocol endpoint entries', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        sse: { e1: { baseUrl: 'https://old' } },
      },
    });
    const cleared = patchProtocolEndpoints(svc, 'sse', 'e1', { baseUrl: '' });
    expect(cleared?.sse?.e1).toBeUndefined();
    const added = patchProtocolEndpoints(svc, 'graphql', 'e1', { baseUrl: 'https://gql', path: '/v1' });
    expect(added?.graphql?.e1).toEqual({ baseUrl: 'https://gql', path: '/v1' });
  });

  it('stores graphql path without empty baseUrl when only path changes', () => {
    const svc = makeSvc();
    const patched = patchProtocolEndpoints(svc, 'graphql', 'e1', { path: '/custom' });
    expect(patched?.graphql?.e1).toEqual({ baseUrl: '', path: '/custom' });
  });

  it('preserves tls-only grpc entry when toggling without address', () => {
    const svc = makeSvc();
    const patched = patchProtocolEndpoints(svc, 'grpc', 'e1', { tls: true });
    expect(patched?.grpc?.e1?.tls).toBe(true);
  });

  it('strips environment from all protocol endpoints', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        websocket: {
          e1: { baseUrl: 'wss://ws.example.com' },
          e2: { baseUrl: 'wss://ws.staging.com' },
        },
        graphql: {
          e1: { baseUrl: 'https://gql.example.com', path: '/graphql' },
        },
      },
    });
    const stripped = stripEnvFromProtocolEndpoints(svc, 'e1');
    expect(stripped?.websocket?.e1).toBeUndefined();
    expect(stripped?.websocket?.e2).toBeDefined();
    expect(stripped?.graphql?.e1).toBeUndefined();
  });

  it('stripEnvFromProtocolEndpoints returns undefined when no endpoints remain', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        websocket: { e1: { baseUrl: 'wss://ws.example.com' } },
      },
    });
    const stripped = stripEnvFromProtocolEndpoints(svc, 'e1');
    expect(stripped).toBeUndefined();
  });

  it('preview graphql url combines base and path', () => {
    expect(previewGraphqlUrl('https://api.example.com', '/v1')).toBe('https://api.example.com/v1');
    expect(previewGraphqlUrl('https://api.example.com', '')).toBe('https://api.example.com/graphql');
    expect(previewGraphqlUrl('', '/v1')).toBe('');
    expect(previewGraphqlUrl('https://api.example.com', '  ')).toBe('https://api.example.com/graphql');
  });

  it('derives status chip labels', () => {
    expect(statusChipLabel('explicit')).toContain('set');
    expect(statusChipLabel('fallback')).toContain('fallback');
    expect(statusChipLabel('unresolved')).toContain('unresolved');
    expect(statusChipLabel('empty')).toContain('empty');
  });

  it('derives variable source labels', () => {
    expect(derivedVarSourceLabel('envName', 'explicit')).toBe('env name');
    expect(derivedVarSourceLabel('svcName', 'fallback')).toBe('service name');
    expect(derivedVarSourceLabel('host', 'unresolved')).toBe('extracted');
    expect(derivedVarSourceLabel('graphqlUrl', 'explicit')).toBe('explicitly set');
    expect(derivedVarSourceLabel('wsBaseUrl', 'fallback')).toBe('HTTP fallback');
    expect(derivedVarSourceLabel('grpcHost', 'empty')).toBe('unresolved');
  });

  it('detects protocols with derived vars', () => {
    expect(hasDerivedVarsForProtocol('http')).toBe(true);
    expect(hasDerivedVarsForProtocol('websocket')).toBe(true);
    expect(hasDerivedVarsForProtocol('grpc')).toBe(true);
    expect(hasDerivedVarsForProtocol('unknown' as never)).toBe(false);
  });

  it('returns graphql path for environment', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        graphql: { e1: { baseUrl: 'https://gql', path: '/v2' } },
      },
    });
    expect(graphqlPathForEnv(svc, 'e1')).toBe('/v2');
    expect(graphqlPathForEnv(svc, 'e2')).toBe('/graphql');
    expect(graphqlPathForEnv(makeSvc(), 'e1')).toBe('/graphql');
  });

  it('returns grpc tls for environment', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        grpc: { e1: { baseUrl: 'grpc.example.com:50051', tls: true } },
      },
    });
    expect(grpcTlsForEnv(svc, 'e1')).toBe(true);
    expect(grpcTlsForEnv(svc, 'e2')).toBe(false);
    expect(grpcTlsForEnv(makeSvc(), 'e1')).toBe(false);
  });

  it('gets protocol endpoint for env', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        websocket: { e1: { baseUrl: 'wss://ws.example.com' } },
      },
    });
    expect(getProtocolEndpoint(svc, 'websocket', 'e1')).toEqual({ baseUrl: 'wss://ws.example.com' });
    expect(getProtocolEndpoint(svc, 'websocket', 'e2')).toBeUndefined();
    expect(getProtocolEndpoint(makeSvc(), 'websocket', 'e1')).toBeUndefined();
  });

  it('gets explicit base url per protocol', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        websocket: { e1: { baseUrl: 'wss://ws.example.com' } },
      },
    });
    expect(getExplicitBaseUrl(svc, 'http', 'e1')).toBe('https://api.example.com');
    expect(getExplicitBaseUrl(svc, 'websocket', 'e1')).toBe('wss://ws.example.com');
    expect(getExplicitBaseUrl(svc, 'websocket', 'e2')).toBe('');
    expect(getExplicitBaseUrl(svc, 'sse', 'e1')).toBe('');
  });

  it('displays environment name from global or custom envs', () => {
    const svc = makeSvc({
      customEnvs: [{ id: 'c1', name: 'custom-env' }],
    });
    const envs = [{ id: 'e1', name: 'prod' }, { id: 'e2', name: 'staging' }];
    expect(envDisplayName('e1', envs, svc)).toBe('prod');
    expect(envDisplayName('c1', envs, svc)).toBe('custom-env');
    expect(envDisplayName('unknown', envs, svc)).toBe('unknown');
  });

  it('resolves display values per protocol via buildEnvVarMap', () => {
    const svc = makeSvc({
      baseUrls: { e1: 'https://api.example.com' },
      protocolEndpoints: {
        websocket: { e1: { baseUrl: 'wss://ws.example.com' } },
      },
    });
    expect(getResolvedDisplayValue(svc, 'http', 'e1', 'prod')).toBe('https://api.example.com');
    expect(getResolvedDisplayValue(svc, 'websocket', 'e1', 'prod')).toBe('wss://ws.example.com');
    expect(getResolvedDisplayValue(svc, 'sse', 'e1', 'prod')).toBe('https://api.example.com');
  });

  it('handles patching with missing partial endpoint properties', () => {
    const svc = makeSvc();
    const patched = patchProtocolEndpoints(svc, 'websocket', 'e1', { baseUrl: 'wss://new' });
    expect(patched?.websocket?.e1?.baseUrl).toBe('wss://new');
  });

  it('removes protocol entry entirely when all environments are stripped', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        websocket: { e1: { baseUrl: 'wss://ws' } },
        graphql: { e2: { baseUrl: 'https://gql' } },
      },
    });
    const stripped = stripEnvFromProtocolEndpoints(svc, 'e1');
    expect(stripped?.websocket).toBeUndefined();
    expect(stripped?.graphql?.e2).toBeDefined();
  });

  it('clears protocol endpoints when patching to empty baseUrl, path, and tls', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        graphql: { e1: { baseUrl: 'https://gql', path: '/v1' } },
      },
    });
    const patched = patchProtocolEndpoints(svc, 'graphql', 'e1', { baseUrl: '', path: undefined });
    expect(patched?.graphql?.e1).toBeUndefined();
  });

  it('preserves multiple protocol endpoints during patching', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        websocket: { e1: { baseUrl: 'wss://ws' } },
        graphql: { e1: { baseUrl: 'https://gql' } },
      },
    });
    const patched = patchProtocolEndpoints(svc, 'websocket', 'e1', { baseUrl: 'wss://new' });
    expect(patched?.websocket?.e1?.baseUrl).toBe('wss://new');
    expect(patched?.graphql?.e1?.baseUrl).toBe('https://gql');
  });

  it('keeps tls setting when only baseUrl changes', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        grpc: { e1: { baseUrl: 'grpc.example.com:50051', tls: true } },
      },
    });
    const patched = patchProtocolEndpoints(svc, 'grpc', 'e1', { baseUrl: 'grpc.new.com:50051' });
    expect(patched?.grpc?.e1?.baseUrl).toBe('grpc.new.com:50051');
    expect(patched?.grpc?.e1?.tls).toBe(true);
  });

  it('returns undefined when stripping causes all endpoints to vanish', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        websocket: { e1: { baseUrl: 'wss://ws' } },
      },
    });
    const stripped = stripEnvFromProtocolEndpoints(svc, 'e1');
    expect(stripped).toBeUndefined();
  });

  it('handles stripEnvFromProtocolEndpoints with missing map safely', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        websocket: undefined as unknown as Record<string, { baseUrl: string }>,
        graphql: { e1: { baseUrl: 'https://gql' } },
      },
    });
    const stripped = stripEnvFromProtocolEndpoints(svc, 'e1');
    expect(stripped?.graphql).toBeUndefined();
  });

  it('computes completeness with zero total envs', () => {
    const svc = makeSvc();
    const completeness = computeProtocolCompleteness(svc, 'websocket', [], true);
    expect(completeness.label).toBe('0/0');
    expect(completeness.tone).toBe('err');
  });

  it('computes completeness with partial fallback support', () => {
    const svc = makeSvc({
      baseUrls: { e1: 'https://api', e2: 'https://api2' },
      protocolEndpoints: {
        websocket: {
          e1: { baseUrl: 'wss://ws' },
        },
      },
    });
    // e1: explicit, e2: fallback → 1/2
    const completeness = computeProtocolCompleteness(svc, 'websocket', ['e1', 'e2'], true);
    expect(completeness.label).toBe('1/2');
    expect(completeness.tone).toBe('warn');
  });

  it('marks all-fallback as "fallback" label when supportsFallback=true', () => {
    const svc = makeSvc({
      baseUrls: { e1: 'https://api', e2: 'https://api2' },
      // no explicit websocket endpoints
    });
    // Both e1, e2: fallback (only HTTP configured) → 'fallback'
    const completeness = computeProtocolCompleteness(svc, 'websocket', ['e1', 'e2'], true);
    expect(completeness.label).toBe('fallback');
    expect(completeness.tone).toBe('warn');
  });

  it('computes all-explicit completeness', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        websocket: {
          e1: { baseUrl: 'wss://ws1' },
          e2: { baseUrl: 'wss://ws2' },
        },
      },
    });
    const completeness = computeProtocolCompleteness(svc, 'websocket', ['e1', 'e2'], true);
    expect(completeness.label).toBe('2/2');
    expect(completeness.tone).toBe('ok');
  });

  it('computes partial-explicit completeness', () => {
    const svc = makeSvc({
      baseUrls: { e1: 'https://api', e2: 'https://api2' },
      protocolEndpoints: {
        websocket: {
          e2: { baseUrl: 'wss://ws2' },
        },
      },
    });
    const completeness = computeProtocolCompleteness(svc, 'websocket', ['e1', 'e2'], true);
    expect(completeness.label).toBe('1/2');
    expect(completeness.tone).toBe('warn');
  });

  it('previewWsFallback converts HTTP to WebSocket URL', () => {
    expect(previewWsFallback('https://api.example.com')).toBe('wss://api.example.com');
    expect(previewWsFallback('')).toBe('');
  });

  it('resolvePreviewEnvId prefers selected env when deployed', () => {
    expect(resolvePreviewEnvId('e2', ['e1', 'e2'])).toBe('e2');
    expect(resolvePreviewEnvId('missing', ['e1', 'e2'])).toBe('e1');
    expect(resolvePreviewEnvId('', [])).toBe('');
  });

  it('resolvePreviewEnvName delegates to envDisplayName', () => {
    const svc = makeSvc();
    expect(resolvePreviewEnvName('e1', [{ id: 'e1', name: 'local' }], svc)).toBe('local');
  });

  it('patchProtocolEndpoints removes env when patched entry has no effective values', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        graphql: { e1: { path: '/graphql' } },
      },
    });
    const next = patchProtocolEndpoints(svc, 'graphql', 'e1', { path: '' });
    expect(next?.graphql?.e1).toBeUndefined();
  });

  it('derivedVarSourceLabel covers host and unresolved branches', () => {
    expect(derivedVarSourceLabel('host', 'fallback')).toBe('extracted');
    expect(derivedVarSourceLabel('graphqlUrl', 'unresolved')).toBe('unresolved');
  });

  it('validateProtocolValue default branch accepts unknown protocol keys', () => {
    expect(validateProtocolValue('unknown' as never, 'anything')).toBeNull();
  });

  it('getResolvedDisplayValue default protocol returns empty string', () => {
    expect(getResolvedDisplayValue(makeSvc(), 'unknown' as never, 'e1', 'local')).toBe('');
  });

  it('listDeployedEnvRows includes customEnvs that are in baseUrls as isAdditional', () => {
    const svc = makeSvc({
      baseUrls: { e1: 'https://api.example.com', c1: 'https://custom.example.com' },
      customEnvs: [{ id: 'c1', name: 'custom-env' }],
    });
    const rows = listDeployedEnvRows(svc, [{ id: 'e1', name: 'prod' }]);
    expect(rows).toHaveLength(2);
    const custom = rows.find((r) => r.envId === 'c1');
    expect(custom?.isAdditional).toBe(true);
    expect(custom?.name).toBe('custom-env');
  });

  it('getExplicitBaseUrl returns empty string when envId not in baseUrls for http', () => {
    const svc = makeSvc({ baseUrls: {} });
    expect(getExplicitBaseUrl(svc, 'http', 'missing')).toBe('');
  });

  it('getRowStatus returns empty for http when envId has no baseUrl', () => {
    const svc = makeSvc({ baseUrls: {} });
    expect(getRowStatus(svc, 'http', 'missing')).toBe('empty');
  });

  it('getRowStatus returns empty for sse/graphql when no explicit endpoint and no HTTP fallback', () => {
    const svc = makeSvc({ baseUrls: {} });
    expect(getRowStatus(svc, 'sse', 'e1')).toBe('empty');
    expect(getRowStatus(svc, 'graphql', 'e1')).toBe('empty');
  });

  it('getResolvedDisplayValue covers sse and graphql branches', () => {
    const svc = makeSvc({
      baseUrls: { e1: 'https://api.example.com' },
      protocolEndpoints: {
        sse: { e1: { baseUrl: 'https://events.example.com' } },
        graphql: { e1: { baseUrl: 'https://gql.example.com', path: '/graphql' } },
        grpc: { e1: { baseUrl: 'grpc.example.com:50051' } },
      },
    });
    expect(getResolvedDisplayValue(svc, 'sse', 'e1', 'prod')).toBe('https://events.example.com');
    expect(getResolvedDisplayValue(svc, 'graphql', 'e1', 'prod')).toBe('https://gql.example.com/graphql');
    expect(getResolvedDisplayValue(svc, 'grpc', 'e1', 'prod')).toBe('grpc.example.com:50051');
  });

  it('validateProtocolValue returns null for empty string across protocols', () => {
    for (const protocol of ['http', 'websocket', 'sse', 'graphql', 'grpc'] as const) {
      expect(validateProtocolValue(protocol, '   ')).toBeNull();
    }
  });

  it('validateProtocolValue returns null for valid http URL', () => {
    expect(validateProtocolValue('http', 'http://api.example.com')).toBeNull();
  });

  it('validateProtocolValue rejects sse and graphql without https scheme', () => {
    expect(validateProtocolValue('sse', 'ftp://bad')).toContain('https');
    expect(validateProtocolValue('graphql', 'ftp://bad')).toContain('https');
  });

  it('validateProtocolValue rejects grpc with empty host before colon', () => {
    expect(validateProtocolValue('grpc', ':50051')).toContain('host:port');
  });

  it('patchProtocolEndpoints preserves existing path and tls from current entry when not in patch', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        grpc: { e1: { baseUrl: 'grpc.example.com:50051', tls: true } },
        graphql: { e1: { baseUrl: 'https://gql', path: '/v1' } },
      },
    });
    // Patch only baseUrl — tls should be preserved
    const grpcPatched = patchProtocolEndpoints(svc, 'grpc', 'e1', { baseUrl: 'grpc.new.com:50051' });
    expect(grpcPatched?.grpc?.e1?.tls).toBe(true);

    // Patch only baseUrl — path should be preserved
    const gqlPatched = patchProtocolEndpoints(svc, 'graphql', 'e1', { baseUrl: 'https://gql2' });
    expect(gqlPatched?.graphql?.e1?.path).toBe('/v1');
  });

  it('stripEnvFromProtocolEndpoints returns undefined when svc has no protocolEndpoints', () => {
    const svc = makeSvc({ protocolEndpoints: undefined });
    expect(stripEnvFromProtocolEndpoints(svc, 'e1')).toBeUndefined();
  });

  // Batch coverage-gap tests for branch coverage
  it('covers edge cases and all protocol branches in batch', () => {
    const svc = makeSvc({
      baseUrls: { e1: 'https://api.example.com', e2: 'https://api.staging.com' },
      protocolEndpoints: {
        websocket: { e1: { baseUrl: 'wss://ws.example.com' }, e2: { baseUrl: 'wss://ws.staging.com' } },
        sse: { e1: { baseUrl: 'https://events.example.com' } },
        graphql: { e1: { baseUrl: 'https://gql.example.com', path: '/v1' } },
        grpc: { e1: { baseUrl: 'grpc.example.com:50051', tls: true } },
      },
      customEnvs: [{ id: 'c1', name: 'custom-dev' }],
    });

    // Test all getRowStatus branches for all protocols
    expect(getRowStatus(svc, 'http', 'e1')).toBe('explicit');
    expect(getRowStatus(svc, 'http', 'missing')).toBe('empty');
    expect(getRowStatus(svc, 'websocket', 'e1')).toBe('explicit');
    expect(getRowStatus(svc, 'websocket', 'missing')).toBe('empty');
    expect(getRowStatus(svc, 'sse', 'e1')).toBe('explicit');
    expect(getRowStatus(svc, 'sse', 'e2')).toBe('fallback');
    expect(getRowStatus(svc, 'graphql', 'e1')).toBe('explicit');
    expect(getRowStatus(svc, 'graphql', 'e2')).toBe('fallback');
    expect(getRowStatus(svc, 'grpc', 'e1')).toBe('explicit');
    expect(getRowStatus(svc, 'grpc', 'e2')).toBe('unresolved');

    // Test completeness across all combinations
    expect(computeProtocolCompleteness(svc, 'http', ['e1'], false).tone).toBe('ok');
    expect(computeProtocolCompleteness(svc, 'websocket', ['e1', 'e2'], true).tone).toBe('ok');
    expect(computeProtocolCompleteness(svc, 'websocket', ['e1', 'e2'], true).label).toBe('2/2');
    expect(computeProtocolCompleteness(svc, 'sse', ['e1', 'e2'], true).tone).toBe('warn');
    expect(computeProtocolCompleteness(svc, 'grpc', ['e2'], false).tone).toBe('err');
  });

  it('validates all protocol-specific format edge cases in batch', () => {
    // Websocket scheme validation
    expect(validateProtocolValue('websocket', 'ws://example.com')).toBeNull();
    expect(validateProtocolValue('websocket', 'wss://example.com')).toBeNull();
    expect(validateProtocolValue('websocket', 'WS://example.com')).toBeNull();
    expect(validateProtocolValue('websocket', 'http://example.com')).toContain('ws');
    
    // HTTP family validation
    expect(validateProtocolValue('http', 'http://example.com')).toBeNull();
    expect(validateProtocolValue('http', 'https://example.com')).toBeNull();
    expect(validateProtocolValue('sse', 'https://events.example.com')).toBeNull();
    expect(validateProtocolValue('graphql', 'https://graphql.example.com')).toBeNull();
    expect(validateProtocolValue('sse', 'ftp://bad.com')).toContain('http');

    // gRPC validation - all branches
    expect(validateProtocolValue('grpc', 'grpc.example.com:50051')).toBeNull();
    expect(validateProtocolValue('grpc', 'grpc.example.com:1')).toBeNull();
    expect(validateProtocolValue('grpc', 'grpc.example.com:65535')).toBeNull();
    expect(validateProtocolValue('grpc', 'grpc.example.com:65536')).toContain('65535');
    expect(validateProtocolValue('grpc', 'grpc.example.com:0')).toContain('between');
    expect(validateProtocolValue('grpc', 'grpc.example.com:')).toContain('port');
    expect(validateProtocolValue('grpc', 'grpc.example.com:abc')).toContain('numeric');
    expect(validateProtocolValue('grpc', ':50051')).toContain('host:port');
    expect(validateProtocolValue('grpc', 'host:')).toContain('host:port');
  });

  it('patches and preserves complex endpoint state in batch', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        grpc: { e1: { baseUrl: 'grpc.old.com:50051', tls: true } },
        graphql: { e1: { baseUrl: 'https://gql.old.com', path: '/v2' } },
        websocket: { e1: { baseUrl: 'wss://ws.old.com' } },
      },
    });

    // Batch updates across multiple protocols
    const p1 = patchProtocolEndpoints(svc, 'grpc', 'e1', { baseUrl: 'grpc.new.com:50051' });
    expect(p1?.grpc?.e1?.tls).toBe(true);
    expect(p1?.graphql?.e1?.baseUrl).toBe('https://gql.old.com');

    const p2 = patchProtocolEndpoints(svc, 'graphql', 'e1', { path: '/v3' });
    expect(p2?.graphql?.e1?.path).toBe('/v3');
    expect(p2?.graphql?.e1?.baseUrl).toBe('https://gql.old.com');

    const p3 = patchProtocolEndpoints(svc, 'websocket', 'e1', { baseUrl: '' });
    expect(p3?.websocket?.e1).toBeUndefined();
    expect(p3?.grpc?.e1).toBeDefined();

    const p4 = patchProtocolEndpoints(svc, 'graphql', 'e1', { baseUrl: '', path: undefined });
    expect(p4?.graphql?.e1).toBeUndefined();
  });

  it('resolves display values across all protocol branches in batch', () => {
    const svc = makeSvc({
      baseUrls: { e1: 'https://api.example.com' },
      protocolEndpoints: {
        websocket: { e1: { baseUrl: 'wss://ws.example.com' } },
        sse: { e1: { baseUrl: 'https://events.example.com' } },
        graphql: { e1: { baseUrl: 'https://gql.example.com', path: '/v1' } },
        grpc: { e1: { baseUrl: 'grpc.example.com:50051' } },
      },
    });

    // All getExplicitBaseUrl branches
    expect(getExplicitBaseUrl(svc, 'http', 'e1')).toBe('https://api.example.com');
    expect(getExplicitBaseUrl(svc, 'websocket', 'e1')).toBe('wss://ws.example.com');
    expect(getExplicitBaseUrl(svc, 'sse', 'e1')).toBe('https://events.example.com');
    expect(getExplicitBaseUrl(svc, 'graphql', 'e1')).toBe('https://gql.example.com');
    expect(getExplicitBaseUrl(svc, 'grpc', 'e1')).toBe('grpc.example.com:50051');
    expect(getExplicitBaseUrl(svc, 'http', 'missing')).toBe('');

    // All getResolvedDisplayValue branches
    expect(getResolvedDisplayValue(svc, 'http', 'e1', 'prod')).toBe('https://api.example.com');
    expect(getResolvedDisplayValue(svc, 'websocket', 'e1', 'prod')).toBe('wss://ws.example.com');
    expect(getResolvedDisplayValue(svc, 'sse', 'e1', 'prod')).toBe('https://events.example.com');
    expect(getResolvedDisplayValue(svc, 'graphql', 'e1', 'prod')).toContain('v1');
    expect(getResolvedDisplayValue(svc, 'grpc', 'e1', 'prod')).toBe('grpc.example.com:50051');
  });
});

