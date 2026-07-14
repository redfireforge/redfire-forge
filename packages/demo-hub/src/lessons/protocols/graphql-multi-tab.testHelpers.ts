/**
 * Shared setup for split graphql-multi-tab test files.
 */
import { vi } from 'vitest';
import { GQL } from '@shared/selectors';
import {
  resetGqlLesson14SessionFlags,
  resetGqlLessonSessionFlags,
} from './graphql-lesson-helpers';

export const LESSON14_TAB2_BADGE = GQL.LESSON14_TAB2_BADGE;

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

export const GQL14_DEMO = 'gql-multi-tab';

export function wireGqlTabRenameInputs(): void {
  document.querySelectorAll<HTMLInputElement>('[data-testid^="gql-tab-rename-"]').forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const tab = input.closest('[role="tab"]');
      const label = tab?.querySelector('.gql-tab-label');
      if (label) label.textContent = input.value;
    });
  });
}

export function stubMultiTabDom(tabCount = 1): void {
  const tabs = Array.from({ length: tabCount }, (_, i) => {
    const labelText = i === 1 ? 'Demo: Multi-Tab Works…' : `Query ${i + 1}`;
    const subtitle = i === 1
      ? '<span class="gql-tab-subtitle">localhost:4010</span>'
      : '';
    return `
    <button role="tab" data-testid="gql-tab-${i}" data-tab-id="tab-${i}"
      data-demo-lesson="${GQL14_DEMO}"
      ${i === tabCount - 1 ? 'aria-selected="true"' : ''}>
      <span class="gql-tab-type-badge">Q</span>
      <span class="gql-tab-label">${labelText}</span>
      ${subtitle}
      <input data-testid="gql-tab-rename-${i}" class="gql-tab-rename-input" value="${labelText}" />
    </button>
  `;
  }).join('');

  document.body.innerHTML = `
    <div data-testid="gql-tab-bar">
      ${tabs}
      <button data-testid="gql-tab-add-btn">+</button>
    </div>
    <input data-testid="gql-endpoint-input" value="{{graphqlUrl}}" />
    <button data-testid="gql-endpoint-reset-btn"></button>
    <button data-testid="gql-introspect-btn"></button>
    <button data-testid="gql-execute-btn"></button>
    <span data-testid="gql-schema-badge-ok">Schema (47 types)</span>
    <div data-testid="gql-response-viewer"></div>
    <div data-testid="gql-response-body">{"data":{"health":"ok"}}</div>
    <div data-testid="gql-schema-explorer"></div>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
  `;
  wireGqlTabRenameInputs();
}

export function setupGraphqlMultiTabBeforeEach(): void {
  document.body.innerHTML = '';
  resetGqlLessonSessionFlags();
  resetGqlLesson14SessionFlags();
}

export async function teardownGraphqlMultiTabAfterEach(): Promise<void> {
  vi.unstubAllGlobals();
}
