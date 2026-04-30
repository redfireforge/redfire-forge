import { test, expect } from '@playwright/test';
import { seedAppDataWithTest } from './helpers';

test.describe('CsvImportModal checkbox alignment', () => {
  test('Feature Group and Scenario checkboxes are vertically aligned', async ({ page }) => {
    await seedAppDataWithTest(page);
    await page.goto('/?tab=scenarios');
    await page.waitForSelector('.app-header');

    // Click Import Template button
    await page.click('button:has-text("Import Template")');
    await page.waitForSelector('.csv-import-modal');

    // Upload a JSON file to trigger Steps 3+4
    const fileInput = page.locator('.csv-import-modal input[type="file"]');
    const jsonContent = JSON.stringify([
      { name: 'Test 1', method: 'GET', url: 'https://example.com/api/1' },
      { name: 'Test 2', method: 'POST', url: 'https://example.com/api/2' },
    ]);
    await fileInput.setInputFiles({
      name: 'test.json',
      mimeType: 'application/json',
      buffer: Buffer.from(jsonContent),
    });

    // Wait for Step 4 to appear
    await page.waitForSelector('.csv-dest-fields');

    // Get both checkbox labels
    const checkboxLabels = page.locator('.csv-dest-fields .csv-checkbox-label');
    const count = await checkboxLabels.count();
    expect(count).toBe(2);

    // Get bounding boxes
    const box1 = await checkboxLabels.nth(0).boundingBox();
    const box2 = await checkboxLabels.nth(1).boundingBox();
    console.log('Checkbox 1 (Feature Group):', JSON.stringify(box1));
    console.log('Checkbox 2 (Scenario):', JSON.stringify(box2));

    // Take a screenshot of Step 4
    await page.locator('.csv-dest-fields').screenshot({ path: 'test-results/step4-alignment.png' });

    expect(box1).not.toBeNull();
    expect(box2).not.toBeNull();

    // The X positions should be the same (within 1px tolerance)
    expect(Math.abs(box1!.x - box2!.x)).toBeLessThanOrEqual(1);

    // Also check the actual checkbox inputs inside the labels
    const checkboxInputs = page.locator('.csv-dest-fields .csv-checkbox-label input[type="checkbox"]');
    const inputBox1 = await checkboxInputs.nth(0).boundingBox();
    const inputBox2 = await checkboxInputs.nth(1).boundingBox();
    console.log('Input 1:', JSON.stringify(inputBox1));
    console.log('Input 2:', JSON.stringify(inputBox2));

    expect(Math.abs(inputBox1!.x - inputBox2!.x)).toBeLessThanOrEqual(1);

    // Verify both rows have same structure: select takes flex:1, checkbox is fixed
    const rows = page.locator('.csv-dest-row');
    const rowCount = await rows.count();
    console.log(`Found ${rowCount} dest rows`);

    // Dump layout info
    const layoutInfo = await page.evaluate(() => {
      const rows = document.querySelectorAll('.csv-dest-row');
      return Array.from(rows).map((row, i) => {
        const cs = window.getComputedStyle(row);
        const children = Array.from(row.children).map(child => {
          const rect = child.getBoundingClientRect();
          return {
            tag: child.tagName,
            class: child.className,
            x: rect.x,
            width: rect.width,
          };
        });
        return { row: i, display: cs.display, gap: cs.gap, children };
      });
    });
    console.log('Layout:', JSON.stringify(layoutInfo, null, 2));
  });
});
