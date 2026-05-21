import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for Sub-Workflow Drill-Down (Phase 8b).
 *
 * Two test groups:
 *   A) Synthetic trace — seeds pre-built trace data with subWorkflowTrace
 *      to verify the Results Explorer UI (button, breadcrumb, child canvas).
 *   B) Live execution — runs the "Sub-Workflow Orchestrator" sample with 1
 *      iteration and verifies that the engine actually captures the child trace.
 */

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function seedTestRunsViaIDB(page: Page, runs: unknown[]): Promise<string> {
  return await page.evaluate((testRuns) => {
    return new Promise<string>((resolve) => {
      const req = indexedDB.open('redfireforge', 4);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('testRuns')) {
          const store = db.createObjectStore('testRuns', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains('featureGroups')) db.createObjectStore('featureGroups');
        if (!db.objectStoreNames.contains('sharedDataSources')) db.createObjectStore('sharedDataSources');
        if (!db.objectStoreNames.contains('trash')) db.createObjectStore('trash');
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

// ─── Group A: Synthetic trace — drill-down UI ────────────────────────────────

const PARENT_WORKFLOW = {
  id: 'wf-drilldown-parent',
  name: 'Drill-Down Parent',
  schemaVersion: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'p-start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start' } },
    { id: 'p-http', type: 'http', position: { x: 300, y: 120 }, data: { label: 'Fetch', scenario: { id: 'sc1', name: 'Fetch', method: 'GET', url: 'https://example.com/api', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    {
      id: 'p-sub', type: 'subWorkflow', position: { x: 300, y: 240 },
      data: {
        label: 'Child Process',
        workflowId: 'wf-drilldown-child',
        workflowName: 'Child Workflow',
        inputMappings: [],
        outputMappings: [],
      },
    },
    { id: 'p-end', type: 'end', position: { x: 300, y: 360 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'pe1', source: 'p-start', target: 'p-http' },
    { id: 'pe2', source: 'p-http', target: 'p-sub' },
    { id: 'pe3', source: 'p-sub', target: 'p-end' },
  ],
};

function makeSyntheticTestRun() {
  const now = Date.now();
  const childTrace = {
    workflowId: 'wf-drilldown-child',
    workflowName: 'Child Workflow',
    totalIterations: 1,
    totalDurationMs: 200,
    fullTraceCaptured: true,
    traversedEdges: ['ce1', 'ce2', 'ce3'],
    workflowSnapshot: {
      nodes: [
        { id: 'c-start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Child Start' } },
        { id: 'c-http', type: 'http', position: { x: 300, y: 120 }, data: { label: 'Child Fetch', scenario: { id: 'csc1', name: 'ChildFetch', method: 'GET', url: 'https://example.com/child', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
        { id: 'c-end', type: 'end', position: { x: 300, y: 240 }, data: { label: 'Child End' } },
      ],
      edges: [
        { id: 'ce1', source: 'c-start', target: 'c-http' },
        { id: 'ce2', source: 'c-http', target: 'c-end' },
      ],
    },
    iterations: [
      {
        index: 0, passed: true, durationMs: 200,
        traversedEdges: ['ce1', 'ce2'],
        finalVariables: {},
        events: [
          { nodeId: 'c-start', nodeType: 'start', nodeLabel: 'Child Start', timestamp: now, state: 'pass' as const, durationMs: 1 },
          { nodeId: 'c-http', nodeType: 'http', nodeLabel: 'Child Fetch', timestamp: now + 1, state: 'pass' as const, durationMs: 180, details: { statusCode: 200 } },
          { nodeId: 'c-end', nodeType: 'end', nodeLabel: 'Child End', timestamp: now + 181, state: 'pass' as const, durationMs: 1 },
        ],
      },
    ],
  };

  return {
    id: 'run-drilldown-test',
    timestamp: now,
    config: { executionMode: 'workflow', iterations: 1, concurrency: 1, thinkTime: { type: 'none' }, scenarioWeights: [] },
    summary: {
      totalRequests: 2, successfulRequests: 2, failedRequests: 0,
      totalDurationMs: 500, tps: 4, avgResponseTime: 100,
      minResponseTime: 50, maxResponseTime: 200,
      p50ResponseTime: 100, p95ResponseTime: 190, p99ResponseTime: 200,
      errorRate: 0, errorsByStatus: {}, failedValidations: 0,
    },
    results: [],
    workflowName: 'Drill-Down Parent',
    executionTrace: {
      workflowId: 'wf-drilldown-parent',
      workflowName: 'Drill-Down Parent',
      totalIterations: 1,
      totalDurationMs: 500,
      fullTraceCaptured: true,
      traversedEdges: ['pe1', 'pe2', 'pe3'],
      workflowSnapshot: { nodes: PARENT_WORKFLOW.nodes, edges: PARENT_WORKFLOW.edges },
      iterations: [
        {
          index: 0, passed: true, durationMs: 500,
          traversedEdges: ['pe1', 'pe2', 'pe3'],
          finalVariables: {},
          events: [
            { nodeId: 'p-start', nodeType: 'start', nodeLabel: 'Start', timestamp: now, state: 'pass' as const, durationMs: 1 },
            { nodeId: 'p-http', nodeType: 'http', nodeLabel: 'Fetch', timestamp: now + 1, state: 'pass' as const, durationMs: 120, details: { statusCode: 200 } },
            {
              nodeId: 'p-sub', nodeType: 'subWorkflow', nodeLabel: 'Child Process', timestamp: now + 121, state: 'pass' as const, durationMs: 200,
              details: {
                subWorkflowId: 'wf-drilldown-child',
                subWorkflowPassed: true,
                subWorkflowTrace: childTrace,
              },
            },
            { nodeId: 'p-end', nodeType: 'end', nodeLabel: 'End', timestamp: now + 321, state: 'pass' as const, durationMs: 1 },
          ],
        },
      ],
    },
  };
}

async function openResultsExplorer(page: Page): Promise<void> {
  await page.addInitScript((wfs) => {
    localStorage.setItem('workflows', JSON.stringify(wfs));
  }, [PARENT_WORKFLOW]);

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('domcontentloaded');

  const seeded = await seedTestRunsViaIDB(page, [makeSyntheticTestRun()]);
  expect(seeded).toBe('ok');

  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  const harnessBtn = page.locator('button[title="Harness"]');
  await expect(harnessBtn).toBeVisible({ timeout: 10000 });
  await harnessBtn.click();

  const resultsTab = page.locator('button.sub-nav-tab:has-text("Results")');
  await expect(resultsTab).toBeVisible({ timeout: 5000 });
  await resultsTab.click();
  await page.waitForTimeout(1500);

  const explorerBtn = page.locator('button:has-text("Results Explorer")');
  await expect(explorerBtn.first()).toBeVisible({ timeout: 8000 });
  await explorerBtn.first().click();
  await page.waitForTimeout(1500);

  // Click "Fit view" to bring all nodes into the viewport
  const fitBtn = page.locator('button[title="Fit view"]');
  if (await fitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await fitBtn.click();
    await page.waitForTimeout(500);
  }
}

test.describe('Sub-Workflow Drill-Down — Synthetic Trace', () => {
  test('shows View Sub-Workflow button when sub-workflow node is selected', async ({ page }) => {
    await openResultsExplorer(page);

    const canvas = page.getByRole('application');
    const subNode = canvas.locator('[data-testid="rf__node-p-sub"]');
    await subNode.scrollIntoViewIfNeeded();
    await expect(subNode).toBeVisible({ timeout: 5000 });
    await subNode.click();
    await page.waitForTimeout(500);

    // The detail panel should show the "View Sub-Workflow" button
    const drillBtn = page.locator('.sub-workflow-drilldown-btn');
    await expect(drillBtn).toBeVisible({ timeout: 5000 });
    await expect(drillBtn).toContainText('View Sub-Workflow');
  });

  test('clicking drill-down button shows breadcrumb and child workflow', async ({ page }) => {
    await openResultsExplorer(page);

    const canvas = page.getByRole('application');
    const subNode = canvas.locator('[data-testid="rf__node-p-sub"]');
    await subNode.scrollIntoViewIfNeeded();
    await expect(subNode).toBeVisible({ timeout: 5000 });
    await subNode.click();
    await page.waitForTimeout(500);

    // Click the drill-down button
    const drillBtn = page.locator('.sub-workflow-drilldown-btn');
    await expect(drillBtn).toBeVisible({ timeout: 5000 });
    await drillBtn.click();
    await page.waitForTimeout(1000);

    // Breadcrumb should appear with parent > child segments
    const breadcrumb = page.locator('.sub-workflow-breadcrumb');
    await expect(breadcrumb).toBeVisible({ timeout: 5000 });
    await expect(breadcrumb).toContainText('Drill-Down Parent');
    await expect(breadcrumb).toContainText('Child Workflow');

    // The child workflow's nodes should be visible in the canvas
    const childStartNode = canvas.locator('.react-flow__node').filter({ hasText: 'Child Start' });
    await childStartNode.first().scrollIntoViewIfNeeded();
    await expect(childStartNode.first()).toBeVisible({ timeout: 5000 });
  });

  test('breadcrumb click navigates back to parent workflow', async ({ page }) => {
    await openResultsExplorer(page);

    const canvas = page.getByRole('application');
    const subNode = canvas.locator('[data-testid="rf__node-p-sub"]');
    await subNode.scrollIntoViewIfNeeded();
    await expect(subNode).toBeVisible({ timeout: 5000 });
    await subNode.click();
    await page.waitForTimeout(500);

    const drillBtn = page.locator('.sub-workflow-drilldown-btn');
    await expect(drillBtn).toBeVisible({ timeout: 5000 });
    await drillBtn.click();
    await page.waitForTimeout(1000);

    // Navigate back via breadcrumb
    const parentLink = page.locator('.breadcrumb-link').filter({ hasText: 'Drill-Down Parent' });
    await expect(parentLink).toBeVisible({ timeout: 5000 });
    await parentLink.click();
    await page.waitForTimeout(1000);

    // Breadcrumb should disappear (we're at root now)
    const breadcrumb = page.locator('.sub-workflow-breadcrumb');
    await expect(breadcrumb).not.toBeVisible({ timeout: 3000 });

    // Parent nodes should be visible again
    const parentSubNode = canvas.locator('[data-testid="rf__node-p-sub"]');
    await parentSubNode.scrollIntoViewIfNeeded();
    await expect(parentSubNode).toBeVisible({ timeout: 5000 });
  });

  test('non-sub-workflow node does not show drill-down button', async ({ page }) => {
    await openResultsExplorer(page);

    // Click the HTTP node (not a sub-workflow) — scope to Results Explorer canvas
    const canvas = page.getByRole('application');
    const httpNode = canvas.locator('[data-testid="rf__node-p-http"]');
    await httpNode.scrollIntoViewIfNeeded();
    await expect(httpNode).toBeVisible({ timeout: 5000 });
    await httpNode.click();
    await page.waitForTimeout(500);

    // No drill-down button should be visible
    const drillBtn = page.locator('.sub-workflow-drilldown-btn');
    await expect(drillBtn).not.toBeVisible({ timeout: 2000 });
  });
});

// ─── Group B: Live execution — verify trace capture ──────────────────────────

const LIVE_PARENT = {
  id: 'sample-workflow-sub-workflow',
  name: 'Sub-Workflow Orchestrator',
  variables: {},
  nodes: [
    { id: 'swf-start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start', inputVariables: { apiBase: 'https://jsonplaceholder.typicode.com' } } },
    { id: 'swf-fetch-users', type: 'http', position: { x: 250, y: 120 }, data: { label: '1. Fetch User List', scenario: { id: 'swf-s1', name: 'Get Users', url: '{{apiBase}}/users', method: 'GET', headers: [], body: '', bodyType: 'none', auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [{ name: 'usersJson', source: 'body', expression: '' }, { name: 'userCount', source: 'body', expression: '$.length' }] } } },
    { id: 'swf-set-ids', type: 'setVariable', position: { x: 250, y: 280 }, data: { label: '2. Extract User IDs', assignments: [{ id: 'a1', name: 'userIds', expression: '[1,2,3]' }, { id: 'a2', name: 'processedCount', expression: '0' }] } },
    { id: 'swf-sub', type: 'subWorkflow', position: { x: 250, y: 440 }, data: { label: '3. Process Each User', workflowId: 'sample-subwf-child', workflowName: 'User Processor', inputMappings: [{ sourceExpression: '{{apiBase}}', targetVariable: 'apiBase' }], outputMappings: [{ sourceVariable: 'userStatus', targetVariable: 'lastUserStatus' }], propagateAllOutputs: false, multiInstance: { collection: '{{userIds}}', elementVariable: 'userId', mode: 'sequential' }, maxDepth: 5, timeoutMs: 30000, retryCount: 1, retryDelayMs: 2000, onChildFailure: 'continue' } },
    { id: 'swf-log', type: 'logDebug', position: { x: 250, y: 600 }, data: { label: '4. Log Results', logLevel: 'info', message: 'Sub-workflow completed. Last status: {{lastUserStatus}}', snapshotVariables: true } },
    { id: 'swf-cond', type: 'condition', position: { x: 300, y: 740 }, data: { label: '5. All Succeeded?', left: '{{__subWorkflowFailed}}', operator: '!=', right: 'true' } },
    { id: 'swf-log-ok', type: 'logDebug', position: { x: 100, y: 880 }, data: { label: 'All Good', logLevel: 'info', message: 'All users processed', snapshotVariables: false } },
    { id: 'swf-log-fail', type: 'logDebug', position: { x: 480, y: 880 }, data: { label: 'Partial Failure', logLevel: 'warn', message: 'Some failed.', snapshotVariables: true } },
    { id: 'swf-end', type: 'end', position: { x: 300, y: 1020 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'swf-e1', source: 'swf-start', target: 'swf-fetch-users' },
    { id: 'swf-e2', source: 'swf-fetch-users', target: 'swf-set-ids' },
    { id: 'swf-e3', source: 'swf-set-ids', target: 'swf-sub' },
    { id: 'swf-e4', source: 'swf-sub', target: 'swf-log' },
    { id: 'swf-e5', source: 'swf-log', target: 'swf-cond' },
    { id: 'swf-e6', source: 'swf-cond', target: 'swf-log-ok', sourceHandle: 'true', label: 'Yes' },
    { id: 'swf-e7', source: 'swf-cond', target: 'swf-log-fail', sourceHandle: 'false', label: 'No' },
    { id: 'swf-e8', source: 'swf-log-ok', target: 'swf-end' },
    { id: 'swf-e9', source: 'swf-log-fail', target: 'swf-end' },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const LIVE_CHILD = {
  id: 'sample-subwf-child',
  name: 'User Processor',
  variables: {},
  nodes: [
    { id: 'child-start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start', inputVariables: { apiBase: 'https://jsonplaceholder.typicode.com', userId: '1' } } },
    { id: 'child-fetch', type: 'http', position: { x: 250, y: 120 }, data: { label: 'Fetch User', scenario: { id: 'child-s1', name: 'Get User', url: '{{apiBase}}/users/{{userId}}', method: 'GET', headers: [], body: '', bodyType: 'none', auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [{ name: 'userName', source: 'body', expression: '$.name' }, { name: 'userEmail', source: 'body', expression: '$.email' }] } } },
    { id: 'child-set', type: 'setVariable', position: { x: 250, y: 280 }, data: { label: 'Build Status', assignments: [{ id: 'c1', name: 'userStatus', expression: 'processed:{{userName}}' }] } },
    { id: 'child-end', type: 'end', position: { x: 300, y: 400 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'child-e1', source: 'child-start', target: 'child-fetch' },
    { id: 'child-e2', source: 'child-fetch', target: 'child-set' },
    { id: 'child-e3', source: 'child-set', target: 'child-end' },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

test.describe('Sub-Workflow Drill-Down — Live Execution', () => {
  test('running Sub-Workflow Orchestrator captures child trace', async ({ page }) => {
    // Seed both parent and child workflows before the page loads
    await page.addInitScript((wfs) => {
      localStorage.setItem('workflows', JSON.stringify(wfs));
    }, [LIVE_PARENT, LIVE_CHILD]);

    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to Workflow Runner
    const harnessBtn = page.locator('button[title="Harness"]');
    await expect(harnessBtn).toBeVisible({ timeout: 10000 });
    await harnessBtn.click();

    const wrTab = page.locator('button.sub-nav-tab:has-text("Workflow Runner")');
    await expect(wrTab).toBeVisible({ timeout: 5000 });
    await wrTab.click();
    await page.waitForTimeout(1000);

    // Select the parent workflow
    await expect(page.getByTestId('workflow-select')).toBeVisible({ timeout: 5000 });
    await page.getByTestId('workflow-select').click();
    await page.locator('.wfp-dropdown-item:has-text("Sub-Workflow Orchestrator")').click();
    await page.waitForTimeout(500);

    // Click Run
    const runBtn = page.locator('button.btn-primary.btn-lg');
    await expect(runBtn).toBeVisible({ timeout: 5000 });
    await runBtn.click();

    // Wait for execution to complete (makes HTTP calls to jsonplaceholder.typicode.com)
    // Look for progress indicator reaching 100%, or the "Run Complete" state
    await page.waitForTimeout(2000);
    const progressComplete = page.locator('text=/1\\s*\\/\\s*1/').or(page.locator('text=100%'));
    await expect(progressComplete.first()).toBeVisible({ timeout: 45000 });
    await page.waitForTimeout(3000);

    // Navigate to Results tab
    const resultsTab = page.locator('button.sub-nav-tab:has-text("Results")');
    await expect(resultsTab).toBeVisible({ timeout: 5000 });
    await resultsTab.click();
    await page.waitForTimeout(2000);

    // Open Results Explorer
    const explorerBtn = page.locator('button:has-text("Results Explorer")');
    await expect(explorerBtn.first()).toBeVisible({ timeout: 10000 });
    await explorerBtn.first().click();
    await page.waitForTimeout(2000);

    // Fit view
    const fitBtn = page.locator('button[title="Fit view"]');
    if (await fitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fitBtn.click();
      await page.waitForTimeout(500);
    }

    // Find and click the sub-workflow node
    const canvas = page.getByRole('application');
    const subNode = canvas.locator('[data-testid="rf__node-swf-sub"]');
    await subNode.scrollIntoViewIfNeeded();
    await expect(subNode).toBeVisible({ timeout: 10000 });
    await subNode.click();
    await page.waitForTimeout(1000);

    // The detail panel should show drill-down button (NOT "trace not captured")
    const noTraceMsg = page.locator('.sub-workflow-no-trace');
    const drillBtn = page.locator('.sub-workflow-drilldown-btn');

    const drillVisible = await drillBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const noTraceVisible = await noTraceMsg.isVisible({ timeout: 1000 }).catch(() => false);

    if (noTraceVisible) {
      await page.screenshot({ path: 'e2e-sub-workflow-drilldown-FAILED.png', fullPage: true });
      const panelText = await page.locator('.results-detail-panel, .detail-panel, .results-explorer-detail').first().textContent().catch(() => 'panel not found');
      throw new Error(
        `Sub-workflow trace was NOT captured. Detail panel says: "${panelText}".`
      );
    }

    expect(drillVisible).toBe(true);
  });
});
