/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsPowerUserLesson } from './ws-power-user';
import { makeCtx, makeVisible } from './ws-test-utils';

describe('ws-power-user lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsPowerUserLesson.id).toBe('ws-power-user');
    expect(wsPowerUserLesson.domainId).toBe('protocols');
    expect(wsPowerUserLesson.name).toBe('Power User: Tabs & Keyboard');
    expect(wsPowerUserLesson.steps.length).toBe(7);
    expect(wsPowerUserLesson.concept.title).toBeTruthy();
    expect(wsPowerUserLesson.concept.body).toBeTruthy();
    expect(wsPowerUserLesson.initialTab).toBe('websocket-studio');
  });

  it('has correct metadata', () => {
    expect(wsPowerUserLesson.category).toBe('websocket');
    expect(wsPowerUserLesson.estimatedMinutes).toBe(4);
    expect(wsPowerUserLesson.dockerEndpoint).toBeUndefined();
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsPowerUserLesson.setup).toBe('function');
    expect(typeof wsPowerUserLesson.cleanup).toBe('function');
  });

  it('concept has key terms for roving tabindex and DnD', () => {
    const terms = wsPowerUserLesson.concept.keyTerms ?? [];
    expect(terms.length).toBeGreaterThanOrEqual(2);
    const termNames = terms.map(t => t.term.toLowerCase());
    expect(termNames.some(t => t.includes('roving') || t.includes('tabindex'))).toBe(true);
    expect(termNames.some(t => t.includes('dnd') || t.includes('drag'))).toBe(true);
  });

  it('concept has a diagram', () => {
    expect(wsPowerUserLesson.concept.diagram).toBeTruthy();
    expect(wsPowerUserLesson.concept.diagram).toContain('Tab Bar');
  });

  it('all steps have id, title, and description', () => {
    wsPowerUserLesson.steps.forEach(step => {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description.length).toBeGreaterThan(30);
    });
  });

  it('step IDs are in correct order', () => {
    const ids = wsPowerUserLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'pu-setup-tabs',
      'pu-drag-reorder',
      'pu-kbd-arrow',
      'pu-kbd-rename',
      'pu-kbd-delete',
      'pu-auth-persist',
      'pu-pane-persist',
    ]);
  });

  // ─── Step: pu-setup-tabs ──────────────────────────────────

  it('step pu-setup-tabs action creates tabs and renames them', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('aria-selected', 'true');
    tab1.setAttribute('data-testid', 'conn-tab-1');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'New Connection';
    tab1.appendChild(label);
    bar.appendChild(tab1);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-setup-tabs')!;
    expect(typeof step.action).toBe('function');
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should add new tabs
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-setup-tabs preAction closes extra tabs first (idempotent guard)', async () => {
    // Simulate 3 tabs already existing (step-back scenario)
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    for (let i = 1; i <= 3; i++) {
      const t = document.createElement('div');
      t.setAttribute('role', 'tab');
      t.setAttribute('data-testid', `conn-tab-${i}`);
      bar.appendChild(t);

      const close = document.createElement('button');
      close.setAttribute('data-testid', `conn-tab-close-${i}`);
      document.body.appendChild(close);
    }
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-setup-tabs')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Guard-only preAction should run without tab creation clicks.
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-setup-tabs highlights tab bar', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-setup-tabs')!;
    expect(step.highlight).toContain('conn-tab-bar');
  });

  // ─── Step: pu-drag-reorder ────────────────────────────────

  it('step pu-drag-reorder has a preAction', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step pu-drag-reorder preAction is a no-op when 3 tabs already exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    for (let i = 1; i <= 3; i++) {
      const t = document.createElement('div');
      t.setAttribute('role', 'tab');
      bar.appendChild(t);
    }
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should NOT have added tabs or navigated (3 tabs already present)
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-drag-reorder preAction creates tabs when fewer than 3 exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const t = document.createElement('div');
    t.setAttribute('role', 'tab');
    bar.appendChild(t);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-drag-reorder highlights tab bar', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    expect(step.highlight).toContain('conn-tab-bar');
  });

  it('step pu-drag-reorder has an action with delay', async () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  // ─── Step: pu-kbd-arrow ───────────────────────────────────

  it('step pu-kbd-arrow has a preAction', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-arrow')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step pu-kbd-arrow preAction creates tabs when fewer than 2 exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const t = document.createElement('div');
    t.setAttribute('role', 'tab');
    bar.appendChild(t);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-arrow')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-kbd-arrow preAction is a no-op when 2+ tabs already exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    for (let i = 0; i < 2; i++) {
      const t = document.createElement('div');
      t.setAttribute('role', 'tab');
      bar.appendChild(t);
    }
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-arrow')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-kbd-arrow action dispatches arrow key events on two different tabs', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('aria-selected', 'true');
    tab1.setAttribute('data-testid', 'conn-tab-1');
    tab1.tabIndex = 0;
    bar.appendChild(tab1);
    const tab2 = document.createElement('div');
    tab2.setAttribute('role', 'tab');
    tab2.setAttribute('aria-selected', 'false');
    tab2.setAttribute('data-testid', 'conn-tab-2');
    bar.appendChild(tab2);
    document.body.appendChild(bar);

    const keydownSpy1 = vi.fn();
    const keydownSpy2 = vi.fn();
    tab1.addEventListener('keydown', keydownSpy1);
    tab2.addEventListener('keydown', keydownSpy2);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-arrow')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // tab1 gets ArrowRight (first press)
    const arrowOnTab1 = keydownSpy1.mock.calls.filter(
      (c: [KeyboardEvent]) => c[0].key === 'ArrowRight'
    );
    expect(arrowOnTab1.length).toBeGreaterThanOrEqual(1);
    // tab2 gets ArrowRight (second press — index-based, not active-tab-based)
    const arrowOnTab2 = keydownSpy2.mock.calls.filter(
      (c: [KeyboardEvent]) => c[0].key === 'ArrowRight'
    );
    expect(arrowOnTab2.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Step: pu-kbd-rename ──────────────────────────────────

  it('step pu-kbd-rename has a preAction', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-rename')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step pu-kbd-rename preAction does NOT rename (guard only — ensures tabs exist)', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('aria-selected', 'true');
    tab1.setAttribute('data-testid', 'conn-tab-1');
    bar.appendChild(tab1);
    document.body.appendChild(bar);

    const keydownSpy = vi.fn();
    tab1.addEventListener('keydown', keydownSpy);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-rename')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // preAction must NOT dispatch F2 — rename is now in action
    const f2Calls = keydownSpy.mock.calls.filter(
      (c: [KeyboardEvent]) => c[0].key === 'F2'
    );
    expect(f2Calls.length).toBe(0);
  });

  it('step pu-kbd-rename preAction calls ensureThreeNamedTabs when no tabs exist', async () => {
    // Empty tab bar — tabs.length < 1 → ensureThreeNamedTabs(ctx) must be called
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-rename')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // ensureThreeNamedTabs calls conn-tab-add at least once to create tabs
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-kbd-rename action renames last tab (dispatches F2 + Enter)', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('aria-selected', 'true');
    tab1.setAttribute('data-testid', 'conn-tab-1');
    tab1.tabIndex = 0;
    bar.appendChild(tab1);
    document.body.appendChild(bar);

    const keydownSpy = vi.fn();
    tab1.addEventListener('keydown', keydownSpy);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-rename')!;
    expect(typeof step.action).toBe('function');
    const ctx = makeCtx();
    await step.action!(ctx);
    const f2Calls = keydownSpy.mock.calls.filter(
      (c: [KeyboardEvent]) => c[0].key === 'F2'
    );
    expect(f2Calls.length).toBeGreaterThanOrEqual(1);
  });

  it('step pu-kbd-rename action fills rename input when it appears after F2', async () => {
    // Set up tab bar + rename input pre-present (simulates React rendering it after F2)
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('aria-selected', 'true');
    tab1.setAttribute('data-testid', 'conn-tab-1');
    tab1.tabIndex = 0;
    bar.appendChild(tab1);
    document.body.appendChild(bar);

    // Create the rename input immediately — renameTabByIndex finds it without needing a dblclick fallback
    const renameInput = document.createElement('input');
    renameInput.setAttribute('data-testid', 'conn-tab-rename-1');
    const keydownSpy = vi.fn();
    renameInput.addEventListener('keydown', keydownSpy);
    document.body.appendChild(renameInput);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-rename')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    // Enter key should have been dispatched on the rename input to commit the rename
    const enterCalls = keydownSpy.mock.calls.filter(
      (c: [KeyboardEvent]) => c[0].key === 'Enter'
    );
    expect(enterCalls.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Step: pu-kbd-delete ──────────────────────────────────

  it('step pu-kbd-delete has a preAction', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-delete')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step pu-kbd-delete preAction is a no-op when "Server B" already exists', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-testid', 'conn-tab-1');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'Server B';
    tab.appendChild(label);
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-delete')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should NOT add a new tab — Server B already exists
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-kbd-delete preAction adds and renames tab when "Server B" is missing', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-testid', 'conn-tab-1');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'Server A'; // No Server B
    tab.appendChild(label);
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-delete')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should add a new tab to host "Server B"
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-kbd-delete action dispatches Delete key on "Server B" tab', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-testid', 'conn-tab-1');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'Server B';
    tab.appendChild(label);
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const keydownSpy = vi.fn();
    tab.addEventListener('keydown', keydownSpy);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-delete')!;
    expect(typeof step.action).toBe('function');
    const ctx = makeCtx();
    await step.action!(ctx);
    const deleteCalls = keydownSpy.mock.calls.filter(
      (c: [KeyboardEvent]) => c[0].key === 'Delete'
    );
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('step pu-kbd-delete action is a no-op when "Server B" does not exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-testid', 'conn-tab-1');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'Server A';
    tab.appendChild(label);
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const keydownSpy = vi.fn();
    tab.addEventListener('keydown', keydownSpy);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-delete')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(keydownSpy).not.toHaveBeenCalled();
  });

  // ─── Step: pu-auth-persist ────────────────────────────────

  // ─── Step: pu-auth-persist (updated preAction) ──────────────

  it('step pu-auth-persist has a preAction', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-auth-persist')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step pu-auth-persist preAction adds a tab when fewer than 2 exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const t = document.createElement('div');
    t.setAttribute('role', 'tab');
    bar.appendChild(t);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-auth-persist')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-auth-persist preAction resets left pane to Connect', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    for (let i = 0; i < 2; i++) {
      const t = document.createElement('div');
      t.setAttribute('role', 'tab');
      bar.appendChild(t);
    }
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-auth-persist')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // No add-tab and LEFT_TAB_CONNECT reset is applied
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step pu-auth-persist action switches to auth tab', async () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-auth-persist')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-auth'));
  });

  it('step pu-auth-persist action clicks the other tab when 2+ tabs exist', async () => {
    // Set up 2 tabs in DOM so tabs.length >= 2 branch is hit
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    const tab2 = document.createElement('div');
    tab2.setAttribute('role', 'tab');
    const tab2ClickSpy = vi.spyOn(tab2, 'click');
    bar.append(tab1, tab2);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-auth-persist')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    // The last tab (tab2) should be clicked when tabs.length >= 2
    expect(tab2ClickSpy).toHaveBeenCalled();
    // And then navigates back to first tab (WS.CONN_TAB_FIRST contains :first-child)
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining(':first-child'));
  });

  // ─── Step: pu-pane-persist (redesigned preAction + action) ─────

  it('step pu-pane-persist preAction has a tab guard', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-pane-persist')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step pu-pane-persist preAction adds a tab when fewer than 2 exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const t = document.createElement('div');
    t.setAttribute('role', 'tab');
    bar.appendChild(t);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-pane-persist')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-pane-persist preAction sets Auth+Events on last tab and Connect+Console on first tab', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    const tab2 = document.createElement('div');
    tab2.setAttribute('role', 'tab');
    const tab2ClickSpy = vi.spyOn(tab2, 'click');
    bar.append(tab1, tab2);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-pane-persist')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    // Last tab should be clicked to apply its state
    expect(tab2ClickSpy).toHaveBeenCalled();
    // Auth on last tab, Connect on first tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-auth'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
    // First tab state
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
  });

  it('step pu-pane-persist preAction does not add a tab when 2+ tabs exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    for (let i = 0; i < 2; i++) {
      const t = document.createElement('div');
      t.setAttribute('role', 'tab');
      bar.appendChild(t);
    }
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-pane-persist')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-pane-persist action switches connection tabs to demonstrate persistence', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    const tab2 = document.createElement('div');
    tab2.setAttribute('role', 'tab');
    const tab2ClickSpy = vi.spyOn(tab2, 'click');
    bar.append(tab1, tab2);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-pane-persist')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    // Action switches to last tab, back to first, then to last again
    expect(tab2ClickSpy).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining(':first-child'));
    // Action no longer sets right-tab-events — that is preAction's job
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  // ─── Setup / Cleanup ─────────────────────────────────────

  it('setup starts mock server', async () => {
    const ctx = makeCtx();
    await wsPowerUserLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  it('setup clicks disconnect button when it is present and enabled', async () => {
    // Add an enabled disconnect button so the dcBtn branch fires
    const dcBtn = document.createElement('button');
    dcBtn.setAttribute('data-testid', 'disconnect-btn');
    const clickSpy = vi.spyOn(dcBtn, 'click');
    document.body.appendChild(dcBtn);
    makeVisible(dcBtn);

    const ctx = makeCtx();
    await wsPowerUserLesson.setup!(ctx);

    expect(clickSpy).toHaveBeenCalled();
    dcBtn.remove();
  });

  // ─── Branch-coverage: pu-kbd-rename action (line 277) ──────────
  // `if (tabs.length > 0)` FALSE branch — no tabs in DOM.

  it('step pu-kbd-rename action does nothing when no tabs exist (false branch line 277)', async () => {
    // No tabs in DOM — tabs.length === 0 → if (tabs.length > 0) is false → no rename
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-rename')!;
    const ctx = makeCtx();
    await expect(step.action!(ctx)).resolves.not.toThrow();
  });

  // ─── Branch-coverage: pu-auth-persist action (line 344) ─────────
  // `if (tabs.length >= 2)` FALSE branch — fewer than 2 tabs.

  it('step pu-auth-persist action skips other-tab click when only 1 tab exists (false branch line 344)', async () => {
    // 1 tab → if (tabs.length >= 2) is false → skip otherTab.click(); ctx.click(CONN_TAB_FIRST) still called
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-auth-persist')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-auth'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('first-child'));
  });

  // ─── Branch-coverage: pu-pane-persist action (lines 379, 391) ───
  // Both `if (tabs.length >= 2)` conditions FALSE when only 1 tab in DOM.

  it('step pu-pane-persist action skips tab clicks when fewer than 2 tabs (false branch)', async () => {
    // 1 tab only → both if (tabs.length >= 2) conditions are false → no lastTab.click()
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-pane-persist')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    // With 1 tab, only CONN_TAB_FIRST is clicked — no right-pane tab switches
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('first-child'));
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  // ─── Branch-coverage: getTabByIndex ?? null (line 52) ───────────
  // The ?? null fallback triggers when tabs[index] is undefined (out of bounds).
  // pu-kbd-arrow calls getTabByIndex(1) which is undefined when only 1 tab exists.

  it('step pu-kbd-arrow action uses tab1 as fallback when tab2 is undefined (line 52 ?? branch)', async () => {
    // 1 tab only → getTabByIndex(1) returns null → tab2 = null ?? tab1 = tab1
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('data-testid', 'conn-tab-1');
    const keydownSpy = vi.fn();
    tab1.addEventListener('keydown', keydownSpy);
    bar.appendChild(tab1);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-arrow')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    // Both pressKeyOnTab calls used tab1 (the only tab) — ArrowRight should have fired at least once
    const arrowCalls = keydownSpy.mock.calls.filter(
      (c: [KeyboardEvent]) => c[0].key === 'ArrowRight',
    );
    expect(arrowCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('cleanup stops mock server', async () => {
    const ctx = makeCtx();
    await wsPowerUserLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });
});

// ─── sse-studio-advanced ─────────────────────────────────────────

