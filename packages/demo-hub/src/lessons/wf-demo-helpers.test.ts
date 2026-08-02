/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { makeCtx } from './protocols/ws-test-utils';
import {
  clickWfConfigAddRow,
  clickWfConfigControl,
  clickWfConfigTab,
  clickWfDebugStepButtons,
  closeWfConfigModalIfOpen,
  closeWfConsoleIfOpen,
  cleanupWorkflowDemoRunUi,
  collapseWfDemoAppSidebar,
  buildBlankLessonWorkflow,
  createBlankWorkflowFromSidebar,
  ensureLessonBlankWorkflow,
  ensureLessonWorkflowShown,
  isLessonWorkflowDisplayed,
  waitForLessonWorkflowSelected,
  resetWorkflowRunStateQuiet,
  ensureWfNodeConfigModalOpen,
  fillWfConfigField,
  getWfConfigDemoTiming,
  isWfConfigTabActive,
  openWfConsoleIfClosed,
  openWfNodeConfigModal,
  pauseWfConfigDemo,
  pauseWfConfigSection,
  revealPaletteBlock,
  saveAndCloseWfConfigModal,
  selectWfConfigOption,
  scrollWfConfigFieldIntoView,
  scrollWfConfigModalToTop,
  selectWorkflowFromAppSidebar,
  startWfDebugRun,
  setWfConfigDemoTiming,
  waitForWfConfigPanel,
  WF_CONFIG_DEMO_TIMING,
  WF_CONFIG_DEMO_TIMING_BRISK,
  WF_CONSOLE_MODE_STORAGE_KEY,
} from './wf-demo-helpers';
import { WF } from '@shared/selectors';

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
    setWfConfigDemoTiming(null);
    delete (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar;
    delete (window as unknown as Record<string, unknown>).__demoExpandAppSidebar;
    delete (window as unknown as Record<string, unknown>).__wfOpenNodeConfig;
    delete (window as unknown as Record<string, unknown>).__wfDeselectAll;
    delete (window as unknown as Record<string, unknown>).__wfResetRunState;
    delete (window as unknown as Record<string, unknown>).__wfSetConsoleFloatLayout;
    delete (window as unknown as Record<string, unknown>).__wfGetSelectedName;
    delete (window as unknown as Record<string, unknown>).__wfGetWorkflowByName;
    delete (window as unknown as Record<string, unknown>).__wfSelectByName;
    localStorage.removeItem(WF_CONSOLE_MODE_STORAGE_KEY);
  });

  describe('ensureLessonWorkflowShown', () => {
    const win = () => window as unknown as Record<string, unknown>;

    it('returns "ready" and does not re-select when this lesson\'s workflow is already shown', async () => {
      document.body.innerHTML = '<div class="wf-canvas-area"></div>';
      win().__wfGetSelectedName = () => 'Variables Demo';
      const select = vi.fn(() => true);
      win().__wfSelectByName = select;

      const result = await ensureLessonWorkflowShown(makeCtx(), 'Variables Demo');

      expect(result).toBe('ready');
      expect(select).not.toHaveBeenCalled();
    });

    it('returns "missing" when a canvas is shown but selected name is unknown and workflow is absent', async () => {
      document.body.innerHTML = '<div class="wf-canvas-area"></div>';
      // no __wfGetSelectedName bridge → undefined — do not treat foreign/unknown canvas as ready
      win().__wfGetWorkflowByName = () => null;
      const select = vi.fn(() => true);
      win().__wfSelectByName = select;

      const result = await ensureLessonWorkflowShown(makeCtx(), 'Variables Demo');

      expect(result).toBe('missing');
      expect(select).not.toHaveBeenCalled();
    });

    it('switches to this lesson\'s workflow when a foreign one is displayed', async () => {
      document.body.innerHTML = '<div class="wf-canvas-area"></div>';
      let selected = 'Conditional Demo';
      win().__wfGetSelectedName = () => selected;
      win().__wfGetWorkflowByName = (name: string) =>
        name === 'Variables Demo' ? { id: 'v1', name } : null;
      const select = vi.fn((name: string) => {
        selected = name;
        return true;
      });
      win().__wfSelectByName = select;

      const result = await ensureLessonWorkflowShown(makeCtx(), 'Variables Demo');

      expect(result).toBe('selected');
      expect(select).toHaveBeenCalledWith('Variables Demo');
      expect(selected).toBe('Variables Demo');
    });

    it('returns "missing" when a foreign workflow is displayed and ours is not in the store', async () => {
      document.body.innerHTML = '<div class="wf-canvas-area"></div>';
      win().__wfGetSelectedName = () => 'Conditional Demo';
      win().__wfGetWorkflowByName = () => null;
      const select = vi.fn(() => true);
      win().__wfSelectByName = select;

      const result = await ensureLessonWorkflowShown(makeCtx(), 'Variables Demo');

      expect(result).toBe('missing');
      expect(select).not.toHaveBeenCalled();
    });

    it('returns "missing" when no canvas is shown and the workflow does not exist', async () => {
      win().__wfGetWorkflowByName = () => null;

      const result = await ensureLessonWorkflowShown(makeCtx(), 'Variables Demo');

      expect(result).toBe('missing');
    });
  });

  describe('ensureLessonBlankWorkflow', () => {
    const win = () => window as unknown as Record<string, unknown>;

    beforeEach(() => {
      document.body.innerHTML = '';
      delete win().__wfGetSelectedName;
      delete win().__wfGetWorkflowByName;
      delete win().__wfSelectByName;
      delete win().__demoExpandAppSidebar;
      delete win().__demoCollapseAppSidebar;
    });

    it('skips create when lesson workflow is already selected', async () => {
      document.body.innerHTML = '<div class="wf-canvas-area"></div>';
      win().__wfGetSelectedName = () => 'Echo';
      const ctx = makeCtx();
      await ensureLessonBlankWorkflow(ctx, 'Echo');
      expect(ctx.click).not.toHaveBeenCalled();
    });

    it('seeds a blank workflow when a foreign workflow is open (quiet Preparing path)', async () => {
      document.body.innerHTML = `
        <div class="wf-canvas-area"></div>
        <button data-testid="wf-toolbar-select"><span class="wft-dropdown-text">Other</span></button>
      `;
      let selected = 'Other';
      const store = new Map<string, { name: string }>();
      win().__wfGetSelectedName = () => selected;
      win().__wfGetWorkflowByName = (name: string) => store.get(name) ?? null;
      win().__wfSelectByName = (name: string) => { selected = name; return true; };
      win().__wfInsertWorkflow = (wf: { name: string }) => { store.set(wf.name, wf); };
      win().__wfWorkflowsLoaded = true;
      win().__wfDeleteByName = (name: string) => { store.delete(name); };
      win().__demoExpandAppSidebar = vi.fn();
      win().__demoCollapseAppSidebar = vi.fn();
      const ctx = makeCtx();
      await ensureLessonBlankWorkflow(ctx, 'Echo');
      // Quiet ensure must seed — not walk the slow sidebar + New UI.
      expect(ctx.click).not.toHaveBeenCalled();
      expect(store.has('Echo')).toBe(true);
      expect(selected).toBe('Echo');
    });
  });

  it('isLessonWorkflowDisplayed reads toolbar label when bridge lags', () => {
    document.body.innerHTML =
      '<button data-testid="wf-toolbar-select"><span class="wft-dropdown-text">WS Echo Demo</span></button>';
    expect(isLessonWorkflowDisplayed('WS Echo Demo')).toBe(true);
    expect(isLessonWorkflowDisplayed('Other')).toBe(false);
  });

  it('buildBlankLessonWorkflow is Start-only with the given name', () => {
    const wf = buildBlankLessonWorkflow('Echo');
    expect(wf.name).toBe('Echo');
    expect((wf.nodes as Array<{ type: string }>)).toHaveLength(1);
    expect((wf.nodes as Array<{ type: string }>)[0]?.type).toBe('start');
  });

  it('createBlankWorkflowFromSidebar walks + New → Blank → Create and requires selection', async () => {
    document.body.innerHTML = `
      <button data-testid="wf-sidebar-new-btn"></button>
      <div class="wf-new-dropdown"></div>
      <button data-testid="wf-new-blank-item"></button>
      <input data-testid="wf-create-input" />
      <button data-testid="wf-create-ok"></button>
      <div class="wf-canvas-area"></div>
    `;
    for (const el of document.querySelectorAll('button, input')) {
      (el as HTMLElement).getBoundingClientRect = () =>
        ({ width: 40, height: 20, top: 0, left: 0, bottom: 20, right: 40, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    }
    let selected = 'Foreign';
    (window as unknown as Record<string, unknown>).__demoExpandAppSidebar = vi.fn();
    (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar = vi.fn();
    (window as unknown as Record<string, unknown>).__wfGetSelectedName = () => selected;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => null;
    (window as unknown as Record<string, unknown>).__wfSelectByName = (name: string) => {
      selected = name;
      return true;
    };
    const ctx = makeCtx();
    ctx.fill.mockImplementation(async (_sel: string, value: string) => {
      const input = document.querySelector<HTMLInputElement>('[data-testid="wf-create-input"]');
      if (input) input.value = value;
    });
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel.includes('wf-create-ok')) selected = 'My Flow';
    });
    const ok = await createBlankWorkflowFromSidebar(ctx, 'My Flow');
    expect(ok).toBe(true);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="wf-sidebar-new-btn"]');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="wf-new-blank-item"]');
    expect(ctx.fill).toHaveBeenCalledWith('[data-testid="wf-create-input"]', 'My Flow');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="wf-create-ok"]');
  });

  it('createBlankWorkflowFromSidebar returns false when + New is not available', async () => {
    document.body.innerHTML = '<div class="wf-canvas-area"></div>';
    (window as unknown as Record<string, unknown>).__demoExpandAppSidebar = vi.fn();
    (window as unknown as Record<string, unknown>).__demoCollapseAppSidebar = vi.fn();
    (window as unknown as Record<string, unknown>).__wfGetSelectedName = () => 'SLA Pipeline';
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => null;
    const ctx = makeCtx();
    const ok = await createBlankWorkflowFromSidebar(ctx, 'My Flow');
    expect(ok).toBe(false);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('waitForLessonWorkflowSelected selects from store when bridge name differs', async () => {
    let selected = 'Other';
    (window as unknown as Record<string, unknown>).__wfGetSelectedName = () => selected;
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === 'Echo' ? { name } : null;
    (window as unknown as Record<string, unknown>).__wfSelectByName = (name: string) => {
      selected = name;
      return true;
    };
    const ctx = makeCtx();
    const ok = await waitForLessonWorkflowSelected(ctx, 'Echo', 1000);
    expect(ok).toBe(true);
    expect(selected).toBe('Echo');
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

  it('resetWorkflowRunStateQuiet uses bridge when mounted', () => {
    const spy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfResetRunState = spy;
    expect(resetWorkflowRunStateQuiet()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('cleanupWorkflowDemoRunUi closes console and dismisses exec strip', async () => {
    document.body.innerHTML = `
      <div class="wf-exec-strip"><button class="wf-exec-strip-close"></button></div>
      <div class="wf-console-panel"></div>
      <button class="wf-console-badge"></button>
    `;
    const stripClose = document.querySelector<HTMLElement>('.wf-exec-strip-close')!;
    stripClose.addEventListener('click', () => stripClose.closest('.wf-exec-strip')?.remove());
    const badge = document.querySelector<HTMLElement>('.wf-console-badge')!;
    badge.addEventListener('click', () => document.querySelector('.wf-console-panel')?.remove());
    const resetSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfResetRunState = resetSpy;
    const ctx = makeCtx();
    await cleanupWorkflowDemoRunUi(ctx);
    expect(resetSpy).toHaveBeenCalled();
    expect(document.querySelector('.wf-exec-strip')).toBeNull();
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

  it('fillWfConfigField quietly fills (no ripple) and pauses for reading', async () => {
    document.body.innerHTML = '<input data-testid="field" />';
    const ctx = makeCtx();
    await fillWfConfigField(ctx, '[data-testid="field"]', 'hello');
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="field"]', 8000);
    // Quiet fill — ctx.fill would show a click ripple inside the highlight.
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLInputElement>('[data-testid="field"]')!.value).toBe('hello');
    expect(ctx.delay).toHaveBeenCalledWith(WF_CONFIG_DEMO_TIMING.afterFill);
  });

  it('scrollWfConfigModalToTop scrolls the modal viewport to 0', async () => {
    document.body.innerHTML = '<div class="wf-config-modal-scroll"></div>';
    const viewport = document.querySelector<HTMLElement>('.wf-config-modal-scroll')!;
    viewport.scrollTo = vi.fn();
    const ctx = makeCtx();
    await scrollWfConfigModalToTop(ctx);
    expect(viewport.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('scrollWfConfigFieldIntoView scrolls inside the modal viewport', async () => {
    document.body.innerHTML = `
      <div class="wf-config-modal-scroll" style="height: 100px; overflow: auto;">
        <input data-testid="field" />
      </div>
    `;
    const viewport = document.querySelector<HTMLElement>('.wf-config-modal-scroll')!;
    const field = document.querySelector<HTMLElement>('[data-testid="field"]')!;
    viewport.scrollTo = vi.fn();
    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue({
      top: 200, left: 0, width: 100, height: 30,
      right: 100, bottom: 230, x: 0, y: 200, toJSON: () => ({}),
    });
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
      top: 0, left: 0, width: 300, height: 100,
      right: 300, bottom: 100, x: 0, y: 0, toJSON: () => ({}),
    });
    Object.defineProperty(viewport, 'scrollTop', { value: 0, configurable: true });
    Object.defineProperty(viewport, 'scrollHeight', { value: 400, configurable: true });
    Object.defineProperty(viewport, 'clientHeight', { value: 100, configurable: true });
    const ctx = makeCtx();
    await scrollWfConfigFieldIntoView(ctx, '[data-testid="field"]');
    expect(viewport.scrollTo).toHaveBeenCalled();
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

  it('setWfConfigDemoTiming switches pause durations to brisk', async () => {
    setWfConfigDemoTiming(WF_CONFIG_DEMO_TIMING_BRISK);
    const ctx = makeCtx();
    await pauseWfConfigDemo(ctx, 'afterFill');
    expect(ctx.delay).toHaveBeenCalledWith(WF_CONFIG_DEMO_TIMING_BRISK.afterFill);
  });

  it('scroll settle uses shorter delay under brisk timing', async () => {
    setWfConfigDemoTiming(WF_CONFIG_DEMO_TIMING_BRISK);
    document.body.innerHTML = `
      <div class="wf-config-modal-scroll" style="overflow:auto;height:100px">
        <div data-testid="panel"></div>
      </div>
    `;
    const viewport = document.querySelector<HTMLElement>('.wf-config-modal-scroll')!;
    viewport.scrollTo = vi.fn();
    const ctx = makeCtx();
    await scrollWfConfigModalToTop(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(250);
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

  it('selectWorkflowFromAppSidebar skips expand/collapse when item already active', async () => {
    const { collapse, expand } = mockSidebarBridge();
    document.body.innerHTML =
      '<div class="wf-sidebar-item active"><span class="wf-sidebar-item-name">GraphQL User CRUD Demo</span></div>';
    const item = document.querySelector<HTMLElement>('.wf-sidebar-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) =>
      name === 'GraphQL User CRUD Demo' ? { name } : null;
    const ctx = makeCtx();
    const found = await selectWorkflowFromAppSidebar(ctx, 'GraphQL User CRUD Demo');
    expect(found).toBe(true);
    expect(expand).not.toHaveBeenCalled();
    expect(collapse).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('selectWorkflowFromAppSidebar expands, clicks exact name match, then collapses', async () => {
    const { collapse, expand } = mockSidebarBridge();
    document.body.innerHTML =
      '<div class="wf-sidebar-item"><span class="wf-sidebar-item-name">GraphQL User CRUD Demo</span></div>';
    const item = document.querySelector<HTMLElement>('.wf-sidebar-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    const ctx = makeCtx();
    const found = await selectWorkflowFromAppSidebar(ctx, 'GraphQL User CRUD Demo');
    expect(found).toBe(true);
    expect(expand).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(collapse).toHaveBeenCalled();
  });

  it('selectWorkflowFromAppSidebar skips partial name matches', async () => {
    const { collapse, expand } = mockSidebarBridge();
    document.body.innerHTML =
      '<div class="wf-sidebar-item"><span class="wf-sidebar-item-name">GraphQL Latency Demo</span></div>';
    const item = document.querySelector<HTMLElement>('.wf-sidebar-item')!;
    const clickSpy = vi.spyOn(item, 'click');
    (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = () => null;
    const ctx = makeCtx();
    const found = await selectWorkflowFromAppSidebar(ctx, 'GraphQL User CRUD Demo');
    expect(found).toBe(false);
    expect(expand).toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
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

  it('exposes and resets active timing table', () => {
    setWfConfigDemoTiming(WF_CONFIG_DEMO_TIMING_BRISK);
    expect(getWfConfigDemoTiming()).toEqual(WF_CONFIG_DEMO_TIMING_BRISK);
    setWfConfigDemoTiming(null);
    expect(getWfConfigDemoTiming()).toEqual(WF_CONFIG_DEMO_TIMING);
  });

  it('openWfNodeConfigModal resolves nodeId from nodeSelector path', async () => {
    document.body.innerHTML = '<div class="react-flow__node" data-id="node-7"><div class="node-hit"></div></div>';
    const openSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = openSpy;
    const ctx = makeCtx();
    await openWfNodeConfigModal(ctx, { nodeSelector: '.node-hit' });
    expect(openSpy).toHaveBeenCalledWith('node-7');
  });

  it('scrollWfConfigModalToTop no-ops when viewport is missing', async () => {
    const ctx = makeCtx();
    await scrollWfConfigModalToTop(ctx);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('scrollWfConfigFieldIntoView no-ops when selector does not resolve', async () => {
    const ctx = makeCtx();
    await scrollWfConfigFieldIntoView(ctx, '[data-testid="missing"]');
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('waitForWfConfigPanel waits with default timeout and recenters', async () => {
    document.body.innerHTML = '<div class="wf-config-modal-scroll"></div><div data-testid="panel"></div>';
    const viewport = document.querySelector<HTMLElement>('.wf-config-modal-scroll')!;
    viewport.scrollTo = vi.fn();
    const ctx = makeCtx();
    await waitForWfConfigPanel(ctx, '[data-testid="panel"]');
    expect(ctx.waitFor).toHaveBeenCalledWith('[data-testid="panel"]', 8000);
    expect(viewport.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('selectWfConfigOption selects and applies pacing delay', async () => {
    document.body.innerHTML = '<select data-testid="pick"><option value="one">One</option></select>';
    const ctx = makeCtx();
    await selectWfConfigOption(ctx, '[data-testid="pick"]', 'one');
    expect(ctx.selectOption).toHaveBeenCalledWith('[data-testid="pick"]', 'one');
    expect(ctx.delay).toHaveBeenCalledWith(WF_CONFIG_DEMO_TIMING.afterSelect);
  });

  it('clickWfConfigControl clicks selector and applies pacing delay', async () => {
    document.body.innerHTML = '<button data-testid="ctl">ctl</button>';
    const ctx = makeCtx();
    await clickWfConfigControl(ctx, '[data-testid="ctl"]');
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="ctl"]');
    expect(ctx.delay).toHaveBeenCalledWith(WF_CONFIG_DEMO_TIMING.afterClick);
  });

  it('resetWorkflowRunStateQuiet uses DOM fallback when bridge is unavailable', () => {
    document.body.innerHTML = `
      <button class="wf-toolbar-reset-btn"></button>
      <button class="wf-console-action-btn" title="Clear console"></button>
      <button class="wf-exec-strip-close"></button>
    `;
    const resetBtn = document.querySelector<HTMLButtonElement>('.wf-toolbar-reset-btn')!;
    const clearBtn = document.querySelector<HTMLButtonElement>('.wf-console-action-btn[title="Clear console"]')!;
    const stripClose = document.querySelector<HTMLButtonElement>('.wf-exec-strip-close')!;
    const resetSpy = vi.spyOn(resetBtn, 'click');
    const clearSpy = vi.spyOn(clearBtn, 'click');
    const closeSpy = vi.spyOn(stripClose, 'click');
    expect(resetWorkflowRunStateQuiet()).toBe(false);
    expect(resetSpy).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('isWfConfigTabActive returns false when panel exists but tab label is missing', () => {
    document.body.innerHTML = '<div data-testid="panel"><button class="gql-wf-subtab">Other</button></div>';
    expect(isWfConfigTabActive('[data-testid="panel"]', 'Missing Label')).toBe(false);
  });

  it('isWfConfigTabActive returns false when panel is missing', () => {
    expect(isWfConfigTabActive('[data-testid="no-panel"]', 'Stop')).toBe(false);
  });

  it('closeWfConsoleIfOpen returns early when panel is absent', async () => {
    document.body.innerHTML = '<button class="wf-console-badge"></button>';
    const badge = document.querySelector<HTMLElement>('.wf-console-badge')!;
    const clickSpy = vi.spyOn(badge, 'click');
    const ctx = makeCtx();
    await closeWfConsoleIfOpen(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('closeWfConsoleIfOpen no-ops when panel exists but badge is missing', async () => {
    document.body.innerHTML = '<div class="wf-console-panel"></div>';
    const ctx = makeCtx();
    await closeWfConsoleIfOpen(ctx);
    expect(document.querySelector('.wf-console-panel')).not.toBeNull();
  });

  it('startWfDebugRun navigates and triggers debug button', async () => {
    const ctx = makeCtx();
    await startWfDebugRun(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');
    expect(ctx.click).toHaveBeenCalledWith(WF.DEBUG_BTN);
  });

  it('openWfConsoleIfClosed keeps existing panel and still applies floating layout', async () => {
    document.body.innerHTML = `
      <div class="wf-console-panel"></div>
      <select class="wf-console-mode-select">
        <option value="docked">Bottom</option>
        <option value="floating">Floating</option>
      </select>
    `;
    const layoutSpy = vi.fn();
    (window as unknown as Record<string, unknown>).__wfSetConsoleFloatLayout = layoutSpy;
    const ctx = makeCtx();
    await openWfConsoleIfClosed(ctx);
    expect(layoutSpy).toHaveBeenCalled();
    expect(localStorage.getItem(WF_CONSOLE_MODE_STORAGE_KEY)).toBe('floating');
  });

  it('clickWfDebugStepButtons breaks out when waitFor rejects', async () => {
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockRejectedValueOnce(new Error('timed out'));
    const count = await clickWfDebugStepButtons(ctx, 3);
    expect(count).toBe(0);
  });

  it('ensureWfNodeConfigModalOpen closes stale modal before opening target', async () => {
    document.body.innerHTML = `
      <div class="wf-config-modal">
        <div class="wf-config-modal-footer-actions">
          <button class="btn-ghost">Close</button>
        </div>
      </div>
    `;
    const closeBtn = document.querySelector<HTMLButtonElement>('.btn-ghost')!;
    const closeSpy = vi.spyOn(closeBtn, 'click');
    closeBtn.addEventListener('click', () => document.querySelector('.wf-config-modal')?.remove());
    const openSpy = vi.fn(() => true);
    (window as unknown as Record<string, unknown>).__wfOpenNodeConfig = openSpy;
    const ctx = makeCtx();
    await ensureWfNodeConfigModalOpen(ctx, {
      nodeId: 'node-2',
      panelSelector: '[data-testid="target-panel"]',
    });
    expect(closeSpy).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith('node-2');
  });

  it('clickWfConfigTab returns when panel or target tab is missing', async () => {
    const ctx = makeCtx();
    await clickWfConfigTab(ctx, '[data-testid="missing-panel"]', 'Stop');
    document.body.innerHTML = '<div data-testid="panel"><button class="gql-wf-subtab">Other</button></div>';
    await clickWfConfigTab(ctx, '[data-testid="panel"]', 'Stop');
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('closeWfConfigModalIfOpen returns early when modal is absent', async () => {
    const ctx = makeCtx();
    await closeWfConfigModalIfOpen(ctx);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('closeWfConfigModalIfOpen no-ops when modal has no close button', async () => {
    document.body.innerHTML = '<div class="wf-config-modal"></div>';
    const ctx = makeCtx();
    await closeWfConfigModalIfOpen(ctx);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('saveAndCloseWfConfigModal returns true when save exists outside modal shell', async () => {
    document.body.innerHTML = '<div class="wf-config-modal-footer-actions"><button class="btn-primary">Save</button></div>';
    const ctx = makeCtx();
    const ok = await saveAndCloseWfConfigModal(ctx);
    expect(ok).toBe(true);
    expect(ctx.click).toHaveBeenCalledWith(WF.CFG_SAVE);
  });
});

describe('revealPaletteBlock', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  function renderPaletteBlock(type: string): HTMLElement {
    const block = document.createElement('div');
    block.className = `wf-palette-block wf-palette-block-${type}`;
    block.scrollIntoView = vi.fn();
    document.body.appendChild(block);
    return block;
  }

  function renderBlocksTab(active = true): void {
    const tab = document.createElement('button');
    tab.setAttribute('data-testid', 'wf-palette-tab-blocks');
    if (active) tab.classList.add('active');
    document.body.appendChild(tab);
  }

  function renderRailButton(categoryId: string): HTMLElement {
    const btn = document.createElement('button');
    btn.className = 'wf-palette-rail-btn';
    btn.setAttribute('data-rail', categoryId);
    document.body.appendChild(btn);
    return btn;
  }

  it('returns element immediately when block is already in DOM', async () => {
    renderBlocksTab();
    const block = renderPaletteBlock('http');
    const ctx = makeCtx();
    const result = await revealPaletteBlock(ctx, WF.PAL_HTTP);
    expect(result).toBe(block);
    expect(block.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('returns null for unknown block type', async () => {
    renderBlocksTab();
    const ctx = makeCtx();
    const result = await revealPaletteBlock(ctx, '.wf-palette-block-nonexistent');
    expect(result).toBeNull();
  });

  it('clicks rail button to reveal a block in a different category', async () => {
    renderBlocksTab();
    const railBtn = renderRailButton('logic');
    const ctx = makeCtx();

    const origClick = railBtn.click.bind(railBtn);
    const clickSpy = vi.spyOn(railBtn, 'click').mockImplementation(() => {
      origClick();
      const block = renderPaletteBlock('condition');
      block.scrollIntoView = vi.fn();
    });

    const result = await revealPaletteBlock(ctx, WF.PAL_CONDITION);
    expect(clickSpy).toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result?.classList.contains('wf-palette-block-condition')).toBe(true);
  });

  it('skips delays in quiet mode', async () => {
    renderBlocksTab();
    renderPaletteBlock('http');
    const ctx = makeCtx();
    await revealPaletteBlock(ctx, WF.PAL_HTTP, { quiet: true });
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('scrolls block into view in quiet mode', async () => {
    renderBlocksTab();
    const block = renderPaletteBlock('http');
    const ctx = makeCtx();
    await revealPaletteBlock(ctx, WF.PAL_HTTP, { quiet: true });
    expect(block.scrollIntoView).toHaveBeenCalled();
  });

  it('handles actions subgroup blocks', async () => {
    renderBlocksTab();
    const block = renderPaletteBlock('kafkaProduce');
    const ctx = makeCtx();
    const result = await revealPaletteBlock(ctx, WF.PAL_KAFKA_PRODUCE);
    expect(result).toBe(block);
  });

  it('handles graphqlAssert in logic category (no subGroup)', async () => {
    renderBlocksTab();
    const block = renderPaletteBlock('graphqlAssert');
    const ctx = makeCtx();
    const result = await revealPaletteBlock(ctx, WF.PAL_GQL_ASSERT);
    expect(result).toBe(block);
  });

  it('handles grpcAssert in logic category (no subGroup)', async () => {
    renderBlocksTab();
    const block = renderPaletteBlock('grpcAssert');
    const ctx = makeCtx();
    const result = await revealPaletteBlock(ctx, WF.PAL_GRPC_ASSERT);
    expect(result).toBe(block);
  });

  it('clears active search filter before finding block', async () => {
    renderBlocksTab();
    // Simulate an active search — clear button only exists when search is active
    const clearBtn = document.createElement('button');
    clearBtn.className = 'wf-palette-search-clear';
    const clickSpy = vi.fn(() => {
      // Simulate React clearing the search: remove the clear button
      clearBtn.remove();
    });
    clearBtn.onclick = clickSpy;
    document.body.appendChild(clearBtn);

    const block = renderPaletteBlock('http');
    const ctx = makeCtx();
    await revealPaletteBlock(ctx, WF.PAL_HTTP);
    expect(clickSpy).toHaveBeenCalled();
    expect(document.querySelector('.wf-palette-search-clear')).toBeNull();
    expect(block.scrollIntoView).toHaveBeenCalled();
  });

  it('does not error when no search is active', async () => {
    renderBlocksTab();
    // No clear button in DOM — search is inactive
    const block = renderPaletteBlock('http');
    const ctx = makeCtx();
    const result = await revealPaletteBlock(ctx, WF.PAL_HTTP);
    expect(result).toBe(block);
  });

  it('handles all protocol block types correctly', async () => {
    renderBlocksTab();
    const types = [
      { type: 'wsConnect',           sel: WF.PAL_WS_CONNECT },
      { type: 'wsSend',              sel: WF.PAL_WS_SEND },
      { type: 'wsReceive',           sel: WF.PAL_WS_RECEIVE },
      { type: 'grpcUnary',           sel: WF.PAL_GRPC_UNARY },
      { type: 'grpcServerStream',    sel: WF.PAL_GRPC_SERVER_STREAM },
      { type: 'graphqlQuery',        sel: WF.PAL_GQL_QUERY },
      { type: 'graphqlMutation',     sel: WF.PAL_GQL_MUTATION },
      { type: 'graphqlSubscription', sel: WF.PAL_GQL_SUBSCRIPTION },
    ];
    for (const { type, sel } of types) {
      document.body.innerHTML = '';
      renderBlocksTab();
      const block = renderPaletteBlock(type);
      const ctx = makeCtx();
      const result = await revealPaletteBlock(ctx, sel);
      expect(result).toBe(block);
    }
  });
});
