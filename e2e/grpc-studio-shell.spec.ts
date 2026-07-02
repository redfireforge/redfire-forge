/**
 * grpc-studio-shell.spec.ts — gRPC Studio shell E2E (Phase 1H, no Docker).
 *
 * Validates navigation and idle UI without a live gRPC backend.
 */
import { test, expect } from '@playwright/test';
import {
  BIDI_STREAM_METHOD_TESTID,
  CLIENT_STREAM_METHOD_TESTID,
  ECHO_SERVICE_TESTID,
  SERVER_STREAM_METHOD_TESTID,
  fillEchoMessage,
  gotoGrpcStudio,
  isBackendHealthy,
  reflectGrpcServices,
  selectEchoMethod,
  selectGrpcMethod,
  sendAllPendingStreamMessages,
  sendStreamMessage,
  sendUnaryCall,
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

const GRPC_STUDIO_SESSION_STORAGE_KEY = 'grpc-studio-session-v1';

function serverStreamShellRuleSet() {
  return {
    rules: [{
      id: 'server-stream-shell',
      name: 'Server stream shell rule',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'ServerStream' } as const,
      response: {
        statusCode: 0,
        messages: [
          { message: 'shell-ss [1/2]' },
          { message: 'shell-ss [2/2]' },
        ],
        interMessageDelayMs: 0,
      },
    }],
  };
}

function clientStreamShellRuleSet() {
  return {
    rules: [{
      id: 'client-stream-shell',
      name: 'Client stream shell rule',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'ClientStream' } as const,
      response: {
        statusCode: 0,
        body: { message: 'shell-client-aggregate' },
      },
    }],
  };
}

function bidiStreamShellRuleSet() {
  return {
    rules: [{
      id: 'bidi-stream-shell',
      name: 'Bidi stream shell rule',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'BidiStream' } as const,
      response: {
        statusCode: 0,
        body: { message: 'shell-bidi-ack' },
      },
    }],
  };
}

async function gotoFreshGrpcStudio(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('__grpc_e2e_session_cleared__')) {
      return;
    }
    localStorage.removeItem(key);
    sessionStorage.setItem('__grpc_e2e_session_cleared__', '1');
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

async function gotoGrpcStudioWithCorruptedSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, '{not-valid-json');
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

async function gotoGrpcStudioWithStaleSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'stale-tab',
      tabs: [{
        id: 'stale-tab',
        title: 'Stale tab',
        target: 'stale.example.com:50051',
        tlsMode: 'plaintext',
        auth: { type: 'bearer', bearerToken: 'stale-token' },
        metadata: {},
        timeoutMs: 30000,
        connectionId: null,
        requestMode: 'form',
        body: {},
        envVarOverrides: {},
        servicesCollapsed: true,
      }],
      tabDescriptors: {},
      timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

async function gotoGrpcStudioWithWrongVersionSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 99,
      activeTabId: 'wrong-version-tab',
      tabs: [{
        id: 'wrong-version-tab',
        title: 'Wrong version tab',
        target: 'wrong-version.example.com:50051',
        tlsMode: 'plaintext',
        auth: { type: 'bearer', bearerToken: 'wrong-version-token' },
        metadata: {},
        timeoutMs: 30000,
        connectionId: null,
        requestMode: 'form',
        body: {},
        envVarOverrides: {},
        servicesCollapsed: true,
      }],
      tabDescriptors: {},
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

async function gotoGrpcStudioWithInvalidTabsSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'invalid-tabs-tab',
      tabs: {
        id: 'invalid-tabs-tab',
        target: 'invalid-tabs.example.com:50051',
      },
      tabDescriptors: {},
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

async function gotoGrpcStudioWithMissingActiveTabSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'missing-tab',
      tabs: [
        {
          id: 'restored-tab-1',
          title: 'Restored tab 1',
          target: 'fallback-one.example.com:50051',
          tlsMode: 'plaintext',
          auth: { type: 'bearer', bearerToken: 'fallback-one-token' },
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
          servicesCollapsed: true,
        },
        {
          id: 'restored-tab-2',
          title: 'Restored tab 2',
          target: 'fallback-two.example.com:50052',
          tlsMode: 'plaintext',
          auth: undefined,
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
          servicesCollapsed: false,
        },
      ],
      tabDescriptors: {},
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

async function gotoGrpcStudioWithOverflowTabsSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    const tabs = Array.from({ length: 10 }, (_, index) => ({
      id: `overflow-tab-${index + 1}`,
      title: `Overflow tab ${index + 1}`,
      target: `overflow-${index + 1}.example.com:${50051 + index}`,
      tlsMode: 'plaintext',
      auth: index === 0 ? { type: 'bearer', bearerToken: 'overflow-one-token' } : undefined,
      metadata: {},
      timeoutMs: 30000,
      connectionId: null,
      requestMode: 'form',
      body: {},
      envVarOverrides: {},
      servicesCollapsed: index === 0,
    }));

    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'overflow-tab-10',
      tabs,
      tabDescriptors: {},
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

async function gotoGrpcStudioWithSecondActiveSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'seeded-tab-2',
      tabs: [
        {
          id: 'seeded-tab-1',
          title: 'Seeded tab 1',
          target: 'seeded-one.example.com:50051',
          tlsMode: 'plaintext',
          auth: undefined,
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
          servicesCollapsed: false,
        },
        {
          id: 'seeded-tab-2',
          title: 'Seeded tab 2',
          target: 'seeded-two.example.com:50052',
          tlsMode: 'plaintext',
          auth: { type: 'bearer', bearerToken: 'seeded-two-token' },
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
          servicesCollapsed: true,
        },
      ],
      tabDescriptors: {
        orphaned: {
          sourceSelection: { type: 'reflection' },
          expandedServiceIds: ['unused.service'],
        },
      },
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

async function gotoGrpcStudioWithEmptyTabsSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'empty-tab',
      tabs: [],
      tabDescriptors: {},
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

async function gotoGrpcStudioWithLegacyMissingDescriptorMapSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'legacy-tab-2',
      tabs: [
        {
          id: 'legacy-tab-1',
          title: 'Legacy tab 1',
          target: 'legacy-one.example.com:50051',
          tlsMode: 'plaintext',
          auth: undefined,
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
        },
        {
          id: 'legacy-tab-2',
          title: 'Legacy tab 2',
          target: 'legacy-two.example.com:50052',
          tlsMode: 'plaintext',
          auth: { type: 'bearer', bearerToken: 'legacy-two-token' },
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
        },
      ],
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

async function gotoGrpcStudioWithNullDescriptorMapSession(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({
      version: 1,
      activeTabId: 'legacy-null-descriptor-tab',
      tabs: [
        {
          id: 'legacy-null-descriptor-tab',
          title: 'Legacy null descriptor tab',
          target: 'legacy-null.example.com:50051',
          tlsMode: 'plaintext',
          auth: { type: 'bearer', bearerToken: 'legacy-null-token' },
          metadata: {},
          timeoutMs: 30000,
          connectionId: null,
          requestMode: 'form',
          body: {},
          envVarOverrides: {},
          servicesCollapsed: true,
        },
      ],
      tabDescriptors: null,
      timestamp: Date.now(),
    }));
  }, GRPC_STUDIO_SESSION_STORAGE_KEY);
  await gotoGrpcStudio(page);
}

test.describe('gRPC Studio — navigation (Phase 1H shell)', () => {
  test('navigates to gRPC Studio via URL param', async ({ page }) => {
    await gotoGrpcStudio(page);
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible();
  });

  test('shows target input and explorer idle hint', async ({ page }) => {
    await gotoGrpcStudio(page);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-service-explorer"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });

  test('reflect button is disabled until target is valid', async ({ page }) => {
    await gotoGrpcStudio(page);
    const reflectBtn = page.locator('[data-testid="grpc-reflect-btn"]');
    await expect(reflectBtn).toBeDisabled();
  });

  test('Protocols sub-nav reaches gRPC Studio', async ({ page }) => {
    await gotoGrpcStudio(page, { seed: true });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.click('text=Protocols');
    await page.click('button:has-text("gRPC")');
    await expect(page).toHaveURL(new RegExp(`tab=grpc-studio`));
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 15_000 });
  });

  test('call panel shows empty method hint before selection', async ({ page }) => {
    await gotoGrpcStudio(page);
    await expect(page.locator('[data-testid="grpc-call-panel-empty"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-response-idle"]')).toBeVisible();
  });

  test('auth badge opens connection settings drawer on Auth panel', async ({ page }) => {
    await gotoGrpcStudio(page);

    await page.locator('[data-testid="grpc-auth-badge"]').click();

    await expect(page.locator('[data-testid="grpc-connection-settings-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-settings-panel-auth"]')).toBeVisible();
  });

  test('active tab target persists across reload', async ({ page }) => {
    const restoredTarget = 'localhost:50099';

    await gotoFreshGrpcStudio(page);

    await page.locator('[data-testid="grpc-add-tab"]').click();
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(2);

    const targetInput = page.locator('[data-testid="grpc-target-input"]');
    await targetInput.fill(restoredTarget);
    await expect(targetInput).toHaveValue(restoredTarget);

    await expect
      .poll(async () => page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const session = JSON.parse(stored) as {
          activeTabId?: string;
          tabs?: Array<{ id: string; target?: string }>;
        };
        const activeTab = session.tabs?.find((tab) => tab.id === session.activeTabId);
        return activeTab?.target ?? null;
      }, GRPC_STUDIO_SESSION_STORAGE_KEY))
      .toBe(restoredTarget);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(2);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue(restoredTarget);
  });

  test('duplicated tab state survives closing the source tab and reloading', async ({ page }) => {
    const sourceTarget = 'localhost:50051';
    const copiedTarget = 'localhost:50077';

    await gotoFreshGrpcStudio(page);

    const targetInput = page.locator('[data-testid="grpc-target-input"]');
    await targetInput.fill(sourceTarget);
    await expect(targetInput).toHaveValue(sourceTarget);

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab').first();
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    await page.locator(`[data-testid="grpc-tab-duplicate-${firstTabId}"]`).click();
    const tabs = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab');
    await expect(tabs).toHaveCount(2);

    const activeTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const activeTabId = await activeTab.getAttribute('data-testid');
    if (!activeTabId || activeTabId === firstTabId) {
      throw new Error('Expected duplicated tab to become active');
    }

    await targetInput.fill(copiedTarget);
    await expect(targetInput).toHaveValue(copiedTarget);

    await page.locator(`[data-testid="grpc-tab-close-${firstTabId}"]`).click();
    await expect(tabs).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue(copiedTarget);

    await expect
      .poll(async () => page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const session = JSON.parse(stored) as {
          activeTabId?: string;
          tabs?: Array<{ id: string; target?: string }>;
        };
        return {
          tabCount: session.tabs?.length ?? 0,
          activeTarget: session.tabs?.find((tab) => tab.id === session.activeTabId)?.target ?? null,
        };
      }, GRPC_STUDIO_SESSION_STORAGE_KEY))
      .toEqual({ tabCount: 1, activeTarget: copiedTarget });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue(copiedTarget);
  });

  test('collapsed services sidebar persists across reload', async ({ page }) => {
    await gotoFreshGrpcStudio(page);

    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
    await page.locator('[data-testid="grpc-explorer-collapse-btn"]').click();

    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toHaveCount(0);

    await expect
      .poll(async () => page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const session = JSON.parse(stored) as {
          activeTabId?: string;
          tabs?: Array<{ id: string; servicesCollapsed?: boolean }>;
        };
        return session.tabs?.find((tab) => tab.id === session.activeTabId)?.servicesCollapsed ?? null;
      }, GRPC_STUDIO_SESSION_STORAGE_KEY))
      .toBe(true);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toHaveCount(0);
  });

  test('services sidebar collapse state stays isolated per tab across tab switching', async ({ page }) => {
    await gotoFreshGrpcStudio(page);

    const tabs = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab');
    await page.locator('[data-testid="grpc-explorer-collapse-btn"]').click();
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    await page.locator('[data-testid="grpc-add-tab"]').click();
    await expect(tabs).toHaveCount(2);
    const secondTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const secondTabId = await secondTab.getAttribute('data-testid');
    if (!secondTabId || secondTabId === firstTabId) {
      throw new Error('Expected newly added tab to become active');
    }
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();

    await page.locator(`[data-testid="${firstTabId}"]`).click();
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toHaveCount(0);

    await expect
      .poll(async () => page.evaluate(({ key, firstTabId, secondTabId }) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const session = JSON.parse(stored) as {
          tabs?: Array<{ id: string; servicesCollapsed?: boolean }>;
        };
        const firstTab = session.tabs?.find((tab) => tab.id === firstTabId);
        const secondTab = session.tabs?.find((tab) => tab.id === secondTabId);
        return {
          firstCollapsed: firstTab?.servicesCollapsed ?? null,
          secondCollapsed: secondTab?.servicesCollapsed ?? null,
        };
      }, {
        key: GRPC_STUDIO_SESSION_STORAGE_KEY,
        firstTabId,
        secondTabId,
      }))
      .toEqual({ firstCollapsed: true, secondCollapsed: false });
  });

  test('tablet widths use side-by-side request and response panes', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await gotoGrpcStudio(page);

    const splitDirection = await page.locator('.grpc-call-split').evaluate((node) => getComputedStyle(node).flexDirection);
    expect(splitDirection).toBe('row');
  });

  test('mobile widths keep request and response panes stacked', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 900 });
    await gotoGrpcStudio(page);

    const splitDirection = await page.locator('.grpc-call-split').evaluate((node) => getComputedStyle(node).flexDirection);
    expect(splitDirection).toBe('column');
  });

  test('mobile stage tabs switch between request, response, and auth panes', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 900 });
    await gotoGrpcStudio(page);

    await expect(page.locator('[data-testid="grpc-mobile-stage-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-request-pane"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-response-shell"]')).toBeHidden();

    await page.locator('[data-testid="grpc-mobile-stage-response"]').click();
    await expect(page.locator('[data-testid="grpc-request-pane"]')).toBeHidden();
    await expect(page.locator('[data-testid="grpc-response-shell"]')).toBeVisible();

    await page.locator('[data-testid="grpc-mobile-stage-auth"]').click();
    await expect(page.locator('[data-testid="grpc-request-pane"]')).toBeVisible();
    await expect(page.locator('[data-testid="grpc-response-shell"]')).toBeHidden();
    await expect(page.locator('[data-testid="grpc-request-tab-auth"]')).toHaveClass(/active/);
  });

  test('desktop shell avoids page-level vertical overflow at 1440x900', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoGrpcStudio(page);

    const overflow = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));

    expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 1);
  });

  test('auth configuration stays isolated per tab', async ({ page }) => {
    await gotoFreshGrpcStudio(page);

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await page.locator('[data-testid="grpc-auth-type-pill-bearer"]').click();
    await page.locator('[data-testid="grpc-auth-bearer-token"]').fill('tab-one-token');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');

    await page.locator('[data-testid="grpc-add-tab"]').click();
    const secondTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const secondTabId = await secondTab.getAttribute('data-testid');
    if (!secondTabId || secondTabId === firstTabId) {
      throw new Error('Expected newly added gRPC tab id');
    }

    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-type-pill-none"]')).toHaveClass(/active/);

    await page.locator(`[data-testid="${firstTabId}"]`).click();
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-type-pill-bearer"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('tab-one-token');
  });

  test('active tab auth configuration persists across reload', async ({ page }) => {
    await gotoFreshGrpcStudio(page);

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await page.locator('[data-testid="grpc-auth-type-pill-bearer"]').click();
    await page.locator('[data-testid="grpc-auth-bearer-token"]').fill('reload-token');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');

    await expect
      .poll(async () => page.evaluate((key) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const session = JSON.parse(stored) as {
          activeTabId?: string;
          tabs?: Array<{ id: string; auth?: { type?: string; bearerToken?: string } }>;
        };
        return session.tabs?.find((tab) => tab.id === session.activeTabId)?.auth ?? null;
      }, GRPC_STUDIO_SESSION_STORAGE_KEY))
      .toEqual({ type: 'bearer', bearerToken: 'reload-token' });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-type-pill-bearer"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('reload-token');
  });

  test('duplicated tab copies auth state and keeps it independent', async ({ page }) => {
    await gotoFreshGrpcStudio(page);

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await page.locator('[data-testid="grpc-auth-type-pill-bearer"]').click();
    await page.locator('[data-testid="grpc-auth-bearer-token"]').fill('source-token');

    await page.locator(`[data-testid="grpc-tab-duplicate-${firstTabId}"]`).click();
    const activeTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const activeTabId = await activeTab.getAttribute('data-testid');
    if (!activeTabId || activeTabId === firstTabId) {
      throw new Error('Expected duplicated tab to become active');
    }

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-type-pill-bearer"]')).toHaveClass(/active/);
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('source-token');

    await page.locator('[data-testid="grpc-auth-bearer-token"]').fill('duplicate-token');
    await page.locator(`[data-testid="${firstTabId}"]`).click();
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('source-token');
  });

  test('duplicated tabs preserve independent target and auth state across reload', async ({ page }) => {
    await gotoFreshGrpcStudio(page);

    const targetInput = page.locator('[data-testid="grpc-target-input"]');
    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    await targetInput.fill('source.example.com:50051');
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await page.locator('[data-testid="grpc-auth-type-pill-bearer"]').click();
    await page.locator('[data-testid="grpc-auth-bearer-token"]').fill('source-token');

    await page.locator(`[data-testid="grpc-tab-duplicate-${firstTabId}"]`).click();
    const duplicatedTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const duplicatedTabId = await duplicatedTab.getAttribute('data-testid');
    if (!duplicatedTabId || duplicatedTabId === firstTabId) {
      throw new Error('Expected duplicated tab to become active');
    }

    await targetInput.fill('duplicate.example.com:50052');
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await page.locator('[data-testid="grpc-auth-bearer-token"]').fill('duplicate-token');

    await expect
      .poll(async () => page.evaluate(({ key, firstTabId, duplicatedTabId }) => {
        const stored = localStorage.getItem(key);
        if (!stored) return null;
        const session = JSON.parse(stored) as {
          activeTabId?: string;
          tabs?: Array<{ id: string; target?: string; auth?: { type?: string; bearerToken?: string } }>;
        };
        const firstTab = session.tabs?.find((tab) => tab.id === firstTabId);
        const duplicatedTab = session.tabs?.find((tab) => tab.id === duplicatedTabId);
        return {
          tabCount: session.tabs?.length ?? 0,
          activeTabId: session.activeTabId ?? null,
          firstTarget: firstTab?.target ?? null,
          firstToken: firstTab?.auth?.bearerToken ?? null,
          duplicatedTarget: duplicatedTab?.target ?? null,
          duplicatedToken: duplicatedTab?.auth?.bearerToken ?? null,
        };
      }, {
        key: GRPC_STUDIO_SESSION_STORAGE_KEY,
        firstTabId,
        duplicatedTabId,
      }))
      .toEqual({
        tabCount: 2,
        activeTabId: duplicatedTabId,
        firstTarget: 'source.example.com:50051',
        firstToken: 'source-token',
        duplicatedTarget: 'duplicate.example.com:50052',
        duplicatedToken: 'duplicate-token',
      });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });

    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(2);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('duplicate.example.com:50052');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('duplicate-token');

    await page.locator(`[data-testid="${firstTabId}"]`).click();
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('source.example.com:50051');
    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('source-token');
  });

  test('corrupted persisted session falls back to a fresh default workspace', async ({ page }) => {
    await gotoGrpcStudioWithCorruptedSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
  });

  test('stale persisted session falls back to a fresh default workspace', async ({ page }) => {
    await gotoGrpcStudioWithStaleSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });

  test('wrong-version persisted session falls back to a fresh default workspace', async ({ page }) => {
    await gotoGrpcStudioWithWrongVersionSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });

  test('invalid-tabs persisted session falls back to a fresh default workspace', async ({ page }) => {
    await gotoGrpcStudioWithInvalidTabsSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });

  test('missing active tab id restores the first persisted tab safely', async ({ page }) => {
    await gotoGrpcStudioWithMissingActiveTabSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(2);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('fallback-one.example.com:50051');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('fallback-one-token');
  });

  test('persisted tabs beyond the max limit are truncated and recover to the first surviving tab', async ({ page }) => {
    await gotoGrpcStudioWithOverflowTabsSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(8);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('overflow-1.example.com:50051');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('overflow-one-token');
  });

  test('valid persisted active tab restores a non-first tab and keeps sibling state intact', async ({ page }) => {
    await gotoGrpcStudioWithSecondActiveSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(2);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('seeded-two.example.com:50052');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('seeded-two-token');

    await page.locator('[data-testid="seeded-tab-1"]').click();
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('seeded-one.example.com:50051');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });

  test('empty persisted tabs leave the default workspace intact', async ({ page }) => {
    await gotoGrpcStudioWithEmptyTabsSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
    await expect(page.locator('[data-testid="grpc-explorer-idle"]')).toBeVisible();
  });

  test('legacy persisted session without descriptor map restores active tab and sibling state safely', async ({ page }) => {
    await gotoGrpcStudioWithLegacyMissingDescriptorMapSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(2);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('legacy-two.example.com:50052');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('legacy-two-token');

    await page.locator('[data-testid="legacy-tab-1"]').click();
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('legacy-one.example.com:50051');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: None');
  });

  test('persisted session with null descriptor map restores without crashing and keeps explorer collapse state', async ({ page }) => {
    await gotoGrpcStudioWithNullDescriptorMapSession(page);

    await expect(page.locator('[data-testid="grpc-studio-page"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab')).toHaveCount(1);
    await expect(page.locator('[data-testid="grpc-target-input"]')).toHaveValue('legacy-null.example.com:50051');
    await expect(page.locator('[data-testid="grpc-auth-badge"]')).toContainText('Auth: Bearer');
    await expect(page.locator('[data-testid="grpc-explorer-rail"]')).toBeVisible();

    await page.locator('[data-testid="grpc-request-tab-auth"]').click();
    await expect(page.locator('[data-testid="grpc-auth-bearer-token"]')).toHaveValue('legacy-null-token');
  });
});

test.describe('gRPC Studio — live-backed shell recovery', () => {
  test.beforeEach(async ({ request }) => {
    const ready = await isBackendHealthy(request);
    test.skip(!ready, 'Skipped: Express backend (:3001) not running');
  });

  test('reflection failure on an unreachable target recovers after switching to a live mock listener', async ({ page, request }) => {
    await gotoFreshGrpcStudio(page);

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    const targetInput = page.locator('[data-testid="grpc-target-input"]');
    await targetInput.fill('127.0.0.1:1');
    await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible();

    const { listenTarget } = await startGrpcMockListener(request, { tabId: firstTabId });

    try {
      await page.locator('[data-testid="grpc-reflect-btn"]').click();
      await expect(page.locator('[data-testid="grpc-explorer-error"]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('[data-testid="grpc-explorer-error"]')).toContainText(/failed|unreachable|refused|proxy|express/i);

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

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

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

    const firstTab = page.locator('[data-testid="grpc-tab-bar"]').getByRole('tab', { selected: true });
    const firstTabId = await firstTab.getAttribute('data-testid');
    if (!firstTabId) {
      throw new Error('Expected initial gRPC tab id');
    }

    const { listenTarget } = await startGrpcMockListener(request, { tabId: firstTabId });

    try {
      const targetInput = page.locator('[data-testid="grpc-target-input"]');
      const toggle = page.locator('[data-testid="grpc-connection-toggle-btn"]');
      const dot = page.locator('[data-testid="grpc-connection-status-dot"]');

      await targetInput.fill('127.0.0.1:1');
      await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible();
      await toggle.click();
      await expect(dot).toHaveAttribute('title', /(refused|unreachable|failed|connect)/i, { timeout: 15_000 });
      await expect(toggle).toHaveText('Connect');

      await targetInput.fill(listenTarget);
      await expect(page.locator('[data-testid="grpc-target-status-ok"]')).toBeVisible();
      await toggle.click();
      await expect(toggle).toHaveText('Disconnect', { timeout: 15_000 });
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
      await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('target-flip-recovered-v2');
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

      await toggle.click();
      await expect(dot).toHaveAttribute('title', /(refused|unreachable|failed|connect)/i, { timeout: 15_000 });
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
      await sendUnaryCall(page);
      await expect(page.locator('[data-testid="grpc-response-error-panel"]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('[data-testid="grpc-response-error-message"]')).toContainText(/refused|unreachable|failed|proxy|express|503|service unavailable|backend server/i);

      const recoveryListener = await startGrpcMockListener(request, {
        tabId,
        responseMessage: 'recovered-unary-response',
      });
      await targetInput.fill(recoveryListener.listenTarget);
      await sendUnaryCall(page);
      await waitForUnarySuccess(page);
      await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('recovered-unary-response');
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
      await startGrpcStream(page);
      await expect(page.locator('[data-testid="grpc-stream-status-badge"]')).toContainText('Error', { timeout: 15_000 });

      const recoveryListener = await startGrpcMockListener(request, {
        tabId,
        ruleSet: serverStreamShellRuleSet(),
      });
      await targetInput.fill(recoveryListener.listenTarget);
      await startGrpcStream(page);
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
      await expect(page.locator('[data-testid="grpc-stream-status-badge"]')).toContainText('Error', { timeout: 15_000 });

      const recoveryListener = await startGrpcMockListener(request, {
        tabId,
        ruleSet: clientStreamShellRuleSet(),
      });
      await targetInput.fill(recoveryListener.listenTarget);
      await startGrpcStream(page);
      await waitForStreamStatus(page, /Streaming|Starting/);

      await fillEchoMessage(page, 'recover-client');
      await enqueueStreamMessage(page);
      await sendAllPendingStreamMessages(page);
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
      await startGrpcStream(page);
      await expect(page.locator('[data-testid="grpc-stream-status-badge"]')).toContainText('Error', { timeout: 15_000 });

      const recoveryListener = await startGrpcMockListener(request, {
        tabId,
        ruleSet: bidiStreamShellRuleSet(),
      });
      await targetInput.fill(recoveryListener.listenTarget);
      await startGrpcStream(page);
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
      await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('tab-one-unary-response');

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
      await expect(page.locator('[data-testid="grpc-response-body"]')).toContainText('tab-one-unary-response');
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
