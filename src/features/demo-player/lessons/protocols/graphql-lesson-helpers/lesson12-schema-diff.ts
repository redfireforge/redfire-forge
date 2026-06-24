// ── Lesson 12: Schema Diff ─────────────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import type { GraphqlSchemaSnapshot } from '../../../../../shared/types/graphql';
import { GQL } from '../../../../../shared/selectors';
import {
  GQL_DEMO_CONNECTION_ID,
  ensureDemoEndpoint,
  ensureEditorMode,
  ensureIntrospected,
  gqlDemoSnapshotConnectionIds,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
} from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import {
  ensureSchemaExplorerOpen,
  resetGqlLesson4SessionFlags,
} from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { resetGqlLesson6SessionFlags } from './lesson6-auth-headers';
import { resetGqlLesson7SessionFlags } from './lesson7-query-builder';
import { resetGqlLesson8SessionFlags } from './lesson8-collections-history';
import { resetGqlLesson9SessionFlags } from './lesson9-export-share';
import { resetGqlLesson10SessionFlags } from './lesson10-performance-tracing';
import { resetGqlLesson11SessionFlags } from './lesson11-workflow-integration';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';
import {
  deleteSnapshot,
  loadSnapshots,
  saveSnapshot,
} from '../../../adapters';

const LESSON12_BASELINE_LABEL = 'Prior release (demo)';

async function closeDiffModalIfOpen(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.DIFF_MODAL)) return;
  const doneBtn = document.querySelector<HTMLElement>(GQL.DIFF_DONE);
  if (doneBtn) {
    doneBtn.click();
    await ctx.delay(700);
    _lesson12DiffOpen = false;
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
let _lesson12DiffOpen = false;
let _lesson12FiltersDemoed = false;
let _lesson12Exported = false;

export function resetGqlLesson12SessionFlags(): void {
  _lesson12StartTime = 0;
  _lesson12BaselineId = '';
  _lesson12SnapshotSaved = false;
  _lesson12ChangelogOpen = false;
  _lesson12DiffOpen = false;
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
  await ctx.delay(500);

  const compareSelect = document.querySelector<HTMLSelectElement>(GQL.CHANGELOG_COMPARE_SELECT);
  if (compareSelect && compareSelect.value !== '') {
    compareSelect.value = '';
    compareSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await ctx.delay(300);
  }
  return true;
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
  await ensureSchemaExplorerOpen(ctx);
  const typesTab = document.querySelector<HTMLElement>(GQL.SE_TAB_TYPES);
  if (typesTab && !typesTab.classList.contains('gql-se-main-tab--active')) {
    await ctx.click(GQL.SE_TAB_TYPES);
    await ctx.delay(500);
  }
}

/** Click Save snapshot — persists current introspected SDL. */
export async function ensureLesson12SnapshotSaved(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12TypesTab(ctx);
  if (_lesson12SnapshotSaved && document.querySelectorAll(GQL.CHANGELOG_ROW).length >= 1) {
    return;
  }
  await ctx.waitFor(GQL.SAVE_SNAPSHOT_BTN, 5000);
  await ctx.click(GQL.SAVE_SNAPSHOT_BTN);
  await ctx.delay(1200);
  _lesson12SnapshotSaved = true;
}

/** Open the Changelog tab with at least one snapshot row visible. */
export async function ensureLesson12ChangelogOpen(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12SnapshotSaved(ctx);
  if (_lesson12ChangelogOpen && document.querySelector(GQL.CHANGELOG_PANEL)) return;
  await ctx.click(GQL.CHANGELOG_TAB);
  await ctx.waitFor(GQL.CHANGELOG_PANEL, 5000);
  await ctx.waitFor(GQL.CHANGELOG_ROW, 5000);
  markLesson12BaselineRow();
  await ctx.delay(1000);
  _lesson12ChangelogOpen = true;
}

/** Notify GraphQL Studio to reload snapshots from storage (demo lesson re-seed). */
export function notifyGqlSnapshotsChanged(): void {
  window.dispatchEvent(new CustomEvent('rf-gql-snapshots-changed'));
}

/** Ensure baseline row is visible in changelog (re-seed, expand list, mark for spotlight). */
export async function ensureLesson12BaselineReady(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12ChangelogOpen(ctx);

  const hasBaselineInDom = () =>
    [...document.querySelectorAll<HTMLElement>(GQL.CHANGELOG_ROW)].some((row) =>
      row.textContent?.includes(LESSON12_BASELINE_LABEL),
    );

  if (!hasBaselineInDom()) {
    await ensureLesson12BaselineSnapshot();
    notifyGqlSnapshotsChanged();
    await ctx.delay(900);
  }

  const showMore = document.querySelector<HTMLElement>(GQL.CHANGELOG_SHOW_MORE);
  if (showMore) {
    await ctx.click(GQL.CHANGELOG_SHOW_MORE);
    await ctx.delay(500);
  }

  if (!hasBaselineInDom()) {
    await ensureLesson12BaselineSnapshot();
    notifyGqlSnapshotsChanged();
    await ctx.delay(900);
  }

  markLesson12BaselineRow();
  await ctx.delay(400);
}

/** Open diff modal — baseline snapshot vs current schema. */
export async function ensureLesson12DiffOpen(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12BaselineReady(ctx);
  if (_lesson12DiffOpen && document.querySelector(GQL.DIFF_MODAL)) return;

  const baselineSelected = await selectBaselineChangelogRow(ctx);
  if (!baselineSelected) {
    await ensureLesson12BaselineSnapshot();
    notifyGqlSnapshotsChanged();
    await ctx.delay(900);
    markLesson12BaselineRow();
    await selectBaselineChangelogRow(ctx);
  }

  await ctx.click(GQL.CHANGELOG_DIFF_BTN);
  await ctx.waitFor(GQL.DIFF_MODAL, 5000);
  await ctx.delay(800);
  _lesson12DiffOpen = true;
}

/** Cycle severity filters in the diff modal (breaking → safe → deprecated). */
export async function ensureLesson12DiffFilters(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12DiffOpen(ctx);
  if (_lesson12FiltersDemoed) return;
  await ctx.click(GQL.DIFF_FILTER_BREAKING);
  await ctx.delay(1200);
  await ctx.click(GQL.DIFF_FILTER_SAFE);
  await ctx.delay(1200);
  await ctx.click(GQL.DIFF_FILTER_DEPRECATED);
  await ctx.delay(1200);
  await ctx.click(GQL.DIFF_FILTER_ALL);
  await ctx.delay(800);
  _lesson12FiltersDemoed = true;
}

/** Click Export diff as JSON in the diff modal footer. */
export async function ensureLesson12DiffExported(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12DiffOpen(ctx);
  if (_lesson12Exported) return;
  await ctx.waitFor(GQL.DIFF_EXPORT_JSON, 5000);
  await ctx.click(GQL.DIFF_EXPORT_JSON);
  await ctx.delay(2000);
  await closeDiffModalIfOpen(ctx);
  _lesson12Exported = true;
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

/** Setup for Lesson 12 (GQL-12) — demo tab; introspect Docker server and seed baseline. */
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

  await ensureEditorMode(ctx);
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
    await ctx.delay(200);
  }

  await ensureGqlDemoTab(ctx, 'gql-schema-diff', 'Schema Diff & Breaking Changes');
  await ensureDemoEndpoint(ctx);
  await ensureIntrospected(ctx);
  await ensureLesson12BaselineSnapshot();
  notifyGqlSnapshotsChanged();
}

/** Cleanup for Lesson 12 (GQL-12) — remove snapshots, close demo tab. */
export async function gqlSchemaDiffLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await cleanupLesson12Snapshots();
  resetGqlLesson12SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-schema-diff');
}

