import { test, expect, type Page, type Locator } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  status: 'active',
  offers: [
    { name: 'A', rank: 1 },
    { name: 'B', rank: 2 },
  ],
  tags: ['premium', 'vip'],
};

async function openValidationTab(page: Page): Promise<void> {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('ArrayDbg-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();

  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('ArrayDbg-SC');
  await page.locator('.feature-group-card button:has-text("Create")').click();

  await page.click('button:has-text("+ Test")');
  await expect(page.locator('.modal-overlay')).toBeVisible();

  await page.locator('.url-input').fill('https://api.example.com/test');
  await page.locator('.builder-tab:has-text("Validation")').click();
}

async function openMapper(page: Page): Promise<Locator> {
  await page.locator('label:has-text("Selective Fields") input[type="radio"]').check();
  await page.locator('button:has-text("Fetch Response")').click();
  await expect(page.locator('.validation-response-preview')).toBeVisible();
  await page.locator('button:has-text("⚡ Data Mapper")').click();
  const mapper = page.locator('.dm-modal-overlay');
  await expect(mapper).toBeVisible();
  return mapper;
}

test.describe('Array Assertion Debug', () => {
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

  test('right-click offers array → add length assertion → edit value', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapper(page);

    await page.screenshot({ path: 'test-results/array-dbg-01-mapper-open.png', fullPage: true });

    const targetPanel = mapper.locator('.dm-panel--target');

    // Expand root if collapsed
    const rootToggle = targetPanel.locator('.dm-tree-node[data-path=""] button[aria-label="Collapse"], .dm-tree-node[data-path=""] button[aria-label="Expand"]').first();
    if (await rootToggle.isVisible().catch(() => false)) {
      const label = await rootToggle.getAttribute('aria-label');
      if (label === 'Expand') await rootToggle.click();
    }

    // Find offers node
    const offersNode = targetPanel.locator('.dm-tree-node[data-path="offers"]').first();
    await expect(offersNode).toBeVisible({ timeout: 5000 });

    // Expand offers if collapsed
    const offersToggle = offersNode.locator('button[aria-label="Expand"]');
    if (await offersToggle.isVisible().catch(() => false)) {
      await offersToggle.click();
      await page.waitForTimeout(300);
    }

    await page.screenshot({ path: 'test-results/array-dbg-02-offers-expanded.png', fullPage: true });

    // Right-click on offers
    await offersNode.click({ button: 'right' });
    await page.waitForTimeout(500);

    const contextMenu = page.locator('.dm-context-menu');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    await page.screenshot({ path: 'test-results/array-dbg-03-offers-context-menu.png', fullPage: true });

    // Click "Check array size"
    await contextMenu.locator('.dm-context-menu-item', { hasText: 'Check array size' }).click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/array-dbg-04-after-add-assertion.png', fullPage: true });

    // Check assertion row appeared
    const assertionRow = targetPanel.locator('.dm-array-assertion-row');
    const rowCount = await assertionRow.count();
    console.log(`Assertion rows found: ${rowCount}`);

    if (rowCount > 0) {
      const rowText = await assertionRow.first().innerText();
      console.log(`Assertion row text: "${rowText}"`);

      // Check value element
      const valueEl = assertionRow.first().locator('.dm-array-assertion-value');
      const valueVisible = await valueEl.isVisible().catch(() => false);
      console.log(`Value element visible: ${valueVisible}`);

      if (valueVisible) {
        const valueText = await valueEl.innerText();
        console.log(`Value text: "${valueText}"`);
        const box = await valueEl.boundingBox();
        console.log(`Value bounding box: ${JSON.stringify(box)}`);

        // Get computed styles
        const styles = await valueEl.evaluate((el) => {
          const cs = window.getComputedStyle(el);
          return {
            width: cs.width, height: cs.height,
            color: cs.color, background: cs.backgroundColor,
            border: cs.border, cursor: cs.cursor,
            display: cs.display, visibility: cs.visibility,
            opacity: cs.opacity, flex: cs.flex,
            fontSize: cs.fontSize, fontWeight: cs.fontWeight,
          };
        });
        console.log(`Value computed styles: ${JSON.stringify(styles, null, 2)}`);

        // Click to edit
        await valueEl.click();
        await page.waitForTimeout(300);

        const inputEl = assertionRow.first().locator('.dm-array-assertion-value-input');
        const inputVisible = await inputEl.isVisible().catch(() => false);
        console.log(`Input visible after click: ${inputVisible}`);

        if (inputVisible) {
          await inputEl.fill('5');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(300);
          const newVal = await assertionRow.first().locator('.dm-array-assertion-value').innerText().catch(() => 'N/A');
          console.log(`Value after edit: "${newVal}"`);
          expect(newVal).toBe('5');
        } else {
          console.log('INPUT DID NOT APPEAR - this is the bug');
        }

        await page.screenshot({ path: 'test-results/array-dbg-05-after-edit.png', fullPage: true });
      }

      // Check operator select
      const opSelect = assertionRow.first().locator('.dm-array-assertion-op-select');
      const opVisible = await opSelect.isVisible().catch(() => false);
      console.log(`Operator select visible: ${opVisible}`);

      // Check remove button on hover
      await assertionRow.first().hover();
      const removeBtn = assertionRow.first().locator('.dm-array-assertion-remove');
      const removeVisible = await removeBtn.isVisible().catch(() => false);
      console.log(`Remove button visible on hover: ${removeVisible}`);
    } else {
      console.log('NO ASSERTION ROW FOUND - this is the bug');
      
      // Debug: dump all assertion-related elements
      const hintEl = targetPanel.locator('.dm-array-assertion-hint');
      const hintCount = await hintEl.count();
      console.log(`Assertion hints found: ${hintCount}`);
      
      const assertionRows = targetPanel.locator('.dm-array-assertion-rows');
      const rowsCount = await assertionRows.count();
      console.log(`Assertion row containers found: ${rowsCount}`);
      
      if (rowsCount > 0) {
        const html = await assertionRows.first().innerHTML();
        console.log(`Assertion rows container HTML: ${html.substring(0, 500)}`);
      }
    }

    // Final summary screenshot
    await page.screenshot({ path: 'test-results/array-dbg-06-final.png', fullPage: true });
  });
});
