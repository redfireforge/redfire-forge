import { describe, expect, it } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR,
} from '@shared/grpc/contractFixtures';
import {
  filterGrpcExplorerTree,
  findGrpcMethod,
  formatGrpcCallTypeBadge,
  formatGrpcCallTypeLabel,
  formatDescriptorSourceLabel,
  grpcCallTypeBadgeModifier,
  isExecutableMethod,
  isStreamReadyMethod,
  isUnaryReadyMethod,
  countDescriptorMethods,
  serviceExplorerInitial,
  serviceExplorerShortName,
  isStreamingLayoutCallType,
  resolveGrpcStudioLayoutCallType,
  slugifyGrpcExplorerId,
} from './grpcExplorerUtils';

describe('grpcExplorerUtils (Phase 1E)', () => {
  it('slugifies service and method ids for testids', () => {
    expect(slugifyGrpcExplorerId('echo.EchoService')).toBe('echo-echoservice');
    expect(slugifyGrpcExplorerId('health.v1.Health/Check')).toBe('health-v1-health-check');
  });

  it('finds method by service and name', () => {
    const method = findGrpcMethod(FIXTURE_DESCRIPTOR, 'echo.EchoService', 'Echo');
    expect(method?.callType).toBe('unary');
    expect(isUnaryReadyMethod(method!)).toBe(true);
    expect(isStreamReadyMethod(method!)).toBe(false);

    const streamMethod = findGrpcMethod(FIXTURE_DESCRIPTOR, 'echo.EchoService', 'ServerStream');
    expect(streamMethod?.callType).toBe('server_streaming');
    expect(isStreamReadyMethod(streamMethod!)).toBe(true);
    expect(isExecutableMethod(streamMethod!)).toBe(true);
  });

  it('filters services and methods by query', () => {
    const nodes = filterGrpcExplorerTree(FIXTURE_MULTI_SERVICE_DESCRIPTOR, 'watch');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.service.fullName).toBe('health.v1.Health');
    expect(nodes[0]?.methods.map((method) => method.name)).toEqual(['Watch']);
  });

  it('returns all services when filter is empty', () => {
    const nodes = filterGrpcExplorerTree(FIXTURE_MULTI_SERVICE_DESCRIPTOR, '');
    expect(nodes).toHaveLength(2);
  });

  it('formats call type labels and short badges', () => {
    expect(formatGrpcCallTypeLabel('unary')).toBe('Unary');
    expect(formatGrpcCallTypeLabel('server_streaming')).toBe('Server streaming');
    expect(formatGrpcCallTypeBadge('unary')).toBe('U');
    expect(formatGrpcCallTypeBadge('server_streaming')).toBe('SS');
    expect(grpcCallTypeBadgeModifier('client_streaming')).toBe('grpc-method-badge--cs');
  });

  it('derives service display helpers and descriptor counts', () => {
    expect(serviceExplorerShortName('health.v1.Health')).toBe('Health');
    expect(serviceExplorerInitial('echo.EchoService')).toBe('E');
    expect(countDescriptorMethods(FIXTURE_MULTI_SERVICE_DESCRIPTOR)).toBe(6);
    expect(formatDescriptorSourceLabel('reflection')).toBe('Reflection');
  });

  it('resolves layout call type from method or tab preview', () => {
    const serverStream = findGrpcMethod(FIXTURE_DESCRIPTOR, 'echo.EchoService', 'ServerStream')!;
    expect(resolveGrpcStudioLayoutCallType({ layoutPreviewCallType: 'unary' }, serverStream))
      .toBe('server_streaming');
      expect(resolveGrpcStudioLayoutCallType({ layoutPreviewCallType: 'client_streaming' }))
        .toBe('unary');
    expect(resolveGrpcStudioLayoutCallType({})).toBe('unary');
    expect(isStreamingLayoutCallType('server_streaming')).toBe(true);
    expect(isStreamingLayoutCallType('unary')).toBe(false);
  });
});
