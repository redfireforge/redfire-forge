import { test, expect } from '@playwright/test';

test.describe('Response Detail Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('perf-test-v3-environments', JSON.stringify([{ id: 'env-1', name: 't01' }]));
      localStorage.setItem('perf-test-v3-microservices', JSON.stringify([{
        id: 'svc-1', name: 'test-service',
        baseUrls: { 'env-1': 'http://localhost:5173' },
      }]));
      localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([{
        id: 'fg-1', name: 'E2E Feature', microserviceId: 'svc-1', environmentId: 'env-1',
        scenarios: [{ id: 'sc-1', name: 'E2E Scenario', tests: [{
          id: 'test-1', name: 'GET Health', url: 'http://localhost:5173/',
          method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
        }] }],
      }]));
      localStorage.setItem('perf-test-v3-selected-env', 'env-1');
      localStorage.setItem('perf-test-v3-selected-svc', 'svc-1');
      localStorage.setItem('perf-test-v3-migrated', 'true');

      // Create a test run with long response body to ensure scrollbar appears
      const longResponseBody = JSON.stringify({
        data: Array.from({ length: 50 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
          timestamp: Date.now(),
          status: 'active',
        })),
      });

      const testRun = {
        id: 'run-e2e-1', timestamp: Date.now(),
        envName: 't01', svcName: 'test-service',
        baseUrl: 'http://localhost:5173',
        config: { concurrency: 1, totalTransactions: 3, scenarioWeights: [], executionMode: 'sequential' },
        summary: {
          tps: 10, avgResponseTime: 50, minResponseTime: 20, maxResponseTime: 80,
          p95ResponseTime: 75, p99ResponseTime: 79, errorRate: 0,
          errorsByStatus: {}, totalRequests: 3, successfulRequests: 3,
          failedRequests: 0, failedValidations: 0, totalDurationMs: 300,
        },
        results: [
          {
            id: 'r1', scenarioId: 'test-1', scenarioName: 'GET Health',
            featureGroupName: 'E2E Feature', groupName: 'E2E Scenario',
            url: 'http://localhost:5173/', method: 'GET', httpStatus: 200, responseTimeMs: 20,
            responseBody: longResponseBody, timestamp: Date.now(), passed: true,
            validationMode: 'none', failureDetails: [],
            timing: {
              dnsLookup: 2, tcpConnect: 3, tlsHandshake: 4,
              ttfb: 5, download: 6, total: 20,
            },
          },
        ],
      };
      localStorage.setItem('perf-test-runs', JSON.stringify([testRun]));
      localStorage.setItem('perf-test-theme', 'dark');
    });
    await page.goto('/?tab=results');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('modal opens with title and footer close button', async ({ page }) => {
    // Wait for results table to be visible
    await expect(page.locator('.metric-label:has-text("Total Requests")')).toBeVisible({ timeout: 5000 });
    
    // Wait for clickable row to appear
    await expect(page.locator('tr.clickable-row')).toBeVisible({ timeout: 5000 });
    
    // Click on a result row to open the modal
    await page.locator('tr.clickable-row').first().click();
    
    // Wait for modal to appear
    await expect(page.locator('.response-detail-modal')).toBeVisible({ timeout: 5000 });
    
    // Check header has title
    await expect(page.locator('.response-detail-modal .ram-header h3')).toHaveText('Response Detail');
    
    // Check footer close button exists (header expand/close are hidden via CSS)
    await expect(page.locator('.response-detail-modal button:has-text("Close")')).toBeVisible();
  });

  test('scrollbar is thin (5px) in normal mode', async ({ page }) => {
    // Wait for results table
    await expect(page.locator('tr.clickable-row')).toBeVisible({ timeout: 5000 });
    
    // Click on a result row to open the modal
    await page.locator('tr.clickable-row').first().click();
    
    // Wait for modal to appear
    await expect(page.locator('.response-detail-modal')).toBeVisible({ timeout: 5000 });
    
    // Get the body element
    const body = page.locator('.response-detail-body');
    
    // Check scrollbar width using evaluate
    const scrollbarWidth = await body.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el, '::-webkit-scrollbar');
      return computedStyle.width;
    });
    
    // In normal mode, scrollbar should be 5px
    expect(scrollbarWidth).toBe('5px');
  });

  test('scrollbar style is consistent in response body', async ({ page }) => {
    // Wait for results table
    await expect(page.locator('tr.clickable-row')).toBeVisible({ timeout: 5000 });
    
    // Click on a result row to open the modal
    await page.locator('tr.clickable-row').first().click();
    
    // Wait for modal to appear
    await expect(page.locator('.response-detail-modal')).toBeVisible({ timeout: 5000 });
    
    // Get the body element
    const body = page.locator('.response-detail-body');
    
    // Check scrollbar width using evaluate
    const scrollbarWidth = await body.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el, '::-webkit-scrollbar');
      return computedStyle.width;
    });
    
    // Scrollbar should be 5px (expand/close buttons are hidden in this modal)
    expect(scrollbarWidth).toBe('5px');
  });

  test('modal has correct flex layout for scrolling', async ({ page }) => {
    // Click on a result row to open the modal
    await page.locator('tr.clickable-row').first().click();
    
    // Wait for modal to appear
    const modal = page.locator('.response-detail-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Check modal has overflow: hidden
    const modalOverflow = await modal.evaluate((el) => window.getComputedStyle(el).overflow);
    expect(modalOverflow).toBe('hidden');
    
    // Check body has flex: 1
    const body = page.locator('.response-detail-body');
    const bodyFlex = await body.evaluate((el) => window.getComputedStyle(el).flex);
    expect(bodyFlex).toContain('1');
    
    // Check body has min-height: 0
    const bodyMinHeight = await body.evaluate((el) => window.getComputedStyle(el).minHeight);
    expect(bodyMinHeight).toBe('0px');
  });

  test('modal overlay and dialog have correct classes', async ({ page }) => {
    // Wait for results table
    await expect(page.locator('tr.clickable-row')).toBeVisible({ timeout: 5000 });
    
    // Click on a result row to open the modal
    await page.locator('tr.clickable-row').first().click();
    
    // Wait for modal to appear
    await expect(page.locator('.response-detail-modal')).toBeVisible({ timeout: 5000 });
    
    // Check overlay has response-detail-overlay class
    await expect(page.locator('.modal-overlay.response-detail-overlay')).toBeVisible({ timeout: 1000 });
    
    // Check dialog has response-detail-modal class
    await expect(page.locator('.modal.ram-modal.response-detail-modal')).toBeVisible();
  });

  test('badges stay in body in gray box (not in header)', async ({ page }) => {
    // Wait for results table
    await expect(page.locator('tr.clickable-row')).toBeVisible({ timeout: 5000 });
    
    // Click on a result row to open the modal
    await page.locator('tr.clickable-row').first().click();
    
    // Wait for modal to appear
    await expect(page.locator('.response-detail-modal')).toBeVisible({ timeout: 5000 });
    
    // Check badges container is in body
    const badgesInBody = page.locator('.response-detail-body .response-detail-meta');
    await expect(badgesInBody).toBeVisible();
    
    // Check badges container has proper background
    const metaBackground = await badgesInBody.evaluate((el) => 
      window.getComputedStyle(el).background
    );
    expect(metaBackground).toContain('rgba(255, 255, 255, 0.03)');
    
    // Check method badge exists in body
    await expect(page.locator('.response-detail-body .method-badge')).toBeVisible();
    
    // Check status tag exists in body (use first() since there are multiple tags)
    await expect(page.locator('.response-detail-body .tag').first()).toBeVisible();
  });

  test('close button closes the modal', async ({ page }) => {
    // Wait for results table
    await expect(page.locator('tr.clickable-row')).toBeVisible({ timeout: 5000 });
    
    // Click on a result row to open the modal
    await page.locator('tr.clickable-row').first().click();
    
    // Wait for modal to appear
    await expect(page.locator('.response-detail-modal')).toBeVisible({ timeout: 5000 });
    
    // Click footer close button (header close button is hidden via CSS)
    await page.locator('.response-detail-modal button:has-text("Close")').click();
    
    // Modal should disappear
    await expect(page.locator('.response-detail-modal')).not.toBeVisible({ timeout: 1000 });
  });

  test('modal can be reopened after closing', async ({ page }) => {
    // Wait for results table
    await expect(page.locator('tr.clickable-row')).toBeVisible({ timeout: 5000 });
    
    // Click on a result row to open the modal
    await page.locator('tr.clickable-row').first().click();
    
    // Wait for modal to appear
    await expect(page.locator('.response-detail-modal')).toBeVisible({ timeout: 5000 });
    
    // Close via footer button
    await page.locator('.response-detail-modal button:has-text("Close")').click();
    
    // Modal should disappear
    await expect(page.locator('.response-detail-modal')).not.toBeVisible({ timeout: 1000 });
    
    // Click row again to reopen
    await page.locator('tr.clickable-row').first().click();
    
    // Modal should reappear
    await expect(page.locator('.response-detail-modal')).toBeVisible({ timeout: 5000 });
  });
});
