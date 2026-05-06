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
  await page.locator('.workflow-picker-select').selectOption('wf-poll-test');
  await page.waitForTimeout(300);
  await page.locator('.workflow-runner-config-section').waitFor({ timeout: 5000 });
}

test.describe('Poll Throttle UI', () => {
  test('renders with correct layout and styles', async ({ page }) => {
    await seedAndOpenWorkflowRunner(page);
    
    // Find the Poll Throttle section
    const pollSection = page.locator('.wf-runner-poll-throttle-section');
    await expect(pollSection).toBeVisible();
    
    // Check the header
    await expect(pollSection.locator('h3')).toHaveText('Poll Throttle');
    await expect(pollSection.locator('.config-section-badge')).toContainText('1 node');
    
    // Find the field container
    const fieldContainer = pollSection.locator('.wf-runner-poll-throttle-field');
    await expect(fieldContainer).toBeVisible();
    
    // Check label with inline layout (label text + input on same line)
    // Check input directly inside field container
    const input = fieldContainer.locator('input[type="number"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('20');
    
    // Dump header element boxes to understand layout
    const header = pollSection.locator('.config-section-header');
    const headerChildren = await header.evaluate((el) => {
      return Array.from(el.children).map((child) => {
        const rect = child.getBoundingClientRect();
        const styles = window.getComputedStyle(child);
        return {
          tag: child.tagName,
          class: child.className,
          text: child.textContent?.trim().slice(0, 30),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: styles.display,
        };
      });
    });
    console.log('Header children:', JSON.stringify(headerChildren, null, 2));

    const headerStyles = await header.evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { display: s.display, flexDirection: s.flexDirection, flexWrap: s.flexWrap, alignItems: s.alignItems, gap: s.gap };
    });
    console.log('Header styles:', headerStyles);

    // Verify all three elements are on the same row
    const labelTextEl = fieldContainer.locator('.wf-runner-poll-label-text');
    const hint = fieldContainer.locator('.wf-runner-poll-hint');
    await expect(labelTextEl).toBeVisible();
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('concurrent iteration');

    const labelBox = await labelTextEl.boundingBox();
    const inputBox = await input.boundingBox();
    const hintBox = await hint.boundingBox();

    // All three vertically centered on the same row (within 8px)
    const labelCenter = labelBox!.y + labelBox!.height / 2;
    const inputCenter = inputBox!.y + inputBox!.height / 2;
    const hintCenter = hintBox!.y + hintBox!.height / 2;
    expect(Math.abs(labelCenter - inputCenter)).toBeLessThan(8);
    expect(Math.abs(inputCenter - hintCenter)).toBeLessThan(8);

    // Input is to the right of the label
    expect(inputBox!.x).toBeGreaterThan(labelBox!.x);
    // Hint is to the right of the input
    expect(hintBox!.x).toBeGreaterThan(inputBox!.x);

    // Screenshot of just the section
    const sectionBox = await pollSection.boundingBox();
    await page.screenshot({
      path: 'playwright-report/poll-throttle-one-row.png',
      clip: { x: sectionBox!.x - 10, y: sectionBox!.y - 10, width: sectionBox!.width + 20, height: sectionBox!.height + 20 },
    });
  });
});
