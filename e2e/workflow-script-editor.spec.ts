import { test, expect } from '@playwright/test';
import { gotoAppTab, seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

function makeScriptWorkflow(): Workflow {
  return {
    id: 'wf-script-e2e',
    name: 'Script Editor Test',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: {},
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      {
        id: 'start1',
        type: 'start',
        position: { x: 50, y: 200 },
        data: { label: 'Start' },
      },
      {
        id: 'script1',
        type: 'script',
        position: { x: 300, y: 200 },
        data: {
          label: 'Validate Data',
          code: [
            'const user = JSON.parse(input.userJson);',
            'const posts = JSON.parse(input.postsJson);',
            'console.log("Checking " + posts.length + " posts for user: " + user.name);',
            'let mismatchCount = 0;',
            'for (const post of posts) {',
            '  if (post.userId !== user.id) {',
            '    mismatchCount++;',
            '  }',
            '}',
            'output.postCount = String(posts.length);',
            'output.mismatchCount = String(mismatchCount);',
            'output.result = mismatchCount === 0;',
          ].join('\n'),
          mode: 'validate' as const,
          inputVariables: ['userJson', 'postsJson'],
          outputVariables: ['postCount', 'mismatchCount', 'result'],
          timeoutMs: 5000,
          captureConsole: true,
        },
      },
      {
        id: 'http1',
        type: 'http',
        position: { x: 600, y: 200 },
        data: {
          label: 'Get User',
          scenario: {
            id: 'sc-1', name: 'Get User', url: '/users/1', method: 'GET',
            headers: [], body: '', auth: { type: 'none' }, validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'end1',
        type: 'end',
        position: { x: 900, y: 200 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'e1', source: 'start1', target: 'script1' },
      { id: 'e2', source: 'script1', target: 'http1' },
      { id: 'e3', source: 'http1', target: 'end1' },
    ],
  };
}

async function seedAndNavigate(page: import('@playwright/test').Page) {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-script-e2e');
  }, JSON.stringify([makeScriptWorkflow()]));
  await gotoAppTab(page, 'workflow');
}

/** Open the Script node config modal via the configure badge */
async function openScriptConfigModal(page: import('@playwright/test').Page) {
  const scriptNode = page.locator('.wf-node-script');
  await expect(scriptNode).toBeVisible({ timeout: 5000 });
  const configBadge = scriptNode.locator('.wf-node-configure-badge');
  await configBadge.click();
  // Wait for the config modal to appear
  const configModal = page.locator('[aria-labelledby="wf-config-modal-title"]');
  await expect(configModal).toBeVisible({ timeout: 3000 });
  return configModal;
}

test.describe('Script Editor Modal - Expand/Shrink', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page);
  });

  test('Script node is visible on canvas', async ({ page }) => {
    await expect(page.locator('.wf-node-script')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.wf-node-script .wf-node-label')).toContainText('Validate Data');
  });

  test('Open Editor button is visible in script config', async ({ page }) => {
    await openScriptConfigModal(page);
    const openEditorBtn = page.getByText('Open Editor');
    await expect(openEditorBtn).toBeVisible({ timeout: 3000 });
  });

  test('clicking Open Editor opens the script editor modal', async ({ page }) => {
    await openScriptConfigModal(page);
    const openEditorBtn = page.getByText('Open Editor');
    await openEditorBtn.click();

    // The script editor modal should appear (portaled to body)
    const editorModal = page.locator('.wf-script-modal-overlay');
    await expect(editorModal).toBeVisible({ timeout: 3000 });

    // Title should show "SCRIPT EDITOR — Validate Data"
    const title = page.locator('#wf-script-editor-title');
    await expect(title).toContainText('SCRIPT EDITOR');
    await expect(title).toContainText('Validate Data');
  });

  test('script editor modal has expand button matching other modals', async ({ page }) => {
    await openScriptConfigModal(page);
    await page.getByText('Open Editor').click();

    const overlay = page.locator('.wf-script-modal-overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });

    const scriptModal = overlay.locator('.wf-script-modal');

    // Expand button should be present in header (same as config modal)
    const expandBtn = scriptModal.getByRole('button', { name: 'Expand modal' }).first();
    await expect(expandBtn).toBeVisible();
    // Should use the ⊕ symbol (same as all other modals)
    await expect(expandBtn).toHaveText('⊕');
  });

  test('script editor has expand button in header', async ({ page }) => {
    // Config modal hides expand button but script editor should show it
    await openScriptConfigModal(page);
    await page.getByText('Open Editor').click();

    const overlay = page.locator('.wf-script-modal-overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });
    const scriptExpandBtn = overlay.locator('.wf-script-modal').getByRole('button', { name: 'Expand modal' }).first();
    await expect(scriptExpandBtn).toBeVisible();
    await expect(scriptExpandBtn).toHaveText('⊕');
  });

  test('clicking expand makes script editor fullscreen', async ({ page }) => {
    await openScriptConfigModal(page);
    await page.getByText('Open Editor').click();

    const overlay = page.locator('.wf-script-modal-overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });

    const scriptModal = overlay.locator('.wf-script-modal');
    const expandBtn = scriptModal.getByRole('button', { name: 'Expand modal' }).first();

    // Verify modal is NOT expanded/fullscreen initially
    await expect(scriptModal).not.toHaveClass(/modal-fullscreen/);

    // Click expand
    await expandBtn.click();

    // Should now have modal-fullscreen class (same behavior as config modal)
    await expect(scriptModal).toHaveClass(/modal-fullscreen/, { timeout: 2000 });

    // Expand button text should change to ⊖ (Shrink)
    const shrinkBtn = scriptModal.getByRole('button', { name: 'Shrink modal' }).first();
    await expect(shrinkBtn).toBeVisible();
    await expect(shrinkBtn).toHaveText('⊖');
  });

  test('clicking shrink restores script editor to original size', async ({ page }) => {
    await openScriptConfigModal(page);
    await page.getByText('Open Editor').click();

    const overlay = page.locator('.wf-script-modal-overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });

    const scriptModal = overlay.locator('.wf-script-modal').first();
    await expect(scriptModal).toBeVisible({ timeout: 3000 });

    const expandBtn = scriptModal.getByRole('button', { name: 'Expand modal' }).first();
    await expandBtn.click({ force: true });
    await expect(overlay.locator('.wf-script-modal.modal-fullscreen').first()).toBeVisible({ timeout: 3000 });

    const shrinkBtn = overlay.locator('.wf-script-modal').getByRole('button', { name: 'Shrink modal' }).first();
    await expect(shrinkBtn).toBeVisible({ timeout: 3000 });
    await shrinkBtn.evaluate((el) => (el as HTMLButtonElement).click());

    // Should no longer have modal-fullscreen class.
    await expect(overlay.locator('.wf-script-modal.modal-fullscreen')).toHaveCount(0, { timeout: 3000 });
    await expect(overlay.locator('.wf-script-modal').getByRole('button', { name: 'Expand modal' }).first()).toHaveText('⊕');
  });

  test('config modal has Close and Save buttons in footer', async ({ page }) => {
    const configModal = await openScriptConfigModal(page);

    // Config modal should have Close and Save buttons
    const closeBtn = configModal.getByRole('button', { name: 'Close' });
    const saveBtn = configModal.getByRole('button', { name: 'Save' });
    
    await expect(closeBtn).toBeVisible();
    await expect(saveBtn).toBeVisible();
  });

  test('script editor footer has expand button matching config modal footer', async ({ page }) => {
    await openScriptConfigModal(page);
    await page.getByText('Open Editor').click();

    const overlay = page.locator('.wf-script-modal-overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });

    // Footer expand button (bottom-left) should be present
    const footerExpandBtn = overlay.locator('.modal-expand-btn-bottom');
    await expect(footerExpandBtn).toBeVisible();
  });

  test('script editor modal has Cancel and Save buttons in footer', async ({ page }) => {
    await openScriptConfigModal(page);
    await page.getByText('Open Editor').click();

    const overlay = page.locator('.wf-script-modal-overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });

    const modal = overlay.locator('.wf-script-modal');
    const cancelBtn = modal.getByRole('button', { name: 'Cancel' });
    const saveBtn = modal.getByRole('button', { name: 'Save' });

    await expect(cancelBtn).toBeVisible();
    await expect(saveBtn).toBeVisible();
  });

  test('script editor close button dismisses modal', async ({ page }) => {
    await openScriptConfigModal(page);
    await page.getByText('Open Editor').click();

    const overlay = page.locator('.wf-script-modal-overlay');
    await expect(overlay).toBeVisible({ timeout: 3000 });

    // Close button (×) in header
    const closeBtn = overlay.locator('.wf-script-modal .ram-modal-close');
    await closeBtn.click();

    await expect(overlay).not.toBeVisible({ timeout: 2000 });
  });
});
