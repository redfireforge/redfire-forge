import { test, expect } from '@playwright/test';

test.describe('Run in Harness Navigation', () => {
  test('should preserve workflow selection when navigating from Designer to Runner', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Create a workflow in the Designer
    await page.click('text=Workflow');
    await page.waitForTimeout(500);
    await page.click('button:has-text("+ New Workflow")');
    await page.fill('input[placeholder="Workflow name"]', 'Test Run Harness');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(500);
    
    // Wait for designer to load
    await expect(page.locator('text=Test Run Harness').first()).toBeVisible();
    
    // Click "Run in Harness" button
    const runInHarnessBtn = page.locator('button:has-text("Run in Harness")');
    await expect(runInHarnessBtn).toBeVisible();
    await runInHarnessBtn.click();
    
    // Should navigate to Workflow Runner tab
    await expect(page.locator('text=Workflow Runner')).toBeVisible();
    
    // Verify that "Test Run Harness" workflow is pre-selected
    const workflowSelect = page.locator('select[data-testid="workflow-select"]');
    await expect(workflowSelect).toBeVisible();
    const selectedValue = await workflowSelect.inputValue();
    expect(selectedValue).toBeTruthy();
    
    // Verify workflow name is shown
    await expect(page.locator('text=Test Run Harness')).toBeVisible();
    
    // Navigate back to Workflow Designer
    await page.click('text=Workflow');
    await page.waitForTimeout(500);
    
    // Navigate to Workflow Runner again
    await page.click('text=Workflow Runner');
    await page.waitForTimeout(500);
    
    // Verify that "Test Run Harness" is STILL selected (persistence test)
    const selectedValueAfterNavigate = await workflowSelect.inputValue();
    expect(selectedValueAfterNavigate).toBe(selectedValue);
    await expect(page.locator('text=Test Run Harness')).toBeVisible();
  });

  test('should not reset workflow selection when clicking Run in Harness multiple times', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // Create two workflows
    await page.click('text=Workflow');
    await page.waitForTimeout(500);
    
    // Workflow 1
    await page.click('button:has-text("+ New Workflow")');
    await page.fill('input[placeholder="Workflow name"]', 'Workflow A');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(500);
    
    // Workflow 2
    await page.click('button:has-text("+ New Workflow")');
    await page.fill('input[placeholder="Workflow name"]', 'Workflow B');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(500);
    
    // Select Workflow A
    const workflowSelectInDesigner = page.locator('select').first();
    await workflowSelectInDesigner.selectOption({ label: 'Workflow A' });
    await page.waitForTimeout(300);
    
    // Click "Run in Harness" for Workflow A
    await page.locator('button:has-text("Run in Harness")').click();
    await expect(page.locator('text=Workflow Runner')).toBeVisible();
    
    // Verify Workflow A is selected in Runner
    await expect(page.locator('text=Workflow A')).toBeVisible();
    
    // Go back to Designer
    await page.click('text=Workflow');
    await page.waitForTimeout(500);
    
    // Select Workflow B
    await workflowSelectInDesigner.selectOption({ label: 'Workflow B' });
    await page.waitForTimeout(300);
    
    // Click "Run in Harness" for Workflow B
    await page.locator('button:has-text("Run in Harness")').click();
    await expect(page.locator('text=Workflow Runner')).toBeVisible();
    
    // Verify Workflow B is NOW selected (should override Workflow A)
    const workflowNameInRunner = page.locator('.workflow-runner-summary h3, .workflow-meta h3, text=Workflow B').first();
    await expect(workflowNameInRunner).toBeVisible();
    
    // Verify we don't see Workflow A as the current selection
    const currentWorkflowSelect = page.locator('select[data-testid="workflow-select"]');
    const selectedOption = currentWorkflowSelect.locator('option:checked');
    await expect(selectedOption).toHaveText('Workflow B');
  });
});
