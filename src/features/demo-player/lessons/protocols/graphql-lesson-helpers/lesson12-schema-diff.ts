// ── Lesson 12: Schema Diff ─────────────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import {
  GQL_DEMO_HTTP,
  ensureDemoEndpoint,
  ensureEditorMode,
  ensureIntrospected,
  getEndpointInput,
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

/** Label on the seeded prior-release snapshot (compare-to-current shows real diffs). */
export const LESSON12_BASELINE_LABEL = 'Prior release (demo)';

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

/** Seed a prior-release snapshot in IDB (silent setup — UI refreshes after step 1 save). */
export async function ensureLesson12BaselineSnapshot(): Promise<void> {
  if (_lesson12BaselineId) return;
  const { loadSnapshots, saveSnapshot } = await import(
    '../../../../graphql/utils/schemaSnapshot'
  );
  const existing = await loadSnapshots(GQL_DEMO_HTTP);
  const found = existing.find((s) => s.label === LESSON12_BASELINE_LABEL);
  if (found) {
    _lesson12BaselineId = found.id;
    return;
  }
  const id = crypto.randomUUID();
  await saveSnapshot({
    id,
    connectionId: GQL_DEMO_HTTP,
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
  const typesTab = document.querySelector<HTMLElement>('[data-testid="gql-se-tab-types"]');
  if (typesTab && !typesTab.classList.contains('gql-se-main-tab--active')) {
    await ctx.click('[data-testid="gql-se-tab-types"]');
    await ctx.delay(400);
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
  await ctx.delay(700);
  _lesson12SnapshotSaved = true;
}

/** Open the Changelog tab with at least one snapshot row visible. */
export async function ensureLesson12ChangelogOpen(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12SnapshotSaved(ctx);
  if (_lesson12ChangelogOpen && document.querySelector(GQL.CHANGELOG_PANEL)) return;
  await ctx.click(GQL.CHANGELOG_TAB);
  await ctx.waitFor(GQL.CHANGELOG_PANEL, 5000);
  await ctx.waitFor(GQL.CHANGELOG_ROW, 5000);
  await ctx.delay(800);
  _lesson12ChangelogOpen = true;
}

/** Open diff modal — baseline snapshot vs current schema. */
export async function ensureLesson12DiffOpen(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12ChangelogOpen(ctx);
  if (_lesson12DiffOpen && document.querySelector(GQL.DIFF_MODAL)) return;
  const row = findBaselineChangelogRow();
  if (row) {
    row.setAttribute('data-lesson-target', 'baseline');
    await ctx.click('[data-lesson-target="baseline"] [data-testid="gql-changelog-diff-btn"]');
  } else {
    await ctx.click(GQL.CHANGELOG_DIFF_BTN);
  }
  await ctx.waitFor(GQL.DIFF_MODAL, 5000);
  await ctx.delay(800);
  _lesson12DiffOpen = true;
}

/** Cycle severity filters in the diff modal (breaking → safe → deprecated). */
export async function ensureLesson12DiffFilters(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12DiffOpen(ctx);
  if (_lesson12FiltersDemoed) return;
  await ctx.click(GQL.DIFF_FILTER_BREAKING);
  await ctx.delay(600);
  await ctx.click(GQL.DIFF_FILTER_SAFE);
  await ctx.delay(600);
  await ctx.click(GQL.DIFF_FILTER_DEPRECATED);
  await ctx.delay(600);
  _lesson12FiltersDemoed = true;
}

/** Click Export diff as JSON in the diff modal footer. */
export async function ensureLesson12DiffExported(ctx: DemoActionContext): Promise<void> {
  await ensureLesson12DiffOpen(ctx);
  if (_lesson12Exported) return;
  await ctx.waitFor(GQL.DIFF_EXPORT_JSON, 5000);
  await ctx.click(GQL.DIFF_EXPORT_JSON);
  await ctx.delay(700);
  _lesson12Exported = true;
}

async function cleanupLesson12Snapshots(): Promise<void> {
  try {
    const { loadSnapshots, deleteSnapshot } = await import(
      '../../../../graphql/utils/schemaSnapshot'
    );
    const snaps = await loadSnapshots(GQL_DEMO_HTTP);
    for (const s of snaps) {
      const isBaseline = s.id === _lesson12BaselineId || s.label === LESSON12_BASELINE_LABEL;
      const isLessonCapture = _lesson12StartTime > 0 && s.capturedAt >= _lesson12StartTime;
      if (isBaseline || isLessonCapture) {
        await deleteSnapshot(s.id);
      }
    }
  } catch {
    // IDB unavailable in tests — ignore
  }
}

/** Setup for Lesson 12 — introspect Docker server and seed prior-release baseline. */
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

  const input = getEndpointInput();
  if (input?.value.trim()) {
    await ctx.fill(GQL.ENDPOINT_INPUT, '');
    await ctx.delay(200);
  }

  await ensureDemoEndpoint(ctx);
  await ensureIntrospected(ctx);
  await ensureLesson12BaselineSnapshot();
}

/** Cleanup for Lesson 12 — remove seeded and lesson-captured snapshots. */
export async function gqlSchemaDiffLessonCleanup(ctx: DemoActionContext): Promise<void> {
  await cleanupLesson12Snapshots();
  resetGqlLesson12SessionFlags();
  await ctx.delay(100);
}

