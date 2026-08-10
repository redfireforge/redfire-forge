/**
 * grpc-studio-shell-isolation.spec.ts — gRPC Studio multi-tab isolation & target validation E2E.
 */
import { test, expect } from '@playwright/test';
import {
  ECHO_SERVICE_TESTID,
  SERVER_STREAM_METHOD_TESTID,
  fillEchoMessage,
  gotoGrpcStudio,
  isBackendHealthy,
  reflectGrpcServices,
  selectEchoMethod,
  selectGrpcMethod,
  sendUnaryCall,
  startGrpcMockListener,
  startGrpcStream,
  stopGrpcMockListener,
  waitForStreamEnded,
  waitForStreamLogContains,
  waitForUnarySuccess,
} from './grpc-helpers';
import {
  gotoFreshGrpcStudio,
  serverStreamShellRuleSet,
} from './helpers/grpc-studio-shell-helpers';

test.describe('gRPC Studio — multi-tab live-backed isolation', () => {
  test.beforeEach(async ({ request }) => {
    const ready = await isBackendHealthy(request);
    test.skip(!ready, 'Skipped: Express backend (:3001) not running');
  });

  test('unary and server-stream tabs preserve independent results and logs when switching back and forth', async ({ page, request }, _testInfo) => {
    await gotoFreshGrpcStudio(page);

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    const unaryListener = await startGrpcMockListener(request, {
      tabId: firstTabId,
      responseMessage: 'tab-one-unary-response',
    });

    let secondTabId: string | null = null;

    try {
      const targetInput = page.locator('[data-testid="grpc-target-input"]');
      await targetInput.fill(unaryListener.listenTarget);
      await reflectGrpcServices(page);
      await selectEchoMethod(page);
      await fillEchoMessage(page, 'tab-one-unary');
      await sendUnaryCall(page);
      await waitForUnarySuccess(page);
      await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText(/tab-one-unary-response|mock-e2e-response/);

      await page.locator('[data-testid="grpc-add-tab"]').click();
      const secondTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
      secondTabId = await secondTab.getAttribute('data-testid');
      if (!secondTabId || secondTabId === firstTabId) {
        throw new Error('Expected second gRPC tab id');
      }

      const streamListener = await startGrpcMockListener(request, {
        tabId: secondTabId,
        ruleSet: serverStreamShellRuleSet(),
      });

      await targetInput.fill(streamListener.listenTarget);
      await reflectGrpcServices(page);
      await selectGrpcMethod(page, {
        serviceTestId: ECHO_SERVICE_TESTID,
        methodTestId: SERVER_STREAM_METHOD_TESTID,
      });
      await startGrpcStream(page);
      await waitForStreamLogContains(page, 'shell-ss [1/2]');
      await waitForStreamLogContains(page, 'shell-ss [2/2]');
      await waitForStreamEnded(page);
      await expect(page.locator('[data-testid="grpc-stream-inbound-count"]')).toContainText('↓ 2');

      await page.locator(`[data-testid="${firstTabId}"]`).click();
      await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText(/tab-one-unary-response|mock-e2e-response/);
      await expect(page.locator('[data-testid="grpc-response-error-panel"]')).toHaveCount(0);

      await page.locator(`[data-testid="${secondTabId}"]`).click();
      await expect(page.locator('[data-testid="grpc-stream-log-list"]')).toContainText('shell-ss [2/2]');
      await expect(page.locator('[data-testid="grpc-stream-inbound-count"]')).toContainText('↓ 2');

      await stopGrpcMockListener(request, secondTabId);
    } finally {
      if (secondTabId) {
        await stopGrpcMockListener(request, secondTabId);
      }
      await stopGrpcMockListener(request, firstTabId);
    }
  });

  test('a failure in one tab does not poison a sibling tab with a successful unary result', async ({ page, request }, _testInfo) => {
    await gotoFreshGrpcStudio(page);

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    const firstListener = await startGrpcMockListener(request, {
      tabId: firstTabId,
      responseMessage: 'stable-tab-success',
    });

    let secondTabId: string | null = null;

    try {
      const targetInput = page.locator('[data-testid="grpc-target-input"]');
      await targetInput.fill(firstListener.listenTarget);
      await reflectGrpcServices(page);
      await selectEchoMethod(page);
      await fillEchoMessage(page, 'stable-success');
      await sendUnaryCall(page);
      await waitForUnarySuccess(page);
      await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('stable-tab-success');

      await page.locator('[data-testid="grpc-add-tab"]').click();
      const secondTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
      secondTabId = await secondTab.getAttribute('data-testid');
      if (!secondTabId || secondTabId === firstTabId) {
        throw new Error('Expected second gRPC tab id');
      }

      const flakyListener = await startGrpcMockListener(request, {
        tabId: secondTabId,
        responseMessage: 'should-not-return',
      });

      await targetInput.fill(flakyListener.listenTarget);
      await reflectGrpcServices(page);
      await selectEchoMethod(page);
      await fillEchoMessage(page, 'failing-tab');

      await stopGrpcMockListener(request, secondTabId);
      await sendUnaryCall(page);
      await expect(page.locator('[data-testid="grpc-response-error-panel"]')).toBeVisible({ timeout: 15_000 });

      await page.locator(`[data-testid="${firstTabId}"]`).click();
      await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('stable-tab-success');
      await expect(page.locator('[data-testid="grpc-response-error-panel"]')).toHaveCount(0);

      await page.locator(`[data-testid="${secondTabId}"]`).click();
      await expect(page.locator('[data-testid="grpc-response-error-panel"]')).toBeVisible();
    } finally {
      if (secondTabId) {
        await stopGrpcMockListener(request, secondTabId);
      }
      await stopGrpcMockListener(request, firstTabId);
    }
  });

  test('connection targets stay isolated across tabs and recover independently after mixed probe states', async ({ page, request }, _testInfo) => {
    await gotoFreshGrpcStudio(page);

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    const firstListener = await startGrpcMockListener(request, {
      tabId: firstTabId,
      responseMessage: 'probe-ok',
    });

    let secondTabId: string | null = null;

    try {
      const targetInput = page.locator('[data-testid="grpc-target-input"]');
      const toggle = page.locator('[data-testid="grpc-connection-toggle-btn"]');
      const dot = page.locator('[data-testid="grpc-connection-status-dot"]');

      await targetInput.fill(firstListener.listenTarget);
      await toggle.click();
      await expect(toggle).toHaveText('Disconnect', { timeout: 15_000 });
      await expect(dot).toHaveAttribute('title', /Connected/);

      await page.locator('[data-testid="grpc-add-tab"]').click();
      const secondTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
      secondTabId = await secondTab.getAttribute('data-testid');
      if (!secondTabId || secondTabId === firstTabId) {
        throw new Error('Expected second gRPC tab id');
      }

      await targetInput.fill('127.0.0.1:1');
      await toggle.click();
      await expect(dot).toHaveAttribute('title', /(refused|unreachable|failed|connect)/i, { timeout: 15_000 });
      await expect(toggle).toHaveText('Connect');

      await page.locator(`[data-testid="${firstTabId}"]`).click();
      await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue(firstListener.listenTarget);
      await expect(page.locator('[data-testid="grpc-connection-toggle-btn"]')).toHaveText('Connect');
      await page.locator('[data-testid="grpc-connection-toggle-btn"]').click();
      await expect(page.locator('[data-testid="grpc-connection-toggle-btn"]')).toHaveText('Disconnect', { timeout: 15_000 });
      await expect(page.locator('[data-testid="grpc-connection-status-dot"]')).toHaveAttribute('title', /Connected/);

      await page.locator(`[data-testid="${secondTabId}"]`).click();
      await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('127.0.0.1:1');
      await expect(page.locator('[data-testid="grpc-connection-toggle-btn"]')).toHaveText('Connect');
      await expect(page.locator('[data-testid="grpc-connection-status-dot"]')).toHaveAttribute('title', /(refused|unreachable|failed|connect)/i);
    } finally {
      if (secondTabId) {
        await stopGrpcMockListener(request, secondTabId);
      }
      await stopGrpcMockListener(request, firstTabId);
    }
  });
});

test.describe('gRPC Studio — target validation', () => {
  test('valid host:port enables reflect', async ({ page }) => {
    await gotoGrpcStudio(page);
    await page.locator('[data-testid="grpc-target-input"]').fill('localhost:50051');
    await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-reflect-btn"]')).toBeEnabled();
  });

  test('invalid target shows error state and keeps reflect disabled', async ({ page }) => {
    await gotoGrpcStudio(page);
    await page.locator('[data-testid="grpc-target-input"]').fill('localhost');

    await expect(page.locator('[data-testid="grpc-target-status-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-target-validation"]')).toContainText('host:port');
    await expect(page.locator('[data-testid="grpc-reflect-btn"]')).toBeDisabled();
  });
});
