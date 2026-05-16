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

test.describe('Data Mapper drag-and-drop', () => {
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

  test('supports insert/update left-to-right drag-drop for all source value types', async ({ page }) => {
    const mapperModal = await openSharedDataSourceMapper(page);

    await mapperModal.locator('button[aria-label="Fetch live sample"]').dispatchEvent('click');
    await expect(
      mapperModal.locator('.dm-panel--source .dm-tree-node[data-path="textValue"]'),
    ).toBeVisible();

    const targetNode = mapperModal.locator('.dm-panel--target .dm-tree-node--leaf[data-path="column"]').first();
    await expect(targetNode).toBeVisible();

    const sourcePaths = [
      'objectValue',
      'arrayValue',
      'textValue',
      'numberValue',
      'boolValue',
      'nullValue',
    ];

    for (const sourcePath of sourcePaths) {
      const sourceNode = mapperModal.locator(`.dm-panel--source .dm-tree-node[data-path="${sourcePath}"]`).first();
      await expect(sourceNode).toBeVisible();
      await dragSourceToTarget(sourceNode, targetNode);
      await expect(targetNode.locator('.dm-mapped-src-ref')).toHaveText(sourcePath);
    }

    await mapperModal.locator('.dm-modal-footer button', { hasText: 'Save' }).dispatchEvent('click');
    await expect(mapperModal).not.toBeVisible();
  });
});
