import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const phase25Dir = resolve(__dirname, '..', 'docs', 'test-data', 'phase25-run-comparison');

async function waitForImportedRunLabel(page: Page, labelFragment: string) {
  await expect.poll(async () => {
    const optionCount = await page.locator('.results-run-select-option').count();
    if (optionCount > 0) {
      const optionTexts = await page.locator('.results-run-select-option').allTextContents();
      return optionTexts.some((text) => text.includes(labelFragment));
    }
    const bodyText = await page.locator('body').innerText();
    return bodyText.includes(labelFragment);
  }, { timeout: 15_000 }).toBe(true);
}

async function importRun(page: Page, fileName: string) {
  const fileInput = page.locator('input[data-testid="import-run-input"]');
  const sampleJson = readFileSync(resolve(phase25Dir, fileName), 'utf-8');
  const parsed = JSON.parse(sampleJson) as { summary?: { tps?: number } };
  const tpsLabel = parsed.summary?.tps != null ? `${parsed.summary.tps} TPS` : null;

  await fileInput.setInputFiles({
    name: fileName,
    mimeType: 'application/json',
    buffer: Buffer.from(sampleJson),
  });

  if (tpsLabel) {
    await waitForImportedRunLabel(page, tpsLabel);
  } else {
    await page.waitForSelector('.results-run-select', { timeout: 15_000 });
  }
}

async function selectRunByLabelFragment(page: Page, labelFragment: string) {
  await page.waitForSelector('.results-run-select', { timeout: 15_000 });
  await page.locator('.results-run-select-trigger').click();
  await expect(page.locator('.results-run-select-menu')).toBeVisible();
  await expect(page.locator('.results-run-select-menu')).toContainText(labelFragment);
  const optionTexts = await page.locator('.results-run-select-option').allTextContents();
  const optionIndex = optionTexts.findIndex((text) => text.includes(labelFragment));
  expect(optionIndex).toBeGreaterThanOrEqual(0);
  await page.locator('.results-run-select-option').nth(optionIndex).click();
}

async function markSelectedRunAsBaseline(page: Page) {
  const baselineToggle = page.getByRole('button', { name: /Set Baseline|Baseline/i }).first();
  await baselineToggle.click();
  await expect(page.getByRole('button', { name: /★ Baseline/i })).toBeVisible();
}

async function selectCompareOptionByLabelFragment(page: Page, labelFragment: string) {
  const compareSelect = page.locator('.baseline-compare-select');
  const optionValue = await compareSelect.evaluate((select, fragment) => {
    const options = Array.from((select as HTMLSelectElement).options);
    return options.find((option) => option.textContent?.includes(fragment as string))?.value ?? '';
  }, labelFragment);
  expect(optionValue).not.toBe('');
  await compareSelect.selectOption({ value: optionValue });
}

test.describe('Phase 25 run comparison and trends', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        delete (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker;
      } catch {
        (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined;
      }
    });
    await page.goto('/?tab=results');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 25000 });
  });

  test('imports the performance regression baseline sample and exposes analysis controls', async ({ page }) => {
    await importRun(page, 'baseline-run.json');
    await importRun(page, 'regression-run.json');
    await importRun(page, 'improved-run.json');
    await importRun(page, 'alt-scope-run.json');
    await importRun(page, 'workflow-run.json');

    await page.waitForSelector('.results-run-select', { timeout: 10000 });
    await expect(page.locator('.results-run-select-text')).toContainText('Phase 25');

    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Request Details' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'SLA' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Comparison & Trends/ })).toBeVisible();
  });

  test('can set and unset a baseline run', async ({ page }) => {
    await importRun(page, 'baseline-run.json');

    const baselineToggle = page.getByRole('button', { name: /Set Baseline|Baseline/ }).first();
    await baselineToggle.click();
    await expect(page.getByRole('button', { name: /★ Baseline/ })).toBeVisible();

    await page.getByRole('tab', { name: 'Comparison & Trends' }).click();
    await expect(page.locator('.baseline-list-item')).toBeVisible();
  });

  test('compare dropdown shows baseline runs starred and non-baseline runs in the same picker', async ({ page }) => {
    await importRun(page, 'baseline-run.json');
    await importRun(page, 'regression-run.json');
    await importRun(page, 'improved-run.json');
    await page.waitForSelector('.results-run-select', { timeout: 15_000 });

    await selectRunByLabelFragment(page, '6.94 TPS');
    await markSelectedRunAsBaseline(page);
    await selectRunByLabelFragment(page, '5.1 TPS');

    await page.getByRole('tab', { name: 'Comparison & Trends' }).click();
    const compareSelect = page.locator('.baseline-compare-select');
    await expect(compareSelect).toBeVisible();
    const optionTexts = await compareSelect.locator('option').allTextContents();
    expect(optionTexts.some((text) => text.includes('★'))).toBe(true);
    expect(optionTexts.some((text) => text.includes('TPS'))).toBe(true);
  });

  test('RunComparisonPanel renders all 4 tabs when comparison is active', async ({ page }) => {
    await importRun(page, 'baseline-run.json');
    await importRun(page, 'regression-run.json');

    await selectRunByLabelFragment(page, '6.94 TPS');
    await markSelectedRunAsBaseline(page);
    await selectRunByLabelFragment(page, '5.1 TPS');

    await page.getByRole('tab', { name: 'Comparison & Trends' }).click();
    await selectCompareOptionByLabelFragment(page, '6.94 TPS');

    await expect(page.locator('.run-comparison-tab')).toHaveCount(4);
    await expect(page.locator('.run-comparison-summary')).toBeVisible();
  });

  test('regression status is visible via summary strip and table cells without duplicate top banners', async ({ page }) => {
    await importRun(page, 'baseline-run.json');
    await importRun(page, 'regression-run.json');
    await page.waitForSelector('.results-run-select', { timeout: 15_000 });

    await selectRunByLabelFragment(page, '6.94 TPS');
    await markSelectedRunAsBaseline(page);
    await selectRunByLabelFragment(page, '5.1 TPS');

    await page.getByRole('tab', { name: 'Comparison & Trends' }).click();
    await selectCompareOptionByLabelFragment(page, '6.94 TPS');
    await expect(page.locator('.run-comparison-summary')).toContainText('regressed');
    await page.getByRole('button', { name: /Regressions/ }).click();
    await expect(page.locator('.regression-detail').first()).toBeVisible();
    await expect(page.locator('.regression-alerts')).toHaveCount(0);
  });

  test('TrendChart renders when Show Trend is clicked', async ({ page }) => {
    await importRun(page, 'baseline-run.json');
    await importRun(page, 'improved-run.json');
    await importRun(page, 'regression-run.json');

    await selectRunByLabelFragment(page, '6.94 TPS');
    await markSelectedRunAsBaseline(page);
    await selectRunByLabelFragment(page, '5.1 TPS');

    await page.getByRole('tab', { name: 'Comparison & Trends' }).click();
    await page.getByRole('button', { name: 'Show Trend' }).click();
    await expect(page.locator('.trend-chart-container')).toBeVisible();
  });

  test('TrendChart scope filter changes chart data', async ({ page }) => {
    await importRun(page, 'baseline-run.json');
    await importRun(page, 'workflow-run.json');

    await selectRunByLabelFragment(page, '5.56 TPS');

    await page.getByRole('tab', { name: 'Comparison & Trends' }).click();
    await page.getByRole('button', { name: 'Show Trend' }).click();
    const scopeSelect = page.locator('.trend-scope-select');
    await expect(scopeSelect).toBeVisible();
    await scopeSelect.selectOption('workflow');
    await expect(page.locator('.empty-hint').filter({ hasText: 'Only 1 run match this scope' })).toBeVisible();
  });

  test('regression thresholds panel opens and saves values', async ({ page }) => {
    await importRun(page, 'baseline-run.json');
    await selectRunByLabelFragment(page, '6.94 TPS');
    await page.getByRole('tab', { name: 'Comparison & Trends' }).click();
    const firstThreshold = page.locator('.thresholds-panel .thresholds-input').first();
    await firstThreshold.fill('12');
    await page.locator('.thresholds-panel .btn-primary').click();
    await expect(page.locator('.thresholds-status-message')).toContainText('Thresholds saved.');
  });

  test('export comparison as Markdown triggers download', async ({ page }) => {
    await importRun(page, 'baseline-run.json');
    await importRun(page, 'regression-run.json');
    await page.waitForSelector('.results-run-select', { timeout: 15_000 });
    await selectRunByLabelFragment(page, '6.94 TPS');
    await markSelectedRunAsBaseline(page);
    await selectRunByLabelFragment(page, '5.1 TPS');
    await page.getByRole('tab', { name: 'Comparison & Trends' }).click();
    await selectCompareOptionByLabelFragment(page, '6.94 TPS');
    await expect(page.locator('.run-comparison-summary')).toBeVisible({ timeout: 15_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('button', { name: /Export ▾/ }).click();
    await page.getByRole('button', { name: /Markdown/ }).click();
    await downloadPromise;
  });

  test('Run picker modal opens and allows comparing two arbitrary runs', async ({ page }) => {
    await importRun(page, 'baseline-run.json');
    await importRun(page, 'alt-scope-run.json');
    await selectRunByLabelFragment(page, '6.94 TPS');
    await page.getByRole('tab', { name: 'Comparison & Trends' }).click();

    // Select the non-baseline run directly from the custom run picker.
    await page.locator('.results-run-select-trigger').click();
    await page.locator('[role="option"]').filter({ hasText: '6.58 TPS' }).first().click();
    await expect(page.locator('.results-run-select-text')).toContainText('6.58 TPS');
  });
});