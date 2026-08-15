/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';

const listApiMockStudioServers = vi.fn(async () => [] as Array<{
  id: string; name: string; port: number; active: boolean;
}>);

vi.mock('../../adapters', () => ({
  listApiMockStudioServers: (...a: unknown[]) => listApiMockStudioServers(...(a as [])),
}));

import {
  AM_DEMO_TIMING,
  clickBeat,
  fillBeat,
  prettyFormatImportPaste,
  revealBeat,
  resolveApiMockStudioServerId,
  reviewAndRunSimulation,
  ensureAdHocSimulateForm,
  ensureSimulateResultsPane,
  selectBeat,
  spotlightBeat,
  spotlightElementBeat,
  waitForApiMockStudioServerId,
  waitForApiMockWfServerReady,
  clearApiMockWfServerPicker,
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

  it('prettyFormatImportPaste clicks Pretty format then holds the paste area', async () => {
    const pretty = document.createElement('button');
    pretty.setAttribute('data-testid', 'api-mock-import-pretty');
    makeVisible(pretty);
    const paste = document.createElement('textarea');
    paste.setAttribute('data-testid', 'api-mock-import-paste');
    makeVisible(paste);
    document.body.append(pretty, paste);
    const ctx = makeCtx();
    await prettyFormatImportPaste(ctx, { look: 0, hold: 0 });
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_PRETTY);
  });

  it('prettyFormatImportPaste no-ops when Pretty format is missing', async () => {
    const ctx = makeCtx();
    await prettyFormatImportPaste(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
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

  it('reviewAndRunSimulation runs Ad-hoc first, then saves a named sample', async () => {
    mountSimulateForm({ path: '/products/42' });
    const ctx = makeCtx();
    await reviewAndRunSimulation(ctx);

    const clicks = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(clicks.indexOf(API_MOCK.SIMULATE_RUN)).toBeGreaterThanOrEqual(0);
    expect(clicks.indexOf(API_MOCK.SIMULATE_SAVE_SAMPLE)).toBeGreaterThan(clicks.indexOf(API_MOCK.SIMULATE_RUN));
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SIMULATE_SAMPLE_NAME, 'GET /products/42');
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

  it('ensureAdHocSimulateForm clicks Ad-hoc when Save as sample is hidden', async () => {
    mountSimulateForm({ path: '/x', hideSave: true });
    const adhoc = document.querySelector(API_MOCK.SIMULATE_SAMPLE_ADHOC) as HTMLElement;
    adhoc.classList.add('active');
    const ctx = makeCtx();
    await ensureAdHocSimulateForm(ctx, 50);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_SAMPLE_ADHOC_BTN);
  });

  it('reviewAndRunSimulation returns to Request after Run so Save as sample is visible', async () => {
    mountSimulateForm({ path: '/catalog', viewRequest: true });
    const ctx = makeCtx();
    await reviewAndRunSimulation(ctx, { sampleName: 'GET /catalog — two matches' });
    const clicks = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(clicks.indexOf(API_MOCK.SIMULATE_VIEW_REQUEST)).toBeGreaterThan(clicks.indexOf(API_MOCK.SIMULATE_RUN));
    expect(clicks.indexOf(API_MOCK.SIMULATE_SAVE_SAMPLE)).toBeGreaterThan(clicks.indexOf(API_MOCK.SIMULATE_VIEW_REQUEST));
  });

  it('reviewAndRunSimulation returns to Results after Save so the verdict is mounted', async () => {
    mountSimulateForm({ path: '/reports?page=2', viewRequest: true, viewResults: true });
    const ctx = makeCtx();
    await reviewAndRunSimulation(ctx, { sampleName: 'GET /reports?page=2' });
    const clicks = (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map(c => c[0]);
    expect(clicks.indexOf(API_MOCK.SIMULATE_VIEW_RESULTS)).toBeGreaterThan(
      clicks.indexOf(API_MOCK.SIMULATE_SAVE_SAMPLE),
    );
  });

  it('reviewAndRunSimulation still opens Results when Save as sample is skipped', async () => {
    mountSimulateForm({ path: '/reports?page=3', viewResults: true });
    const ctx = makeCtx();
    await reviewAndRunSimulation(ctx, { saveSample: false, beforeRun: 90 });
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_VIEW_RESULTS);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.SIMULATE_SAVE_SAMPLE);
  });

  it('ensureSimulateResultsPane is a no-op when the verdict is already showing', async () => {
    const result = document.createElement('div');
    result.setAttribute('data-testid', 'api-mock-simulate-result');
    makeVisible(result);
    const results = document.createElement('button');
    results.setAttribute('data-testid', 'api-mock-sim-view-results');
    makeVisible(results);
    document.body.append(result, results);
    const ctx = makeCtx();
    await ensureSimulateResultsPane(ctx, 50);
    expect(ctx.click).not.toHaveBeenCalled();
  });
});

function mountSimulateForm(opts: {
  path?: string;
  headers?: string;
  body?: string;
  hideSave?: boolean;
  viewRequest?: boolean;
  viewResults?: boolean;
} = {}): void {
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
  if (!opts.hideSave) makeVisible(save);

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

  const viewRequest = document.createElement('button');
  viewRequest.setAttribute('data-testid', 'api-mock-sim-view-request');
  if (opts.viewRequest) makeVisible(viewRequest);

  const viewResults = document.createElement('button');
  viewResults.setAttribute('data-testid', 'api-mock-sim-view-results');
  if (opts.viewResults) makeVisible(viewResults);

  document.body.append(path, headers, body, save, name, saved, adhoc, run, viewRequest, viewResults);
}

describe('API Mock Studio server resolve', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    listApiMockStudioServers.mockReset();
  });

  it('resolves by name, then template id, then active', async () => {
    listApiMockStudioServers.mockResolvedValueOnce([
      { id: 'srv-a', name: 'Orders', port: 4600, active: true },
      { id: 'srv-live', name: 'Cart API', port: 4601, active: false },
    ]);
    await expect(resolveApiMockStudioServerId({ name: 'Cart API' })).resolves.toBe('srv-live');
    listApiMockStudioServers.mockResolvedValueOnce([
      { id: 'srv-blank', name: 'Import sandbox', port: 4600, active: false },
    ]);
    await expect(resolveApiMockStudioServerId({ templateId: 'srv-blank' })).resolves.toBe('srv-blank');
    listApiMockStudioServers.mockResolvedValueOnce([
      { id: 'srv-active', name: 'Other', port: 4602, active: true },
    ]);
    await expect(resolveApiMockStudioServerId()).resolves.toBe('srv-active');
    listApiMockStudioServers.mockResolvedValueOnce([]);
    await expect(resolveApiMockStudioServerId({ name: 'Cart API' })).resolves.toBeNull();
  });

  it('times out waiting for a Studio server, then treats a missing picker as ready', async () => {
    listApiMockStudioServers.mockResolvedValue([]);
    const ctx = makeCtx();
    await expect(waitForApiMockStudioServerId(ctx, { templateId: 'srv-x', timeout: 5 })).resolves.toBe('srv-x');
    await expect(waitForApiMockWfServerReady(ctx, 'srv-x')).resolves.toBe(true);
  });

  it('waits until the picker host reports a loaded library', async () => {
    const host = document.createElement('div');
    host.setAttribute('data-testid', 'api-mock-wf-server-host');
    host.setAttribute('data-count', '0');
    makeVisible(host);
    document.body.append(host);
    const ctx = makeCtx();
    let ticks = 0;
    vi.mocked(ctx.delay).mockImplementation(async () => {
      ticks += 1;
      if (ticks > 1) host.setAttribute('data-count', '1');
    });
    await expect(waitForApiMockWfServerReady(ctx, 'srv-live', 500)).resolves.toBe(true);
  });

  it('clears a pre-filled workflow server picker so the next pick is visible', () => {
    const wrap = document.createElement('div');
    wrap.className = 'cs-wrapper';
    wrap.setAttribute('data-testid', 'api-mock-wf-server');
    wrap.setAttribute('data-value', 'srv-live');
    makeVisible(wrap);
    document.body.append(wrap);
    let cleared = '';
    wrap.addEventListener('custom-select:set-value', (event) => {
      cleared = (event as CustomEvent<{ value?: string }>).detail?.value ?? '';
    });
    expect(clearApiMockWfServerPicker()).toBe(true);
    expect(cleared).toBe('');
    wrap.setAttribute('data-value', '');
    expect(clearApiMockWfServerPicker()).toBe(false);
  });

  it('returns false when the picker host never loads a library', async () => {
    const host = document.createElement('div');
    host.setAttribute('data-testid', 'api-mock-wf-server-host');
    host.setAttribute('data-count', '0');
    makeVisible(host);
    document.body.append(host);
    const ctx = makeCtx();
    await expect(waitForApiMockWfServerReady(ctx, 'srv-x', 5)).resolves.toBe(false);
  });
});
