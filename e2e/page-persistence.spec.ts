import { test, expect } from '@playwright/test';

async function selectHeaderOption(page: import('@playwright/test').Page, testId: string, label: string) {
  const select = page.locator(`[data-testid="${testId}"]`);
  await select.locator('.cs-trigger').click();
  await page.locator('.cs-menu[role="listbox"] .cs-item[role="option"]', { hasText: label }).click();
}

async function expectHeaderValue(select: import('@playwright/test').Locator, value: string) {
  await expect(select).toHaveAttribute('data-value', value);
}

/**
 * Seeds multi-env data via addInitScript so it is available on the FIRST page
 * load.  A localStorage guard prevents the initScript from overwriting
 * data that the app itself saved on subsequent reloads.
 */
function seedMultiEnv(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    // On the first load the guard key is absent → seed.
    // On every reload the guard is already set → skip so app-persisted
    // data (e.g. the newly-selected env) is not clobbered.
    if (localStorage.getItem('__e2e_seed_done__')) return;
    localStorage.setItem('__e2e_seed_done__', '1');

    localStorage.setItem('perf-test-v3-environments', JSON.stringify([
      { id: 'gal-env', name: 'Gallery Samples' },
      { id: 't01-env', name: 't01' },
      { id: 't02-env', name: 't02' },
    ]));
    localStorage.setItem('perf-test-v3-microservices', JSON.stringify([
      { id: 'gal-svc', name: 'Gallery Samples', baseUrls: { 'gal-env': '' } },
      { id: 't01-svc', name: 'sales-product-autoassign', baseUrls: { 't01-env': 'https://example.com' } },
      { id: 't02-svc', name: 'another-service', baseUrls: { 't02-env': 'https://example2.com' } },
    ]));
    localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([
      { id: 'fg-gal', name: 'Gallery: Sample', source: 'gallery', microserviceId: 'gal-svc', environmentId: 'gal-env', scenarios: [] },
      { id: 'fg-t01', name: 'My Tests', microserviceId: 't01-svc', environmentId: 't01-env', scenarios: [{ id: 'sc-1', name: 'Scenario A', tests: [] }] },
      { id: 'fg-t02', name: 'Other Tests', microserviceId: 't02-svc', environmentId: 't02-env', scenarios: [] },
    ]));
    localStorage.setItem('perf-test-v3-selected-env', 'gal-env');
    localStorage.setItem('perf-test-v3-selected-svc', 'gal-svc');
    localStorage.setItem('perf-test-v3-migrated', 'true');
  });
}

test.describe('Page persistence across refresh', () => {
  // All tests in this describe block involve page reloads
  test.describe.configure({ mode: 'serial' });

  test('selecting t01 via sidebar persists after refresh', async ({ page }) => {
    test.slow(); // Involves page reload
    await seedMultiEnv(page);
    await page.goto('http://localhost:5173/?tab=scenarios');
    await page.waitForLoadState('networkidle');

    // Wait for the app to fully load - header dropdown must be visible
    const envDropdown = page.locator('[data-testid="header-env-select"]');
    await expect(envDropdown).toBeVisible({ timeout: 10_000 });
    await expectHeaderValue(envDropdown, 'gal-env');

    // Click t01 in sidebar
    await page.locator('.sidebar-item-name', { hasText: 't01' }).click();

    // Verify selection changed
    await expectHeaderValue(envDropdown, 't01-env');

    // Check localStorage was updated
    const stored = await page.evaluate(() => ({
      envId: localStorage.getItem('perf-test-v3-selected-env'),
      svcId: localStorage.getItem('perf-test-v3-selected-svc'),
    }));
    expect(stored.envId).toBe('t01-env');
    expect(stored.svcId).toBe('t01-svc');

    // Feature groups should show t01's FGs
    await expect(page.locator('.feature-group-card', { hasText: 'My Tests' })).toBeVisible();

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // After reload: wait for dropdown to be ready, then verify t01 is selected
    await expect(envDropdown).toBeVisible({ timeout: 10_000 });
    await expectHeaderValue(envDropdown, 't01-env');

    // Sidebar should show t01 as selected and expanded
    await expect(page.locator('.sidebar-item.selected .sidebar-item-name')).toHaveText('t01');

    // Feature groups should show t01's FGs, NOT gallery
    await expect(page.locator('.feature-group-card', { hasText: 'My Tests' })).toBeVisible();
    await expect(page.locator('.feature-group-card', { hasText: 'Gallery' })).not.toBeVisible();
  });

  test('selecting t01 via header dropdowns persists after refresh', async ({ page }) => {
    test.slow(); // Involves page reload
    await seedMultiEnv(page);
    await page.goto('http://localhost:5173/?tab=scenarios');
    await page.waitForLoadState('networkidle');

    // Wait for dropdowns to be ready
    const envDropdown = page.locator('[data-testid="header-env-select"]');
    const svcDropdown = page.locator('[data-testid="header-svc-select"]');
    await expect(envDropdown).toBeVisible({ timeout: 10_000 });

    // Select t01 via header dropdown
    await selectHeaderOption(page, 'header-env-select', 't01');
    await selectHeaderOption(page, 'header-svc-select', 'sales-product-autoassign');

    // Wait for the selection to propagate (feature card should appear)
    await expect(page.locator('.feature-group-card', { hasText: 'My Tests' })).toBeVisible({ timeout: 5_000 });

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for dropdown to be ready, then verify persistence
    await expect(envDropdown).toBeVisible({ timeout: 10_000 });
    await expectHeaderValue(envDropdown, 't01-env');
    await expectHeaderValue(svcDropdown, 't01-svc');
    await expect(page.locator('.feature-group-card', { hasText: 'My Tests' })).toBeVisible({ timeout: 5_000 });
  });

  test('activeTab=scenarios persists via URL across refresh', async ({ page }) => {
    test.slow(); // Involves page reload
    await seedMultiEnv(page);
    await page.goto('http://localhost:5173/?tab=scenarios');
    await page.waitForLoadState('networkidle');

    // Should be on scenarios tab
    await expect(page.locator('.feature-group-card').first()).toBeVisible({ timeout: 10_000 });

    // Reload
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Should still be on scenarios tab
    expect(page.url()).toContain('tab=scenarios');
    await expect(page.locator('.feature-group-card').first()).toBeVisible({ timeout: 10_000 });
  });

  test('localStorage selectedEnvId is NOT overwritten on load', async ({ page }) => {
    test.slow(); // Involves localStorage seeding and full app load
    // Seed with t01 pre-selected (not gallery) to verify the app respects it.
    await page.addInitScript(() => {
      if (localStorage.getItem('__e2e_seed_done__')) return;
      localStorage.setItem('__e2e_seed_done__', '1');

      localStorage.setItem('perf-test-v3-environments', JSON.stringify([
        { id: 'gal-env', name: 'Gallery Samples' },
        { id: 't01-env', name: 't01' },
        { id: 't02-env', name: 't02' },
      ]));
      localStorage.setItem('perf-test-v3-microservices', JSON.stringify([
        { id: 'gal-svc', name: 'Gallery Samples', baseUrls: { 'gal-env': '' } },
        { id: 't01-svc', name: 'sales-product-autoassign', baseUrls: { 't01-env': 'https://example.com' } },
        { id: 't02-svc', name: 'another-service', baseUrls: { 't02-env': 'https://example2.com' } },
      ]));
      localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([
        { id: 'fg-gal', name: 'Gallery: Sample', source: 'gallery', microserviceId: 'gal-svc', environmentId: 'gal-env', scenarios: [] },
        { id: 'fg-t01', name: 'My Tests', microserviceId: 't01-svc', environmentId: 't01-env', scenarios: [{ id: 'sc-1', name: 'Scenario A', tests: [] }] },
        { id: 'fg-t02', name: 'Other Tests', microserviceId: 't02-svc', environmentId: 't02-env', scenarios: [] },
      ]));
      // Pre-select t01 (not gal-env) to verify the app won't overwrite it
      localStorage.setItem('perf-test-v3-selected-env', 't01-env');
      localStorage.setItem('perf-test-v3-selected-svc', 't01-svc');
      localStorage.setItem('perf-test-v3-migrated', 'true');
    });

    await page.goto('http://localhost:5173/?tab=scenarios');
    await page.waitForLoadState('networkidle');

    // Wait for app to fully load
    const envDropdown = page.locator('[data-testid="header-env-select"]');
    await expect(envDropdown).toBeVisible({ timeout: 10_000 });

    // Check that localStorage still has t01, not overwritten to gallery or empty
    const stored = await page.evaluate(() => ({
      envId: localStorage.getItem('perf-test-v3-selected-env'),
      svcId: localStorage.getItem('perf-test-v3-selected-svc'),
    }));
    expect(stored.envId).toBe('t01-env');
    expect(stored.svcId).toBe('t01-svc');

    // Header should show t01
    await expectHeaderValue(envDropdown, 't01-env');

    // Feature groups for t01 should be visible
    await expect(page.locator('.feature-group-card', { hasText: 'My Tests' })).toBeVisible();
  });
});
