/**
 * Helpers for product API Mock multi-server E2E (plan §12.2).
 *
 * Prereq: Express companion on :3001 (Playwright webServer) + Vite :5173.
 * Demo Hub bridges (`__demoWipeApiMockWorkspace`, `__demoPatchApiMockActiveRoute`)
 * are available in default `npm run dev` (VITE_ENABLE_DEMO_HUB=true).
 */
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { API_MOCK } from '../src/shared/selectors/apiMock';
import { isBackendHealthy } from './grpc-helpers';
import { ensureAppSidebarExpanded, gotoAppTab } from './helpers';

export const USERS_NAME = 'Users API';
export const PAYMENTS_NAME = 'Payments API';
export const CONFLICT_NAME = 'Conflict Probe';
export const USERS_PORT = 4600;
export const PAYMENTS_PORT = 4601;
export const USERS_PATH = '/users';
export const PAYMENTS_PATH = '/payments';
export const USERS_BODY = '{"service":"users","ok":true}';
export const USERS_BODY_V2 = '{"service":"users","ok":true,"v":2}';
export const PAYMENTS_BODY = '{"service":"payments","ok":true}';

export const MULTI_SERVER_TIMEOUT = 180_000;

export async function isApiMockCompanionReady(request: APIRequestContext): Promise<boolean> {
  return isBackendHealthy(request);
}

/** Stop every companion listener (including orphans from prior runs). */
export async function stopAllCompanionListeners(request: APIRequestContext): Promise<void> {
  try {
    const res = await request.get('http://localhost:3001/api/mock/servers', { timeout: 5_000 });
    if (!res.ok()) return;
    const body = await res.json() as { ok?: boolean; data?: Array<{ serverId: string }> };
    for (const row of body.data ?? []) {
      await request.post(`http://localhost:3001/api/mock/servers/${encodeURIComponent(row.serverId)}/stop`, {
        timeout: 5_000,
      }).catch(() => undefined);
    }
  } catch {
    // Best-effort — companion may be restarting.
  }
}

export async function openApiMockStudio(page: Page): Promise<void> {
  await gotoAppTab(page, 'api-mock-studio');
  await expect(
    page.locator(API_MOCK.STUDIO).or(page.locator(API_MOCK.EMPTY)),
  ).toBeVisible({ timeout: 30_000 });
}

/** In-app nav back to API Mock without full reload (keeps Studio mounted). */
export async function switchToApiMockStudio(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Protocols', exact: true }).click();
  await page.locator('[data-testid="nav-tab-api-mock-studio"]').click();
  await expect(
    page.locator(API_MOCK.STUDIO).or(page.locator(API_MOCK.EMPTY)),
  ).toBeVisible({ timeout: 15_000 });
}

/** Wipe persisted workspace and stop orphan listeners (demo bridge + companion). */
export async function wipeApiMockWorkspace(
  page: Page,
  request?: APIRequestContext,
): Promise<void> {
  if (request) await stopAllCompanionListeners(request);
  const ok = await page.evaluate(async () => {
    const wipe = (window as unknown as { __demoWipeApiMockWorkspace?: () => Promise<boolean> })
      .__demoWipeApiMockWorkspace;
    if (!wipe) return false;
    return wipe();
  });
  expect(ok, 'Expected __demoWipeApiMockWorkspace (demo hub enabled in .env.development)').toBe(true);
  await page.waitForTimeout(400);
  const empty = page.locator(API_MOCK.EMPTY);
  const tabs = page.locator(API_MOCK.SERVER_TABS);
  await expect(empty.or(tabs)).toBeVisible({ timeout: 10_000 });
}

export function serverTab(page: Page, name: string) {
  return page.locator('[data-testid^="api-mock-tab-"]').filter({ hasText: name }).first();
}

export async function selectServerTab(page: Page, name: string): Promise<void> {
  const tab = serverTab(page, name);
  await expect(tab).toBeVisible({ timeout: 10_000 });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

export async function expectTabStatus(
  page: Page,
  name: string,
  status: 'running' | 'stopped' | 'error' | 'starting' | 'draining' | 'applying',
): Promise<void> {
  const tab = serverTab(page, name);
  await expect(tab.locator(`.am-status-dot.${status}`)).toBeVisible({ timeout: 20_000 });
}

async function createBlankServer(page: Page): Promise<void> {
  const emptyCreate = page.locator(API_MOCK.CREATE_FIRST);
  if (await emptyCreate.isVisible().catch(() => false)) {
    await emptyCreate.click();
  } else {
    await page.locator(API_MOCK.TAB_ADD).click();
  }
  await expect(page.locator(API_MOCK.SERVER_BAR)).toBeVisible({ timeout: 15_000 });
}

export async function configureActiveServerIdentity(
  page: Page,
  name: string,
  port: number,
): Promise<void> {
  await page.locator(API_MOCK.SETTINGS).click();
  await expect(page.locator(API_MOCK.SETTINGS_MODAL)).toBeVisible({ timeout: 10_000 });
  await page.locator(API_MOCK.SETTINGS_NAME).fill(name);
  await page.locator(API_MOCK.SETTINGS_PORT).fill(String(port));
  await page.locator(API_MOCK.SETTINGS_SAVE).click();
  await expect(page.locator(API_MOCK.SETTINGS_MODAL)).toBeHidden({ timeout: 10_000 });
  await expect(serverTab(page, name)).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(API_MOCK.ADDRESS)).toContainText(String(port));
}

async function patchActiveRoute(
  page: Page,
  patch: { path?: string; body?: string },
): Promise<void> {
  const ok = await page.evaluate((p) => {
    const fn = (window as unknown as {
      __demoPatchApiMockActiveRoute?: (patch: { path?: string; body?: string; priority?: number }) => boolean;
    }).__demoPatchApiMockActiveRoute;
    if (!fn) return false;
    return fn(p);
  }, patch);
  expect(ok, 'Expected __demoPatchApiMockActiveRoute bridge').toBe(true);
  await page.waitForTimeout(300);
}

export async function ensureRouteWithBody(
  page: Page,
  path: string,
  body: string,
): Promise<void> {
  const routeCount = await page.locator(API_MOCK.ROUTE_ROW).count();
  if (routeCount === 0) {
    const noRouteCreate = page.locator(API_MOCK.NO_ROUTE_CREATE);
    if (await noRouteCreate.isVisible().catch(() => false)) {
      await noRouteCreate.click();
    } else {
      await page.locator(API_MOCK.ADD_ROUTE).click();
    }
    await expect(page.locator(API_MOCK.ROUTE_EDITOR)).toBeVisible({ timeout: 10_000 });
  } else {
    await page.locator(API_MOCK.FIRST_ROUTE).click();
    await expect(page.locator(API_MOCK.ROUTE_EDITOR)).toBeVisible({ timeout: 10_000 });
  }

  await page.locator(API_MOCK.PATH_INPUT).fill(path);
  await page.locator(API_MOCK.BTAB_RESPONSE).click();
  await expect(page.locator(API_MOCK.VARIANT_BODY)).toBeVisible({ timeout: 10_000 });
  await patchActiveRoute(page, { path, body });
}

export async function createConfiguredServer(
  page: Page,
  opts: { name: string; port: number; path: string; body: string },
): Promise<void> {
  await createBlankServer(page);
  await configureActiveServerIdentity(page, opts.name, opts.port);
  await ensureRouteWithBody(page, opts.path, opts.body);
}

export async function startActiveServer(page: Page): Promise<void> {
  await page.locator(API_MOCK.START).click();
  await expect(page.locator(API_MOCK.STATUS_LABEL)).toContainText(/Running/i, { timeout: 20_000 });
}

export async function stopActiveServer(page: Page): Promise<void> {
  await page.locator(API_MOCK.STOP).click();
  await expect(page.locator(API_MOCK.STATUS_LABEL)).toContainText(/Stopped/i, { timeout: 20_000 });
}

export async function applyActiveServer(page: Page): Promise<void> {
  await page.locator(API_MOCK.APPLY).click();
  await expect(page.locator(API_MOCK.STATUS_LABEL)).toContainText(/Running/i, { timeout: 20_000 });
  await expect(page.locator(API_MOCK.DIRTY_BADGE)).toBeHidden({ timeout: 10_000 });
}

export async function readGeneration(page: Page): Promise<number> {
  const gen = page.locator(API_MOCK.GENERATION);
  if (!(await gen.isVisible().catch(() => false))) return 0;
  const text = (await gen.textContent()) ?? '';
  const m = text.match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

export async function openTransactionsDock(page: Page): Promise<void> {
  const dockTab = page.locator(API_MOCK.DOCK_TAB_TRANSACTIONS);
  const live = page.locator(API_MOCK.LIVE_TRANSACTIONS);
  if (await live.isVisible().catch(() => false)) {
    await live.click();
  } else if (!(await dockTab.isVisible().catch(() => false))) {
    await page.locator(API_MOCK.VIEW_RUNTIME).click();
  }
  if (await dockTab.isVisible().catch(() => false)) {
    await dockTab.click();
  }
  await expect(page.locator(API_MOCK.DOCK).or(page.locator(API_MOCK.JOURNAL_TOOLBAR)).first()).toBeVisible({
    timeout: 10_000,
  });
}

export async function expectJournalMatch(page: Page): Promise<void> {
  await openTransactionsDock(page);
  await expect(page.locator(API_MOCK.JOURNAL_FIRST_ROW).first()).toBeVisible({ timeout: 15_000 });
}

/**
 * Create/open a URL collection request and Send to the mock listener.
 * Uses activity-bar navigation (no full reload) so API Mock Studio stays mounted.
 */
export async function sendFromRequestsStudio(
  page: Page,
  url: string,
  expectBodyFragment: string,
): Promise<void> {
  await page.getByRole('button', { name: 'API', exact: true }).click();
  await page.locator('[data-testid="nav-tab-requests"]').click();
  await ensureAppSidebarExpanded(page);
  await expect(page.locator('[data-testid="req-sidebar"]')).toBeVisible({ timeout: 15_000 });

  const urlInput = page.locator('[data-testid="req-url-input"]');
  if (!(await urlInput.isVisible().catch(() => false))) {
    await page.locator('[data-testid="req-sidebar-add-btn"]').click();
    await page.locator('[data-testid="req-add-url-collection"]').click();
    const modal = page.locator('[data-testid="req-collection-modal"]');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await modal.locator('input.req-input').first().fill('API Mock Multi-Server');
    await modal.locator('button.btn-primary', { hasText: /Create/i }).click();
    await expect(modal).toBeHidden({ timeout: 10_000 });

    const col = page.locator('.req-col-header, .req-collection-item, [data-testid^="req-col-"]')
      .filter({ hasText: /API Mock Multi-Server/i })
      .first();
    await expect(col).toBeVisible({ timeout: 10_000 });
    await col.click({ button: 'right' });
    const addReq = page.getByRole('button', { name: /Add Request/i }).or(
      page.locator('button', { hasText: /Add Request/i }),
    );
    await expect(addReq.first()).toBeVisible({ timeout: 5_000 });
    await addReq.first().click();

    const prompt = page.locator('[data-testid="req-new-request-prompt"]');
    if (await prompt.isVisible().catch(() => false)) {
      await page.locator('[data-testid="req-new-request-name"]').fill('Mock probe');
      await prompt.locator('button.btn-primary', { hasText: /Create/i }).click();
    }
    await expect(page.locator('[data-testid="req-url-input"]')).toBeVisible({ timeout: 15_000 });
  }

  await page.locator('[data-testid="req-url-input"]').fill(url);
  await page.locator('[data-testid="req-send-btn"]').click();
  await expect(page.locator('[data-testid="req-status-pill"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-testid="req-status-pill"]')).toContainText(/200/);
  await expect(page.locator('.req-pane-right')).toContainText(expectBodyFragment, { timeout: 10_000 });
}

/** Node-side fetch (avoids browser CORS — mock CORS is off by default). */
export async function fetchMock(
  request: APIRequestContext,
  port: number,
  path: string,
): Promise<{ status: number; body: string }> {
  const res = await request.get(`http://localhost:${port}${path}`, { timeout: 10_000 });
  return { status: res.status(), body: await res.text() };
}
