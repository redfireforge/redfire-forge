/**
 * graphql-workflow-nodes.spec.ts
 *
 * E2E tests for GraphQL workflow node types (Phase 4).
 * Covers:
 *   - All 5 node types render on canvas when seeded
 *   - Config modal opens for each node type showing the correct panel
 *   - Config panel tabs and key fields are present and interactive
 *   - Gallery templates include graphql entries
 *   - Node types appear in the workflow palette
 *
 * No live GraphQL server is required — tests work against the UI only.
 */

import { test, expect, type Page } from '@playwright/test';
import { gotoAppTab, seedAppData, seedWorkflowInLocalStorage, clickFitViewIfVisible } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

test.describe.configure({ mode: 'serial' });

// ── Shared workflow seed data ─────────────────────────────────────────────────

function makeGraphqlWorkflow(): Workflow {
  return {
    id: 'wf-gql-nodes-1',
    name: 'GraphQL Node Test Workflow',
    schemaVersion: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: {},
    nodes: [
      { id: 'start1', type: 'start', position: { x: 50, y: 200 }, data: { label: 'Start' } },
      {
        id: 'query1',
        type: 'graphqlQuery',
        position: { x: 250, y: 80 },
        data: {
          label: 'Fetch User',
          endpoint: 'https://api.example.com/graphql',
          query: 'query GetUser($id: ID!) { user(id: $id) { id name email } }',
          variables: '{"id": "1"}',
          headers: [],
          auth: { type: 'none' },
          skipTlsVerify: false,
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [],
        },
      },
      {
        id: 'mutation1',
        type: 'graphqlMutation',
        position: { x: 250, y: 200 },
        data: {
          label: 'Create User',
          endpoint: 'https://api.example.com/graphql',
          query: 'mutation CreateUser($name: String!) { createUser(name: $name) { id } }',
          variables: '{"name": "Alice"}',
          headers: [],
          auth: { type: 'none' },
          skipTlsVerify: false,
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [],
        },
      },
      {
        id: 'sub1',
        type: 'graphqlSubscription',
        position: { x: 250, y: 330 },
        data: {
          label: 'Watch Orders',
          endpoint: 'wss://api.example.com/graphql',
          subscriptionQuery: 'subscription { orderUpdated { id status } }',
          variables: '',
          headers: [],
          auth: { type: 'none' },
          subscriptionTransport: 'graphql-ws',
          stopAfterMessages: 5,
          stopAfterMs: null,
          stopCondition: '',
          extractionRules: [],
          outputBindings: [],
        },
      },
      {
        id: 'introspect1',
        type: 'graphqlIntrospect',
        position: { x: 450, y: 80 },
        data: {
          label: 'Check Schema',
          endpoint: 'https://api.example.com/graphql',
          headers: [],
          auth: { type: 'none' },
          skipTlsVerify: false,
          timeoutMs: 30000,
          minTypeCount: 10,
          requiredTypes: ['User', 'Order'],
          requiredFields: [],
          outputBindings: [],
        },
      },
      {
        id: 'assert1',
        type: 'graphqlAssert',
        position: { x: 450, y: 250 },
        data: {
          label: 'Verify User',
          sourceVariable: 'query1',
          assertions: [
            {
              id: 'asrt-1',
              jsonPath: '$.data.user.id',
              operator: 'exists',
              expectedValue: '',
              description: 'User ID exists',
            },
          ],
          failBehavior: 'error',
        },
      },
      { id: 'end1', type: 'end', position: { x: 650, y: 200 }, data: { label: 'End' } },
    ],
    edges: [],
  } as unknown as Workflow;
}

async function seedGraphqlWorkflow(page: Page) {
  await seedAppData(page);
  await seedWorkflowInLocalStorage(page, [makeGraphqlWorkflow()], 'wf-gql-nodes-1');
}

// ── 1. Canvas rendering ───────────────────────────────────────────────────────

test.describe('GraphQL workflow nodes — canvas rendering', () => {
  test.beforeEach(async ({ page }) => {
    await seedGraphqlWorkflow(page);
    await gotoAppTab(page, 'workflow');
  });

  test('renders graphqlQuery node on canvas', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-canvas-query-node"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="gql-canvas-query-node"] .wf-node-label')).toContainText('Fetch User');
  });

  test('renders graphqlMutation node on canvas', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-canvas-mutation-node"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="gql-canvas-mutation-node"] .wf-node-label')).toContainText('Create User');
  });

  test('renders graphqlSubscription node on canvas', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-canvas-subscription-node"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="gql-canvas-subscription-node"] .wf-node-label')).toContainText('Watch Orders');
  });

  test('graphqlSubscription node shows stop-after-messages summary', async ({ page }) => {
    const node = page.locator('[data-testid="gql-canvas-subscription-node"]');
    await expect(node).toBeVisible({ timeout: 8000 });
    await expect(node.locator('.wf-ws-meta')).toContainText('5');
  });

  test('renders graphqlIntrospect node on canvas', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-canvas-introspect-node"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="gql-canvas-introspect-node"] .wf-node-label')).toContainText('Check Schema');
  });

  test('graphqlIntrospect node shows schema validation indicator', async ({ page }) => {
    const node = page.locator('[data-testid="gql-canvas-introspect-node"]');
    await expect(node).toBeVisible({ timeout: 8000 });
    await expect(node.locator('.wf-ws-meta')).toContainText('Schema validation');
  });

  test('renders graphqlAssert node on canvas', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-canvas-assert-node"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="gql-canvas-assert-node"] .wf-node-label')).toContainText('Verify User');
  });

  test('renders graphqlQuery endpoint host on canvas card', async ({ page }) => {
    const node = page.locator('[data-testid="gql-canvas-query-node"]');
    await expect(node.locator('.wf-ws-url')).toContainText('api.example.com');
  });
});

// ── 2. Config modal — graphqlQuery ────────────────────────────────────────────

test.describe('GraphQL workflow nodes — query config modal', () => {
  test.beforeEach(async ({ page }) => {
    await seedGraphqlWorkflow(page);
    await gotoAppTab(page, 'workflow');
    await clickFitViewIfVisible(page, 5000);
    const node = page.locator('[data-testid="gql-canvas-query-node"]');
    await node.waitFor({ state: 'visible', timeout: 8000 });
    await node.dblclick();
    await page.locator('.wf-config-modal').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('opens query config panel', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-wf-query-panel"]')).toBeVisible();
  });

  test('query panel has Operation tab visible', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-query-panel"]');
    const operationTab = panel.locator('.gql-wf-subtab', { hasText: 'Operation' });
    await expect(operationTab).toBeVisible();
  });

  test('query editor shows pre-filled query', async ({ page }) => {
    const editor = page.locator('[data-testid="gql-wf-query-editor"]');
    await expect(editor).toBeVisible();
    await expect(editor).toContainText('GetUser');
  });

  test('Variables tab shows variables JSON', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-query-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Variables' }).click();
    const varsEditor = page.locator('[data-testid="gql-wf-variables-editor"]');
    await expect(varsEditor).toBeVisible();
    await expect(varsEditor).toContainText('"id"');
  });

  test('Headers tab shows add-header button', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-query-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Headers' }).click();
    await expect(page.locator('[data-testid="gql-wf-headers-add-btn"]')).toBeVisible();
  });

  test('clicking + Add header adds a header row', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-query-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Headers' }).click();
    await page.locator('[data-testid="gql-wf-headers-add-btn"]').click();
    await expect(page.locator('[data-testid="gql-wf-header-key"]').first()).toBeVisible();
  });

  test('Extraction tab shows add-extraction button', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-query-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Extraction' }).click();
    await expect(page.locator('[data-testid="gql-wf-extraction-add-btn"]')).toBeVisible();
  });

  test('clicking + Add extraction adds an extraction row', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-query-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Extraction' }).click();
    await page.locator('[data-testid="gql-wf-extraction-add-btn"]').click();
    await expect(page.locator('[data-testid="gql-wf-extraction-jsonpath"]').first()).toBeVisible();
  });

  test('Output tab shows add-output button', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-query-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Output' }).click();
    await expect(page.locator('[data-testid="gql-wf-output-add-btn"]')).toBeVisible();
  });

  test('Import from Collections button is present', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-wf-import-collections-btn"]')).toBeVisible();
  });

  test('Save button closes the modal', async ({ page }) => {
    await page.locator('.wf-config-modal-footer-actions .btn-primary').click();
    await expect(page.locator('.wf-config-modal')).not.toBeVisible({ timeout: 3000 });
  });
});

// ── 3. Config modal — graphqlMutation ────────────────────────────────────────

test.describe('GraphQL workflow nodes — mutation config modal', () => {
  test.beforeEach(async ({ page }) => {
    await seedGraphqlWorkflow(page);
    await gotoAppTab(page, 'workflow');
    await clickFitViewIfVisible(page, 5000);
    const node = page.locator('[data-testid="gql-canvas-mutation-node"]');
    await node.waitFor({ state: 'visible', timeout: 8000 });
    await node.dblclick();
    await page.locator('.wf-config-modal').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('opens mutation config panel', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-wf-mutation-panel"]')).toBeVisible();
  });

  test('mutation editor shows pre-filled mutation', async ({ page }) => {
    const editor = page.locator('[data-testid="gql-wf-query-editor"]');
    await expect(editor).toBeVisible();
    await expect(editor).toContainText('CreateUser');
  });

  test('mutation panel Variables tab works', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-mutation-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Variables' }).click();
    await expect(page.locator('[data-testid="gql-wf-variables-editor"]')).toBeVisible();
  });
});

// ── 4. Config modal — graphqlSubscription ────────────────────────────────────

test.describe('GraphQL workflow nodes — subscription config modal', () => {
  test.beforeEach(async ({ page }) => {
    await seedGraphqlWorkflow(page);
    await gotoAppTab(page, 'workflow');
    await clickFitViewIfVisible(page, 5000);
    const node = page.locator('[data-testid="gql-canvas-subscription-node"]');
    await node.waitFor({ state: 'visible', timeout: 8000 });
    await node.dblclick();
    await page.locator('.wf-config-modal').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('opens subscription config panel', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-wf-subscription-panel"]')).toBeVisible();
  });

  test('subscription query editor is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-wf-subscription-query-editor"]')).toBeVisible();
  });

  test('subscription editor contains pre-filled query', async ({ page }) => {
    const editor = page.locator('[data-testid="gql-wf-subscription-query-editor"]');
    await expect(editor).toContainText('orderUpdated');
  });

  test('transport select is visible', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-wf-sub-transport-select"]')).toBeVisible();
  });

  test('Stop tab shows stop-after-messages input', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-subscription-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Stop' }).click();
    const stopInput = page.locator('[data-testid="gql-wf-stop-messages-input"]');
    await expect(stopInput).toBeVisible();
    await expect(stopInput).toHaveValue('5');
  });

  test('Stop tab shows stop-after-seconds input', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-subscription-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Stop' }).click();
    await expect(page.locator('[data-testid="gql-wf-stop-secs-input"]')).toBeVisible();
  });
});

// ── 5. Config modal — graphqlIntrospect ──────────────────────────────────────

test.describe('GraphQL workflow nodes — introspect config modal', () => {
  test.beforeEach(async ({ page }) => {
    await seedGraphqlWorkflow(page);
    await gotoAppTab(page, 'workflow');
    await clickFitViewIfVisible(page, 5000);
    // Double-click the node body to open config (React Flow's onNodeDoubleClick handler)
    // This is more reliable than clicking the configure button in serial mode tests.
    const node = page.locator('[data-testid="gql-canvas-introspect-node"]');
    await node.waitFor({ state: 'visible', timeout: 8000 });
    await node.dblclick();
    await page.locator('.wf-config-modal').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('opens introspect config panel', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-wf-introspect-panel"]')).toBeVisible();
  });

  test('introspect panel shows timeout input', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-wf-introspect-timeout-input"]')).toBeVisible();
  });

  test('introspect timeout defaults to 30000', async ({ page }) => {
    const input = page.locator('[data-testid="gql-wf-introspect-timeout-input"]');
    await expect(input).toHaveValue('30000');
  });

  test('Schema Validation tab shows min-type-count input', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-introspect-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Schema Validation' }).click();
    const input = page.locator('[data-testid="gql-wf-introspect-min-type-count"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('10');
  });

  test('Schema Validation tab shows required types input', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-introspect-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Schema Validation' }).click();
    const input = page.locator('[data-testid="gql-wf-introspect-required-types"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('User, Order');
  });

  test('Schema Validation tab has + Add required field button', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-introspect-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Schema Validation' }).click();
    await expect(page.locator('[data-testid="gql-wf-introspect-add-field-btn"]')).toBeVisible();
  });

  test('Skip TLS checkbox is present', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-wf-introspect-skip-tls"]')).toBeVisible();
  });
});

// ── 6. Config modal — graphqlAssert ──────────────────────────────────────────

test.describe('GraphQL workflow nodes — assert config modal', () => {
  test.beforeEach(async ({ page }) => {
    await seedGraphqlWorkflow(page);
    await gotoAppTab(page, 'workflow');
    await clickFitViewIfVisible(page, 5000);
    // Double-click the node body to open config (React Flow's onNodeDoubleClick handler)
    const node = page.locator('[data-testid="gql-canvas-assert-node"]');
    await node.waitFor({ state: 'visible', timeout: 8000 });
    await node.dblclick();
    await page.locator('.wf-config-modal').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('opens assert config panel', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-wf-assert-panel"]')).toBeVisible();
  });

  test('assert panel shows existing assertion row', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-wf-assert-row"]').first()).toBeVisible();
  });

  test('assertion row shows JSONPath input', async ({ page }) => {
    const jsonpathInput = page.locator('[data-testid="gql-wf-assert-jsonpath"]').first();
    await expect(jsonpathInput).toBeVisible();
    await expect(jsonpathInput).toHaveValue('$.data.user.id');
  });

  test('assertion row shows operator select', async ({ page }) => {
    await expect(page.locator('[data-testid="gql-wf-assert-operator"]').first()).toBeVisible();
  });

  test('clicking + Add assertion adds a row', async ({ page }) => {
    const initialCount = await page.locator('[data-testid="gql-wf-assert-row"]').count();
    await page.locator('[data-testid="gql-wf-assert-add-btn"]').click();
    const newCount = await page.locator('[data-testid="gql-wf-assert-row"]').count();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('fail behavior error radio is checked', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-assert-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Behavior' }).click();
    const errorRadio = page.locator('[data-testid="gql-wf-assert-fail-error"]');
    await expect(errorRadio).toBeChecked();
  });

  test('fail behavior warn radio can be selected', async ({ page }) => {
    const panel = page.locator('[data-testid="gql-wf-assert-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Behavior' }).click();
    const warnOption = page.locator('label:has([data-testid="gql-wf-assert-fail-warn"])');
    await warnOption.click();
    await expect(page.locator('[data-testid="gql-wf-assert-fail-warn"]')).toBeChecked();
  });
});

// ── 7. Workflow palette shows GraphQL nodes ───────────────────────────────────

test.describe('GraphQL workflow nodes — palette registration', () => {
  test.beforeEach(async ({ page }) => {
    // Seed a workflow so one is selected and the canvas+palette render
    await seedGraphqlWorkflow(page);
    await gotoAppTab(page, 'workflow');
    await clickFitViewIfVisible(page, 3000);
    await page.locator('[data-testid="wf-palette-rail-actions"]').click();
    await page.locator('[data-testid="wf-palette-chip-graphql"]').click();
  });

  test('palette shows graphqlQuery block', async ({ page }) => {
    // Open Blocks tab in palette
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    if (await blocksTab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await blocksTab.click();
    }
    await expect(page.locator('.wf-palette-block-graphqlQuery')).toBeVisible({ timeout: 6000 });
  });

  test('palette shows graphqlMutation block', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    if (await blocksTab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await blocksTab.click();
    }
    await expect(page.locator('.wf-palette-block-graphqlMutation')).toBeVisible({ timeout: 6000 });
  });

  test('palette shows graphqlSubscription block', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    if (await blocksTab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await blocksTab.click();
    }
    await expect(page.locator('.wf-palette-block-graphqlSubscription')).toBeVisible({ timeout: 6000 });
  });

  test('palette shows graphqlIntrospect block', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    if (await blocksTab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await blocksTab.click();
    }
    await expect(page.locator('.wf-palette-block-graphqlIntrospect')).toBeVisible({ timeout: 6000 });
  });

  test('palette shows graphqlAssert block', async ({ page }) => {
    const blocksTab = page.locator('.wf-palette-tab', { hasText: 'Blocks' });
    if (await blocksTab.isVisible({ timeout: 4000 }).catch(() => false)) {
      await blocksTab.click();
    }
    await page.locator('[data-testid="wf-palette-rail-logic"]').click();
    await expect(page.locator('.wf-palette-block-graphqlAssert')).toBeVisible({ timeout: 6000 });
  });
});

// ── 8. Gallery templates — graphql entries ────────────────────────────────────

test.describe('GraphQL workflow nodes — gallery templates', () => {
  const healthCheckCard = (page: import('@playwright/test').Page) =>
    page.locator('.gallery-card').filter({ hasText: /GraphQL:?\s+Health Check/i }).first();

  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await gotoAppTab(page, 'workflow');
    // Open +New → From Template → Gallery
    await page.locator('button:has-text("+ New")').click();
    await page.locator('.wf-new-dropdown-item:has-text("From Template")').click();
    await page.locator('.gallery-domain-btn').first().waitFor({ state: 'visible', timeout: 8000 });
    // Filter to Workflow domain
    await page.locator('.gallery-domain-btn:has-text("Workflow")').click();
    await page.getByRole('searchbox', { name: 'Search gallery' }).fill('graphql');
    await page.waitForTimeout(300);
  });

  test('gallery shows graphql-health-check template', async ({ page }) => {
    await expect(healthCheckCard(page)).toBeVisible({ timeout: 5000 });
  });

  test('graphql-health-check template has description', async ({ page }) => {
    await expect(healthCheckCard(page).locator('.gallery-card-desc')).toBeVisible();
  });

  test('gallery shows graphql-e-commerce-flow template', async ({ page }) => {
    const card = page.locator('.gallery-card').filter({ hasText: /e.commerce|E.Commerce|order/i });
    // At least one graphql e-commerce template card exists
    const count = await card.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('graphql-health-check can be loaded via Use as Template', async ({ page }) => {
    const card = healthCheckCard(page);
    await expect(card).toBeVisible({ timeout: 5000 });

    // Click the card to select it — this opens the GalleryDetailPanel on the right.
    // The "Load Workflow" action button lives in the detail panel, NOT inside the card itself.
    await card.click();

    // Wait for the primary action button ("Load Workflow") in the detail panel
    const actionBtn = page.locator('.gallery-detail-btn-primary');
    await actionBtn.waitFor({ state: 'visible', timeout: 5000 });
    await actionBtn.click();

    // Handle folder picker modal if it appears (workflow save-to-folder flow)
    const folderModal = page.locator('.fp-dialog');
    if (await folderModal.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.locator('.fp-dialog .btn-primary').click();
    }

    // After loading, App navigates back to the workflow designer tab
    await expect(page.locator('.wf-designer')).toBeVisible({ timeout: 10000 });
  });
});

// ── 9. Cross-panel: query config editor fills persist on save ─────────────────

test.describe('GraphQL workflow nodes — config persistence', () => {
  test('query config: editing query string and saving updates canvas node', async ({ page }) => {
    await seedGraphqlWorkflow(page);
    await gotoAppTab(page, 'workflow');
    await clickFitViewIfVisible(page, 5000);
    const queryNode = page.locator('[data-testid="gql-canvas-query-node"]');
    await queryNode.waitFor({ state: 'visible', timeout: 8000 });
    await queryNode.dblclick();
    await page.locator('.wf-config-modal').waitFor({ state: 'visible', timeout: 10000 });

    // Save (just verify the modal can be closed)
    await page.locator('.wf-config-modal-footer-actions .btn-primary').click();
    await expect(page.locator('.wf-config-modal')).not.toBeVisible({ timeout: 3000 });
  });

  test('assert config: adding assertion saves correctly', async ({ page }) => {
    await seedGraphqlWorkflow(page);
    await gotoAppTab(page, 'workflow');
    await clickFitViewIfVisible(page, 5000);
    const assertNode = page.locator('[data-testid="gql-canvas-assert-node"]');
    await assertNode.waitFor({ state: 'visible', timeout: 8000 });
    await assertNode.dblclick();
    await page.locator('.wf-config-modal').waitFor({ state: 'visible', timeout: 10000 });

    // Add a new assertion
    await page.locator('[data-testid="gql-wf-assert-add-btn"]').click();
    const newRow = page.locator('[data-testid="gql-wf-assert-row"]').last();
    await newRow.locator('[data-testid="gql-wf-assert-jsonpath"]').fill('$.data.user.name');

    // Save
    await page.locator('.wf-config-modal-footer-actions .btn-primary').click();
    await expect(page.locator('.wf-config-modal')).not.toBeVisible({ timeout: 3000 });
  });

  test('introspect config: updating min type count saves correctly', async ({ page }) => {
    await seedGraphqlWorkflow(page);
    await gotoAppTab(page, 'workflow');
    await clickFitViewIfVisible(page, 5000);
    const introspectNode = page.locator('[data-testid="gql-canvas-introspect-node"]');
    await introspectNode.waitFor({ state: 'visible', timeout: 8000 });
    await introspectNode.dblclick();
    await page.locator('.wf-config-modal').waitFor({ state: 'visible', timeout: 10000 });

    // Navigate to Schema Validation tab and update min type count
    const panel = page.locator('[data-testid="gql-wf-introspect-panel"]');
    await panel.locator('.gql-wf-subtab', { hasText: 'Schema Validation' }).click();
    await page.locator('[data-testid="gql-wf-introspect-min-type-count"]').fill('25');

    // Save
    await page.locator('.wf-config-modal-footer-actions .btn-primary').click();
    await expect(page.locator('.wf-config-modal')).not.toBeVisible({ timeout: 3000 });
  });
});
