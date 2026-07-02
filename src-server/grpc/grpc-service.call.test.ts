/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import { GRPC_ERROR_CODES } from '../../src/shared/grpc/contracts.js';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_UNARY_CALL_REQUEST,
} from '../../src/shared/grpc/contractFixtures.js';
import { clearGrpcCallRegistry, getGrpcCallEntry } from '../grpc/callRegistry.js';
import { clearDynamicProtoCodecCache } from '../grpc/dynamicProtoCodec.js';
import { clearGrpcDescriptorStore, setGrpcDescriptor } from '../grpc/descriptorStore.js';
import { clearDescriptorCacheManager } from '../grpc/descriptorCacheManager.js';
import { clearDescriptorRootCache } from '../grpc/descriptorRootCache.js';
import { descriptorLoader } from './descriptorLoader.js';
import { GrpcService } from '../grpc/grpc-service.js';
import type { GrpcClientPort } from '../grpc/grpcClient.js';
import { GrpcOAuth2TokenService } from './grpcOAuth2TokenService.js';
import { createMockGrpcClientPort } from './grpc-service.testHelpers.js';

describe('GrpcService call/cancel', () => {
  let mockClient: GrpcClientPort;
  let service: GrpcService;

  function createOAuth2TokenService(fetch: (url: string, init?: RequestInit) => Promise<Response>) {
    return new GrpcOAuth2TokenService(
      { fetch },
      { resolveHostname: async () => ['93.184.216.34'] },
    );
  }

  beforeEach(() => {
    clearGrpcCallRegistry();
    clearGrpcDescriptorStore();
    clearDescriptorCacheManager();
    clearDescriptorRootCache();
    clearDynamicProtoCodecCache();
    mockClient = createMockGrpcClientPort();
    service = new GrpcService(mockClient);
    setGrpcDescriptor(FIXTURE_DESCRIPTOR);
  });

  describe('call', () => {
    it('invokes unary call with encoded payload', async () => {
      const envelope = await service.call(FIXTURE_UNARY_CALL_REQUEST, 'tab-1');

      expect(envelope.ok).toBe(true);
      if (envelope.ok) {
        expect(envelope.data.body).toEqual({ message: 'hello grpc' });
      }
      expect(mockClient.invokeUnary).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'echo.EchoService',
          method: 'Echo',
        }),
      );
    });

    it('passes TLS target to unary invoke when tlsMode is tls (Phase 4F)', async () => {
      await service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-tls-unary',
        target: {
          address: 'localhost:50051',
          tlsMode: 'tls',
          tlsConfig: { serverNameOverride: 'grpc.local' },
        },
      }, 'tab-1');

      expect(mockClient.invokeUnary).toHaveBeenCalledWith(
        expect.objectContaining({
          tlsMode: 'tls',
          tlsConfig: expect.objectContaining({ serverNameOverride: 'grpc.local' }),
        }),
      );
    });

    it('classifies TLS transport failures on unary call (Phase 4F)', async () => {
      mockClient.invokeUnary = vi.fn(async () => {
        throw new Error('self signed certificate in certificate chain');
      });
      const envelope = await service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-tls-failure',
      }, 'tab-1');
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
        expect(envelope.error.message).toMatch(/not trusted/i);
        expect((envelope.error.details as { tlsFailure?: string })?.tlsFailure).toBe('unknown_ca');
      }
    });

    it('classifies gRPC DEADLINE_EXCEEDED as call_failed not TLS (Phase 4F)', async () => {
      const deadlineError = Object.assign(new Error('Deadline Exceeded'), {
        grpcStatus: grpc.status.DEADLINE_EXCEEDED,
        grpcDetails: 'Deadline Exceeded',
      });
      mockClient.invokeUnary = vi.fn(async () => {
        throw deadlineError;
      });
      const envelope = await service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-deadline-exceeded',
      }, 'tab-1');
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.CALL_FAILED);
        expect((envelope.error.details as { tlsFailure?: string })?.tlsFailure).toBeUndefined();
        expect((envelope.error.details as { grpcStatus?: number })?.grpcStatus).toBe(4);
      }
    });

    it('classifies gRPC UNAVAILABLE connect failures as unreachable on unary call (Phase 4F)', async () => {
      const connectError = Object.assign(new Error('14 UNAVAILABLE'), {
        grpcStatus: grpc.status.UNAVAILABLE,
        grpcDetails: 'failed to connect to all addresses',
      });
      mockClient.invokeUnary = vi.fn(async () => {
        throw connectError;
      });
      const envelope = await service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-unavailable-connect',
      }, 'tab-1');
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
        expect(envelope.error.retryable).toBe(true);
        expect((envelope.error.details as { tlsFailure?: string })?.tlsFailure).toBeUndefined();
      }
    });

    it('merges basic auth into unary call metadata via shared auth policy (Phase 4A)', async () => {
      await service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-basic-auth-unary',
        auth: { type: 'basic', basicUsername: 'alice', basicPassword: 'secret' },
      }, 'tab-1');

      expect(mockClient.invokeUnary).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            authorization: expect.stringMatching(/^Basic /),
          }),
        }),
      );
    });

    it('auth panel overrides conflicting authorization metadata on unary call (Phase 4A)', async () => {
      await service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-auth-precedence-unary',
        metadata: { authorization: 'Bearer manual-token' },
        auth: { type: 'bearer', bearerToken: 'panel-token' },
      }, 'tab-1');

      expect(mockClient.invokeUnary).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            authorization: 'Bearer panel-token',
          }),
        }),
      );
    });

    it('merges oauth2 auth into unary metadata via server-side token acquisition (Phase 4D)', async () => {
      const oauth2TokenService = createOAuth2TokenService(vi.fn(async () => new Response(JSON.stringify({
          access_token: 'oauth-access-token',
        }), { status: 200 })),
      );
      const oauthService = new GrpcService(mockClient, descriptorLoader, oauth2TokenService);

      await oauthService.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-oauth-unary',
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'client',
            clientSecret: 'secret',
          },
        },
      }, 'tab-1');

      expect(mockClient.invokeUnary).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            authorization: 'Bearer oauth-access-token',
          }),
        }),
      );
    });

    it('returns validation error when oauth2 token acquisition fails (Phase 4D)', async () => {
      const oauth2TokenService = createOAuth2TokenService(vi.fn(async () => new Response(JSON.stringify({
          error: 'invalid_client',
        }), { status: 401 })),
      );
      const oauthService = new GrpcService(mockClient, descriptorLoader, oauth2TokenService);

      const envelope = await oauthService.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-oauth-fail',
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'client',
            clientSecret: 'secret',
          },
        },
      }, 'tab-1');

      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.message).toMatch(/invalid_client/i);
        expect(envelope.error.message).not.toMatch(/client_secret=|Bearer /i);
      }
      expect(mockClient.invokeUnary).not.toHaveBeenCalled();
    });

    it('does not fetch oauth2 token when unary preflight validation fails (Phase 4D)', async () => {
      const fetchSpy = vi.fn(async () => new Response(JSON.stringify({
        access_token: 'should-not-fetch',
      }), { status: 200 }));
      const oauth2TokenService = createOAuth2TokenService(fetchSpy);
      const oauthService = new GrpcService(mockClient, descriptorLoader, oauth2TokenService);

      const envelope = await oauthService.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        descriptorKey: 'missing-descriptor-key',
        requestId: 'req-oauth-preflight',
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'client',
            clientSecret: 'secret',
          },
        },
      }, 'tab-1');

      expect(envelope.ok).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockClient.invokeUnary).not.toHaveBeenCalled();
    });

    it('does not leave orphaned call registry entries when oauth2 token acquisition fails (Phase 4D)', async () => {
      const oauth2TokenService = createOAuth2TokenService(vi.fn(async () => new Response(JSON.stringify({
          error: 'invalid_client',
        }), { status: 401 })),
      );
      const oauthService = new GrpcService(mockClient, descriptorLoader, oauth2TokenService);

      const envelope = await oauthService.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-oauth-orphan',
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'client',
            clientSecret: 'secret',
          },
        },
      }, 'tab-1');

      expect(envelope.ok).toBe(false);
      expect(getGrpcCallEntry('req-oauth-orphan')).toBeUndefined();

      const fetchOk = vi.fn(async () => new Response(JSON.stringify({
        access_token: 'retry-token',
      }), { status: 200 }));
      const retryService = new GrpcService(
        mockClient,
        descriptorLoader,
        createOAuth2TokenService(fetchOk),
      );
      const retry = await retryService.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-oauth-orphan',
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'client',
            clientSecret: 'secret',
          },
        },
      }, 'tab-1');
      expect(retry.ok).toBe(true);
    });

    it('returns validation error when oauth2 token acquisition fails with invalid_scope (Phase 4D)', async () => {
      const oauth2TokenService = createOAuth2TokenService(vi.fn(async () => new Response(JSON.stringify({
          error: 'invalid_scope',
          error_description: 'scope grpc.write not allowed',
        }), { status: 400 })),
      );
      const oauthService = new GrpcService(mockClient, descriptorLoader, oauth2TokenService);

      const envelope = await oauthService.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'req-oauth-scope',
        auth: {
          type: 'oauth2',
          oauth2: {
            tokenUrl: 'https://auth.example.com/token',
            clientId: 'client',
            clientSecret: 'secret',
            scope: 'grpc.write',
          },
        },
      }, 'tab-1');

      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.message).toMatch(/invalid_scope/i);
      }
      expect(getGrpcCallEntry('req-oauth-scope')).toBeUndefined();
      expect(mockClient.invokeUnary).not.toHaveBeenCalled();
    });

    it('returns validation error for invalid request body encoding', async () => {
      const envelope = await service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        body: { message: 123 },
      });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
      }
      expect(getGrpcCallEntry(FIXTURE_UNARY_CALL_REQUEST.requestId)).toBeUndefined();
    });

    it('returns cancelled when invoke resolves after cancel', async () => {
      mockClient.invokeUnary = vi.fn(() => new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            status: 0,
            statusMessage: 'OK',
            headers: {},
            trailers: {},
            body: { message: 'late' },
          });
        }, 50);
      }));

      const callPromise = service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'late-success-001',
      }, 'tab-late');

      await new Promise((resolve) => setTimeout(resolve, 5));
      service.cancel('late-success-001', 'tab-late');

      const envelope = await callPromise;
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.CANCELLED);
      }
    });

    it('returns descriptor error when response decode fails', async () => {
      const echoMethod = FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'Echo')!;
      setGrpcDescriptor({
        ...FIXTURE_DESCRIPTOR,
        services: [{
          fullName: 'echo.EchoService',
          methods: [{
            ...echoMethod,
            responseTypeName: 'echo.NotInProto',
            responseSchema: echoMethod.responseSchema,
          }],
        }],
      });

      mockClient.invokeUnary = vi.fn(async ({ decodeResponse }) => ({
        status: 0,
        statusMessage: 'OK',
        headers: {},
        trailers: {},
        body: decodeResponse(Buffer.from([])),
      }));

      const envelope = await service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'decode-fail-001',
      });

      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
      }
    });

    it('rejects duplicate active requestId', async () => {
      mockClient.invokeUnary = vi.fn(({ signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Call cancelled')));
      }));

      const first = service.call(FIXTURE_UNARY_CALL_REQUEST);
      await new Promise((resolve) => setTimeout(resolve, 5));

      const duplicate = await service.call(FIXTURE_UNARY_CALL_REQUEST);
      expect(duplicate.ok).toBe(false);
      if (!duplicate.ok) {
        expect(duplicate.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
        expect(duplicate.error.message).toContain('already in use');
      }

      service.cancel(FIXTURE_UNARY_CALL_REQUEST.requestId);
      const firstEnvelope = await first;
      expect(firstEnvelope.ok).toBe(false);
      if (!firstEnvelope.ok) {
        expect(firstEnvelope.error.code).toBe(GRPC_ERROR_CODES.CANCELLED);
      }
    });

    it('rejects non-unary methods from descriptor', async () => {
      setGrpcDescriptor({
        ...FIXTURE_DESCRIPTOR,
        services: [{
          fullName: 'echo.EchoService',
          methods: [{
            ...FIXTURE_DESCRIPTOR.services[0]!.methods.find((entry) => entry.name === 'Echo')!,
            callType: 'server_streaming',
          }],
        }],
      });

      const envelope = await service.call(FIXTURE_UNARY_CALL_REQUEST);
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
      }
    });

    it('normalizes host:port before invoke', async () => {
      await service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        target: { address: 'localhost:50051', tlsMode: 'disabled' },
      });

      expect(mockClient.invokeUnary).toHaveBeenCalledWith(
        expect.objectContaining({ address: 'localhost:50051' }),
      );
    });

    it('returns descriptor missing error', async () => {
      const envelope = await service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        descriptorKey: 'missing-key',
      });
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_DESCRIPTOR);
      }
    });

    it('cancels in-flight call via DELETE contract', async () => {
      mockClient.invokeUnary = vi.fn(({ signal }) => new Promise((_resolve, reject) => {
        if (signal.aborted) {
          reject(new Error('Call cancelled before invoke'));
          return;
        }
        signal.addEventListener('abort', () => {
          reject(new Error('Call cancelled'));
        });
      }));

      const callPromise = service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'cancel-me-001',
      }, 'tab-cancel');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const cancelEnvelope = service.cancel('cancel-me-001', 'tab-cancel');
      expect(cancelEnvelope.ok).toBe(true);
      if (cancelEnvelope.ok) {
        expect(cancelEnvelope.data.cancelled).toBe(true);
      }

      const callEnvelope = await callPromise;
      expect(callEnvelope.ok).toBe(false);
      if (!callEnvelope.ok) {
        expect(callEnvelope.error.code).toBe(GRPC_ERROR_CODES.CANCELLED);
      }
    });

    it('returns unreachable for in-process call targets', async () => {
      const envelope = await service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'in-process-call-1',
        target: { address: 'in-process:test-server', tlsMode: 'disabled' },
      });

      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.UNREACHABLE);
      }
      expect(mockClient.invokeUnary).not.toHaveBeenCalled();
    });

    it('marks registry cancelled when server returns gRPC CANCELLED status', async () => {
      mockClient.invokeUnary = vi.fn(async () => {
        const err = new Error('Cancelled') as Error & { grpcStatus: number; grpcDetails: string };
        err.grpcStatus = grpc.status.CANCELLED;
        err.grpcDetails = 'Cancelled';
        throw err;
      });

      const envelope = await service.call({
        ...FIXTURE_UNARY_CALL_REQUEST,
        requestId: 'grpc-cancelled-1',
      });

      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.CANCELLED);
      }
      expect(getGrpcCallEntry('grpc-cancelled-1')?.status).toBe('cancelled');
    });
  });

  describe('cancel', () => {
    it('returns not found for unknown requestId', () => {
      const envelope = service.cancel('unknown');
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
      }
    });

    it('returns not found for blank requestId', () => {
      const envelope = service.cancel('   ');
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.REQUEST_NOT_FOUND);
      }
    });

    it('returns alreadyCompleted when call finished', async () => {
      await service.call(FIXTURE_UNARY_CALL_REQUEST);
      const envelope = service.cancel(FIXTURE_UNARY_CALL_REQUEST.requestId);
      expect(envelope.ok).toBe(true);
      if (envelope.ok) {
        expect(envelope.data.cancelled).toBe(false);
        expect(envelope.data.alreadyCompleted).toBe(true);
      }
    });

    it('returns tab mismatch as invalid request', async () => {
      mockClient.invokeUnary = vi.fn(() => new Promise(() => {}));
      service.call({ ...FIXTURE_UNARY_CALL_REQUEST, requestId: 'tab-mismatch-1' }, 'tab-owner');
      await new Promise((resolve) => setTimeout(resolve, 5));

      const envelope = service.cancel('tab-mismatch-1', 'other-tab');
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
      }

      service.cancel('tab-mismatch-1', 'tab-owner');
    });

    it('rejects cancel without tabId when call was registered with tab ownership', async () => {
      mockClient.invokeUnary = vi.fn(({ signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Call cancelled')));
      }));

      service.call({ ...FIXTURE_UNARY_CALL_REQUEST, requestId: 'tab-owned-1' }, 'tab-owner');
      await new Promise((resolve) => setTimeout(resolve, 5));

      const envelope = service.cancel('tab-owned-1');
      expect(envelope.ok).toBe(false);
      if (!envelope.ok) {
        expect(envelope.error.code).toBe(GRPC_ERROR_CODES.INVALID_REQUEST);
      }

      service.cancel('tab-owned-1', 'tab-owner');
    });
  });
});
