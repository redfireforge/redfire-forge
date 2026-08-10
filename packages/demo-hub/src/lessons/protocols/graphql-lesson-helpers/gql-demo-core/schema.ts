import type { DemoActionContext } from '../../../../types';
import { GQL } from '@shared/selectors';
import {
  ensureGqlDemoHeaderContext,
  navigateToGraphqlStudio,
} from '../../../env-manager-lesson-helpers';
import { getDemoBridgeWindow, patchDemoTabConnection } from '../../../../adapters';
import { ensureDemoEndpoint, ensureDemoTabDirectHttpEndpoint, ensureGqlDemoPageDefaultEndpoint } from './endpoint';
import { gqlLessonSession } from './sessionFlags';

function hasSchemaBadge(): boolean {
  return !!document.querySelector(GQL.SCHEMA_BADGE_OK);
}

/** True when the schema badge shows a zero-type count — stale or failed introspection. */
export function schemaBadgeShowsEmpty(): boolean {
  const badge = document.querySelector(GQL.SCHEMA_BADGE_OK);
  if (!badge) return false;
  return /\(\s*0\s*\)/.test(badge.textContent ?? '');
}

/** True when the schema badge is present and reports a non-empty type count. */
export function hasUsableSchemaBadge(): boolean {
  return hasSchemaBadge() && !schemaBadgeShowsEmpty();
}

/** True when the Schema Explorer type list includes the root Query type. */
function schemaExplorerShowsQueryType(): boolean {
  return !!document.querySelector(GQL.SCHEMA_TYPE_QUERY);
}

function getPollingAttempts(timeoutMs: number, intervalMs: number): number {
  const interval = Math.max(1, intervalMs);
  return Math.max(1, Math.ceil(timeoutMs / interval));
}

/** Poll until the schema badge appears (Tauri IDB cache can lag behind preAction). */
export async function waitForSchemaCached(
  ctx: DemoActionContext,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<boolean> {
  const attempts = getPollingAttempts(timeoutMs, 100);
  for (let i = 0; i < attempts; i++) {
    if (signal?.aborted) return false;
    if (document.querySelector(GQL.SCHEMA_BADGE_OK)) return true;
    await ctx.delay(100);
  }
  return !!document.querySelector(GQL.SCHEMA_BADGE_OK);
}

/** Switch the right pane to Schema via React bridge (preferred) or DOM click. */
export async function setGqlRightTabSchema(ctx: DemoActionContext): Promise<void> {
  const bridge = getDemoBridgeWindow().__demoSetGqlRightView;
  if (bridge) {
    bridge('schema');
    await ctx.delay(300);
    return;
  }
  await ctx.click(GQL.RIGHT_TAB_SCHEMA);
  await ctx.delay(400);
}

/** Open Schema tab once the contract badge is green (cached or live introspect). */
export async function openSchemaTabWhenCached(ctx: DemoActionContext): Promise<boolean> {
  if (!document.querySelector(GQL.SCHEMA_BADGE_OK)) return false;
  if (document.querySelector(GQL.RIGHT_TAB_SCHEMA)?.getAttribute('aria-selected') !== 'true') {
    await setGqlRightTabSchema(ctx);
  }
  await ctx.waitFor(GQL.SCHEMA_EXPLORER, 5000);
  await ctx.waitFor(GQL.SCHEMA_TYPE_LIST, 5000);
  await ctx.delay(200);
  return true;
}

/** Poll during reading pause and open Schema when IDB/async cache finishes loading. */
export async function syncSchemaTabWhenCachedDuringReading(
  ctx: DemoActionContext,
  signal?: AbortSignal,
): Promise<void> {
  const cached = await waitForSchemaCached(ctx, 15000, signal);
  if (!cached || signal?.aborted) return;
  await openSchemaTabWhenCached(ctx);
}

/** Open the Schema tab and wait until the Query type is listed. */
export async function openSchemaExplorer(ctx: DemoActionContext): Promise<void> {
  await ctx.click(GQL.RIGHT_TAB_SCHEMA);
  await ctx.waitFor(GQL.SCHEMA_EXPLORER, 5000);
  if (!schemaExplorerShowsQueryType()) {
    await ensureIntrospected(ctx);
    await ctx.click(GQL.RIGHT_TAB_SCHEMA);
    await ctx.delay(400);
  }
  await ctx.waitFor(GQL.SCHEMA_TYPE_QUERY, 15000);
  await ctx.delay(400);
}

/** Cap for ensure-introspect waits — Preparing/setup must never burn 25s×2. */
const ENSURE_INTROSPECT_WAIT_MS = 5_000;
const ENSURE_INTROSPECT_RETRY_MS = 3_000;

async function runEnsureIntrospected(ctx: DemoActionContext): Promise<void> {
  // Green schema badge is enough proof of introspection. Never open the Schema
  // tab from this helper — that steals focus from Response/Tracing mid-lesson
  // and used to stack 25s+ waits that froze the Preparing pill on step 1.
  // Lessons that need the Schema Explorer should call openSchemaExplorer().
  if (hasUsableSchemaBadge()) {
    gqlLessonSession.schemaLoaded = true;
    return;
  }

  const introspectBtn = document.querySelector<HTMLElement>(GQL.INTROSPECT_BTN);
  if (introspectBtn) {
    introspectBtn.click();
  } else {
    await ctx.click(GQL.INTROSPECT_BTN);
  }
  await ctx.waitFor(GQL.SCHEMA_BADGE_OK, ENSURE_INTROSPECT_WAIT_MS).catch(() => undefined);
  await ctx.delay(200);

  if (hasUsableSchemaBadge()) {
    gqlLessonSession.schemaLoaded = true;
    return;
  }

  // One short retry — fail soft so lesson setup can enter Reading.
  document.querySelector<HTMLElement>(GQL.INTROSPECT_BTN)?.click();
  await ctx.waitFor(GQL.SCHEMA_BADGE_OK, ENSURE_INTROSPECT_RETRY_MS).catch(() => undefined);
  gqlLessonSession.schemaLoaded = hasUsableSchemaBadge();
}

/** Ensure schema introspection completed and the Query type is browsable. */
export async function ensureIntrospected(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEndpoint(ctx);
  await runEnsureIntrospected(ctx);
}

/**
 * Introspect using page-level `{{graphqlUrl}}` — demo tabs inherit without per-tab override.
 * Use for multi-tab / batch lessons (GQL-14, GQL-15) where batch parity requires a shared page default.
 */
export async function ensureIntrospectedWithPageDefault(ctx: DemoActionContext): Promise<void> {
  await ensureGqlDemoHeaderContext(ctx);
  await navigateToGraphqlStudio(ctx);
  await ensureGqlDemoPageDefaultEndpoint(ctx);
  await patchDemoTabConnection({ endpoint: undefined });
  gqlLessonSession.endpointSet = true;
  await runEnsureIntrospected(ctx);
}

/** Introspect on the demo tab using a direct HTTP endpoint (skips Environment Manager). */
export async function ensureIntrospectedOnDirectEndpoint(ctx: DemoActionContext): Promise<void> {
  await ensureDemoTabDirectHttpEndpoint(ctx);
  await runEnsureIntrospected(ctx);
}
