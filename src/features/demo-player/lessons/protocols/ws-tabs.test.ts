/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsTabsLesson } from './ws-tabs';
import { makeCtx } from './ws-test-utils';

describe('ws-tabs lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // ─── Structure ──────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(wsTabsLesson.id).toBe('ws-tabs');
    expect(wsTabsLesson.domainId).toBe('protocols');
    expect(wsTabsLesson.category).toBe('websocket');
    expect(wsTabsLesson.name).toBe('Tabs & Multi-Connection');
    expect(wsTabsLesson.initialTab).toBe('websocket-studio');
    expect(wsTabsLesson.estimatedMinutes).toBe(3);
  });

  it('has concept with title, body, keyTerms, and diagram', () => {
    expect(wsTabsLesson.concept).toBeDefined();
    expect(wsTabsLesson.concept!.title).toBe('Connection Tabs');
    expect(wsTabsLesson.concept!.body).toContain('multiple WebSocket connections');
    expect(wsTabsLesson.concept!.keyTerms!.length).toBe(3);
    expect(wsTabsLesson.concept!.diagram).toContain('<svg');
  });

  it('has 8 steps', () => {
    expect(wsTabsLesson.steps.length).toBe(8);
  });

  it('has expected step IDs in order', () => {
    const ids = wsTabsLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'tabs-intro',
      'tabs-add',
      'tabs-switch',
      'tabs-connect',
      'tabs-independent',
      'tabs-rename',
      'tabs-history',
      'tabs-close',
    ]);
  });

  it('all steps have title, description, and highlight', () => {
    for (const step of wsTabsLesson.steps) {
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
      expect(step.highlight).toBeTruthy();
    }
  });

  it('all steps have pauseAfter', () => {
    for (const step of wsTabsLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  // ─── Step actions ───────────────────────────────────────────

  it('step tabs-intro has no action (read-only)', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-intro')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toContain('conn-tab-bar');
  });

  it('step tabs-add clicks the add button', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-add')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-add'));
  });

  it('step tabs-add has verify selector for last tab', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-add')!;
    expect(step.verify).toBeDefined();
    expect(step.verify).toContain('[role="tab"]');
  });

  it('step tabs-switch clicks the first tab', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-switch')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-bar'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining(':first-child'));
  });

  it('step tabs-connect fills /connect command and dispatches Enter', async () => {
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);
    const spy = vi.spyOn(input, 'dispatchEvent');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect')!;
    await step.action!(ctx);

    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/connect ws://localhost:9876',
    );
    const enterCalls = spy.mock.calls.filter(
      (c) => c[0] instanceof KeyboardEvent && (c[0] as KeyboardEvent).key === 'Enter',
    );
    expect(enterCalls.length).toBe(1);
  });

  it('step tabs-connect preAction clicks Tab 1 then the console tab', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect')!;
    await step.preAction!(ctx);
    // Must navigate to Tab 1 first so the connect command applies to Tab 1
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-bar'));
    // Then switch to Console tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
  });

  it('step tabs-connect action uses waitFor for connected status', async () => {
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect')!;
    await step.action!(ctx);

    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/connect ws://localhost:9876',
    );
    // Must use waitFor (not only delay) so connection timing is reliable
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('connected'), expect.any(Number));
  });

  it('step tabs-connect has verify selector for connected status', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect')!;
    expect(step.verify).toBeDefined();
    expect(step.verify).toContain('connected');
  });

  it('step tabs-independent has preAction that ensures two tabs exist', async () => {
    // Only one tab in DOM → ensureTwoTabs should add one
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
      </div>
      <button data-testid="conn-tab-add">+</button>`;

    const addBtn = document.querySelector('[data-testid="conn-tab-add"]') as HTMLElement;
    const addSpy = vi.spyOn(addBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-independent')!;
    await step.preAction!(ctx);
    expect(addSpy).toHaveBeenCalled();
  });

  it('step tabs-independent preAction does not add tab when two already exist', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>
      <button data-testid="conn-tab-add">+</button>`;

    const addBtn = document.querySelector('[data-testid="conn-tab-add"]') as HTMLElement;
    const addSpy = vi.spyOn(addBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-independent')!;
    await step.preAction!(ctx);
    // Should NOT add a tab — already have 2
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('step tabs-independent preAction navigates to Tab 1', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>`;

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-independent')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining(':first-child'));
  });

  it('step tabs-independent clicks the last tab', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>`;

    const lastTab = document.querySelector('[data-testid="conn-tab-2"]') as HTMLElement;
    const clickSpy = vi.spyOn(lastTab, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-independent')!;
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step tabs-independent preAction clicks connect button when it exists and is enabled', async () => {
    // Set up DOM: Tab 1 element + an enabled connect button + STATUS_CONNECTED not present
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
      </div>
      <button data-testid="connect-btn">Connect</button>`;

    const connectBtn = document.querySelector('[data-testid="connect-btn"]') as HTMLButtonElement;
    const clickSpy = vi.spyOn(connectBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-independent')!;
    await step.preAction!(ctx);

    // Connect button is enabled (not disabled) → should be clicked
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step tabs-independent preAction skips connect button when disabled', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
      </div>
      <button data-testid="connect-btn" disabled>Connect</button>`;

    const connectBtn = document.querySelector('[data-testid="connect-btn"]') as HTMLButtonElement;
    const clickSpy = vi.spyOn(connectBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-independent')!;
    await step.preAction!(ctx);

    // Button is disabled → should NOT be clicked
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it('step tabs-rename triggers double-click and fills rename input', async () => {
    // Create a tab bar with a tab that responds to dblclick
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
      </div>`;

    const tab = document.querySelector('[data-testid="conn-tab-bar"] [role="tab"]:first-child')!;
    const dblClickSpy = vi.fn();
    tab.addEventListener('dblclick', dblClickSpy);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-rename')!;
    await step.action!(ctx);

    // Verify double-click was dispatched
    expect(dblClickSpy).toHaveBeenCalledTimes(1);
  });

  it('step tabs-rename action fills rename input when it appears after dblclick', async () => {
    // Create tab + a rename input already in the DOM (simulating it was rendered by the dblclick handler)
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    bar.appendChild(tab);
    document.body.appendChild(bar);

    // Simulate rename input appearing in DOM (normally rendered by React after dblclick)
    const renameInput = document.createElement('input');
    renameInput.setAttribute('data-testid', 'conn-tab-rename-1');
    document.body.appendChild(renameInput);

    const inputSpy = vi.fn();
    const changeSpy = vi.fn();
    renameInput.addEventListener('input', inputSpy);
    renameInput.addEventListener('change', changeSpy);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-rename')!;
    await step.action!(ctx);

    // Rename input should have been filled (input + change events dispatched)
    expect(inputSpy).toHaveBeenCalled();
    expect(changeSpy).toHaveBeenCalled();
  });

  it('step tabs-rename has preAction that switches to first tab', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-rename')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining(':first-child'));
  });

  it('step tabs-history has preAction that navigates to Tab 1', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-history')!;
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining(':first-child'));
  });

  it('step tabs-history clicks the history trigger and waits 2s before closing', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-history')!;
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('conn-tab-history-trigger'));
    // Should have called delay with at least 2000ms for end-user readability
    const delayCalls = (ctx.delay as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0] as number);
    expect(delayCalls.some((ms: number) => ms >= 2000)).toBe(true);
  });

  it('step tabs-close has preAction that ensures Tab 2 exists', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
      </div>
      <button data-testid="conn-tab-add">+</button>`;

    const addBtn = document.querySelector('[data-testid="conn-tab-add"]') as HTMLElement;
    const addSpy = vi.spyOn(addBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-close')!;
    await step.preAction!(ctx);
    expect(addSpy).toHaveBeenCalled();
  });

  it('step tabs-close preAction does not add tab when two exist', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>
      <button data-testid="conn-tab-add">+</button>`;

    const addBtn = document.querySelector('[data-testid="conn-tab-add"]') as HTMLElement;
    const addSpy = vi.spyOn(addBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-close')!;
    await step.preAction!(ctx);
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('step tabs-close finds and clicks the close button on last tab', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>
      <button data-testid="conn-tab-close-2">×</button>`;

    const closeBtn = document.querySelector('[data-testid="conn-tab-close-2"]') as HTMLElement;
    const clickSpy = vi.spyOn(closeBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-close')!;
    await step.action!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('step tabs-close has no verify (cleanup handles state)', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-close')!;
    expect(step.verify).toBeUndefined();
  });

  // ─── Highlights ─────────────────────────────────────────────

  it('tabs-intro highlights the tab bar', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-intro')!;
    expect(step.highlight).toContain('conn-tab-bar');
  });

  it('tabs-add highlights the add button', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-add')!;
    expect(step.highlight).toContain('conn-tab-add');
  });

  it('tabs-connect highlights the console input', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect')!;
    expect(step.highlight).toContain('ws-console-cmd-input');
  });

  it('tabs-history highlights the history trigger', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-history')!;
    expect(step.highlight).toContain('conn-tab-history-trigger');
  });

  // ─── Setup & Cleanup ───────────────────────────────────────

  it('setup cleans extra tabs, resets label, then starts mock server', async () => {
    // Provide a tab with a non-default label so rename reset branch triggers
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">
          <span class="ws-conn-tab-label">Echo Server</span>
        </div>
      </div>`;

    const tab = document.querySelector('[data-testid="conn-tab-1"]')!;
    const dblClickSpy = vi.fn();
    tab.addEventListener('dblclick', dblClickSpy);

    const ctx = makeCtx();
    await wsTabsLesson.setup!(ctx);
    // Should end with mock server start and client mode switch
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    // Should trigger double-click to rename when label is not "New Connection"
    expect(dblClickSpy).toHaveBeenCalled();
  });

  it('cleanup is callable', async () => {
    const ctx = makeCtx();
    await wsTabsLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('setup fills rename input when tab label is not New Connection', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">
          <span class="ws-conn-tab-label">Echo Server</span>
        </div>
      </div>
      <input data-testid="conn-tab-rename-1" />`;

    const tab = document.querySelector('[data-testid="conn-tab-1"]') as HTMLElement;
    tab.addEventListener('dblclick', () => {
      const renameInput = document.querySelector('[data-testid="conn-tab-rename-1"]') as HTMLInputElement;
      if (renameInput) {
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        nativeSet?.call(renameInput, 'New Connection');
        renameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    const renameInput = document.querySelector('[data-testid="conn-tab-rename-1"]') as HTMLInputElement;
    const enterSpy = vi.spyOn(renameInput, 'dispatchEvent');

    await wsTabsLesson.setup!(makeCtx());
    expect(enterSpy).toHaveBeenCalled();
  });

  it('step tabs-rename fills rename input and commits with Enter', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
      </div>
      <input data-testid="conn-tab-rename-1" />`;

    const tab = document.querySelector('[data-testid="conn-tab-bar"] [role="tab"]:first-child') as HTMLElement;
    tab.addEventListener('dblclick', () => {
      // rename input already in DOM for this test
    });

    const renameInput = document.querySelector('[data-testid="conn-tab-rename-1"]') as HTMLInputElement;
    const enterSpy = vi.spyOn(renameInput, 'dispatchEvent');

    const step = wsTabsLesson.steps.find(s => s.id === 'tabs-rename')!;
    await step.action!(makeCtx());

    expect(renameInput.value).toBe('Echo Server');
    const enterCalls = enterSpy.mock.calls.filter(
      c => c[0] instanceof KeyboardEvent && (c[0] as KeyboardEvent).key === 'Enter',
    );
    expect(enterCalls.length).toBe(1);
  });

  it('step tabs-connect handles missing console input gracefully', async () => {
    const step = wsTabsLesson.steps.find(s => s.id === 'tabs-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalled();
  });

  // ─── Branch-coverage: tabs-independent (line 228) ─────────────
  // `if (lastTab)` — both TRUE (tab exists) and FALSE (no tabs) branches.

  it('step tabs-independent action does nothing when tab bar is empty (false branch line 228)', async () => {
    // No DOM tabs — querySelectorAll returns empty list, lastTab = undefined, if (lastTab) is false.
    const step = wsTabsLesson.steps.find(s => s.id === 'tabs-independent')!;
    await expect(step.action!(makeCtx())).resolves.not.toThrow();
  });

  // ─── Branch-coverage: tabs-rename (line 249) ───────────────────
  // `if (tab)` — FALSE branch when CONN_TAB_FIRST selector finds nothing.

  it('step tabs-rename action does nothing when no first tab exists (false branch line 249)', async () => {
    // No DOM tab — querySelector returns null, if (tab) is false.
    const step = wsTabsLesson.steps.find(s => s.id === 'tabs-rename')!;
    await expect(step.action!(makeCtx())).resolves.not.toThrow();
  });

  // ─── Branch-coverage: tabs-close (lines 307-311) ───────────────
  // Two false branches: no last tab (line 307) and no close button (line 311).

  it('step tabs-close action does nothing when tab bar is empty (false branch line 307)', async () => {
    // No DOM tabs — lastTab is undefined, if (lastTab) is false.
    const step = wsTabsLesson.steps.find(s => s.id === 'tabs-close')!;
    await expect(step.action!(makeCtx())).resolves.not.toThrow();
  });

  it('step tabs-close action skips click when close button is absent (false branch line 311)', async () => {
    // Tab exists but no matching close button → if (closeBtn) is false.
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-testid', 'conn-tab-99');
    bar.appendChild(tab);
    document.body.appendChild(bar);
    // No close button in DOM — ensures the inner if (closeBtn) false path is taken.

    const step = wsTabsLesson.steps.find(s => s.id === 'tabs-close')!;
    await expect(step.action!(makeCtx())).resolves.not.toThrow();
  });

  it('step tabs-close action clicks close button on last tab when present', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-testid', 'conn-tab-42');
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-testid', 'conn-tab-close-42');
    const closeSpy = vi.fn();
    closeBtn.addEventListener('click', closeSpy);
    document.body.appendChild(closeBtn);

    const step = wsTabsLesson.steps.find(s => s.id === 'tabs-close')!;
    await step.action!(makeCtx());

    expect(closeSpy).toHaveBeenCalled();
  });

  // ─── Branch-coverage: tabs-close line 308 (?? fallback) ────────
  // Tab lacks data-testid → getAttribute returns null → ?? '' gives '' → no close button found.

  it('step tabs-close action handles tab without data-testid (line 308 ?? branch)', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    // NOTE: no data-testid attribute — getAttribute returns null → ?? '' triggers
    bar.appendChild(tab);
    document.body.appendChild(bar);

    const step = wsTabsLesson.steps.find(s => s.id === 'tabs-close')!;
    await expect(step.action!(makeCtx())).resolves.not.toThrow();
  });

  // ─── Branch-coverage: setup (lines 13-15) ──────────────────────
  // Line 13: no tab → `if (tab)` false. Line 15: label === 'New Connection' → no rename.

  it('setup does nothing when no first tab exists (false branch line 13)', async () => {
    // DOM is empty — querySelector(CONN_TAB_FIRST) returns null → if (tab) is false
    const ctx = makeCtx();
    await wsTabsLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
  });

  it('setup skips rename when tab label is already "New Connection" (false branch line 15)', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">
          <span class="ws-conn-tab-label">New Connection</span>
        </div>
      </div>`;

    const tab = document.querySelector('[data-testid="conn-tab-1"]')!;
    const dblClickSpy = vi.fn();
    tab.addEventListener('dblclick', dblClickSpy);

    const ctx = makeCtx();
    await wsTabsLesson.setup!(ctx);

    // Label is already "New Connection" → no rename dblclick should fire
    expect(dblClickSpy).not.toHaveBeenCalled();
  });

  // ─── Branch-coverage: tabs-independent preAction (line 209) ────
  // `if (!document.querySelector(WS.STATUS_CONNECTED))` FALSE branch:
  // when status IS connected, the connect block is skipped entirely.

  it('step tabs-independent preAction skips connect when STATUS_CONNECTED is already present', async () => {
    const statusEl = document.createElement('div');
    statusEl.className = 'ws-status-dot connected';
    document.body.appendChild(statusEl);

    const step = wsTabsLesson.steps.find(s => s.id === 'tabs-independent')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);

    // When already connected, LEFT_TAB_CONNECT is NOT clicked
    const leftTabConnectCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: [string]) => c[0].includes('left-tab-connect'),
    );
    expect(leftTabConnectCalls.length).toBe(0);
  });
});

// ─── ws-filtering ───────────────────────────────────────────────

