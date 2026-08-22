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
const clearApiMockServerSamples = vi.fn(() => true);
const upsertApiMockServerSamples = vi.fn(() => true);

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [string])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  patchApiMockActiveRoute: (...a: unknown[]) => patchApiMockActiveRoute(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
  clearApiMockServerSamples: (...a: unknown[]) => clearApiMockServerSamples(...(a as [])),
  upsertApiMockServerSamples: (...a: unknown[]) => upsertApiMockServerSamples(...(a as [])),
}));

import {
  AM13_CHECKED_OUT,
  AM13_CORPUS_SAMPLE,
  AM13_COUNTER_KEY,
  AM13_EMPTY,
  AM13_EMPTY_BODY,
  AM13_EMPTY_TRANSITION,
  AM13_HAS_ITEMS,
  AM13_HAS_ITEMS_BODY,
  AM13_HAS_ITEMS_TRANSITION,
  AM13_PATH,
  AM13_TIMING,
  AM13_TENANT_BODY,
  AM13_VAR_KEY,
  AM13_VAR_SNIPPET,
  AM13_VAR_VALUE,
  AM13_VARIANT_2_NAME,
  AM13_WEIGHT_A,
  AM13_WEIGHT_B,
  am13HasCounter,
  am13HasEmptyTransition,
  am13HasLiveState,
  am13HasTenantVariable,
  am13HasTwoVariants,
  am13NextState,
  am13RequiredState,
  am13SimMethod,
  am13SimOutcome,
  am13VariantCount,
  cleanupAm13,
  closeAm13Simulate,
  ensureAm13FirstCall,
  ensureAm13ForApply,
  ensureAm13ForWeighted,
  ensureAm13HasItemsHop,
  ensureAm13JournalOpen,
  ensureAm13ResponseTab,
  ensureAm13RuleOpen,
  ensureAm13Running,
  ensureAm13SecondVariant,
  ensureAm13SelectionTab,
  ensureAm13StateLive,
  ensureAm13StateMode,
  ensureAm13StudioView,
  ensureAm13Transition,
  ensureAm13TwoVariants,
  ensureAm13Weighted,
  ensureAm13Workspace,
  hasAm13RouteEditor,
  hasAm13Traffic,
  hasAm13Workspace,
  isAm13ServerRunning,
  isAm13SimulateOpen,
  isAm13StateMode,
  isAm13StudioViewActive,
  isAm13WeightedMode,
  prepareAm13Workspace,
  runAm13FirstCall,
  runAm13HasItemsHop,
  runAm13ResetAndBatch,
  runAm13StateLive,
  runAm13SecondVariant,
  runAm13Transition,
  runAm13Variables,
  runAm13WeightedAndSeed,
  runAm13WhyState,
  sendAm13ProveRequest,
} from './api-mock-am13-helpers';

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

function mountVariantCard(id: string, label: string): HTMLElement {
  const card = el('button', 'am-variant-card', `api-mock-variant-tab-${id}`);
  card.textContent = label;
  return card;
}

function mountStateFields(panel: HTMLElement, opts: {
  required?: string;
  next?: string;
  counter?: boolean;
  weight?: string;
}): void {
  const required = document.createElement('input');
  required.setAttribute('data-testid', 'api-mock-variant-required-state');
  if (opts.required) required.value = opts.required;
  makeVisible(required);
  const next = document.createElement('input');
  next.setAttribute('data-testid', 'api-mock-variant-next-state');
  if (opts.next) next.value = opts.next;
  makeVisible(next);
  panel.append(required, next, el('button', 'am-btn', 'api-mock-counter-add'));
  if (opts.counter) {
    const row = el('div', 'am-chunk-row', 'api-mock-counter-row-0');
    const key = document.createElement('input');
    key.setAttribute('data-testid', 'api-mock-counter-key-0');
    key.value = AM13_COUNTER_KEY;
    makeVisible(key);
    row.append(key);
    panel.append(row);
  }
  if (opts.weight != null) {
    const weight = document.createElement('input');
    weight.setAttribute('data-testid', 'api-mock-variant-weight');
    weight.value = opts.weight;
    makeVisible(weight);
    panel.append(weight);
  }
}

function mountEditor(opts: {
  variants?: Array<{ id: string; label: string }>;
  state?: boolean;
  weighted?: boolean;
  selection?: boolean;
  required?: string;
  next?: string;
  counter?: boolean;
  weight?: string;
} = {}): void {
  const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
  const response = el('div', undefined, 'api-mock-response-editor');
  const modeBar = el('div', undefined, 'api-mock-response-mode-bar');
  const rules = el('button', undefined, 'api-mock-response-mode-rules');
  rules.setAttribute('aria-pressed', opts.state || opts.weighted ? 'false' : 'true');
  const state = el('button', opts.state ? 'active' : '', 'api-mock-response-mode-state');
  state.setAttribute('aria-pressed', opts.state ? 'true' : 'false');
  const weighted = el('button', opts.weighted ? 'active' : '', 'api-mock-response-mode-weighted');
  weighted.setAttribute('aria-pressed', opts.weighted ? 'true' : 'false');
  modeBar.append(rules, weighted, state, el('button', undefined, 'api-mock-response-mode-sequence'));
  const sidebar = el('aside', undefined, 'api-mock-variant-sidebar');
  const list = el('div', undefined, 'api-mock-variant-list');
  const variants = opts.variants ?? [
    { id: 'resp-1', label: '200 In cart' },
    { id: 'resp-2', label: `200 ${AM13_VARIANT_2_NAME}` },
  ];
  for (const v of variants) list.append(mountVariantCard(v.id, v.label));
  sidebar.append(list);
  sidebar.append(el('button', 'am-btn', 'api-mock-add-variant'));
  response.append(modeBar, sidebar);
  response.append(el('button', undefined, 'api-mock-response-tab-selection'));
  response.append(el('button', undefined, 'api-mock-response-tab-content'));
  response.append(el('div', undefined, 'api-mock-variant-body'));
  response.append(el('div', undefined, 'api-mock-preview-body'));
  if (opts.selection || opts.state || opts.weighted) {
    const panel = el('div', undefined, 'api-mock-selection-panel');
    mountStateFields(panel, opts);
    response.append(panel);
  }
  editor.append(response);
  const btab = document.createElement('button');
  btab.id = 'api-mock-btab-response';
  makeVisible(btab);
  editor.append(btab);
  document.body.append(editor);
}

function mountSimSampleRow(id: string, name: string, stateLine: string): HTMLElement {
  const row = el('div', 'am-sim-sample', `api-mock-sim-sample-${id}`);
  const btn = el('button', 'am-sim-sample-btn');
  const rowLine = el('div', 'am-row');
  const nameEl = el('span', 'am-sim-sample-name');
  nameEl.textContent = name;
  const badge = el('span', 'am-badge success');
  badge.textContent = 'PASS';
  rowLine.append(nameEl, badge);
  const chip = el('span', 'am-chip', 'api-mock-sim-sample-state');
  chip.textContent = stateLine;
  btn.append(rowLine, chip);
  row.append(btn);
  return row;
}

function mountSimulate(outcome = 'MATCHED'): void {
  const workspace = el('div', undefined, 'api-mock-simulate-workspace');
  const method = el('div', undefined, 'api-mock-simulate-method');
  method.setAttribute('data-value', 'POST');
  workspace.append(method);
  workspace.append(el('input', undefined, 'api-mock-simulate-path'));
  workspace.append(el('input', undefined, 'api-mock-simulate-seed'));
  workspace.append(el('button', undefined, 'api-mock-simulate-run'));
  workspace.append(el('button', undefined, 'api-mock-simulate-run-all'));
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
  status.textContent = '200';
  rendered.append(status);
  const body = el('pre', 'am-code', 'api-mock-sim-rendered-body');
  body.textContent = AM13_EMPTY_BODY;
  rendered.append(body);
  workspace.append(rendered);
  const samples = el('aside', undefined, 'api-mock-sim-samples');
  samples.append(mountSimSampleRow('adhoc', 'Ad-hoc request', '(empty) → HAS_ITEMS'));
  samples.append(mountSimSampleRow('add-to-cart', 'Add to cart', 'HAS_ITEMS → CHECKED_OUT'));
  workspace.append(samples);
  document.body.append(workspace);
}

function mountLiveStrip(): void {
  const strip = el('div', undefined, 'api-mock-live-strip');
  const tx = el('button', undefined, 'api-mock-live-transactions');
  tx.append(Object.assign(el('span', 'am-count-badge'), { textContent: '1' }));
  strip.append(tx);
  strip.append(el('button', undefined, 'api-mock-live-variables'));
  document.body.append(strip);
}

function mountJournal(liveText = 'default = HAS_ITEMS items: 1'): void {
  const dock = el('div', undefined, 'api-mock-dock');
  dock.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
  dock.append(el('button', 'am-btn small danger', 'api-mock-journal-clear'));
  const stateTab = el('button', undefined, 'api-mock-dock-tab-state');
  stateTab.setAttribute('aria-selected', 'false');
  dock.append(stateTab);
  dock.append(el('button', undefined, 'api-mock-dock-tab-variables'));
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  tbody.append(el('tr', undefined, 'api-mock-tx-1'));
  table.append(tbody);
  dock.append(table);
  const state = el('div', undefined, 'api-mock-dock-state');
  const live = el('div', undefined, 'api-mock-dock-state-live');
  live.textContent = liveText;
  state.append(live);
  state.append(el('button', undefined, 'api-mock-state-reset'));
  dock.append(state);
  const vars = el('div', undefined, 'api-mock-dock-variables');
  vars.append(el('button', undefined, 'api-mock-var-add'));
  const vtable = document.createElement('table');
  const vbody = document.createElement('tbody');
  vtable.append(vbody);
  vars.append(vtable);
  dock.append(vars);
  document.body.append(dock);
  const detail = el('div', undefined, 'api-mock-tx-detail');
  detail.append(el('section', undefined, 'api-mock-tx-response'));
  document.body.append(detail);
}

function appendVarRow(): void {
  const tbody = document.querySelector(`${API_MOCK.DOCK_VARIABLES} tbody`);
  if (!tbody) return;
  const tr = el('tr', undefined, 'api-mock-var-row-v1');
  const key = document.createElement('input');
  key.setAttribute('data-testid', 'api-mock-var-key-v1');
  key.value = AM13_VAR_KEY;
  makeVisible(key);
  const value = document.createElement('input');
  value.setAttribute('data-testid', 'api-mock-var-value-v1');
  value.value = AM13_VAR_VALUE;
  makeVisible(value);
  const sensitive = el('button', undefined, 'api-mock-var-sensitive-v1');
  tr.append(key, value, sensitive);
  tbody.append(tr);
}

function withClickSideEffects(ctx: DemoActionContext): void {
  ctx.click = vi.fn(async (selector: string) => {
    if (selector === API_MOCK.SIMULATE && !document.querySelector(API_MOCK.SIMULATE_WORKSPACE)) {
      mountSimulate();
    }
    if (selector === API_MOCK.SIMULATE_CLOSE) {
      document.querySelector(API_MOCK.SIMULATE_WORKSPACE)?.remove();
    }
    if (selector === API_MOCK.RESPONSE_MODE_STATE) {
      document.querySelector(API_MOCK.RESPONSE_MODE_STATE)?.setAttribute('aria-pressed', 'true');
      if (!document.querySelector(API_MOCK.SELECTION_PANEL)) {
        const panel = el('div', undefined, 'api-mock-selection-panel');
        mountStateFields(panel, {});
        document.querySelector(API_MOCK.RESPONSE_EDITOR)?.append(panel);
      }
    }
    if (selector === API_MOCK.RESPONSE_MODE_WEIGHTED) {
      document.querySelector(API_MOCK.RESPONSE_MODE_WEIGHTED)?.setAttribute('aria-pressed', 'true');
      if (!document.querySelector(API_MOCK.VARIANT_WEIGHT)) {
        const panel = document.querySelector(API_MOCK.SELECTION_PANEL)
          ?? el('div', undefined, 'api-mock-selection-panel');
        if (!panel.isConnected) document.querySelector(API_MOCK.RESPONSE_EDITOR)?.append(panel);
        mountStateFields(panel as HTMLElement, { weight: '1' });
      }
    }
    if (selector === API_MOCK.RESPONSE_TAB_SELECTION && !document.querySelector(API_MOCK.SELECTION_PANEL)) {
      const panel = el('div', undefined, 'api-mock-selection-panel');
      mountStateFields(panel, {});
      document.querySelector(API_MOCK.RESPONSE_EDITOR)?.append(panel);
    }
    if (selector === API_MOCK.COUNTER_ADD && !document.querySelector(API_MOCK.COUNTER_ROW)) {
      const row = el('div', 'am-chunk-row', 'api-mock-counter-row-0');
      const key = document.createElement('input');
      key.setAttribute('data-testid', 'api-mock-counter-key-0');
      makeVisible(key);
      row.append(key);
      document.querySelector(API_MOCK.SELECTION_PANEL)?.append(row);
    }
    if (selector === API_MOCK.VAR_ADD) appendVarRow();
    if (selector === API_MOCK.VAR_SENSITIVE_LAST) {
      const input = document.querySelector<HTMLInputElement>(API_MOCK.VAR_VALUE_LAST);
      if (input) input.type = 'password';
    }
    if (selector === API_MOCK.STATE_RESET) {
      const live = document.querySelector(API_MOCK.DOCK_STATE_LIVE);
      if (live) live.textContent = 'No state changes yet.';
    }
    if (selector === API_MOCK.SIMULATE_RUN_ALL && !document.querySelector(API_MOCK.SIMULATE_SAMPLE_STATE)) {
      const chip = el('span', 'am-chip', 'api-mock-sim-sample-state');
      chip.textContent = '(empty) → HAS_ITEMS';
      document.querySelector(API_MOCK.SIMULATE_WORKSPACE)?.append(chip);
    }
    if (selector === API_MOCK.LIVE_TRANSACTIONS && !document.querySelector(API_MOCK.DOCK)) {
      mountJournal();
    }
    if ((selector === API_MOCK.VIEW_RUNTIME || selector === API_MOCK.OPEN_RUNTIME)
      && !document.querySelector(API_MOCK.DOCK)) {
      document.body.append(el('div', undefined, 'api-mock-runtime-page'));
      mountJournal();
    }
    if (selector === API_MOCK.LIVE_VARIABLES && !document.querySelector(API_MOCK.DOCK_VARIABLES)) {
      mountJournal();
    }
    if (selector === API_MOCK.VIEW_STUDIO && !document.querySelector(API_MOCK.ROUTE_EXPLORER)) {
      mountExplorer();
      mountServerBar(true, true);
    }
  }) as DemoActionContext['click'];
}

describe('AM-13 stateful helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    importApiMockGallerySample.mockResolvedValue(true);
    patchApiMockActiveRoute.mockReturnValue(true);
    // Advance the dock State label the way a live stateful listener would, so
    // seed waits in hop helpers do not spin when the draft was Applied.
    sendApiMockRequest.mockImplementation(async () => {
      const live = document.querySelector<HTMLElement>('[data-testid="api-mock-dock-state-live"]');
      const text = live?.textContent ?? '';
      if (live && (/No state changes/i.test(text) || text.trim() === '')) {
        live.textContent = 'default = HAS_ITEMS\nitems: 1';
        return { status: 200, body: AM13_EMPTY_BODY };
      }
      if (live && /HAS_ITEMS/i.test(text) && !/CHECKED_OUT/i.test(text)) {
        live.textContent = 'default = CHECKED_OUT\nitems: 1';
        return { status: 200, body: AM13_HAS_ITEMS_BODY };
      }
      return { status: 200, body: AM13_EMPTY_BODY };
    });
  });

  it('exposes corpus constants and slower timing', () => {
    expect(AM13_CORPUS_SAMPLE).toBe('am-gallery-checkout');
    expect(AM13_PATH).toBe('/cart');
    expect(AM13_HAS_ITEMS_BODY).toContain('RF-100');
    expect(AM13_EMPTY_TRANSITION.currentState).toBe(AM13_EMPTY);
    expect(AM13_HAS_ITEMS_TRANSITION.targetState).toBe('CHECKED_OUT');
    expect(AM13_TENANT_BODY).toContain(AM13_VAR_SNIPPET);
    expect(AM13_TIMING.beforeOpen).toBe(1400);
    expect(AM13_TIMING.payoff).toBe(1600);
  });

  it('probes workspace, running, variants, and modes', () => {
    expect(hasAm13Workspace()).toBe(false);
    expect(isAm13StudioViewActive()).toBe(false);
    expect(isAm13ServerRunning()).toBe(false);
    expect(am13HasTwoVariants()).toBe(false);
    expect(am13HasCounter()).toBe(false);
    expect(am13HasLiveState()).toBe(false);
    expect(hasAm13Traffic()).toBe(false);
    expect(am13HasTenantVariable()).toBe(false);

    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true, required: AM13_EMPTY, next: AM13_HAS_ITEMS, counter: true });
    mountLiveStrip();
    mountJournal();
    appendVarRow();

    expect(hasAm13Workspace()).toBe(true);
    expect(hasAm13RouteEditor()).toBe(true);
    expect(isAm13StudioViewActive()).toBe(true);
    expect(isAm13ServerRunning()).toBe(true);
    expect(am13VariantCount()).toBe(2);
    expect(am13HasTwoVariants()).toBe(true);
    expect(isAm13StateMode()).toBe(true);
    expect(isAm13WeightedMode()).toBe(false);
    expect(am13RequiredState()).toBe(AM13_EMPTY);
    expect(am13NextState()).toBe(AM13_HAS_ITEMS);
    expect(am13HasEmptyTransition()).toBe(true);
    expect(am13HasLiveState()).toBe(true);
    expect(hasAm13Traffic()).toBe(true);
    expect(am13HasTenantVariable()).toBe(true);
  });

  it('prepareAm13Workspace imports checkout then adds the second body', async () => {
    await prepareAm13Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM13_CORPUS_SAMPLE);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith(expect.objectContaining({
      addVariant: true,
      variantName: AM13_VARIANT_2_NAME,
      body: AM13_HAS_ITEMS_BODY,
    }));
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
  });

  it('prepareAm13Workspace throws when the gallery import fails', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(prepareAm13Workspace()).rejects.toThrow(/am-gallery-checkout/);
  });

  it('cleanupAm13 wipes the workspace', async () => {
    await cleanupAm13();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
  });

  it('ensureAm13Workspace re-imports when the explorer is missing', async () => {
    const ctx = makeCtx();
    document.body.append(el('button', undefined, 'api-mock-view-studio'));
    await ensureAm13Workspace(ctx);
    expect(importApiMockGallerySample).toHaveBeenCalled();
  });

  it('ensureAm13TwoVariants patches when only one card exists', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ variants: [{ id: 'resp-1', label: '200 In cart' }] });
    await ensureAm13TwoVariants(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith(expect.objectContaining({
      addVariant: true,
      variantName: AM13_VARIANT_2_NAME,
    }));
  });

  it('ensureAm13TwoVariants skips when both cards exist', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    await ensureAm13TwoVariants(ctx);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('ensureAm13StateMode patches when still on rules', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    await ensureAm13StateMode(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ responseMode: 'state' });
  });

  it('ensureAm13StateMode skips when already in state', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true });
    await ensureAm13StateMode(ctx);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('ensureAm13Transition patches EMPTY → HAS_ITEMS with a counter', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true, selection: true });
    await ensureAm13Transition(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith(expect.objectContaining({
      variantIndex: 0,
      transition: AM13_EMPTY_TRANSITION,
    }));
  });

  it('ensureAm13Transition skips when the counter row is already filled', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_EMPTY,
      next: AM13_HAS_ITEMS,
      counter: true,
    });
    await ensureAm13Transition(ctx);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('ensureAm13SecondVariant patches the HAS_ITEMS hop', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_EMPTY,
      next: AM13_HAS_ITEMS,
      counter: true,
    });
    await ensureAm13SecondVariant(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith(expect.objectContaining({
      variantIndex: 1,
      transition: AM13_HAS_ITEMS_TRANSITION,
      body: AM13_HAS_ITEMS_BODY,
    }));
  });

  it('ensureAm13SecondVariant skips when the second hop is already authored', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_HAS_ITEMS,
      next: AM13_CHECKED_OUT,
    });
    // First-card probe still needs EMPTY→HAS_ITEMS + counter on card 1.
    patchApiMockActiveRoute.mockClear();
    await ensureAm13SecondVariant(ctx);
    // May patch variant 0 if the visible fields are the second hop; must not
    // keep re-patching variant 1 once HAS_ITEMS→CHECKED_OUT is showing.
    const secondPatches = patchApiMockActiveRoute.mock.calls.filter(
      (c) => (c[0] as { variantIndex?: number }).variantIndex === 1,
    );
    expect(secondPatches).toHaveLength(0);
  });

  it('ensureAm13ForApply and first-call send a probe when the journal is empty', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_EMPTY,
      next: AM13_HAS_ITEMS,
      counter: true,
    });
    await ensureAm13ForApply(ctx);
    await ensureAm13FirstCall(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).toHaveBeenCalled();
    await ensureAm13StateLive(ctx);
    await ensureAm13ForWeighted(ctx);
    await runAm13StateLive(ctx);
    expect(sendApiMockRequest).toHaveBeenCalled();
  });

  it('ensureAm13Weighted switches mode and sets 90/10', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_EMPTY,
      next: AM13_HAS_ITEMS,
      counter: true,
    });
    mountLiveStrip();
    await ensureAm13Weighted(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ responseMode: 'weighted' });
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ variantIndex: 0, weight: 90 });
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ variantIndex: 1, weight: 10 });
  });

  it('ensureAm13Weighted skips when already weighted', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ weighted: true, weight: '90' });
    mountLiveStrip();
    await ensureAm13Weighted(ctx);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalledWith({ responseMode: 'weighted' });
  });

  it('closeAm13Simulate clicks Close when the workspace is open', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountSimulate();
    expect(isAm13SimulateOpen()).toBe(true);
    expect(am13SimMethod()).toBe('POST');
    expect(am13SimOutcome()).toBe('MATCHED');
    await closeAm13Simulate(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_CLOSE);
  });

  it('closeAm13Simulate is a no-op when Simulate is closed', async () => {
    const ctx = makeCtx();
    await closeAm13Simulate(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm13JournalOpen returns when neither the live strip nor the dock tab is mounted', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true });
    await ensureAm13JournalOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
  });

  it('ensureAm13StudioView clicks Studio when the explorer is missing', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    document.body.append(el('button', undefined, 'api-mock-view-studio'));
    await ensureAm13StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
  });

  it('ensureAm13RuleOpen clicks the route row when the editor is missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    await ensureAm13RuleOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ROUTE_ROW);
  });

  it('ensureAm13ResponseTab and Selection tab click their triggers', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
    editor.append(el('button', undefined, 'api-mock-btab-response'));
    document.querySelector('#api-mock-btab-response')?.remove();
    const btab = el('button', undefined, 'api-mock-btab-response');
    btab.id = 'api-mock-btab-response';
    editor.append(btab);
    document.body.append(editor);
    await ensureAm13ResponseTab(ctx);
    mountEditor();
    await ensureAm13SelectionTab(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('ensureAm13Running starts a stopped server', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(false);
    await ensureAm13Running(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);
  });

  it('sendAm13ProveRequest posts /cart', async () => {
    await sendAm13ProveRequest();
    expect(sendApiMockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: AM13_PATH,
      method: 'POST',
    }));
  });

  it('runAm13WhyState holds both cards then clicks State', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountEditor();
    await runAm13WhyState(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESPONSE_MODE_STATE);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ responseMode: 'state' });
  });

  it('runAm13Transition fills EMPTY → HAS_ITEMS and adds a counter', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true, selection: true });
    await runAm13Transition(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.VARIANT_REQUIRED_STATE, AM13_EMPTY);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.VARIANT_NEXT_STATE, AM13_HAS_ITEMS);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.COUNTER_ADD);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.COUNTER_KEY, AM13_COUNTER_KEY);
    // Required then Next — natural EMPTY → HAS_ITEMS order (no editor mirror).
    const fillTargets = vi.mocked(ctx.fill).mock.calls.map(c => c[0]);
    expect(fillTargets.indexOf(API_MOCK.VARIANT_REQUIRED_STATE))
      .toBeLessThan(fillTargets.indexOf(API_MOCK.VARIANT_NEXT_STATE));
  });

  it('runAm13SecondVariant selects the last card and holds its body', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_EMPTY,
      next: AM13_HAS_ITEMS,
      counter: true,
    });
    await runAm13SecondVariant(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.VARIANT_REQUIRED_STATE, AM13_HAS_ITEMS);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.VARIANT_NEXT_STATE, AM13_CHECKED_OUT);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VARIANT_CARD_LAST);
    // Required then Next — natural HAS_ITEMS → CHECKED_OUT order.
    const fillTargets = vi.mocked(ctx.fill).mock.calls.map(c => c[0]);
    expect(fillTargets.indexOf(API_MOCK.VARIANT_REQUIRED_STATE))
      .toBeLessThan(fillTargets.indexOf(API_MOCK.VARIANT_NEXT_STATE));
  });

  it('runAm13FirstCall Applies and opens the journal', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true });
    mountLiveStrip();
    await runAm13FirstCall(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_STATE);
  });

  it('runAm13HasItemsHop resets, clears, seeds two POSTs, then walks both journal rows', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true });
    mountLiveStrip();
    mountJournal();
    // Newest-first list: tx-2 (arrived second) above tx-1 (arrived first).
    const tbody = document.querySelector('tbody');
    tbody?.replaceChildren(
      el('tr', undefined, 'api-mock-tx-2'),
      el('tr', undefined, 'api-mock-tx-1'),
    );
    await runAm13HasItemsHop(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.STATE_RESET);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.JOURNAL_CLEAR);
    expect(sendApiMockRequest).toHaveBeenCalledTimes(2);
    const clicks = vi.mocked(ctx.click).mock.calls.map(c => c[0]);
    const firstArrived = clicks.indexOf('[data-testid="api-mock-tx-1"]');
    const secondArrived = clicks.indexOf('[data-testid="api-mock-tx-2"]');
    expect(firstArrived).toBeGreaterThan(-1);
    expect(secondArrived).toBeGreaterThan(-1);
    expect(firstArrived).toBeLessThan(secondArrived);
    expect(clicks.lastIndexOf(API_MOCK.DOCK_TAB_STATE)).toBeGreaterThan(secondArrived);
  });

  it('runAm13ResetAndBatch resets then runs all samples', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true });
    mountJournal();
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    await runAm13ResetAndBatch(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.STATE_RESET);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_RUN_ALL);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_CLOSE);
    // Walks both sample verdicts: waits for per-sample state, then opens Rendered response.
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.SIMULATE_SAMPLE_STATE, expect.any(Number));
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_TAB_RENDERED);
  });

  it('runAm13WeightedAndSeed fills 90/10 and runs Simulate twice', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true, selection: true });
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    await runAm13WeightedAndSeed(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESPONSE_MODE_WEIGHTED);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.VARIANT_WEIGHT, AM13_WEIGHT_A);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.VARIANT_WEIGHT, AM13_WEIGHT_B);
    expect(ctx.fill).not.toHaveBeenCalledWith(API_MOCK.SIMULATE_SEED, expect.anything());
    const clicks = vi.mocked(ctx.click).mock.calls.map(c => c[0]);
    const applyAt = clicks.indexOf(API_MOCK.APPLY);
    const simulateAt = clicks.indexOf(API_MOCK.SIMULATE);
    expect(applyAt).toBeGreaterThan(-1);
    expect(simulateAt).toBeGreaterThan(applyAt);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_RUN);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_SAVE_SAMPLE);
    const renderedClicks = vi.mocked(ctx.click).mock.calls.filter(
      (c) => c[0] === API_MOCK.SIMULATE_TAB_RENDERED,
    );
    expect(renderedClicks).toHaveLength(2);
    const delayMs = vi.mocked(ctx.delay).mock.calls.reduce((sum, [ms]) => sum + Number(ms ?? 0), 0);
    expect(delayMs).toBeGreaterThan(8_000);
    expect(delayMs).toBeLessThan(34_000);
  });

  it('runAm13Variables adds a tenant row and toggles sensitive', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountEditor({ weighted: true });
    mountLiveStrip();
    mountJournal();
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    await runAm13Variables(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VAR_ADD);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.VAR_KEY_LAST, AM13_VAR_KEY);
    expect(ctx.fill).toHaveBeenCalledWith(API_MOCK.VAR_VALUE_LAST, AM13_VAR_VALUE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VAR_SENSITIVE_LAST);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESPONSE_TAB_CONTENT);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith(expect.objectContaining({
      body: AM13_TENANT_BODY,
    }));
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_RUN);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_TAB_RENDERED);
  });

  it('runAm13Variables skips add when the tenant row already exists', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountEditor({ weighted: true });
    mountLiveStrip();
    mountJournal();
    appendVarRow();
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    await runAm13Variables(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.VAR_ADD);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith(expect.objectContaining({
      body: AM13_TENANT_BODY,
    }));
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.SIMULATE_RUN);
  });

  it('probe fallbacks when the matching nodes are missing', () => {
    expect(am13RequiredState()).toBe('');
    expect(am13NextState()).toBe('');
    expect(am13SimMethod()).toBe('');
    expect(am13SimOutcome()).toBe('');
    expect(isAm13WeightedMode()).toBe(false);
    expect(isAm13StateMode()).toBe(false);

    const hiddenLive = document.createElement('div');
    hiddenLive.setAttribute('data-testid', 'api-mock-dock-state-live');
    hiddenLive.textContent = 'default = HAS_ITEMS';
    document.body.append(hiddenLive);
    expect(am13HasLiveState()).toBe(true);

    const hiddenCounter = document.createElement('div');
    hiddenCounter.setAttribute('data-testid', 'api-mock-counter-row-0');
    document.body.append(hiddenCounter);
    expect(am13HasCounter()).toBe(true);
  });

  it('hasAm13Traffic reads the live-strip count without a journal', () => {
    mountLiveStrip();
    expect(hasAm13Traffic()).toBe(true);
  });

  it('ensureAm13StudioView is a no-op without a Studio button', async () => {
    const ctx = makeCtx();
    await ensureAm13StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm13Workspace throws when a missing studio cannot be re-imported', async () => {
    const ctx = makeCtx();
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(ensureAm13Workspace(ctx)).rejects.toThrow(/am-gallery-checkout/);
  });

  it('ensureAm13SelectionTab clicks the trigger when the panel is missing', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    await ensureAm13SelectionTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.RESPONSE_TAB_SELECTION);
  });

  it('ensureAm13SelectionTab returns when the Selection trigger is missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
    const response = el('div', undefined, 'api-mock-response-editor');
    response.append(el('div', undefined, 'api-mock-response-mode-bar'));
    editor.append(response);
    document.body.append(editor);
    await ensureAm13SelectionTab(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.RESPONSE_TAB_SELECTION);
  });

  it('ensureAm13JournalOpen clicks the live strip to reveal rows', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_EMPTY,
      next: AM13_HAS_ITEMS,
      counter: true,
    });
    mountLiveStrip();
    await ensureAm13JournalOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
  });

  it('ensureAm13JournalOpen clicks the dock tab when the strip is missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_EMPTY,
      next: AM13_HAS_ITEMS,
      counter: true,
    });
    const dock = el('div', undefined, 'api-mock-dock');
    dock.append(el('button', undefined, 'api-mock-dock-tab-transactions'));
    document.body.append(dock);
    await ensureAm13JournalOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_TRANSACTIONS);
  });

  it('runAm13FirstCall holds the dirty badge when the draft is unsaved', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    document.querySelector(API_MOCK.SERVER_BAR)?.append(el('span', undefined, 'api-mock-dirty-badge'));
    mountEditor({ state: true });
    mountLiveStrip();
    await runAm13FirstCall(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
  });

  it('runAm13HasItemsHop always clears then seeds two POSTs', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true });
    const detail = el('div', undefined, 'api-mock-tx-detail');
    document.body.append(detail);
    mountJournal();
    document.querySelector('tbody')?.append(el('tr', undefined, 'api-mock-tx-2'));
    await runAm13HasItemsHop(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.STATE_RESET);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.JOURNAL_CLEAR);
    expect(sendApiMockRequest).toHaveBeenCalledTimes(2);
  });

  it('runAm13ResetAndBatch selects POST when Simulate is still on GET', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true });
    mountJournal();
    mountSimulate('MATCHED');
    const method = document.querySelector(API_MOCK.SIMULATE_METHOD);
    method?.setAttribute('data-value', 'GET');
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    await runAm13ResetAndBatch(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.SIMULATE_METHOD, 'POST');
  });

  it('runAm13WeightedAndSeed selects POST when Simulate is still on GET', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true, selection: true });
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    const ctxFill = ctx.fill;
    ctx.click = vi.fn(async (selector: string) => {
      if (selector === API_MOCK.SIMULATE && !document.querySelector(API_MOCK.SIMULATE_WORKSPACE)) {
        mountSimulate();
        document.querySelector(API_MOCK.SIMULATE_METHOD)?.setAttribute('data-value', 'GET');
      }
      if (selector === API_MOCK.SIMULATE_CLOSE) {
        document.querySelector(API_MOCK.SIMULATE_WORKSPACE)?.remove();
      }
      if (selector === API_MOCK.RESPONSE_MODE_WEIGHTED) {
        document.querySelector(API_MOCK.RESPONSE_MODE_WEIGHTED)?.setAttribute('aria-pressed', 'true');
        if (!document.querySelector(API_MOCK.VARIANT_WEIGHT)) {
          const panel = document.querySelector(API_MOCK.SELECTION_PANEL) as HTMLElement;
          mountStateFields(panel, { weight: '1' });
        }
      }
    }) as DemoActionContext['click'];
    ctx.fill = ctxFill;
    await runAm13WeightedAndSeed(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(API_MOCK.SIMULATE_METHOD, 'POST');
  });

  it('ensureAm13HasItemsHop rewinds and sends when only one transaction exists', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_EMPTY,
      next: AM13_HAS_ITEMS,
      counter: true,
    });
    mountLiveStrip();
    mountJournal();
    await ensureAm13HasItemsHop(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.STATE_RESET);
    expect(sendApiMockRequest).toHaveBeenCalled();
  });

  it('ensureAm13StateLive opens the State tab when it is not selected', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_EMPTY,
      next: AM13_HAS_ITEMS,
      counter: true,
    });
    mountLiveStrip();
    mountJournal();
    await ensureAm13StateLive(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_STATE);
  });

  it('ensureAm13StateLive opens Runtime when the State tab is missing', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_EMPTY,
      next: AM13_HAS_ITEMS,
      counter: true,
    });
    mountLiveStrip();
    await ensureAm13StateLive(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_RUNTIME);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.DOCK_TAB_STATE);
  });

  it('ensureAm13JournalOpen returns when a journal row is already visible', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_EMPTY,
      next: AM13_HAS_ITEMS,
      counter: true,
    });
    mountJournal();
    await ensureAm13JournalOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.DOCK_TAB_TRANSACTIONS);
  });

  it('runAm13SecondVariant holds VARIANT_BODY when preview is missing', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({
      state: true,
      required: AM13_EMPTY,
      next: AM13_HAS_ITEMS,
      counter: true,
    });
    document.querySelector(API_MOCK.PREVIEW_BODY)?.remove();
    await runAm13SecondVariant(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VARIANT_CARD_LAST);
  });

  it('runAm13WeightedAndSeed falls back to the outcome badge without a rendered status', async () => {
    const ctx = makeCtx();
    withClickSideEffects(ctx);
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ state: true, selection: true });
    document.body.append(el('button', undefined, 'api-mock-simulate'));
    const originalClick = ctx.click;
    ctx.click = vi.fn(async (selector: string) => {
      await originalClick(selector);
      if (selector === API_MOCK.SIMULATE) {
        document.querySelector(API_MOCK.SIMULATE_RENDERED_STATUS)?.remove();
      }
    }) as DemoActionContext['click'];
    await runAm13WeightedAndSeed(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(API_MOCK.SIMULATE_SEED, expect.anything());
  });

  it('am13HasTenantVariable matches a row whose text is the key', () => {
    const dock = el('div', undefined, 'api-mock-dock-variables');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const tr = el('tr', undefined, 'api-mock-var-row-plain');
    tr.textContent = AM13_VAR_KEY;
    tbody.append(tr);
    table.append(tbody);
    dock.append(table);
    document.body.append(dock);
    expect(am13HasTenantVariable()).toBe(true);
  });
});
