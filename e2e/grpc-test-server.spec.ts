/**
 * grpc-test-server.spec.ts — Smoke test for the Docker gRPC test server (Phase 1H).
 *
 * Prerequisites (live API/UI tests):
 *   npm run server       — Express :3001 for /api/grpc route checks
 *   docker/grpc fixture  — ports 50051/50052 (or E2E_GRPC_SERVER=1 to auto-start)
 *
 * Run:
 *   npx playwright test e2e/grpc-test-server.spec.ts --reporter=list
 *   E2E_GRPC_SERVER=1 npx playwright test e2e/grpc-test-server.spec.ts --reporter=list
 */
import { test, expect } from '@playwright/test';
import {
  GRPC_HEALTH,
  GRPC_TARGET,
  cancelInFlightGrpcCallViaApi,
  isBackendHealthy,
  isGrpcTestServerHealthy,
} from './grpc-helpers';

test.describe.configure({ retries: 0 });

test.describe('gRPC test server (port 50051)', () => {
  test('health endpoint returns ok', async ({ request }) => {
    const healthy = await isGrpcTestServerHealthy(request);
    test.skip(!healthy, 'gRPC test server not running on :50052 — start docker/grpc');

    const resp = await request.get(GRPC_HEALTH);
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('grpc-test-server');
  });

  test('status reports reachable target via GET /api/grpc/status', async ({ request }) => {
    const grpcHealthy = await isGrpcTestServerHealthy(request);
    const backendHealthy = await isBackendHealthy(request);
    test.skip(!grpcHealthy, 'gRPC test server not running');
    test.skip(!backendHealthy, 'Express backend not running on :3001 — run npm run server');

    const resp = await request.get(
      `/api/grpc/status?address=${encodeURIComponent(GRPC_TARGET)}&tlsMode=disabled&timeoutMs=5000`,
    );
    expect(resp.ok()).toBeTruthy();
    const envelope = await resp.json();
    expect(envelope.ok).toBe(true);
    expect(envelope.data.reachable).toBe(true);
    expect(envelope.data.address).toBe(GRPC_TARGET);
  });

  test('reflect returns echo.EchoService via Express /api/grpc/reflect', async ({ request }) => {
    const grpcHealthy = await isGrpcTestServerHealthy(request);
    const backendHealthy = await isBackendHealthy(request);
    test.skip(!grpcHealthy, 'gRPC test server not running');
    test.skip(!backendHealthy, 'Express backend not running on :3001 — run npm run server');

    const resp = await request.post('/api/grpc/reflect', {
      data: {
        requestId: 'e2e-grpc-reflect-1',
        target: { address: GRPC_TARGET, tlsMode: 'disabled' },
        timeoutMs: 10_000,
      },
    });

    expect(resp.ok()).toBeTruthy();
    const envelope = await resp.json();
    expect(envelope.ok).toBe(true);
    expect(envelope.data.services.some(
      (svc: { fullName: string }) => svc.fullName === 'echo.EchoService',
    )).toBe(true);
    const echoService = envelope.data.services.find(
      (svc: { fullName: string }) => svc.fullName === 'echo.EchoService',
    );
    expect(echoService).toBeTruthy();
    const echoMethod = echoService?.methods?.find((m: { name: string }) => m.name === 'Echo');
    expect(echoMethod?.callType).toBe('unary');

    const methodNames = echoService!.methods.map((m: { name: string }) => m.name).sort();
    expect(methodNames).toEqual(['BidiStream', 'ClientStream', 'CreateComplexEcho', 'Echo', 'ServerStream']);

    const serverStream = echoService!.methods.find((m: { name: string }) => m.name === 'ServerStream');
    expect(serverStream?.callType).toBe('server_streaming');

    const clientStream = echoService!.methods.find((m: { name: string }) => m.name === 'ClientStream');
    expect(clientStream?.callType).toBe('client_streaming');

    const bidiStream = echoService!.methods.find((m: { name: string }) => m.name === 'BidiStream');
    expect(bidiStream?.callType).toBe('bidi_streaming');
  });

  test('unary call echoes message via Express /api/grpc/call', async ({ request }) => {
    const grpcHealthy = await isGrpcTestServerHealthy(request);
    const backendHealthy = await isBackendHealthy(request);
    test.skip(!grpcHealthy, 'gRPC test server not running');
    test.skip(!backendHealthy, 'Express backend not running on :3001');

    const reflectResp = await request.post('/api/grpc/reflect', {
      data: {
        requestId: 'e2e-grpc-reflect-2',
        target: { address: GRPC_TARGET, tlsMode: 'disabled' },
        timeoutMs: 10_000,
      },
    });
    expect(reflectResp.ok()).toBeTruthy();
    const reflectBody = await reflectResp.json();
    const descriptorKey = reflectBody.data.key as string;

    const callResp = await request.post('/api/grpc/call?tabId=e2e-tab-1', {
      data: {
        callType: 'unary',
        requestId: 'e2e-grpc-call-1',
        target: { address: GRPC_TARGET, tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: 'fixture-e2e-ping' },
        descriptorKey,
        timeoutMs: 10_000,
      },
    });

    expect(callResp.ok()).toBeTruthy();
    const callBody = await callResp.json();
    expect(callBody.ok).toBe(true);
    expect(callBody.data.status).toBe(0);
    expect(callBody.data.body).toEqual({ message: 'fixture-e2e-ping' });
  });

  test('DELETE cancels an in-flight unary call via Express /api/grpc/call/:requestId', async ({ request }, testInfo) => {
    const grpcHealthy = await isGrpcTestServerHealthy(request);
    const backendHealthy = await isBackendHealthy(request);
    test.skip(!grpcHealthy, 'gRPC test server not running');
    test.skip(!backendHealthy, 'Express backend not running on :3001');

    const reflectResp = await request.post('/api/grpc/reflect', {
      data: {
        requestId: `e2e-grpc-reflect-cancel-${testInfo.workerIndex}-${Date.now()}`,
        target: { address: GRPC_TARGET, tlsMode: 'disabled' },
        timeoutMs: 10_000,
      },
    });
    expect(reflectResp.ok()).toBeTruthy();
    const descriptorKey = ((await reflectResp.json()) as { data: { key: string } }).data.key;

    const requestId = `e2e-grpc-cancel-api-${testInfo.workerIndex}-${Date.now()}`;
    const tabId = 'e2e-tab-cancel';

    const callPromise = request.post(`/api/grpc/call?tabId=${tabId}`, {
      data: {
        callType: 'unary',
        requestId,
        target: { address: GRPC_TARGET, tlsMode: 'disabled' },
        service: 'echo.EchoService',
        method: 'Echo',
        body: { message: '@sleep:8000' },
        descriptorKey,
        timeoutMs: 30_000,
      },
    });

    await cancelInFlightGrpcCallViaApi(request, requestId, tabId);

    const callResp = await callPromise;
    expect(callResp.ok()).toBeFalsy();
    const callBody = await callResp.json();
    expect(callBody.ok).toBe(false);
    expect(callBody.error.code).toBe('GRPC_CANCELLED');
  });

  test('describe rejects private-network url_proto (SSRF policy)', async ({ request }) => {
    const backendHealthy = await isBackendHealthy(request);
    test.skip(!backendHealthy, 'Express backend not running on :3001 — run npm run server');

    const resp = await request.post('/api/grpc/describe', {
      data: {
        requestId: 'e2e-describe-blocked-url',
        source: 'url_proto',
        url: 'https://192.168.1.10/echo.proto',
      },
    });

    const envelope = await resp.json();
    expect(envelope.ok).toBe(false);
    expect(envelope.error.message).toMatch(/private network/i);
  });

  test('describe rejects https loopback url_proto (SSRF policy)', async ({ request }) => {
    const backendHealthy = await isBackendHealthy(request);
    test.skip(!backendHealthy, 'Express backend not running on :3001 — run npm run server');

    const resp = await request.post('/api/grpc/describe', {
      data: {
        requestId: 'e2e-describe-blocked-loopback-url',
        source: 'url_proto',
        url: 'https://127.0.0.1/echo.proto',
      },
    });

    const envelope = await resp.json();
    expect(envelope.ok).toBe(false);
    expect(envelope.error.message).toMatch(/loopback/i);
  });
});
