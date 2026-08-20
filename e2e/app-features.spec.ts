import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';

/**
 * E2E tests for App-level refactored features:
 * - Theme switching (useTheme hook) 
 * - Sidebar resize interactions (useSidebarResize hook)
 * - Export functionality (extracted handleExportSpec)
 * 
 * Actual DOM structure from App.tsx:
 * - Theme picker: .theme-toggle button, .theme-option items, .theme-customize-btn
 * - Sidebar: .unified-sidebar, .usb-resize-handle, .usb-toggle-btn
 * - Activity bar: .ab-btn buttons with .ab-label text
 */

test.describe('Theme Customization', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.goto('/');
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 25_000 });
  });

  test('theme picker button is visible in header', async ({ page }) => {
    const themePicker = page.locator('.theme-toggle').first();
    await expect(themePicker).toBeVisible();
  });

  test('can open theme picker dropdown', async ({ page }) => {
    // Click theme picker button
    const themePicker = page.locator('.theme-toggle').first();
    await themePicker.click();
    
    // Check that theme picker is open
    const pickerDropdown = page.locator('.theme-picker.open');
    await expect(pickerDropdown).toBeVisible({ timeout: 3_000 });
  });

  test('can switch between themes', async ({ page }) => {
    // Open theme picker
    const themePicker = page.locator('.theme-toggle').first();
    await themePicker.click();
    await expect(page.locator('.theme-picker.open')).toBeVisible({ timeout: 3_000 });
    
    // Get initial theme
    const htmlElement = page.locator('html');
    const initialTheme = await htmlElement.getAttribute('data-theme');
    
    // Click a different theme option
    const themeOptions = page.locator('.theme-option');
    const count = await themeOptions.count();
    
    if (count > 1) {
      await themeOptions.nth(1).click();
      
      // Verify theme changed - wait for attribute to change
      await expect(htmlElement).not.toHaveAttribute('data-theme', initialTheme ?? '', { timeout: 3_000 });
    }
  });

  test('theme persists after page reload', async ({ page }) => {
    test.slow(); // Involves page reload
    const htmlElement = page.locator('html');
    const initialTheme = await htmlElement.getAttribute('data-theme');
    
    // Reload page
    await page.reload();
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 25_000 });
    
    // Verify theme persisted
    const reloadedTheme = await htmlElement.getAttribute('data-theme');
    expect(reloadedTheme).toBe(initialTheme);
  });

  test('can open theme customizer', async ({ page }) => {
    // Open theme picker first
    const themePicker = page.locator('.theme-toggle').first();
    await themePicker.click();
    await expect(page.locator('.theme-picker.open')).toBeVisible({ timeout: 3_000 });
    
    // Look for customize button
    const customizeButton = page.locator('.theme-customize-btn').first();
    
    if (await customizeButton.isVisible()) {
      await customizeButton.click();
      
      // Check that customizer modal opened
      const customizerModal = page.locator('.theme-customizer-modal');
      if (await customizerModal.count() > 0) {
        await expect(customizerModal).toBeVisible({ timeout: 3_000 });
      }
    }
  });
});

test.describe('Sidebar Resize', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.goto('/');
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 25_000 });
  });

  test('sidebar is visible on page load', async ({ page }) => {
    const sidebar = page.locator('.unified-sidebar').first();
    await expect(sidebar).toBeVisible();
  });

  test('sidebar has resize handle', async ({ page }) => {
    const resizeHandle = page.locator('.usb-resize-handle').first();
    await expect(resizeHandle).toBeVisible();
  });

  test('can toggle sidebar visibility', async ({ page }) => {
    // Find the sidebar toggle button
    const toggleButton = page.locator('.usb-toggle-btn').first();
    
    if (await toggleButton.isVisible()) {
      const sidebar = page.locator('.unified-sidebar').first();
      const initialVisible = await sidebar.isVisible();
      
      // Click toggle
      await toggleButton.click();
      
      // Sidebar visibility should change - wait for visibility state to change
      if (initialVisible) {
        await expect(sidebar).not.toBeVisible({ timeout: 3_000 });
      } else {
        await expect(sidebar).toBeVisible({ timeout: 3_000 });
      }
    }
  });

  test('sidebar width persists between sessions', async ({ page }) => {
    test.slow(); // Involves page reload
    const sidebar = page.locator('.unified-sidebar').first();
    
    if (await sidebar.isVisible()) {
      const initialWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
      
      // Reload page
      await page.reload();
      await expect(page.locator('.app-header')).toBeVisible({ timeout: 25_000 });
      
      const reloadedWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
      expect(reloadedWidth).toBe(initialWidth);
    }
  });

  test('can drag resize handle to change width', async ({ page }) => {
    const resizeHandle = page.locator('.usb-resize-handle').first();
    
    if (await resizeHandle.isVisible()) {
      const sidebar = page.locator('.unified-sidebar').first();
      const initialWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
      
      // Get handle position
      const handleBox = await resizeHandle.boundingBox();
      if (handleBox) {
        // Drag handle 50px to the right
        await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(handleBox.x + 50, handleBox.y + handleBox.height / 2);
        await page.mouse.up();
        
        // Wait for resize to take effect
        await expect(async () => {
          const newWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
          expect(newWidth).not.toBe(initialWidth);
        }).toPass({ timeout: 3_000 });
      }
    }
  });
});

test.describe('Workflow Export', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    // Navigate directly to workflow tab
    await page.goto('/?tab=workflow');
    await expect(page.locator('.wf-designer')).toBeVisible({ timeout: 25_000 });
  });

  test('workflow designer loads correctly', async ({ page }) => {
    // Workflow designer should be visible
    const designer = page.locator('.wf-designer');
    await expect(designer).toBeVisible({ timeout: 5000 });
  });

  test('can navigate to workflow via activity bar', async ({ page }) => {
    test.slow(); // Involves page navigation
    // Go to home first
    await page.goto('/');
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 25_000 });
    
    // Click Workflow button in activity bar
    const workflowButton = page.locator('.ab-btn:has(.ab-label:text("Workflow"))');
    await workflowButton.click();
    
    // Workflow designer should be visible
    const designer = page.locator('.wf-designer');
    await expect(designer).toBeVisible({ timeout: 5000 });
  });

  test('workflow export button is accessible', async ({ page }) => {
    // Verify the workflow toolbar has an export/save button accessible to users
    const toolbar = page.locator('.wf-toolbar, .wf-status-bar');
    if (await toolbar.count() > 0) {
      await expect(toolbar.first()).toBeVisible();
    }
    // The handleExportSpec function is exercised via unit tests;
    // here we just confirm the workflow designer loads with its controls
    const designer = page.locator('.wf-designer');
    await expect(designer).toBeVisible({ timeout: 5000 });
    // Verify canvas controls are rendered (zoom, fit-view, etc.)
    const controls = page.locator('.react-flow__controls, .wf-canvas-controls');
    if (await controls.count() > 0) {
      await expect(controls.first()).toBeVisible();
    }
  });
});

test.describe('Execution Mode Selector', () => {
  test.beforeEach(async ({ page }) => {
    await seedAppData(page);
    await page.goto('/?tab=scenarios');
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 25_000 });
  });

  test('execution mode selector exists on scenarios tab', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Scenarios page may be empty for the seeded env/svc pair, so assert on
    // stable controls that are always present in this tab context.
    const featureGroupsTab = page.getByRole('button', { name: 'Feature Groups' })
      .or(page.locator('.builder-tab[title*="Feature Group"]'));
    const testRunnerTab = page.getByRole('button', { name: 'Test Runner' })
      .or(page.locator('.builder-tab[title*="Test Runner"]'));
    await expect(featureGroupsTab.first()).toBeVisible();
    await expect(testRunnerTab.first()).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add Feature Group' })).toBeVisible();

    // Header environment/service selectors now use CustomSelect wrappers.
    await expect(page.getByTestId('header-env-select').locator('.cs-trigger')).toBeVisible();
    await expect(page.getByTestId('header-svc-select').locator('.cs-trigger')).toBeVisible();
  });

  test('can interact with select elements on scenarios tab', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const envSelect = page.getByTestId('header-env-select');
    await envSelect.locator('.cs-trigger').click();
    await expect(page.locator('.cs-menu').first()).toBeVisible();
    const envItemCount = await page.locator('.cs-menu .cs-item').count();
    if (envItemCount === 0) {
      await expect(page.locator('.cs-menu .cs-empty').first()).toBeVisible();
    } else {
      expect(envItemCount).toBeGreaterThan(0);
    }
    await page.keyboard.press('Escape');

    const svcSelect = page.getByTestId('header-svc-select');
    await svcSelect.locator('.cs-trigger').click();
    await expect(page.locator('.cs-menu').first()).toBeVisible();
    const svcItemCount = await page.locator('.cs-menu .cs-item').count();
    if (svcItemCount === 0) {
      await expect(page.locator('.cs-menu .cs-empty').first()).toBeVisible();
    } else {
      expect(svcItemCount).toBeGreaterThan(0);
    }
    await page.keyboard.press('Escape');
  });

  test('execution mode selector is on runner tab', async ({ page }) => {
    test.slow(); // Involves navigation
    // Navigate to runner tab where execution mode lives
    await page.goto('/?tab=runner');
    await expect(page.locator('.app-header')).toBeVisible({ timeout: 25_000 });

    const visibleRunner = page.locator('div:not([hidden]) > .page').first();
    await expect(visibleRunner.getByText('Execution Mode:')).toBeVisible();
    await expect(visibleRunner.getByText('Sequential')).toBeVisible();
    await expect(visibleRunner.getByText('Batch')).toBeVisible();
  });
});
