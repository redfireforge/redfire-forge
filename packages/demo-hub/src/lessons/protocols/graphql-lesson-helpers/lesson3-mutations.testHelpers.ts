/**
 * Shared setup for split lesson3-mutations test files.
 */
import { vi } from 'vitest';
import { GQL } from '@shared/selectors';
import { GQL_DEMO_HTTP, resetGqlLesson2SessionFlags, resetGqlLessonSessionFlags } from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { stubGqlStudioShell } from '../__test-utils__/graphql-test-fixtures';

export function combinedEditor(...parts: string[]): string {
  return parts.join('\n');
}

export function buildGql3StudioDom(extra = ''): void {
  stubGqlStudioShell(`
    <div data-testid="gql-studio-page"></div>
    <select data-testid="header-env-select"><option>GraphQL Demo</option></select>
    <select data-testid="header-svc-select"><option>graphql-demo</option></select>
    <button data-testid="gql-right-tab-schema"></button>
    <button data-testid="gql-right-tab-response" aria-selected="true"></button>
    <span data-testid="gql-schema-badge-ok">Schema loaded (12 types)</span>
    <div data-testid="gql-schema-explorer">
      <div data-testid="gql-se-type-list">
        <button data-testid="gql-se-type-Query"></button>
        <button data-testid="gql-se-type-Mutation"></button>
      </div>
    </div>
    <div data-testid="gql-response-viewer">
      <pre data-testid="gql-response-body">{"data":{"createUser":{"id":"usr-1","name":"Carol","email":"carol@demo.local"}}}</pre>
      <div data-testid="gql-response-data-create-user">Carol</div>
    </div>
    <button data-testid="gql-rv-tab-body"></button>
    <button data-testid="gql-endpoint-reset-btn"></button>
    ${extra}
  `);
  document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_DEMO_HTTP;
}

export function setupLesson3MutationsBeforeEach(): void {
  document.body.innerHTML = '';
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({ data: { createUser: { id: 'usr-1' } } }),
  }));
}

export async function teardownLesson3MutationsAfterEach(): Promise<void> {
  vi.unstubAllGlobals();
}
