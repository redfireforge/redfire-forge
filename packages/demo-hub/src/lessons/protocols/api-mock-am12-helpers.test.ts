/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import type { DemoActionContext } from '../../types';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const importApiMockGallerySample = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();
const patchApiMockActiveRoute = vi.fn(() => true);
const sendApiMockRequest = vi.fn(async () => ({ status: 200, body: '{"ok":true,"items":[]}' }));

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [string])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  patchApiMockActiveRoute: (...a: unknown[]) => patchApiMockActiveRoute(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
}));

import {
  AM12_CORPUS_SAMPLE,
  AM12_ERR_BODY,
  AM12_JSONPATH,
  AM12_MATCH_BODY,
  AM12_MISS_BODY,
  AM12_NOT_FOUND_CONDITIONS,
  AM12_OK_BODY,
  AM12_PATH,
  AM12_SKU_MISSING,
  AM12_TIMING,
  AM12_VARIANT_NAME,
  am12ConditionPath,
  am12HasDefaultBadge,
  am12HasJsonPathCondition,
  am12HasNotFoundVariant,
  am12HasSeqRow,
  am12IsRulesMode,
  am12IsSequenceMode,
  am12SimMethod,
  am12SimOutcome,
  am12VariantCount,
  cleanupAm12,
  closeAm12Simulate,
  ensureAm12Conditions,
  ensureAm12Default,
  ensureAm12ForApply,
  ensureAm12JournalOpen,
  ensureAm12NotFoundVariant,
  ensureAm12ResponseTab,
  ensureAm12RuleOpen,
  ensureAm12Running,
  ensureAm12SelectionTab,
  ensureAm12Sequence,
  ensureAm12StateLive,
  ensureAm12StudioView,
  ensureAm12Workspace,
  hasAm12RouteEditor,
  hasAm12Traffic,
  hasAm12Workspace,
  isAm12ServerRunning,
  isAm12SimulateOpen,
  isAm12StudioViewActive,
  isAm12RuntimeViewActive,
  prepareAm12Workspace,
  runAm12AddVariant,
  runAm12Conditions,
  runAm12Default,
  runAm12ModeBar,
  runAm12ProveRules,
  runAm12Sequence,
  runAm12StateTab,
  runAm12ThreeCalls,
  sendAm12ProveRequest,
} from './api-mock-am12-helpers';

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function mountExplorer(): void {
  const explorer = el('div', 'am-explorer', 'api-mock-route-explorer');
  const row = el('button', 'am-route-item', 'api-mock-route-row');
  row.setAttribute('role', 'treeitem');
  explorer.append(row);
  document.body.append(explorer);
  if (!document.querySelector('[data-testid="api-mock-view-runtime"]')) {
    const nav = el('nav', undefined, 'api-mock-workspace-nav');
    nav.append(el('button', undefined, 'api-mock-view-studio'));
    nav.append(el('button', undefined, 'api-mock-view-runtime'));
    document.body.append(nav);
  }
}

function mountServerBar(running: boolean, apply = false): void {
  const bar = el('div', 'am-server-bar', 'api-mock-server-bar');
  const status = el('span', undefined, 'api-mock-status-label');
  status.textContent = running ? 'Running' : 'Stopped';
  bar.append(status);
  if (running) bar.append(el('button', 'am-btn', 'api-mock-stop'));
  else bar.append(el('button', 'am-btn', 'api-mock-start'));
  if (apply) bar.append(el('button', 'am-btn', 'api-mock-apply'));
  bar.append(el('span', undefined, 'api-mock-generation'));
  document.body.append(bar);
}

function mountVariantCard(id: string, label: string, isDefault = false): HTMLElement {
  const card = el('button', 'am-variant-card', `api-mock-variant-tab-${id}`);
  card.textContent = label;
  if (isDefault) card.append(el('span', 'am-badge', 'api-mock-variant-default-badge'));
  return card;
}

function mountEditor(opts: {
  variants?: Array<{ id: string; label: string; isDefault?: boolean }>;
  rules?: boolean;
  sequence?: boolean;
  selection?: boolean;
  jsonPath?: boolean;
} = {}): void {
  const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
  const response = el('div', undefined, 'api-mock-response-editor');
  const modeBar = el('div', undefined, 'api-mock-response-mode-bar');
  const rules = el('button', opts.rules === false ? '' : 'active', 'api-mock-response-mode-rules');
  rules.setAttribute('aria-pressed', opts.sequence ? 'false' : 'true');
  const seq = el('button', opts.sequence ? 'active' : '', 'api-mock-response-mode-sequence');
  seq.setAttribute('aria-pressed', opts.sequence ? 'true' : 'false');
  modeBar.append(
    rules,
    el('button', undefined, 'api-mock-response-mode-weighted'),
    el('button', undefined, 'api-mock-response-mode-state'),
    seq,
  );
  if (opts.sequence) modeBar.append(el('span', 'am-hint', 'api-mock-sequence-order-note'));
  const sidebar = el('aside', undefined, 'api-mock-variant-sidebar');
  const list = el('div', undefined, 'api-mock-variant-list');
  const variants = opts.variants ?? [{ id: 'resp-1', label: '200 In cart', isDefault: true }];
  for (const v of variants) list.append(mountVariantCard(v.id, v.label, v.isDefault));
  sidebar.append(list);
  sidebar.append(el('button', 'am-btn', 'api-mock-add-variant'));
  response.append(modeBar, sidebar);
  response.append(el('input', undefined, 'api-mock-variant-name'));
  response.append(el('button', undefined, 'api-mock-variant-status-quick-404'));
  response.append(el('span', undefined, 'api-mock-preview-status'));
  response.append(el('button', undefined, 'api-mock-response-tab-selection'));
  if (opts.selection) {
    const panel = el('div', undefined, 'api-mock-selection-panel');
    const chip = el('span', undefined, 'api-mock-selection-condition');
    chip.textContent = opts.jsonPath ? `${AM12_JSONPATH} = ${AM12_SKU_MISSING}` : 'No extra condition';
    const path = document.createElement('input');
    path.setAttribute('data-testid', 'api-mock-selection-condition-path');
    if (opts.jsonPath) path.value = AM12_JSONPATH;
    makeVisible(path);
    const value = document.createElement('input');
    value.setAttribute('data-testid', 'api-mock-selection-condition-value');
    if (opts.jsonPath) value.value = AM12_SKU_MISSING;
    makeVisible(value);
    panel.append(
      chip,
      path,
      value,
      el('button', undefined, 'api-mock-selection-default'),
      el('span', undefined, 'api-mock-selection-default-note'),
    );
    if (opts.sequence) {
      const pos = el('span', undefined, 'api-mock-sequence-position');
      pos.textContent = 'Position 0 of 2';
      panel.append(pos);
    }
    response.append(panel);
  }
  editor.append(response);
  const btab = document.createElement('button');
  btab.id = 'api-mock-btab-response';
  makeVisible(btab);
  editor.append(btab);
  document.body.append(editor);
}

function mountSimulate(outcome = 'MATCHED'): void {
  const workspace = el('div', undefined, 'api-mock-simulate-workspace');
  const method = el('div', undefined, 'api-mock-simulate-method');
  method.setAttribute('data-value', 'POST');
  workspace.append(method);
  workspace.append(el('input', undefined, 'api-mock-simulate-path'));
  workspace.append(el('textarea', undefined, 'api-mock-simulate-body'));
  workspace.append(el('button', undefined, 'api-mock-simulate-run'));
  workspace.append(el('button', undefined, 'api-mock-simulate-close'));
  workspace.append(el('button', undefined, 'api-mock-simulate-save-sample'));
  workspace.append(el('button', undefined, 'api-mock-sim-tab-rendered'));
  const result = el('div', undefined, 'api-mock-simulate-result');
  const out = el('span', undefined, 'api-mock-sim-outcome');
  out.textContent = outcome;
  result.append(out);
  workspace.append(result);
  const rendered = el('div', undefined, 'api-mock-sim-rendered');
  const status = el('span', undefined, 'api-mock-sim-rendered-status');
  status.textContent = '404';
  rendered.append(status);
  rendered.append(el('pre', undefined, 'api-mock-sim-rendered-body'));
  workspace.append(rendered);
  document.body.append(workspace);
}

function mountLiveStrip(): void {
  const strip = el('div', undefined, 'api-mock-live-strip');
  const tx = el('button', undefined, 'api-mock-live-transactions');
  tx.append(Object.assign(el('span', 'am-count-badge'), { textContent: '1' }));
  strip.append(tx);
  document.body.append(strip);
}

function mountJournal(): void {
  const dock = el('div', undefined, 'api-mock-dock');
  dock.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
  dock.append(el('button', undefined, 'api-mock-dock-tab-state'));
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  const tr = el('tr', undefined, 'api-mock-tx-1');
  tbody.append(tr);
  table.append(tbody);
  dock.append(table);
  const state = el('div', undefined, 'api-mock-dock-state');
  const live = el('div', undefined, 'api-mock-dock-state-live');
  live.append(el('span', 'am-chip', 'api-mock-dock-seq-row'));
  state.append(live);
  dock.append(state);
  document.body.append(dock);
  const detail = el('div', undefined, 'api-mock-tx-detail');
  detail.append(el('section', undefined, 'api-mock-tx-response'));
  document.body.append(detail);
}

function withClickSideEffects(ctx: DemoActionContext): void {
  ctx.click = vi.fn(async (selector: string) => {
    if (selector === API_MOCK.ADD_VARIANT) {
      document.querySelector(API_MOCK.VARIANT_LIST)
        ?.append(mountVariantCard('resp-2', `404 ${AM12_VARIANT_NAME}`));
    }
    if (selector === API_MOCK.SIMULATE && !document.querySelector(API_MOCK.SIMULATE_WORKSPACE)) {
      mountSimulate();
    }
    if (selector === API_MOCK.SIMULATE_CLOSE) {
      document.querySelector(API_MOCK.SIMULATE_WORKSPACE)?.remove();
    }
    if (selector === API_MOCK.RESPONSE_TAB_SELECTION && !document.querySelector(API_MOCK.SELECTION_PANEL)) {
      const panel = el('div', undefined, 'api-mock-selection-panel');
      panel.append(el('span', undefined, 'api-mock-selection-condition'));
      const path = document.createElement('input');
      path.setAttribute('data-testid', 'api-mock-selection-condition-path');
      makeVisible(path);
      const value = document.createElement('input');
      value.setAttribute('data-testid', 'api-mock-selection-condition-value');
      makeVisible(value);
      panel.append(path, value, el('button', undefined, 'api-mock-selection-default'), el('span', undefined, 'api-mock-selection-default-note'));
      document.querySelector(API_MOCK.RESPONSE_EDITOR)?.append(panel);
    }
    if (selector === API_MOCK.RESPONSE_MODE_SEQUENCE) {
      document.querySelector(API_MOCK.RESPONSE_MODE_SEQUENCE)?.setAttribute('aria-pressed', 'true');
      if (!document.querySelector(API_MOCK.SEQUENCE_ORDER_NOTE)) {
        document.querySelector(API_MOCK.RESPONSE_MODE_BAR)
          ?.append(el('span', 'am-hint', 'api-mock-sequence-order-note'));
      }
    }
    if (selector === API_MOCK.LIVE_TRANSACTIONS && !document.querySelector(API_MOCK.DOCK)) {
      mountJournal();
    }
    if ((selector === API_MOCK.VIEW_RUNTIME || selector === API_MOCK.OPEN_RUNTIME)
      && !document.querySelector(API_MOCK.DOCK)) {
      document.body.append(el('div', undefined, 'api-mock-runtime-page'));
      mountJournal();
    }
    if (selector === API_MOCK.VIEW_STUDIO && !document.querySelector(API_MOCK.ROUTE_EXPLORER)) {
      mountExplorer();
      mountServerBar(true, true);
    }
  }) as DemoActionContext['click'];
}

describe('AM-12 variants-sequence helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    importApiMockGallerySample.mockResolvedValue(true);
    patchApiMockActiveRoute.mockReturnValue(true);
    sendApiMockRequest.mockResolvedValue({ status: 200, body: AM12_OK_BODY });
  });

  it('pins slower holds plus Simulate review/run', () => {
    expect(AM12_TIMING.look).toBe(900);
    expect(AM12_TIMING.beforeOpen).toBe(1400);
    expect(AM12_TIMING.payoff).toBe(1600);
    expect(AM12_TIMING.simOutcome).toBe(1800);
    expect(AM12_TIMING.beforeRun).toBe(2400);
  });

  it('reads workspace, variants, modes, and dock from the DOM', () => {
    expect(hasAm12Workspace()).toBe(false);
    expect(isAm12StudioViewActive()).toBe(false);
    expect(isAm12RuntimeViewActive()).toBe(false);
    expect(isAm12ServerRunning()).toBe(false);
    expect(hasAm12Traffic()).toBe(false);
    expect(am12HasNotFoundVariant()).toBe(false);
    expect(am12HasSeqRow()).toBe(false);

    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
      jsonPath: true,
    });
    mountLiveStrip();
    mountJournal();

    expect(hasAm12Workspace()).toBe(true);
    expect(hasAm12RouteEditor()).toBe(true);
    expect(isAm12StudioViewActive()).toBe(true);
    expect(isAm12RuntimeViewActive()).toBe(true);
    expect(isAm12ServerRunning()).toBe(true);
    expect(am12VariantCount()).toBe(2);
    expect(am12HasNotFoundVariant()).toBe(true);
    expect(am12IsRulesMode()).toBe(true);
    expect(am12IsSequenceMode()).toBe(false);
    expect(am12HasJsonPathCondition()).toBe(true);
    expect(am12ConditionPath()).toBe(AM12_JSONPATH);
    expect(am12HasDefaultBadge()).toBe(true);
    expect(hasAm12Traffic()).toBe(true);
    expect(am12HasSeqRow()).toBe(true);
  });

  it('boots by importing the cart corpus', async () => {
    await prepareAm12Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM12_CORPUS_SAMPLE);
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    await cleanupAm12();
    expect(wipeApiMockWorkspace).toHaveBeenCalledTimes(2);
  });

  it('throws when the gallery sample cannot be imported', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(prepareAm12Workspace()).rejects.toThrow(AM12_CORPUS_SAMPLE);
  });

  it('ensureAm12StudioView clicks Studio when the explorer is gone', async () => {
    const ctx = makeCtx();
    document.body.append(el('button', 'am-btn', 'api-mock-view-studio'));
    await ensureAm12StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
  });

  it('ensureAm12StudioView skips when Studio is already showing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    await ensureAm12StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm12Workspace imports when the explorer is empty', async () => {
    const ctx = makeCtx();
    document.body.append(el('button', 'am-btn', 'api-mock-view-studio'));
    await ensureAm12Workspace(ctx);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM12_CORPUS_SAMPLE);
  });

  it('ensureAm12Workspace throws when a mid-lesson reimport fails', async () => {
    const ctx = makeCtx();
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(ensureAm12Workspace(ctx)).rejects.toThrow(AM12_CORPUS_SAMPLE);
  });

  it('ensureAm12Running starts a stopped listener and skips when already running', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(false, false);
    await ensureAm12Running(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);

    vi.clearAllMocks();
    document.body.innerHTML = '';
    mountExplorer();
    mountServerBar(true, true);
    await ensureAm12Running(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm12RuleOpen clicks the route row when the editor is missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    await ensureAm12RuleOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ROUTE_ROW);
  });

  it('ensureAm12ResponseTab clicks Response when the mode bar is missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
    const btab = document.createElement('button');
    btab.id = 'api-mock-btab-response';
    makeVisible(btab);
    editor.append(btab);
    document.body.append(editor);
    await ensureAm12ResponseTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.BTAB_RESPONSE);
  });

  it('ensureAm12NotFoundVariant patches a 404 sibling when it is missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    await ensureAm12NotFoundVariant(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith(expect.objectContaining({
      addVariant: true,
      variantName: AM12_VARIANT_NAME,
      status: 404,
      body: AM12_ERR_BODY,
    }));
  });

  it('ensureAm12NotFoundVariant skips when the 404 card already exists', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
    });
    await ensureAm12NotFoundVariant(ctx);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('ensureAm12Conditions patches JSONPath when the chip is empty', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
    });
    await ensureAm12Conditions(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith(expect.objectContaining({
      variantIndex: 1,
      variantConditions: AM12_NOT_FOUND_CONDITIONS,
    }));
  });

  it('ensureAm12Sequence switches mode when still on rules', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
      jsonPath: true,
    });
    await ensureAm12Sequence(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ responseMode: 'sequence' });
  });

  it('closeAm12Simulate clicks Close when the workspace is open', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountSimulate();
    expect(isAm12SimulateOpen()).toBe(true);
    expect(am12SimMethod()).toBe('POST');
    expect(am12SimOutcome()).toBe('MATCHED');
    await closeAm12Simulate(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_CLOSE);
  });

  it('closeAm12Simulate is a no-op when Simulate is closed', async () => {
    const ctx = makeCtx();
    await closeAm12Simulate(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm12JournalOpen returns when neither the live strip nor the dock tab is mounted', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ sequence: true });
    await ensureAm12JournalOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
  });

  it('ensureAm12StateLive Applies and sends a probe when the cursor is empty', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
      jsonPath: true,
      sequence: true,
    });
    await ensureAm12StateLive(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_RUNTIME);
  });

  it('runAm12ModeBar holds the list and the four mode buttons', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor();
    await runAm12ModeBar(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('runAm12AddVariant clicks + Variant, names it, and hits the 404 chip', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountEditor();
    await runAm12AddVariant(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ADD_VARIANT);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.VARIANT_NAME, AM12_VARIANT_NAME);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VARIANT_STATUS_QUICK_404);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith(expect.objectContaining({
      variantIndex: 1,
      status: 404,
      body: AM12_ERR_BODY,
    }));
  });

  it('runAm12AddVariant skips when the 404 sibling already exists', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
    });
    await runAm12AddVariant(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.ADD_VARIANT);
  });

  it('runAm12Conditions fills JSONPath on the Selection tab', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
    });
    await runAm12Conditions(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SELECTION_CONDITION_PATH, AM12_JSONPATH);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SELECTION_CONDITION_VALUE, AM12_SKU_MISSING);
  });

  it('runAm12Default clicks Make default on the 200 card', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
      jsonPath: true,
    });
    await runAm12Default(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SELECTION_DEFAULT);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ variantIndex: 0, isDefault: true });
  });

  it('runAm12ProveRules simulates the missing SKU then the happy path', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
      jsonPath: true,
    });
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    await runAm12ProveRules(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SIMULATE_BODY, AM12_MATCH_BODY);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SIMULATE_BODY, AM12_MISS_BODY);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_TAB_RENDERED);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_CLOSE);
  });

  it('runAm12Sequence clicks Sequence and holds the cursor', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
      jsonPath: true,
    });
    await runAm12Sequence(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESPONSE_MODE_SEQUENCE);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ responseMode: 'sequence' });
  });

  it('runAm12ThreeCalls Applies and fetches three times', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ sequence: true });
    mountLiveStrip();
    await runAm12ThreeCalls(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).toHaveBeenCalledTimes(3);
    expect(sendApiMockRequest).toHaveBeenCalledWith({
      path: AM12_PATH,
      method: 'POST',
      body: AM12_MISS_BODY,
    });
  });

  it('runAm12StateTab holds the live sequence row', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ sequence: true });
    mountJournal();
    await runAm12StateTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_STATE);
  });

  it('runAm12StateTab falls back to the empty live pane when no cursor exists', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ sequence: true });
    const dock = el('div', undefined, 'api-mock-dock');
    dock.append(el('button', undefined, 'api-mock-dock-tab-state'));
    const state = el('div', undefined, 'api-mock-dock-state');
    state.append(el('div', undefined, 'api-mock-dock-state-live'));
    dock.append(state);
    document.body.append(dock);
    await runAm12StateTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_STATE);
  });

  it('sendAm12ProveRequest posts the in-cart body', async () => {
    await sendAm12ProveRequest();
    expect(sendApiMockRequest).toHaveBeenCalledWith({
      path: AM12_PATH,
      method: 'POST',
      body: AM12_MISS_BODY,
    });
  });

  it('ensureAm12SelectionTab clicks Selection when the panel is missing', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountEditor();
    await ensureAm12SelectionTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESPONSE_TAB_SELECTION);
  });

  it('ensureAm12ForApply leaves sequence mode on a running listener', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
      jsonPath: true,
      sequence: true,
    });
    await ensureAm12ForApply(ctx);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalledWith({ responseMode: 'sequence' });
  });

  it('ensureAm12Workspace skips import when the explorer already has a rule', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    await ensureAm12Workspace(ctx);
    expect(importApiMockGallerySample).not.toHaveBeenCalled();
  });

  it('ensureAm12Conditions skips when the JSONPath chip is already filled', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
      jsonPath: true,
    });
    await ensureAm12Conditions(ctx);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('ensureAm12Sequence is a no-op when Sequence is already pressed', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
      jsonPath: true,
      sequence: true,
    });
    await ensureAm12Sequence(ctx);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalledWith({ responseMode: 'sequence' });
  });

  it('ensureAm12RuleOpen and ensureAm12ResponseTab skip when the editor is already open', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor();
    await ensureAm12RuleOpen(ctx);
    await ensureAm12ResponseTab(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm12SelectionTab skips when the panel is already mounted', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor({ selection: true });
    await ensureAm12SelectionTab(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.RESPONSE_TAB_SELECTION);
  });

  it('ensureAm12Running is a no-op when Start is missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    await ensureAm12Running(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm12StateLive skips the probe when the sequence cursor is already live', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
      jsonPath: true,
      sequence: true,
    });
    mountJournal();
    await ensureAm12StateLive(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).not.toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_STATE);
  });

  it('ensureAm12JournalOpen clicks the live strip when the table is empty', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ sequence: true });
    mountLiveStrip();
    await ensureAm12JournalOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
  });

  it('reads a JSONPath condition from the inputs when the chip is empty', () => {
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
    });
    const path = document.querySelector<HTMLInputElement>('[data-testid="api-mock-selection-condition-path"]');
    const value = document.querySelector<HTMLInputElement>('[data-testid="api-mock-selection-condition-value"]');
    if (path) path.value = AM12_JSONPATH;
    if (value) value.value = AM12_SKU_MISSING;
    expect(am12HasJsonPathCondition()).toBe(true);
  });

  it('runAm12StateTab sends a probe when the dock has no cursor yet', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ sequence: true });
    const dock = el('div', undefined, 'api-mock-dock');
    dock.append(el('button', undefined, 'api-mock-dock-tab-state'));
    dock.append(el('div', undefined, 'api-mock-dock-state'));
    document.body.append(dock);
    await runAm12StateTab(ctx);
    expect(sendApiMockRequest).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_STATE);
  });

  it('ensureAm12Default marks the first variant as the sole fallback', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
      jsonPath: true,
    });
    await ensureAm12Default(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ variantIndex: 0, isDefault: true });
  });

  it('ensureAm12JournalOpen clicks the dock tab when the live strip is missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ sequence: true });
    const dock = el('div', undefined, 'api-mock-dock');
    dock.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
    document.body.append(dock);
    await ensureAm12JournalOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_TRANSACTIONS);
  });

  it('ensureAm12ResponseTab and ensureAm12SelectionTab no-op when their triggers are missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    document.body.append(el('div', 'am-route-editor', 'api-mock-route-editor'));
    await ensureAm12ResponseTab(ctx);
    await ensureAm12SelectionTab(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm12StudioView no-ops when Studio is missing and the explorer is gone', async () => {
    const ctx = makeCtx();
    await ensureAm12StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('reads traffic and the sequence cursor from hidden dock nodes', () => {
    const tx = document.createElement('button');
    tx.setAttribute('data-testid', 'api-mock-live-transactions');
    const badge = document.createElement('span');
    badge.className = 'am-count-badge';
    badge.textContent = '2';
    tx.append(badge);
    document.body.append(tx);
    expect(hasAm12Traffic()).toBe(true);

    const seq = document.createElement('span');
    seq.setAttribute('data-testid', 'api-mock-dock-seq-row');
    document.body.append(seq);
    expect(am12HasSeqRow()).toBe(true);
  });

  it('runAm12ProveRules selects POST when Simulate is already open on GET', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    const prev = ctx.click;
    ctx.click = vi.fn(async (selector: string) => {
      await prev(selector);
      if (selector === API_MOCK.SIMULATE) {
        document.querySelector('[data-testid="api-mock-simulate-method"]')?.setAttribute('data-value', 'GET');
        document.querySelector('[data-testid="api-mock-sim-tab-rendered"]')?.remove();
        document.querySelector('[data-testid="api-mock-sim-rendered-status"]')?.remove();
      }
    }) as DemoActionContext['click'];
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      variants: [
        { id: 'resp-1', label: '200 In cart', isDefault: true },
        { id: 'resp-2', label: `404 ${AM12_VARIANT_NAME}` },
      ],
      selection: true,
      jsonPath: true,
    });
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    await runAm12ProveRules(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.SIMULATE_METHOD, 'POST');
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.SIMULATE_BODY, AM12_MATCH_BODY);
  });

  it('runAm12ThreeCalls holds the dirty badge and skips Apply when it is missing', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, false);
    document.querySelector('[data-testid="api-mock-server-bar"]')
      ?.append(el('span', undefined, 'api-mock-dirty-badge'));
    mountEditor({ sequence: true });
    mountLiveStrip();
    await runAm12ThreeCalls(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).toHaveBeenCalledTimes(3);
  });

  it('runAm12ThreeCalls skips the journal row click when the table is empty', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ sequence: true });
    mountLiveStrip();
    await runAm12ThreeCalls(ctx);
    expect(sendApiMockRequest).toHaveBeenCalledTimes(3);
  });

  it('runAm12StateTab opens Runtime then holds the live sequence row', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ sequence: true });
    mountLiveStrip();
    await runAm12StateTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_RUNTIME);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_STATE);
  });

  it('runAm12StateTab holds the live pane when the cursor chip is missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ sequence: true });
    mountLiveStrip();
    const dock = el('div', undefined, 'api-mock-dock');
    dock.append(el('button', undefined, 'api-mock-dock-tab-state'));
    const state = el('div', undefined, 'api-mock-dock-state');
    state.append(el('div', undefined, 'api-mock-dock-state-live'));
    dock.append(state);
    document.body.append(dock);
    await runAm12StateTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_STATE);
  });
});
