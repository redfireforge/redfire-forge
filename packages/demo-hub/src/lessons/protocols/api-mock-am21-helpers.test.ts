/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK, APP } from '@shared/selectors';
import { AM_DEMO_TIMING } from './api-mock-demo-helpers';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const importApiMockGallerySample = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const deleteCollectionsByName = vi.fn(() => 0);

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  deleteCollectionsByName: (...a: unknown[]) => deleteCollectionsByName(...(a as [])),
}));

import {
  AM21_ADHOC_PATH,
  AM21_CORPUS_SAMPLE,
  AM21_DICE_NAME,
  AM21_EXAMPLES_TIMING,
  AM21_HEALTH_NAME,
  AM21_ORPHAN_NAME,
  AM21_TIMING,
  AM21_WRONG_STATUS,
  am21InputValue,
  am21RenderedBody,
  am21SimOutcome,
  cleanupAm21,
  closeAm21Simulate,
  ensureAm21ForExamples,
  ensureAm21ForExpectations,
  ensureAm21ForExport,
  ensureAm21ForFailLoudly,
  ensureAm21ForRunAll,
  ensureAm21ForSeed,
  ensureAm21ForThreeViews,
  ensureAm21Library,
  ensureAm21OnApiMock,
  ensureAm21StudioView,
  ensureAm21WrongExpectation,
  hasAm21Attach,
  hasAm21Examples,
  hasAm21ExportConfirm,
  hasAm21Fail,
  hasAm21Result,
  hasAm21SampleResult,
  hasAm21SavedSamples,
  hasAm21Server,
  hasAm21Summary,
  hasAm21WrongExpectation,
  isAm21DiceSelected,
  isAm21HealthSelected,
  isAm21SimulateOpen,
  isAm21StudioViewActive,
  prepareAm21Workspace,
  runAm21Examples,
  runAm21Expectations,
  runAm21ExportTrace,
  runAm21FailLoudly,
  runAm21RunAll,
  runAm21Seed,
  runAm21SuiteAndScratchpad,
  runAm21ThreeViews,
} from './api-mock-am21-helpers';

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function input(testid: string, value = ''): HTMLInputElement {
  const node = document.createElement('input');
  node.setAttribute('data-testid', testid);
  node.value = value;
  makeVisible(node);
  return node;
}

function calls(fn: DemoActionContext['click']): string[] {
  return vi.mocked(fn).mock.calls.map(c => String(c[0]));
}

function fills(fn: DemoActionContext['fill']): Array<[string, string]> {
  return vi.mocked(fn).mock.calls.map(c => [String(c[0]), String(c[1])]);
}

type DemoActionContext = ReturnType<typeof makeCtx>;

// Gallery import remaps sample/example ids; the lesson resolves them by their
// stable name. These synthetic ids stand in for the remapped values so the
// fixtures exercise the name-based resolver (not the authored corpus ids).
const HEALTH_ID = 'sample-7766c234';
const DICE_ID = 'sample-d543b1ea';
const ORPHAN_ID = 'sample-96216e0d';

function mountStudio(): void {
  const bar = el('div', undefined, 'api-mock-server-bar');
  bar.append(el('span', undefined, 'api-mock-status-label'));
  document.body.append(bar);
  document.body.append(el('button', undefined, 'api-mock-view-studio'));
  document.body.append(el('button', undefined, 'api-mock-simulate'));
  const explorer = el('div', undefined, 'api-mock-route-explorer');
  const row = el('button', 'am-route-item', 'api-mock-route-health');
  row.setAttribute('role', 'treeitem');
  explorer.append(row);
  document.body.append(explorer);
  const cli = el('code', undefined, 'api-mock-cli-simulate');
  cli.textContent = 'redfireforge mock simulate workspace.json';
  document.body.append(cli);
}

function mountSample(id: string, name: string, active = false): HTMLElement {
  const wrap = el('div', active ? 'am-sim-sample active' : 'am-sim-sample', `api-mock-sim-sample-${id}`);
  const btn = el('button', 'am-sim-sample-btn');
  const label = document.createElement('span');
  label.className = 'am-sim-sample-name';
  label.textContent = name;
  btn.append(label);
  wrap.append(btn);
  makeVisible(btn);
  return wrap;
}

function mountSimulate(opts: {
  outcome?: string;
  summary?: boolean;
  fail?: boolean;
  seed?: string;
  path?: string;
  assertStatus?: string;
  healthActive?: boolean;
  diceActive?: boolean;
  exportConfirm?: boolean;
  stateChip?: boolean;
  timeline?: boolean;
} = {}): HTMLElement {
  const root = el('div', undefined, 'api-mock-simulate-workspace');
  const saved = el('div', undefined, 'api-mock-sim-section-saved');
  saved.textContent = 'Saved samples';
  const scratch = el('div', undefined, 'api-mock-sim-section-scratch');
  scratch.textContent = 'Scratch pad';
  root.append(saved, scratch);
  root.append(mountSample('adhoc', 'Ad-hoc request', !opts.healthActive && !opts.diceActive));
  const health = mountSample(HEALTH_ID, AM21_HEALTH_NAME, opts.healthActive);
  if (opts.fail) {
    health.append(el('span', 'am-badge danger', 'api-mock-sim-sample-fail'));
  } else if (opts.healthActive && opts.outcome) {
    health.append(el('span', 'am-badge success'));
  }
  root.append(health);
  root.append(mountSample(DICE_ID, AM21_DICE_NAME, opts.diceActive));
  root.append(el('button', undefined, 'api-mock-sim-sample-adhoc'));
  const adhocBtn = el('button', 'am-sim-sample-btn');
  const adhocWrap = el('div', undefined, 'api-mock-sim-sample-adhoc');
  adhocWrap.append(adhocBtn);
  makeVisible(adhocBtn);
  root.append(adhocWrap);
  root.append(input('api-mock-simulate-path', opts.path ?? AM21_ADHOC_PATH));
  root.append(input('api-mock-simulate-seed', opts.seed ?? '11111'));
  root.append(el('button', undefined, 'api-mock-simulate-save-sample'));
  root.append(input('api-mock-simulate-sample-name'));
  root.append(el('button', undefined, 'api-mock-simulate-run'));
  root.append(el('button', undefined, 'api-mock-simulate-run-all'));
  root.append(el('button', undefined, 'api-mock-simulate-export'));
  root.append(el('button', undefined, 'api-mock-simulate-close'));
  root.append(el('button', undefined, 'api-mock-sim-view-request'));
  root.append(el('button', undefined, 'api-mock-sim-tab-request'));
  root.append(el('button', undefined, 'api-mock-sim-tab-rendered'));
  root.append(el('button', undefined, 'api-mock-sim-tab-assertions'));
  if (opts.timeline !== false) root.append(el('div', undefined, 'api-mock-sim-timeline-1'));
  if (opts.outcome) {
    const outcome = el('span', undefined, 'api-mock-sim-outcome');
    outcome.textContent = opts.outcome;
    root.append(outcome);
    root.append(el('div', undefined, 'api-mock-simulate-result'));
  }
  const rendered = el('div', undefined, 'api-mock-sim-rendered');
  const body = el('pre', undefined, 'api-mock-sim-rendered-body');
  body.textContent = '{"face":"heads"}';
  rendered.append(body);
  root.append(rendered);
  root.append(el('pre', undefined, 'api-mock-sim-normalized'));
  if (opts.summary) {
    const summary = el('span', undefined, 'api-mock-simulate-summary');
    summary.textContent = '6 passed · 1 conflict';
    root.append(summary);
  }
  const table = el('table', undefined, 'api-mock-sim-assertions');
  table.append(el('tr', undefined, 'api-mock-sim-assert-row-outcome'));
  table.append(el('tr', undefined, 'api-mock-sim-assert-row-status'));
  table.append(el('tr', undefined, 'api-mock-sim-assert-row-body'));
  table.append(input('api-mock-sim-assert-status', opts.assertStatus ?? '200'));
  if (opts.fail) table.append(el('span', 'am-badge danger', 'api-mock-sim-assert-fail'));
  const hint = el('p', undefined, 'api-mock-sim-assert-hint');
  hint.textContent = 'Only Status and Body contains are editable.';
  root.append(hint, table);
  if (opts.exportConfirm) {
    const confirm = el('div', undefined, 'api-mock-sim-export-confirm');
    confirm.append(el('div', undefined, 'api-mock-sim-export-filename'));
    confirm.append(el('pre', undefined, 'api-mock-sim-export-preview'));
    root.append(confirm);
  }
  if (opts.stateChip) root.append(el('span', undefined, 'api-mock-sim-sample-state'));
  document.body.append(root);
  return root;
}

function tabButton(id: string): HTMLElement {
  const node = document.createElement('button');
  node.id = id;
  makeVisible(node);
  return node;
}

function mountExamples(opts: { attach?: boolean } = {}): void {
  const grid = el('div', undefined, 'api-mock-examples-grid');
  const row = el('article', undefined, `api-mock-example-${ORPHAN_ID}`);
  row.append(input(`api-mock-example-name-${ORPHAN_ID}`, AM21_ORPHAN_NAME));
  row.append(input(`api-mock-example-status-${ORPHAN_ID}`, '200'));
  row.append(input(`api-mock-example-body-${ORPHAN_ID}`, 'ok'));
  if (opts.attach !== false) {
    row.append(el('button', undefined, `api-mock-example-attach-${ORPHAN_ID}`));
  }
  row.append(el('button', undefined, `api-mock-example-try-${ORPHAN_ID}`));
  grid.append(row);
  document.body.append(grid);
  document.body.append(tabButton('api-mock-btab-examples'));
  const url = input('req-url-input', 'http://127.0.0.1:4600/health');
  document.body.append(url);
}

beforeEach(() => {
  document.body.innerHTML = '';
  wipeApiMockWorkspace.mockClear().mockResolvedValue(true);
  importApiMockGallerySample.mockClear().mockResolvedValue(true);
  prepareApiMockStudioChrome.mockClear();
});

describe('AM-21 simulation-suite helpers', () => {
  it('holds AM-21 spotlights longer than the shared pack', () => {
    expect(AM21_TIMING.look).toBeGreaterThan(AM_DEMO_TIMING.look);
    expect(AM21_TIMING.beforeOpen).toBe(1400);
    expect(AM21_TIMING.beforeRun).toBe(2400);
    expect(AM21_EXAMPLES_TIMING.look).toBeGreaterThan(AM21_TIMING.look);
    expect(AM21_EXAMPLES_TIMING.payoff).toBeGreaterThan(AM21_TIMING.payoff);
    expect(AM21_CORPUS_SAMPLE).toBe('am-gallery-suite');
  });

  it('probes empty DOM as absent', () => {
    expect(hasAm21Server()).toBe(false);
    expect(hasAm21SavedSamples()).toBe(false);
    expect(isAm21SimulateOpen()).toBe(false);
    expect(isAm21StudioViewActive()).toBe(false);
    expect(hasAm21Result()).toBe(false);
    expect(hasAm21SampleResult(HEALTH_ID)).toBe(false);
    expect(hasAm21Fail()).toBe(false);
    expect(hasAm21Summary()).toBe(false);
    expect(hasAm21ExportConfirm()).toBe(false);
    expect(hasAm21Examples()).toBe(false);
    expect(hasAm21Attach()).toBe(false);
    expect(hasAm21WrongExpectation()).toBe(false);
    expect(isAm21HealthSelected()).toBe(false);
    expect(isAm21DiceSelected()).toBe(false);
    expect(am21InputValue(API_MOCK.SIMULATE_PATH)).toBe('');
    expect(am21SimOutcome()).toBe('');
    expect(am21RenderedBody()).toBe('');
  });

  it('reads simulate probes from the fixture', () => {
    mountSimulate({
      outcome: 'MATCHED',
      summary: true,
      fail: true,
      assertStatus: AM21_WRONG_STATUS,
      healthActive: true,
      exportConfirm: true,
      stateChip: true,
    });
    expect(isAm21SimulateOpen()).toBe(true);
    expect(hasAm21SavedSamples()).toBe(true);
    expect(hasAm21Result()).toBe(true);
    expect(hasAm21SampleResult(HEALTH_ID)).toBe(true);
    expect(hasAm21Fail()).toBe(true);
    expect(hasAm21Summary()).toBe(true);
    expect(hasAm21ExportConfirm()).toBe(true);
    expect(hasAm21WrongExpectation()).toBe(true);
    expect(isAm21HealthSelected()).toBe(true);
    expect(am21SimOutcome()).toBe('MATCHED');
    expect(am21RenderedBody()).toContain('heads');
  });

  it('wipes, chromes, and imports the suite corpus', async () => {
    await prepareAm21Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM21_CORPUS_SAMPLE);
    await cleanupAm21();
    expect(wipeApiMockWorkspace).toHaveBeenCalledTimes(2);
  });

  it('throws when the suite gallery import fails', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(prepareAm21Workspace()).rejects.toThrow(/am-gallery-suite/);
  });

  it('skips chrome navigation when the studio is already showing', async () => {
    mountStudio();
    const ctx = makeCtx();
    await ensureAm21OnApiMock(ctx);
    await ensureAm21StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('clicks Protocols then the API Mock subnav when studio is missing', async () => {
    document.body.append(el('button', undefined, 'ab-protocols'));
    document.body.append(el('button', undefined, 'nav-tab-api-mock-studio'));
    const ctx = makeCtx();
    await ensureAm21OnApiMock(ctx);
    expect(calls(ctx.click)).toEqual([APP.AB_PROTOCOLS, API_MOCK.APP_SUBNAV]);
  });

  it('falls back to navigateToTab when no subnav is mounted', async () => {
    const ctx = makeCtx();
    await ensureAm21OnApiMock(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('api-mock-studio');
  });

  it('opens Studio view when the explorer is missing', async () => {
    document.body.append(el('button', undefined, 'api-mock-view-studio'));
    const ctx = makeCtx();
    await ensureAm21StudioView(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.VIEW_STUDIO);
  });

  it('reimports the corpus when the library is empty', async () => {
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async () => {
      mountStudio();
    });
    await ensureAm21Library(ctx);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM21_CORPUS_SAMPLE);
  });

  it('skips reimport when a server is already showing', async () => {
    mountStudio();
    const ctx = makeCtx();
    await ensureAm21Library(ctx);
    expect(importApiMockGallerySample).not.toHaveBeenCalled();
  });

  it('closes Simulate when the workspace is open', async () => {
    mountSimulate();
    const ctx = makeCtx();
    await closeAm21Simulate(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
  });

  it('skips close when Simulate is not open', async () => {
    const ctx = makeCtx();
    await closeAm21Simulate(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('opens Simulate and runs an ad-hoc scratch-pad request', async () => {
    mountStudio();
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.SIMULATE_WORKSPACE || sel === API_MOCK.SIMULATE_OUTCOME) {
        if (!document.querySelector('[data-testid="api-mock-simulate-workspace"]')) {
          mountSimulate({ outcome: 'MATCHED', path: '' });
        }
      }
    });
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.SIMULATE && !document.querySelector('[data-testid="api-mock-simulate-workspace"]')) {
        mountSimulate({ path: '' });
      }
    });
    await runAm21SuiteAndScratchpad(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE);
    expect(fills(ctx.fill).some(f => f[0] === API_MOCK.SIMULATE_PATH && f[1] === AM21_ADHOC_PATH)).toBe(true);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_SAVE_SAMPLE);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN);
    expect(calls(ctx.click).indexOf(API_MOCK.SIMULATE_RUN)).toBeGreaterThan(
      calls(ctx.click).indexOf(API_MOCK.SIMULATE_SAVE_SAMPLE),
    );
  });

  it('holds the three result views without re-ringing the timeline', async () => {
    mountStudio();
    mountSimulate({ outcome: 'MATCHED' });
    const ctx = makeCtx();
    await runAm21ThreeViews(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_TAB_REQUEST);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_TAB_RENDERED);
    expect(calls(ctx.click)).not.toContain(API_MOCK.SIMULATE_TIMELINE_FIRST);
  });

  it('switches back to Results when the timeline is hidden', async () => {
    mountStudio();
    const root = mountSimulate({ outcome: 'MATCHED', timeline: false });
    root.append(el('button', undefined, 'api-mock-sim-view-results'));
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.SIMULATE_VIEW_RESULTS) {
        root.append(el('div', undefined, 'api-mock-sim-timeline-1'));
      }
    });
    await runAm21ThreeViews(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_VIEW_RESULTS);
  });

  it('runs a scratch-pad probe when three-views has no result yet', async () => {
    mountStudio();
    mountSimulate({ path: '/other' });
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.SIMULATE_OUTCOME) {
        const outcome = el('span', undefined, 'api-mock-sim-outcome');
        outcome.textContent = 'MATCHED';
        document.querySelector('[data-testid="api-mock-simulate-workspace"]')?.append(outcome);
      }
    });
    await ensureAm21ForThreeViews(ctx);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.SIMULATE_PATH, AM21_ADHOC_PATH]);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN);
  });

  it('edits expected status on the assertions table', async () => {
    mountStudio();
    mountSimulate({ outcome: 'MATCHED', healthActive: true, assertStatus: '200' });
    const ctx = makeCtx();
    await runAm21Expectations(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_TAB_ASSERTIONS);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.SIMULATE_ASSERT_STATUS, AM21_WRONG_STATUS]);
  });

  it('skips the status edit when the wrong expectation is already set', async () => {
    mountStudio();
    mountSimulate({ outcome: 'MATCHED', healthActive: true, assertStatus: AM21_WRONG_STATUS });
    const ctx = makeCtx();
    await runAm21Expectations(ctx);
    expect(fills(ctx.fill)).not.toContainEqual([API_MOCK.SIMULATE_ASSERT_STATUS, AM21_WRONG_STATUS]);
  });

  it('runs the health sample even when the scratch pad already has a result', async () => {
    mountStudio();
    mountSimulate({ outcome: 'MATCHED' });
    const ctx = makeCtx();
    await ensureAm21ForExpectations(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.simSampleBtn(HEALTH_ID));
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN);
  });

  it('runs the failing sample and holds FAIL', async () => {
    mountStudio();
    mountSimulate({ outcome: 'MATCHED', healthActive: true, assertStatus: AM21_WRONG_STATUS, fail: true });
    const ctx = makeCtx();
    await runAm21FailLoudly(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN);
  });

  it('selects the health sample before the FAIL run when it is not active', async () => {
    mountStudio();
    mountSimulate({ outcome: 'MATCHED', assertStatus: AM21_WRONG_STATUS, fail: true });
    const ctx = makeCtx();
    await runAm21FailLoudly(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.simSampleBtn(HEALTH_ID));
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN);
  });

  it('runs the whole suite and holds the tally', async () => {
    mountStudio();
    mountSimulate({
      outcome: 'MATCHED',
      healthActive: true,
      assertStatus: AM21_WRONG_STATUS,
      fail: true,
      summary: true,
      stateChip: true,
    });
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async () => undefined);
    await runAm21RunAll(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN_ALL);
  });

  it('runs the dice sample twice without filling a seed', async () => {
    mountStudio();
    mountSimulate({ outcome: 'MATCHED', diceActive: true });
    const ctx = makeCtx();
    await runAm21Seed(ctx);
    expect(fills(ctx.fill)).not.toContainEqual([API_MOCK.SIMULATE_SEED, expect.anything()]);
    expect(calls(ctx.click).filter(s => s === API_MOCK.SIMULATE_RUN).length).toBeGreaterThanOrEqual(2);
  });

  it('exports the trace and holds the confirmation', async () => {
    mountStudio();
    mountSimulate({ outcome: 'MATCHED', summary: true });
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.SIMULATE_EXPORT) {
        const confirm = el('div', undefined, 'api-mock-sim-export-confirm');
        confirm.append(el('pre', undefined, 'api-mock-sim-export-preview'));
        document.querySelector('[data-testid="api-mock-simulate-workspace"]')?.append(confirm);
      }
    });
    await runAm21ExportTrace(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_EXPORT);
    expect(calls(ctx.click)).not.toContain(API_MOCK.SIMULATE_CLOSE);
  });

  it('attaches the orphan example and tries it in Requests', async () => {
    mountStudio();
    mountExamples();
    const ctx = makeCtx();
    await runAm21Examples(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.BTAB_EXAMPLES);
    expect(calls(ctx.click)).toContain(API_MOCK.exampleAttach(ORPHAN_ID));
    expect(calls(ctx.click)).toContain(API_MOCK.exampleTry(ORPHAN_ID));
  });

  it('skips Attach when the orphan is already attached', async () => {
    mountStudio();
    mountExamples({ attach: false });
    const ctx = makeCtx();
    await runAm21Examples(ctx);
    expect(calls(ctx.click)).not.toContain(API_MOCK.exampleAttach(ORPHAN_ID));
  });

  it('quiet guards recreate Simulate state without a second open', async () => {
    mountStudio();
    mountSimulate({ outcome: 'MATCHED', healthActive: true, summary: true });
    const ctx = makeCtx();
    await ensureAm21ForThreeViews(ctx);
    await ensureAm21ForExpectations(ctx);
    await ensureAm21ForFailLoudly(ctx);
    await ensureAm21ForRunAll(ctx);
    await ensureAm21ForSeed(ctx);
    await ensureAm21ForExport(ctx);
    expect(calls(ctx.click)).not.toContain(API_MOCK.SIMULATE);
  });

  it('examples guard closes Simulate and opens the Examples tab', async () => {
    mountStudio();
    mountSimulate();
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.SIMULATE_CLOSE) {
        document.querySelector('[data-testid="api-mock-simulate-workspace"]')?.remove();
      }
      if (sel === API_MOCK.BTAB_EXAMPLES) mountExamples();
    });
    document.body.append(tabButton('api-mock-btab-examples'));
    await ensureAm21ForExamples(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_CLOSE);
    expect(calls(ctx.click)).toContain(API_MOCK.BTAB_EXAMPLES);
  });

  it('quietly patches a missing wrong expectation', async () => {
    mountStudio();
    mountSimulate({ outcome: 'MATCHED', healthActive: true, assertStatus: '200' });
    const ctx = makeCtx();
    await ensureAm21WrongExpectation(ctx, false);
    expect(fills(ctx.fill)).toContainEqual([API_MOCK.SIMULATE_ASSERT_STATUS, AM21_WRONG_STATUS]);
  });

  it('opens Simulate visibly and fills a missing ad-hoc path', async () => {
    mountStudio();
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async () => {
      if (!document.querySelector('[data-testid="api-mock-simulate-workspace"]')) {
        mountSimulate({ path: '/other', outcome: 'MATCHED' });
      }
    });
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.SIMULATE && !document.querySelector('[data-testid="api-mock-simulate-workspace"]')) {
        mountSimulate({ path: '/other' });
      }
    });
    await ensureAm21WrongExpectation(ctx, true);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE);
  });

  it('skips filling the scratch-pad path when it is already /health', async () => {
    mountStudio();
    mountSimulate({ outcome: 'MATCHED', path: AM21_ADHOC_PATH });
    const ctx = makeCtx();
    await runAm21SuiteAndScratchpad(ctx);
    expect(fills(ctx.fill).some(f => f[0] === API_MOCK.SIMULATE_PATH)).toBe(false);
  });

  it('opens Assertions during FAIL when the table is not mounted yet', async () => {
    mountStudio();
    const root = mountSimulate({
      outcome: 'MATCHED',
      healthActive: true,
      assertStatus: AM21_WRONG_STATUS,
      fail: true,
    });
    root.querySelector('[data-testid="api-mock-sim-assertions"]')?.remove();
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.SIMULATE_ASSERTIONS) {
        const table = el('table', undefined, 'api-mock-sim-assertions');
        table.append(el('tr', undefined, 'api-mock-sim-assert-row-status'));
        table.append(el('span', undefined, 'api-mock-sim-assert-fail'));
        document.querySelector('[data-testid="api-mock-simulate-workspace"]')?.append(table);
      }
    });
    await runAm21FailLoudly(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_TAB_ASSERTIONS);
  });

  it('skips the state chip when run-all has no sequential cursor', async () => {
    mountStudio();
    mountSimulate({
      outcome: 'MATCHED',
      healthActive: true,
      assertStatus: AM21_WRONG_STATUS,
      fail: true,
      summary: true,
    });
    const ctx = makeCtx();
    await runAm21RunAll(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN_ALL);
  });

  it('clicks Run all when export has no results yet', async () => {
    mountStudio();
    mountSimulate();
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.SIMULATE_SUMMARY) {
        const summary = el('span', undefined, 'api-mock-simulate-summary');
        document.querySelector('[data-testid="api-mock-simulate-workspace"]')?.append(summary);
      }
    });
    await ensureAm21ForExport(ctx);
    expect(calls(ctx.click)).toContain(API_MOCK.SIMULATE_RUN_ALL);
  });

  it('does not wait on a failed library reimport', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    const ctx = makeCtx();
    await ensureAm21Library(ctx);
    expect(ctx.waitFor).not.toHaveBeenCalled();
  });

  it('returns early from close when the Close button is missing', async () => {
    mountSimulate();
    document.querySelector('[data-testid="api-mock-simulate-close"]')?.remove();
    const ctx = makeCtx();
    await closeAm21Simulate(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('skips Studio view when the view control is absent', async () => {
    const ctx = makeCtx();
    await ensureAm21StudioView(ctx);
    expect(calls(ctx.click)).not.toContain(API_MOCK.VIEW_STUDIO);
  });

  it('reopens Examples after Try in Requests leaves the grid', async () => {
    mountStudio();
    mountExamples();
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.exampleTry(ORPHAN_ID) || sel === API_MOCK.EXAMPLE_TRY_REQUESTS) {
        document.querySelector('[data-testid="api-mock-examples-grid"]')?.remove();
      }
    });
    await runAm21Examples(ctx);
    expect(calls(ctx.click).filter(s => s === API_MOCK.BTAB_EXAMPLES).length).toBeGreaterThanOrEqual(2);
  });

  it('skips Try in Requests when no try button is mounted', async () => {
    mountStudio();
    const grid = el('div', undefined, 'api-mock-examples-grid');
    grid.append(el('article', undefined, `api-mock-example-${ORPHAN_ID}`));
    document.body.append(grid);
    document.body.append(tabButton('api-mock-btab-examples'));
    const ctx = makeCtx();
    await runAm21Examples(ctx);
    expect(calls(ctx.click)).not.toContain(API_MOCK.EXAMPLE_TRY_REQUESTS);
  });

  it('reads rendered fallback text when the body node is missing', () => {
    const rendered = el('div', undefined, 'api-mock-sim-rendered');
    rendered.textContent = '{"ok":true}';
    document.body.append(rendered);
    expect(am21RenderedBody()).toContain('ok');
  });
});
