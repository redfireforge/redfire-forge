/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  resetGqlLesson12SessionFlags,
  markLesson12BaselineRow,
  notifyGqlSnapshotsChanged,
  ensureLesson12TypesTab,
  LESSON12_BASELINE_LABEL,
} from './lesson12-schema-diff';
import { GQL_DEMO_CONNECTION_ID } from './core';

vi.mock('../../../adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters')>();
  return {
    ...actual,
    deleteSnapshot: vi.fn(async () => {}),
    loadSnapshots: vi.fn(async () => []),
    saveSnapshot: vi.fn(async () => {}),
  };
});

vi.mock('./lesson4-schema-exploration', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lesson4-schema-exploration')>();
  return {
    ...actual,
    ensureSchemaExplorerOpen: vi.fn(async () => {}),
  };
});

describe('lesson12-schema-diff — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson12SessionFlags();
  });

  it('markLesson12BaselineRow marks the baseline changelog row', () => {
    document.body.innerHTML = `
      <div data-testid="gql-changelog-row">${LESSON12_BASELINE_LABEL}</div>
    `;
    markLesson12BaselineRow();
    expect(document.querySelector('[data-lesson-baseline="true"]')).toBeTruthy();
  });

  it('markLesson12BaselineRow no-ops when baseline row missing', () => {
    document.body.innerHTML = '';
    markLesson12BaselineRow();
    expect(document.querySelector('[data-lesson-baseline="true"]')).toBeNull();
  });

  it('notifyGqlSnapshotsChanged dispatches a custom event', () => {
    const handler = vi.fn();
    window.addEventListener('rf-gql-snapshots-changed', handler);
    notifyGqlSnapshotsChanged();
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('rf-gql-snapshots-changed', handler);
  });

  it('ensureLesson12TypesTab opens schema types tab when explorer is visible', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<button data-testid="gql-se-tab-types"></button>`;
    await ensureLesson12TypesTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.SE_TAB_TYPES);
  });

  it('ensureLesson12TypesTab skips when diff modal is open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="gql-diff-modal"></div>`;
    await ensureLesson12TypesTab(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureLesson12BaselineSnapshot saves new baseline when none exists', async () => {
    const adapters = await import('../../../adapters');
    vi.mocked(adapters.loadSnapshots).mockResolvedValue([]);
    const { ensureLesson12BaselineSnapshot } = await import('./lesson12-schema-diff');
    await ensureLesson12BaselineSnapshot();
    expect(adapters.saveSnapshot).toHaveBeenCalled();
  });

  it('ensureLesson12BaselineSnapshot reuses existing baseline on demo connection', async () => {
    const adapters = await import('../../../adapters');
    vi.mocked(adapters.loadSnapshots).mockImplementation(async () => [{
      id: 'snap-1',
      connectionId: GQL_DEMO_CONNECTION_ID,
      sdl: 'type Query { health: String }',
      typesCount: 1,
      capturedAt: Date.now(),
      label: LESSON12_BASELINE_LABEL,
    }]);
    vi.mocked(adapters.saveSnapshot).mockClear();
    const { ensureLesson12BaselineSnapshot, resetGqlLesson12SessionFlags } = await import('./lesson12-schema-diff');
    resetGqlLesson12SessionFlags();
    await ensureLesson12BaselineSnapshot();
    expect(adapters.saveSnapshot).not.toHaveBeenCalled();
  });

  it('ensureLesson12ChangelogOpen opens changelog panel', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-se-tab-types" class="gql-se-main-tab--active"></button>
      <button data-testid="gql-save-snapshot-btn"></button>
      <button data-testid="gql-changelog-tab"></button>
      <div data-testid="gql-changelog-panel"></div>
      <div data-testid="gql-changelog-row">${LESSON12_BASELINE_LABEL}</div>
    `;
    const { ensureLesson12ChangelogOpen } = await import('./lesson12-schema-diff');
    await ensureLesson12ChangelogOpen(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.CHANGELOG_TAB);
  });

  it('ensureLesson12TypesTab skips click when types tab already active', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-se-tab-types" class="gql-se-main-tab--active"></button>
    `;
    await ensureLesson12TypesTab(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureLesson12DiffOpen clears compare select before opening diff', async () => {
    const ctx = makeCtx();
    const adapters = await import('../../../adapters');
    vi.mocked(adapters.loadSnapshots).mockResolvedValue([{
      id: 'snap-1',
      connectionId: GQL_DEMO_CONNECTION_ID,
      sdl: 'type Query { health: String }',
      typesCount: 1,
      capturedAt: Date.now(),
      label: LESSON12_BASELINE_LABEL,
    }]);
    const select = document.createElement('select');
    select.setAttribute('data-testid', 'gql-changelog-compare-select');
    select.value = 'other-snap';
    document.body.innerHTML = `
      <button data-testid="gql-save-snapshot-btn"></button>
      <button data-testid="gql-changelog-tab"></button>
      <div data-testid="gql-changelog-panel"></div>
      <div data-testid="gql-changelog-row">${LESSON12_BASELINE_LABEL}</div>
      <button data-testid="gql-changelog-diff-btn"></button>
    `;
    document.body.appendChild(select);
    const { ensureLesson12DiffOpen, resetGqlLesson12SessionFlags } = await import('./lesson12-schema-diff');
    resetGqlLesson12SessionFlags();
    await ensureLesson12DiffOpen(ctx);
    expect(select.value).toBe('');
  });

  it('ensureLesson12DiffOpen skips when diff modal already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="gql-diff-modal"></div>`;
    const { ensureLesson12DiffOpen } = await import('./lesson12-schema-diff');
    await ensureLesson12DiffOpen(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureLesson12BaselineSnapshot migrates baseline from legacy connection id', async () => {
    const adapters = await import('../../../adapters');
    const { GQL_DEMO_CONNECTION_ID, gqlDemoSnapshotConnectionIds } = await import('./core');
    const legacyKey = gqlDemoSnapshotConnectionIds().find((id) => id !== GQL_DEMO_CONNECTION_ID);
    expect(legacyKey).toBeTruthy();
    vi.mocked(adapters.loadSnapshots).mockImplementation(async (connectionId) => {
      if (connectionId === legacyKey) {
        return [{
          id: 'snap-legacy',
          connectionId: legacyKey!,
          sdl: 'type Query { health: String }',
          typesCount: 1,
          capturedAt: Date.now(),
          label: LESSON12_BASELINE_LABEL,
        }];
      }
      return [];
    });
    const { ensureLesson12BaselineSnapshot, resetGqlLesson12SessionFlags } = await import('./lesson12-schema-diff');
    resetGqlLesson12SessionFlags();
    await ensureLesson12BaselineSnapshot();
    expect(adapters.deleteSnapshot).toHaveBeenCalledWith('snap-legacy');
    expect(adapters.saveSnapshot).toHaveBeenCalled();
  });

  it('ensureLesson12DiffExported closes modal after export', async () => {
    const ctx = makeCtx();
    const adapters = await import('../../../adapters');
    vi.mocked(adapters.loadSnapshots).mockResolvedValue([{
      id: 'snap-1',
      connectionId: GQL_DEMO_CONNECTION_ID,
      sdl: 'type Query { health: String }',
      typesCount: 1,
      capturedAt: Date.now(),
      label: LESSON12_BASELINE_LABEL,
    }]);
    document.body.innerHTML = `
      <button data-testid="gql-save-snapshot-btn"></button>
      <button data-testid="gql-changelog-tab"></button>
      <div data-testid="gql-changelog-panel"></div>
      <div data-testid="gql-changelog-row">${LESSON12_BASELINE_LABEL}</div>
      <button data-testid="gql-changelog-diff-btn"></button>
      <div data-testid="gql-diff-modal"></div>
      <button data-testid="gql-diff-export-json"></button>
      <button data-testid="gql-diff-done">Done</button>
    `;
    const doneBtn = document.querySelector<HTMLElement>('[data-testid="gql-diff-done"]')!;
    const clickSpy = vi.spyOn(doneBtn, 'click');
    const { ensureLesson12DiffExported, resetGqlLesson12SessionFlags } = await import('./lesson12-schema-diff');
    resetGqlLesson12SessionFlags();
    await ensureLesson12DiffExported(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureLesson12BaselineReady expands show-more when baseline row hidden', async () => {
    const ctx = makeCtx();
    const adapters = await import('../../../adapters');
    vi.mocked(adapters.loadSnapshots).mockResolvedValue([]);
    document.body.innerHTML = `
      <button data-testid="gql-se-tab-types" class="gql-se-main-tab--active"></button>
      <button data-testid="gql-save-snapshot-btn"></button>
      <button data-testid="gql-changelog-tab"></button>
      <div data-testid="gql-changelog-panel"></div>
      <div data-testid="gql-changelog-row">Current snapshot</div>
      <button data-testid="gql-changelog-show-more">Show more</button>
    `;
    const { ensureLesson12BaselineReady, resetGqlLesson12SessionFlags } = await import('./lesson12-schema-diff');
    resetGqlLesson12SessionFlags();
    await ensureLesson12BaselineReady(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.CHANGELOG_SHOW_MORE);
  });

  it('gqlSchemaDiffLessonSetup clicks response tab when not selected', async () => {
    const ctx = makeCtx();
    const responseTab = document.createElement('button');
    responseTab.setAttribute('data-testid', 'gql-right-tab-response');
    responseTab.setAttribute('aria-selected', 'false');
    const clickSpy = vi.spyOn(responseTab, 'click');
    document.body.innerHTML = `
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    `;
    document.body.appendChild(responseTab);
    const adapters = await import('../../../adapters');
    vi.mocked(adapters.loadSnapshots).mockResolvedValue([]);
    const { gqlSchemaDiffLessonSetup } = await import('./lesson12-schema-diff');
    await gqlSchemaDiffLessonSetup(ctx);
    expect(clickSpy).toHaveBeenCalled();
  });

  it('ensureLesson12DiffOpen keeps compare select when already empty', async () => {
    const ctx = makeCtx();
    const adapters = await import('../../../adapters');
    vi.mocked(adapters.loadSnapshots).mockResolvedValue([{
      id: 'snap-1',
      connectionId: GQL_DEMO_CONNECTION_ID,
      sdl: 'type Query { health: String }',
      typesCount: 1,
      capturedAt: Date.now(),
      label: LESSON12_BASELINE_LABEL,
    }]);
    const select = document.createElement('select');
    select.setAttribute('data-testid', 'gql-changelog-compare-select');
    select.value = '';
    document.body.innerHTML = `
      <button data-testid="gql-save-snapshot-btn"></button>
      <button data-testid="gql-changelog-tab"></button>
      <div data-testid="gql-changelog-panel"></div>
      <div data-testid="gql-changelog-row">${LESSON12_BASELINE_LABEL}</div>
      <button data-testid="gql-changelog-diff-btn"></button>
    `;
    document.body.appendChild(select);
    const { ensureLesson12DiffOpen, resetGqlLesson12SessionFlags } = await import('./lesson12-schema-diff');
    resetGqlLesson12SessionFlags();
    await ensureLesson12DiffOpen(ctx);
    expect(select.value).toBe('');
  });
});
