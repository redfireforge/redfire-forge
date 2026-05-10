import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke tests for Workflow Picker in Workflow Runner (after runner split)
 * Tests the workflow selection UI and variable history features.
 * 
 * NOTE: After the runner split, WorkflowPicker is in a dedicated WorkflowRunner component
 * accessible at /?tab=workflow-runner
 */

async function selectWorkflow(page: Page, workflowName: string) {
  await page.locator('[data-testid="workflow-select"]').click();
  await page.locator(`.wfp-dropdown-item:has-text("${workflowName}")`).click();
}

test.describe('Workflow Picker Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/?tab=workflow-runner');
    await page.waitForLoadState('networkidle');
  });

  test('shows workflow picker on workflow runner page', async ({ page }) => {
    await expect(page.locator('.workflow-picker')).toBeVisible();
    const selectOrEmpty = page.locator('[data-testid="workflow-select"], .workflow-picker-empty');
    await expect(selectOrEmpty.first()).toBeVisible();
  });

  test('shows empty state when no workflows exist', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem('workflows');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const picker = page.locator('.workflow-picker');
    await expect(picker).toBeVisible();

    const emptyOrDropdown = picker.locator('.workflow-picker-empty, [data-testid="workflow-select"]');
    await expect(emptyOrDropdown.first()).toBeVisible();
  });

  test('workflow runner does not show test scenario selection', async ({ page }) => {
    const scenarioHeader = page.locator('h3').filter({ hasText: 'Select Scenarios to Test' });
    await expect(scenarioHeader).not.toBeVisible();
    
    await expect(page.locator('.workflow-picker')).toBeVisible();
  });

  test('workflow picker dropdown is enabled', async ({ page }) => {
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

    const trigger = page.locator('[data-testid="workflow-select"]');
    await expect(trigger).toBeVisible();
    await expect(trigger).not.toBeDisabled();
  });

  test('can select a workflow from dropdown', async ({ page }) => {
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

    await selectWorkflow(page, 'Order API Flow');

    await expect(page.locator('.workflow-step-count')).toContainText('2 HTTP steps');
    await expect(page.locator('.workflow-step-names')).toContainText('Create Order');

    await expect(page.locator('.wf-vars-list')).toBeVisible();
    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('test-key-123');
  });

  test('shows Clear button when workflow is selected', async ({ page }) => {
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

    await selectWorkflow(page, 'Clear Test Workflow');

    const clearBtn = page.getByRole('button', { name: 'Clear', exact: true });
    await expect(clearBtn).toBeVisible();

    await clearBtn.click();

    await expect(page.locator('.workflow-picker-hint')).toContainText('Select a workflow above');
  });

  test('shows Presets button and panel', async ({ page }) => {
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
      
      const history = [
        { id: 'h1', workflowId: 'test-wf-history', variables: { env: 'staging' }, usedAt: Date.now() - 3600000 },
        { id: 'h2', workflowId: 'test-wf-history', variables: { env: 'dev' }, label: 'Dev Config', usedAt: Date.now() - 7200000 },
      ];
      localStorage.setItem('workflow-run-configs', JSON.stringify(history));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await selectWorkflow(page, 'History Test Workflow');

    const presetsBtn = page.getByRole('button', { name: /Presets \(2\)/ });
    await expect(presetsBtn).toBeVisible();

    await presetsBtn.click();

    await expect(page.locator('.workflow-presets-panel, .workflow-history-panel')).toBeVisible();
  });

  test('can restore variables from presets', async ({ page }) => {
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

    await selectWorkflow(page, 'Restore Test');

    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('https://default.com');

    await page.getByRole('button', { name: /Presets/ }).click();
    const restoreBtn = page.locator('button[title="Restore these variable values"]');
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('https://staging.com');
  });

  test('shows modified state when variables differ from defaults', async ({ page }) => {
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

    await selectWorkflow(page, 'Modified Test');

    await page.locator('input.wf-var-value-input').first().fill('changed-key');
    await page.locator('input.wf-var-value-input').first().blur();
    
    await page.waitForTimeout(300);

    await expect(page.getByRole('button', { name: 'Reset', exact: true })).toBeVisible();
  });

  test('Reset button restores default variables', async ({ page }) => {
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

    await selectWorkflow(page, 'Reset Test');

    await page.locator('input.wf-var-value-input').first().fill('modified-value');
    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('modified-value');

    await page.getByRole('button', { name: 'Reset', exact: true }).click();

    await expect(page.locator('input.wf-var-value-input').first()).toHaveValue('original-value');
  });

  test('workflow runner has dedicated tab', async ({ page }) => {
    await expect(page.locator('.workflow-picker')).toBeVisible();
    
    await expect(page).toHaveURL(/tab=workflow-runner/);
  });
});
