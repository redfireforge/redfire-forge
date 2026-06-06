import { test, expect, type Page } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  offers: [
    { associatedOfferingCode: 'ONZFCNCP01MCALM', rank: 1, offerName: 'OnStar One - Trial' },
  ],
};

async function openValidationMapper(page: Page) {
  await seedAppData(page);
  await page.route('**/__proxy', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 200, statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sampleResponse),
      }),
    });
  });

  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 25000 });
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('ExprTest-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();
  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('ExprTest-Scenario');
  await page.locator('.feature-group-card button:has-text("Create")').click();
  await page.click('button:has-text("+ Test")');
  await expect(page.locator('.modal-overlay')).toBeVisible();
  await page.locator('.url-input').fill('https://api.example.com/offers');

  // Go to Validation tab, set selective fields, fetch, open mapper
  await page.locator('.builder-tab:has-text("Validation")').click();
  await page.locator('label:has-text("Selective Fields") input[type="radio"]').check();
  await page.locator('button:has-text("Fetch Response")').click();
  await expect(page.locator('.validation-response-preview')).toBeVisible();
  await page.locator('button:has-text("⚡ Data Mapper")').click();
  const mapper = page.locator('.dm-modal-overlay');
  await expect(mapper).toBeVisible();
  return mapper;
}

test.describe('Expression Editor overflow', () => {
  test('expression editor does not extend beyond viewport bottom at small viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 580 });
    const mapper = await openValidationMapper(page);

    await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
    await page.waitForTimeout(300);

    const mappedNode = mapper.locator('.dm-panel--target .dm-tree-node--mapped').first();
    await expect(mappedNode).toBeVisible();
    await mappedNode.click({ button: 'right' });
    const contextMenu = page.locator('.dm-context-menu');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });
    await contextMenu.locator('button:has-text("Edit expression")').click();

    const exprOverlay = page.locator('.dm-expr-overlay');
    await expect(exprOverlay).toBeVisible({ timeout: 3000 });

    const exprModal = page.locator('.dm-expr-modal');
    await expect(exprModal).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'test-results/expression-editor-position.png' });

    const modalBox = await exprModal.boundingBox();
    const viewport = page.viewportSize()!;

    console.log('EXPR MODAL:', JSON.stringify({
      modalBox,
      viewport,
      overflowBottom: modalBox ? modalBox.y + modalBox.height - viewport.height : 'N/A',
    }, null, 2));

    expect(modalBox).toBeTruthy();
    expect(modalBox!.y + modalBox!.height).toBeLessThanOrEqual(viewport.height + 5);
    expect(modalBox!.y).toBeGreaterThanOrEqual(0);

    const portaledToTopLayer = await exprOverlay.evaluate((el) => {
      const p = el.parentElement;
      if (!p) return false;
      if (p.tagName === 'BODY') return true;
      return p.classList.contains('dm-modal-shell');
    });
    expect(portaledToTopLayer).toBe(true);
  });
});
