import { type Page } from '@playwright/test';

/**
 * Seeds localStorage with flat v3 data so the app starts with an
 * environment and microservice already selected — prerequisite for most tests.
 */
export async function seedAppData(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('perf-test-v3-environments', JSON.stringify([{ id: 'env-1', name: 't01' }]));
    localStorage.setItem('perf-test-v3-microservices', JSON.stringify([{
      id: 'svc-1', name: 'test-service',
      baseUrls: { 'env-1': 'http://localhost:5173' },
    }]));
    localStorage.setItem('perf-test-v3-feature-groups', '[]');
    localStorage.setItem('perf-test-v3-selected-env', 'env-1');
    localStorage.setItem('perf-test-v3-selected-svc', 'svc-1');
    localStorage.setItem('perf-test-v3-migrated', 'true');
    localStorage.setItem('perf-test-theme', 'dark');
  });
}

/**
 * Seeds flat v3 data with a Feature Group, Scenario, and one Test already present.
 */
export async function seedAppDataWithTest(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('perf-test-v3-environments', JSON.stringify([{ id: 'env-1', name: 't01' }]));
    localStorage.setItem('perf-test-v3-microservices', JSON.stringify([{
      id: 'svc-1', name: 'test-service',
      baseUrls: { 'env-1': 'http://localhost:5173' },
    }]));
    localStorage.setItem('perf-test-v3-feature-groups', JSON.stringify([{
      id: 'fg-1',
      name: 'E2E Feature',
      microserviceId: 'svc-1',
      environmentId: 'env-1',
      scenarios: [{
        id: 'sc-1',
        name: 'E2E Scenario',
        tests: [{
          id: 'test-1',
          name: 'GET Homepage',
          url: 'http://localhost:5173/',
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
        }],
      }],
    }]));
    localStorage.setItem('perf-test-v3-selected-env', 'env-1');
    localStorage.setItem('perf-test-v3-selected-svc', 'svc-1');
    localStorage.setItem('perf-test-v3-migrated', 'true');
    localStorage.setItem('perf-test-theme', 'dark');
  });
}

/** Confirm save destination in FolderPickerModal (opened by "Use as Template" gallery flow). */
export async function confirmFolderPickerModal(page: Page, opts?: { timeout?: number }) {
  const timeout = opts?.timeout ?? 5000;
  await page.locator('.fp-dialog').waitFor({ state: 'visible', timeout });
  await page.locator('.fp-dialog .btn-primary').click();
  await page.waitForTimeout(500);
}
