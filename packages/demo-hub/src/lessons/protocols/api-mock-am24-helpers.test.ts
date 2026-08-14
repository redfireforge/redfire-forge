/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK, WF } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const ensureBlankApiMockServer = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const sendApiMockRequest = vi.fn(async () => ({ status: 201, body: '{}' }));
const patchApiMockActiveRoute = vi.fn(() => true);
const deleteWorkflowByName = vi.fn(() => true);
const addWorkflowNodeWithPreset = vi.fn(() => true);
const patchWorkflowNodeDataById = vi.fn(() => true);
const connectWorkflowNodes = vi.fn(() => true);
const triggerWorkflowQuickTest = vi.fn();

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  ensureBlankApiMockServer: (...a: unknown[]) => ensureBlankApiMockServer(...(a as [])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
  patchApiMockActiveRoute: (...a: unknown[]) => patchApiMockActiveRoute(...(a as [])),
  deleteWorkflowByName: (...a: unknown[]) => deleteWorkflowByName(...(a as [])),
  addWorkflowNodeWithPreset: (...a: unknown[]) => addWorkflowNodeWithPreset(...(a as [])),
  patchWorkflowNodeDataById: (...a: unknown[]) => patchWorkflowNodeDataById(...(a as [])),
  connectWorkflowNodes: (...a: unknown[]) => connectWorkflowNodes(...(a as [])),
  triggerWorkflowQuickTest: (...a: unknown[]) => triggerWorkflowQuickTest(...(a as [])),
}));

const ensureLessonBlankWorkflow = vi.fn(async () => undefined);
const collapseWfDemoAppSidebar = vi.fn(async () => undefined);
const revealPaletteBlock = vi.fn(async (_ctx: unknown, sel: string) => document.querySelector<HTMLElement>(sel));
const openWfNodeConfigModal = vi.fn(async () => undefined);
const waitForWfConfigPanel = vi.fn(async () => undefined);
const fillWfConfigField = vi.fn(async () => undefined);
const selectWfConfigOption = vi.fn(async () => undefined);
const clickWfConfigControl = vi.fn(async () => undefined);
const pauseWfConfigSection = vi.fn(async () => undefined);
const saveAndCloseWfConfigModal = vi.fn(async () => true);
const closeWfConfigModalIfOpen = vi.fn(async () => undefined);
const closeWfConsoleIfOpen = vi.fn(async () => undefined);
const closeWfSamplePreviewIfOpen = vi.fn(async () => undefined);
const holdWfSpotlight = vi.fn(async () => undefined);
const fitWfCanvasQuiet = vi.fn(async () => undefined);

vi.mock('../wf-demo-helpers', () => ({
  ensureLessonBlankWorkflow: (...a: unknown[]) => ensureLessonBlankWorkflow(...(a as [])),
  collapseWfDemoAppSidebar: (...a: unknown[]) => collapseWfDemoAppSidebar(...(a as [])),
  revealPaletteBlock: (...a: unknown[]) => revealPaletteBlock(...(a as [])),
  openWfNodeConfigModal: (...a: unknown[]) => openWfNodeConfigModal(...(a as [])),
  waitForWfConfigPanel: (...a: unknown[]) => waitForWfConfigPanel(...(a as [])),
  fillWfConfigField: (...a: unknown[]) => fillWfConfigField(...(a as [])),
  selectWfConfigOption: (...a: unknown[]) => selectWfConfigOption(...(a as [])),
  clickWfConfigControl: (...a: unknown[]) => clickWfConfigControl(...(a as [])),
  pauseWfConfigSection: (...a: unknown[]) => pauseWfConfigSection(...(a as [])),
  saveAndCloseWfConfigModal: (...a: unknown[]) => saveAndCloseWfConfigModal(...(a as [])),
  closeWfConfigModalIfOpen: (...a: unknown[]) => closeWfConfigModalIfOpen(...(a as [])),
  closeWfConsoleIfOpen: (...a: unknown[]) => closeWfConsoleIfOpen(...(a as [])),
  closeWfSamplePreviewIfOpen: (...a: unknown[]) => closeWfSamplePreviewIfOpen(...(a as [])),
  holdWfSpotlight: (...a: unknown[]) => holdWfSpotlight(...(a as [])),
  fitWfCanvasQuiet: (...a: unknown[]) => fitWfCanvasQuiet(...(a as [])),
}));

vi.mock('./api-mock-demo-helpers', async () => {
  const actual = await vi.importActual<typeof import('./api-mock-demo-helpers')>('./api-mock-demo-helpers');
  return {
    ...actual,
    reviewAndRunSimulation: vi.fn(async () => undefined),
    ensureAdHocSimulateForm: vi.fn(async () => undefined),
  };
});

import {
  AM24_ITEM_PATH,
  AM24_OPENAPI,
  AM24_ORDERS_PATH,
  AM24_SERVER_ID,
  AM24_SKU,
  AM24_TIMING,
  AM24_WF_NAME,
  am24CanvasNodeId,
  am24DraftCount,
  am24FindRoute,
  am24PassSelector,
  am24ServerRunning,
  am24TestHooks,
  cleanupAm24,
  closeAm24Import,
  closeAm24Simulate,
  ensureAm24Designer,
  ensureAm24ForConflicts,
  ensureAm24ForLive,
  ensureAm24ForMatching,
  ensureAm24ForResilience,
  ensureAm24ForResponse,
  ensureAm24ForShip,
  ensureAm24ForSuite,
  ensureAm24ForVariants,
  ensureAm24OnDesigner,
  ensureAm24OnStudio,
  ensureAm24Server,
  ensureAm24StudioView,
  hasAm24Assert,
  hasAm24ConflictsClean,
  hasAm24Delay,
  hasAm24Draft,
  hasAm24EnabledOrders,
  hasAm24FakerBody,
  hasAm24Finding,
  hasAm24Http,
  hasAm24JournalRow,
  hasAm24JsonPath,
  hasAm24NotFoundVariant,
  hasAm24Pass,
  hasAm24Sample,
  hasAm24Server,
  hasAm24Start,
  hasAm24Stop,
  hasAm24Summary,
  isAm24DesignerActive,
  isAm24ExportConfirmOpen,
  isAm24ImportOpen,
  isAm24RouteEnabled,
  isAm24SimulateOpen,
  isAm24StudioActive,
  prepareAm24Workspace,
  runAm24Conflicts,
  runAm24FromSpec,
  runAm24Live,
  runAm24Matching,
  runAm24Resilience,
  runAm24Response,
  runAm24Ship,
  runAm24Suite,
  runAm24Variants,
} from './api-mock-am24-helpers';

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

function input(testid: string, value = ''): HTMLInputElement {
  const node = document.createElement('input');
  node.setAttribute('data-testid', testid);
  node.value = value;
  makeVisible(node);
  return node;
}

function select(testid: string, value = ''): HTMLSelectElement {
  const node = document.createElement('select');
  node.setAttribute('data-testid', testid);
  const opt = document.createElement('option');
  opt.value = value || 'POST';
  opt.textContent = value || 'POST';
  node.append(opt);
  node.value = value;
  makeVisible(node);
  return node;
}

function mountRoute(opts: {
  path?: string;
  method?: string;
  draft?: boolean;
  id?: string;
} = {}): HTMLElement {
  const row = el('button', `am-route-item${opts.draft ? ' disabled' : ''}`, opts.id ?? 'api-mock-route-orders');
  row.setAttribute('role', 'treeitem');
  const method = el('span', 'am-method');
  method.textContent = opts.method ?? 'POST';
  const path = el('span', 'am-route-path');
  path.textContent = opts.path ?? AM24_ORDERS_PATH;
  row.append(method, path);
  return row;
}

function mountStudio(opts: { running?: boolean; draft?: boolean; enabled?: boolean } = {}): HTMLElement {
  const explorer = el('div', undefined, 'api-mock-route-explorer');
  explorer.append(mountRoute({ draft: opts.draft !== false && !opts.enabled, id: 'api-mock-route-1' }));
  document.body.append(explorer);
  document.body.append(el('div', undefined, 'api-mock-server-bar'));
  const status = el('span', undefined, 'api-mock-status-label');
  status.textContent = opts.running ? 'Running' : 'Stopped';
  document.body.append(status);
  document.body.append(el('button', undefined, 'api-mock-view-studio'));
  document.body.append(el('button', undefined, 'nav-tab-api-mock-studio'));
  return explorer;
}

function mountEditor(): void {
  document.body.append(el('div', undefined, 'api-mock-route-editor'));
  const enabled = el('button', undefined, 'api-mock-route-enabled');
  enabled.setAttribute('title', 'Disable this rule');
  document.body.append(enabled);
  document.body.append(el('button', undefined, 'api-mock-path-toolbox'));
  document.body.append(el('button', undefined, 'api-mock-add-condition'));
  const matchTab = el('button');
  matchTab.id = 'api-mock-btab-match';
  const respTab = el('button');
  respTab.id = 'api-mock-btab-response';
  document.body.append(matchTab, respTab);
  document.body.append(el('div', undefined, 'api-mock-response-mode-bar'));
  document.body.append(el('button', undefined, 'api-mock-add-variant'));
  document.body.append(el('textarea', undefined, 'api-mock-variant-body'));
}

describe('AM-24 helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    ensureBlankApiMockServer.mockResolvedValue(true);
  });

  it('pins timing to the slower AM-14…AM-23 holds', () => {
    expect(AM24_TIMING.look).toBe(900);
    expect(AM24_TIMING.beforeOpen).toBe(1400);
    expect(AM24_TIMING.beforeRun).toBe(2000);
    expect(AM24_TIMING.payoff).toBe(1600);
    expect(JSON.parse(AM24_OPENAPI).paths['/orders'].post).toBeTruthy();
    expect(AM24_SKU).toBe('WIDGET');
    expect(AM24_ITEM_PATH).toBe('/orders/:id');
  });

  it('probes studio, drafts, variants, and designer surfaces', () => {
    expect(hasAm24Server()).toBe(false);
    expect(isAm24StudioActive()).toBe(false);
    mountStudio({ enabled: true, running: true });
    mountEditor();
    const list = el('div', undefined, 'api-mock-variant-list');
    const card = el('button', undefined, 'api-mock-variant-tab-1');
    card.textContent = '404 Not found';
    list.append(card);
    document.body.append(list);
    document.body.append(input('api-mock-variant-delay', '200'));
    document.body.append(el('div', undefined, 'api-mock-conflict-filter-empty'));
    document.body.append(el('div', undefined, 'api-mock-sim-section-saved'));
    document.body.append(el('div', undefined, 'api-mock-simulate-summary'));
    const dock = el('div', undefined, 'api-mock-dock');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    tr.setAttribute('data-testid', 'api-mock-tx-0');
    makeVisible(tr);
    tbody.append(tr);
    table.append(tbody);
    dock.append(table);
    document.body.append(dock);
    document.body.append(el('div', 'wf-designer'));
    document.body.append(el('div', undefined, 'api-mock-canvas-apiMockStart'));
    document.body.append(el('div', 'react-flow__node-http'));
    document.body.append(el('div', undefined, 'api-mock-canvas-apiMockStop'));
    const assert = el('div', 'wf-node-pass', 'api-mock-canvas-apiMockAssertCalls');
    document.body.append(assert);

    expect(hasAm24Server()).toBe(true);
    expect(isAm24StudioActive()).toBe(true);
    expect(hasAm24EnabledOrders()).toBe(true);
    expect(isAm24RouteEnabled()).toBe(true);
    expect(am24ServerRunning()).toBe(true);
    expect(hasAm24NotFoundVariant()).toBe(true);
    expect(hasAm24Delay()).toBe(true);
    expect(hasAm24ConflictsClean()).toBe(true);
    expect(hasAm24Sample()).toBe(true);
    expect(hasAm24Summary()).toBe(true);
    expect(hasAm24JournalRow()).toBe(true);
    expect(isAm24DesignerActive()).toBe(true);
    expect(hasAm24Start()).toBe(true);
    expect(hasAm24Http()).toBe(true);
    expect(hasAm24Stop()).toBe(true);
    expect(hasAm24Pass()).toBe(true);
    expect(am24PassSelector(API_MOCK.CANVAS_ASSERT)).toContain('wf-node-pass');
  });

  it('finds route rows by path and enabled flag', () => {
    const explorer = el('div', undefined, 'api-mock-route-explorer');
    explorer.append(mountRoute({ draft: true, id: 'api-mock-route-draft' }));
    explorer.append(mountRoute({ draft: false, id: 'api-mock-route-live' }));
    document.body.append(explorer);
    expect(hasAm24Draft()).toBe(true);
    expect(am24DraftCount()).toBe(1);
    expect(am24FindRoute(AM24_ORDERS_PATH, 'POST', true)?.getAttribute('data-testid')).toBe('api-mock-route-live');
    expect(am24FindRoute(AM24_ORDERS_PATH, 'GET')).toBeUndefined();
  });

  it('prepare seeds a blank server; cleanup deletes the workflow', async () => {
    await prepareAm24Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(ensureBlankApiMockServer).toHaveBeenCalled();
    await cleanupAm24();
    expect(deleteWorkflowByName).toHaveBeenCalledWith(AM24_WF_NAME);
  });

  it('throws when the blank server cannot be created', async () => {
    ensureBlankApiMockServer.mockResolvedValueOnce(false);
    await expect(prepareAm24Workspace()).rejects.toThrow('blank mock server');
  });

  it('ensureAm24OnStudio is a no-op when explorer is visible', async () => {
    mountStudio({ enabled: true });
    const ctx = makeCtx();
    await ensureAm24OnStudio(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('ensureAm24OnStudio clicks subnav or falls back to navigateToTab', async () => {
    const ctx = makeCtx();
    document.body.append(el('button', undefined, 'ab-protocols'));
    document.body.append(el('button', undefined, 'nav-tab-api-mock-studio'));
    await ensureAm24OnStudio(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APP_SUBNAV);

    document.body.innerHTML = '';
    ctx.click.mockClear();
    await ensureAm24OnStudio(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('api-mock-studio');
  });

  it('ensureAm24StudioView clicks Studio when the explorer is missing', async () => {
    document.body.append(el('button', undefined, 'api-mock-view-studio'));
    const ctx = makeCtx();
    await ensureAm24StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
  });

  it('ensureAm24OnDesigner navigates when the canvas is missing', async () => {
    const ctx = makeCtx();
    await ensureAm24OnDesigner(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('workflow');

    document.body.append(el('div', 'wf-designer'));
    ctx.navigateToTab.mockClear();
    await ensureAm24OnDesigner(ctx);
    expect(ctx.navigateToTab).not.toHaveBeenCalled();
  });

  it('ensureAm24Server creates a blank server when the bar is missing', async () => {
    const ctx = makeCtx();
    await ensureAm24Server(ctx);
    expect(ensureBlankApiMockServer).toHaveBeenCalled();
  });

  it('close import and simulate are no-ops when those overlays are gone', async () => {
    const ctx = makeCtx();
    await closeAm24Import(ctx);
    await closeAm24Simulate(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('closes import and simulate when the close controls exist', async () => {
    document.body.append(el('div', undefined, 'api-mock-import-review'));
    document.body.append(el('button', undefined, 'api-mock-import-close'));
    document.body.append(el('div', undefined, 'api-mock-simulate-workspace'));
    document.body.append(el('button', undefined, 'api-mock-simulate-close'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.IMPORT_CLOSE) {
        document.querySelector(API_MOCK.IMPORT_REVIEW)?.remove();
      }
      if (sel === API_MOCK.SIMULATE_CLOSE) {
        document.querySelector(API_MOCK.SIMULATE_WORKSPACE)?.remove();
      }
    });
    expect(isAm24ImportOpen()).toBe(true);
    expect(isAm24SimulateOpen()).toBe(true);
    await closeAm24Import(ctx);
    await closeAm24Simulate(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CLOSE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_CLOSE);
  });

  it('imports OpenAPI as drafts then enables POST /orders', async () => {
    mountStudio({ draft: true });
    mountEditor();
    document.body.append(el('button', undefined, 'api-mock-import-menu'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.IMPORT_MENU) {
        const review = el('div', undefined, 'api-mock-import-review');
        const src = el('button', undefined, 'api-mock-import-source-openapi');
        review.append(src);
        review.append(el('textarea', undefined, 'api-mock-import-paste'));
        review.append(el('button', undefined, 'api-mock-import-parse'));
        review.append(el('div', undefined, 'api-mock-import-route-list'));
        review.append(checkbox('api-mock-import-generalize', false));
        review.append(el('button', undefined, 'api-mock-import-confirm'));
        review.append(el('button', undefined, 'api-mock-import-close'));
        document.body.append(review);
      }
      if (sel === API_MOCK.importSource('openapi')) {
        document.querySelector(API_MOCK.importSource('openapi'))?.classList.add('active');
      }
      if (sel === API_MOCK.IMPORT_CONFIRM) {
        document.querySelector(API_MOCK.IMPORT_REVIEW)?.remove();
      }
    });
    await runAm24FromSpec(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_MENU);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.IMPORT_PASTE, AM24_OPENAPI);
  });

  it('matching opens the toolbox, applies JSONPath, and runs Simulate', async () => {
    mountStudio({ enabled: true });
    mountEditor();
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.PATH_TOOLBOX) {
        const box = el('div', undefined, 'api-mock-pattern-toolbox');
        box.append(el('button', undefined, 'api-mock-toolbox-tab-jsonpath'));
        box.append(el('textarea', undefined, 'api-mock-toolbox-json-sample'));
        box.append(input('api-mock-toolbox-jsonpath'));
        box.append(input('api-mock-toolbox-json-expected'));
        box.append(el('button', undefined, 'api-mock-toolbox-apply'));
        document.body.append(box);
      }
      if (sel === API_MOCK.SIMULATE) {
        const ws = el('div', undefined, 'api-mock-simulate-workspace');
        ws.append(select('api-mock-simulate-method', 'POST'));
        ws.append(input('api-mock-simulate-path', '/'));
        ws.append(el('textarea', undefined, 'api-mock-simulate-body'));
        ws.append(el('div', undefined, 'api-mock-sim-outcome'));
        document.body.append(ws);
      }
    });
    await runAm24Matching(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.PATH_TOOLBOX);
  });

  it('response patches faker JSON and formats the preview', async () => {
    mountStudio({ enabled: true });
    mountEditor();
    document.body.append(el('button', undefined, 'api-mock-body-format'));
    const preview = el('pre', undefined, 'api-mock-preview-body');
    preview.textContent = '{"buyer":"Ada"}';
    document.body.append(preview);
    const ctx = makeCtx();
    await runAm24Response(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalled();
    expect(hasAm24FakerBody()).toBe(true);
  });

  it('variants add a 404 sibling, show sequence, then restore rules', async () => {
    mountStudio({ enabled: true });
    mountEditor();
    const list = el('div', undefined, 'api-mock-variant-list');
    list.append(el('button', undefined, 'api-mock-variant-tab-0'));
    document.body.append(list);
    document.body.append(input('api-mock-variant-name'));
    document.body.append(el('button', undefined, 'api-mock-variant-status-quick-404'));
    document.body.append(el('button', undefined, 'api-mock-response-tab-selection'));
    document.body.append(input('api-mock-selection-condition-path'));
    document.body.append(input('api-mock-selection-condition-value'));
    document.body.append(el('button', undefined, 'api-mock-response-mode-sequence'));
    document.body.append(el('div', undefined, 'api-mock-sequence-order-note'));
    document.body.append(el('button', undefined, 'api-mock-response-mode-rules'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.ADD_VARIANT) {
        const card = el('button', undefined, 'api-mock-variant-tab-1');
        card.textContent = '404';
        document.querySelector('[data-testid="api-mock-variant-list"]')?.append(card);
      }
    });
    await runAm24Variants(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ADD_VARIANT);
    expect(patchApiMockActiveRoute).toHaveBeenCalled();
  });

  it('skips adding a variant when a 404 sibling already exists', async () => {
    mountStudio({ enabled: true });
    mountEditor();
    const list = el('div', undefined, 'api-mock-variant-list');
    const a = el('button', undefined, 'api-mock-variant-tab-0');
    const b = el('button', undefined, 'api-mock-variant-tab-1');
    b.textContent = '404 Not found';
    list.append(a, b);
    document.body.append(list);
    document.body.append(el('button', undefined, 'api-mock-response-mode-rules'));
    const ctx = makeCtx();
    await runAm24Variants(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.ADD_VARIANT);
  });

  it('resilience fills delay + probability then a timeout fault', async () => {
    mountStudio({ enabled: true });
    mountEditor();
    const list = el('div', undefined, 'api-mock-variant-list');
    list.append(el('button', undefined, 'api-mock-variant-tab-0'));
    const last = el('button', undefined, 'api-mock-variant-tab-1');
    last.textContent = '404';
    list.append(last);
    document.body.append(list);
    document.body.append(el('button', undefined, 'api-mock-response-tab-timing'));
    document.body.append(el('div', undefined, 'api-mock-timing-panel'));
    document.body.append(input('api-mock-variant-delay'));
    document.body.append(input('api-mock-variant-probability'));
    document.body.append(el('button', undefined, 'api-mock-response-tab-faults'));
    document.body.append(el('div', undefined, 'api-mock-faults-panel'));
    document.body.append(el('button', undefined, 'api-mock-fault-timeout'));
    const ctx = makeCtx();
    await runAm24Resilience(ctx);
    expect(ctx.fill).toHaveBeenCalled();
    expect(patchApiMockActiveRoute).toHaveBeenCalled();
  });

  it('conflicts add an overlap, analyze, and raise priority', async () => {
    mountStudio({ enabled: true });
    mountEditor();
    document.body.append(el('button', undefined, 'api-mock-add-route'));
    document.body.append(el('button', undefined, 'api-mock-analyze'));
    document.body.append(input('api-mock-priority-input', '0'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.ANALYZE) {
        const list = el('div', undefined, 'api-mock-conflict-list');
        list.append(el('button', undefined, 'api-mock-finding-1'));
        document.body.append(list);
        document.body.append(el('div', undefined, 'api-mock-conflict-summary'));
        document.body.append(el('button', undefined, 'api-mock-conflict-adjust-priority'));
        document.body.append(el('button', undefined, 'api-mock-conflict-prio-left'));
        document.body.append(el('button', undefined, 'api-mock-conflicts-analyze'));
        document.body.append(el('div', undefined, 'api-mock-conflict-filter-empty'));
      }
    });
    await runAm24Conflicts(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ANALYZE);
    expect(hasAm24Finding() || hasAm24ConflictsClean()).toBe(true);
  });

  it('conflicts fall back to View Conflicts and the priority field', async () => {
    mountStudio({ enabled: true });
    mountEditor();
    document.body.append(el('button', undefined, 'api-mock-view-conflicts'));
    document.body.append(input('api-mock-priority-input', '0'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.VIEW_CONFLICTS) {
        document.body.append(el('div', undefined, 'api-mock-conflict-list'));
        document.body.append(el('div', undefined, 'api-mock-conflict-summary'));
      }
    });
    await runAm24Conflicts(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_CONFLICTS);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.PRIORITY_INPUT, '20');
  });

  it('suite opens Simulate, sets expected 201, and runs all', async () => {
    mountStudio({ enabled: true });
    mountEditor();
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.SIMULATE) {
        const ws = el('div', undefined, 'api-mock-simulate-workspace');
        ws.append(el('button', undefined, 'api-mock-sim-tab-assertions'));
        ws.append(input('api-mock-sim-assert-status', '200'));
        ws.append(el('button', undefined, 'api-mock-simulate-run-all'));
        ws.append(el('div', undefined, 'api-mock-simulate-summary'));
        document.body.append(ws);
      }
    });
    await runAm24Suite(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE);
  });

  it('live starts the listener, posts, then records a near-miss', async () => {
    mountStudio({ enabled: true, running: false });
    mountEditor();
    document.body.append(el('button', undefined, 'api-mock-start'));
    document.body.append(el('button', undefined, 'api-mock-apply'));
    document.body.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.START) {
        const stop = el('button', undefined, 'api-mock-stop');
        document.body.append(stop);
        const label = document.querySelector(API_MOCK.STATUS_LABEL);
        if (label) label.textContent = 'Running';
        const dock = el('div', undefined, 'api-mock-dock');
        const table = document.createElement('table');
        const tbody = document.createElement('tbody');
        const tr = document.createElement('tr');
        tr.setAttribute('data-testid', 'api-mock-tx-0');
        makeVisible(tr);
        tbody.append(tr);
        table.append(tbody);
        dock.append(table);
        document.body.append(dock);
        document.body.append(el('div', undefined, 'api-mock-tx-detail'));
        document.body.append(el('div', undefined, 'api-mock-tx-near-misses'));
      }
    });
    await runAm24Live(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);
    expect(sendApiMockRequest).toHaveBeenCalled();
  });

  it('ship exports workspace + WireMock then Quick Tests the graph', async () => {
    mountStudio({ enabled: true });
    document.body.append(el('button', undefined, 'api-mock-export'));
    document.body.append(el('div', 'wf-designer'));
    document.body.append(el('button', 'wf-palette-block-apiMockStart'));
    document.body.append(el('button', 'wf-palette-block-http'));
    document.body.append(el('button', 'wf-palette-block-apiMockAssertCalls'));
    document.body.append(el('button', 'wf-palette-block-apiMockStop'));
    document.body.append(el('button', 'wf-quick-test-btn'));
    document.body.append(el('div', undefined, 'api-mock-start-config'));
    document.body.append(select('api-mock-wf-server', AM24_SERVER_ID));
    document.body.append(el('button', undefined, 'api-mock-wf-isolate'));
    document.body.append(el('input', undefined, 'api-mock-wf-save-port'));
    document.body.append(el('input', undefined, 'api-mock-wf-save-base-url'));
    document.body.append(el('input', 'wf-config-url-input'));
    document.body.append(select('unused', 'POST'));
    const url = document.querySelector('.wf-config-url-input');
    if (url) {
      url.setAttribute('data-testid', 'skip');
      (url as HTMLElement).className = 'wf-config-url-input';
    }
    document.body.append(el('div', undefined, 'api-mock-assert-config'));
    document.body.append(input('api-mock-wf-assert-min', '1'));
    document.body.append(input('api-mock-wf-assert-status'));
    document.body.append(input('api-mock-wf-assert-body'));
    document.body.append(input('api-mock-wf-assert-recency'));
    document.body.append(el('div', undefined, 'api-mock-stop-config'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.EXPORT) {
        const menu = el('div', undefined, 'api-mock-export-menu-panel');
        menu.append(el('button', undefined, 'api-mock-export-workspace'));
        menu.append(el('button', undefined, 'api-mock-export-wiremock'));
        document.body.append(menu);
      }
      if (sel === API_MOCK.EXPORT_WORKSPACE || sel === API_MOCK.EXPORT_WIREMOCK) {
        const confirm = el('div', undefined, 'api-mock-export-confirm');
        confirm.append(el('div', undefined, 'api-mock-export-loss'));
        confirm.append(el('button', undefined, 'api-mock-export-close'));
        document.body.append(confirm);
      }
      if (sel === API_MOCK.EXPORT_CLOSE) {
        document.querySelector(API_MOCK.EXPORT_CONFIRM)?.remove();
      }
      if (sel === WF.PAL_API_MOCK_START) {
        document.body.append(el('div', undefined, 'api-mock-canvas-apiMockStart'));
      }
      if (sel === WF.PAL_HTTP) {
        document.body.append(el('div', 'react-flow__node-http'));
      }
      if (sel === WF.PAL_API_MOCK_ASSERT) {
        const node = el('div', 'wf-node-pass', 'api-mock-canvas-apiMockAssertCalls');
        document.body.append(node);
      }
      if (sel === WF.PAL_API_MOCK_STOP) {
        document.body.append(el('div', undefined, 'api-mock-canvas-apiMockStop'));
      }
    });
    await runAm24Ship(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT);
    expect(triggerWorkflowQuickTest).not.toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(WF.QUICK_TEST);
  });

  it('ship falls back to triggerWorkflowQuickTest when the button is missing', async () => {
    mountStudio({ enabled: true });
    document.body.append(el('div', 'wf-designer'));
    document.body.append(el('div', 'wf-node-pass', 'api-mock-canvas-apiMockStart'));
    document.body.append(el('div', 'wf-node-pass', 'api-mock-canvas-apiMockAssertCalls'));
    const ctx = makeCtx();
    await runAm24Ship(ctx);
    expect(triggerWorkflowQuickTest).toHaveBeenCalled();
  });

  it('ensure matching quietly imports when no drafts exist', async () => {
    mountStudio({ enabled: true });
    mountEditor();
    document.body.append(el('button', undefined, 'api-mock-import-menu'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.IMPORT_MENU) {
        const review = el('div', undefined, 'api-mock-import-review');
        review.append(el('button', undefined, 'api-mock-import-source-openapi'));
        review.append(el('textarea', undefined, 'api-mock-import-paste'));
        review.append(el('button', undefined, 'api-mock-import-parse'));
        review.append(el('button', undefined, 'api-mock-import-confirm'));
        review.append(el('button', undefined, 'api-mock-import-close'));
        document.body.append(review);
      }
    });
    await ensureAm24ForMatching(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('ensure chain skips work that is already on screen', async () => {
    mountStudio({ enabled: true });
    mountEditor();
    const list = el('div', undefined, 'api-mock-variant-list');
    const a = el('button', undefined, 'api-mock-variant-tab-0');
    const b = el('button', undefined, 'api-mock-variant-tab-1');
    b.textContent = '404';
    list.append(a, b);
    document.body.append(list);
    document.body.append(el('div', undefined, 'api-mock-sim-section-saved'));
    const dock = el('div', undefined, 'api-mock-dock');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    tr.setAttribute('data-testid', 'api-mock-tx-0');
    makeVisible(tr);
    tbody.append(tr);
    table.append(tbody);
    dock.append(table);
    document.body.append(dock);
    const ctx = makeCtx();
    await ensureAm24ForResponse(ctx);
    await ensureAm24ForVariants(ctx);
    await ensureAm24ForResilience(ctx);
    await ensureAm24ForConflicts(ctx);
    await ensureAm24ForSuite(ctx);
    await ensureAm24ForLive(ctx);
    await ensureAm24ForShip(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalled();
  });

  it('quiet overlap clicks Add route only when a second POST is missing', async () => {
    mountStudio({ enabled: true });
    mountEditor();
    document.body.append(el('button', undefined, 'api-mock-add-route'));
    document.body.append(input('api-mock-path-input'));
    document.body.append(select('api-mock-method-select', 'GET'));
    const ctx = makeCtx();
    await am24TestHooks.quietOverlap(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ADD_ROUTE);
    ctx.click.mockClear();
    const explorer = document.querySelector(API_MOCK.ROUTE_EXPLORER);
    explorer?.append(mountRoute({ id: 'api-mock-route-dup', draft: false }));
    await am24TestHooks.quietOverlap(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('quiet journal sends traffic only when no row exists', async () => {
    mountStudio({ enabled: true, running: true });
    const ctx = makeCtx();
    await am24TestHooks.quietJournal(ctx);
    expect(sendApiMockRequest).toHaveBeenCalled();
    sendApiMockRequest.mockClear();
    const dock = el('div', undefined, 'api-mock-dock');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    tr.setAttribute('data-testid', 'api-mock-tx-0');
    makeVisible(tr);
    tbody.append(tr);
    table.append(tbody);
    dock.append(table);
    document.body.append(dock);
    await am24TestHooks.quietJournal(ctx);
    expect(sendApiMockRequest).not.toHaveBeenCalled();
  });

  it('quiet node helpers skip when the canvas already has the node', async () => {
    document.body.append(el('div', undefined, 'api-mock-canvas-apiMockStart'));
    document.body.append(el('div', 'react-flow__node-http'));
    document.body.append(el('div', undefined, 'api-mock-canvas-apiMockAssertCalls'));
    document.body.append(el('div', undefined, 'api-mock-canvas-apiMockStop'));
    const ctx = makeCtx();
    await am24TestHooks.quietStart(ctx);
    await am24TestHooks.quietHttp(ctx);
    await am24TestHooks.quietAssert(ctx);
    await am24TestHooks.quietStop(ctx);
    expect(addWorkflowNodeWithPreset).not.toHaveBeenCalled();
  });

  it('dropFromPalette clicks the chip unless the node is already on the canvas', async () => {
    document.body.append(el('button', 'wf-palette-block-http'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === WF.PAL_HTTP) document.body.append(el('div', 'react-flow__node-http'));
    });
    await am24TestHooks.dropFromPalette(ctx, WF.PAL_HTTP, WF.NODE_HTTP);
    expect(ctx.click).toHaveBeenCalledWith(WF.PAL_HTTP);
    ctx.click.mockClear();
    await am24TestHooks.dropFromPalette(ctx, WF.PAL_HTTP, WF.NODE_HTTP);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('dismisses onboarding when the skip chip exists', async () => {
    const skip = el('button', 'onboarding-tooltip-skip');
    document.body.append(skip);
    const click = vi.spyOn(skip, 'click');
    const ctx = makeCtx();
    await am24TestHooks.dismissWfOnboarding(ctx);
    expect(click).toHaveBeenCalled();
    await am24TestHooks.dismissWfOnboarding(ctx);
  });

  it('holdOrEnableIsolate clicks when isolate is off', async () => {
    const iso = el('button', undefined, 'api-mock-wf-isolate');
    iso.setAttribute('aria-checked', 'false');
    document.body.append(iso);
    const ctx = makeCtx();
    await am24TestHooks.holdOrEnableIsolate(ctx);
    expect(clickWfConfigControl).toHaveBeenCalled();
    iso.setAttribute('aria-checked', 'true');
    clickWfConfigControl.mockClear();
    await am24TestHooks.holdOrEnableIsolate(ctx);
    expect(clickWfConfigControl).not.toHaveBeenCalled();
  });

  it('applyIfDirty and export helpers no-op when controls are missing', async () => {
    const ctx = makeCtx();
    await am24TestHooks.applyIfDirty(ctx);
    await am24TestHooks.closeAm24Export(ctx, false);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('closes an open export confirm', async () => {
    const confirm = el('div', undefined, 'api-mock-export-confirm');
    confirm.append(el('button', undefined, 'api-mock-export-close'));
    document.body.append(confirm);
    expect(isAm24ExportConfirmOpen()).toBe(true);
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.EXPORT_CLOSE) confirm.remove();
    });
    await am24TestHooks.closeAm24Export(ctx, true);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT_CLOSE);
  });

  it('ensureAm24Designer seeds a blank workflow', async () => {
    document.body.append(el('div', 'wf-designer'));
    const ctx = makeCtx();
    await ensureAm24Designer(ctx);
    expect(ensureLessonBlankWorkflow).toHaveBeenCalledWith(ctx, AM24_WF_NAME, expect.any(Object));
    expect(collapseWfDemoAppSidebar).toHaveBeenCalled();
  });

  it('pickExport opens the menu and the confirmation', async () => {
    mountStudio({ enabled: true });
    document.body.append(el('button', undefined, 'api-mock-export'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.EXPORT) {
        const menu = el('div', undefined, 'api-mock-export-menu-panel');
        menu.append(el('button', undefined, 'api-mock-export-workspace'));
        document.body.append(menu);
      }
      if (sel === API_MOCK.EXPORT_WORKSPACE) {
        document.body.append(el('div', undefined, 'api-mock-export-confirm'));
      }
    });
    await am24TestHooks.pickExport(ctx, API_MOCK.EXPORT_WORKSPACE, true);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT);
  });

  it('quietAnalyze clicks Analyze or Conflicts', async () => {
    mountStudio({ enabled: true });
    document.body.append(el('button', undefined, 'api-mock-analyze'));
    const ctx = makeCtx();
    await am24TestHooks.quietAnalyze(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ANALYZE);
    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    document.body.append(el('button', undefined, 'api-mock-view-conflicts'));
    ctx.click.mockClear();
    await am24TestHooks.quietAnalyze(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_CONFLICTS);
  });

  it('quietAnalyze skips when a finding already exists', async () => {
    const skipList = el('div', undefined, 'api-mock-conflict-list');
    skipList.append(el('button', undefined, 'api-mock-finding-1'));
    document.body.append(skipList);
    const ctx = makeCtx();
    await am24TestHooks.quietAnalyze(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('hasAm24JsonPath and faker probes read the editor', () => {
    const row = el('div', undefined, 'api-mock-condition-pred-am24-sku');
    row.textContent = '$.sku';
    document.body.append(row);
    expect(hasAm24JsonPath()).toBe(true);
    const preview = el('pre', undefined, 'api-mock-preview-body');
    preview.textContent = "{{faker 'person.firstName'}}";
    document.body.append(preview);
    expect(hasAm24FakerBody()).toBe(true);
  });

  it('openAm24Import clickNow vs quiet', async () => {
    mountStudio({ enabled: true });
    document.body.append(el('button', undefined, 'api-mock-import-menu'));
    const ctx = makeCtx();
    ctx.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.IMPORT_MENU) {
        document.body.append(el('div', undefined, 'api-mock-import-review'));
      }
    });
    await am24TestHooks.openAm24Import(ctx, true);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_MENU);
    await am24TestHooks.openAm24Import(ctx, false);
  });

  it('selectOpenApiSource is a no-op when the source is already active', async () => {
    const review = el('div', undefined, 'api-mock-import-review');
    const src = el('button', 'active', 'api-mock-import-source-openapi');
    review.append(src);
    document.body.append(review);
    const ctx = makeCtx();
    await am24TestHooks.selectOpenApiSource(ctx, false);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.importSource('openapi'));
  });

  it('aim/fillNow helpers click and fill without throwing', async () => {
    document.body.append(el('button', undefined, 'api-mock-start'));
    document.body.append(input('api-mock-path-input'));
    const ctx = makeCtx();
    await am24TestHooks.am24Aim(ctx, API_MOCK.START);
    await am24TestHooks.am24ClickNow(ctx, API_MOCK.START);
    await am24TestHooks.am24FillNow(ctx, API_MOCK.PATH_INPUT, '/orders');
    await am24TestHooks.am24AimFill(ctx, API_MOCK.PATH_INPUT, '/orders');
    expect(ctx.click).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('covers remaining quiet authors, tabs, wire, and export skip paths', async () => {
    expect(hasAm24Assert()).toBe(false);
    document.body.append(el('div', undefined, 'api-mock-canvas-apiMockAssertCalls'));
    expect(hasAm24Assert()).toBe(true);

    mountStudio({ enabled: true });
    const ctx = makeCtx();
    await am24TestHooks.ensureAm24RuleOpen(ctx);
    expect(ctx.click).toHaveBeenCalled();

    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    const matchTab = el('button');
    matchTab.id = 'api-mock-btab-match';
    document.body.append(matchTab);
    const ctx2 = makeCtx();
    await am24TestHooks.ensureAm24MatchTab(ctx2);
    expect(ctx2.click).toHaveBeenCalledWith(API_MOCK.BTAB_MATCH);

    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    const respTab = el('button');
    respTab.id = 'api-mock-btab-response';
    document.body.append(respTab);
    const ctx3 = makeCtx();
    await am24TestHooks.ensureAm24ResponseTab(ctx3);
    expect(ctx3.click).toHaveBeenCalledWith(API_MOCK.BTAB_RESPONSE);

    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    document.body.append(el('button', undefined, 'api-mock-import-menu'));
    const ctx4 = makeCtx();
    ctx4.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.IMPORT_MENU) {
        const review = el('div', undefined, 'api-mock-import-review');
        review.append(el('button', undefined, 'api-mock-import-source-openapi'));
        review.append(el('textarea', undefined, 'api-mock-import-paste'));
        review.append(el('button', undefined, 'api-mock-import-parse'));
        review.append(el('div', undefined, 'api-mock-import-route-list'));
        review.append(checkbox('api-mock-import-generalize', false));
        review.append(el('button', undefined, 'api-mock-import-confirm'));
        review.append(el('button', undefined, 'api-mock-import-close'));
        document.body.append(review);
      }
    });
    await am24TestHooks.quietParseOpenApi(ctx4);
    expect(ctx4.fill).toHaveBeenCalledWith(API_MOCK.IMPORT_PASTE, AM24_OPENAPI);
    expect(ctx4.click).toHaveBeenCalledWith(API_MOCK.IMPORT_GENERALIZE);

    document.body.innerHTML = '';
    mountStudio({ draft: true });
    const enabled = el('button', undefined, 'api-mock-route-enabled');
    enabled.setAttribute('title', 'Enable this rule');
    document.body.append(enabled);
    const ctx5 = makeCtx();
    await am24TestHooks.quietEnableOrders(ctx5);
    expect(ctx5.click).toHaveBeenCalledWith(API_MOCK.ROUTE_ENABLED);

    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    mountEditor();
    document.body.append(el('button', undefined, 'api-mock-apply'));
    const ctx6 = makeCtx();
    await am24TestHooks.applyIfDirty(ctx6);
    expect(ctx6.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    await am24TestHooks.quietJsonPath(ctx6);
    await am24TestHooks.quietFakerBody(ctx6);
    await am24TestHooks.quietNotFoundVariant(ctx6);
    await am24TestHooks.quietDelayAndFault(ctx6);
    expect(patchApiMockActiveRoute).toHaveBeenCalled();

    document.body.append(input('api-mock-priority-input', '0'));
    await am24TestHooks.quietFixPriority(ctx6);
    expect(ctx6.fill).toHaveBeenCalledWith(API_MOCK.PRIORITY_INPUT, '20');

    document.body.append(el('button', undefined, 'api-mock-simulate'));
    ctx6.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.SIMULATE) {
        const ws = el('div', undefined, 'api-mock-simulate-workspace');
        ws.append(select('api-mock-simulate-method', 'GET'));
        ws.append(input('api-mock-simulate-path', '/'));
        ws.append(el('textarea', undefined, 'api-mock-simulate-body'));
        ws.append(el('div', undefined, 'api-mock-sim-outcome'));
        document.body.append(ws);
      }
    });
    await am24TestHooks.quietSample(ctx6);
    expect(ctx6.click).toHaveBeenCalledWith(API_MOCK.SIMULATE);

    document.body.innerHTML = '';
    mountStudio({ enabled: true, running: false });
    document.body.append(el('button', undefined, 'api-mock-start'));
    const ctx7 = makeCtx();
    await am24TestHooks.ensureAm24Running(ctx7);
    expect(ctx7.click).toHaveBeenCalledWith(API_MOCK.START);
    await am24TestHooks.ensureAm24Running(ctx7);

    document.body.innerHTML = '';
    const start = el('div', 'react-flow__node', 'api-mock-canvas-apiMockStart');
    start.setAttribute('data-id', 'n-start');
    const http = el('div', 'react-flow__node-http');
    http.setAttribute('data-id', 'n-http');
    http.classList.add('react-flow__node');
    const assert = el('div', 'react-flow__node', 'api-mock-canvas-apiMockAssertCalls');
    assert.setAttribute('data-id', 'n-assert');
    const stop = el('div', 'react-flow__node', 'api-mock-canvas-apiMockStop');
    stop.setAttribute('data-id', 'n-stop');
    document.body.append(start, http, assert, stop);
    await am24TestHooks.quietWire();
    expect(connectWorkflowNodes).toHaveBeenCalled();
    const ctx8 = makeCtx();
    await am24TestHooks.connectPair(ctx8, API_MOCK.CANVAS_START, WF.NODE_HTTP);
    expect(connectWorkflowNodes).toHaveBeenCalledWith('n-start', 'n-http');

    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    document.body.append(el('button', undefined, 'api-mock-export'));
    const ctx9 = makeCtx();
    ctx9.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.EXPORT) {
        const menu = el('div', undefined, 'api-mock-export-menu-panel');
        menu.append(el('button', undefined, 'api-mock-export-workspace'));
        document.body.append(menu);
      }
      if (sel === API_MOCK.EXPORT_WORKSPACE) {
        document.body.append(el('div', undefined, 'api-mock-export-confirm'));
      }
    });
    await am24TestHooks.pickExport(ctx9, API_MOCK.EXPORT_WORKSPACE, false);
    expect(ctx9.click).toHaveBeenCalledWith(API_MOCK.EXPORT_WORKSPACE);

    document.body.append(el('div', undefined, 'api-mock-export-confirm'));
    await am24TestHooks.openAm24ExportMenu(ctx9, false);

    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    document.body.append(el('div', undefined, 'api-mock-import-review'));
    const ctx10 = makeCtx();
    await closeAm24Import(ctx10);
    expect(ctx10.click).not.toHaveBeenCalled();

    document.body.append(el('div', undefined, 'api-mock-simulate-workspace'));
    await closeAm24Simulate(ctx10);
    expect(ctx10.click).not.toHaveBeenCalledWith(API_MOCK.SIMULATE_CLOSE);

    document.body.append(el('div', undefined, 'api-mock-tx-outcome'));
    mountStudio({ enabled: true, running: true });
    document.body.append(el('button', undefined, 'api-mock-start'));
    const ctx11 = makeCtx();
    await runAm24Live(ctx11);
    expect(sendApiMockRequest).toHaveBeenCalled();

    document.body.append(el('button', undefined, 'api-mock-simulate'));
    await am24TestHooks.openAm24Simulate(ctx11, false);
    await am24TestHooks.runOrdersSimulation(ctx11, '{}', 'adhoc');

    document.body.append(el('button', 'wf-designer'));
    const fit = el('button');
    fit.setAttribute('title', 'Fit view');
    fit.className = 'wf-fit';
    const designer = el('div', 'wf-designer');
    designer.append(fit);
    document.body.append(designer);
    makeVisible(fit);
  });

  it('covers remaining probe, waitFor-reject, and ship branch paths', async () => {
    expect(am24FindRoute('/nope')).toBeUndefined();
    const explorer = el('div', undefined, 'api-mock-route-explorer');
    const bare = document.createElement('button');
    bare.className = 'am-route-item';
    bare.setAttribute('role', 'treeitem');
    makeVisible(bare);
    explorer.append(bare);
    const getRow = mountRoute({ method: 'GET', path: AM24_ORDERS_PATH, id: 'api-mock-route-get' });
    explorer.append(getRow);
    const live = mountRoute({ draft: false, id: 'api-mock-route-live-only' });
    explorer.append(live);
    document.body.append(explorer);
    expect(am24FindRoute('', 'POST')).toBeUndefined();
    expect(am24FindRoute(AM24_ORDERS_PATH, 'POST', false)).toBeUndefined();
    expect(am24FindRoute(AM24_ORDERS_PATH, 'GET')?.getAttribute('data-testid')).toBe('api-mock-route-get');
    const ctx = makeCtx();
    await am24TestHooks.selectOrdersRoute(ctx, true);
    expect(ctx.click).toHaveBeenCalled();

    const jsonRow = el('div', undefined, 'api-mock-condition-other');
    jsonRow.textContent = 'jsonPath';
    document.body.append(jsonRow);
    expect(hasAm24JsonPath()).toBe(true);
    expect(hasAm24FakerBody()).toBe(false);
    const editor = el('textarea', undefined, 'api-mock-variant-body');
    editor.textContent = "{{faker 'person.firstName'}}";
    document.body.append(editor);
    expect(hasAm24FakerBody()).toBe(true);
    const list = el('div', undefined, 'api-mock-variant-list');
    const named = el('button', undefined, 'api-mock-variant-tab-2');
    named.textContent = 'Not found';
    list.append(named);
    document.body.append(list);
    expect(hasAm24NotFoundVariant()).toBe(true);
    document.body.append(el('div', undefined, 'api-mock-conflict-summary'));
    expect(hasAm24ConflictsClean()).toBe(true);
    expect(isAm24RouteEnabled()).toBe(false);
    expect(am24ServerRunning()).toBe(false);
    expect(am24CanvasNodeId(API_MOCK.CANVAS_START)).toBeNull();
    const loose = el('div', undefined, 'api-mock-canvas-apiMockStart');
    loose.setAttribute('data-id', 'loose-start');
    document.body.append(loose);
    expect(am24CanvasNodeId(API_MOCK.CANVAS_START)).toBe('loose-start');

    document.body.innerHTML = '';
    const ctxSkip = makeCtx();
    await am24TestHooks.dismissWfOnboarding(ctxSkip);
    await am24TestHooks.openAm24Import(ctxSkip, false);
    await am24TestHooks.ensureAm24MatchTab(ctxSkip);
    await am24TestHooks.ensureAm24ResponseTab(ctxSkip);
    await am24TestHooks.ensureAm24Running(ctxSkip);
    await am24TestHooks.connectPair(ctxSkip, API_MOCK.CANVAS_START, WF.NODE_HTTP);
    await am24TestHooks.quietWire();
    expect(connectWorkflowNodes).not.toHaveBeenCalled();

    document.body.append(el('div', undefined, 'api-mock-server-bar'));
    document.body.append(el('div', undefined, 'api-mock-route-explorer'));
    document.body.append(el('button', undefined, 'nav-tab-api-mock-studio'));
    const ctxImport = makeCtx();
    ctxImport.waitFor.mockImplementation(async () => Promise.reject(new Error('timeout')));
    ctxImport.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.IMPORT_MENU) {
        const review = el('div', undefined, 'api-mock-import-review');
        review.append(el('textarea', undefined, 'api-mock-import-paste'));
        review.append(el('button', undefined, 'api-mock-import-parse'));
        review.append(checkbox('api-mock-import-generalize', true));
        review.append(el('button', undefined, 'api-mock-import-confirm'));
        review.append(el('button', undefined, 'api-mock-import-cancel'));
        document.body.append(review);
      }
      if (sel === API_MOCK.SIMULATE) {
        const ws = el('div', undefined, 'api-mock-simulate-workspace');
        ws.append(select('api-mock-simulate-method', 'GET'));
        ws.append(input('api-mock-simulate-path', AM24_ORDERS_PATH));
        ws.append(el('textarea', undefined, 'api-mock-simulate-body'));
        document.body.append(ws);
      }
      if (sel === API_MOCK.EXPORT) {
        const menu = el('div', undefined, 'api-mock-export-menu-panel');
        menu.append(el('button', undefined, 'api-mock-export-workspace'));
        document.body.append(menu);
      }
    });
    document.body.append(el('button', undefined, 'api-mock-import-menu'));
    await am24TestHooks.quietParseOpenApi(ctxImport);
    await closeAm24Import(ctxImport);
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    await am24TestHooks.openAm24Simulate(ctxImport, false);
    document.body.append(el('button', undefined, 'api-mock-export'));
    await am24TestHooks.pickExport(ctxImport, API_MOCK.EXPORT_WORKSPACE, false);
    await am24TestHooks.openAm24ExportMenu(ctxImport, false);

    const ctxSim = makeCtx();
    ctxSim.selectOption.mockImplementation(async () => Promise.reject(new Error('no select')));
    await am24TestHooks.runOrdersSimulation(ctxSim, AM24_SKU, 'reject');
    await am24TestHooks.openAm24Simulate(ctxSim, true);
    document.body.append(el('div', undefined, 'api-mock-simulate-workspace'));
    await am24TestHooks.openAm24Simulate(ctxSim, false);

    document.body.innerHTML = '';
    const conflictList = el('div', undefined, 'api-mock-conflict-list');
    conflictList.append(el('button', undefined, 'api-mock-finding-1'));
    document.body.append(conflictList);
    document.body.append(el('div', undefined, 'api-mock-route-explorer'));
    const ctxFind = makeCtx();
    await am24TestHooks.quietAnalyze(ctxFind);
    expect(ctxFind.click).not.toHaveBeenCalled();

    document.body.innerHTML = '';
    ensureBlankApiMockServer.mockResolvedValueOnce(false);
    const ctxCreated = makeCtx();
    await ensureAm24Server(ctxCreated);
    expect(ctxCreated.waitFor).not.toHaveBeenCalled();

    document.body.innerHTML = '';
    const ctxServer = makeCtx();
    ctxServer.waitFor.mockImplementation(async () => Promise.reject(new Error('timeout')));
    await ensureAm24Server(ctxServer);
    expect(ensureBlankApiMockServer).toHaveBeenCalled();
    document.body.append(el('button', undefined, 'api-mock-view-studio'));
    await ensureAm24StudioView(ctxServer);
    mountStudio({ enabled: true, running: false });
    document.body.append(el('button', undefined, 'api-mock-start'));
    await am24TestHooks.ensureAm24Running(ctxServer);
    await am24TestHooks.selectOrdersRoute(ctxServer, false);

    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    document.body.append(el('div', undefined, 'api-mock-route-editor'));
    const ctxTabs = makeCtx();
    await am24TestHooks.ensureAm24MatchTab(ctxTabs);
    await am24TestHooks.ensureAm24ResponseTab(ctxTabs);
    expect(ctxTabs.click).not.toHaveBeenCalledWith(API_MOCK.BTAB_MATCH);

    document.body.innerHTML = '';
    const emptyExplorer = el('div', undefined, 'api-mock-route-explorer');
    document.body.append(emptyExplorer);
    document.body.append(el('div', undefined, 'api-mock-server-bar'));
    document.body.append(el('button', undefined, 'nav-tab-api-mock-studio'));
    document.body.append(el('button', undefined, 'api-mock-import-menu'));
    const ctxMatch = makeCtx();
    ctxMatch.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.IMPORT_MENU) {
        const review = el('div', undefined, 'api-mock-import-review');
        review.append(el('button', 'active', 'api-mock-import-source-openapi'));
        review.append(el('textarea', undefined, 'api-mock-import-paste'));
        review.append(el('button', undefined, 'api-mock-import-parse'));
        review.append(el('div', undefined, 'api-mock-import-route-list'));
        review.append(el('button', undefined, 'api-mock-import-confirm'));
        review.append(el('button', undefined, 'api-mock-import-close'));
        document.body.append(review);
      }
    });
    await ensureAm24ForMatching(ctxMatch);
    expect(ctxMatch.fill).toHaveBeenCalledWith(API_MOCK.IMPORT_PASTE, AM24_OPENAPI);

    document.body.innerHTML = '';
    mountStudio({ draft: true });
    mountEditor();
    const enableBtn = document.querySelector(API_MOCK.ROUTE_ENABLED) as HTMLElement;
    enableBtn.setAttribute('title', 'Enable this rule');
    document.body.append(el('button', undefined, 'api-mock-import-menu'));
    const noIdDraft = document.createElement('button');
    noIdDraft.className = 'am-route-item disabled';
    noIdDraft.setAttribute('role', 'treeitem');
    makeVisible(noIdDraft);
    document.querySelector(API_MOCK.ROUTE_EXPLORER)?.append(noIdDraft);
    const ctxSpec = makeCtx();
    ctxSpec.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.IMPORT_MENU) {
        const review = el('div', undefined, 'api-mock-import-review');
        review.append(el('button', undefined, 'api-mock-import-sources'));
        const src = el('button', undefined, 'api-mock-import-source-openapi');
        review.append(src);
        review.append(el('textarea', undefined, 'api-mock-import-paste'));
        review.append(el('button', undefined, 'api-mock-import-parse'));
        review.append(el('div', undefined, 'api-mock-import-route-list'));
        review.append(checkbox('api-mock-import-generalize', false));
        review.append(el('button', undefined, 'api-mock-import-confirm'));
        review.append(el('button', undefined, 'api-mock-import-close'));
        document.body.append(review);
      }
      if (sel === API_MOCK.importSource('openapi')) {
        document.querySelector(API_MOCK.importSource('openapi'))?.classList.add('active');
      }
      if (sel === API_MOCK.IMPORT_CONFIRM) {
        document.querySelector(API_MOCK.IMPORT_REVIEW)?.remove();
      }
    });
    await runAm24FromSpec(ctxSpec);
    expect(ctxSpec.click).toHaveBeenCalledWith(API_MOCK.ROUTE_ENABLED);

    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    document.body.append(el('div', undefined, 'api-mock-route-editor'));
    const respTab = el('button');
    respTab.id = 'api-mock-btab-response';
    document.body.append(respTab);
    const ctxResp = makeCtx();
    await runAm24Response(ctxResp);
    expect(ctxResp.click).toHaveBeenCalledWith(API_MOCK.BTAB_RESPONSE);

    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    mountEditor();
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    await runAm24Matching(makeCtx());

    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    mountEditor();
    document.body.append(el('button', undefined, 'api-mock-add-route'));
    document.body.append(input('api-mock-path-input'));
    document.body.append(el('button', undefined, 'api-mock-analyze'));
    document.body.append(el('button', undefined, 'api-mock-view-studio'));
    const explorerEl = document.querySelector(API_MOCK.ROUTE_EXPLORER) as HTMLElement;
    const ctxConf = makeCtx();
    ctxConf.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.ANALYZE) {
        document.body.append(el('div', undefined, 'api-mock-conflict-list'));
        document.body.append(el('div', undefined, 'api-mock-conflict-summary'));
        explorerEl.getBoundingClientRect = () => ({
          width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => '{}',
        } as DOMRect);
      }
    });
    await runAm24Conflicts(ctxConf);
    expect(ctxConf.click).toHaveBeenCalledWith(API_MOCK.ANALYZE);
    expect(ctxConf.fill).toHaveBeenCalledWith(API_MOCK.PATH_INPUT, AM24_ORDERS_PATH);

    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    document.body.append(el('button', undefined, 'api-mock-analyze'));
    document.body.append(el('button', undefined, 'api-mock-conflicts-analyze'));
    const ctxAn = makeCtx();
    await am24TestHooks.quietAnalyze(ctxAn);
    expect(ctxAn.click).toHaveBeenCalledWith(API_MOCK.CONFLICTS_ANALYZE);

    document.body.innerHTML = '';
    const confirm = el('div', undefined, 'api-mock-export-confirm');
    confirm.append(el('button', undefined, 'api-mock-export-close'));
    document.body.append(confirm);
    const ctxExp = makeCtx();
    await am24TestHooks.closeAm24Export(ctxExp, false);
    expect(ctxExp.click).toHaveBeenCalledWith(API_MOCK.EXPORT_CLOSE);

    document.body.innerHTML = '';
    const ctxQuiet = makeCtx();
    await am24TestHooks.quietStart(ctxQuiet);
    await am24TestHooks.quietHttp(ctxQuiet);
    await am24TestHooks.quietAssert(ctxQuiet);
    await am24TestHooks.quietStop(ctxQuiet);
    expect(addWorkflowNodeWithPreset).toHaveBeenCalled();

    document.body.innerHTML = '';
    mountStudio({ enabled: true });
    document.body.append(el('button', undefined, 'api-mock-export'));
    const designer = el('div', 'wf-designer');
    const fit = el('button');
    fit.setAttribute('title', 'Fit view');
    designer.append(fit);
    document.body.append(designer);
    document.body.append(el('button', 'wf-palette-block-apiMockStart'));
    document.body.append(el('button', 'wf-palette-block-http'));
    document.body.append(el('button', 'wf-palette-block-apiMockAssertCalls'));
    document.body.append(el('button', 'wf-palette-block-apiMockStop'));
    document.body.append(el('div', undefined, 'api-mock-start-config'));
    document.body.append(select('api-mock-wf-server', AM24_SERVER_ID));
    document.body.append(el('button', undefined, 'api-mock-wf-isolate'));
    document.body.append(el('div', undefined, 'api-mock-assert-config'));
    document.body.append(input('api-mock-wf-assert-min', '0'));
    document.body.append(input('api-mock-wf-assert-status'));
    document.body.append(input('api-mock-wf-assert-body'));
    document.body.append(input('api-mock-wf-assert-recency'));
    document.body.append(el('div', undefined, 'api-mock-stop-config'));
    const ctxShip = makeCtx();
    ctxShip.click.mockImplementation(async (sel: string) => {
      if (sel === API_MOCK.EXPORT) {
        const menu = el('div', undefined, 'api-mock-export-menu-panel');
        menu.append(el('button', undefined, 'api-mock-export-workspace'));
        menu.append(el('button', undefined, 'api-mock-export-wiremock'));
        document.body.append(menu);
      }
      if (sel === API_MOCK.EXPORT_WORKSPACE || sel === API_MOCK.EXPORT_WIREMOCK) {
        const box = el('div', undefined, 'api-mock-export-confirm');
        box.append(el('div', undefined, 'api-mock-export-loss'));
        box.append(el('button', undefined, 'api-mock-export-close'));
        document.body.append(box);
      }
      if (sel === API_MOCK.EXPORT_CLOSE) {
        document.querySelector(API_MOCK.EXPORT_CONFIRM)?.remove();
      }
      if (sel === WF.PAL_API_MOCK_START) {
        const node = el('div', 'react-flow__node', 'api-mock-canvas-apiMockStart');
        node.setAttribute('data-id', 'n-start');
        document.body.append(node);
      }
      if (sel === WF.PAL_HTTP) {
        const node = el('div', 'react-flow__node-http wf-node-pass');
        node.classList.add('react-flow__node');
        node.setAttribute('data-id', 'n-http');
        document.body.append(node);
      }
      if (sel === WF.PAL_API_MOCK_ASSERT) {
        const node = el('div', 'react-flow__node wf-node-pass', 'api-mock-canvas-apiMockAssertCalls');
        node.setAttribute('data-id', 'n-assert');
        document.body.append(node);
      }
      if (sel === WF.PAL_API_MOCK_STOP) {
        const node = el('div', 'react-flow__node', 'api-mock-canvas-apiMockStop');
        node.setAttribute('data-id', 'n-stop');
        document.body.append(node);
      }
    });
    await runAm24Ship(ctxShip);
    expect(patchWorkflowNodeDataById).toHaveBeenCalled();
    expect(ctxShip.click).toHaveBeenCalledWith(WF.FIT_VIEW_BTN);
    expect(triggerWorkflowQuickTest).toHaveBeenCalled();
  });
});
