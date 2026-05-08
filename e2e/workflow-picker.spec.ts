import { test, expect } from '@playwright/test';

/**
 * Smoke tests for Workflow Picker in Workflow Runner (after runner split)
 * Tests the workflow selection UI and variable history features.
 * 
 * NOTE: After the runner split, WorkflowPicker is in a dedicated WorkflowRunner component
 * accessible at /?tab=workflow-runner
 */

test.describe('Workflow Picker Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dedicated Workflow Runner tab
    await page.goto('http://localhost:5173/?tab=workflow-runner');
    await page.waitForLoadState('networkidle');
  });

  test('shows workflow picker on workflow runner page', async ({ page }) => {
    // Verify WorkflowPicker appears (may show dropdown or empty state)
    await expect(page.locator('.workflow-picker')).toBeVisible();
    // Either shows the select dropdown or the empty state
    const selectOrEmpty = page.locator('.workflow-picker-select, .workflow-picker-empty');
    await expect(selectOrEmpty.first()).toBeVisible();
  });

  test('shows empty state when no workflows exist', async ({ page }) => {
    // Clear any existing workflows from storage
    await page.evaluate(() => {
      localStorage.removeItem('workflows');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check for empty state or workflow dropdown
    const picker = page.locator('.workflow-picker');
    await expect(picker).toBeVisible();

    // Either shows empty state or a dropdown (depending on if sample workflows exist)
    const emptyOrDropdown = picker.locator('.workflow-picker-empty, .workflow-picker-select');
    await expect(emptyOrDropdown.first()).toBeVisible();
  });

  test('workflow runner does not show test scenario selection', async ({ page }) => {
    // Workflow runner should not have scenario selection (that's in TestRunner)
    const scenarioHeader = page.locator('h3').filter({ hasText: 'Select Scenarios to Test' });
    await expect(scenarioHeader).not.toBeVisible();
    
    // But workflow picker should be visible
    await expect(page.locator('.workflow-picker')).toBeVisible();
  });

  test('workflow picker dropdown is enabled', async ({ page }) => {
    // Create a test workflow via storage
    await page.evaluate(() => {
      const workflow = {
        id: 'test-wf-1',
        name: 'Test Workflow',
        variables: { baseUrl: 'https://httpbin.org' },
        nodes: [
          { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Test Request' } }
        ],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      localStorage.setItem('workflows', JSON.stringify([workflow]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify dropdown exists and is enabled initially
    const dropdown = page.locator('.workflow-picker-select');
    await expect(dropdown).toBeVisible();
    await expect(dropdown).not.toBeDisabled();
  });

  test('can select a workflow from dropdown', async ({ page }) => {
    // Create a test workflow
    await page.evaluate(() => {
      const workflow = {
        id: 'test-wf-select',
        name: 'Order API Flow',
        variables: { apiKey: 'test-key-123', baseUrl: 'https://api.example.com' },
        nodes: [
          { id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Create Order' } },
          { id: 'n2', type: 'http', position: { x: 0, y: 100 }, data: { label: 'Get Order' } }
        ],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      localStorage.setItem('workflows', JSON.stringify([workflow]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select the workflow
    await page.locator('.workflow-picker-select').selectOption('test-wf-select');

    // Verify workflow summary appears
    await expect(page.locator('.workflow-step-count')).toContainText('2 HTTP steps');
    await expect(page.locator('.workflow-step-names')).toContainText('Create Order');

    // Verify variables are shown
    await expect(page.locator('.wf-vars-list')).toBeVisible();
    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('test-key-123');
  });

  test('shows Clear button when workflow is selected', async ({ page }) => {
    // Create a test workflow
    await page.evaluate(() => {
      const workflow = {
        id: 'test-wf-clear',
        name: 'Clear Test Workflow',
        variables: {},
        nodes: [{ id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Request' } }],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      localStorage.setItem('workflows', JSON.stringify([workflow]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select the workflow
    await page.locator('.workflow-picker-select').selectOption('test-wf-clear');

    // Clear button should be visible
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();

    // Click Clear
    await page.getByRole('button', { name: 'Clear' }).click();

    // Workflow should be deselected (hint text appears)
    await expect(page.locator('.workflow-picker-hint')).toContainText('Select a workflow above');
  });

  test('shows Presets button and panel', async ({ page }) => {
    // Create a test workflow and some presets
    await page.evaluate(() => {
      const workflow = {
        id: 'test-wf-history',
        name: 'History Test Workflow',
        variables: { env: 'production' },
        nodes: [{ id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Request' } }],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      localStorage.setItem('workflows', JSON.stringify([workflow]));
      
      // Add some presets (history renamed to presets)
      const history = [
        { id: 'h1', workflowId: 'test-wf-history', variables: { env: 'staging' }, usedAt: Date.now() - 3600000 },
        { id: 'h2', workflowId: 'test-wf-history', variables: { env: 'dev' }, label: 'Dev Config', usedAt: Date.now() - 7200000 },
      ];
      localStorage.setItem('workflow-run-configs', JSON.stringify(history));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select workflow
    await page.locator('.workflow-picker-select').selectOption('test-wf-history');

    // Presets button should show count
    const presetsBtn = page.getByRole('button', { name: /Presets \(2\)/ });
    await expect(presetsBtn).toBeVisible();

    // Click to open presets panel
    await presetsBtn.click();

    // Presets panel should be visible with items
    await expect(page.locator('.workflow-presets-panel, .workflow-history-panel')).toBeVisible();
  });

  test('can restore variables from presets', async ({ page }) => {
    // Create workflow and presets
    await page.evaluate(() => {
      const workflow = {
        id: 'test-wf-restore',
        name: 'Restore Test',
        variables: { baseUrl: 'https://default.com' },
        nodes: [{ id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Request' } }],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      localStorage.setItem('workflows', JSON.stringify([workflow]));
      
      const presets = [
        { id: 'h1', workflowId: 'test-wf-restore', variables: { baseUrl: 'https://staging.com' }, label: 'Staging', usedAt: Date.now() },
      ];
      localStorage.setItem('workflow-run-configs', JSON.stringify(presets));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select workflow
    await page.locator('.workflow-picker-select').selectOption('test-wf-restore');

    // Verify default value
    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('https://default.com');

    // Open presets panel and click Restore on the preset
    await page.getByRole('button', { name: /Presets/ }).click();
    // Click the Restore button for the preset
    const restoreBtn = page.getByRole('button', { name: /Restore/ });
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    // Variable should be updated
    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('https://staging.com');
  });

  test('shows modified state when variables differ from defaults', async ({ page }) => {
    // Create workflow
    await page.evaluate(() => {
      const workflow = {
        id: 'test-wf-modified',
        name: 'Modified Test',
        variables: { apiKey: 'default-key' },
        nodes: [{ id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Request' } }],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      localStorage.setItem('workflows', JSON.stringify([workflow]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select workflow
    await page.locator('.workflow-picker-select').selectOption('test-wf-modified');

    // Modify the variable
    await page.locator('input.wf-var-value-input').first().fill('changed-key');
    await page.locator('input.wf-var-value-input').first().blur();
    
    // Wait for state update
    await page.waitForTimeout(300);

    // Reset button should appear when values are modified
    await expect(page.getByRole('button', { name: 'Reset', exact: true })).toBeVisible();
  });

  test('Reset button restores default variables', async ({ page }) => {
    // Create workflow
    await page.evaluate(() => {
      const workflow = {
        id: 'test-wf-reset',
        name: 'Reset Test',
        variables: { apiKey: 'original-value' },
        nodes: [{ id: 'n1', type: 'http', position: { x: 0, y: 0 }, data: { label: 'Request' } }],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      localStorage.setItem('workflows', JSON.stringify([workflow]));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select workflow
    await page.locator('.workflow-picker-select').selectOption('test-wf-reset');

    // Modify the variable
    await page.locator('input.wf-var-value-input').first().fill('modified-value');
    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('modified-value');

    // Click Reset - use exact match to avoid matching presets
    await page.getByRole('button', { name: 'Reset', exact: true }).click();

    // Value should be restored
    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('original-value');
  });

  test('workflow runner has dedicated tab', async ({ page }) => {
    // Verify we're on the workflow runner page
    await expect(page.locator('.workflow-picker')).toBeVisible();
    
    // The current URL should reflect the workflow-runner tab
    await expect(page).toHaveURL(/tab=workflow-runner/);
  });
});
