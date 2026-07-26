/**
 * E2E tests for Workflow Execution History page.
 * Tests the tab navigation, loading state, error state, list rendering, filtering, and detail panel.
 * Uses route interception to mock the server API since the webhook server may not be running.
 */
import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

async function chooseExhFilter(page: import('@playwright/test').Page, label: string) {
  const select = page.locator('.exh-select').first();
  await select.locator('.cs-trigger').click();
  await page.locator('.cs-menu .cs-item', { hasText: label }).first().click();
}

const MOCK_EXECUTIONS = [
  {
    id: 'exec-1',
    workflowId: 'wf-1',
    triggerId: 'trigger-1',
    triggerType: 'webhook',
    status: 'success',
    duration: 150,
    results: [
      { url: 'https://api.example.com/orders', statusCode: 200, responseTime: 85.5, body: '{"ok":true}' },
    ],
    variables: { orderId: '12345' },
    timestamp: '2025-01-15T10:30:00.000Z',
  },
  {
    id: 'exec-2',
    workflowId: 'wf-1',
    triggerId: 'trigger-2',
    triggerType: 'schedule',
    status: 'failed',
    duration: 500,
    results: [
      { url: 'https://api.example.com/report', statusCode: 500, responseTime: 450.2 },
    ],
    variables: { triggerTime: '2025-01-15T09:00:00.000Z' },
    timestamp: '2025-01-15T09:00:00.000Z',
  },
  {
    id: 'exec-3',
    workflowId: 'wf-2',
    triggerId: 'trigger-3',
    triggerType: 'webhook',
    status: 'error',
    duration: 10,
    results: [],
    variables: {},
    timestamp: '2025-01-14T15:00:00.000Z',
    error: 'Workflow not found',
  },
];

test.describe('Workflow Execution History', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    // Mock the executions API
    await page.route('**/api/executions*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ executions: MOCK_EXECUTIONS }),
      });
    });
  });

  test('navigates to execution history tab and shows list', async ({ page }) => {
    await page.goto('/');
    // Navigate to the workflow section first
    await page.click('.ab-btn[title="Workflow"]');
    // Then click execution history tab
    const tab = page.locator('button', { hasText: /Executions|Execution History/i });
    await tab.click();
    // Should show the execution list
    await expect(page.locator('.exh-title')).toBeVisible();
    await expect(page.locator('.exh-title')).toHaveText('Workflow Execution History');
  });

  test('displays execution cards with correct info', async ({ page }) => {
    await page.goto('/');
    await page.click('.ab-btn[title="Workflow"]');
    const tab = page.locator('button', { hasText: /Executions|Execution History/i });
    await tab.click();

    // Should show all 3 executions
    const cards = page.locator('.exh-card');
    await expect(cards).toHaveCount(3);

    // First card should show webhook trigger and success badge
    const firstCard = cards.nth(0);
    await expect(firstCard.locator('.exh-badge')).toHaveText('SUCCESS');
  });

  test('filters executions by trigger type', async ({ page }) => {
    await page.goto('/');
    await page.click('.ab-btn[title="Workflow"]');
    const tab = page.locator('button', { hasText: /Executions|Execution History/i });
    await tab.click();

    // Filter to webhooks only
    await chooseExhFilter(page, 'Webhooks');
    const cards = page.locator('.exh-card');
    await expect(cards).toHaveCount(2); // exec-1 and exec-3

    // Filter to schedules only
    await chooseExhFilter(page, 'Schedules');
    await expect(cards).toHaveCount(1); // exec-2

    // Back to all
    await chooseExhFilter(page, 'All Types');
    await expect(cards).toHaveCount(3);
  });

  test('shows detail panel when clicking an execution', async ({ page }) => {
    await page.goto('/');
    await page.click('.ab-btn[title="Workflow"]');
    const tab = page.locator('button', { hasText: /Executions|Execution History/i });
    await tab.click();

    // Click first execution card
    await page.locator('.exh-card').first().click();

    // Detail panel should appear
    await expect(page.locator('.exh-detail')).toBeVisible();
    await expect(page.locator('.exh-detail-title')).toHaveText('Execution Details');

    // Should show execution info
    await expect(page.locator('.exh-info-value.exh-mono').first()).toContainText('exec-1');
  });

  test('closes detail panel when clicking close button', async ({ page }) => {
    await page.goto('/');
    await page.click('.ab-btn[title="Workflow"]');
    const tab = page.locator('button', { hasText: /Executions|Execution History/i });
    await tab.click();

    // Open detail
    await page.locator('.exh-card').first().click();
    await expect(page.locator('.exh-detail')).toBeVisible();

    // Close detail
    await page.locator('.exh-btn-ghost').click();
    await expect(page.locator('.exh-detail')).not.toBeVisible();
  });

  test('shows error state when server is unavailable', async ({ page }) => {
    // Override the route to return an error
    await page.route('**/api/executions*', (route) => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.goto('/');
    await page.click('.ab-btn[title="Workflow"]');
    const tab = page.locator('button', { hasText: /Executions|Execution History/i });
    await tab.click();

    await expect(page.locator('.exh-error-title')).toBeVisible();
    await expect(page.locator('.exh-error-title')).toHaveText('Error Loading Executions');
  });

  test('shows empty state when no executions', async ({ page }) => {
    await page.route('**/api/executions*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ executions: [] }),
      });
    });

    await page.goto('/');
    await page.click('.ab-btn[title="Workflow"]');
    const tab = page.locator('button', { hasText: /Executions|Execution History/i });
    await tab.click();

    await expect(page.locator('.exh-empty-title')).toBeVisible();
    await expect(page.locator('.exh-empty-title')).toHaveText('No executions found');
  });

  test('shows error details in execution detail panel', async ({ page }) => {
    await page.goto('/');
    await page.click('.ab-btn[title="Workflow"]');
    const tab = page.locator('button', { hasText: /Executions|Execution History/i });
    await tab.click();

    // Click the error execution (3rd card)
    await page.locator('.exh-card').nth(2).click();

    // Should show error section
    await expect(page.locator('.exh-error-block')).toBeVisible();
    await expect(page.locator('.exh-error-block code')).toHaveText('Workflow not found');
  });

  test('refresh button reloads executions', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/executions*', (route) => {
      callCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ executions: MOCK_EXECUTIONS }),
      });
    });

    await page.goto('/');
    await page.click('.ab-btn[title="Workflow"]');
    const tab = page.locator('button', { hasText: /Executions|Execution History/i });
    await tab.click();
    await expect(page.locator('.exh-card')).toHaveCount(3);

    const initialCount = callCount;
    await page.locator('.exh-btn-primary', { hasText: 'Refresh' }).click();
    // Wait for the API call to complete
    await expect(page.locator('.exh-card')).toHaveCount(3);
    expect(callCount).toBeGreaterThan(initialCount);
  });
});
