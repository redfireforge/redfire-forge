/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { API_MOCK } from '@shared/selectors';
import { makeCtx, makeVisible } from './ws-test-utils';

const wipeApiMockWorkspace = vi.fn(async () => true);
const importApiMockGallerySample = vi.fn(async () => true);
const seedApiMockExportSecrets = vi.fn(async () => true);
const prepareApiMockStudioChrome = vi.fn();

vi.mock('../../adapters', () => ({
  wipeApiMockWorkspace: (...a: unknown[]) => wipeApiMockWorkspace(...(a as [])),
  importApiMockGallerySample: (...a: unknown[]) => importApiMockGallerySample(...(a as [])),
  seedApiMockExportSecrets: (...a: unknown[]) => seedApiMockExportSecrets(...(a as [])),
  prepareApiMockStudioChrome: (...a: unknown[]) => prepareApiMockStudioChrome(...(a as [])),
}));

import {
  AM16_CLI,
  AM16_CONFIRM_MS,
  AM16_CORPUS_SAMPLE,
  AM16_REVEAL_MS,
  AM16_SECRET_REDACTED,
  AM16_TIMING,
  AM16_TLS_REDACTED,
  am16CopiedCount,
  am16HarCountText,
  am16TlsKeyText,
  cleanupAm16,
  closeAm16Export,
  closeAm16Import,
  dismissAm16Overlays,
  ensureAm16ForCi,
  ensureAm16ForExportMenu,
  ensureAm16ForHar,
  ensureAm16ForNarrower,
  ensureAm16ForRedaction,
  ensureAm16ForRoundTrip,
  ensureAm16ForWireMock,
  ensureAm16Library,
  ensureAm16StudioView,
  hasAm16Copies,
  hasAm16LastExport,
  hasAm16Library,
  isAm16CopyModeActive,
  isAm16ExportConfirmOpen,
  isAm16ExportMenuOpen,
  isAm16ImportOpen,
  isAm16RedactionVisible,
  isAm16SourceActive,
  isAm16StudioViewActive,
  prepareAm16Workspace,
  runAm16CiHandoff,
  runAm16ExportMenu,
  runAm16Har,
  runAm16NarrowerScopes,
  runAm16Redaction,
  runAm16RoundTrip,
  runAm16WireMock,
} from './api-mock-am16-helpers';

function el(tag: string, className?: string, testid?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (testid) node.setAttribute('data-testid', testid);
  makeVisible(node);
  return node;
}

function mountStudio(): HTMLElement {
  const bar = el('div', undefined, 'api-mock-server-bar');
  const explorer = el('div', undefined, 'api-mock-route-explorer');
  const row = el('button', 'am-route-item', 'api-mock-route-r1');
  row.setAttribute('role', 'treeitem');
  explorer.append(row);
  const footer = el('span', undefined, 'api-mock-routes-footer');
  footer.textContent = '10 enabled · 2 drafts';
  const cli = el('code', undefined, 'api-mock-cli-simulate');
  cli.textContent = AM16_CLI;
  explorer.append(footer, cli);
  document.body.append(bar, explorer);
  return explorer;
}

function mountExportChrome(opts: { menu?: boolean; confirm?: boolean; redaction?: boolean; loss?: boolean; har?: boolean } = {}): void {
  const exportBtn = el('button', undefined, 'api-mock-export');
  document.body.append(exportBtn);
  if (opts.menu) {
    const menu = el('div', undefined, 'api-mock-export-menu-panel');
    for (const [id, testid] of [
      ['workspace', 'api-mock-export-group-workspace'],
      ['server', 'api-mock-export-group-server'],
      ['interop', 'api-mock-export-group-interop'],
      ['json', 'api-mock-export-workspace'],
      ['yaml', 'api-mock-export-workspace-yaml'],
      ['servers', 'api-mock-export-servers'],
      ['routes', 'api-mock-export-routes'],
      ['wiremock', 'api-mock-export-wiremock'],
      ['har', 'api-mock-export-har'],
    ] as const) {
      const node = el('button', undefined, testid);
      node.textContent = id;
      menu.append(node);
    }
    document.body.append(menu);
  }
  if (opts.confirm) {
    const confirm = el('div', undefined, 'api-mock-export-confirm');
    const close = el('button', undefined, 'api-mock-export-close');
    const filename = el('span', undefined, 'api-mock-export-filename');
    filename.textContent = 'api-mock-workspace.json';
    const save = el('button', undefined, 'api-mock-export-save');
    save.textContent = 'Save to disk';
    const preview = el('textarea', undefined, 'api-mock-export-preview') as HTMLTextAreaElement;
    preview.value = '{"ok":true}';
    confirm.append(close, filename, save, preview);
    if (opts.redaction) {
      confirm.append(el('div', undefined, 'api-mock-export-redaction'));
      const tls = el('code', undefined, 'api-mock-export-tls-key');
      tls.textContent = AM16_TLS_REDACTED;
      const secret = el('code', undefined, 'api-mock-export-secret');
      secret.textContent = AM16_SECRET_REDACTED;
      confirm.append(tls, secret);
    }
    if (opts.loss) {
      confirm.append(el('div', undefined, 'api-mock-export-mapping-count'));
      const loss = el('div', undefined, 'api-mock-export-loss');
      loss.textContent = 'template helpers exported as literal text';
      confirm.append(loss);
    }
    if (opts.har) {
      const count = el('div', undefined, 'api-mock-export-har-count');
      count.textContent = 'HAR export: 2 entries';
      confirm.append(count);
    }
    document.body.append(confirm);
  }
}

function mountImport(opts: { source?: string; lastExport?: boolean; copy?: boolean; preview?: boolean } = {}): void {
  const review = el('div', undefined, 'api-mock-import-review');
  const close = el('button', undefined, 'api-mock-import-close');
  const sources = el('div', undefined, 'api-mock-import-sources');
  for (const id of ['curl', 'native', 'openapi']) {
    const btn = el('button', id === (opts.source ?? 'curl') ? 'active' : '', `api-mock-import-source-${id}`);
    sources.append(btn);
  }
  const copy = el('button', opts.copy ? 'active' : '', 'api-mock-import-mode-copy');
  review.append(close, sources, copy);
  if (opts.lastExport) review.append(el('button', undefined, 'api-mock-import-last-export'));
  review.append(el('textarea', undefined, 'api-mock-import-paste'));
  review.append(el('button', undefined, 'api-mock-import-pretty'));
  review.append(el('button', undefined, 'api-mock-import-parse'));
  if (opts.preview) review.append(el('div', undefined, 'api-mock-import-preview-block'));
  review.append(el('button', undefined, 'api-mock-import-confirm'));
  document.body.append(review, el('button', undefined, 'api-mock-import-menu'));
}

function spyNativeClick(testid: string): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  document.querySelector(`[data-testid="${testid}"]`)?.addEventListener('click', fn);
  return fn;
}

function mountCopies(count: number): void {
  const explorer = document.querySelector('[data-testid="api-mock-route-explorer"]') ?? el('div', undefined, 'api-mock-route-explorer');
  for (let i = 0; i < count; i++) {
    const row = el('button', 'am-route-item', `api-mock-route-copy-${i}`);
    row.setAttribute('role', 'treeitem');
    row.setAttribute('data-copied', 'true');
    explorer.append(row);
  }
  if (!explorer.isConnected) document.body.append(explorer);
}

describe('AM-16 export helpers', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
    importApiMockGallerySample.mockResolvedValue(true);
    seedApiMockExportSecrets.mockResolvedValue(true);
  });

  it('pins timing and redaction placeholders', () => {
    expect(AM16_TIMING.payoff).toBe(1600);
    expect(AM16_TIMING.beforeOpen).toBe(1400);
    expect(AM16_TIMING.importLook).toBe(1200);
    expect(AM16_TIMING.importHold).toBe(1700);
    expect(AM16_TIMING.importRead).toBe(1900);
    expect(AM16_TIMING.importBreak).toBe(1100);
    expect(AM16_REVEAL_MS).toBe(8_000);
    expect(AM16_CONFIRM_MS).toBe(3_000);
    expect(AM16_CORPUS_SAMPLE).toBe('am-gallery-store');
    expect(AM16_TLS_REDACTED).toBe('***REDACTED***');
    expect(AM16_SECRET_REDACTED).toBe('[REDACTED]');
    expect(AM16_CLI).toContain('redfireforge mock simulate');
  });

  it('probes are false on an empty document', () => {
    expect(hasAm16Library()).toBe(false);
    expect(isAm16StudioViewActive()).toBe(false);
    expect(isAm16ExportMenuOpen()).toBe(false);
    expect(isAm16ExportConfirmOpen()).toBe(false);
    expect(isAm16ImportOpen()).toBe(false);
    expect(isAm16RedactionVisible()).toBe(false);
    expect(am16TlsKeyText()).toBe('');
    expect(am16HarCountText()).toBe('');
    expect(am16CopiedCount()).toBe(0);
    expect(hasAm16Copies()).toBe(false);
    expect(hasAm16LastExport()).toBe(false);
    expect(isAm16SourceActive('native')).toBe(false);
    expect(isAm16CopyModeActive()).toBe(false);
  });

  it('probes read mounted studio, export confirm, and copies', () => {
    mountStudio();
    mountExportChrome({ menu: true, confirm: true, redaction: true, har: true });
    mountImport({ source: 'native', lastExport: true, copy: true });
    mountCopies(2);
    expect(hasAm16Library()).toBe(true);
    expect(isAm16StudioViewActive()).toBe(true);
    expect(isAm16ExportMenuOpen()).toBe(true);
    expect(isAm16ExportConfirmOpen()).toBe(true);
    expect(isAm16ImportOpen()).toBe(true);
    expect(isAm16RedactionVisible()).toBe(true);
    expect(am16TlsKeyText()).toBe(AM16_TLS_REDACTED);
    expect(am16HarCountText()).toContain('2 entries');
    expect(am16CopiedCount()).toBe(2);
    expect(hasAm16LastExport()).toBe(true);
    expect(isAm16SourceActive('native')).toBe(true);
    expect(isAm16CopyModeActive()).toBe(true);
  });

  it('prepare imports the store library and seeds secrets; cleanup wipes', async () => {
    await prepareAm16Workspace();
    expect(wipeApiMockWorkspace).toHaveBeenCalled();
    expect(prepareApiMockStudioChrome).toHaveBeenCalled();
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM16_CORPUS_SAMPLE);
    expect(seedApiMockExportSecrets).toHaveBeenCalled();
    await cleanupAm16();
    expect(wipeApiMockWorkspace).toHaveBeenCalledTimes(2);
  });

  it('prepare throws when the gallery import fails', async () => {
    importApiMockGallerySample.mockResolvedValueOnce(false);
    await expect(prepareAm16Workspace()).rejects.toThrow(/am-gallery-store/);
  });

  it('prepare throws when secret seeding fails', async () => {
    seedApiMockExportSecrets.mockResolvedValueOnce(false);
    await expect(prepareAm16Workspace()).rejects.toThrow(/TLS key/);
  });

  it('ensureAm16StudioView clicks Studio when the explorer is gone', async () => {
    const ctx = makeCtx();
    document.body.append(el('button', undefined, 'api-mock-view-studio'));
    await ensureAm16StudioView(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.VIEW_STUDIO);
  });

  it('ensureAm16Library skips when the corpus is already up', async () => {
    const ctx = makeCtx();
    mountStudio();
    await ensureAm16Library(ctx);
    expect(importApiMockGallerySample).not.toHaveBeenCalled();
  });

  it('ensureAm16Library re-imports when the explorer is empty', async () => {
    const ctx = makeCtx();
    document.body.append(el('div', undefined, 'api-mock-server-bar'));
    document.body.append(el('button', undefined, 'api-mock-view-studio'));
    await ensureAm16Library(ctx);
    expect(importApiMockGallerySample).toHaveBeenCalledWith(AM16_CORPUS_SAMPLE);
    expect(seedApiMockExportSecrets).toHaveBeenCalled();
  });

  it('close helpers no-op when overlays are absent', async () => {
    const ctx = makeCtx();
    await closeAm16Export(ctx, true);
    await closeAm16Import(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('closeAm16Export clicks Close on the confirmation', async () => {
    const ctx = makeCtx();
    mountExportChrome({ confirm: true });
    await closeAm16Export(ctx, true);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT_CLOSE);
  });

  it('closeAm16Import clicks Cancel', async () => {
    const ctx = makeCtx();
    mountImport();
    await closeAm16Import(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CLOSE);
  });

  it('dismissAm16Overlays clicks Export Close when the confirm is leftover', () => {
    mountExportChrome({ confirm: true });
    const close = document.querySelector(API_MOCK.EXPORT_CLOSE) as HTMLButtonElement;
    const spy = vi.spyOn(close, 'click');
    dismissAm16Overlays();
    expect(spy).toHaveBeenCalled();
  });

  it('prepare and cleanup dismiss leftover Export confirm', async () => {
    mountExportChrome({ confirm: true });
    const close = document.querySelector(API_MOCK.EXPORT_CLOSE) as HTMLButtonElement;
    const spy = vi.spyOn(close, 'click');
    await prepareAm16Workspace();
    expect(spy).toHaveBeenCalled();
    await cleanupAm16();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('ensureAm16ForExportMenu closes a leftover confirm', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountExportChrome({ confirm: true });
    await ensureAm16ForExportMenu(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT_CLOSE);
  });

  it('runAm16ExportMenu opens the menu, holds groups, then workspace JSON', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountExportChrome({ menu: true, confirm: true });
    const workspace = spyNativeClick('api-mock-export-workspace');
    await runAm16ExportMenu(ctx);
    expect(workspace).toHaveBeenCalled();
  });

  it('runAm16NarrowerScopes exports YAML, server, and routes', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountExportChrome({ menu: true, confirm: true });
    const yaml = spyNativeClick('api-mock-export-workspace-yaml');
    const servers = spyNativeClick('api-mock-export-servers');
    const routes = spyNativeClick('api-mock-export-routes');
    await runAm16NarrowerScopes(ctx);
    expect(yaml).toHaveBeenCalled();
    expect(servers).toHaveBeenCalled();
    expect(routes).toHaveBeenCalled();
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.EXPORT_CONFIRM, AM16_CONFIRM_MS);
  });

  it('runAm16NarrowerScopes skips filename/preview holds when confirm chrome is missing', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountExportChrome({ menu: true });
    const yaml = spyNativeClick('api-mock-export-workspace-yaml');
    await runAm16NarrowerScopes(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.EXPORT_CONFIRM, AM16_CONFIRM_MS);
    expect(yaml).toHaveBeenCalled();
  });

  it('runAm16Redaction holds the callout and the stripped TLS key', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountExportChrome({ menu: true, confirm: true, redaction: true });
    const workspace = spyNativeClick('api-mock-export-workspace');
    await runAm16Redaction(ctx);
    expect(workspace).toHaveBeenCalled();
  });

  it('runAm16WireMock holds the loss report', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountExportChrome({ menu: true, confirm: true, loss: true });
    const wiremock = spyNativeClick('api-mock-export-wiremock');
    await runAm16WireMock(ctx);
    expect(wiremock).toHaveBeenCalled();
  });

  it('runAm16Har holds the entry count', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountExportChrome({ menu: true, confirm: true, har: true });
    const har = spyNativeClick('api-mock-export-har');
    await runAm16Har(ctx);
    expect(har).toHaveBeenCalled();
  });

  it('runAm16RoundTrip uses last export as copy and confirms', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountExportChrome({ confirm: true });
    mountImport({ source: 'curl', lastExport: true, preview: true });
    mountCopies(2);
    await runAm16RoundTrip(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_MODE_COPY);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_LAST_EXPORT);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_PRETTY);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_PARSE);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_CONFIRM);
  });

  it('runAm16CiHandoff holds the footer CLI line', async () => {
    const ctx = makeCtx();
    mountStudio();
    await runAm16CiHandoff(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('ensure guards skip work when the library is already up', async () => {
    const ctx = makeCtx();
    mountStudio();
    await ensureAm16ForNarrower(ctx);
    await ensureAm16ForRedaction(ctx);
    await ensureAm16ForWireMock(ctx);
    await ensureAm16ForHar(ctx);
    expect(importApiMockGallerySample).not.toHaveBeenCalled();
  });

  it('ensureAm16ForRoundTrip skips import when copies already exist', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountCopies(1);
    await ensureAm16ForRoundTrip(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.IMPORT_MENU);
  });

  it('ensureAm16ForRoundTrip closes leftover export confirm without re-opening Export', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountExportChrome({ menu: true, confirm: true, har: true });
    document.body.append(el('button', undefined, 'api-mock-import-menu'));
    const workspace = spyNativeClick('api-mock-export-workspace');
    const exportBtn = spyNativeClick('api-mock-export');
    await ensureAm16ForRoundTrip(ctx);
    expect(workspace).not.toHaveBeenCalled();
    expect(exportBtn).not.toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT_CLOSE);
  });

  it('ensureAm16ForCi quietly round-trips when copies are missing', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountExportChrome({ menu: true, confirm: true });
    mountImport({ source: 'curl', lastExport: true, preview: true });
    await ensureAm16ForCi(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.importSource('native'));
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_MODE_COPY);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_LAST_EXPORT);
  });

  it('ensureAm16ForCi opens Import when the review is closed', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountExportChrome({ menu: true });
    document.body.append(el('button', undefined, 'api-mock-import-menu'));
    await ensureAm16ForCi(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.IMPORT_MENU);
  });

  it('ensureAm16ForRoundTrip skips a new export when last-export is already available', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountImport({ lastExport: true });
    await ensureAm16ForRoundTrip(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.EXPORT_WORKSPACE);
  });

  it('ensureAm16Library does not seed when re-import fails', async () => {
    const ctx = makeCtx();
    importApiMockGallerySample.mockResolvedValueOnce(false);
    document.body.append(el('div', undefined, 'api-mock-server-bar'));
    document.body.append(el('button', undefined, 'api-mock-view-studio'));
    await ensureAm16Library(ctx);
    expect(seedApiMockExportSecrets).not.toHaveBeenCalled();
  });

  it('openAm16ExportMenu no-ops when Export is missing', async () => {
    const ctx = makeCtx();
    mountStudio();
    await runAm16ExportMenu(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.EXPORT);
  });

  it('runAm16CiHandoff still pays off when the footer is missing', async () => {
    const ctx = makeCtx();
    mountStudio();
    document.querySelector('[data-testid="api-mock-routes-footer"]')?.remove();
    await runAm16CiHandoff(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('runAm16Redaction and WireMock skip optional holds when those nodes are missing', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountExportChrome({ menu: true, confirm: true });
    const workspace = spyNativeClick('api-mock-export-workspace');
    const wiremock = spyNativeClick('api-mock-export-wiremock');
    await runAm16Redaction(ctx);
    await runAm16WireMock(ctx);
    expect(workspace).toHaveBeenCalled();
    expect(wiremock).toHaveBeenCalled();
  });

  it('ensureAm16ForCi skips when copies already exist', async () => {
    const ctx = makeCtx();
    mountStudio();
    mountCopies(3);
    await ensureAm16ForCi(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.IMPORT_CONFIRM);
  });

  it('ensureAm16StudioView no-ops when the explorer is already visible', async () => {
    const ctx = makeCtx();
    mountStudio();
    await ensureAm16StudioView(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('closeAm16Export can close quietly and skip a missing Close control', async () => {
    const ctx = makeCtx();
    mountExportChrome({ confirm: true });
    document.querySelector('[data-testid="api-mock-export-close"]')?.remove();
    await closeAm16Export(ctx, false);
    expect(ctx.click).not.toHaveBeenCalled();
    const confirm = el('div', undefined, 'api-mock-export-confirm');
    confirm.append(el('button', undefined, 'api-mock-export-close'));
    document.body.append(confirm);
    await closeAm16Export(ctx, false);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT_CLOSE);
  });

  it('runAm16RoundTrip no-ops when Import is missing', async () => {
    const ctx = makeCtx();
    mountStudio();
    await runAm16RoundTrip(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.IMPORT_MENU);
  });

  it('retries opening Export when a narrower-scope menu item is missing', async () => {
    const ctx = makeCtx();
    mountStudio();
    document.body.append(el('button', undefined, 'api-mock-export'));
    await runAm16NarrowerScopes(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT);
    expect(ctx.waitFor).toHaveBeenCalledWith(API_MOCK.EXPORT_MENU, 3_000);
    expect(ctx.waitFor).not.toHaveBeenCalledWith(API_MOCK.EXPORT_CONFIRM, AM16_CONFIRM_MS);
  });

  it('runAm16ExportMenu skips the workspace click when the menu item is missing', async () => {
    const ctx = makeCtx();
    mountStudio();
    document.body.append(el('button', undefined, 'api-mock-export'));
    await runAm16ExportMenu(ctx);
    expect(ctx.click).toHaveBeenCalledWith(API_MOCK.EXPORT);
    expect(ctx.click).not.toHaveBeenCalledWith(API_MOCK.EXPORT_WORKSPACE);
  });

  it('treats the empty studio view as active', () => {
    document.body.append(el('div', undefined, 'api-mock-empty'));
    expect(isAm16StudioViewActive()).toBe(true);
  });
});
