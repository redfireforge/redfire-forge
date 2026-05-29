import { test, expect, type Page } from '@playwright/test';

// Persistence assertions depend on ordered localStorage/IndexedDB transitions.
test.describe.configure({ mode: 'serial' });

/**
 * Seed initial data: environments, microservices, a request collection with
 * microservice binding, and one empty workflow.
 */
/**
 * Uses addInitScript with a guard: only seeds if workflows key doesn't exist
 * yet. This prevents overwriting persisted data on page.reload().
 * We also seed non-workflow data unconditionally since it doesn't change.
 */
async function seedPersistenceData(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('perf-test-v3-environments', JSON.stringify([
      { id: 'env-1', name: 't01' },
    ]));
    localStorage.setItem('perf-test-v3-microservices', JSON.stringify([
      {
        id: 'ms-persist', name: 'PersistAPI',
        baseUrls: { 'env-1': 'https://api.example.com' },
      },
    ]));
    localStorage.setItem('perf-test-v3-feature-groups', '[]');
    localStorage.setItem('perf-test-v3-selected-env', 'env-1');
    localStorage.setItem('perf-test-v3-selected-svc', 'ms-persist');
    localStorage.setItem('perf-test-v3-migrated', 'true');
    localStorage.setItem('perf-test-theme', 'dark');
    localStorage.setItem('redfire-onboarding-dismissed', JSON.stringify([
      'palette-drag', 'command-palette', 'node-config', 'connect-nodes', 'quick-test',
    ]));

    localStorage.setItem('perf-test-requests', JSON.stringify({
      collections: [
        {
          id: 'col-persist',
          name: 'PersistColl',
          microserviceId: 'ms-persist',
          requests: [
            { id: 'req-a', name: 'Get Users', url: 'https://api.example.com/users', method: 'GET', headers: [], body: '' },
            { id: 'req-b', name: 'Get Posts', url: 'https://api.example.com/posts', method: 'GET', headers: [], body: '' },
            { id: 'req-c', name: 'Create User', url: 'https://api.example.com/users', method: 'POST', headers: [], body: '{"name":"test"}', bodyType: 'json' },
          ],
          folders: [],
        },
      ],
    }));

    // Only seed workflow data on the very first load (not on reloads).
    // Use a sessionStorage flag since it survives across reloads within the same tab
    // but the app migrates workflows from localStorage to IndexedDB on first load.
    if (!sessionStorage.getItem('__e2e_wf_seeded__')) {
      sessionStorage.setItem('__e2e_wf_seeded__', '1');
      const startNodeId = crypto.randomUUID();
      localStorage.setItem('workflows', JSON.stringify([
        {
          id: 'wf-persist',
          name: 'Persist WF',
          schemaVersion: 6,
          variables: {},
          hostProfiles: [],
          authProfiles: [],
          services: [],
          nodes: [{ id: startNodeId, type: 'start', position: { x: 250, y: 50 }, data: { label: 'Start', inputVariables: {} } }],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ]));
      localStorage.setItem('selectedWorkflowId', JSON.stringify('wf-persist'));
    }
  });
}

function getWorkflowFromStorage(page: Page) {
  return page.evaluate(async () => {
    // Try IndexedDB first (v5+), fall back to localStorage
    let raw: string | null = null;
    try {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open('redfireforge');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (db.objectStoreNames.contains('workflows')) {
        const idbVal = await new Promise<unknown>((_resolve) => {
          const t = db.transaction('workflows', 'readonly');
          const r = t.objectStore('workflows').get('all');
          r.onsuccess = () => _resolve(r.result ?? null);
          r.onerror = () => _resolve(null);
        });
        raw = idbVal ? JSON.stringify(idbVal) : null;
      }
      db.close();
    } catch { /* fallback */ }
    if (!raw) raw = localStorage.getItem('workflows');
    if (!raw) return null;
    const wfs = JSON.parse(raw);
    const wf = wfs.find((w: { id: string }) => w.id === 'wf-persist');
    if (!wf) return null;
    return {
      nodeCount: (wf.nodes as unknown[]).length,
      nodeTypes: (wf.nodes as { type: string }[]).map(n => n.type),
      nodeLabels: (wf.nodes as { data?: { label?: string } }[]).map(n => n.data?.label ?? '(no label)'),
      serviceCount: (wf.services as unknown[] ?? []).length,
    };
  });
}

test.describe('Workflow persistence across hard refresh', () => {
  test('nodes added from BLOCKS palette persist after reload', async ({ page }) => {
    await seedPersistenceData(page);
    await page.goto('http://localhost:5173/?tab=workflow');

    // Wait for canvas to load
    await expect(page.locator('.react-flow__node')).toHaveCount(1, { timeout: 10000 });

    // Add 3 HTTP nodes from the blocks palette
    const httpBlock = page.locator('button.wf-palette-block-http');
    for (let i = 0; i < 3; i++) {
      await httpBlock.click();
      await page.waitForTimeout(300);
    }

    // Should now have 4 nodes on canvas
    await expect(page.locator('.react-flow__node')).toHaveCount(4, { timeout: 5000 });

    // Wait for persistence to flush
    await page.waitForTimeout(1000);

    // Verify localStorage before reload
    const before = await getWorkflowFromStorage(page);
    expect(before?.nodeCount).toBe(4);

    // Hard refresh
    await page.reload();
    await expect(page.locator('.react-flow__node')).toHaveCount(4, { timeout: 10000 });

    const after = await getWorkflowFromStorage(page);
    expect(after?.nodeCount).toBe(4);
  });

  test('nodes added from REQUESTS palette persist after reload', async ({ page }) => {
    await seedPersistenceData(page);
    await page.goto('http://localhost:5173/?tab=workflow');

    await expect(page.locator('.react-flow__node')).toHaveCount(1, { timeout: 10000 });

    // Switch to REQUESTS tab
    await page.locator('.wf-palette-tabs button:nth-child(2)').click();
    await page.waitForTimeout(300);

    // Expand PersistColl collection
    await page.locator('.wf-palette-group-header:has-text("PersistColl")').click();
    await page.waitForTimeout(300);

    // Click on each of the 3 requests to add them
    const requestItems = page.locator('button.wf-palette-item');
    await expect(requestItems).toHaveCount(3, { timeout: 5000 });

    for (let i = 0; i < 3; i++) {
      await requestItems.nth(i).click();
      await page.waitForTimeout(300);
    }

    // Should have 4 nodes (start + 3 requests)
    await expect(page.locator('.react-flow__node')).toHaveCount(4, { timeout: 5000 });

    // Verify localStorage
    const before = await getWorkflowFromStorage(page);
    expect(before?.nodeCount).toBe(4);

    // Hard refresh
    await page.reload();
    await expect(page.locator('.react-flow__node')).toHaveCount(4, { timeout: 10000 });

    const after = await getWorkflowFromStorage(page);
    expect(after?.nodeCount).toBe(4);
  });

  test('rapidly added nodes from palette all persist', async ({ page }) => {
    await seedPersistenceData(page);
    await page.goto('http://localhost:5173/?tab=workflow');

    await expect(page.locator('.react-flow__node')).toHaveCount(1, { timeout: 10000 });

    // Rapidly add 5 HTTP nodes with minimal delay
    const httpBlock = page.locator('button.wf-palette-block-http');
    for (let i = 0; i < 5; i++) {
      await httpBlock.click();
    }

    // Wait for all nodes to appear
    await expect(page.locator('.react-flow__node')).toHaveCount(6, { timeout: 10000 });

    // Small delay for persistence to flush
    await page.waitForTimeout(500);

    const before = await getWorkflowFromStorage(page);
    expect(before?.nodeCount).toBe(6);

    // Hard refresh
    await page.reload();
    await expect(page.locator('.react-flow__node')).toHaveCount(6, { timeout: 10000 });

    const after = await getWorkflowFromStorage(page);
    expect(after?.nodeCount).toBe(6);
  });
});
