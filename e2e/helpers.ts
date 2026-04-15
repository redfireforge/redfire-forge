import { type Page } from '@playwright/test';

/**
 * Seeds localStorage with a minimal project so the app starts with an
 * environment and microservice already selected — prerequisite for most tests.
 */
export async function seedProject(page: Page) {
  await page.addInitScript(() => {
    const project = {
      id: 'e2e-project',
      name: 'E2E Test Project',
      description: 'Seeded by Playwright',
      createdAt: Date.now(),
      environments: [{ id: 'env-1', name: 't01' }],
      microservices: [{
        id: 'svc-1', name: 'test-service',
        baseUrls: { 'env-1': 'http://localhost:5173' },
      }],
      globalAuthProfiles: [],
      featureGroups: [],
      selectedEnvId: 'env-1',
      selectedSvcId: 'svc-1',
    };
    localStorage.setItem('perf-test-projects', JSON.stringify([project]));
    localStorage.setItem('perf-test-selected-project', 'e2e-project');
    localStorage.setItem('perf-test-theme', 'dark');
  });
}

/**
 * Seeds a project that already has a Feature Group, Scenario, and one Test.
 */
export async function seedProjectWithTest(page: Page) {
  await page.addInitScript(() => {
    const project = {
      id: 'e2e-project',
      name: 'E2E Test Project',
      description: 'Seeded by Playwright',
      createdAt: Date.now(),
      environments: [{ id: 'env-1', name: 't01' }],
      microservices: [{
        id: 'svc-1', name: 'test-service',
        baseUrls: { 'env-1': 'http://localhost:5173' },
      }],
      globalAuthProfiles: [],
      featureGroups: [{
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
      }],
      selectedEnvId: 'env-1',
      selectedSvcId: 'svc-1',
    };
    localStorage.setItem('perf-test-projects', JSON.stringify([project]));
    localStorage.setItem('perf-test-selected-project', 'e2e-project');
    localStorage.setItem('perf-test-theme', 'dark');
  });
}
