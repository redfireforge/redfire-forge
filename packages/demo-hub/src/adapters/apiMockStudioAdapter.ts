/**
 * API Mock Studio demo adapters — quiet workspace helpers for lessons.
 */
import { getDemoBridgeWindow } from './bridgeWindow';
import { collapseAppSidebar } from './appShellAdapter';
import type { DemoLesson } from '../types';

export { collapseAppSidebar };

export function isApiMockStudioLesson(lesson: Pick<DemoLesson, 'category' | 'domainId' | 'initialTab'>): boolean {
  return lesson.category === 'api-mock'
    || lesson.domainId === 'api-mock'
    || lesson.initialTab === 'api-mock-studio';
}

export interface ApiMockStudioServerRow {
  id: string;
  name: string;
  port: number;
  active: boolean;
}

/** Wipe mock workspace listeners and close Studio tabs (saved servers stay in the library). */
export async function wipeApiMockWorkspace(): Promise<boolean> {
  const fn = getDemoBridgeWindow().__demoWipeApiMockWorkspace;
  if (!fn) return false;
  return fn();
}

/** Restore the user mock library captured before the lesson wipe. */
export async function restoreApiMockUserWorkspace(): Promise<boolean> {
  const fn = getDemoBridgeWindow().__demoRestoreApiMockUserWorkspace;
  if (!fn) return false;
  return fn();
}

/** Live Studio mocks — gallery import remaps template ids (`srv-gallery-*` → `srv-<uuid>`). */
export async function listApiMockStudioServers(): Promise<ApiMockStudioServerRow[]> {
  const fn = getDemoBridgeWindow().__demoListApiMockServers;
  if (!fn) return [];
  return fn();
}

/** Quiet import of a Gallery mock sample into Studio. */
export async function importApiMockGallerySample(sampleId: string): Promise<boolean> {
  const fn = getDemoBridgeWindow().__demoImportApiMockGallerySample;
  if (!fn) return false;
  return fn(sampleId);
}

/** Open an empty mock server when the workspace has none. */
export async function ensureBlankApiMockServer(): Promise<boolean> {
  const fn = getDemoBridgeWindow().__demoEnsureBlankApiMockServer;
  if (!fn) return false;
  return fn();
}

/** Quiet TLS key + sensitive variable so an export lesson can prove redaction. */
export async function seedApiMockExportSecrets(): Promise<boolean> {
  const fn = getDemoBridgeWindow().__demoSeedApiMockExportSecrets;
  if (!fn) return false;
  return fn();
}

/** Collapse the app sidebar so Studio has horizontal room. */
export function prepareApiMockStudioChrome(): void {
  collapseAppSidebar();
}

/** Clear all server-level simulate samples (removes stale FAIL badges on lesson replay). */
export function clearApiMockServerSamples(): boolean {
  const fn = getDemoBridgeWindow().__demoClearApiMockServerSamples;
  if (!fn) return false;
  return fn();
}

export type ApiMockDemoSampleDraft = {
  name: string;
  method: string;
  path: string;
  body?: string | null;
  contentType?: string;
  expected?: {
    outcome: 'matched' | 'unmatched' | 'ambiguous' | 'fault' | 'error' | 'proxied';
    status?: number;
    bodyContains?: string;
  };
};

/** Upsert saved Simulate samples by display name (idempotent). */
export function upsertApiMockServerSamples(drafts: ApiMockDemoSampleDraft[]): boolean {
  const fn = getDemoBridgeWindow().__demoUpsertApiMockServerSamples;
  if (!fn) return false;
  return fn(drafts);
}


export interface ApiMockDemoRequest {
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  serverId?: string;
  /** Abort the client after this many ms (timeout faults never answer). */
  timeoutMs?: number;
}

/** Send real traffic to a running mock (journal row + readable status) without a terminal. */
export async function sendApiMockRequest(
  req: ApiMockDemoRequest = {},
): Promise<{ status: number; body: string } | null> {
  const fn = getDemoBridgeWindow().__demoSendApiMockRequest;
  if (!fn) return null;
  return fn(req);
}

/** Path matcher kinds a lesson may pin when patching quietly. */
export type ApiMockDemoPathKind = 'exact' | 'parameterized' | 'glob' | 'regex';

/** Where a match condition reads its value from. */
export type ApiMockDemoPredicateSource =
  | 'pathParam' | 'query' | 'header' | 'cookie' | 'security' | 'body' | 'transport';

/** Response selection mode a lesson may pin when patching quietly. */
export type ApiMockDemoResponseMode = 'rules' | 'sequence' | 'weighted' | 'state';

/**
 * One quiet match condition. `expected` is omitted for the present / absent operators
 * and is a `[expression, value]` pair for the JSONPath / XPath / form matchers.
 * `matchStyle` is how that value is compared — `exact` equality or `subset` containment.
 */
export interface ApiMockDemoPredicate {
  id: string;
  source: ApiMockDemoPredicateSource;
  selector?: string;
  operator: string;
  expected?: string | string[];
  options?: { caseSensitive?: boolean; negate?: boolean; matchStyle?: 'subset' | 'exact' };
}

/** A boolean group of conditions — `not` is the product's "None of" guard. */
export interface ApiMockDemoPredicateGroup {
  id: string;
  combinator: 'all' | 'any' | 'not';
  children: Array<ApiMockDemoPredicate | ApiMockDemoPredicateGroup>;
}

/**
 * Patch active route path/priority/body/conditions via Studio React state (required for
 * the Monaco body). `path` re-infers the matcher kind; pass `pathKind` for regex, which
 * no path string implies. `predicates` replaces the whole Match group, so a replayed
 * condition step can start from a known tree instead of stacking duplicates.
 */
export function patchApiMockActiveRoute(patch: {
  path?: string;
  pathKind?: ApiMockDemoPathKind;
  selectPath?: string;
  selectMethod?: string;
  body?: string;
  contentType?: string;
  status?: number;
  reasonPhrase?: string;
  priority?: number;
  predicates?: ApiMockDemoPredicateGroup;
  responseMode?: ApiMockDemoResponseMode;
  addVariant?: boolean;
  addRoute?: boolean;
  removeRoute?: boolean;
  enabled?: boolean;
  method?: string;
  variantIndex?: number;
  variantName?: string;
  variantConditions?: ApiMockDemoPredicateGroup;
  isDefault?: boolean;
  transition?: {
    currentState?: string;
    targetState: string;
    counterUpdates?: Array<{ key: string; delta: number }>;
  };
  weight?: number;
  behavior?: {
    delayMs?: number;
    jitterMs?: number;
    maxMatches?: number | null;
    expiresAt?: string | null;
    probability?: number | null;
    fault?: 'none' | 'timeout' | 'close' | 'reset' | 'malformed' | 'dribble';
    longRunningMs?: number | null;
    chunkSchedule?: Array<{ afterMs: number; body: string }> | null;
  };
}): boolean {
  const fn = getDemoBridgeWindow().__demoPatchApiMockActiveRoute;
  if (!fn) return false;
  return fn(patch);
}

/** Quiet patch of the active server's selection / proxy / fallback so a replayed step starts clean. */
export function patchApiMockServerSettings(patch: {
  multipleMatchPolicy?: 'highest_priority' | 'reject_multiple';
  equalPriorityPolicy?: 'specificity_then_id' | 'reject';
  ambiguityBody?: string;
  fallbackMode?: 'default_response' | 'closest_match_debug' | 'proxy';
  proxyEnabled?: boolean;
  proxyAllowlist?: string[];
  proxyBlockPrivate?: boolean;
  proxyForwardAuth?: boolean;
  proxyRecordDrafts?: boolean;
  corsEnabled?: boolean;
  corsOrigins?: string[];
  maxInboundBodyBytes?: number;
  maxConcurrentConnections?: number;
  gracefulDrainMs?: number;
  persistToDisk?: boolean;
  redactHeaders?: string[];
  redactJsonPaths?: string[];
  callbackAllowlist?: string[];
}): boolean {
  const fn = getDemoBridgeWindow().__demoPatchApiMockServerSettings;
  if (!fn) return false;
  return fn(patch);
}
