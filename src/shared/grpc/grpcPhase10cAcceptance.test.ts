/**
 * Phase 10C — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pkg from '../../../package.json';
import {
  resolveGrpcBrowserTransportAdapter,
  isGrpcTransportDispatchImplemented,
} from './grpcBrowserTransportRouter';
import { GRPC_WEB_CONTENT_TYPES } from './grpcWebTransportContracts';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('Phase 10C acceptance checklist', () => {
  describe('checklist-1: framing codec and trailer normalize', () => {
    it('exports binary and text content type constants', () => {
      expect(GRPC_WEB_CONTENT_TYPES.BINARY).toBe('application/grpc-web+proto');
      expect(GRPC_WEB_CONTENT_TYPES.TEXT).toBe('application/grpc-web-text+proto');
    });

    it('framing codec module exposes encode/decode entry points', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcWebFramingCodec.ts`, 'utf8');
      expect(source).toContain('encodeGrpcWebDataFrame');
      expect(source).toContain('decodeGrpcWebResponseBody');
      expect(source).toContain('encodeGrpcWebTextBody');
    });

    it('trailer normalize maps grpc-status to canonical fields', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcWebTrailerNormalize.ts`, 'utf8');
      expect(source).toContain('normalizeGrpcWebUnaryResponse');
      expect(source).toContain('grpc-status');
    });
  });

  describe('checklist-2: grpc-web adapter dispatch + unary client', () => {
    it('grpc-web adapter is dispatch-ready with unary invoke', () => {
      const adapter = resolveGrpcBrowserTransportAdapter('grpc-web');
      expect(adapter.dispatchReady).toBe(true);
      expect(isGrpcTransportDispatchImplemented('grpc-web')).toBe(true);
      expect(adapter.invokeUnary).toBeTypeOf('function');
      expect(adapter.cancelUnary).toBeTypeOf('function');
      expect(adapter.startStream).toBeUndefined();
    });

    it('spring-servlet dispatch is covered by Phase 10D acceptance gate', () => {
      expect(resolveGrpcBrowserTransportAdapter('spring-servlet').mode).toBe('spring-servlet');
    });

    it('grpcBrowserTransportAdapters wires grpc-web unary client', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcBrowserTransportAdapters.ts`, 'utf8');
      expect(source).toContain('invokeGrpcWebUnary');
      expect(source).toContain('cancelGrpcWebUnary');
      expect(source).toContain("mode: 'grpc-web'");
      expect(source).toContain('dispatchReady: true');
    });

    it('unary client protects framing headers and applies client timeout', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcGrpcWebUnaryClient.ts`, 'utf8');
      // Phase 10F: inline reserved set was extracted to GRPC_WEB_RESERVED_HEADERS in contracts
      expect(source).toContain('GRPC_WEB_RESERVED_HEADERS');
      expect(source).toContain('abortCause');
      expect(source).toContain('grpc-timeout');
    });

    it('proto codec loads protoset via protobufjs descriptor bridge', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcWebProtoCodec.ts`, 'utf8');
      expect(source).toContain('fromDescriptor');
      expect(source).toContain('encodeGrpcWebProtoMessage');
    });

    it('transport panel gates grpc-web via dispatchReady and platform support', async () => {
      const source = await readFile(`${root}/features/grpc/components/GrpcTransportPanel.tsx`, 'utf8');
      expect(source).toContain('isGrpcTransportDispatchImplemented');
      expect(source).toContain('isGrpcTransportPlatformSupported');
    });

    it('stream start fails closed for grpc-web with Phase 10H guidance', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcStreamClient.ts`, 'utf8');
      expect(source).toContain('Phase 10H');
    });
  });

  describe('checklist-3: gate script and package entry', () => {
    it('package.json exposes test:grpc:phase10c', () => {
      expect(pkg.scripts?.['test:grpc:phase10c']).toContain('test-grpc-phase10c.sh');
    });
  });
});
