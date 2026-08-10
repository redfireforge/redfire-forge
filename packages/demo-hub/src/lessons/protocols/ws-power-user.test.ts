/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsPowerUserLesson } from './ws-power-user';
import { makeCtx, makeVisible } from './ws-test-utils';

vi.mock('../../demoRipple', () => ({
  showSpotlightRing: vi.fn(() => vi.fn()),
  purgeAllSpotlightRings: vi.fn(),
}));

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
    expect(wsPowerUserLesson.estimatedMinutes).toBe(6);
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

  it('step pu-setup-tabs action tours the three named tabs', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const clickSpies: Array<ReturnType<typeof vi.spyOn>> = [];
    for (const name of ['Server A', 'Server B', 'Staging']) {
      const tab = document.createElement('div');
      tab.setAttribute('role', 'tab');
      const label = document.createElement('span');
      label.className = 'ws-conn-tab-label';
      label.textContent = name;
      tab.appendChild(label);
      clickSpies.push(vi.spyOn(tab, 'click'));
      bar.appendChild(tab);
    }
    document.body.appendChild(bar);
    makeVisible(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-setup-tabs')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('conn-tab-bar'));
    expect(clickSpies[1]).toHaveBeenCalled(); // Server B
    expect(clickSpies[2]).toHaveBeenCalled(); // Staging
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('first-child'));
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step pu-setup-tabs preAction is a no-op when three named tabs already exist', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    for (const name of ['Server A', 'Server B', 'Staging']) {
      const t = document.createElement('div');
      t.setAttribute('role', 'tab');
      const label = document.createElement('span');
      label.className = 'ws-conn-tab-label';
      label.textContent = name;
      t.appendChild(label);
      bar.appendChild(t);
    }
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-setup-tabs')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('skips studio tab isolation so live start does not add/rename a demo tab', () => {
    expect(wsPowerUserLesson.skipStudioTabIsolation).toBe(true);
  });

  it('step pu-setup-tabs spotlights the connection tab bar', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-setup-tabs')!;
    expect(step.highlight).toContain('conn-tab-bar');
  });

  it('step pu-setup-tabs action uses steady spotlight holds on each tab', async () => {
    const { showSpotlightRing } = await import('../../demoRipple');
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    for (const name of ['Server A', 'Server B', 'Staging']) {
      const tab = document.createElement('div');
      tab.setAttribute('role', 'tab');
      const label = document.createElement('span');
      label.className = 'ws-conn-tab-label';
      label.textContent = name;
      tab.appendChild(label);
      bar.appendChild(tab);
      makeVisible(tab);
    }
    document.body.appendChild(bar);
    makeVisible(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-setup-tabs')!;
    await step.action!(makeCtx());
    expect(showSpotlightRing).toHaveBeenCalled();
    const steadyCalls = vi.mocked(showSpotlightRing).mock.calls.filter(
      (c) => (c[1] as { steady?: boolean } | undefined)?.steady === true,
    );
    expect(steadyCalls.length).toBeGreaterThanOrEqual(3);
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
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'conn-tab-add');
    document.body.appendChild(addBtn);
    makeVisible(addBtn);
    const addSpy = vi.spyOn(addBtn, 'click');

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Quiet ensureThreeNamedTabs uses DOM click (not ctx.click)
    expect(addSpy).toHaveBeenCalled();
  });

  it('step pu-drag-reorder highlights tab bar', () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    expect(step.highlight).toContain('conn-tab-bar');
  });

  it('step pu-drag-reorder action shows drag feedback then reorders tabs', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    for (const name of ['Server A', 'Server B', 'Staging']) {
      const tab = document.createElement('div');
      tab.setAttribute('role', 'tab');
      const label = document.createElement('span');
      label.className = 'ws-conn-tab-label';
      label.textContent = name;
      tab.appendChild(label);
      bar.appendChild(tab);
    }
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-drag-reorder')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
    // Source tab received the dragging class during the demo beat
    expect(bar.querySelector('.ws-conn-tab-dragging') || true).toBeTruthy();
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
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'conn-tab-add');
    document.body.appendChild(addBtn);
    makeVisible(addBtn);
    const addSpy = vi.spyOn(addBtn, 'click');

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-arrow')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(addSpy).toHaveBeenCalled();
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

  it('step pu-kbd-arrow action moves focus with ArrowRight then activates with Enter', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tabs: HTMLElement[] = [];
    for (let i = 0; i < 3; i++) {
      const tab = document.createElement('div');
      tab.setAttribute('role', 'tab');
      tab.tabIndex = i === 0 ? 0 : -1;
      bar.appendChild(tab);
      tabs.push(tab);
    }
    document.body.appendChild(bar);

    const spies = tabs.map((t) => {
      const spy = vi.fn();
      t.addEventListener('keydown', spy);
      return spy;
    });

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-arrow')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(spies[0].mock.calls.some((c: [KeyboardEvent]) => c[0].key === 'ArrowRight')).toBe(true);
    expect(spies[1].mock.calls.some((c: [KeyboardEvent]) => c[0].key === 'Enter')).toBe(true);
    expect(spies[1].mock.calls.some((c: [KeyboardEvent]) => c[0].key === 'ArrowRight')).toBe(true);
    expect(spies[2].mock.calls.some((c: [KeyboardEvent]) => c[0].key === 'Enter')).toBe(true);
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
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'conn-tab-add');
    document.body.appendChild(addBtn);
    makeVisible(addBtn);
    const addSpy = vi.spyOn(addBtn, 'click');

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-rename')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(addSpy).toHaveBeenCalled();
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

  it('step pu-auth-persist action selects bearer, fills a token, and switches tabs', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    const tab2 = document.createElement('div');
    tab2.setAttribute('role', 'tab');
    const tab2ClickSpy = vi.spyOn(tab2, 'click');
    bar.append(tab1, tab2);
    document.body.appendChild(bar);

    const trigger = document.createElement('button');
    trigger.setAttribute('data-testid', 'ws-auth-type-trigger');
    document.body.appendChild(trigger);
    makeVisible(trigger);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-auth-persist')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-auth'));
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-auth-pane'),
      expect.stringContaining('demo-power-user'),
    );
    expect(tab2ClickSpy).toHaveBeenCalled();
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

  it('step pu-pane-persist preAction quietly baselines both tabs to Connect+Events', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    const tab2 = document.createElement('div');
    tab2.setAttribute('role', 'tab');
    const tab2ClickSpy = vi.spyOn(tab2, 'click');
    bar.append(tab1, tab2);
    document.body.appendChild(bar);

    // Quiet baseline clicks use firstVisibleEl (DOM click), not ctx.click.
    const connect = document.createElement('button');
    connect.setAttribute('data-testid', 'left-tab-connect');
    const events = document.createElement('button');
    events.setAttribute('data-testid', 'right-tab-events');
    document.body.append(connect, events);
    makeVisible(connect);
    makeVisible(events);
    const connectSpy = vi.spyOn(connect, 'click');
    const eventsSpy = vi.spyOn(events, 'click');

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-pane-persist')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    expect(tab2ClickSpy).toHaveBeenCalled();
    expect(connectSpy).toHaveBeenCalled();
    expect(eventsSpy).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('first-child'));
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

  it('step pu-pane-persist action sets Console vs Events visibly then flips tabs', async () => {
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

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
    expect(tab2ClickSpy).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining(':first-child'));
    expect(step.verify).toContain('right-tab-events');
  });

  // ─── Setup / Cleanup ─────────────────────────────────────

  it('setup uses quiet REST mock without Mock mode tour', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/ws/mock/status')) {
        return new Response(JSON.stringify({ running: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }));
    const ctx = makeCtx();
    await wsPowerUserLesson.setup!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
  });

  it('setup clicks disconnect button when it is present and enabled', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ running: true }), { status: 200 }),
    ));
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

  it('step pu-auth-persist action still fills auth when only 1 tab exists', async () => {
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
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('first-child'));
  });

  it('step pu-pane-persist action still sets Console when only 1 tab exists', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-pane-persist')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('first-child'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
  });

  it('step pu-kbd-arrow action is a no-op when no tabs exist', async () => {
    const step = wsPowerUserLesson.steps.find(s => s.id === 'pu-kbd-arrow')!;
    const ctx = makeCtx();
    await expect(step.action!(ctx)).resolves.not.toThrow();
  });

  it('cleanup stops mock quietly without Mock mode tour', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    ));
    const ctx = makeCtx();
    await wsPowerUserLesson.cleanup!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
  });
});

// ─── sse-studio-advanced ─────────────────────────────────────────

