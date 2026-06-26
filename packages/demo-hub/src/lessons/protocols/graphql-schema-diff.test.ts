/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql12'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import { gqlSchemaDiffLesson } from './graphql-schema-diff';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  LESSON12_BASELINE_LABEL,
  LESSON12_BASELINE_SDL,
  GQL_DEMO_CONNECTION_ID,
  resetGqlLesson12SessionFlags,
  resetGqlLessonSessionFlags,
  ensureLesson12SnapshotSaved,
  ensureLesson12ChangelogOpen,
  ensureLesson12DiffOpen,
  ensureLesson12DiffFilters,
  ensureLesson12DiffExported,
  ensureLesson12TypesTab,
  ensureLesson12BaselineSnapshot,
  gqlSchemaDiffLessonSetup,
  gqlSchemaDiffLessonCleanup,
} from './graphql-lesson-helpers';
import { computeSchemaDiff } from '../../adapters';

/** Current Docker test server SDL (subset used for diff validation). */
const LESSON12_CURRENT_SDL = `
  type Query {
    health: String
    user(id: ID!): User
  }

  type User {
    id: ID!
    name: String!
    email: String!
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

const DIFF_MODAL_HTML = `
    <div data-testid="gql-diff-modal">
      <span class="gql-diff-count gql-diff-count--breaking">1 Breaking</span>
      <div class="gql-diff-filters">
        <button class="gql-diff-filter gql-diff-filter--all">All</button>
        <button class="gql-diff-filter gql-diff-filter--breaking">Breaking</button>
        <button class="gql-diff-filter gql-diff-filter--safe">Safe</button>
        <button class="gql-diff-filter gql-diff-filter--deprecated">Deprecated</button>
      </div>
      <div class="gql-diff-content">
        <div data-testid="gql-diff-row"></div>
      </div>
      <button data-testid="gql-diff-export-json">Export JSON</button>
      <button data-testid="gql-diff-done">Done</button>
    </div>`;

function stubSchemaExplorerDom(options?: { withDiffModal?: boolean }): void {
  const withDiffModal = options?.withDiffModal ?? false;
  document.body.innerHTML = `
    <button data-testid="gql-se-tab-types" class="gql-se-main-tab--active"></button>
    <button data-testid="gql-se-save-snapshot"></button>
    <button data-testid="gql-se-tab-changelog"></button>
    <div data-testid="gql-changelog-panel">
      <div data-testid="gql-changelog-row">
        <span class="gql-changelog-row-label">Snapshot</span>
      </div>
      <div data-testid="gql-changelog-row">
        <span class="gql-changelog-row-label">${LESSON12_BASELINE_LABEL}</span>
      </div>
      <div data-testid="gql-changelog-compare-bar">
        <select data-testid="gql-changelog-compare-select">
          <option value="">Current schema</option>
        </select>
        <button data-testid="gql-changelog-diff-btn">View diff</button>
      </div>
    </div>
    ${withDiffModal ? DIFF_MODAL_HTML : ''}
    <div data-testid="gql-schema-explorer"></div>
    <div data-testid="gql-se-type-list"></div>
    <span data-testid="gql-schema-badge-ok"></span>
    <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
  `;
}

describe('gql-schema-diff lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson12SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Lesson structure ───────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlSchemaDiffLesson.id).toBe('gql-schema-diff');
    expect(gqlSchemaDiffLesson.category).toBe('graphql');
    expect(gqlSchemaDiffLesson.name).toBe('Schema Diff & Breaking Changes');
    expect(gqlSchemaDiffLesson.steps.length).toBe(7);
    expect(gqlSchemaDiffLesson.estimatedMinutes).toBe(4);
    expect(gqlSchemaDiffLesson.tabBudget).toBe(1);
  });

  it('declares allowedTabs for environments and graphql-studio so EM setup does not auto-exit demo', () => {
    expect(gqlSchemaDiffLesson.allowedTabs).toContain('environments');
    expect(gqlSchemaDiffLesson.allowedTabs).toContain('graphql-studio');
  });

  it('has docker prerequisite fields', () => {
    expect(gqlSchemaDiffLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlSchemaDiffLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlSchemaDiffLesson.steps.map((s) => s.id)).toEqual([
      'gql12-save-snapshot',
      'gql12-changelog',
      'gql12-compare',
      'gql12-diff-modal',
      'gql12-breaking',
      'gql12-filters',
      'gql12-export',
    ]);
  });

  it('all 7 steps have pauseAfter configured', () => {
    gqlSchemaDiffLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBeTruthy();
    });
  });

  it('stateful steps have preAction guards', () => {
    gqlSchemaDiffLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  // ── Concept content ────────────────────────────────────────────────────────

  it('concept title explains schema drift detection', () => {
    expect(gqlSchemaDiffLesson.concept.title).toContain('Schema Diff');
    expect(gqlSchemaDiffLesson.concept.title).toContain('Breaks');
  });

  it('concept body explains WHY schema drift is a risk', () => {
    expect(gqlSchemaDiffLesson.concept.body).toContain('living contracts');
    expect(gqlSchemaDiffLesson.concept.body).toContain('silent');
  });

  it('concept body explains WHY snapshots are point-in-time', () => {
    expect(gqlSchemaDiffLesson.concept.body).toContain('point in time');
    expect(gqlSchemaDiffLesson.concept.body).toContain('IndexedDB');
  });

  it('concept body explains all four severity levels', () => {
    expect(gqlSchemaDiffLesson.concept.body).toContain('Breaking');
    expect(gqlSchemaDiffLesson.concept.body).toContain('Dangerous');
    expect(gqlSchemaDiffLesson.concept.body).toContain('Safe');
    expect(gqlSchemaDiffLesson.concept.body).toContain('Deprecated');
  });

  it('concept body explains WHY JSON export enables CI/CD gating', () => {
    expect(gqlSchemaDiffLesson.concept.body).toContain('CI/CD');
    expect(gqlSchemaDiffLesson.concept.body).toContain('breakingCount');
  });

  it('concept body explains the seeded baseline approach', () => {
    expect(gqlSchemaDiffLesson.concept.body).toContain('prior-release baseline');
    expect(gqlSchemaDiffLesson.concept.body).toContain('4010');
  });

  it('has exactly 5 key terms', () => {
    expect(gqlSchemaDiffLesson.concept.keyTerms.length).toBe(5);
  });

  it('key terms cover: Snapshot, Breaking, Safe, Compare to current, Diff export', () => {
    const terms = gqlSchemaDiffLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Snapshot');
    expect(terms).toContain('Breaking change');
    expect(terms).toContain('Safe change');
    expect(terms).toContain('Compare to current');
    expect(terms).toContain('Diff export (JSON)');
  });

  it('Snapshot key term explains per-endpoint persistence', () => {
    const snapshot = gqlSchemaDiffLesson.concept.keyTerms.find((k) => k.term === 'Snapshot')!;
    expect(snapshot.definition).toContain('endpoint URL');
    expect(snapshot.definition).toContain('IndexedDB');
  });

  it('Breaking change key term explains client impact', () => {
    const breaking = gqlSchemaDiffLesson.concept.keyTerms.find((k) => k.term === 'Breaking change')!;
    expect(breaking.definition).toContain('fail');
    expect(breaking.definition).toContain('migration');
  });

  // ── Diagram ────────────────────────────────────────────────────────────────

  it('diagram has 700x430 studio chrome dimensions', () => {
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
  });

  it('diagram includes window chrome traffic lights', () => {
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('#ff5f57');
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('#febc2e');
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('#28c840');
  });

  it('diagram shows Changelog tab as active', () => {
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('Changelog');
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('fill="#3b82f6"');
  });

  it('diagram shows Prior Release baseline row', () => {
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('Prior Release');
  });

  it('diagram includes diff modal with Breaking and Safe count badges', () => {
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('Schema Diff');
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('Breaking');
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('Safe');
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('#ef4444');
  });

  it('diagram shows diff rows with field paths', () => {
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('Query.users');
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('User.email');
  });

  it('diagram includes Export diff as JSON footer button', () => {
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('Export diff as JSON');
  });

  it('diagram includes severity filter tabs', () => {
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('Deprecated');
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('SDL Diff');
  });

  it('diagram includes bottom pipeline legend', () => {
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('Snapshot');
    expect(gqlSchemaDiffLesson.concept.diagram).toContain('CI/CD gate');
  });

  // ── Step spotlights ────────────────────────────────────────────────────────

  it('gql12-save-snapshot highlights SAVE_SNAPSHOT_BTN', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-save-snapshot')!;
    expect(step.highlight).toBe(GQL.SAVE_SNAPSHOT_BTN);
  });

  it('gql12-changelog highlights CHANGELOG_TAB', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-changelog')!;
    expect(step.highlight).toBe(GQL.CHANGELOG_TAB);
  });

  it('gql12-compare highlights CHANGELOG_COMPARE_BAR', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-compare')!;
    expect(step.highlight).toBe(GQL.CHANGELOG_COMPARE_BAR);
  });

  it('gql12-compare uses capped reading pause', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-compare')!;
    expect(step.pauseAfter).toBe(5500);
  });

  it('gql12-diff-modal highlights DIFF_CONTENT', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-diff-modal')!;
    expect(step.highlight).toBe(GQL.DIFF_CONTENT);
  });

  it('gql12-breaking highlights DIFF_COUNT_BREAKING', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-breaking')!;
    expect(step.highlight).toBe(GQL.DIFF_COUNT_BREAKING);
  });

  it('gql12-filters highlights DIFF_FILTERS toolbar', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-filters')!;
    expect(step.highlight).toBe(GQL.DIFF_FILTERS);
  });

  it('gql12-export highlights DIFF_EXPORT_JSON', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-export')!;
    expect(step.highlight).toBe(GQL.DIFF_EXPORT_JSON);
  });

  // ── Step descriptions WHY content ─────────────────────────────────────────

  it('gql12-save-snapshot description explains WHY saving establishes a reference', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-save-snapshot')!;
    expect(step.description).toContain('reference point');
    expect(step.description).toContain('persist');
  });

  it('gql12-changelog description explains WHY changelog provides a timeline', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-changelog')!;
    expect(step.description).toContain('chronological');
    expect(step.description).toContain('prior release');
  });

  it('gql12-compare description explains baseline row and View diff', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-compare')!;
    expect(step.description).toContain('Current schema');
    expect(step.description).toContain('View diff');
    expect(step.description).toContain('compare bar');
  });

  it('gql12-diff-modal description explains WHY structured table beats raw SDL diff', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-diff-modal')!;
    expect(step.description).toContain('severity');
    expect(step.description).toContain('SDL Diff');
  });

  it('gql12-breaking description explains WHY red count badge is prominent', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-breaking')!;
    expect(step.description).toContain('0 Breaking');
    expect(step.description).toContain('migration');
  });

  it('gql12-filters description explains WHY filtering by severity is useful', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-filters')!;
    expect(step.description).toContain('Safe');
    expect(step.description).toContain('noise');
  });

  it('gql12-export description mentions Export JSON button label', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-export')!;
    expect(step.description).toContain('Export JSON');
    expect(step.description).toContain('CI/CD');
    expect(step.description).toContain('breakingCount');
  });

  // ── Diff engine validation ─────────────────────────────────────────────────

  it('baseline SDL diff against current yields breaking and safe changes', () => {
    const result = computeSchemaDiff(LESSON12_BASELINE_SDL, LESSON12_CURRENT_SDL);
    expect(result.breakingCount).toBeGreaterThan(0);
    expect(result.safeCount).toBeGreaterThan(0);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  // ── Step actions ───────────────────────────────────────────────────────────

  it('gql12-save-snapshot clicks save snapshot button', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-save-snapshot')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SAVE_SNAPSHOT_BTN);
  });

  it('gql12-changelog opens changelog tab', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-changelog')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.CHANGELOG_TAB);
  });

  it('gql12-compare selects baseline and opens diff from compare bar', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    document.querySelector(GQL.CHANGELOG_ROW)?.setAttribute('data-lesson-baseline', 'true');
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-compare')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.CHANGELOG_BASELINE_ROW);
    expect(ctx.click).toHaveBeenCalledWith(GQL.CHANGELOG_DIFF_BTN);
  });

  it('gql12-filters cycles severity tabs and returns to All', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-filters')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.DIFF_FILTER_BREAKING);
    expect(ctx.click).toHaveBeenCalledWith(GQL.DIFF_FILTER_SAFE);
    expect(ctx.click).toHaveBeenCalledWith(GQL.DIFF_FILTER_DEPRECATED);
    expect(ctx.click).toHaveBeenCalledWith(GQL.DIFF_FILTER_ALL);
  });

  it('gql12-export clicks export JSON and closes diff modal', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom({ withDiffModal: true });
    const doneBtn = document.querySelector<HTMLButtonElement>(GQL.DIFF_DONE)!;
    doneBtn.addEventListener('click', () => document.querySelector(GQL.DIFF_MODAL)?.remove());
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-export')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.DIFF_EXPORT_JSON);
    expect(document.querySelector(GQL.DIFF_MODAL)).toBeNull();
  });

  it('gql12-export verify targets changelog diff button after modal closes', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-export')!;
    expect(step.verify).toBe(GQL.CHANGELOG_DIFF_BTN);
  });

  it('gql12-breaking action pauses on breaking count badge', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom({ withDiffModal: true });
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-breaking')!;
    vi.mocked(ctx.click).mockClear();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SE_TAB_TYPES);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.CHANGELOG_TAB);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(1500);
  });

  it('gql12-diff-modal pauses on change list content', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom({ withDiffModal: true });
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-diff-modal')!;
    vi.mocked(ctx.click).mockClear();
    await step.preAction!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SE_TAB_TYPES);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.CHANGELOG_TAB);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(1500);
    expect(document.querySelector(GQL.DIFF_CONTENT)).toBeTruthy();
  });

  // ── Verify selectors ───────────────────────────────────────────────────────

  it('gql12-breaking verify selector is breaking count badge', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-breaking')!;
    expect(step.verify).toBe(GQL.DIFF_COUNT_BREAKING);
  });

  it('gql12-diff-modal verify selector is diff row', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-diff-modal')!;
    expect(step.verify).toBe(GQL.DIFF_ROW);
  });

  it('gql12-filters verify selector is DIFF_FILTER_SAFE', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-filters')!;
    expect(step.verify).toBe(GQL.DIFF_FILTER_SAFE);
  });

  it('gql12-compare verify selector is DIFF_MODAL', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-compare')!;
    expect(step.verify).toBe(GQL.DIFF_MODAL);
  });

  // ── Guard helpers ──────────────────────────────────────────────────────────

  it('ensureLesson12TypesTab clicks types tab when inactive', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    document.querySelector('[data-testid="gql-se-tab-types"]')!.classList.remove('gql-se-main-tab--active');
    await ensureLesson12TypesTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SE_TAB_TYPES);
  });

  it('ensureLesson12DiffOpen clicks View diff when baseline row is absent from DOM', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    document.querySelectorAll(GQL.CHANGELOG_ROW).forEach((r) => r.remove());
    vi.spyOn(await import('../../adapters'), 'loadSnapshots')
      .mockResolvedValue([]);
    vi.spyOn(await import('../../adapters'), 'saveSnapshot')
      .mockResolvedValue(undefined);
    await ensureLesson12ChangelogOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson12DiffOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.CHANGELOG_DIFF_BTN);
  });

  it('ensureLesson12BaselineSnapshot loads existing baseline from storage', async () => {
    const loadSpy = vi.spyOn(await import('../../adapters'), 'loadSnapshots')
      .mockResolvedValue([{ id: 'existing-baseline', label: LESSON12_BASELINE_LABEL } as never]);
    await ensureLesson12BaselineSnapshot();
    expect(loadSpy).toHaveBeenCalledWith(GQL_DEMO_CONNECTION_ID);
    loadSpy.mockRestore();
  });

  it('gqlSchemaDiffLessonSetup creates demo tab, introspects, and seeds baseline', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    vi.spyOn(await import('../../adapters'), 'loadSnapshots')
      .mockResolvedValue([]);
    vi.spyOn(await import('../../adapters'), 'saveSnapshot')
      .mockResolvedValue(undefined);
    await gqlSchemaDiffLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-schema-diff',
      'Schema Diff & Breaking Changes',
    );
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gqlSchemaDiffLessonCleanup closes demo tab', async () => {
    const ctx = makeCtx();
    await gqlSchemaDiffLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-schema-diff');
  });

  it('ensureLesson12SnapshotSaved guard skips save button on repeat', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    await ensureLesson12SnapshotSaved(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson12SnapshotSaved(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SAVE_SNAPSHOT_BTN);
  });

  it('ensureLesson12ChangelogOpen guard skips when panel visible', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    await ensureLesson12ChangelogOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson12ChangelogOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.CHANGELOG_TAB);
  });

  it('ensureLesson12DiffOpen guard skips diff button on repeat', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom({ withDiffModal: true });
    await ensureLesson12DiffOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson12DiffOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.CHANGELOG_BASELINE_ROW);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.CHANGELOG_DIFF_BTN);
  });

  it('ensureLesson12DiffOpen skips Types and Changelog clicks when modal is already open', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom({ withDiffModal: true });
    const typesTab = document.querySelector<HTMLElement>(GQL.SE_TAB_TYPES)!;
    const changelogTab = document.querySelector<HTMLElement>(GQL.CHANGELOG_TAB)!;
    typesTab.classList.remove('gql-se-main-tab--active');
    changelogTab.classList.add('gql-se-main-tab--active');
    resetGqlLesson12SessionFlags();
    await ensureLesson12DiffOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SE_TAB_TYPES);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.CHANGELOG_TAB);
  });

  it('ensureLesson12DiffFilters guard skips filter clicks on repeat', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom({ withDiffModal: true });
    await ensureLesson12DiffFilters(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson12DiffFilters(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.DIFF_FILTER_BREAKING);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.DIFF_FILTER_SAFE);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.DIFF_FILTER_DEPRECATED);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.DIFF_FILTER_ALL);
  });

  it('ensureLesson12DiffExported guard skips export on repeat', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom({ withDiffModal: true });
    await ensureLesson12DiffExported(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson12DiffExported(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.DIFF_EXPORT_JSON);
  });

  it('ensureLesson12TypesTab skips click when types tab already active', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    await ensureLesson12TypesTab(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson12TypesTab(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.SE_TAB_TYPES);
  });

  it('findBaselineChangelogRow falls back to first row when label missing', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    document.querySelectorAll(GQL.CHANGELOG_ROW).forEach((row) => {
      const label = row.querySelector('.gql-changelog-row-label');
      if (label?.textContent?.includes(LESSON12_BASELINE_LABEL)) {
        label.textContent = 'Other snapshot';
      }
    });
    await ensureLesson12ChangelogOpen(ctx);
    await ensureLesson12DiffOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.CHANGELOG_DIFF_BTN);
  });

  it('ensureLesson12BaselineSnapshot saves new baseline when not in storage', async () => {
    const saveSpy = vi.spyOn(await import('../../adapters'), 'saveSnapshot')
      .mockResolvedValue(undefined);
    vi.spyOn(await import('../../adapters'), 'loadSnapshots')
      .mockResolvedValue([]);
    resetGqlLesson12SessionFlags();
    await ensureLesson12BaselineSnapshot();
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
      label: LESSON12_BASELINE_LABEL,
      connectionId: GQL_DEMO_CONNECTION_ID,
    }));
    saveSpy.mockRestore();
  });

  it('gqlSchemaDiffLessonCleanup deletes lesson-captured snapshots', async () => {
    const ctx = makeCtx();
    const deleteSpy = vi.spyOn(await import('../../adapters'), 'deleteSnapshot')
      .mockResolvedValue(undefined);
    vi.spyOn(await import('../../adapters'), 'loadSnapshots')
      .mockResolvedValue([
        { id: 'snap-new', label: 'Current', capturedAt: Date.now() + 1000 } as never,
        { id: 'baseline', label: LESSON12_BASELINE_LABEL, capturedAt: Date.now() - 1000 } as never,
      ]);
    await gqlSchemaDiffLessonSetup(ctx);
    await gqlSchemaDiffLessonCleanup(ctx);
    expect(deleteSpy).toHaveBeenCalled();
    deleteSpy.mockRestore();
  });

  it('ensureLesson12SnapshotSaved runs when changelog rows empty after flag set', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    await ensureLesson12SnapshotSaved(ctx);
    document.querySelectorAll(GQL.CHANGELOG_ROW).forEach((r) => r.remove());
    vi.mocked(ctx.click).mockClear();
    resetGqlLesson12SessionFlags();
    await ensureLesson12SnapshotSaved(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SAVE_SNAPSHOT_BTN);
  });
});
