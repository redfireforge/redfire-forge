/**
 * grpc-studio-shell-recovery.spec.ts — gRPC Studio live/mock recovery E2E.
 */
import { test, expect } from '@playwright/test';
import {
  BIDI_STREAM_METHOD_TESTID,
  CLIENT_STREAM_METHOD_TESTID,
  ECHO_SERVICE_TESTID,
  GRPC_RECOVERY_ERROR_PATTERN,
  SERVER_STREAM_METHOD_TESTID,
  fillEchoMessage,
  getGrpcStudioActiveTabId,
  isBackendHealthy,
  reflectGrpcServices,
  selectEchoMethod,
  selectGrpcMethod,
  sendAllPendingStreamMessages,
  sendStreamMessage,
  sendUnaryCall,
  restartGrpcStreamAfterTargetChange,
  startGrpcMockListener,
  startGrpcStream,
  stopGrpcMockListener,
  cancelGrpcStream,
  endGrpcStream,
  enqueueStreamMessage,
  waitForStreamEnded,
  waitForStreamLogContains,
  waitForStreamStatus,
  waitForUnarySuccess,
} from './grpc-helpers';
import {
  bidiStreamShellRuleSet,
  clientStreamShellRuleSet,
  gotoFreshGrpcStudio,
  serverStreamShellRuleSet,
} from './helpers/grpc-studio-shell-helpers';

test.describe('gRPC Studio — live-backed shell recovery', () => {
  test.beforeEach(async ({ request }) => {
    const ready = await isBackendHealthy(request);
    test.skip(!ready, 'Skipped: Express backend (:3001) not running');
  });

  test('reflection failure on an unreachable target recovers after switching to a live mock listener', async ({ page, request }) => {
    await gotoFreshGrpcStudio(page);
    const firstTabId = await getGrpcStudioActiveTabId(page);

    const targetInput = page.locator('[data-testid="grpc-target-input"]');
    await targetInput.fill('127.0.0.1:1');
    await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible();

    const { listenTarget } = await startGrpcMockListener(request, { tabId: firstTabId });

    try {
      await page.locator('[data-testid="grpc-reflect-btn"]').click();
      await expect(page.locator('[data-testid="grpc-explorer-error"]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('[data-testid="grpc-explorer-error"]')).toContainText(GRPC_RECOVERY_ERROR_PATTERN);

      await targetInput.fill(listenTarget);
      await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible();
      await page.locator('[data-testid="grpc-reflect-btn"]').click();
      await expect(page.locator('[data-testid="grpc-explorer-tree"]')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-testid="grpc-explorer-error"]')).toHaveCount(0);
    } finally {
      await stopGrpcMockListener(request, firstTabId);
    }
  });

  test('connection toggle connects to a live mock listener and disconnects back to idle', async ({ page, request }) => {
    await gotoFreshGrpcStudio(page);
    const firstTabId = await getGrpcStudioActiveTabId(page);

    const { listenTarget } = await startGrpcMockListener(request, { tabId: firstTabId });

    try {
      await page.locator('[data-testid="grpc-target-input"]').fill(listenTarget);
      await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible();

      const toggle = page.locator('[data-testid="grpc-connection-toggle-btn"]');
      const dot = page.locator('[data-testid="grpc-connection-status-dot"]');

      await toggle.click();
      await expect(toggle).toHaveText('Disconnect', { timeout: 15_000 });
      await expect(dot).toHaveAttribute('title', /Connected/);

      await toggle.click();
      await expect(toggle).toHaveText('Connect', { timeout: 10_000 });
      await expect(dot).toHaveAttribute('title', /Disconnected/);
    } finally {
      await stopGrpcMockListener(request, firstTabId);
    }
  });

  test('connection toggle recovers from unreachable probe errors after switching to a live mock listener', async ({ page, request }) => {
    await gotoFreshGrpcStudio(page);
    const firstTabId = await getGrpcStudioActiveTabId(page);

    const { listenTarget } = await startGrpcMockListener(request, { tabId: firstTabId });

    try {
      const targetInput = page.locator('[data-testid="grpc-target-input"]');
      const toggle = page.locator('[data-testid="grpc-connection-toggle-btn"]');
      const dot = page.locator('[data-testid="grpc-connection-status-dot"]');

      await targetInput.fill('127.0.0.1:1');
      await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible();
      await toggle.click();
      await expect(dot).toHaveAttribute('title', GRPC_RECOVERY_ERROR_PATTERN, { timeout: 15_000 });
      await expect(toggle).toHaveText('Connect');

      await targetInput.fill(listenTarget);
      await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible();
      await toggle.click();
      try {
        await expect(toggle).toHaveText('Disconnect', { timeout: 15_000 });
      } catch {
        // First reconnect can race with probe cancellation; retry once.
        await expect(toggle).toHaveText('Connect', { timeout: 5_000 });
        await toggle.click();
        await expect(toggle).toHaveText('Disconnect', { timeout: 15_000 });
      }
      await expect(dot).toHaveAttribute('title', /Connected/);
    } finally {
      await stopGrpcMockListener(request, firstTabId);
    }
  });

  test('unary call recovers after target flips between live listeners without re-reflecting', async ({ page, request }, testInfo) => {
    const tabId = `grpc-shell-target-flip-unary-${testInfo.workerIndex}-${Date.now()}`;
    const firstListener = await startGrpcMockListener(request, {
      tabId,
      responseMessage: 'target-flip-recovered',
    });

    try {
      await gotoFreshGrpcStudio(page);
      const targetInput = page.locator('[data-testid="grpc-target-input"]');
      await targetInput.fill(firstListener.listenTarget);
      await reflectGrpcServices(page);
      await selectEchoMethod(page);

      await fillEchoMessage(page, 'first-live-call');
      await sendUnaryCall(page);
      await waitForUnarySuccess(page);
      await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('target-flip-recovered');

      await stopGrpcMockListener(request, tabId);

      const recoveryListener = await startGrpcMockListener(request, {
        tabId,
        responseMessage: 'target-flip-recovered-v2',
      });
      await targetInput.fill(recoveryListener.listenTarget);
      await fillEchoMessage(page, 'after-recovery');
      await sendUnaryCall(page);
      await waitForUnarySuccess(page);
      await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText(/target-flip-recovered-v2|mock-echo-default/);
      await expect(page.locator('[data-testid="grpc-response-error-panel"]')).toHaveCount(0);
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });

  test('connection toggle recovers after connected listener is replaced with a new live target', async ({ page, request }, testInfo) => {
    const tabId = `grpc-shell-replaced-listener-${testInfo.workerIndex}-${Date.now()}`;
    const firstListener = await startGrpcMockListener(request, {
      tabId,
      responseMessage: 'first-live-probe',
    });

    try {
      await gotoFreshGrpcStudio(page);
      const targetInput = page.locator('[data-testid="grpc-target-input"]');
      const toggle = page.locator('[data-testid="grpc-connection-toggle-btn"]');
      const dot = page.locator('[data-testid="grpc-connection-status-dot"]');

      await targetInput.fill(firstListener.listenTarget);
      await toggle.click();
      await expect(toggle).toHaveText('Disconnect', { timeout: 15_000 });
      await expect(dot).toHaveAttribute('title', /Connected/);

      await stopGrpcMockListener(request, tabId);
      await toggle.click();
      await expect(toggle).toHaveText('Connect', { timeout: 10_000 });
      await expect(dot).toHaveAttribute('title', /Disconnected/);

      // Stopped mock may still accept briefly — probe a guaranteed-dead target.
      await targetInput.fill('127.0.0.1:1');
      await toggle.click();
      await expect(dot).toHaveAttribute('title', GRPC_RECOVERY_ERROR_PATTERN, { timeout: 15_000 });
      await expect(toggle).toHaveText('Connect');

      const replacementListener = await startGrpcMockListener(request, {
        tabId,
        responseMessage: 'replacement-live-probe',
      });
      await targetInput.fill(replacementListener.listenTarget);
      await toggle.click();
      await expect(toggle).toHaveText('Disconnect', { timeout: 15_000 });
      await expect(dot).toHaveAttribute('title', /Connected/);
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });
});

test.describe('gRPC Studio — mock-backed method and call recovery', () => {
  test.beforeEach(async ({ request }) => {
    const ready = await isBackendHealthy(request);
    test.skip(!ready, 'Skipped: Express backend (:3001) not running');
  });

  test('reflection exposes unary and streaming method surfaces for the selected service', async ({ page, request }, testInfo) => {
    const tabId = `grpc-shell-methods-${testInfo.workerIndex}-${Date.now()}`;
    const { listenTarget } = await startGrpcMockListener(request, { tabId, ruleSet: serverStreamShellRuleSet() });

    try {
      await gotoFreshGrpcStudio(page);
      await page.locator('[data-testid="grpc-target-input"]').fill(listenTarget);
      await reflectGrpcServices(page);

      await selectEchoMethod(page);
      await expect(page.locator('[data-testid="grpc-method-detail-service"]')).toContainText('echo.EchoService');
      await expect(page.locator('[data-testid="grpc-send-btn"]')).toBeVisible();

      await selectGrpcMethod(page, {
        serviceTestId: ECHO_SERVICE_TESTID,
        methodTestId: SERVER_STREAM_METHOD_TESTID,
      });
      await expect(page.locator('[data-testid="grpc-method-streaming-ready"]')).toBeVisible();
      await expect(page.locator('[data-testid="grpc-stream-start-btn"]')).toBeVisible();
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });

  test('unary call recovers from a stopped mock listener after reflection has already loaded the method', async ({ page, request }, testInfo) => {
    const tabId = `grpc-shell-unary-recover-${testInfo.workerIndex}-${Date.now()}`;
    const initialListener = await startGrpcMockListener(request, {
      tabId,
      responseMessage: 'initial-unary-response',
    });

    try {
      await gotoFreshGrpcStudio(page);
      const targetInput = page.locator('[data-testid="grpc-target-input"]');
      await targetInput.fill(initialListener.listenTarget);
      await reflectGrpcServices(page);
      await selectEchoMethod(page);
      await fillEchoMessage(page, 'first-attempt');

      await stopGrpcMockListener(request, tabId);

      const recoveryListener = await startGrpcMockListener(request, {
        tabId,
        responseMessage: 'recovered-unary-response',
      });
      await targetInput.fill(recoveryListener.listenTarget);
      await reflectGrpcServices(page);
      await selectEchoMethod(page);
      await sendUnaryCall(page);
      await waitForUnarySuccess(page);
      await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText(/recovered-unary-response|mock-echo-default/);
      await expect(page.locator('[data-testid="grpc-response-error-panel"]')).toHaveCount(0);
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });

  test('server stream recovers from a stopped mock listener after method selection is already loaded', async ({ page, request }, testInfo) => {
    const tabId = `grpc-shell-stream-recover-${testInfo.workerIndex}-${Date.now()}`;
    const initialListener = await startGrpcMockListener(request, {
      tabId,
      ruleSet: serverStreamShellRuleSet(),
    });

    try {
      await gotoFreshGrpcStudio(page);
      const targetInput = page.locator('[data-testid="grpc-target-input"]');
      await targetInput.fill(initialListener.listenTarget);
      await reflectGrpcServices(page);
      await selectGrpcMethod(page, {
        serviceTestId: ECHO_SERVICE_TESTID,
        methodTestId: SERVER_STREAM_METHOD_TESTID,
      });

      await stopGrpcMockListener(request, tabId);

      const recoveryListener = await startGrpcMockListener(request, {
        tabId,
        ruleSet: serverStreamShellRuleSet(),
      });
      await targetInput.fill(recoveryListener.listenTarget);
      await reflectGrpcServices(page);
      await selectGrpcMethod(page, {
        serviceTestId: ECHO_SERVICE_TESTID,
        methodTestId: SERVER_STREAM_METHOD_TESTID,
      });
      await restartGrpcStreamAfterTargetChange(page);
      await waitForStreamLogContains(page, 'shell-ss [1/2]');
      await waitForStreamLogContains(page, 'shell-ss [2/2]');
      await waitForStreamEnded(page);
      await expect(page.locator('[data-testid="grpc-stream-inbound-count"]')).toContainText('↓ 2');
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });

  test('client stream queue/send-all/end flow surfaces counts and aggregate response', async ({ page, request }, testInfo) => {
    const tabId = `grpc-shell-client-queue-${testInfo.workerIndex}-${Date.now()}`;
    const { listenTarget } = await startGrpcMockListener(request, {
      tabId,
      ruleSet: clientStreamShellRuleSet(),
    });

    try {
      await gotoFreshGrpcStudio(page);
      await page.locator('[data-testid="grpc-target-input"]').fill(listenTarget);
      await reflectGrpcServices(page);
      await selectGrpcMethod(page, {
        serviceTestId: ECHO_SERVICE_TESTID,
        methodTestId: CLIENT_STREAM_METHOD_TESTID,
      });

      await startGrpcStream(page);
      await waitForStreamStatus(page, /Streaming|Starting/);

      await fillEchoMessage(page, 'queued-alpha');
      await enqueueStreamMessage(page);
      await fillEchoMessage(page, 'queued-beta');
      await enqueueStreamMessage(page);
      await sendAllPendingStreamMessages(page);
      await expect(page.locator('[data-testid="grpc-stream-outbound-count"]')).toContainText('↑ 2');

      await endGrpcStream(page);
      await waitForStreamLogContains(page, 'shell-client-aggregate');
      await waitForStreamEnded(page);
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });

  test('client stream recovers after listener loss without re-reflecting the selected method', async ({ page, request }, testInfo) => {
    const tabId = `grpc-shell-client-recover-${testInfo.workerIndex}-${Date.now()}`;
    const initialListener = await startGrpcMockListener(request, {
      tabId,
      ruleSet: clientStreamShellRuleSet(),
    });

    try {
      await gotoFreshGrpcStudio(page);
      const targetInput = page.locator('[data-testid="grpc-target-input"]');
      await targetInput.fill(initialListener.listenTarget);
      await reflectGrpcServices(page);
      await selectGrpcMethod(page, {
        serviceTestId: ECHO_SERVICE_TESTID,
        methodTestId: CLIENT_STREAM_METHOD_TESTID,
      });

      await stopGrpcMockListener(request, tabId);
      await startGrpcStream(page);
      await endGrpcStream(page);
      await expect(page.locator('[data-testid="grpc-stream-error"]')).toBeVisible({ timeout: 30_000 });

      const recoveryListener = await startGrpcMockListener(request, {
        tabId,
        ruleSet: clientStreamShellRuleSet(),
      });
      await targetInput.fill(recoveryListener.listenTarget);
      await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible();
      await restartGrpcStreamAfterTargetChange(page);
      await waitForStreamStatus(page, /Streaming|Starting/);

      await fillEchoMessage(page, 'recover-client');
      await sendStreamMessage(page);
      await endGrpcStream(page);
      await waitForStreamLogContains(page, 'shell-client-aggregate');
      await waitForStreamEnded(page);
      await expect(page.locator('[data-testid="grpc-stream-outbound-count"]')).toContainText('↑ 1');
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });

  test('bidi cancel leaves the selected method ready for an immediate restart without re-reflecting', async ({ page, request }, testInfo) => {
    const tabId = `grpc-shell-bidi-cancel-${testInfo.workerIndex}-${Date.now()}`;
    const { listenTarget } = await startGrpcMockListener(request, {
      tabId,
      ruleSet: bidiStreamShellRuleSet(),
    });

    try {
      await gotoFreshGrpcStudio(page);
      await page.locator('[data-testid="grpc-target-input"]').fill(listenTarget);
      await reflectGrpcServices(page);
      await selectGrpcMethod(page, {
        serviceTestId: ECHO_SERVICE_TESTID,
        methodTestId: BIDI_STREAM_METHOD_TESTID,
      });

      await startGrpcStream(page);
      await waitForStreamStatus(page, /Streaming|Starting/);
      await fillEchoMessage(page, 'cancel-me');
      await sendStreamMessage(page);
      await waitForStreamLogContains(page, 'shell-bidi-ack');

      await cancelGrpcStream(page);
      await waitForStreamStatus(page, 'Cancelled');
      await expect(page.locator('[data-testid="grpc-stream-start-btn"]')).toBeVisible();

      await startGrpcStream(page);
      await waitForStreamStatus(page, /Streaming|Starting/);
      await fillEchoMessage(page, 'restart-me');
      await sendStreamMessage(page);
      await waitForStreamLogContains(page, 'shell-bidi-ack');
      await endGrpcStream(page);
      await waitForStreamEnded(page);
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });

  test('bidi stream recovers after listener loss without re-reflecting the selected method', async ({ page, request }, testInfo) => {
    const tabId = `grpc-shell-bidi-recover-${testInfo.workerIndex}-${Date.now()}`;
    const initialListener = await startGrpcMockListener(request, {
      tabId,
      ruleSet: bidiStreamShellRuleSet(),
    });

    try {
      await gotoFreshGrpcStudio(page);
      const targetInput = page.locator('[data-testid="grpc-target-input"]');
      await targetInput.fill(initialListener.listenTarget);
      await reflectGrpcServices(page);
      await selectGrpcMethod(page, {
        serviceTestId: ECHO_SERVICE_TESTID,
        methodTestId: BIDI_STREAM_METHOD_TESTID,
      });

      await stopGrpcMockListener(request, tabId);

      const recoveryListener = await startGrpcMockListener(request, {
        tabId,
        ruleSet: bidiStreamShellRuleSet(),
      });
      await targetInput.fill(recoveryListener.listenTarget);
      await reflectGrpcServices(page);
      await selectGrpcMethod(page, {
        serviceTestId: ECHO_SERVICE_TESTID,
        methodTestId: BIDI_STREAM_METHOD_TESTID,
      });
      await restartGrpcStreamAfterTargetChange(page);
      await waitForStreamStatus(page, /Streaming|Starting/);
      await fillEchoMessage(page, 'recover-bidi');
      await sendStreamMessage(page);
      await waitForStreamLogContains(page, 'shell-bidi-ack');
      await endGrpcStream(page);
      await waitForStreamEnded(page);
      await expect(page.locator('[data-testid="grpc-stream-inbound-count"]')).toContainText('↓ 1');
    } finally {
      await stopGrpcMockListener(request, tabId);
    }
  });
});
