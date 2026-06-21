/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { gqlSchemaDiffLesson } from './graphql-schema-diff';
import { makeCtx } from './ws-test-utils';
import { GQL } from '../../../../shared/selectors';
import {
  LESSON12_BASELINE_LABEL,
  LESSON12_BASELINE_SDL,
  GQL_DEMO_HTTP,
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
import { computeSchemaDiff } from '../../../graphql/utils/schemaDiff';

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

function stubSchemaExplorerDom(): void {
  document.body.innerHTML = `
    <button data-testid="gql-se-tab-types" class="gql-se-main-tab--active"></button>
    <button data-testid="gql-se-save-snapshot"></button>
    <button data-testid="gql-se-tab-changelog"></button>
    <div data-testid="gql-changelog-panel">
      <div data-testid="gql-changelog-row">
        <span class="gql-changelog-row-label">Snapshot</span>
        <button data-testid="gql-changelog-diff-btn">Diff</button>
      </div>
      <div data-testid="gql-changelog-row">
        <span class="gql-changelog-row-label">${LESSON12_BASELINE_LABEL}</span>
        <button data-testid="gql-changelog-diff-btn">Diff</button>
      </div>
    </div>
    <div data-testid="gql-diff-modal">
      <span class="gql-diff-count gql-diff-count--breaking">1 Breaking</span>
      <button class="gql-diff-filter gql-diff-filter--breaking">Breaking</button>
      <button class="gql-diff-filter gql-diff-filter--safe">Safe</button>
      <button class="gql-diff-filter gql-diff-filter--deprecated">Deprecated</button>
      <div data-testid="gql-diff-row"></div>
      <button data-testid="gql-diff-export-json">Export JSON</button>
    </div>
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

  it('has valid lesson structure', () => {
    expect(gqlSchemaDiffLesson.id).toBe('gql-schema-diff');
    expect(gqlSchemaDiffLesson.category).toBe('graphql');
    expect(gqlSchemaDiffLesson.name).toBe('Schema Diff & Breaking Changes');
    expect(gqlSchemaDiffLesson.steps.length).toBe(7);
    expect(gqlSchemaDiffLesson.estimatedMinutes).toBe(3);
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

  it('all 7 steps have pauseAfter: true', () => {
    gqlSchemaDiffLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards', () => {
    gqlSchemaDiffLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('baseline SDL diff against current yields breaking and safe changes', () => {
    const result = computeSchemaDiff(LESSON12_BASELINE_SDL, LESSON12_CURRENT_SDL);
    expect(result.breakingCount).toBeGreaterThan(0);
    expect(result.safeCount).toBeGreaterThan(0);
    expect(result.changes.length).toBeGreaterThan(0);
  });

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

  it('gql12-compare opens diff on baseline row', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-compare')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(
      '[data-lesson-target="baseline"] [data-testid="gql-changelog-diff-btn"]',
    );
  });

  it('gql12-filters cycles severity tabs', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-filters')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.DIFF_FILTER_BREAKING);
    expect(ctx.click).toHaveBeenCalledWith(GQL.DIFF_FILTER_SAFE);
    expect(ctx.click).toHaveBeenCalledWith(GQL.DIFF_FILTER_DEPRECATED);
  });

  it('gql12-export clicks export JSON', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-export')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.DIFF_EXPORT_JSON);
  });

  it('gql12-breaking action highlights breaking count badge', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-breaking')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql12-diff-modal re-opens diff modal when already saved', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-diff-modal')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(document.querySelector(GQL.DIFF_MODAL)).toBeTruthy();
  });

  it('ensureLesson12TypesTab clicks types tab when inactive', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    document.querySelector('[data-testid="gql-se-tab-types"]')!.classList.remove('gql-se-main-tab--active');
    await ensureLesson12TypesTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith('[data-testid="gql-se-tab-types"]');
  });

  it('ensureLesson12DiffOpen uses fallback diff button when baseline row missing', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    document.querySelectorAll(GQL.CHANGELOG_ROW).forEach((r) => r.remove());
    await ensureLesson12ChangelogOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson12DiffOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.CHANGELOG_DIFF_BTN);
  });

  it('ensureLesson12BaselineSnapshot loads existing baseline from storage', async () => {
    const loadSpy = vi.spyOn(await import('../../../graphql/utils/schemaSnapshot'), 'loadSnapshots')
      .mockResolvedValue([{ id: 'existing-baseline', label: LESSON12_BASELINE_LABEL } as never]);
    await ensureLesson12BaselineSnapshot();
    expect(loadSpy).toHaveBeenCalledWith(GQL_DEMO_HTTP);
    loadSpy.mockRestore();
  });

  it('gqlSchemaDiffLessonSetup introspects and seeds baseline', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    vi.spyOn(await import('../../../graphql/utils/schemaSnapshot'), 'loadSnapshots')
      .mockResolvedValue([]);
    vi.spyOn(await import('../../../graphql/utils/schemaSnapshot'), 'saveSnapshot')
      .mockResolvedValue(undefined);
    await gqlSchemaDiffLessonSetup(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, '');
  });

  it('gqlSchemaDiffLessonCleanup resets session flags', async () => {
    const ctx = makeCtx();
    await gqlSchemaDiffLessonCleanup(ctx);
    expect(ctx.delay).toHaveBeenCalled();
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
    stubSchemaExplorerDom();
    await ensureLesson12DiffOpen(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson12DiffOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(
      '[data-lesson-target="baseline"] [data-testid="gql-changelog-diff-btn"]',
    );
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.CHANGELOG_DIFF_BTN);
  });

  it('ensureLesson12DiffFilters guard skips filter clicks on repeat', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    await ensureLesson12DiffFilters(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson12DiffFilters(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.DIFF_FILTER_BREAKING);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.DIFF_FILTER_SAFE);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.DIFF_FILTER_DEPRECATED);
  });

  it('ensureLesson12DiffExported guard skips export on repeat', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    await ensureLesson12DiffExported(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson12DiffExported(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.DIFF_EXPORT_JSON);
  });

  it('gql12-breaking verify selector is breaking count badge', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-breaking')!;
    expect(step.verify).toBe(GQL.DIFF_COUNT_BREAKING);
  });

  it('gql12-diff-modal verify selector is diff row', () => {
    const step = gqlSchemaDiffLesson.steps.find((s) => s.id === 'gql12-diff-modal')!;
    expect(step.verify).toBe(GQL.DIFF_ROW);
  });

  it('ensureLesson12TypesTab skips click when types tab already active', async () => {
    const ctx = makeCtx();
    stubSchemaExplorerDom();
    await ensureLesson12TypesTab(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson12TypesTab(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith('[data-testid="gql-se-tab-types"]');
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
    expect(ctx.click).toHaveBeenCalledWith(
      '[data-lesson-target="baseline"] [data-testid="gql-changelog-diff-btn"]',
    );
  });

  it('ensureLesson12BaselineSnapshot saves new baseline when not in storage', async () => {
    const saveSpy = vi.spyOn(await import('../../../graphql/utils/schemaSnapshot'), 'saveSnapshot')
      .mockResolvedValue(undefined);
    vi.spyOn(await import('../../../graphql/utils/schemaSnapshot'), 'loadSnapshots')
      .mockResolvedValue([]);
    resetGqlLesson12SessionFlags();
    await ensureLesson12BaselineSnapshot();
    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
      label: LESSON12_BASELINE_LABEL,
      connectionId: GQL_DEMO_HTTP,
    }));
    saveSpy.mockRestore();
  });

  it('gqlSchemaDiffLessonCleanup deletes lesson-captured snapshots', async () => {
    const ctx = makeCtx();
    const deleteSpy = vi.spyOn(await import('../../../graphql/utils/schemaSnapshot'), 'deleteSnapshot')
      .mockResolvedValue(undefined);
    vi.spyOn(await import('../../../graphql/utils/schemaSnapshot'), 'loadSnapshots')
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
