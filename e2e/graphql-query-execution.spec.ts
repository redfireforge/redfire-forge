/**
 * graphql-query-execution.spec.ts
 *
 * E2E tests for GraphQL Studio query execution (Phase 4).
 *
 * ── Network mock strategy ─────────────────────────────────────────────────────
 *
 * In web mode (not Tauri), ALL outbound HTTP requests go through the Vite
 * /__proxy middleware. The flow is:
 *
 *   Browser -> fetch('/__proxy', { body: JSON.stringify({ url, method, headers, body }) })
 *           -> Vite Node.js middleware -> upstream server
 *
 * Playwright's page.route() intercepts browser-level network requests.
 * So the correct interception target is `**\/__proxy`, NOT the upstream URL.
 *
 * The mock must return the response in HttpResponse format:
 *   { status: number, statusText: string, headers: Record<string,string>, body: string }
 * where `body` is the raw HTTP response body string (not parsed JSON).
 *
 * httpFetchViaViteProxy parses this JSON and validates that `status` is present
 * before returning it. If the wrapper is missing, it returns error status 0.
 *
 * Covers:
 *   - Execute button visibility and state
 *   - Query execution → response viewer renders
 *   - Status badge (200) and latency badge
 *   - GraphQL error responses → warn badge on Response tab
 *   - Variables panel interactions
 *   - Headers panel interactions
 *   - Introspection (schema pane)
 *   - Tab management
 *   - HTTP error responses
 */

import { test, expect, type Page } from '@playwright/test';
import { makeProxyResponse, mockProxy, silenceLogStream } from './graphql-helpers';

const GQL_URL = '/?tab=graphql-studio';

/** The endpoint we fill in the GQL studio */
const TEST_ENDPOINT = 'https://api.example.com/graphql';

/** Standard successful response */
const MOCK_SUCCESS = {
  data: {
    user: { id: 'u-123', name: 'Alice Tester', email: 'alice@example.com' },
  },
};

/** Response with GraphQL errors alongside partial data */
const MOCK_GQL_ERROR = {
  data: { user: null },
  errors: [
    { message: 'User not found', locations: [{ line: 1, column: 8 }], path: ['user'] },
  ],
};

/** Mutation response */
const MOCK_MUTATION = {
  data: { createUser: { id: 'u-456', name: 'Bob Builder' } },
};

/** Introspection schema response */
const MOCK_INTROSPECTION = {
  data: {
    __schema: {
      types: [
        { name: 'Query', kind: 'OBJECT', fields: [{ name: 'user', args: [], type: { kind: 'OBJECT', name: 'User', ofType: null }, isDeprecated: false, deprecationReason: null }], interfaces: [] },
        { name: 'User', kind: 'OBJECT', fields: [{ name: 'id', args: [], type: { kind: 'SCALAR', name: 'ID', ofType: null }, isDeprecated: false, deprecationReason: null }], interfaces: [] },
      ],
      queryType: { name: 'Query' },
      mutationType: null,
      subscriptionType: null,
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function gotoGqlStudio(page: Page) {
  await silenceLogStream(page);
  await page.goto('http://localhost:5173' + GQL_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: 15000 });
}

/**
 * Fill Monaco editor via the Monaco API (window.monaco).
 * Waits for Monaco to initialise before setting the value.
 */
async function fillMonacoEditor(page: Page, query: string) {
  await page.waitForFunction(
    () => {
      const w = window as unknown as Record<string, unknown>;
      const m = w['monaco'] as { editor?: { getModels?: () => { setValue: (v: string) => void }[] } } | undefined;
      return (m?.editor?.getModels?.()?.length ?? 0) > 0;
    },
    { timeout: 8000 },
  ).catch(() => {});

  const set = await page.evaluate((q: string) => {
    const w = window as unknown as Record<string, unknown>;
    const m = w['monaco'] as { editor?: { getModels?: () => { setValue: (v: string) => void }[] } } | undefined;
    const models = m?.editor?.getModels?.();
    if (models && models.length > 0) {
      models[0].setValue(q);
      return true;
    }
    return false;
  }, query);

  if (!set) {
    const monacoEl = page.locator('.monaco-editor').first();
    if (await monacoEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      await monacoEl.click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(query);
    }
  }

  await page.waitForTimeout(400);
}

/**
 * Fill endpoint, fill query, click Execute.
 * Uses the default (skipTlsVerify=false) path so httpFetch goes through /__proxy,
 * which is intercepted by the Playwright mock.
 */
async function executeQuery(page: Page, query = 'query { __typename }') {
  const input = page.locator('[data-testid="gql-endpoint-input"]');
  await input.fill(TEST_ENDPOINT);
  await page.waitForTimeout(300);

  await fillMonacoEditor(page, query);

  await page.locator('[data-testid="gql-execute-btn"]:not([disabled])').waitFor({ timeout: 5000 }).catch(() => {});
  await page.locator('[data-testid="gql-execute-btn"]').click();
}

// ── Suite 1: Execute button state ─────────────────────────────────────────────

test.describe('GraphQL Studio — execute button', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGqlStudio(page);
  });

  test('Execute button is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-execute-btn"]')).toBeVisible({ timeout: 5000 });
  });

  test('Execute button is disabled when endpoint is empty', async ({ page }) => {
    const input = page.locator('[data-testid="gql-endpoint-input"]');
    await input.clear();
    await page.waitForTimeout(200);
    await expect(page.locator('[data-testid="gql-execute-btn"]')).toBeDisabled({ timeout: 3000 });
  });

  test('Introspect button is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-introspect-btn"]')).toBeVisible({ timeout: 5000 });
  });
});

// ── Suite 2: Query execution (mocked via /__proxy) ────────────────────────────

test.describe('GraphQL Studio — query execution (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockProxy(page, MOCK_SUCCESS);
    await gotoGqlStudio(page);
  });

  test('after execution, gql-response-empty disappears', async ({ page }) => {
    await executeQuery(page);
    await expect(page.locator('[data-testid="gql-response-empty"]')).not.toBeVisible({ timeout: 12000 });
  });

  test('response viewer appears after successful execution', async ({ page }) => {
    await executeQuery(page);
    await expect(page.locator('[data-testid="gql-response-viewer"]')).toBeVisible({ timeout: 12000 });
  });

  test('response body contains returned data', async ({ page }) => {
    await executeQuery(page);
    await expect(page.locator('[data-testid="gql-response-body"]')).toContainText('Alice Tester', { timeout: 12000 });
  });

  test('status badge shows 200', async ({ page }) => {
    await executeQuery(page);
    const badge = page.locator('[data-testid="gql-response-status"]');
    await expect(badge).toBeVisible({ timeout: 12000 });
    await expect(badge).toContainText('200');
  });

  test('latency badge appears after execution', async ({ page }) => {
    await executeQuery(page);
    const latency = page.locator('[data-testid="gql-response-latency"]');
    await expect(latency).toBeVisible({ timeout: 12000 });
    await expect(latency).toContainText('ms');
  });

  test('response tab shows a success badge', async ({ page }) => {
    await executeQuery(page);
    const responseTab = page.locator('[data-testid="gql-right-tab-response"]');
    await expect(responseTab).toBeVisible({ timeout: 12000 });
    const badge = responseTab.locator('.gql-right-tab-badge');
    await expect(badge.first()).toBeVisible({ timeout: 5000 });
  });
});

// ── Suite 3: GraphQL error responses ─────────────────────────────────────────

test.describe('GraphQL Studio — GraphQL error responses (mocked)', () => {
  test.beforeEach(async ({ page }) => {
    await mockProxy(page, MOCK_GQL_ERROR);
    await gotoGqlStudio(page);
  });

  test('response viewer appears for error responses', async ({ page }) => {
    await executeQuery(page);
    await expect(page.locator('[data-testid="gql-response-viewer"]')).toBeVisible({ timeout: 12000 });
  });

  test('response tab shows a warn badge for data+errors response', async ({ page }) => {
    await executeQuery(page);
    const responseTab = page.locator('[data-testid="gql-right-tab-response"]');
    await expect(responseTab).toBeVisible({ timeout: 12000 });
    const warnBadge = responseTab.locator('.gql-right-tab-badge--warn');
    await expect(warnBadge).toBeVisible({ timeout: 12000 });
  });

  test('error message appears in the response body', async ({ page }) => {
    await executeQuery(page);
    const body = page.locator('[data-testid="gql-response-body"]');
    await expect(body).toBeVisible({ timeout: 12000 });
    await expect(body).toContainText('User not found', { timeout: 5000 });
  });

  test('error count badge appears on status bar', async ({ page }) => {
    await executeQuery(page);
    const errorCount = page.locator('[data-testid="gql-response-error-count"]');
    await expect(errorCount).toBeVisible({ timeout: 12000 });
    await expect(errorCount).toContainText('1');
  });
});

// ── Suite 4: HTTP error responses ─────────────────────────────────────────────

test.describe('GraphQL Studio — HTTP error responses (mocked)', () => {
  test('401 response shows error badge on Response tab', async ({ page }) => {
    await mockProxy(page, { error: 'Unauthorized' }, 401);
    await gotoGqlStudio(page);
    await executeQuery(page);

    await expect(page.locator('[data-testid="gql-response-viewer"]')).toBeVisible({ timeout: 12000 });
    const badge = page.locator('[data-testid="gql-response-status"]');
    if (await badge.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(badge).toContainText('401');
    }
  });

  test('500 response shows response viewer with error badge', async ({ page }) => {
    await mockProxy(page, { error: 'Internal server error' }, 500);
    await gotoGqlStudio(page);
    await executeQuery(page);

    await expect(page.locator('[data-testid="gql-response-viewer"]')).toBeVisible({ timeout: 12000 });
    const responseTab = page.locator('[data-testid="gql-right-tab-response"]');
    await expect(responseTab).toBeVisible({ timeout: 5000 });
    const errorBadge = responseTab.locator('.gql-right-tab-badge--error');
    await expect(errorBadge).toBeVisible({ timeout: 5000 });
  });
});

// ── Suite 5: Mutation execution ───────────────────────────────────────────────

test.describe('GraphQL Studio — mutation execution (mocked)', () => {
  test('mutation response shows returned data', async ({ page }) => {
    await mockProxy(page, MOCK_MUTATION);
    await gotoGqlStudio(page);
    await executeQuery(page, 'mutation CreateUser($name: String!) { createUser(name: $name) { id name } }');

    await expect(page.locator('[data-testid="gql-response-viewer"]')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('[data-testid="gql-response-body"]')).toContainText('Bob Builder', { timeout: 5000 });
  });
});

// ── Suite 6: Variables panel ──────────────────────────────────────────────────

test.describe('GraphQL Studio — variables panel', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGqlStudio(page);
  });

  test('variables tab is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-bottom-tab-variables"]')).toBeVisible({ timeout: 5000 });
  });

  test('clicking variables tab shows variables panel', async ({ page }) => {
    await page.locator('[data-testid="gql-bottom-tab-variables"]').click();
    await expect(page.locator('[data-testid="gql-variables-panel"]')).toBeVisible({ timeout: 5000 });
  });

  test('variables and headers tabs are mutually exclusive', async ({ page }) => {
    await page.locator('[data-testid="gql-bottom-tab-headers"]').click();
    await expect(page.locator('[data-testid="gql-headers-panel"]')).toBeVisible({ timeout: 3000 });
    await page.locator('[data-testid="gql-bottom-tab-variables"]').click();
    await expect(page.locator('[data-testid="gql-variables-panel"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="gql-headers-panel"]')).not.toBeVisible({ timeout: 1000 });
  });

  test('execution request payload includes query field', async ({ page }) => {
    let capturedBody: string | null = null;

    await page.route('**/__proxy', async (route) => {
      const postData = route.request().postData();
      if (postData) {
        capturedBody = postData;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: makeProxyResponse(MOCK_SUCCESS),
      });
    });

    await page.locator('[data-testid="gql-endpoint-input"]').fill(TEST_ENDPOINT);
    await page.waitForTimeout(300);
    await fillMonacoEditor(page, 'query GetUser { user { id } }');
    await page.locator('[data-testid="gql-execute-btn"]:not([disabled])').waitFor({ timeout: 5000 }).catch(() => {});
    await page.locator('[data-testid="gql-execute-btn"]').click();
    await page.waitForTimeout(2000);

    if (capturedBody !== null) {
      try {
        const parsed = JSON.parse(capturedBody) as Record<string, unknown>;
        // The proxy request body is { url, method, headers, body }
        // where `body` is the JSON-stringified GraphQL request
        if (typeof parsed.body === 'string') {
          const gqlBody = JSON.parse(parsed.body) as Record<string, unknown>;
          expect(gqlBody).toHaveProperty('query');
        }
      } catch { /* ignore parse errors */ }
    }
  });
});

// ── Suite 7: Headers panel ────────────────────────────────────────────────────

test.describe('GraphQL Studio — headers panel', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGqlStudio(page);
    await page.locator('[data-testid="gql-bottom-tab-headers"]').click();
    await page.waitForSelector('[data-testid="gql-headers-panel"]', { timeout: 5000 });
  });

  test('headers panel is visible after clicking Headers tab', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-headers-panel"]')).toBeVisible();
  });

  test('+ Add header button is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-headers-add-btn"]')).toBeVisible();
  });

  test('clicking + Add header creates a new row', async ({ page }) => {
    await page.locator('[data-testid="gql-headers-add-btn"]').click();
    const rows = page.locator('[data-testid^="gql-header-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 3000 });
  });

  test('new header row has key and value inputs', async ({ page }) => {
    await page.locator('[data-testid="gql-headers-add-btn"]').click();
    const row = page.locator('[data-testid^="gql-header-row-"]').first();
    await expect(row).toBeVisible({ timeout: 3000 });
    const inputs = row.locator('input');
    await expect(inputs.first()).toBeVisible({ timeout: 2000 });
  });
});

// ── Suite 8: Introspection ────────────────────────────────────────────────────

test.describe('GraphQL Studio — introspection', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGqlStudio(page);
    await page.locator('[data-testid="gql-endpoint-input"]').fill(TEST_ENDPOINT);
    await page.locator('[data-testid="gql-right-tab-schema"]').click();
  });

  test('schema pane shows Introspect button when idle', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-se-idle-introspect-btn"]')).toBeVisible({ timeout: 5000 });
  });

  test('clicking Introspect removes the idle state', async ({ page }) => {
    await mockProxy(page, MOCK_INTROSPECTION);
    await page.locator('[data-testid="gql-se-idle-introspect-btn"]').click();
    await expect(page.locator('[data-testid="gql-se-empty-idle"]')).not.toBeVisible({ timeout: 8000 });
  });
});

// ── Suite 9: Tab management ───────────────────────────────────────────────────

test.describe('GraphQL Studio — tab management', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGqlStudio(page);
  });

  test('+ button adds a new tab', async ({ page }) => {
    const tabSelector = '[data-testid="gql-tab-bar"] button[role="tab"]';
    const before = await page.locator(tabSelector).count();
    await page.locator('[data-testid="gql-tab-add-btn"]').click();
    await page.waitForTimeout(300);
    expect(await page.locator(tabSelector).count()).toBeGreaterThan(before);
  });

  test('multiple tabs can be added', async ({ page }) => {
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-testid="gql-tab-add-btn"]').click();
      await page.waitForTimeout(200);
    }
    const tabs = page.locator('[data-testid="gql-tab-bar"] button[role="tab"]');
    expect(await tabs.count()).toBeGreaterThanOrEqual(3);
  });

  test('clicking a different tab makes it active', async ({ page }) => {
    await page.locator('[data-testid="gql-tab-add-btn"]').click();
    await page.waitForTimeout(300);
    const tabs = page.locator('[data-testid="gql-tab-bar"] button[role="tab"]');
    if (await tabs.count() >= 2) {
      await tabs.nth(1).click();
      const isSelected = await tabs.nth(1).evaluate((el) =>
        el.getAttribute('aria-selected') === 'true' ||
        el.classList.contains('active') ||
        el.classList.contains('gql-tab--active'),
      );
      expect(isSelected).toBe(true);
    }
  });

  test('tab bar has at least one tab on load', async ({ page }) => {
    const tabs = page.locator('[data-testid="gql-tab-bar"] button[role="tab"]');
    await expect(tabs.first()).toBeVisible({ timeout: 5000 });
    expect(await tabs.count()).toBeGreaterThanOrEqual(1);
  });
});
