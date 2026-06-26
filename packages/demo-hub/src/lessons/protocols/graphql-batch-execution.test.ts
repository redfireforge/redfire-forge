/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql15'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  GQL15_LESSON_ID: 'gql-batch-execution',
}));

import { gqlBatchExecutionLesson } from './graphql-batch-execution';
import { ensureGqlDemoTab, closeGqlDemoTabs } from './graphql-lesson-helpers/gql-demo-tab';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  LESSON15_TAB2_QUERY,
  LESSON15_ERROR_QUERY,
  GQL_DEMO_VAR,
  resetGqlLesson15SessionFlags,
  resetGqlLessonSessionFlags,
  ensureLesson15BatchEnabled,
  ensureLesson15TwoTabsSameEndpoint,
  ensureLesson15BothTabsChecked,
  ensureLesson15ReadyToExecute,
  ensureLesson15Executed,
  ensureLesson15PartialErrorExecuted,
  gqlBatchLessonSetup,
  gqlBatchLessonCleanup,
} from './graphql-lesson-helpers';

function stubMonacoEditor(query = ''): void {
  const w = window as unknown as {
    monaco?: {
      editor: {
        getModels: () => Array<{ getValue: () => string; setValue: (v: string) => void; uri: { toString: () => string } }>;
        getEditors: () => Array<{ getModel: () => null; setValue: (v: string) => void }>;
      };
    };
  };
  w.monaco = {
    editor: {
      getModels: () => [{
        getValue: () => query,
        setValue: (v: string) => { query = v; },
        uri: { toString: () => 'inmemory://graphql/1' },
      }],
      getEditors: () => [{ getModel: () => null, setValue: (v: string) => { query = v; } }],
    },
  };
}

const GQL15_DEMO = 'gql-batch-execution';

function stubBatchDom(tabCount = 1, batchChecked = false, batchEnabled = false): void {
  const tabs = Array.from({ length: tabCount }, (_, i) => `
    <button role="tab" data-testid="gql-tab-tab${i}"
      data-demo-lesson="${GQL15_DEMO}"
      ${i === 0 ? 'aria-selected="true"' : ''}>
      ${i === 0 ? 'Q GetHealth' : 'Q CheckHealth'}
      ${batchChecked ? `<span data-testid="gql-tab-batch-badge-tab${i}" class="gql-tab-batch-badge">B</span>` : ''}
    </button>
  `).join('');

  const advBatchRows = Array.from({ length: tabCount }, (_, i) => `
    <label data-testid="gql-adv-batch-tab-label-tab${i}" class="gql-adv-batch-panel__tab-label">
      <input type="checkbox" class="gql-adv-batch-panel__tab-cb-input"
        data-testid="gql-adv-batch-tab-cb-tab${i}" ${batchChecked ? 'checked' : ''} />
    </label>
  `).join('');

  const batchEnabledSection = batchEnabled ? `
    <div data-testid="gql-adv-settings-modal">
      <span data-testid="gql-batch-summary-chip">Batch ${tabCount}/${tabCount}</span>
      <label data-testid="gql-adv-batch-enable-toggle" class="gql-advsettings-toggle">
        <input type="checkbox" aria-label="Enable query batching" checked />
      </label>
      <button data-testid="gql-adv-settings-tab-batch" class="gql-advsettings-tab active"></button>
      <div data-testid="gql-adv-batch-panel">${advBatchRows}</div>
      <button data-testid="gql-adv-settings-save-btn"></button>
    </div>
  ` : '';

  document.body.innerHTML = `
    <div data-testid="gql-tab-bar">
      ${tabs}
      <button data-testid="gql-tab-add-btn">+</button>
    </div>
    <input data-testid="gql-endpoint-input" value="{{graphqlUrl}}" />
    <button data-testid="gql-introspect-btn"></button>
    <button data-testid="gql-execute-btn"></button>
    <button data-testid="gql-send-batch-btn">⚡ Send Batch (${tabCount})</button>
    <button data-testid="gql-adv-settings-btn">⚙</button>
    <span data-testid="gql-schema-badge-ok">Schema (47 types)</span>
    <div data-testid="gql-response-viewer"></div>
    <div data-testid="gql-response-body"></div>
    <div data-testid="gql-batch-results">
      <div class="gql-batch-results-header">Batch of ${tabCount}</div>
    </div>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    ${batchEnabledSection}
  `;
}

describe('gql-batch-execution lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLessonSessionFlags();
    resetGqlLesson15SessionFlags();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Lesson structure ───────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlBatchExecutionLesson.id).toBe('gql-batch-execution');
    expect(gqlBatchExecutionLesson.category).toBe('graphql');
    expect(gqlBatchExecutionLesson.name).toBe('Batch Execution');
    expect(gqlBatchExecutionLesson.steps.length).toBe(9);
    expect(gqlBatchExecutionLesson.estimatedMinutes).toBe(5);
    expect(gqlBatchExecutionLesson.tabBudget).toBe(2);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlBatchExecutionLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlBatchExecutionLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlBatchExecutionLesson.steps.map((s) => s.id)).toEqual([
      'gql15-intro',
      'gql15-enable-batch',
      'gql15-add-tab',
      'gql15-batch-select',
      'gql15-write-queries',
      'gql15-batch-run',
      'gql15-batch-results',
      'gql15-partial-error',
      'gql15-export-batch',
    ]);
  });

  it('all 9 steps have pauseAfter: true', () => {
    gqlBatchExecutionLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('all steps have a preAction guard', () => {
    gqlBatchExecutionLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  // ── Concept content ────────────────────────────────────────────────────────

  it('concept title captures N-operations-one-request semantics', () => {
    expect(gqlBatchExecutionLesson.concept.title).toContain('Batch Execution');
    expect(gqlBatchExecutionLesson.concept.title).toContain('One HTTP');
  });

  it('concept body explains WHY batch beats individual requests', () => {
    expect(gqlBatchExecutionLesson.concept.body).toContain('round-trip');
    expect(gqlBatchExecutionLesson.concept.body).toContain('overhead');
  });

  it('concept body explains WHY mutations should not be batched', () => {
    expect(gqlBatchExecutionLesson.concept.body).toContain('Mutations');
    expect(gqlBatchExecutionLesson.concept.body).toContain('side-effects');
  });

  it('concept body explains WHY endpoint parity is required', () => {
    expect(gqlBatchExecutionLesson.concept.body).toContain('parity');
    expect(gqlBatchExecutionLesson.concept.body).toContain('disabled');
  });

  it('concept body explains sequential fallback for unsupported servers', () => {
    expect(gqlBatchExecutionLesson.concept.body).toContain('sequential');
    expect(gqlBatchExecutionLesson.concept.body).toContain('fallback');
  });

  it('has exactly 5 key terms', () => {
    expect(gqlBatchExecutionLesson.concept.keyTerms.length).toBe(5);
  });

  it('key terms cover: batch request, endpoint parity, partial error, sequential fallback, batch inclusion', () => {
    const terms = gqlBatchExecutionLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Batch request');
    expect(terms).toContain('Endpoint parity');
    expect(terms).toContain('Partial error');
    expect(terms).toContain('Sequential fallback');
    expect(terms).toContain('Batch inclusion');
  });

  it('Partial error key term explains no fail-fast behavior', () => {
    const term = gqlBatchExecutionLesson.concept.keyTerms.find((k) => k.term === 'Partial error')!;
    expect(term.definition).toContain('independently');
    expect(term.definition).toContain('errors');
  });

  // ── Diagram ────────────────────────────────────────────────────────────────

  it('diagram has 700x430 studio chrome dimensions', () => {
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
  });

  it('diagram includes window chrome traffic lights', () => {
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('#ff5f57');
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('#febc2e');
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('#28c840');
  });

  it('diagram shows Send Batch button in connection bar', () => {
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('Send Batch (2)');
  });

  it('diagram shows checked batch checkboxes on tabs', () => {
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('GetHealth');
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('CheckHealth');
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('included in batch');
  });

  it('diagram shows batch results panel with two operation cards', () => {
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('Batch of 2');
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('2 passed');
  });

  it('diagram shows both cards with success indicators', () => {
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('GetHealth');
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('CheckHealth');
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('HTTP 200');
  });

  it('diagram includes bottom pipeline legend', () => {
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('Enable Batch');
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('Add Tab 2');
    expect(gqlBatchExecutionLesson.concept.diagram).toContain('Send Batch (2)');
  });

  // ── Step spotlights ────────────────────────────────────────────────────────

  it('gql15-intro highlights TAB_BAR', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-intro')!;
    expect(step.highlight).toBe(GQL.TAB_BAR);
  });

  it('gql15-enable-batch highlights batch panel in Advanced settings', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-enable-batch')!;
    expect(step.highlight).toBe(GQL.ADV_BATCH_PANEL);
  });

  it('gql15-add-tab highlights TAB_ADD_BTN', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-add-tab')!;
    expect(step.highlight).toBe(GQL.TAB_ADD_BTN);
  });

  it('gql15-batch-select highlights batch panel in Advanced settings', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-batch-select')!;
    expect(step.highlight).toBe(GQL.ADV_BATCH_PANEL);
  });

  it('gql15-write-queries highlights EDITOR', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-write-queries')!;
    expect(step.highlight).toBe(GQL.EDITOR);
  });

  it('gql15-batch-run highlights BATCH_EXECUTE_BTN', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-batch-run')!;
    expect(step.highlight).toBe(GQL.BATCH_EXECUTE_BTN);
  });

  it('gql15-batch-results highlights BATCH_RESULTS', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-batch-results')!;
    expect(step.highlight).toBe(GQL.BATCH_RESULTS);
  });

  it('gql15-partial-error highlights EDITOR', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-partial-error')!;
    expect(step.highlight).toBe(GQL.EDITOR);
  });

  it('gql15-export-batch highlights ACTIVITY_HISTORY', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-export-batch')!;
    expect(step.highlight).toBe(GQL.ACTIVITY_HISTORY);
  });

  // ── Step verify selectors ──────────────────────────────────────────────────

  it('gql15-batch-run verify is BATCH_RESULTS', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-batch-run')!;
    expect(step.verify).toBe(GQL.BATCH_RESULTS);
  });

  it('gql15-batch-results verify is BATCH_RESULTS', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-batch-results')!;
    expect(step.verify).toBe(GQL.BATCH_RESULTS);
  });

  it('gql15-partial-error verify is BATCH_RESULTS', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-partial-error')!;
    expect(step.verify).toBe(GQL.BATCH_RESULTS);
  });

  // ── Step description WHY content ───────────────────────────────────────────

  it('gql15-intro description explains WHY batch beats sequential requests', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-intro')!;
    expect(step.description).toContain('round-trip');
    expect(step.description).toContain('overhead');
  });

  it('gql15-add-tab description explains WHY endpoint parity is needed', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-add-tab')!;
    expect(step.description).toContain('endpoint');
    expect(step.description).toContain('disabled');
  });

  it('gql15-add-tab description cross-references GQL-14', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-add-tab')!;
    expect(step.description).toContain('GQL-14');
  });

  it('gql15-batch-select description references Advanced Settings batch table', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-batch-select')!;
    expect(step.description).toContain('Advanced settings');
    expect(step.description).toContain('B');
  });

  it('gql15-batch-run description explains WHY count shows in button', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-batch-run')!;
    expect(step.description).toContain('count');
    expect(step.description).toContain('array');
  });

  it('gql15-batch-results description explains WHY order matters for CI', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-batch-results')!;
    expect(step.description).toContain('order');
    expect(step.description).toContain('CI');
  });

  it('gql15-partial-error description explains WHY batch does not fail-fast', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-partial-error')!;
    expect(step.description).toContain('independently');
    expect(step.description).toContain('partial');
  });

  it('gql15-export-batch description explains sequential fallback and CI export', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-export-batch')!;
    expect(step.description).toContain('Sequential fallback');
    expect(step.description).toContain('History');
  });

  it('gql15-partial-error description mentions the error query field', () => {
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-partial-error')!;
    expect(step.description).toContain(LESSON15_ERROR_QUERY);
  });

  // ── Helper constants ───────────────────────────────────────────────────────

  it('LESSON15_TAB2_QUERY has a different operation name from health query', () => {
    expect(LESSON15_TAB2_QUERY).toContain('CheckHealth');
    expect(LESSON15_TAB2_QUERY).not.toBe('query { health }');
  });

  it('LESSON15_ERROR_QUERY references a non-existent field', () => {
    expect(LESSON15_ERROR_QUERY).toContain('nonexistent');
    expect(LESSON15_ERROR_QUERY).toContain('BadField');
  });

  // ── Helper unit tests ──────────────────────────────────────────────────────

  it('ensureLesson15BatchEnabled opens Advanced Settings when checkbox not in DOM', async () => {
    const ctx = makeCtx();
    // Simulate closed popover: only the gear button is visible, no batch checkbox yet
    document.body.innerHTML = `
      <button data-testid="gql-adv-settings-btn">⚙</button>
    `;
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === GQL.ADV_SETTINGS_BTN) {
        // Simulate opening the popover
        document.body.insertAdjacentHTML('beforeend', `
          <div class="gql-advsettings-tabs">
            <button class="gql-advsettings-tab">APQ</button>
            <button class="gql-advsettings-tab">Batch</button>
          </div>
          <input type="checkbox" aria-label="Enable query batching" />
          <button data-testid="gql-adv-settings-save-btn">Save</button>
        `);
      }
    });
    await ensureLesson15BatchEnabled(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ADV_SETTINGS_BTN);
    expect(ctx.click).toHaveBeenCalledWith('[data-lesson-target="gql15-settings-batch-tab"]');
  });

  it('ensureLesson15BatchEnabled guard skips when already enabled', async () => {
    const ctx = makeCtx();
    stubBatchDom(1, false, true);
    await ensureLesson15BatchEnabled(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15BatchEnabled(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureLesson15TwoTabsSameEndpoint adds a second tab', async () => {
    const ctx = makeCtx();
    stubBatchDom(1, false, true);
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === GQL.TAB_ADD_BTN) {
        document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML(
          'beforeend',
          '<button role="tab">Q CheckHealth</button>',
        );
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15TwoTabsSameEndpoint(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
  });

  it('ensureLesson15TwoTabsSameEndpoint skips when 2 tabs exist', async () => {
    const ctx = makeCtx();
    stubBatchDom(2, false, true);
    await ensureLesson15BatchEnabled(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15TwoTabsSameEndpoint(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
  });

  it('ensureLesson15BothTabsChecked clicks unchecked adv batch checkboxes', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <span data-testid="gql-batch-summary-chip">Batch</span>
      <input type="checkbox" aria-label="Enable query batching" checked />
      <input data-testid="gql-endpoint-input" value="{{graphqlUrl}}" />
      <div data-testid="gql-tab-bar">
        <button role="tab" data-testid="gql-tab-tab0" data-demo-lesson="${GQL15_DEMO}">Q GetHealth</button>
        <button role="tab" data-testid="gql-tab-tab1" data-demo-lesson="${GQL15_DEMO}">Q CheckHealth</button>
      </div>
      <button data-testid="gql-adv-settings-btn"></button>
      <button data-testid="gql-adv-settings-tab-batch" class="gql-advsettings-tab active"></button>
      <div data-testid="gql-adv-batch-panel">
        <label data-testid="gql-adv-batch-tab-label-tab0" class="gql-adv-batch-panel__tab-label">
          <input type="checkbox" data-testid="gql-adv-batch-tab-cb-tab0" class="gql-adv-batch-panel__tab-cb-input" />
        </label>
        <label data-testid="gql-adv-batch-tab-label-tab1" class="gql-adv-batch-panel__tab-label">
          <input type="checkbox" data-testid="gql-adv-batch-tab-cb-tab1" class="gql-adv-batch-panel__tab-cb-input" />
        </label>
      </div>
      <button data-testid="gql-adv-settings-save-btn"></button>
    `;
    await ensureLesson15BothTabsChecked(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('ensureLesson15BothTabsChecked skips already-checked checkboxes', async () => {
    const ctx = makeCtx();
    stubBatchDom(2, true, true);
    await ensureLesson15TwoTabsSameEndpoint(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15BothTabsChecked(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.advBatchTabCb('tab0'));
  });

  it('ensureLesson15ReadyToExecute writes queries on both tabs', async () => {
    const ctx = makeCtx();
    stubBatchDom(2, true, true);
    stubMonacoEditor('');
    await ensureLesson15ReadyToExecute(ctx);
    // Should have switched tabs and filled queries
    expect(ctx.click).toHaveBeenCalled();
  });

  it('ensureLesson15Executed clicks BATCH_EXECUTE_BTN when not yet run', async () => {
    const ctx = makeCtx();
    stubBatchDom(2, true, true);
    stubMonacoEditor('query { health }');
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    // Remove batch results to simulate not-yet-run state
    document.querySelector(GQL.BATCH_RESULTS)?.remove();
    await ensureLesson15Executed(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });

  it('ensureLesson15Executed guard skips when results already in DOM', async () => {
    const ctx = makeCtx();
    stubBatchDom(2, true, true);
    stubMonacoEditor('query { health }');
    // Batch results already visible (from stubBatchDom)
    await ensureLesson15Executed(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15Executed(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });

  it('ensureLesson15PartialErrorExecuted writes error query and re-executes', async () => {
    const ctx = makeCtx();
    stubBatchDom(2, true, true);
    stubMonacoEditor('query { health }');
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15PartialErrorExecuted(ctx);
    // Should have re-executed batch
    const batchCalls = vi.mocked(ctx.click).mock.calls.filter(
      (args) => args[0] === GQL.BATCH_EXECUTE_BTN,
    );
    expect(batchCalls.length).toBeGreaterThanOrEqual(1);
  });

  // ── Step actions ───────────────────────────────────────────────────────────

  it('gql15-intro action calls delay (observation step)', async () => {
    const ctx = makeCtx();
    stubBatchDom(1);
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-intro')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql15-enable-batch action enables batch without toggling modal closed', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-tab-bar">
        <button role="tab" data-testid="gql-tab-tab0" data-demo-lesson="${GQL15_DEMO}" aria-selected="true">Q GetHealth</button>
        <button data-testid="gql-tab-add-btn">+</button>
      </div>
      <button data-testid="gql-adv-settings-btn">⚙</button>
      <div data-testid="gql-adv-settings-modal">
        <button data-testid="gql-adv-settings-tab-batch" class="active"></button>
        <label data-testid="gql-adv-batch-enable-toggle" class="gql-advsettings-toggle">
          <input type="checkbox" aria-label="Enable query batching" />
        </label>
        <button data-testid="gql-adv-settings-save-btn">Save</button>
      </div>
    `;
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === GQL.ADV_BATCH_ENABLE_TOGGLE) {
        const cb = document.querySelector<HTMLInputElement>(GQL.ADV_BATCH_ENABLE)!;
        cb.checked = true;
        document.body.insertAdjacentHTML('beforeend', '<div data-testid="gql-adv-batch-panel"></div>');
      }
      if (sel === GQL.ADV_SETTINGS_SAVE_BTN) {
        document.body.insertAdjacentHTML('beforeend', '<span data-testid="gql-batch-summary-chip">Batch</span>');
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-enable-batch')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ADV_SETTINGS_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ADV_BATCH_ENABLE_TOGGLE);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ADV_SETTINGS_SAVE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ADV_BATCH_PANEL, 5000);
    expect(ctx.delay).toHaveBeenCalledWith(3500);
  });

  it('gql15-add-tab action adds second tab only', async () => {
    const ctx = makeCtx();
    stubBatchDom(1, false, true);
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === GQL.TAB_ADD_BTN) {
        document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML(
          'beforeend',
          `<button role="tab" data-testid="gql-tab-tab1" data-demo-lesson="${GQL15_DEMO}">Q CheckHealth</button>`,
        );
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-add-tab')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
  });

  it('gql15-batch-run action clicks BATCH_EXECUTE_BTN', async () => {
    const ctx = makeCtx();
    stubBatchDom(2, true, true);
    stubMonacoEditor('query { health }');
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-batch-run')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });

  it('gql15-batch-results action calls delay (observation step)', async () => {
    const ctx = makeCtx();
    stubBatchDom(2, true, true);
    stubMonacoEditor('query { health }');
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-batch-results')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql15-partial-error action re-executes batch after error query', async () => {
    const ctx = makeCtx();
    stubBatchDom(2, true, true);
    stubMonacoEditor('query { health }');
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-partial-error')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    // Should have re-executed batch at least once
    const batchCalls = vi.mocked(ctx.click).mock.calls.filter(
      (args) => args[0] === GQL.BATCH_EXECUTE_BTN,
    );
    expect(batchCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('gql15-export-batch action opens history panel', async () => {
    const ctx = makeCtx();
    stubBatchDom(2, true, true);
    stubMonacoEditor('query { health }');
    document.body.insertAdjacentHTML('beforeend', `
      <button data-testid="gql-activity-history" class="gql-activity-tab"></button>
      <div data-testid="gql-history-panel"></div>
    `);
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    const step = gqlBatchExecutionLesson.steps.find((s) => s.id === 'gql15-export-batch')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
  });

  // ── Setup / cleanup ────────────────────────────────────────────────────────

  it('gqlBatchLessonSetup creates demo workspace and seeds endpoint', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-introspect-btn"></button>
      <span data-testid="gql-schema-badge-ok"></span>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-tab-bar">
        <button role="tab" data-demo-lesson="gql-batch-execution" aria-selected="true">Demo</button>
      </div>
    `;
    stubMonacoEditor('');
    await gqlBatchLessonSetup(ctx);
    expect(ensureGqlDemoTab).toHaveBeenCalledWith(
      ctx,
      'gql-batch-execution',
      'Batch Execution',
      2,
    );
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
  });

  it('gqlBatchLessonCleanup closes demo tabs', async () => {
    const ctx = makeCtx();
    await gqlBatchLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-batch-execution');
  });

  it('ensureLesson15TwoTabsSameEndpoint fills empty endpoint before adding tab', async () => {
    const ctx = makeCtx();
    stubBatchDom(1, false, true);
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = '';
    vi.mocked(ctx.click).mockImplementation(async (sel: string) => {
      if (sel === GQL.TAB_ADD_BTN) {
        document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML(
          'beforeend',
          '<button role="tab">Q CheckHealth</button>',
        );
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15TwoTabsSameEndpoint(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
  });

  it('ensureLesson15PartialErrorExecuted guard skips when already executed', async () => {
    const ctx = makeCtx();
    stubBatchDom(2, true, true);
    stubMonacoEditor('query { health }');
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15PartialErrorExecuted(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15PartialErrorExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });

  it('ensureLesson15BatchEnabled works when batch toggle is already in open modal', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-adv-settings-btn"></button>
      <button data-testid="gql-adv-settings-tab-batch" class="gql-advsettings-tab active"></button>
      <label data-testid="gql-adv-batch-enable-toggle" class="gql-advsettings-toggle">
        <input type="checkbox" aria-label="Enable query batching" />
      </label>
      <button data-testid="gql-adv-settings-save-btn"></button>
    `;
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.ADV_BATCH_ENABLE_TOGGLE) {
        const cb = document.querySelector<HTMLInputElement>(GQL.ADV_BATCH_ENABLE)!;
        cb.checked = true;
      }
      if (sel === GQL.ADV_SETTINGS_SAVE_BTN) {
        document.body.insertAdjacentHTML('beforeend', '<span data-testid="gql-batch-summary-chip">Batch</span>');
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15BatchEnabled(ctx);
    expect(document.querySelector<HTMLInputElement>(GQL.ADV_BATCH_ENABLE)?.checked).toBe(true);
  });
});
