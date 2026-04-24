/**
 * E2E tests for Webhook Delivery Logs page.
 * Tests tab navigation, loading state, error state, list rendering, date navigation, and detail panel.
 * Uses route interception to mock the server API since the webhook server may not be running.
 */
import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

const TODAY = new Date().toISOString().split('T')[0];

const MOCK_DELIVERIES = [
  {
    triggerId: 'webhook-order-1',
    method: 'POST',
    payload: { orderId: '12345', amount: 99.99 },
    status: 'success',
    duration: 120,
    timestamp: `${TODAY}T10:30:00.000Z`,
  },
  {
    triggerId: 'webhook-order-1',
    method: 'POST',
    payload: { orderId: '67890', amount: 149.99 },
    status: 'failed',
    duration: 350,
    timestamp: `${TODAY}T11:00:00.000Z`,
  },
  {
    triggerId: 'webhook-alert-2',
    method: 'PUT',
    payload: { alertId: 'A-001' },
    status: 'error',
    duration: 5,
    timestamp: `${TODAY}T12:15:00.000Z`,
    error: 'Connection refused',
  },
];

test.describe('Webhook Delivery Logs', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    // Mock the webhook deliveries API
    await page.route('**/api/webhook-deliveries*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ deliveries: MOCK_DELIVERIES }),
      });
    });
  });

  test('navigates to webhook deliveries tab and shows list', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Workflow');
    const tab = page.locator('button', { hasText: /Webhook|Deliveries/i });
    await tab.click();

    await expect(page.locator('.whl-title')).toBeVisible();
    await expect(page.locator('.whl-title')).toHaveText('Webhook Delivery Logs');
  });

  test('displays delivery cards with correct info', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Workflow');
    const tab = page.locator('button', { hasText: /Webhook|Deliveries/i });
    await tab.click();

    const cards = page.locator('.whl-card');
    await expect(cards).toHaveCount(3);

    // First card should show POST method and success badge
    const firstCard = cards.nth(0);
    await expect(firstCard.locator('.whl-method')).toHaveText('POST');
    await expect(firstCard.locator('.whl-badge')).toHaveText('SUCCESS');
  });

  test('shows detail panel when clicking a delivery', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Workflow');
    const tab = page.locator('button', { hasText: /Webhook|Deliveries/i });
    await tab.click();

    // Click first delivery card
    await page.locator('.whl-card').first().click();

    // Detail panel should appear
    await expect(page.locator('.whl-detail')).toBeVisible();
    await expect(page.locator('.whl-detail-title')).toHaveText('Delivery Details');

    // Should show trigger ID
    await expect(page.locator('.whl-info-value.whl-mono').first()).toContainText('webhook-order-1');

    // Should show payload
    await expect(page.locator('.whl-payload')).toBeVisible();
    await expect(page.locator('.whl-payload')).toContainText('12345');
  });

  test('closes detail panel when clicking close button', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Workflow');
    const tab = page.locator('button', { hasText: /Webhook|Deliveries/i });
    await tab.click();

    await page.locator('.whl-card').first().click();
    await expect(page.locator('.whl-detail')).toBeVisible();

    await page.locator('.whl-btn-ghost').click();
    await expect(page.locator('.whl-detail')).not.toBeVisible();
  });

  test('shows error state when server is unavailable', async ({ page }) => {
    await page.route('**/api/webhook-deliveries*', (route) => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.goto('/');
    await page.click('text=Workflow');
    const tab = page.locator('button', { hasText: /Webhook|Deliveries/i });
    await tab.click();

    await expect(page.locator('.whl-error-title')).toBeVisible();
    await expect(page.locator('.whl-error-title')).toHaveText('Error Loading Webhook Deliveries');
  });

  test('shows empty state when no deliveries', async ({ page }) => {
    await page.route('**/api/webhook-deliveries*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ deliveries: [] }),
      });
    });

    await page.goto('/');
    await page.click('text=Workflow');
    const tab = page.locator('button', { hasText: /Webhook|Deliveries/i });
    await tab.click();

    await expect(page.locator('.whl-empty-title')).toBeVisible();
    await expect(page.locator('.whl-empty-title')).toHaveText('No webhook deliveries found');
  });

  test('date navigation changes the date and reloads', async ({ page }) => {
    let requestedDates: string[] = [];
    await page.route('**/api/webhook-deliveries*', (route) => {
      const url = new URL(route.request().url());
      const date = url.searchParams.get('date');
      if (date) requestedDates.push(date);
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ deliveries: [] }),
      });
    });

    await page.goto('/');
    await page.click('text=Workflow');
    const tab = page.locator('button', { hasText: /Webhook|Deliveries/i });
    await tab.click();

    // Click prev day button
    await page.locator('.whl-btn-secondary', { hasText: '← Prev' }).click();
    // Wait for the request
    // Wait for the new empty state to render after date change
    await expect(page.locator('.whl-empty-title')).toBeVisible();

    // Should have made at least 2 API calls (initial + prev)
    expect(requestedDates.length).toBeGreaterThanOrEqual(2);

    // The prev date should be one day before today
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expectedDate = yesterday.toISOString().split('T')[0];
    expect(requestedDates).toContain(expectedDate);
  });

  test('shows error details in delivery detail panel', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Workflow');
    const tab = page.locator('button', { hasText: /Webhook|Deliveries/i });
    await tab.click();

    // Click the error delivery (3rd card)
    await page.locator('.whl-card').nth(2).click();

    // Should show error section
    await expect(page.locator('.whl-error-block')).toBeVisible();
    await expect(page.locator('.whl-error-block code')).toHaveText('Connection refused');
  });

  test('refresh button reloads deliveries', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/webhook-deliveries*', (route) => {
      callCount++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ deliveries: MOCK_DELIVERIES }),
      });
    });

    await page.goto('/');
    await page.click('text=Workflow');
    const tab = page.locator('button', { hasText: /Webhook|Deliveries/i });
    await tab.click();
    await expect(page.locator('.whl-card')).toHaveCount(3);

    const initialCount = callCount;
    await page.locator('.whl-btn-primary', { hasText: 'Refresh' }).click();
    await expect(page.locator('.whl-card')).toHaveCount(3);
    expect(callCount).toBeGreaterThan(initialCount);
  });
});
