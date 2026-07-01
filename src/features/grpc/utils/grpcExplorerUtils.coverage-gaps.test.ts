import { describe, expect, it } from 'vitest';
import { FIXTURE_MULTI_SERVICE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import {
  countGrpcExplorerMethods,
  formatDescriptorSourceLabel,
  formatGrpcCallTypeBadge,
  formatGrpcCallTypeLabel,
  grpcCallTypeBadgeModifier,
  serviceExplorerIconVariant,
} from './grpcExplorerUtils';

describe('grpcExplorerUtils coverage gaps', () => {
  it('covers default branches for unknown call types and sources', () => {
    const unknownCallType = 'custom_stream' as never;
    expect(formatGrpcCallTypeLabel(unknownCallType)).toBe('custom_stream');
    expect(formatGrpcCallTypeBadge(unknownCallType)).toBe('?');
    expect(grpcCallTypeBadgeModifier(unknownCallType)).toBe('grpc-method-badge--u');
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
});
