import { test, expect, type Locator, type Page } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleRows = [
  {
    textValue: 'alpha',
    numberValue: 42,
    boolValue: true,
    objectValue: { nested: 'x' },
    arrayValue: [1, 2, 3],
    nullValue: null,
  },
];

async function openSharedDataSourceMapper(page: Page): Promise<Locator> {
  await page.locator('.header-actions button', { hasText: 'Shared Data Sources' }).click();
  await page.locator('.shared-ds-new-btn').click();
  await page.locator('.shared-ds-fetch-url').fill('https://api.example.com/users?column=');
  await page.locator('.shared-ds-fetch-actions .btn', { hasText: 'Populate Rows from API' }).click();

  const mapperModal = page.locator('.dm-modal-overlay');
  await expect(mapperModal).toBeVisible();
  return mapperModal;
}

async function dragSourceToTarget(sourceNode: Locator, targetNode: Locator): Promise<void> {
  await sourceNode.scrollIntoViewIfNeeded();
  await targetNode.scrollIntoViewIfNeeded();
  await sourceNode.dragTo(targetNode);
}

test.describe('Data Mapper UX critical paths', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.route('**/__proxy', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(sampleRows),
        }),
      });
    });
    await page.goto('/?tab=scenarios');
    await page.waitForSelector('.header-actions', { timeout: 10000 });
  });

  test('creates first mapping via drag-drop and saves', async ({ page }) => {
    const mapperModal = await openSharedDataSourceMapper(page);
    await mapperModal.locator('button[aria-label="Fetch live sample"]').dispatchEvent('click');

    const sourceNode = mapperModal.locator('.dm-panel--source .dm-tree-node[data-path="textValue"]').first();
    const targetNode = mapperModal.locator('.dm-panel--target .dm-tree-node--leaf[data-path="column"]').first();
    await expect(sourceNode).toBeVisible();
    await expect(targetNode).toBeVisible();

    await dragSourceToTarget(sourceNode, targetNode);
    await expect(targetNode.locator('.dm-mapped-src-ref')).toHaveText('textValue');

    await mapperModal.locator('.dm-modal-footer button', { hasText: 'Save' }).click();
    await expect(mapperModal).not.toBeVisible();
  });

  test('toggles advanced controls and keeps bottom utility surface singular', async ({ page }) => {
    const mapperModal = await openSharedDataSourceMapper(page);
    await mapperModal.locator('button[aria-label="Fetch live sample"]').dispatchEvent('click');

    const sourceNode = mapperModal.locator('.dm-panel--source .dm-tree-node[data-path="textValue"]').first();
    const targetNode = mapperModal.locator('.dm-panel--target .dm-tree-node--leaf[data-path="column"]').first();
    await dragSourceToTarget(sourceNode, targetNode);

    const advancedToggle = mapperModal.locator('button[aria-label="Toggle advanced controls"]');
    const advancedPanel = mapperModal.locator('.dm-toolbar-advanced-panel');
    await expect(advancedToggle).toBeVisible();
    const expandedBefore = await advancedToggle.getAttribute('aria-expanded');
    await advancedToggle.click();
    const expandedAfterFirst = await advancedToggle.getAttribute('aria-expanded');
    expect(expandedAfterFirst).not.toBe(expandedBefore);
    if (expandedAfterFirst === 'true') {
      await expect(advancedPanel).toBeVisible();
    } else {
      await expect(advancedPanel).toHaveCount(0);
    }
    await advancedToggle.click();
    const expandedAfterSecond = await advancedToggle.getAttribute('aria-expanded');
    expect(expandedAfterSecond).toBe(expandedBefore);
    if (expandedAfterSecond === 'true') {
      await expect(advancedPanel).toBeVisible();
    } else {
      await expect(advancedPanel).toHaveCount(0);
    }

    await mapperModal.locator('.dm-toolbar-cluster--view button', { hasText: 'Code' }).click();
    await expect(mapperModal.locator('.dm-bottom-utility-dock .dm-code-view')).toBeVisible();
    await mapperModal.locator('button[role="tab"]', { hasText: 'Table' }).click();
    await expect(mapperModal.locator('.dm-code-table-search')).toBeVisible();

    await mapperModal.locator('.dm-toolbar-cluster--view button', { hasText: 'Preview' }).click();
    await expect(mapperModal.locator('.dm-bottom-utility-dock .dm-preview-bar')).toBeVisible();
    await expect(mapperModal.locator('.dm-bottom-utility-dock .dm-code-view')).toHaveCount(0);
  });

  test('supports explicit cancel exit path', async ({ page }) => {
    const mapperModal = await openSharedDataSourceMapper(page);
    await mapperModal.locator('.dm-modal-footer button', { hasText: 'Cancel' }).click();
    await expect(mapperModal).not.toBeVisible();
  });

  test('clear all keeps schema visible and removes mapping badges', async ({ page }) => {
    const mapperModal = await openSharedDataSourceMapper(page);
    await mapperModal.locator('button[aria-label="Fetch live sample"]').dispatchEvent('click');

    const sourceNode = mapperModal.locator('.dm-panel--source .dm-tree-node[data-path="textValue"]').first();
    const targetLeaf = mapperModal.locator('.dm-panel--target .dm-tree-node--leaf[data-path="column"]').first();
    await expect(sourceNode).toBeVisible();
    await expect(targetLeaf).toBeVisible();
    await dragSourceToTarget(sourceNode, targetLeaf);
    await expect(targetLeaf.locator('.dm-mapped-src-ref')).toHaveText('textValue');

    await mapperModal.locator('.dm-toolbar-cluster--core button', { hasText: 'Clear all' }).click();
    await expect(mapperModal.locator('.dm-panel--target .dm-tree-node[data-path=""]')).toBeVisible();
    await expect(targetLeaf).toBeVisible();
    await expect(targetLeaf.locator('.dm-mapped-src-ref')).toHaveCount(0);
  });
});
