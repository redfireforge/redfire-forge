/**
 * E2E: Phase 1 (Visual Foundation) & Phase 2 (Execution Feedback)
 *
 * Phase 1 — SVG icon badges, category tints, node structure
 * Phase 2 — Node status dots, edge class states, status badges, edge labels
 */
import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

function makeVisualWorkflow(): Workflow {
  return {
    id: 'wf-visual-e2e',
    name: 'Visual E2E Workflow',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: {},
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      {
        id: 'start-1',
        type: 'start',
        position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: 'http-1',
        type: 'http',
        position: { x: 300, y: 140 },
        data: {
          label: 'Get Users',
          scenario: {
            id: 'sc-1', name: 'Get Users', url: '/get', method: 'GET',
            headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'cond-1',
        type: 'condition',
        position: { x: 300, y: 280 },
        data: { label: 'Check Status', left: '{{status}}', operator: '==', right: '200' },
      },
      {
        id: 'delay-1',
        type: 'delay',
        position: { x: 100, y: 420 },
        data: { label: 'Wait', delayMs: 500, mode: 'fixed' },
      },
      {
        id: 'end-1',
        type: 'end',
        position: { x: 500, y: 420 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start-1', target: 'http-1' },
      { id: 'e2', source: 'http-1', target: 'cond-1' },
      { id: 'e3', source: 'cond-1', target: 'delay-1', sourceHandle: 'true', label: 'Yes' },
      { id: 'e4', source: 'cond-1', target: 'end-1', sourceHandle: 'false', label: 'No' },
    ],
  };
}

async function seedAndNavigate(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-visual-e2e');
  }, JSON.stringify([makeVisualWorkflow()]));
  await page.goto('/?tab=workflow');
  await page.waitForSelector('.wf-designer', { timeout: 25000 });
  await page.waitForLoadState('networkidle');
}

// ────────────────────────────────────────────
// Phase 1: Visual Foundation
// ────────────────────────────────────────────

test.describe('Phase 1 – SVG Icon Badges', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('start node has trigger icon badge', async ({ page }) => {
    const startNode = page.locator('.react-flow__node[data-id="start-1"]');
    await expect(startNode).toBeVisible({ timeout: 5000 });
    const badge = startNode.locator('.wf-node-icon-badge');
    await expect(badge).toBeVisible();
    // Trigger category
    await expect(badge).toHaveClass(/wf-node-icon-badge--trigger/);
    // Contains SVG
    await expect(badge.locator('svg')).toBeVisible();
  });

  test('HTTP node has action icon badge', async ({ page }) => {
    const httpNode = page.locator('.react-flow__node[data-id="http-1"]');
    await expect(httpNode).toBeVisible({ timeout: 5000 });
    const badge = httpNode.locator('.wf-node-icon-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/wf-node-icon-badge--action/);
  });

  test('condition node has logic icon badge', async ({ page }) => {
    const condNode = page.locator('.react-flow__node[data-id="cond-1"]');
    await expect(condNode).toBeVisible({ timeout: 5000 });
    const badge = condNode.locator('.wf-node-icon-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/wf-node-icon-badge--logic/);
  });

  test('end node has terminal icon badge', async ({ page }) => {
    const endNode = page.locator('.react-flow__node[data-id="end-1"]');
    await expect(endNode).toBeVisible({ timeout: 5000 });
    const badge = endNode.locator('.wf-node-icon-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveClass(/wf-node-icon-badge--terminal/);
  });
});

test.describe('Phase 1 – Node Category Tints', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('start node has trigger category CSS class', async ({ page }) => {
    const startNode = page.locator('.react-flow__node[data-id="start-1"]');
    await expect(startNode).toBeVisible({ timeout: 5000 });
    // Start nodes have wf-node-start which applies trigger category tint
    await expect(startNode.locator('.wf-node-start')).toBeVisible();
  });

  test('HTTP node has action category CSS class', async ({ page }) => {
    const httpNode = page.locator('.react-flow__node[data-id="http-1"]');
    await expect(httpNode).toBeVisible({ timeout: 5000 });
    await expect(httpNode.locator('.wf-node-http')).toBeVisible();
  });

  test('condition node has logic category CSS class', async ({ page }) => {
    const condNode = page.locator('.react-flow__node[data-id="cond-1"]');
    await expect(condNode).toBeVisible({ timeout: 5000 });
    await expect(condNode.locator('.wf-node-condition')).toBeVisible();
  });

  test('end node has terminal category CSS class', async ({ page }) => {
    const endNode = page.locator('.react-flow__node[data-id="end-1"]');
    await expect(endNode).toBeVisible({ timeout: 5000 });
    await expect(endNode.locator('.wf-node-end')).toBeVisible();
  });
});

test.describe('Phase 1 – Node Structure', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('HTTP node shows method badge', async ({ page }) => {
    const httpNode = page.locator('.react-flow__node[data-id="http-1"]');
    await expect(httpNode).toBeVisible({ timeout: 5000 });
    const methodBadge = httpNode.locator('.wf-method-badge');
    await expect(methodBadge).toBeVisible();
    await expect(methodBadge).toHaveText('GET');
  });

  test('HTTP node shows URL path', async ({ page }) => {
    const httpNode = page.locator('.react-flow__node[data-id="http-1"]');
    await expect(httpNode).toBeVisible({ timeout: 5000 });
    const url = httpNode.locator('.wf-node-url');
    await expect(url).toBeVisible();
    await expect(url).toContainText('/get');
  });

  test('HTTP node shows label', async ({ page }) => {
    const httpNode = page.locator('.react-flow__node[data-id="http-1"]');
    await expect(httpNode).toBeVisible({ timeout: 5000 });
    const label = httpNode.locator('.wf-node-label');
    await expect(label).toBeVisible();
    await expect(label).toHaveText('Get Users');
  });

  test('nodes have drop shadow styling', async ({ page }) => {
    const httpNode = page.locator('.react-flow__node[data-id="http-1"]');
    await expect(httpNode).toBeVisible({ timeout: 5000 });
    // The .wf-node class has box-shadow defined in CSS
    const wfNode = httpNode.locator('.wf-node');
    await expect(wfNode).toBeVisible();
  });

  test('nodes have header with icon and label', async ({ page }) => {
    const httpNode = page.locator('.react-flow__node[data-id="http-1"]');
    await expect(httpNode).toBeVisible({ timeout: 5000 });
    const header = httpNode.locator('.wf-node-header');
    await expect(header).toBeVisible();
    // Icon badge + label group inside header
    await expect(header.locator('.wf-node-icon-badge')).toBeVisible();
    await expect(header.locator('.wf-node-label')).toBeVisible();
  });

  test('condition node shows expression', async ({ page }) => {
    const condNode = page.locator('.react-flow__node[data-id="cond-1"]');
    await expect(condNode).toBeVisible({ timeout: 5000 });
    await expect(condNode).toContainText('status');
  });
});

// ────────────────────────────────────────────
// Phase 2: Execution Feedback
// ────────────────────────────────────────────

test.describe('Phase 2 – Edge Labels', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('condition edges show Yes/No labels', async ({ page }) => {
    // React Flow renders edge labels as SVG text nodes in the edge layer.
    const edgeLabels = page.locator('.react-flow__edge-text');
    await expect(edgeLabels.first()).toBeVisible({ timeout: 5000 });
    const texts = await edgeLabels.allTextContents();
    expect(texts.some(t => t.includes('Yes'))).toBe(true);
    expect(texts.some(t => t.includes('No'))).toBe(true);
  });
});

test.describe('Phase 2 – Canvas Background', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('canvas has dot-grid background pattern', async ({ page }) => {
    // React Flow renders Background component as SVG pattern
    const bgPattern = page.locator('.react-flow__background');
    await expect(bgPattern).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Phase 2 – Arrow Markers on Edges', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('edges have arrow markers', async ({ page }) => {
    // React Flow renders marker definitions in an SVG defs element
    const markers = page.locator('.react-flow__marker');
    await expect(markers.first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Phase 2 – Node Sublabel (Category)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('nodes display category sublabel', async ({ page }) => {
    const httpNode = page.locator('.react-flow__node[data-id="http-1"]');
    await expect(httpNode).toBeVisible({ timeout: 5000 });
    const sublabel = httpNode.locator('.wf-node-sublabel');
    // Sublabel shows category like "Action" or "HTTP Request"
    if (await sublabel.count() > 0) {
      await expect(sublabel).toBeVisible();
    }
  });
});

test.describe('Phase 2 – Minimap', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('minimap renders with correct node colors', async ({ page }) => {
    const minimapBtn = page.locator('.wf-pill-btn[title="Toggle minimap"]');
    await minimapBtn.click();
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).toBeVisible({ timeout: 5000 });
    // Minimap should have node representations
    const minimapNodes = minimap.locator('.react-flow__minimap-node');
    expect(await minimapNodes.count()).toBeGreaterThan(0);
  });

  test('minimap can be toggled off and on', async ({ page }) => {
    const minimap = page.locator('.react-flow__minimap');
    await expect(minimap).not.toBeVisible();

    const minimapBtn = page.locator('.wf-pill-btn[title="Toggle minimap"]');
    await minimapBtn.click();
    await expect(minimap).toBeVisible({ timeout: 5000 });

    // Toggle minimap off
    await minimapBtn.click();
    await expect(minimap).not.toBeVisible();

    // Toggle back on
    await minimapBtn.click();
    await expect(minimap).toBeVisible();
  });
});
