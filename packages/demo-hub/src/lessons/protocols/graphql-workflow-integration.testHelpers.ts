/**
 * Shared setup for split graphql-workflow-integration test files.
 */
import { vi } from 'vitest';
import {
  GQL_DEMO_HTTP,
  GQL_DEMO_VAR,
  LESSON11_LATENCY_VAR,
  LESSON11_WF_NAME,
  resetGqlLesson11SessionFlags,
} from './graphql-lesson-helpers';

export function mockLesson11WorkflowBridge(thresholdMs = '2000'): void {
  (window as unknown as Record<string, unknown>).__wfGetWorkflowByName = (name: string) => {
    if (name !== LESSON11_WF_NAME) return null;
    return {
      variables: { graphqlUrl: GQL_DEMO_HTTP },
      nodes: [
        {
          type: 'graphqlQuery',
          data: {
            endpoint: GQL_DEMO_VAR,
            query: 'query { health }',
            outputBindings: [{ field: 'latencyMs', variableName: LESSON11_LATENCY_VAR, enabled: true }],
          },
        },
        {
          type: 'graphqlAssert',
          data: {
            sourceVariable: LESSON11_LATENCY_VAR,
            assertions: [{ jsonPath: '$', operator: 'less_than', expectedValue: thresholdMs }],
          },
        },
      ],
    };
  };
}

export function buildQueryConfigDom(): string {
  return `
    <div class="wf-canvas-area"></div>
    <button class="wf-palette-block-graphqlQuery"></button>
    <div class="react-flow__node-start" data-id="start1"></div>
    <div class="react-flow__node-graphqlQuery" data-id="q1">
      <div data-testid="gql-canvas-query-node"></div>
    </div>
    <button data-testid="wf-sidebar-new-btn" title="New workflow"></button>
    <div class="wf-new-dropdown"></div>
      <button data-testid="wf-new-blank-item" class="wf-new-dropdown-item"></button>
    <input data-testid="wf-create-input" class="req-confirm-input" />
    <button data-testid="wf-create-ok" class="req-confirm-ok"></button>
    <div class="wf-config-modal">
      <div data-testid="gql-wf-query-panel">
        <button type="button" class="gql-wf-subtab"><span>Operation</span></button>
        <button type="button" class="gql-wf-subtab"><span>Output</span></button>
        <input data-testid="gql-wf-endpoint-input" />
        <textarea data-testid="gql-wf-query-editor"></textarea>
        <div data-testid="gql-wf-output-table">
          <button data-testid="gql-wf-output-add-btn"></button>
          <select data-testid="gql-wf-output-field-select"><option value="latencyMs">latencyMs</option></select>
          <input data-testid="gql-wf-output-varname" />
        </div>
      </div>
      <div class="wf-config-modal-footer-actions"><button class="btn-ghost">Close</button><button class="btn-primary">Save</button></div>
    </div>
  `;
}

export function buildFullAssertDom(): string {
  return `
    ${buildQueryConfigDom()}
    <div class="react-flow__node-graphqlAssert" data-id="a1">
      <div data-testid="gql-canvas-assert-node"></div>
    </div>
    <div class="wf-config-modal">
      <div data-testid="gql-wf-assert-panel">
          <button type="button" class="gql-wf-subtab"><span>Source</span></button>
          <button type="button" class="gql-wf-subtab"><span>Assertions</span></button>
        <input data-testid="gql-wf-assert-source-var" />
        <button data-testid="gql-wf-assert-add-btn"></button>
        <div data-testid="gql-wf-assert-row">
          <input data-testid="gql-wf-assert-jsonpath" />
          <select data-testid="gql-wf-assert-operator"><option value="less_than">&lt;</option></select>
          <input data-testid="gql-wf-assert-expected" />
          <input data-testid="gql-wf-assert-description" />
        </div>
      </div>
      <div class="wf-config-modal-footer-actions">
        <button class="btn-primary"></button>
        <button class="btn-ghost"></button>
      </div>
    </div>
    <button class="wf-quick-test-btn"></button>
    <button title="Fit view"></button>
    <button class="wf-toolbar-save-wrap"><button></button></button>
    <div data-testid="wf-exec-summary"></div>
  `;
}

export function setupGraphqlWorkflowIntegrationBeforeEach(): void {
  document.body.innerHTML = '';
      resetGqlLesson11SessionFlags();
}

export async function teardownGraphqlWorkflowIntegrationAfterEach(): Promise<void> {
  vi.unstubAllGlobals();
      delete (window as unknown as Record<string, unknown>).__wfConnect;
      delete (window as unknown as Record<string, unknown>).__wfOpenNodeConfig;
      delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
      delete (window as unknown as Record<string, unknown>).__wfGetWorkflowByName;
      delete (window as unknown as Record<string, unknown>).__wfQuickTest;
}
