import { test, expect, type Page } from '@playwright/test';
import type { Workflow } from '../src/features/workflow/types/workflow';

function makeWaitForConditionWorkflow(): Workflow {
  return {
    id: 'wf-poll-test',
    name: 'Poll Test Workflow',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: {},
    hostProfiles: [],
    authProfiles: [],
    nodes: [
      { id: 'start', type: 'start', position: { x: 100, y: 100 }, data: { label: 'Start' } },
      { id: 'wait', type: 'waitForCondition', position: { x: 100, y: 200 }, 
        data: { label: 'Wait for Status', conditionExpression: '{{status}} == "done"', pollIntervalMs: 2000, timeoutMs: 10000, maxAttempts: 5 } },
      { id: 'end', type: 'end', position: { x: 100, y: 300 }, data: { label: 'End', isSuccess: true } },
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'wait' },
      { id: 'e2', source: 'wait', target: 'end' },
    ],
  };
}

async function seedAndOpenWorkflowRunner(page: Page) {
  const workflow = makeWaitForConditionWorkflow();
  await page.addInitScript((wf) => {
    localStorage.setItem('workflows', JSON.stringify([wf]));
  }, workflow);

  await page.goto('/?tab=workflow-runner');
  await page.waitForLoadState('networkidle');
  await page.getByTestId('workflow-select').click();
  await page.locator('.wfp-dropdown-item:has-text("Poll Test Workflow")').click();
  await page.waitForTimeout(300);
  await page.locator('.workflow-runner-config-section').waitFor({ timeout: 5000 });
}

test.describe('Poll Throttle UI', () => {
  test('renders with correct layout and styles', async ({ page }) => {
    await seedAndOpenWorkflowRunner(page);
    
    // Find the Poll limit inline option for WaitForCondition workflows
    const pollOption = page.locator('.wf-inline-option').filter({ hasText: 'Poll limit' });
    await expect(pollOption).toBeVisible();
    
    // Check the label
    await expect(pollOption.locator('.wf-inline-label')).toHaveText('Poll limit');
    
    // Check input
    const input = pollOption.locator('input[type="number"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('20');
    
    // Check hint text
    const hint = pollOption.locator('.wf-inline-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('max concurrent polls');
  });
});
