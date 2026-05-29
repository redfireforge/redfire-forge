import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('Import CLI Run into Results', () => {
  const sampleRunPath = resolve(__dirname, '..', 'test-data', 'cli-sample-run.json');

  test('imports a CLI JSON result file and displays it in Results', async ({ page }) => {
    // Navigate to Results tab (empty state)
    await page.goto('/?tab=results');
    await page.waitForSelector('.app-header', { timeout: 10000 });

    // Verify the Import Test Results button is visible
    const importBtn = page.locator('button:has-text("📥 Import Test Results")');
    await expect(importBtn).toBeVisible();

    // Use the hidden file input to upload the sample CLI run
    const fileInput = page.locator('input[data-testid="import-run-input"]');
    const sampleJson = readFileSync(sampleRunPath, 'utf-8');
    await fileInput.setInputFiles({
      name: 'cli-sample-run.json',
      mimeType: 'application/json',
      buffer: Buffer.from(sampleJson),
    });

    // Wait a moment for async handler to process
    await page.waitForTimeout(2000);

    // Check if import error is shown
    const importError = page.locator('.results-import-error');
    if (await importError.isVisible()) {
      const errText = await importError.textContent();
      throw new Error('Import error displayed: ' + errText);
    }

    // Wait for the run to appear in the run list
    await page.waitForSelector('.results-run-select', { timeout: 10000 });

    // Verify the imported run is selected and shows the project name
    // ResultsRunSelect is a custom listbox (not a native <select>), so read the trigger text
    const runSelect = page.locator('.results-run-select');
    const selectedLabel = runSelect.locator('.results-run-select-text');
    const optionText = await selectedLabel.textContent({ timeout: 5000 });
    expect(optionText).toContain('CLI Sample Run');

    // Verify metrics cards are visible (proves the run data loaded)
    await expect(page.locator('.metrics-row').first()).toBeVisible({ timeout: 5000 });

    // Verify context tags show environment
    await expect(page.locator('.context-tag.env-tag')).toHaveText('staging');

    // Verify SLA compact bar is visible (since slaTargets were embedded in config)
    await expect(page.locator('.sla-compact-bar')).toBeVisible({ timeout: 5000 });
  });

  test('shows error for invalid JSON file', async ({ page }) => {
    await page.goto('/?tab=results');
    await page.waitForSelector('.app-header', { timeout: 10000 });

    const fileInput = page.locator('input[data-testid="import-run-input"]');
    await fileInput.setInputFiles({
      name: 'bad-file.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ "not": "a valid run" }'),
    });

    // Should show an error message
    const errorMsg = page.locator('.results-import-error');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
    const errorText = await errorMsg.textContent();
    expect(errorText).toContain('Import failed');
  });

  test('Import Run button is also visible when runs already exist', async ({ page }) => {
    // Seed a run via localStorage so the non-empty state renders
    await page.addInitScript(() => {
      const testRun = {
        id: 'run-existing-1', timestamp: Date.now(),
        config: { concurrency: 1, iterations: 1, scenarioWeights: [], executionMode: 'sequential' },
        summary: {
          totalRequests: 1, totalDurationMs: 100, avgResponseTime: 50,
          minResponseTime: 50, maxResponseTime: 50,
          p50ResponseTime: 50, p95ResponseTime: 50, p99ResponseTime: 50,
          failedRequests: 0, failedValidations: 0, errorRate: 0,
          successfulRequests: 1, errorsByStatus: {},
        },
        results: [{
          id: 'r1', scenarioName: 'Test', url: 'http://localhost/', method: 'GET',
          httpStatus: 200, responseTimeMs: 50, timestamp: Date.now(), passed: true,
          responseBody: '{"ok":true}', validationMode: 'none', failureDetails: [],
        }],
      };
      localStorage.setItem('perf-test-runs', JSON.stringify([testRun]));
    });

    await page.goto('/?tab=results');
    await page.waitForSelector('.app-header', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Import Test Results button should be visible in the non-empty toolbar
    const importBtn = page.locator('button:has-text("📥 Import Test Results")');
    await expect(importBtn).toBeVisible({ timeout: 5000 });
  });
});
