/**
 * graphql-multi-tab.spec.ts — Phase 6B-4 E2E: per-tab endpoint, schema, and response isolation.
 *
 * No Demo Hub / lesson infrastructure — tests GraphQL Studio directly.
 * No Docker required — dual endpoints are mocked via /__proxy URL routing.
 *
 * Covers:
 *   - Connection bar reflects each tab's endpoint override on switch
 *   - Per-tab endpoint hostname badge on tabs with custom endpoints
 *   - Schema explorer restores the correct introspection per tab
 *   - Response pane cache preserves each tab's last execution result
 *   - Phase 6G-7: two endpoints → two batch groups in Advanced Settings
 */

import { test, expect } from '@playwright/test';
import { GQL } from '../src/shared/selectors';
import {
  fillEndpoint,
  gotoGqlStudioFresh,
  addGqlTab,
  clickGqlTabByIndex,
  getGqlTabIds,
  executeQueryOnTab,
  fillMonacoEditorForTab,
  setupDualEndpointGraphqlProxy,
  introspectSchemaFromPanel,
  gotoSchemaTab,
  seedGqlConnectionProfiles,
  loadGqlProfileOnActiveTab,
  setGqlPollingEnabled,
  isGqlPollingEnabled,
  seedGqlStudioCleanState,
  silenceLogStream,
  GQL_STUDIO_URL,
  enableGqlBatchInAdvancedSettings,
} from './graphql-helpers';

const STAGING_ENDPOINT = 'https://staging.example.com/graphql';
const PROD_ENDPOINT = 'https://prod.example.com/graphql';

const STAGING_QUERY = 'query { stagingHealth }';
const PROD_QUERY = 'query { prodHealth }';

const STAGING_QUERY_RESPONSE = { data: { stagingHealth: 'STAGING_MARKER' } };
const PROD_QUERY_RESPONSE = { data: { prodHealth: 'PROD_MARKER' } };

async function setupMultiTabStudio(page: import('@playwright/test').Page) {
  await setupDualEndpointGraphqlProxy(page, {
    stagingQueryData: STAGING_QUERY_RESPONSE,
    prodQueryData: PROD_QUERY_RESPONSE,
  });
  await gotoGqlStudioFresh(page);
}

/** Two tabs required so endpoint edits become per-tab overrides (badges + isolation). */
async function prepareTwoTabsWithEndpoints(page: import('@playwright/test').Page) {
  await addGqlTab(page);
  const tabIds = await getGqlTabIds(page);
  expect(tabIds.length).toBe(2);

  await clickGqlTabByIndex(page, 0);
  await fillEndpoint(page, STAGING_ENDPOINT);

  await clickGqlTabByIndex(page, 1);
  await fillEndpoint(page, PROD_ENDPOINT);

  return tabIds;
}

test.describe.configure({ mode: 'serial', timeout: 90_000 });

test.describe('GraphQL Studio — Phase 6 multi-tab isolation (6B-4)', () => {
  test('connection bar and endpoint badge follow active tab endpoint overrides', async ({ page }) => {
    await setupMultiTabStudio(page);
    const [tab1Id, tab2Id] = await prepareTwoTabsWithEndpoints(page);

    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(PROD_ENDPOINT);
    await expect(page.locator(GQL.tabLabel(tab2Id))).toContainText('prod.example.com');
    await expect(page.locator(GQL.tabLabel(tab1Id))).toContainText('staging.example.com');

    await clickGqlTabByIndex(page, 0);
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(STAGING_ENDPOINT);
    await expect(page.locator(GQL.tab(tab1Id))).toBeVisible();
  });

  test('schema explorer restores per-tab introspection on tab switch', async ({ page }) => {
    await setupMultiTabStudio(page);
    await prepareTwoTabsWithEndpoints(page);

    await clickGqlTabByIndex(page, 0);
    await introspectSchemaFromPanel(page);

    await clickGqlTabByIndex(page, 1);
    await introspectSchemaFromPanel(page);

    await gotoSchemaTab(page);
    await expect(page.locator('[data-testid="gql-se-type-ProdGadget"]')).toBeVisible({ timeout: 12_000 });
    await expect(page.locator('[data-testid="gql-se-type-StagingWidget"]')).toBeHidden();

    await clickGqlTabByIndex(page, 0);
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(STAGING_ENDPOINT);
    await gotoSchemaTab(page);
    await expect(page.locator('[data-testid="gql-se-type-StagingWidget"]')).toBeVisible({ timeout: 12_000 });
    await expect(page.locator('[data-testid="gql-se-type-ProdGadget"]')).toBeHidden();
  });

  test('response pane preserves each tab last execution after switching', async ({ page }) => {
    await setupMultiTabStudio(page);
    const [tab1Id, tab2Id] = await prepareTwoTabsWithEndpoints(page);

    await clickGqlTabByIndex(page, 0);
    await executeQueryOnTab(page, tab1Id, STAGING_ENDPOINT, STAGING_QUERY);
    await expect(page.locator('[data-testid="gql-response-body"]')).toContainText('STAGING_MARKER', { timeout: 12_000 });

    await clickGqlTabByIndex(page, 1);
    await executeQueryOnTab(page, tab2Id, PROD_ENDPOINT, PROD_QUERY);
    await expect(page.locator('[data-testid="gql-response-body"]')).toContainText('PROD_MARKER', { timeout: 12_000 });
    await expect(page.locator('[data-testid="gql-response-body"]')).not.toContainText('STAGING_MARKER');

    await clickGqlTabByIndex(page, 0);
    await expect(page.locator('[data-testid="gql-response-body"]')).toContainText('STAGING_MARKER', { timeout: 8_000 });
    await expect(page.locator('[data-testid="gql-response-body"]')).not.toContainText('PROD_MARKER');

    await clickGqlTabByIndex(page, 1);
    await expect(page.locator('[data-testid="gql-response-body"]')).toContainText('PROD_MARKER', { timeout: 8_000 });
    await expect(page.locator('[data-testid="gql-response-body"]')).not.toContainText('STAGING_MARKER');
  });

  test('reset endpoint control clears tab override and reverts tab title', async ({ page }) => {
    await setupMultiTabStudio(page);
    const [tab1Id] = await prepareTwoTabsWithEndpoints(page);

    await clickGqlTabByIndex(page, 0);
    await expect(page.locator(GQL.tabLabel(tab1Id))).toContainText('staging.example.com');

    await page.locator('[data-testid="gql-endpoint-reset-btn"]').click();
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue('');
    await expect(page.locator(GQL.tabLabel(tab1Id))).not.toContainText('staging.example.com');
  });
});

test.describe('GraphQL Studio — Phase 6E background execution (6E-6)', () => {
  test('tab 1 keeps loading then completes after switching away and back', async ({ page }) => {
    await setupDualEndpointGraphqlProxy(page, {
      stagingQueryData: STAGING_QUERY_RESPONSE,
      prodQueryData: PROD_QUERY_RESPONSE,
      stagingQueryDelayMs: 2500,
    });
    await gotoGqlStudioFresh(page);
    await addGqlTab(page);
    const tabIds = await getGqlTabIds(page);
    expect(tabIds.length).toBe(2);

    await clickGqlTabByIndex(page, 0);
    await fillEndpoint(page, STAGING_ENDPOINT);
    await clickGqlTabByIndex(page, 1);
    await fillEndpoint(page, PROD_ENDPOINT);

    await clickGqlTabByIndex(page, 0);
    const tab1Id = tabIds[0]!;
    await fillMonacoEditorForTab(page, tab1Id, STAGING_QUERY);
    await page.locator('[data-testid="gql-execute-btn"]').click();

    await clickGqlTabByIndex(page, 1);
    await expect(page.locator('[data-testid="gql-execute-btn"]')).toBeEnabled({ timeout: 5_000 });

    await clickGqlTabByIndex(page, 0);
    const cancelOrLoading = page.locator('[data-testid="gql-cancel-btn"], [data-testid="gql-response-loading"]');
    await expect(cancelOrLoading.first()).toBeVisible({ timeout: 5_000 });

    await expect(page.locator('[data-testid="gql-response-body"]')).toContainText('STAGING_MARKER', { timeout: 15_000 });
  });
});

test.describe('GraphQL Studio — Phase 6F profile-per-tab + polling (6F-13)', () => {
  const STAGING_PROFILE = {
    id: 'e2e-prof-staging',
    name: 'Staging',
    endpoint: STAGING_ENDPOINT,
    auth: { type: 'bearer', token: 'staging-token' },
    createdAt: 1,
  };
  const PROD_PROFILE = {
    id: 'e2e-prof-prod',
    name: 'Prod',
    endpoint: PROD_ENDPOINT,
    auth: { type: 'bearer', token: 'prod-token' },
    createdAt: 2,
  };

  async function setup6FStudio(page: import('@playwright/test').Page) {
    await setupDualEndpointGraphqlProxy(page, {
      stagingQueryData: STAGING_QUERY_RESPONSE,
      prodQueryData: PROD_QUERY_RESPONSE,
    });
    await seedGqlStudioCleanState(page);
    await seedGqlConnectionProfiles(page, [STAGING_PROFILE, PROD_PROFILE]);
    await silenceLogStream(page);
    await page.goto(GQL_STUDIO_URL, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="gql-studio-page"]')).toBeVisible({ timeout: 30_000 });
  }

  test('profile load per tab: titles and endpoints follow active tab', async ({ page }) => {
    await setup6FStudio(page);
    await addGqlTab(page);
    const [tab1Id, tab2Id] = await getGqlTabIds(page);
    expect(tab1Id).toBeTruthy();
    expect(tab2Id).toBeTruthy();

    await clickGqlTabByIndex(page, 0);
    await loadGqlProfileOnActiveTab(page, 'Staging');
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(STAGING_ENDPOINT);
    await expect(page.locator(GQL.tab(tab1Id))).toContainText('Staging');
    await expect(page.locator(GQL.tabLabel(tab1Id))).toContainText('staging.example.com');

    await clickGqlTabByIndex(page, 1);
    await loadGqlProfileOnActiveTab(page, 'Prod');
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(PROD_ENDPOINT);
    await expect(page.locator(GQL.tab(tab2Id))).toContainText('Prod');
    await expect(page.locator(GQL.tabLabel(tab2Id))).toContainText('prod.example.com');

    await clickGqlTabByIndex(page, 0);
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(STAGING_ENDPOINT);
    await expect(page.locator(GQL.tab(tab1Id))).toBeVisible();

    await clickGqlTabByIndex(page, 1);
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue(PROD_ENDPOINT);
  });

  test('manual endpoint edit clears profile link but keeps URL override', async ({ page }) => {
    await setup6FStudio(page);
    const [tab1Id] = await getGqlTabIds(page);

    await loadGqlProfileOnActiveTab(page, 'Staging');
    await expect(page.locator(GQL.tab(tab1Id))).toContainText('Staging');

    await fillEndpoint(page, 'https://custom.example.com/graphql');
    await expect(page.locator(GQL.tabLabel(tab1Id))).toContainText('custom.example.com');
    await expect(page.locator(GQL.tab(tab1Id))).not.toContainText('Staging');
    await expect(page.locator('[data-testid="gql-endpoint-input"]')).toHaveValue('https://custom.example.com/graphql');
  });

  test('per-tab polling toggle is isolated across tab switches', async ({ page }) => {
    await setup6FStudio(page);
    await addGqlTab(page);
    await clickGqlTabByIndex(page, 0);
    await fillEndpoint(page, STAGING_ENDPOINT);
    await clickGqlTabByIndex(page, 1);
    await fillEndpoint(page, PROD_ENDPOINT);

    await clickGqlTabByIndex(page, 0);
    await introspectSchemaFromPanel(page);
    await setGqlPollingEnabled(page, true);
    expect(await isGqlPollingEnabled(page)).toBe(true);

    await clickGqlTabByIndex(page, 1);
    expect(await isGqlPollingEnabled(page)).toBe(false);

    await clickGqlTabByIndex(page, 0);
    expect(await isGqlPollingEnabled(page)).toBe(true);
  });
});

test.describe('GraphQL Studio — Phase 6G batch endpoint groups (6G-7)', () => {
  test('two resolved endpoints produce two batch groups in Advanced Settings', async ({ page }) => {
    await setupMultiTabStudio(page);
    await prepareTwoTabsWithEndpoints(page);

    await enableGqlBatchInAdvancedSettings(page);

    const groupSelect = page.locator(GQL.ADV_BATCH_GROUP_SELECT);
    await expect(groupSelect).toBeVisible({ timeout: 10_000 });
    await expect(groupSelect.locator('option')).toHaveCount(2);

    const optionLabels = await groupSelect.locator('option').allTextContents();
    expect(optionLabels.some((l) => /staging\.example\.com/i.test(l))).toBe(true);
    expect(optionLabels.some((l) => /prod\.example\.com/i.test(l))).toBe(true);

    const optionMeta = await groupSelect.locator('option').evaluateAll((els) =>
      els.map((el) => ({ value: el.getAttribute('value') ?? '', text: el.textContent ?? '' })),
    );

    for (const host of ['staging.example.com', 'prod.example.com']) {
      const match = optionMeta.find((o) => o.text.includes(host));
      expect(match, `batch group for ${host}`).toBeDefined();
      await groupSelect.selectOption(match!.value);

      const groupCheckboxes = page.locator(
        `${GQL.ADV_BATCH_PANEL} [data-testid^="gql-adv-batch-tab-cb-"]`,
      );
      await expect(groupCheckboxes).toHaveCount(1);
      await expect(groupCheckboxes.first()).toHaveAttribute('aria-label', new RegExp(host, 'i'));
    }
  });
});
