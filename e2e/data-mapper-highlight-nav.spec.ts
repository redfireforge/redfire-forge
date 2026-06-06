import { test, expect, type Locator, type Page } from '@playwright/test';
import { seedAppData } from './helpers';

const sampleResponse = {
  id: 1,
  name: 'Leanne Graham',
  username: 'Bret',
  email: 'Sincere@april.biz',
  phone: '1-770-736-8031',
};

async function openValidationTab(page: Page): Promise<void> {
  await seedAppData(page);
  await page.goto('/?tab=scenarios');
  await page.waitForSelector('.app-header', { timeout: 25000 });
  await page.waitForLoadState('networkidle');

  await page.click('button:has-text("+ Add Feature Group")');
  await page.locator('input[placeholder="Feature group name (e.g. Onboarding)"]').fill('HL-FG');
  await page.locator('.inline-name-form button:has-text("Create")').click();

  await page.click('button:has-text("+ Scenario")');
  await page.locator('input[placeholder="Scenario name (e.g. Happy Path)"]').fill('HL-Scenario');
  await page.locator('.feature-group-card button:has-text("Create")').click();

  await page.click('button:has-text("+ Test")');
  await expect(page.locator('.modal-overlay')).toBeVisible();

  await page.locator('.url-input').fill('https://jsonplaceholder.typicode.com/users/1');
  await page.locator('.builder-tab:has-text("Validation")').click();
}

async function openMapperWithAutoMap(page: Page): Promise<Locator> {
  await page.locator('label:has-text("Selective Fields") input[type="radio"]').check();
  await page.locator('button:has-text("Fetch Response")').click();
  await expect(page.locator('.validation-response-preview')).toBeVisible();
  await page.locator('button:has-text("⚡ Data Mapper")').click();
  const mapper = page.locator('.dm-modal-overlay');
  await expect(mapper).toBeVisible();

  await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Auto-map' }).click();
  await mapper.locator('.dm-toolbar-cluster--core button', { hasText: 'Accept all' }).click();

  return mapper;
}

function sourceNode(mapper: Locator, path: string): Locator {
  return mapper.locator(`.dm-panel--source .dm-tree-node[data-path="${path}"]`).first();
}

function targetNode(mapper: Locator, path: string): Locator {
  return mapper.locator(`.dm-panel--target .dm-tree-node[data-path="${path}"]`).first();
}

test.describe('Data Mapper highlight & keyboard navigation', () => {
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

  test('hover on source leaf highlights both source and target nodes', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const src = sourceNode(mapper, 'name');
    const tgt = targetNode(mapper, 'name');
    await expect(src).toBeVisible();
    await expect(tgt).toBeVisible();

    await src.hover();

    await expect(src).toHaveClass(/dm-tree-node--hover-highlight/, { timeout: 3000 });
    await expect(tgt).toHaveClass(/dm-tree-node--hover-highlight/, { timeout: 3000 });
  });

  test('hover on target leaf highlights both source and target nodes', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const src = sourceNode(mapper, 'email');
    const tgt = targetNode(mapper, 'email');

    await tgt.hover();

    await expect(src).toHaveClass(/dm-tree-node--hover-highlight/, { timeout: 3000 });
    await expect(tgt).toHaveClass(/dm-tree-node--hover-highlight/, { timeout: 3000 });
  });

  test('hover highlights only one pair at a time — moving to another clears previous', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const srcName = sourceNode(mapper, 'name');
    const tgtName = targetNode(mapper, 'name');
    const srcEmail = sourceNode(mapper, 'email');
    const tgtEmail = targetNode(mapper, 'email');

    await srcName.hover();
    await expect(srcName).toHaveClass(/dm-tree-node--hover-highlight/, { timeout: 3000 });
    await expect(tgtName).toHaveClass(/dm-tree-node--hover-highlight/, { timeout: 3000 });

    await srcEmail.hover();
    await expect(srcEmail).toHaveClass(/dm-tree-node--hover-highlight/, { timeout: 3000 });
    await expect(tgtEmail).toHaveClass(/dm-tree-node--hover-highlight/, { timeout: 3000 });

    await expect(srcName).not.toHaveClass(/dm-tree-node--hover-highlight/);
    await expect(tgtName).not.toHaveClass(/dm-tree-node--hover-highlight/);
  });

  test('click on source leaf sets keyboard focus and highlights both sides', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const src = sourceNode(mapper, 'username');
    await src.click();

    await expect(src).toHaveClass(/dm-tree-node--focused/, { timeout: 3000 });

    const tgt = targetNode(mapper, 'username');
    await expect(tgt).toHaveClass(/dm-tree-node--hover-highlight/, { timeout: 3000 });
  });

  test('click on target leaf sets keyboard focus and highlights both sides', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const tgt = targetNode(mapper, 'phone');
    // Click on the type pill rather than the row centre — mapped target rows put
    // an operator pill / NOT button at the centre, and clicking the field name
    // (.dm-node-key) opens the rename input. Both stop propagation, so neither
    // triggers the keyboard-focus click handler delegated on .dm-body.
    await tgt.locator('.dm-type-pill').first().click();

    await expect(tgt).toHaveClass(/dm-tree-node--focused/, { timeout: 3000 });

    const src = sourceNode(mapper, 'phone');
    await expect(src).toHaveClass(/dm-tree-node--hover-highlight/);
  });

  test('arrow down from first source node moves focus and updates highlights', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const firstSrc = sourceNode(mapper, 'id');
    await firstSrc.click();
    await expect(firstSrc).toHaveClass(/dm-tree-node--focused/, { timeout: 3000 });

    await page.mouse.move(0, 0);

    await page.keyboard.press('ArrowDown');

    const secondSrc = sourceNode(mapper, 'name');
    await expect(secondSrc).toHaveClass(/dm-tree-node--focused/);
    await expect(firstSrc).not.toHaveClass(/dm-tree-node--focused/);

    const tgtName = targetNode(mapper, 'name');
    await expect(tgtName).toHaveClass(/dm-tree-node--hover-highlight/);
  });

  test('arrow up navigates back and updates highlights', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const src = sourceNode(mapper, 'username');
    await src.click();
    await expect(src).toHaveClass(/dm-tree-node--focused/, { timeout: 3000 });

    await page.mouse.move(0, 0);

    await page.keyboard.press('ArrowUp');

    const prevSrc = sourceNode(mapper, 'name');
    await expect(prevSrc).toHaveClass(/dm-tree-node--focused/);

    const tgtName = targetNode(mapper, 'name');
    await expect(tgtName).toHaveClass(/dm-tree-node--hover-highlight/);

    await expect(sourceNode(mapper, 'username')).not.toHaveClass(/dm-tree-node--focused/);
  });

  test('arrow keys wrap at boundaries — top stays at first, bottom stays at last', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const allSrcNodes = mapper.locator('.dm-panel--source .dm-tree-node[data-path]');

    const firstSrc = allSrcNodes.first();
    await firstSrc.click();
    await expect(firstSrc).toHaveClass(/dm-tree-node--focused/, { timeout: 3000 });

    await page.keyboard.press('ArrowUp');
    const firstPath = await firstSrc.getAttribute('data-path');
    const focusedAfterUp = mapper.locator('.dm-panel--source .dm-tree-node--focused');
    await expect(focusedAfterUp).toBeVisible({ timeout: 3000 });
    const focusedPath = await focusedAfterUp.getAttribute('data-path');
    expect(focusedPath).toBe(firstPath);

    const lastSrc = allSrcNodes.last();
    await lastSrc.click();
    await expect(lastSrc).toHaveClass(/dm-tree-node--focused/, { timeout: 3000 });

    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowDown');
    }
    const lastPath = await lastSrc.getAttribute('data-path');
    const focusedAfterDown = mapper.locator('.dm-panel--source .dm-tree-node--focused');
    const focusedPathDown = await focusedAfterDown.getAttribute('data-path');
    expect(focusedPathDown).toBe(lastPath);
  });

  test('Lines toggle hides and shows connection lines', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const canvas = mapper.locator('.dm-canvas');
    await expect(canvas).toBeVisible();

    const linesBeforeCount = await canvas.locator('.dm-connection-line').count();
    expect(linesBeforeCount).toBeGreaterThan(0);

    const linesBtn = mapper.locator('.dm-toolbar-cluster--view button', { hasText: 'Lines' });
    await linesBtn.click();

    await expect(canvas.locator('.dm-connection-line')).toHaveCount(0, { timeout: 3000 });

    await linesBtn.click();

    const linesRestoredCount = await canvas.locator('.dm-connection-line').count();
    expect(linesRestoredCount).toBeGreaterThan(0);
  });

  test('Verify All shows correct pass count matching mapped count', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const verifyBtn = mapper.locator('button', { hasText: 'Verify All' });
    await verifyBtn.click();

    const summary = mapper.locator('.dm-toolbar-verify-summary');
    await expect(summary).toBeVisible({ timeout: 5000 });

    const summaryText = await summary.textContent();
    const mappedCount = await mapper.locator('.dm-panel--source .dm-tree-node--leaf.dm-tree-node--mapped').count();
    expect(summaryText).toContain(`${mappedCount} passed`);
  });

  test('clicking a source node selects mapping and highlights canvas line', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const src = sourceNode(mapper, 'name');
    await src.click();
    await expect(src).toHaveClass(/dm-tree-node--focused/, { timeout: 3000 });

    const canvas = mapper.locator('.dm-canvas');
    const highlightedLines = canvas.locator('.dm-connection-line--selected');
    await expect(highlightedLines).not.toHaveCount(0, { timeout: 3000 });
  });

  test('no phantom passed count with zero mapper-created rules', async ({ page }) => {
    await openValidationTab(page);

    await page.locator('label:has-text("Selective Fields") input[type="radio"]').check();
    await page.locator('button:has-text("Fetch Response")').click();
    await expect(page.locator('.validation-response-preview')).toBeVisible();
    await page.locator('button:has-text("⚡ Data Mapper")').click();
    const mapper = page.locator('.dm-modal-overlay');
    await expect(mapper).toBeVisible();

    const verifyBtn = mapper.locator('button', { hasText: 'Verify All' });
    await verifyBtn.click();
    await page.waitForTimeout(300);

    const summary = mapper.locator('.dm-toolbar-verify-summary');
    const summaryCount = await summary.count();
    if (summaryCount > 0) {
      const text = await summary.textContent();
      expect(text).not.toContain('passed');
    }
  });

  test('Tab switches focus between source and target panels', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const src = sourceNode(mapper, 'name');
    await src.click();

    const sourcePanel = mapper.locator('.dm-panel--source');
    await expect(sourcePanel).toHaveClass(/dm-panel--focused/, { timeout: 3000 });

    await page.keyboard.press('Tab');

    const targetPanel = mapper.locator('.dm-panel--target');
    await expect(targetPanel).toHaveClass(/dm-panel--focused/, { timeout: 3000 });
  });

  test('Home and End keys jump to first and last visible nodes', async ({ page }) => {
    await openValidationTab(page);
    const mapper = await openMapperWithAutoMap(page);

    const middleSrc = sourceNode(mapper, 'username');
    await middleSrc.click();
    await expect(middleSrc).toHaveClass(/dm-tree-node--focused/, { timeout: 3000 });

    await page.keyboard.press('Home');

    const allSrcNodes = mapper.locator('.dm-panel--source .dm-tree-node[data-path]');
    const firstPath = await allSrcNodes.first().getAttribute('data-path');
    const focusedNode = mapper.locator('.dm-panel--source .dm-tree-node--focused');
    await expect(focusedNode).toBeVisible({ timeout: 3000 });
    const focusedPath = await focusedNode.getAttribute('data-path');
    expect(focusedPath).toBe(firstPath);

    await page.keyboard.press('End');

    const lastPath = await allSrcNodes.last().getAttribute('data-path');
    const focusedAfterEnd = mapper.locator('.dm-panel--source .dm-tree-node--focused');
    await expect(focusedAfterEnd).toBeVisible({ timeout: 3000 });
    const focusedPathEnd = await focusedAfterEnd.getAttribute('data-path');
    expect(focusedPathEnd).toBe(lastPath);
  });
});
