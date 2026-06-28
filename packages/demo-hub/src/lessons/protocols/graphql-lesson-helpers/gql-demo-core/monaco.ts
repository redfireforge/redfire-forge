import type { DemoActionContext } from '../../../../types';
import { GQL } from '@shared/selectors';
import { getDemoBridgeWindow } from '../../../../adapters';

export type MonacoGqlModel = { uri: { toString(): string }; getValue(): string; setValue(v: string): void };

export type MonacoGqlEditor = { getModel(): MonacoGqlModel | null; setValue(v: string): void };

function getMonacoApi(): {
  editor: { getModels: () => MonacoGqlModel[]; getEditors: () => MonacoGqlEditor[] };
} | null {
  const w = window as unknown as {
    monaco?: { editor: { getModels: () => MonacoGqlModel[]; getEditors: () => MonacoGqlEditor[] } };
  };
  return w.monaco ?? null;
}

function resolveActiveGqlModelUri(): string | null {
  const activeTabId = getActiveGqlTabIdFromDom();
  return activeTabId ? gqlModelUriForTabId(activeTabId) : null;
}

function isGqlQueryModelUri(uri: string): boolean {
  return uri.includes('inmemory://graphql/') && !uri.includes('inmemory://graphql-vars/');
}

function findGqlQueryModel(models: MonacoGqlModel[], targetUri: string | null): MonacoGqlModel | undefined {
  return models.find((m) => {
    const uri = m.uri.toString();
    if (targetUri) return uri === targetUri;
    return isGqlQueryModelUri(uri);
  });
}

function findGqlQueryEditor(editors: MonacoGqlEditor[], targetUri: string | null): MonacoGqlEditor | undefined {
  return editors.find((e) => {
    const uri = e.getModel()?.uri.toString() ?? '';
    if (targetUri) return uri === targetUri;
    return isGqlQueryModelUri(uri);
  });
}

export function getMonacoGqlModel(): MonacoGqlModel | null {
  const monaco = getMonacoApi();
  if (!monaco?.editor) return null;
  const models = monaco.editor.getModels?.() ?? [];
  return findGqlQueryModel(models, resolveActiveGqlModelUri()) ?? null;
}

/** Monaco editor instance for the active GraphQL tab's query document. */
export function getMonacoGqlEditorInstance(): MonacoGqlEditor | null {
  const monaco = getMonacoApi();
  if (!monaco?.editor) return null;
  const editors = monaco.editor.getEditors?.() ?? [];
  return findGqlQueryEditor(editors, resolveActiveGqlModelUri()) ?? null;
}

/** Active studio tab id from the tab bar (e.g. `gql-tab-1`). */
export function getActiveGqlTabIdFromDom(): string | null {
  const selected = document.querySelector<HTMLElement>(
    '[data-testid="gql-tab-bar"] [role="tab"][aria-selected="true"]',
  );
  if (!selected) return null;
  const testId = selected.getAttribute('data-testid') ?? '';
  const prefix = 'gql-tab-';
  if (!testId.startsWith(prefix)) return null;
  return testId.slice(prefix.length) || null;
}

function gqlModelUriForTabId(tabId: string): string {
  return `inmemory://graphql/${tabId}`;
}

/** Sync programmatic editor writes into React tab state (Execute reads tab state). */
export function syncGqlQueryToAppState(query: string): void {
  getDemoBridgeWindow().__demoSetGqlQuery?.(query);
}

function setMonacoGqlValue(query: string): boolean {
  const monaco = getMonacoApi();
  if (!monaco?.editor) return false;
  const targetUri = resolveActiveGqlModelUri();

  const editors = monaco.editor.getEditors?.() ?? [];
  const editor = findGqlQueryEditor(editors, targetUri);
  if (editor) {
    editor.setValue(query);
    return true;
  }
  const models = monaco.editor.getModels?.() ?? [];
  const model = findGqlQueryModel(models, targetUri);
  if (model) {
    model.setValue(query);
    return true;
  }
  return false;
}

function getMonacoVarsModel(): MonacoGqlModel | null {
  const monaco = getMonacoApi();
  const models = monaco?.editor?.getModels?.() ?? [];
  return models.find((m) => m.uri.toString().includes('inmemory://graphql-vars/')) ?? null;
}

function setMonacoVarsValue(json: string): boolean {
  const monaco = getMonacoApi();
  if (!monaco?.editor) return false;
  const editors = monaco.editor.getEditors?.() ?? [];
  const editor = editors.find((e) => e.getModel()?.uri.toString().includes('inmemory://graphql-vars/'));
  if (editor) {
    editor.setValue(json);
    return true;
  }
  const model = getMonacoVarsModel();
  if (model) {
    model.setValue(json);
    return true;
  }
  return false;
}

/** Read the active variables JSON from the Monaco model. */
export function getGqlVariablesJson(): string {
  return getMonacoVarsModel()?.getValue() ?? '';
}

/**
 * Set the Variables panel JSON. Opens the Variables tab first unless `openPanel: false`.
 */
export async function fillGqlVariables(
  ctx: DemoActionContext,
  json: string,
  opts?: { focus?: boolean; openPanel?: boolean },
): Promise<void> {
  if (opts?.openPanel !== false) {
    await ensureVariablesPanelOpen(ctx);
  }
  if (opts?.focus !== false) {
    const surface = document.querySelector<HTMLElement>(`${GQL.VARS_PANEL} .monaco-editor`);
    if (surface) {
      await ctx.click(`${GQL.VARS_PANEL} .monaco-editor`);
      await ctx.delay(200);
    }
  }
  if (setMonacoVarsValue(json)) {
    await ctx.delay(400);
    return;
  }
  const textarea = document.querySelector<HTMLTextAreaElement>(
    `${GQL.VARS_PANEL} .monaco-editor textarea.inputarea`,
  );
  if (textarea) {
    const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    desc?.set?.call(textarea, json);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await ctx.delay(400);
  }
}

/** Open the bottom Variables tab and wait for the panel. */
export async function ensureVariablesPanelOpen(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(GQL.BOTTOM_TAB_VARS, 5000);
  const tabSelected = document.querySelector(GQL.BOTTOM_TAB_VARS)?.getAttribute('aria-selected') === 'true';
  if (!tabSelected || !document.querySelector(GQL.VARS_PANEL)) {
    await ctx.click(GQL.BOTTOM_TAB_VARS);
    await ctx.waitFor(GQL.VARS_PANEL, 5000);
    await ctx.delay(400);
  }
}

/** Read the active GraphQL query from the Monaco model (empty string if unavailable). */
export function getGqlEditorQuery(): string {
  return getMonacoGqlModel()?.getValue() ?? '';
}

/**
 * Set the GraphQL editor content. Clicks the Monaco surface first (unless focus=false)
 * so the viewer sees the interaction; falls back to the hidden textarea when Monaco
 * is not yet mounted.
 */
export async function fillGqlEditor(
  ctx: DemoActionContext,
  query: string,
  opts?: { focus?: boolean },
): Promise<void> {
  if (opts?.focus !== false) {
    const surface = document.querySelector<HTMLElement>(`${GQL.EDITOR} .monaco-editor`);
    if (surface) {
      await ctx.click(`${GQL.EDITOR} .monaco-editor`);
      await ctx.delay(200);
    }
  }
  if (setMonacoGqlValue(query)) {
    syncGqlQueryToAppState(query);
    await ctx.delay(400);
    return;
  }
  const textarea = document.querySelector<HTMLTextAreaElement>('.monaco-editor textarea.inputarea');
  if (textarea) {
    const desc = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
    desc?.set?.call(textarea, query);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    syncGqlQueryToAppState(query);
    await ctx.delay(400);
  }
}
