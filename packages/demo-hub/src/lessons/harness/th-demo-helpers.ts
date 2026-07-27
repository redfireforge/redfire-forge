/**
 * Shared helpers for Test Harness demo lessons.
 *
 * Follows the same adapter-only import pattern as workflow lessons:
 * - Bridge window for programmatic state changes
 * - Selectors for DOM queries
 * - DemoActionContext for paced user-visible interactions
 */
import type { DemoActionContext } from '../../types';
import { getDemoBridgeWindow } from '../../adapters/bridgeWindow';
import { showSpotlightRing } from '../../demoRipple';
import { HAR } from '@shared/selectors';

// ─── Constants ──────────────────────────────────────────────────

export const DEMO_FG_NAME = 'User API Tests';
export const TH2_FG_NAME = 'JSONPlaceholder API';
export const TH2_SCENARIO_NAME = 'User Endpoints';
export const TH2_TEST_NAME = 'Get User by ID';
export const TH2_TEST_URL = 'https://jsonplaceholder.typicode.com/users/1';

export const TH3_FG_NAME = 'Validation Demo';
export const TH3_SCENARIO_NAME = 'User Endpoints';
export const TH3_TEST_NAME = 'Get User by ID';
export const TH3_TEST_URL = 'https://jsonplaceholder.typicode.com/users/1';

export const TH3_SAMPLE_RESPONSE = JSON.stringify({
  id: 1,
  name: 'Leanne Graham',
  username: 'Bret',
  email: 'Sincere@april.biz',
  address: {
    street: 'Kulas Light',
    suite: 'Apt. 556',
    city: 'Gwenborough',
    zipcode: '92998-3874',
    geo: { lat: '-37.3159', lng: '81.1496' },
  },
  phone: '1-770-736-8031 x56442',
  website: 'hildegard.org',
  company: {
    name: 'Romaguera-Crona',
    catchPhrase: 'Multi-layered client-server neural-net',
    bs: 'harness real-time e-markets',
  },
}, null, 2);

// ─── Spotlight helpers ──────────────────────────────────────────

let activeCleanup: (() => void) | null = null;

/**
 * Highlight a specific DOM element with the spotlight ring for `holdMs`
 * milliseconds. Scrolls the element into view (for non-flow elements).
 */
export function spotlight(el: HTMLElement, holdMs: number, ctx: DemoActionContext): Promise<void> {
  activeCleanup?.();
  activeCleanup = null;
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const remove = showSpotlightRing(el);
  activeCleanup = remove;
  return ctx.delay(holdMs).then(() => {
    remove();
    if (activeCleanup === remove) activeCleanup = null;
  });
}

/** Spotlight a selector — no-op if the element is missing. */
export async function spotlightSel(ctx: DemoActionContext, sel: string, holdMs: number): Promise<void> {
  const el = document.querySelector<HTMLElement>(sel);
  if (el) await spotlight(el, holdMs, ctx);
}

// ─── Seeding / teardown ─────────────────────────────────────────

/**
 * Seed the demo environment + microservice and select them in the header.
 * Uses bridge functions to create entities (if missing) and then
 * programmatically set the header selection via React state.
 * Returns `{ envId, svcId }` on success.
 */
export async function seedDemoEnvAndService(ctx: DemoActionContext): Promise<{ envId: string; svcId: string } | null> {
  const w = getDemoBridgeWindow();
  const ids = w.__demoSeedHarnessTarget?.();
  if (!ids) return null;

  await ctx.delay(300);
  w.__demoSelectEnvSvc?.(ids.envId, ids.svcId);
  await ctx.delay(300);

  return ids;
}

/**
 * Seed a pre-built Feature Group with realistic test data.
 * Idempotent: skips if a FG with the same name already exists.
 */
export function seedDemoFeatureGroup(envId: string, svcId: string): void {
  const w = getDemoBridgeWindow();
  const fg = {
    id: 'demo-fg-user-api',
    name: DEMO_FG_NAME,
    environmentId: envId,
    microserviceId: svcId,
    scenarios: [
      {
        id: 'demo-sc-users',
        name: 'User Endpoints',
        kind: 'standard',
        tests: [
          {
            id: 'demo-t-get-users',
            name: 'List All Users',
            method: 'GET',
            url: '/users',
            assertions: { statusCode: '200' },
          },
          {
            id: 'demo-t-get-user',
            name: 'Get User by ID',
            method: 'GET',
            url: '/users/1',
            assertions: { statusCode: '200' },
            expectedFields: [
              { jsonPath: '$.name', operator: 'is_not_empty' },
              { jsonPath: '$.email', operator: 'is_not_empty' },
            ],
          },
          {
            id: 'demo-t-create-user',
            name: 'Create User',
            method: 'POST',
            url: '/users',
            body: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com' }),
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            assertions: { statusCode: '201' },
          },
        ],
      },
    ],
  };
  w.__demoSeedFeatureGroup?.(fg);
}

/** Delete demo FG by name (cleanup). */
export function deleteDemoFeatureGroup(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(DEMO_FG_NAME);
}

/** Ensure demo env/svc is seeded and selected (for preAction guards). */
export async function ensureDemoEnvAndServiceQuiet(ctx: DemoActionContext): Promise<{ envId: string; svcId: string } | null> {
  return seedDemoEnvAndService(ctx);
}

/** Ensure the demo FG exists (for preAction guards). */
export async function ensureDemoFgExists(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(HAR.FG_CARD)) return;
  const ids = await ensureDemoEnvAndServiceQuiet(ctx);
  if (ids) seedDemoFeatureGroup(ids.envId, ids.svcId);
  await ctx.delay(300);
}

/** Expand the first FG if it isn't already expanded. */
export async function expandFirstFg(ctx: DemoActionContext): Promise<void> {
  const fgHeader = document.querySelector<HTMLElement>(HAR.FG_EXPAND);
  if (!fgHeader) return;
  const expandIcon = fgHeader.querySelector('.expand-icon');
  if (expandIcon && !expandIcon.classList.contains('expanded')) {
    fgHeader.click();
    await ctx.delay(400);
  }
}

/** Expand the first scenario if it isn't already expanded. */
export async function expandFirstScenario(ctx: DemoActionContext): Promise<void> {
  const scHeader = document.querySelector<HTMLElement>(HAR.SCENARIO_HEADER);
  if (!scHeader) return;
  const expandIcon = scHeader.querySelector('.expand-icon');
  if (expandIcon && !expandIcon.classList.contains('expanded')) {
    scHeader.click();
    await ctx.delay(400);
  }
}

// ─── TH-2 helpers ────────────────────────────────────────────────

/** Delete TH-2 demo Feature Group by name. */
export function deleteTh2DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH2_FG_NAME);
}

/** Close any stale inline name form (FG or Scenario creation). */
export function closeInlineNameFormQuiet(): void {
  const forms = document.querySelectorAll<HTMLElement>('.inline-name-form');
  forms.forEach(form => {
    const cancel = form.querySelector<HTMLElement>('.btn:not(.btn-primary)');
    cancel?.click();
  });
}

/** Close the Test Editor modal if it's open (quiet — no ripple). */
export async function closeTestEditorQuiet(ctx: DemoActionContext): Promise<void> {
  const cancelBtn = document.querySelector<HTMLElement>(HAR.TE_CANCEL_BTN);
  if (cancelBtn) {
    cancelBtn.click();
    await ctx.delay(300);
  }
}

/** Check if the Test Editor modal is currently open. */
export function isTestEditorOpen(): boolean {
  return !!document.querySelector(HAR.TE_PROP_CARD);
}

/**
 * Ensure a FG with the given name exists. If not, seed it programmatically.
 * Returns true if the FG was seeded (caller should wait for React update).
 */
export async function ensureTh2FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH2_FG_NAME);
  if (found) return false;

  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh2Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh2Ids = ids;
    }
  }
  if (!ids) return false;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th2-fg',
    name: TH2_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [],
  });
  await ctx.delay(300);
  return true;
}

/**
 * Ensure a Scenario exists inside the TH-2 Feature Group.
 * Seeds one programmatically if missing.
 */
export async function ensureTh2ScenarioExists(ctx: DemoActionContext): Promise<void> {
  await ensureTh2FgExists(ctx);
  await expandFirstFg(ctx);
  const scCards = document.querySelectorAll<HTMLElement>(HAR.SCENARIO_CARD);
  if (scCards.length > 0) return;

  const w = getDemoBridgeWindow();
  const ids = (window as unknown as Record<string, unknown>).__demoTh2Ids as { envId: string; svcId: string } | undefined;
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th2-fg',
    name: TH2_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [{
      id: 'demo-th2-sc',
      name: TH2_SCENARIO_NAME,
      kind: 'standard',
      tests: [],
    }],
  });
  await ctx.delay(400);
  await expandFirstFg(ctx);
}

// ─── TH-3 helpers ────────────────────────────────────────────────

/** Delete TH-3 demo Feature Group by name. */
export function deleteTh3DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH3_FG_NAME);
}

/**
 * Seed the TH-3 Feature Group with a pre-configured test that has
 * a fetched sample response (sampleJson) — no assertions or expected fields.
 */
export async function seedTh3FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh3Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh3Ids = ids;
    }
  }
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th3-fg',
    name: TH3_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [{
      id: 'demo-th3-sc',
      name: TH3_SCENARIO_NAME,
      kind: 'standard',
      tests: [{
        id: 'demo-th3-test',
        name: TH3_TEST_NAME,
        method: 'GET',
        url: TH3_TEST_URL,
        headers: [{ key: 'Accept', value: 'application/json' }],
        auth: { type: 'none' },
        assertions: { statusCode: '' },
        validation: {
          mode: 'none',
          sampleJson: TH3_SAMPLE_RESPONSE,
        },
      }],
    }],
  });
  await ctx.delay(400);
}

/**
 * Ensure the TH-3 FG and test are in place — returns true if freshly seeded.
 */
export async function ensureTh3FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH3_FG_NAME);
  if (found) return false;

  await seedTh3FeatureGroup(ctx);
  return true;
}

/**
 * Open the first test in the seeded TH-3 FG by clicking its Edit button.
 * Expands the tree first if needed.
 */
export async function openTh3TestEditor(ctx: DemoActionContext): Promise<void> {
  if (isTestEditorOpen()) return;

  await expandFirstFg(ctx);
  await expandFirstScenario(ctx);
  await ctx.delay(300);

  const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
  if (editBtn) {
    editBtn.click();
    await ctx.delay(600);
  }
}

/**
 * Navigate to the Validation tab inside an open Test Editor.
 */
export async function navigateToValidationTab(ctx: DemoActionContext): Promise<void> {
  const validationTab = Array.from(document.querySelectorAll<HTMLElement>('.builder-tab'))
    .find(t => t.textContent?.includes('Validation'));
  if (validationTab) {
    validationTab.click();
    await ctx.delay(500);
  }
}

/**
 * Close the assertion add menu if it's open.
 * The menu's outside-click handler listens on `mousedown`, so we dispatch that.
 */
export function closeAssertionMenuQuiet(): void {
  const menu = document.querySelector<HTMLElement>(HAR.TE_ASSERTIONS_ADD_MENU);
  if (menu) {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  }
}

// ─── TH-4 helpers ────────────────────────────────────────────────

export const TH4_FG_NAME = 'Runner Demo';
export const TH4_SCENARIO_NAME = 'User API Tests';

/** Delete TH-4 demo Feature Group by name. */
export function deleteTh4DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH4_FG_NAME);
}

/**
 * Seed the TH-4 Feature Group with 3 tests and basic assertions.
 * Tests use absolute jsonplaceholder URLs so "Original" host mode works.
 */
export async function seedTh4FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh4Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh4Ids = ids;
    }
  }
  if (!ids) return;

  const makeTest = (
    id: string, name: string, method: 'GET' | 'POST', url: string,
    statusCode: string, body = '',
  ) => ({
    id,
    name,
    method,
    url,
    headers: [{ key: 'Accept', value: 'application/json' }],
    body,
    auth: { type: 'none' as const },
    validation: {
      mode: 'none' as const,
      assertions: [
        { type: 'status' as const, expected: statusCode },
        { type: 'responseTime' as const, maxMs: 5000 },
      ],
    },
  });

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th4-fg',
    name: TH4_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [{
      id: 'demo-th4-sc',
      name: TH4_SCENARIO_NAME,
      kind: 'standard',
      tests: [
        makeTest('demo-th4-t1', 'List All Users', 'GET',
          'https://jsonplaceholder.typicode.com/users', '200'),
        makeTest('demo-th4-t2', 'Get User by ID', 'GET',
          'https://jsonplaceholder.typicode.com/users/1', '200'),
        makeTest('demo-th4-t3', 'Create User', 'POST',
          'https://jsonplaceholder.typicode.com/users', '201',
          JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com' })),
      ],
    }],
  });
  await ctx.delay(400);
}

/**
 * Ensure the TH-4 FG exists. Returns true if freshly seeded.
 */
export async function ensureTh4FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH4_FG_NAME);
  if (found) return false;

  await seedTh4FeatureGroup(ctx);
  return true;
}

/**
 * Select the first scenario in the scenario selector by clicking its checkbox.
 * @param scope Optional CSS ancestor scope (e.g. `.param-runner-page`) to
 *              avoid hitting the hidden twin runner page.
 */
export async function selectFirstScenarioInRunner(ctx: DemoActionContext, scope = ''): Promise<void> {
  const prefix = scope ? `${scope} ` : '';
  const checkbox = document.querySelector<HTMLInputElement>(
    `${prefix}${HAR.SCENARIO_SELECTOR} .selection-scenario input[type="checkbox"]`,
  );
  if (checkbox && !checkbox.checked) {
    checkbox.click();
    await ctx.delay(400);
  }
}

/**
 * Fill the iterations input with a specific value.
 * @param scope Optional CSS ancestor scope to avoid hitting the hidden twin runner page.
 */
export async function setIterationsValue(ctx: DemoActionContext, value: number, scope = ''): Promise<void> {
  const root = scope ? document.querySelector<HTMLElement>(scope) : document;
  if (!root) return;
  const labels = root.querySelectorAll<HTMLElement>('.resilience-field label');
  for (const label of labels) {
    if (label.textContent?.includes('Iterations')) {
      const input = label.closest('.resilience-field')?.querySelector<HTMLInputElement>('input[type="number"]');
      if (input) {
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(input, String(value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await ctx.delay(300);
      }
      break;
    }
  }
}

// ─── TH-5 helpers ────────────────────────────────────────────────

export const TH5_FG_NAME = 'Data-Driven Demo';
export const TH5_SCENARIO_NAME = 'User Tests';
export const TH5_TEST_NAME = 'Get User by ID';

export function deleteTh5DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH5_FG_NAME);
}

/**
 * Seed TH-5 FG with a parameterized scenario containing a test that already
 * has a data source (one Path column `userId`, 2 pre-filled rows).
 */
export async function seedTh5FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh5Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh5Ids = ids;
    }
  }
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th5-fg',
    name: TH5_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [{
      id: 'demo-th5-sc',
      name: TH5_SCENARIO_NAME,
      kind: 'parameterized',
      tests: [{
        id: 'demo-th5-test',
        name: TH5_TEST_NAME,
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/users/{{userId}}',
        headers: [{ key: 'Accept', value: 'application/json' }],
        body: '',
        auth: { type: 'none' as const },
        validation: {
          mode: 'none' as const,
          assertions: [{ type: 'status' as const, expected: '200' }],
        },
        dataSource: {
          id: 'demo-th5-ds',
          label: 'User IDs',
          columns: [{
            id: 'col-userid',
            name: 'userId',
            type: 'path' as const,
            mapping: 'userId',
          }],
          rows: [
            { id: 'row-1', label: '', values: { 'col-userid': '1' }, enabled: true },
            { id: 'row-2', label: '', values: { 'col-userid': '2' }, enabled: true },
          ],
          source: { type: 'inline' as const },
          urlTemplate: 'https://jsonplaceholder.typicode.com/users/{{userId}}',
        },
      }],
    }],
  });
  await ctx.delay(400);
}

export async function ensureTh5FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH5_FG_NAME);
  if (found) return false;
  await seedTh5FeatureGroup(ctx);
  return true;
}

/** Open the first test's editor from the seeded TH-5 FG. */
export async function openTh5TestEditor(ctx: DemoActionContext): Promise<void> {
  if (isTestEditorOpen()) return;
  await expandFirstFg(ctx);
  await expandFirstScenario(ctx);
  await ctx.delay(300);
  const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
  if (editBtn) {
    editBtn.click();
    await ctx.delay(600);
  }
}

/** Click the Data Source tab in the test editor. */
export async function navigateToDataSourceTab(ctx: DemoActionContext): Promise<void> {
  const tabs = document.querySelectorAll<HTMLElement>('.builder-tab');
  for (const tab of tabs) {
    if (tab.textContent?.includes('Data Source') || tab.textContent?.includes('Parameterize')) {
      if (!tab.classList.contains('active')) {
        tab.click();
        await ctx.delay(500);
      }
      return;
    }
  }
}

/**
 * Fill a data source cell by row/col index.
 * Uses the native setter to work with React controlled inputs.
 */
export function fillDsCell(rowIdx: number, colIdx: number, value: string): void {
  const rows = document.querySelectorAll<HTMLElement>('.data-source-row');
  const row = rows[rowIdx];
  if (!row) return;
  const cells = row.querySelectorAll<HTMLInputElement>('.data-source-cell-input');
  const cell = cells[colIdx];
  if (!cell) return;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  nativeSetter?.call(cell, value);
  cell.dispatchEvent(new Event('input', { bubbles: true }));
  cell.dispatchEvent(new Event('change', { bubbles: true }));
}

// ─── TH-6 helpers ────────────────────────────────────────────────

export const TH6_FG_NAME = 'Param Runner Demo';
export const TH6_SCENARIO_NAME = 'User Tests';

export function deleteTh6DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH6_FG_NAME);
}

/**
 * Seed TH-6 FG with a parameterized scenario: 1 test, 5 data rows with tags.
 */
export async function seedTh6FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh6Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh6Ids = ids;
    }
  }
  if (!ids) return;

  const makeRow = (n: number, tag: string) => ({
    id: `row-${n}`,
    label: `User ${n}`,
    values: { 'col-userid': String(n) },
    enabled: true,
    tags: [tag],
  });

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th6-fg',
    name: TH6_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [{
      id: 'demo-th6-sc',
      name: TH6_SCENARIO_NAME,
      kind: 'parameterized',
      tests: [{
        id: 'demo-th6-test',
        name: 'Get User by ID',
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/users/{{userId}}',
        headers: [{ key: 'Accept', value: 'application/json' }],
        body: '',
        auth: { type: 'none' as const },
        validation: {
          mode: 'none' as const,
          assertions: [{ type: 'status' as const, expected: '200' }],
        },
        dataSource: {
          id: 'demo-th6-ds',
          label: 'User IDs',
          columns: [{
            id: 'col-userid',
            name: 'userId',
            type: 'path' as const,
            mapping: 'userId',
          }],
          rows: [
            makeRow(1, 'smoke'),
            makeRow(2, 'smoke'),
            makeRow(3, 'smoke'),
            makeRow(4, 'regression'),
            makeRow(5, 'regression'),
          ],
          source: { type: 'inline' as const },
          urlTemplate: 'https://jsonplaceholder.typicode.com/users/{{userId}}',
        },
      }],
    }],
  });
  await ctx.delay(400);
}

export async function ensureTh6FgExists(ctx: DemoActionContext): Promise<void> {
  const w = window as unknown as Record<string, unknown>;
  if (w.__demoTh6Seeded) return;
  await seedTh6FeatureGroup(ctx);
  w.__demoTh6Seeded = true;
}

/** Fill a native text input by CSS selector (for tag filter etc.) */
export function fillNativeInput(selector: string, value: string): void {
  const el = document.querySelector<HTMLInputElement>(selector);
  if (!el) return;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  nativeSetter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ─── TH-8 helpers ────────────────────────────────────────────────

export const TH8_FG_NAME = 'Load Test Demo';
export const TH8_SCENARIO_NAME = 'API Endpoints';

export function deleteTh8DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH8_FG_NAME);
}

/**
 * Seed TH-8 FG with 3 fast GET endpoints for load testing config demo.
 */
export async function seedTh8FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh8Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh8Ids = ids;
    }
  }
  if (!ids) return;

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

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th8-fg',
    name: TH8_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [{
      id: 'demo-th8-sc',
      name: TH8_SCENARIO_NAME,
      kind: 'standard',
      tests: [
        makeTest('demo-th8-t1', 'List Posts', 'https://jsonplaceholder.typicode.com/posts'),
        makeTest('demo-th8-t2', 'List Users', 'https://jsonplaceholder.typicode.com/users'),
        makeTest('demo-th8-t3', 'List Comments', 'https://jsonplaceholder.typicode.com/comments'),
      ],
    }],
  });
  await ctx.delay(400);
}

export async function ensureTh8FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH8_FG_NAME);
  if (found) return false;
  await seedTh8FeatureGroup(ctx);
  return true;
}

/**
 * Click a radio button inside a specific container by matching its label text.
 */
export function clickRadioByLabel(container: string, labelText: string): void {
  const root = document.querySelector<HTMLElement>(container);
  if (!root) return;
  const labels = root.querySelectorAll<HTMLElement>('.radio-label');
  for (const lbl of labels) {
    if (lbl.textContent?.trim() === labelText) {
      const radio = lbl.querySelector<HTMLInputElement>('input[type="radio"]');
      if (radio && !radio.checked && !radio.disabled) radio.click();
      return;
    }
  }
}

/**
 * Click a profile type button (Ramp-Up, Sustained, Spike) by label text.
 */
export function clickProfileType(label: string): void {
  const btns = document.querySelectorAll<HTMLElement>(HAR.PROFILE_TYPE_BTN);
  for (const btn of btns) {
    if (btn.textContent?.trim() === label && !btn.classList.contains('active')) {
      btn.click();
      return;
    }
  }
}

/**
 * Set a numeric input value inside a container by matching its label text.
 * Works with the NumericInput component's controlled state.
 */
export function setFieldByLabel(container: string, labelText: string, value: number): void {
  const root = document.querySelector<HTMLElement>(container);
  if (!root) return;
  const fields = root.querySelectorAll<HTMLElement>('.profile-field, .resilience-field, .resilience-field-sm, .resilience-field-xs');
  for (const field of fields) {
    const lbl = field.querySelector('label');
    if (lbl && lbl.textContent?.trim() === labelText) {
      const input = field.querySelector<HTMLInputElement>('input[type="number"]');
      if (input) {
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        nativeSetter?.call(input, String(value));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
  }
}

/**
 * Set the think time inline input value (for Constant mode).
 */
export function setThinkTimeMs(value: number): void {
  const input = document.querySelector<HTMLInputElement>('.think-time-inline-input');
  if (!input) return;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  nativeSetter?.call(input, String(value));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// ─── TH-7 helpers ────────────────────────────────────────────────

const TH7_RUN_PREFIX = 'demo-th7-run';

function makeDemoResult(
  idx: number,
  method: string,
  name: string,
  url: string,
  status: number,
  responseTimeMs: number,
  passed: boolean,
): Record<string, unknown> {
  return {
    id: `${TH7_RUN_PREFIX}-r${idx}`,
    testName: name,
    method,
    url,
    httpStatus: status,
    responseTime: responseTimeMs,
    passed,
    error: passed ? undefined : 'Validation failed: $.name expected "Alice" but got "Leanne Graham"',
    timing: {
      dnsMs: 2 + Math.random() * 3,
      tcpMs: 8 + Math.random() * 5,
      tlsMs: 12 + Math.random() * 8,
      ttfbMs: responseTimeMs * 0.6,
      downloadMs: responseTimeMs * 0.15,
    },
    scenarioName: 'User API',
    featureGroupName: 'Results Demo',
    assertions: passed
      ? [{ type: 'status', expected: '200', actual: String(status), passed: true }]
      : [
          { type: 'status', expected: '200', actual: String(status), passed: true },
          { type: 'field', path: '$.name', expected: 'Alice', actual: 'Leanne Graham', passed: false },
        ],
  };
}

function buildDemoTestRun(): Record<string, unknown> {
  const now = Date.now();
  const results = [
    makeDemoResult(0, 'GET', 'Get User 1', 'https://jsonplaceholder.typicode.com/users/1', 200, 145, true),
    makeDemoResult(1, 'GET', 'Get User 2', 'https://jsonplaceholder.typicode.com/users/2', 200, 198, true),
    makeDemoResult(2, 'GET', 'Get User 3', 'https://jsonplaceholder.typicode.com/users/3', 200, 167, true),
    makeDemoResult(3, 'POST', 'Create User', 'https://jsonplaceholder.typicode.com/users', 201, 312, true),
    makeDemoResult(4, 'GET', 'Get User (bad)', 'https://jsonplaceholder.typicode.com/users/1', 200, 156, false),
  ];
  const times = [145, 198, 167, 312, 156];
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const sorted = [...times].sort((a, b) => a - b);
  return {
    id: `${TH7_RUN_PREFIX}-${now}`,
    timestamp: now,
    projectName: 'Demo Project',
    envName: 'demo',
    svcName: 'jsonplaceholder',
    baseUrl: 'https://jsonplaceholder.typicode.com',
    config: {
      concurrency: 1,
      iterations: 1,
      scenarioWeights: [],
      executionMode: 'sequential',
    },
    summary: {
      tps: +(5 / (0.978)).toFixed(1),
      avgResponseTime: Math.round(avg),
      minResponseTime: Math.min(...times),
      maxResponseTime: Math.max(...times),
      p50ResponseTime: sorted[2],
      p95ResponseTime: sorted[4],
      p99ResponseTime: sorted[4],
      errorRate: 0,
      errorsByStatus: {},
      totalRequests: 5,
      successfulRequests: 5,
      failedRequests: 0,
      failedValidations: 1,
      totalDurationMs: 978,
    },
    results,
  };
}

/**
 * Quietly select the first run in the results dropdown if no run is currently selected.
 * Detects selection by checking for the metrics cards element.
 */
export async function ensureResultsRunSelected(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(HAR.METRICS_CARDS)) return;
  const trigger = document.querySelector<HTMLElement>(HAR.RUN_SELECT_TRIGGER);
  if (!trigger) return;
  trigger.click();
  await ctx.delay(300);
  const firstOption = document.querySelector<HTMLElement>(HAR.RUN_SELECT_OPTION);
  if (firstOption) {
    firstOption.click();
    await ctx.delay(400);
  } else {
    document.body.click();
    await ctx.delay(200);
  }
}

export async function seedTh7TestRun(): Promise<void> {
  const w = getDemoBridgeWindow();
  if (!w.__demoSeedTestRun) return;
  await w.__demoSeedTestRun(buildDemoTestRun());
}

export async function deleteTh7TestRuns(): Promise<void> {
  const w = getDemoBridgeWindow();
  if (!w.__demoDeleteTestRuns) return;
  await w.__demoDeleteTestRuns(TH7_RUN_PREFIX);
}

// ─── TH-9 helpers ────────────────────────────────────────────────

export const TH9_FG_NAME = 'Organization Demo';
export const TH9_SC1_NAME = 'User Endpoints';
export const TH9_SC2_NAME = 'Post Endpoints';

export function deleteTh9DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH9_FG_NAME);
}

/**
 * Build 2 version snapshots for a test to demonstrate the History tab.
 * v1 = original URL; v2 = updated URL with added header.
 */
function buildVersionEntries(): Array<Record<string, unknown>> {
  const now = Date.now();
  return [
    {
      id: 'demo-th9-v2',
      timestamp: now - 60_000,
      label: 'Added Accept header',
      changeSummary: 'URL unchanged · 1 header added',
      snapshot: {
        name: 'Get User by ID',
        url: 'https://jsonplaceholder.typicode.com/users/1',
        method: 'GET',
        headers: [{ key: 'Accept', value: 'application/json' }],
        body: '',
        auth: { type: 'none' },
      },
    },
    {
      id: 'demo-th9-v1',
      timestamp: now - 3_600_000,
      label: 'Initial version',
      changeSummary: 'Initial snapshot',
      snapshot: {
        name: 'Get User',
        url: 'https://jsonplaceholder.typicode.com/users',
        method: 'GET',
        headers: [],
        body: '',
        auth: { type: 'none' },
      },
    },
  ];
}

/**
 * Seed TH-9 FG with 2 scenarios, 3 tests, tags, and version history.
 */
export async function seedTh9FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh9Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh9Ids = ids;
    }
  }
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th9-fg',
    name: TH9_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [
      {
        id: 'demo-th9-sc1',
        name: TH9_SC1_NAME,
        kind: 'standard',
        tags: ['smoke'],
        tests: [
          {
            id: 'demo-th9-t1',
            name: 'Get User by ID',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' as const },
            validation: {
              mode: 'none' as const,
              assertions: [{ type: 'status' as const, expected: '200' }],
            },
            definitionVersions: buildVersionEntries(),
          },
          {
            id: 'demo-th9-t2',
            name: 'List All Users',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' as const },
            validation: {
              mode: 'none' as const,
              assertions: [{ type: 'status' as const, expected: '200' }],
            },
          },
        ],
      },
      {
        id: 'demo-th9-sc2',
        name: TH9_SC2_NAME,
        kind: 'standard',
        tests: [
          {
            id: 'demo-th9-t3',
            name: 'Get Post by ID',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' as const },
            validation: {
              mode: 'none' as const,
              assertions: [{ type: 'status' as const, expected: '200' }],
            },
          },
        ],
      },
    ],
  } as Record<string, unknown>);
  await ctx.delay(400);
}

export async function ensureTh9FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH9_FG_NAME);
  if (found) return false;
  await seedTh9FeatureGroup(ctx);
  return true;
}

/** Fill the search bar with the given query text. */
export function fillSearchBar(query: string): void {
  const input = document.querySelector<HTMLInputElement>(HAR.SEARCH_INPUT);
  if (!input) return;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  nativeSetter?.call(input, query);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Clear the search bar. */
export function clearSearchBar(): void {
  fillSearchBar('');
}

/** Click the Trash button in the Scenario Builder header. */
export function clickTrashButton(): void {
  const btns = document.querySelectorAll<HTMLElement>('.header-actions .btn');
  for (const btn of btns) {
    if (btn.textContent?.includes('Trash')) {
      btn.click();
      return;
    }
  }
}

/** Close the Trash panel if open. */
export function closeTrashPanel(): void {
  const panel = document.querySelector<HTMLElement>(HAR.TRASH_PANEL);
  if (!panel) return;
  const closeBtn = panel.querySelector<HTMLElement>('.modal-footer .btn');
  if (closeBtn) closeBtn.click();
}

// ─── TH-10 helpers ────────────────────────────────────────────────

export const TH10_FG_NAME = 'Assertions Demo';
export const TH10_SC_NAME = 'User API';

const TH10_SAMPLE_JSON = JSON.stringify({
  id: 1,
  name: 'Leanne Graham',
  username: 'Bret',
  email: 'Sincere@april.biz',
  address: {
    street: 'Kulas Light',
    suite: 'Apt. 556',
    city: 'Gwenborough',
    zipcode: '92998-3874',
    geo: { lat: '-37.3159', lng: '81.1496' },
  },
  phone: '1-770-736-8031 x56442',
  website: 'hildegard.org',
  company: {
    name: 'Romaguera-Crona',
    catchPhrase: 'Multi-layered client-server neural-net',
    bs: 'harness real-time e-markets',
  },
});

export function deleteTh10DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH10_FG_NAME);
}

export async function seedTh10FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh10Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh10Ids = ids;
    }
  }
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th10-fg',
    name: TH10_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [
      {
        id: 'demo-th10-sc',
        name: TH10_SC_NAME,
        kind: 'standard',
        tests: [
          {
            id: 'demo-th10-t1',
            name: 'Get User by ID',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' as const },
            validation: {
              mode: 'selective' as const,
              sampleJson: TH10_SAMPLE_JSON,
              assertions: [],
              expectedFields: [],
            },
          },
        ],
      },
    ],
  } as Record<string, unknown>);
  await ctx.delay(400);
}

export async function ensureTh10FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH10_FG_NAME);
  if (found) return false;
  await seedTh10FeatureGroup(ctx);
  return true;
}

/** Click + Add button in the assertions section and wait for menu to appear. */
export async function openAssertionAddMenu(ctx: DemoActionContext): Promise<void> {
  const addBtn = document.querySelector<HTMLElement>(HAR.TE_ASSERTIONS_ADD_BTN);
  if (addBtn) {
    addBtn.click();
    await ctx.delay(400);
  }
}

/** Close the assertion add menu if open. */
export function closeAssertionAddMenu(): void {
  const menu = document.querySelector<HTMLElement>(HAR.TE_ASSERTIONS_ADD_MENU);
  if (menu) {
    document.body.click();
  }
}

/** Click an assertion type in the add menu by its label text. */
export async function selectAssertionType(ctx: DemoActionContext, label: string): Promise<void> {
  const items = document.querySelectorAll<HTMLElement>('.aam-grid-item');
  for (const item of items) {
    const itemLabel = item.querySelector<HTMLElement>('.aam-label');
    if (itemLabel?.textContent?.trim() === label) {
      item.click();
      await ctx.delay(500);
      return;
    }
  }
}

/** Navigate to the Validation tab in the test editor. */
export async function clickValidationTab(ctx: DemoActionContext): Promise<void> {
  const tabs = document.querySelectorAll<HTMLElement>('.builder-tab');
  for (const tab of tabs) {
    if (tab.textContent?.includes('Validation')) {
      tab.click();
      await ctx.delay(400);
      return;
    }
  }
}

/** Close the Regex Builder modal if open. */
export function closeRegexBuilderModal(): void {
  const modal = document.querySelector<HTMLElement>(HAR.TE_REGEX_MODAL);
  if (!modal) return;
  const cancelBtn = modal.querySelector<HTMLElement>('.modal-footer .btn:not(.btn-accent)');
  if (cancelBtn) cancelBtn.click();
}

/** Close the assertion presets panel if open. */
export function closePresetsPanel(): void {
  const panel = document.querySelector<HTMLElement>(HAR.TE_PRESETS_MENU);
  if (panel) document.body.click();
}

// ─── TH-11 helpers ────────────────────────────────────────────────

export const TH11_FG_NAME = 'Data Mapper Demo';
export const TH11_SC_NAME = 'User API';

const TH11_SAMPLE_JSON = JSON.stringify({
  id: 1,
  name: 'Leanne Graham',
  username: 'Bret',
  email: 'Sincere@april.biz',
  address: {
    street: 'Kulas Light',
    suite: 'Apt. 556',
    city: 'Gwenborough',
    zipcode: '92998-3874',
  },
  phone: '1-770-736-8031 x56442',
  website: 'hildegard.org',
  company: {
    name: 'Romaguera-Crona',
    catchPhrase: 'Multi-layered client-server neural-net',
    bs: 'harness real-time e-markets',
  },
}, null, 2);

export function deleteTh11DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH11_FG_NAME);
}

export async function seedTh11FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh11Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh11Ids = ids;
    }
  }
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th11-fg',
    name: TH11_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [
      {
        id: 'demo-th11-sc',
        name: TH11_SC_NAME,
        kind: 'standard',
        tests: [
          {
            id: 'demo-th11-t1',
            name: 'Get User by ID',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' as const },
            validation: {
              mode: 'selective' as const,
              sampleJson: TH11_SAMPLE_JSON,
              assertions: [{ type: 'status' as const, expected: '200' }],
              expectedFields: [
                { jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' },
                { jsonPath: '$.email', operator: 'equals', expectedValue: 'Sincere@april.biz' },
              ],
            },
          },
        ],
      },
    ],
  } as Record<string, unknown>);
  await ctx.delay(400);
}

export async function ensureTh11FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH11_FG_NAME);
  if (found) return false;
  await seedTh11FeatureGroup(ctx);
  return true;
}

/** Close the Data Mapper modal if open. */
export function closeDataMapperModal(): void {
  const cancelBtn = document.querySelector<HTMLElement>('.dm-modal-btn--secondary');
  if (cancelBtn) cancelBtn.click();
}

/** Check if the Data Mapper modal is open. */
export function isDataMapperOpen(): boolean {
  return !!document.querySelector(HAR.MAPPER_MODAL);
}

/** Click a toolbar view mode button by its label text. */
export async function clickMapperViewMode(ctx: DemoActionContext, label: string): Promise<void> {
  const btns = document.querySelectorAll<HTMLElement>('.dm-toolbar-btn--quiet');
  for (const btn of btns) {
    if (btn.textContent?.trim() === label) {
      btn.click();
      await ctx.delay(500);
      return;
    }
  }
}

/** Fill the Data Mapper search input. */
export function fillMapperSearch(query: string): void {
  const input = document.querySelector<HTMLInputElement>(HAR.MAPPER_SEARCH);
  if (!input) return;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  nativeSetter?.call(input, query);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Clear the Data Mapper search input. */
export function clearMapperSearch(): void {
  fillMapperSearch('');
  const clearBtn = document.querySelector<HTMLElement>('.dm-search-clear');
  if (clearBtn) clearBtn.click();
}

// ─── TH-12 helpers ────────────────────────────────────────────────

export const TH12_FG_NAME = 'Versioning Demo';
export const TH12_SC_NAME = 'User API';

const TH12_SAMPLE_JSON_V1 = JSON.stringify({
  id: 1,
  name: 'Leanne Graham',
  email: 'Sincere@april.biz',
});

const TH12_SAMPLE_JSON_V2 = JSON.stringify({
  id: 1,
  name: 'Leanne Graham',
  email: 'Sincere@april.biz',
  username: 'Bret',
  phone: '1-770-736-8031 x56442',
});

const TH12_SAMPLE_JSON_V3 = JSON.stringify({
  id: 1,
  name: 'Leanne Graham',
  email: 'Sincere@april.biz',
  username: 'Bret',
  phone: '1-770-736-8031 x56442',
  website: 'hildegard.org',
  company: { name: 'Romaguera-Crona', catchPhrase: 'Multi-layered client-server neural-net' },
});

function buildTh12ResponseVersions(): Array<Record<string, unknown>> {
  const now = Date.now();
  return [
    {
      id: 'demo-th12-rv3',
      timestamp: now - 60_000,
      label: 'Added company data',
      json: TH12_SAMPLE_JSON_V3,
      validationMode: 'selective',
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' },
        { jsonPath: '$.email', operator: 'equals', expectedValue: 'Sincere@april.biz' },
      ],
    },
    {
      id: 'demo-th12-rv2',
      timestamp: now - 3_600_000,
      label: 'Added username & phone',
      json: TH12_SAMPLE_JSON_V2,
      validationMode: 'selective',
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' },
        { jsonPath: '$.email', operator: 'equals', expectedValue: 'Sincere@april.biz' },
      ],
    },
    {
      id: 'demo-th12-rv1',
      timestamp: now - 86_400_000,
      label: 'Initial fetch',
      json: TH12_SAMPLE_JSON_V1,
      validationMode: 'selective',
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' },
      ],
    },
  ];
}

function buildTh12RulesVersions(): Array<Record<string, unknown>> {
  const now = Date.now();
  return [
    {
      id: 'demo-th12-rr2',
      timestamp: now - 120_000,
      label: 'Refined to 2 rules',
      validationMode: 'selective',
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' },
        { jsonPath: '$.email', operator: 'equals', expectedValue: 'Sincere@april.biz' },
      ],
      excludedPaths: [],
      unorderedArrays: false,
      assertions: [],
    },
    {
      id: 'demo-th12-rr1',
      timestamp: now - 7_200_000,
      label: 'Original 4 rules',
      validationMode: 'selective',
      selectiveMode: 'include',
      expectedFields: [
        { jsonPath: '$.id', operator: 'equals', expectedValue: '1' },
        { jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' },
        { jsonPath: '$.email', operator: 'is_not_empty', expectedValue: '' },
        { jsonPath: '$.username', operator: 'equals', expectedValue: 'Bret' },
      ],
      excludedPaths: [],
      unorderedArrays: true,
      assertions: [],
    },
  ];
}

export function deleteTh12DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH12_FG_NAME);
}

export async function seedTh12FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh12Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh12Ids = ids;
    }
  }
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th12-fg',
    name: TH12_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [
      {
        id: 'demo-th12-sc',
        name: TH12_SC_NAME,
        kind: 'standard',
        tests: [
          {
            id: 'demo-th12-t1',
            name: 'Get User by ID',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' as const },
            validation: {
              mode: 'selective' as const,
              selectiveMode: 'include' as const,
              sampleJson: TH12_SAMPLE_JSON_V3,
              expectedFields: [
                { jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' },
                { jsonPath: '$.email', operator: 'equals', expectedValue: 'Sincere@april.biz' },
              ],
              excludedPaths: [],
              unorderedArrays: false,
              assertions: [{ type: 'status' as const, expected: '200' }],
              responseVersions: buildTh12ResponseVersions(),
              rulesVersions: buildTh12RulesVersions(),
            },
          },
        ],
      },
    ],
  } as Record<string, unknown>);
  await ctx.delay(400);
}

export async function ensureTh12FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH12_FG_NAME);
  if (found) return false;
  await seedTh12FeatureGroup(ctx);
  return true;
}

/** Find and click a row action button by its text within a version panel. */
export function clickVersionRowAction(
  panelSel: string,
  rowIndex: number,
  buttonText: string,
): boolean {
  const panel = document.querySelector<HTMLElement>(panelSel);
  if (!panel) return false;
  const items = panel.querySelectorAll<HTMLElement>('.version-item');
  const row = items[rowIndex];
  if (!row) return false;
  const btns = row.querySelectorAll<HTMLElement>('.version-item-actions .btn');
  for (const btn of btns) {
    if (btn.textContent?.trim() === buttonText) {
      btn.click();
      return true;
    }
  }
  return false;
}

/** Close the Version Preview modal if open. */
export function closeVersionPreviewModal(): void {
  const actions = document.querySelector<HTMLElement>('.vp-footer-actions');
  if (!actions) return;
  const btns = actions.querySelectorAll<HTMLElement>('.vp-btn');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Close') { btn.click(); return; }
  }
}

/** Close the Version Diff modal if open. */
export function closeVersionDiffModal(): void {
  const footer = document.querySelector<HTMLElement>('.version-diff-footer');
  if (!footer) return;
  const btns = footer.querySelectorAll<HTMLElement>('.btn');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Close') { btn.click(); return; }
  }
}

// ─── TH-13 helpers ────────────────────────────────────────────────

export const TH13_FG_NAME = 'SLA Demo';
export const TH13_SC_NAME = 'User Endpoints';

export function deleteTh13DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH13_FG_NAME);
}

export async function seedTh13FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh13Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh13Ids = ids;
    }
  }
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th13-fg',
    name: TH13_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [
      {
        id: 'demo-th13-sc',
        name: TH13_SC_NAME,
        kind: 'standard',
        tests: [
          {
            id: 'demo-th13-t1',
            name: 'Get User by ID',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' as const },
            validation: {
              mode: 'selective' as const,
              selectiveMode: 'include' as const,
              sampleJson: JSON.stringify({ id: 1, name: 'Leanne Graham', email: 'Sincere@april.biz' }),
              expectedFields: [
                { jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' },
              ],
              assertions: [{ type: 'status' as const, expected: '200' }],
            },
          },
        ],
      },
    ],
  } as Record<string, unknown>);
  await ctx.delay(400);
}

export async function ensureTh13FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH13_FG_NAME);
  if (found) return false;
  await seedTh13FeatureGroup(ctx);
  return true;
}

/** Find the SLA button on the first test card. */
export function findSlaButton(): HTMLElement | null {
  const cards = document.querySelectorAll<HTMLElement>('[data-testid="har-test-card"]');
  for (const card of cards) {
    const btn = card.querySelector<HTMLElement>('.test-card-actions .btn');
    if (btn?.textContent?.includes('🎯')) return btn;
  }
  return null;
}

/** Close the TestSlaModal if open. */
export function closeSlaModal(): void {
  const modal = document.querySelector<HTMLElement>(HAR.SLA_MODAL);
  if (!modal) return;
  const btns = modal.querySelectorAll<HTMLElement>('.sla-editor-actions .btn');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Cancel') { btn.click(); return; }
  }
}

/** Click Save in the TestSlaModal. */
export function saveSlaModal(): void {
  const modal = document.querySelector<HTMLElement>(HAR.SLA_MODAL);
  if (!modal) return;
  const btns = modal.querySelectorAll<HTMLElement>('.sla-editor-actions .btn');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Save') { btn.click(); return; }
  }
}

/** Close the SLA Override modal if open (clicks Cancel). */
export function closeSlaOverrideModal(): void {
  const modal = document.querySelector<HTMLElement>(HAR.SLA_OVERRIDE_MODAL);
  if (!modal) return;
  const actions = modal.querySelector<HTMLElement>('.sla-modal-footer-actions');
  if (!actions) return;
  const btns = actions.querySelectorAll<HTMLElement>('.btn');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Cancel') { btn.click(); return; }
  }
}

// ─── TH-14 helpers ────────────────────────────────────────────────

export const TH14_FG_NAME = 'Auth Demo';
export const TH14_SC_NAME = 'User Endpoints';
export const TH14_PROFILE_NAME = 'Corp OAuth2';
export const TH14_PROFILE_ID = 'demo-th14-profile';

export function deleteTh14DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH14_FG_NAME);
}

export function seedTh14GlobalProfile(): void {
  getDemoBridgeWindow().__demoUpsertGlobalAuthProfile?.({
    id: TH14_PROFILE_ID,
    name: TH14_PROFILE_NAME,
    auth: {
      type: 'oauth2' as const,
      tokenUrl: 'https://auth.example.com/oauth/token',
      clientId: 'demo-client-id',
      clientSecret: 'demo-client-secret',
    },
  });
}

export function purgeTh14GlobalProfile(): void {
  getDemoBridgeWindow().__demoPurgeGlobalAuthProfiles?.(
    [TH14_PROFILE_NAME],
    [TH14_PROFILE_ID],
  );
}

export async function seedTh14FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh14Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh14Ids = ids;
    }
  }
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th14-fg',
    name: TH14_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    auth: { type: 'inherit' as const },
    globalAuthProfileId: TH14_PROFILE_ID,
    scenarios: [
      {
        id: 'demo-th14-sc',
        name: TH14_SC_NAME,
        kind: 'standard',
        tests: [
          {
            id: 'demo-th14-t1',
            name: 'Get User by ID',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'inherit' as const },
          },
          {
            id: 'demo-th14-t2',
            name: 'List All Users',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'inherit' as const },
          },
        ],
      },
    ],
  } as Record<string, unknown>);
  await ctx.delay(400);
}

export async function ensureTh14FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH14_FG_NAME);
  if (found) return false;
  await seedTh14FeatureGroup(ctx);
  return true;
}

/** Find an Auth button by text inside a container. */
export function findAuthButton(container: HTMLElement): HTMLElement | null {
  const btns = container.querySelectorAll<HTMLElement>('.btn');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Auth') return btn;
  }
  return null;
}

/** Close the Feature Auth panel if open. */
export function closeFgAuthPanel(): void {
  const panel = document.querySelector<HTMLElement>(HAR.FEATURE_AUTH_PANEL);
  if (!panel) return;
  const fgActions = panel.closest('[data-testid="har-fg-card"]')?.querySelector<HTMLElement>('.feature-group-actions');
  if (!fgActions) return;
  const authBtn = findAuthButton(fgActions);
  if (authBtn) authBtn.click();
}

/** Close the Scenario Auth panel if open. */
export function closeScenarioAuthPanel(): void {
  const panel = document.querySelector<HTMLElement>(HAR.AUTH_PANEL);
  if (!panel || panel.classList.contains('feature-auth-panel')) return;
  const scHeader = panel.closest('[data-testid="har-scenario-card"]')?.querySelector<HTMLElement>('.scenario-group-actions');
  if (!scHeader) return;
  const authBtn = findAuthButton(scHeader);
  if (authBtn) authBtn.click();
}

// ─── TH-15 helpers ────────────────────────────────────────────────

export const TH15_FG_NAME = 'Import Export Demo';
export const TH15_SC_NAME = 'User API';

const TH15_SAMPLE_JSON = JSON.stringify({
  id: 1,
  name: 'Leanne Graham',
  email: 'Sincere@april.biz',
  username: 'Bret',
});

export function deleteTh15DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH15_FG_NAME);
}

export async function seedTh15FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh15Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh15Ids = ids;
    }
  }
  if (!ids) return;

  const now = Date.now();
  w.__demoSeedFeatureGroup?.({
    id: 'demo-th15-fg',
    name: TH15_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [
      {
        id: 'demo-th15-sc',
        name: TH15_SC_NAME,
        kind: 'standard',
        tests: [
          {
            id: 'demo-th15-t1',
            name: 'Create User',
            method: 'POST',
            url: 'https://jsonplaceholder.typicode.com/users',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'Authorization', value: 'Bearer demo-token-xyz' },
            ],
            body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
            auth: { type: 'none' as const },
            validation: {
              mode: 'selective' as const,
              selectiveMode: 'include' as const,
              sampleJson: TH15_SAMPLE_JSON,
              expectedFields: [
                { jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' },
              ],
              assertions: [{ type: 'status' as const, expected: '201' }],
              responseVersions: [
                { id: 'th15-rv2', timestamp: now - 60_000, label: 'Added username', json: TH15_SAMPLE_JSON, validationMode: 'selective', selectiveMode: 'include', expectedFields: [{ jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' }] },
                { id: 'th15-rv1', timestamp: now - 3_600_000, label: 'Initial response', json: JSON.stringify({ id: 1, name: 'Leanne Graham' }), validationMode: 'selective', selectiveMode: 'include', expectedFields: [] },
              ],
              rulesVersions: [
                { id: 'th15-rr1', timestamp: now - 120_000, label: 'Original rules', validationMode: 'selective', selectiveMode: 'include', expectedFields: [{ jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' }], excludedPaths: [], unorderedArrays: false, assertions: [] },
              ],
            },
          },
        ],
      },
    ],
  } as Record<string, unknown>);
  await ctx.delay(400);
}

export async function ensureTh15FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH15_FG_NAME);
  if (found) return false;
  await seedTh15FeatureGroup(ctx);
  return true;
}

/** Find a mode button by its text label in the test editor header. */
export function findModeButton(label: string): HTMLElement | null {
  const btns = document.querySelectorAll<HTMLElement>(HAR.MODE_BTN);
  for (const btn of btns) {
    if (btn.textContent?.trim() === label) return btn;
  }
  return null;
}

/** Close the Export Options popover if open. */
export function closeExportPopover(): void {
  const popover = document.querySelector<HTMLElement>(HAR.EXPORT_POPOVER);
  if (!popover) return;
  const btns = popover.querySelectorAll<HTMLElement>('.btn');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Cancel') { btn.click(); return; }
  }
}

// ─── TH-16 helpers ────────────────────────────────────────────────

export const TH16_FG1_NAME = 'User API Tests';
export const TH16_FG2_NAME = 'Admin API Tests';

export function deleteTh16DemoFgs(): void {
  const w = getDemoBridgeWindow();
  w.__demoDeleteFeatureGroupsByName?.(TH16_FG1_NAME);
  w.__demoDeleteFeatureGroupsByName?.(TH16_FG2_NAME);
}

export async function seedTh16FeatureGroups(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh16Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh16Ids = ids;
    }
  }
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th16-fg1',
    name: TH16_FG1_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [
      {
        id: 'demo-th16-sc1',
        name: 'User Endpoints',
        kind: 'standard',
        tags: ['smoke', 'regression'],
        tests: [
          { id: 'demo-th16-t1', name: 'Get User by ID', method: 'GET', url: '/users/1', headers: [{ key: 'Accept', value: 'application/json' }], body: '', auth: { type: 'none' as const } },
          { id: 'demo-th16-t2', name: 'Create User', method: 'POST', url: '/users', headers: [{ key: 'Content-Type', value: 'application/json' }], body: '{"name":"Alice"}', auth: { type: 'bearer' as const, token: 'tok' } },
          { id: 'demo-th16-t3', name: 'Update User', method: 'PUT', url: '/users/1', headers: [{ key: 'Content-Type', value: 'application/json' }], body: '{"name":"Bob"}', auth: { type: 'bearer' as const, token: 'tok' } },
        ],
      },
      {
        id: 'demo-th16-sc2',
        name: 'Profile Endpoints',
        kind: 'standard',
        tags: ['regression'],
        tests: [
          { id: 'demo-th16-t4', name: 'Get Profile', method: 'GET', url: '/profile', headers: [], body: '', auth: { type: 'none' as const } },
        ],
      },
    ],
  } as Record<string, unknown>);

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th16-fg2',
    name: TH16_FG2_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [
      {
        id: 'demo-th16-sc3',
        name: 'Admin Operations',
        kind: 'standard',
        tags: ['critical'],
        tests: [
          { id: 'demo-th16-t5', name: 'List Admin Users', method: 'GET', url: '/admin/users', headers: [], body: '', auth: { type: 'none' as const } },
          { id: 'demo-th16-t6', name: 'Delete User', method: 'DELETE', url: '/admin/users/1', headers: [], body: '', auth: { type: 'bearer' as const, token: 'admin-tok' } },
        ],
      },
    ],
  } as Record<string, unknown>);
  await ctx.delay(400);
}

export async function ensureTh16FgsExist(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const names = Array.from(cards).map(el => el.textContent?.trim());
  if (names.includes(TH16_FG1_NAME) && names.includes(TH16_FG2_NAME)) return false;
  await seedTh16FeatureGroups(ctx);
  return true;
}

/** Close the PopupModal (Copy/Move) if open by clicking Cancel. */
export function closePopupModal(): void {
  const modals = document.querySelectorAll<HTMLElement>('.popup-modal');
  for (const modal of modals) {
    const btns = modal.querySelectorAll<HTMLElement>('.btn');
    for (const btn of btns) {
      if (btn.textContent?.trim() === 'Cancel') { btn.click(); return; }
    }
  }
}

/** Find a test card action button by text within a specific test card. */
export function findTestCardAction(card: HTMLElement, label: string): HTMLElement | null {
  const btns = card.querySelectorAll<HTMLElement>('.test-card-actions .btn');
  for (const btn of btns) {
    if (btn.textContent?.trim() === label) return btn;
  }
  return null;
}

// ─── TH-17 helpers ────────────────────────────────────────────────

export const TH17_FG_NAME = 'Expressions & DSL Demo';
export const TH17_SC_NAME = 'User API';

const TH17_SAMPLE_JSON = JSON.stringify({
  id: 1,
  name: 'Leanne Graham',
  username: 'Bret',
  email: 'Sincere@april.biz',
  phone: '1-770-736-8031 x56442',
  website: 'hildegard.org',
  address: {
    street: 'Kulas Light',
    city: 'Gwenborough',
    zipcode: '92998-3874',
  },
  company: {
    name: 'Romaguera-Crona',
    catchPhrase: 'Multi-layered client-server neural-net',
  },
});

export function deleteTh17DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH17_FG_NAME);
}

export async function seedTh17FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh17Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh17Ids = ids;
    }
  }
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th17-fg',
    name: TH17_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [
      {
        id: 'demo-th17-sc',
        name: TH17_SC_NAME,
        kind: 'standard',
        tests: [
          {
            id: 'demo-th17-t1',
            name: 'Get User Details',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' as const },
            validation: {
              mode: 'selective' as const,
              sampleJson: TH17_SAMPLE_JSON,
              assertions: [{ type: 'status' as const, expected: '200' }],
              expectedFields: [
                { jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' },
                { jsonPath: '$.email', operator: 'equals', expectedValue: 'Sincere@april.biz' },
                { jsonPath: '$.username', operator: 'is_not_empty', expectedValue: '' },
              ],
            },
          },
        ],
      },
    ],
  } as Record<string, unknown>);
  await ctx.delay(400);
}

export async function ensureTh17FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH17_FG_NAME);
  if (found) return false;
  await seedTh17FeatureGroup(ctx);
  return true;
}

/** Check if the Expression Editor modal is open. */
export function isExpressionEditorOpen(): boolean {
  return !!document.querySelector(HAR.EXPR_MODAL);
}

/** Close the Expression Editor modal by clicking Cancel. */
export function closeExpressionEditor(): void {
  const footer = document.querySelector<HTMLElement>(HAR.EXPR_FOOTER);
  if (!footer) return;
  const btns = footer.querySelectorAll<HTMLElement>('button');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Cancel') { btn.click(); return; }
  }
}

/** Check if the Validation Rules Modal is open. */
export function isRulesModalOpen(): boolean {
  return !!document.querySelector(HAR.VR_MODAL);
}

/** Close the Validation Rules Modal by clicking Cancel. */
export function closeRulesModal(): void {
  const modal = document.querySelector<HTMLElement>(HAR.VR_MODAL);
  if (!modal) return;
  const btns = modal.querySelectorAll<HTMLElement>('.vr-modal-actions button');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Cancel') { btn.click(); return; }
  }
}

/** Click the "Rules" button in the Data Mapper toolbar. */
export function clickRulesToolbarButton(): void {
  const btns = document.querySelectorAll<HTMLElement>('.dm-toolbar-btn--quiet');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Rules') { btn.click(); return; }
  }
}

/** Click the "Reference" toggle in the Validation Rules Modal. */
export function clickRulesReference(): void {
  const modal = document.querySelector<HTMLElement>(HAR.VR_MODAL);
  if (!modal) return;
  const btns = modal.querySelectorAll<HTMLElement>('.vr-modal-header-actions button');
  for (const btn of btns) {
    if (btn.textContent?.trim().includes('Reference')) { btn.click(); return; }
  }
}

// ─── TH-18 helpers ────────────────────────────────────────────────

export const TH18_FG_NAME = 'Data Source Advanced Demo';
export const TH18_SC_NAME = 'User Tests';

export function deleteTh18DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH18_FG_NAME);
}

export async function seedTh18FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh18Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh18Ids = ids;
    }
  }
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th18-fg',
    name: TH18_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [
      {
        id: 'demo-th18-sc',
        name: TH18_SC_NAME,
        kind: 'parameterized',
        tests: [
          {
            id: 'demo-th18-t1',
            name: 'Get User by ID',
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' as const },
            validation: {
              mode: 'selective' as const,
              assertions: [{ type: 'status' as const, expected: '200' }],
              expectedFields: [
                { jsonPath: '$.name', operator: 'equals', expectedValue: '{{expectedName}}' },
              ],
            },
            dataSource: {
              id: 'demo-th18-ds',
              label: 'User IDs',
              columns: [
                { id: 'col-uid', name: 'userId', type: 'path' as const, mapping: 'userId' },
                { id: 'col-name', name: 'expectedName', type: 'validate' as const, mapping: 'expectedName' },
              ],
              rows: [
                { id: 'row-1', label: 'Admin User', values: { 'col-uid': '1', 'col-name': 'Leanne Graham' }, enabled: true },
                { id: 'row-2', label: 'Regular User', values: { 'col-uid': '2', 'col-name': 'Ervin Howell' }, enabled: true },
                { id: 'row-3', label: 'Power User', values: { 'col-uid': '3', 'col-name': 'Clementine Bauch' }, enabled: true },
              ],
              source: { type: 'inline' as const },
              urlTemplate: 'https://jsonplaceholder.typicode.com/users/{{userId}}',
            },
          },
        ],
      },
    ],
  } as Record<string, unknown>);
  await ctx.delay(400);
}

export async function ensureTh18FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH18_FG_NAME);
  if (found) return false;
  await seedTh18FeatureGroup(ctx);
  return true;
}

/** Find a Data Source toolbar button by its title attribute. */
export function findDsToolbarBtn(title: string): HTMLElement | null {
  const btns = document.querySelectorAll<HTMLElement>('.data-source-toolbar-btn');
  for (const btn of btns) {
    if (btn.title?.includes(title) || btn.textContent?.includes(title)) return btn;
  }
  return null;
}

/** Close the Row Detail Modal if open. */
export function closeRowDetailModal(): void {
  const modal = document.querySelector<HTMLElement>(HAR.ROW_DETAIL_MODAL);
  if (!modal) return;
  const btns = modal.querySelectorAll<HTMLElement>('.modal-footer button, .wf-config-modal-footer button');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Close' || btn.textContent?.trim() === 'Cancel') {
      btn.click(); return;
    }
  }
}

/** Close the Verify Modal if open. */
export function closeVerifyModal(): void {
  const modal = document.querySelector<HTMLElement>(HAR.VERIFY_MODAL);
  if (!modal) return;
  const footer = modal.querySelector<HTMLElement>('.verify-modal-footer');
  if (footer) {
    const closeBtn = Array.from(footer.querySelectorAll<HTMLElement>('button'))
      .find(b => b.textContent?.trim() === 'Close');
    if (closeBtn) { closeBtn.click(); return; }
  }
  const overlay = document.querySelector<HTMLElement>('.verify-modal-overlay');
  if (overlay) overlay.click();
}

/** Close the Shared DS Modal if open. */
export function closeSharedDsModal(): void {
  const modal = document.querySelector<HTMLElement>(HAR.SHARED_DS_MODAL);
  if (!modal) return;
  const btns = modal.querySelectorAll<HTMLElement>('.shared-ds-footer button');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Close' || btn.textContent?.trim() === 'Cancel') {
      btn.click(); return;
    }
  }
}

/** Toggle the Contract panel off (click Contract button if panel is open). */
export function closeContractPanel(): void {
  if (!document.querySelector(HAR.CONTRACT_PANEL)) return;
  const btn = findDsToolbarBtn('Contract');
  if (btn) btn.click();
}

// ─── TH-19 helpers ────────────────────────────────────────────────

export const TH19_FG_NAME = 'Schema Drift Demo';
export const TH19_SC_NAME = 'User API';
export const TH19_TEST_ID = 'demo-th19-t1';

const TH19_CURRENT_SAMPLE = {
  id: 1,
  name: 'Leanne Graham',
  user_name: 'Bret',
  email: 'Sincere@april.biz',
  phone: '1-770-736-8031 x56442',
  website: 'hildegard.org',
  age: 28,
  metadata: { version: '2.1', region: 'US' },
};

const TH19_OLD_SNAPSHOT_FIELDS = [
  { path: 'id', type: 'number', depth: 0, nullable: false, isArrayElement: false },
  { path: 'name', type: 'string', depth: 0, nullable: false, isArrayElement: false },
  { path: 'userName', type: 'string', depth: 0, nullable: false, isArrayElement: false },
  { path: 'email', type: 'string', depth: 0, nullable: false, isArrayElement: false },
  { path: 'phone', type: 'string', depth: 0, nullable: false, isArrayElement: false },
  { path: 'website', type: 'string', depth: 0, nullable: false, isArrayElement: false },
  { path: 'age', type: 'string', depth: 0, nullable: false, isArrayElement: false },
];

function buildOldSnapshot(): Record<string, unknown> {
  const contextId = `validation:${TH19_TEST_ID}`;
  return {
    source: [{
      id: `snap-${contextId}-src`,
      contextId,
      side: 'source',
      sourceId: undefined,
      fields: TH19_OLD_SNAPSHOT_FIELDS,
      capturedAt: new Date(Date.now() - 86400000).toISOString(),
      topLevelKeyCount: TH19_OLD_SNAPSHOT_FIELDS.length,
    }],
    target: null,
  };
}

export function deleteTh19DemoFg(): void {
  getDemoBridgeWindow().__demoDeleteFeatureGroupsByName?.(TH19_FG_NAME);
  try {
    localStorage.removeItem(`dm-schema-snapshot-validation:${TH19_TEST_ID}`);
  } catch { /* noop */ }
}

export async function seedTh19FeatureGroup(ctx: DemoActionContext): Promise<void> {
  const w = getDemoBridgeWindow();
  let ids = (window as unknown as Record<string, unknown>).__demoTh19Ids as { envId: string; svcId: string } | undefined;
  if (!ids) {
    const fresh = w.__demoSeedHarnessTarget?.();
    if (fresh) {
      w.__demoSelectEnvSvc?.(fresh.envId, fresh.svcId);
      ids = fresh;
      (window as unknown as Record<string, unknown>).__demoTh19Ids = ids;
    }
  }
  if (!ids) return;

  w.__demoSeedFeatureGroup?.({
    id: 'demo-th19-fg',
    name: TH19_FG_NAME,
    environmentId: ids.envId,
    microserviceId: ids.svcId,
    scenarios: [{
      id: 'demo-th19-sc',
      name: TH19_SC_NAME,
      kind: 'standard',
      tests: [{
        id: TH19_TEST_ID,
        name: 'Get User by ID',
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/users/1',
        headers: [{ key: 'Accept', value: 'application/json' }],
        body: '',
        auth: { type: 'none' as const },
        validation: {
          mode: 'selective' as const,
          sampleJson: JSON.stringify(TH19_CURRENT_SAMPLE),
          assertions: [{ type: 'status' as const, expected: '200' }],
          expectedFields: [
            { jsonPath: '$.name', operator: 'equals', expectedValue: 'Leanne Graham' },
            { jsonPath: '$.userName', operator: 'equals', expectedValue: 'Bret' },
            { jsonPath: '$.email', operator: 'equals', expectedValue: 'Sincere@april.biz' },
          ],
        },
      }],
    }],
  } as Record<string, unknown>);
  await ctx.delay(400);
}

/** Inject a fake old snapshot so drift is detected when the mapper opens. */
export function injectTh19OldSnapshot(): void {
  try {
    const key = `dm-schema-snapshot-validation:${TH19_TEST_ID}`;
    localStorage.setItem(key, JSON.stringify(buildOldSnapshot()));
  } catch { /* noop */ }
}

export async function ensureTh19FgExists(ctx: DemoActionContext): Promise<boolean> {
  const cards = document.querySelectorAll<HTMLElement>(HAR.FG_NAME);
  const found = Array.from(cards).some(el => el.textContent?.trim() === TH19_FG_NAME);
  if (found) return false;
  await seedTh19FeatureGroup(ctx);
  return true;
}

/** Close the Schema Diff Modal if open. */
export function closeDiffModal(): void {
  const modal = document.querySelector<HTMLElement>(HAR.DIFF_SHELL);
  if (!modal) return;
  const btns = modal.querySelectorAll<HTMLElement>('.dm-diff-footer button');
  for (const btn of btns) {
    if (btn.textContent?.trim() === 'Close') { btn.click(); return; }
  }
}

/** Check if the Drift Banner is visible. */
export function isDriftBannerVisible(): boolean {
  return !!document.querySelector(HAR.DRIFT_BANNER);
}

/** Check if the Schema Diff Modal is open. */
export function isDiffModalOpen(): boolean {
  return !!document.querySelector(HAR.DIFF_SHELL);
}

// ─── TH-20 helpers ────────────────────────────────────────────────

const TH20_RUN_PREFIX = 'demo-th20-run';

function makeTh20Result(
  idx: number,
  method: string,
  name: string,
  url: string,
  status: number,
  responseTimeMs: number,
  passed: boolean,
  scenario: string,
): Record<string, unknown> {
  return {
    id: `${TH20_RUN_PREFIX}-r${idx}`,
    testName: name,
    method,
    url,
    httpStatus: status,
    responseTime: responseTimeMs,
    responseTimeMs,
    passed,
    error: passed ? undefined : 'Status mismatch: expected 200 got 500',
    timing: {
      dnsMs: 2 + Math.random() * 3,
      tcpMs: 8 + Math.random() * 5,
      tlsMs: 12 + Math.random() * 8,
      ttfbMs: responseTimeMs * 0.6,
      downloadMs: responseTimeMs * 0.15,
    },
    scenarioName: scenario,
    featureGroupName: 'Baseline Demo',
  };
}

function buildSummary(results: Array<Record<string, unknown>>): Record<string, unknown> {
  const times = results.map(r => r.responseTimeMs as number);
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const errorCount = results.filter(r => (r.httpStatus as number) >= 400).length;
  const totalMs = times.reduce((a, b) => a + b, 0);

  return {
    tps: +(times.length / (totalMs / 1000)).toFixed(1),
    avgResponseTime: Math.round(avg),
    minResponseTime: Math.min(...times),
    maxResponseTime: Math.max(...times),
    p50ResponseTime: sorted[Math.floor(sorted.length * 0.5)],
    p95ResponseTime: sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1],
    p99ResponseTime: sorted[Math.floor(sorted.length * 0.99)] ?? sorted[sorted.length - 1],
    p999ResponseTime: sorted[sorted.length - 1],
    errorRate: (errorCount / times.length) * 100,
    errorsByStatus: errorCount > 0 ? { 500: errorCount } : {},
    totalRequests: times.length,
    successfulRequests: times.length - errorCount,
    failedRequests: errorCount,
    failedValidations: 0,
    totalDurationMs: totalMs,
  };
}

function buildTh20Run(runIdx: number, timeMultiplier: number, errorRate: number): Record<string, unknown> {
  const now = Date.now();
  const base = [
    { method: 'GET', name: 'List Users', url: 'https://jsonplaceholder.typicode.com/users', scenario: 'User API' },
    { method: 'GET', name: 'Get User 1', url: 'https://jsonplaceholder.typicode.com/users/1', scenario: 'User API' },
    { method: 'POST', name: 'Create User', url: 'https://jsonplaceholder.typicode.com/users', scenario: 'User API' },
    { method: 'GET', name: 'List Posts', url: 'https://jsonplaceholder.typicode.com/posts', scenario: 'Post API' },
    { method: 'GET', name: 'Get Post 1', url: 'https://jsonplaceholder.typicode.com/posts/1', scenario: 'Post API' },
  ];

  const baseTimes = [120, 95, 210, 140, 105];
  const results = base.map((req, i) => {
    const time = Math.round(baseTimes[i] * timeMultiplier + (Math.random() * 20 - 10));
    const isError = i === base.length - 1 && errorRate > 0 && Math.random() < errorRate;
    return makeTh20Result(
      runIdx * 10 + i, req.method, req.name, req.url,
      isError ? 500 : (req.method === 'POST' ? 201 : 200),
      time, !isError, req.scenario,
    );
  });

  return {
    id: `${TH20_RUN_PREFIX}-${runIdx}-${now}`,
    timestamp: now - (2 - runIdx) * 3_600_000,
    projectName: 'Demo Project',
    envName: 'demo',
    svcName: 'jsonplaceholder',
    baseUrl: 'https://jsonplaceholder.typicode.com',
    config: { concurrency: 1, iterations: 1, scenarioWeights: [], executionMode: 'sequential' },
    summary: buildSummary(results),
    results,
  };
}

export async function seedTh20TestRuns(): Promise<void> {
  const w = getDemoBridgeWindow();
  if (!w.__demoSeedTestRun) return;

  const run1 = buildTh20Run(0, 1.0, 0);
  const run2 = buildTh20Run(1, 1.45, 0.2);

  await w.__demoSeedTestRun(run1 as never);
  await w.__demoSeedTestRun(run2 as never);

  const baselines = await import('../../../../../src/features/results/utils/runBaselines');
  await baselines.markAsBaseline(run1.id as string, 'Fast baseline');
}

export async function deleteTh20TestRuns(): Promise<void> {
  const w = getDemoBridgeWindow();
  if (!w.__demoDeleteTestRuns) return;
  await w.__demoDeleteTestRuns(TH20_RUN_PREFIX);

  const blMod = await import('../../../../../src/features/results/utils/runBaselines');
  const baselines = await blMod.loadBaselines();
  const filtered = baselines.filter(b => !b.runId.startsWith(TH20_RUN_PREFIX));
  if (filtered.length !== baselines.length) await blMod.saveBaselines(filtered);
}

export async function ensureTh20RunsExist(): Promise<boolean> {
  const storageMod = await import('../../../../../src/shared/utils/storage');
  const all = await storageMod.loadTestRuns();
  const found = all.some(r => r.id.startsWith(TH20_RUN_PREFIX));
  if (found) return false;
  await seedTh20TestRuns();
  return true;
}

/** Ensure we're on the Comparison & Trends tab. */
export function switchToAnalysisTab(): void {
  const tab = document.querySelector<HTMLElement>(HAR.TAB_ANALYSIS);
  if (tab) tab.click();
}

/** Check if the comparison export menu is open. */
export function isExportMenuOpen(): boolean {
  return !!document.querySelector(HAR.COMPARISON_EXPORT_MENU);
}

/** Close the comparison export menu if open. */
export function closeExportMenu(): void {
  if (isExportMenuOpen()) document.body.click();
}

