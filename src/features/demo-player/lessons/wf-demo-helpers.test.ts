/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { makeCtx } from './protocols/ws-test-utils';
import {
  clickWfConfigAddRow,
  clickWfConfigTab,
  clickWfDebugStepButtons,
  closeWfConfigModalIfOpen,
  closeWfConsoleIfOpen,
  collapseWfDemoAppSidebar,
  ensureWfNodeConfigModalOpen,
  fillWfConfigField,
  isWfConfigTabActive,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  pauseWfConfigDemo,
  pauseWfConfigSection,
  saveAndCloseWfConfigModal,
  selectWorkflowFromAppSidebar,
  WF_CONFIG_DEMO_TIMING,
  WF_CONSOLE_MODE_STORAGE_KEY,
} from './wf-demo-helpers';
import { WF } from '../../../shared/selectors';

function mockSidebarBridge(): { collapse: ReturnType<typeof vi.fn>; expand: ReturnType<typeof vi.fn> } {
  const collapse = vi.fn();
  const expand = vi.fn();
  (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar = collapse;
  (window as unknown as Record<string, unknown>).__demoExpandAppSidebar = expand;
  return { collapse, expand };
}

describe('wf-demo-helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    delete (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar;
    delete (window as unknown as Record<string, unknown>).__demoExpandAppSidebar;
    delete (window as unknown as Record<string, unknown>).__wfOpenNodeConfig;
    delete (window as unknown as Record<string, unknown>).__wfDeselectAll;
    delete (window as unknown as Record<string, unknown>).__wfSetConsoleFloatLayout;
    localStorage.removeItem(WF_CONSOLE_MODE_STORAGE_KEY);
  });

  it('openWfConsoleIfClosed uses floating mode on the left before opening', async () => {
    document.body.innerHTML = `
      <div class="wf-console-badge"></div>
      <select class="wf-console-mode-select">
        <option value="docked">Bottom</option>
        <option value="floating">Floating</option>
      </select>
    `;
    const layoutSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfSetConsoleFloatLayout = layoutSpy;
    const badge = document.querySelector<HTMLElement>('.wf-console-badge')!;
    badge.addEventListener('click', () => {
      const panel = document.createElement('div');
      panel.className = 'wf-console-panel';
      document.body.appendChild(panel);
    });
    const select = document.querySelector<HTMLSelectElement>('.wf-console-mode-select')!;
    select.value = 'docked';
    localStorage.setItem(WF_CONSOLE_MODE_STORAGE_KEY, 'docked');
    const ctx = makeCtx();
    await openWfConsoleIfClosed(ctx);
    expect(document.querySelector('.wf-console-panel')).toBeTruthy();
    expect(select.value).toBe('floating');
    expect(localStorage.getItem(WF_CONSOLE_MODE_STORAGE_KEY)).toBe('floating');
    expect(layoutSpy).toHaveBeenCalled();
  });

  it('clickWfDebugStepButtons clicks each visible Step control', async () => {
    const ctx = makeCtx();
    let remaining = 2;
    const btn = document.createElement('button');
    btn.className = 'wf-debug-step-btn';
    document.body.appendChild(btn);
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === WF.DEBUG_STEP_BTN) {
        remaining--;
        if (remaining <= 0) btn.remove();
      }
    });
    const count = await clickWfDebugStepButtons(ctx, 4);
    expect(count).toBe(2);
    expect(ctx.click).toHaveBeenCalledWith(WF.DEBUG_STEP_BTN);
  });

  it('openWfConsoleIfClosed clicks badge when panel absent', async () => {
    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    const clickSpy = vi.fn();
    badge.addEventListener('click', () => {
      const panel = document.createElement('div');
      panel.className = 'wf-console-panel';
      document.body.appendChild(panel);
      clickSpy();
    });
    document.body.appendChild(badge);
    const ctx = makeCtx();
    await openWfConsoleIfClosed(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(document.querySelector('.wf-console-panel')).toBeTruthy();
  });

  it('closeWfConsoleIfOpen clicks badge when panel present', async () => {
    const panel = document.createElement('div');
    panel.className = 'wf-console-panel';
    document.body.appendChild(panel);
    const badge = document.createElement('button');
    badge.className = 'wf-console-badge';
    badge.addEventListener('click', () => panel.remove());
    document.body.appendChild(badge);
    const ctx = makeCtx();
    await closeWfConsoleIfOpen(ctx);
    expect(document.querySelector('.wf-console-panel')).toBeNull();
  });

  it('openWfNodeConfigModal dblclicks node by data-id when bridge missing', async () => {
    document.body.innerHTML = `<div class="react-flow__node" data-id="node-99"></div>`;
    const node = document.querySelector<HTMLElement>('.react-flow__node')!;
    const dispatchSpy = vi.spyOn(node, 'dispatchEvent');
    const ctx = makeCtx();
    await openWfNodeConfigModal(ctx, { nodeId: 'node-99' });
    expect(dispatchSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(WF_CONFIG_DEMO_TIMING.modalOpen);
  });

  it('openWfNodeConfigModal uses bridge when available', async () => {
    const openSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = openSpy;
    document.body.innerHTML = `
      <div class="react-flow__node" data-id="node-1">
        <div data-testid="gql-canvas-query-node"></div>
      </div>
    `;
    const ctx = makeCtx();
    await openWfNodeConfigModal(ctx, { canvasTestId: '[data-testid="gql-canvas-query-node"]' });
    expect(openSpy).toHaveBeenCalledWith('node-1');
    expect(ctx.delay).toHaveBeenCalledWith(WF_CONFIG_DEMO_TIMING.modalOpen);
  });

  it('fillWfConfigField fills and pauses for reading', async () => {
    document.body.innerHTML = '<input data-testid="field" />';
    const ctx = makeCtx();
    await fillWfConfigField(ctx, '[data-testid="field"]', 'hello');
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="field"]', 8000);
    expect(ctx.fill).toHaveBeenCalledWith('[data-testid="field"]', 'hello');
    expect(ctx.delay).toHaveBeenCalledWith(WF_CONFIG_DEMO_TIMING.afterFill);
  });

  it('pauseWfConfigSection uses sectionBreak timing', async () => {
    const ctx = makeCtx();
    await pauseWfConfigSection(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(WF_CONFIG_DEMO_TIMING.sectionBreak);
  });

  it('clickWfConfigAddRow clicks add, waits for row, then pauses', async () => {
    document.body.innerHTML = `
      <button data-testid="add">+ Add</button>
      <input data-testid="row" />
    `;
    const ctx = makeCtx();
    await clickWfConfigAddRow(ctx, '[data-testid="add"]', '[data-testid="row"]');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="add"]');
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="row"]', 8000);
    expect(ctx.delay).toHaveBeenCalledWith(WF_CONFIG_DEMO_TIMING.afterSubFormOpen);
  });

  it('pauseWfConfigDemo uses centralized timing keys', async () => {
    const ctx = makeCtx();
    await pauseWfConfigDemo(ctx, 'tabSwitch');
    expect(ctx.delay).toHaveBeenCalledWith(WF_CONFIG_DEMO_TIMING.tabSwitch);
  });

  it('clickWfConfigTab clicks gql-wf-subtab inside panel', async () => {
    document.body.innerHTML = `
      <div data-testid="gql-wf-assert-panel">
        <button type="button" class="gql-wf-subtab"><span>Source</span></button>
        <button type="button" class="gql-wf-subtab active"><span>Assertions</span></button>
      </div>
    `;
    const sourceTab = document.querySelector<HTMLButtonElement>('.gql-wf-subtab')!;
    const clickSpy = vi.spyOn(sourceTab, 'click');
    const ctx = makeCtx();
    await clickWfConfigTab(ctx, '[data-testid="gql-wf-assert-panel"]', 'Source');
    expect(clickSpy).toHaveBeenCalled();
  });

  it('saveAndCloseWfConfigModal closes config modal after save', async () => {
    document.body.innerHTML = `
      <div class="wf-config-modal">
        <div class="wf-config-modal-footer-actions">
          <button class="btn-ghost">Close</button>
          <button class="btn-primary">Save</button>
        </div>
      </div>
    `;
    const ctx = makeCtx();
    const ok = await saveAndCloseWfConfigModal(ctx);
    expect(ok).toBe(true);
    expect(ctx.click).toHaveBeenCalledWith(WF.CFG_SAVE);
  });

  it('saveAndCloseWfConfigModal skips save and close when Save is disabled', async () => {
    document.body.innerHTML = `
      <div class="wf-config-modal">
        <div class="wf-config-modal-footer-actions">
          <button class="btn-ghost">Close</button>
          <button class="btn-primary" disabled>Save</button>
        </div>
      </div>
    `;
    const ctx = makeCtx();
    const ok = await saveAndCloseWfConfigModal(ctx);
    expect(ok).toBe(false);
    expect(ctx.click).not.toHaveBeenCalledWith(WF.CFG_SAVE);
    expect(document.querySelector('.wf-config-modal')).not.toBeNull();
  });

  it('isWfConfigTabActive detects gql-wf-subtab active state', () => {
    document.body.innerHTML = `
      <div data-testid="panel">
        <button class="gql-wf-subtab active">Stop</button>
        <button class="gql-wf-subtab">Output</button>
      </div>
    `;
    expect(isWfConfigTabActive('[data-testid="panel"]', 'Stop')).toBe(true);
    expect(isWfConfigTabActive('[data-testid="panel"]', 'Output')).toBe(false);
  });

  it('clickWfConfigTab skips click when tab is already active', async () => {
    document.body.innerHTML = `
      <div data-testid="panel">
        <button class="gql-wf-subtab active">Stop</button>
      </div>
    `;
    const tab = document.querySelector<HTMLButtonElement>('.gql-wf-subtab')!;
    const clickSpy = vi.spyOn(tab, 'click');
    const ctx = makeCtx();
    await clickWfConfigTab(ctx, '[data-testid="panel"]', 'Stop');
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('ensureWfNodeConfigModalOpen skips bridge when modal and panel already visible', async () => {
    document.body.innerHTML = `
      <div class="wf-config-modal">
        <div data-testid="gql-wf-subscription-panel"></div>
      </div>
    `;
    const openSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = openSpy;
    const ctx = makeCtx();
    await ensureWfNodeConfigModalOpen(ctx, {
      nodeId: 'gql19-watch-status',
      panelSelector: '[data-testid="gql-wf-subscription-panel"]',
    });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('closeWfConfigModalIfOpen dismisses modal when present', async () => {
    document.body.innerHTML = `
      <div class="wf-config-modal">
        <div class="wf-config-modal-footer-actions">
          <button class="btn-ghost">Close</button>
        </div>
      </div>
    `;
    const closeBtn = document.querySelector<HTMLButtonElement>('.btn-ghost')!;
    closeBtn.addEventListener('click', () => document.querySelector('.wf-config-modal')?.remove());
    const ctx = makeCtx();
    await closeWfConfigModalIfOpen(ctx);
    expect(document.querySelector('.wf-config-modal')).toBeNull();
  });

  it('collapseWfDemoAppSidebar calls demo bridge', async () => {
    const { collapse } = mockSidebarBridge();
    const ctx = makeCtx();
    await collapseWfDemoAppSidebar(ctx);
    expect(collapse).toHaveBeenCalled();
  });

  it('selectWorkflowFromAppSidebar expands, clicks match, then collapses', async () => {
    const { collapse, expand } = mockSidebarBridge();
    document.body.innerHTML = '<div class="wf-sidebar-item">GraphQL User CRUD Demo</div>';
    const item = document.querySelector<HTMLElement>('.wf-sidebar-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    const ctx = makeCtx();
    const found = await selectWorkflowFromAppSidebar(ctx, 'GraphQL User CRUD Demo');
    expect(found).toBe(true);
    expect(expand).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(collapse).toHaveBeenCalled();
  });

  it('selectWorkflowFromAppSidebar skips item click when no match', async () => {
    const { collapse, expand } = mockSidebarBridge();
    document.body.innerHTML = '<div class="wf-sidebar-item">Other Workflow</div>';
    const item = document.querySelector<HTMLElement>('.wf-sidebar-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    const ctx = makeCtx();
    const found = await selectWorkflowFromAppSidebar(ctx, 'Missing');
    expect(found).toBe(false);
    expect(expand).toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
    expect(collapse).toHaveBeenCalled();
  });
});
