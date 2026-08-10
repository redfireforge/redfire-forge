// ── Lesson 12: Schema Diff ─────────────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import type { GraphqlSchemaSnapshot } from '@shared/types/graphql';
import { GQL } from '@shared/selectors';
import {
  GQL_DEMO_CONNECTION_ID,
  GQL_DEMO_HTTP,
  ensureDemoTabDirectHttpEndpoint,
  ensureEditorMode,
  ensureIntrospectedOnDirectEndpoint,
  gqlDemoSnapshotConnectionIds,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
} from './core';
import { navigateToGraphqlStudio } from '../../env-manager-lesson-helpers';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import {
  ensureSchemaExplorerOpen,
  resetGqlLesson4SessionFlags,
} from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { closeEnvIfOpen, resetGqlLesson6SessionFlags } from './lesson6-auth-headers';
import { resetGqlLesson7SessionFlags } from './lesson7-query-builder';
import { resetGqlLesson8SessionFlags } from './lesson8-collections-history';
import { resetGqlLesson9SessionFlags } from './lesson9-export-share';
import { resetGqlLesson10SessionFlags } from './lesson10-performance-tracing';
import { resetGqlLesson11SessionFlags } from './lesson11-workflow-integration';
import { closeGqlDemoTabs, ensureGqlDemoTab, activateGqlDemoTabQuiet } from './gql-demo-tab';
import { spotlightAndPause } from './gql-demo-spotlight';
import {
  deleteSnapshot,
  loadSnapshots,
  patchDemoTabConnection,
  saveSnapshot,
} from '../../../adapters';

const LESSON12_BASELINE_LABEL = 'Prior release (demo)';

/** Keep waits under DEMO_ACTION_TIMEOUT_MS (16s) — stacked 5s waits were timing out compare/export. */
const L12_WAIT_MS = 2_500;
const L12_HOLD_MS = 500;

async function closeDiffModalIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.DIFF_MODAL)) return;
  const doneBtn = document.querySelector<HTMLElement>(GQL.DIFF_DONE);
  if (doneBtn) {
    doneBtn.click();
    await ctx.delay(L12_HOLD_MS);
  }
}

/** Label on the seeded prior-release snapshot (compare-to-current shows real diffs). */
export { LESSON12_BASELINE_LABEL };

/**
 * Older SDL variant for the Docker test server — extra `Query.users`, no `User.email`.
 * Compared to the live introspected schema this yields BREAKING + SAFE rows.
 */
export const LESSON12_BASELINE_SDL = `
type Query {
  health: String
  user(id: ID!): User
  users: [User!]!
}

type User {
  id: ID!
  name: String!
}

input OrderInput {
  customerId: ID!
  items: [String!]
}

type Order {
  id: ID!
  status: OrderStatusEnum!
  customerId: ID!
}

enum OrderStatusEnum {
  PENDING
  PROCESSING
  COMPLETE
}

type OrderStatus {
  status: OrderStatusEnum!
  updatedAt: String!
}

type Mutation {
  createOrder(input: OrderInput!): Order!
  createUser(name: String!, email: String!): User!
  deleteUser(id: ID!): DeleteResult!
}

type DeleteResult {
  success: Boolean!
}

type Subscription {
  orderStatus(orderId: ID!): OrderStatus!
}
`;

let _lesson12StartTime = 0;
let _lesson12BaselineId = '';
let _lesson12SnapshotSaved = false;
let _lesson12ChangelogOpen = false;
let _lesson12FiltersDemoed = false;
let _lesson12Exported = false;

/** True when the Schema Diff modal is visible — background tab clicks must not run. */
function isLesson12DiffModalOpen(): boolean {
  return !!document.querySelector(GQL.DIFF_MODAL);
}

/** Skip schema-explorer navigation when the diff modal is open (preAction on later steps). */
function skipWhenDiffModalOpen(): boolean {
  return isLesson12DiffModalOpen();
}

export function resetGqlLesson12SessionFlags(): void {
  _lesson12StartTime = 0;
  _lesson12BaselineId = '';
  _lesson12SnapshotSaved = false;
  _lesson12ChangelogOpen = false;
  _lesson12FiltersDemoed = false;
  _lesson12Exported = false;
}

function findBaselineChangelogRow(): HTMLElement | null {
  const rows = document.querySelectorAll<HTMLElement>(GQL.CHANGELOG_ROW);
  for (const row of rows) {
    if (row.textContent?.includes(LESSON12_BASELINE_LABEL)) return row;
  }
  return rows[0] ?? null;
}

async function findExistingBaselineSnapshot(): Promise<{
  snapshot: GraphqlSchemaSnapshot;
  connectionId: string;
} | null> {
  for (const connectionId of gqlDemoSnapshotConnectionIds()) {
    const found = (await loadSnapshots(connectionId)).find(
      (s) => s.label === LESSON12_BASELINE_LABEL,
    );
    if (found) return { snapshot: found, connectionId };
  }
  return null;
}

/** Set CustomSelect value without opening the menu (avoids portal wait / flicker). */
function setChangelogCompareValue(value: string): void {
  const wrapper = document.querySelector(GQL.CHANGELOG_COMPARE_SELECT);
  if (!wrapper) return;
  if (wrapper.getAttribute('data-value') === value) return;
  wrapper.dispatchEvent(
    new CustomEvent('custom-select:set-value', { detail: { value }, bubbles: true }),
  );
}

/** Select the prior-release baseline row and ensure compare target is the live schema. */
async function selectBaselineChangelogRow(ctx: DemoActionContext): Promise<boolean> {
  markLesson12BaselineRow();
  let row = document.querySelector<HTMLElement>(GQL.CHANGELOG_BASELINE_ROW);
  if (!row) {
    row = findBaselineChangelogRow();
    row?.setAttribute('data-lesson-baseline', 'true');
  }
  if (!row) return false;

  await ctx.click(GQL.CHANGELOG_BASELINE_ROW);
  await ctx.delay(L12_HOLD_MS);

  setChangelogCompareValue('');
  await ctx.delay(150);
  return true;
}

/** loadSnapshots with a hard cap — IDB stalls must not burn the 16s action budget. */
async function loadSnapshotsBounded(connectionId: string, timeoutMs = 1_200): Promise<GraphqlSchemaSnapshot[]> {
  try {
    return await Promise.race([
      loadSnapshots(connectionId),
      new Promise<GraphqlSchemaSnapshot[]>((resolve) => {
        setTimeout(() => resolve([]), timeoutMs);
      }),
    ]);
  } catch {
    return [];
  }
}

/**
 * View diff is disabled when currentSdl is empty and compare target is "Current schema".
 * Fall back to comparing against another saved snapshot so the button enables.
 */
async function enableLesson12ViewDiffButton(ctx: DemoActionContext): Promise<void> {
  const btn = document.querySelector<HTMLButtonElement>(GQL.CHANGELOG_DIFF_BTN);
  if (!btn || !btn.disabled) return;

  const snaps = await loadSnapshotsBounded(GQL_DEMO_CONNECTION_ID);
  const baseline =
    snaps.find((s) => s.label === LESSON12_BASELINE_LABEL)
    ?? snaps.find((s) => s.id === _lesson12BaselineId)
    ?? null;
  const other = snaps.find((s) => s.id !== baseline?.id);
  if (!other) return;
  setChangelogCompareValue(other.id);
  await ctx.delay(200);
}

/** Mark the baseline snapshot row so lesson spotlights target the correct diff button. */
export function markLesson12BaselineRow(): void {
  document.querySelectorAll('[data-lesson-baseline="true"]').forEach((el) => {
    el.removeAttribute('data-lesson-baseline');
  });
  const row = findBaselineChangelogRow();
  if (row) row.setAttribute('data-lesson-baseline', 'true');
}

/** Seed a prior-release snapshot in IDB (silent setup — UI refreshes after step 1 save). */
export async function ensureLesson12BaselineSnapshot(): Promise<void> {
  if (_lesson12BaselineId) return;

  const existing = await findExistingBaselineSnapshot();
  if (existing) {
    const { snapshot, connectionId } = existing;
    if (connectionId === GQL_DEMO_CONNECTION_ID) {
      _lesson12BaselineId = snapshot.id;
      return;
    }
    await deleteSnapshot(snapshot.id);
    await saveSnapshot({ ...snapshot, connectionId: GQL_DEMO_CONNECTION_ID });
    _lesson12BaselineId = snapshot.id;
    return;
  }

  const id = crypto.randomUUID();
  await saveSnapshot({
    id,
    connectionId: GQL_DEMO_CONNECTION_ID,
    sdl: LESSON12_BASELINE_SDL,
    typesCount: 10,
    capturedAt: Date.now() - 7 * 86_400_000,
    label: LESSON12_BASELINE_LABEL,
  });
  _lesson12BaselineId = id;
}

/** Open Schema Explorer on the Types tab (Save snapshot lives here). */
export async function ensureLesson12TypesTab(ctx: DemoActionContext): Promise<void> {
  if (skipWhenDiffModalOpen()) return;

  // Never call ensureSchemaExplorerOpen here — it waits on SCHEMA_TYPE_LIST (unmounted
  // on Changelog) and re-introspects, which exceeds DEMO_ACTION_TIMEOUT_MS.
  const schemaTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_SCHEMA);
  if (schemaTab && schemaTab.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GQL.RIGHT_TAB_SCHEMA);
    await ctx.delay(300);
  }

  const typesTab = document.querySelector<HTMLElement>(GQL.SE_TAB_TYPES);
  if (typesTab && !typesTab.classList.contains('gql-se-main-tab--active')) {
    await ctx.click(GQL.SE_TAB_TYPES);
    await ctx.delay(L12_HOLD_MS);
  }

  // Setup already introspected — only wait briefly for Save Snapshot to remount.
  if (!document.querySelector(GQL.SAVE_SNAPSHOT_BTN)) {
    await ctx.waitFor(GQL.SAVE_SNAPSHOT_BTN, L12_WAIT_MS);
  }

  // Last resort (badge missing): one introspect — still capped by L12 waits inside.
  if (
    !document.querySelector(GQL.SAVE_SNAPSHOT_BTN)
    && !document.querySelector(GQL.SCHEMA_BADGE_OK)
  ) {
    await ensureSchemaExplorerOpen(ctx);
  }
}

/** Click Save snapshot — persists current introspected SDL. */
export async function ensureLesson12SnapshotSaved(ctx: DemoActionContext): Promise<void> {
  if (skipWhenDiffModalOpen()) return;
  if (_lesson12SnapshotSaved && document.querySelectorAll(GQL.CHANGELOG_ROW).length >= 1) {
    return;
  }
  await ensureLesson12TypesTab(ctx);
  await ctx.waitFor(GQL.SAVE_SNAPSHOT_BTN, L12_WAIT_MS);
  if (!document.querySelector(GQL.SAVE_SNAPSHOT_BTN)) return;
  await ctx.click(GQL.SAVE_SNAPSHOT_BTN);
  await ctx.delay(800);
  _lesson12SnapshotSaved = true;
}

/** Step-1 action beat: hold Save Snapshot before click so the control is clearly taught. */
export async function performLesson12SnapshotSaveWithPause(ctx: DemoActionContext): Promise<void> {
  if (skipWhenDiffModalOpen()) return;
  await ensureLesson12TypesTab(ctx);
  await ctx.waitFor(GQL.SAVE_SNAPSHOT_BTN, L12_WAIT_MS);
  await spotlightAndPause(ctx, GQL.SAVE_SNAPSHOT_BTN, 900);
  await ensureLesson12SnapshotSaved(ctx);
}

function isLesson12ChangelogTabActive(): boolean {
  const tab = document.querySelector<HTMLElement>(GQL.CHANGELOG_TAB);
  return !!tab && tab.classList.contains('gql-se-main-tab--active');
}

/** Open the Changelog tab with at least one snapshot row visible. */
export async function ensureLesson12ChangelogOpen(ctx: DemoActionContext): Promise<void> {
  if (skipWhenDiffModalOpen()) return;

  const hasChangelogRows = () =>
    !!document.querySelector(GQL.CHANGELOG_PANEL) && !!document.querySelector(GQL.CHANGELOG_ROW);

  // Session flag: already opened and rows still present (tests mock click without toggling tab class).
  if (_lesson12ChangelogOpen && hasChangelogRows()) {
    markLesson12BaselineRow();
    return;
  }

  // Live UI: Changelog tab already active with rows.
  if (isLesson12ChangelogTabActive() && hasChangelogRows()) {
    markLesson12BaselineRow();
    _lesson12ChangelogOpen = true;
    return;
  }

  // Prefer switching to Changelog before re-saving / re-introspecting.
  // (Changelog panel may stay mounted while Types is active — still click the tab.)
  if (document.querySelector(GQL.CHANGELOG_TAB)) {
    if (!isLesson12ChangelogTabActive()) {
      await ctx.click(GQL.CHANGELOG_TAB);
    }
    await ctx.waitFor(GQL.CHANGELOG_PANEL, L12_WAIT_MS);
    if (hasChangelogRows()) {
      markLesson12BaselineRow();
      await ctx.delay(L12_HOLD_MS);
      _lesson12ChangelogOpen = true;
      return;
    }
  }

  await ensureLesson12SnapshotSaved(ctx);
  if (_lesson12ChangelogOpen && hasChangelogRows()) return;
  await ctx.click(GQL.CHANGELOG_TAB);
  await ctx.waitFor(GQL.CHANGELOG_PANEL, L12_WAIT_MS);
  await ctx.waitFor(GQL.CHANGELOG_ROW, L12_WAIT_MS);
  markLesson12BaselineRow();
  await ctx.delay(L12_HOLD_MS);
  _lesson12ChangelogOpen = true;
}

/** Notify GraphQL Studio to reload snapshots from storage (demo lesson re-seed). */
export function notifyGqlSnapshotsChanged(): void {
  window.dispatchEvent(new CustomEvent('rf-gql-snapshots-changed'));
}

/** Ensure baseline row is visible in changelog (re-seed, expand list, mark for spotlight). */
export async function ensureLesson12BaselineReady(ctx: DemoActionContext): Promise<void> {
  if (skipWhenDiffModalOpen()) return;
  await ensureLesson12ChangelogOpen(ctx);

  const hasBaselineInDom = () =>
    [...document.querySelectorAll<HTMLElement>(GQL.CHANGELOG_ROW)].some((row) =>
      row.textContent?.includes(LESSON12_BASELINE_LABEL),
    );

  if (!hasBaselineInDom()) {
    await ensureLesson12BaselineSnapshot();
    notifyGqlSnapshotsChanged();
    await ctx.delay(600);
  }

  const showMore = document.querySelector<HTMLElement>(GQL.CHANGELOG_SHOW_MORE);
  if (showMore && !hasBaselineInDom()) {
    await ctx.click(GQL.CHANGELOG_SHOW_MORE);
    await ctx.delay(300);
  }

  if (!hasBaselineInDom()) {
    await ensureLesson12BaselineSnapshot();
    notifyGqlSnapshotsChanged();
    await ctx.delay(600);
  }

  markLesson12BaselineRow();
  await ctx.delay(200);
}

/** Click View diff and wait for the modal — returns false if it never appears. */
async function clickLesson12ViewDiff(ctx: DemoActionContext): Promise<boolean> {
  await enableLesson12ViewDiffButton(ctx);
  const btn = document.querySelector<HTMLButtonElement>(GQL.CHANGELOG_DIFF_BTN);
  if (!btn || btn.disabled) return false;
  await ctx.click(GQL.CHANGELOG_DIFF_BTN);
  await ctx.waitFor(GQL.DIFF_MODAL, L12_WAIT_MS);
  if (!isLesson12DiffModalOpen()) return false;
  await ctx.delay(600);
  return true;
}

/**
 * Visible compare-step action — select baseline + View diff only.
 * Prep (changelog / seed) must run in preAction; do not re-introspect here.
 */
export async function performLesson12CompareDiff(ctx: DemoActionContext): Promise<void> {
  if (isLesson12DiffModalOpen()) return;
  await selectBaselineChangelogRow(ctx);
  if (await clickLesson12ViewDiff(ctx)) return;
  markLesson12BaselineRow();
  await selectBaselineChangelogRow(ctx);
  await clickLesson12ViewDiff(ctx);
}

/**
 * Visible export-step action — Export JSON + close only.
 * Modal must already be open from preAction (ensureLesson12DiffOpen).
 */
export async function performLesson12ExportDiff(ctx: DemoActionContext): Promise<void> {
  if (_lesson12Exported && !isLesson12DiffModalOpen()) return;
  if (!isLesson12DiffModalOpen()) {
    // Lightweight recovery only — no changelog/introspect chain.
    await performLesson12CompareDiff(ctx);
  }
  if (_lesson12Exported) return;
  if (!document.querySelector(GQL.DIFF_EXPORT_JSON)) {
    await ctx.waitFor(GQL.DIFF_EXPORT_JSON, L12_WAIT_MS);
  }
  if (!document.querySelector(GQL.DIFF_EXPORT_JSON)) return;

  await ctx.click(GQL.DIFF_EXPORT_JSON);
  await ctx.delay(900);
  await closeDiffModalIfOpen(ctx);
  _lesson12Exported = true;
}

/** Open diff modal — baseline snapshot vs current schema (safe for preAction). */
export async function ensureLesson12DiffOpen(ctx: DemoActionContext): Promise<void> {
  if (isLesson12DiffModalOpen()) return;

  await ensureLesson12BaselineReady(ctx);
  if (isLesson12DiffModalOpen()) return;

  let baselineSelected = await selectBaselineChangelogRow(ctx);
  if (!baselineSelected) {
    await ensureLesson12BaselineSnapshot();
    notifyGqlSnapshotsChanged();
    await ctx.delay(600);
    markLesson12BaselineRow();
    baselineSelected = await selectBaselineChangelogRow(ctx);
  }
  if (!baselineSelected && !document.querySelector(GQL.CHANGELOG_DIFF_BTN)) return;

  if (await clickLesson12ViewDiff(ctx)) return;

  markLesson12BaselineRow();
  await selectBaselineChangelogRow(ctx);
  await clickLesson12ViewDiff(ctx);
}

/** Cycle severity filters in the diff modal (breaking → safe → deprecated). */
export async function ensureLesson12DiffFilters(ctx: DemoActionContext): Promise<void> {
  if (!isLesson12DiffModalOpen()) {
    await ensureLesson12DiffOpen(ctx);
  }
  if (_lesson12FiltersDemoed) return;
  await ctx.click(GQL.DIFF_FILTER_BREAKING);
  await ctx.delay(700);
  await ctx.click(GQL.DIFF_FILTER_SAFE);
  await ctx.delay(700);
  await ctx.click(GQL.DIFF_FILTER_DEPRECATED);
  await ctx.delay(700);
  await ctx.click(GQL.DIFF_FILTER_ALL);
  await ctx.delay(500);
  _lesson12FiltersDemoed = true;
}

/** @deprecated Prefer performLesson12ExportDiff for the timed action step. */
export async function ensureLesson12DiffExported(ctx: DemoActionContext): Promise<void> {
  await performLesson12ExportDiff(ctx);
}

async function cleanupLesson12Snapshots(): Promise<void> {
  try {
    const seen = new Set<string>();
    for (const connectionId of gqlDemoSnapshotConnectionIds()) {
      const snaps = await loadSnapshots(connectionId);
      for (const s of snaps) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        const isBaseline = s.id === _lesson12BaselineId || s.label === LESSON12_BASELINE_LABEL;
        const isLessonCapture = _lesson12StartTime > 0 && s.capturedAt >= _lesson12StartTime;
        if (isBaseline || isLessonCapture) {
          await deleteSnapshot(s.id);
        }
      }
    }
  } catch {
    // IDB unavailable in tests — ignore
  }
}

/**
 * Setup for Lesson 12 (GQL-12) — demo tab + direct HTTP introspect + baseline seed.
 * Never open Environment Manager or the GraphQL Env modal.
 */
export async function gqlSchemaDiffLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();
  resetGqlLesson7SessionFlags();
  resetGqlLesson8SessionFlags();
  resetGqlLesson9SessionFlags();
  resetGqlLesson10SessionFlags();
  resetGqlLesson11SessionFlags();
  resetGqlLesson12SessionFlags();
  _lesson12StartTime = Date.now();

  await navigateToGraphqlStudio(ctx);
  await ensureEditorMode(ctx);
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
    await ctx.delay(200);
  }

  await ensureGqlDemoTab(ctx, 'gql-schema-diff', 'Schema Diff & Breaking Changes');
  await patchDemoTabConnection({
    endpoint: GQL_DEMO_HTTP,
    skipTlsVerify: undefined,
    tlsCaCert: undefined,
    tlsClientCert: undefined,
    tlsClientKey: undefined,
  });
  await activateGqlDemoTabQuiet(ctx);
  await ensureDemoTabDirectHttpEndpoint(ctx);
  await ensureIntrospectedOnDirectEndpoint(ctx);
  await closeEnvIfOpen(ctx);
  await ensureLesson12BaselineSnapshot();
  notifyGqlSnapshotsChanged();
}

/** Cleanup for Lesson 12 (GQL-12) — remove snapshots, close demo tab. */
export async function gqlSchemaDiffLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await cleanupLesson12Snapshots();
  resetGqlLesson12SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-schema-diff');
}

