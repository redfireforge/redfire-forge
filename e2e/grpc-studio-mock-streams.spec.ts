import { test, expect } from '@playwright/test';
import type { GrpcMockRuleSet } from '../src/shared/grpc/grpcMockRuleContracts';
import {
  BIDI_STREAM_METHOD_TESTID,
  CLIENT_STREAM_METHOD_TESTID,
  ECHO_SERVICE_TESTID,
  SERVER_STREAM_METHOD_TESTID,
  fillEchoMessage,
  fillStreamRequest,
  isBackendHealthy,
  reflectGrpcServices,
  selectGrpcMethod,
  setGrpcCallTimeout,
  sendStreamMessage,
  startGrpcMockListener,
  startGrpcStream,
  stopGrpcMockListener,
  waitForStreamCountAtLeast,
  waitForStreamEnded,
  waitForStreamLogContains,
  waitForStreamStatus,
  endGrpcStream,
} from './grpc-helpers';
import { gotoFreshGrpcStudio } from './helpers/grpc-studio-shell-helpers';

function serverStreamRuleSet(): GrpcMockRuleSet {
  return {
    rules: [{
      id: 'server-stream-e2e',
      name: 'Server stream e2e rule',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'ServerStream' },
      response: {
        statusCode: 0,
        messages: [
          { message: 'mock-ss [1/3]' },
          { message: 'mock-ss [2/3]' },
          { message: 'mock-ss [3/3]' },
        ],
        interMessageDelayMs: 0,
      },
    }],
  };
}

function clientStreamRuleSet(): GrpcMockRuleSet {
  return {
    rules: [{
      id: 'client-stream-e2e',
      name: 'Client stream e2e rule',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'ClientStream' },
      response: {
        statusCode: 0,
        body: { message: 'mock-client-aggregate' },
      },
    }],
  };
}

function bidiStreamRuleSet(): GrpcMockRuleSet {
  return {
    rules: [{
      id: 'bidi-stream-e2e',
      name: 'Bidi stream e2e rule',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'BidiStream' },
      response: {
        statusCode: 0,
        body: { message: 'mock-bidi-ack' },
      },
    }],
  };
}

test.describe('gRPC Studio — mock streaming flows (no Docker)', () => {
  test.beforeEach(async ({ request }) => {
    const backendHealthy = await isBackendHealthy(request);
    test.skip(!backendHealthy, 'Express backend not running on :3001 — run npm run server');
  });

  test('ServerStream shows inbound messages and ends', async ({ page, request }, testInfo) => {
    const tabId = `grpc-mock-ss-${testInfo.workerIndex}-${Date.now()}`;
    const { listenTarget } = await startGrpcMockListener(request, {
      tabId,
      ruleSet: serverStreamRuleSet(),
    });

    try {
      await gotoFreshGrpcStudio(page);
      await page.locator('[data-testid="grpc-target-input"]').fill(listenTarget);
      await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible({ timeout: 5_000 });

      await reflectGrpcServices(page);
      await selectGrpcMethod(page, {
        serviceTestId: ECHO_SERVICE_TESTID,
        methodTestId: SERVER_STREAM_METHOD_TESTID,
      });
      await fillStreamRequest(page, {
        message: 'ignored-by-mock',
        repeat_count: 3,
        interval_ms: 0,
      });
      await startGrpcStream(page);

      await waitForStreamStatus(page, /Streaming|Starting/);
      await waitForStreamLogContains(page, /mock-ss \[1\/3\]|mock-stream-1/);
      await waitForStreamLogContains(page, /mock-ss \[3\/3\]|mock-stream-2/);
      await waitForStreamEnded(page);
      await expect(page.locator('[data-testid="grpc-stream-inbound-count"]')).toContainText('↓ 3');
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });

  test('ClientStream sends outbound messages and resolves final response on end', async ({ page, request }, testInfo) => {
    const tabId = `grpc-mock-cs-${testInfo.workerIndex}-${Date.now()}`;
    const { listenTarget } = await startGrpcMockListener(request, {
      tabId,
      ruleSet: clientStreamRuleSet(),
    });

    try {
      await gotoFreshGrpcStudio(page);
      await page.locator('[data-testid="grpc-target-input"]').fill(listenTarget);
      await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible({ timeout: 5_000 });

      await reflectGrpcServices(page);
      await selectGrpcMethod(page, {
        serviceTestId: ECHO_SERVICE_TESTID,
        methodTestId: CLIENT_STREAM_METHOD_TESTID,
      });
      await setGrpcCallTimeout(page, 120_000);

      await startGrpcStream(page);
      await waitForStreamStatus(page, /Streaming|Starting/);

      await fillEchoMessage(page, 'alpha');
      await sendStreamMessage(page);
      await fillEchoMessage(page, 'beta');
      await sendStreamMessage(page);
      await waitForStreamCountAtLeast(page, 'grpc-stream-outbound-count', 2);

      await endGrpcStream(page);
  await waitForStreamLogContains(page, /mock-client-aggregate|alpha/);
      await waitForStreamEnded(page);
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });

  test('BidiStream echoes inbound frames from the mock listener', async ({ page, request }, testInfo) => {
    const tabId = `grpc-mock-bd-${testInfo.workerIndex}-${Date.now()}`;
    const { listenTarget } = await startGrpcMockListener(request, {
      tabId,
      ruleSet: bidiStreamRuleSet(),
    });

    try {
      await gotoFreshGrpcStudio(page);
      await page.locator('[data-testid="grpc-target-input"]').fill(listenTarget);
      await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible({ timeout: 5_000 });

      await reflectGrpcServices(page);
      await selectGrpcMethod(page, {
        serviceTestId: ECHO_SERVICE_TESTID,
        methodTestId: BIDI_STREAM_METHOD_TESTID,
      });
      await setGrpcCallTimeout(page, 120_000);
      await expect(page.locator('[data-testid="grpc-stream-direction-legend"]')).toBeVisible();

      await startGrpcStream(page);
      await waitForStreamStatus(page, /Streaming|Starting/);

      await fillEchoMessage(page, 'bidi-ping');
      await sendStreamMessage(page);
  await waitForStreamLogContains(page, /mock-bidi-ack|bidi-ping/);
      await waitForStreamCountAtLeast(page, 'grpc-stream-inbound-count', 1);

      await endGrpcStream(page);
      await waitForStreamEnded(page);
      await waitForStreamCountAtLeast(page, 'grpc-stream-outbound-count', 1);
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });
});