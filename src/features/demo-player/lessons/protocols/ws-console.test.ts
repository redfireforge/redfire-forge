/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsConsoleLesson } from './ws-console';
import { makeCtx } from './ws-test-utils';

describe('ws-console lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsConsoleLesson.id).toBe('ws-console');
    expect(wsConsoleLesson.domainId).toBe('protocols');
    expect(wsConsoleLesson.category).toBe('websocket');
    expect(wsConsoleLesson.name).toBe('Console & Debugging');
    expect(wsConsoleLesson.steps.length).toBe(9);
    expect(wsConsoleLesson.concept.title).toBeTruthy();
    expect(wsConsoleLesson.concept.body).toBeTruthy();
    expect(wsConsoleLesson.initialTab).toBe('websocket-studio');
  });

  it('has both setup and cleanup', () => {
    expect(typeof wsConsoleLesson.setup).toBe('function');
    expect(typeof wsConsoleLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsConsoleLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('has key terms defined', () => {
    expect(wsConsoleLesson.concept.keyTerms).toBeDefined();
    expect(wsConsoleLesson.concept.keyTerms!.length).toBe(3);
    const termNames = wsConsoleLesson.concept.keyTerms!.map(t => t.term);
    expect(termNames).toContain('Lifecycle Event');
    expect(termNames).toContain('Slash Command');
    expect(termNames).toContain('Category Filter');
  });

  it('has a diagram', () => {
    expect(wsConsoleLesson.concept.diagram).toBeTruthy();
  });

  it('estimated time is 3 minutes', () => {
    expect(wsConsoleLesson.estimatedMinutes).toBe(3);
  });

  it('has correct step IDs in order', () => {
    const ids = wsConsoleLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'console-intro', 'console-connect', 'console-lifecycle', 'console-categories',
      'console-send', 'console-help', 'console-clear',
      'console-search', 'console-views',
    ]);
  });

  // ─── Step: console-intro ────────────────────────────────────

  it('step console-intro preAction switches to client mode', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-intro')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
    expect(ctx.delay).toHaveBeenCalledWith(200);
  });

  it('step console-connect preAction ensures console tab and structured view', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-connect')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('ws-console-view-structured'));
  });

  it('step console-intro action clicks console tab', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
  });

  it('step console-intro highlights the console tab', () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-intro')!;
    expect(step.highlight).toContain('right-tab-console');
  });

  // ─── Step: console-connect ──────────────────────────────────

  it('step console-connect action skips Enter dispatch when input absent from DOM (line 124 false branch)', async () => {
    // DOM is empty — querySelector returns null → if (input) is false → line 125 not reached
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-connect')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/connect ws://localhost:9876',
    );
    // No throw expected — the null-guard on line 124 safely skips dispatch
  });

  it('step console-connect fills /connect command and submits', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-connect')!;
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/connect ws://localhost:9876',
    );
    // Must use waitFor for connection timing, not a fixed delay (Rule 5).
    // Waits for a CONSOLE_ENTRY because STATUS_CONNECTED lives inside the Connect
    // panel which is unmounted when Send tab is active after connection.
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-console-entry'), expect.any(Number));
  });

  it('step console-connect dispatches Enter key on input', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-connect')!;
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);
    const spy = vi.spyOn(input, 'dispatchEvent');

    const ctx = makeCtx();
    await step.action!(ctx);
    const enterCalls = spy.mock.calls.filter(
      c => c[0] instanceof KeyboardEvent && (c[0] as KeyboardEvent).key === 'Enter',
    );
    expect(enterCalls.length).toBe(1);
  });

  it('step console-connect action sets _consoleConnected so subsequent preActions skip /connect', async () => {
    // After step 2 action runs, the module flag must be true.
    // Verify by running step 3 preAction afterwards — fill must NOT be called again.
    const connectStep = wsConsoleLesson.steps.find(s => s.id === 'console-connect')!;
    const lifecycleStep = wsConsoleLesson.steps.find(s => s.id === 'console-lifecycle')!;
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);

    const ctx = makeCtx();
    // Reset session flag first
    await wsConsoleLesson.setup!(ctx);
    ctx.fill.mockClear();
    ctx.waitFor.mockClear();

    // Run step 2 action — should connect and set flag
    await connectStep.action!(ctx);
    ctx.fill.mockClear();
    ctx.waitFor.mockClear();

    // Run step 3 preAction — must NOT call fill('/connect ...') again
    await lifecycleStep.preAction!(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/connect ws://localhost:9876',
    );
  });

  // ─── Step: console-lifecycle ────────────────────────────────

  it('step console-lifecycle is informational (no action)', () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-lifecycle')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toBeTruthy();
  });

  it('step console-lifecycle preAction navigates to Console tab and switches to Structured view', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-lifecycle')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('ws-console-view-structured'));
  });

  it('step console-lifecycle preAction connects on first call (no prior connection in session)', async () => {
    // _consoleConnected starts false (reset by setup) → preAction should connect
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);
    const spy = vi.spyOn(input, 'dispatchEvent');

    // Reset lesson session flag via setup
    const ctx = makeCtx();
    await wsConsoleLesson.setup!(ctx);

    const step = wsConsoleLesson.steps.find(s => s.id === 'console-lifecycle')!;
    await step.preAction!(ctx);

    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/connect ws://localhost:9876',
    );
    // Enter key must be dispatched to submit the command
    const enterCalls = spy.mock.calls.filter(
      c => c[0] instanceof KeyboardEvent && (c[0] as KeyboardEvent).key === 'Enter',
    );
    expect(enterCalls.length).toBe(1);
    // waitFor must use CONSOLE_ENTRY to confirm entries appeared
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-console-entry'), expect.any(Number));
  });

  it('step console-lifecycle preAction is no-op when already connected in session', async () => {
    // Simulate _consoleConnected = true by first running the step's preAction once
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);

    // Reset lesson session flag
    const ctx = makeCtx();
    await wsConsoleLesson.setup!(ctx);

    const step = wsConsoleLesson.steps.find(s => s.id === 'console-lifecycle')!;
    // First call connects and sets _consoleConnected = true
    await step.preAction!(ctx);
    ctx.fill.mockClear();
    ctx.waitFor.mockClear();

    // Second call should be a no-op (flag already set)
    await step.preAction!(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(expect.stringContaining('ws-console-cmd-input'), '/connect ws://localhost:9876');
    expect(ctx.waitFor).not.toHaveBeenCalled();
  });

  // ─── Step: console-categories ───────────────────────────────

  it('step console-categories selects lifecycle category', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-categories')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-category'),
      'lifecycle',
    );
  });

  it('step console-categories highlights category dropdown', () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-categories')!;
    expect(step.highlight).toContain('ws-console-category');
  });

  it('step console-categories preAction navigates to Console and connects if needed', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-categories')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
  });

  // ─── Step: console-send ─────────────────────────────────────

  it('step console-send preAction ensures connected and resets category filter', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-send')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Must navigate to Console tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
    // Must reset category filter to show all entries
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-category'),
      'all',
    );
  });

  it('step console-send action fills command input', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-send')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/send {"demo": "console command"}',
    );
  });

  it('step console-send dispatches Enter key on input', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-send')!;
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);
    const spy = vi.spyOn(input, 'dispatchEvent');

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(spy).toHaveBeenCalled();
    const event = spy.mock.calls[0][0] as KeyboardEvent;
    expect(event.key).toBe('Enter');
  });

  // ─── Step: console-help ─────────────────────────────────────

  it('step console-help preAction ensures connected and resets category filter', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-help')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Must navigate to Console tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
    // Must reset category filter so /help output is visible (step 4 may have set lifecycle)
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-category'),
      'all',
    );
  });

  it('step console-help action fills /help and submits', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-help')!;
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/help',
    );
  });

  it('step console-help dispatches Enter key on input', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-help')!;
    const input = document.createElement('input');
    input.setAttribute('data-testid', 'ws-console-cmd-input');
    document.body.appendChild(input);
    const spy = vi.spyOn(input, 'dispatchEvent');

    const ctx = makeCtx();
    await step.action!(ctx);
    const enterCalls = spy.mock.calls.filter(
      c => c[0] instanceof KeyboardEvent && (c[0] as KeyboardEvent).key === 'Enter',
    );
    expect(enterCalls.length).toBe(1);
  });

  // ─── Step: console-clear ────────────────────────────────────

  it('step console-clear is informational (no action)', () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-clear')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toContain('ws-console-clear');
  });

  it('step console-clear preAction ensures Console tab is active with entries', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-clear')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
  });

  // ─── Step: console-search ───────────────────────────────────

  it('step console-search preAction ensures connected with entries and resets category', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-search')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Must navigate to Console tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
    // Must reset category so search covers all entry types
    expect(ctx.selectOption).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-category'),
      'all',
    );
  });

  it('step console-search fills search input', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-search')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-search'),
      'connect',
    );
  });

  it('step console-search highlights search input', () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-search')!;
    expect(step.highlight).toContain('ws-console-search');
  });

  // ─── Step: console-views ────────────────────────────────────

  it('step console-views preAction ensures connected, clears search', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-views')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Must navigate to Console tab
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-console'));
    // Must clear search from step 8 so all entries are visible in the Raw view
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-search'),
      '',
    );
  });

  it('step console-views action clicks raw view', async () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-views')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-view-raw'),
    );
  });

  it('step console-views highlights raw view button', () => {
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-views')!;
    expect(step.highlight).toContain('ws-console-view-raw');
  });

  // ─── Branch: if (input) false path (lines 31 and 205) ────────────────────
  // When the input element is absent from DOM, the Enter key dispatch is skipped.
  // This covers the false branch of `if (input)` inside ensureConnectedWithConsole
  // and inside the /help action.

  it('ensureConnectedWithConsole skips Enter dispatch when input element is absent', async () => {
    // No input in DOM — reset flag so ensureConnectedWithConsole reaches line 31
    const ctx = makeCtx();
    await wsConsoleLesson.setup!(ctx);
    ctx.fill.mockClear();
    ctx.waitFor.mockClear();

    // Use console-lifecycle preAction which calls ensureConnectedWithConsole
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-lifecycle')!;
    await step.preAction!(ctx);

    // fill still called for /connect command (line 29 in ws-console.ts)
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/connect ws://localhost:9876',
    );
    // waitFor still called (line 34) — but no Enter dispatch because input is null
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('ws-console-entry'), expect.any(Number));
  });

  it('console-help action skips Enter dispatch when input element is absent (line 205)', async () => {
    // Ensure no input in DOM (beforeEach cleared body, no input added here)
    const step = wsConsoleLesson.steps.find(s => s.id === 'console-help')!;
    const ctx = makeCtx();
    await step.action!(ctx);

    // fill was still called for /help
    expect(ctx.fill).toHaveBeenCalledWith(
      expect.stringContaining('ws-console-cmd-input'),
      '/help',
    );
    // No exception thrown — the if (input) guard safely skips dispatch
  });

  // ─── Setup & Cleanup ───────────────────────────────────────

  it('setup resets _consoleConnected flag and starts mock server', async () => {
    const ctx = makeCtx();
    await wsConsoleLesson.setup!(ctx);
    // wsSetup: click mock mode → start mock → click client mode
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-mock'));
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('mode-client'));
  });

  it('cleanup resets _consoleConnected flag and runs wsCleanup', async () => {
    const ctx = makeCtx();
    await wsConsoleLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });
});

// ─── ws-tabs ────────────────────────────────────────────────────

