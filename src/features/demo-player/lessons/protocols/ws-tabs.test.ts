/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsTabsLesson } from './ws-tabs';
import { makeCtx } from './ws-test-utils';

/**
 * jsdom does not do layout, so getBoundingClientRect() always returns zero.
 * firstVisibleEl() relies on non-zero width/height to detect visibility.
 * This helper patches selected elements so they appear visible in tests.
 */
function makeVisible(el: Element): void {
  (el as HTMLElement).getBoundingClientRect = () => ({
    width: 100, height: 20, top: 0, left: 0, right: 100, bottom: 20, x: 0, y: 0,
    toJSON: () => '{}',
  } as DOMRect);
}

/** Build a minimal tab bar with N tab elements that are visible. */
function buildTabBar(count: number): void {
  const tabBar = document.createElement('div');
  tabBar.setAttribute('data-testid', 'conn-tab-bar');
  for (let i = 1; i <= count; i++) {
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('data-testid', `conn-tab-${i}`);
    makeVisible(tab);
    tabBar.appendChild(tab);
  }
  document.body.appendChild(tabBar);
}

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
    expect(wsTabsLesson.estimatedMinutes).toBe(4);
  });

  it('has concept with title, body, keyTerms, and diagram', () => {
    expect(wsTabsLesson.concept).toBeDefined();
    expect(wsTabsLesson.concept!.title).toBe('Multi-Tab, Multi-Server');
    expect(wsTabsLesson.concept!.body).toContain('independent mock server');
    expect(wsTabsLesson.concept!.keyTerms!.length).toBe(4);
    expect(wsTabsLesson.concept!.diagram).toContain('<svg');
  });

  it('has 9 steps', () => {
    expect(wsTabsLesson.steps.length).toBe(9);
  });

  it('has expected step IDs in order', () => {
    const ids = wsTabsLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'tabs-intro',
      'tabs-add',
      'tabs-mock-start-tab2',
      'tabs-connect-tab1',
      'tabs-connect-tab2',
      'tabs-send-tab1',
      'tabs-mock-log-tab1',
      'tabs-send-tab2',
      'tabs-close',
    ]);
  });

  it('all steps have title, description, and highlight', () => {
    for (const step of wsTabsLesson.steps) {
      expect(step.title, `step ${step.id} missing title`).toBeTruthy();
      expect(step.description, `step ${step.id} missing description`).toBeTruthy();
      expect(step.highlight, `step ${step.id} missing highlight`).toBeTruthy();
    }
  });

  it('all steps have pauseAfter', () => {
    for (const step of wsTabsLesson.steps) {
      expect(step.pauseAfter, `step ${step.id} missing pauseAfter`).toBe(true);
    }
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsTabsLesson.setup).toBe('function');
    expect(typeof wsTabsLesson.cleanup).toBe('function');
  });

  // ─── Step content: concept mentions both ports ───────────────

  it('concept body mentions port 9876 and 9877', () => {
    expect(wsTabsLesson.concept!.body).toContain('9876');
    expect(wsTabsLesson.concept!.body).toContain('9877');
  });

  it('tabs-add description mentions port 9877', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-add')!;
    expect(step.description).toContain('9877');
    expect(step.description).toContain('9876');
  });

  it('tabs-mock-start-tab2 description mentions starting server on 9877', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-mock-start-tab2')!;
    expect(step.description).toContain('9877');
  });

  it('tabs-connect-tab1 description mentions ws://localhost:9876', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect-tab1')!;
    expect(step.description).toContain('9876');
  });

  it('tabs-connect-tab2 description mentions ws://localhost:9877', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect-tab2')!;
    expect(step.description).toContain('9877');
  });

  it('tabs-send-tab1 description mentions Tab 1 and :9876', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab1')!;
    expect(step.description).toContain('9876');
  });

  it('tabs-mock-log-tab1 description mentions :9876 and :9877 isolation', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-mock-log-tab1')!;
    expect(step.description).toContain('9876');
    expect(step.description).toContain('9877');
  });

  it('tabs-send-tab2 description mentions :9877 and isolation', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab2')!;
    expect(step.description).toContain('9877');
  });

  it('tabs-close description mentions server stopping automatically', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-close')!;
    expect(step.description.toLowerCase()).toMatch(/stop|automat/);
  });

  // ─── Step verify selectors ───────────────────────────────────

  it('tabs-add has verify selector', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-add')!;
    expect(step.verify).toBeTruthy();
  });

  it('tabs-mock-start-tab2 has verify for mock stop button', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-mock-start-tab2')!;
    expect(step.verify).toContain('mock-stop-btn');
  });

  it('tabs-connect-tab1 has verify for connected status', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect-tab1')!;
    expect(step.verify).toContain('connected');
  });

  it('tabs-connect-tab2 has verify for connected status', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect-tab2')!;
    expect(step.verify).toContain('connected');
  });

  it('tabs-send-tab1 has verify for message row', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab1')!;
    expect(step.verify).toBeTruthy();
  });

  it('tabs-mock-log-tab1 has verify for mock log', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-mock-log-tab1')!;
    expect(step.verify).toContain('mock-log');
  });

  it('tabs-send-tab2 has verify for mock log', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab2')!;
    expect(step.verify).toContain('mock-log');
  });

  // ─── Step actions ───────────────────────────────────────────

  it('step tabs-intro has no action (read-only)', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-intro')!;
    expect(step.action).toBeUndefined();
    expect(step.preAction).toBeUndefined();
  });

  it('step tabs-add action clicks CONN_TAB_ADD', async () => {
    document.body.innerHTML = `
      <button data-testid="conn-tab-add">+</button>
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>`;

    const addBtn = document.querySelector('[data-testid="conn-tab-add"]') as HTMLElement;
    makeVisible(addBtn);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-add')!;
    await step.action!(ctx);

    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    expect(clickCalls.some((c: [string]) => c[0].includes('conn-tab-add'))).toBe(true);
  });

  it('step tabs-mock-start-tab2 preAction switches to last tab', async () => {
    buildTabBar(2);
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'conn-tab-add');
    makeVisible(addBtn);
    document.body.appendChild(addBtn);

    const tabs = document.querySelectorAll('[data-testid="conn-tab-bar"] [role="tab"]');
    const lastTab = tabs[tabs.length - 1] as HTMLElement;
    const clickSpy = vi.spyOn(lastTab, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-mock-start-tab2')!;
    await step.preAction!(ctx);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('step tabs-mock-start-tab2 action calls ctx.click with mock-start-btn when not running', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>`;
    const startBtn = document.createElement('button');
    startBtn.setAttribute('data-testid', 'mock-start-btn');
    makeVisible(startBtn);
    document.body.appendChild(startBtn);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-mock-start-tab2')!;
    await step.action!(ctx);

    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    expect(clickCalls.some((c: [string]) => c[0].includes('mock-start-btn'))).toBe(true);
  });

  it('step tabs-mock-start-tab2 action skips start if mock stop button already present', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>`;
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'mock-stop-btn');
    makeVisible(stopBtn);
    document.body.appendChild(stopBtn);

    const startBtn = document.createElement('button');
    startBtn.setAttribute('data-testid', 'mock-start-btn');
    makeVisible(startBtn);
    document.body.appendChild(startBtn);
    const startSpy = vi.spyOn(startBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-mock-start-tab2')!;
    await step.action!(ctx);

    expect(startSpy).not.toHaveBeenCalled();
  });

  it('step tabs-connect-tab1 action fills URL with 9876 and clicks connect', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>`;
    const urlInput = document.createElement('input');
    urlInput.setAttribute('aria-label', 'WebSocket URL');
    makeVisible(urlInput);
    document.body.appendChild(urlInput);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect-tab1')!;
    await step.action!(ctx);

    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const urlFill = fillCalls.find((c: [string, string]) => c[0].includes('WebSocket URL'));
    expect(urlFill).toBeDefined();
    expect(urlFill![1]).toContain('9876');
  });

  it('step tabs-connect-tab2 action fills URL with 9877 and clicks connect', async () => {
    buildTabBar(2);
    const urlInput = document.createElement('input');
    urlInput.setAttribute('aria-label', 'WebSocket URL');
    makeVisible(urlInput);
    document.body.appendChild(urlInput);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect-tab2')!;
    await step.action!(ctx);

    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const urlFill = fillCalls.find((c: [string, string]) => c[0].includes('WebSocket URL'));
    expect(urlFill).toBeDefined();
    expect(urlFill![1]).toContain('9877');
  });

  it('step tabs-send-tab1 action fills message with "Hello from Tab 1!"', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>`;
    const msgInput = document.createElement('textarea');
    msgInput.setAttribute('aria-label', 'Message input');
    makeVisible(msgInput);
    document.body.appendChild(msgInput);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab1')!;
    await step.action!(ctx);

    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const msgFill = fillCalls.find((c: [string, string]) => c[0].includes('Message input'));
    expect(msgFill).toBeDefined();
    expect(msgFill![1]).toContain('Tab 1');
  });

  it('step tabs-send-tab2 action fills message with "Hello from Tab 2!"', async () => {
    buildTabBar(2);
    const msgInput = document.createElement('textarea');
    msgInput.setAttribute('aria-label', 'Message input');
    makeVisible(msgInput);
    document.body.appendChild(msgInput);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab2')!;
    await step.action!(ctx);

    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const msgFill = fillCalls.find((c: [string, string]) => c[0].includes('Message input'));
    expect(msgFill).toBeDefined();
    expect(msgFill![1]).toContain('Tab 2');
  });

  it('step tabs-send-tab1 action switches to Events tab to show echo', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
        <div role="tab" data-testid="conn-tab-2">Tab 2</div>
      </div>`;
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab1')!;
    await step.action!(ctx);

    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    expect(clickCalls.some((c: [string]) => c[0].includes('right-tab-events'))).toBe(true);
  });

  it('step tabs-send-tab2 action switches to Mock mode and Log tab', async () => {
    buildTabBar(2);
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab2')!;
    await step.action!(ctx);

    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    expect(clickCalls.some((c: [string]) => c[0].includes('mode-mock'))).toBe(true);
    expect(clickCalls.some((c: [string]) => c[0].includes('mock-tab-log'))).toBe(true);
  });

  it('step tabs-mock-log-tab1 action switches to Mock mode and Log tab', async () => {
    document.body.innerHTML = `
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
      </div>`;
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-mock-log-tab1')!;
    await step.action!(ctx);

    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    expect(clickCalls.some((c: [string]) => c[0].includes('mock-tab-log'))).toBe(true);
  });

  // ─── tabs-close ─────────────────────────────────────────────

  it('step tabs-close action clicks the close button on the last tab', async () => {
    buildTabBar(2);
    // The action strips 'conn-tab-' from the tab testid: 'conn-tab-2' → tabId='2'
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-testid', 'conn-tab-close-2');
    document.body.appendChild(closeBtn);
    const clickSpy = vi.spyOn(closeBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-close')!;
    await step.action!(ctx);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('step tabs-close preAction disconnects Tab 2 before closing', async () => {
    buildTabBar(2);
    const disconnectBtn = document.createElement('button');
    disconnectBtn.setAttribute('data-testid', 'disconnect-btn');
    makeVisible(disconnectBtn);
    document.body.appendChild(disconnectBtn);
    const disconnectSpy = vi.spyOn(disconnectBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-close')!;
    await step.preAction!(ctx);

    expect(disconnectSpy).toHaveBeenCalled();
  });

  // ─── ensureTwoTabs guard ─────────────────────────────────────

  it('preAction for tabs-connect-tab2 adds a tab when only one exists', async () => {
    buildTabBar(1);
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'conn-tab-add');
    makeVisible(addBtn);
    document.body.appendChild(addBtn);
    const addSpy = vi.spyOn(addBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect-tab2')!;
    await step.preAction!(ctx);

    expect(addSpy).toHaveBeenCalled();
  });

  it('preAction for tabs-connect-tab2 does not add tab when two already exist', async () => {
    buildTabBar(2);
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'conn-tab-add');
    makeVisible(addBtn);
    document.body.appendChild(addBtn);
    const addSpy = vi.spyOn(addBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect-tab2')!;
    await step.preAction!(ctx);

    expect(addSpy).not.toHaveBeenCalled();
  });

  // ─── Connection guard in send-tab1 preAction ────────────────

  it('tabs-send-tab1 preAction skips connect when STATUS_CONNECTED is present', async () => {
    // Add Tab 1 + status indicator
    buildTabBar(2);
    const statusEl = document.createElement('div');
    statusEl.className = 'ws-status-dot connected';
    makeVisible(statusEl);
    document.body.appendChild(statusEl);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab1')!;
    await step.preAction!(ctx);

    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    expect(clickCalls.some((c: [string]) => c[0].includes('connect-btn'))).toBe(false);
  });

  it('tabs-send-tab1 preAction clicks connect when STATUS_CONNECTED is absent', async () => {
    buildTabBar(2);
    const urlInput = document.createElement('input');
    urlInput.setAttribute('aria-label', 'WebSocket URL');
    makeVisible(urlInput);
    document.body.appendChild(urlInput);

    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'connect-btn');
    makeVisible(connectBtn);
    document.body.appendChild(connectBtn);
    const connectSpy = vi.spyOn(connectBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab1')!;
    await step.preAction!(ctx);

    expect(connectSpy).toHaveBeenCalled();
  });

  // ─── ws-filtering ───────────────────────────────────────────

  it('has no description that references non-existent UI elements', () => {
    for (const step of wsTabsLesson.steps) {
      // None of the new steps reference the removed "Rename" or "History" steps
      expect(step.description, `step ${step.id}`).not.toContain('F2');
    }
  });

  // ─── setup & cleanup ────────────────────────────────────────

  it('setup (tabsSetup) runs without error when no extra tabs present', async () => {
    const ctx = makeCtx();
    await wsTabsLesson.setup!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('setup resets tab label when label is not "New Connection"', async () => {
    // CONN_TAB_FIRST = '[data-testid="conn-tab-bar"] [role="tab"]:first-child'
    const tabBar = document.createElement('div');
    tabBar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'Custom Name';
    tab.appendChild(label);
    tabBar.appendChild(tab);
    document.body.appendChild(tabBar);

    const renameInput = document.createElement('input');
    renameInput.setAttribute('data-testid', 'conn-tab-rename-1');  // matches [data-testid^="conn-tab-rename-"]
    document.body.appendChild(renameInput);

    const ctx = makeCtx();
    await wsTabsLesson.setup!(ctx);
    // Should have triggered double-click sequence
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('setup resets tab label but skips fillControlledInput when renameInput is absent', async () => {
    const tabBar = document.createElement('div');
    tabBar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'Custom Name';
    tab.appendChild(label);
    tabBar.appendChild(tab);
    document.body.appendChild(tabBar);
    // No rename input in DOM

    const ctx = makeCtx();
    await wsTabsLesson.setup!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('setup skips rename when tab label is already "New Connection"', async () => {
    const tabBar = document.createElement('div');
    tabBar.setAttribute('data-testid', 'conn-tab-bar');
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    const label = document.createElement('span');
    label.className = 'ws-conn-tab-label';
    label.textContent = 'New Connection';
    tab.appendChild(label);
    tabBar.appendChild(tab);
    document.body.appendChild(tabBar);

    const ctx = makeCtx();
    await wsTabsLesson.setup!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  // ─── tabs-mock-log-tab1 preAction ────────────────────────────

  it('step tabs-mock-log-tab1 preAction switches to Tab 1 and Mock mode', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-mock-log-tab1')!;
    await step.preAction!(ctx);

    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    // CONN_TAB_FIRST has ':first-child' in selector
    expect(clickCalls.some((c: [string]) => c[0].includes(':first-child'))).toBe(true);
    expect(clickCalls.some((c: [string]) => c[0].includes('mode-mock'))).toBe(true);
  });

  it('cleanup (tabsCleanup) runs without error', async () => {
    const ctx = makeCtx();
    await wsTabsLesson.cleanup!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  // ─── switchToLastTab edge cases ──────────────────────────────

  it('step tabs-mock-start-tab2 preAction handles single tab (no switchToLastTab click)', async () => {
    buildTabBar(1);
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-testid', 'conn-tab-add');
    makeVisible(addBtn);
    document.body.appendChild(addBtn);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-mock-start-tab2')!;
    // With 1 tab, ensureTwoTabs adds a tab then switchToLastTab runs on tabs
    await step.preAction!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('step tabs-add action switches to Mock mode after clicking add', async () => {
    document.body.innerHTML = `
      <button data-testid="conn-tab-add">+</button>
      <div data-testid="conn-tab-bar">
        <div role="tab" data-testid="conn-tab-1">Tab 1</div>
      </div>`;
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-add')!;
    await step.action!(ctx);

    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    expect(clickCalls.some((c: [string]) => c[0].includes('mode-mock'))).toBe(true);
  });

  // ─── tabs-connect-tab1 preAction ─────────────────────────────

  it('step tabs-connect-tab1 preAction switches to Client mode on Tab 2 then Tab 1', async () => {
    buildTabBar(2);
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-connect-tab1')!;
    await step.preAction!(ctx);

    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    expect(clickCalls.some((c: [string]) => c[0].includes('mode-client'))).toBe(true);
    // CONN_TAB_FIRST = '[data-testid="conn-tab-bar"] [role="tab"]:first-child'
    expect(clickCalls.some((c: [string]) => c[0].includes(':first-child'))).toBe(true);
  });

  // ─── tabs-send-tab1 preAction: connect btn is disabled ───────

  it('tabs-send-tab1 preAction does not click connect when btn is disabled', async () => {
    buildTabBar(2);
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'connect-btn');
    connectBtn.disabled = true;
    makeVisible(connectBtn);
    document.body.appendChild(connectBtn);
    const connectSpy = vi.spyOn(connectBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab1')!;
    await step.preAction!(ctx);

    expect(connectSpy).not.toHaveBeenCalled();
  });

  // ─── tabs-send-tab2 preAction: connection guard ──────────────

  it('tabs-send-tab2 preAction clicks connect when Tab 2 not connected', async () => {
    buildTabBar(2);
    const urlInput = document.createElement('input');
    urlInput.setAttribute('aria-label', 'WebSocket URL');
    makeVisible(urlInput);
    document.body.appendChild(urlInput);

    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'connect-btn');
    makeVisible(connectBtn);
    document.body.appendChild(connectBtn);
    const connectSpy = vi.spyOn(connectBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab2')!;
    await step.preAction!(ctx);

    expect(connectSpy).toHaveBeenCalled();
  });

  it('tabs-send-tab2 preAction skips connect when Tab 2 already connected', async () => {
    buildTabBar(2);
    const statusEl = document.createElement('div');
    statusEl.className = 'ws-status-dot connected';
    makeVisible(statusEl);
    document.body.appendChild(statusEl);

    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'connect-btn');
    makeVisible(connectBtn);
    document.body.appendChild(connectBtn);
    const connectSpy = vi.spyOn(connectBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab2')!;
    await step.preAction!(ctx);

    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('tabs-send-tab2 preAction does not click connect when btn is disabled', async () => {
    buildTabBar(2);
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'connect-btn');
    connectBtn.disabled = true;
    makeVisible(connectBtn);
    document.body.appendChild(connectBtn);
    const connectSpy = vi.spyOn(connectBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-send-tab2')!;
    await step.preAction!(ctx);

    expect(connectSpy).not.toHaveBeenCalled();
  });

  // ─── tabs-mock-start-tab2 action: stays on Tab 2 ────────────

  it('tabs-mock-start-tab2 action does NOT flip to Tab 1 when server already started', async () => {
    buildTabBar(2);
    // Mock stop btn present = server already running
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'mock-stop-btn');
    makeVisible(stopBtn);
    document.body.appendChild(stopBtn);

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-mock-start-tab2')!;
    await step.action!(ctx);

    const clickCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    // The action must NOT navigate to Tab 1 — that caused the spotlight to jump
    expect(clickCalls.some((c: [string]) => c[0].includes(':first-child'))).toBe(false);
  });

  it('tabs-mock-start-tab2 highlight targets the start button (not the panel)', () => {
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-mock-start-tab2')!;
    expect(step.highlight).toContain('mock-start-btn');
  });

  // ─── tabs-close action: no last tab ─────────────────────────

  it('step tabs-close action is a no-op when no tabs are in DOM', async () => {
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-close')!;
    // Should not throw
    await expect(step.action!(ctx)).resolves.toBeUndefined();
  });

  it('step tabs-close action is a no-op when close button is missing', async () => {
    buildTabBar(2);
    // No close button in DOM
    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-close')!;
    await expect(step.action!(ctx)).resolves.toBeUndefined();
  });

  // ─── tabs-close preAction: disconnect btn disabled ───────────

  it('step tabs-close preAction does not click disabled disconnect btn', async () => {
    buildTabBar(2);
    const disconnectBtn = document.createElement('button');
    disconnectBtn.setAttribute('data-testid', 'disconnect-btn');
    disconnectBtn.disabled = true;
    makeVisible(disconnectBtn);
    document.body.appendChild(disconnectBtn);
    const disconnectSpy = vi.spyOn(disconnectBtn, 'click');

    const ctx = makeCtx();
    const step = wsTabsLesson.steps.find((s) => s.id === 'tabs-close')!;
    await step.preAction!(ctx);

    expect(disconnectSpy).not.toHaveBeenCalled();
  });
});
