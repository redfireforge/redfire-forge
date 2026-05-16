import { test, expect, type Page, type Locator } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  offers: [
    { associatedOfferingCode: 'ONZF', rank: 1, offerName: 'OnStar One - Trial' },
    { associatedOfferingCode: 'IHUT', rank: 3, offerName: 'IHU Connectivity' },
  ],
  status: 'active',
};

async function openValidationRules(page: Page): Promise<{ mapper: Locator; rulesPanel: Locator }> {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('EdgeToggle-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();

  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('EdgeToggle-Scenario');
  await page.locator('.feature-group-card button:has-text("Create")').click();

  await page.click('button:has-text("+ Test")');
  await expect(page.locator('.modal-overlay')).toBeVisible();

  await page.locator('.url-input').fill('https://api.example.com/offers');
  await page.locator('.builder-tab:has-text("Validation")').click();

  await page.locator('label:has-text("Selective Fields") input[type="radio"]').check();
  await page.locator('button:has-text("Fetch Response")').click();
  await expect(page.locator('.validation-response-preview')).toBeVisible();
  await page.locator('button:has-text("⚡ Visual Mapper")').click();
  const mapper = page.locator('.dm-modal-overlay');
  await expect(mapper).toBeVisible();

  await mapper.locator('button:has-text("Auto-Map")').click();
  await page.waitForTimeout(500);

  await mapper.locator('button:has-text("Rules")').click();
  const rulesPanel = page.locator('.vr-modal-panel');
  await expect(rulesPanel).toBeVisible({ timeout: 5000 });

  return { mapper, rulesPanel };
}

test.describe('Validation Rules — edge toggle & line decorations', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/__proxy', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(sampleResponse),
        }),
      });
    });
  });

  test('edge toggle button is visible and works', async ({ page }) => {
    const { rulesPanel } = await openValidationRules(page);

    const toggle = rulesPanel.locator('.vr-ref-edge-toggle');
    await expect(toggle).toBeVisible();

    const box = await toggle.boundingBox();
    console.log('Edge toggle box (ref visible):', JSON.stringify(box));
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThanOrEqual(16);
    expect(box!.height).toBeGreaterThan(50);

    await page.screenshot({ path: 'test-results/toggle-ref-visible.png' });

    // Hide reference panel
    await toggle.click();
    await expect(rulesPanel.locator('.vr-reference-pane')).not.toBeVisible();
    await expect(toggle).toBeVisible();

    const boxHidden = await toggle.boundingBox();
    console.log('Edge toggle box (ref hidden):', JSON.stringify(boxHidden));

    await page.screenshot({ path: 'test-results/toggle-ref-hidden.png' });

    // Show reference panel again
    await toggle.click();
    await expect(rulesPanel.locator('.vr-reference-pane')).toBeVisible();
  });

  test('line decorations render after Verify All', async ({ page }) => {
    const { mapper, rulesPanel } = await openValidationRules(page);

    await rulesPanel.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(300);

    const verifyBtn = mapper.locator('button:has-text("Verify All")');
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();
      await page.waitForTimeout(2000);

      await mapper.locator('button:has-text("Rules")').click();
      const reopenedPanel = page.locator('.vr-modal-panel');
      await expect(reopenedPanel).toBeVisible({ timeout: 5000 });

      await expect.poll(async () => {
        const decorations = await page.evaluate(() => {
          const glyphs = document.querySelectorAll('.dm-verify-glyph--pass, .dm-verify-glyph--fail');
          const lines = document.querySelectorAll('.dm-verify-line--pass, .dm-verify-line--fail');
          return { glyphCount: glyphs.length, lineCount: lines.length };
        });
        console.log('Decorations after verify:', JSON.stringify(decorations));
        return decorations.glyphCount > 0 && decorations.lineCount > 0;
      }, { timeout: 15000, intervals: [200, 400, 800] }).toBe(true);

      await page.screenshot({ path: 'test-results/line-decorations-after-verify.png' });
    }
  });
});
