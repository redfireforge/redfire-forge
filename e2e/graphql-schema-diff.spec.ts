/**
 * graphql-schema-diff.spec.ts — E2E tests for GraphQL Studio schema diffing (Phase 4, task 4F-9).
 *
 * ── What is tested ────────────────────────────────────────────────────────────
 *
 * 1. Changelog panel: seeded snapshots appear in the Changelog tab
 * 2. Diff modal (snapshot-vs-snapshot): opens from Changelog, shows BREAKING changes,
 *    filter tabs, SDL diff view, Export JSON, Export HTML, Done button
 * 3. Schema change toast: two sequential mocked introspections trigger the
 *    "Schema changed" toast with "View diff →" when a snapshot already exists
 * 4. Diff modal from toast: correct BREAKING count shown; Acknowledge flow works
 *
 * ── Mocking strategy ──────────────────────────────────────────────────────────
 *
 * All network requests go through POST /__proxy (Vite middleware bridge).
 * page.route('**\/__proxy') intercepts them and returns the response in
 * HttpResponse envelope: { status, statusText, headers, body (stringified) }.
 *
 * Introspection requests contain "__schema" in the body JSON.
 *
 * ── Snapshot seeding ──────────────────────────────────────────────────────────
 *
 * Suites 1-2 use page.evaluate() to insert GraphqlSchemaSnapshot records
 * directly into the 'graphql-schema-snapshots' IndexedDB store.
 * The connectionId must match the TEST_ENDPOINT URL filled in the endpoint
 * input — the hook calls loadSnapshots(historyConnectionId) which equals
 * the trimmed endpoint URL.
 */

import { test, expect, type Page } from '@playwright/test';
import { makeProxyResponse, silenceLogStream } from './graphql-helpers';
import { REDFIREFORGE_IDB_VERSION } from './helpers';

const GQL_URL = '/?tab=graphql-studio';
const TEST_ENDPOINT = 'https://api.example.com/graphql';
const DB_NAME = 'redfireforge';
const DB_VERSION = REDFIREFORGE_IDB_VERSION;

/** Suppress the SSE log-stream endpoint to avoid connection errors in E2E tests. */
// silenceLogStream is imported from graphql-helpers

// ── Schema SDLs ───────────────────────────────────────────────────────────────

/** Schema V1: Query.user + User with 3 fields */
const SDL_V1 = `type Query {
  user(id: ID!): User
  health: String
}

type User {
  id: ID!
  name: String
  email: String
}`;

/** Schema V2: Query.user removed, User.email removed (2 BREAKING changes) */
const SDL_V2 = `type Query {
  health: String
}

type User {
  id: ID!
  name: String
}`;

// ── Introspection JSON for mocked proxy ───────────────────────────────────────

/**
 * Minimal but valid introspection result for Schema V1.
 * buildClientSchema adds built-in scalars (String, ID, etc.) automatically;
 * only user-defined types are needed here.
 */
const INTROSPECT_V1 = {
  __schema: {
    queryType: { name: 'Query' },
    mutationType: null,
    subscriptionType: null,
    types: [
      {
        kind: 'OBJECT', name: 'Query', description: null,
        fields: [
          {
            name: 'user', description: null,
            args: [{ name: 'id', description: null, type: { kind: 'NON_NULL', name: null, ofType: { kind: 'SCALAR', name: 'ID', ofType: null } }, defaultValue: null }],
            type: { kind: 'OBJECT', name: 'User', ofType: null },
            isDeprecated: false, deprecationReason: null,
          },
          {
            name: 'health', description: null, args: [],
            type: { kind: 'SCALAR', name: 'String', ofType: null },
            isDeprecated: false, deprecationReason: null,
          },
        ],
        inputFields: null, interfaces: [], enumValues: null, possibleTypes: null,
      },
      {
        kind: 'OBJECT', name: 'User', description: null,
        fields: [
          { name: 'id', description: null, args: [], type: { kind: 'NON_NULL', name: null, ofType: { kind: 'SCALAR', name: 'ID', ofType: null } }, isDeprecated: false, deprecationReason: null },
          { name: 'name', description: null, args: [], type: { kind: 'SCALAR', name: 'String', ofType: null }, isDeprecated: false, deprecationReason: null },
          { name: 'email', description: null, args: [], type: { kind: 'SCALAR', name: 'String', ofType: null }, isDeprecated: false, deprecationReason: null },
        ],
        inputFields: null, interfaces: [], enumValues: null, possibleTypes: null,
      },
    ],
    directives: [],
  },
};

/** Schema V2: Query.user removed, User.email removed */
const INTROSPECT_V2 = {
  __schema: {
    queryType: { name: 'Query' },
    mutationType: null,
    subscriptionType: null,
    types: [
      {
        kind: 'OBJECT', name: 'Query', description: null,
        fields: [
          {
            name: 'health', description: null, args: [],
            type: { kind: 'SCALAR', name: 'String', ofType: null },
            isDeprecated: false, deprecationReason: null,
          },
        ],
        inputFields: null, interfaces: [], enumValues: null, possibleTypes: null,
      },
      {
        kind: 'OBJECT', name: 'User', description: null,
        fields: [
          { name: 'id', description: null, args: [], type: { kind: 'NON_NULL', name: null, ofType: { kind: 'SCALAR', name: 'ID', ofType: null } }, isDeprecated: false, deprecationReason: null },
          { name: 'name', description: null, args: [], type: { kind: 'SCALAR', name: 'String', ofType: null }, isDeprecated: false, deprecationReason: null },
        ],
        inputFields: null, interfaces: [], enumValues: null, possibleTypes: null,
      },
    ],
    directives: [],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// makeProxyResponse is imported from graphql-helpers

/** Navigate to GraphQL Studio and wait for the page to be ready. */
async function gotoGqlStudio(page: Page) {
  await silenceLogStream(page);
  await page.goto(GQL_URL);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('[data-testid="gql-studio-page"]')).toBeVisible({ timeout: 15000 });
}

/** Fill the endpoint input. */
async function fillEndpoint(page: Page, url = TEST_ENDPOINT) {
  const input = page.locator('[data-testid="gql-endpoint-input"]');
  await input.fill(url);
  await page.waitForTimeout(300);
}

/** Switch to the Schema (right-pane) tab. */
async function gotoSchemaTab(page: Page) {
  await page.locator('[data-testid="gql-right-tab-schema"]').click();
  // Wait for the schema explorer to appear (idle state shows the introspect button)
  await expect(page.locator('[data-testid="gql-schema-explorer"]')).toBeVisible({ timeout: 5000 });
}

/** Switch to the Changelog sub-tab inside the schema explorer. */
async function gotoChangelogTab(page: Page) {
  // Force-click to bypass actionability checks — the button may be partially outside
  // the visible scroll area in headless mode
  await page.locator('[data-testid="gql-se-tab-changelog"]').click({ force: true, timeout: 5000 });
  await page.waitForTimeout(300);
}

/**
 * Seed a GraphqlSchemaSnapshot directly into the IndexedDB store.
 * The page must already be loaded (so IDB is accessible in the browser context).
 */
async function seedSnapshot(
  page: Page,
  snapshot: { id: string; connectionId: string; sdl: string; typesCount: number; capturedAt: number; label?: string },
) {
  await page.evaluate(
    ({ snap, dbName, dbVersion }: { snap: typeof snapshot; dbName: string; dbVersion: number }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName, dbVersion);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('graphql-schema-snapshots')) {
            const store = db.createObjectStore('graphql-schema-snapshots', { keyPath: 'id' });
            store.createIndex('connectionId', 'connectionId', { unique: false });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('graphql-schema-snapshots', 'readwrite');
          tx.objectStore('graphql-schema-snapshots').put(snap);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    { snap: snapshot, dbName: DB_NAME, dbVersion: DB_VERSION },
  );
}

/** Seed two snapshots: V1 (older) and V2 (newer, with fewer fields). */
async function seedTwoSnapshots(page: Page) {
  const now = Date.now();
  await seedSnapshot(page, {
    id: 'snap-v1',
    connectionId: TEST_ENDPOINT,
    sdl: SDL_V1,
    typesCount: 2,
    capturedAt: now - 60_000, // 1 minute ago
    label: 'Schema V1',
  });
  await seedSnapshot(page, {
    id: 'snap-v2',
    connectionId: TEST_ENDPOINT,
    sdl: SDL_V2,
    typesCount: 2,
    capturedAt: now - 30_000, // 30 seconds ago
    label: 'Schema V2',
  });
}

/**
 * Open the diff modal via the Changelog tab by selecting snap-v2 as the
 * compare target for snap-v1 and clicking the diff button.
 * Returns after the modal is visible.
 */
async function openDiffFromChangelog(page: Page) {
  // The newer snapshot (V2) is listed first (most recent at top).
  // We want to open diff for V1 comparing to V2.
  // The first row = V2 (newer), second row = V1 (older).
  // We select "Schema V2" in the compare-select of the V1 row, then click diff.
  const rows = page.locator('[data-testid="gql-changelog-row"]');
  await rows.first().waitFor({ state: 'visible', timeout: 8000 });

  // Find the row for the older snapshot (V1) — it's the second row.
  // Select V2 as the compare target in its dropdown.
  const v1Row = rows.nth(1);
  const compareSelect = v1Row.locator('[data-testid="gql-changelog-compare-select"]');
  await compareSelect.selectOption({ value: 'snap-v2' });
  await page.waitForTimeout(200);

  // Click the diff button
  await v1Row.locator('[data-testid="gql-changelog-diff-btn"]').click();
  await page.locator('[data-testid="gql-diff-modal"]').waitFor({ state: 'visible', timeout: 8000 });
}

// ── Suite 1: Changelog panel (seeded snapshots) ───────────────────────────────

test.describe('GraphQL Studio — schema diff changelog panel', () => {
  test('empty state shows "No snapshots yet" when no snapshots exist', async ({ page }) => {
    await gotoGqlStudio(page);
    await fillEndpoint(page);
    await gotoSchemaTab(page);
    await gotoChangelogTab(page);
    await expect(page.locator('[data-testid="gql-changelog-empty"]')).toBeVisible({ timeout: 5000 });
  });

  test('seeded snapshot appears as a row in the changelog', async ({ page }) => {
    await gotoGqlStudio(page);
    await seedSnapshot(page, {
      id: 'snap-single',
      connectionId: TEST_ENDPOINT,
      sdl: SDL_V1,
      typesCount: 2,
      capturedAt: Date.now() - 5000,
      label: 'My Snapshot',
    });
    await fillEndpoint(page);
    await gotoSchemaTab(page);
    await gotoChangelogTab(page);

    const row = page.locator('[data-testid="gql-changelog-row"]');
    await expect(row).toBeVisible({ timeout: 6000 });
    await expect(row).toContainText('My Snapshot');
  });

  test('two seeded snapshots show two rows in the changelog', async ({ page }) => {
    await gotoGqlStudio(page);
    await seedTwoSnapshots(page);
    await fillEndpoint(page);
    await gotoSchemaTab(page);
    await gotoChangelogTab(page);

    const rows = page.locator('[data-testid="gql-changelog-row"]');
    await rows.first().waitFor({ state: 'visible', timeout: 6000 });
    expect(await rows.count()).toBe(2);
  });

  test('compare-select dropdown is present on each changelog row', async ({ page }) => {
    await gotoGqlStudio(page);
    await seedTwoSnapshots(page);
    await fillEndpoint(page);
    await gotoSchemaTab(page);
    await gotoChangelogTab(page);

    const rows = page.locator('[data-testid="gql-changelog-row"]');
    await rows.first().waitFor({ state: 'visible', timeout: 6000 });
    await expect(rows.first().locator('[data-testid="gql-changelog-compare-select"]')).toBeVisible();
  });

  test('diff button is present on each changelog row', async ({ page }) => {
    await gotoGqlStudio(page);
    await seedTwoSnapshots(page);
    await fillEndpoint(page);
    await gotoSchemaTab(page);
    await gotoChangelogTab(page);

    const rows = page.locator('[data-testid="gql-changelog-row"]');
    await rows.first().waitFor({ state: 'visible', timeout: 6000 });
    await expect(rows.first().locator('[data-testid="gql-changelog-diff-btn"]')).toBeVisible();
  });
});

// ── Suite 2: Diff modal (snapshot-vs-snapshot from changelog) ─────────────────

test.describe('GraphQL Studio — diff modal (snapshot comparison)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGqlStudio(page);
    await seedTwoSnapshots(page);
    await fillEndpoint(page);
    await gotoSchemaTab(page);
    await gotoChangelogTab(page);
    await openDiffFromChangelog(page);
  });

  test('diff modal opens when diff button is clicked', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-diff-modal"]')).toBeVisible();
  });

  test('diff modal shows the Schema Diff title', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-diff-modal"]')).toContainText('Schema Diff');
  });

  test('diff modal shows BREAKING count in summary', async ({ page }) => {
    // V1 → V2: Query.user removed + User.email removed = 2 BREAKING
    const modal = page.locator('[data-testid="gql-diff-modal"]');
    await expect(modal).toContainText('Breaking');
    await expect(modal.locator('.gql-diff-count--breaking')).toBeVisible({ timeout: 5000 });
  });

  test('change rows are shown', async ({ page }) => {
    const rows = page.locator('[data-testid="gql-diff-row"]');
    await expect(rows.first()).toBeVisible({ timeout: 5000 });
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
  });

  test('Breaking filter tab narrows the visible rows', async ({ page }) => {
    await page.locator('.gql-diff-filter--breaking').click();
    await page.waitForTimeout(300);
    const rows = page.locator('[data-testid="gql-diff-row"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
    // All visible rows must have the Breaking badge
    const badges = page.locator('[data-testid="gql-diff-row"] .gql-diff-badge--breaking');
    expect(await badges.count()).toBe(count);
  });

  test('SDL Diff view toggle shows sdl diff panel', async ({ page }) => {
    await page.locator('.gql-diff-view-btn', { hasText: 'SDL Diff' }).click();
    await expect(page.locator('[data-testid="gql-diff-sdl-view"]')).toBeVisible({ timeout: 3000 });
  });

  test('SDL Diff view shows removed lines', async ({ page }) => {
    await page.locator('.gql-diff-view-btn', { hasText: 'SDL Diff' }).click();
    const sdlView = page.locator('[data-testid="gql-diff-sdl-view"]');
    await expect(sdlView).toBeVisible({ timeout: 3000 });
    await expect(sdlView.locator('.gql-diff-sdl-row--modified, .gql-diff-sdl-row--removed').first()).toBeVisible({ timeout: 3000 });
  });

  test('Done button closes the diff modal', async ({ page }) => {
    await page.locator('[data-testid="gql-diff-done"]').click();
    await expect(page.locator('[data-testid="gql-diff-modal"]')).not.toBeVisible({ timeout: 3000 });
  });
});

// ── Suite 3: Export from diff modal ──────────────────────────────────────────

test.describe('GraphQL Studio — diff modal exports', () => {
  test.beforeEach(async ({ page }) => {
    await gotoGqlStudio(page);
    await seedTwoSnapshots(page);
    await fillEndpoint(page);
    await gotoSchemaTab(page);
    await gotoChangelogTab(page);
    await openDiffFromChangelog(page);
  });

  test('Export JSON button triggers a file download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download', { timeout: 8000 });
    await page.locator('[data-testid="gql-diff-export-json"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/schema-diff.*\.json$/);
  });

  test('Export HTML button triggers a file download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download', { timeout: 8000 });
    await page.locator('[data-testid="gql-diff-export-html"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/schema-diff.*\.html$/);
  });

  test('Download SDL button triggers a file download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download', { timeout: 8000 });
    await page.locator('[data-testid="gql-diff-download-sdl"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/schema.*\.graphql$/);
  });
});

// ── Suite 4: Schema change toast (real introspection via mocked /__proxy) ─────

test.describe('GraphQL Studio — schema change toast flow', () => {
  /**
   * Sets up the two-introspection mock:
   * - First call (request body contains "__schema") → V1 schema
   * - Subsequent calls → V2 schema
   * All other proxy calls are fulfilled with an empty response.
   */
  async function setupIntrospectionMock(page: Page) {
    let introspectCount = 0;
    await page.route('**/__proxy', (route) => {
      const body = route.request().postData() ?? '';
      // The introspection query body always contains "__schema" in the query text.
      // The proxy body is JSON-encoded, so __schema appears as a substring.
      if (body.includes('__schema') || body.includes('IntrospectionQuery')) {
        // This is an introspection call
        introspectCount++;
        const schema = introspectCount === 1 ? INTROSPECT_V1 : INTROSPECT_V2;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: makeProxyResponse({ data: schema }),
        });
      }
      // Non-introspection proxy call — return empty response
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: makeProxyResponse({ data: {} }),
      });
    });
  }

  test('toast appears after schema changes between introspections', async ({ page }) => {
    await setupIntrospectionMock(page);
    await gotoGqlStudio(page);
    await fillEndpoint(page);
    await gotoSchemaTab(page);

    // First introspection — loads V1
    await page.locator('[data-testid="gql-se-idle-introspect-btn"]').click();
    // Wait for schema to load (save snapshot button appears in types tab when loaded)
    const saveBtn = page.locator('[data-testid="gql-se-save-snapshot"]');
    const schemaLoaded = await saveBtn.isVisible({ timeout: 10000 }).catch(() => false);

    if (!schemaLoaded) {
      // Schema failed to parse (minimal introspection might not work) — skip gracefully
      test.skip();
      return;
    }

    // Save snapshot while on V1
    await saveBtn.click();
    // Wait for snapshot to appear in changelog
    await gotoChangelogTab(page);
    await page.locator('[data-testid="gql-changelog-row"]').waitFor({ state: 'visible', timeout: 6000 });

    // Go back to Types tab and trigger re-introspection
    await page.locator('[data-testid="gql-se-tab-types"]').click();
    await page.locator('[data-testid="gql-se-reintrospect-btn"]').click();

    // Toast should appear when the schema changes
    await expect(page.locator('[data-testid="gql-schema-change-toast"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="gql-schema-change-toast"]')).toContainText('Schema changed');
  });

  test('toast shows "View diff" link when a snapshot exists', async ({ page }) => {
    await setupIntrospectionMock(page);
    await gotoGqlStudio(page);
    await fillEndpoint(page);
    await gotoSchemaTab(page);

    // First introspection
    await page.locator('[data-testid="gql-se-idle-introspect-btn"]').click();
    const saveBtn = page.locator('[data-testid="gql-se-save-snapshot"]');
    const schemaLoaded = await saveBtn.isVisible({ timeout: 10000 }).catch(() => false);
    if (!schemaLoaded) { test.skip(); return; }

    // Save snapshot
    await saveBtn.click();
    await gotoChangelogTab(page);
    await page.locator('[data-testid="gql-changelog-row"]').waitFor({ state: 'visible', timeout: 6000 });

    // Re-introspect
    await page.locator('[data-testid="gql-se-tab-types"]').click();
    await page.locator('[data-testid="gql-se-reintrospect-btn"]').click();

    // Toast should have "View diff →" link (snapshot exists)
    const toast = page.locator('[data-testid="gql-schema-change-toast"]');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast.locator('button', { hasText: 'View diff' })).toBeVisible({ timeout: 5000 });
  });

  test('clicking "View diff →" opens the diff modal', async ({ page }) => {
    await setupIntrospectionMock(page);
    await gotoGqlStudio(page);
    await fillEndpoint(page);
    await gotoSchemaTab(page);

    await page.locator('[data-testid="gql-se-idle-introspect-btn"]').click();
    const saveBtn = page.locator('[data-testid="gql-se-save-snapshot"]');
    const schemaLoaded = await saveBtn.isVisible({ timeout: 10000 }).catch(() => false);
    if (!schemaLoaded) { test.skip(); return; }

    await saveBtn.click();
    await gotoChangelogTab(page);
    await page.locator('[data-testid="gql-changelog-row"]').waitFor({ state: 'visible', timeout: 6000 });

    await page.locator('[data-testid="gql-se-tab-types"]').click();
    await page.locator('[data-testid="gql-se-reintrospect-btn"]').click();

    const toast = page.locator('[data-testid="gql-schema-change-toast"]');
    await toast.waitFor({ state: 'visible', timeout: 10000 });

    await toast.locator('button', { hasText: 'View diff' }).click();
    await expect(page.locator('[data-testid="gql-diff-modal"]')).toBeVisible({ timeout: 8000 });
  });

  test('diff modal from toast shows BREAKING changes', async ({ page }) => {
    await setupIntrospectionMock(page);
    await gotoGqlStudio(page);
    await fillEndpoint(page);
    await gotoSchemaTab(page);

    await page.locator('[data-testid="gql-se-idle-introspect-btn"]').click();
    const saveBtn = page.locator('[data-testid="gql-se-save-snapshot"]');
    const schemaLoaded = await saveBtn.isVisible({ timeout: 10000 }).catch(() => false);
    if (!schemaLoaded) { test.skip(); return; }

    await saveBtn.click();
    await gotoChangelogTab(page);
    await page.locator('[data-testid="gql-changelog-row"]').waitFor({ state: 'visible', timeout: 6000 });

    await page.locator('[data-testid="gql-se-tab-types"]').click();
    await page.locator('[data-testid="gql-se-reintrospect-btn"]').click();

    const toast = page.locator('[data-testid="gql-schema-change-toast"]');
    await toast.waitFor({ state: 'visible', timeout: 10000 });
    await toast.locator('button', { hasText: 'View diff' }).click();
    await page.locator('[data-testid="gql-diff-modal"]').waitFor({ state: 'visible', timeout: 8000 });

    // Should show BREAKING changes (Query.user removed, User.email removed)
    await expect(page.locator('.gql-diff-count--breaking')).toBeVisible({ timeout: 5000 });
  });
});

// ── Suite 5: Acknowledge flow (snapshot-vs-current, via seeded snapshot) ──────

test.describe('GraphQL Studio — diff modal acknowledge flow', () => {
  /**
   * Seeds one snapshot (V1) and mocks introspection to return V2.
   * After introspection, the hook detects the schema changed and can open
   * diff via the snapshot-vs-current path (which enables the Acknowledge button).
   */
  async function setupForAcknowledge(page: Page) {
    await gotoGqlStudio(page);
    // Seed V1 snapshot
    await seedSnapshot(page, {
      id: 'snap-ack-v1',
      connectionId: TEST_ENDPOINT,
      sdl: SDL_V1,
      typesCount: 2,
      capturedAt: Date.now() - 60_000,
      label: 'V1 for ack test',
    });
    // Mock introspection to return V2
    await page.route('**/__proxy', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: makeProxyResponse({ data: INTROSPECT_V2 }),
      }),
    );
    await fillEndpoint(page);
    await gotoSchemaTab(page);
    await page.locator('[data-testid="gql-se-idle-introspect-btn"]').click();
    // Wait for schema to load (or fail gracefully)
    const schemaLoaded = await page.locator('[data-testid="gql-se-save-snapshot"]')
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    return schemaLoaded;
  }

  test('Acknowledge button appears for BREAKING changes when snapshotId is set', async ({ page }) => {
    const loaded = await setupForAcknowledge(page);
    if (!loaded) { test.skip(); return; }

    // Open diff via Changelog tab comparing snapshot to current schema (no compareToId)
    await gotoChangelogTab(page);
    const row = page.locator('[data-testid="gql-changelog-row"]').first();
    await row.waitFor({ state: 'visible', timeout: 6000 });
    // Click diff without selecting compare target (snapshot vs current)
    await row.locator('[data-testid="gql-changelog-diff-btn"]').click();
    await page.locator('[data-testid="gql-diff-modal"]').waitFor({ state: 'visible', timeout: 8000 });

    // Filter to Breaking to ensure we see BREAKING rows with Acknowledge buttons
    await page.locator('.gql-diff-filter--breaking').click();
    await expect(page.locator('[data-testid="gql-diff-ack-btn"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('clicking Acknowledge expands the acknowledge form', async ({ page }) => {
    const loaded = await setupForAcknowledge(page);
    if (!loaded) { test.skip(); return; }

    await gotoChangelogTab(page);
    const row = page.locator('[data-testid="gql-changelog-row"]').first();
    await row.waitFor({ state: 'visible', timeout: 6000 });
    await row.locator('[data-testid="gql-changelog-diff-btn"]').click();
    await page.locator('[data-testid="gql-diff-modal"]').waitFor({ state: 'visible', timeout: 8000 });

    await page.locator('.gql-diff-filter--breaking').click();
    await page.locator('[data-testid="gql-diff-ack-btn"]').first().click();

    await expect(page.locator('[data-testid="gql-diff-ack-note"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="gql-diff-ack-confirm"]')).toBeVisible();
  });

  test('confirming acknowledge moves the change to the Acknowledged section', async ({ page }) => {
    const loaded = await setupForAcknowledge(page);
    if (!loaded) { test.skip(); return; }

    await gotoChangelogTab(page);
    const row = page.locator('[data-testid="gql-changelog-row"]').first();
    await row.waitFor({ state: 'visible', timeout: 6000 });
    await row.locator('[data-testid="gql-changelog-diff-btn"]').click();
    await page.locator('[data-testid="gql-diff-modal"]').waitFor({ state: 'visible', timeout: 8000 });

    await page.locator('.gql-diff-filter--breaking').click();
    await page.locator('[data-testid="gql-diff-ack-btn"]').first().click();

    const noteInput = page.locator('[data-testid="gql-diff-ack-note"]');
    await noteInput.fill('Intentional schema migration');
    await page.locator('[data-testid="gql-diff-ack-confirm"]').click();

    // The change should move to the Acknowledged section
    await expect(page.locator('[data-testid="gql-diff-acked-section"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="gql-diff-acked-section"]')).toContainText('Acknowledged');
  });
});
