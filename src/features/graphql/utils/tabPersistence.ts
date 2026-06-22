/**
 * tabPersistence.ts — persistence helpers for GraphQL Studio editor tabs.
 *
 * Extracted from GraphqlStudioPage.tsx so the tab-management logic can be
 * unit-tested independently of the React component tree.
 */

import type { GraphqlAuth, GraphqlHeaderRow, GraphqlOperationTab, GraphqlSubscriptionAssertion } from '../../../shared/types/graphql';
import { readKey, writeKey, removeKey } from '../../../shared/utils/storage';
import { makeHeaderId } from './headerUtils';
import { buildModelUri, buildVarsModelUri } from './monacoGraphqlSetup';
import { clampPollingIntervalSeconds } from './pollingIntervalUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_TABS = 8;
/** Demo Hub reserves the last slot — users may open at most MAX_USER_TABS tabs. */
export const MAX_USER_TABS = MAX_TABS - 1;
export const STORAGE_KEY = 'gql_tabs_v1';
export const AUTH_STORAGE_KEY = 'gql_auth_v1';
export const POLLING_STORAGE_KEY = 'gql_polling_v1';
export const TLS_STORAGE_KEY = 'gql_tls_skip_v1';
/** Page-level CA / mTLS PEM fields (mirrors skipTlsVerify page storage). */
export const TLS_CERTS_STORAGE_KEY = 'gql_tls_certs_v1';

export interface GqlTlsCertsStorage {
  caCert?: string;
  clientCert?: string;
  clientKey?: string;
}
export const ENDPOINT_STORAGE_KEY = 'gql_endpoint_v1';
export const ENDPOINT_BASE_STORAGE_KEY = 'gql_endpoint_base_v1';
export const DEFAULT_QUERY = 'query {\n  \n}';
export const DEFAULT_VARS = '{\n  \n}';
export const SAVE_DEBOUNCE_MS = 500;

// ─── Tab type ─────────────────────────────────────────────────────────────────

/** Tab state extended with the query content (not in the shared type) */
export interface GqlStudioTab extends GraphqlOperationTab {
  query: string;
  /** Per-tab subscription transport override. Defaults to 'auto'. */
  subscriptionTransport?: 'auto' | 'graphql-transport-ws' | 'graphql-ws' | 'sse';
  /** Per-tab subscription assertions (2C-5). Persisted with the tab. */
  subscriptionAssertions?: GraphqlSubscriptionAssertion[];
  /** Phase 3F: true when this tab is selected for batch execution */
  isBatched?: boolean;
  /** When true, tab label is user-defined and not overwritten by query auto-naming */
  labelManual?: boolean;
  /** Per-tab endpoint override; undefined = inherit page/env default (Phase 6) */
  endpoint?: string;
  /** Per-tab TLS skip override; undefined = inherit page default (Phase 6) */
  skipTlsVerify?: boolean;
  /** Per-tab custom CA PEM (Lesson GQL-5 Phase 2) */
  tlsCaCert?: string;
  /** Per-tab mTLS client certificate PEM (Lesson GQL-5 Phase 3) */
  tlsClientCert?: string;
  /** Per-tab mTLS client private key PEM (Lesson GQL-5 Phase 3) */
  tlsClientKey?: string;
  /** Per-tab polling override; undefined = inherit page default (Phase 6F — wired in slice 2) */
  pollingEnabled?: boolean;
  pollingIntervalSeconds?: number;
  /** Set when Demo Hub created this tab — stripped on lesson cleanup. */
  demoLessonId?: string;
}

// ─── Tab ID sequence ──────────────────────────────────────────────────────────

let nextTabSeq = 1;

export function generateTabId(): string {
  return `gql-tab-${nextTabSeq++}`;
}

export function advanceSeqPastRestoredIds(tabs: GqlStudioTab[]): void {
  for (const tab of tabs) {
    const m = tab.id.match(/^gql-tab-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= nextTabSeq) nextTabSeq = n + 1;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function makeBlankTab(): GqlStudioTab {
  const id = generateTabId();
  return {
    id,
    label: 'Untitled',
    modelUri: buildModelUri(id),
    query: DEFAULT_QUERY,
    variables: DEFAULT_VARS,
    headers: [],
    operationType: 'query',
    unsavedChanges: false,
    connectionId: undefined,
    endpoint: undefined,
    skipTlsVerify: undefined,
  };
}

/** Factory for Demo Hub scratch tabs (§11.0). */
export function makeDemoTab(lessonId: string, label: string): GqlStudioTab {
  const tab = makeBlankTab();
  return {
    ...tab,
    label,
    labelManual: true,
    demoLessonId: lessonId,
    unsavedChanges: false,
    endpoint: undefined,
    connectionId: undefined,
  };
}

export function isDemoTab(tab: GqlStudioTab): boolean {
  return Boolean(tab.demoLessonId?.trim());
}

export function countUserTabs(tabs: GqlStudioTab[]): number {
  return tabs.filter((t) => !isDemoTab(t)).length;
}

// ─── Tab normalizer ───────────────────────────────────────────────────────────

/**
 * Normalizes a single raw JSON object from localStorage into a valid GqlStudioTab.
 * Returns null if the object is missing the required `id` field.
 * All other fields fall back to safe defaults so corrupted or migrated data
 * can never cause a runtime crash.
 */
export function normalizeTab(raw: unknown): GqlStudioTab | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  if (typeof t.id !== 'string' || !t.id) return null;

  const opType = t.operationType;
  return {
    id: t.id,
    label: typeof t.label === 'string' ? t.label : 'Untitled',
    modelUri: typeof t.modelUri === 'string' ? t.modelUri : buildModelUri(t.id),
    query: typeof t.query === 'string' ? t.query : DEFAULT_QUERY,
    variables: typeof t.variables === 'string' ? t.variables : DEFAULT_VARS,
    // Ensure every header row has a stable id. Without this,
    // rows deserialized from old localStorage data (which may predate the id field)
    // produce duplicate undefined keys in React and break row update/delete.
    headers: Array.isArray(t.headers)
      ? (t.headers as GraphqlHeaderRow[]).map((h) => ({
          ...h,
          id: typeof h.id === 'string' && h.id ? h.id : makeHeaderId(),
        }))
      : [],
    operationType:
      opType === 'query' || opType === 'mutation' || opType === 'subscription'
        ? opType
        : undefined,
    unsavedChanges: false, // always reset on load
    connectionId: typeof t.connectionId === 'string' ? t.connectionId : undefined,
    selectedOperation: typeof t.selectedOperation === 'string' ? t.selectedOperation : undefined,
    subscriptionTransport: (
      t.subscriptionTransport === 'auto' ||
      t.subscriptionTransport === 'graphql-transport-ws' ||
      t.subscriptionTransport === 'graphql-ws' ||
      t.subscriptionTransport === 'sse'
    ) ? t.subscriptionTransport as GqlStudioTab['subscriptionTransport'] : undefined,
    subscriptionAssertions: Array.isArray(t.subscriptionAssertions)
      ? (t.subscriptionAssertions as GraphqlSubscriptionAssertion[])
          .filter((a) => a && typeof a === 'object' && typeof a.id === 'string' && typeof a.jsonPath === 'string')
          .map((a) => ({
            id:          a.id,
            jsonPath:    a.jsonPath,
            operator:    typeof a.operator === 'string' && a.operator ? a.operator : 'is_not_null',
            expected:    a.expected ?? '',
            description: typeof a.description === 'string' ? a.description : '',
          }))
      : undefined,
    labelManual: t.labelManual === true,
    endpoint: typeof t.endpoint === 'string' && t.endpoint.trim() ? t.endpoint.trim() : undefined,
    skipTlsVerify: typeof t.skipTlsVerify === 'boolean' ? t.skipTlsVerify : undefined,
    tlsCaCert: typeof t.tlsCaCert === 'string' && t.tlsCaCert.trim() ? t.tlsCaCert : undefined,
    tlsClientCert: typeof t.tlsClientCert === 'string' && t.tlsClientCert.trim() ? t.tlsClientCert : undefined,
    tlsClientKey: typeof t.tlsClientKey === 'string' && t.tlsClientKey.trim() ? t.tlsClientKey : undefined,
    pollingEnabled: typeof t.pollingEnabled === 'boolean' ? t.pollingEnabled : undefined,
    pollingIntervalSeconds: (() => {
      const s = t.pollingIntervalSeconds;
      if (typeof s !== 'number' || !Number.isFinite(s)) return undefined;
      return clampPollingIntervalSeconds(s);
    })(),
    demoLessonId:
      typeof t.demoLessonId === 'string' && t.demoLessonId.trim()
        ? t.demoLessonId.trim()
        : undefined,
  };
}

// ─── Load / save tabs ─────────────────────────────────────────────────────────

export async function loadTabs(): Promise<GqlStudioTab[]> {
  try {
    const raw = await readKey(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    const normalized = parsed.map(normalizeTab).filter((t): t is GqlStudioTab => t !== null);
    // Cap to MAX_TABS on load. Older builds, manual edits, or corrupt data could
    // persist more tabs than the UI allows. Excess tabs are silently dropped.
    const capped = normalized.slice(0, MAX_TABS);
    return capped.length > 0 ? capped : [];
  } catch {
    return [];
  }
}

export async function saveTabs(tabs: GqlStudioTab[], activeId: string): Promise<void> {
  try {
    await writeKey(STORAGE_KEY, JSON.stringify(tabs));
    await writeKey(`${STORAGE_KEY}_active`, activeId);
  } catch {
    // storage unavailable (private browsing, quota exceeded, etc.)
  }
}

export async function loadActiveTabId(): Promise<string> {
  return (await readKey(`${STORAGE_KEY}_active`)) ?? '';
}

// ─── Auth persistence ─────────────────────────────────────────────────────────

export async function loadAuth(): Promise<GraphqlAuth | null> {
  try {
    const raw = await readKey(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const a = parsed as Record<string, unknown>;
    const validTypes = ['bearer', 'basic', 'apiKey', 'oauth2', 'custom'] as const;
    if (!validTypes.includes(a.type as (typeof validTypes)[number])) return null;
    return parsed as GraphqlAuth;
  } catch {
    return null;
  }
}

export async function saveAuth(auth: GraphqlAuth | null): Promise<void> {
  try {
    if (auth) {
      await writeKey(AUTH_STORAGE_KEY, JSON.stringify(auth));
    } else {
      await removeKey(AUTH_STORAGE_KEY);
    }
  } catch { /* no-op */ }
}

// ─── Page-level TLS certificate persistence ───────────────────────────────────

function trimTlsPemField(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeTlsCertsStorage(raw: unknown): GqlTlsCertsStorage {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return {
    caCert: trimTlsPemField(o.caCert),
    clientCert: trimTlsPemField(o.clientCert),
    clientKey: trimTlsPemField(o.clientKey),
  };
}

export async function loadTlsCerts(): Promise<GqlTlsCertsStorage> {
  try {
    const raw = await readKey(TLS_CERTS_STORAGE_KEY);
    if (!raw) return {};
    return normalizeTlsCertsStorage(JSON.parse(raw));
  } catch {
    return {};
  }
}

export async function saveTlsCerts(certs: GqlTlsCertsStorage): Promise<void> {
  const normalized = normalizeTlsCertsStorage(certs);
  const hasAny = !!(normalized.caCert || normalized.clientCert || normalized.clientKey);
  try {
    if (hasAny) {
      await writeKey(TLS_CERTS_STORAGE_KEY, JSON.stringify(normalized));
    } else {
      await removeKey(TLS_CERTS_STORAGE_KEY);
    }
  } catch { /* no-op */ }
}

// ─── Variables disposal helper ────────────────────────────────────────────────

/** Disposes Monaco models (query + vars) for a closed tab. */
export function disposeTabModels(
  mc: { editor: { getModel: (u: unknown) => { dispose: () => void } | null }; Uri: { parse: (s: string) => unknown } },
  tab: GqlStudioTab,
): void {
  try {
    const queryUri = mc.Uri.parse(tab.modelUri);
    const varsUri = mc.Uri.parse(buildVarsModelUri(tab.id));
    mc.editor.getModel(queryUri)?.dispose();
    mc.editor.getModel(varsUri)?.dispose();
  } catch {
    // Non-fatal — models may not exist yet if the tab was never rendered
  }
}
