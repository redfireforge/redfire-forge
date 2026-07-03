import { describe, expect, it } from 'vitest';
import { FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import {
  countDescriptorMethods,
  filterGrpcExplorerTree,
  findGrpcMethod,
  countGrpcExplorerMethods,
  formatDescriptorSourceLabel,
  formatGrpcCallTypeBadge,
  formatGrpcCallTypeLabel,
  grpcCallTypeBadgeModifier,
  isExecutableMethod,
  isStreamReadyMethod,
  isStreamingLayoutCallType,
  isUnaryReadyMethod,
  resolveGrpcStudioLayoutCallType,
  serviceExplorerInitial,
  serviceExplorerShortName,
  slugifyGrpcExplorerId,
  serviceExplorerIconVariant,
} from './grpcExplorerUtils';

describe('grpcExplorerUtils coverage gaps', () => {
  it('covers helper utilities for names and executable method classification', () => {
    expect(slugifyGrpcExplorerId('echo.EchoService/Echo')).toBe('echo-echoservice-echo');
    expect(serviceExplorerShortName('echo.EchoService')).toBe('EchoService');
    expect(serviceExplorerInitial('echo.EchoService')).toBe('E');
    expect(serviceExplorerShortName('')).toBe('');
    expect(serviceExplorerInitial('')).toBe('?');

    const unary = FIXTURE_MULTI_SERVICE_DESCRIPTOR.services[0]!.methods.find((m) => m.callType === 'unary')!;
    const serverStream = FIXTURE_MULTI_SERVICE_DESCRIPTOR.services[0]!.methods.find((m) => m.callType === 'server_streaming')!;
    const clientStream = FIXTURE_MULTI_SERVICE_DESCRIPTOR.services[0]!.methods.find((m) => m.callType === 'client_streaming')!;
    const bidiStream = FIXTURE_MULTI_SERVICE_DESCRIPTOR.services[0]!.methods.find((m) => m.callType === 'bidi_streaming')!;
    expect(isUnaryReadyMethod(unary)).toBe(true);
    expect(isUnaryReadyMethod(serverStream)).toBe(false);
    expect(isStreamReadyMethod(serverStream)).toBe(true);
    expect(isStreamReadyMethod(clientStream)).toBe(true);
    expect(isStreamReadyMethod(bidiStream)).toBe(true);
    expect(isStreamReadyMethod(unary)).toBe(false);
    expect(isExecutableMethod(unary)).toBe(true);
    expect(isStreamingLayoutCallType('unary')).toBe(false);
    expect(isStreamingLayoutCallType('bidi_streaming')).toBe(true);
    expect(resolveGrpcStudioLayoutCallType({}, unary)).toBe('unary');
    expect(resolveGrpcStudioLayoutCallType({ layoutPreviewCallType: 'server_streaming' }, undefined)).toBe('server_streaming');
  });

  it('covers default branches for unknown call types and sources', () => {
    const unknownCallType = 'custom_stream' as never;
    expect(formatGrpcCallTypeLabel(unknownCallType)).toBe('custom_stream');
    expect(formatGrpcCallTypeLabel('client_streaming')).toBe('Client streaming');
    expect(formatGrpcCallTypeLabel('bidi_streaming')).toBe('Bidirectional streaming');
    expect(formatGrpcCallTypeBadge(unknownCallType)).toBe('?');
    expect(formatGrpcCallTypeBadge('client_streaming')).toBe('CS');
    expect(formatGrpcCallTypeBadge('bidi_streaming')).toBe('BD');
    expect(grpcCallTypeBadgeModifier(unknownCallType)).toBe('grpc-method-badge--u');
    expect(grpcCallTypeBadgeModifier('server_streaming')).toBe('grpc-method-badge--ss');
    expect(grpcCallTypeBadgeModifier('bidi_streaming')).toBe('grpc-method-badge--bd');
    expect(formatDescriptorSourceLabel(undefined)).toBe('Unknown');
    expect(formatDescriptorSourceLabel('proto_files')).toBe('Proto files');
    expect(formatDescriptorSourceLabel('protoset')).toBe('Protoset');
    expect(formatDescriptorSourceLabel('bsr')).toBe('BSR');
    expect(formatDescriptorSourceLabel('url_proto')).toBe('URL proto');
  });

  it('filters methods by request type and counts visible methods', () => {
    const nodes = FIXTURE_MULTI_SERVICE_DESCRIPTOR.services.map((service) => ({
      service,
      methods: service.methods,
      visible: true,
    }));
    expect(countGrpcExplorerMethods(nodes)).toBe(6);
    expect(serviceExplorerIconVariant('echo.EchoService')).toBeTruthy();
  });

  it('filters explorer tree by service and method query and finds methods', () => {
    const all = filterGrpcExplorerTree(FIXTURE_MULTI_SERVICE_DESCRIPTOR, '');
    expect(all).toHaveLength(FIXTURE_MULTI_SERVICE_DESCRIPTOR.services.length);
    expect(countDescriptorMethods(FIXTURE_MULTI_SERVICE_DESCRIPTOR)).toBe(6);

    const byService = filterGrpcExplorerTree(FIXTURE_MULTI_SERVICE_DESCRIPTOR, 'health.v1');
    expect(byService).toHaveLength(1);

    const byMethod = filterGrpcExplorerTree(FIXTURE_MULTI_SERVICE_DESCRIPTOR, 'ServerStream');
    expect(byMethod.some((node) => node.methods.some((method) => method.name === 'ServerStream'))).toBe(true);

    expect(findGrpcMethod(FIXTURE_MULTI_SERVICE_DESCRIPTOR, 'echo.EchoService', 'Echo')?.name).toBe('Echo');
    expect(findGrpcMethod(FIXTURE_MULTI_SERVICE_DESCRIPTOR, 'missing.Service', 'Echo')).toBeUndefined();
  });
});
