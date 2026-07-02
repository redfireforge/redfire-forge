/**
 * grpc-studio-native-transport.spec.ts — Phase 7I desktop CI smoke.
 *
 * Runs only when E2E_TAURI_NATIVE_GRPC=1 (Tauri desktop build).
 * Default web Playwright CI skips this file.
 */
import { test, expect } from '@playwright/test';
import {
  ECHO_SERVICE_TESTID,
  SERVER_STREAM_METHOD_TESTID,
  fillEchoMessage,
  fillStreamRequest,
  gotoGrpcStudio,
  isGrpcTestServerHealthy,
  reflectGrpcServices,
  selectEchoMethod,
  selectGrpcMethod,
  sendUnaryCall,
  setGrpcTarget,
  startGrpcStream,
  waitForStreamEnded,
  waitForStreamLogContains,
  waitForUnarySuccess,
} from './grpc-helpers';

const isNativeTransportE2e = process.env.E2E_TAURI_NATIVE_GRPC === '1';

async function openTransportPanel(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('[data-testid="grpc-connection-settings-btn"]').click();
  await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toBeVisible({ timeout: 10_000 });
  await page.locator('[data-testid="grpc-settings-nav-transport"]').click();
  await expect(page.locator('[data-testid="grpc-settings-panel-transport"]')).toBeVisible();
  await expect(page.locator('[data-testid="grpc-transport-panel"]')).toBeVisible();
}

async function isNativeTransportModeAvailable(page: import('@playwright/test').Page): Promise<boolean> {
  const tauriMode = page.locator('[data-testid="grpc-transport-mode-tauri"]');
  await expect(tauriMode).toBeVisible();
  return tauriMode.isEnabled();
}

async function selectNativeTransportMode(page: import('@playwright/test').Page): Promise<void> {
  const tauriMode = page.locator('[data-testid="grpc-transport-mode-tauri"]');
  await expect(tauriMode).toBeVisible();
  await expect(tauriMode).toBeEnabled();
  await tauriMode.click();
  await expect(tauriMode).toHaveClass(/active/);
}

test.describe('gRPC Studio — native transport smoke (Phase 7I)', () => {
  test.skip(!isNativeTransportE2e, 'desktop CI only — set E2E_TAURI_NATIVE_GRPC=1');

  test('studio shell loads with transport panel on desktop', async ({ page }) => {
    await gotoGrpcStudio(page);
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible();
    await openTransportPanel(page);
    await expect(page.locator('[data-testid="grpc-transport-mode-express"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-transport-mode-tauri"]')).toBeVisible();
  });

  test('native transport executes unary call after reflection', async ({ page, request }) => {
    const grpcReady = await isGrpcTestServerHealthy(request);
    test.skip(!grpcReady, 'Skipped: gRPC test server (:50052/health -> :50051) not running');

    await gotoGrpcStudio(page);
    await setGrpcTarget(page);
    await openTransportPanel(page);
    const nativeAvailable = await isNativeTransportModeAvailable(page);
    test.skip(!nativeAvailable, 'Skipped: native transport mode disabled (requires Tauri webview runtime)');
    await selectNativeTransportMode(page);

    await reflectGrpcServices(page);
    await selectEchoMethod(page);
    await fillEchoMessage(page, 'native-unary-hello');
    await sendUnaryCall(page);
    await waitForUnarySuccess(page);

    await expect(page.locator('[data-testid="grpc-response-status"]')).toContainText('OK');
    await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('native-unary-hello');
  });

  test('native transport executes server-stream lifecycle', async ({ page, request }) => {
    const grpcReady = await isGrpcTestServerHealthy(request);
    test.skip(!grpcReady, 'Skipped: gRPC test server (:50052/health -> :50051) not running');

    await gotoGrpcStudio(page);
    await setGrpcTarget(page);
    await openTransportPanel(page);
    const nativeAvailable = await isNativeTransportModeAvailable(page);
    test.skip(!nativeAvailable, 'Skipped: native transport mode disabled (requires Tauri webview runtime)');
    await selectNativeTransportMode(page);

    await reflectGrpcServices(page);
    await selectGrpcMethod(page, {
      serviceTestId: ECHO_SERVICE_TESTID,
      methodTestId: SERVER_STREAM_METHOD_TESTID,
    });
    await fillStreamRequest(page, {
      message: 'native-ss',
      repeat_count: 2,
      interval_ms: 0,
    });
    await startGrpcStream(page);
    await waitForStreamLogContains(page, 'native-ss [1/2]');
    await waitForStreamLogContains(page, 'native-ss [2/2]');
    await waitForStreamEnded(page);
  });
});
