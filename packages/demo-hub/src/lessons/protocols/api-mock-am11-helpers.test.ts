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
const sendApiMockRequest = vi.fn(async () => ({ status: 200, body: '{"id":"42","uuid":"aaa"}' }));

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [string])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
  patchApiMockActiveRoute: (...a: unknown[]) => patchApiMockActiveRoute(...(a as [])),
  sendApiMockRequest: (...a: unknown[]) => sendApiMockRequest(...(a as [])),
}));

import {
  AM11_BROKEN_BODY,
  AM11_CONTENT_JSON,
  AM11_CORPUS_SAMPLE,
  AM11_ECHO_BODY,
  AM11_FAKER_BODY,
  AM11_GENERATED_BODY,
  AM11_PROVE_BODY,
  AM11_PROVE_HEADERS,
  AM11_PROVE_PATH,
  AM11_REPEAT_BODY,
  AM11_STATIC_BODY,
  AM11_TENANT_KEY,
  AM11_TENANT_VALUE,
  AM11_TIMING,
  AM11_VARIABLES_BODY,
  am11HasCompletions,
  am11HasHelpersBrowse,
  am11HasHelpersModal,
  am11HasMapper,
  am11HasTemplateBadge,
  am11HasTemplateError,
  am11HasTenantVariable,
  am11PreviewText,
  am11VariableKeys,
  cleanupAm11,
  closeAm11HelpersIfOpen,
  closeAm11MapperIfOpen,
  ensureAm11EchoBody,
  ensureAm11FakerBody,
  ensureAm11ForApply,
  ensureAm11ForMapBody,
  ensureAm11GeneratedBody,
  ensureAm11JournalOpen,
  ensureAm11Mapped,
  ensureAm11RepeatBody,
  ensureAm11ResponseTab,
  ensureAm11RuleOpen,
  ensureAm11Running,
  ensureAm11StudioView,
  ensureAm11TenantVariable,
  ensureAm11VariablesBody,
  ensureAm11Workspace,
  hasAm11RouteEditor,
  hasAm11Traffic,
  hasAm11Workspace,
  isAm11ServerRunning,
  isAm11StudioViewActive,
  prepareAm11Workspace,
  runAm11Completions,
  runAm11Echo,
  runAm11HelpersCatalog,
  runAm11Faker,
  runAm11Generated,
  runAm11MapBody,
  runAm11ProveTwice,
  runAm11Repeat,
  runAm11TemplateError,
  runAm11Variables,
  sendAm11ProveRequest,
  triggerAm11TemplateCompletions,
} from './api-mock-am11-helpers';

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function clicks(ctx: DemoActionContext): string[] {
  return (ctx.click as ReturnType<typeof vi.fn>).mock.calls.map(c => String(c[0]));
}

function fills(ctx: DemoActionContext): Array<[string, string]> {
  return (ctx.fill as ReturnType<typeof vi.fn>).mock.calls.map(c => [String(c[0]), String(c[1])]);
}

function mountExplorer(): void {
  if (document.querySelector(API_MOCK.ROUTE_EXPLORER)) return;
  const explorer = el('aside', 'api-mock-route-panel', 'api-mock-route-explorer');
  const wrap = el('div', 'am-tree-route-row');
  const row = el('button', 'am-route-item', 'api-mock-route-product');
  row.setAttribute('role', 'treeitem');
  wrap.append(row);
  explorer.append(wrap);
  document.body.append(explorer);
}

function mountServerBar(running = true, dirty = true): void {
  document.querySelector(API_MOCK.SERVER_BAR)?.remove();
  const bar = el('div', 'api-mock-server-bar', 'api-mock-server-bar');
  const status = el('span', running ? 'am-status-label running' : 'am-status-label', 'api-mock-status-label');
  status.textContent = running ? 'Running' : 'Stopped';
  bar.append(status);
  if (running) {
    bar.append(el('span', 'am-generation', 'api-mock-generation'));
    bar.append(el('button', 'am-btn', 'api-mock-stop'));
    if (dirty) {
      bar.append(el('span', 'am-badge warning', 'api-mock-dirty-badge'));
      bar.append(el('button', 'am-btn primary', 'api-mock-apply'));
    }
  } else {
    bar.append(el('button', 'am-btn primary', 'api-mock-start'));
  }
  document.body.append(bar);
}

function mountEditor(opts: {
  preview?: string;
  templateBadge?: boolean;
  templateError?: boolean;
  mapper?: boolean;
} = {}): void {
  document.querySelector(API_MOCK.ROUTE_EDITOR)?.remove();
  const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
  const btab = document.createElement('button');
  btab.id = 'api-mock-btab-response';
  makeVisible(btab);
  editor.append(btab);

  const response = el('div', 'am-response-editor', 'api-mock-response-editor');
  const body = el('div', 'am-monaco-body', 'api-mock-variant-body');
  const textarea = document.createElement('textarea');
  textarea.className = 'inputarea';
  makeVisible(textarea);
  body.append(textarea);
  response.append(body);
  response.append(el('span', 'am-faint', 'api-mock-body-size'));
  response.append(el('button', 'am-btn', 'api-mock-body-map'));
  if (opts.templateBadge) {
    const badge = el('span', 'am-badge info', 'api-mock-body-template-badge');
    badge.textContent = 'TEMPLATE';
    response.append(badge);
  }
  if (opts.mapper) {
    const mapper = el('div', 'dm-modal-shell', 'api-mock-body-mapper');
    const toolbar = el('div', 'dm-toolbar');
    toolbar.append(el('button', 'dm-toolbar-btn dm-toolbar-btn--primary'));
    mapper.append(toolbar);
    const footer = el('div', 'dm-modal-footer');
    footer.append(el('button', 'dm-modal-btn dm-modal-btn--secondary', 'api-mock-body-mapper-cancel'));
    footer.append(el('button', 'dm-modal-btn dm-modal-btn--primary'));
    mapper.append(footer);
    response.append(mapper);
  }

  const preview = el('aside', 'am-response-preview', 'api-mock-response-preview');
  preview.append(el('span', 'am-faint', 'api-mock-preview-sample'));
  const previewBody = el('pre', 'am-preview-body', 'api-mock-preview-body');
  previewBody.textContent = opts.preview ?? AM11_STATIC_BODY;
  preview.append(previewBody);
  if (opts.templateError) {
    const err = el('div', 'am-hint am-hint--error', 'api-mock-template-error');
    err.textContent = 'Unknown helper: noSuchHelper';
    preview.append(err);
  }
  response.append(preview);
  editor.append(response);
  document.body.append(editor);
}

function mountHelpersBrowse(): HTMLButtonElement {
  const existing = document.querySelector<HTMLButtonElement>(API_MOCK.TEMPLATE_HELPERS_BROWSE);
  if (existing) return existing;
  const browse = el('button', 'am-btn', 'api-mock-template-helpers-browse') as HTMLButtonElement;
  browse.textContent = 'Browse helpers';
  const editor = document.querySelector(API_MOCK.RESPONSE_EDITOR) ?? document.body;
  editor.append(browse);
  return browse;
}

function mountHelpersModal(): HTMLElement {
  document.querySelector(API_MOCK.TEMPLATE_HELPERS_MODAL)?.remove();
  const modal = el('div', 'am-template-helpers-modal', 'api-mock-template-helpers-modal');
  const group = el('section', 'am-template-helpers-group', 'api-mock-template-helpers-group-request');
  const row = el('div', 'am-template-helpers-row', 'api-mock-template-helpers-row');
  row.setAttribute('data-helper-id', 'uuid');
  row.textContent = '{{uuid}}';
  group.append(row);
  modal.append(group);
  const search = document.createElement('input');
  search.setAttribute('data-testid', 'api-mock-template-helpers-search');
  makeVisible(search);
  modal.append(search);
  modal.append(el('button', 'am-btn', 'api-mock-template-helpers-close'));
  document.body.append(modal);
  return modal;
}

function mountLiveStrip(): void {
  const strip = el('div', 'am-live-strip', 'api-mock-live-strip');
  const tx = el('button', 'am-chip', 'api-mock-live-transactions');
  const badge = el('span', 'am-count-badge');
  badge.textContent = '0';
  tx.append(badge);
  strip.append(tx);
  strip.append(el('button', 'am-chip', 'api-mock-live-variables'));
  document.body.append(strip);
  document.body.append(el('button', 'am-btn', 'api-mock-view-studio'));
}

function mountVariablesDock(keys: string[] = []): void {
  const dock = el('div', 'am-dock', 'api-mock-dock');
  const tab = el('button', 'am-dock-tab', 'api-mock-dock-tab-variables');
  tab.setAttribute('aria-selected', 'true');
  dock.append(tab);
  const panel = el('div', 'am-vars', 'api-mock-dock-variables');
  panel.append(el('button', 'am-btn', 'api-mock-var-add'));
  if (keys.length > 0) {
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    keys.forEach((key, i) => {
      const tr = el('tr', undefined, `api-mock-var-row-v${i + 1}`);
      const keyInput = document.createElement('input');
      keyInput.setAttribute('data-testid', `api-mock-var-key-v${i + 1}`);
      keyInput.value = key;
      makeVisible(keyInput);
      const valInput = document.createElement('input');
      valInput.setAttribute('data-testid', `api-mock-var-value-v${i + 1}`);
      valInput.value = key === AM11_TENANT_KEY ? AM11_TENANT_VALUE : '';
      makeVisible(valInput);
      const td1 = document.createElement('td');
      td1.append(keyInput);
      const td2 = document.createElement('td');
      td2.append(valInput);
      tr.append(td1, td2);
      tbody.append(tr);
    });
    table.append(tbody);
    panel.append(table);
  }
  dock.append(panel);
  document.body.append(dock);
}

function mountJournal(ids = ['tx-1']): void {
  const dock = document.querySelector(API_MOCK.DOCK) ?? el('div', 'am-dock', 'api-mock-dock');
  if (!dock.isConnected) document.body.append(dock);
  let table = dock.querySelector('table');
  if (!table) {
    table = document.createElement('table');
    const tbody = document.createElement('tbody');
    table.append(tbody);
    dock.append(table);
  }
  const tbody = table.querySelector('tbody')!;
  tbody.replaceChildren();
  for (const id of ids) {
    const tr = el('tr', undefined, `api-mock-tx-${id}`);
    tbody.append(tr);
  }
  if (!document.querySelector(API_MOCK.TX_DETAIL)) {
    const detail = el('div', 'am-tx-detail', 'api-mock-tx-detail');
    detail.append(el('section', undefined, 'api-mock-tx-response'));
    document.body.append(detail);
  }
}

describe('AM-11 templating helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    importApiMockGallerySample.mockResolvedValue(true);
    patchApiMockActiveRoute.mockReturnValue(true);
    sendApiMockRequest.mockResolvedValue({ status: 200, body: '{"id":"42","uuid":"aaa"}' });
    delete (window as unknown as { monaco?: unknown }).monaco;
  });

  it('pins slower holds plus completions, faker preview, and the broken-helper hold', () => {
    expect(AM11_TIMING.look).toBe(900);
    expect(AM11_TIMING.beforeOpen).toBe(1400);
    expect(AM11_TIMING.payoff).toBe(1600);
    expect(AM11_TIMING.completions).toBe(2000);
    expect(AM11_TIMING.helpersCatalog).toBe(2000);
    expect(AM11_TIMING.fakerPreview).toBe(1500);
    expect(AM11_TIMING.brokenExpression).toBe(4500);
    expect(AM11_TIMING.brokenExpression).toBeGreaterThan(AM11_TIMING.templateError);
    expect(AM11_TIMING.templateError).toBe(3200);
  });

  it('reads workspace, preview, badge, and mapper from the DOM', () => {
    expect(hasAm11Workspace()).toBe(false);
    expect(isAm11StudioViewActive()).toBe(false);
    expect(isAm11ServerRunning()).toBe(false);
    expect(hasAm11Traffic()).toBe(false);
    expect(am11HasTemplateBadge()).toBe(false);
    expect(am11HasTemplateError()).toBe(false);
    expect(am11HasMapper()).toBe(false);
    expect(am11HasCompletions()).toBe(false);
    expect(am11HasHelpersBrowse()).toBe(false);
    expect(am11HasHelpersModal()).toBe(false);

    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ preview: '{"id":"42"}', templateBadge: true, templateError: true, mapper: true });
    const suggest = el('div', 'suggest-widget visible');
    document.body.append(suggest);

    expect(hasAm11Workspace()).toBe(true);
    expect(hasAm11RouteEditor()).toBe(true);
    expect(isAm11StudioViewActive()).toBe(true);
    expect(isAm11ServerRunning()).toBe(true);
    expect(am11PreviewText()).toContain('42');
    expect(am11HasTemplateBadge()).toBe(true);
    expect(am11HasTemplateError()).toBe(true);
    expect(am11HasMapper()).toBe(true);
    expect(am11HasCompletions()).toBe(true);
  });

  it('boots by importing the static product corpus', async () => {
    await prepareAm11Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM11_CORPUS_SAMPLE);
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    await cleanupAm11();
    expect(wipeApiMockWorkspace).toHaveBeenCalledTimes(2);
  });

  it('throws when the gallery sample cannot be imported', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(prepareAm11Workspace()).rejects.toThrow(AM11_CORPUS_SAMPLE);
  });

  it('ensureAm11StudioView clicks Studio when the explorer is gone', async () => {
    const ctx = makeCtx();
    document.body.append(el('button', 'am-btn', 'api-mock-view-studio'));
    await ensureAm11StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
  });

  it('ensureAm11StudioView skips when Studio is already showing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    await ensureAm11StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm11Workspace imports when the explorer is empty', async () => {
    const ctx = makeCtx();
    document.body.append(el('button', 'am-btn', 'api-mock-view-studio'));
    await ensureAm11Workspace(ctx);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM11_CORPUS_SAMPLE);
  });

  it('ensureAm11Workspace throws when a mid-lesson reimport fails', async () => {
    const ctx = makeCtx();
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(ensureAm11Workspace(ctx)).rejects.toThrow(AM11_CORPUS_SAMPLE);
  });

  it('ensureAm11Running starts a stopped listener and skips when already running', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(false, false);
    await ensureAm11Running(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.START);

    vi.clearAllMocks();
    document.body.innerHTML = '';
    mountExplorer();
    mountServerBar(true, true);
    await ensureAm11Running(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm11ResponseTab clicks Response when the body is missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    const editor = el('div', 'am-route-editor', 'api-mock-route-editor');
    const btab = document.createElement('button');
    btab.id = 'api-mock-btab-response';
    makeVisible(btab);
    editor.append(btab);
    document.body.append(editor);
    await ensureAm11ResponseTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.BTAB_RESPONSE);
  });

  it('ensureAm11EchoBody patches when the preview is still static', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ preview: AM11_STATIC_BODY });
    await ensureAm11EchoBody(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({
      body: AM11_ECHO_BODY,
      contentType: AM11_CONTENT_JSON,
    });
  });

  it('ensureAm11EchoBody skips when 42 is already in the preview', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ preview: '{"id":"42"}', templateBadge: true });
    await ensureAm11EchoBody(ctx);
    expect(patchApiMockActiveRoute).not.toHaveBeenCalled();
  });

  it('ensure helpers patch generated, repeat, faker, and variables bodies', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    mountLiveStrip();
    mountVariablesDock([AM11_TENANT_KEY]);
    await ensureAm11GeneratedBody(ctx);
    await ensureAm11RepeatBody(ctx);
    await ensureAm11FakerBody(ctx);
    await ensureAm11VariablesBody(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ body: AM11_GENERATED_BODY, contentType: AM11_CONTENT_JSON });
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ body: AM11_REPEAT_BODY, contentType: AM11_CONTENT_JSON });
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ body: AM11_FAKER_BODY, contentType: AM11_CONTENT_JSON });
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ body: AM11_VARIABLES_BODY, contentType: AM11_CONTENT_JSON });
  });

  it('ensureAm11TenantVariable adds a row when Variables is empty', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    mountLiveStrip();
    mountVariablesDock([]);
    await ensureAm11TenantVariable(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VAR_ADD);
    expect(fills(ctx)).toEqual(expect.arrayContaining([
      [API_MOCK.VAR_KEY_LAST, AM11_TENANT_KEY],
      [API_MOCK.VAR_VALUE_LAST, AM11_TENANT_VALUE],
    ]));
  });

  it('ensureAm11TenantVariable skips add when tenant already exists', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    mountLiveStrip();
    mountVariablesDock([AM11_TENANT_KEY]);
    expect(am11HasTenantVariable()).toBe(true);
    expect(am11VariableKeys()).toEqual([AM11_TENANT_KEY]);
    await ensureAm11TenantVariable(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.VAR_ADD);
  });

  it('ensureAm11ForMapBody restores the static JSON body', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ templateBadge: true, preview: '{"id":"42"}' });
    mountLiveStrip();
    mountVariablesDock([AM11_TENANT_KEY]);
    await ensureAm11ForMapBody(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenLastCalledWith({
      body: AM11_STATIC_BODY,
      contentType: AM11_CONTENT_JSON,
    });
  });

  it('closeAm11MapperIfOpen clicks cancel when the mapper is up', async () => {
    const ctx = makeCtx();
    mountEditor({ mapper: true });
    await closeAm11MapperIfOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.BODY_MAPPER_CANCEL);
  });

  it('closeAm11MapperIfOpen is a no-op when the mapper is closed', async () => {
    const ctx = makeCtx();
    mountEditor();
    await closeAm11MapperIfOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('triggerAm11TemplateCompletions types {{ via monaco when the editor is mounted', () => {
    mountEditor();
    const trigger = vi.fn();
    const focus = vi.fn();
    const setPosition = vi.fn();
    const wrap = document.querySelector(API_MOCK.VARIANT_BODY)!;
    const dom = document.createElement('div');
    wrap.append(dom);
    (window as unknown as { monaco: { editor: { getEditors: () => unknown[] } } }).monaco = {
      editor: {
        getEditors: () => [{
          getDomNode: () => dom,
          focus,
          getModel: () => ({ getLineCount: () => 1, getLineMaxColumn: () => 2 }),
          setPosition,
          trigger,
        }],
      },
    };
    expect(triggerAm11TemplateCompletions()).toBe(true);
    expect(focus).toHaveBeenCalled();
    expect(trigger).toHaveBeenCalledWith('keyboard', 'type', { text: '{{' });
    expect(trigger).toHaveBeenCalledWith('keyboard', 'editor.action.triggerSuggest');
  });

  it('triggerAm11TemplateCompletions falls back to the textarea', () => {
    mountEditor();
    expect(triggerAm11TemplateCompletions()).toBe(true);
    const textarea = document.querySelector<HTMLTextAreaElement>(`${API_MOCK.VARIANT_BODY} textarea`)!;
    expect(textarea.value).toContain('{{');
  });

  it('triggerAm11TemplateCompletions returns false without a body editor', () => {
    expect(triggerAm11TemplateCompletions()).toBe(false);
  });

  it('runAm11Completions spotlights the body and types {{', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor();
    await runAm11Completions(ctx);
    expect(clicks(ctx)).toContain(API_MOCK.VARIANT_BODY);
  });

  it('runAm11Echo patches the echo body and holds the template badge', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor({ templateBadge: true, preview: '{"id":"42"}' });
    await runAm11Echo(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({
      body: AM11_ECHO_BODY,
      contentType: AM11_CONTENT_JSON,
    });
  });

  it('runAm11Generated patches uuid/now then the full generated body', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor();
    await runAm11Generated(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledTimes(2);
    expect(patchApiMockActiveRoute).toHaveBeenLastCalledWith({
      body: AM11_GENERATED_BODY,
      contentType: AM11_CONTENT_JSON,
    });
  });

  it('runAm11Repeat, faker, map-body, and template-error patch the authored bodies', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor({ mapper: true, templateError: true });
    mountLiveStrip();
    await runAm11Repeat(ctx);
    await runAm11Faker(ctx);
    await runAm11MapBody(ctx);
    await runAm11TemplateError(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ body: AM11_REPEAT_BODY, contentType: AM11_CONTENT_JSON });
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ body: AM11_FAKER_BODY, contentType: AM11_CONTENT_JSON });
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ body: AM11_STATIC_BODY, contentType: AM11_CONTENT_JSON });
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ body: AM11_BROKEN_BODY, contentType: AM11_CONTENT_JSON });
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ body: AM11_VARIABLES_BODY, contentType: AM11_CONTENT_JSON });
  });

  it('runAm11TemplateError holds the diagnostic long enough to read', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor({ templateError: true });
    await runAm11TemplateError(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(AM11_TIMING.brokenExpression);
    expect(ctx.delay).toHaveBeenCalledWith(AM11_TIMING.templateError);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({ body: AM11_BROKEN_BODY, contentType: AM11_CONTENT_JSON });
    expect(patchApiMockActiveRoute).toHaveBeenLastCalledWith({
      body: AM11_VARIABLES_BODY,
      contentType: AM11_CONTENT_JSON,
    });
  });

  it('runAm11Variables adds tenant then returns to the rule', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    mountLiveStrip();
    mountVariablesDock(['']);
    await runAm11Variables(ctx);
    expect(clicks(ctx)).toEqual(expect.arrayContaining([
      API_MOCK.VAR_ADD,
      API_MOCK.VIEW_STUDIO,
    ]));
    expect(clicks(ctx)).not.toContain(API_MOCK.LIVE_VARIABLES);
    expect(fills(ctx)).toEqual(expect.arrayContaining([
      [API_MOCK.VAR_KEY_LAST, AM11_TENANT_KEY],
      [API_MOCK.VAR_VALUE_LAST, AM11_TENANT_VALUE],
    ]));
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({
      body: AM11_VARIABLES_BODY,
      contentType: AM11_CONTENT_JSON,
    });
  });

  it('runAm11ProveTwice Applies, fetches twice, and opens journal detail', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    mountLiveStrip();
    mountJournal(['tx-1']);
    sendApiMockRequest
      .mockResolvedValueOnce({ status: 200, body: '{"id":"42","uuid":"aaa"}' })
      .mockResolvedValueOnce({ status: 200, body: '{"id":"42","uuid":"bbb"}' });
    await runAm11ProveTwice(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.APPLY);
    expect(sendApiMockRequest).toHaveBeenCalledTimes(2);
    expect(sendApiMockRequest).toHaveBeenCalledWith({
      path: AM11_PROVE_PATH,
      method: 'GET',
      headers: AM11_PROVE_HEADERS,
      body: AM11_PROVE_BODY,
    });
  });

  it('sendAm11ProveRequest hits the parameterized path', async () => {
    await sendAm11ProveRequest();
    expect(sendApiMockRequest).toHaveBeenCalledWith({
      path: AM11_PROVE_PATH,
      method: 'GET',
      headers: AM11_PROVE_HEADERS,
      body: AM11_PROVE_BODY,
    });
  });

  it('ensureAm11ForApply and ensureAm11Mapped compose the later-step guards', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    mountLiveStrip();
    mountVariablesDock([AM11_TENANT_KEY]);
    await ensureAm11ForApply(ctx);
    await ensureAm11Mapped(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalled();
  });

  it('hasAm11Traffic reads the journal row and the live-strip count', () => {
    expect(hasAm11Traffic()).toBe(false);
    mountLiveStrip();
    const badge = document.querySelector('.am-count-badge')!;
    badge.textContent = '2';
    expect(hasAm11Traffic()).toBe(true);
    document.body.innerHTML = '';
    mountJournal(['tx-9']);
    expect(hasAm11Traffic()).toBe(true);
  });

  it('ensureAm11StudioView is a no-op when Studio is missing', async () => {
    const ctx = makeCtx();
    await ensureAm11StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm11RuleOpen clicks the explorer row when the editor is closed', async () => {
    const ctx = makeCtx();
    mountExplorer();
    await ensureAm11RuleOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.ROUTE_ROW);
  });

  it('ensureAm11RuleOpen skips when the editor is already open', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor();
    await ensureAm11RuleOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm11Workspace skips import when the explorer is already populated', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    await ensureAm11Workspace(ctx);
    expect(importApiMockGallerySample).not.toHaveBeenCalled();
  });

  it('ensureAm11Running is a no-op without a Start button', async () => {
    const ctx = makeCtx();
    mountExplorer();
    await ensureAm11Running(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureAm11TenantVariable opens Runtime when the dock is closed', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    mountLiveStrip();
    await ensureAm11TenantVariable(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.LIVE_VARIABLES);
  });

  it('ensureAm11TenantVariable returns when Variables cannot be opened', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    await ensureAm11TenantVariable(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.VAR_ADD);
  });

  it('ensureAm11JournalOpen clicks the live strip then the dock tab', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    mountLiveStrip();
    mountVariablesDock([AM11_TENANT_KEY]);
    const dock = document.querySelector(API_MOCK.DOCK)!;
    dock.append(el('button', 'am-dock-tab', 'api-mock-dock-tab-transactions'));
    await ensureAm11JournalOpen(ctx);
    expect(clicks(ctx)).toEqual(expect.arrayContaining([
      API_MOCK.LIVE_TRANSACTIONS,
      API_MOCK.DOCK_TAB_TRANSACTIONS,
    ]));
  });

  it('ensureAm11JournalOpen skips when a journal row is already visible', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    mountLiveStrip();
    mountVariablesDock([AM11_TENANT_KEY]);
    mountJournal(['tx-1']);
    await ensureAm11JournalOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
  });

  it('ensureAm11JournalOpen returns when neither the live strip nor the dock tab is mounted', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    mountVariablesDock([AM11_TENANT_KEY]);
    await ensureAm11JournalOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.LIVE_TRANSACTIONS);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.DOCK_TAB_TRANSACTIONS);
  });

  it('closeAm11MapperIfOpen skips cancel when the mapper has no footer', async () => {
    const ctx = makeCtx();
    const mapper = el('div', 'dm-modal-shell', 'api-mock-body-mapper');
    document.body.append(mapper);
    await closeAm11MapperIfOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('triggerAm11TemplateCompletions uses the first monaco editor as a fallback', () => {
    mountEditor();
    const trigger = vi.fn();
    (window as unknown as { monaco: { editor: { getEditors: () => unknown[] } } }).monaco = {
      editor: {
        getEditors: () => [{
          getDomNode: () => document.createElement('div'),
          focus: vi.fn(),
          getModel: () => null,
          setPosition: vi.fn(),
          trigger,
        }],
      },
    };
    expect(triggerAm11TemplateCompletions()).toBe(true);
    expect(trigger).toHaveBeenCalledWith('keyboard', 'type', { text: '{{' });
  });

  it('triggerAm11TemplateCompletions returns false without monaco or a textarea', () => {
    const body = el('div', 'am-monaco-body', 'api-mock-variant-body');
    document.body.append(body);
    expect(triggerAm11TemplateCompletions()).toBe(false);
  });

  it('runAm11Completions holds the suggest widget when it is open', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor();
    const suggest = el('div', 'suggest-widget visible');
    document.body.append(suggest);
    await runAm11Completions(ctx);
    expect(clicks(ctx)).toContain(API_MOCK.VARIANT_BODY);
  });

  it('runAm11Completions opens Browse helpers, searches uuid, and closes', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor();
    mountHelpersBrowse();
    (ctx.click as ReturnType<typeof vi.fn>).mockImplementation(async (selector: string) => {
      if (selector === API_MOCK.TEMPLATE_HELPERS_BROWSE) mountHelpersModal();
      if (selector === API_MOCK.TEMPLATE_HELPERS_CLOSE) {
        document.querySelector(API_MOCK.TEMPLATE_HELPERS_MODAL)?.remove();
      }
    });
    await runAm11Completions(ctx);
    expect(clicks(ctx)).toEqual(expect.arrayContaining([
      API_MOCK.VARIANT_BODY,
      API_MOCK.TEMPLATE_HELPERS_BROWSE,
      API_MOCK.TEMPLATE_HELPERS_CLOSE,
    ]));
    expect(fills(ctx)).toContainEqual([API_MOCK.TEMPLATE_HELPERS_SEARCH, 'uuid']);
    expect(am11HasHelpersModal()).toBe(false);
  });

  it('runAm11HelpersCatalog is a no-op without Browse helpers', async () => {
    const ctx = makeCtx();
    mountEditor();
    await runAm11HelpersCatalog(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('closeAm11HelpersIfOpen is quiet when the catalog is already closed', async () => {
    const ctx = makeCtx();
    await closeAm11HelpersIfOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('closeAm11HelpersIfOpen dismisses an open catalog quietly', async () => {
    const ctx = makeCtx();
    mountHelpersModal();
    (ctx.click as ReturnType<typeof vi.fn>).mockImplementation(async (selector: string) => {
      if (selector === API_MOCK.TEMPLATE_HELPERS_CLOSE) {
        document.querySelector(API_MOCK.TEMPLATE_HELPERS_MODAL)?.remove();
      }
    });
    await closeAm11HelpersIfOpen(ctx);
    expect(clicks(ctx)).toEqual([API_MOCK.TEMPLATE_HELPERS_CLOSE]);
    expect(am11HasHelpersModal()).toBe(false);
  });

  it('ensureAm11Workspace closes a leftover helpers catalog', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, true);
    mountEditor();
    mountHelpersModal();
    (ctx.click as ReturnType<typeof vi.fn>).mockImplementation(async (selector: string) => {
      if (selector === API_MOCK.TEMPLATE_HELPERS_CLOSE) {
        document.querySelector(API_MOCK.TEMPLATE_HELPERS_MODAL)?.remove();
      }
    });
    await ensureAm11Workspace(ctx);
    expect(clicks(ctx)).toContain(API_MOCK.TEMPLATE_HELPERS_CLOSE);
  });

  it('runAm11Variables clicks the Variables dock tab when it is not selected', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor();
    mountLiveStrip();
    mountVariablesDock([]);
    const tab = document.querySelector(API_MOCK.DOCK_TAB_VARIABLES)!;
    tab.setAttribute('aria-selected', 'false');
    await runAm11Variables(ctx);
    expect(clicks(ctx)).toContain(API_MOCK.DOCK_TAB_VARIABLES);
    expect(clicks(ctx)).not.toContain(API_MOCK.LIVE_VARIABLES);
  });

  it('runAm11Variables clicks the live strip when the dock is not mounted', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor();
    mountLiveStrip();
    (ctx.click as ReturnType<typeof vi.fn>).mockImplementation(async (selector: string) => {
      if (selector === API_MOCK.LIVE_VARIABLES && !document.querySelector(API_MOCK.DOCK_VARIABLES)) {
        mountVariablesDock([]);
      }
    });
    await runAm11Variables(ctx);
    expect(clicks(ctx)).toEqual(expect.arrayContaining([
      API_MOCK.LIVE_VARIABLES,
      API_MOCK.VAR_ADD,
      API_MOCK.VIEW_STUDIO,
    ]));
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.DOCK_VARIABLES, 8_000);
  });

  it('runAm11Variables still patches the body when Variables never opens', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor();
    mountLiveStrip();
    await runAm11Variables(ctx);
    expect(clicks(ctx)).toContain(API_MOCK.LIVE_VARIABLES);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.VAR_ADD);
    expect(ctx.waitFor).not.toHaveBeenCalledWith(API_MOCK.DOCK_VARIABLES, 8_000);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({
      body: AM11_VARIABLES_BODY,
      contentType: AM11_CONTENT_JSON,
    });
  });

  it('runAm11ProveTwice still fetches when Apply is absent', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountServerBar(true, false);
    mountEditor();
    mountLiveStrip();
    await runAm11ProveTwice(ctx);
    expect(sendApiMockRequest).toHaveBeenCalledTimes(2);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.APPLY);
  });

  it('runAm11MapBody still patches when the mapper chrome is missing', async () => {
    const ctx = makeCtx();
    mountExplorer();
    mountEditor();
    await runAm11MapBody(ctx);
    expect(patchApiMockActiveRoute).toHaveBeenCalledWith({
      body: AM11_STATIC_BODY,
      contentType: AM11_CONTENT_JSON,
    });
    expect(clicks(ctx)).toContain(API_MOCK.BODY_MAP);
  });

  it('hasAm11Traffic ignores a non-numeric live-strip badge', () => {
    mountLiveStrip();
    document.querySelector('.am-count-badge')!.textContent = 'n';
    expect(hasAm11Traffic()).toBe(false);
  });
});
