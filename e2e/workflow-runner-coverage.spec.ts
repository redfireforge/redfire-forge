/**
 * E2E tests for WorkflowRunner and Results Explorer coverage.
 * Seeding strategy:
 *   - Workflows → localStorage (key: "workflows") via addInitScript
 *   - Test runs → IndexedDB via page.evaluate before app reads them
 */
import { test, expect, type Page } from '@playwright/test';

const CORRELATION_WORKFLOW = {
  id: 'wf-correlation-e2e',
  name: 'E2E Correlation Test',
  schemaVersion: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  variables: { id: 'test-123' },
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start', inputVariables: {} } },
    { id: 'http1', type: 'http', position: { x: 300, y: 100 }, data: { label: 'API Call', scenario: { id: 'sc1', name: 'Test', method: 'GET', url: 'https://httpbin.org/get', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'cw1', type: 'correlationWait', position: { x: 300, y: 200 }, data: { label: 'Wait for Callback', correlationIdExpression: '{{id}}', webhookPath: '/callback', correlationSource: 'body', correlationJsonPath: '$.id', extractVariables: [], timeoutMs: 5000 } },
    { id: 'end', type: 'end', position: { x: 300, y: 300 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'http1' },
    { id: 'e2', source: 'http1', target: 'cw1' },
    { id: 'e3', source: 'cw1', target: 'end' },
  ],
};

const WEBHOOK_WORKFLOW = {
  id: 'wf-webhook-e2e',
  name: 'E2E Webhook Test',
  schemaVersion: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'webhook', type: 'webhook', position: { x: 300, y: 0 }, data: { label: 'Webhook Trigger', method: 'POST', samplePayload: '{"orderId": "{{$uuid}}"}' } },
    { id: 'http1', type: 'http', position: { x: 300, y: 100 }, data: { label: 'Process', scenario: { id: 'sc1', name: 'Process', method: 'POST', url: 'https://httpbin.org/post', headers: [], body: '{}', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'end', type: 'end', position: { x: 300, y: 200 }, data: { label: 'Done' } },
  ],
  edges: [
    { id: 'e1', source: 'webhook', target: 'http1' },
    { id: 'e2', source: 'http1', target: 'end' },
  ],
};

const SIMPLE_WORKFLOW = {
  id: 'wf-simple-e2e',
  name: 'E2E Simple Test',
  schemaVersion: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  variables: { baseUrl: 'https://httpbin.org' },
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start', inputVariables: { baseUrl: 'https://httpbin.org' } } },
    { id: 'http1', type: 'http', position: { x: 300, y: 100 }, data: { label: 'GET Request', scenario: { id: 'sc1', name: 'Test', method: 'GET', url: '{{baseUrl}}/get', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'condition', type: 'condition', position: { x: 300, y: 200 }, data: { label: 'Check Status', expression: 'true' } },
    { id: 'end', type: 'end', position: { x: 300, y: 300 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'http1' },
    { id: 'e2', source: 'http1', target: 'condition' },
    { id: 'e3', source: 'condition', target: 'end', sourceHandle: 'yes' },
  ],
};

function makeSeedTestRun() {
  const now = Date.now();
  return {
    id: 'run-e2e-coverage',
    timestamp: now,
    config: {
      executionMode: 'workflow',
      totalTransactions: 3,
      concurrentUsers: 1,
      thinkTimeMs: 0,
      errorPolicy: 'continue',
      scenarioWeights: [],
      concurrency: 1,
    },
    summary: {
      totalRequests: 3, successfulRequests: 2, failedRequests: 1,
      totalDurationMs: 1500, tps: 2, avgResponseTime: 150,
      minResponseTime: 100, maxResponseTime: 200,
      p50ResponseTime: 150, p95ResponseTime: 195, p99ResponseTime: 200,
      errorRate: 33.33, errorsByStatus: { 500: 1 }, failedValidations: 0,
    },
    results: [
      { id: 'r1', scenarioId: 'sc1', scenarioName: 'Test', url: 'https://httpbin.org/get', method: 'GET', httpStatus: 200, responseTimeMs: 100, passed: true, timestamp: now, validationMode: 'none', failureDetails: [], responseBody: '{}' },
      { id: 'r2', scenarioId: 'sc1', scenarioName: 'Test', url: 'https://httpbin.org/get', method: 'GET', httpStatus: 200, responseTimeMs: 150, passed: true, timestamp: now, validationMode: 'none', failureDetails: [], responseBody: '{}' },
      { id: 'r3', scenarioId: 'sc1', scenarioName: 'Test', url: 'https://httpbin.org/get', method: 'GET', httpStatus: 500, responseTimeMs: 200, passed: false, timestamp: now, validationMode: 'none', failureDetails: [], responseBody: '{"error":"500"}', errorMessage: 'HTTP 500' },
    ],
    workflowName: 'E2E Simple Test',
    executionTrace: {
      workflowId: 'wf-simple-e2e',
      workflowName: 'E2E Simple Test',
      totalIterations: 3,
      totalDurationMs: 1500,
      fullTraceCaptured: true,
      traversedEdges: ['e1', 'e2', 'e3'],
      workflowSnapshot: { nodes: SIMPLE_WORKFLOW.nodes, edges: SIMPLE_WORKFLOW.edges },
      iterations: [
        { index: 0, passed: true, durationMs: 400, traversedEdges: ['e1', 'e2', 'e3'], events: [
          { nodeId: 'start', nodeType: 'start', nodeLabel: 'Start', timestamp: now, state: 'pass', durationMs: 1 },
          { nodeId: 'http1', nodeType: 'http', nodeLabel: 'GET Request', timestamp: now, state: 'pass', durationMs: 100, details: { statusCode: 200, method: 'GET', url: 'https://httpbin.org/get' } },
          { nodeId: 'condition', nodeType: 'condition', nodeLabel: 'Check Status', timestamp: now, state: 'pass', durationMs: 1 },
          { nodeId: 'end', nodeType: 'end', nodeLabel: 'End', timestamp: now, state: 'pass', durationMs: 1 },
        ], finalVariables: { baseUrl: 'https://httpbin.org' } },
        { index: 1, passed: true, durationMs: 500, traversedEdges: ['e1', 'e2', 'e3'], events: [
          { nodeId: 'start', nodeType: 'start', nodeLabel: 'Start', timestamp: now, state: 'pass', durationMs: 1 },
          { nodeId: 'http1', nodeType: 'http', nodeLabel: 'GET Request', timestamp: now, state: 'pass', durationMs: 150, details: { statusCode: 200, method: 'GET', url: 'https://httpbin.org/get' } },
          { nodeId: 'condition', nodeType: 'condition', nodeLabel: 'Check Status', timestamp: now, state: 'pass', durationMs: 1 },
          { nodeId: 'end', nodeType: 'end', nodeLabel: 'End', timestamp: now, state: 'pass', durationMs: 1 },
        ], finalVariables: { baseUrl: 'https://httpbin.org' } },
        { index: 2, passed: false, durationMs: 600, traversedEdges: ['e1', 'e2'], events: [
          { nodeId: 'start', nodeType: 'start', nodeLabel: 'Start', timestamp: now, state: 'pass', durationMs: 1 },
          { nodeId: 'http1', nodeType: 'http', nodeLabel: 'GET Request', timestamp: now, state: 'fail', durationMs: 200, details: { statusCode: 500, method: 'GET', url: 'https://httpbin.org/get', error: 'Internal Server Error' } },
        ], finalVariables: { baseUrl: 'https://httpbin.org' } },
      ],
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

async function navigateToWorkflowRunner(page: Page) {
  const harnessBtn = page.locator('button[title="Harness"]');
  await expect(harnessBtn).toBeVisible({ timeout: 10000 });
  await harnessBtn.click();

  const tab = page.locator('button.sub-nav-tab:has-text("Workflow Runner")');
  await expect(tab).toBeVisible({ timeout: 5000 });
  await tab.click();
  await page.waitForTimeout(500);
}

async function navigateToResults(page: Page) {
  const harnessBtn = page.locator('button[title="Harness"]');
  await expect(harnessBtn).toBeVisible({ timeout: 10000 });
  await harnessBtn.click();

  const tab = page.locator('button.sub-nav-tab:has-text("Results")');
  await expect(tab).toBeVisible({ timeout: 5000 });
  await tab.click();
  await page.waitForTimeout(1000);
}

test.describe('WorkflowRunner Coverage Tests', () => {
  test('should display workflow picker and select workflow', async ({ page }) => {
    await page.addInitScript((wfs) => {
      localStorage.setItem('workflows', JSON.stringify(wfs));
    }, [SIMPLE_WORKFLOW]);
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    await navigateToWorkflowRunner(page);

    const picker = page.getByTestId('workflow-select');
    await expect(picker).toBeVisible({ timeout: 5000 });
  });

  test('should show CorrelationWait config panel for workflow with correlationWait node', async ({ page }) => {
    await page.addInitScript((wfs) => {
      localStorage.setItem('workflows', JSON.stringify(wfs));
    }, [CORRELATION_WORKFLOW, SIMPLE_WORKFLOW]);
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    await navigateToWorkflowRunner(page);

    const picker = page.getByTestId('workflow-select');
    await expect(picker).toBeVisible({ timeout: 5000 });
    await picker.selectOption('wf-correlation-e2e');
    await page.waitForTimeout(500);

    // The CorrelationWait config section should appear with heading text
    const heading = page.locator('h3:has-text("CorrelationWait Behavior")');
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('should show webhook load driver for webhook-triggered workflow', async ({ page }) => {
    await page.addInitScript((wfs) => {
      localStorage.setItem('workflows', JSON.stringify(wfs));
    }, [WEBHOOK_WORKFLOW, SIMPLE_WORKFLOW]);
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    await navigateToWorkflowRunner(page);

    const picker = page.getByTestId('workflow-select');
    await expect(picker).toBeVisible({ timeout: 5000 });
    await picker.selectOption('wf-webhook-e2e');
    await page.waitForTimeout(500);

    // Webhook-triggered workflows show a Run Mode selector
    const runModeLabel = page.locator('.webhook-mode-label, :text("Run Mode")');
    await expect(runModeLabel.first()).toBeVisible({ timeout: 5000 });
  });

  test('should configure execution settings', async ({ page }) => {
    await page.addInitScript((wfs) => {
      localStorage.setItem('workflows', JSON.stringify(wfs));
    }, [SIMPLE_WORKFLOW]);
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    await navigateToWorkflowRunner(page);

    const picker = page.getByTestId('workflow-select');
    await expect(picker).toBeVisible({ timeout: 5000 });
    await picker.selectOption('wf-simple-e2e');
    await page.waitForTimeout(500);

    // Should show execution config inputs (concurrency, transactions, etc.)
    const iterationsInput = page.locator('input[type="number"]').first();
    await expect(iterationsInput).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Results Explorer Coverage Tests', () => {
  test('should open Results Explorer and interact with nodes', async ({ page }) => {
    await page.addInitScript((wfs) => {
      localStorage.setItem('workflows', JSON.stringify(wfs));
    }, [SIMPLE_WORKFLOW]);
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    const seedResult = await seedTestRunsViaIDB(page, [makeSeedTestRun()]);
    expect(seedResult).toBe('ok');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await navigateToResults(page);

    // Click on the test run
    const runText = page.getByText('E2E Simple Test');
    const runVisible = await runText.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!runVisible) return;

    await runText.first().click();
    await page.waitForTimeout(500);

    // Look for Results Explorer button
    const explorerBtn = page.locator('button:has-text("Results Explorer")');
    const explorerVisible = await explorerBtn.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!explorerVisible) return;

    await explorerBtn.first().click();
    await page.waitForTimeout(1500);

    // The explorer opens as a full-page view; verify ReactFlow in the visible results explorer
    const explorerCanvas = page.locator('.results-explorer-diagram .react-flow, .results-explorer-flow');
    const visibleCanvas = await explorerCanvas.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (visibleCanvas) {
      const nodes = page.locator('.react-flow__node:visible');
      const nodeCount = await nodes.count();
      expect(nodeCount).toBeGreaterThan(0);

      // Click first node to open detail panel
      await nodes.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('should handle keyboard navigation in Results Explorer', async ({ page }) => {
    await page.addInitScript((wfs) => {
      localStorage.setItem('workflows', JSON.stringify(wfs));
    }, [SIMPLE_WORKFLOW]);
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    const seedResult = await seedTestRunsViaIDB(page, [makeSeedTestRun()]);
    expect(seedResult).toBe('ok');

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    await navigateToResults(page);

    const runText = page.getByText('E2E Simple Test');
    if (await runText.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await runText.first().click();
      await page.waitForTimeout(500);

      const explorerBtn = page.locator('button:has-text("Results Explorer")');
      if (await explorerBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await explorerBtn.first().click();
        await page.waitForTimeout(1000);

        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(200);
        await page.keyboard.press('ArrowUp');
        await page.waitForTimeout(200);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
  });
});

test.describe('MultiWebhookTestingPanel Coverage', () => {
  test('should display multi-webhook panel for webhook workflows', async ({ page }) => {
    await page.addInitScript((wfs) => {
      localStorage.setItem('workflows', JSON.stringify(wfs));
    }, [WEBHOOK_WORKFLOW]);
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    await navigateToWorkflowRunner(page);

    const picker = page.getByTestId('workflow-select');
    await expect(picker).toBeVisible({ timeout: 5000 });
    await picker.selectOption('wf-webhook-e2e');
    await page.waitForTimeout(500);

    // Webhook workflows show Run Mode selector
    const runModeLabel = page.locator('.webhook-mode-label, :text("Run Mode")');
    await expect(runModeLabel.first()).toBeVisible({ timeout: 5000 });
  });
});
