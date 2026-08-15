/**
 * AM-16 `am-16-export` helpers — Export & Round-Trip: JSON/YAML, WireMock, HAR, Redaction.
 *
 * Quiet corpus is the store library plus a TLS private key and a sensitive
 * variable so redaction has something to strip. Every export and the re-import
 * are authored live. Offline — the listener never starts.
 */
import {
  importApiMockGallerySample,
  prepareApiMockStudioChrome,
  seedApiMockExportSecrets,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  prettyFormatImportPaste,
  spotlightBeat,
  spotlightElementBeat,
} from './api-mock-demo-helpers';

export const AM16_TIMING = {
  look: 900,
  fieldFilled: 850,
  tabSwitch: 1100,
  panelReady: 1000,
  payoff: 1600,
  groupBreak: 1200,
  beforeOpen: 1400,
  lifecycle: 1600,
  journalWrite: 1400,
  simOutcome: 1800,
  beforeRun: 2000,
} as const;

const T = AM16_TIMING;
/** Cap silent waitFor — the shared reveal default is 20s and does not throw. */
export const AM16_REVEAL_MS = 8_000;
/** Export confirm is a sync React setState after the menu click — do not burn 8s. */
export const AM16_CONFIRM_MS = 3_000;

export const AM16_CORPUS_SAMPLE = 'am-gallery-store';
export const AM16_TLS_REDACTED = '***REDACTED***';
export const AM16_SECRET_REDACTED = '[REDACTED]';
export const AM16_CLI = 'redfireforge mock simulate workspace.json';

async function am16Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

/** Click without a beforeOpen re-ring — the step highlight is already on this control. */
async function am16ClickNow(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await ctx.click(selector);
  await ctx.delay(hold);
}

async function am16Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am16Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
): Promise<void> {
  await ctx.waitFor(selector, AM16_REVEAL_MS);
  if (!document.querySelector(selector)) return;
  await ctx.delay(hold);
}

async function am16Look(ctx: DemoActionContext, selector: string): Promise<void> {
  if (!firstVisibleElement(selector)) return;
  await spotlightBeat(ctx, selector, T.look);
}

async function am16Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  if (!firstVisibleElement(selector)) return;
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am16Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

// ── Probes ──────────────────────────────────────────────────────────────────

export function hasAm16Library(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SERVER_BAR) && firstVisibleElement(API_MOCK.ROUTE_ROW));
}

export function isAm16StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function isAm16ExportMenuOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.EXPORT_MENU));
}

export function isAm16ExportConfirmOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.EXPORT_CONFIRM));
}

export function isAm16ImportOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.IMPORT_REVIEW));
}

export function isAm16RedactionVisible(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.EXPORT_REDACTION));
}

export function am16TlsKeyText(): string {
  return firstVisibleElement(API_MOCK.EXPORT_TLS_KEY)?.textContent?.trim() ?? '';
}

export function am16HarCountText(): string {
  return firstVisibleElement(API_MOCK.EXPORT_HAR_COUNT)?.textContent?.trim() ?? '';
}

export function am16CopiedRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.COPIED_ROUTE));
}

export function am16CopiedCount(): number {
  return am16CopiedRows().length;
}

export function hasAm16Copies(): boolean {
  return am16CopiedCount() >= 1;
}

export function hasAm16LastExport(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.IMPORT_LAST_EXPORT));
}

export function isAm16SourceActive(id: string): boolean {
  return firstVisibleElement(API_MOCK.importSource(id))?.classList.contains('active') === true;
}

export function isAm16CopyModeActive(): boolean {
  return firstVisibleElement(API_MOCK.IMPORT_MODE_COPY)?.classList.contains('active') === true;
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

export async function prepareAm16Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  prepareApiMockStudioChrome();
  const imported = await importApiMockGallerySample(AM16_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-16: failed to import ${AM16_CORPUS_SAMPLE}`);
  }
  const seeded = await seedApiMockExportSecrets();
  if (!seeded) {
    throw new Error('AM-16: failed to seed TLS key and sensitive variable');
  }
}

export async function cleanupAm16(): Promise<void> {
  await wipeApiMockWorkspace();
}

export async function ensureAm16StudioView(ctx: DemoActionContext): Promise<void> {
  if (isAm16StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 10_000);
}

export async function ensureAm16Library(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm16StudioView(ctx);
  if (hasAm16Library()) return;
  const imported = await importApiMockGallerySample(AM16_CORPUS_SAMPLE);
  if (imported) await seedApiMockExportSecrets();
  await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
}

export async function closeAm16Export(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (!isAm16ExportConfirmOpen()) return;
  if (!firstVisibleElement(API_MOCK.EXPORT_CLOSE)) return;
  if (visible) await am16ClickNow(ctx, API_MOCK.EXPORT_CLOSE, T.panelReady);
  else await ctx.click(API_MOCK.EXPORT_CLOSE);
  await ctx.delay(visible ? 400 : 200);
}

export async function closeAm16Import(ctx: DemoActionContext): Promise<void> {
  if (!isAm16ImportOpen()) return;
  if (!firstVisibleElement(API_MOCK.IMPORT_CLOSE)) return;
  await ctx.click(API_MOCK.IMPORT_CLOSE);
  await ctx.delay(400);
}

/** Immediate click — `ctx.click` waits 560ms for a ripple, and the menu can close in that gap. */
function fireAm16Node(selector: string): boolean {
  const el = firstVisibleElement(selector) ?? document.querySelector<HTMLElement>(selector);
  if (!el) return false;
  el.click();
  return true;
}

async function openAm16ExportMenu(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await closeAm16Import(ctx);
  await closeAm16Export(ctx, visible);
  if (isAm16ExportMenuOpen()) return;
  if (!firstVisibleElement(API_MOCK.EXPORT) && !document.querySelector(API_MOCK.EXPORT)) return;
  if (visible) {
    // Step highlight is already Export — do not re-ring for 1400ms.
    await am16ClickNow(ctx, API_MOCK.EXPORT, T.fieldFilled);
  } else {
    fireAm16Node(API_MOCK.EXPORT);
  }
  await ctx.waitFor(API_MOCK.EXPORT_MENU, 3_000);
}

async function clickAm16ExportItem(
  ctx: DemoActionContext,
  item: string,
  visible: boolean,
): Promise<boolean> {
  if (visible && (firstVisibleElement(item) || document.querySelector(item))) {
    await spotlightBeat(ctx, item, T.look);
  }
  if (fireAm16Node(item)) return true;
  if (!isAm16ExportMenuOpen()) {
    fireAm16Node(API_MOCK.EXPORT);
    await ctx.waitFor(API_MOCK.EXPORT_MENU, 3_000);
  }
  return fireAm16Node(item);
}

async function pickAm16Export(
  ctx: DemoActionContext,
  item: string,
  visible: boolean,
): Promise<void> {
  await openAm16ExportMenu(ctx, visible);
  const clicked = await clickAm16ExportItem(ctx, item, visible);
  if (!clicked) return;
  await ctx.waitFor(API_MOCK.EXPORT_CONFIRM, AM16_CONFIRM_MS);
  if (visible && document.querySelector(API_MOCK.EXPORT_CONFIRM)) {
    await ctx.delay(T.payoff);
  }
}

async function quietWorkspaceExport(ctx: DemoActionContext): Promise<void> {
  if (hasAm16LastExport() || (isAm16ExportConfirmOpen() && firstVisibleElement(API_MOCK.EXPORT_PREVIEW))) {
    await closeAm16Export(ctx, false);
    return;
  }
  await pickAm16Export(ctx, API_MOCK.EXPORT_WORKSPACE, false);
  await closeAm16Export(ctx, false);
}

// ── Guards ──────────────────────────────────────────────────────────────────

export async function ensureAm16ForNarrower(ctx: DemoActionContext): Promise<void> {
  await ensureAm16Library(ctx);
  await closeAm16Import(ctx);
  await closeAm16Export(ctx, false);
}

export async function ensureAm16ForRedaction(ctx: DemoActionContext): Promise<void> {
  await ensureAm16Library(ctx);
  await closeAm16Import(ctx);
  await closeAm16Export(ctx, false);
}

export async function ensureAm16ForWireMock(ctx: DemoActionContext): Promise<void> {
  await ensureAm16Library(ctx);
  await closeAm16Import(ctx);
  await closeAm16Export(ctx, false);
}

export async function ensureAm16ForHar(ctx: DemoActionContext): Promise<void> {
  await ensureAm16Library(ctx);
  await closeAm16Import(ctx);
  await closeAm16Export(ctx, false);
}

export async function ensureAm16ForRoundTrip(ctx: DemoActionContext): Promise<void> {
  await ensureAm16Library(ctx);
  await closeAm16Export(ctx, false);
  if (hasAm16Copies()) {
    await closeAm16Import(ctx);
    return;
  }
  await quietWorkspaceExport(ctx);
}

export async function ensureAm16ForCi(ctx: DemoActionContext): Promise<void> {
  await ensureAm16Library(ctx);
  await closeAm16Export(ctx, false);
  await closeAm16Import(ctx);
  if (hasAm16Copies()) return;
  await quietWorkspaceExport(ctx);
  await quietRoundTrip(ctx);
}

async function quietRoundTrip(ctx: DemoActionContext): Promise<void> {
  if (hasAm16Copies()) return;
  await closeAm16Export(ctx, false);
  if (!isAm16ImportOpen() && firstVisibleElement(API_MOCK.IMPORT_MENU)) {
    await ctx.click(API_MOCK.IMPORT_MENU);
    await ctx.waitFor(API_MOCK.IMPORT_REVIEW, 8_000);
  }
  const native = API_MOCK.importSource('native');
  if (firstVisibleElement(native) && !isAm16SourceActive('native')) {
    await ctx.click(native);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_MODE_COPY) && !isAm16CopyModeActive()) {
    await ctx.click(API_MOCK.IMPORT_MODE_COPY);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_LAST_EXPORT)) {
    await ctx.click(API_MOCK.IMPORT_LAST_EXPORT);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_PARSE)) {
    await ctx.click(API_MOCK.IMPORT_PARSE);
    await ctx.waitFor(API_MOCK.IMPORT_PREVIEW, 8_000);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_CONFIRM)) {
    await ctx.click(API_MOCK.IMPORT_CONFIRM);
    await ctx.delay(400);
  }
}

// ── Visible runs ────────────────────────────────────────────────────────────

export async function runAm16ExportMenu(ctx: DemoActionContext): Promise<void> {
  await openAm16ExportMenu(ctx, true);
  if (firstVisibleElement(API_MOCK.EXPORT_GROUP_WORKSPACE)) {
    await am16Look(ctx, API_MOCK.EXPORT_GROUP_WORKSPACE);
  }
  if (firstVisibleElement(API_MOCK.EXPORT_GROUP_SERVER)) {
    await am16Look(ctx, API_MOCK.EXPORT_GROUP_SERVER);
  }
  if (firstVisibleElement(API_MOCK.EXPORT_GROUP_INTEROP)) {
    await am16Look(ctx, API_MOCK.EXPORT_GROUP_INTEROP);
  }
  const clicked = await clickAm16ExportItem(ctx, API_MOCK.EXPORT_WORKSPACE, true);
  if (clicked) {
    await ctx.waitFor(API_MOCK.EXPORT_CONFIRM, AM16_CONFIRM_MS);
    if (document.querySelector(API_MOCK.EXPORT_CONFIRM)) await ctx.delay(T.payoff);
  }
  await am16Look(ctx, API_MOCK.EXPORT_FILENAME);
  await am16Payoff(ctx, API_MOCK.EXPORT_CONFIRM);
}

export async function runAm16NarrowerScopes(ctx: DemoActionContext): Promise<void> {
  await pickAm16Export(ctx, API_MOCK.EXPORT_WORKSPACE_YAML, true);
  await am16Look(ctx, API_MOCK.EXPORT_FILENAME);
  await am16Break(ctx);
  await pickAm16Export(ctx, API_MOCK.EXPORT_SERVERS, true);
  await am16Look(ctx, API_MOCK.EXPORT_PREVIEW);
  await am16Break(ctx);
  await pickAm16Export(ctx, API_MOCK.EXPORT_ROUTES, true);
}

export async function runAm16Redaction(ctx: DemoActionContext): Promise<void> {
  await pickAm16Export(ctx, API_MOCK.EXPORT_WORKSPACE, true);
  if (firstVisibleElement(API_MOCK.EXPORT_REDACTION)) {
    await am16Look(ctx, API_MOCK.EXPORT_REDACTION);
  }
  if (firstVisibleElement(API_MOCK.EXPORT_TLS_KEY)) {
    await am16Look(ctx, API_MOCK.EXPORT_TLS_KEY);
  }
  if (firstVisibleElement(API_MOCK.EXPORT_SECRET)) {
    await am16Look(ctx, API_MOCK.EXPORT_SECRET);
  }
  await am16Payoff(ctx, API_MOCK.EXPORT_TLS_KEY);
}

export async function runAm16WireMock(ctx: DemoActionContext): Promise<void> {
  await pickAm16Export(ctx, API_MOCK.EXPORT_WIREMOCK, true);
  await am16Look(ctx, API_MOCK.EXPORT_MAPPING_COUNT);
  await am16Reveal(ctx, API_MOCK.EXPORT_LOSS, T.panelReady);
  await am16Payoff(ctx, API_MOCK.EXPORT_LOSS);
}

export async function runAm16Har(ctx: DemoActionContext): Promise<void> {
  await pickAm16Export(ctx, API_MOCK.EXPORT_HAR, true);
  await am16Reveal(ctx, API_MOCK.EXPORT_HAR_COUNT, T.panelReady);
  await am16Payoff(ctx, API_MOCK.EXPORT_HAR_COUNT);
}

export async function runAm16RoundTrip(ctx: DemoActionContext): Promise<void> {
  await closeAm16Export(ctx, true);
  await closeAm16Import(ctx);
  if (!firstVisibleElement(API_MOCK.IMPORT_MENU)) return;
  await am16Aim(ctx, API_MOCK.IMPORT_MENU);
  await am16Reveal(ctx, API_MOCK.IMPORT_REVIEW);
  const native = API_MOCK.importSource('native');
  if (firstVisibleElement(native)) {
    await am16Aim(ctx, native);
  }
  await am16Look(ctx, API_MOCK.IMPORT_MODE_COPY);
  await am16Aim(ctx, API_MOCK.IMPORT_MODE_COPY);
  if (firstVisibleElement(API_MOCK.IMPORT_LAST_EXPORT)) {
    await am16Click(ctx, API_MOCK.IMPORT_LAST_EXPORT, T.payoff);
    await prettyFormatImportPaste(ctx, { look: T.look, hold: T.payoff });
    await am16Look(ctx, API_MOCK.IMPORT_PASTE);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_PARSE)) {
    await am16Click(ctx, API_MOCK.IMPORT_PARSE, T.payoff);
    await am16Reveal(ctx, API_MOCK.IMPORT_PREVIEW, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.IMPORT_CONFIRM)) {
    await am16Click(ctx, API_MOCK.IMPORT_CONFIRM, T.payoff);
  }
  await am16Reveal(ctx, API_MOCK.COPIED_ROUTE, T.payoff);
  const copies = am16CopiedRows().slice(0, 3);
  for (const row of copies) {
    await spotlightElementBeat(ctx, row, T.look);
  }
  await am16Payoff(ctx, API_MOCK.ROUTES_FOOTER);
}

export async function runAm16CiHandoff(ctx: DemoActionContext): Promise<void> {
  await closeAm16Export(ctx, false);
  await closeAm16Import(ctx);
  if (firstVisibleElement(API_MOCK.ROUTES_FOOTER)) {
    await am16Look(ctx, API_MOCK.ROUTES_FOOTER);
  }
  await am16Payoff(ctx, API_MOCK.CLI_SIMULATE);
}
