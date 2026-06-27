/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql15'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  GQL15_LESSON_ID: 'gql-batch-execution',
}));

vi.mock('../../../adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../adapters')>();
  return {
    ...actual,
    resetGqlDemoBatchDetection: vi.fn(async () => true),
  };
});

import { resetGqlDemoBatchDetection } from '../../../adapters';

import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import { stubMonacoEditor } from '../__test-utils__/graphql-test-fixtures';
import { closeGqlDemoTabs } from './gql-demo-tab';
import {
  GQL_DEMO_VAR,
  resetGqlLesson15SessionFlags,
  ensureLesson15BatchEnabled,
  ensureLesson15BothTabsChecked,
  ensureLesson15TwoTabsSameEndpoint,
  ensureLesson15ReadyToExecute,
  ensureLesson15Executed,
  ensureLesson15PartialErrorExecuted,
  demonstrateLesson15EnableBatch,
  demonstrateLesson15AddSecondTab,
  demonstrateLesson15SelectBatchTabs,
  demonstrateLesson15WriteQueries,
  demonstrateLesson15PartialError,
  demonstrateLesson15BatchResults,
  demonstrateLesson15BatchResponseSlice,
  demonstrateLesson15OpenHistory,
  prepareGql15BatchResultsReading,
  prepareGql15BatchResponseSliceReading,
  prepareGql15ExportBatchReading,
  prepareGql15PartialErrorReading,
  ensureLesson15IntroReady,
  gqlBatchLessonSetup,
  gqlBatchLessonCleanup,
  LESSON15_TAB2_QUERY,
  LESSON15_ERROR_QUERY,
} from './lesson15-batch-execution';

const GQL15_DEMO = 'gql-batch-execution';
const DEMO_TAB = `role="tab" data-demo-lesson="${GQL15_DEMO}"`;
const DEMO_TAB0 = `${DEMO_TAB} data-testid="gql-tab-tab0"`;
const DEMO_TAB1 = `${DEMO_TAB} data-testid="gql-tab-tab1"`;

function stubAdvBatchDom(tabCount: number, checked: boolean): string {
  const tabs = Array.from({ length: tabCount }, (_, i) => `
    <button role="tab" data-demo-lesson="${GQL15_DEMO}" data-testid="gql-tab-tab${i}">Q${i + 1}
      ${checked ? `<span data-testid="gql-tab-batch-badge-tab${i}" class="gql-tab-batch-badge">B</span>` : ''}
    </button>
  `).join('');
  const cbs = Array.from({ length: tabCount }, (_, i) => `
    <label data-testid="gql-adv-batch-tab-label-tab${i}" class="gql-adv-batch-panel__tab-label">
      <input type="checkbox" data-testid="gql-adv-batch-tab-cb-tab${i}" class="gql-adv-batch-panel__tab-cb-input" ${checked ? 'checked' : ''} />
    </label>
  `).join('');
  return `
    <span data-testid="gql-batch-summary-chip">Batch</span>
    <label data-testid="gql-adv-batch-enable-toggle" class="gql-advsettings-toggle">
      <input type="checkbox" aria-label="Enable query batching" checked />
    </label>
    <button data-testid="gql-adv-settings-btn"></button>
    <button data-testid="gql-adv-settings-tab-batch" class="gql-advsettings-tab active"></button>
    <div data-testid="gql-adv-batch-panel">${cbs}</div>
    <button data-testid="gql-adv-settings-save-btn"></button>
    <div data-testid="gql-tab-bar">${tabs}</div>
    <input data-testid="gql-endpoint-input" value="${GQL_DEMO_VAR}" />
  `;
}

describe('lesson15-batch-execution helpers (direct)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson15SessionFlags();
  });

  it('ensureLesson15BatchEnabled skips when flag set and batch chip visible', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15BatchEnabled(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15BatchEnabled(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureLesson15BothTabsChecked guard skips when already checked', async () => {
    document.body.innerHTML = stubAdvBatchDom(2, true);
    const ctx = makeCtx();
    await ensureLesson15BothTabsChecked(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15BothTabsChecked(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureLesson15TwoTabsSameEndpoint skips when two tabs already exist', async () => {
    document.body.innerHTML = `
      <span data-testid="gql-batch-summary-chip">Batch</span>
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_VAR}" />
      <div data-testid="gql-tab-bar">
        <button ${DEMO_TAB0}>Q1</button>
        <button ${DEMO_TAB1}>Q2</button>
      </div>
    `;
    const ctx = makeCtx();
    await ensureLesson15TwoTabsSameEndpoint(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15TwoTabsSameEndpoint(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
  });

  it('ensureLesson15Executed skips when batch results already visible', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <div data-testid="gql-batch-results"></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15Executed(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15Executed(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });

  it('ensureLesson15Executed skips when batch banner visible without modal', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-response-viewer">
        <div data-testid="gql-rv-batch-banner"></div>
      </div>
    `;
    document.querySelector(GQL.BATCH_RESULTS)?.remove();
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15Executed(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });

  it('ensureLesson15TwoTabsSameEndpoint sets Tab 2 direct URL when second tab is added', async () => {
    document.body.innerHTML = `
      <span data-testid="gql-batch-summary-chip">Batch</span>
      <input data-testid="gql-endpoint-input" value="" />
      <div data-testid="gql-tab-bar"><button ${DEMO_TAB0}>Q1</button></div>
      <button data-testid="gql-tab-add-btn"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.TAB_ADD_BTN) {
        document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML(
          'beforeend',
          `<button ${DEMO_TAB1}>Q2</button>`,
        );
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15TwoTabsSameEndpoint(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, expect.stringContaining('4010'));
  });

  it('ensureLesson15BatchEnabled finds Batch tab via settings tab strip text', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-adv-settings-btn"></button>
      <button class="gql-advsettings-tab">Batch</button>
      <button data-testid="gql-adv-settings-save-btn"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (String(sel).includes('gql15-settings-batch-tab')) {
        document.body.insertAdjacentHTML(
          'beforeend',
          '<input type="checkbox" aria-label="Enable query batching" checked />',
        );
      }
    });
    await ensureLesson15BatchEnabled(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ADV_SETTINGS_BTN);
  });

  it('ensureLesson15BatchEnabled opens advanced settings when batch toggle not visible', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-adv-settings-btn"></button>
      <button data-testid="gql-adv-settings-tab-batch"></button>
      <button data-testid="gql-adv-settings-save-btn"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.ADV_SETTINGS_TAB_BATCH) {
        document.body.insertAdjacentHTML(
          'beforeend',
          `<label data-testid="gql-adv-batch-enable-toggle" class="gql-advsettings-toggle">
            <input type="checkbox" aria-label="Enable query batching" />
          </label>`,
        );
      }
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
    expect(ctx.click).toHaveBeenCalledWith(GQL.ADV_SETTINGS_TAB_BATCH);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ADV_BATCH_ENABLE_TOGGLE);
  });

  it('ensureLesson15BatchEnabled re-checks checkbox when session flag set but DOM unchecked', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-adv-settings-btn"></button>
      <button data-testid="gql-adv-settings-tab-batch"></button>
      <label data-testid="gql-adv-batch-enable-toggle" class="gql-advsettings-toggle">
        <input type="checkbox" aria-label="Enable query batching" checked />
      </label>
      <button data-testid="gql-adv-settings-save-btn"></button>
    `;
    const ctx = makeCtx();
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
    const checkbox = document.querySelector<HTMLInputElement>(GQL.ADV_BATCH_ENABLE)!;
    checkbox.checked = false;
    resetGqlLesson15SessionFlags();
    await ensureLesson15BatchEnabled(ctx);
    expect(checkbox.checked).toBe(true);
  });

  it('ensureLesson15BatchEnabled uses batch tab test id when present', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-adv-settings-btn"></button>
      <button data-testid="gql-adv-settings-tab-batch"></button>
      <button data-testid="gql-adv-settings-save-btn"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.ADV_SETTINGS_TAB_BATCH) {
        document.body.insertAdjacentHTML(
          'beforeend',
          '<input type="checkbox" aria-label="Enable query batching" checked />',
        );
      }
    });
    await ensureLesson15BatchEnabled(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ADV_SETTINGS_TAB_BATCH);
  });

  it('gqlBatchLessonCleanup closes demo tabs', async () => {
    const ctx = makeCtx();
    await gqlBatchLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, GQL15_DEMO);
  });

  it('exports lesson 15 query constants', () => {
    expect(LESSON15_TAB2_QUERY).toContain('CheckHealth');
    expect(LESSON15_ERROR_QUERY).toContain('nonexistent');
  });

  it('ensureLesson15TwoTabsSameEndpoint adds a second tab when only one exists', async () => {
    document.body.innerHTML = `
      <input type="checkbox" aria-label="Enable query batching" checked />
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_VAR}" />
      <div data-testid="gql-tab-bar"><button ${DEMO_TAB}>Q1</button></div>
      <button data-testid="gql-tab-add-btn"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.TAB_ADD_BTN) {
        document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML(
          'beforeend',
          `<button ${DEMO_TAB}>Q2</button>`,
        );
      }
    });
    await ensureLesson15TwoTabsSameEndpoint(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
    expect(document.querySelectorAll(`[data-demo-lesson="${GQL15_DEMO}"]`).length).toBe(2);
  });

  it('ensureLesson15BothTabsChecked toggles unchecked adv batch checkboxes', async () => {
    document.body.innerHTML = stubAdvBatchDom(2, false);
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (String(sel).includes('gql-adv-batch-tab-label-')) {
        const tabId = String(sel).match(/tab(\d+)/)?.[1];
        const cb = document.querySelector<HTMLInputElement>(`[data-testid="gql-adv-batch-tab-cb-tab${tabId}"]`);
        if (cb) cb.checked = true;
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15BothTabsChecked(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('ensureLesson15ReadyToExecute fills health queries on both tabs', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await ensureLesson15ReadyToExecute(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('ensureLesson15Executed runs batch when results panel is absent', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (sel === GQL.BATCH_RESULTS) {
        document.body.insertAdjacentHTML('beforeend', '<div data-testid="gql-batch-results"></div>');
      }
    });
    await ensureLesson15Executed(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });

  it('ensureLesson15PartialErrorExecuted runs batch after writing error query on tab 2', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-batch-results"></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (sel === GQL.BATCH_RESULTS) {
        document.body.insertAdjacentHTML('beforeend', '<div data-testid="gql-batch-results"></div>');
      }
    });
    await ensureLesson15PartialErrorExecuted(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });

  it('gqlBatchLessonSetup closes an open History activity panel', async () => {
    document.body.innerHTML = `
      <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
      <select data-testid="header-svc-select"><option>graphql-demo</option></select>
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-history-panel"></div>
      <button data-testid="gql-right-tab-response"></button>
      <button data-testid="gql-right-tab-schema" aria-selected="true"></button>
      <button data-testid="gql-introspect-btn"></button>
      <div data-testid="gql-tab-bar"><button ${DEMO_TAB}>Q1</button></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-schema-explorer">
        <div data-testid="gql-se-type-list">
          <button data-testid="gql-se-type-Query"></button>
        </div>
      </div>
    `;
    stubMonacoEditor('');
    const ctx = makeCtx();
    await gqlBatchLessonSetup(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RIGHT_TAB_RESPONSE);
  });

  it('ensureLesson15IntroReady closes History sidebar before step 1 reading', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>
      <div data-testid="gql-tab-bar"></div>
    `;
    const ctx = makeCtx();
    await ensureLesson15IntroReady(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.TAB_BAR, 5000);
  });

  it('gqlBatchLessonSetup clears cached batch-unsupported detection before studio setup', async () => {
    document.body.innerHTML = `
      <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
      <select data-testid="header-svc-select"><option>graphql-demo</option></select>
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <div data-testid="gql-tab-bar"><button ${DEMO_TAB}>Q1</button></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await gqlBatchLessonSetup(ctx);
    expect(resetGqlDemoBatchDetection).toHaveBeenCalled();
  });

  it('gqlBatchLessonSetup ensures editor mode, demo endpoint, and introspection', async () => {
    document.body.innerHTML = `
      <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
      <select data-testid="header-svc-select"><option>graphql-demo</option></select>
      <input data-testid="gql-endpoint-input" value="" />
      <button data-testid="gql-mode-editor" class="gql-mode-btn"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
      <button data-testid="gql-right-tab-schema"></button>
      <button data-testid="gql-introspect-btn"></button>
      <div data-testid="gql-tab-bar"><button ${DEMO_TAB}>Q1</button></div>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-schema-explorer">
        <div data-testid="gql-se-type-list">
          <button data-testid="gql-se-type-Query"></button>
        </div>
      </div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await gqlBatchLessonSetup(ctx);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
    expect(ctx.click).toHaveBeenCalledWith(GQL.MODE_EDITOR);
  });

  it('ensureLesson15BatchEnabled skips checkbox click when toggle element is missing', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-adv-settings-btn"></button>
      <button data-testid="gql-adv-settings-tab-batch"></button>
      <button data-testid="gql-adv-settings-save-btn"></button>
    `;
    const ctx = makeCtx();
    await ensureLesson15BatchEnabled(ctx);
    expect(document.querySelector('[aria-label="Enable query batching"]')).toBeNull();
  });

  it('ensureLesson15BatchEnabled ignores non-Batch settings tabs in the strip', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-adv-settings-btn"></button>
      <button class="gql-advsettings-tab">General</button>
      <button data-testid="gql-adv-settings-save-btn"></button>
    `;
    const ctx = makeCtx();
    await ensureLesson15BatchEnabled(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ADV_SETTINGS_BTN);
  });

  it('ensureLesson15TwoTabsSameEndpoint skips endpoint fill when input element is missing', async () => {
    document.body.innerHTML = `
      <input type="checkbox" aria-label="Enable query batching" checked />
      <div data-testid="gql-tab-bar"><button ${DEMO_TAB}>Q1</button></div>
      <button data-testid="gql-tab-add-btn"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.TAB_ADD_BTN) {
        document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML('beforeend', `<button ${DEMO_TAB}>Q2</button>`);
      }
    });
    await ensureLesson15TwoTabsSameEndpoint(ctx);
    expect(ctx.fill).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_DEMO_VAR);
  });

  it('ensureLesson15BothTabsChecked only toggles demo tabs in adv batch panel', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <input type="checkbox" data-testid="gql-adv-batch-tab-cb-user1" class="gql-adv-batch-panel__tab-cb-input" />
    `;
    const ctx = makeCtx();
    await ensureLesson15BothTabsChecked(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.advBatchTabCb('user1'));
  });

  it('ensureLesson15ReadyToExecute handles a single-tab workspace', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(1, true)}
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await ensureLesson15ReadyToExecute(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('ensureLesson15Executed does not re-run when results panel is dismissed after first run', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (sel === GQL.BATCH_RESULTS) {
        document.body.insertAdjacentHTML('beforeend', '<div data-testid="gql-batch-results"></div>');
      }
    });
    await ensureLesson15Executed(ctx);
    document.querySelector(GQL.BATCH_RESULTS)?.remove();
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15Executed(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });

  it('gqlBatchLessonCleanup clears cached batch-unsupported detection', async () => {
    vi.mocked(resetGqlDemoBatchDetection).mockClear();
    const ctx = makeCtx();
    await gqlBatchLessonCleanup(ctx);
    expect(resetGqlDemoBatchDetection).toHaveBeenCalled();
  });

  it('gqlBatchLessonCleanup closes activity panel and demo tabs', async () => {
    document.body.innerHTML =
      '<button data-testid="gql-activity-history" class="gql-activity-tab--active"></button>';
    const ctx = makeCtx();
    await gqlBatchLessonCleanup(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, 'gql-batch-execution');
  });

  it('gqlBatchLessonCleanup delegates to closeGqlDemoTabs', async () => {
    const ctx = makeCtx();
    await gqlBatchLessonCleanup(ctx);
    expect(closeGqlDemoTabs).toHaveBeenCalledWith(ctx, GQL15_DEMO);
  });

  it('ensureLesson15PartialErrorExecuted skips on second call', async () => {
    document.body.innerHTML = `
      <div data-testid="gql-tab-bar">
        <button ${DEMO_TAB}>Q1</button>
        <button ${DEMO_TAB}>Q2</button>
      </div>
      <input type="checkbox" aria-label="Enable query batching" checked />
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_VAR}" />
      <span class="gql-tab-batch-cb" role="checkbox" aria-checked="true" aria-label="Include Tab 1 in batch"></span>
      <span class="gql-tab-batch-cb" role="checkbox" aria-checked="true" aria-label="Include Tab 2 in batch"></span>
      <button data-testid="gql-send-batch-btn"></button>
      <div data-testid="gql-batch-results"></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15PartialErrorExecuted(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15PartialErrorExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });
});

describe('lesson15 demonstrate actions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson15SessionFlags();
  });

  it('demonstrateLesson15EnableBatch opens settings and enables batch', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-adv-settings-btn"></button>
      <div data-testid="gql-adv-settings-modal">
        <button data-testid="gql-adv-settings-tab-batch" class="active"></button>
        <label data-testid="gql-adv-batch-enable-toggle" class="gql-advsettings-toggle">
          <input type="checkbox" aria-label="Enable query batching" />
        </label>
        <button data-testid="gql-adv-settings-save-btn"></button>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.ADV_BATCH_ENABLE_TOGGLE) {
        document.querySelector<HTMLInputElement>(GQL.ADV_BATCH_ENABLE)!.checked = true;
        if (!document.querySelector(GQL.ADV_BATCH_PANEL)) {
          document.body.insertAdjacentHTML('beforeend', '<div data-testid="gql-adv-batch-panel"></div>');
        }
      }
      if (sel === GQL.ADV_SETTINGS_SAVE_BTN) {
        document.body.insertAdjacentHTML('beforeend', '<span data-testid="gql-batch-summary-chip">Batch</span>');
      }
    });
    await demonstrateLesson15EnableBatch(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.ADV_SETTINGS_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ADV_BATCH_ENABLE_TOGGLE);
  });

  it('demonstrateLesson15EnableBatch short-circuits when batch already enabled', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await demonstrateLesson15EnableBatch(ctx);
    vi.mocked(ctx.click).mockClear();
    await demonstrateLesson15EnableBatch(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('demonstrateLesson15AddSecondTab adds tab and sets Tab 2 localhost URL', async () => {
    document.body.innerHTML = `
      <span data-testid="gql-batch-summary-chip">Batch</span>
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_VAR}" />
      <div data-testid="gql-tab-bar"><button ${DEMO_TAB}>Q1</button></div>
      <button data-testid="gql-tab-add-btn"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.TAB_ADD_BTN) {
        document.querySelector(GQL.TAB_BAR)!.insertAdjacentHTML(
          'beforeend',
          `<button ${DEMO_TAB1}>Q2</button>`,
        );
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await demonstrateLesson15AddSecondTab(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, expect.stringContaining('4010'));
  });

  it('demonstrateLesson15AddSecondTab short-circuits add when two tabs exist', async () => {
    document.body.innerHTML = `
      <span data-testid="gql-batch-summary-chip">Batch</span>
      <input data-testid="gql-endpoint-input" value="${GQL_DEMO_VAR}" />
      <div data-testid="gql-tab-bar">
        <button ${DEMO_TAB0}>Q1</button>
        <button ${DEMO_TAB1}>Q2</button>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await demonstrateLesson15AddSecondTab(ctx);
    vi.mocked(ctx.click).mockClear();
    await demonstrateLesson15AddSecondTab(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.TAB_ADD_BTN);
  });

  it('demonstrateLesson15SelectBatchTabs checks both demo tabs', async () => {
    document.body.innerHTML = stubAdvBatchDom(2, false);
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (String(sel).includes('gql-adv-batch-tab-label-')) {
        const tabId = String(sel).match(/tab(\d+)/)?.[1];
        const cb = document.querySelector<HTMLInputElement>(`[data-testid="gql-adv-batch-tab-cb-tab${tabId}"]`);
        if (cb) cb.checked = true;
      }
    });
    await demonstrateLesson15SelectBatchTabs(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('demonstrateLesson15WriteQueries fills queries on both tabs', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await demonstrateLesson15WriteQueries(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('prepareGql15BatchResultsReading reopens batch modal when dismissed after execute', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-response-viewer">
        <div data-testid="gql-rv-batch-banner">
          <button data-testid="gql-rv-open-batch-results">View full batch</button>
        </div>
      </div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.RESPONSE_OPEN_BATCH_RESULTS) {
        document.body.insertAdjacentHTML('beforeend', `
          <div data-testid="gql-batch-results">
            <p data-testid="gql-batch-results-transport">1 upstream HTTP POST</p>
          </div>
        `);
      }
    });
    await prepareGql15BatchResultsReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RESPONSE_OPEN_BATCH_RESULTS);
    expect(document.querySelector(GQL.BATCH_RESULTS)).not.toBeNull();
  });

  it('demonstrateLesson15BatchResults observes modal without closing', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <div data-testid="gql-batch-results">
        <p data-testid="gql-batch-results-transport">1 upstream HTTP POST</p>
        <button data-testid="gql-batch-results-close-btn">Close</button>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await demonstrateLesson15BatchResults(ctx);
    expect(ctx.delay).toHaveBeenCalledWith(2000);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BATCH_RESULTS_CLOSE_BTN);
    expect(document.querySelector(GQL.BATCH_RESULTS)).not.toBeNull();
  });

  it('demonstrateLesson15BatchResponseSlice closes modal and reopens via link', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <div data-testid="gql-batch-results">
        <button data-testid="gql-batch-results-close-btn">Close</button>
      </div>
      <div data-testid="gql-response-viewer">
        <div data-testid="gql-rv-batch-banner">
          <span data-testid="gql-rv-batch-pill">Batch 1/2</span>
          <button data-testid="gql-rv-open-batch-results">View full batch</button>
        </div>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.BATCH_RESULTS_CLOSE_BTN) {
        document.querySelector(GQL.BATCH_RESULTS)?.remove();
      }
      if (sel === GQL.RESPONSE_OPEN_BATCH_RESULTS) {
        document.body.insertAdjacentHTML('beforeend', `
          <div data-testid="gql-batch-results">
            <button data-testid="gql-batch-results-close-btn">Close</button>
          </div>
        `);
      }
    });
    await demonstrateLesson15BatchResponseSlice(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_RESULTS_CLOSE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RESPONSE_OPEN_BATCH_RESULTS);
  });

  it('prepareGql15BatchResponseSliceReading dismisses modal and waits for batch banner', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <div data-testid="gql-batch-results">
        <button data-testid="gql-batch-results-close-btn">Close</button>
      </div>
      <div data-testid="gql-response-viewer">
        <div data-testid="gql-rv-batch-banner"></div>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.BATCH_RESULTS_CLOSE_BTN) {
        document.querySelector(GQL.BATCH_RESULTS)?.remove();
      }
    });
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await prepareGql15BatchResponseSliceReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_RESULTS_CLOSE_BTN);
    expect(document.querySelector(GQL.BATCH_RESULTS)).toBeNull();
  });

  it('prepareGql15PartialErrorReading reopens batch modal when partial error already ran', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-response-viewer">
        <button data-testid="gql-rv-open-batch-results">View full batch</button>
      </div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.BATCH_EXECUTE_BTN) {
        document.body.insertAdjacentHTML('beforeend', `
          <div data-testid="gql-batch-results">
            <span data-testid="gql-batch-results-failed-pill">1 failed</span>
          </div>
        `);
      }
      if (sel === GQL.BATCH_RESULTS_CLOSE_BTN) {
        document.querySelector(GQL.BATCH_RESULTS)?.remove();
      }
      if (sel === GQL.RESPONSE_OPEN_BATCH_RESULTS) {
        document.body.insertAdjacentHTML('beforeend', `
          <div data-testid="gql-batch-results">
            <span data-testid="gql-batch-results-failed-pill">1 failed</span>
          </div>
        `);
      }
    });
    await ensureLesson15PartialErrorExecuted(ctx);
    document.querySelector(GQL.BATCH_RESULTS)?.remove();
    vi.mocked(ctx.click).mockClear();
    await prepareGql15PartialErrorReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RESPONSE_OPEN_BATCH_RESULTS);
    expect(document.querySelector(GQL.BATCH_RESULTS)).not.toBeNull();
  });

  it('prepareGql15PartialErrorReading dismisses open batch results panel', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <div data-testid="gql-batch-results">
        <button data-testid="gql-batch-results-close-btn">Close</button>
      </div>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.BATCH_RESULTS_CLOSE_BTN) {
        document.querySelector(GQL.BATCH_RESULTS)?.remove();
      }
    });
    await prepareGql15PartialErrorReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_RESULTS_CLOSE_BTN);
    expect(document.querySelector(GQL.BATCH_RESULTS)).toBeNull();
  });

  it('prepareGql15PartialErrorReading focuses Tab 2 editor after dismissing batch modal', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <div data-testid="gql-batch-results">
        <button data-testid="gql-batch-results-close-btn">Close</button>
      </div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.BATCH_RESULTS_CLOSE_BTN) {
        document.querySelector(GQL.BATCH_RESULTS)?.remove();
      }
    });
    await prepareGql15PartialErrorReading(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_RESULTS_CLOSE_BTN);
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.EDITOR, expect.any(Number));
  });

  it('ensureLesson15PartialErrorExecuted skips when failed pill already visible', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-batch-results">
        <span data-testid="gql-batch-results-failed-pill">1 failed</span>
      </div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15PartialErrorExecuted(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15PartialErrorExecuted(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });

  it('prepareGql15ExportBatchReading dismisses batch modal after partial-error run', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-batch-results">
        <button data-testid="gql-batch-results-close-btn">Close</button>
      </div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.BATCH_RESULTS_CLOSE_BTN) {
        document.querySelector(GQL.BATCH_RESULTS)?.remove();
      }
    });
    await prepareGql15ExportBatchReading(ctx);
    expect(document.querySelector(GQL.BATCH_RESULTS)).toBeNull();
  });

  it('demonstrateLesson15PartialError writes error query and re-runs batch', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-batch-results"></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await demonstrateLesson15PartialError(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });

  it('demonstrateLesson15OpenHistory closes batch modal before opening history', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-batch-results">
        <button data-testid="gql-batch-results-close-btn">Close</button>
      </div>
      <button data-testid="gql-activity-history"></button>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockImplementation(async (sel) => {
      if (sel === GQL.HISTORY_PANEL) {
        document.body.insertAdjacentHTML('beforeend', '<div data-testid="gql-history-panel"></div>');
      }
    });
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.BATCH_RESULTS_CLOSE_BTN) {
        document.querySelector(GQL.BATCH_RESULTS)?.remove();
      }
    });
    await demonstrateLesson15OpenHistory(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_RESULTS_CLOSE_BTN);
    expect(document.querySelector(GQL.BATCH_RESULTS)).toBeNull();
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_HISTORY);
  });

  it('ensureLesson15BatchEnabled detects batch via ADV_BATCH_ENABLE checkbox without opening settings', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await ensureLesson15BatchEnabled(ctx);
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15BatchEnabled(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('demonstrateLesson15WriteQueries short-circuits when queries already written', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    await demonstrateLesson15WriteQueries(ctx);
    vi.mocked(ctx.click).mockClear();
    await demonstrateLesson15WriteQueries(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('demonstrateLesson15PartialError short-circuits when partial error already run', async () => {
    document.body.innerHTML = `
      ${stubAdvBatchDom(2, true)}
      <button data-testid="gql-send-batch-btn"></button>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
      <div data-testid="gql-batch-results"></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    await demonstrateLesson15PartialError(ctx);
    vi.mocked(ctx.click).mockClear();
    await demonstrateLesson15PartialError(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
  });

  it('demonstrateLesson15SelectBatchTabs short-circuits when both tabs already batched', async () => {
    document.body.innerHTML = stubAdvBatchDom(2, true);
    const ctx = makeCtx();
    await demonstrateLesson15SelectBatchTabs(ctx);
    vi.mocked(ctx.click).mockClear();
    await demonstrateLesson15SelectBatchTabs(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('openAdvancedSettingsBatchTab uses text fallback when batch tab test id missing', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-adv-settings-btn"></button>
      <button class="gql-advsettings-tab">Batch</button>
      <button data-testid="gql-adv-settings-save-btn"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (String(sel).includes('gql15-settings-batch-tab')) {
        document.body.insertAdjacentHTML(
          'beforeend',
          '<input type="checkbox" aria-label="Enable query batching" checked />',
        );
      }
    });
    await ensureLesson15BatchEnabled(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ADV_SETTINGS_BTN);
  });

  it('ensureLesson15BothTabsChecked re-checks when session flag set but badges missing', async () => {
    document.body.innerHTML = stubAdvBatchDom(2, false);
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (String(sel).includes('gql-adv-batch-tab-label-')) {
        const tabId = String(sel).match(/tab(\d+)/)?.[1];
        const cb = document.querySelector<HTMLInputElement>(`[data-testid="gql-adv-batch-tab-cb-tab${tabId}"]`);
        if (cb) cb.checked = true;
        document.querySelector(`[data-testid="gql-tab-tab${tabId}"]`)?.insertAdjacentHTML(
          'beforeend',
          `<span data-testid="gql-tab-batch-badge-tab${tabId}" class="gql-tab-batch-badge">B</span>`,
        );
      }
    });
    await ensureLesson15BothTabsChecked(ctx);
    document.querySelectorAll('[data-testid^="gql-tab-batch-badge-"]').forEach((el) => el.remove());
    resetGqlLesson15SessionFlags();
    vi.mocked(ctx.click).mockClear();
    await ensureLesson15BothTabsChecked(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('saveAdvancedSettings no-ops when save button absent', async () => {
    document.body.innerHTML = `
      <button data-testid="gql-adv-settings-btn"></button>
      <button data-testid="gql-adv-settings-tab-batch"></button>
    `;
    const ctx = makeCtx();
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.ADV_SETTINGS_TAB_BATCH) {
        document.body.insertAdjacentHTML(
          'beforeend',
          `<label data-testid="gql-adv-batch-enable-toggle" class="gql-advsettings-toggle">
            <input type="checkbox" aria-label="Enable query batching" />
          </label>`,
        );
      }
      if (sel === GQL.ADV_BATCH_ENABLE_TOGGLE) {
        document.querySelector<HTMLInputElement>(GQL.ADV_BATCH_ENABLE)!.checked = true;
      }
    });
    await ensureLesson15BatchEnabled(ctx);
    expect(document.querySelector(GQL.ADV_SETTINGS_SAVE_BTN)).toBeNull();
  });
});
