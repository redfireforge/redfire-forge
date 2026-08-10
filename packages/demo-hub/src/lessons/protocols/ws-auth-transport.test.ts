/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsAuthTransportLesson } from './ws-auth-transport';
import { makeCtx, makeVisible } from './ws-test-utils';

vi.mock('../../demoRipple', () => ({
  showSpotlightRing: () => vi.fn(),
}));

describe('ws-auth-transport lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsAuthTransportLesson.id).toBe('ws-auth-transport');
    expect(wsAuthTransportLesson.domainId).toBe('protocols');
    expect(wsAuthTransportLesson.name).toBe('Auth & Transport');
    expect(wsAuthTransportLesson.steps.length).toBeGreaterThan(0);
    expect(wsAuthTransportLesson.concept.title).toBeTruthy();
    expect(wsAuthTransportLesson.concept.body).toBeTruthy();
    expect(wsAuthTransportLesson.initialTab).toBe('websocket-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsAuthTransportLesson.setup).toBe('function');
    expect(typeof wsAuthTransportLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsAuthTransportLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('has key terms about transport modes', () => {
    const terms = wsAuthTransportLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    const termIds = terms!.map(t => t.term);
    expect(termIds).toContain('Direct');
    expect(termIds).toContain('Proxy');
    expect(termIds).toContain('Native');
  });

  it('has category set', () => {
    expect(wsAuthTransportLesson.category).toBe('websocket');
  });

  // ── auth-intro ───────────────────────────────────────────────
  it('step auth-intro preAction switches to Client mode before Auth spotlight', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-intro')!;
    expect(step.preAction).toBeTypeOf('function');
    const clientBtn = document.createElement('button');
    clientBtn.setAttribute('data-testid', 'mode-client');
    makeVisible(clientBtn);
    document.body.appendChild(clientBtn);
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  it('step auth-intro action clicks auth tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-auth'));
  });

  // ── auth-type-selector ───────────────────────────────────────
  it('step auth-type-selector highlights the auth type trigger', () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-type-selector')!;
    expect(step.highlight).toContain('ws-auth-type-trigger');
  });

  it('step auth-type-selector preAction clicks auth tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-type-selector')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-auth'));
  });

  it('step auth-type-selector preAction resets type to none when not already none', async () => {
    const pane = document.createElement('div');
    pane.className = 'auth-type-select';
    const sel = document.createElement('select');
    Object.defineProperty(sel, 'value', { value: 'bearer', writable: true, configurable: true });
    pane.appendChild(sel);
    document.body.appendChild(pane);
    makeVisible(sel);

    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-type-selector')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.any(String), 'none');
  });

  it('step auth-type-selector action opens dropdown, spotlights the full menu, then clicks Bearer', async () => {
    const pane = document.createElement('div');
    pane.className = 'ws-auth-pane';
    const menu = document.createElement('div');
    menu.className = 'auth-type-menu';
    const bearerOpt = document.createElement('button');
    bearerOpt.setAttribute('data-testid', 'ws-auth-type-opt-bearer');
    menu.appendChild(bearerOpt);
    pane.appendChild(menu);
    document.body.appendChild(pane);

    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-type-selector')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('ws-auth-type-trigger'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-auth-type-opt-bearer'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('ws-auth-type-opt-bearer'));
    expect(ctx.delay).toHaveBeenCalledWith(1800); // full-menu spotlight
    expect(ctx.delay).toHaveBeenCalledWith(800); // after Bearer click
  });

  // ── auth-bearer ──────────────────────────────────────────────
  it('step auth-bearer has preAction that navigates to auth tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-bearer')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-auth'));
  });

  it('step auth-bearer preAction selects bearer when not already selected', async () => {
    const sel = document.createElement('select');
    sel.className = 'auth-type-select';
    const inner = document.createElement('select');
    const pane = document.createElement('div');
    pane.className = 'auth-type-select';
    pane.appendChild(inner);
    document.body.appendChild(pane);

    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-bearer')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(expect.any(String), 'bearer');
    document.body.removeChild(pane);
    void sel;
  });

  it('step auth-bearer action uses ctx.fill with auth pane selector', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-bearer')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-auth-pane'),
      expect.stringContaining('demo-token'),
    );
  });

  it('step auth-bearer action does not throw when input is absent', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-bearer')!;
    const ctx = makeCtx();
    await expect(step.action!(ctx)).resolves.toBeUndefined();
  });

  // ── auth-callout ─────────────────────────────────────────────
  it('step auth-callout has preAction that ensures bearer auth', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-callout')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-auth'));
  });

  it('step auth-callout has no action', () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-callout')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toBeTruthy();
  });

  // ── auth-connect-setup ───────────────────────────────────────
  it('step auth-connect-setup preAction clicks connect tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-connect-setup')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step auth-connect-setup action fills URL', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-connect-setup')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), 'ws://localhost:9876');
  });

  // ── auth-connect ─────────────────────────────────────────────
  it('step auth-connect preAction clicks connect tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-connect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step auth-connect action clicks connect button when not connected', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-connect')!;
    const ctx = makeCtx();
    // No .ws-status-dot.connected in DOM → should click connect and waitFor
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('connect-btn'));
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('connected'), expect.any(Number));
  });

  it('step auth-connect action skips click when already connected', async () => {
    const dot = document.createElement('div');
    dot.className = 'ws-status-dot connected';
    document.body.appendChild(dot);
    makeVisible(dot);

    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // click should NOT have been called with connect-btn (guard prevents double-click)
    const connectCalls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls;
    expect(connectCalls.some((args: unknown[]) => String(args[0]).includes('connect-btn'))).toBe(false);

    document.body.removeChild(dot);
  });

  it('step auth-connect has verify selector', () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-connect')!;
    expect(step.verify).toBeTruthy();
  });

  // ── auth-compose-send ────────────────────────────────────────
  it('step auth-compose-send preAction navigates to compose tab', async () => {
    // Provide a connected status dot so ensureConnected skips setup
    const dot = document.createElement('div');
    dot.className = 'ws-status-dot connected';
    document.body.appendChild(dot);

    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));

    document.body.removeChild(dot);
  });

  it('step auth-compose-send preAction runs ensureConnected when not connected', async () => {
    // No connected dot → ensureConnected should attempt auth + connect
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Auth setup path: clicks auth tab, then connect tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-auth'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
    // Finally navigates to compose tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-send'));
  });

  it('ensureConnected fills token when auth input exists with empty value', async () => {
    // Provide an empty token input → covers lines 56-60 (tokenInput && !tokenInput.value)
    const select = document.createElement('select');
    select.className = 'auth-type-select';
    const inner = document.createElement('select');
    inner.value = 'bearer';
    select.appendChild(inner);
    document.body.appendChild(select);
    makeVisible(select);

    const wrapper = document.createElement('div');
    wrapper.className = 'ws-auth-pane';
    const input = document.createElement('input');
    // leave input.value = '' so the branch fires
    wrapper.appendChild(input);
    document.body.appendChild(wrapper);
    makeVisible(wrapper);
    makeVisible(input);

    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // After the function runs the input should have been filled via nativeSet
    expect(input.value).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo-token');
  });

  it('ensureConnected clicks connectBtn when it exists and is not disabled', async () => {
    // Provide a select with bearer already selected (skip selectOption branch)
    const authPane = document.createElement('div');
    authPane.className = 'auth-type-select';
    const sel = document.createElement('select');
    sel.value = 'bearer';
    authPane.appendChild(sel);
    document.body.appendChild(authPane);
    makeVisible(authPane);

    // Provide a filled token input (skip nativeSet branch)
    const pane = document.createElement('div');
    pane.className = 'ws-auth-pane';
    const input = document.createElement('input');
    Object.defineProperty(input, 'value', { get: () => 'existing-token', configurable: true });
    pane.appendChild(input);
    document.body.appendChild(pane);
    makeVisible(pane);
    makeVisible(input);

    // Provide a non-disabled connect button → covers lines 70-71
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'connect-btn');
    btn.disabled = false;
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);
    document.body.appendChild(btn);
    makeVisible(btn);

    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('connected'), 3000);
  });

  it('step auth-compose-send action fills message and clicks send', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('greet'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('send-btn'));
  });

  it('step auth-compose-send has verify selector', () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    expect(step.verify).toBeTruthy();
  });

  it('step auth-compose-send highlights compose tab', () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-compose-send')!;
    expect(step.highlight).toContain('send');
  });

  // ── auth-events ──────────────────────────────────────────────
  it('step auth-events action clicks events tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-events')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-events'));
  });

  // ── auth-protocol ────────────────────────────────────────────
  it('step auth-protocol preAction clicks connect tab', async () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-protocol')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('left-tab-connect'));
  });

  it('step auth-protocol has no action', () => {
    const step = wsAuthTransportLesson.steps.find(s => s.id === 'auth-protocol')!;
    expect(step.action).toBeUndefined();
  });

  // ── meta ─────────────────────────────────────────────────────
  it('has correct step IDs in order', () => {
    const ids = wsAuthTransportLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'auth-intro', 'auth-type-selector', 'auth-bearer', 'auth-callout',
      'auth-connect-setup', 'auth-connect', 'auth-compose-send',
      'auth-events', 'auth-protocol',
    ]);
  });

  it('has TLS key term', () => {
    const terms = wsAuthTransportLesson.concept.keyTerms!;
    expect(terms.some(t => t.term === 'TLS')).toBe(true);
  });

  it('has a diagram', () => {
    expect(wsAuthTransportLesson.concept.diagram).toBeTruthy();
  });

  it('estimated time is 4 minutes', () => {
    expect(wsAuthTransportLesson.estimatedMinutes).toBe(4);
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of wsAuthTransportLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('setup disconnects, clears events, resets auth, and starts mock server', async () => {
    const ctx = makeCtx();
    await wsAuthTransportLesson.setup!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });
});

// ─── ws-mock-server ─────────────────────────────────────────────

