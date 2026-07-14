/**
 * Phase 10A — gRPC-Web transport contract unit tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GrpcCallType } from './contracts';
import { GRPC_ERROR_CODES } from './contracts';

vi.mock('../utils/platform', () => ({
  isTauri: vi.fn(() => false),
}));

import { isTauri } from '../utils/platform';
import {
  GRPC_STUDIO_TRANSPORT_MODES,
  GRPC_TRANSPORT_CAPABILITY_MATRIX,
  GRPC_WEB_CONTENT_TYPES,
  GRPC_WEB_TRANSPORT_SCHEMA_VERSION,
  GrpcWebTransportPreflightError,
  assertGrpcTransportCallTypeSupported,
  assertGrpcTransportExecutePreflight,
  assertBrowserDirectTransportTlsSupported,
  assertGrpcTransportPlatformSupported,
  captureGrpcTransportExecuteSnapshotFields,
  defaultGrpcStudioTransportModeForPlatform,
  getGrpcTransportCapabilities,
  isGrpcStudioTransportMode,
  isGrpcTransportCallTypeSupported,
  isGrpcTransportPlatformSupported,
  validateGrpcWebTransportSchemaVersion,
} from './grpcWebTransportContracts';

describe('grpcWebTransportContracts (Phase 10A)', () => {
  afterEach(() => {
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it('freezes schema version 1', () => {
    expect(GRPC_WEB_TRANSPORT_SCHEMA_VERSION).toBe(1);
    expect(validateGrpcWebTransportSchemaVersion(1)).toBe(true);
    expect(validateGrpcWebTransportSchemaVersion(2)).toBe(false);
  });

  it('declares four studio transport modes', () => {
    expect(GRPC_STUDIO_TRANSPORT_MODES).toEqual([
      'express',
      'tauri',
      'grpc-web',
      'spring-servlet',
    ]);
  });

  it('freezes grpc-web content types', () => {
    expect(GRPC_WEB_CONTENT_TYPES.BINARY).toBe('application/grpc-web+proto');
    expect(GRPC_WEB_CONTENT_TYPES.TEXT).toBe('application/grpc-web-text+proto');
  });

  it('isGrpcStudioTransportMode guards mode strings', () => {
    expect(isGrpcStudioTransportMode('grpc-web')).toBe(true);
    expect(isGrpcStudioTransportMode('invalid')).toBe(false);
  });

  it('express and tauri support all call types', () => {
    const allTypes: GrpcCallType[] = [
      'unary',
      'server_streaming',
      'client_streaming',
      'bidi_streaming',
    ];
    for (const callType of allTypes) {
      expect(isGrpcTransportCallTypeSupported('express', callType)).toBe(true);
      expect(isGrpcTransportCallTypeSupported('tauri', callType)).toBe(true);
    }
  });

  it('grpc-web and spring-servlet block client and bidi streaming', () => {
    expect(isGrpcTransportCallTypeSupported('grpc-web', 'unary')).toBe(true);
    expect(isGrpcTransportCallTypeSupported('grpc-web', 'server_streaming')).toBe(true);
    expect(isGrpcTransportCallTypeSupported('grpc-web', 'client_streaming')).toBe(false);
    expect(isGrpcTransportCallTypeSupported('grpc-web', 'bidi_streaming')).toBe(false);

    expect(isGrpcTransportCallTypeSupported('spring-servlet', 'unary')).toBe(true);
    expect(isGrpcTransportCallTypeSupported('spring-servlet', 'server_streaming')).toBe(true);
    expect(isGrpcTransportCallTypeSupported('spring-servlet', 'client_streaming')).toBe(false);
    expect(isGrpcTransportCallTypeSupported('spring-servlet', 'bidi_streaming')).toBe(false);
  });

  it('GrpcWebTransportPreflightError.toErrorBody returns validation envelope', () => {
    try {
      assertGrpcTransportCallTypeSupported('grpc-web', 'client_streaming');
    } catch (error) {
      expect(error).toBeInstanceOf(GrpcWebTransportPreflightError);
      expect((error as GrpcWebTransportPreflightError).toErrorBody()).toEqual({
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        category: 'validation',
        message: expect.stringMatching(/client streaming/i),
      });
    }
  });

  it('isGrpcTransportCallTypeSupported returns false for unknown call types', () => {
    expect(isGrpcTransportCallTypeSupported('express', 'unknown' as GrpcCallType)).toBe(false);
  });

  it('assertGrpcTransportCallTypeSupported uses server streaming label when capability blocks it', () => {
    const matrixEntry = GRPC_TRANSPORT_CAPABILITY_MATRIX['grpc-web'];
    const previous = matrixEntry.serverStreaming;
    matrixEntry.serverStreaming = false;
    try {
      expect(() => assertGrpcTransportCallTypeSupported('grpc-web', 'server_streaming'))
        .toThrow(/server streaming/i);
    } finally {
      matrixEntry.serverStreaming = previous;
    }
  });

  it('assertGrpcTransportCallTypeSupported uses unary label when capability blocks it', () => {
    const matrixEntry = GRPC_TRANSPORT_CAPABILITY_MATRIX.express;
    const previous = matrixEntry.unary;
    matrixEntry.unary = false;
    try {
      expect(() => assertGrpcTransportCallTypeSupported('express', 'unary'))
        .toThrow(/unary/i);
    } finally {
      matrixEntry.unary = previous;
    }
  });

  it('assertGrpcTransportCallTypeSupported throws validation error for blocked combinations', () => {
    expect(() => assertGrpcTransportCallTypeSupported('grpc-web', 'client_streaming'))
      .toThrow(GrpcWebTransportPreflightError);
    try {
      assertGrpcTransportCallTypeSupported('spring-servlet', 'bidi_streaming');
    } catch (error) {
      expect(error).toBeInstanceOf(GrpcWebTransportPreflightError);
      const preflight = error as GrpcWebTransportPreflightError;
      expect(preflight.category).toBe('validation');
      expect(preflight.mode).toBe('spring-servlet');
      expect(preflight.callType).toBe('bidi_streaming');
      expect(preflight.message).toMatch(/bidirectional streaming/i);
      expect(preflight.message).toMatch(/Express Proxy|Tauri Native/i);
    }
  });

  it('capability matrix matches call-type support flags', () => {
    for (const mode of GRPC_STUDIO_TRANSPORT_MODES) {
      const caps = getGrpcTransportCapabilities(mode);
      expect(caps.mode).toBe(mode);
      expect(caps).toEqual(GRPC_TRANSPORT_CAPABILITY_MATRIX[mode]);
    }
  });

  it('browser-direct modes are not browser-only in capability matrix', () => {
    expect(getGrpcTransportCapabilities('grpc-web').browserOnly).toBe(false);
    expect(getGrpcTransportCapabilities('spring-servlet').browserOnly).toBe(false);
    expect(getGrpcTransportCapabilities('express').browserOnly).toBe(false);
  });

  it('tauri is desktop-only in capability matrix', () => {
    expect(getGrpcTransportCapabilities('tauri').desktopOnly).toBe(true);
    expect(getGrpcTransportCapabilities('tauri').tauriNative).toBe(true);
  });

  it('captureGrpcTransportExecuteSnapshotFields freezes mode and schema version', () => {
    const fields = captureGrpcTransportExecuteSnapshotFields('grpc-web');
    expect(fields).toEqual({
      transportMode: 'grpc-web',
      transportSchemaVersion: 1,
    });
  });

  it('express is supported on web', () => {
    expect(isGrpcTransportPlatformSupported('express')).toBe(true);
    expect(() => assertGrpcTransportPlatformSupported('express')).not.toThrow();
  });

  it('grpc-web is supported on web and desktop', () => {
    expect(isGrpcTransportPlatformSupported('grpc-web')).toBe(true);
    vi.mocked(isTauri).mockReturnValue(true);
    expect(isGrpcTransportPlatformSupported('grpc-web')).toBe(true);
    expect(() => assertGrpcTransportPlatformSupported('grpc-web')).not.toThrow();
  });

  it('tauri is supported on desktop but not web', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    expect(isGrpcTransportPlatformSupported('tauri')).toBe(true);

    vi.mocked(isTauri).mockReturnValue(false);
    expect(isGrpcTransportPlatformSupported('tauri')).toBe(false);
    expect(() => assertGrpcTransportPlatformSupported('tauri'))
      .toThrow(/desktop/i);
  });

  it('browserOnly modes are rejected on desktop', () => {
    const matrixEntry = GRPC_TRANSPORT_CAPABILITY_MATRIX['grpc-web'];
    const previous = matrixEntry.browserOnly;
    matrixEntry.browserOnly = true;
    try {
      vi.mocked(isTauri).mockReturnValue(true);
      expect(isGrpcTransportPlatformSupported('grpc-web')).toBe(false);
      expect(() => assertGrpcTransportPlatformSupported('grpc-web'))
        .toThrow(/browser build/i);
    } finally {
      matrixEntry.browserOnly = previous;
      vi.mocked(isTauri).mockReturnValue(false);
    }
  });

  it('assertGrpcTransportExecutePreflight combines platform and call-type checks', () => {
    expect(() => assertGrpcTransportExecutePreflight({
      transportMode: 'grpc-web',
      callType: 'client_streaming',
    })).toThrow(GrpcWebTransportPreflightError);
  });

  it('assertBrowserDirectTransportTlsSupported blocks mTLS on grpc-web', () => {
    expect(() => assertBrowserDirectTransportTlsSupported('grpc-web', 'mtls'))
      .toThrow(/mTLS/i);
    expect(() => assertBrowserDirectTransportTlsSupported('grpc-web', 'tls')).not.toThrow();
    expect(() => assertBrowserDirectTransportTlsSupported('express', 'mtls')).not.toThrow();
  });

  it('assertGrpcTransportExecutePreflight blocks mTLS on spring-servlet', () => {
    expect(() => assertGrpcTransportExecutePreflight({
      transportMode: 'spring-servlet',
      callType: 'unary',
      tlsMode: 'mtls',
    })).toThrow(/mTLS/i);
  });

  it('defaultGrpcStudioTransportModeForPlatform returns express on web', () => {
    vi.mocked(isTauri).mockReturnValue(false);
    expect(defaultGrpcStudioTransportModeForPlatform()).toBe('express');
  });

  it('defaultGrpcStudioTransportModeForPlatform returns tauri on desktop', () => {
    vi.mocked(isTauri).mockReturnValue(true);
    expect(defaultGrpcStudioTransportModeForPlatform()).toBe('tauri');
  });
});
