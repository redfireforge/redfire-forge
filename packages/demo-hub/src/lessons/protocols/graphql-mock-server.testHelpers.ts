/**
 * Shared setup for split graphql-mock-server test files.
 */
import { vi } from 'vitest';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {
  LESSON13_HEALTH_OVERRIDE,
  resetGqlLesson13SessionFlags,
  resetGqlLessonSessionFlags,
} from './graphql-lesson-helpers';

export function stubMonacoEditor(query = 'query { health }'): void {
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

export function stubMockDom(): void {
  document.body.innerHTML = `
    <button data-testid="gql-activity-mock" aria-selected="true"></button>
    <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
    <button data-testid="gql-introspect-btn"></button>
    <button data-testid="gql-execute-btn"></button>
    <button data-testid="gql-right-tab-response"></button>
    <span data-testid="gql-schema-badge-ok"></span>
    <div data-testid="gql-response-viewer"></div>
    <div data-testid="gql-response-body">{"data":{"health":"${LESSON13_HEALTH_OVERRIDE}"}}</div>
    <div data-testid="gql-response-latency">650 ms</div>
    <div data-testid="gql-mock-panel">
      <input type="checkbox" data-testid="gql-mock-toggle" />
      <div data-testid="gql-mock-status-row"></div>
      <div data-testid="gql-mock-schema-source">Introspected SDL</div>
      <div data-testid="gql-mock-resolvers-list">
        <div data-testid="gql-mock-type-group">
          <button data-testid="gql-mock-type-header">Query</button>
          <div data-testid="gql-mock-field-row" data-lesson-target="mock-health">
            <span>health</span>
            <select data-testid="gql-mock-resolver-select">
              <option value="random">Random</option>
              <option value="fixed">Fixed</option>
            </select>
            <input data-testid="gql-mock-fixed-input" />
          </div>
        </div>
      </div>
      <input type="range" data-testid="gql-mock-latency-slider" min="0" max="5000" step="50" value="0" />
    </div>
  `;
}

/** Jsdom has no real GraphQL server — simulate live `health: ok` on Execute. */
export function mockLesson13LiveExecute(
  ctx: ReturnType<typeof makeCtx>,
  onClick?: (selector: string) => void | Promise<void>,
): void {
  vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
    if (selector === GQL.EXECUTE_BTN) {
      document.querySelector(GQL.RESPONSE_BODY)!.textContent = '{"data":{"health":"ok"}}';
    }
    if (onClick) await onClick(selector);
  });
}

export function setupGraphqlMockServerBeforeEach(): void {
  document.body.innerHTML = '';
  resetGqlLessonSessionFlags();
  resetGqlLesson13SessionFlags();
  delete (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__;
}

export async function teardownGraphqlMockServerAfterEach(): Promise<void> {
  vi.unstubAllGlobals();
}
