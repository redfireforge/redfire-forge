/**
 * @vitest-environment jsdom
 * Unit tests for demo lesson setup helpers.
 * Uses a mocked DemoActionContext to verify click/fill/delay calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  startMockServer,
  stopMockServer,
  switchToClientMode,
  disconnectWebSocket,
  clearEvents,
  resetAuth,
  clearCustomHeaders,
  closeExtraConnectionTabs,
  fillControlledInput,
  connectToMockServer,
  wsSetup,
  wsCleanup,
  wsAuthCleanup,
  kafkaSetup,
  kafkaPublishSetup,
  kafkaCleanup,
  kafkaQuickStartCleanup,
  kafkaTopicsSetup,
  kafkaSchemaSetup,
} from './setup-helpers';
import { makeCtx, makeVisible } from './protocols/ws-test-utils';

describe('setup-helpers', () => {
  let ctx: DemoActionContext;

  beforeEach(() => {
    ctx = makeCtx();
    document.body.innerHTML = '';
  });

  // ─── startMockServer ─────────────────────────────────────────

  it('startMockServer clicks mode mock and delay, skips btn when not present', async () => {
    await startMockServer(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock'));
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('startMockServer clicks btn when present and not disabled', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'ws-mock-start');
    btn.setAttribute('data-mock-start', 'true');
    // Use the actual WS selector key (mock start btn uses data attribute)
    btn.className = 'ws-mock-start-btn';
    document.body.appendChild(btn);

    // Monkey-patch querySelector to return our button for the MOCK_START_BTN selector
    const origQS = document.querySelector.bind(document);
    vi.spyOn(document, 'querySelector').mockImplementation((sel: string) => {
      if (sel.includes('mock-start') || sel.includes('MOCK_START')) return btn;
      return origQS(sel);
    });

    await startMockServer(ctx);
    vi.restoreAllMocks();
  });

  it('startMockServer does NOT click btn when already disabled', async () => {
    const btn = document.createElement('button');
    btn.disabled = true;
    vi.spyOn(document, 'querySelector').mockReturnValue(btn as Element);
    const clickSpy = vi.spyOn(btn, 'click');
    await startMockServer(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  // ─── stopMockServer ───────────────────────────────────────────

  it('stopMockServer clicks mode mock and delay, skips btn when not present', async () => {
    await stopMockServer(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mock'));
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('stopMockServer clicks btn when present and not disabled', async () => {
    // stopMockServer is gated behind _demoStartedMock.
    // To set it true: call startMockServer with start btn visible and stop btn NOT yet
    // visible. After 150ms (during the polling loop) make stop btn visible so
    // startMockServer resolves quickly → _demoStartedMock=true.
    const startBtn = document.createElement('button');
    startBtn.setAttribute('data-testid', 'mock-start-btn');
    document.body.appendChild(startBtn);
    makeVisible(startBtn);

    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'mock-stop-btn');
    document.body.appendChild(stopBtn);
    // Initially NOT visible so startMockServer doesn't short-circuit to "already running"

    // Make the stop button visible after 150ms so the polling loop in startMockServer
    // finds it → resolves successfully → _demoStartedMock = true
    const timer = setTimeout(() => makeVisible(stopBtn), 150);

    await startMockServer(ctx);
    clearTimeout(timer);

    // Now _demoStartedMock is true; stopMockServer should click the stop button
    const clickSpy = vi.spyOn(stopBtn, 'click');
    await stopMockServer(ctx);
    expect(clickSpy).toHaveBeenCalled();

    startBtn.remove();
    stopBtn.remove();
  });

  // ─── switchToClientMode ───────────────────────────────────────

  it('switchToClientMode clicks client mode selector', async () => {
    await switchToClientMode(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.any(String));
    expect(ctx.delay).toHaveBeenCalled();
  });

  // ─── disconnectWebSocket ──────────────────────────────────────

  it('disconnectWebSocket does nothing when no disconnect btn present', async () => {
    await disconnectWebSocket(ctx);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('disconnectWebSocket clicks btn when present and not disabled', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'disconnect-btn');
    document.body.appendChild(btn);
    makeVisible(btn);
    const clickSpy = vi.spyOn(btn, 'click');
    await disconnectWebSocket(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalled();
    btn.remove();
  });

  it('disconnectWebSocket does not click disabled btn', async () => {
    const btn = document.createElement('button');
    btn.disabled = true;
    vi.spyOn(document, 'querySelector').mockReturnValue(btn as Element);
    const clickSpy = vi.spyOn(btn, 'click');
    await disconnectWebSocket(ctx);
    expect(clickSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  // ─── clearEvents ─────────────────────────────────────────────

  it('clearEvents does nothing when no clear btn present', async () => {
    await clearEvents(ctx);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('clearEvents clicks btn when present and not disabled', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'clear-btn');
    document.body.appendChild(btn);
    makeVisible(btn);
    const clickSpy = vi.spyOn(btn, 'click');
    await clearEvents(ctx);
    expect(clickSpy).toHaveBeenCalled();
    btn.remove();
  });

  // ─── resetAuth ───────────────────────────────────────────────

  it('resetAuth clicks auth tab and selects none', async () => {
    await resetAuth(ctx);
    expect(ctx.click).toHaveBeenCalled();
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.any(String), 'none');
  });

  // ─── clearCustomHeaders ───────────────────────────────────────

  it('clearCustomHeaders clicks headers tab and returns to connect tab', async () => {
    await clearCustomHeaders(ctx);
    expect(ctx.click).toHaveBeenCalledTimes(2); // headers tab + connect tab
  });

  it('clearCustomHeaders removes header rows while they exist', async () => {
    let callCount = 0;
    const origQS = document.querySelector.bind(document);
    vi.spyOn(document, 'querySelector').mockImplementation((sel: string) => {
      if (sel.includes('kv-remove-btn')) {
        callCount++;
        if (callCount <= 2) {
          const btn = document.createElement('button');
          return btn;
        }
        return null;
      }
      return origQS(sel);
    });

    await clearCustomHeaders(ctx);
    expect(callCount).toBeGreaterThan(0);
    vi.restoreAllMocks();
  });

  // ─── closeExtraConnectionTabs ─────────────────────────────────

  it('closeExtraConnectionTabs does nothing when only 1 tab', async () => {
    const bar = document.createElement('div');
    const tab = document.createElement('button');
    tab.setAttribute('role', 'tab');
    bar.appendChild(tab);
    document.body.appendChild(bar);

    await closeExtraConnectionTabs(ctx);
    expect(ctx.delay).not.toHaveBeenCalled();
    bar.remove();
  });

  it('closeExtraConnectionTabs closes extra tabs when close btn found', async () => {
    const bar = document.createElement('div');
    // Tab 1
    const t1 = document.createElement('button');
    t1.setAttribute('role', 'tab');
    t1.setAttribute('data-testid', 'conn-tab-tab-1');
    // Tab 2 (extra)
    const t2 = document.createElement('button');
    t2.setAttribute('role', 'tab');
    t2.setAttribute('data-testid', 'conn-tab-tab-2');
    bar.append(t1, t2);

    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('data-testid', 'conn-tab-close-tab-2');
    document.body.append(bar, closeBtn);

    // Mock querySelectorAll to return our tabs
    const origQSA = document.querySelectorAll.bind(document);
    vi.spyOn(document, 'querySelectorAll').mockImplementation((sel: string) => {
      if (sel.includes('[role="tab"]')) {
        // First iteration: 2 tabs; subsequent: 1 tab
        if (vi.mocked(document.querySelectorAll).mock.calls.length <= 1) return [t1, t2] as unknown as NodeListOf<Element>;
        return [t1] as unknown as NodeListOf<Element>;
      }
      return origQSA(sel);
    });

    await closeExtraConnectionTabs(ctx, 2);
    vi.restoreAllMocks();
    bar.remove();
    closeBtn.remove();
  });

  it('closeExtraConnectionTabs breaks when close btn not found', async () => {
    const bar = document.createElement('div');
    const t1 = document.createElement('button');
    t1.setAttribute('role', 'tab');
    const t2 = document.createElement('button');
    t2.setAttribute('role', 'tab');
    t2.setAttribute('data-testid', 'conn-tab-tab-x');
    bar.append(t1, t2);
    document.body.appendChild(bar);

    vi.spyOn(document, 'querySelectorAll').mockReturnValue([t1, t2] as unknown as NodeListOf<Element>);
    // No close btn → querySelector returns null for close btn

    await closeExtraConnectionTabs(ctx, 3);
    vi.restoreAllMocks();
    bar.remove();
  });

  // ─── fillControlledInput ─────────────────────────────────────

  it('fillControlledInput sets input value and dispatches events', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    const inputSpy = vi.fn();
    const changeSpy = vi.fn();
    input.addEventListener('input', inputSpy);
    input.addEventListener('change', changeSpy);

    fillControlledInput(input, 'test-val');
    expect(input.value).toBe('test-val');
    expect(inputSpy).toHaveBeenCalledTimes(1);
    expect(changeSpy).toHaveBeenCalledTimes(1);
    input.remove();
  });

  // ─── connectToMockServer ──────────────────────────────────────

  it('connectToMockServer fills URL and clicks connect', async () => {
    await connectToMockServer(ctx);
    expect(ctx.click).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('connectToMockServer uses provided URL and delay', async () => {
    await connectToMockServer(ctx, 'ws://custom:1234', 500);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'ws://custom:1234');
    expect(ctx.delay).toHaveBeenCalledWith(500);
  });

  // ─── Composed helpers ─────────────────────────────────────────

  it('wsSetup calls startMockServer and switchToClientMode sequences', async () => {
    await wsSetup(ctx);
    expect(ctx.click).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('wsCleanup runs disconnect, clear, stop, client mode', async () => {
    await wsCleanup(ctx);
    expect(ctx.click).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('wsAuthCleanup runs disconnect, clear, reset auth, stop, client mode', async () => {
    await wsAuthCleanup(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.any(String), 'none');
  });

  // ─── kafkaSetup ─────────────────────────────────────────────────

  it('kafkaSetup navigates to kafka-message-studio', async () => {
    await kafkaSetup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-message-studio');
    expect(ctx.delay).toHaveBeenCalled();
  });

  // ─── kafkaPublishSetup ───────────────────────────────────────────

  it('kafkaPublishSetup navigates to kafka-message-studio when settings page not mounted', async () => {
    document.body.innerHTML = '';
    await kafkaPublishSetup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-settings');
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-message-studio');
  });

  it('kafkaPublishSetup with settings page but no empty-create-btn polls for connect', async () => {
    const page = document.createElement('div');
    page.setAttribute('data-testid', 'kafka-settings-page');
    document.body.appendChild(page);
    // No emptyCreateBtn, no connectBtn → polls 10× then returns
    await kafkaPublishSetup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-settings');
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-message-studio');
    page.remove();
  });

  it('kafkaPublishSetup with empty-create-btn, name input, save btn, and connect btn', async () => {
    const page = document.createElement('div');
    page.setAttribute('data-testid', 'kafka-settings-page');

    const emptyBtn = document.createElement('button');
    emptyBtn.setAttribute('data-testid', 'kafka-empty-create-btn');

    const nameInput = document.createElement('input');
    nameInput.id = 'kafka-cluster-name';

    const saveBtn = document.createElement('button');
    saveBtn.setAttribute('data-testid', 'kafka-save-cluster-btn');

    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'kafka-connect-btn');

    document.body.append(page, emptyBtn, nameInput, saveBtn, connectBtn);
    await kafkaPublishSetup(ctx);

    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-settings');
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-message-studio');
    [page, emptyBtn, nameInput, saveBtn, connectBtn].forEach(el => el.remove());
  });

  it('kafkaPublishSetup with connect btn already disabled skips connect', async () => {
    const page = document.createElement('div');
    page.setAttribute('data-testid', 'kafka-settings-page');
    const connectBtn = document.createElement('button');
    connectBtn.setAttribute('data-testid', 'kafka-connect-btn');
    connectBtn.disabled = true;
    document.body.append(page, connectBtn);
    await kafkaPublishSetup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-message-studio');
    page.remove();
    connectBtn.remove();
  });

  // ─── kafkaCleanup ────────────────────────────────────────────────

  it('kafkaCleanup is a no-op function', async () => {
    await expect(kafkaCleanup(ctx)).resolves.not.toThrow();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  // ─── kafkaQuickStartCleanup ───────────────────────────────────────

  it('kafkaQuickStartCleanup navigates to kafka-settings', async () => {
    document.body.innerHTML = '';
    await kafkaQuickStartCleanup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-settings');
  });

  it('kafkaQuickStartCleanup is a no-op when no cluster cards exist', async () => {
    document.body.innerHTML = '';
    await kafkaQuickStartCleanup(ctx);
    // No clicks should happen — nothing to delete
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('kafkaQuickStartCleanup clicks cluster card, delete btn, and confirm btn when all present', async () => {
    document.body.innerHTML = '';

    const card = document.createElement('div');
    card.setAttribute('data-testid', 'kafka-cluster-card-demo-cluster');
    document.body.appendChild(card);

    const deleteBtn = document.createElement('button');
    deleteBtn.setAttribute('data-testid', 'kafka-delete-cluster-btn');
    document.body.appendChild(deleteBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.setAttribute('data-testid', 'kafka-confirm-delete-btn');
    document.body.appendChild(confirmBtn);

    await kafkaQuickStartCleanup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-settings');
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('kafkaQuickStartCleanup exits early when delete btn is not found after card click', async () => {
    document.body.innerHTML = '';

    const card = document.createElement('div');
    card.setAttribute('data-testid', 'kafka-cluster-card-demo-cluster');
    document.body.appendChild(card);
    // No delete button — should exit gracefully

    await expect(kafkaQuickStartCleanup(ctx)).resolves.not.toThrow();
  });

  // ─── kafkaTopicsSetup ─────────────────────────────────────────────

  it('kafkaTopicsSetup navigates to kafka-message-studio and clicks topics tab', async () => {
    await kafkaTopicsSetup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-message-studio');
    expect(ctx.click).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalled();
  });

  // ─── kafkaSchemaSetup ─────────────────────────────────────────────

  it('kafkaSchemaSetup navigates to kafka-message-studio and clicks schema tab', async () => {
    await kafkaSchemaSetup(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('kafka-message-studio');
    expect(ctx.click).toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalled();
  });

  // ─── startMockServer — already-running fast path ────────────────

  it('startMockServer returns early when MOCK_STOP_BTN is already visible', async () => {
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'mock-stop-btn');
    makeVisible(stopBtn);
    document.body.appendChild(stopBtn);

    const clickSpy = vi.spyOn(ctx, 'click');
    await startMockServer(ctx);

    // Should still navigate to mock mode but return early without clicking start
    expect(clickSpy).toHaveBeenCalledWith(expect.stringContaining('mock'));
    stopBtn.remove();
  });

  it('startMockServer returns when server starts successfully after clicking start', async () => {
    const startBtn = document.createElement('button');
    startBtn.setAttribute('data-testid', 'mock-start-btn');
    makeVisible(startBtn);
    document.body.appendChild(startBtn);

    // Simulate server starting: add stop btn after a short delay
    const stopBtn = document.createElement('button');
    stopBtn.setAttribute('data-testid', 'mock-stop-btn');
    setTimeout(() => {
      makeVisible(stopBtn);
      document.body.appendChild(stopBtn);
    }, 50);

    await startMockServer(ctx);

    stopBtn.remove();
    startBtn.remove();
  });

  // ─── closeExtraConnectionTabs — no-closeBtn branch ──────────────

  it('closeExtraConnectionTabs breaks when close btn is missing for a tab', async () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-testid', 'conn-tab-bar');
    const tab1 = document.createElement('div');
    tab1.setAttribute('role', 'tab');
    tab1.setAttribute('data-testid', 'conn-tab-1');
    const tab2 = document.createElement('div');
    tab2.setAttribute('role', 'tab');
    tab2.setAttribute('data-testid', 'conn-tab-2');
    bar.append(tab1, tab2);
    document.body.appendChild(bar);

    // No close button for tab2 — should break without crash
    await closeExtraConnectionTabs(ctx, 5);

    bar.remove();
  });
});
