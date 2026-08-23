import { describe, it, expect } from 'vitest';
import type { Microservice } from '@shared/types';
import {
  buildHeaderProtocolTooltip,
  resolveHeaderProtocolIndicator,
  tabToHeaderProtocol,
} from './headerProtocolUtils';

function makeSvc(overrides: Partial<Microservice> = {}): Microservice {
  return {
    id: 'svc-1',
    name: 'orders-service',
    baseUrls: { e1: 'https://api.example.com' },
    ...overrides,
  };
}

describe('tabToHeaderProtocol', () => {
  it('maps protocol studio tabs to their protocol keys', () => {
    expect(tabToHeaderProtocol('websocket-studio')).toBe('websocket');
    expect(tabToHeaderProtocol('sse-studio')).toBe('sse');
    expect(tabToHeaderProtocol('graphql-studio')).toBe('graphql');
    expect(tabToHeaderProtocol('grpc-studio')).toBe('grpc');
  });

  it('maps HTTP-context tabs to http', () => {
    expect(tabToHeaderProtocol('requests')).toBe('http');
    expect(tabToHeaderProtocol('runner')).toBe('http');
  });

  it('returns null for non-endpoint tabs', () => {
    expect(tabToHeaderProtocol('environments')).toBeNull();
    expect(tabToHeaderProtocol('kafka-message-studio')).toBeNull();
    expect(tabToHeaderProtocol('workflow')).toBeNull();
    expect(tabToHeaderProtocol('gallery')).toBeNull();
    expect(tabToHeaderProtocol('training')).toBeNull();
    expect(tabToHeaderProtocol('demo-hub')).toBeNull();
  });
});

describe('resolveHeaderProtocolIndicator', () => {
  it('returns null when the active tab has no protocol context', () => {
    expect(resolveHeaderProtocolIndicator('environments', makeSvc(), 'e1', [])).toBeNull();
  });

  it('shows explicit websocket URL when configured (AC-EM-15)', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        websocket: { e1: { baseUrl: 'wss://ws.example.com' } },
      },
    });
    const state = resolveHeaderProtocolIndicator('websocket-studio', svc, 'e1', [{ id: 'e1', name: 'local' }]);
    expect(state?.resolvedUrl).toBe('wss://ws.example.com');
    expect(state?.status).toBe('explicit');
    expect(state?.statusSymbol).toBe('✓');
  });

  it('shows fallback status when websocket uses HTTP derivation (AC-EM-15)', () => {
    const state = resolveHeaderProtocolIndicator(
      'websocket-studio',
      makeSvc(),
      'e1',
      [{ id: 'e1', name: 'local' }],
    );
    expect(state?.resolvedUrl).toBe('wss://api.example.com');
    expect(state?.status).toBe('fallback');
    expect(state?.statusSymbol).toBe('⚠');
    expect(state?.tooltipDetail).toContain('HTTP');
  });

  it('shows unresolved when env and service are not selected', () => {
    const state = resolveHeaderProtocolIndicator('sse-studio', undefined, '', []);
    expect(state?.status).toBe('unresolved');
    expect(state?.statusSymbol).toBe('✗');
    expect(state?.tooltipDetail).toContain('Select an environment');
  });

  it('shows fallback status for graphql when only HTTP base is configured', () => {
    const state = resolveHeaderProtocolIndicator(
      'graphql-studio',
      makeSvc(),
      'e1',
      [{ id: 'e1', name: 'local' }],
    );
    expect(state?.status).toBe('fallback');
    expect(state?.statusSymbol).toBe('⚠');
    expect(state?.tooltipDetail).toContain('No explicit GraphQL endpoint');
  });

  it('shows explicit graphql URL when protocol endpoint is configured', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        graphql: { e1: { baseUrl: 'https://gql.example.com', path: '/v1' } },
      },
    });
    const state = resolveHeaderProtocolIndicator('graphql-studio', svc, 'e1', [{ id: 'e1', name: 'local' }]);
    expect(state?.resolvedUrl).toBe('https://gql.example.com/v1');
    expect(state?.status).toBe('explicit');
  });

  it('includes full resolved URL in tooltip detail (AC-EM-16)', () => {
    const state = resolveHeaderProtocolIndicator(
      'graphql-studio',
      makeSvc(),
      'e1',
      [{ id: 'e1', name: 'local' }],
    );
    expect(state?.tooltipDetail).toContain('Resolved: https://api.example.com/graphql');
    expect(state?.tooltipTitle).toContain('GraphQL endpoint');
    expect(state?.tooltipTitle).toContain('local × orders-service');
  });
});

describe('buildHeaderProtocolTooltip', () => {
  it('describes explicit configuration', () => {
    const { detail } = buildHeaderProtocolTooltip('sse', 'local', 'orders', 'https://events.example.com', 'explicit');
    expect(detail).toContain('Explicitly configured');
    expect(detail).toContain('Resolved: https://events.example.com');
  });

  it('describes fallback semantics for graphql endpoint', () => {
    const { detail } = buildHeaderProtocolTooltip('graphql', 'local', 'orders', 'https://api.example.com/graphql', 'fallback');
    expect(detail).toContain('No explicit GraphQL endpoint');
  });

  it('describes fallback semantics for HTTP context', () => {
    const { detail } = buildHeaderProtocolTooltip('http', 'local', 'orders', '', 'fallback');
    expect(detail).toContain('No HTTP base URL configured for this environment.');
  });

  it('describes unresolved gRPC with explicit configuration guidance', () => {
    const { detail } = buildHeaderProtocolTooltip('grpc', 'local', 'orders', '', 'unresolved');
    expect(detail).toContain('gRPC requires an explicit host:port');
    expect(detail).toContain('Configure it in Environment Manager.');
  });

  it('describes unresolved SSE without resolved URL', () => {
    const { detail } = buildHeaderProtocolTooltip('sse', 'local', 'orders', '', 'unresolved');
    expect(detail).toContain('No explicit SSE endpoint');
    expect(detail).toContain('Configure it in Environment Manager.');
  });

  it('describes fallback for websocket protocol', () => {
    const { detail } = buildHeaderProtocolTooltip('websocket', 'local', 'orders', 'wss://api.example.com', 'fallback');
    expect(detail).toContain('No explicit WebSocket address');
  });

  it('describes explicit SSE configuration', () => {
    const { detail } = buildHeaderProtocolTooltip('sse', 'local', 'orders', 'https://events.example.com', 'explicit');
    expect(detail).toContain('Explicitly configured');
    expect(detail).toContain('SSE tab');
  });

  it('uses fallback reason when unresolved receives a resolved URL', () => {
    const { detail } = buildHeaderProtocolTooltip(
      'graphql',
      'local',
      'orders',
      'https://api.example.com/graphql',
      'unresolved',
    );
    expect(detail).toContain('No explicit GraphQL endpoint');
    expect(detail).toContain('Resolved: https://api.example.com/graphql');
  });

  it('handles unknown protocol keys defensively', () => {
    const { title, detail } = buildHeaderProtocolTooltip(
      'unknown' as never,
      'local',
      'orders',
      '',
      'unresolved',
    );
    expect(title).toContain('unknown endpoint');
    expect(detail).toContain('Endpoint unresolved.');
  });
});

describe('resolveHeaderProtocolIndicator — HTTP context', () => {
  it('shows explicit HTTP base URL on requests tab (AC-EM-14)', () => {
    const state = resolveHeaderProtocolIndicator(
      'requests',
      makeSvc(),
      'e1',
      [{ id: 'e1', name: 'local' }],
    );
    expect(state?.resolvedUrl).toBe('https://api.example.com');
    expect(state?.status).toBe('explicit');
    expect(state?.statusSymbol).toBe('✓');
  });

  it('uses accurate unresolved HTTP guidance when base URL is missing', () => {
    const state = resolveHeaderProtocolIndicator(
      'requests',
      makeSvc({ baseUrls: {} }),
      'e1',
      [{ id: 'e1', name: 'local' }],
    );
    expect(state?.status).toBe('unresolved');
    expect(state?.tooltipDetail).toContain('Set a base URL on the HTTP tab');
    expect(state?.tooltipDetail).toContain('deploy the row first if needed');
  });

  it('shows explicit SSE URL when configured', () => {
    const svc = makeSvc({
      protocolEndpoints: {
        sse: { e1: { baseUrl: 'https://events.example.com/stream' } },
      },
    });
    const state = resolveHeaderProtocolIndicator('sse-studio', svc, 'e1', [{ id: 'e1', name: 'local' }]);
    expect(state?.resolvedUrl).toBe('https://events.example.com/stream');
    expect(state?.status).toBe('explicit');
    expect(state?.statusSymbol).toBe('✓');
  });

  it('maps fallback row status without resolved URL to unresolved header status', () => {
    const svc = makeSvc({ baseUrls: {} });
    const state = resolveHeaderProtocolIndicator('websocket-studio', svc, 'e1', [{ id: 'e1', name: 'local' }]);
    expect(state?.status).toBe('unresolved');
    expect(state?.statusSymbol).toBe('✗');
  });
});
