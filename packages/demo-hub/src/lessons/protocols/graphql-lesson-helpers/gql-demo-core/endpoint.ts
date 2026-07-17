import type { DemoActionContext } from '../../../../types';
import { GQL } from '@shared/selectors';
import {
  ensureGqlDemoHeaderContext,
  navigateToGraphqlStudio,
} from '../../../env-manager-lesson-helpers';
import { activateGqlDemoTabQuiet } from '../gql-demo-tab';
import {
  dispatchGqlPageEndpointReload,
  loadDemoSession,
  patchDemoTabConnection,
  restorePageEndpointSnapshot,
} from '../../../../adapters';
import { GQL_DEMO_HTTP, GQL_DEMO_VAR } from './constants';
import { gqlLessonSession } from './sessionFlags';

export function getEndpointInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT);
}

/** Fill the connection bar endpoint and blur so React persists the value on the active tab. */
export async function fillActiveTabEndpoint(ctx: DemoActionContext, url: string): Promise<void> {
  await ctx.fill(GQL.ENDPOINT_INPUT, url);
  getEndpointInput()?.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  await ctx.delay(400);
}

/**
 * Clear per-tab endpoint override on the active tab (reset → inherit page default).
 * No-op when the reset control is absent (single-tab page-default mode).
 */
export async function clearActiveTabEndpointOverride(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(GQL.ENDPOINT_RESET_BTN)) return;
  await ctx.click(GQL.ENDPOINT_RESET_BTN);
  await ctx.delay(400);
}

/**
 * Set the page-level GraphQL endpoint to `{{graphqlUrl}}` so demo tabs inherit the
 * env-managed template instead of a resolved loopback literal (§11.0).
 */
export async function ensureGqlDemoPageDefaultEndpoint(ctx: DemoActionContext): Promise<void> {
  await restorePageEndpointSnapshot(GQL_DEMO_VAR);
  dispatchGqlPageEndpointReload();
  await ctx.delay(500);
  await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
  for (let i = 0; i < 20; i++) {
    const v = (getEndpointInput()?.value ?? '').trim();
    if (v === GQL_DEMO_VAR) return;
    await ctx.delay(100);
  }
}

/**
 * Demo tab should use page `{{graphqlUrl}}` without storing a per-tab override
 * (required when the user already has tabs open — §11.0).
 */
export async function configureDemoTabInheritPageDefault(ctx: DemoActionContext): Promise<void> {
  const session = await loadDemoSession();
  if (session?.demoTabId) {
    await ctx.waitFor(GQL.tab(session.demoTabId), 10_000);
    const demoTabSel = GQL.tab(session.demoTabId);
    const demoTabEl = document.querySelector(demoTabSel);
    if (demoTabEl?.getAttribute('aria-selected') !== 'true') {
      await ctx.click(demoTabSel);
      await ctx.delay(400);
    }
  }
  await ensureGqlDemoPageDefaultEndpoint(ctx);
  await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
  // Wait for the demo tab to appear in the tab bar so endpoint edits stay tab-scoped (§11.0).
  const tabBarSel = `${GQL.TAB_BAR} [role="tab"]`;
  for (let i = 0; i < 20; i++) {
    if (document.querySelectorAll(tabBarSel).length >= 2) break;
    await ctx.delay(100);
  }
  await ctx.delay(400);
  await clearActiveTabEndpointOverride(ctx);
  await patchDemoTabConnection({ endpoint: undefined });
}

/** Demo tab explicit per-tab URL override (mutations server, mock, TLS, schema literal URL). */
export async function configureDemoTabEndpointOverride(
  ctx: DemoActionContext,
  url: string,
): Promise<void> {
  await ctx.waitFor(GQL.ENDPOINT_INPUT, 5000);
  const trimmed = url.trim();
  if ((getEndpointInput()?.value ?? '').trim() !== trimmed) {
    await fillActiveTabEndpoint(ctx, trimmed);
  }
  if (demoEndpointLooksConfigured()) {
    gqlLessonSession.endpointSet = true;
  }
}

/** True when the connection bar still shows a TLS lesson endpoint or TLS chrome. */
export function demoTabShowsStaleTlsState(): boolean {
  const v = (getEndpointInput()?.value ?? '').trim().toLowerCase();
  if (v.startsWith('https://') || v.includes(':4443') || v.includes(':4445')) return true;
  return Boolean(document.querySelector(GQL.TLS_TOGGLE));
}

/**
 * Reset the demo tab to plain HTTP and clear TLS overrides — e.g. after GQL-5 or when
 * starting a port-4010 lesson with stale https://127.0.0.1:4443 still on the tab.
 */
export async function resetDemoTabToPlainHttp(ctx: DemoActionContext): Promise<void> {
  const session = await loadDemoSession();
  if (session?.demoTabId) {
    await patchDemoTabConnection({
      endpoint: GQL_DEMO_HTTP,
      skipTlsVerify: undefined,
      tlsCaCert: undefined,
      tlsClientCert: undefined,
      tlsClientKey: undefined,
    });
    await activateGqlDemoTabQuiet(ctx);
    await ctx.delay(500);
  }

  if (demoTabShowsStaleTlsState()) {
    await configureDemoTabEndpointOverride(ctx, GQL_DEMO_HTTP);
  }
  await ctx.delay(200);
}

/** True when the connection bar shows a usable GraphQL demo endpoint. */
export function demoEndpointLooksConfigured(): boolean {
  const v = (getEndpointInput()?.value ?? '').trim();
  // Match the template var OR the resolved http:// URL on port 4010.
  // Explicitly exclude https:// on 4010 — that's the wrong scheme.
  return v.includes('graphqlUrl') || (v.includes(':4010') && v.startsWith('http://'));
}

/** Ensure the demo endpoint is filled in the connection bar. */
export async function ensureDemoEndpoint(ctx: DemoActionContext): Promise<void> {
  if (gqlLessonSession.endpointSet && demoEndpointLooksConfigured()) {
    await navigateToGraphqlStudio(ctx);
    return;
  }
  await ensureGqlDemoHeaderContext(ctx);
  await navigateToGraphqlStudio(ctx);
  if (!demoEndpointLooksConfigured()) {
    await fillActiveTabEndpoint(ctx, GQL_DEMO_VAR);
  }
  gqlLessonSession.endpointSet = true;
}

/**
 * Demo tab at literal `http://localhost:4010/graphql` — no Environment Manager round-trip.
 * Use for lessons that isolate work on the demo tab (Query Builder, mutations, etc.).
 */
export async function ensureDemoTabDirectHttpEndpoint(ctx: DemoActionContext): Promise<void> {
  await navigateToGraphqlStudio(ctx);
  await activateGqlDemoTabQuiet(ctx);
  if (!demoEndpointLooksConfigured()) {
    await configureDemoTabEndpointOverride(ctx, GQL_DEMO_HTTP);
    await patchDemoTabConnection({ endpoint: GQL_DEMO_HTTP });
  }
  gqlLessonSession.endpointSet = true;
}
