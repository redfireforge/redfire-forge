/**
 * tabPersistence.ts — persistence helpers for GraphQL Studio editor tabs.
 *
 * Extracted from GraphqlStudioPage.tsx so the tab-management logic can be
 * unit-tested independently of the React component tree.
 */

import type { GraphqlAuth, GraphqlHeaderRow, GraphqlOperationTab, GraphqlSubscriptionAssertion } from '../../../shared/types/graphql';
import {
  idbClearPageAuthRaw,
  idbLoadPageAuthRaw,
  idbLoadTabsPersisted,
  idbMigratePageAuthFromLocalStorage,
  idbMigrateTabsFromLocalStorage,
  idbSavePageAuthRaw,
  idbSaveTabsPersisted,
} from '../../../shared/utils/idbGraphqlStudio';
import { readKey, writeKey, removeKey } from '../../../shared/utils/storage';
import { isTauri } from '../../../shared/utils/platform';
import { makeHeaderId } from './headerUtils';
import { buildModelUri, buildVarsModelUri } from './monacoGraphqlSetup';
import { clampPollingIntervalSeconds } from './pollingIntervalUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_TABS = 8;
/** Demo Hub reserves the last slot — users may open at most MAX_USER_TABS tabs. */
export const MAX_USER_TABS = MAX_TABS - 1;
export const STORAGE_KEY = 'gql_tabs_v1';
export const AUTH_STORAGE_KEY = 'gql_auth_v1';
/** Survives demo-session loss so orphan tab purge / crash cleanup can restore page auth. */
export const DEMO_PRIOR_PAGE_AUTH_KEY = 'gql_demo_prior_page_auth_v1';
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
  /**
   * Phase 6H — per-tab auth override.
   * undefined = inherit workspace (profile → page); null = explicit No Auth.
   */
  auth?: GraphqlAuth | null;
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

// ─── Auth normalizer (page + tab persistence) ─────────────────────────────────

const GRAPHQL_AUTH_TYPES = ['inherit', 'bearer', 'basic', 'apiKey', 'oauth2', 'custom'] as const;
type GraphqlAuthType = (typeof GRAPHQL_AUTH_TYPES)[number];

function isGraphqlAuthType(value: unknown): value is GraphqlAuthType {
  return typeof value === 'string' && (GRAPHQL_AUTH_TYPES as readonly string[]).includes(value);
}

/**
 * Validates raw persisted auth JSON.
 * - `null` → explicit No Auth override (tab layer only)
 * - object → GraphqlAuth when type is valid
 * - anything else → undefined (treat as absent / inherit workspace on tabs)
 */
export function normalizeGraphqlAuth(raw: unknown): GraphqlAuth | null | undefined {
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object') return undefined;
  const a = raw as Record<string, unknown>;
  if (!isGraphqlAuthType(a.type)) return undefined;

  const auth: GraphqlAuth = { type: a.type };

  if (a.type === 'inherit') {
    if (typeof a.globalProfileId === 'string' && a.globalProfileId.trim()) {
      auth.globalProfileId = a.globalProfileId.trim();
    }
    return auth;
  }

  if (typeof a.token === 'string') auth.token = a.token;
  if (typeof a.username === 'string') auth.username = a.username;
  if (typeof a.password === 'string') auth.password = a.password;
  if (typeof a.headerName === 'string') auth.headerName = a.headerName;
  if (typeof a.headerValue === 'string') auth.headerValue = a.headerValue;

  if (a.oauth2 && typeof a.oauth2 === 'object') {
    const o = a.oauth2 as Record<string, unknown>;
    auth.oauth2 = {
      tokenUrl: typeof o.tokenUrl === 'string' ? o.tokenUrl : '',
      clientId: typeof o.clientId === 'string' ? o.clientId : '',
      clientSecret: typeof o.clientSecret === 'string' ? o.clientSecret : '',
      scope: typeof o.scope === 'string' ? o.scope : undefined,
      audience: typeof o.audience === 'string' ? o.audience : undefined,
    };
  }

  return auth;
}

/** Deep equality for persisted GraphqlAuth configs (Phase 6H tab override comparison). */
export function graphqlAuthEquals(
  a: GraphqlAuth | null | undefined,
  b: GraphqlAuth | null | undefined,
): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (a.type !== b.type) return false;

  switch (a.type) {
    case 'inherit':
      return a.globalProfileId === (b as GraphqlAuth & { type: 'inherit' }).globalProfileId;
    case 'bearer':
      return a.token === (b as GraphqlAuth & { type: 'bearer' }).token;
    case 'basic':
      return (
        a.username === (b as GraphqlAuth & { type: 'basic' }).username
        && a.password === (b as GraphqlAuth & { type: 'basic' }).password
      );
    case 'apiKey':
      return (
        a.headerName === (b as GraphqlAuth & { type: 'apiKey' }).headerName
        && a.headerValue === (b as GraphqlAuth & { type: 'apiKey' }).headerValue
      );
    case 'oauth2':
    case 'custom':
    default:
      return JSON.stringify(a) === JSON.stringify(b);
  }
}

/**
 * Maps a connection-bar auth edit to tab storage.
 * Returns `undefined` when the tab should inherit workspace (omit `auth` field).
 */
export function computeTabAuthStoredValue(
  newAuth: GraphqlAuth | null,
  pageDefaultAuth: GraphqlAuth | null,
): GraphqlAuth | null | undefined {
  if (newAuth?.type === 'inherit' && !newAuth.globalProfileId?.trim()) {
    return undefined;
  }
  // Explicit No Auth is always a tab override — even when page default is also null.
  if (newAuth === null) {
    return null;
  }
  if (graphqlAuthEquals(newAuth, pageDefaultAuth)) {
    return undefined;
  }
  return newAuth;
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
    ...(() => {
      if (!('auth' in t)) return {};
      const normalized = normalizeGraphqlAuth(t.auth);
      if (normalized === undefined) return {};
      if (normalized === null) return { auth: null };
      // Tab inherit-global requires globalProfileId; bare inherit = inherit workspace (omit field).
      if (normalized.type === 'inherit' && !normalized.globalProfileId) return {};
      return { auth: normalized };
    })(),
  };
}

// ─── Load / save tabs ─────────────────────────────────────────────────────────

function removeLegacyTabLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}_active`);
  } catch { /* ignore */ }
}

function normalizeLoadedTabs(parsed: unknown[]): GqlStudioTab[] {
  const normalized = parsed.map(normalizeTab).filter((t): t is GqlStudioTab => t !== null);
  const capped = normalized.slice(0, MAX_TABS);
  return capped.length > 0 ? capped : [];
}

async function loadTabsFromIdb(): Promise<GqlStudioTab[] | null> {
  try {
    let blob = await idbLoadTabsPersisted();
    if (!blob) {
      const migrated = await idbMigrateTabsFromLocalStorage(STORAGE_KEY, `${STORAGE_KEY}_active`);
      if (!migrated) return null;
      blob = await idbLoadTabsPersisted();
    }
    if (!blob || !Array.isArray(blob.tabs)) return null;
    removeLegacyTabLocalStorage();
    return normalizeLoadedTabs(blob.tabs);
  } catch {
    return null;
  }
}

export async function loadTabs(): Promise<GqlStudioTab[]> {
  if (!isTauri()) {
    const fromIdb = await loadTabsFromIdb();
    if (fromIdb !== null) return fromIdb;
  }
  try {
    const raw = await readKey(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [];
    return normalizeLoadedTabs(parsed);
  } catch {
    return [];
  }
}

export async function saveTabs(tabs: GqlStudioTab[], activeId: string): Promise<void> {
  if (!isTauri()) {
    try {
      await idbSaveTabsPersisted(tabs, activeId);
      removeLegacyTabLocalStorage();
      return;
    } catch (err) {
      console.error('[Storage] GraphQL tabs IDB save failed', err);
    }
  }
  try {
    await writeKey(STORAGE_KEY, JSON.stringify(tabs));
    await writeKey(`${STORAGE_KEY}_active`, activeId);
  } catch {
    // storage unavailable (private browsing, quota exceeded, etc.)
  }
}

export async function loadActiveTabId(): Promise<string> {
  if (!isTauri()) {
    try {
      const blob = await idbLoadTabsPersisted();
      if (blob?.activeId) return blob.activeId;
    } catch { /* fall through */ }
  }
  return (await readKey(`${STORAGE_KEY}_active`)) ?? '';
}

// ─── Auth persistence ─────────────────────────────────────────────────────────

function parseAuthRaw(raw: string | null): GraphqlAuth | null {
  if (!raw) return null;
  const normalized = normalizeGraphqlAuth(JSON.parse(raw) as unknown);
  if (normalized === undefined) return null;
  return normalized;
}

export async function loadAuth(): Promise<GraphqlAuth | null> {
  if (!isTauri()) {
    try {
      let raw = await idbLoadPageAuthRaw();
      if (!raw) {
        await idbMigratePageAuthFromLocalStorage(AUTH_STORAGE_KEY);
        raw = await idbLoadPageAuthRaw();
      }
      if (raw) {
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch { /* ignore */ }
        return parseAuthRaw(raw);
      }
    } catch { /* fall through */ }
  }
  try {
    const raw = await readKey(AUTH_STORAGE_KEY);
    return parseAuthRaw(raw);
  } catch {
    return null;
  }
}

export async function saveAuth(auth: GraphqlAuth | null): Promise<void> {
  if (!isTauri()) {
    try {
      if (auth) {
        await idbSavePageAuthRaw(JSON.stringify(auth));
      } else {
        await idbClearPageAuthRaw();
      }
      try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } catch { /* ignore */ }
      return;
    } catch (err) {
      console.error('[Storage] GraphQL page auth IDB save failed', err);
    }
  }
  try {
    if (auth) {
      await writeKey(AUTH_STORAGE_KEY, JSON.stringify(auth));
    } else {
      await removeKey(AUTH_STORAGE_KEY);
    }
  } catch { /* no-op */ }
}

/** Snapshot of page-level auth before a Demo Hub lesson (Phase 6H Slice 6). */
export type GqlPageAuthSnapshot =
  | { stored: false }
  | { stored: true; auth: GraphqlAuth | null };

/** Validates raw JSON into a page-auth snapshot; returns undefined when corrupt. */
export function normalizePageAuthSnapshot(raw: unknown): GqlPageAuthSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (o.stored === false) return { stored: false };
  if (o.stored !== true) return undefined;
  if (o.auth === null) return { stored: true, auth: null };
  const normalized = normalizeGraphqlAuth(o.auth);
  if (normalized === undefined) return undefined;
  return { stored: true, auth: normalized };
}

/** Capture current `gql_auth_v1` for restore when a demo lesson closes. */
export async function capturePageAuthSnapshot(): Promise<GqlPageAuthSnapshot> {
  try {
    const raw = await readKey(AUTH_STORAGE_KEY);
    if (!raw) return { stored: false };
    const normalized = normalizeGraphqlAuth(JSON.parse(raw) as unknown);
    if (normalized === undefined) return { stored: false };
    return { stored: true, auth: normalized };
  } catch {
    return { stored: false };
  }
}

/** Restore page auth from a demo-session snapshot. No-op when snapshot is absent. */
export async function restorePageAuthSnapshot(
  snapshot: GqlPageAuthSnapshot | undefined,
): Promise<void> {
  if (!snapshot) return;
  if (!snapshot.stored) {
    await removeKey(AUTH_STORAGE_KEY);
    return;
  }
  await saveAuth(snapshot.auth);
}

export async function saveDemoPriorPageAuthBackup(
  snapshot: GqlPageAuthSnapshot,
): Promise<void> {
  try {
    await writeKey(DEMO_PRIOR_PAGE_AUTH_KEY, JSON.stringify(snapshot));
  } catch { /* no-op */ }
}

export async function loadDemoPriorPageAuthBackup(): Promise<GqlPageAuthSnapshot | undefined> {
  try {
    const raw = await readKey(DEMO_PRIOR_PAGE_AUTH_KEY);
    if (!raw) return undefined;
    return normalizePageAuthSnapshot(JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

export async function clearDemoPriorPageAuthBackup(): Promise<void> {
  try {
    await removeKey(DEMO_PRIOR_PAGE_AUTH_KEY);
  } catch { /* no-op */ }
}

export const DEMO_PRIOR_PAGE_ENDPOINT_KEY = 'gql_demo_prior_page_endpoint_v1';

/** Capture current `gql_endpoint_v1` for restore when a demo lesson closes (§11.0). */
export async function capturePageEndpointSnapshot(): Promise<string | null> {
  try {
    return await readKey(ENDPOINT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Restore page endpoint from a demo-session snapshot. No-op when snapshot is undefined. */
export async function restorePageEndpointSnapshot(
  endpoint: string | null | undefined,
): Promise<void> {
  if (endpoint === undefined) return;
  if (endpoint === null || endpoint.trim() === '') {
    await removeKey(ENDPOINT_STORAGE_KEY);
    return;
  }
  await writeKey(ENDPOINT_STORAGE_KEY, endpoint.trim());
}

export async function saveDemoPriorPageEndpointBackup(endpoint: string | null): Promise<void> {
  try {
    await writeKey(DEMO_PRIOR_PAGE_ENDPOINT_KEY, endpoint ?? '');
  } catch { /* no-op */ }
}

export async function loadDemoPriorPageEndpointBackup(): Promise<string | null | undefined> {
  try {
    const raw = await readKey(DEMO_PRIOR_PAGE_ENDPOINT_KEY);
    if (raw === null) return undefined;
    return raw === '' ? null : raw;
  } catch {
    return undefined;
  }
}

export async function clearDemoPriorPageEndpointBackup(): Promise<void> {
  try {
    await removeKey(DEMO_PRIOR_PAGE_ENDPOINT_KEY);
  } catch { /* no-op */ }
}

/** Remove per-tab auth override from a demo tab before lesson cleanup (Phase 6H Slice 6). */
export function stripDemoTabAuthOverride(tab: GqlStudioTab): GqlStudioTab {
  if (!tab.demoLessonId || tab.auth === undefined) return tab;
  const { auth: _auth, ...rest } = tab;
  return rest as GqlStudioTab;
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
