import { test, expect, type Page } from '@playwright/test';
import { openResultsExplorer, seedWorkflowAndTestRun } from './helpers';

/**
 * Timeline Filter Visual Rules (enforced by these tests):
 *
 * ALL (no filter active):
 *   → Dots: ALL green (forced, even for never-executed nodes)
 *   → Labels: ALL bold, full opacity
 *
 * noMatches (e.g. Fail(0), Skip(0))
 *   → Dots: ALL gray
 *   → Labels: ALL normal weight, dim (0.3 opacity)
 *   → Bars: ALL gray (#475569), 0.2 opacity
 *   → "No {state} nodes" overlay visible
 *
 * partialMatch (e.g. Skip(1), Pass(N) where N < total):
 *   → Matching nodes: dot per aggState, bold if executed, full opacity (1)
 *   → Non-matching nodes: same dot/weight, but dimmed to 0.3 opacity
 *   → Non-matching bars: dimmed to 0.15 opacity
 *   → Visual focus on matching nodes via brightness contrast
 */

const TIMELINE_WORKFLOW = {
  id: 'wf-timeline-filter',
  name: 'Timeline Filter Test',
  schemaVersion: 6,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  variables: {},
  hostProfiles: [],
  authProfiles: [],
  services: [],
  nodes: [
    { id: 'start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start' } },
    { id: 'fetch', type: 'http', position: { x: 300, y: 120 }, data: { label: 'Fetch Data', scenario: { id: 'sc1', name: 'Fetch', method: 'GET', url: 'https://example.com/api', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'cond', type: 'condition', position: { x: 300, y: 240 }, data: { label: 'Check Result', expression: '{{status}} === 200' } },
    { id: 'ok', type: 'http', position: { x: 100, y: 360 }, data: { label: 'Process OK', scenario: { id: 'sc2', name: 'OK', method: 'POST', url: 'https://example.com/ok', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'notok', type: 'http', position: { x: 500, y: 360 }, data: { label: 'Handle Error', scenario: { id: 'sc3', name: 'Err', method: 'POST', url: 'https://example.com/err', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' } } } },
    { id: 'end', type: 'end', position: { x: 300, y: 480 }, data: { label: 'Done' } },
  ],
  edges: [
    { id: 'e1', source: 'start', target: 'fetch' },
    { id: 'e2', source: 'fetch', target: 'cond' },
    { id: 'e3', source: 'cond', target: 'ok', label: 'Yes', sourceHandle: 'yes' },
    { id: 'e4', source: 'cond', target: 'notok', label: 'No', sourceHandle: 'no' },
    { id: 'e5', source: 'ok', target: 'end' },
    { id: 'e6', source: 'notok', target: 'end' },
  ],
};

function makeTimelineTestRun() {
  const now = Date.now();
  return {
    id: 'run-timeline-filter',
    timestamp: now,
    config: { executionMode: 'workflow', iterations: 3, concurrency: 1, thinkTime: { type: 'none' }, scenarioWeights: [] },
    summary: {
      totalRequests: 3, successfulRequests: 3, failedRequests: 0,
      totalDurationMs: 1500, tps: 2, avgResponseTime: 100,
      minResponseTime: 50, maxResponseTime: 200,
      p50ResponseTime: 100, p95ResponseTime: 190, p99ResponseTime: 200,
      errorRate: 0, errorsByStatus: {}, failedValidations: 0,
    },
    results: [],
    workflowName: 'Timeline Filter Test',
    executionTrace: {
      workflowId: 'wf-timeline-filter',
      workflowName: 'Timeline Filter Test',
      totalIterations: 3,
      totalDurationMs: 1500,
      fullTraceCaptured: true,
      traversedEdges: ['e1', 'e2', 'e3', 'e5'],
      workflowSnapshot: { nodes: TIMELINE_WORKFLOW.nodes, edges: TIMELINE_WORKFLOW.edges },
      iterations: [
        {
          index: 0, passed: true, durationMs: 500,
          traversedEdges: ['e1', 'e2', 'e3', 'e5'],
          finalVariables: {},
          events: [
            { nodeId: 'start', nodeType: 'start', nodeLabel: 'Start', timestamp: now, state: 'pass' as const, durationMs: 2 },
            { nodeId: 'fetch', nodeType: 'http', nodeLabel: 'Fetch Data', timestamp: now + 2, state: 'pass' as const, durationMs: 120, details: { statusCode: 200 } },
            { nodeId: 'cond', nodeType: 'condition', nodeLabel: 'Check Result', timestamp: now + 122, state: 'pass' as const, durationMs: 1 },
            { nodeId: 'ok', nodeType: 'http', nodeLabel: 'Process OK', timestamp: now + 123, state: 'pass' as const, durationMs: 100, details: { statusCode: 200 } },
            { nodeId: 'end', nodeType: 'end', nodeLabel: 'Done', timestamp: now + 223, state: 'pass' as const, durationMs: 1 },
          ],
        },
        {
          index: 1, passed: true, durationMs: 500,
          traversedEdges: ['e1', 'e2', 'e3', 'e5'],
          finalVariables: {},
          events: [
            { nodeId: 'start', nodeType: 'start', nodeLabel: 'Start', timestamp: now + 500, state: 'pass' as const, durationMs: 3 },
            { nodeId: 'fetch', nodeType: 'http', nodeLabel: 'Fetch Data', timestamp: now + 503, state: 'pass' as const, durationMs: 130, details: { statusCode: 200 } },
            { nodeId: 'cond', nodeType: 'condition', nodeLabel: 'Check Result', timestamp: now + 633, state: 'pass' as const, durationMs: 1 },
            { nodeId: 'ok', nodeType: 'http', nodeLabel: 'Process OK', timestamp: now + 634, state: 'pass' as const, durationMs: 110, details: { statusCode: 200 } },
            { nodeId: 'end', nodeType: 'end', nodeLabel: 'Done', timestamp: now + 744, state: 'pass' as const, durationMs: 1 },
          ],
        },
        {
          index: 2, passed: true, durationMs: 500,
          traversedEdges: ['e1', 'e2', 'e3', 'e5'],
          finalVariables: {},
          events: [
            { nodeId: 'start', nodeType: 'start', nodeLabel: 'Start', timestamp: now + 1000, state: 'pass' as const, durationMs: 2 },
            { nodeId: 'fetch', nodeType: 'http', nodeLabel: 'Fetch Data', timestamp: now + 1002, state: 'pass' as const, durationMs: 125, details: { statusCode: 200 } },
            { nodeId: 'cond', nodeType: 'condition', nodeLabel: 'Check Result', timestamp: now + 1127, state: 'pass' as const, durationMs: 1 },
            { nodeId: 'ok', nodeType: 'http', nodeLabel: 'Process OK', timestamp: now + 1128, state: 'pass' as const, durationMs: 105, details: { statusCode: 200 } },
            { nodeId: 'end', nodeType: 'end', nodeLabel: 'Done', timestamp: now + 1233, state: 'pass' as const, durationMs: 1 },
          ],
        },
      ],
    },
  };
}

async function openTimelineView(page: Page): Promise<void> {
  await seedWorkflowAndTestRun(page, TIMELINE_WORKFLOW, makeTimelineTestRun());
  await openResultsExplorer(page);

  await expect(page.locator('[data-testid="view-mode-toggle"]')).toBeVisible({ timeout: 10000 });

  const timelineBtn = page.locator('[data-testid="view-toggle-timeline"]');
  await expect(timelineBtn).toBeVisible({ timeout: 5000 });
  await timelineBtn.click();

  const timeline = page.locator('[data-testid="execution-timeline"]');
  await expect(timeline).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid^="timeline-label-"]')).toHaveCount(6, { timeout: 10000 });
}

/** Wait until aggregate-mode avg/P95 markers are mounted in the timeline SVG. */
async function waitForAggregateMarkers(page: Page): Promise<void> {
  const avgMarker = page.locator('[data-testid="timeline-avg-marker"]');
  const p95Marker = page.locator('[data-testid="timeline-p95-marker"]');

  await expect.poll(async () => {
    const avgStroke = await avgMarker.getAttribute('stroke');
    const p95Stroke = await p95Marker.getAttribute('stroke');
    return avgStroke === '#60a5fa' && p95Stroke === '#f59e0b';
  }, { timeout: 10000, intervals: [100, 200, 500] }).toBe(true);
}

/*
 * Test data summary:
 *   Nodes in workflow: start, fetch, cond, ok, notok, end (6 total)
 *   Executed across 3 iterations: start, fetch, cond, ok, end (5 nodes — all pass)
 *   Never executed (skipped): notok (1 node — "Handle Error")
 *
 *   nodeStateCounts: pass=5, fail=0, skipped=1
 *   Filter buttons show: All, Pass(5), Fail(0), Skip(1)
 */

test.describe('Timeline View — Universal Visual Rule (executed=green+bold, skipped=dim)', () => {

  /*
   * Universal rule (independent of filter):
   *   • Executed node (aggState pass/fail) → green dot + bold + full opacity (1.0)
   *   • Skipped node (aggState skipped)   → gray dot + normal weight + dim (~0.3)
   * Filter buttons:
   *   • Pass/Skip — info-only (counts in label); visuals unchanged
   *   • Filter with 0 matches (e.g. Fail(0)) — overlay shown, visuals unchanged
   * Search:
   *   • Non-matching nodes additionally dimmed (label opacity ~0.3, bar opacity ~0.15)
   */

  // Helper: assert universal visual state (executed=green+bold+1.0, skipped=gray+normal+0.3)
  async function expectUniversalVisuals(page: ReturnType<typeof Object>) {
    const executedNodes = ['start', 'fetch', 'cond', 'ok', 'end'];
    const skippedNodes = ['notok'];

    for (const nodeId of executedNodes) {
      const label = page.locator(`[data-testid="timeline-label-${nodeId}"]`);
      await expect(label).toBeVisible();

      const dot = label.locator('.timeline-node-dot');
      await expect(dot).toHaveClass(/timeline-dot-pass/);

      const fontWeight = await label.evaluate((el: Element) => getComputedStyle(el).fontWeight);
      expect(fontWeight).toBe('600');

      const opacity = await label.evaluate((el: Element) => getComputedStyle(el).opacity);
      expect(Number(opacity)).toBeGreaterThanOrEqual(0.9);
    }

    for (const nodeId of skippedNodes) {
      const label = page.locator(`[data-testid="timeline-label-${nodeId}"]`);
      const dot = label.locator('.timeline-node-dot');
      await expect(dot).toHaveClass(/timeline-dot-skipped/);

      const fontWeight = await label.evaluate((el: Element) => getComputedStyle(el).fontWeight);
      expect(fontWeight).toBe('400');

      const opacity = await label.evaluate((el: Element) => getComputedStyle(el).opacity);
      expect(Number(opacity)).toBeLessThanOrEqual(0.35);
    }
  }

  test('ALL: executed nodes green+bold, skipped node gray+dim', async ({ page }) => {
    await openTimelineView(page);

    const timeline = page.locator('[data-testid="execution-timeline"]');
    await expect(timeline).toBeVisible({ timeout: 5000 });

    const allBtn = page.locator('[data-testid="node-filter-all"]');
    await expect(allBtn).toHaveClass(/active/);

    await expectUniversalVisuals(page);

    const overlay = page.locator('[data-testid="timeline-no-matches"]');
    await expect(overlay).not.toBeVisible();
  });

  test('Pass(5): same visuals as ALL (filter is info-only)', async ({ page }) => {
    await openTimelineView(page);

    const passBtn = page.locator('[data-testid="node-filter-pass"]');
    await passBtn.click();
    await page.waitForTimeout(300);
    await expect(passBtn).toHaveClass(/active/);

    await expectUniversalVisuals(page);

    const overlay = page.locator('[data-testid="timeline-no-matches"]');
    await expect(overlay).not.toBeVisible();
  });

  test('Fail(0): visuals unchanged, overlay shown', async ({ page }) => {
    await openTimelineView(page);

    const failBtn = page.locator('[data-testid="node-filter-fail"]');
    await failBtn.click();
    await page.waitForTimeout(300);
    await expect(failBtn).toHaveClass(/active/);

    const overlay = page.locator('[data-testid="timeline-no-matches"]');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('fail');

    // Visuals unchanged: executed nodes still green+bold, skipped still gray+dim
    await expectUniversalVisuals(page);
  });

  test('Skip(1): same visuals as ALL (filter is info-only)', async ({ page }) => {
    await openTimelineView(page);

    const skipBtn = page.locator('[data-testid="node-filter-skipped"]');
    await skipBtn.click();
    await page.waitForTimeout(300);
    await expect(skipBtn).toHaveClass(/active/);

    const overlay = page.locator('[data-testid="timeline-no-matches"]');
    await expect(overlay).not.toBeVisible();

    await expectUniversalVisuals(page);

    // Bars for executed nodes remain at normal opacity (no filter dimming)
    for (const nodeId of ['start', 'fetch', 'cond', 'ok', 'end']) {
      const nodeBars = page.locator(`[data-testid="timeline-bar-${nodeId}"]`);
      const count = await nodeBars.count();
      for (let i = 0; i < count; i++) {
        const opacity = await nodeBars.nth(i).getAttribute('opacity');
        expect(Number(opacity)).toBeGreaterThanOrEqual(0.4);
      }
    }
  });

  test('toggling filter off returns to ALL view', async ({ page }) => {
    await openTimelineView(page);

    const failBtn = page.locator('[data-testid="node-filter-fail"]');

    await failBtn.click();
    await page.waitForTimeout(300);
    const overlay = page.locator('[data-testid="timeline-no-matches"]');
    await expect(overlay).toBeVisible();

    await failBtn.click();
    await page.waitForTimeout(300);
    await expect(overlay).not.toBeVisible();

    await expectUniversalVisuals(page);
  });

  test('filter buttons show correct counts', async ({ page }) => {
    await openTimelineView(page);

    const passBtn = page.locator('[data-testid="node-filter-pass"]');
    const failBtn = page.locator('[data-testid="node-filter-fail"]');
    const skipBtn = page.locator('[data-testid="node-filter-skipped"]');

    await expect(passBtn).toContainText('5');
    await expect(failBtn).toContainText('0');
    await expect(skipBtn).toContainText('1');
  });

  test('search filter dims non-matching nodes', async ({ page }) => {
    await openTimelineView(page);

    const searchInput = page.locator('[data-testid="node-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('Fetch');
    await page.waitForTimeout(300);

    // "Fetch Data" node should be at full opacity
    const fetchLabel = page.locator('[data-testid="timeline-label-fetch"]');
    const fetchOpacity = await fetchLabel.evaluate(el => getComputedStyle(el).opacity);
    expect(Number(fetchOpacity)).toBeGreaterThanOrEqual(0.9);

    // Other nodes should be dimmed
    for (const nodeId of ['start', 'cond', 'ok', 'notok', 'end']) {
      const label = page.locator(`[data-testid="timeline-label-${nodeId}"]`);
      const opacity = await label.evaluate(el => getComputedStyle(el).opacity);
      expect(Number(opacity)).toBeLessThanOrEqual(0.4);
    }

    // No overlay (there is a match)
    const overlay = page.locator('[data-testid="timeline-no-matches"]');
    await expect(overlay).not.toBeVisible();
  });

  test('search with no results shows overlay, dims all labels (universal rule preserved)', async ({ page }) => {
    await openTimelineView(page);

    const searchInput = page.locator('[data-testid="node-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('xyznonexistent');
    await page.waitForTimeout(300);

    const overlay = page.locator('[data-testid="timeline-no-matches"]');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('matching');

    // All labels dimmed by search (no matches), but dots retain universal rule
    // (executed → green dot, skipped → gray dot)
    const executedNodes = ['start', 'fetch', 'cond', 'ok', 'end'];
    const skippedNodes = ['notok'];

    for (const nodeId of executedNodes) {
      const label = page.locator(`[data-testid="timeline-label-${nodeId}"]`);
      const dot = label.locator('.timeline-node-dot');
      await expect(dot).toHaveClass(/timeline-dot-pass/);
      const opacity = await label.evaluate(el => getComputedStyle(el).opacity);
      expect(Number(opacity)).toBeLessThanOrEqual(0.35);
    }

    for (const nodeId of skippedNodes) {
      const label = page.locator(`[data-testid="timeline-label-${nodeId}"]`);
      const dot = label.locator('.timeline-node-dot');
      await expect(dot).toHaveClass(/timeline-dot-skipped/);
      const opacity = await label.evaluate(el => getComputedStyle(el).opacity);
      expect(Number(opacity)).toBeLessThanOrEqual(0.35);
    }
  });

  test('timeline renders all 6 nodes in topological order', async ({ page }) => {
    await openTimelineView(page);

    const labels = page.locator('[data-testid^="timeline-label-"]');
    const count = await labels.count();
    expect(count).toBe(6);

    // Verify order: start → fetch → cond → ok/notok → end
    const labelTexts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await labels.nth(i).innerText();
      labelTexts.push(text.trim());
    }

    const startIdx = labelTexts.findIndex(t => t.includes('Start'));
    const fetchIdx = labelTexts.findIndex(t => t.includes('Fetch'));
    const condIdx = labelTexts.findIndex(t => t.includes('Check'));
    const endIdx = labelTexts.findIndex(t => t.includes('Done'));

    expect(startIdx).toBeLessThan(fetchIdx);
    expect(fetchIdx).toBeLessThan(condIdx);
    expect(condIdx).toBeLessThan(endIdx);
  });

  test('aggregate mode shows avg and P95 markers', async ({ page }) => {
    await openTimelineView(page);

    // Aggregate is default for multi-iteration runs; markers render after SVG layout.
    const iterToggle = page.locator('[data-testid="iter-picker-toggle"]');
    await expect(iterToggle).toHaveClass(/aggregate/, { timeout: 5000 });

    // SVG <line> elements aren't "visible" to Playwright's visibility check.
    // Poll until markers exist with the expected stroke colors.
    await waitForAggregateMarkers(page);

    await expect(page.locator('[data-testid="timeline-avg-marker"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="timeline-p95-marker"]')).toHaveCount(1);
  });

  test('clicking a node label selects it', async ({ page }) => {
    await openTimelineView(page);

    const fetchLabel = page.locator('[data-testid="timeline-label-fetch"]');
    await expect(fetchLabel).toBeVisible({ timeout: 5000 });
    await fetchLabel.scrollIntoViewIfNeeded();
    await fetchLabel.click();

    await expect(fetchLabel).toHaveClass(/timeline-label-selected/, { timeout: 5000 });
  });
});
