import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalEscapeClose } from '../../../shared/hooks/useModalEscapeClose';
import { useModalDrag } from '../../../shared/hooks/useModalDrag';
import { useModalResize } from '../../../shared/hooks/useModalResize';
import ModalResizeHandles from '../../../shared/components/ModalResizeHandles';
import Editor, { useMonaco, type BeforeMount } from '@monaco-editor/react';
import type * as MonacoType from 'monaco-editor';
import type { GraphqlScriptConfig, RfResponseContext, ScriptLogEntry, CollectionRunTestResult } from '../../../shared/types/graphql';
import { createRfContext, runScript, NO_OP_STORE } from '../utils/preRequestScriptRunner';
import { defineGraphqlTheme, GRAPHQL_THEME_ID } from '../utils/monacoGraphqlSetup';

const SCRIPT_MODAL_MIN_WIDTH = 560;
const SCRIPT_MODAL_MIN_HEIGHT = 420;

const handleScriptEditorBeforeMount: BeforeMount = (monaco) => {
  defineGraphqlTheme(monaco);
};

interface ScriptTemplate {
  label: string;
  description: string;
  code: string;
  phase: 'pre' | 'post' | 'both';
}

const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    label: 'OAuth2 Token Refresh',
    description: 'Check expiry via rf.getEnv, fetch a new token, and inject as Bearer header',
    phase: 'pre',
    code: `const expiry = parseInt(rf.getEnv('tokenExpiry') ?? '0', 10);
if (Date.now() >= expiry) {
  const res = await rf.fetch(rf.getEnv('tokenUrl'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: \`grant_type=client_credentials&client_id=\${rf.getEnv('clientId')}&client_secret=\${rf.getEnv('clientSecret')}\`,
  });
  const { access_token, expires_in } = await res.json();
  rf.setEnv('accessToken', access_token);
  rf.setEnv('tokenExpiry', String(Date.now() + expires_in * 1000));
  rf.log('Token refreshed, expires in', expires_in, 's');
}
rf.setHeader('Authorization', \`Bearer \${rf.getEnv('accessToken')}\`);`,
  },
  {
    label: 'JWT Decode (debug)',
    description: 'Decode and log JWT payload claims from the access token',
    phase: 'pre',
    code: `const token = rf.getEnv('accessToken');
if (token) {
  const parts = token.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1]));
      rf.log('JWT claims:', payload);
    } catch {
      rf.warn('Could not decode JWT payload');
    }
  }
}`,
  },
  {
    label: 'Inject Tenant ID',
    description: 'Add X-Tenant-ID header from environment variable',
    phase: 'pre',
    code: `const tenantId = rf.getEnv('tenantId');
if (!tenantId) {
  rf.abort('tenantId env var is not set');
}
rf.setHeader('X-Tenant-ID', tenantId);`,
  },
  {
    label: 'Assert No GraphQL Errors',
    description: 'Fail the test if the response contains any GraphQL errors',
    phase: 'post',
    code: `rf.test('no GraphQL errors', () => {
  rf.assert(
    !rf.response?.errors?.length,
    \`Expected no errors, got: \${rf.response?.errors?.map(e => e.message).join(', ')}\`,
  );
});`,
  },
  {
    label: 'Extract and Chain ID',
    description: 'Store a created resource ID into an environment variable for use in later requests',
    phase: 'post',
    code: `const id = rf.response?.data?.create?.id;
if (!id) {
  rf.warn('No id found in response.data.create.id');
} else {
  rf.setEnv('createdId', String(id));
  rf.log('Stored createdId:', id);
}`,
  },
  {
    label: 'Chain with Runner Store',
    description: 'Pass a value between items using the collection runner store',
    phase: 'post',
    code: `// Store a value for use in a later item's pre-request script
const id = rf.response?.data?.create?.id;
if (id) {
  rf.store.set('createdId', id);
  rf.log('Stored createdId in runner store:', id);
}

// In the later item's pre-request script, read it back:
// const id = rf.store.get('createdId');
// if (!id) rf.abort('createdId not found in store — run the create item first');`,
  },
  {
    label: 'Skip if Env Missing',
    description: 'Skip this item in the Collection Runner if a required env var is not set',
    phase: 'pre',
    code: `const apiKey = rf.getEnv('apiKey');
if (!apiKey) {
  rf.skip('apiKey env var is not set — skipping this item');
}
rf.setHeader('X-API-Key', apiKey);`,
  },
];

const RF_COMPLETIONS = [
  { label: 'rf.getEnv', insertText: "rf.getEnv('${1:key}')", detail: 'getEnv(key: string): string | undefined' },
  { label: 'rf.setEnv', insertText: "rf.setEnv('${1:key}', '${2:value}')", detail: 'setEnv(key, value): void' },
  { label: 'rf.setHeader', insertText: "rf.setHeader('${1:name}', '${2:value}')", detail: 'setHeader(name, value): void' },
  { label: 'rf.removeHeader', insertText: "rf.removeHeader('${1:name}')", detail: 'removeHeader(name): void' },
  { label: 'rf.abort', insertText: "rf.abort('${1:reason}')", detail: 'abort(message): never — blocks request' },
  { label: 'rf.skip', insertText: "rf.skip('${1:reason}')", detail: 'skip(message?): never — skips in collection runner' },
  { label: 'rf.assert', insertText: 'rf.assert(${1:condition}, ${2:\'message\'})', detail: 'assert(condition, message?): void' },
  { label: 'rf.test', insertText: "rf.test('${1:test name}', () => {\n\t${2:rf.assert(true);}\n})", detail: 'test(name, fn): void — named assertion' },
  { label: 'rf.log', insertText: 'rf.log(${1:value})', detail: 'log(...args): void' },
  { label: 'rf.warn', insertText: 'rf.warn(${1:value})', detail: 'warn(...args): void' },
  { label: 'rf.error', insertText: 'rf.error(${1:value})', detail: 'error(...args): void' },
  { label: 'rf.fetch', insertText: "rf.fetch('${1:url}', { method: '${2:GET}' })", detail: 'fetch(url, init?): Promise<Response>' },
  { label: 'rf.response', insertText: 'rf.response', detail: 'response?: { httpStatus, httpHeaders, data, errors, latencyMs }' },
  { label: 'rf.response?.data', insertText: 'rf.response?.data', detail: 'unknown — GraphQL response data' },
  { label: 'rf.response?.errors', insertText: 'rf.response?.errors', detail: 'GraphqlError[] | undefined' },
  { label: 'rf.response?.httpStatus', insertText: 'rf.response?.httpStatus', detail: 'number' },
  { label: 'rf.response?.latencyMs', insertText: 'rf.response?.latencyMs', detail: 'number' },
  { label: 'rf.store.get', insertText: "rf.store.get('${1:key}')", detail: 'get(key): unknown — runner store' },
  { label: 'rf.store.set', insertText: "rf.store.set('${1:key}', ${2:value})", detail: 'set(key, value): void — runner store' },
  { label: 'rf.store.delete', insertText: "rf.store.delete('${1:key}')", detail: 'delete(key): void — runner store' },
  { label: 'rf.getCollectionVar', insertText: "rf.getCollectionVar('${1:key}')", detail: 'getCollectionVar(key): string | undefined' },
  { label: 'rf.setCollectionVar', insertText: "rf.setCollectionVar('${1:key}', '${2:value}')", detail: 'setCollectionVar(key, value): void' },
  { label: 'rf.operation', insertText: 'rf.operation', detail: '{ name, type, variables }' },
  { label: 'rf.operation.name', insertText: 'rf.operation.name', detail: 'string | undefined' },
  { label: 'rf.operation.type', insertText: 'rf.operation.type', detail: "'query' | 'mutation' | 'subscription'" },
  { label: 'rf.operation.variables', insertText: 'rf.operation.variables', detail: 'Record<string, unknown>' },
];

export type ScriptEditorContext = 'item' | 'collection';

export interface GraphqlScriptEditorModalProps {
  open: boolean;
  name: string;
  context: ScriptEditorContext;
  scripts?: GraphqlScriptConfig;
  collectionPreScript?: string;
  collectionPostScript?: string;
  resetKey?: string;
  testResponse?: RfResponseContext;
  envSnapshot?: Record<string, string>;
  collectionVarsSnapshot?: Record<string, string>;
  onSave: (updated: ScriptEditorSavePayload) => void;
  onClose: () => void;
}

export interface ScriptEditorSavePayload {
  context: ScriptEditorContext;
  scripts?: GraphqlScriptConfig;
  collectionPreScript?: string;
  collectionPostScript?: string;
}

const PHASE_HINTS: Record<'pre' | 'post', string> = {
  pre: 'Runs before the HTTP request — set headers, refresh tokens, or abort early.',
  post: 'Runs after the response — assert results, extract values, or chain to later items.',
};

function ExecutionOrderDiagram() {
  return (
    <div className="gql-script-order-diagram" data-testid="gql-script-order-diagram">
      <span className="gql-script-order-step">Collection pre-request</span>
      <span className="gql-script-order-arrow" aria-hidden="true">→</span>
      <span className="gql-script-order-step gql-script-order-step--item">Item pre-request</span>
      <span className="gql-script-order-arrow" aria-hidden="true">→</span>
      <span className="gql-script-order-step gql-script-order-step--http">HTTP request</span>
      <span className="gql-script-order-arrow" aria-hidden="true">→</span>
      <span className="gql-script-order-step gql-script-order-step--item">Item post-response</span>
      <span className="gql-script-order-arrow" aria-hidden="true">→</span>
      <span className="gql-script-order-step">Collection post-response</span>
    </div>
  );
}

export function GraphqlScriptEditorModal({
  open,
  name,
  context,
  scripts,
  collectionPreScript: initCollPre = '',
  collectionPostScript: initCollPost = '',
  resetKey,
  testResponse,
  envSnapshot: envSnapshotProp,
  collectionVarsSnapshot: collectionVarsSnapshotProp,
  onSave,
  onClose,
}: GraphqlScriptEditorModalProps) {
  const monaco = useMonaco();
  const modalRef = useRef<HTMLDivElement>(null);
  const { onDragStart, isDragged, overlayStyle, modalStyle } = useModalDrag(open, {
    modalRef,
    constrainToViewport: true,
    viewportPadding: 12,
  });
  const { resizeStyle, onRightEdge, onCorner, onBottomEdge, resetSize } = useModalResize(
    SCRIPT_MODAL_MIN_WIDTH,
    SCRIPT_MODAL_MIN_HEIGHT,
  );

  const [activePhase, setActivePhase] = useState<'pre' | 'post'>('pre');
  const [showOrder, setShowOrder]     = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const templatesRef = useRef<HTMLDivElement>(null);

  // Dry-run ("Test Script") state
  const [dryRunLogs,  setDryRunLogs]  = useState<Array<ScriptLogEntry & { itemName: string }>>([]);
  const [dryRunTests, setDryRunTests] = useState<CollectionRunTestResult[]>([]);
  const [dryRunning,  setDryRunning]  = useState(false);

  // Item script state
  const [preScript,  setPreScript]  = useState(scripts?.preRequest  ?? '');
  const [postScript, setPostScript] = useState(scripts?.postResponse ?? '');
  const [timeout,    setTimeout_]   = useState(scripts?.timeout ?? 10000);
  const [enabled,    setEnabled]    = useState(scripts?.enabled !== false);

  // Collection-level script state
  const [collPre,  setCollPre]  = useState(initCollPre);
  const [collPost, setCollPost] = useState(initCollPost);

  // Reset state when modal opens OR when the target item/collection changes.
  // resetKey must be included so switching from item A to item B (while open stays
  // true) loads the new item's scripts rather than showing stale data.
  useEffect(() => {
    if (!open) return;
    setPreScript(scripts?.preRequest   ?? '');
    setPostScript(scripts?.postResponse ?? '');
    setTimeout_(scripts?.timeout ?? 10000);
    setEnabled(scripts?.enabled !== false);
    setCollPre(initCollPre);
    setCollPost(initCollPost);
    setActivePhase('pre');
    setShowOrder(false);
    setShowTemplates(false);
    setDryRunLogs([]);
    setDryRunTests([]);
    setDryRunning(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resetKey]);

  useEffect(() => {
    if (!open) resetSize();
  }, [open, resetSize]);

  const handleEscapeClose = useCallback(() => {
    if (open) onClose();
  }, [open, onClose]);

  useModalEscapeClose(handleEscapeClose, { capture: true });

  // Keep script editor background aligned with var(--bg) when the app theme changes.
  useEffect(() => {
    if (!monaco) return;
    defineGraphqlTheme(monaco);
    monaco.editor.setTheme(GRAPHQL_THEME_ID);
    const observer = new MutationObserver(() => {
      defineGraphqlTheme(monaco);
      monaco.editor.setTheme(GRAPHQL_THEME_ID);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [monaco]);

  // Register rf.* completions when Monaco is ready and the modal is open.
  // Scoped to open state so the provider is not active on other JS editors in the app
  // when the modal is closed but the component is still mounted.
  useEffect(() => {
    if (!monaco || !open) return;
    const disposable = monaco.languages.registerCompletionItemProvider('javascript', {
      triggerCharacters: ['.'],
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range: MonacoType.IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber:   position.lineNumber,
          startColumn: word.startColumn,
          endColumn:   position.column,
        };
        const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
        // Only offer rf.* completions when the cursor follows a word-boundary 'rf' or 'rf.'
        // Using a word-boundary anchored regex prevents false positives from substrings
        // like "surf.", "href.", "dwarf." which contain the literal 'rf.' but are unrelated.
        if (!/(^|[^a-zA-Z0-9$_])rf\.?$/.test(line)) return { suggestions: [] };
        return {
          suggestions: RF_COMPLETIONS.map((c) => ({
            label: c.label,
            kind: monaco.languages.CompletionItemKind.Method,
            insertText: c.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: c.detail,
            range,
          })),
        };
      },
    });
    return () => disposable.dispose();
  }, [monaco, open]);

  // Close template dropdown on outside click
  useEffect(() => {
    if (!showTemplates) return;
    const handler = (e: MouseEvent) => {
      if (templatesRef.current && !templatesRef.current.contains(e.target as Node)) {
        setShowTemplates(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTemplates]);

  const currentScript = context === 'collection'
    ? (activePhase === 'pre' ? collPre : collPost)
    : (activePhase === 'pre' ? preScript : postScript);

  const handleEditorChange = useCallback((value: string | undefined) => {
    const v = value ?? '';
    if (context === 'collection') {
      if (activePhase === 'pre')  setCollPre(v);
      else                        setCollPost(v);
    } else {
      if (activePhase === 'pre')  setPreScript(v);
      else                        setPostScript(v);
    }
  }, [activePhase, context]);

  const handleInsertTemplate = useCallback((template: ScriptTemplate) => {
    setShowTemplates(false);
    const inserted = '\n' + template.code + '\n';
    if (context === 'collection') {
      if (activePhase === 'pre')  setCollPre ((p) => (p ? p + inserted : template.code));
      else                        setCollPost((p) => (p ? p + inserted : template.code));
    } else {
      if (activePhase === 'pre')  setPreScript ((p) => (p ? p + inserted : template.code));
      else                        setPostScript((p) => (p ? p + inserted : template.code));
    }
  }, [activePhase, context]);

  const handleSave = useCallback(() => {
    if (context === 'collection') {
      onSave({ context, collectionPreScript: collPre, collectionPostScript: collPost });
    } else {
      const hasPreScript  = preScript.trim().length > 0;
      const hasPostScript = postScript.trim().length > 0;
      const hasCustomTimeout = timeout !== 10000;
      const scriptsDisabled  = !enabled;

      // Only persist a scripts object when there is actual content to save.
      // An object with no script text, default timeout, and enabled=true would be an
      // orphan entry that could mislead callers (e.g. badge check) into thinking scripts exist.
      const scriptsPayload =
        hasPreScript || hasPostScript || hasCustomTimeout || scriptsDisabled
          ? {
              preRequest:   hasPreScript  ? preScript  : undefined,
              postResponse: hasPostScript ? postScript : undefined,
              timeout:      hasCustomTimeout ? timeout : undefined,
              enabled,
            }
          : undefined;

      onSave({ context, scripts: scriptsPayload });
    }
  }, [context, collPre, collPost, preScript, postScript, timeout, enabled, onSave]);

  const handleTestScript = useCallback(async () => {
    const source = context === 'collection'
      ? (activePhase === 'pre' ? collPre : collPost)
      : (activePhase === 'pre' ? preScript : postScript);
    if (!source.trim()) return;

    setDryRunLogs([]);
    setDryRunTests([]);
    setDryRunning(true);

    // Script Editor dry-runs use NO_OP_STORE so rf.store.set/get are silent no-ops.
    // This prevents scripts designed for Collection Runner use from appearing to work
    // when tested individually (the store never persists across items anyway).
    const dryStore = NO_OP_STORE;
    // Seed dry-run with real env/collection vars so rf.getEnv() and rf.getCollectionVar()
    // return actual values. Shallow-copy to prevent the dry-run from mutating the parent's
    // snapshot (setEnv calls in the test run should not persist to the real environment).
    const dryEnv: Record<string, string> = { ...(envSnapshotProp ?? {}) };
    const dryCollVars: Record<string, string> = { ...(collectionVarsSnapshotProp ?? {}) };
    // Post-response phase injects the most recent response if available;
    // pre-request always runs without a response (rf.response === undefined).
    const dryResponse = activePhase === 'post' ? testResponse : undefined;

    const { rf, resolvePendingTests, getLogs } = createRfContext({
      envSnapshot: dryEnv,
      persistEnv: () => {},  // dry-run env mutations are intentionally NOT persisted
      collectionVarsSnapshot: dryCollVars,
      mutableHeaders: {},
      response: dryResponse,
      store: dryStore,
      operation: { name: undefined, type: 'query', variables: {} },
    });

    let scriptErrorMsg: string | null = null;
    try {
      // Item scripts: use local `timeout` state so unsaved changes are respected.
      // Collection scripts: hardcode 10s to match runner behavior (collections have no timeout field).
      const dryRunTimeout = context === 'collection' ? 10_000 : timeout;
      await runScript(source, rf, dryRunTimeout);
    } catch (err) {
      // Capture abort/skip/runtime/timeout errors for display — getLogs() only
      // contains explicit rf.log/warn/error calls and would miss thrown exceptions.
      scriptErrorMsg = err instanceof Error ? err.message : String(err);
    }

    try {
      const tests = await resolvePendingTests();
      const logs = getLogs().map((l) => ({ ...l, itemName: name }));

      // Append script-level error (if any) as the last entry before test results
      const errorEntries: Array<ScriptLogEntry & { itemName: string }> = scriptErrorMsg
        ? [{ level: 'error', message: `⚠ ${scriptErrorMsg}`, timestamp: Date.now(), itemName: name }]
        : [];

      const testEntries: Array<ScriptLogEntry & { itemName: string }> = tests.map((t) => ({
        level: t.passed ? 'pass' : 'fail',
        message: t.passed ? `✓ ${t.name}` : `✗ ${t.name}${t.error ? ': ' + t.error : ''}`,
        timestamp: Date.now(),
        itemName: name,
      }));

      setDryRunLogs([...logs, ...errorEntries, ...testEntries]);
      setDryRunTests(tests);
    } finally {
      setDryRunning(false);
    }
  }, [context, activePhase, collPre, collPost, preScript, postScript, testResponse, envSnapshotProp, collectionVarsSnapshotProp, timeout, name]);

  const filteredTemplates = SCRIPT_TEMPLATES.filter((t) =>
    t.phase === 'both' || t.phase === activePhase,
  );

  if (!open) return null;

  return (
    <div
      className={`gql-script-modal-backdrop${isDragged ? ' gql-script-modal-backdrop--dragged' : ''}`}
      style={overlayStyle}
      onClick={onClose}
      data-testid="gql-script-modal-backdrop"
    >
      <div
        ref={modalRef}
        className={`gql-script-modal${isDragged ? ' gql-script-modal--dragged' : ''}`}
        style={{ ...modalStyle, ...resizeStyle }}
        role="dialog"
        aria-modal="true"
        aria-label={`Script editor — ${name}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="gql-script-modal"
      >
        {/* Header — drag handle */}
        <header
          className="gql-script-modal-header gql-script-modal-header--draggable"
          onMouseDown={onDragStart}
          data-testid="gql-script-modal-header"
        >
          <span className="gql-script-modal-drag-grip" aria-hidden="true" title="Drag to move">
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="2" cy="2" r="1.2" /><circle cx="8" cy="2" r="1.2" />
              <circle cx="2" cy="8" r="1.2" /><circle cx="8" cy="8" r="1.2" />
              <circle cx="2" cy="14" r="1.2" /><circle cx="8" cy="14" r="1.2" />
            </svg>
          </span>
          <div className="gql-script-modal-header-main">
            <div className="gql-script-modal-heading">
              <span className="gql-script-modal-badge">
                {context === 'collection' ? 'Collection' : 'Item'}
              </span>
              <h2 className="gql-script-modal-title">
                {context === 'collection' ? 'Collection Scripts' : 'Item Scripts'}
              </h2>
            </div>
            <p className="gql-script-modal-target" data-testid="gql-script-modal-target">{name}</p>
            <span className="gql-script-modal-drag-hint">Drag header to reposition</span>
          </div>
          <button
            type="button"
            className={`gql-script-modal-order-toggle${showOrder ? ' gql-script-modal-order-toggle--active' : ''}`}
            onClick={() => setShowOrder((v) => !v)}
            onMouseDown={(e) => e.stopPropagation()}
            aria-expanded={showOrder}
            aria-label="Toggle execution order diagram"
            data-testid="gql-script-order-toggle"
          >
            <span className="gql-script-modal-order-toggle-label">Execution order</span>
            <span className="gql-script-modal-order-toggle-chevron" aria-hidden="true">{showOrder ? '▴' : '▾'}</span>
          </button>
          {showOrder && <ExecutionOrderDiagram />}
        </header>

        {/* Toolbar: phase tabs + template library */}
        <div className="gql-script-toolbar">
          <div className="gql-script-tab-group" role="tablist" aria-label="Script phase">
            <button
              type="button"
              role="tab"
              aria-selected={activePhase === 'pre'}
              className={`gql-script-tab${activePhase === 'pre' ? ' gql-script-tab--active' : ''}`}
              onClick={() => setActivePhase('pre')}
              data-testid="gql-script-tab-pre"
            >
              Pre-Request
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activePhase === 'post'}
              className={`gql-script-tab${activePhase === 'post' ? ' gql-script-tab--active' : ''}`}
              onClick={() => setActivePhase('post')}
              data-testid="gql-script-tab-post"
            >
              Post-Response
            </button>
          </div>
          <div className="gql-script-toolbar-actions">
            <div className="gql-script-template-wrap" ref={templatesRef}>
              <button
                type="button"
                className={`gql-script-template-btn${showTemplates ? ' gql-script-template-btn--active' : ''}`}
                onClick={() => setShowTemplates((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={showTemplates}
                data-testid="gql-script-template-btn"
              >
                Insert template
                <span className="gql-script-template-btn-chevron" aria-hidden="true">▾</span>
              </button>
              {showTemplates && (
                <div className="gql-script-template-dropdown" role="listbox" data-testid="gql-script-template-dropdown">
                  {filteredTemplates.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      role="option"
                      className="gql-script-template-item"
                      onClick={() => handleInsertTemplate(t)}
                      data-testid={`gql-script-template-${t.label.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                      <span className="gql-script-template-label">{t.label}</span>
                      <span className="gql-script-template-desc">{t.description}</span>
                    </button>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <div className="gql-script-template-empty">No templates for this phase</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="gql-script-phase-hint" data-testid="gql-script-phase-hint">
          {PHASE_HINTS[activePhase]}
        </p>

        {/* Monaco editor */}
        <div className="gql-script-editor-panel">
          <div className="gql-script-editor-toolbar">
            <span className="gql-script-lang-badge">JavaScript</span>
            <span className="gql-script-editor-hint">
              Type <code>rf.</code> for API autocomplete
            </span>
          </div>
          <div className="gql-script-editor-wrap" data-testid="gql-script-editor-wrap">
            <Editor
              height="100%"
              language="javascript"
              theme={GRAPHQL_THEME_ID}
              value={currentScript}
              onChange={handleEditorChange}
              beforeMount={handleScriptEditorBeforeMount}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                folding: false,
                overviewRulerLanes: 0,
                renderLineHighlight: 'line',
                glyphMargin: false,
                lineDecorationsWidth: 4,
                padding: { top: 8, bottom: 8 },
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        {/* Dry-run console */}
        {(dryRunLogs.length > 0 || dryRunning) && (
          <div className="gql-script-dryrun-console" data-testid="gql-script-dryrun-console">
            <div className="gql-script-dryrun-header">
              <span>Test output</span>
              {dryRunTests.length > 0 && (
                <span className="gql-script-dryrun-summary">
                  {dryRunTests.filter((t) => t.passed).length}/{dryRunTests.length} passed
                </span>
              )}
              <button
                type="button"
                className="gql-runner-console-clear-btn"
                onClick={() => { setDryRunLogs([]); setDryRunTests([]); }}
                title="Clear test output"
              >
                Clear
              </button>
            </div>
            {dryRunning ? (
              <div className="gql-script-dryrun-running">Running…</div>
            ) : (
              dryRunLogs.map((log, i) => (
                <div key={i} className={`gql-runner-console-line gql-runner-console-line--${log.level}`}>
                  <span className="gql-runner-console-msg">{log.message}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <footer className="gql-script-modal-footer">
          {context === 'item' ? (
            <div className="gql-script-settings" data-testid="gql-script-settings">
              <label className="gql-script-setting-row gql-script-setting-row--toggle">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  data-testid="gql-script-enabled"
                />
                <span>Scripts enabled</span>
              </label>
              <label className="gql-script-setting-row gql-script-setting-row--timeout">
                <span className="gql-script-setting-label">Timeout</span>
                <input
                  type="number"
                  className="gql-script-timeout-input"
                  value={timeout}
                  min={1000}
                  max={120000}
                  step={1000}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isNaN(n) && n >= 1000) setTimeout_(Math.min(120000, n));
                  }}
                  data-testid="gql-script-timeout"
                  aria-label="Script timeout in milliseconds"
                />
                <span className="gql-script-setting-suffix">ms</span>
              </label>
            </div>
          ) : (
            <div className="gql-script-footer-spacer" />
          )}
          <div className="gql-script-footer-actions">
            <button
              type="button"
              className="gql-script-btn gql-script-btn--secondary"
              onClick={onClose}
              data-testid="gql-script-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              className="gql-script-btn gql-script-btn--test"
              onClick={() => { handleTestScript().catch(() => {}); }}
              disabled={dryRunning || (activePhase === 'post' && !testResponse)}
              title={
                activePhase === 'post' && !testResponse
                  ? 'Execute a request first to populate rf.response for post-script testing'
                  : activePhase === 'post'
                  ? 'Run against most recent response'
                  : 'Dry-run the pre-request script'
              }
              data-testid="gql-script-test"
            >
              {dryRunning ? 'Running…' : 'Test Script'}
            </button>
            <button
              type="button"
              className="gql-script-btn gql-script-btn--primary"
              onClick={handleSave}
              data-testid="gql-script-save"
            >
              Save
            </button>
          </div>
        </footer>

        <ModalResizeHandles
          onRightEdge={onRightEdge}
          onCorner={onCorner}
          onBottomEdge={onBottomEdge}
        />
      </div>
    </div>
  );
}
