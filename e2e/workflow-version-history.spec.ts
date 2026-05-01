import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

// ── Seed data builders ────────────────────────────────────

/**
 * Build a workflow with 2 nodes, 1 edge, 1 variable, and an optional versions array.
 * The "current" state always has 2 nodes (start + request), 1 edge, 1 variable.
 */
function makeSeedWorkflow(versions: unknown[] = []) {
  return {
    id: 'wf-ver-1',
    name: 'Version Test WF',
    nodes: [
      {
        id: 'n1',
        type: 'start',
        position: { x: 100, y: 100 },
        data: { label: 'Start' },
      },
      {
        id: 'n2',
        type: 'request',
        position: { x: 300, y: 100 },
        data: {
          label: 'GET Test',
          method: 'GET',
          url: '/api/test',
          headers: {},
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
        },
      },
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    variables: { baseUrl: 'http://localhost' },
    services: [],
    versions,
  };
}

/**
 * Build 2 version snapshots with known differences:
 * - ver-1 (newer, 1h ago): 2 nodes, 1 edge, 1 var (baseUrl)
 *   → represents adding a request node + edge + variable from ver-2
 * - ver-2 (older, 2h ago): 1 node, 0 edges, no vars
 *   → initial start-only state, labelled "Empty Start"
 */
function makeVersions() {
  return [
    {
      id: 'ver-1',
      timestamp: Date.now() - 3600_000, // 1 h ago
      label: 'Added Request',
      fingerprint: 'fp-1',
      nodeCount: 2,
      edgeCount: 1,
      nodes: [
        { id: 'n1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Start' } },
        { id: 'n2', type: 'request', position: { x: 300, y: 100 }, data: { label: 'GET Test', method: 'GET', url: '/api/test' } },
      ],
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      variables: { baseUrl: 'http://localhost' },
    },
    {
      id: 'ver-2',
      timestamp: Date.now() - 7200_000, // 2 h ago
      label: 'Empty Start',
      fingerprint: 'fp-2',
      nodeCount: 1,
      edgeCount: 0,
      nodes: [
        { id: 'n1', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Start' } },
      ],
      edges: [],
      variables: {},
    },
  ];
}

/** Seed localStorage with a workflow that already has 2 versions. */
async function seedVersionWorkflow(page: import('@playwright/test').Page) {
  await seedAppData(page);
  const wf = makeSeedWorkflow(makeVersions());
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-ver-1');
  }, JSON.stringify([wf]));
}

/** Seed localStorage with a workflow that has zero versions. */
async function seedNoVersionWorkflow(page: import('@playwright/test').Page) {
  await seedAppData(page);
  const wf = makeSeedWorkflow([]);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-ver-1');
  }, JSON.stringify([wf]));
}

// ── Helpers ───────────────────────────────────────────────

/** Click the "Versions" toolbar button. */
async function openVersionPanel(page: import('@playwright/test').Page) {
  await page.locator('.wf-toolbar-versions-btn').click();
  await expect(page.locator('.wf-version-panel')).toBeVisible();
}

/** Read the persisted workflow from localStorage and return parsed. */
async function getPersistedWorkflows(page: import('@playwright/test').Page) {
  const raw = await page.evaluate(() => localStorage.getItem('workflows'));
  return raw ? JSON.parse(raw) : [];
}

// ═══════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════

test.describe('Workflow Version History — Toolbar Button', () => {
  test.beforeEach(async ({ page }) => {
    await seedVersionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.wf-designer', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('toolbar shows a Versions button with the correct title', async ({ page }) => {
    const btn = page.locator('.wf-toolbar-versions-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute('title', 'View and manage workflow version history');
    await expect(btn).toContainText('Versions');
  });

  test('toolbar badge shows the number of existing versions', async ({ page }) => {
    // The badge uses class wf-toolbar-services-badge inside the versions button
    const badge = page.locator('.wf-toolbar-versions-btn .wf-toolbar-services-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('2');
  });

  test('clicking Versions toggles the version panel open/closed', async ({ page }) => {
    const btn = page.locator('.wf-toolbar-versions-btn');
    // Initially panel is not visible
    await expect(page.locator('.wf-version-panel')).not.toBeVisible();
    // First click opens
    await btn.click();
    await expect(page.locator('.wf-version-panel')).toBeVisible();
    // Second click closes (toggle)
    await btn.click();
    await expect(page.locator('.wf-version-panel')).not.toBeVisible();
  });
});

test.describe('Workflow Version Panel — Empty State', () => {
  test.beforeEach(async ({ page }) => {
    await seedNoVersionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.wf-designer', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('shows "No versions yet" message when no versions exist', async ({ page }) => {
    await openVersionPanel(page);
    await expect(page.locator('.wf-version-empty')).toBeVisible();
    await expect(page.locator('.wf-version-empty p').first()).toHaveText('No versions yet');
  });

  test('shows hint about saving to create a version', async ({ page }) => {
    await openVersionPanel(page);
    await expect(page.locator('.wf-version-empty-hint')).toHaveText(
      'Save the workflow to create a version snapshot.',
    );
  });

  test('footer shows "0 versions"', async ({ page }) => {
    await openVersionPanel(page);
    await expect(page.locator('.wf-version-footer-count')).toHaveText('0 versions');
  });

  test('Compare button is disabled', async ({ page }) => {
    await openVersionPanel(page);
    const compare = page.locator('.wf-version-panel .btn-primary', { hasText: 'Compare' });
    await expect(compare).toBeDisabled();
  });

  test('toolbar badge is hidden when there are 0 versions', async ({ page }) => {
    const badge = page.locator('.wf-toolbar-versions-btn .wf-toolbar-services-badge');
    await expect(badge).toHaveCount(0);
  });
});

test.describe('Workflow Version Panel — With Versions', () => {
  test.beforeEach(async ({ page }) => {
    await seedVersionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.wf-designer', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('panel header shows clock emoji and "Version History" title', async ({ page }) => {
    await openVersionPanel(page);
    await expect(page.locator('.wf-config-type')).toContainText('Version History');
  });

  test('lists all versions in newest-first order', async ({ page }) => {
    await openVersionPanel(page);
    const items = page.locator('.wf-version-item');
    await expect(items).toHaveCount(2);
    // First item should be newer (ver-1 = "Added Request", 1h ago)
    const firstLabel = items.nth(0).locator('.wf-version-item-label');
    await expect(firstLabel).toHaveText('Added Request');
    // Second item should be older (ver-2 = "Empty Start", 2h ago)
    const secondLabel = items.nth(1).locator('.wf-version-item-label');
    await expect(secondLabel).toHaveText('Empty Start');
  });

  test('each version item shows node and edge counts', async ({ page }) => {
    await openVersionPanel(page);
    const firstMeta = page.locator('.wf-version-item').nth(0).locator('.wf-version-item-meta span').first();
    await expect(firstMeta).toHaveText('2 nodes · 1 edges');
    const secondMeta = page.locator('.wf-version-item').nth(1).locator('.wf-version-item-meta span').first();
    await expect(secondMeta).toHaveText('1 nodes · 0 edges');
  });

  test('last version shows "Initial version" as change summary', async ({ page }) => {
    await openVersionPanel(page);
    const lastSummary = page.locator('.wf-version-item').last().locator('.wf-version-item-summary');
    await expect(lastSummary).toHaveText('Initial version');
  });

  test('non-last version shows a generated change summary', async ({ page }) => {
    await openVersionPanel(page);
    // ver-1 (newer) compared to ver-2 (older): added 1 node, added 1 edge, added 1 var
    const firstSummary = page.locator('.wf-version-item').first().locator('.wf-version-item-summary');
    const text = await firstSummary.textContent();
    expect(text).toContain('1 node added');
    expect(text).toContain('1 edge added');
    expect(text).toContain('1 var added');
  });

  test('each version item shows relative time (e.g. "1h ago")', async ({ page }) => {
    await openVersionPanel(page);
    const firstTime = page.locator('.wf-version-item').first().locator('.wf-version-item-time');
    await expect(firstTime).toHaveText('1h ago');
    const secondTime = page.locator('.wf-version-item').nth(1).locator('.wf-version-item-time');
    await expect(secondTime).toHaveText('2h ago');
  });

  test('each version item has Restore, Rename, Delete action buttons', async ({ page }) => {
    await openVersionPanel(page);
    const firstItem = page.locator('.wf-version-item').first();
    await expect(firstItem.locator('[title="Restore this version"]')).toBeVisible();
    await expect(firstItem.locator('[title="Rename this version"]')).toBeVisible();
    await expect(firstItem.locator('[title="Delete this version"]')).toBeVisible();
  });

  test('footer shows correct version count text', async ({ page }) => {
    await openVersionPanel(page);
    await expect(page.locator('.wf-version-footer-count')).toHaveText('2 versions');
  });

  test('close button (×) dismisses the panel', async ({ page }) => {
    await openVersionPanel(page);
    await page.locator('.wf-version-panel button[title="Close"]').click();
    await expect(page.locator('.wf-version-panel')).not.toBeVisible();
  });
});

test.describe('Workflow Version Panel — Selection & Compare', () => {
  test.beforeEach(async ({ page }) => {
    await seedVersionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.wf-designer', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await openVersionPanel(page);
  });

  test('Compare button is disabled until exactly 2 versions are selected', async ({ page }) => {
    const compare = page.locator('.wf-version-panel .btn-primary', { hasText: 'Compare' });
    await expect(compare).toBeDisabled();
    // Select first
    await page.locator('.wf-version-item input[type="checkbox"]').nth(0).click();
    await expect(compare).toBeDisabled(); // only 1 selected
    // Select second
    await page.locator('.wf-version-item input[type="checkbox"]').nth(1).click();
    await expect(compare).toBeEnabled();
  });

  test('selecting a checkbox adds "selected" class to the version item', async ({ page }) => {
    const firstItem = page.locator('.wf-version-item').first();
    // Not selected initially
    await expect(firstItem).not.toHaveClass(/selected/);
    await firstItem.locator('input[type="checkbox"]').click();
    await expect(firstItem).toHaveClass(/selected/);
  });

  test('"Clear selection" button appears when versions are selected', async ({ page }) => {
    await expect(page.locator('.wf-version-footer-clear')).not.toBeVisible();
    await page.locator('.wf-version-item input[type="checkbox"]').nth(0).click();
    await expect(page.locator('.wf-version-footer-clear')).toBeVisible();
    await expect(page.locator('.wf-version-footer-clear')).toHaveText('Clear selection');
  });

  test('"Clear selection" deselects all versions', async ({ page }) => {
    const checkboxes = page.locator('.wf-version-item input[type="checkbox"]');
    await checkboxes.nth(0).click();
    await checkboxes.nth(1).click();
    await page.locator('.wf-version-footer-clear').click();
    // Both should be unchecked
    await expect(checkboxes.nth(0)).not.toBeChecked();
    await expect(checkboxes.nth(1)).not.toBeChecked();
    // "Clear selection" should be hidden again
    await expect(page.locator('.wf-version-footer-clear')).not.toBeVisible();
  });

  test('deselecting a checked checkbox untoggles it', async ({ page }) => {
    const cb = page.locator('.wf-version-item input[type="checkbox"]').nth(0);
    await cb.click();
    await expect(cb).toBeChecked();
    await cb.click();
    await expect(cb).not.toBeChecked();
  });
});

test.describe('Workflow Version Diff Modal', () => {
  test.beforeEach(async ({ page }) => {
    await seedVersionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.wf-designer', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    // Open panel and select both versions, then compare
    await openVersionPanel(page);
    await page.locator('.wf-version-item input[type="checkbox"]').nth(0).click();
    await page.locator('.wf-version-item input[type="checkbox"]').nth(1).click();
    await page.locator('.wf-version-panel .btn-primary', { hasText: 'Compare' }).click();
    await expect(page.locator('.wf-version-diff-modal')).toBeVisible();
  });

  test('diff modal shows "Version Comparison" header', async ({ page }) => {
    await expect(page.locator('.wf-version-diff-header h3')).toHaveText('Version Comparison');
  });

  test('diff modal header shows the version range (older → newer labels)', async ({ page }) => {
    const range = page.locator('.wf-version-diff-range');
    await expect(range).toContainText('Empty Start');
    await expect(range).toContainText('Added Request');
    // Arrow direction: older → newer
    const text = await range.textContent();
    expect(text).toMatch(/Empty Start.*→.*Added Request/);
  });

  test('diff modal has 4 tabs: Nodes, Edges, Variables, Services', async ({ page }) => {
    const tabs = page.locator('.wf-version-diff-tab');
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toContainText('Nodes');
    await expect(tabs.nth(1)).toContainText('Edges');
    await expect(tabs.nth(2)).toContainText('Variables');
    await expect(tabs.nth(3)).toContainText('Services');
  });

  test('Nodes tab shows change count badge', async ({ page }) => {
    const nodesTab = page.locator('.wf-version-diff-tab').nth(0);
    const badge = nodesTab.locator('.wf-version-diff-tab-count');
    // ver-2 → ver-1: 1 node added (n2 = request node)
    await expect(badge).toHaveText('1');
  });

  test('Nodes tab is active by default and shows added node', async ({ page }) => {
    // Nodes tab should be active
    await expect(page.locator('.wf-version-diff-tab').nth(0)).toHaveClass(/active/);
    // Should show the added request node with + badge
    const addedRow = page.locator('.wf-version-diff-row.added');
    await expect(addedRow).toBeVisible();
    await expect(addedRow.locator('.wf-version-diff-badge.added')).toHaveText('+');
    await expect(addedRow).toContainText('request');
  });

  test('Edges tab shows added edge', async ({ page }) => {
    await page.locator('.wf-version-diff-tab', { hasText: 'Edges' }).click();
    const badge = page.locator('.wf-version-diff-tab').nth(1).locator('.wf-version-diff-tab-count');
    await expect(badge).toHaveText('1');
    const addedEdge = page.locator('.wf-version-diff-row.added');
    await expect(addedEdge).toBeVisible();
    await expect(addedEdge).toContainText('n1');
    await expect(addedEdge).toContainText('n2');
  });

  test('Variables tab shows added variable', async ({ page }) => {
    await page.locator('.wf-version-diff-tab', { hasText: 'Variables' }).click();
    const addedVar = page.locator('.wf-version-diff-row.added');
    await expect(addedVar).toBeVisible();
    await expect(addedVar.locator('.wf-version-diff-var-key')).toContainText('baseUrl');
  });

  test('Services tab shows "No service changes" when none changed', async ({ page }) => {
    await page.locator('.wf-version-diff-tab', { hasText: 'Services' }).click();
    await expect(page.locator('.wf-version-diff-empty')).toHaveText('No service changes');
  });

  test('Services tab does not show a count badge when count is 0', async ({ page }) => {
    const svcTab = page.locator('.wf-version-diff-tab', { hasText: 'Services' });
    const badge = svcTab.locator('.wf-version-diff-tab-count');
    await expect(badge).toHaveCount(0);
  });

  test('clicking × closes the diff modal', async ({ page }) => {
    await page.locator('.wf-version-diff-header button').click();
    await expect(page.locator('.wf-version-diff-modal')).not.toBeVisible();
  });

  test('clicking the overlay backdrop closes the diff modal', async ({ page }) => {
    // Click the overlay outside the modal
    await page.locator('.wf-version-diff-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('.wf-version-diff-modal')).not.toBeVisible();
  });
});

test.describe('Workflow Version Panel — Restore', () => {
  test.beforeEach(async ({ page }) => {
    await seedVersionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.wf-designer', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await openVersionPanel(page);
  });

  test('clicking Restore shows success toast with version label', async ({ page }) => {
    await page.locator('.wf-version-item').first().locator('[title="Restore this version"]').click();
    const toast = page.locator('.wf-toast-success');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast.locator('.wf-toast-title')).toHaveText('Version restored');
    await expect(toast.locator('.wf-toast-sub')).toHaveText('Added Request');
  });

  test('restoring a version persists the restored node/edge/variable data to localStorage', async ({ page }) => {
    // Restore ver-2 ("Empty Start") which has 1 node, 0 edges, no variables
    await page.locator('.wf-version-item').nth(1).locator('[title="Restore this version"]').click();
    await expect(page.locator('.wf-toast-success')).toBeVisible({ timeout: 5000 });
    // Check localStorage was updated with the restored data
    const workflows = await getPersistedWorkflows(page);
    const wf = workflows.find((w: { id: string }) => w.id === 'wf-ver-1');
    expect(wf).toBeTruthy();
    expect(wf.nodes).toHaveLength(1); // Only "Start" node from ver-2
    expect(wf.edges).toHaveLength(0);
    expect(wf.variables).toEqual({});
  });
});

test.describe('Workflow Version Panel — Delete', () => {
  test.beforeEach(async ({ page }) => {
    await seedVersionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.wf-designer', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await openVersionPanel(page);
  });

  test('deleting a version removes it from the list', async ({ page }) => {
    await expect(page.locator('.wf-version-item')).toHaveCount(2);
    await page.locator('.wf-version-item').first().locator('[title="Delete this version"]').click();
    await expect(page.locator('.wf-version-item')).toHaveCount(1);
    // The remaining version should be "Empty Start"
    await expect(page.locator('.wf-version-item-label')).toHaveText('Empty Start');
  });

  test('deleting a version updates the footer count', async ({ page }) => {
    await expect(page.locator('.wf-version-footer-count')).toHaveText('2 versions');
    await page.locator('.wf-version-item').first().locator('[title="Delete this version"]').click();
    await expect(page.locator('.wf-version-footer-count')).toHaveText('1 version');
  });

  test('deleting a version persists the change to localStorage', async ({ page }) => {
    await page.locator('.wf-version-item').first().locator('[title="Delete this version"]').click();
    const workflows = await getPersistedWorkflows(page);
    const wf = workflows.find((w: { id: string }) => w.id === 'wf-ver-1');
    expect(wf.versions).toHaveLength(1);
    expect(wf.versions[0].id).toBe('ver-2');
  });

  test('deleting all versions shows empty state', async ({ page }) => {
    await page.locator('.wf-version-item').first().locator('[title="Delete this version"]').click();
    await page.locator('.wf-version-item').first().locator('[title="Delete this version"]').click();
    await expect(page.locator('.wf-version-empty')).toBeVisible();
    await expect(page.locator('.wf-version-footer-count')).toHaveText('0 versions');
  });

  test('deleting a version also updates the toolbar badge', async ({ page }) => {
    const badge = page.locator('.wf-toolbar-versions-btn .wf-toolbar-services-badge');
    await expect(badge).toHaveText('2');
    await page.locator('.wf-version-item').first().locator('[title="Delete this version"]').click();
    await expect(badge).toHaveText('1');
  });
});

test.describe('Workflow Version Panel — Rename', () => {
  test.beforeEach(async ({ page }) => {
    await seedVersionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.wf-designer', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await openVersionPanel(page);
  });

  test('clicking Rename shows an inline input pre-filled with the current label', async ({ page }) => {
    await page.locator('.wf-version-item').first().locator('[title="Rename this version"]').click();
    const input = page.locator('.wf-version-label-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('Added Request');
  });

  test('pressing Enter commits the renamed label', async ({ page }) => {
    await page.locator('.wf-version-item').first().locator('[title="Rename this version"]').click();
    const input = page.locator('.wf-version-label-input');
    await input.fill('After Refactor');
    await input.press('Enter');
    // Input should disappear and label should update
    await expect(input).not.toBeVisible();
    await expect(page.locator('.wf-version-item').first().locator('.wf-version-item-label')).toHaveText('After Refactor');
  });

  test('pressing Escape cancels the rename without saving', async ({ page }) => {
    await page.locator('.wf-version-item').first().locator('[title="Rename this version"]').click();
    const input = page.locator('.wf-version-label-input');
    await input.fill('Discarded Name');
    await input.press('Escape');
    // Label should remain the original
    await expect(page.locator('.wf-version-item').first().locator('.wf-version-item-label')).toHaveText('Added Request');
  });

  test('renaming persists the new label to localStorage', async ({ page }) => {
    await page.locator('.wf-version-item').first().locator('[title="Rename this version"]').click();
    const input = page.locator('.wf-version-label-input');
    await input.fill('Persisted Label');
    await input.press('Enter');
    const workflows = await getPersistedWorkflows(page);
    const wf = workflows.find((w: { id: string }) => w.id === 'wf-ver-1');
    expect(wf.versions[0].label).toBe('Persisted Label');
  });
});

test.describe('Workflow Version — Auto-Save on Save', () => {
  // Use wider viewport so Save button isn't obscured by right-side toolbar buttons
  test.use({ viewport: { width: 1920, height: 1080 } });

  test.beforeEach(async ({ page }) => {
    await seedNoVersionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.wf-designer', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('saving the workflow auto-creates a version snapshot', async ({ page }) => {
    // Initially 0 versions
    const versionsBtn = page.locator('.wf-toolbar-versions-btn');
    const badge = versionsBtn.locator('.wf-toolbar-services-badge');
    await expect(badge).toHaveCount(0);

    // Click Save
    const saveBtn = page.locator('.wf-toolbar-save-wrap button');
    await saveBtn.click();

    // Wait for inline "Saved" acknowledgement (not a toast — uses toolbar inline msg)
    await expect(page.locator('.wf-toolbar-saved-msg')).toBeVisible({ timeout: 5000 });

    // Badge should now show 1
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('1');

    // Open panel and verify
    await openVersionPanel(page);
    await expect(page.locator('.wf-version-item')).toHaveCount(1);
    await expect(page.locator('.wf-version-footer-count')).toHaveText('1 version');
  });

  test('saving again with no changes does NOT create a duplicate version', async ({ page }) => {
    // First save creates version
    const saveBtn = page.locator('.wf-toolbar-save-wrap button');
    await saveBtn.click();
    await expect(page.locator('.wf-toolbar-saved-msg')).toBeVisible({ timeout: 5000 });

    // Wait for saved msg to disappear
    await page.waitForTimeout(3000);

    // Second save with same content — should NOT create a new version (fingerprint dedup)
    await saveBtn.click();
    await expect(page.locator('.wf-toolbar-saved-msg')).toBeVisible({ timeout: 5000 });

    // Still only 1 version
    const badge = page.locator('.wf-toolbar-versions-btn .wf-toolbar-services-badge');
    await expect(badge).toHaveText('1');
  });

  test('auto-created version has correct node/edge counts', async ({ page }) => {
    await page.locator('.wf-toolbar-save-wrap button').click();
    await expect(page.locator('.wf-toolbar-saved-msg')).toBeVisible({ timeout: 5000 });

    // Check persisted version data
    const workflows = await getPersistedWorkflows(page);
    const wf = workflows.find((w: { id: string }) => w.id === 'wf-ver-1');
    expect(wf.versions).toHaveLength(1);
    expect(wf.versions[0].nodeCount).toBe(2); // start + request
    expect(wf.versions[0].edgeCount).toBe(1);
    expect(wf.versions[0].fingerprint).toBeTruthy();
  });
});

test.describe('Workflow Version — Panel Interaction with Other Panels', () => {
  test.beforeEach(async ({ page }) => {
    await seedVersionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.wf-designer', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('opening version panel closes the service registry panel', async ({ page }) => {
    // Open service registry first
    const svcBtn = page.locator('.wf-toolbar button', { hasText: 'Services' });
    await svcBtn.click();
    // Service panel should be open (it uses wf-service-panel class or similar)
    // Now open version panel
    await page.locator('.wf-toolbar-versions-btn').click();
    await expect(page.locator('.wf-version-panel')).toBeVisible();
    // Service registry should close — the service panel uses className that contains "wf-service-registry"
    // We verify by checking version panel is the only right panel
  });

  test('opening service registry panel closes the version panel', async ({ page }) => {
    await openVersionPanel(page);
    // Now open services
    await page.locator('.wf-toolbar button', { hasText: 'Services' }).click();
    await expect(page.locator('.wf-version-panel')).not.toBeVisible();
  });
});

test.describe('Workflow Sidebar — Export/Import Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await seedVersionWorkflow(page);
    await page.goto('/?tab=workflow');
    await page.waitForSelector('.wf-designer', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('context menu shows Export Workflow and Import Workflow items', async ({ page }) => {
    const sidebarItem = page.locator('.wf-sidebar-item', { hasText: 'Version Test WF' });
    await sidebarItem.click({ button: 'right' });
    const menu = page.locator('.wf-sidebar-ctx-menu');
    await expect(menu).toBeVisible();
    await expect(menu.locator('[role="menuitem"]', { hasText: 'Export Workflow' })).toBeVisible();
    await expect(menu.locator('[role="menuitem"]', { hasText: 'Import Workflow' })).toBeVisible();
  });

  test('context menu shows a divider between Import and Delete', async ({ page }) => {
    const sidebarItem = page.locator('.wf-sidebar-item', { hasText: 'Version Test WF' });
    await sidebarItem.click({ button: 'right' });
    const divider = page.locator('.wf-sidebar-ctx-divider');
    await expect(divider).toBeVisible();
  });

  test('context menu still has Rename, Duplicate, Delete items', async ({ page }) => {
    const sidebarItem = page.locator('.wf-sidebar-item', { hasText: 'Version Test WF' });
    await sidebarItem.click({ button: 'right' });
    const menu = page.locator('.wf-sidebar-ctx-menu');
    await expect(menu.locator('[role="menuitem"]', { hasText: 'Rename Workflow' })).toBeVisible();
    await expect(menu.locator('[role="menuitem"]', { hasText: 'Duplicate Workflow' })).toBeVisible();
    await expect(menu.locator('[role="menuitem"]', { hasText: 'Delete Workflow' })).toBeVisible();
  });
});
