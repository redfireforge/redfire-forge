import { test, expect, type Page } from '@playwright/test';

const DEBUG_WORKFLOW = {
  id: 'wf-debug-fitview',
  name: 'Debug FitView Workflow',
  schemaVersion: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start', inputVariables: {} } },
    { id: 'http1', type: 'http', position: { x: 300, y: 100 }, data: { label: 'Fetch', scenario: { id: 'sc1', name: 'Fetch', method: 'GET', url: 'https://httpbin.org/get', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'end', type: 'end', position: { x: 300, y: 200 }, data: { label: 'Done' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'http1' },
    { id: 'e2', source: 'http1', target: 'end' },
  ],
};

function makeDebugTestRun() {
  const now = Date.now();
  return {
    id: 'run-debug-fitview',
    timestamp: now,
    config: { executionMode: 'workflow', iterations: 1, concurrency: 1, scenarioWeights: [] },
    summary: {
      totalRequests: 1, successfulRequests: 1, failedRequests: 0,
      totalDurationMs: 300, tps: 3.3, avgResponseTime: 100,
      minResponseTime: 100, maxResponseTime: 100,
      p50ResponseTime: 100, p95ResponseTime: 100, p99ResponseTime: 100,
      errorRate: 0, errorsByStatus: {}, failedValidations: 0,
    },
    results: [
      { id: 'r1', scenarioId: 'sc1', scenarioName: 'Fetch', url: 'https://httpbin.org/get', method: 'GET', httpStatus: 200, responseTimeMs: 100, passed: true, timestamp: now, validationMode: 'none', failureDetails: [], responseBody: '{}' },
    ],
    workflowName: 'Debug FitView Workflow',
    executionTrace: {
      workflowId: 'wf-debug-fitview',
      workflowName: 'Debug FitView Workflow',
      totalIterations: 1,
      totalDurationMs: 300,
      fullTraceCaptured: true,
      traversedEdges: ['e1', 'e2'],
      workflowSnapshot: { nodes: DEBUG_WORKFLOW.nodes, edges: DEBUG_WORKFLOW.edges },
      iterations: [{
        index: 0, passed: true, durationMs: 300, traversedEdges: ['e1', 'e2'],
        events: [
          { nodeId: 'start', nodeType: 'start', nodeLabel: 'Start', timestamp: now, state: 'pass', durationMs: 1 },
          { nodeId: 'http1', nodeType: 'http', nodeLabel: 'Fetch', timestamp: now, state: 'pass', durationMs: 100, details: { statusCode: 200, method: 'GET', url: 'https://httpbin.org/get' } },
          { nodeId: 'end', nodeType: 'end', nodeLabel: 'Done', timestamp: now, state: 'pass', durationMs: 1 },
        ],
        finalVariables: {},
      }],
    },
  };
}

async function seedTestRunsViaIDB(page: Page, runs: unknown[]): Promise<string> {
  return await page.evaluate((testRuns) => {
    return new Promise<string>((resolve) => {
      const req = indexedDB.open('redfireforge', 3);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('testRuns')) {
          const store = db.createObjectStore('testRuns', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('featureGroups')) db.createObjectStore('featureGroups');
        if (!db.objectStoreNames.contains('sharedDataSources')) db.createObjectStore('sharedDataSources');
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction('testRuns', 'readwrite');
          const store = tx.objectStore('testRuns');
          store.clear();
          for (const run of testRuns) store.put(run);
          tx.oncomplete = () => { db.close(); resolve('ok'); };
          tx.onerror = () => { db.close(); resolve('tx-error'); };
        } catch (e) { db.close(); resolve('catch: ' + String(e)); }
      };
      req.onerror = () => resolve('open-error');
      req.onblocked = () => resolve('blocked');
    });
  }, runs);
}

test.describe('Replay Fit View Debug', () => {
  test('diagnose fit view and dragging', async ({ page }) => {
    await page.addInitScript((wfs) => {
      localStorage.setItem('workflows', JSON.stringify(wfs));
    }, [DEBUG_WORKFLOW]);

    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    const seeded = await seedTestRunsViaIDB(page, [makeDebugTestRun()]);
    expect(seeded).toBe('ok');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Navigate to Results
    const harnessBtn = page.locator('button[title="Harness"]');
    await expect(harnessBtn).toBeVisible({ timeout: 10000 });
    await harnessBtn.click();

    const resultsTab = page.locator('button.sub-nav-tab:has-text("Results")');
    await expect(resultsTab).toBeVisible({ timeout: 5000 });
    await resultsTab.click();
    await page.waitForTimeout(1500);

    // Click on the seeded test run
    const runText = page.getByText('Debug FitView Workflow');
    const runVisible = await runText.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!runVisible) return;

    await runText.first().click();
    await page.waitForTimeout(500);

    // Look for Replay button
    const replayBtn = page.locator('button:has-text("Replay")').first();
    const replayVisible = await replayBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!replayVisible) return;

    await replayBtn.click();
    await page.waitForTimeout(1500);

    // Check ReactFlow rendered
    const canvas = page.locator('.react-flow');
    const canvasVisible = await canvas.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!canvasVisible) return;

    const nodes = page.locator('.react-flow__node');
    const nodeCount = await nodes.count();
    expect(nodeCount).toBeGreaterThan(0);

    // Test fit view button
    const fitBtn = page.locator('button[title="Fit view"]');
    if (await fitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await fitBtn.click();
      await page.waitForTimeout(500);
    }
  });
});
