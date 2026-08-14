/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';
import {
  AM_DEMO_TIMING,
  clickBeat,
  fillBeat,
  revealBeat,
  reviewAndRunSimulation,
  ensureAdHocSimulateForm,
  selectBeat,
  spotlightBeat,
  spotlightElementBeat,
} from './api-mock-demo-helpers';

const SEL = '[data-testid="beat-target"]';

function mountTarget(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-testid', 'beat-target');
  makeVisible(el);
  document.body.appendChild(el);
  return el;
}

const ringCount = () => document.querySelectorAll('.demo-spotlight-ring').length;

describe('API Mock beat helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('rings a visible target for the hold, then clears it', async () => {
    mountTarget();
    const ctx = makeCtx();
    let ringsDuringHold = 0;
    vi.mocked(ctx.delay).mockImplementation(async () => {
      ringsDuringHold = ringCount();
    });

    await expect(spotlightBeat(ctx, SEL, 700)).resolves.toBe(true);
    expect(ringsDuringHold).toBe(1);
    expect(ringCount()).toBe(0);
    expect(ctx.delay).toHaveBeenCalledWith(700);
  });

  it('falls back to a plain pause when the target is not mounted', async () => {
    const ctx = makeCtx();
    await expect(spotlightBeat(ctx, SEL, 400)).resolves.toBe(false);
    expect(ctx.delay).toHaveBeenCalledWith(400);
    expect(ringCount()).toBe(0);
  });

  it('defaults the hold to the look budget', async () => {
    const ctx = makeCtx();
    await spotlightBeat(ctx, SEL);
    expect(ctx.delay).toHaveBeenCalledWith(AM_DEMO_TIMING.look);
  });

  it('clears the ring even when the hold throws', async () => {
    mountTarget();
    const ctx = makeCtx();
    vi.mocked(ctx.delay).mockRejectedValueOnce(new Error('interrupted'));
    await expect(spotlightBeat(ctx, SEL, 500)).rejects.toThrow('interrupted');
    expect(ringCount()).toBe(0);
  });

  it('rings an element handed over directly, and pauses when it is null', async () => {
    const el = mountTarget();
    const ctx = makeCtx();
    let ringsDuringHold = 0;
    vi.mocked(ctx.delay).mockImplementation(async () => {
      ringsDuringHold = ringCount();
    });

    await expect(spotlightElementBeat(ctx, el, 300)).resolves.toBe(true);
    expect(ringsDuringHold).toBe(1);
    expect(ringCount()).toBe(0);

    await expect(spotlightElementBeat(ctx, null)).resolves.toBe(false);
    expect(ctx.delay).toHaveBeenLastCalledWith(AM_DEMO_TIMING.look);
  });

  it('clickBeat spotlights, clicks, then holds — with defaults', async () => {
    const ctx = makeCtx();
    await clickBeat(ctx, SEL);
    expect(ctx.click).toHaveBeenCalledWith(SEL);
    expect(ctx.delay).toHaveBeenNthCalledWith(1, AM_DEMO_TIMING.look);
    expect(ctx.delay).toHaveBeenNthCalledWith(2, AM_DEMO_TIMING.fieldFilled);
  });

  it('clickBeat honours explicit look and hold', async () => {
    const ctx = makeCtx();
    await clickBeat(ctx, SEL, { look: 100, hold: 0 });
    expect(ctx.delay).toHaveBeenNthCalledWith(1, 100);
    expect(ctx.delay).toHaveBeenNthCalledWith(2, 0);
  });

  it('fillBeat spotlights, fills, then holds — with defaults', async () => {
    const ctx = makeCtx();
    await fillBeat(ctx, SEL, '/health');
    expect(ctx.fill).toHaveBeenCalledWith(SEL, '/health');
    expect(ctx.delay).toHaveBeenNthCalledWith(1, AM_DEMO_TIMING.look);
    expect(ctx.delay).toHaveBeenNthCalledWith(2, AM_DEMO_TIMING.fieldFilled);
  });

  it('fillBeat honours explicit look and hold', async () => {
    const ctx = makeCtx();
    await fillBeat(ctx, SEL, 'x', { look: 50, hold: 60 });
    expect(ctx.delay).toHaveBeenNthCalledWith(1, 50);
    expect(ctx.delay).toHaveBeenNthCalledWith(2, 60);
  });

  it('selectBeat spotlights, picks the option, then holds — with defaults', async () => {
    const ctx = makeCtx();
    await selectBeat(ctx, SEL, 'query');
    expect(ctx.selectOption).toHaveBeenCalledWith(SEL, 'query');
    expect(ctx.delay).toHaveBeenNthCalledWith(1, AM_DEMO_TIMING.look);
    expect(ctx.delay).toHaveBeenNthCalledWith(2, AM_DEMO_TIMING.fieldFilled);
  });

  it('selectBeat honours explicit look and hold', async () => {
    const ctx = makeCtx();
    await selectBeat(ctx, SEL, 'header', { look: 80, hold: 120 });
    expect(ctx.delay).toHaveBeenNthCalledWith(1, 80);
    expect(ctx.delay).toHaveBeenNthCalledWith(2, 120);
  });

  it('revealBeat waits for the node then holds — with defaults', async () => {
    const ctx = makeCtx();
    await revealBeat(ctx, SEL);
    expect(ctx.waitFor).toHaveBeenCalledWith(SEL, 20_000);
    expect(ctx.delay).toHaveBeenCalledWith(AM_DEMO_TIMING.panelReady);
  });

  it('revealBeat honours explicit timeout and hold', async () => {
    const ctx = makeCtx();
    await revealBeat(ctx, SEL, { timeout: 5_000, hold: 90 });
    expect(ctx.waitFor).toHaveBeenCalledWith(SEL, 5_000);
    expect(ctx.delay).toHaveBeenCalledWith(90);
  });

  it('reviewAndRunSimulation saves a named sample, then holds on Run', async () => {
    mountSimulateForm({ path: '/products/42' });
    const ctx = makeCtx();
    await reviewAndRunSimulation(ctx);

    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_SAVE_SAMPLE);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SIMULATE_SAMPLE_NAME, 'GET /products/42');
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_RUN);
    expect(ctx.delay).toHaveBeenNthCalledWith(1, 800);
    expect(ctx.delay).toHaveBeenNthCalledWith(2, 700);
    expect(ctx.delay).toHaveBeenNthCalledWith(3, AM_DEMO_TIMING.fieldFilled);
    expect(ctx.delay).toHaveBeenNthCalledWith(4, AM_DEMO_TIMING.look);
    expect(ctx.delay).toHaveBeenNthCalledWith(5, AM_DEMO_TIMING.fieldFilled);
    expect(ctx.delay).toHaveBeenNthCalledWith(6, 800);
    expect(ctx.delay).toHaveBeenNthCalledWith(7, AM_DEMO_TIMING.beforeRun);
    expect(ctx.delay).toHaveBeenNthCalledWith(8, 0);
  });

  it('reviewAndRunSimulation also walks filled headers and body', async () => {
    mountSimulateForm({
      path: '/orders',
      headers: 'Content-Type: application/json',
      body: '{"ok":true}',
    });
    const ctx = makeCtx();
    await reviewAndRunSimulation(ctx, { review: 111, beforeRun: 222, sampleName: 'Gold order' });

    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SIMULATE_SAMPLE_NAME, 'Gold order');
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_RUN);
    expect(ctx.delay).toHaveBeenNthCalledWith(1, 111);
    expect(ctx.delay).toHaveBeenNthCalledWith(2, 111);
    expect(ctx.delay).toHaveBeenNthCalledWith(3, 111);
  });

  it('reviewAndRunSimulation can skip Save as sample', async () => {
    mountSimulateForm({ path: '/health' });
    const ctx = makeCtx();
    await reviewAndRunSimulation(ctx, { saveSample: false, beforeRun: 90 });
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SIMULATE_SAVE_SAMPLE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_RUN);
  });

  it('reviewAndRunSimulation skips empty headers and body', async () => {
    mountSimulateForm({ path: '/health', headers: '  ', body: '' });
    const ctx = makeCtx();
    await reviewAndRunSimulation(ctx, { review: 80, beforeRun: 90 });

    expect(ctx.delay).toHaveBeenNthCalledWith(1, 80);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_SAVE_SAMPLE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_RUN);
  });

  it('ensureAdHocSimulateForm returns to the scratch pad when a saved sample is selected', async () => {
    mountSimulateForm({ path: '/x' });
    const adhoc = document.querySelector(API_MOCK.SIMULATE_SAMPLE_ADHOC) as HTMLElement;
    adhoc.classList.remove('active');
    const ctx = makeCtx();
    await ensureAdHocSimulateForm(ctx, 50);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_SAMPLE_ADHOC_BTN);
  });
});

function mountSimulateForm(opts: { path?: string; headers?: string; body?: string } = {}): void {
  const path = document.createElement('input');
  path.setAttribute('data-testid', 'api-mock-simulate-path');
  path.value = opts.path ?? '';
  makeVisible(path);

  const headers = document.createElement('textarea');
  headers.setAttribute('data-testid', 'api-mock-simulate-headers');
  headers.value = opts.headers ?? '';
  makeVisible(headers);

  const body = document.createElement('textarea');
  body.setAttribute('data-testid', 'api-mock-simulate-body');
  body.value = opts.body ?? '';
  makeVisible(body);

  const save = document.createElement('button');
  save.setAttribute('data-testid', 'api-mock-simulate-save-sample');
  makeVisible(save);

  const name = document.createElement('input');
  name.setAttribute('data-testid', 'api-mock-simulate-sample-name');
  makeVisible(name);

  const saved = document.createElement('div');
  saved.setAttribute('data-testid', 'api-mock-sim-section-saved');
  makeVisible(saved);

  const adhoc = document.createElement('div');
  adhoc.setAttribute('data-testid', 'api-mock-sim-sample-adhoc');
  adhoc.className = 'am-sim-sample active';
  makeVisible(adhoc);
  const adhocBtn = document.createElement('button');
  adhocBtn.className = 'am-sim-sample-btn';
  makeVisible(adhocBtn);
  adhoc.append(adhocBtn);

  const run = document.createElement('button');
  run.setAttribute('data-testid', 'api-mock-simulate-run');
  makeVisible(run);

  document.body.append(path, headers, body, save, name, saved, adhoc, run);
}
