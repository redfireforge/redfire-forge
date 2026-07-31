/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wsLoadTestingLesson } from './ws-load-testing';
import { makeCtx, makeVisible } from './ws-test-utils';

describe('ws-load-testing lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has valid lesson structure', () => {
    expect(wsLoadTestingLesson.id).toBe('ws-load-testing');
    expect(wsLoadTestingLesson.domainId).toBe('protocols');
    expect(wsLoadTestingLesson.name).toBe('Load Testing');
    expect(wsLoadTestingLesson.steps.length).toBe(7);
    expect(wsLoadTestingLesson.concept.title).toBeTruthy();
    expect(wsLoadTestingLesson.concept.body).toBeTruthy();
    expect(wsLoadTestingLesson.initialTab).toBe('websocket-studio');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof wsLoadTestingLesson.setup).toBe('function');
    expect(typeof wsLoadTestingLesson.cleanup).toBe('function');
  });

  it('all steps have required fields', () => {
    for (const step of wsLoadTestingLesson.steps) {
      expect(step.id).toBeTruthy();
      expect(step.title).toBeTruthy();
      expect(step.description).toBeTruthy();
    }
  });

  it('all steps have pauseAfter: true', () => {
    for (const step of wsLoadTestingLesson.steps) {
      expect(step.pauseAfter).toBe(true);
    }
  });

  it('has key terms defined', () => {
    const terms = wsLoadTestingLesson.concept.keyTerms;
    expect(terms).toBeDefined();
    expect(terms!.length).toBeGreaterThanOrEqual(4);
    const termNames = terms!.map(t => t.term);
    expect(termNames).toContain('Constant Profile');
    expect(termNames).toContain('Burst Profile');
    expect(termNames).toContain('Throughput');
  });

  it('has a diagram', () => {
    expect(wsLoadTestingLesson.concept.diagram).toBeTruthy();
  });

  it('has category set', () => {
    expect(wsLoadTestingLesson.category).toBe('websocket');
  });

  it('has correct step IDs in order', () => {
    const ids = wsLoadTestingLesson.steps.map(s => s.id);
    expect(ids).toEqual([
      'lt-intro', 'lt-template', 'lt-profile', 'lt-settings',
      'lt-run', 'lt-results', 'lt-export',
    ]);
  });

  it('estimated time is 4 minutes', () => {
    expect(wsLoadTestingLesson.estimatedMinutes).toBe(4);
  });

  it('step lt-intro preAction navigates to Events tab quietly first', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-intro')!;
    expect(typeof step.preAction).toBe('function');
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('events'));
  });

  it('step lt-intro action clicks load test tab with ripple', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-intro')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('right-tab-loadtest'));
  });

  it('step lt-template has a preAction guard for LT panel', () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-template')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step lt-template action fills template with counter and timestamp', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-template')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('ping'));
    const fillArg: string = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(fillArg).toContain('{{counter}}');
    expect(fillArg).toContain('{{timestamp}}');
  });

  it('step lt-profile has a preAction guard for LT panel', () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-profile')!;
    expect(typeof step.preAction).toBe('function');
  });

  it('step lt-profile action tours all three profiles (ramp → burst → constant)', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-profile')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    // Should click: ramp, burst, constant
    expect(ctx.click).toHaveBeenCalledTimes(3);
    const calls = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map((c: [string]) => c[0]);
    expect(calls.some((s: string) => s.includes('ramp'))).toBe(true);
    expect(calls.some((s: string) => s.includes('burst'))).toBe(true);
    expect(calls.some((s: string) => s.includes('constant'))).toBe(true);
  });

  it('step lt-settings preAction ensures constant profile is selected', async () => {
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    makeVisible(config);
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-settings')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should click constant to ensure profile is set before fills
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('constant'));
  });

  it('step lt-settings action sets rate to 5 and duration to 5', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-settings')!;
    const ctx = makeCtx();
    await step.action!(ctx);
    const calls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const values = calls.map((c: [string, string]) => c[1]);
    expect(values).toContain('5'); // rate
    expect(values.filter((v: string) => v === '5').length).toBe(2); // both rate and duration are 5
  });

  it('step lt-run action uses ctx.click for ripple on enabled button and waitFor results (Rule 5)', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-run')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'lt-start-btn');
    document.body.appendChild(btn);
    makeVisible(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('lt-start-btn'));
    // Must use waitFor to detect test completion robustly (Rule 5)
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('lt-results'), expect.any(Number));
  });

  it('step lt-run action skips ctx.click when button is disabled', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-run')!;
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'lt-start-btn');
    btn.disabled = true;
    document.body.appendChild(btn);
    makeVisible(btn);

    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('step lt-run preAction clears previous results when config is hidden (Rule 4 skip guard)', async () => {
    // Simulate: user skipped here from step 6/7 — results panel is visible, config is hidden
    const results = document.createElement('div');
    results.setAttribute('data-testid', 'lt-results');
    document.body.appendChild(results);
    makeVisible(results);
    const clearBtn = document.createElement('button');
    clearBtn.setAttribute('data-testid', 'lt-clear-btn');
    document.body.appendChild(clearBtn);
    makeVisible(clearBtn);

    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-run')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // ctx.click should be called with lt-clear-btn to dismiss results
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('lt-clear-btn'));
    // ctx.waitFor should wait for the config form to appear after clearing
    expect(ctx.waitFor).toHaveBeenCalledWith(expect.stringContaining('lt-config'), expect.any(Number));
  });

  it('step lt-run preAction always sets rate=5 and duration=5 regardless of template state', async () => {
    // Template is already filled — but rate/duration should still be set
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    makeVisible(config);
    const ta = document.createElement('textarea');
    ta.setAttribute('data-testid', 'lt-message-template');
    ta.value = '{"action":"ping","seq":{{counter}}}'; // non-empty
    document.body.appendChild(ta);
    makeVisible(ta);

    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-run')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Rate and duration should ALWAYS be set
    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const fillValues = fillCalls.map((c: [string, string]) => c[1]);
    expect(fillValues).toContain('5'); // rate or duration
    // constant profile should be clicked
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('constant'));
  });

  it('step lt-run has a preAction guard that fills template when empty', async () => {
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    makeVisible(config);
    const ta = document.createElement('textarea');
    ta.setAttribute('data-testid', 'lt-message-template');
    ta.value = '';
    document.body.appendChild(ta);
    makeVisible(ta);

    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-run')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('ping'));
  });

  it('step lt-results has no action (observation step) but has a preAction guard', () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-results')!;
    expect(step.action).toBeUndefined();
    expect(step.highlight).toBeTruthy();
    expect(typeof step.preAction).toBe('function');
  });

  it('step lt-results preAction returns early when results already exist', async () => {
    // Add a mock results element
    const results = document.createElement('div');
    results.setAttribute('data-testid', 'lt-results');
    document.body.appendChild(results);
    makeVisible(results);
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-results')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    // Should not try to navigate or fill anything — early return
    expect(ctx.click).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('step lt-export has action that clicks Export JSON button', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-export')!;
    expect(typeof step.action).toBe('function');
    const ctx = makeCtx();
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('lt-export-btn'));
  });

  it('step lt-export preAction returns early when results already exist', async () => {
    const results = document.createElement('div');
    results.setAttribute('data-testid', 'lt-results');
    document.body.appendChild(results);
    makeVisible(results);
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-export')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('cleanup handles missing DOM elements gracefully', async () => {
    const ctx = makeCtx();
    await wsLoadTestingLesson.cleanup!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('cleanup clicks stop button when present', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'lt-stop-btn');
    document.body.appendChild(btn);
    makeVisible(btn);
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await wsLoadTestingLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('cleanup clicks clear button when present', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-testid', 'lt-clear-btn');
    document.body.appendChild(btn);
    makeVisible(btn);
    const clickSpy = vi.fn();
    btn.addEventListener('click', clickSpy);

    const ctx = makeCtx();
    await wsLoadTestingLesson.cleanup!(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('setup is callable', async () => {
    const ctx = makeCtx();
    await wsLoadTestingLesson.setup!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step lt-results preAction runs full ensureTestResults when no results', async () => {
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    makeVisible(config);
    const ta = document.createElement('textarea');
    ta.setAttribute('data-testid', 'lt-message-template');
    ta.value = '{"test":true}';
    document.body.appendChild(ta);
    makeVisible(ta);
    const startBtn = document.createElement('button');
    startBtn.setAttribute('data-testid', 'lt-start-btn');
    startBtn.disabled = true;
    document.body.appendChild(startBtn);
    makeVisible(startBtn);

    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-results')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step lt-results preAction navigates to LT tab when config not visible', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-results')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('loadtest'));
  });

  it('step lt-export preAction runs ensureTestResults when no results exist', async () => {
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    makeVisible(config);
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-export')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('step lt-template preAction navigates to LT tab when config not visible', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-template')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('loadtest'));
  });

  it('step lt-profile preAction navigates to LT tab when config not visible', async () => {
    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-profile')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('loadtest'));
  });

  it('ensureTestResults fills empty template before running', async () => {
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    makeVisible(config);
    const ta = document.createElement('textarea');
    ta.setAttribute('data-testid', 'lt-message-template');
    ta.value = '';
    document.body.appendChild(ta);
    makeVisible(ta);

    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-results')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('ping'));
  });

  it('ensureTestResults clicks enabled start button and waits', async () => {
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    makeVisible(config);
    const ta = document.createElement('textarea');
    ta.setAttribute('data-testid', 'lt-message-template');
    ta.value = '{"test":true}';
    document.body.appendChild(ta);
    makeVisible(ta);
    const startBtn = document.createElement('button');
    startBtn.setAttribute('data-testid', 'lt-start-btn');
    document.body.appendChild(startBtn);
    makeVisible(startBtn);
    const clickSpy = vi.spyOn(startBtn, 'click');

    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-results')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(clickSpy).toHaveBeenCalled();
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('step lt-settings preAction skips navigation when LT config is already visible', async () => {
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    makeVisible(config);

    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-settings')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const loadtestNav = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: [string]) => c[0].includes('loadtest'));
    expect(loadtestNav.length).toBe(0);
    expect(ctx.click).toHaveBeenCalledWith(expect.stringContaining('constant'));
  });

  it('step lt-run preAction skips navigation when LT config is already visible', async () => {
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    makeVisible(config);
    const ta = document.createElement('textarea');
    ta.setAttribute('data-testid', 'lt-message-template');
    ta.value = '{"filled":true}';
    document.body.appendChild(ta);
    makeVisible(ta);

    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-run')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    const loadtestNav = (ctx.click as ReturnType<typeof vi.fn>).mock.calls
      .filter((c: [string]) => c[0].includes('loadtest'));
    expect(loadtestNav.length).toBe(0);
  });

  it('step lt-template preAction skips navigation when LT config is visible', async () => {
    const config = document.createElement('div');
    config.setAttribute('data-testid', 'lt-config');
    document.body.appendChild(config);
    makeVisible(config);

    const step = wsLoadTestingLesson.steps.find(s => s.id === 'lt-template')!;
    const ctx = makeCtx();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });
});

// ─── sse-studio ─────────────────────────────────────────────────

