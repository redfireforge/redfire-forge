/**
 * monacoGraphqlSetup.ts
 *
 * Phase 1A: Registers a GraphQL language mode (Monarch tokenizer + theme).
 * Phase 1B: Activates the monaco-graphql language service worker for schema-aware
 *           autocomplete and validation. Now that `graphql` and `monaco-graphql`
 *           are installed, the real language service replaces the fallback.
 *
 * WORKER SETUP (Phase 1B):
 * The MonacoEnvironment.getWorker shim runs at module-import time (before React renders)
 * so the `graphql` worker is registered before the first <Editor> mounts. The `?worker`
 * Vite import bundles the worker file at build time for correct asset resolution.
 */

// The package.json exports map exposes './initializeMode' (not './esm/initializeMode')
import { initializeMode } from 'monaco-graphql/initializeMode';
import type { IntrospectionQuery } from 'graphql';
// Vite ?worker suffix — Vite handles bundling at build time; avoids rolldown
// UNRESOLVED_ENTRY errors that occur with the runtime new URL(...) pattern.
import GraphqlWorkerCtor from 'monaco-graphql/esm/graphql.worker?worker';
import EditorWorkerCtor from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import type * as MonacoType from 'monaco-editor';

// ─── Monaco GraphQL worker shim ───────────────────────────────────────────────
// Runs once at module import time (before any React/Monaco rendering).
// Injects the graphql worker into MonacoEnvironment while chaining to
// any existing getWorker handler set by @monaco-editor/react.
if (typeof window !== 'undefined') {
  // Cast through Monaco's own Environment type — avoids `any` while matching the declaration.
  const existingEnv = window.MonacoEnvironment as MonacoType.Environment | undefined;
  const _prev = existingEnv?.getWorker;
  window.MonacoEnvironment = {
    ...existingEnv,
    getWorker(_id: string, label: string): Worker | Promise<Worker> {
      if (label === 'graphql') {
        return new GraphqlWorkerCtor() as Worker;
      }
      if (_prev) return _prev.call(existingEnv, _id, label);
      return new EditorWorkerCtor() as Worker;
    },
  } as MonacoType.Environment;
}

// ─── monaco-graphql API ───────────────────────────────────────────────────────

let gqlApi: ReturnType<typeof initializeMode> | null = null;

/**
 * Lazily initialises the monaco-graphql language service.
 * Returns the same instance on subsequent calls (singleton).
 * Safe to call from beforeMount callbacks in React components.
 */
export function getOrInitGraphqlMode(): ReturnType<typeof initializeMode> {
  if (!gqlApi) {
    gqlApi = initializeMode();
  }
  return gqlApi;
}

/**
 * Feeds an introspection result to the monaco-graphql language service so that
 * all open GraphQL editors get schema-aware autocomplete and validation.
 *
 * @param introspectionData - The `data` field from a GraphQL introspection response
 *   (i.e. `{ __schema: { ... } }`). Pass `response.data` directly.
 */
export function setGraphqlSchema(introspectionData: Record<string, unknown>): void {
  getOrInitGraphqlMode().setSchemaConfig([
    { introspectionJSON: introspectionData as unknown as IntrospectionQuery, uri: 'schema.graphql' },
  ]);
}

/**
 * Clears the schema from the monaco-graphql language service so editors
 * no longer offer stale autocomplete/validation from a previous endpoint.
 */
export function clearGraphqlSchema(): void {
  getOrInitGraphqlMode().setSchemaConfig([]);
}

export const GRAPHQL_LANGUAGE_ID = 'graphql';
export const GRAPHQL_THEME_ID = 'graphql-dark';

let languageRegistered = false;

/**
 * Registers the GraphQL language with Monaco using a Monarch tokenizer.
 * Called once on first mount of any GraphQL editor component.
 * Subsequent calls are no-ops.
 */
export function registerGraphqlLanguage(monaco: typeof MonacoType): void {
  if (languageRegistered) return;
  languageRegistered = true;

  // Register the language ID
  monaco.languages.register({ id: GRAPHQL_LANGUAGE_ID, extensions: ['.graphql', '.gql'] });

  // Monarch tokenizer — provides syntax highlighting without the graphql-language-service worker
  monaco.languages.setMonarchTokensProvider(GRAPHQL_LANGUAGE_ID, {
    defaultToken: '',
    keywords: [
      'query', 'mutation', 'subscription', 'fragment', 'on',
      'type', 'interface', 'union', 'enum', 'input', 'extend',
      'schema', 'directive', 'implements', 'repeatable',
      'true', 'false', 'null',
    ],

    tokenizer: {
      root: [
        // Line comments
        [/#[^\n]*/, 'comment'],

        // Block strings (triple-quoted)
        [/"""/, { token: 'string.block', next: '@blockstring' }],

        // Regular strings
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],

        // Numbers
        [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],

        // Directives (e.g. @deprecated, @skip, @include)
        [/@[a-zA-Z_][a-zA-Z0-9_]*/, 'keyword.annotation'],

        // Variable references ($varName)
        [/\$[a-zA-Z_][a-zA-Z0-9_]*/, 'variable'],

        // Spread operator
        [/\.\.\./, 'delimiter.spread'],

        // Brackets
        [/[{}()[\]]/, '@brackets'],

        // Delimiters
        [/[:,!|&=]/, 'delimiter'],

        // Type names — PascalCase identifiers are treated as type references
        [/[A-Z][a-zA-Z0-9_]*/, 'type.identifier'],

        // Keywords and general identifiers
        [/[a-zA-Z_][a-zA-Z0-9_]*/, {
          cases: {
            '@keywords': 'keyword',
            '@default': 'identifier',
          },
        }],

        // Whitespace
        [/\s+/, 'white'],
      ],

      blockstring: [
        [/"""/, { token: 'string.block', next: '@pop' }],
        [/./, 'string'],
      ],

      string: [
        [/[^"\\]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
      ],
    },
  } as MonacoType.languages.IMonarchLanguage);

  // Language configuration for bracket matching, auto-closing, etc.
  monaco.languages.setLanguageConfiguration(GRAPHQL_LANGUAGE_ID, {
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"', notIn: ['string'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    comments: {
      lineComment: '#',
    },
    indentationRules: {
      increaseIndentPattern: /^.*\{[^}]*$/,
      decreaseIndentPattern: /^.*\}/,
    },
    folding: {
      markers: {
        start: /^\s*#\s*region\b/,
        end: /^\s*#\s*endregion\b/,
      },
    },
  });

  defineGraphqlTheme(monaco);
}

/**
 * Reads `--bg` from the app's CSS variables and (re-)applies the GraphQL Monaco theme.
 * Safe to call multiple times — Monaco treats repeated defineTheme calls as updates.
 * Call this whenever the app theme changes so the editor background stays in sync.
 */
export function defineGraphqlTheme(monaco: typeof MonacoType): void {
  // Read the app's --bg CSS variable so the editor background always matches the
  // Response/Schema pane (which uses var(--bg)). Fallback to a safe dark value.
  const bg = typeof document !== 'undefined'
    ? (getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0f172a')
    : '#0f172a';

  // Derive related colors from the background so they stay coherent across themes.
  // selectionBackground and lineHighlightBackground are lightened relative to bg.
  monaco.editor.defineTheme(GRAPHQL_THEME_ID, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword',           foreground: 'C792EA', fontStyle: 'bold' },
      { token: 'keyword.annotation',foreground: 'FFCB6B' },
      { token: 'type.identifier',   foreground: 'FFCB6B' },
      { token: 'variable',          foreground: 'F78C6C' },
      { token: 'string',            foreground: 'C3E88D' },
      { token: 'string.block',      foreground: 'C3E88D' },
      { token: 'string.escape',     foreground: '89DDFF' },
      { token: 'number',            foreground: 'F78C6C' },
      { token: 'comment',           foreground: '546E7A', fontStyle: 'italic' },
      { token: 'identifier',        foreground: 'EEFFFF' },
      { token: 'delimiter',         foreground: '89DDFF' },
      { token: 'delimiter.spread',  foreground: '89DDFF' },
    ],
    colors: {
      'editor.background':           bg,
      'editor.foreground':           '#EEFFFF',
      'editorLineNumber.foreground': '#546E7A',
      'editor.selectionBackground':  '#2C3E50',
      'editor.lineHighlightBackground': '#1E2D3D',
      'editorCursor.foreground':     '#FFCB6B',
      'editorSuggestWidget.background': '#1e2030',
      'editorSuggestWidget.border':  '#2d3561',
    },
  });
}

/**
 * Returns Monaco editor options for a GraphQL operation editor.
 * NOTE: `language` and `theme` are intentionally omitted — they are set
 * via the <Editor language= theme=> props and are NOT valid editor.updateOptions() keys.
 */
export function getGraphqlEditorOptions(): MonacoType.editor.IStandaloneEditorConstructionOptions {
  return {
    minimap: { enabled: false },
    fontSize: 13,
    lineHeight: 20,
    wordWrap: 'on',
    automaticLayout: true,
    scrollBeyondLastLine: false,
    renderWhitespace: 'selection',
    tabSize: 2,
    insertSpaces: true,
    bracketPairColorization: { enabled: true },
    suggest: {
      showWords: false,
      showSnippets: true,
    },
    padding: { top: 8, bottom: 8 },
  };
}

/**
 * Returns Monaco editor options for the Variables JSON panel.
 * NOTE: `language` and `theme` are intentionally omitted — they are set
 * via the <Editor language= theme=> props and are NOT valid editor.updateOptions() keys.
 */
export function getVariablesEditorOptions(): MonacoType.editor.IStandaloneEditorConstructionOptions {
  return {
    minimap: { enabled: false },
    fontSize: 12,
    lineHeight: 18,
    wordWrap: 'on',
    automaticLayout: true,
    scrollBeyondLastLine: false,
    tabSize: 2,
    insertSpaces: true,
    padding: { top: 6, bottom: 6 },
  };
}

/**
 * Builds a stable Monaco model URI for a given operation tab.
 * Pattern: "inmemory://graphql/<tabId>"
 *
 * Using the `path` prop of @monaco-editor/react with this URI ensures
 * each tab keeps its own independent model with its own undo history.
 */
export function buildModelUri(tabId: string): string {
  return `inmemory://graphql/${tabId}`;
}

/**
 * Builds a stable Monaco model URI for a tab's variables JSON editor.
 * Pattern: "inmemory://graphql-vars/<tabId>"
 */
export function buildVarsModelUri(tabId: string): string {
  return `inmemory://graphql-vars/${tabId}`;
}

// ─── Operation Name Extraction ───────────────────────────────────────────────

// Intentionally uses regex rather than graphql.parse() for keystroke-level
// robustness: graphql.parse() throws on any syntax error, which would break
// tab-label and operation-type derivation every time the user is mid-edit.
// The regex approach safely extracts operations from partial/malformed queries.

export interface ExtractedOperation {
  name: string;
  type: 'query' | 'mutation' | 'subscription';
}

/**
 * Extracts named operations from a GraphQL document string using regex.
 * Returns an empty array for anonymous operations.
 *
 * Matches both PascalCase and camelCase operation names, which are both
 * valid per the GraphQL specification: `query GetUser`, `mutation createPost`.
 * The name must start with a letter or underscore (not a digit).
 *
 * This is a best-effort parser — it handles normal operation definitions but
 * does not handle edge cases (operations inside comments, multi-line edge cases).
 * Replace with graphql.parse() in Phase 1B.
 *
 * NOTE: The regex is created fresh on each call (not module-scoped) to avoid
 * the stateful lastIndex race condition that occurs in React Strict Mode where
 * render functions may execute multiple times concurrently.
 */
export function extractOperations(query: string): ExtractedOperation[] {
  if (!query.trim()) return [];
  const ops: ExtractedOperation[] = [];
  const stripped = query.replace(/#[^\n]*/g, '').replace(/"""[\s\S]*?"""/g, '');
  // Fresh regex instance per call — no shared lastIndex state.
  // Operation names may start with any letter (upper or lower) or underscore.
  const pattern = /(?:^|\s)(query|mutation|subscription)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(stripped)) !== null) {
    ops.push({
      type: match[1] as 'query' | 'mutation' | 'subscription',
      name: match[2],
    });
  }
  return ops;
}

/**
 * Derives the display label for a tab from its query text.
 * Returns the first operation name, or "Untitled" for anonymous operations.
 */
export function deriveTabLabel(query: string): string {
  const ops = extractOperations(query);
  return ops.length > 0 ? ops[0].name : 'Untitled';
}

/**
 * Derives the primary operation type from the query text.
 *
 * Handles three forms:
 *   1. Named:     "query MyOp { ... }"  → 'query'
 *   2. Anonymous: "query { ... }"       → 'query'
 *   3. Shorthand: "{ ... }"             → 'query' (implicit query)
 *
 * Returns undefined only when the text is empty or cannot be classified.
 */
export function deriveOperationType(
  query: string,
): 'query' | 'mutation' | 'subscription' | undefined {
  // First try named operations (most specific)
  const ops = extractOperations(query);
  if (ops.length > 0) return ops[0].type;

  // Fall back to anonymous / shorthand detection
  const stripped = query.replace(/#[^\n]*/g, '').trim();
  if (!stripped) return undefined;

  // Shorthand query: document starts directly with "{"
  if (stripped.startsWith('{')) return 'query';

  // Anonymous operation: "query { ... }" / "mutation { ... }" / "subscription { ... }"
  // Also handles "query(...) { ... }" (operation with variable definitions but no name)
  const anonMatch = /^(query|mutation|subscription)\s*[({]/.exec(stripped);
  if (anonMatch) return anonMatch[1] as 'query' | 'mutation' | 'subscription';

  return undefined;
}
