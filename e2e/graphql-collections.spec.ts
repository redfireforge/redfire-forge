/**
 * graphql-collections.spec.ts — E2E for GraphQL Studio collections panel (Phase 4).
 *
 * No live server required — tests local IDB CRUD, save/load, export/import.
 */

import { test, expect } from '@playwright/test';
import { fillMonacoEditor, gotoGqlStudio, type Page } from './graphql-helpers';

const SAMPLE_QUERY = 'query GetHealth { health }';

async function clearGraphqlCollections(page: Page) {
  await page.evaluate(() =>
    new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('redfireforge');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const stores = ['graphql-collections', 'graphql-collection-folders', 'graphql-collection-items'];
        const tx = db.transaction(stores.filter((s) => db.objectStoreNames.contains(s)), 'readwrite');
        for (const s of stores) {
          if (db.objectStoreNames.contains(s)) tx.objectStore(s).clear();
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    }),
  );
}

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeEach(async ({ page }) => {
  await gotoGqlStudio(page);
  await clearGraphqlCollections(page);
  await fillMonacoEditor(page, SAMPLE_QUERY);
});

async function openCollectionsPanel(page: Page) {
  await page.locator('[data-testid="gql-activity-collections"]').click();
  await expect(page.locator('[data-testid="gql-collections-panel"]')).toBeVisible();
}

async function saveOperationToCollection(page: Page, operationName: string) {
  await page.locator('[data-testid="gql-collections-new"]').click();
  await expect(page.locator('[data-testid="gql-col-node"]')).toBeVisible({ timeout: 5_000 });
  await page.locator('.gql-col-node-header').first().click();
  const saveBtn = page.locator('[data-testid="gql-col-save-current"]').first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click({ force: true });
  await page.locator('.gql-collections-save-input').fill(operationName);
  await page.locator('.gql-collections-save-confirm').click();
  await expect(page.locator('[data-testid="gql-col-item"]', { hasText: operationName })).toBeVisible({ timeout: 5_000 });
}

test('create collection and save current operation', async ({ page }) => {
  await openCollectionsPanel(page);
  await saveOperationToCollection(page, 'Health Check');
});

test('double-click collection item loads query into editor', async ({ page }) => {
  await openCollectionsPanel(page);
  await saveOperationToCollection(page, 'Load Me');

  await fillMonacoEditor(page, 'query { __typename }');
  await page.locator('[data-testid="gql-col-item"]').dblclick();

  await page.waitForFunction(() => {
    const w = window as unknown as Record<string, unknown>;
    const monaco = w['monaco'] as { editor?: { getModels?: () => { getValue: () => string }[] } };
    const models = monaco?.editor?.getModels?.() ?? [];
    return models.some((m) => m.getValue().includes('GetHealth') || m.getValue().includes('health'));
  }, { timeout: 5_000 });
});

test('export collections produces valid JSON download', async ({ page }) => {
  await openCollectionsPanel(page);
  await saveOperationToCollection(page, 'Export Test');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-testid="gql-collections-export"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/redfire-graphql-collections.*\.json$/);

  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import('fs');
  const raw = JSON.parse(fs.readFileSync(path!, 'utf-8')) as { collections?: unknown[]; _exportMeta?: unknown };
  expect(Array.isArray(raw.collections)).toBe(true);
  expect(raw.collections!.length).toBeGreaterThan(0);
});

test('import collections round-trip via file upload', async ({ page }) => {
  await openCollectionsPanel(page);

  const exportData = {
    _exportMeta: { version: '1.1', exportedAt: Date.now(), appVersion: 'e2e' },
    collections: [{
      collection: { id: 'col-import-e2e', name: 'Imported Collection', variables: {}, createdAt: Date.now(), updatedAt: Date.now() },
      folders: [],
      items: [{
        id: 'item-import-e2e',
        collectionId: 'col-import-e2e',
        name: 'Imported Op',
        isPinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        operation: {
          id: 'op-import',
          name: 'ImportedOp',
          query: 'query Imported { health }',
          variables: '{}',
          operationType: 'query',
          headers: [],
        },
      }],
    }],
  };

  const tmpPath = `/tmp/gql-collections-e2e-${Date.now()}.json`;
  const fs = await import('fs');
  fs.writeFileSync(tmpPath, JSON.stringify(exportData, null, 2));

  await page.locator('[data-testid="gql-collections-import"]').click();
  await page.locator('[data-testid="gql-collections-import-input"]').setInputFiles(tmpPath);
  await expect(page.locator('[data-testid="gql-import-mode-dialog"]')).toBeVisible();
  await page.locator('[data-testid="gql-import-mode-merge"]').click();

  const importedNode = page.locator('[data-testid="gql-col-node"]', { hasText: 'Imported Collection' });
  await expect(importedNode).toBeVisible({ timeout: 8_000 });
  await importedNode.locator('.gql-col-node-header').click();
  await expect(page.locator('[data-testid="gql-col-item"]', { hasText: 'Imported Op' })).toBeVisible({ timeout: 8_000 });

  fs.unlinkSync(tmpPath);
});

test('collections search filters visible items', async ({ page }) => {
  await openCollectionsPanel(page);
  await saveOperationToCollection(page, 'Alpha Query');

  await page.locator('[data-testid="gql-collections-search"]').fill('Alpha');
  await expect(page.locator('[data-testid="gql-col-item"]')).toContainText('Alpha Query');
  await expect(page.locator('[data-testid="gql-col-item"]')).toHaveCount(1);

  await page.locator('[data-testid="gql-collections-search"]').fill('no-match-xyz');
  await expect(page.locator('[data-testid="gql-col-item"]')).toHaveCount(0);
});
