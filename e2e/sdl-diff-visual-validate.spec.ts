/**
 * Visual validation — SDL diff must show semantic changes only (not formatting noise).
 * Run: npx playwright test e2e/sdl-diff-visual-validate.spec.ts --reporter=list --workers=1
 */
import { test, expect } from '@playwright/test';
import {
  GQL_STUDIO_URL,
  ensureGql3StudioEndpoint,
  ensureGqlDemoHeaderSelected,
  introspectSchema,
  seedGqlDemoEnvironmentForE2e,
  setupLiveProxy,
} from './graphql-helpers';
import { seedGql12BaselineSnapshotForE2e } from './graphql-lesson-smoke-helpers';

test.describe.configure({ retries: 0 });

test('SDL diff shows 1 removed + 1 added for lesson12 baseline vs live schema', async ({ page, request }) => {
  test.setTimeout(180_000);

  const healthy = await request.get('http://localhost:4010/health').then((r) => r.ok()).catch(() => false);
  test.skip(!healthy, 'GraphQL test server not running on port 4010');

  await seedGqlDemoEnvironmentForE2e(page);
  await setupLiveProxy(page, request);
  await page.goto(GQL_STUDIO_URL);
  await page.waitForSelector('[data-testid="gql-studio-page"]', { timeout: 60_000 });
  await seedGql12BaselineSnapshotForE2e(page);
  await ensureGqlDemoHeaderSelected(page);
  await ensureGql3StudioEndpoint(page);
  await introspectSchema(page);

  await page.locator('[data-testid="gql-right-tab-schema"]').click({ force: true });
  await page.locator('[data-testid="gql-se-tab-changelog"]').click({ force: true });
  await expect(page.locator('[data-testid="gql-changelog-panel"]')).toBeVisible({ timeout: 30_000 });

  await page
    .locator('[data-testid="gql-changelog-row"]')
    .filter({ hasText: 'Prior release (demo)' })
    .first()
    .click({ force: true });
  // gql-changelog-compare-select is a CustomSelect (div-based), not a native <select>
  await page.locator('[data-testid="gql-changelog-compare-select"] .cs-trigger').click();
  await page.locator('.cs-menu').waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('.cs-menu .cs-item').filter({ hasText: 'Current schema' }).first().click();
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-testid="gql-changelog-diff-btn"]')?.click();
  });
  await expect(page.locator('[data-testid="gql-diff-modal"]')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'SDL Diff' }).click();
  await expect(page.locator('[data-testid="gql-diff-sdl-view"]')).toBeVisible();

  const stats = page.locator('.gql-diff-sdl-stats');
  await expect(stats).toContainText('1 removed', { timeout: 10_000 });
  await expect(stats).toContainText('1 added');
  await expect(stats).not.toContainText('40 removed');

  const changedRows = page.locator(
    '.gql-diff-sdl-row--removed, .gql-diff-sdl-row--added, .gql-diff-sdl-row--modified',
  );
  await expect(changedRows).toHaveCount(2);

  await page.locator('[data-testid="gql-diff-sdl-hide-unchanged"]').check();
  await expect(changedRows).toHaveCount(2);

  await page.locator('[data-testid="gql-diff-modal"]').screenshot({
    path: 'e2e/screenshots/sdl-diff-visual-validate.png',
  });
});
