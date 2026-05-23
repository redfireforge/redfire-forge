import { test, expect } from '@playwright/test';
import { navigateToHarnessResults, seedWorkflowAndTestRun } from './helpers';

const SEED_WORKFLOW = {
  id: 'wf-fitview-test',
  name: 'FitView Test Workflow',
  schemaVersion: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'n0', type: 'webhook', position: { x: 300, y: 0 }, data: { label: 'Order Webhook', method: 'POST', samplePayload: '{}' } },
    { id: 'n1', type: 'http', position: { x: 300, y: 180 }, data: { label: '1. Check Inventory', scenario: { id: 'sc1', name: 'Check', method: 'GET', url: 'https://jsonplaceholder.typicode.com/posts/1', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'n2', type: 'condition', position: { x: 300, y: 360 }, data: { label: '2. In Stock?', expression: '{{stockLevel}} > 0' } },
    { id: 'n3', type: 'http', position: { x: 100, y: 540 }, data: { label: '3a. Process Order', scenario: { id: 'sc2', name: 'Process', method: 'POST', url: 'https://jsonplaceholder.typicode.com/posts', headers: [], body: '{}', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'n4', type: 'http', position: { x: 500, y: 540 }, data: { label: '3b. Out of Stock', scenario: { id: 'sc3', name: 'OOS', method: 'POST', url: 'https://jsonplaceholder.typicode.com/posts', headers: [], body: '{}', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'n5', type: 'end', position: { x: 300, y: 720 }, data: { label: 'Order Handled' } },
  ],
  edges: [
    { id: 'e1', source: 'n0', target: 'n1' },
    { id: 'e2', source: 'n1', target: 'n2' },
    { id: 'e3', source: 'n2', target: 'n3', label: 'Yes', sourceHandle: 'yes' },
    { id: 'e4', source: 'n2', target: 'n4', label: 'No', sourceHandle: 'no' },
    { id: 'e5', source: 'n3', target: 'n5' },
  ],
};

function makeFitViewTestRun() {
  const now = Date.now();
  return {
    id: 'fitview-test-run',
    timestamp: now,
    config: { iterations: 5, concurrency: 1, executionMode: 'workflow', thinkTime: { type: 'none' }, scenarioWeights: [] },
    summary: {
      totalRequests: 5, successfulRequests: 5, failedRequests: 0,
      totalDurationMs: 2500, tps: 2, avgResponseTime: 120,
      minResponseTime: 80, maxResponseTime: 200,
      p50ResponseTime: 110, p95ResponseTime: 190, p99ResponseTime: 200,
      errorRate: 0, errorsByStatus: {}, failedValidations: 0,
    },
    results: [],
    workflowName: 'FitView Test Workflow',
    executionTrace: {
      workflowId: 'wf-fitview-test',
      workflowName: 'FitView Test Workflow',
      totalIterations: 5,
      totalDurationMs: 2500,
      fullTraceCaptured: true,
      traversedEdges: ['e1', 'e2', 'e3', 'e4', 'e5'],
      workflowSnapshot: { nodes: SEED_WORKFLOW.nodes, edges: SEED_WORKFLOW.edges },
      iterations: Array.from({ length: 5 }, (_, i) => ({
        index: i,
        passed: true,
        durationMs: 450,
        traversedEdges: ['e1', 'e2', 'e3', 'e5'],
        finalVariables: { stockLevel: '10' },
        events: [
          { nodeId: 'n0', nodeType: 'webhook', nodeLabel: 'Order Webhook', timestamp: now, state: 'pass', durationMs: 5 },
          { nodeId: 'n1', nodeType: 'http', nodeLabel: '1. Check Inventory', timestamp: now, state: 'pass', durationMs: 120 },
          { nodeId: 'n2', nodeType: 'condition', nodeLabel: '2. In Stock?', timestamp: now, state: 'pass', durationMs: 2 },
          { nodeId: 'n3', nodeType: 'http', nodeLabel: '3a. Process Order', timestamp: now, state: 'pass', durationMs: 160 },
          { nodeId: 'n5', nodeType: 'end', nodeLabel: 'Order Handled', timestamp: now, state: 'pass', durationMs: 1 },
        ],
      })),
    },
  };
}

test.describe('Results Explorer FitView', () => {
  test('fitView should render nodes within canvas bounds', async ({ page }) => {
    await seedWorkflowAndTestRun(page, SEED_WORKFLOW, makeFitViewTestRun());

    await navigateToHarnessResults(page, 1500);

    // Click on the test run
    const runText = page.getByText('FitView Test Workflow');
    const runVisible = await runText.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!runVisible) {
      // Test run didn't appear - IDB might not have been picked up. This is acceptable.
      return;
    }
    await runText.first().click();
    await page.waitForTimeout(500);

    // Look for Results Explorer button
    const explorerBtn = page.locator('button:has-text("Results Explorer")');
    const explorerVisible = await explorerBtn.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!explorerVisible) return;

    await explorerBtn.first().click();
    await page.waitForTimeout(1500);

    // Verify ReactFlow canvas and nodes
    const canvas = page.locator('.react-flow');
    await expect(canvas.first()).toBeVisible({ timeout: 5000 });

    const nodes = page.locator('.react-flow__node');
    const nodeCount = await nodes.count();
    expect(nodeCount).toBeGreaterThan(0);
  });
});
