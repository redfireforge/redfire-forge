/**
 * AM-23 `am-23-harness-ci` helpers — Test Runner Fixtures & CI Handoff.
 *
 * Quiet corpus is the store library plus a small scenario suite. Live beats
 * configure the fixture, isolate the run, execute, then hand the workspace
 * to CI. Companion required — the fixture binds a listener. No Docker.
 */
import {
  deleteDemoFeatureGroupsByName,
  importApiMockGallerySample,
  prepareApiMockStudioChrome,
  seedDemoFeatureGroup,
  seedDemoHarnessTarget,
  selectDemoEnvSvc,
  sendApiMockRequest,
  wipeApiMockWorkspace,
} from '../../adapters';
import { API_MOCK, HAR } from '@shared/selectors';
import { firstVisibleElement } from '../../utils/domVisibility';
import type { DemoActionContext } from '../../types';
import {
  clickBeat,
  openApiMockFromActivityBar,
  revealBeat,
  spotlightBeat,
} from './api-mock-demo-helpers';

export const AM23_TIMING = {
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
  generate: 2000,
  cliHandoffHighlight: 2600,
} as const;

const T = AM23_TIMING;
const REVEAL_MS = 8_000;

export const AM23_CORPUS_SAMPLE = 'am-gallery-store';
export const AM23_FG_NAME = 'Store smoke suite';
export const AM23_SCENARIO_NAME = 'Store smoke';
export const AM23_SERVER_ID = 'srv-gallery-store';
export const AM23_CLI_SIMULATE = 'redfireforge mock simulate workspace.json';
export const AM23_CLI_VERIFY = 'redfireforge mock verify workspace.json';
export const AM23_PRODUCTS_PATH = '/products';
export const AM23_CART_PATH = '/cart';

async function am23Aim(
  ctx: DemoActionContext,
  selector: string,
  hold: number = 0,
): Promise<void> {
  await clickBeat(ctx, selector, { look: T.beforeOpen, hold });
}

async function am23ClickNow(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.fieldFilled,
): Promise<void> {
  await ctx.click(selector);
  await ctx.delay(hold);
}

async function am23SelectNow(
  ctx: DemoActionContext,
  selector: string,
  value: string,
  hold: number = T.payoff,
): Promise<void> {
  await ctx.selectOption(selector, value);
  await ctx.delay(hold);
}

async function am23Reveal(
  ctx: DemoActionContext,
  selector: string,
  hold: number = T.panelReady,
  timeout: number = REVEAL_MS,
): Promise<void> {
  await revealBeat(ctx, selector, { hold, timeout });
}

async function am23Look(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.look);
}

async function am23Payoff(ctx: DemoActionContext, selector: string): Promise<void> {
  await spotlightBeat(ctx, selector, T.payoff);
}

async function am23Break(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(T.groupBreak);
}

function checkboxChecked(selector: string): boolean {
  const el = firstVisibleElement<HTMLInputElement>(selector);
  return Boolean(el?.checked);
}

export function isAm23RunnerActive(): boolean {
  return Boolean(firstVisibleElement(HAR.HARNESS_MOCK_FIXTURE) || firstVisibleElement(HAR.RUN_BTN));
}

export function isAm23StudioActive(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.ROUTE_EXPLORER) ?? firstVisibleElement(API_MOCK.EMPTY));
}

export function isAm23FixtureEnabled(): boolean {
  return Boolean(firstVisibleElement(HAR.HARNESS_MOCK_FIXTURE));
}

type Am23ServerChoice = { value: string; label: string };

function readAm23ServerChoices(el: Element): Am23ServerChoice[] {
  if (el instanceof HTMLSelectElement) {
    return Array.from(el.options)
      .filter(o => o.value.trim().length > 0)
      .map(o => ({ value: o.value, label: o.textContent ?? '' }));
  }
  const encoded = el.closest('[data-am-servers]')?.getAttribute('data-am-servers')
    ?? el.getAttribute('data-am-servers');
  if (!encoded) return [];
  try {
    const parsed = JSON.parse(encoded) as Am23ServerChoice[];
    return parsed.filter(o => typeof o?.value === 'string' && o.value.trim().length > 0);
  } catch {
    return [];
  }
}

function readAm23ServerValue(el: Element): string {
  if (el instanceof HTMLSelectElement) return el.value.trim();
  return (el.getAttribute('data-value') ?? '').trim();
}

function readAm23ServerLabel(el: Element): string {
  if (el instanceof HTMLSelectElement) return el.selectedOptions[0]?.textContent ?? '';
  return el.querySelector('.cs-text')?.textContent ?? '';
}

/**
 * Gallery import remaps `srv-gallery-store` to a fresh `srv-*` id. Prefer the
 * live select option (template id, then a Store-named row, then the first
 * real option) so the lesson never writes a missing value that clears React state.
 */
export function am23StoreServerId(): string {
  const el = firstVisibleElement(HAR.HARNESS_MOCK_SERVER);
  if (!el) return '';
  const options = readAm23ServerChoices(el);
  const byTemplate = options.find(o => o.value === AM23_SERVER_ID);
  if (byTemplate) return byTemplate.value;
  const byName = options.find(o => /store/i.test(o.label));
  if (byName) return byName.value;
  return options[0]?.value ?? '';
}

export function isAm23StoreSelected(): boolean {
  const el = firstVisibleElement(HAR.HARNESS_MOCK_SERVER);
  if (!el) return false;
  const current = readAm23ServerValue(el);
  if (!current) return false;
  if (current === AM23_SERVER_ID) return true;
  return /store/i.test(readAm23ServerLabel(el));
}

export function isAm23IsolateOn(): boolean {
  if (!firstVisibleElement(HAR.HARNESS_MOCK_ISOLATE)) return false;
  return checkboxChecked(HAR.HARNESS_MOCK_ISOLATE);
}

export function hasAm23StartLine(): boolean {
  return Boolean(firstVisibleElement(HAR.HARNESS_MOCK_START));
}

export function hasAm23Stopped(): boolean {
  return Boolean(firstVisibleElement(HAR.HARNESS_MOCK_STOPPED));
}

export function hasAm23Results(): boolean {
  return Boolean(firstVisibleElement(HAR.COMPLETION) || firstVisibleElement(HAR.LIVE_PROGRESS));
}

export function hasAm23JournalRow(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW));
}

export function isAm23ExportConfirmOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.EXPORT_CONFIRM));
}

export function isAm23ExportMenuOpen(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.EXPORT_MENU));
}

export function hasAm23CliVerify(): boolean {
  return Boolean(firstVisibleElement(API_MOCK.CLI_VERIFY));
}

export function am23ServerRunning(): boolean {
  const label = firstVisibleElement(API_MOCK.STATUS_LABEL);
  return (label?.textContent ?? '').toLowerCase().includes('running');
}

function makeAm23FeatureGroup(envId: string, svcId: string): Record<string, unknown> {
  const makeTest = (id: string, name: string, url: string) => ({
    id,
    name,
    method: 'GET' as const,
    url,
    headers: [{ key: 'Accept', value: 'application/json' }],
    body: '',
    auth: { type: 'none' as const },
    validation: {
      mode: 'none' as const,
      assertions: [
        { type: 'status' as const, expected: '200' },
        { type: 'responseTime' as const, maxMs: 5000 },
      ],
    },
  });
  return {
    id: 'demo-am23-fg',
    name: AM23_FG_NAME,
    environmentId: envId,
    microserviceId: svcId,
    scenarios: [{
      id: 'demo-am23-sc',
      name: AM23_SCENARIO_NAME,
      kind: 'standard',
      tests: [
        makeTest('demo-am23-t1', 'List products', `http://store.example${AM23_PRODUCTS_PATH}`),
        makeTest('demo-am23-t2', 'Get cart', `http://store.example${AM23_CART_PATH}`),
      ],
    }],
  };
}

export async function prepareAm23Workspace(): Promise<void> {
  await wipeApiMockWorkspace();
  prepareApiMockStudioChrome();
  const imported = await importApiMockGallerySample(AM23_CORPUS_SAMPLE);
  if (!imported) {
    throw new Error(`AM-23: failed to import ${AM23_CORPUS_SAMPLE}`);
  }
  const ids = seedDemoHarnessTarget();
  if (ids) {
    selectDemoEnvSvc(ids.envId, ids.svcId);
    seedDemoFeatureGroup(makeAm23FeatureGroup(ids.envId, ids.svcId));
  }
}

export async function cleanupAm23(): Promise<void> {
  deleteDemoFeatureGroupsByName(AM23_FG_NAME);
  await wipeApiMockWorkspace();
}

export async function ensureAm23OnRunner(ctx: DemoActionContext): Promise<void> {
  if (isAm23RunnerActive()) return;
  if (firstVisibleElement(HAR.NAV_RUNNER)) {
    await ctx.click(HAR.NAV_RUNNER);
    await ctx.delay(200);
    return;
  }
  if (firstVisibleElement(HAR.NAV_HARNESS)) {
    await ctx.click(HAR.NAV_HARNESS);
    await ctx.delay(200);
    if (firstVisibleElement(HAR.NAV_RUNNER)) {
      await ctx.click(HAR.NAV_RUNNER);
      await ctx.delay(200);
      return;
    }
  }
  ctx.navigateToTab('runner');
  await ctx.delay(200);
}

export async function ensureAm23OnStudio(ctx: DemoActionContext): Promise<void> {
  if (isAm23StudioActive()) return;
  if (await openApiMockFromActivityBar(ctx)) return;
  ctx.navigateToTab('api-mock-studio');
  await ctx.delay(200);
}

async function selectAm23Scenario(ctx: DemoActionContext): Promise<void> {
  const root = document.querySelector(HAR.SCENARIO_SELECTOR);
  if (!root) return;
  const boxes = Array.from(root.querySelectorAll<HTMLInputElement>(
    '.selection-scenario input[type="checkbox"]',
  ));
  if (boxes.length === 0) return;
  const first = boxes[0];
  const onlyFirst = first.checked && boxes.slice(1).every(c => !c.checked);
  if (onlyFirst) return;
  const deselect = Array.from(root.querySelectorAll<HTMLElement>('button'))
    .find(b => b.textContent?.trim() === 'Deselect All');
  if (deselect) {
    deselect.click();
    await ctx.delay(200);
  }
  if (!first.checked) {
    first.click();
    await ctx.delay(400);
  }
}

async function ensureAm23FixtureOpen(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (firstVisibleElement(HAR.HARNESS_MOCK_FIXTURE)) return;
  if (!firstVisibleElement(HAR.HOST_MOCK_SERVER)) return;
  if (visible) await am23ClickNow(ctx, HAR.HOST_MOCK_SERVER, T.panelReady);
  else await ctx.click(HAR.HOST_MOCK_SERVER);
}

async function enableFixtureAndPickStore(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm23OnRunner(ctx);
  await ensureAm23FixtureOpen(ctx, visible);
  if (!firstVisibleElement(HAR.HARNESS_MOCK_FIXTURE)) return;
  if (!firstVisibleElement(HAR.HARNESS_MOCK_SERVER)) return;
  if (isAm23StoreSelected()) return;
  const serverId = am23StoreServerId();
  if (!serverId) return;
  if (visible) {
    await am23Aim(ctx, HAR.HARNESS_MOCK_SERVER);
    await am23SelectNow(ctx, HAR.HARNESS_MOCK_SERVER, serverId);
  } else {
    await ctx.selectOption(HAR.HARNESS_MOCK_SERVER, serverId);
  }
}

async function holdOrEnableIsolate(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (!firstVisibleElement(HAR.HARNESS_MOCK_ISOLATE)) return;
  if (isAm23IsolateOn()) {
    if (visible) await ctx.delay(T.look);
    return;
  }
  if (visible) await am23ClickNow(ctx, HAR.HARNESS_MOCK_ISOLATE, T.lifecycle);
  else await ctx.click(HAR.HARNESS_MOCK_ISOLATE);
}

async function quietRunIfNeeded(ctx: DemoActionContext): Promise<void> {
  if (hasAm23Stopped() && hasAm23Results()) return;
  await enableFixtureAndPickStore(ctx, false);
  await holdOrEnableIsolate(ctx, false);
  await selectAm23Scenario(ctx);
  if (!firstVisibleElement(HAR.RUN_BTN)) return;
  await ctx.click(HAR.RUN_BTN);
  await ctx.waitFor(HAR.COMPLETION, REVEAL_MS).catch(() => undefined);
}

async function closeAm23Export(ctx: DemoActionContext, visible: boolean): Promise<void> {
  if (!isAm23ExportConfirmOpen()) return;
  if (!firstVisibleElement(API_MOCK.EXPORT_CLOSE)) return;
  if (visible) await am23ClickNow(ctx, API_MOCK.EXPORT_CLOSE, T.panelReady);
  else await ctx.click(API_MOCK.EXPORT_CLOSE);
  await ctx.delay(visible ? 700 : 200);
}

async function openAm23ExportMenu(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm23OnStudio(ctx);
  await closeAm23Export(ctx, visible);
  if (isAm23ExportMenuOpen()) return;
  if (!firstVisibleElement(API_MOCK.EXPORT)) return;
  if (visible) await am23ClickNow(ctx, API_MOCK.EXPORT, T.fieldFilled);
  else await ctx.click(API_MOCK.EXPORT);
  await ctx.waitFor(API_MOCK.EXPORT_MENU, REVEAL_MS).catch(() => undefined);
}

async function ensureAm23StudioRunning(ctx: DemoActionContext): Promise<void> {
  await ensureAm23OnStudio(ctx);
  prepareApiMockStudioChrome();
  if (am23ServerRunning()) return;
  if (!firstVisibleElement(API_MOCK.START)) return;
  await ctx.click(API_MOCK.START);
  await ctx.waitFor(API_MOCK.STOP, REVEAL_MS).catch(() => undefined);
}

async function ensureAm23JournalRow(ctx: DemoActionContext): Promise<void> {
  if (hasAm23JournalRow()) return;
  await ensureAm23StudioRunning(ctx);
  await sendApiMockRequest({ path: AM23_PRODUCTS_PATH, method: 'GET' });
  await ctx.delay(400);
}

async function openAm23Journal(ctx: DemoActionContext, visible: boolean): Promise<void> {
  await ensureAm23OnStudio(ctx);
  if (firstVisibleElement(API_MOCK.JOURNAL_TOOLBAR) || firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    return;
  }
  if (firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    if (visible) await am23ClickNow(ctx, API_MOCK.DOCK_TAB_TRANSACTIONS, T.tabSwitch);
    else await ctx.click(API_MOCK.DOCK_TAB_TRANSACTIONS);
    await ctx.delay(visible ? T.tabSwitch : 200);
    return;
  }
  if (firstVisibleElement(API_MOCK.VIEW_RUNTIME)) {
    if (visible) await am23Aim(ctx, API_MOCK.VIEW_RUNTIME);
    else await ctx.click(API_MOCK.VIEW_RUNTIME);
    await ctx.delay(visible ? T.tabSwitch : 200);
    if (firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
      if (visible) await am23ClickNow(ctx, API_MOCK.DOCK_TAB_TRANSACTIONS, T.tabSwitch);
      else await ctx.click(API_MOCK.DOCK_TAB_TRANSACTIONS);
    }
  }
}

export async function ensureAm23ForIsolate(ctx: DemoActionContext): Promise<void> {
  await enableFixtureAndPickStore(ctx, false);
  await holdOrEnableIsolate(ctx, false);
}

export async function ensureAm23ForRun(ctx: DemoActionContext): Promise<void> {
  await enableFixtureAndPickStore(ctx, false);
  await holdOrEnableIsolate(ctx, false);
  await selectAm23Scenario(ctx);
}

export async function ensureAm23ForTeardown(ctx: DemoActionContext): Promise<void> {
  await ensureAm23ForRun(ctx);
  await quietRunIfNeeded(ctx);
}

export async function ensureAm23ForEvidence(ctx: DemoActionContext): Promise<void> {
  await ensureAm23ForTeardown(ctx);
  await ensureAm23OnStudio(ctx);
  await ensureAm23JournalRow(ctx);
}

export async function ensureAm23ForArtifact(ctx: DemoActionContext): Promise<void> {
  await ensureAm23OnStudio(ctx);
  await closeAm23Export(ctx, false);
}

export async function ensureAm23ForCli(ctx: DemoActionContext): Promise<void> {
  await ensureAm23OnStudio(ctx);
  await closeAm23Export(ctx, false);
}

export async function runAm23FixturePanel(ctx: DemoActionContext): Promise<void> {
  await ensureAm23OnRunner(ctx);
  await enableFixtureAndPickStore(ctx, true);
  await am23Payoff(ctx, HAR.HARNESS_MOCK_SERVER);
}

/** Isolate is already on and on screen from step 1 — do not scroll or re-ring. */
export async function runAm23Isolate(ctx: DemoActionContext): Promise<void> {
  await holdOrEnableIsolate(ctx, false);
}

export async function runAm23Suite(ctx: DemoActionContext): Promise<void> {
  await ensureAm23OnRunner(ctx);
  await selectAm23Scenario(ctx);
  if (firstVisibleElement(HAR.RUN_BTN)) {
    await am23ClickNow(ctx, HAR.RUN_BTN, T.fieldFilled);
  }
  await am23Break(ctx);
  if (firstVisibleElement(HAR.LIVE_PROGRESS)) {
    await am23Look(ctx, HAR.LIVE_PROGRESS);
  }
  await am23Reveal(ctx, HAR.COMPLETION, T.payoff);
  await am23Payoff(ctx, HAR.COMPLETION);
}

export async function runAm23Teardown(ctx: DemoActionContext): Promise<void> {
  await ensureAm23OnRunner(ctx);
  if (!firstVisibleElement(HAR.HARNESS_MOCK_STOPPED)) {
    await am23Reveal(ctx, HAR.HARNESS_MOCK_STOPPED, T.panelReady);
  } else {
    await ctx.delay(T.look);
  }
  if (firstVisibleElement(HAR.HARNESS_MOCK_FREED_PORT)) {
    await am23Payoff(ctx, HAR.HARNESS_MOCK_FREED_PORT);
  }
}

export async function runAm23Evidence(ctx: DemoActionContext): Promise<void> {
  await ensureAm23OnStudio(ctx);
  await ensureAm23JournalRow(ctx);
  if (firstVisibleElement(API_MOCK.DOCK_TAB_TRANSACTIONS)) {
    await am23ClickNow(ctx, API_MOCK.DOCK_TAB_TRANSACTIONS, T.tabSwitch);
  } else {
    await openAm23Journal(ctx, true);
  }
  if (firstVisibleElement(API_MOCK.JOURNAL_FIRST_ROW)) {
    await am23Reveal(ctx, API_MOCK.JOURNAL_FIRST_ROW, T.journalWrite);
    await am23Payoff(ctx, API_MOCK.JOURNAL_FIRST_ROW);
  }
  if (firstVisibleElement(API_MOCK.JOURNAL_EXPORT)) {
    await am23Look(ctx, API_MOCK.JOURNAL_EXPORT);
  }
}

export async function runAm23Artifact(ctx: DemoActionContext): Promise<void> {
  await openAm23ExportMenu(ctx, true);
  if (firstVisibleElement(API_MOCK.EXPORT_WORKSPACE)) {
    await am23Aim(ctx, API_MOCK.EXPORT_WORKSPACE);
  }
  await am23Reveal(ctx, API_MOCK.EXPORT_CONFIRM, T.payoff);
  if (firstVisibleElement(API_MOCK.EXPORT_CLI)) {
    await am23Look(ctx, API_MOCK.EXPORT_CLI);
  }
  if (firstVisibleElement(API_MOCK.EXPORT_CLI_VERIFY)) {
    await am23Look(ctx, API_MOCK.EXPORT_CLI_VERIFY);
  }
  await am23Payoff(ctx, API_MOCK.EXPORT_CONFIRM);
}

export async function runAm23CliHandoff(ctx: DemoActionContext): Promise<void> {
  await closeAm23Export(ctx, true);
  await ensureAm23OnStudio(ctx);
  if (firstVisibleElement(API_MOCK.VIEW_STUDIO) && !isAm23StudioActive()) {
    await am23Aim(ctx, API_MOCK.VIEW_STUDIO);
  }
  if (firstVisibleElement(API_MOCK.CLI_VERIFY)) {
    await spotlightBeat(ctx, API_MOCK.CLI_VERIFY, T.cliHandoffHighlight);
  }
  await spotlightBeat(ctx, API_MOCK.ROUTES_FOOTER, T.cliHandoffHighlight);
}

/** @internal exported for helper tests */
export const am23TestHooks = {
  am23Aim,
  am23ClickNow,
  am23SelectNow,
  enableFixtureAndPickStore,
  holdOrEnableIsolate,
  selectAm23Scenario,
  quietRunIfNeeded,
  closeAm23Export,
  openAm23ExportMenu,
  openAm23Journal,
  ensureAm23StudioRunning,
  ensureAm23JournalRow,
  makeAm23FeatureGroup,
};
