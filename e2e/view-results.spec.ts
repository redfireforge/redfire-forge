import { test, expect } from '@playwright/test';

test.describe('View Results flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const project = {
        id: 'e2e-project', name: 'E2E Test Project', createdAt: Date.now(),
        environments: [{ id: 'env-1', name: 't01' }],
        microservices: [{ id: 'svc-1', name: 'test-service', baseUrls: { 'env-1': 'http://localhost:5173' } }],
        globalAuthProfiles: [],
        featureGroups: [{
          id: 'fg-1', name: 'E2E Feature', microserviceId: 'svc-1', environmentId: 'env-1',
          scenarios: [{ id: 'sc-1', name: 'E2E Scenario', tests: [{
            id: 'test-1', name: 'GET Health', url: 'http://localhost:5173/',
            method: 'GET', headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          }] }],
        }],
        selectedEnvId: 'env-1', selectedSvcId: 'svc-1',
      };
      localStorage.setItem('perf-test-projects', JSON.stringify([project]));
      localStorage.setItem('perf-test-selected-project', 'e2e-project');

      const testRun = {
        id: 'run-e2e-1', timestamp: Date.now(),
        projectName: 'E2E Test Project', envName: 't01', svcName: 'test-service',
        baseUrl: 'http://localhost:5173',
        config: { concurrency: 1, totalTransactions: 3, scenarioWeights: [], executionMode: 'sequential' },
        summary: {
          tps: 10, avgResponseTime: 50, minResponseTime: 20, maxResponseTime: 80,
          p95ResponseTime: 75, p99ResponseTime: 79, errorRate: 0,
          errorsByStatus: {}, totalRequests: 3, successfulRequests: 3,
          failedRequests: 0, failedValidations: 0, totalDurationMs: 300,
        },
        results: [
          { id: 'r1', scenarioId: 'test-1', scenarioName: 'GET Health', featureGroupName: 'E2E Feature', groupName: 'E2E Scenario',
            url: 'http://localhost:5173/', method: 'GET', httpStatus: 200, responseTimeMs: 20,
            responseBody: '{"ok":true}', timestamp: Date.now(), passed: true, validationMode: 'none', failureDetails: [] },
          { id: 'r2', scenarioId: 'test-1', scenarioName: 'GET Health', featureGroupName: 'E2E Feature', groupName: 'E2E Scenario',
            url: 'http://localhost:5173/', method: 'GET', httpStatus: 200, responseTimeMs: 50,
            responseBody: '{"ok":true}', timestamp: Date.now(), passed: true, validationMode: 'none', failureDetails: [] },
          { id: 'r3', scenarioId: 'test-1', scenarioName: 'GET Health', featureGroupName: 'E2E Feature', groupName: 'E2E Scenario',
            url: 'http://localhost:5173/', method: 'GET', httpStatus: 200, responseTimeMs: 80,
            responseBody: '{"ok":true}', timestamp: Date.now(), passed: true, validationMode: 'none', failureDetails: [] },
        ],
      };
      localStorage.setItem('perf-test-runs', JSON.stringify([testRun]));
      localStorage.setItem('perf-test-theme', 'dark');
    });
    await page.goto('/');
    await page.waitForSelector('.app-header');
  });

  test('navigate to Results tab and see metrics', async ({ page }) => {
    await page.click('.tab:has-text("Results")');
    await expect(page.locator('.tab.active')).toHaveText('Results');

    // Use specific locators to avoid strict mode violations (TPS appears in dropdown too)
    await expect(page.locator('.metric-label:has-text("TPS")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.metric-label:has-text("Avg Response")')).toBeVisible();
  });

  test('results show run history dropdown', async ({ page }) => {
    await page.click('.tab:has-text("Results")');

    const dropdown = page.locator('select').first();
    await expect(dropdown).toBeVisible();
    const options = dropdown.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
  });

  test('results show request count in metrics', async ({ page }) => {
    await page.click('.tab:has-text("Results")');

    // Total Requests metric
    await expect(page.locator('.metric-label:has-text("Total Requests")')).toBeVisible({ timeout: 5000 });
  });

  test('group by controls are present', async ({ page }) => {
    await page.click('.tab:has-text("Results")');

    await expect(page.getByText('Group by')).toBeVisible({ timeout: 5000 });
  });
});
