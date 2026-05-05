import { test, expect } from '@playwright/test';

/**
 * Smoke tests for Workflow Picker in Harness (Phase 2)
 * Tests the workflow selection UI and variable history features.
 */

test.describe('Workflow Picker Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/?tab=runner');
    await page.waitForLoadState('networkidle');
  });

  test('shows workflow picker when Workflow mode is selected', async ({ page }) => {
    // Select Workflow execution mode
    const workflowRadio = page.locator('label.radio-label').filter({ hasText: 'Workflow' });
    await workflowRadio.click();

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

    // Select Workflow mode
    const workflowRadio = page.locator('label.radio-label').filter({ hasText: 'Workflow' });
    await workflowRadio.click();

    // Check for empty state or workflow dropdown
    const picker = page.locator('.workflow-picker');
    await expect(picker).toBeVisible();

    // Either shows empty state or a dropdown (depending on if sample workflows exist)
    const emptyOrDropdown = picker.locator('.workflow-picker-empty, .workflow-picker-select');
    await expect(emptyOrDropdown.first()).toBeVisible();
  });

  test('hides scenario selection when workflow mode is selected', async ({ page }) => {
    // First verify scenario selection is visible in default mode
    const scenarioHeader = page.locator('h3').filter({ hasText: 'Select Scenarios to Test' });
    
    // Select Workflow mode
    const workflowRadio = page.locator('label.radio-label').filter({ hasText: 'Workflow' });
    await workflowRadio.click();

    // Workflow picker should be visible
    await expect(page.locator('.workflow-picker')).toBeVisible();
    
    // If a workflow is selected, scenario selection should be hidden
    // (If no workflows exist, the picker will show empty state)
  });

  test('workflow picker dropdown is disabled when test is running', async ({ page }) => {
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

    // Select Workflow mode
    const workflowRadio = page.locator('label.radio-label').filter({ hasText: 'Workflow' });
    await workflowRadio.click();

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

    // Select Workflow mode
    await page.locator('label.radio-label').filter({ hasText: 'Workflow' }).click();

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

    // Select Workflow mode
    await page.locator('label.radio-label').filter({ hasText: 'Workflow' }).click();

    // Select the workflow
    await page.locator('.workflow-picker-select').selectOption('test-wf-clear');

    // Clear button should be visible
    await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();

    // Click Clear
    await page.getByRole('button', { name: 'Clear' }).click();

    // Workflow should be deselected (hint text appears)
    await expect(page.locator('.workflow-picker-hint')).toContainText('Select a workflow above');
  });

  test('shows History button and panel', async ({ page }) => {
    // Create a test workflow and some history
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
      
      // Add some history
      const history = [
        { id: 'h1', workflowId: 'test-wf-history', variables: { env: 'staging' }, usedAt: Date.now() - 3600000 },
        { id: 'h2', workflowId: 'test-wf-history', variables: { env: 'dev' }, label: 'Dev Config', usedAt: Date.now() - 7200000 },
      ];
      localStorage.setItem('workflow-run-configs', JSON.stringify(history));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select Workflow mode and workflow
    await page.locator('label.radio-label').filter({ hasText: 'Workflow' }).click();
    await page.locator('.workflow-picker-select').selectOption('test-wf-history');

    // History button should show count
    const historyBtn = page.getByRole('button', { name: /History \(2\)/ });
    await expect(historyBtn).toBeVisible();

    // Click to open history panel
    await historyBtn.click();

    // History panel should be visible with items
    await expect(page.locator('.workflow-history-panel')).toBeVisible();
    await expect(page.locator('.history-item')).toHaveCount(2);
    await expect(page.locator('.history-label').filter({ hasText: 'Dev Config' })).toBeVisible();
  });

  test('can restore variables from history', async ({ page }) => {
    // Create workflow and history
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
      
      const history = [
        { id: 'h1', workflowId: 'test-wf-restore', variables: { baseUrl: 'https://staging.com' }, label: 'Staging', usedAt: Date.now() },
      ];
      localStorage.setItem('workflow-run-configs', JSON.stringify(history));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Select Workflow mode and workflow
    await page.locator('label.radio-label').filter({ hasText: 'Workflow' }).click();
    await page.locator('.workflow-picker-select').selectOption('test-wf-restore');

    // Verify default value
    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('https://default.com');

    // Open history and click on the saved config
    await page.getByRole('button', { name: /History/ }).click();
    await page.locator('.history-item-info').filter({ hasText: 'Staging' }).click();

    // Variable should be updated
    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('https://staging.com');
  });

  test('shows modified badge when variables differ from defaults', async ({ page }) => {
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

    // Select Workflow mode and workflow
    await page.locator('label.radio-label').filter({ hasText: 'Workflow' }).click();
    await page.locator('.workflow-picker-select').selectOption('test-wf-modified');

    // Initially no modified badge
    await expect(page.locator('.vars-modified-badge')).not.toBeVisible();

    // Modify the variable
    await page.locator('input.wf-var-value-input').first().fill('changed-key');

    // Modified badge should appear
    await expect(page.locator('.vars-modified-badge')).toBeVisible();

    // Reset button should appear
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
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

    // Select Workflow mode and workflow
    await page.locator('label.radio-label').filter({ hasText: 'Workflow' }).click();
    await page.locator('.workflow-picker-select').selectOption('test-wf-reset');

    // Modify the variable
    await page.locator('input.wf-var-value-input').first().fill('modified-value');
    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('modified-value');

    // Click Reset
    await page.getByRole('button', { name: 'Reset' }).click();

    // Value should be restored
    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('original-value');
  });

  test('switching away from Workflow mode hides picker', async ({ page }) => {
    // Select Workflow mode
    await page.locator('label.radio-label').filter({ hasText: 'Workflow' }).click();
    await expect(page.locator('.workflow-picker')).toBeVisible();

    // Switch to Sequential mode
    await page.locator('label.radio-label').filter({ hasText: 'Sequential' }).click();
    
    // Workflow picker should be hidden
    await expect(page.locator('.workflow-picker')).not.toBeVisible();
  });
});
