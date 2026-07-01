import { describe, expect, it } from 'vitest';
import {
  formatGrpcAcceptEncodingHeader,
  mergeGrpcCompressionMetadata,
  prepareGrpcCallMetadata,
  resolveGrpcCompressionEncoding,
} from './grpcCompressionPolicy';

describe('grpcCompressionPolicy (Phase 4J-D)', () => {
  it('resolveGrpcCompressionEncoding returns undefined when disabled', () => {
    expect(resolveGrpcCompressionEncoding({ enabled: false, algorithm: 'gzip' })).toBeUndefined();
    expect(resolveGrpcCompressionEncoding(undefined)).toBeUndefined();
  });

  it('resolveGrpcCompressionEncoding treats identity as no compression', () => {
    expect(resolveGrpcCompressionEncoding({ enabled: true, algorithm: 'gzip' })).toBe('gzip');
    expect(resolveGrpcCompressionEncoding({ enabled: true, algorithm: 'deflate' })).toBe('deflate');
    expect(resolveGrpcCompressionEncoding({ enabled: true, algorithm: 'identity' })).toBeUndefined();
  });

  it('formatGrpcAcceptEncodingHeader lists identity fallback', () => {
    expect(formatGrpcAcceptEncodingHeader({ enabled: true, algorithm: 'gzip' })).toBe('gzip,identity');
    expect(formatGrpcAcceptEncodingHeader({ enabled: false, algorithm: 'gzip' })).toBe('identity');
  });

  it('mergeGrpcCompressionMetadata overrides manual grpc-encoding when enabled', () => {
    const merged = mergeGrpcCompressionMetadata(
      { 'grpc-encoding': 'deflate', 'x-custom': '1' },
      { enabled: true, algorithm: 'gzip' },
    );
    expect(merged['grpc-encoding']).toBe('gzip');
    expect(merged['grpc-accept-encoding']).toBe('gzip,identity');
    expect(merged['x-custom']).toBe('1');
  });

  it('mergeGrpcCompressionMetadata leaves metadata unchanged when disabled', () => {
    const input = { 'grpc-encoding': 'deflate' };
    expect(mergeGrpcCompressionMetadata(input, { enabled: false, algorithm: 'gzip' })).toEqual(input);
  });

  it('prepareGrpcCallMetadata chains auth bearer then compression', () => {
    const metadata = prepareGrpcCallMetadata(
      { 'x-trace': 'abc' },
      { type: 'bearer', bearerToken: 'tok' },
      { enabled: true, algorithm: 'gzip' },
    );
    expect(metadata?.authorization).toMatch(/^Bearer tok$/);
    expect(metadata?.['grpc-encoding']).toBe('gzip');
    expect(metadata?.['x-trace']).toBe('abc');
  });
});
