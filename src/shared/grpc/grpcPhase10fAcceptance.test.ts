/**
 * Phase 10F acceptance tests — cross-mode metadata/auth/tls normalization parity.
 *
 * Verifies that the same metadata/auth setup produces equivalent behavior
 * across grpc-web and spring-servlet transport modes.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import protobuf from 'protobufjs';
import descriptor from 'protobufjs/ext/descriptor/index.js';
import { FIXTURE_ECHO_PROTO, FIXTURE_TARGET, FIXTURE_UNARY_CALL_REQUEST } from './contractFixtures';
import {
  invokeGrpcWebUnary,
  resetGrpcWebUnaryClientForTests,
} from './grpcGrpcWebUnaryClient';
import {
  invokeGrpcSpringServletUnary,
  resetGrpcSpringServletUnaryClientForTests,
} from './grpcGrpcSpringServletUnaryClient';
import {
  clearGrpcWebProtoCodecCacheForTests,
  encodeGrpcWebProtoMessage,
} from './grpcWebProtoCodec';
import {
  concatGrpcWebFrames,
  encodeGrpcWebDataFrame,
} from './grpcWebFramingCodec';
import { GRPC_WEB_CONTENT_TYPES, GRPC_WEB_RESERVED_HEADERS } from './grpcWebTransportContracts';
import { SPRING_SERVLET_CONTENT_TYPE, SPRING_SERVLET_RESERVED_HEADERS, SPRING_SERVLET_TE_TRAILERS } from './grpcSpringServletTransportContracts';
import { buildBrowserTransportUserMetadataHeaders, GRPC_AUTH_HEADER_KEYS } from './grpcBrowserTransportMetadataNorm';
import { prepareGrpcCallMetadata } from './grpcCompressionPolicy';
import { GRPC_REDACTED_PLACEHOLDER, redactGrpcCallRequestForExport } from './grpcRedaction';
import pkg from '../../../package.json';

const root = fileURLToPath(new URL('../..', import.meta.url));

function buildEchoProtosetBase64(): string {
  const root = new protobuf.Root();
  protobuf.parse(FIXTURE_ECHO_PROTO, root, { keepCase: true, alternateCommentMode: true });
  root.resolveAll();
  const fileDescriptorSet = root.toDescriptor('proto3');
  const bytes = descriptor.FileDescriptorSet.encode(fileDescriptorSet).finish();
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}

function buildSuccessGrpcWebResponse(protosetBase64: string): Response {
  const responsePayload = encodeGrpcWebProtoMessage(
    protosetBase64,
    'echo.EchoResponse',
    { message: 'pong' },
  );
  const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': GRPC_WEB_CONTENT_TYPES.BINARY,
      'grpc-status': '0',
      'grpc-message': '',
    },
  });
}

function buildSuccessSpringServletResponse(protosetBase64: string): Response {
  const responsePayload = encodeGrpcWebProtoMessage(
    protosetBase64,
    'echo.EchoResponse',
    { message: 'pong' },
  );
  const body = concatGrpcWebFrames([encodeGrpcWebDataFrame(responsePayload)]);
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': SPRING_SERVLET_CONTENT_TYPE,
      'grpc-status': '0',
      'grpc-message': '',
    },
  });
}

describe('Phase 10F — cross-mode metadata/auth/tls parity', () => {
  beforeEach(() => {
    resetGrpcWebUnaryClientForTests();
    resetGrpcSpringServletUnaryClientForTests();
    clearGrpcWebProtoCodecCacheForTests();
  });

  // ── Reserved header sets are symmetric (both contain the common slots) ──────

  describe('reserved header set symmetry', () => {
    it('both modes reserve accept', () => {
      expect(GRPC_WEB_RESERVED_HEADERS.has('accept')).toBe(true);
      expect(SPRING_SERVLET_RESERVED_HEADERS.has('accept')).toBe(true);
    });

    it('both modes reserve content-type', () => {
      expect(GRPC_WEB_RESERVED_HEADERS.has('content-type')).toBe(true);
      expect(SPRING_SERVLET_RESERVED_HEADERS.has('content-type')).toBe(true);
    });

    it('both modes reserve grpc-timeout', () => {
      expect(GRPC_WEB_RESERVED_HEADERS.has('grpc-timeout')).toBe(true);
      expect(SPRING_SERVLET_RESERVED_HEADERS.has('grpc-timeout')).toBe(true);
    });

    it('grpc-web reserves x-grpc-web (spring-servlet does not)', () => {
      expect(GRPC_WEB_RESERVED_HEADERS.has('x-grpc-web')).toBe(true);
      expect(SPRING_SERVLET_RESERVED_HEADERS.has('x-grpc-web')).toBe(false);
    });

    it('spring-servlet reserves te (grpc-web does not)', () => {
      expect(SPRING_SERVLET_RESERVED_HEADERS.has('te')).toBe(true);
      expect(GRPC_WEB_RESERVED_HEADERS.has('te')).toBe(false);
    });
  });

  // ── User metadata reaches fetch in both modes ────────────────────────────────

  describe('user metadata passthrough parity', () => {
    it('grpc-web: user metadata key reaches fetch call', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedKey: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedKey = (init.headers as Record<string, string>)['x-trace-id'];
        return buildSuccessGrpcWebResponse(protosetBase64);
      });

      await invokeGrpcWebUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          metadata: { 'x-trace-id': 'trace-grpc-web' },
        },
        tabId: 'tab-parity-gw',
        protosetBase64,
        fetchFn,
      });

      expect(capturedKey).toBe('trace-grpc-web');
    });

    it('spring-servlet: user metadata key reaches fetch call', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedKey: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedKey = (init.headers as Record<string, string>)['x-trace-id'];
        return buildSuccessSpringServletResponse(protosetBase64);
      });

      await invokeGrpcSpringServletUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          metadata: { 'x-trace-id': 'trace-spring' },
        },
        tabId: 'tab-parity-ss',
        protosetBase64,
        fetchFn,
      });

      expect(capturedKey).toBe('trace-spring');
    });
  });

  // ── Auth header (authorization) reaches fetch in both modes ─────────────────
  // Note: prepareGrpcCallMetadata merges auth into metadata before the request
  // reaches the transport client. These tests simulate that by passing an
  // already-merged metadata record (as snapshotToUnaryCallRequest produces).

  describe('authorization header parity', () => {
    it('grpc-web: authorization header from merged metadata reaches fetch', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedAuth: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedAuth = (init.headers as Record<string, string>)['authorization'];
        return buildSuccessGrpcWebResponse(protosetBase64);
      });

      await invokeGrpcWebUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          // Simulate bearer auth merged into metadata by prepareGrpcCallMetadata
          metadata: { authorization: 'Bearer tok-grpc-web' },
        },
        tabId: 'tab-auth-gw',
        protosetBase64,
        fetchFn,
      });

      expect(capturedAuth).toBe('Bearer tok-grpc-web');
    });

    it('spring-servlet: authorization header from merged metadata reaches fetch', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedAuth: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedAuth = (init.headers as Record<string, string>)['authorization'];
        return buildSuccessSpringServletResponse(protosetBase64);
      });

      await invokeGrpcSpringServletUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          // Simulate bearer auth merged into metadata by prepareGrpcCallMetadata
          metadata: { authorization: 'Bearer tok-spring' },
        },
        tabId: 'tab-auth-ss',
        protosetBase64,
        fetchFn,
      });

      expect(capturedAuth).toBe('Bearer tok-spring');
    });

    it('grpc-web: x-api-key from merged metadata reaches fetch', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedApiKey: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedApiKey = (init.headers as Record<string, string>)['x-api-key'];
        return buildSuccessGrpcWebResponse(protosetBase64);
      });

      await invokeGrpcWebUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          metadata: { 'x-api-key': 'api-key-grpc-web' },
        },
        tabId: 'tab-apikey-gw',
        protosetBase64,
        fetchFn,
      });

      expect(capturedApiKey).toBe('api-key-grpc-web');
    });

    it('spring-servlet: x-api-key from merged metadata reaches fetch', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedApiKey: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedApiKey = (init.headers as Record<string, string>)['x-api-key'];
        return buildSuccessSpringServletResponse(protosetBase64);
      });

      await invokeGrpcSpringServletUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          metadata: { 'x-api-key': 'api-key-spring' },
        },
        tabId: 'tab-apikey-ss',
        protosetBase64,
        fetchFn,
      });

      expect(capturedApiKey).toBe('api-key-spring');
    });
  });

  // ── Binary (-bin) metadata passthrough parity ────────────────────────────────

  describe('binary metadata (-bin) parity', () => {
    it('grpc-web: -bin key with base64 value reaches fetch untouched', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      const base64Payload = btoa('binary-content-grpc-web');
      let capturedBinValue: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedBinValue = (init.headers as Record<string, string>)['custom-data-bin'];
        return buildSuccessGrpcWebResponse(protosetBase64);
      });

      await invokeGrpcWebUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          metadata: { 'custom-data-bin': base64Payload },
        },
        tabId: 'tab-bin-gw',
        protosetBase64,
        fetchFn,
      });

      expect(capturedBinValue).toBe(base64Payload);
    });

    it('spring-servlet: -bin key with base64 value reaches fetch untouched', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      const base64Payload = btoa('binary-content-spring');
      let capturedBinValue: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedBinValue = (init.headers as Record<string, string>)['custom-data-bin'];
        return buildSuccessSpringServletResponse(protosetBase64);
      });

      await invokeGrpcSpringServletUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          metadata: { 'custom-data-bin': base64Payload },
        },
        tabId: 'tab-bin-ss',
        protosetBase64,
        fetchFn,
      });

      expect(capturedBinValue).toBe(base64Payload);
    });
  });

  // ── Reserved header injection blocked in both modes ──────────────────────────

  describe('reserved header blocking parity', () => {
    it('grpc-web: user cannot override Content-Type via metadata', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedContentType: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedContentType = (init.headers as Record<string, string>)['Content-Type']
          ?? (init.headers as Record<string, string>)['content-type'];
        return buildSuccessGrpcWebResponse(protosetBase64);
      });

      await invokeGrpcWebUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          metadata: { 'content-type': 'text/plain' },
        },
        tabId: 'tab-reserved-gw',
        protosetBase64,
        fetchFn,
      });

      // Transport must own content-type — user value must not win
      expect(capturedContentType).toContain('application/grpc-web');
    });

    it('grpc-web: user cannot override X-Grpc-Web via metadata', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedGrpcWeb: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedGrpcWeb = (init.headers as Record<string, string>)['X-Grpc-Web']
          ?? (init.headers as Record<string, string>)['x-grpc-web'];
        return buildSuccessGrpcWebResponse(protosetBase64);
      });

      await invokeGrpcWebUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          metadata: { 'x-grpc-web': '0' },
        },
        tabId: 'tab-reserved-gw-xgrpc',
        protosetBase64,
        fetchFn,
      });

      expect(capturedGrpcWeb).toBe('1');
    });

    it('spring-servlet: user cannot override Content-Type via metadata', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedContentType: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedContentType = (init.headers as Record<string, string>)['Content-Type']
          ?? (init.headers as Record<string, string>)['content-type'];
        return buildSuccessSpringServletResponse(protosetBase64);
      });

      await invokeGrpcSpringServletUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          metadata: { 'content-type': 'text/plain' },
        },
        tabId: 'tab-reserved-ss',
        protosetBase64,
        fetchFn,
      });

      // Transport must own content-type
      expect(capturedContentType).toBe(SPRING_SERVLET_CONTENT_TYPE);
    });

    it('spring-servlet: user cannot override TE via metadata', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedTe: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedTe = (init.headers as Record<string, string>).TE
          ?? (init.headers as Record<string, string>).te;
        return buildSuccessSpringServletResponse(protosetBase64);
      });

      await invokeGrpcSpringServletUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          metadata: { te: 'gzip' },
        },
        tabId: 'tab-reserved-ss-te',
        protosetBase64,
        fetchFn,
      });

      expect(capturedTe).toBe(SPRING_SERVLET_TE_TRAILERS);
    });

    it('grpc-web: transport owns grpc-timeout when timeoutMs is set', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedTimeout: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedTimeout = (init.headers as Record<string, string>)['grpc-timeout'];
        return buildSuccessGrpcWebResponse(protosetBase64);
      });

      await invokeGrpcWebUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          timeoutMs: 5000,
          metadata: { 'grpc-timeout': '9999m' },
        },
        tabId: 'tab-timeout-gw',
        protosetBase64,
        fetchFn,
      });

      expect(capturedTimeout).toBe('5000m');
    });

    it('spring-servlet: transport owns grpc-timeout when timeoutMs is set', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedTimeout: string | undefined;

      const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
        capturedTimeout = (init.headers as Record<string, string>)['grpc-timeout'];
        return buildSuccessSpringServletResponse(protosetBase64);
      });

      await invokeGrpcSpringServletUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          timeoutMs: 3000,
          metadata: { 'grpc-timeout': '9999m' },
        },
        tabId: 'tab-timeout-ss',
        protosetBase64,
        fetchFn,
      });

      expect(capturedTimeout).toBe('3000m');
    });
  });

  // ── TLS mode → URL scheme parity ─────────────────────────────────────────────

  describe('TLS parity — URL scheme matches tlsMode', () => {
    it('grpc-web: uses http scheme when tlsMode is disabled', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedUrl = '';

      const fetchFn = vi.fn(async (url: string) => {
        capturedUrl = url;
        return buildSuccessGrpcWebResponse(protosetBase64);
      });

      await invokeGrpcWebUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          target: { ...FIXTURE_TARGET, tlsMode: 'disabled' },
        },
        tabId: 'tab-tls-gw-plain',
        protosetBase64,
        fetchFn,
      });

      expect(capturedUrl).toMatch(/^http:\/\//);
    });

    it('grpc-web: uses https scheme when tlsMode is enabled', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedUrl = '';

      const fetchFn = vi.fn(async (url: string) => {
        capturedUrl = url;
        return buildSuccessGrpcWebResponse(protosetBase64);
      });

      await invokeGrpcWebUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          target: { ...FIXTURE_TARGET, tlsMode: 'tls' },
        },
        tabId: 'tab-tls-gw-tls',
        protosetBase64,
        fetchFn,
      });

      expect(capturedUrl).toMatch(/^https:\/\//);
    });

    it('spring-servlet: uses http scheme when tlsMode is disabled', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedUrl = '';

      const fetchFn = vi.fn(async (url: string) => {
        capturedUrl = url;
        return buildSuccessSpringServletResponse(protosetBase64);
      });

      await invokeGrpcSpringServletUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          target: { ...FIXTURE_TARGET, tlsMode: 'disabled' },
        },
        tabId: 'tab-tls-ss-plain',
        protosetBase64,
        fetchFn,
      });

      expect(capturedUrl).toMatch(/^http:\/\//);
    });

    it('spring-servlet: uses https scheme when tlsMode is enabled', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedUrl = '';

      const fetchFn = vi.fn(async (url: string) => {
        capturedUrl = url;
        return buildSuccessSpringServletResponse(protosetBase64);
      });

      await invokeGrpcSpringServletUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          target: { ...FIXTURE_TARGET, tlsMode: 'tls' },
        },
        tabId: 'tab-tls-ss-tls',
        protosetBase64,
        fetchFn,
      });

      expect(capturedUrl).toMatch(/^https:\/\//);
    });

    it('grpc-web: uses https scheme when tlsMode is mtls', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedUrl = '';

      const fetchFn = vi.fn(async (url: string) => {
        capturedUrl = url;
        return buildSuccessGrpcWebResponse(protosetBase64);
      });

      await invokeGrpcWebUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          target: { ...FIXTURE_TARGET, tlsMode: 'mtls' },
        },
        tabId: 'tab-tls-gw-mtls',
        protosetBase64,
        fetchFn,
      });

      expect(capturedUrl).toMatch(/^https:\/\//);
    });

    it('spring-servlet: uses https scheme when tlsMode is mtls', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      let capturedUrl = '';

      const fetchFn = vi.fn(async (url: string) => {
        capturedUrl = url;
        return buildSuccessSpringServletResponse(protosetBase64);
      });

      await invokeGrpcSpringServletUnary({
        request: {
          ...FIXTURE_UNARY_CALL_REQUEST,
          target: { ...FIXTURE_TARGET, tlsMode: 'mtls' },
        },
        tabId: 'tab-tls-ss-mtls',
        protosetBase64,
        fetchFn,
      });

      expect(capturedUrl).toMatch(/^https:\/\//);
    });
  });

  // ── Metadata casing (Phase 4 normalizeGrpcMetadata contract) ───────────────

  describe('metadata casing parity', () => {
    it('prepareGrpcCallMetadata lowercases manual keys before transport norm', () => {
      const merged = prepareGrpcCallMetadata(
        { 'X-Trace-Id': 'trace-cased' },
        undefined,
        undefined,
      );
      expect(merged?.['x-trace-id']).toBe('trace-cased');
      expect(merged?.['X-Trace-Id']).toBeUndefined();

      const { headers } = buildBrowserTransportUserMetadataHeaders(merged, GRPC_WEB_RESERVED_HEADERS);
      expect(headers['x-trace-id']).toBe('trace-cased');
    });

    it('mixed-case reserved keys are filtered at transport norm layer', () => {
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'Content-Type': 'text/plain', 'x-custom': 'ok' },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['Content-Type']).toBeUndefined();
      expect(headers['x-custom']).toBe('ok');
    });
  });

  // ── Phase 4 redaction regression (transport sends full values; export/display redact) ──

  describe('Phase 4 redaction regression', () => {
    it('transport passes authorization intact but export still redacts', () => {
      const metadata = {
        authorization: 'Bearer transport-secret-token',
        'x-trace': 'trace-1',
      };
      const { headers } = buildBrowserTransportUserMetadataHeaders(metadata, GRPC_WEB_RESERVED_HEADERS);
      expect(headers.authorization).toBe('Bearer transport-secret-token');

      const exported = redactGrpcCallRequestForExport({
        ...FIXTURE_UNARY_CALL_REQUEST,
        metadata: headers,
        auth: { type: 'bearer', bearerToken: 'transport-secret-token' },
      });
      expect(exported.metadata?.authorization).toBe(GRPC_REDACTED_PLACEHOLDER);
    });

    it('-bin values pass through transport but export redacts binary metadata', () => {
      const binValue = btoa('binary-payload');
      const { headers } = buildBrowserTransportUserMetadataHeaders(
        { 'payload-bin': binValue },
        GRPC_WEB_RESERVED_HEADERS,
      );
      expect(headers['payload-bin']).toBe(binValue);

      const exported = redactGrpcCallRequestForExport({
        ...FIXTURE_UNARY_CALL_REQUEST,
        metadata: headers,
      });
      expect(exported.metadata?.['payload-bin']).toBe('[base64]');
    });
  });

  // ── Auth precedence (Phase 4) before transport header emission ───────────────

  describe('auth precedence before transport', () => {
    it('prepareGrpcCallMetadata: auth wins over conflicting manual authorization', () => {
      const merged = prepareGrpcCallMetadata(
        { authorization: 'Bearer manual-override' },
        { type: 'bearer', bearerToken: 'injected-token' },
        undefined,
      );
      expect(merged?.authorization).toBe('Bearer injected-token');

      const { headers } = buildBrowserTransportUserMetadataHeaders(merged, GRPC_WEB_RESERVED_HEADERS);
      expect(headers.authorization).toBe('Bearer injected-token');
    });

    it('prepareGrpcCallMetadata: api_key auth wins over conflicting manual key', () => {
      const merged = prepareGrpcCallMetadata(
        { 'x-api-key': 'manual-key' },
        { type: 'api_key', apiKeyName: 'x-api-key', apiKeyValue: 'injected-key' },
        undefined,
      );
      expect(merged?.['x-api-key']).toBe('injected-key');

      const { headers } = buildBrowserTransportUserMetadataHeaders(merged, SPRING_SERVLET_RESERVED_HEADERS);
      expect(headers['x-api-key']).toBe('injected-key');
    });
  });

  // ── Cross-mode: same user metadata keys reach both transports ─────────────────

  describe('cross-mode user metadata key parity', () => {
    it('same user keys reach grpc-web and spring-servlet fetch equally', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      const base64Payload = btoa('shared-binary');
      const sharedMetadata = {
        authorization: 'Bearer shared-auth',
        'x-trace-id': 'trace-shared',
        'custom-data-bin': base64Payload,
      };

      let grpcWebUserHeaders: Record<string, string> = {};
      let springUserHeaders: Record<string, string> = {};

      const grpcWebFetch = vi.fn(async (_url: string, init: RequestInit) => {
        grpcWebUserHeaders = { ...(init.headers as Record<string, string>) };
        return buildSuccessGrpcWebResponse(protosetBase64);
      });
      const springFetch = vi.fn(async (_url: string, init: RequestInit) => {
        springUserHeaders = { ...(init.headers as Record<string, string>) };
        return buildSuccessSpringServletResponse(protosetBase64);
      });

      await invokeGrpcWebUnary({
        request: { ...FIXTURE_UNARY_CALL_REQUEST, metadata: sharedMetadata },
        tabId: 'tab-parity-both-gw',
        protosetBase64,
        fetchFn: grpcWebFetch,
      });
      await invokeGrpcSpringServletUnary({
        request: { ...FIXTURE_UNARY_CALL_REQUEST, metadata: sharedMetadata },
        tabId: 'tab-parity-both-ss',
        protosetBase64,
        fetchFn: springFetch,
      });

      for (const key of ['authorization', 'x-trace-id', 'custom-data-bin'] as const) {
        expect(grpcWebUserHeaders[key]).toBe(sharedMetadata[key]);
        expect(springUserHeaders[key]).toBe(sharedMetadata[key]);
      }
    });

    it('same compression headers reach grpc-web and spring-servlet fetch equally', async () => {
      const protosetBase64 = buildEchoProtosetBase64();
      const compressionMetadata = {
        'grpc-encoding': 'gzip',
        'grpc-accept-encoding': 'gzip,identity',
      };

      let grpcWebHeaders: Record<string, string> = {};
      let springHeaders: Record<string, string> = {};

      const grpcWebFetch = vi.fn(async (_url: string, init: RequestInit) => {
        grpcWebHeaders = { ...(init.headers as Record<string, string>) };
        return buildSuccessGrpcWebResponse(protosetBase64);
      });
      const springFetch = vi.fn(async (_url: string, init: RequestInit) => {
        springHeaders = { ...(init.headers as Record<string, string>) };
        return buildSuccessSpringServletResponse(protosetBase64);
      });

      await invokeGrpcWebUnary({
        request: { ...FIXTURE_UNARY_CALL_REQUEST, metadata: compressionMetadata },
        tabId: 'tab-compress-gw',
        protosetBase64,
        fetchFn: grpcWebFetch,
      });
      await invokeGrpcSpringServletUnary({
        request: { ...FIXTURE_UNARY_CALL_REQUEST, metadata: compressionMetadata },
        tabId: 'tab-compress-ss',
        protosetBase64,
        fetchFn: springFetch,
      });

      expect(grpcWebHeaders['grpc-encoding']).toBe('gzip');
      expect(grpcWebHeaders['grpc-accept-encoding']).toBe('gzip,identity');
      expect(springHeaders['grpc-encoding']).toBe('gzip');
      expect(springHeaders['grpc-accept-encoding']).toBe('gzip,identity');
    });
  });
});

describe('Phase 10F acceptance checklist', () => {
  it('package.json exposes test:grpc:phase10f', () => {
    expect(pkg.scripts?.['test:grpc:phase10f']).toContain('test-grpc-phase10f.sh');
  });

  it('clients use shared buildBrowserTransportUserMetadataHeaders', async () => {
    const webSource = await readFile(`${root}/shared/grpc/grpcGrpcWebUnaryClient.ts`, 'utf8');
    const servletSource = await readFile(`${root}/shared/grpc/grpcGrpcSpringServletUnaryClient.ts`, 'utf8');
    expect(webSource).toContain('buildBrowserTransportUserMetadataHeaders');
    expect(servletSource).toContain('buildBrowserTransportUserMetadataHeaders');
    expect(webSource).toContain('GRPC_WEB_RESERVED_HEADERS');
    expect(webSource).not.toMatch(/const RESERVED_GRPC_WEB_HEADERS/);
    expect(servletSource).toContain('SPRING_SERVLET_RESERVED_HEADERS');
  });

  it('GRPC_WEB_RESERVED_HEADERS lives in grpcWebTransportContracts', async () => {
    const source = await readFile(`${root}/shared/grpc/grpcWebTransportContracts.ts`, 'utf8');
    expect(source).toContain('export const GRPC_WEB_RESERVED_HEADERS');
  });

  it('norm module exports GRPC_AUTH_HEADER_KEYS contract', async () => {
    const source = await readFile(`${root}/shared/grpc/grpcBrowserTransportMetadataNorm.ts`, 'utf8');
    expect(source).toContain('export const GRPC_AUTH_HEADER_KEYS');
    expect(GRPC_AUTH_HEADER_KEYS.has('authorization')).toBe(true);
    expect(GRPC_AUTH_HEADER_KEYS.has('x-api-key')).toBe(true);
  });

  it('acceptance covers metadata casing, auth precedence, and redaction regression', async () => {
    const source = await readFile(`${root}/shared/grpc/grpcPhase10fAcceptance.test.ts`, 'utf8');
    expect(source).toContain('metadata casing parity');
    expect(source).toContain('auth precedence before transport');
    expect(source).toContain('Phase 4 redaction regression');
  });

  it('execute boundary merges auth/compression via prepareGrpcCallMetadata before transport', async () => {
    const studioTypes = await readFile(`${root}/features/grpc/grpcStudioTypes.ts`, 'utf8');
    const harnessAdapter = await readFile(`${root}/shared/grpc/grpcHarnessTransportAdapter.ts`, 'utf8');
    expect(studioTypes).toMatch(/metadata:\s*prepareGrpcCallMetadata\(/);
    expect(harnessAdapter).toContain('snapshotToUnaryCallRequest');
  });
});
