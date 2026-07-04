/**
 * gRPC Studio — Selector Guard E2E Test
 *
 * Verifies UX-1..UX-3 shell-critical selectors from shared constants resolve
 * to real DOM elements in the app.
 */
import { test, expect, type Page } from '@playwright/test';
import { GRPC } from '../src/shared/selectors/grpc';
import {
  fillEchoMessage,
  gotoGrpcStudio,
  reflectGrpcServices,
  selectEchoMethod,
  sendUnaryCall,
  startGrpcMockListener,
  stopGrpcMockListener,
  waitForUnarySuccess,
} from './grpc-helpers';

async function gotoFresh(page: Page): Promise<void> {
  await page.addInitScript(() => {
    sessionStorage.setItem('__grpc_e2e_session_cleared__', '1');
    localStorage.removeItem('grpc-studio-session-v1');
  });
  await gotoGrpcStudio(page);
}

test.describe('gRPC Selector Guard — Unified Shell UX', () => {
  test('renders shell frame selectors (UX-1)', async ({ page }) => {
    await gotoFresh(page);

    await expect(page.locator(GRPC.STUDIO_PAGE)).toBeVisible();
    await expect(page.locator(GRPC.TAB_BAR)).toBeVisible();
    await expect(page.locator(GRPC.CONNECTION_CHROME)).toBeVisible();
    await expect(page.locator(GRPC.SERVICE_EXPLORER)).toBeVisible();
    await expect(page.locator(GRPC.CALL_PANEL)).toBeVisible();
    await expect(page.locator(GRPC.RESPONSE_PANEL)).toBeVisible();
  });

  test('renders core connection row selectors (UX-1)', async ({ page }) => {
    await gotoFresh(page);

    await expect(page.locator(GRPC.TARGET_INPUT)).toBeVisible();
    await expect(page.locator(GRPC.REFLECT_BTN)).toBeVisible();
    await expect(page.locator(GRPC.TLS_BADGE)).toBeVisible();
    await expect(page.locator(GRPC.AUTH_BADGE)).toBeVisible();
    await expect(page.locator(GRPC.DEADLINE_BADGE)).toBeVisible();
  });

  test('tab interactions keep selectors stable (UX-2)', async ({ page }) => {
    await gotoFresh(page);

    await page.locator(GRPC.ADD_TAB).click();
    await expect(page.locator(GRPC.TAB_BAR).getByRole('tab')).toHaveCount(2);

    const activeTab = page.locator(GRPC.TAB_BAR).getByRole('tab', { selected: true });
    const activeTabId = await activeTab.getAttribute('data-testid');
    expect(activeTabId).toBeTruthy();

    await expect(page.locator(GRPC.TAB_PANE(activeTabId!))).toBeVisible();
    await expect(page.locator(GRPC.TAB_DUPLICATE(activeTabId!))).toBeVisible();
    await expect(page.locator(GRPC.TAB_CLOSE(activeTabId!))).toBeVisible();
    await expect(page.locator(GRPC.TARGET_INPUT)).toBeVisible();
  });

  test('request composer selectors are present (UX-3)', async ({ page }) => {
    await gotoFresh(page);

    await expect(page.locator(GRPC.REQUEST_TAB_FORM)).toBeVisible();
    await expect(page.locator(GRPC.REQUEST_TAB_JSON)).toBeVisible();
    await expect(page.locator(GRPC.REQUEST_TAB_METADATA)).toBeVisible();
    await expect(page.locator(GRPC.REQUEST_TAB_AUTH)).toBeVisible();
    await expect(page.locator(GRPC.REQUEST_TAB_FILES)).toBeVisible();
  });

  test('dynamic explorer selectors resolve for reflected service/method IDs', async ({ page, request }) => {
    await gotoFresh(page);

    const tab = page.locator(GRPC.TAB_BAR).getByRole('tab', { selected: true });
    const tabId = await tab.getAttribute('data-testid');
    expect(tabId).toBeTruthy();

    const listener = await startGrpcMockListener(request, {
      tabId: tabId!,
      connectionId: `conn-${tabId}`,
      responseMessage: 'selector-guard',
    });

    try {
      await page.locator(GRPC.TARGET_INPUT).fill(listener.listenTarget);
      await reflectGrpcServices(page);

      await expect(page.locator(GRPC.SERVICE('echo.EchoService'))).toBeVisible();
      await expect(page.locator(GRPC.METHOD('echo.EchoService', 'Echo'))).toBeVisible();
      await expect(page.locator(GRPC.METHOD('echo.EchoService', 'ServerStream'))).toBeVisible();
    } finally {
      await stopGrpcMockListener(request, tabId!);
    }
  });

  test('UX-4 response selectors render after unary call and support proto switch', async ({ page, request }) => {
    await gotoFresh(page);

    const tab = page.locator(GRPC.TAB_BAR).getByRole('tab', { selected: true });
    const tabId = await tab.getAttribute('data-testid');
    expect(tabId).toBeTruthy();

    const listener = await startGrpcMockListener(request, {
      tabId: tabId!,
      connectionId: `conn-${tabId}`,
      responseMessage: 'ux4-selector-guard',
    });

    try {
      await page.locator(GRPC.TARGET_INPUT).fill(listener.listenTarget);
      await reflectGrpcServices(page);
      await selectEchoMethod(page);
      await fillEchoMessage(page, 'ux4-selector-guard');
      await sendUnaryCall(page);
      await waitForUnarySuccess(page);

      await expect(page.locator(GRPC.RESPONSE_TOP_TAB_RESPONSE)).toBeVisible();
      await expect(page.locator(GRPC.RESPONSE_TOP_TAB_PROTO)).toBeVisible();
      await expect(page.locator(GRPC.RESPONSE_TAB_BODY)).toBeVisible();
      await expect(page.locator(GRPC.RESPONSE_TAB_HEADERS)).toBeVisible();
      await expect(page.locator(GRPC.RESPONSE_TAB_METADATA)).toBeVisible();
      await expect(page.locator(GRPC.RESPONSE_TAB_TRAILERS)).toBeVisible();
      await expect(page.locator(GRPC.RESPONSE_TAB_TRACING)).toBeVisible();
      await expect(page.locator(GRPC.RESPONSE_TAB_TIMING)).toBeVisible();

      await page.locator(GRPC.RESPONSE_TOP_TAB_PROTO).click();
      await expect(page.locator(GRPC.RESPONSE_PROTO_PANEL)).toBeVisible();
      await expect(page.locator(GRPC.RESPONSE_PROTO_CODE)).toBeVisible();
      await expect(page.locator(GRPC.RESPONSE_PROTO_EXPORT)).toBeVisible();
    } finally {
      await stopGrpcMockListener(request, tabId!);
    }
  });
});
