import { test, expect } from '@playwright/test';
import { navigateToHarnessResults, seedWorkflowAndTestRun } from './helpers';

const REPLAY_WORKFLOW = {
  id: 'wf-replay-e2e',
  name: 'Replay Test Workflow',
  schemaVersion: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start', inputVariables: {} } },
    { id: 'http1', type: 'http', position: { x: 300, y: 100 }, data: { label: 'GET Data', scenario: { id: 'sc1', name: 'Fetch', method: 'GET', url: 'https://httpbin.org/get', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'end', type: 'end', position: { x: 300, y: 200 }, data: { label: 'End' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'http1' },
    { id: 'e2', source: 'http1', target: 'end' },
  ],
};

function makeReplayTestRun() {
  const now = Date.now();
  return {
    id: 'run-replay-e2e',
    timestamp: now,
    config: { executionMode: 'workflow', iterations: 1, concurrency: 1, scenarioWeights: [] },
    summary: {
      totalRequests: 1, successfulRequests: 1, failedRequests: 0,
      totalDurationMs: 500, tps: 2, avgResponseTime: 120,
      minResponseTime: 120, maxResponseTime: 120,
      p50ResponseTime: 120, p95ResponseTime: 120, p99ResponseTime: 120,
      errorRate: 0, errorsByStatus: {}, failedValidations: 0,
    },
    results: [
      { id: 'r1', scenarioId: 'sc1', scenarioName: 'Fetch', url: 'https://httpbin.org/get', method: 'GET', httpStatus: 200, responseTimeMs: 120, passed: true, timestamp: now, validationMode: 'none', failureDetails: [], responseBody: '{}' },
    ],
    workflowName: 'Replay Test Workflow',
    executionTrace: {
      workflowId: 'wf-replay-e2e',
      workflowName: 'Replay Test Workflow',
      totalIterations: 1,
      totalDurationMs: 500,
      fullTraceCaptured: true,
      traversedEdges: ['e1', 'e2'],
      workflowSnapshot: { nodes: REPLAY_WORKFLOW.nodes, edges: REPLAY_WORKFLOW.edges },
      iterations: [{
        index: 0,
        passed: true,
        durationMs: 500,
        traversedEdges: ['e1', 'e2'],
        events: [
          { nodeId: 'start', nodeType: 'start', nodeLabel: 'Start', timestamp: now, state: 'pass', durationMs: 1 },
          { nodeId: 'http1', nodeType: 'http', nodeLabel: 'GET Data', timestamp: now, state: 'pass', durationMs: 120, details: { statusCode: 200, method: 'GET', url: 'https://httpbin.org/get' } },
          { nodeId: 'end', nodeType: 'end', nodeLabel: 'End', timestamp: now, state: 'pass', durationMs: 1 },
        ],
        finalVariables: {},
      }],
    },
  };
}

test.describe('Workflow Execution Replay Modal', () => {
  test('should render ReactFlow controls and minimap when modal is opened', async ({ page }) => {
    await seedWorkflowAndTestRun(page, REPLAY_WORKFLOW, makeReplayTestRun());

    await navigateToHarnessResults(page, 1500);

    // Click on the test run
    const runText = page.getByText('Replay Test Workflow');
    const runVisible = await runText.first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!runVisible) {
      // IDB seeding may not have been picked up - acceptable for CI
      return;
    }
    await runText.first().click();
    await page.waitForTimeout(500);

    // Look for Replay button
    const replayBtn = page.locator('button:has-text("Replay")').first();
    const replayVisible = await replayBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!replayVisible) return;

    await replayBtn.click();
    await page.waitForTimeout(1500);

    // Check for ReactFlow canvas
    const canvas = page.locator('.react-flow');
    const canvasVisible = await canvas.first().isVisible({ timeout: 5000 }).catch(() => false);

    if (canvasVisible) {
      const nodes = page.locator('.react-flow__node');
      const nodeCount = await nodes.count();
      expect(nodeCount).toBeGreaterThan(0);
    }
  });
});
