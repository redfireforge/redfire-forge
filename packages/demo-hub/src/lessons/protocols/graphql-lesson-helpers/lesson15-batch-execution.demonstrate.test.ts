/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  setupLesson15BatchExecutionBeforeEach,
  DEMO_TAB,
  DEMO_TAB0,
  DEMO_TAB1,
  stubAdvBatchDom,
} from './lesson15-batch-execution.testHelpers';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';
import { stubMonacoEditor } from '../__test-utils__/graphql-test-fixtures';
import {
  GQL_DEMO_VAR,
  resetGqlLesson15SessionFlags,
  ensureLesson15BatchEnabled,
  ensureLesson15BothTabsChecked,
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
} from './lesson15-batch-execution';

describe('lesson15 demonstrate actions — demonstrate', () => {
  beforeEach(() => {
    setupLesson15BatchExecutionBeforeEach();
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
    // spotlightAndPause settle (280) + HOLD.payoff (1400) on transport/results.
    expect(ctx.delay).toHaveBeenCalledWith(280);
    expect(ctx.delay).toHaveBeenCalledWith(1400);
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
      <div data-testid="gql-batch-results">
        <button data-testid="gql-batch-results-close-btn">Close</button>
      </div>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-error-list"></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.BATCH_RESULTS_CLOSE_BTN) {
        document.querySelector(GQL.BATCH_RESULTS)?.remove();
      }
    });
    await demonstrateLesson15PartialError(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
    expect(ctx.delay).toHaveBeenCalledWith(700);
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
      <div data-testid="gql-batch-results">
        <button data-testid="gql-batch-results-close-btn">Close</button>
      </div>
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-rv-tab-metadata"></button>
      <div data-testid="gql-rv-error-list"></div>
    `;
    stubMonacoEditor('query { health }');
    const ctx = makeCtx();
    vi.mocked(ctx.waitFor).mockResolvedValue(undefined);
    vi.mocked(ctx.click).mockImplementation(async (sel) => {
      if (sel === GQL.BATCH_RESULTS_CLOSE_BTN) {
        document.querySelector(GQL.BATCH_RESULTS)?.remove();
      }
    });
    await demonstrateLesson15PartialError(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
    vi.mocked(ctx.click).mockClear();
    // Re-seed modal so short-circuit can spotlight the failed pill again.
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div data-testid="gql-batch-results">
        <button data-testid="gql-batch-results-close-btn">Close</button>
        <span data-testid="gql-batch-results-failed-pill">1 failed</span>
      </div>`,
    );
    await demonstrateLesson15PartialError(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.BATCH_EXECUTE_BTN);
    expect(ctx.click).toHaveBeenCalledWith(GQL.RV_TAB_METADATA);
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
