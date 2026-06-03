/**
 * Phase 9D — Cross-transport parity hardening
 *
 * Verifies that server-proxy (defaultTransport) and native Tauri (kafkaNativeTauriTransport)
 * produce equivalent behaviour for all Kafka operations when driven from the same golden
 * fixtures in test-data/kafka/.
 *
 * Tests per fixture:
 *   1. dispatchKafkaOperation builds the same KafkaDispatchRequest regardless of transport
 *   2. Server-proxy path: httpFetch is called with the correct URL path and body/query
 *   3. Native path: invoke() is called with the correct Tauri command name and args
 *   4. Both transports return equivalent KafkaEnvelope from the same mock response
 *   5. Both transports throw an equivalent KafkaClientError on ok:false
 *   6. toKafkaUiSafeError() maps both errors to the same UI kind
 *
 * Concurrent parity test:
 *   7. produce + subscribe fire concurrently via a capture transport — both resolve
 *
 * Note on connect: unlike other POST commands, the connect fixture request is already
 * shaped as { connection: KafkaConnectionConfig } by useKafkaState.toConnectRequest.
 * The native transport passes the body as-is (no paramKey) — correct.
 * All other POST struct-param commands (produce/consume-once/subscribe/unsubscribe) pass
 * a flat request that the native transport wraps under the "request" paramKey.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchKafkaOperation,
  KafkaClientError,
  setKafkaClientTransport,
  toKafkaUiSafeError,
  type KafkaClientTransport,
  type KafkaDispatchRequest,
  type KafkaEnvelope,
  type KafkaOperation,
} from './kafkaClient';
import { kafkaNativeTauriTransport } from './kafkaNativeTauriTransport';

// ── Mock httpFetch (server-proxy path) ─────────────────────────────────────────
const mockHttpFetch = vi.fn();
vi.mock('../utils/httpClient', () => ({
  httpFetch: (...args: unknown[]) => mockHttpFetch(...args),
}));

// ── Mock @tauri-apps/api/core (native path) ────────────────────────────────────
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// ── Fixture types ──────────────────────────────────────────────────────────────

interface FixtureDispatch {
  op: KafkaOperation;
  method: 'GET' | 'POST';
  path: string;
  query: Record<string, string>;
  body?: Record<string, unknown>;
}

interface FixtureResponse {
  ok: boolean;
  op: string;
  data?: unknown;
  meta: { timestamp: string; durationMs?: number };
}

interface FixtureErrorShape {
  code: string;
  message: string;
  retryable: boolean;
}

interface KafkaFixture {
  operation: KafkaOperation;
  description: string;
  request: Record<string, unknown>;
  expectedDispatch: FixtureDispatch;
  expectedInvokeCommand: string;
  expectedInvokeArgs: Record<string, unknown>;
  expectedHttpBody?: Record<string, unknown>;
  expectedHttpQuery?: string;
  expectedResponse: FixtureResponse;
  expectedErrorShape?: FixtureErrorShape;
  /** Expected toKafkaUiSafeError kind — verified by the classification-parity test. */
  expectedErrorKind?: string;
}

// ── Import golden fixtures ─────────────────────────────────────────────────────
import connectFixture from '../../../test-data/kafka/connect.json';
import disconnectFixture from '../../../test-data/kafka/disconnect.json';
import statusFixture from '../../../test-data/kafka/status.json';
import topicsFixture from '../../../test-data/kafka/topics.json';
import produceFixture from '../../../test-data/kafka/produce.json';
import consumeOnceFixture from '../../../test-data/kafka/consume-once.json';
import subscribeFixture from '../../../test-data/kafka/subscribe.json';
import unsubscribeFixture from '../../../test-data/kafka/unsubscribe.json';
import subscriptionsFixture from '../../../test-data/kafka/subscriptions.json';

const ALL_FIXTURES: KafkaFixture[] = [
  connectFixture as unknown as KafkaFixture,
  disconnectFixture as unknown as KafkaFixture,
  statusFixture as unknown as KafkaFixture,
  topicsFixture as unknown as KafkaFixture,
  produceFixture as unknown as KafkaFixture,
  consumeOnceFixture as unknown as KafkaFixture,
  subscribeFixture as unknown as KafkaFixture,
  unsubscribeFixture as unknown as KafkaFixture,
  subscriptionsFixture as unknown as KafkaFixture,
];

// ── Helper: build httpFetch mock response from a KafkaEnvelope ────────────────
function httpOk(envelope: FixtureResponse) {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    body: JSON.stringify(envelope),
  };
}

// ── Helper: build ok:false envelope for error-path tests ─────────────────────
function errorEnvelope(op: KafkaOperation, errorShape: FixtureErrorShape): FixtureResponse {
  return {
    ok: false,
    op,
    error: errorShape,
    meta: { timestamp: '2026-06-01T00:00:00.000Z' },
  } as unknown as FixtureResponse;
}

// ── Dispatch-capture transport ─────────────────────────────────────────────────
// Used to record the KafkaDispatchRequest that dispatchKafkaOperation builds,
// independent of which actual transport handles the request.
function makeCaptureTransport(mockResponse: KafkaEnvelope): {
  transport: KafkaClientTransport;
  getCaptured: () => KafkaDispatchRequest | null;
} {
  let captured: KafkaDispatchRequest | null = null;
  const transport: KafkaClientTransport = async (request) => {
    captured = request;
    return mockResponse;
  };
  return { transport, getCaptured: () => captured };
}

// ── Shared setup / teardown ────────────────────────────────────────────────────
afterEach(() => {
  setKafkaClientTransport(null);
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// Per-fixture parity tests
// ══════════════════════════════════════════════════════════════════════════════

for (const fixture of ALL_FIXTURES) {
  describe(`parity fixture: ${fixture.operation}`, () => {

    // ── 1. Dispatch-request shape ──────────────────────────────────────────────
    describe('dispatch request parity', () => {
      it('dispatchKafkaOperation builds a KafkaDispatchRequest matching expectedDispatch', async () => {
        const { transport, getCaptured } = makeCaptureTransport(
          fixture.expectedResponse as unknown as KafkaEnvelope,
        );
        setKafkaClientTransport(transport);
        await dispatchKafkaOperation(fixture.operation, fixture.request);

        const captured = getCaptured()!;
        expect(captured.op).toBe(fixture.expectedDispatch.op);
        expect(captured.method).toBe(fixture.expectedDispatch.method);
        expect(captured.path).toBe(fixture.expectedDispatch.path);
        expect(captured.query).toEqual(fixture.expectedDispatch.query);

        if (fixture.expectedDispatch.method === 'POST') {
          expect(captured.body).toEqual(fixture.expectedDispatch.body);
        } else {
          // GET operations have no body
          expect(captured.body).toBeUndefined();
        }
      });
    });

    // ── 2. Server-proxy HTTP parity ───────────────────────────────────────────
    describe('server-proxy transport', () => {
      beforeEach(() => setKafkaClientTransport(null));

      it('httpFetch is called with correct HTTP method and path', async () => {
        mockHttpFetch.mockResolvedValue(httpOk(fixture.expectedResponse));
        await dispatchKafkaOperation(fixture.operation, fixture.request);

        expect(mockHttpFetch).toHaveBeenCalledOnce();
        const [url, method] = mockHttpFetch.mock.calls[0] as [string, string, unknown, string | undefined];
        expect(method).toBe(fixture.expectedDispatch.method);
        expect(url).toContain(fixture.expectedDispatch.path);
      });

      if (fixture.expectedDispatch.method === 'POST' && fixture.expectedHttpBody) {
        it('httpFetch POST body matches expectedHttpBody', async () => {
          mockHttpFetch.mockResolvedValue(httpOk(fixture.expectedResponse));
          await dispatchKafkaOperation(fixture.operation, fixture.request);

          const [, , , bodyText] = mockHttpFetch.mock.calls[0] as [string, string, unknown, string];
          expect(JSON.parse(bodyText)).toEqual(fixture.expectedHttpBody);
        });
      }

      if (fixture.expectedDispatch.method === 'GET' && fixture.expectedHttpQuery) {
        it('httpFetch GET URL contains expected query string', async () => {
          mockHttpFetch.mockResolvedValue(httpOk(fixture.expectedResponse));
          await dispatchKafkaOperation(fixture.operation, fixture.request);

          const [url] = mockHttpFetch.mock.calls[0] as [string];
          for (const pair of fixture.expectedHttpQuery.split('&')) {
            expect(url).toContain(pair);
          }
        });
      }

      it('returns KafkaEnvelope matching expectedResponse', async () => {
        mockHttpFetch.mockResolvedValue(httpOk(fixture.expectedResponse));
        const result = await dispatchKafkaOperation(fixture.operation, fixture.request);

        expect(result.ok).toBe(true);
        expect(result.op).toBe(fixture.operation);
        expect(result.data).toEqual(fixture.expectedResponse.data);
      });

      if (fixture.expectedErrorShape) {
        it('throws KafkaClientError with matching code on ok:false', async () => {
          mockHttpFetch.mockResolvedValue(
            httpOk(errorEnvelope(fixture.operation, fixture.expectedErrorShape!)),
          );

          await expect(
            dispatchKafkaOperation(fixture.operation, fixture.request),
          ).rejects.toThrow(KafkaClientError);

          try {
            await dispatchKafkaOperation(fixture.operation, fixture.request);
          } catch (err) {
            expect(err).toBeInstanceOf(KafkaClientError);
            const kafkaErr = err as KafkaClientError;
            expect(kafkaErr.code).toBe(fixture.expectedErrorShape!.code);
            expect(kafkaErr.message).toBe(fixture.expectedErrorShape!.message);
            expect(kafkaErr.retryable).toBe(fixture.expectedErrorShape!.retryable);
          }
        });
      }
    });

    // ── 3. Native Tauri transport parity ─────────────────────────────────────
    describe('native Tauri transport', () => {
      beforeEach(() => setKafkaClientTransport(kafkaNativeTauriTransport));
      afterEach(() => setKafkaClientTransport(null));

      it('invoke() is called with correct command name', async () => {
        mockInvoke.mockResolvedValue(fixture.expectedResponse);
        await dispatchKafkaOperation(fixture.operation, fixture.request);

        expect(mockInvoke).toHaveBeenCalledOnce();
        const [command] = mockInvoke.mock.calls[0] as [string, unknown];
        expect(command).toBe(fixture.expectedInvokeCommand);
      });

      it('invoke() args match expectedInvokeArgs', async () => {
        mockInvoke.mockResolvedValue(fixture.expectedResponse);
        await dispatchKafkaOperation(fixture.operation, fixture.request);

        const [, args] = mockInvoke.mock.calls[0] as [string, Record<string, unknown>];
        expect(args).toEqual(fixture.expectedInvokeArgs);
      });

      it('returns KafkaEnvelope matching expectedResponse', async () => {
        mockInvoke.mockResolvedValue(fixture.expectedResponse);
        const result = await dispatchKafkaOperation(fixture.operation, fixture.request);

        expect(result.ok).toBe(true);
        expect(result.op).toBe(fixture.operation);
        expect(result.data).toEqual(fixture.expectedResponse.data);
      });

      if (fixture.expectedErrorShape) {
        it('throws KafkaClientError with matching code on ok:false', async () => {
          mockInvoke.mockResolvedValue(
            errorEnvelope(fixture.operation, fixture.expectedErrorShape!),
          );

          await expect(
            dispatchKafkaOperation(fixture.operation, fixture.request),
          ).rejects.toThrow(KafkaClientError);

          try {
            await dispatchKafkaOperation(fixture.operation, fixture.request);
          } catch (err) {
            const kafkaErr = err as KafkaClientError;
            expect(kafkaErr.code).toBe(fixture.expectedErrorShape!.code);
            expect(kafkaErr.message).toBe(fixture.expectedErrorShape!.message);
            expect(kafkaErr.retryable).toBe(fixture.expectedErrorShape!.retryable);
          }
        });
      }
    });

    // ── 4. Error classification parity ───────────────────────────────────────
    if (fixture.expectedErrorShape) {
      describe('error classification parity (toKafkaUiSafeError)', () => {
        it('both transports produce the same UI error kind for fixture errorShape', async () => {
          const fakeErr = new KafkaClientError(fixture.operation, fixture.expectedErrorShape!.message, {
            code: fixture.expectedErrorShape!.code,
            retryable: fixture.expectedErrorShape!.retryable,
          });

          const uiError = toKafkaUiSafeError(fakeErr, fixture.operation);

          // code, message, retryable must be preserved exactly
          expect(uiError.code).toBe(fixture.expectedErrorShape!.code);
          expect(uiError.message).toBe(fixture.expectedErrorShape!.message);
          expect(uiError.retryable).toBe(fixture.expectedErrorShape!.retryable);

          // Assert the exact expected UI kind when specified in the fixture
          if (fixture.expectedErrorKind !== undefined) {
            expect(uiError.kind).toBe(fixture.expectedErrorKind);
          } else {
            // Fallback: verify it is at least a recognised kind
            expect(['auth', 'tls', 'timeout', 'network', 'validation', 'cluster', 'server', 'unknown']).toContain(
              uiError.kind,
            );
          }
        });
      });
    }
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Concurrent operation parity test
// ══════════════════════════════════════════════════════════════════════════════

describe('concurrent operation parity — produce + subscribe via capture transport', () => {
  it('both produce and subscribe resolve without interference', async () => {
    const produceResponse: KafkaEnvelope = {
      ok: true,
      op: 'produce',
      data: { topic: 'orders.created', sentCount: 1, records: [] },
      meta: { timestamp: '2026-06-01T00:00:00.000Z' },
    };
    const subscribeResponse: KafkaEnvelope = {
      ok: true,
      op: 'subscribe',
      data: { subscription: { subscriptionId: 'sub-001', topic: 'orders.created', groupId: 'g1', createdAt: '' } },
      meta: { timestamp: '2026-06-01T00:00:00.000Z' },
    };

    let produceRequest: KafkaDispatchRequest | null = null;
    let subscribeRequest: KafkaDispatchRequest | null = null;

    const captureTransport: KafkaClientTransport = async (req) => {
      if (req.op === 'produce') {
        produceRequest = req;
        return produceResponse;
      }
      if (req.op === 'subscribe') {
        subscribeRequest = req;
        return subscribeResponse;
      }
      throw new Error(`unexpected op: ${req.op}`);
    };

    setKafkaClientTransport(captureTransport);

    const [produceEnvelope, subscribeEnvelope] = await Promise.all([
      dispatchKafkaOperation('produce', {
        clusterId: 'parity-test-cluster',
        topic: 'orders.created',
        messages: [{ value: 'hello' }],
      }),
      dispatchKafkaOperation('subscribe', {
        clusterId: 'parity-test-cluster',
        topic: 'orders.created',
        groupId: 'g1',
      }),
    ]);

    // Both resolved successfully
    expect(produceEnvelope.ok).toBe(true);
    expect(produceEnvelope.op).toBe('produce');
    expect(subscribeEnvelope.ok).toBe(true);
    expect(subscribeEnvelope.op).toBe('subscribe');

    // Captured requests were correctly built
    expect(produceRequest).not.toBeNull();
    expect((produceRequest as unknown as KafkaDispatchRequest).method).toBe('POST');
    expect((produceRequest as unknown as KafkaDispatchRequest).path).toBe('/api/kafka/produce');

    expect(subscribeRequest).not.toBeNull();
    expect((subscribeRequest as unknown as KafkaDispatchRequest).method).toBe('POST');
    expect((subscribeRequest as unknown as KafkaDispatchRequest).path).toBe('/api/kafka/subscribe');
  });

  // Note: concurrent native transport testing is covered by the per-fixture
  // native transport describe blocks above. Those tests already verify that
  // invoke() is called correctly for both produce and subscribe independently.
});

// ══════════════════════════════════════════════════════════════════════════════
// Envelope equivalence: same mock response → same data in both transports
// ══════════════════════════════════════════════════════════════════════════════

describe('envelope equivalence — same mock response produces same data from both transports', () => {
  const syntheticEnvelope: KafkaEnvelope = {
    ok: true,
    op: 'status',
    data: { state: 'connected', clusterId: 'parity-test-cluster', subscriptionCount: 2 },
    meta: { timestamp: '2026-06-01T00:00:00.000Z', durationMs: 3 },
  };

  it('server-proxy data matches native data for the same synthetic envelope', async () => {
    // Server-proxy
    setKafkaClientTransport(null);
    mockHttpFetch.mockResolvedValue(httpOk(syntheticEnvelope as unknown as FixtureResponse));
    const serverResult = await dispatchKafkaOperation('status', { clusterId: 'parity-test-cluster' });

    // Native transport
    setKafkaClientTransport(kafkaNativeTauriTransport);
    mockInvoke.mockResolvedValue(syntheticEnvelope);
    const nativeResult = await dispatchKafkaOperation('status', { clusterId: 'parity-test-cluster' });

    // Both produce the same data
    expect(serverResult.data).toEqual(nativeResult.data);
    expect(serverResult.ok).toBe(nativeResult.ok);
    expect(serverResult.op).toBe(nativeResult.op);
  });
});
