/**
 * AM-20 `am-20-tls-mtls` helpers — HTTPS, HTTP/2 & mTLS with Cert-Subject Matching.
 *
 * Quiet corpus is the health-check gallery: one plaintext server, one rule.
 * TLS, mTLS, and the cert-subject condition are authored in the UI. Companion
 * required — Start + a live HTTPS fetch is the proof. No Docker.
 */
import {
  importApiMockGallerySample,
  patchApiMockActiveRoute,
  prepareApiMockStudioChrome,
  sendApiMockRequest,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK, APP } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  fillBeat,
  revealBeat,
  reviewAndRunSimulation,
  closeSimulateWorkspace,
  selectBeat,
  spotlightBeat,
  ensureAdHocSimulateForm,
} from './api-mock-demo-helpers';

export const AM20_TIMING = {
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
  beforeRun: 2400,
  /** PEM / client-bundle fill after Generate — curriculum 2000ms. */
  generate: 2000,
  /** Keep the HTTPS-to-HTTP/2 transition brisk after the scheme is visible. */
  httpsTransition: 350,
  http2Highlight: 1800,
} as const;

const T = AM20_TIMING;
const REVEAL_MS = 8_000;
const PEM_POLLS = 80;

export const AM20_CORPUS_SAMPLE = 'am-gallery-health';
export const AM20_HEALTH = '/health';
export const AM20_CN = 'acme-client';
export const AM20_CERT_SUBJECT = `CN=${AM20_CN}`;
export const AM20_CERT_SUBJECT_WRONG = 'CN=wrong-client';
export const AM20_CERT_FACET = 'certSubject';

const CONDITION_TESTID_PREFIX = 'api-mock-condition-';
const CERT_PREDICATE_ID = 'pred-am20-cert';
const CERT_GROUP_ID = 'grp-am20-root';

async function am20Click(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.look, hold });
}

/** Long ring on a *new* tab or modal trigger — never the step's reading highlight. */
async function am20Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

/** Click without a second ring — reading already spotlighted this control. */
async function am20ClickNow(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await ctx.click(selector);
  await ctx.delay(hold);
}

async function am20AimFill(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await fillBeat(ctx, selector, value, { look: T.beforeOpen, hold });
}

async function am20AimSelect(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await selectBeat(ctx, selector, value, { look: T.beforeOpen, hold });
}

async function am20Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
  timeout: number = REVEAL_MS,
): Promise<void> {
  await revealBeat(ctx, selector, { hold, timeout });
}

async function am20Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am20Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am20Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

async function waitForIncludes(
  ctx: DemoActionContext,
  selector: string,
  needle: string,
  attempts: number = PEM_POLLS,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    if (am20InputValue(selector).includes(needle)) return true;
    await ctx.delay(100);
  }
  return am20InputValue(selector).includes(needle);
}

// ── Probes ──────────────────────────────────────────────────────────────────

export function isAm20StudioViewActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function hasAm20Server(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SERVER_BAR));
}

export function hasAm20Library(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SERVER_BAR) && firstVisibleElement(API_MOCK.ROUTE_ROW));
}

export function isAm20ServerRunning(): boolean {
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

export function isAm20ToggleOn(selector: string): boolean {
  return firstVisibleElement(selector)?.getAttribute('aria-checked') === 'true';
}

export function am20InputValue(selector: string): string {
  const el = firstVisibleElement<HTMLInputElement | HTMLTextAreaElement>(selector);
  return typeof el?.value === 'string' ? el.value : '';
}

export function isAm20SettingsOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SETTINGS_MODAL));
}

export function isAm20TlsPanelOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SETTINGS_PANEL_TLS) ?? firstVisibleElement(API_MOCK.SETTINGS_TLS_ENABLED));
}

export function isAm20TlsOn(): boolean {
  return isAm20ToggleOn(API_MOCK.SETTINGS_TLS_ENABLED);
}

export function hasAm20TlsPem(): boolean {
  return am20InputValue(API_MOCK.SETTINGS_TLS_CERT).includes('BEGIN CERTIFICATE');
}

export function isAm20MtlsOn(): boolean {
  return isAm20ToggleOn(API_MOCK.SETTINGS_MTLS_ENABLED);
}

export function hasAm20MtlsIssued(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SETTINGS_MTLS_ISSUED));
}

export function hasAm20Http2Badge(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.HTTP2_BADGE));
}

export function am20AddressText(): string {
  return firstVisibleElement(API_MOCK.ADDRESS)?.textContent?.trim() ?? '';
}

export function isAm20HttpsAddress(): boolean {
  return am20AddressText().includes('https://');
}

export function hasAm20Traffic(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW));
}

export function isAm20SimulateOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.SIMULATE_WORKSPACE));
}

export function isAm20ExportConfirmOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.EXPORT_CONFIRM));
}

export function isAm20ExportMenuOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.EXPORT_MENU));
}

export function am20SimOutcome(): string {
  return firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)?.textContent?.trim() ?? '';
}

export function am20ConditionRows(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    `.am-matcher-row[data-testid^="${CONDITION_TESTID_PREFIX}"]`,
  ));
}

export function am20ConditionIds(root: ParentNode = document): string[] {
  return am20ConditionRows(root)
    .map(row => row.getAttribute('data-testid') ?? '')
    .filter(id => id.startsWith(CONDITION_TESTID_PREFIX))
    .map(id => id.slice(CONDITION_TESTID_PREFIX.length));
}

export function am20ConditionSource(id: string): string {
  return document.querySelector(API_MOCK.conditionSource(id))?.getAttribute('data-value') ?? '';
}

export function am20ConditionKey(id: string): string {
  const el = document.querySelector<HTMLElement>(API_MOCK.conditionSelector(id));
  if (!el) return '';
  if (el instanceof HTMLInputElement) return el.value;
  return el.getAttribute('data-value') ?? '';
}

export function am20ConditionValue(id: string): string {
  return document.querySelector<HTMLInputElement>(API_MOCK.conditionValue(id))?.value ?? '';
}

export function am20FindCertCondition(): string | null {
  return am20ConditionIds().find(
    id => am20ConditionSource(id) === 'security' && am20ConditionKey(id) === AM20_CERT_FACET,
  ) ?? null;
}

export function hasAm20CertPredicate(): boolean {
  const id = am20FindCertCondition();
  return Boolean(id && am20ConditionValue(id).includes(AM20_CN));
}

// ── Boot / cleanup ──────────────────────────────────────────────────────────

export async function prepareAm20Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  prepareApiMockStudioChrome();
  const imported = await importApiMockGallerySample(AM20_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-20: failed to import ${AM20_CORPUS_SAMPLE}`);
  }
}

export async function cleanupAm20(): Promise<void> {
  await wipeApiMockWorkspace();
}

// ── Quiet primitives ────────────────────────────────────────────────────────

export async function ensureAm20OnApiMock(ctx: DemoActionContext): Promise<void> {
  if (hasAm20Server() || firstVisibleElement(API_MOCK.STUDIO) || firstVisibleElement(API_MOCK.RUNTIME_PAGE)) {
    return;
  }
  if (firstVisibleElement(APP.AB_PROTOCOLS)) {
    await ctx.click(APP.AB_PROTOCOLS);
  }
  if (firstVisibleElement(API_MOCK.APP_SUBNAV)) {
    await ctx.click(API_MOCK.APP_SUBNAV);
    await ctx.delay(200);
    return;
  }
  ctx.navigateToTab('api-mock-studio');
  await ctx.delay(200);
}

export async function ensureAm20StudioView(ctx: DemoActionContext): Promise<void> {
  await ensureAm20OnApiMock(ctx);
  if (isAm20StudioViewActive()) return;
  if (!firstVisibleElement(API_MOCK.VIEW_STUDIO)) return;
  await ctx.click(API_MOCK.VIEW_STUDIO);
  await ctx.waitFor(API_MOCK.ROUTE_EXPLORER, 10_000);
}

export async function ensureAm20Library(ctx: DemoActionContext): Promise<void> {
  prepareApiMockStudioChrome();
  await ensureAm20StudioView(ctx);
  if (hasAm20Library()) return;
  const imported = await importApiMockGallerySample(AM20_CORPUS_SAMPLE);
  if (imported) await ctx.waitFor(API_MOCK.ROUTE_ROW, 10_000);
}

export async function closeAm20SettingsModal(ctx: DemoActionContext): Promise<void> {
  if (!isAm20SettingsOpen()) return;
  if (firstVisibleElement(API_MOCK.SETTINGS_CANCEL)) {
    await ctx.click(API_MOCK.SETTINGS_CANCEL);
    await ctx.delay(200);
    return;
  }
  if (firstVisibleElement(API_MOCK.SETTINGS_SAVE)) {
    await ctx.click(API_MOCK.SETTINGS_SAVE);
    await ctx.delay(200);
  }
}

export async function closeAm20Simulate(ctx: DemoActionContext, opts: { review?: boolean } = {}): Promise<void> {
  if (!isAm20SimulateOpen()) return;
  await closeSimulateWorkspace(ctx, { ...opts, afterClose: 200 });
}

export async function closeAm20Export(ctx: DemoActionContext): Promise<void> {
  if (isAm20ExportConfirmOpen() && firstVisibleElement(API_MOCK.EXPORT_CLOSE)) {
    await ctx.click(API_MOCK.EXPORT_CLOSE);
    await ctx.delay(200);
  }
}

async function openTlsSettings(ctx: DemoActionContext): Promise<void> {
  await ensureAm20OnApiMock(ctx);
  if (!isAm20SettingsOpen()) {
    if (!firstVisibleElement(API_MOCK.SETTINGS)) return;
    await ctx.click(API_MOCK.SETTINGS);
    await ctx.waitFor(API_MOCK.SETTINGS_MODAL, REVEAL_MS).catch(() => undefined);
  }
  if (isAm20TlsPanelOpen()) return;
  if (!firstVisibleElement(API_MOCK.SETTINGS_TAB_TLS)) return;
  await ctx.click(API_MOCK.SETTINGS_TAB_TLS);
  await ctx.waitFor(API_MOCK.SETTINGS_TLS_ENABLED, REVEAL_MS).catch(() => undefined);
}

async function quietSaveSettings(ctx: DemoActionContext): Promise<void> {
  if (!firstVisibleElement(API_MOCK.SETTINGS_SAVE)) return;
  await ctx.click(API_MOCK.SETTINGS_SAVE);
  await ctx.delay(200);
}

async function quietGenerateTls(ctx: DemoActionContext): Promise<void> {
  await openTlsSettings(ctx);
  if (!firstVisibleElement(API_MOCK.SETTINGS_TLS_ENABLED)) return;
  if (!isAm20TlsOn()) await ctx.click(API_MOCK.SETTINGS_TLS_ENABLED);
  if (!hasAm20TlsPem() && firstVisibleElement(API_MOCK.SETTINGS_TLS_GENERATE)) {
    await ctx.click(API_MOCK.SETTINGS_TLS_GENERATE);
    await waitForIncludes(ctx, API_MOCK.SETTINGS_TLS_CERT, 'BEGIN CERTIFICATE');
  }
}

async function quietStart(ctx: DemoActionContext): Promise<void> {
  if (isAm20ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, REVEAL_MS).catch(() => undefined);
}

async function quietTlsLive(ctx: DemoActionContext): Promise<void> {
  await quietGenerateTls(ctx);
  await quietSaveSettings(ctx);
  await quietStart(ctx);
}

async function quietMtls(ctx: DemoActionContext): Promise<void> {
  await openTlsSettings(ctx);
  if (!hasAm20TlsPem()) await quietGenerateTls(ctx);
  if (!firstVisibleElement(API_MOCK.SETTINGS_MTLS_ENABLED)) return;
  if (!isAm20MtlsOn()) await ctx.click(API_MOCK.SETTINGS_MTLS_ENABLED);
  if (am20InputValue(API_MOCK.SETTINGS_MTLS_CN) !== AM20_CN) {
    await ctx.fill(API_MOCK.SETTINGS_MTLS_CN, AM20_CN);
  }
  if (!hasAm20MtlsIssued() && firstVisibleElement(API_MOCK.SETTINGS_MTLS_GENERATE)) {
    await ctx.click(API_MOCK.SETTINGS_MTLS_GENERATE);
    for (let i = 0; i < PEM_POLLS && !hasAm20MtlsIssued(); i++) await ctx.delay(100);
  }
  await quietSaveSettings(ctx);
  if (firstVisibleElement(API_MOCK.RESTART) && isAm20ServerRunning()) {
    await ctx.click(API_MOCK.RESTART);
    await ctx.delay(400);
    return;
  }
  await quietStart(ctx);
}

async function quietCertPredicate(ctx: DemoActionContext): Promise<void> {
  if (hasAm20CertPredicate()) return;
  const applied = patchApiMockActiveRoute({
    predicates: {
      id: CERT_GROUP_ID,
      combinator: 'all',
      children: [{
        id: CERT_PREDICATE_ID,
        source: 'security',
        selector: AM20_CERT_FACET,
        operator: 'exact',
        expected: AM20_CERT_SUBJECT,
      }],
    },
  });
  if (applied) {
    await ctx.delay(200);
    return;
  }
  await ensureMatchTab(ctx, false);
  const id = await addOrReuseCertCondition(ctx, false);
  if (!id) return;
  await ctx.selectOption(API_MOCK.conditionSource(id), 'security');
  await ctx.selectOption(API_MOCK.conditionSelector(id), AM20_CERT_FACET);
  await ctx.fill(API_MOCK.conditionValue(id), AM20_CERT_SUBJECT);
}

async function ensureMatchTab(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm20StudioView(ctx);
  if (firstVisibleElement(API_MOCK.ADD_CONDITION)) return;
  if (!firstVisibleElement(API_MOCK.BTAB_MATCH)) return;
  if (visible) await am20Aim(ctx, API_MOCK.BTAB_MATCH, T.tabSwitch);
  else await ctx.click(API_MOCK.BTAB_MATCH);
  if (visible) await am20Reveal(ctx, API_MOCK.ADD_CONDITION, T.tabSwitch);
  else await ctx.waitFor(API_MOCK.ADD_CONDITION, REVEAL_MS).catch(() => undefined);
}

async function addOrReuseCertCondition(
  ctx: DemoActionContext,
  visible: boolean,
): Promise<string | null> {
  const existing = am20FindCertCondition();
  if (existing) {
    if (visible) await am20Look(ctx, API_MOCK.conditionRow(existing));
    return existing;
  }
  const before = am20ConditionIds();
  if (!firstVisibleElement(API_MOCK.ADD_CONDITION)) return null;
  if (visible) await am20ClickNow(ctx, API_MOCK.ADD_CONDITION, T.panelReady);
  else await ctx.click(API_MOCK.ADD_CONDITION);
  if (am20ConditionIds().length === before.length) await ctx.delay(T.panelReady);
  return am20ConditionIds().find(id => !before.includes(id)) ?? null;
}

function journalRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(API_MOCK.JOURNAL_FIRST_ROW));
}

function rowSelector(row: HTMLElement | undefined): string | undefined {
  const id = row?.getAttribute('data-testid');
  return id ? `[data-testid="${id}"]` : undefined;
}

async function openJournal(ctx: DemoActionContext): Promise<void> {
  await ensureAm20OnApiMock(ctx);
  if (firstVisibleElement(API_MOCK.JOURNAL_TOOLBAR) || firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    return;
  }
  if (firstVisibleElement(API_MOCK.LIVE_TRANSACTIONS)) {
    await am20Aim(ctx, API_MOCK.LIVE_TRANSACTIONS, T.tabSwitch);
  }
}

async function clickNewestJournalRow(ctx: DemoActionContext): Promise<void> {
  const row = journalRows()[0];
  const selector = rowSelector(row) ?? API_MOCK.JOURNAL_FIRST_ROW;
  if (!firstVisibleElement(selector)) return;
  await am20Click(ctx, selector, T.fieldFilled);
  if (firstVisibleElement(API_MOCK.TX_DETAIL)) {
    await am20Reveal(ctx, API_MOCK.TX_DETAIL, T.payoff);
  }
}

async function openSimulate(ctx: DemoActionContext): Promise<void> {
  if (isAm20SimulateOpen()) return;
  if (!firstVisibleElement(API_MOCK.SIMULATE)) return;
  await am20ClickNow(ctx, API_MOCK.SIMULATE, T.panelReady);
  await am20Reveal(ctx, API_MOCK.SIMULATE_WORKSPACE, T.panelReady);
}

async function runCertSimulation(
  ctx: DemoActionContext,
  subject: string,
  opts: { digest?: boolean } = {},
): Promise<string> {
  await ensureAdHocSimulateForm(ctx, T.tabSwitch, T.fieldFilled);
  if (am20InputValue(API_MOCK.SIMULATE_PATH) !== AM20_HEALTH) {
    await am20AimFill(ctx, API_MOCK.SIMULATE_PATH, AM20_HEALTH);
  }
  if (firstVisibleElement(API_MOCK.SIMULATE_CERT_SUBJECT)) {
    await am20AimFill(ctx, API_MOCK.SIMULATE_CERT_SUBJECT, subject);
  }
  await reviewAndRunSimulation(ctx, {
    review: T.look,
    beforeRun: T.beforeRun,
    controlHold: T.fieldFilled,
    digest: opts.digest,
    sampleName: subject === AM20_CERT_SUBJECT
      ? `GET ${AM20_HEALTH} — cert match`
      : `GET ${AM20_HEALTH} — cert miss`,
  });
  if (firstVisibleElement(API_MOCK.SIMULATE_RESULT)) {
    await am20Reveal(ctx, API_MOCK.SIMULATE_RESULT, T.panelReady);
  }
  if (firstVisibleElement(API_MOCK.SIMULATE_OUTCOME)) {
    await spotlightBeat(ctx, API_MOCK.SIMULATE_OUTCOME, T.simOutcome);
  }
  return am20SimOutcome();
}

// ── Guards ──────────────────────────────────────────────────────────────────

export async function ensureAm20ForInspect(ctx: DemoActionContext): Promise<void> {
  await ensureAm20Library(ctx);
  await closeAm20Simulate(ctx);
  await closeAm20Export(ctx);
  await quietGenerateTls(ctx);
  await openTlsSettings(ctx);
}

export async function ensureAm20ForHttpsLive(ctx: DemoActionContext): Promise<void> {
  await ensureAm20ForInspect(ctx);
}

export async function ensureAm20ForProveHttps(ctx: DemoActionContext): Promise<void> {
  await ensureAm20Library(ctx);
  await closeAm20Simulate(ctx);
  await closeAm20Export(ctx);
  await quietTlsLive(ctx);
}

export async function ensureAm20ForMtls(ctx: DemoActionContext): Promise<void> {
  await ensureAm20ForProveHttps(ctx);
  await openTlsSettings(ctx);
}

export async function ensureAm20ForCertPredicate(ctx: DemoActionContext): Promise<void> {
  await ensureAm20Library(ctx);
  await closeAm20Simulate(ctx);
  await closeAm20Export(ctx);
  await quietTlsLive(ctx);
  await quietMtls(ctx);
  await closeAm20SettingsModal(ctx);
  await ensureMatchTab(ctx, false);
}

export async function ensureAm20ForProveCert(ctx: DemoActionContext): Promise<void> {
  await ensureAm20ForCertPredicate(ctx);
  await quietCertPredicate(ctx);
  await closeAm20SettingsModal(ctx);
}

export async function ensureAm20ForRedaction(ctx: DemoActionContext): Promise<void> {
  await ensureAm20ForProveCert(ctx);
  await closeAm20Simulate(ctx);
  await closeAm20SettingsModal(ctx);
  await closeAm20Export(ctx);
}

// ── Visible steps ───────────────────────────────────────────────────────────

/** Step 1 — Settings → TLS → enable → Generate, then hold the PEMs. */
export async function runAm20GenerateTls(ctx: DemoActionContext): Promise<void> {
  await ensureAm20Library(ctx);
  if (!isAm20SettingsOpen()) {
    if (!firstVisibleElement(API_MOCK.SETTINGS)) return;
    await am20ClickNow(ctx, API_MOCK.SETTINGS, T.panelReady);
    await am20Reveal(ctx, API_MOCK.SETTINGS_MODAL, T.panelReady);
  }
  if (!isAm20TlsPanelOpen() && firstVisibleElement(API_MOCK.SETTINGS_TAB_TLS)) {
    await am20Aim(ctx, API_MOCK.SETTINGS_TAB_TLS, T.tabSwitch);
    await am20Reveal(ctx, API_MOCK.SETTINGS_TLS_ENABLED, T.tabSwitch);
  }
  if (!firstVisibleElement(API_MOCK.SETTINGS_TLS_ENABLED)) return;
  if (!isAm20TlsOn()) {
    await am20Aim(ctx, API_MOCK.SETTINGS_TLS_ENABLED, T.fieldFilled);
  } else {
    await am20Look(ctx, API_MOCK.SETTINGS_TLS_ENABLED);
  }
  await am20Break(ctx);
  if (firstVisibleElement(API_MOCK.SETTINGS_TLS_GENERATE)) {
    await am20Aim(ctx, API_MOCK.SETTINGS_TLS_GENERATE, 0);
    await waitForIncludes(ctx, API_MOCK.SETTINGS_TLS_CERT, 'BEGIN CERTIFICATE');
  }
  if (firstVisibleElement(API_MOCK.SETTINGS_TLS_CERT)) {
    await spotlightBeat(ctx, API_MOCK.SETTINGS_TLS_CERT, T.generate);
  }
}

/** Step 2 — read the public cert, then the private-key redaction note. */
export async function runAm20InspectCert(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.payoff);
  if (firstVisibleElement(API_MOCK.SETTINGS_TLS_KEY)) {
    await am20Payoff(ctx, API_MOCK.SETTINGS_TLS_KEY);
  }
}

/** Step 3 — Save, Start, hold the https:// listen URL, then HTTP/2. */
export async function runAm20HttpsLive(ctx: DemoActionContext): Promise<void> {
  if (firstVisibleElement(API_MOCK.SETTINGS_SAVE)) {
    await am20ClickNow(ctx, API_MOCK.SETTINGS_SAVE, T.httpsTransition);
  }
  // Save closes the modal — wait until the server bar is free to read.
  for (let i = 0; i < 20 && isAm20SettingsOpen(); i++) await ctx.delay(100);
  if (!isAm20ServerRunning() && firstVisibleElement(API_MOCK.START)) {
    await clickBeat(ctx, API_MOCK.START, { look: T.httpsTransition, hold: T.httpsTransition });
    await am20Reveal(ctx, API_MOCK.STOP, T.httpsTransition);
  }
  // Scheme flip is the teaching beat — wait for https:// then ring Running + URL.
  for (let i = 0; i < 30 && !isAm20HttpsAddress(); i++) await ctx.delay(100);
  const listen = firstVisibleElement(API_MOCK.LISTEN_URL)
    ? API_MOCK.LISTEN_URL
    : API_MOCK.ADDRESS;
  if (firstVisibleElement(listen) || firstVisibleElement(API_MOCK.ADDRESS)) {
    await am20Reveal(ctx, listen, T.httpsTransition);
  }
  await ctx.delay(T.httpsTransition);
  if (firstVisibleElement(API_MOCK.HTTP2_BADGE)) {
    await spotlightBeat(ctx, API_MOCK.HTTP2_BADGE, T.http2Highlight);
  }
}

/** Step 4 — live GET /health over TLS, then the 200 journal row. */
export async function runAm20ProveHttps(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.look);
  await sendApiMockRequest({ path: AM20_HEALTH, method: 'GET' });
  await ctx.delay(T.journalWrite);
  await openJournal(ctx);
  await clickNewestJournalRow(ctx);
  if (firstVisibleElement(API_MOCK.TX_RESPONSE_STATUS)) {
    await am20Payoff(ctx, API_MOCK.TX_RESPONSE_STATUS);
  } else if (firstVisibleElement(API_MOCK.TX_RESPONSE)) {
    await am20Payoff(ctx, API_MOCK.TX_RESPONSE);
  }
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    await am20Look(ctx, API_MOCK.JOURNAL_FIRST_ROW);
  }
}

/** Step 5 — require a client cert, issue a named bundle, Save, Restart. */
export async function runAm20Mtls(ctx: DemoActionContext): Promise<void> {
  await openTlsSettings(ctx);
  if (!firstVisibleElement(API_MOCK.SETTINGS_MTLS_ENABLED)) return;
  if (!isAm20MtlsOn()) {
    await am20ClickNow(ctx, API_MOCK.SETTINGS_MTLS_ENABLED, T.fieldFilled);
  } else {
    await ctx.delay(T.look);
  }
  await am20Look(ctx, API_MOCK.SETTINGS_MTLS_ENABLED);
  if (firstVisibleElement(API_MOCK.SETTINGS_MTLS_CN)
    && am20InputValue(API_MOCK.SETTINGS_MTLS_CN) !== AM20_CN) {
    await am20AimFill(ctx, API_MOCK.SETTINGS_MTLS_CN, AM20_CN);
  }
  await am20Break(ctx);
  if (firstVisibleElement(API_MOCK.SETTINGS_MTLS_GENERATE)) {
    await am20Aim(ctx, API_MOCK.SETTINGS_MTLS_GENERATE, 0);
    for (let i = 0; i < PEM_POLLS && !hasAm20MtlsIssued(); i++) await ctx.delay(100);
  }
  if (firstVisibleElement(API_MOCK.SETTINGS_MTLS_ISSUED)) {
    await spotlightBeat(ctx, API_MOCK.SETTINGS_MTLS_ISSUED, T.generate);
  }
  if (firstVisibleElement(API_MOCK.SETTINGS_MTLS_DOWNLOAD_CERT)) {
    await am20Look(ctx, API_MOCK.SETTINGS_MTLS_DOWNLOAD_CERT);
  }
  if (firstVisibleElement(API_MOCK.SETTINGS_SAVE)) {
    await am20Aim(ctx, API_MOCK.SETTINGS_SAVE, T.lifecycle);
  }
  if (firstVisibleElement(API_MOCK.RESTART)) {
    await am20Aim(ctx, API_MOCK.RESTART, T.lifecycle);
  } else if (!isAm20ServerRunning() && firstVisibleElement(API_MOCK.START)) {
    await am20Aim(ctx, API_MOCK.START, T.lifecycle);
  }
}

/** Step 6 — security source → certSubject → expected CN. */
export async function runAm20CertPredicate(ctx: DemoActionContext): Promise<void> {
  await closeAm20SettingsModal(ctx);
  await ensureMatchTab(ctx, true);
  const id = await addOrReuseCertCondition(ctx, true);
  if (!id) return;
  await am20AimSelect(ctx, API_MOCK.conditionSource(id), 'security', T.payoff);
  await am20Reveal(ctx, API_MOCK.conditionSelector(id), T.fieldFilled);
  await am20Break(ctx);
  await am20AimSelect(ctx, API_MOCK.conditionSelector(id), AM20_CERT_FACET, T.payoff);
  await am20AimFill(ctx, API_MOCK.conditionValue(id), AM20_CERT_SUBJECT, T.payoff);
  await am20Payoff(ctx, API_MOCK.conditionRow(id));
}

/** Step 7 — Simulate the pinned CN (matched) then a wrong CN (unmatched). */
export async function runAm20ProveCertMatch(ctx: DemoActionContext): Promise<string[]> {
  await closeAm20SettingsModal(ctx);
  await openSimulate(ctx);
  const outcomes: string[] = [];
  outcomes.push(await runCertSimulation(ctx, AM20_CERT_SUBJECT, { digest: false }));
  await am20Break(ctx);
  outcomes.push(await runCertSimulation(ctx, AM20_CERT_SUBJECT_WRONG));
  return outcomes;
}

/** Step 8 — export strips the private key; stop; keys stay local. */
export async function runAm20RedactionParity(ctx: DemoActionContext): Promise<void> {
  await closeAm20Simulate(ctx);
  await closeAm20SettingsModal(ctx);
  if (!isAm20ExportMenuOpen() && firstVisibleElement(API_MOCK.EXPORT)) {
    await am20ClickNow(ctx, API_MOCK.EXPORT, T.panelReady);
    await am20Reveal(ctx, API_MOCK.EXPORT_MENU, T.panelReady);
  }
  if (firstVisibleElement(API_MOCK.EXPORT_WORKSPACE)) {
    await am20Aim(ctx, API_MOCK.EXPORT_WORKSPACE, T.payoff);
    await am20Reveal(ctx, API_MOCK.EXPORT_CONFIRM, T.payoff);
  }
  if (firstVisibleElement(API_MOCK.EXPORT_REDACTION)) {
    await am20Payoff(ctx, API_MOCK.EXPORT_REDACTION);
  }
  if (firstVisibleElement(API_MOCK.EXPORT_TLS_KEY)) {
    await am20Payoff(ctx, API_MOCK.EXPORT_TLS_KEY);
  }
  await closeAm20Export(ctx);
  if (firstVisibleElement(API_MOCK.NATIVE_WARNINGS)) {
    await am20Look(ctx, API_MOCK.NATIVE_WARNINGS);
  }
  if (firstVisibleElement(API_MOCK.STOP)) {
    await am20Aim(ctx, API_MOCK.STOP, T.lifecycle);
  }
  if (firstVisibleElement(API_MOCK.SETTINGS)) {
    await am20Aim(ctx, API_MOCK.SETTINGS, T.panelReady);
    await am20Reveal(ctx, API_MOCK.SETTINGS_MODAL, T.panelReady);
  }
  if (!isAm20TlsPanelOpen() && firstVisibleElement(API_MOCK.SETTINGS_TAB_TLS)) {
    await am20Aim(ctx, API_MOCK.SETTINGS_TAB_TLS, T.tabSwitch);
    await am20Reveal(ctx, API_MOCK.SETTINGS_TLS_CERT, T.panelReady);
  }
  if (firstVisibleElement(API_MOCK.SETTINGS_TLS_CERT)) {
    await am20Payoff(ctx, API_MOCK.SETTINGS_TLS_CERT);
  }
  if (firstVisibleElement(API_MOCK.SETTINGS_TLS_KEY)) {
    await am20Payoff(ctx, API_MOCK.SETTINGS_TLS_KEY);
  }
}
