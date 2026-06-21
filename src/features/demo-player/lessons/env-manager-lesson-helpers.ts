/**
 * Shared helpers for Environment Manager demo steps (Phase 5).
 * Used by WebSocket, SSE, and GraphQL protocol lessons.
 */
import type { DemoActionContext } from '../types';
import { APP, EM, emAddProtocolItemSel } from '../../../shared/selectors';
import type { ProtocolKey } from '../../../shared/types';

/** Shared SSE demo lesson identifiers and endpoint (basic + advanced lessons). */
export const SSE_DEMO_ENV_NAME = 'SSE Demo';
export const SSE_DEMO_SVC_NAME = 'sse-demo';
export const SSE_DEMO_BASE_URL = 'http://localhost:3001';

function isNamedHeaderOptionAvailable(selectSelector: string, name: string): boolean {
  const select = document.querySelector<HTMLSelectElement>(selectSelector);
  if (!select) return false;
  return Array.from(select.options).some((o) => o.text.trim() === name);
}

/**
 * Recreate the SSE Demo environment + sse-demo microservice with SSE endpoint configured.
 * Idempotent — safe when the basic SSE lesson already ran or data was cleaned up afterward.
 */
export async function ensureSseDemoEndpointConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEnvironment(ctx, SSE_DEMO_ENV_NAME);
  await ensureDemoMicroservice(ctx, SSE_DEMO_SVC_NAME);
  await navigateToEnvironmentManager(ctx);
  await ctx.delay(400);
  await expandNamedMicroservice(ctx, SSE_DEMO_SVC_NAME);
  await ensureProtocolEnabled(ctx, 'sse');
  await ensureNamedEnvDeployedOnProtocol(ctx, 'sse', SSE_DEMO_ENV_NAME, SSE_DEMO_BASE_URL);
}

/** Ensure demo env/svc exist and are selected in the app header so {{sseUrl}} resolves. */
export async function ensureSseDemoHeaderContext(ctx: DemoActionContext): Promise<void> {
  const envReady = isNamedHeaderOptionAvailable(APP.HEADER_ENV_SELECT, SSE_DEMO_ENV_NAME);
  const svcReady = isNamedHeaderOptionAvailable(APP.HEADER_SVC_SELECT, SSE_DEMO_SVC_NAME);
  if (!envReady || !svcReady) {
    await ensureSseDemoEndpointConfigured(ctx);
  }
  await selectEnvInHeader(ctx, SSE_DEMO_ENV_NAME);
  await selectSvcInHeader(ctx, SSE_DEMO_SVC_NAME);
}

// ── Demo-dedicated env / microservice creation & cleanup ───────────────────

/**
 * Click a delete button then handle the (possibly two-stage) confirm dialog.
 * The EnvironmentManager uses a custom confirm dialog with two stages when
 * there are associated resources (warning → continue → delete permanently).
 * Clicking `.confirm-dialog .btn-danger` up to twice handles both cases.
 */
async function clickDeleteAndConfirm(
  ctx: DemoActionContext,
  deleteButtonSelector: string,
): Promise<void> {
  const deleteBtn = document.querySelector<HTMLElement>(deleteButtonSelector);
  if (!deleteBtn) return;
  deleteBtn.click();
  await ctx.delay(300);
  // Handle up to two-stage confirm dialog (warning → continue → delete permanently).
  for (let i = 0; i < 2; i++) {
    const dialogBtn = document.querySelector<HTMLElement>('.confirm-dialog .btn-danger');
    if (!dialogBtn) break;
    dialogBtn.click();
    await ctx.delay(300);
  }
}

/**
 * Delete a named microservice from the Environment Manager.
 * No-op if the microservice card is not found.
 */
export async function cleanupDemoMicroservice(
  ctx: DemoActionContext,
  name: string,
): Promise<void> {
  await navigateToEnvironmentManager(ctx);
  const svcCard = document.querySelector<HTMLElement>(`[data-svc-name="${name}"]`);
  if (!svcCard) return;
  // Collapse any open panel first so the Delete button is accessible.
  const collapseBtn = svcCard.querySelector<HTMLElement>('[data-testid^="em-svc-configure-"]');
  if (collapseBtn?.textContent?.includes('Collapse')) {
    collapseBtn.click();
    await ctx.delay(300);
  }
  await clickDeleteAndConfirm(ctx, `[data-svc-name="${name}"] .btn-danger`);
  await ctx.delay(400);
}

/**
 * Delete a named environment chip from the Environment Manager.
 * No-op if the environment chip is not found.
 */
export async function cleanupDemoEnvironment(
  ctx: DemoActionContext,
  name: string,
): Promise<void> {
  await navigateToEnvironmentManager(ctx);
  const chip = document.querySelector<HTMLElement>(`[data-env-name="${name}"]`);
  if (!chip) return;
  await clickDeleteAndConfirm(ctx, `[data-env-name="${name}"] .settings-chip-delete`);
  await ctx.delay(400);
}

// ── Demo-dedicated env / microservice creation ─────────────────────────────

/**
 * Ensure a named environment exists, creating it if absent.
 * Idempotent: does nothing when `[data-env-name="${name}"]` is already in the DOM.
 * Call this before `ensureDemoMicroservice` so the env row is available in
 * the microservice's protocol panel when it is expanded.
 */
export async function ensureDemoEnvironment(
  ctx: DemoActionContext,
  name: string,
): Promise<void> {
  await navigateToEnvironmentManager(ctx);
  if (document.querySelector(`[data-env-name="${name}"]`)) return;
  await ctx.fill(EM.ADD_ENV_INPUT, name);
  await ctx.delay(300);
  await ctx.click(EM.ADD_ENV_BTN);
  // Wait for the chip to appear in the DOM.
  for (let i = 0; i < 20; i++) {
    if (document.querySelector(`[data-env-name="${name}"]`)) break;
    await ctx.delay(100);
  }
  await ctx.delay(400);
}

/**
 * Ensure a named microservice exists, creating it if absent.
 * Idempotent: does nothing when `[data-svc-name="${name}"]` is already in the DOM.
 */
export async function ensureDemoMicroservice(
  ctx: DemoActionContext,
  name: string,
): Promise<void> {
  await navigateToEnvironmentManager(ctx);
  if (document.querySelector(`[data-svc-name="${name}"]`)) return;
  await ctx.fill(EM.ADD_SVC_INPUT, name);
  await ctx.delay(300);
  await ctx.click(EM.ADD_SVC_BTN);
  for (let i = 0; i < 20; i++) {
    if (document.querySelector(`[data-svc-name="${name}"]`)) break;
    await ctx.delay(100);
  }
  await ctx.delay(400);
}

/**
 * Expand the Configure panel for a specific named microservice.
 * Falls back to expanding the first microservice if the named card is not found.
 */
export async function expandNamedMicroservice(
  ctx: DemoActionContext,
  name: string,
): Promise<void> {
  if (document.querySelector(EM.PROTOCOL_PANEL)) return;
  const svcCard = document.querySelector<HTMLElement>(`[data-svc-name="${name}"]`);
  if (svcCard) {
    const configBtn = svcCard.querySelector<HTMLElement>('[data-testid^="em-svc-configure-"]');
    if (configBtn) {
      configBtn.click();
      await ctx.waitFor(EM.PROTOCOL_PANEL);
      await ctx.delay(600);
      return;
    }
  }
  // Fallback: expand first visible microservice.
  await expandFirstMicroservice(ctx);
}

const PROTOCOL_TAB: Record<ProtocolKey, string> = {
  http: EM.PROTOCOL_TAB_HTTP,
  websocket: EM.PROTOCOL_TAB_WS,
  sse: EM.PROTOCOL_TAB_SSE,
  graphql: EM.PROTOCOL_TAB_GQL,
  grpc: EM.PROTOCOL_TAB_GRPC,
};

function firstVisibleSelector(selector: string): string | null {
  const all = document.querySelectorAll<HTMLElement>(selector);
  for (const el of Array.from(all)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return selector;
  }
  return all.length > 0 ? selector : null;
}

function panelScoped(selector: string): string {
  return `${EM.PROTOCOL_PANEL} ${selector}`;
}

/** Open Settings → Environments when not already on the Environment Manager page.
 *
 * IMPORTANT: We must use `ctx.navigateToTab('environments')` rather than clicking
 * APP.AB_SETTINGS.  Clicking the activity bar during live mode goes through
 * `handleSetActiveTab` in App.tsx, which unconditionally calls `exitLiveDemo()` —
 * destroying the popup before the step can run.  `ctx.navigateToTab` bypasses that
 * handler and calls raw `setActiveTab` directly, keeping the demo alive.
 */
export async function navigateToEnvironmentManager(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(EM.MANAGER)) {
    ctx.navigateToTab('environments');
    await ctx.delay(400);
    await ctx.waitFor(EM.MANAGER);
  }
}

/** Expand the first microservice card if none is expanded yet. */
export async function expandFirstMicroservice(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(EM.PROTOCOL_PANEL)) return;
  const configureSel = firstVisibleSelector(EM.SVC_CONFIGURE);
  if (!configureSel) return;
  await ctx.click(configureSel);
  await ctx.waitFor(EM.PROTOCOL_PANEL);
  await ctx.delay(600);
}

/** Deploy the first environment row on a protocol tab; optionally save an endpoint URL. */
export async function ensureFirstEnvDeployedOnProtocol(
  ctx: DemoActionContext,
  protocol: ProtocolKey,
  endpointUrl?: string,
): Promise<void> {
  await ensureProtocolEnabled(ctx, protocol);
  await selectProtocolTab(ctx, protocol);

  const firstCheckbox = document.querySelector<HTMLInputElement>(panelScoped(EM.DEPLOY_CHECKBOX));
  if (firstCheckbox && !firstCheckbox.checked) {
    firstCheckbox.click();
    for (let i = 0; i < 20; i++) {
      if (document.querySelector(panelScoped(EM.ENDPOINT_EDIT))) break;
      await ctx.delay(100);
    }
    await ctx.delay(300);
  }

  if (!endpointUrl) return;

  const editBtn = document.querySelector<HTMLButtonElement>(panelScoped(EM.ENDPOINT_EDIT));
  if (!editBtn) return;
  const row = editBtn.closest('tr');
  const code = row?.querySelector('code.em-url-text');
  if (code?.textContent?.trim()) return;
  await editFirstProtocolEndpoint(ctx, endpointUrl);
}

/** Deploy a named environment on a protocol tab; optionally save an endpoint URL. */
export async function ensureNamedEnvDeployedOnProtocol(
  ctx: DemoActionContext,
  protocol: ProtocolKey,
  envName: string,
  endpointUrl?: string,
): Promise<void> {
  await ensureProtocolEnabled(ctx, protocol);
  await selectProtocolTab(ctx, protocol);

  const deploySel = panelScoped(`input[type="checkbox"][aria-label="Deploy ${envName}"]`);
  const checkbox = document.querySelector<HTMLInputElement>(deploySel);
  if (checkbox && !checkbox.checked) {
    checkbox.click();
    for (let i = 0; i < 20; i++) {
      if (findEditBtnForEnv(envName)) break;
      await ctx.delay(100);
    }
    await ctx.delay(300);
  }

  if (!endpointUrl) return;

  const editBtn = findEditBtnForEnv(envName);
  if (!editBtn) return;
  const row = editBtn.closest('tr');
  const code = row?.querySelector('code.em-url-text');
  if (code?.textContent?.trim()) return;
  await editNamedProtocolEndpoint(ctx, envName, endpointUrl);
}

function findEditBtnForEnv(envName: string): HTMLButtonElement | null {
  const panel = document.querySelector(EM.PROTOCOL_PANEL);
  if (!panel) return null;
  for (const row of Array.from(panel.querySelectorAll('tr'))) {
    const chip = row.querySelector('.em-env-chip');
    if (chip?.textContent?.trim() !== envName) continue;
    return row.querySelector<HTMLButtonElement>(EM.ENDPOINT_EDIT);
  }
  return null;
}

/** Inline-edit the endpoint row for a named environment in the active protocol panel. */
export async function editNamedProtocolEndpoint(
  ctx: DemoActionContext,
  envName: string,
  url: string,
): Promise<void> {
  await ctx.waitFor(EM.PROTOCOL_PANEL);
  const editBtn = findEditBtnForEnv(envName);
  if (!editBtn) {
    await editFirstProtocolEndpoint(ctx, url);
    return;
  }
  editBtn.click();
  await ctx.waitFor(EM.ENDPOINT_EDIT_INPUT);
  await ctx.delay(600);
  await ctx.fill(EM.ENDPOINT_EDIT_INPUT, url);
  await ctx.delay(400);
  await ctx.click(EM.ENDPOINT_SAVE);
  await ctx.delay(700);
}

/** Ensure at least one environment is deployed on the HTTP tab with a base URL. */
export async function ensureFirstEnvDeployed(
  ctx: DemoActionContext,
  httpBaseUrl: string,
): Promise<void> {
  await ensureFirstEnvDeployedOnProtocol(ctx, 'http', httpBaseUrl);
}

/**
 * Ensure the given protocol tab is visible in the expanded microservice panel.
 * All protocols — including HTTP — must be added via the "+ Add protocol" menu.
 * Idempotent — does nothing if the tab is already in the DOM.
 */
export async function ensureProtocolEnabled(
  ctx: DemoActionContext,
  protocol: ProtocolKey,
): Promise<void> {
  const tabSel = PROTOCOL_TAB[protocol];
  if (document.querySelector(tabSel)) return; // already enabled
  // Open the "+ Add protocol" dropdown
  await ctx.click(EM.ADD_PROTOCOL_BTN);
  await ctx.delay(400);
  // Select the target protocol from the menu
  const itemSel = emAddProtocolItemSel(protocol);
  await ctx.click(itemSel);
  // Wait for the tab to appear in the DOM (max ~2 s)
  for (let i = 0; i < 20; i++) {
    if (document.querySelector(tabSel)) break;
    await ctx.delay(100);
  }
  await ctx.delay(400);
}

/** Switch protocol tab inside the expanded microservice card. */
export async function selectProtocolTab(ctx: DemoActionContext, protocol: ProtocolKey): Promise<void> {
  await ctx.waitFor(EM.PROTOCOL_PANEL);
  await ctx.click(PROTOCOL_TAB[protocol]);
  await ctx.delay(600);
}

/** Inline-edit the first endpoint row in the active protocol panel. */
export async function editFirstProtocolEndpoint(ctx: DemoActionContext, url: string): Promise<void> {
  await ctx.waitFor(EM.PROTOCOL_PANEL);
  const editSel = panelScoped(EM.ENDPOINT_EDIT);
  await ctx.click(editSel);
  await ctx.waitFor(EM.ENDPOINT_EDIT_INPUT);
  await ctx.delay(600);
  await ctx.fill(EM.ENDPOINT_EDIT_INPUT, url);
  await ctx.delay(400);
  await ctx.click(EM.ENDPOINT_SAVE);
  await ctx.delay(700);
}

/** Set GraphQL endpoint base URL and optional default path on the first deployed row. */
export async function configureGraphqlEndpoint(
  ctx: DemoActionContext,
  baseUrl: string,
  path = '/graphql',
): Promise<void> {
  await selectProtocolTab(ctx, 'graphql');
  await editFirstProtocolEndpoint(ctx, baseUrl);
  const pathInput = document.querySelector<HTMLInputElement>(panelScoped(EM.GRAPHQL_PATH_INPUT));
  if (pathInput && pathInput.value.trim() !== path) {
    await ctx.fill(panelScoped(EM.GRAPHQL_PATH_INPUT), path);
    await ctx.delay(400);
  }
}

/**
 * Full flow: open Environment Manager, expand a microservice, optionally
 * deploy HTTP base URL, then set a protocol-specific endpoint.
 *
 * When `options.svcName` is provided, the named microservice is expanded
 * instead of the first one in the list. Combine with `ensureDemoMicroservice`
 * (called beforehand) to guarantee the named card exists.
 */
export async function configureProtocolEndpointInEnvManager(
  ctx: DemoActionContext,
  protocol: ProtocolKey,
  endpointUrl: string,
  options?: { httpFallbackBase?: string; graphqlPath?: string; svcName?: string },
): Promise<void> {
  await navigateToEnvironmentManager(ctx);
  // Give React a repaint tick after tab navigation so the spotlight
  // binds to the Environment Manager DOM, not the previous page.
  await ctx.delay(400);
  if (options?.svcName) {
    await expandNamedMicroservice(ctx, options.svcName);
  } else {
    await expandFirstMicroservice(ctx);
  }
  if (options?.httpFallbackBase) {
    await ensureFirstEnvDeployed(ctx, options.httpFallbackBase);
  }
  // Add the protocol tab if it hasn't been enabled yet (protocol-selection feature).
  await ensureProtocolEnabled(ctx, protocol);

  if (protocol === 'graphql') {
    await configureGraphqlEndpoint(ctx, endpointUrl, options?.graphqlPath ?? '/graphql');
    return;
  }
  await selectProtocolTab(ctx, protocol);
  await editFirstProtocolEndpoint(ctx, endpointUrl);
}

/**
 * Select a named environment in the app header dropdown.
 * Finds the <option> whose visible text matches `envName` and sets the select value.
 * No-op if the select or matching option is not found.
 */
export async function selectEnvInHeader(
  ctx: DemoActionContext,
  envName: string,
): Promise<void> {
  const select = document.querySelector<HTMLSelectElement>(APP.HEADER_ENV_SELECT);
  if (!select) return;
  const option = Array.from(select.options).find(o => o.text.trim() === envName);
  if (!option) return;
  await ctx.selectOption(APP.HEADER_ENV_SELECT, option.value);
  await ctx.delay(300);
}

/**
 * Select a named microservice in the app header dropdown.
 * Finds the <option> whose visible text matches `svcName` and sets the select value.
 * No-op if the select or matching option is not found.
 */
export async function selectSvcInHeader(
  ctx: DemoActionContext,
  svcName: string,
): Promise<void> {
  const select = document.querySelector<HTMLSelectElement>(APP.HEADER_SVC_SELECT);
  if (!select) return;
  const option = Array.from(select.options).find(o => o.text.trim() === svcName);
  if (!option) return;
  await ctx.selectOption(APP.HEADER_SVC_SELECT, option.value);
  await ctx.delay(300);
}

export async function navigateToWebSocketStudio(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector('[data-testid="ws-studio"]')) {
    ctx.navigateToTab('websocket-studio');
    await ctx.delay(400);
    await ctx.waitFor('[data-testid="ws-studio"]');
  }
}

export async function navigateToSseStudio(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector('[data-testid="sse-studio"]')) {
    ctx.navigateToTab('sse-studio');
    await ctx.delay(400);
    await ctx.waitFor('[data-testid="sse-studio"]');
  }
}

export async function navigateToGraphqlStudio(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector('[data-testid="gql-studio-page"]')) {
    ctx.navigateToTab('graphql-studio');
    await ctx.delay(400);
    await ctx.waitFor('[data-testid="gql-studio-page"]');
  }
}
