/**
 * Validates Results Explorer Fit View actually changes the React Flow viewport
 * and keeps all nodes inside the diagram pane bounds.
 */
import { test, expect } from '@playwright/test';
import { seedTestRunsViaIDB, openResultsExplorer } from './helpers';

const SPREAD_WORKFLOW = {
  id: 'wf-fitview-spread',
  name: 'FitView Spread Workflow',
  schemaVersion: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'start', type: 'start', position: { x: 50, y: 150 }, data: { label: 'Start', inputVariables: {} } },
    { id: 'http1', type: 'http', position: { x: 400, y: 150 }, data: { label: 'Middle Step', scenario: { id: 'sc1', name: 'Middle', method: 'GET', url: 'https://httpbin.org/get', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'end', type: 'end', position: { x: 900, y: 150 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'http1' },
    { id: 'e2', source: 'http1', target: 'end' },
  ],
};

const GQL_LATENCY_WORKFLOW = {
  id: 'wf-gql-latency-fitview',
  name: 'GraphQL Latency Demo',
  schemaVersion: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  variables: { graphqlUrl: 'http://localhost:4010/graphql' },
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'start', type: 'start', position: { x: 100, y: 150 }, data: { label: 'Start', inputVariables: {} } },
    { id: 'query', type: 'graphqlQuery', position: { x: 300, y: 150 }, data: { label: 'GraphQL Query', endpoint: '{{graphqlUrl}}', query: 'query { health }', variables: '{}', headers: [], timeoutMs: 30000, extractionRules: [], outputBindings: [{ field: 'latencyMs', variableName: 'gqlLatency', enabled: true }] } },
    { id: 'assert', type: 'graphqlAssert', position: { x: 550, y: 150 }, data: { label: 'GraphQL Assert', sourceVariable: 'gqlLatency', assertions: [{ id: 'a1', jsonPath: '$', operator: 'less_than', expectedValue: '2000' }], failBehavior: 'error' } },
    { id: 'end', type: 'end', position: { x: 800, y: 150 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'query' },
    { id: 'e2', source: 'query', target: 'assert' },
    { id: 'e3', source: 'assert', target: 'end' },
  ],
};

function makeSpreadTestRun() {
  const now = Date.now();
  return {
    id: 'run-fitview-spread',
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
      { id: 'r1', scenarioId: 'http1', scenarioName: 'Middle Step', url: 'https://httpbin.org/get', method: 'GET', httpStatus: 200, responseTimeMs: 100, passed: true, timestamp: now, validationMode: 'none', failureDetails: [], workflowNodeId: 'http1', iterationIndex: 0 },
    ],
    workflowName: 'FitView Spread Workflow',
    executionTrace: {
      workflowId: 'wf-fitview-spread',
      workflowName: 'FitView Spread Workflow',
      totalIterations: 1,
      totalDurationMs: 300,
      fullTraceCaptured: true,
      traversedEdges: ['e1', 'e2'],
      workflowSnapshot: { nodes: SPREAD_WORKFLOW.nodes, edges: SPREAD_WORKFLOW.edges },
      iterations: [{
        index: 0, passed: true, durationMs: 300, traversedEdges: ['e1', 'e2'],
        events: [
          { nodeId: 'start', nodeType: 'start', nodeLabel: 'Start', timestamp: now, state: 'pass', durationMs: 1 },
          { nodeId: 'http1', nodeType: 'http', nodeLabel: 'Middle Step', timestamp: now, state: 'pass', durationMs: 100 },
          { nodeId: 'end', nodeType: 'end', nodeLabel: 'End', timestamp: now, state: 'pass', durationMs: 1 },
        ],
        finalVariables: {},
      }],
    },
  };
}

function makeGqlLatencyTestRun() {
  const now = Date.now();
  return {
    id: 'run-gql-latency-fitview',
    timestamp: now,
    config: { executionMode: 'workflow', iterations: 3, concurrency: 1, scenarioWeights: [] },
    summary: {
      totalRequests: 6, successfulRequests: 6, failedRequests: 0,
      totalDurationMs: 200, tps: 30, avgResponseTime: 20,
      minResponseTime: 7, maxResponseTime: 33,
      p50ResponseTime: 22, p95ResponseTime: 33, p99ResponseTime: 33,
      errorRate: 0, errorsByStatus: {}, failedValidations: 0,
    },
    results: [],
    workflowName: 'GraphQL Latency Demo',
    executionTrace: {
      workflowId: 'wf-gql-latency-fitview',
      workflowName: 'GraphQL Latency Demo',
      totalIterations: 3,
      totalDurationMs: 200,
      captureLevel: 'standard',
      traversedEdges: ['e1', 'e2', 'e3'],
      workflowSnapshot: { nodes: GQL_LATENCY_WORKFLOW.nodes, edges: GQL_LATENCY_WORKFLOW.edges },
      iterations: [0, 1, 2].map((i) => ({
        index: i, passed: true, durationMs: 20 + i * 5, traversedEdges: ['e1', 'e2', 'e3'],
        events: [
          { nodeId: 'start', nodeType: 'start', nodeLabel: 'Start', timestamp: now, state: 'pass', durationMs: 1 },
          { nodeId: 'query', nodeType: 'graphqlQuery', nodeLabel: 'GraphQL Query', timestamp: now, state: 'pass', durationMs: 15, details: { responseTimeMs: 15, statusCode: 200 } },
          { nodeId: 'assert', nodeType: 'graphqlAssert', nodeLabel: 'GraphQL Assert', timestamp: now, state: 'pass', durationMs: 2 },
          { nodeId: 'end', nodeType: 'end', nodeLabel: 'End', timestamp: now, state: 'pass', durationMs: 1 },
        ],
        finalVariables: { gqlLatency: '15' },
      })),
    },
  };
}

async function readViewport(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const vp = document.querySelector('.results-explorer-diagram .react-flow__viewport') as HTMLElement | null;
    if (!vp) return null;
    const m = vp.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/);
    if (!m) return null;
    return { x: Number(m[1]), y: Number(m[2]), zoom: Number(m[3]) };
  });
}

async function nodesInDiagramBounds(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const pane = document.querySelector('.results-explorer-diagram .react-flow')?.getBoundingClientRect();
    if (!pane) return { ok: false, reason: 'no pane' };
    const nodes = Array.from(document.querySelectorAll('.results-explorer-diagram .react-flow__node'));
    if (nodes.length === 0) return { ok: false, reason: 'no nodes' };
    const out: string[] = [];
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      const pad = 4;
      if (r.left < pane.left - pad || r.right > pane.right + pad || r.top < pane.top - pad || r.bottom > pane.bottom + pad) {
        out.push(`${n.getAttribute('data-id') ?? '?'}: L${Math.round(r.left)} R${Math.round(r.right)} pane L${Math.round(pane.left)} R${Math.round(pane.right)}`);
      }
    }
    return { ok: out.length === 0, reason: out.join('; ') || 'all in bounds', count: nodes.length };
  });
}

async function seedAndOpenExplorer(page: import('@playwright/test').Page, workflow: unknown, testRun: unknown) {
  await page.addInitScript((wfs) => {
    localStorage.setItem('workflows', JSON.stringify(wfs));
    localStorage.setItem('perf-test-theme', 'dark');
  }, [workflow]);

  await page.goto('http://localhost:5173');
  await page.waitForLoadState('domcontentloaded');
  const seeded = await seedTestRunsViaIDB(page, [testRun]);
  expect(seeded).toBe('ok');
  await page.goto('/?tab=results', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.app-header')).toBeVisible({ timeout: 25000 });
  await openResultsExplorer(page, { retryHarness: true, waitAfterNavMs: 800 });
  await expect(page.locator('.results-explorer-diagram .react-flow')).toBeVisible({ timeout: 8000 });
}

async function panDiagram(page: import('@playwright/test').Page, dx: number, dy: number) {
  const pane = page.locator('.results-explorer-diagram .react-flow__pane').first();
  const box = await pane.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + dx, box!.y + box!.height / 2 + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test.describe('Results Explorer Fit View validation', () => {
  test.describe.configure({ timeout: 90_000 });

  test('initial explorer open shows all GQL nodes in bounds without manual fit click', async ({ page }) => {
    await seedAndOpenExplorer(page, GQL_LATENCY_WORKFLOW, makeGqlLatencyTestRun());
    await page.waitForTimeout(600);

    const bounds = await nodesInDiagramBounds(page);
    expect(bounds.ok, `initial: ${bounds.reason}`).toBe(true);
  });

  test('fit view button recenters nodes after manual pan/zoom', async ({ page }) => {
    await seedAndOpenExplorer(page, SPREAD_WORKFLOW, makeSpreadTestRun());

    const fitBtn = page.locator('[data-testid="results-explorer-fit-view-btn"]');
    await expect(fitBtn).toBeVisible();

    await panDiagram(page, 200, 120);

    const beforeFit = await readViewport(page);
    expect(beforeFit).not.toBeNull();

    await fitBtn.click();
    await page.waitForTimeout(400);

    const afterFit = await readViewport(page);
    expect(afterFit).not.toBeNull();

    const viewportChanged =
      Math.abs((afterFit!.x ?? 0) - (beforeFit!.x ?? 0)) > 1
      || Math.abs((afterFit!.y ?? 0) - (beforeFit!.y ?? 0)) > 1
      || Math.abs((afterFit!.zoom ?? 1) - (beforeFit!.zoom ?? 1)) > 0.01;

    expect(viewportChanged, `before=${JSON.stringify(beforeFit)} after=${JSON.stringify(afterFit)}`).toBe(true);

    const afterBounds = await nodesInDiagramBounds(page);
    expect(afterBounds.ok, afterBounds.reason).toBe(true);
    expect(afterBounds.count).toBeGreaterThanOrEqual(3);

    const bridgeResult = await page.evaluate(() => {
      const fn = (window as Window & { __reExplorerFitView?: () => boolean }).__reExplorerFitView;
      return { exists: typeof fn === 'function', result: fn?.() };
    });
    expect(bridgeResult.exists).toBe(true);
    expect(bridgeResult.result).toBe(true);
  });

  test('GQL latency workflow: fit view with detail panel + console open', async ({ page }) => {
    await seedAndOpenExplorer(page, GQL_LATENCY_WORKFLOW, makeGqlLatencyTestRun());

    const fitBtn = page.locator('[data-testid="results-explorer-fit-view-btn"]');

    // Collapse detail panel (lesson step does this)
    const detailToggle = page.locator('[data-testid="detail-panel-toggle"]');
    if (await detailToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await detailToggle.textContent();
      if (text?.trim() === '▶') await detailToggle.click();
    }

    // Open console (lesson step 7)
    const consoleBtn = page.locator('[data-testid="console-toggle-btn-header"]');
    if (await consoleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await consoleBtn.click();
      await page.waitForTimeout(600);
    }

    await panDiagram(page, -200, 100);

    const beforeFit = await nodesInDiagramBounds(page);
    expect(beforeFit.count).toBeGreaterThanOrEqual(4);

    await fitBtn.click();
    await page.waitForTimeout(500);

    const afterFit = await nodesInDiagramBounds(page);
    expect(afterFit.ok, `after fit: ${afterFit.reason}`).toBe(true);

    // Bridge must work in GQL layout too
    const bridgeOk = await page.evaluate(() => {
      const fn = (window as Window & { __reExplorerFitView?: () => boolean }).__reExplorerFitView;
      return fn?.() ?? false;
    });
    expect(bridgeOk).toBe(true);

    const afterBridge = await nodesInDiagramBounds(page);
    expect(afterBridge.ok, `after bridge: ${afterBridge.reason}`).toBe(true);
  });

  test('GQL workflow with detail panel expanded — fit view shows full chain', async ({ page }) => {
    await seedAndOpenExplorer(page, GQL_LATENCY_WORKFLOW, makeGqlLatencyTestRun());

    const fitBtn = page.locator('[data-testid="results-explorer-fit-view-btn"]');
    const detailToggle = page.locator('[data-testid="detail-panel-toggle"]');

    // Ensure detail panel is expanded (narrower canvas — reproduces user screenshot)
    if (await detailToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      const text = await detailToggle.textContent();
      if (text?.trim() === '◀') await detailToggle.click();
      await page.waitForTimeout(400);
    }

    await fitBtn.click();
    await page.waitForTimeout(500);

    const bounds = await nodesInDiagramBounds(page);
    expect(bounds.ok, bounds.reason).toBe(true);
    expect(bounds.count).toBe(4);

    // All four node labels should be visible in the diagram pane
    for (const label of ['Start', 'GraphQL Query', 'GraphQL Assert', 'End']) {
      await expect(page.locator('.results-explorer-diagram').getByText(label, { exact: false }).first()).toBeVisible();
    }
  });

  test('opening console without fit may clip nodes — fit view must recover', async ({ page }) => {
    await seedAndOpenExplorer(page, GQL_LATENCY_WORKFLOW, makeGqlLatencyTestRun());

    const fitBtn = page.locator('[data-testid="results-explorer-fit-view-btn"]');
    const consoleBtn = page.locator('[data-testid="console-toggle-btn-header"]');

    await fitBtn.click();
    await page.waitForTimeout(400);
    const beforeConsole = await nodesInDiagramBounds(page);
    expect(beforeConsole.ok, beforeConsole.reason).toBe(true);

    if (await consoleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await consoleBtn.click();
      await page.waitForTimeout(800);
    }

    await fitBtn.click();
    await page.waitForTimeout(500);
    const afterFit = await nodesInDiagramBounds(page);
    expect(afterFit.ok, afterFit.reason).toBe(true);
  });
});
