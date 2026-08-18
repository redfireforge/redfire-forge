/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK, HAR } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const importApiMockGallerySample = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const seedDemoHarnessTarget = vi.fn(() => ({ envId: 'e1', svcId: 's1' }));
const selectDemoEnvSvc = vi.fn();
const seedDemoFeatureGroup = vi.fn(() => true);
const deleteDemoFeatureGroupsByName = vi.fn();
const sendApiMockRequest = vi.fn(async () => ({ status: 200, body: '{}' }));

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  seedDemoHarnessTarget: (...a: unknown[]) => seedDemoHarnessTarget(...(a as [])),
  selectDemoEnvSvc: (...a: unknown[]) => selectDemoEnvSvc(...(a as [])),
  seedDemoFeatureGroup: (...a: unknown[]) => seedDemoFeatureGroup(...(a as [])),
  deleteDemoFeatureGroupsByName: (...a: unknown[]) => deleteDemoFeatureGroupsByName(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
}));

import {
  AM23_CLI_SIMULATE,
  AM23_CLI_VERIFY,
  AM23_CORPUS_SAMPLE,
  AM23_FG_NAME,
  AM23_SERVER_ID,
  AM23_TIMING,
  am23ServerRunning,
  am23StoreServerId,
  am23TestHooks,
  cleanupAm23,
  ensureAm23ForArtifact,
  ensureAm23ForCli,
  ensureAm23ForEvidence,
  ensureAm23ForIsolate,
  ensureAm23ForRun,
  ensureAm23ForTeardown,
  ensureAm23OnRunner,
  ensureAm23OnStudio,
  hasAm23CliVerify,
  hasAm23JournalRow,
  hasAm23Results,
  hasAm23StartLine,
  hasAm23Stopped,
  isAm23ExportConfirmOpen,
  isAm23FixtureEnabled,
  isAm23IsolateOn,
  isAm23RunnerActive,
  isAm23StoreSelected,
  isAm23StudioActive,
  prepareAm23Workspace,
  runAm23Artifact,
  runAm23CliHandoff,
  runAm23Evidence,
  runAm23FixturePanel,
  runAm23Isolate,
  runAm23Suite,
  runAm23Teardown,
} from './api-mock-am23-helpers';

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function checkbox(testid: string, checked = false): HTMLInputElement {
  const node = document.createElement('input');
  node.type = 'checkbox';
  node.setAttribute('data-testid', testid);
  node.checked = checked;
  makeVisible(node);
  return node;
}

function select(testid: string, value = '', options: Array<{ value: string; label: string }> = []): HTMLSelectElement {
  const node = document.createElement('select');
  node.setAttribute('data-testid', testid);
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    node.append(o);
  }
  node.value = value;
  makeVisible(node);
  return node;
}

function mountFixture(opts: {
  enabled?: boolean;
  serverId?: string;
  isolate?: boolean;
  start?: boolean;
  stopped?: boolean;
  port?: string;
} = {}): HTMLElement {
  const setup = el('div', undefined, 'har-runner-mock-setup');
  setup.append(el('div', undefined, 'har-host-selector'));
  const fieldset = el('fieldset', undefined, 'har-apimock-fixture');
  fieldset.append(select('har-apimock-fixture-server', opts.serverId ?? '', [
    { value: AM23_SERVER_ID, label: 'Store API (:4600)' },
    { value: 'srv-other', label: 'Other (:4601)' },
  ]));
  const isolateRow = el('div', undefined, 'har-apimock-fixture-isolate-row');
  isolateRow.append(checkbox('har-apimock-fixture-isolate', opts.isolate !== false));
  fieldset.append(isolateRow);
  setup.append(fieldset);
  document.body.append(setup);
  if (opts.start) {
    const start = el('p', undefined, 'har-apimock-fixture-start');
    start.textContent = `Started mock on :${opts.port ?? '4612'}`;
    const port = el('span', undefined, 'har-apimock-fixture-port');
    port.textContent = opts.port ?? '4612';
    start.append(port);
    fieldset.append(start);
  }
  if (opts.stopped) {
    const stopped = el('p', undefined, 'har-apimock-fixture-stopped');
    stopped.textContent = 'Stopped · port freed';
    const freed = el('span', undefined, 'har-apimock-fixture-freed-port');
    freed.textContent = opts.port ?? '4612';
    stopped.append(freed);
    fieldset.append(stopped);
  }
  return fieldset;
}

function mountRunnerChrome(opts: { run?: boolean; results?: boolean; scenario?: boolean } = {}): void {
  if (opts.run !== false) document.body.append(el('button', undefined, 'har-run-btn'));
  if (opts.results) {
    document.body.append(el('div', undefined, 'har-live-progress'));
    document.body.append(el('div', undefined, 'har-completion'));
  }
  if (opts.scenario) {
    const root = el('div', undefined, 'har-scenario-selector');
    const label = el('label', 'selection-scenario');
    const box = document.createElement('input');
    box.type = 'checkbox';
    makeVisible(box);
    label.append(box);
    const deselect = el('button');
    deselect.textContent = 'Deselect All';
    root.append(deselect, label);
    document.body.append(root);
  }
}

function mountStudio(): void {
  document.body.append(el('div', undefined, 'api-mock-route-explorer'));
  document.body.append(el('div', undefined, 'api-mock-server-bar'));
  const footer = el('span', undefined, 'api-mock-routes-footer');
  footer.textContent = '10 enabled · 2 drafts';
  const sim = el('code', undefined, 'api-mock-cli-simulate');
  sim.textContent = AM23_CLI_SIMULATE;
  const verify = el('code', undefined, 'api-mock-cli-verify');
  verify.textContent = AM23_CLI_VERIFY;
  document.body.append(footer, sim, verify);
}

describe('AM-23 helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    importApiMockGallerySample.mockResolvedValue(true);
    seedDemoHarnessTarget.mockReturnValue({ envId: 'e1', svcId: 's1' });
  });

  it('pins timing to the slower AM-14…AM-22 holds', () => {
    expect(AM23_TIMING.look).toBe(900);
    expect(AM23_TIMING.beforeOpen).toBe(1400);
    expect(AM23_TIMING.beforeRun).toBe(2000);
    expect(AM23_TIMING.payoff).toBe(1600);
    expect(AM23_CORPUS_SAMPLE).toBe('am-gallery-store');
  });

  it('probes runner and studio surfaces', () => {
    expect(isAm23RunnerActive()).toBe(false);
    expect(isAm23StudioActive()).toBe(false);
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID, isolate: true, start: true, stopped: true });
    mountRunnerChrome({ results: true });
    mountStudio();
    expect(isAm23RunnerActive()).toBe(true);
    expect(isAm23StudioActive()).toBe(true);
    expect(isAm23FixtureEnabled()).toBe(true);
    expect(isAm23StoreSelected()).toBe(true);
    expect(isAm23IsolateOn()).toBe(true);
    expect(hasAm23StartLine()).toBe(true);
    expect(hasAm23Stopped()).toBe(true);
    expect(hasAm23Results()).toBe(true);
    expect(hasAm23CliVerify()).toBe(true);
  });

  it('prepare seeds store + suite; cleanup wipes both', async () => {
    await prepareAm23Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM23_CORPUS_SAMPLE);
    expect(seedDemoFeatureGroup).toHaveBeenCalled();
    expect(selectDemoEnvSvc).toHaveBeenCalledWith('e1', 's1');
    await cleanupAm23();
    expect(deleteDemoFeatureGroupsByName).toHaveBeenCalledWith(AM23_FG_NAME);
  });

  it('throws when gallery import fails', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(prepareAm23Workspace()).rejects.toThrow(AM23_CORPUS_SAMPLE);
  });

  it('skips feature-group seed when the harness target is missing', async () => {
    seedDemoHarnessTarget.mockReturnValueOnce(null);
    await prepareAm23Workspace();
    expect(seedDemoFeatureGroup).not.toHaveBeenCalled();
  });

  it('ensureAm23OnRunner is a no-op when the fixture is already on screen', async () => {
    mountFixture();
    const ctx = makeCtx();
    await ensureAm23OnRunner(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm23OnRunner clicks the runner tab, then harness, then navigateToTab', async () => {
    const ctx = makeCtx();
    document.body.append(el('button', undefined, 'nav-tab-runner'));
    await ensureAm23OnRunner(ctx);
    expect(ctx.click).toHaveBeenCalledWith(HAR.NAV_RUNNER);

    document.body.innerHTML = '';
    ctx.click.mockClear();
    document.body.append(el('button', undefined, 'nav-harness'));
    await ensureAm23OnRunner(ctx);
    expect(ctx.click).toHaveBeenCalledWith(HAR.NAV_HARNESS);

    document.body.innerHTML = '';
    ctx.click.mockClear();
    await ensureAm23OnRunner(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('runner');
  });

  it('ensureAm23OnStudio clicks subnav or falls back to navigateToTab', async () => {
    mountStudio();
    const ctx = makeCtx();
    await ensureAm23OnStudio(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();

    document.body.innerHTML = '';
    document.body.append(el('button', undefined, 'ab-protocols'));
    document.body.append(el('button', undefined, 'nav-tab-api-mock-studio'));
    await ensureAm23OnStudio(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APP_SUBNAV);

    document.body.innerHTML = '';
    ctx.click.mockClear();
    await ensureAm23OnStudio(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('api-mock-studio');
  });

  it('opens Mock Server when the fixture panel is hidden', async () => {
    const mock = document.createElement('input');
    mock.type = 'radio';
    mock.setAttribute('data-testid', 'har-host-mock');
    makeVisible(mock);
    document.body.append(mock);
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === HAR.HOST_MOCK_SERVER) {
        mountFixture({ enabled: true, serverId: AM23_SERVER_ID });
      }
    });
    await am23TestHooks.enableFixtureAndPickStore(ctx, false);
    expect(ctx.click).toHaveBeenCalledWith(HAR.HOST_MOCK_SERVER);
  });

  it('picks Store when the fixture is open and the server is new', async () => {
    mountFixture({ serverId: '' });
    const ctx = makeCtx();
    await runAm23FixturePanel(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(HAR.HARNESS_MOCK_SERVER, AM23_SERVER_ID);
  });

  it('reads a remapped Store id from CustomSelect metadata', () => {
    const wrap = el('div');
    wrap.setAttribute('data-am-servers', JSON.stringify([
      { value: 'srv-live-store', label: 'Store API (:4612)' },
    ]));
    const cs = el('div', 'cs-wrapper', 'har-apimock-fixture-server');
    cs.setAttribute('data-value', '');
    const text = el('span', 'cs-text');
    text.textContent = 'No Studio servers';
    cs.append(text);
    wrap.append(cs);
    document.body.append(wrap);
    expect(am23StoreServerId()).toBe('srv-live-store');
    expect(isAm23StoreSelected()).toBe(false);
    cs.setAttribute('data-value', 'srv-live-store');
    text.textContent = 'Store API (:4612)';
    expect(isAm23StoreSelected()).toBe(true);
  });

  it('ignores malformed CustomSelect server metadata', () => {
    const cs = el('div', 'cs-wrapper', 'har-apimock-fixture-server');
    cs.setAttribute('data-am-servers', '{not-json');
    cs.setAttribute('data-value', '');
    document.body.append(cs);
    expect(am23StoreServerId()).toBe('');
    expect(isAm23StoreSelected()).toBe(false);
  });

  it('picks a remapped Store id instead of the gallery template id', async () => {
    mountFixture({ enabled: true, serverId: '' });
    const selectEl = document.querySelector(HAR.HARNESS_MOCK_SERVER) as HTMLSelectElement;
    selectEl.innerHTML = '';
    const remapped = document.createElement('option');
    remapped.value = 'srv-live-store';
    remapped.textContent = 'Store API (:4612)';
    selectEl.append(remapped);
    selectEl.value = '';
    expect(am23StoreServerId()).toBe('srv-live-store');
    expect(isAm23StoreSelected()).toBe(false);
    const ctx = makeCtx();
    await am23TestHooks.enableFixtureAndPickStore(ctx, false);
    expect(ctx.selectOption).toHaveBeenCalledWith(HAR.HARNESS_MOCK_SERVER, 'srv-live-store');
  });

  it('skips enable and select when Store is already chosen', async () => {
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID });
    const ctx = makeCtx();
    await ensureAm23ForIsolate(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    expect(ctx.selectOption).not.toHaveBeenCalled();
  });

  it('holds isolate when it is already on and clicks when it is off', async () => {
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID, isolate: true });
    const ctx = makeCtx();
    await runAm23Isolate(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(HAR.HARNESS_MOCK_ISOLATE);

    document.body.innerHTML = '';
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID, isolate: false });
    const ctx2 = makeCtx();
    await am23TestHooks.holdOrEnableIsolate(ctx2, true);
    expect(ctx2.click).toHaveBeenCalledWith(HAR.HARNESS_MOCK_ISOLATE);
  });

  it('does not re-click or re-tour Isolate when it is already on', async () => {
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID, isolate: true });
    const ctx = makeCtx();
    await runAm23Isolate(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('selects the first scenario after deselecting stale checks', async () => {
    mountRunnerChrome({ scenario: true });
    const ctx = makeCtx();
    await am23TestHooks.selectAm23Scenario(ctx);
    const box = document.querySelector('.selection-scenario input') as HTMLInputElement;
    expect(box.checked).toBe(true);
  });

  it('runs the suite: click Run, hold start line, hold results', async () => {
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID, start: true });
    mountRunnerChrome({ results: true, scenario: true });
    const ctx = makeCtx();
    await runAm23Suite(ctx);
    expect(ctx.click).toHaveBeenCalledWith(HAR.RUN_BTN);
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('skips quiet run when stopped + results already exist', async () => {
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID, stopped: true });
    mountRunnerChrome({ results: true, run: true, scenario: true });
    const ctx = makeCtx();
    await ensureAm23ForTeardown(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(HAR.RUN_BTN);
  });

  it('quiet-runs when teardown evidence is missing', async () => {
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID });
    mountRunnerChrome({ run: true, scenario: true });
    const ctx = makeCtx();
    await am23TestHooks.quietRunIfNeeded(ctx);
    expect(ctx.click).toHaveBeenCalledWith(HAR.RUN_BTN);
  });

  it('holds stopped + freed port', async () => {
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID, stopped: true, port: '4612' });
    const ctx = makeCtx();
    await runAm23Teardown(ctx);
    expect(ctx.waitFor).not.toHaveBeenCalled();
  });

  it('opens the journal dock and holds the first row', async () => {
    mountStudio();
    document.body.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
    const row = el('tr', undefined, 'api-mock-tx-tx-1');
    const table = el('table');
    const tbody = el('tbody');
    tbody.append(row);
    table.append(tbody);
    const dock = el('div', undefined, 'api-mock-dock');
    dock.append(table);
    document.body.append(dock);
    document.body.append(el('button', undefined, 'api-mock-journal-export'));
    const ctx = makeCtx();
    await runAm23Evidence(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_TRANSACTIONS);
    expect(hasAm23JournalRow()).toBe(true);
  });

  it('starts Studio and sends a GET when the journal is empty', async () => {
    mountStudio();
    document.body.append(el('button', undefined, 'api-mock-start'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.START) {
        const stop = el('button', undefined, 'api-mock-stop');
        document.body.append(stop);
        const label = el('span', undefined, 'api-mock-status-label');
        label.textContent = 'Running';
        document.body.append(label);
      }
    });
    await am23TestHooks.ensureAm23JournalRow(ctx);
    expect(sendApiMockRequest).toHaveBeenCalledWith({ path: '/products', method: 'GET' });
    expect(am23ServerRunning()).toBe(true);
  });

  it('skips journal seed when a row already exists', async () => {
    const row = el('tr', undefined, 'api-mock-tx-1');
    const table = el('table');
    const tbody = el('tbody');
    tbody.append(row);
    table.append(tbody);
    const dock = el('div', undefined, 'api-mock-dock');
    dock.append(table);
    document.body.append(dock);
    const ctx = makeCtx();
    await am23TestHooks.ensureAm23JournalRow(ctx);
    expect(sendApiMockRequest).not.toHaveBeenCalled();
  });

  it('exports workspace JSON and holds the confirmation', async () => {
    mountStudio();
    document.body.append(el('button', undefined, 'api-mock-export'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.EXPORT) {
        const menu = el('div', undefined, 'api-mock-export-menu-panel');
        menu.append(el('button', undefined, 'api-mock-export-workspace'));
        document.body.append(menu);
      }
      if (sel === API_MOCK.EXPORT_WORKSPACE) {
        const confirm = el('div', undefined, 'api-mock-export-confirm');
        confirm.append(el('code', undefined, 'api-mock-export-cli'));
        confirm.append(el('code', undefined, 'api-mock-export-cli-verify'));
        confirm.append(el('button', undefined, 'api-mock-export-close'));
        document.body.append(confirm);
      }
    });
    await runAm23Artifact(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT);
    expect(isAm23ExportConfirmOpen()).toBe(true);
  });

  it('closes export confirm then holds verify + footer', async () => {
    mountStudio();
    const confirm = el('div', undefined, 'api-mock-export-confirm');
    confirm.append(el('button', undefined, 'api-mock-export-close'));
    document.body.append(confirm);
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.EXPORT_CLOSE) confirm.remove();
    });
    await runAm23CliHandoff(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT_CLOSE);
    expect(isAm23ExportConfirmOpen()).toBe(false);
  });

  it('ensure artifact/cli close a stray export confirm quietly', async () => {
    mountStudio();
    const confirm = el('div', undefined, 'api-mock-export-confirm');
    confirm.append(el('button', undefined, 'api-mock-export-close'));
    document.body.append(confirm);
    const ctx = makeCtx();
    await ensureAm23ForArtifact(ctx);
    await ensureAm23ForCli(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT_CLOSE);
  });

  it('ensure evidence navigates to Studio after a finished run', async () => {
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID, stopped: true });
    mountRunnerChrome({ results: true });
    mountStudio();
    const ctx = makeCtx();
    await ensureAm23ForEvidence(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalledWith('api-mock-studio');
  });

  it('ensureAm23ForRun selects the suite without clicking Run', async () => {
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID });
    mountRunnerChrome({ scenario: true, run: true });
    const ctx = makeCtx();
    await ensureAm23ForRun(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(HAR.RUN_BTN);
  });

  it('openAm23Journal falls back to Runtime view', async () => {
    mountStudio();
    document.body.append(el('button', undefined, 'api-mock-view-runtime'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.VIEW_RUNTIME) {
        document.body.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
      }
    });
    await am23TestHooks.openAm23Journal(ctx, true);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_RUNTIME);
  });

  it('skips opening export when the menu is already open', async () => {
    mountStudio();
    document.body.append(el('button', undefined, 'api-mock-export'));
    document.body.append(el('div', undefined, 'api-mock-export-menu-panel'));
    const ctx = makeCtx();
    await am23TestHooks.openAm23ExportMenu(ctx, true);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.EXPORT);
  });

  it('covers quiet fixture/isolate paths and missing controls', async () => {
    const ctx = makeCtx();
    await am23TestHooks.enableFixtureAndPickStore(ctx, false);
    await am23TestHooks.holdOrEnableIsolate(ctx, false);
    await am23TestHooks.selectAm23Scenario(ctx);
    await am23TestHooks.closeAm23Export(ctx, false);
    expect(isAm23IsolateOn()).toBe(false);

    mountFixture({ serverId: '' });
    await am23TestHooks.enableFixtureAndPickStore(ctx, false);
    expect(ctx.selectOption).toHaveBeenCalledWith(HAR.HARNESS_MOCK_SERVER, AM23_SERVER_ID);

    document.body.innerHTML = '';
    mountFixture({ enabled: true, serverId: 'srv-other' });
    const ctx2 = makeCtx();
    await am23TestHooks.enableFixtureAndPickStore(ctx2, false);
    expect(ctx2.selectOption).toHaveBeenCalledWith(HAR.HARNESS_MOCK_SERVER, AM23_SERVER_ID);

    document.body.innerHTML = '';
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID, isolate: false });
    const ctx3 = makeCtx();
    await am23TestHooks.holdOrEnableIsolate(ctx3, false);
    expect(ctx3.click).toHaveBeenCalledWith(HAR.HARNESS_MOCK_ISOLATE);
  });

  it('skips scenario select when the first box is already the only selection', async () => {
    mountRunnerChrome({ scenario: true });
    const box = document.querySelector('.selection-scenario input') as HTMLInputElement;
    box.checked = true;
    const ctx = makeCtx();
    await am23TestHooks.selectAm23Scenario(ctx);
    expect(ctx.delay).not.toHaveBeenCalled();
  });

  it('clicks the first scenario when Deselect All is missing', async () => {
    const root = el('div', undefined, 'har-scenario-selector');
    const label = el('label', 'selection-scenario');
    const box = document.createElement('input');
    box.type = 'checkbox';
    makeVisible(box);
    label.append(box);
    root.append(label);
    document.body.append(root);
    const ctx = makeCtx();
    await am23TestHooks.selectAm23Scenario(ctx);
    expect(box.checked).toBe(true);
  });

  it('returns from quiet run when Run is missing, and swallows waitFor rejection', async () => {
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID });
    const ctx = makeCtx();
    await am23TestHooks.quietRunIfNeeded(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(HAR.RUN_BTN);

    mountRunnerChrome({ run: true, scenario: true });
    ctx.waitFor.mockRejectedValueOnce(new Error('timeout'));
    await am23TestHooks.quietRunIfNeeded(ctx);
    expect(ctx.click).toHaveBeenCalledWith(HAR.RUN_BTN);
  });

  it('reveals Stopped when the status line is not yet painted', async () => {
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID });
    const ctx = makeCtx();
    await runAm23Teardown(ctx);
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('runs the suite without a Run button and without live progress', async () => {
    mountFixture({ enabled: true, serverId: AM23_SERVER_ID, start: true });
    document.body.append(el('div', undefined, 'har-completion'));
    const ctx = makeCtx();
    await runAm23Suite(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(HAR.RUN_BTN);
  });

  it('opens Runtime when the journal dock tab is missing', async () => {
    mountStudio();
    const ctx = makeCtx();
    await runAm23Evidence(ctx);
    expect(sendApiMockRequest).toHaveBeenCalled();
  });

  it('skips journal open when the toolbar is already visible', async () => {
    mountStudio();
    document.body.append(el('div', undefined, 'api-mock-journal-toolbar'));
    const ctx = makeCtx();
    await am23TestHooks.openAm23Journal(ctx, false);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('quietly opens Runtime then the transactions tab', async () => {
    mountStudio();
    document.body.append(el('button', undefined, 'api-mock-view-runtime'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.VIEW_RUNTIME) {
        document.body.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
      }
    });
    await am23TestHooks.openAm23Journal(ctx, false);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_RUNTIME);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_TRANSACTIONS);
  });

  it('quietly clicks the transactions dock tab when it is already present', async () => {
    mountStudio();
    document.body.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
    const ctx = makeCtx();
    await am23TestHooks.openAm23Journal(ctx, false);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_TRANSACTIONS);
  });

  it('skips Start when the Studio listener is already running', async () => {
    mountStudio();
    const label = el('span', undefined, 'api-mock-status-label');
    label.textContent = 'Running';
    document.body.append(label);
    document.body.append(el('button', undefined, 'api-mock-start'));
    const ctx = makeCtx();
    await am23TestHooks.ensureAm23StudioRunning(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.START);
  });

  it('exports without a workspace menu item and still waits for confirm', async () => {
    mountStudio();
    document.body.append(el('button', undefined, 'api-mock-export'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.EXPORT) {
        document.body.append(el('div', undefined, 'api-mock-export-menu-panel'));
        document.body.append(el('div', undefined, 'api-mock-export-confirm'));
      }
    });
    await runAm23Artifact(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT);
  });

  it('clicks Studio view during CLI handoff when the explorer is hidden', async () => {
    document.body.append(el('button', undefined, 'api-mock-view-studio'));
    document.body.append(el('span', undefined, 'api-mock-routes-footer'));
    const ctx = makeCtx();
    await runAm23CliHandoff(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
  });

  it('clicks harness then runner when the runner tab appears after Harness', async () => {
    document.body.append(el('button', undefined, 'nav-harness'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === HAR.NAV_HARNESS) {
        document.body.append(el('button', undefined, 'nav-tab-runner'));
      }
    });
    await ensureAm23OnRunner(ctx);
    expect(ctx.click).toHaveBeenCalledWith(HAR.NAV_HARNESS);
    expect(ctx.click).toHaveBeenCalledWith(HAR.NAV_RUNNER);
  });

  it('clicks Protocols then falls through to navigateToTab without a subnav', async () => {
    document.body.append(el('button', undefined, 'ab-protocols'));
    const ctx = makeCtx();
    await ensureAm23OnStudio(ctx);
    expect(ctx.click).toHaveBeenCalled();
    expect(ctx.navigateToTab).toHaveBeenCalledWith('api-mock-studio');
  });

  it('treats the empty studio as active and exposes the feature-group factory', () => {
    document.body.append(el('div', undefined, 'api-mock-empty'));
    expect(isAm23StudioActive()).toBe(true);
    const fg = am23TestHooks.makeAm23FeatureGroup('e1', 's1');
    expect(fg.name).toBe(AM23_FG_NAME);
    expect(Array.isArray(fg.scenarios)).toBe(true);
  });

  it('opens export quietly and no-ops when the Export button is missing', async () => {
    mountStudio();
    const ctx = makeCtx();
    await am23TestHooks.openAm23ExportMenu(ctx, false);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.EXPORT);
    document.body.append(el('button', undefined, 'api-mock-export'));
    await am23TestHooks.openAm23ExportMenu(ctx, false);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT);
  });
});
