/**
 * Shared setup for split lesson15-batch-execution test files.
 */
import { GQL_DEMO_VAR, resetGqlLesson15SessionFlags } from './lesson15-batch-execution';

export const GQL15_DEMO = 'gql-batch-execution';

export const DEMO_TAB = `role="tab" data-demo-lesson="${GQL15_DEMO}"`;

export const DEMO_TAB0 = `${DEMO_TAB} data-testid="gql-tab-tab0"`;

export const DEMO_TAB1 = `${DEMO_TAB} data-testid="gql-tab-tab1"`;

export function stubAdvBatchDom(tabCount: number, checked: boolean): string {
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

export function setupLesson15BatchExecutionBeforeEach(): void {
  document.body.innerHTML = '';
  resetGqlLesson15SessionFlags();
}
