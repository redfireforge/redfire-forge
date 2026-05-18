import { test, expect } from '@playwright/test';
import { seedAppData } from './helpers';
import type { Workflow } from '../src/features/workflow/types/workflow';

function makeWorkflow(): Workflow {
  return {
    id: 'wf-diag',
    name: 'Diag',
    schemaVersion: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    variables: {},
    hostProfiles: [],
    authProfiles: [],
    services: [],
    nodes: [
      { id: 'start1', type: 'start', position: { x: 50, y: 200 }, data: { label: 'Start' } },
      {
        id: 'script1',
        type: 'script',
        position: { x: 300, y: 200 },
        data: {
          label: 'Diag Script',
          code: 'const x = JSON.parse(input.pageJson);\noutput.result = x;',
          mode: 'transform' as const,
          inputVariables: ['pageJson', 'pageIndex', 'pageSize'],
          outputVariables: ['result'],
          timeoutMs: 5000,
          captureConsole: true,
          mockInputs: {
            pageJson: JSON.stringify(Array.from({ length: 30 }, (_, i) => ({
              userId: 1, id: i + 1, title: 'item ' + i,
              body: 'lorem ipsum dolor sit amet '.repeat(20),
            }))),
            pageIndex: '9',
            pageSize: '3',
          },
        },
      },
      { id: 'end1', type: 'end', position: { x: 600, y: 200 }, data: { label: 'End' } },
    ],
    edges: [
      { id: 'e1', source: 'start1', target: 'script1' },
      { id: 'e2', source: 'script1', target: 'end1' },
    ],
  };
}

test('diagnose value panel scrollbar', async ({ page }) => {
  await seedAppData(page);
  await page.addInitScript((workflowJson: string) => {
    localStorage.setItem('workflows', workflowJson);
    localStorage.setItem('workflows_selected_id', 'wf-diag');
  }, JSON.stringify([makeWorkflow()]));
  await page.goto('/?tab=workflow');
  await page.waitForSelector('.app-header', { timeout: 10000 });
  await page.waitForLoadState('networkidle');

  // Open script config
  await page.locator('.wf-node-script .wf-node-configure-badge').click();
  await expect(page.locator('[aria-labelledby="wf-config-modal-title"]')).toBeVisible();

  // Open editor
  await page.getByText('Open Editor').click();
  const editorModal = page.locator('.wf-script-modal-overlay');
  await expect(editorModal).toBeVisible();

  // Click the pageJson test value
  // Note: dispatchEvent is needed because the underlying config modal's
  // .wf-config-button-row (inside .wf-designer) can intercept pointer events
  const pageJsonRow = page.locator('.wf-script-test-value-header').filter({ hasText: 'pageJson' });
  await expect(pageJsonRow).toBeVisible();
  await pageJsonRow.dispatchEvent('click');

  // Wait for value panel
  const valuePanel = page.locator('.wf-script-value-panel');
  await expect(valuePanel).toBeVisible();

  // Switch to text mode and inject a long value
  const switchBtn = page.locator('.wf-script-value-popup-actions button').first();
  if (await switchBtn.isVisible()) {
    const txt = await switchBtn.getAttribute('title') ?? '';
    if (txt.includes('text editor')) await switchBtn.dispatchEvent('click');
  }

  const textarea = page.locator('.wf-script-value-panel-editor');
  if (await textarea.isVisible()) {
    const longJson = JSON.stringify(Array.from({ length: 50 }, (_, i) => ({
      userId: 1, id: i + 1, title: 'item ' + i, body: 'lorem '.repeat(30),
    })), null, 2);
    await textarea.fill(longJson);
  }

  // Now switch back to tree mode
  const switchBtn2 = page.locator('.wf-script-value-popup-actions button').first();
  const t2 = await switchBtn2.getAttribute('title') ?? '';
  if (t2.includes('tree view')) await switchBtn2.dispatchEvent('click');
  await page.waitForTimeout(300);

  // Click "Expand All" to expand the tree
  const expandAllBtn = page.getByRole('button', { name: 'Expand All' });
  if (await expandAllBtn.isVisible()) await expandAllBtn.dispatchEvent('click');
  await page.waitForTimeout(300);

  // === DIAGNOSTICS ===
  const diagnostics = await page.evaluate(() => {
    const panel = document.querySelector('.wf-script-value-panel') as HTMLElement | null;
    const body = document.querySelector('.wf-script-value-panel-body') as HTMLElement | null;
    const scroll = document.querySelector('.wf-script-value-panel-json-scroll') as HTMLElement | null;
    const wrapper = document.querySelector('.wf-script-value-panel-json-scroll .req-json-preview-wrapper') as HTMLElement | null;
    const tree = document.querySelector('.wf-script-value-panel-json-scroll .jt-tree') as HTMLElement | null;
    const layout = document.querySelector('.wf-script-modal-layout') as HTMLElement | null;
    const modalBody = document.querySelector('.wf-script-modal .wf-config-modal-body') as HTMLElement | null;
    const modal = document.querySelector('.wf-script-modal') as HTMLElement | null;

    const measure = (el: HTMLElement | null, name: string) => {
      if (!el) return { name, exists: false };
      const cs = getComputedStyle(el);
      return {
        name,
        exists: true,
        rect: { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height },
        scroll: { sw: el.scrollWidth, sh: el.scrollHeight, cw: el.clientWidth, ch: el.clientHeight },
        css: {
          display: cs.display,
          position: cs.position,
          flex: cs.flex,
          height: cs.height,
          maxHeight: cs.maxHeight,
          minHeight: cs.minHeight,
          overflow: cs.overflow,
          overflowY: cs.overflowY,
          overflowX: cs.overflowX,
        },
      };
    };

    return {
      modal: measure(modal, 'modal'),
      modalBody: measure(modalBody, 'modalBody'),
      layout: measure(layout, 'layout'),
      panel: measure(panel, 'panel'),
      body: measure(body, 'body'),
      scroll: measure(scroll, 'scroll'),
      wrapper: measure(wrapper, 'wrapper'),
      tree: measure(tree, 'tree'),
      hasOverflowV: scroll ? scroll.scrollHeight > scroll.clientHeight : false,
      hasOverflowH: scroll ? scroll.scrollWidth > scroll.clientWidth : false,
    };
  });

  console.log('=== DIAGNOSTICS ===');
  console.log(JSON.stringify(diagnostics, null, 2));

  // Check actual scrollbar visibility
  const scrollbarInfo = await page.evaluate(() => {
    const scroll = document.querySelector('.wf-script-value-panel-json-scroll') as HTMLElement | null;
    if (!scroll) return null;
    const cs = getComputedStyle(scroll);
    // Try to get pseudo-element styles
    const sbStyle = getComputedStyle(scroll, '::-webkit-scrollbar');
    return {
      scrollbarWidth: cs.scrollbarWidth,
      scrollbarColor: cs.scrollbarColor,
      sbWidth: sbStyle.width,
      sbHeight: sbStyle.height,
      sbAppearance: (sbStyle as Record<string, string>).webkitAppearance,
      // Compute reserved scrollbar gutter width:
      gutter: scroll.offsetWidth - scroll.clientWidth,
    };
  });
  console.log('=== SCROLLBAR INFO ===');
  console.log(JSON.stringify(scrollbarInfo, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'test-results/value-panel-diag.png', fullPage: false });

  // Screenshot just the panel
  await page.locator('.wf-script-value-panel').screenshot({ path: 'test-results/value-panel-only.png' });
});
