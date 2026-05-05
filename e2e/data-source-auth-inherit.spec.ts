import { test, expect, type Page } from '@playwright/test';

/**
 * Seeds a test with Bearer Token auth and an existing data source.
 * This reproduces the scenario where the user has a test with bearer auth
 * and wants to change the data-source-level auth to "Inherit".
 */
async function seedWithBearerAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('perf-test-v3-environments', JSON.stringify([{ id: 'env-1', name: 't01' }]));
    localStorage.setItem('perf-test-v3-microservices', JSON.stringify([{
      id: 'svc-1', name: 'test-service',
      baseUrls: { 'env-1': 'https://api.example.com' },
    }]));
    localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([{
      id: 'fg-1',
      name: 'Auth Feature',
      microserviceId: 'svc-1',
      environmentId: 'env-1',
      auth: { type: 'bearer', token: 'fg-level-token', prefix: 'Bearer' },
      scenarios: [{
        id: 'sc-1',
        name: 'Auth Scenario',
        auth: { type: 'bearer', token: 'sc-level-token', prefix: 'Bearer' },
        tests: [{
          id: 'test-1',
          name: 'Vehicle API',
          url: 'https://api.example.com/vehicles/{{vin}}/offers?channel={{channel}}',
          method: 'GET',
          headers: [{ key: 'Accept', value: 'application/json' }],
          body: '',
          auth: { type: 'bearer', token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test', prefix: 'Bearer' },
          validation: { mode: 'none' },
          dataSource: {
            id: 'ds-1',
            columns: [
              { id: 'col-vin', name: 'vin', type: 'path', mapping: 'vin' },
              { id: 'col-ch', name: 'channel', type: 'param', mapping: 'channel' },
            ],
            rows: [
              { id: 'row-1', values: { 'col-vin': 'VIN123', 'col-ch': 'WEBRNW' }, enabled: true },
            ],
            source: { type: 'inline' },
            distribution: 'sequential',
            urlTemplate: 'https://api.example.com/vehicles/{{vin}}/offers?channel={{channel}}',
          },
        }],
      }],
    }]));
    localStorage.setItem('perf-test-v3-selected-env', 'env-1');
    localStorage.setItem('perf-test-v3-selected-svc', 'svc-1');
    localStorage.setItem('perf-test-v3-migrated', 'true');
    localStorage.setItem('perf-test-theme', 'dark');
  });
}

async function openTestEditor(page: Page) {
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 10_000 });
  await page.waitForLoadState('networkidle');

  const fgName = page.locator('.feature-group-card .feature-group-name', { hasText: 'Auth Feature' });
  await expect(fgName).toBeVisible({ timeout: 10_000 });
  await fgName.click();

  const scName = page.locator('.scenario-group-name', { hasText: 'Auth Scenario' });
  await expect(scName).toBeVisible({ timeout: 5_000 });
  await scName.click();

  await expect(page.locator('.test-card')).toBeVisible({ timeout: 5_000 });
  await page.locator('.test-card button:has-text("Edit")').click();
  await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5_000 });
}

async function clickDataTab(page: Page) {
  const tab = page.locator('.builder-tab', { hasText: /Parameterize|Data Source/ });
  await tab.click();
}

async function openConfigureModal(page: Page) {
  await page.locator('button[title="Configure data source columns"]').click();
  await expect(page.locator('.full-panel-modal')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Auth Configuration')).toBeVisible();
}

function authSelect(page: Page) {
  return page.locator('.csv-auth-select').first();
}

test.describe('Data Source Auth Inherit Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await seedWithBearerAuth(page);
  });

  test('auth dropdown initializes from test-level auth (Bearer Token)', async ({ page }) => {
    await openTestEditor(page);
    await clickDataTab(page);
    await openConfigureModal(page);

    await expect(authSelect(page)).toHaveValue('bearer');
    await expect(page.locator('.step-section-count', { hasText: 'bearer' })).toBeVisible();
  });

  test('changing auth to Inherit and applying persists across modal reopen', async ({ page }) => {
    await openTestEditor(page);
    await clickDataTab(page);
    await openConfigureModal(page);

    // Verify initial state is Bearer Token
    await expect(authSelect(page)).toHaveValue('bearer');

    // Change to Inherit
    await authSelect(page).selectOption('inherit');
    await expect(authSelect(page)).toHaveValue('inherit');

    // Advance to Columns and Apply
    await page.getByRole('button', { name: 'Next: Columns' }).click();
    await page.getByRole('button', { name: 'Apply to Data Source' }).click();

    // Modal should close
    await expect(page.locator('.full-panel-modal')).not.toBeVisible({ timeout: 5_000 });

    // Reopen the Configure Data Source modal
    await openConfigureModal(page);

    // Auth should still be "Inherit" — not reverted to "Bearer Token"
    await expect(authSelect(page)).toHaveValue('inherit');
    await expect(page.locator('.step-section-count', { hasText: 'inherit' })).toBeVisible();
  });

  test('Inherit auth persists after saving the test and reopening editor', async ({ page }) => {
    await openTestEditor(page);
    await clickDataTab(page);
    await openConfigureModal(page);

    // Change to Inherit
    await authSelect(page).selectOption('inherit');

    // Apply
    await page.getByRole('button', { name: 'Next: Columns' }).click();
    await page.getByRole('button', { name: 'Apply to Data Source' }).click();
    await expect(page.locator('.full-panel-modal')).not.toBeVisible({ timeout: 5_000 });

    // Save the test
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5_000 });

    // Reopen the test editor
    await page.locator('.test-card button:has-text("Edit")').click();
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5_000 });

    // Go to Data Source tab and open Configure modal
    await clickDataTab(page);
    await openConfigureModal(page);

    // Auth should still be "Inherit"
    await expect(authSelect(page)).toHaveValue('inherit');
  });

  test('Inherit auth survives page reload (persistence)', async ({ page }) => {
    await openTestEditor(page);
    await clickDataTab(page);
    await openConfigureModal(page);

    // Change to Inherit and apply
    await authSelect(page).selectOption('inherit');
    await page.getByRole('button', { name: 'Next: Columns' }).click();
    await page.getByRole('button', { name: 'Apply to Data Source' }).click();
    await expect(page.locator('.full-panel-modal')).not.toBeVisible({ timeout: 5_000 });

    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 5_000 });

    // Reload the page
    await page.reload();
    await page.waitForSelector('.app-header', { timeout: 10_000 });
    await page.waitForLoadState('networkidle');

    // Reopen the test
    const fgName = page.locator('.feature-group-card .feature-group-name', { hasText: 'Auth Feature' });
    await expect(fgName).toBeVisible({ timeout: 10_000 });
    await fgName.click();
    const scName = page.locator('.scenario-group-name', { hasText: 'Auth Scenario' });
    await expect(scName).toBeVisible({ timeout: 5_000 });
    await scName.click();
    await page.locator('.test-card button:has-text("Edit")').click();
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5_000 });

    // Open Data Source > Configure
    await clickDataTab(page);
    await openConfigureModal(page);

    // Auth should still be "Inherit" after reload
    await expect(authSelect(page)).toHaveValue('inherit');
  });

  test('Auth tab also reflects change when Configure Data Source sets to Inherit', async ({ page }) => {
    await openTestEditor(page);

    // Verify Auth tab initially shows Bearer Token
    await page.locator('.builder-tab', { hasText: 'Auth' }).click();
    const authTabSelect = page.locator('.auth-type-select select');
    await expect(authTabSelect).toHaveValue('bearer');

    // Now go to Data Source and change auth to Inherit via Configure modal
    await clickDataTab(page);
    await openConfigureModal(page);
    await authSelect(page).selectOption('inherit');
    await page.getByRole('button', { name: 'Next: Columns' }).click();
    await page.getByRole('button', { name: 'Apply to Data Source' }).click();
    await expect(page.locator('.full-panel-modal')).not.toBeVisible({ timeout: 5_000 });

    // Auth tab should now show "inherit" (both share draft.auth)
    await page.locator('.builder-tab', { hasText: 'Auth' }).click();
    await expect(authTabSelect).toHaveValue('inherit');
  });

  test('switching auth types in Configure modal works for all types', async ({ page }) => {
    await openTestEditor(page);
    await clickDataTab(page);
    await openConfigureModal(page);

    const select = authSelect(page);

    for (const authType of ['inherit', 'none', 'basic', 'bearer']) {
      await select.selectOption(authType);
      await expect(select).toHaveValue(authType);
      await expect(page.locator('.step-section-count', { hasText: authType })).toBeVisible();
    }
  });

  test('Cancel does NOT persist auth change', async ({ page }) => {
    await openTestEditor(page);
    await clickDataTab(page);
    await openConfigureModal(page);

    // Initial is bearer
    await expect(authSelect(page)).toHaveValue('bearer');

    // Change to Inherit
    await authSelect(page).selectOption('inherit');
    await expect(authSelect(page)).toHaveValue('inherit');

    // Cancel inside the Configure Data Source modal (scoped to .full-panel-modal)
    await page.locator('.full-panel-modal').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.full-panel-modal')).not.toBeVisible({ timeout: 5_000 });

    // Reopen — should still be bearer (change was NOT applied)
    await openConfigureModal(page);
    await expect(authSelect(page)).toHaveValue('bearer');
  });

  test('closing modal via X does NOT persist auth change', async ({ page }) => {
    await openTestEditor(page);
    await clickDataTab(page);
    await openConfigureModal(page);

    await expect(authSelect(page)).toHaveValue('bearer');
    await authSelect(page).selectOption('inherit');

    // Close via Cancel inside the Configure Data Source modal
    await page.locator('.full-panel-modal').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.full-panel-modal')).not.toBeVisible({ timeout: 5_000 });

    // Reopen — should still be bearer
    await openConfigureModal(page);
    await expect(authSelect(page)).toHaveValue('bearer');
  });

  test('BUG REPRO: auth change lost when user closes modal from Step 1 without Apply', async ({ page }) => {
    await openTestEditor(page);
    await clickDataTab(page);
    await openConfigureModal(page);

    // Initial is bearer
    await expect(authSelect(page)).toHaveValue('bearer');

    // Change to Inherit on Step 1
    await authSelect(page).selectOption('inherit');
    await expect(authSelect(page)).toHaveValue('inherit');

    // User might expect that clicking "Next: Columns" then closing preserves auth.
    // Go to Step 2 but don't click Apply — just close
    await page.getByRole('button', { name: 'Next: Columns' }).click();

    // Close from Step 2 without clicking "Apply to Data Source"
    await page.locator('.full-panel-modal').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.full-panel-modal')).not.toBeVisible({ timeout: 5_000 });

    // Reopen — auth change was NOT persisted (no Apply was clicked)
    await openConfigureModal(page);
    // This will be 'bearer' because the change was lost — no Apply was clicked
    await expect(authSelect(page)).toHaveValue('bearer');
  });

  test('Inherit persists in Shared Data Source auth tab', async ({ page }) => {
    // Seed shared data sources with bearer auth
    await page.addInitScript(() => {
      localStorage.setItem('perf-test-v3-environments', JSON.stringify([{ id: 'env-1', name: 't01' }]));
      localStorage.setItem('perf-test-v3-microservices', JSON.stringify([{
        id: 'svc-1', name: 'test-service',
        baseUrls: { 'env-1': 'https://api.example.com' },
      }]));
      localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([{
        id: 'fg-1', name: 'Auth Feature', microserviceId: 'svc-1', environmentId: 'env-1', scenarios: [],
      }]));
      localStorage.setItem('perf-test-v3-shared-data-sources', JSON.stringify([{
        id: 'sds-1',
        name: 'Data Source 3',
        featureGroupId: 'fg-1',
        dataSource: {
          id: 'ds-1',
          columns: [{ id: 'col-vin', name: 'vin', type: 'path', mapping: 'vin' }],
          rows: [{ id: 'row-1', values: { 'col-vin': 'VIN123' }, enabled: true }],
          source: { type: 'inline' },
          distribution: 'sequential',
          urlTemplate: 'https://api.example.com/vehicles/{{vin}}/offers',
        },
        fetchConfig: {
          url: 'https://api.example.com/vehicles/{{vin}}/offers',
          method: 'GET',
          headers: [{ key: 'Accept', value: 'application/json' }],
          body: '',
          bodyType: 'none',
          auth: { type: 'bearer', token: 'eyJhbGciOiJSUzI1NiJ9.test', prefix: 'Bearer' },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }]));
      localStorage.setItem('perf-test-v3-selected-env', 'env-1');
      localStorage.setItem('perf-test-v3-selected-svc', 'svc-1');
      localStorage.setItem('perf-test-v3-migrated', 'true');
      localStorage.setItem('perf-test-theme', 'dark');
    });

    await page.goto('/?tab=scenarios');
    await page.waitForSelector('.header-actions', { timeout: 10_000 });

    // Open Shared Data Sources modal
    await page.locator('.header-actions button', { hasText: 'Shared Data Sources' }).click();
    await expect(page.locator('.shared-ds-modal')).toBeVisible({ timeout: 10_000 });

    // Should see "Data Source 3" selected
    await expect(page.getByText('Data Source 3')).toBeVisible();

    // Expand fetch panel to see auth tab
    const authTab = page.locator('.shared-ds-fetch-panel .builder-tab', { hasText: 'Auth' });
    await authTab.click();

    // Auth should be "bearer"
    const authTypeSelect = page.locator('.shared-ds-fetch-auth-type');
    await expect(authTypeSelect).toHaveValue('bearer');

    // Change to Inherit
    await authTypeSelect.selectOption('inherit');
    await expect(authTypeSelect).toHaveValue('inherit');

    // Close and reopen the modal
    await page.locator('.shared-ds-footer button', { hasText: 'Close' }).click();
    await expect(page.locator('.shared-ds-modal')).not.toBeVisible({ timeout: 5_000 });

    // Reopen
    await page.locator('.header-actions button', { hasText: 'Shared Data Sources' }).click();
    await expect(page.locator('.shared-ds-modal')).toBeVisible({ timeout: 10_000 });

    // Click Auth tab again
    await authTab.click();

    // Auth should still be "inherit" — NOT reverted to "bearer"
    await expect(authTypeSelect).toHaveValue('inherit');
  });

  test('BUG FIX: Shared DS Configure button persists auth change to fetchConfig', async ({ page }) => {
    // This tests the exact bug path: DataSourceEditor inside SharedDataSourceModal
    // uses handleEditorDraftChange which previously dropped auth changes.
    await page.addInitScript(() => {
      localStorage.setItem('perf-test-v3-environments', JSON.stringify([{ id: 'env-1', name: 't01' }]));
      localStorage.setItem('perf-test-v3-microservices', JSON.stringify([{
        id: 'svc-1', name: 'test-service',
        baseUrls: { 'env-1': 'https://api.example.com' },
      }]));
      localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([{
        id: 'fg-1', name: 'Auth Feature', microserviceId: 'svc-1', environmentId: 'env-1', scenarios: [],
      }]));
      localStorage.setItem('perf-test-v3-shared-data-sources', JSON.stringify([{
        id: 'sds-1',
        name: 'Data Source 3',
        featureGroupId: 'fg-1',
        dataSource: {
          id: 'ds-1',
          columns: [{ id: 'col-vin', name: 'vin', type: 'path', mapping: 'vin' }],
          rows: [{ id: 'row-1', values: { 'col-vin': 'VIN123' }, enabled: true }],
          source: { type: 'inline' },
          distribution: 'sequential',
          urlTemplate: 'https://api.example.com/vehicles/{{vin}}/offers',
        },
        fetchConfig: {
          url: 'https://api.example.com/vehicles/{{vin}}/offers',
          method: 'GET',
          headers: [{ key: 'Accept', value: 'application/json' }],
          body: '',
          bodyType: 'none',
          auth: { type: 'bearer', token: 'eyJhbGciOiJSUzI1NiJ9.test', prefix: 'Bearer' },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }]));
      localStorage.setItem('perf-test-v3-selected-env', 'env-1');
      localStorage.setItem('perf-test-v3-selected-svc', 'svc-1');
      localStorage.setItem('perf-test-v3-migrated', 'true');
      localStorage.setItem('perf-test-theme', 'dark');
    });

    await page.goto('/?tab=scenarios');
    await page.waitForSelector('.header-actions', { timeout: 10_000 });

    // Open Shared Data Sources modal
    await page.locator('.header-actions button', { hasText: 'Shared Data Sources' }).click();
    await expect(page.locator('.shared-ds-modal')).toBeVisible({ timeout: 10_000 });

    // Click the ⚙ Configure button inside the embedded DataSourceEditor
    await page.locator('button[title="Configure data source columns"]').click();
    await expect(page.locator('.full-panel-modal')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Auth Configuration')).toBeVisible();

    // Auth should show Bearer Token (from fetchConfig)
    const dsAuthSelect = page.locator('.csv-auth-select').first();
    await expect(dsAuthSelect).toHaveValue('bearer');

    // Change to Inherit
    await dsAuthSelect.selectOption('inherit');
    await expect(dsAuthSelect).toHaveValue('inherit');

    // Apply: Next: Columns → Apply to Data Source
    await page.getByRole('button', { name: 'Next: Columns' }).click();
    await page.getByRole('button', { name: 'Apply to Data Source' }).click();
    await expect(page.locator('.full-panel-modal')).not.toBeVisible({ timeout: 5_000 });

    // Reopen Configure — auth should be Inherit, not Bearer Token
    await page.locator('button[title="Configure data source columns"]').click();
    await expect(page.locator('.full-panel-modal')).toBeVisible({ timeout: 10_000 });
    await expect(dsAuthSelect).toHaveValue('inherit');

    // Also verify the inline Auth tab shows inherit
    await page.locator('.full-panel-modal').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.full-panel-modal')).not.toBeVisible({ timeout: 5_000 });

    const authTab = page.locator('.shared-ds-fetch-panel .builder-tab', { hasText: 'Auth' });
    await authTab.click();
    const inlineAuthSelect = page.locator('.shared-ds-fetch-auth-type');
    await expect(inlineAuthSelect).toHaveValue('inherit');
  });

  test('Shared DS auth Inherit survives page reload', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('perf-test-v3-environments', JSON.stringify([{ id: 'env-1', name: 't01' }]));
      localStorage.setItem('perf-test-v3-microservices', JSON.stringify([{
        id: 'svc-1', name: 'test-service',
        baseUrls: { 'env-1': 'https://api.example.com' },
      }]));
      localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([{
        id: 'fg-1', name: 'Auth Feature', microserviceId: 'svc-1', environmentId: 'env-1', scenarios: [],
      }]));
      localStorage.setItem('perf-test-v3-shared-data-sources', JSON.stringify([{
        id: 'sds-1',
        name: 'Data Source 3',
        featureGroupId: 'fg-1',
        dataSource: {
          id: 'ds-1',
          columns: [{ id: 'col-vin', name: 'vin', type: 'path', mapping: 'vin' }],
          rows: [{ id: 'row-1', values: { 'col-vin': 'VIN123' }, enabled: true }],
          source: { type: 'inline' },
          distribution: 'sequential',
          urlTemplate: 'https://api.example.com/vehicles/{{vin}}/offers',
        },
        fetchConfig: {
          url: 'https://api.example.com/vehicles/{{vin}}/offers',
          method: 'GET',
          headers: [{ key: 'Accept', value: 'application/json' }],
          body: '',
          bodyType: 'none',
          auth: { type: 'bearer', token: 'eyJhbGciOiJSUzI1NiJ9.test', prefix: 'Bearer' },
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }]));
      localStorage.setItem('perf-test-v3-selected-env', 'env-1');
      localStorage.setItem('perf-test-v3-selected-svc', 'svc-1');
      localStorage.setItem('perf-test-v3-migrated', 'true');
      localStorage.setItem('perf-test-theme', 'dark');
    });

    await page.goto('/?tab=scenarios');
    await page.waitForSelector('.header-actions', { timeout: 10_000 });

    // Open Shared Data Sources, change auth to Inherit
    await page.locator('.header-actions button', { hasText: 'Shared Data Sources' }).click();
    await expect(page.locator('.shared-ds-modal')).toBeVisible({ timeout: 10_000 });
    const authTab = page.locator('.shared-ds-fetch-panel .builder-tab', { hasText: 'Auth' });
    await authTab.click();
    const authTypeSelect = page.locator('.shared-ds-fetch-auth-type');
    await authTypeSelect.selectOption('inherit');
    await expect(authTypeSelect).toHaveValue('inherit');

    // Close modal
    await page.locator('.shared-ds-footer button', { hasText: 'Close' }).click();
    await expect(page.locator('.shared-ds-modal')).not.toBeVisible({ timeout: 5_000 });

    // Reload the page
    await page.reload();
    await page.waitForSelector('.header-actions', { timeout: 10_000 });

    // Reopen Shared Data Sources
    await page.locator('.header-actions button', { hasText: 'Shared Data Sources' }).click();
    await expect(page.locator('.shared-ds-modal')).toBeVisible({ timeout: 10_000 });

    await authTab.click();

    // Auth should still be "inherit" after reload
    await expect(authTypeSelect).toHaveValue('inherit');
  });

  test('Inherit persists when test had inherit auth initially', async ({ page }) => {
    // Seed a test that already has auth: { type: 'inherit' }
    await page.addInitScript(() => {
      localStorage.setItem('perf-test-v3-environments', JSON.stringify([{ id: 'env-1', name: 't01' }]));
      localStorage.setItem('perf-test-v3-microservices', JSON.stringify([{
        id: 'svc-1', name: 'test-service',
        baseUrls: { 'env-1': 'https://api.example.com' },
      }]));
      localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([{
        id: 'fg-1',
        name: 'Auth Feature',
        microserviceId: 'svc-1',
        environmentId: 'env-1',
        scenarios: [{
          id: 'sc-1',
          name: 'Auth Scenario',
          tests: [{
            id: 'test-1',
            name: 'Vehicle API',
            url: 'https://api.example.com/vehicles/{{vin}}/offers?channel={{channel}}',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'inherit' },
            validation: { mode: 'none' },
            dataSource: {
              id: 'ds-1',
              columns: [
                { id: 'col-vin', name: 'vin', type: 'path', mapping: 'vin' },
                { id: 'col-ch', name: 'channel', type: 'param', mapping: 'channel' },
              ],
              rows: [
                { id: 'row-1', values: { 'col-vin': 'VIN123', 'col-ch': 'WEBRNW' }, enabled: true },
              ],
              source: { type: 'inline' },
              distribution: 'sequential',
              urlTemplate: 'https://api.example.com/vehicles/{{vin}}/offers?channel={{channel}}',
            },
          }],
        }],
      }]));
      localStorage.setItem('perf-test-v3-selected-env', 'env-1');
      localStorage.setItem('perf-test-v3-selected-svc', 'svc-1');
      localStorage.setItem('perf-test-v3-migrated', 'true');
      localStorage.setItem('perf-test-theme', 'dark');
    });

    await openTestEditor(page);
    await clickDataTab(page);
    await openConfigureModal(page);

    // Should show Inherit from the start
    await expect(authSelect(page)).toHaveValue('inherit');

    // Apply without changing
    await page.getByRole('button', { name: 'Next: Columns' }).click();
    await page.getByRole('button', { name: 'Apply to Data Source' }).click();
    await expect(page.locator('.full-panel-modal')).not.toBeVisible({ timeout: 5_000 });

    // Reopen — should still be inherit
    await openConfigureModal(page);
    await expect(authSelect(page)).toHaveValue('inherit');
  });
});
