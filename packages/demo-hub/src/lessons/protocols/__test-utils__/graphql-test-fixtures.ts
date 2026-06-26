/**
 * Shared DOM fixtures for GraphQL demo-player lesson unit tests.
 */
import { vi } from 'vitest';
import { GQL } from '@shared/selectors';

export function stubMonacoEditor(query = 'query { health }'): {
  setQuery: ReturnType<typeof vi.fn>;
  setVars: ReturnType<typeof vi.fn>;
} {
  const setQuery = vi.fn();
  const setVars = vi.fn();
  const w = window as unknown as {
    monaco?: {
      editor: {
        getModels: () => Array<{
          getValue: () => string;
          setValue: (v: string) => void;
          uri: { toString: () => string };
        }>;
        getEditors: () => Array<{
          getModel: () => { uri: { toString: () => string } } | null;
          setValue: (v: string) => void;
        }>;
      };
    };
  };
  w.monaco = {
    editor: {
      getModels: () => [
        {
          getValue: () => query,
          setValue: (v: string) => {
            query = v;
            setQuery(v);
          },
          uri: { toString: () => 'inmemory://graphql/tab-1' },
        },
        {
          getValue: () => '{}',
          setValue: (v: string) => setVars(v),
          uri: { toString: () => 'inmemory://graphql-vars/tab-1' },
        },
      ],
      getEditors: () => [
        {
          getModel: () => ({ uri: { toString: () => 'inmemory://graphql/tab-1' } }),
          setValue: (v: string) => {
            query = v;
            setQuery(v);
          },
        },
        {
          getModel: () => ({ uri: { toString: () => 'inmemory://graphql-vars/tab-1' } }),
          setValue: (v: string) => setVars(v),
        },
      ],
    },
  };
  return { setQuery, setVars };
}

/** Minimal GraphQL Studio DOM shell for mutation/subscription/variables lessons. */
export function stubGqlStudioShell(extra = ''): void {
  document.body.innerHTML = `
    <input data-testid="gql-endpoint-input" value="" />
    <button data-testid="gql-introspect-btn"></button>
    <button data-testid="gql-mode-editor" class="gql-mode-btn gql-mode-btn--active"></button>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    <button data-testid="gql-bottom-tab-variables"></button>
    <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    <button data-testid="gql-right-tab-response"></button>
    <button data-testid="gql-execute-btn"></button>
    <div data-testid="gql-response-viewer"></div>
    <pre data-testid="gql-response-body"></pre>
    ${extra}
  `;
}

/** Builder mode field tree with health + user rows (unchecked). */
export function stubBuilderFieldTree(userExpanded = false): string {
  const expandClass = userExpanded ? ' gql-qb-expand-btn--open' : '';
  return `
    <button data-testid="gql-mode-builder" class="gql-mode-btn--active"></button>
    <div data-testid="gql-qb-field-tree">
      <div class="gql-qb-field-row">
        <span class="gql-qb-expand-spacer"></span>
        <button class="gql-qb-check" type="button"></button>
        <span class="gql-qb-field-name">health</span>
      </div>
      <div class="gql-qb-field-row">
        <button class="gql-qb-expand-btn${expandClass}" type="button"></button>
        <button class="gql-qb-check" type="button"></button>
        <span class="gql-qb-field-name">user</span>
      </div>
      <div data-testid="gql-qb-arg-user-id"><input class="gql-qb-arg-input" value="" /></div>
    </div>
    <pre data-testid="gql-qb-code">query { }</pre>
    <button data-testid="gql-qb-select-all"></button>
    <button data-testid="gql-qb-copy"></button>
    <button data-testid="gql-qb-edit"></button>
  `;
}

/** Schema explorer DOM for lesson 4. */
export function stubSchemaExplorerDom(extra = ''): void {
  document.body.innerHTML = `
    <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
    <span data-testid="gql-schema-badge-ok"></span>
    <button data-testid="gql-right-tab-schema"></button>
    <div data-testid="gql-schema-explorer">
      <input data-testid="gql-se-search" />
      <div data-testid="gql-se-type-list">
        <button data-testid="gql-se-type-Query"></button>
        <button data-testid="gql-se-type-User"></button>
      </div>
      <div data-testid="gql-se-type-detail">
        <button data-testid="gql-se-dtab-fields"></button>
        <button data-testid="gql-try-field-health"></button>
      </div>
      <button data-testid="gql-se-dtab-sdl"></button>
      <div data-testid="gql-se-detail-panel"></div>
      <button data-testid="gql-se-export-sdl-btn"></button>
    </div>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    <div data-testid="gql-insert-toast"></div>
    ${extra}
  `;
}

/** Subscription lesson DOM shell. */
export function stubSubscriptionShell(extra = ''): void {
  document.body.innerHTML = `
    <input data-testid="gql-endpoint-input" value="" />
    <button data-testid="gql-introspect-btn"></button>
    <span data-testid="gql-schema-badge-ok"></span>
    <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
    <div data-testid="gql-editor"><div class="monaco-editor"></div></div>
    <select data-testid="gql-transport-select">
      <option value="auto">Auto</option>
      <option value="graphql-transport-ws">WS</option>
    </select>
    <button data-testid="gql-bottom-tab-variables"></button>
    <div data-testid="gql-variables-panel"><div class="monaco-editor"></div></div>
    <button data-testid="gql-right-tab-response"></button>
    <button data-testid="gql-execute-btn"></button>
    <button data-testid="gql-subscribe-btn"></button>
    <div data-testid="gql-response-viewer"></div>
    <pre data-testid="gql-response-body"></pre>
    <div data-testid="gql-sub-log">
      <div data-testid="gql-sub-message-list">
        <div data-testid="gql-sub-row">PENDING</div>
        <div data-testid="gql-sub-row">PROCESSING</div>
        <div data-testid="gql-sub-row">COMPLETE</div>
      </div>
    </div>
    <div data-testid="gql-ws-status"></div>
    <button data-testid="gql-sub-filter-btn"></button>
    <div data-testid="gql-sub-filter-bar"><input data-testid="gql-sub-filter-input" /></div>
    <button data-testid="gql-sub-pause-btn"></button>
    <button data-testid="gql-sub-resume-btn"></button>
    <button data-testid="gql-stop-sub-btn"></button>
    <button data-testid="gql-sub-stop-btn"></button>
    <div data-testid="gql-assertion-panel">
      <button data-testid="gql-assertion-toggle" aria-expanded="true"></button>
      <button data-testid="gql-assertion-add-btn"></button>
      <div data-testid="gql-assertion-row">
        <input data-testid="gql-assertion-jsonpath" />
        <select data-testid="gql-assertion-operator"><option value="equals">equals</option></select>
        <input data-testid="gql-assertion-expected" />
      </div>
    </div>
    ${extra}
  `;
}

/** Metadata request-headers table rows matching GraphqlResponseViewer testids. */
export function metadataRequestHeadersHtml(
  rows: Array<{ name: string; value: string }>,
): string {
  const trs = rows
    .map(
      (r) => `<tr>
      <td data-testid="gql-rv-request-header-key-${r.name}">${r.name}</td>
      <td data-testid="gql-rv-request-header-val-${r.name}">${r.value}</td>
    </tr>`,
    )
    .join('');
  return `<div data-testid="gql-rv-request-headers"><table><tbody>${trs}</tbody></table></div>`;
}

export { GQL };
