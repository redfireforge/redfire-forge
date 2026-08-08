/**
 * Shared helpers for Environment Manager demo steps (Phase 5).
 * Used by WebSocket, SSE, and GraphQL protocol lessons.
 */
import type { DemoActionContext } from '../types';
import { APP, EM, emAddProtocolItemSel, emRemoveProtocolSel } from '@shared/selectors';
import type { ProtocolKey } from '@shared/types';
import { isDemoTargetVisible } from '../demoSpotlightUtils';
import { showSpotlightRing } from '../demoRipple';
import { fillControlledInput } from './setup-helpers';
import { getDemoBridgeWindow } from '../adapters/bridgeWindow';

/** Shared SSE demo lesson identifiers and endpoint (basic + advanced lessons). */
export const SSE_DEMO_ENV_NAME = 'SSE Demo';
export const SSE_DEMO_SVC_NAME = 'sse-demo';
export const SSE_DEMO_BASE_URL = 'http://localhost:3001';

function isNamedHeaderOptionAvailable(selectSelector: string, name: string): boolean {
  const target = document.querySelector<HTMLElement>(selectSelector);
  if (!target) return false;

  if (target instanceof HTMLSelectElement) {
    return Array.from(target.options).some((option) => option.text.trim() === name);
  }

  // For CustomSelect we can only check if the option is already selected (label visible)
  const selectedLabel = target.querySelector<HTMLElement>('.cs-text')?.textContent?.trim();
  return selectedLabel === name;
}

async function selectNamedHeaderOption(
  ctx: DemoActionContext,
  selectSelector: string,
  label: string,
): Promise<void> {
  const target = document.querySelector<HTMLElement>(selectSelector);
  if (!target) return;

  if (target instanceof HTMLSelectElement) {
    const option = Array.from(target.options).find((entry) => entry.text.trim() === label);
    if (!option || target.value === option.value) return;
    await ctx.selectOption(selectSelector, option.value);
    await ctx.delay(120);
    return;
  }

  // CustomSelect — only confirm already selected; never open dropdown visually
  const selectedLabel = target.querySelector<HTMLElement>('.cs-text')?.textContent?.trim();
  if (selectedLabel === label) return;

  // Not selected — click trigger, pick option, dismiss quickly
  const trigger = target.querySelector<HTMLElement>('.cs-trigger');
  if (!trigger) return;
  trigger.click();
  await ctx.delay(50);

  const option = Array.from(document.querySelectorAll<HTMLElement>('.cs-menu .cs-item'))
    .find((entry) => entry.textContent?.trim().includes(label));
  if (option) {
    option.click();
  } else {
    // Option not found — dismiss immediately
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  }
  await ctx.delay(50);
}

/**
 * Live-demo paced header select — always opens the menu so viewers can follow
 * Environment / Service picks even when setup already selected the value quietly.
 */
async function selectNamedHeaderOptionVisible(
  ctx: DemoActionContext,
  selectSelector: string,
  label: string,
): Promise<void> {
  const target = document.querySelector<HTMLElement>(selectSelector);
  if (!target) return;

  if (target instanceof HTMLSelectElement) {
    const option = Array.from(target.options).find((entry) => entry.text.trim() === label);
    if (!option) return;
    await ctx.selectOption(selectSelector, option.value);
    await ctx.delay(800);
    return;
  }

  const triggerSel = `${selectSelector} .cs-trigger`;
  if (!document.querySelector(triggerSel)) return;

  // Open menu with ripple so the dropdown change is visible.
  await ctx.click(triggerSel);
  await ctx.waitFor('.cs-menu', 3000);
  await ctx.delay(1000);

  const option = Array.from(document.querySelectorAll<HTMLElement>('.cs-menu .cs-item'))
    .find((entry) => entry.textContent?.trim().includes(label));
  if (option) {
    option.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const dispose = showSpotlightRing(option, { steady: true });
    try {
      await ctx.delay(900);
      option.click();
    } finally {
      dispose();
    }
  } else {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  }
  // Hold on the closed control so the selected label can be read.
  await ctx.delay(1000);
}

/** Visible Environment dropdown pick for live demo actions (not quiet setup). */
export async function selectEnvInHeaderVisible(
  ctx: DemoActionContext,
  envName: string,
): Promise<void> {
  await selectNamedHeaderOptionVisible(ctx, APP.HEADER_ENV_SELECT, envName);
}

/** Visible Service dropdown pick for live demo actions (not quiet setup). */
export async function selectSvcInHeaderVisible(
  ctx: DemoActionContext,
  svcName: string,
): Promise<void> {
  await selectNamedHeaderOptionVisible(ctx, APP.HEADER_SVC_SELECT, svcName);
}

/**
 * Recreate the SSE Demo environment + sse-demo microservice with SSE endpoint configured.
 * Idempotent — safe when the basic SSE lesson already ran or data was cleaned up afterward.
 */
export async function ensureSseDemoEndpointConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEnvironment(ctx, SSE_DEMO_ENV_NAME);
  await ensureDemoMicroservice(ctx, SSE_DEMO_SVC_NAME);
  await navigateToEnvironmentManager(ctx);
  await ctx.delay(120);
  await expandNamedMicroservice(ctx, SSE_DEMO_SVC_NAME);
  await ensureProtocolDisabled(ctx, 'http');
  await ensureProtocolEnabled(ctx, 'sse');
  await undeployAllExceptNamedEnv(ctx, SSE_DEMO_ENV_NAME);
  await ensureNamedEnvDeployedOnProtocol(ctx, 'sse', SSE_DEMO_ENV_NAME, SSE_DEMO_BASE_URL);
}

/** True when the header CustomSelect/native select currently shows `label`. */
function isNamedHeaderOptionSelected(selectSelector: string, label: string): boolean {
  const target = document.querySelector<HTMLElement>(selectSelector);
  if (!target) return false;
  if (target instanceof HTMLSelectElement) {
    const selected = target.selectedOptions[0]?.text.trim();
    return selected === label;
  }
  return target.querySelector<HTMLElement>('.cs-text')?.textContent?.trim() === label;
}

/** Ensure demo env/svc exist and are selected in the app header so {{sseUrl}} resolves. */
export async function ensureSseDemoHeaderContext(ctx: DemoActionContext): Promise<void> {
  // Already correct — never open Environment/Service dropdowns for no reason.
  if (
    isNamedHeaderOptionSelected(APP.HEADER_ENV_SELECT, SSE_DEMO_ENV_NAME)
    && isNamedHeaderOptionSelected(APP.HEADER_SVC_SELECT, SSE_DEMO_SVC_NAME)
  ) {
    return;
  }

  // Prefer the demo bridge — creates env/svc + selects IDs with zero UI churn.
  // Do NOT follow up with CustomSelect open/click: React labels can lag a tick
  // and opening the menus is what viewers see as "flashing" header dropdowns.
  const w = getDemoBridgeWindow();
  if (w.__demoEnsureSettingsEnv && w.__demoEnsureSettingsSvc && w.__demoSelectEnvSvc) {
    const envId = w.__demoEnsureSettingsEnv(SSE_DEMO_ENV_NAME);
    const svcId = w.__demoEnsureSettingsSvc(SSE_DEMO_SVC_NAME, { [envId]: SSE_DEMO_BASE_URL });
    w.__demoSelectEnvSvc(envId, svcId);
    for (let i = 0; i < 16; i++) {
      if (
        isNamedHeaderOptionSelected(APP.HEADER_ENV_SELECT, SSE_DEMO_ENV_NAME)
        && isNamedHeaderOptionSelected(APP.HEADER_SVC_SELECT, SSE_DEMO_SVC_NAME)
      ) {
        return;
      }
      await ctx.delay(40);
    }
    // IDs are selected even if labels lag — opening menus would only flash.
    return;
  }

  // No bridge (unit tests / degraded shell): configure via EM if needed, then select once.
  const envReady = isNamedHeaderOptionAvailable(APP.HEADER_ENV_SELECT, SSE_DEMO_ENV_NAME);
  const svcReady = isNamedHeaderOptionAvailable(APP.HEADER_SVC_SELECT, SSE_DEMO_SVC_NAME);
  if (!envReady || !svcReady) {
    await ensureSseDemoEndpointConfigured(ctx);
  }
  await selectEnvInHeader(ctx, SSE_DEMO_ENV_NAME);
  await selectSvcInHeader(ctx, SSE_DEMO_SVC_NAME);
  document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await ctx.delay(80);
}

/** Shared GraphQL demo lesson identifiers and endpoint (GQL-1+ lessons). */
export const GQL_DEMO_ENV_NAME = 'GraphQL Demo';
export const GQL_DEMO_SVC_NAME = 'graphql-demo';
/** Active-environment name in GraphQL Studio's env modal (distinct from EM "GraphQL Demo"). */
export const GQL_STUDIO_DEMO_ENV_NAME = 'Demo';
export const GQL_DEMO_BASE_URL = 'http://localhost:4010';
export const GQL_DEMO_GRAPHQL_PATH = '/graphql';

/** Shared WebSocket demo lesson identifiers and endpoint (basics + workspace lessons). */
export const WS_DEMO_ENV_NAME = 'WebSocket Demo';
export const WS_DEMO_SVC_NAME = 'ws-demo';
export const WS_DEMO_BASE_URL = 'ws://localhost:9876';

/**
 * Prepare ws-demo for the WebSocket demo lessons: WebSocket protocol only, WebSocket Demo row deployed.
 * Does not set the endpoint URL — use before the "Configure endpoint" demo step.
 */
export async function ensureWsDemoProtocolReady(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEnvironment(ctx, WS_DEMO_ENV_NAME);
  await ensureDemoMicroservice(ctx, WS_DEMO_SVC_NAME);
  await navigateToEnvironmentManager(ctx);
  await ctx.delay(120);
  await expandNamedMicroservice(ctx, WS_DEMO_SVC_NAME);
  await ensureProtocolDisabled(ctx, 'http');
  await ensureProtocolEnabled(ctx, 'websocket');
  await undeployAllExceptNamedEnv(ctx, WS_DEMO_ENV_NAME);
  await ensureNamedEnvDeployedOnProtocol(ctx, 'websocket', WS_DEMO_ENV_NAME);
  await selectProtocolTab(ctx, 'websocket');
}

/**
 * Recreate the WebSocket Demo environment + ws-demo microservice with WebSocket endpoint configured.
 * WebSocket-only — does not add an HTTP protocol tab.
 *
 * @param baseUrl The endpoint URL to save. Defaults to `WS_DEMO_BASE_URL` (`ws://localhost:9876`),
 * but callers should pass the tab's *actual* assigned mock port (e.g. via `getLastMockPort()` from
 * `setup-helpers` or a lesson-local `captureMockPort()`) since a tab is not guaranteed to be on 9876
 * — `closeExtraConnectionTabs()` reduces the tab count to 1 but does not renumber the surviving tab's
 * already-assigned port.
 */
export async function ensureWsDemoEndpointConfigured(
  ctx: DemoActionContext,
  baseUrl: string = WS_DEMO_BASE_URL,
): Promise<void> {
  await ensureWsDemoProtocolReady(ctx);
  await editNamedProtocolEndpoint(ctx, WS_DEMO_ENV_NAME, baseUrl);
}

/** Ensure demo env/svc exist and are selected in the app header so {{wsBaseUrl}} resolves.
 * See `ensureWsDemoEndpointConfigured` for why `baseUrl` should reflect the tab's real mock port. */
export async function ensureWsDemoHeaderContext(
  ctx: DemoActionContext,
  baseUrl: string = WS_DEMO_BASE_URL,
): Promise<void> {
  const envReady = isNamedHeaderOptionAvailable(APP.HEADER_ENV_SELECT, WS_DEMO_ENV_NAME);
  const svcReady = isNamedHeaderOptionAvailable(APP.HEADER_SVC_SELECT, WS_DEMO_SVC_NAME);
  if (!envReady || !svcReady) {
    await ensureWsDemoEndpointConfigured(ctx, baseUrl);
  }
  await selectEnvInHeader(ctx, WS_DEMO_ENV_NAME);
  await selectSvcInHeader(ctx, WS_DEMO_SVC_NAME);
}

/**
 * Prepare graphql-demo for GraphQL demo lessons: GraphQL protocol only, GraphQL Demo row deployed.
 * Does not set the endpoint URL — use before the "Configure endpoint" demo step.
 */
export async function ensureGqlDemoProtocolReady(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEnvironment(ctx, GQL_DEMO_ENV_NAME);
  await ensureDemoMicroservice(ctx, GQL_DEMO_SVC_NAME);
  await navigateToEnvironmentManager(ctx);
  await ctx.delay(120);
  await expandNamedMicroservice(ctx, GQL_DEMO_SVC_NAME);
  await ensureProtocolDisabled(ctx, 'http');
  await ensureProtocolEnabled(ctx, 'graphql');
  await undeployAllExceptNamedEnv(ctx, GQL_DEMO_ENV_NAME);
  await ensureNamedEnvDeployedOnProtocol(ctx, 'graphql', GQL_DEMO_ENV_NAME);
  await selectProtocolTab(ctx, 'graphql');
}

/** Set GraphQL base URL and default path on a named environment row. */
export async function configureNamedGraphqlEndpoint(
  ctx: DemoActionContext,
  envName: string,
  baseUrl: string,
  path = '/graphql',
): Promise<void> {
  await selectProtocolTab(ctx, 'graphql');
  await editNamedProtocolEndpoint(ctx, envName, baseUrl);
  const pathInput = document.querySelector<HTMLInputElement>(panelScoped(EM.GRAPHQL_PATH_INPUT));
  if (pathInput && pathInput.value.trim() !== path) {
    await ctx.fill(panelScoped(EM.GRAPHQL_PATH_INPUT), path);
    await ctx.delay(400);
  }
}

/**
 * Recreate the GraphQL Demo environment + graphql-demo microservice with GraphQL endpoint configured.
 * GraphQL-only — does not add an HTTP protocol tab.
 */
export async function ensureGqlDemoEndpointConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureGqlDemoProtocolReady(ctx);
  await configureNamedGraphqlEndpoint(
    ctx,
    GQL_DEMO_ENV_NAME,
    GQL_DEMO_BASE_URL,
    GQL_DEMO_GRAPHQL_PATH,
  );
}

/**
 * Ensure demo env/svc exist and are selected in the app header so {{graphqlUrl}} resolves.
 * Prefer the settings bridge (zero UI churn). Never open Environment Manager when the bridge works.
 */
export async function ensureGqlDemoHeaderContext(ctx: DemoActionContext): Promise<void> {
  if (
    isNamedHeaderOptionSelected(APP.HEADER_ENV_SELECT, GQL_DEMO_ENV_NAME)
    && isNamedHeaderOptionSelected(APP.HEADER_SVC_SELECT, GQL_DEMO_SVC_NAME)
  ) {
    await navigateToGraphqlStudio(ctx);
    return;
  }

  // Prefer the demo bridge — creates env/svc + selects IDs without opening EM or header menus.
  // httpBase falls back for graphqlUrl when no GraphQL protocol row exists yet.
  const w = getDemoBridgeWindow();
  if (w.__demoEnsureSettingsEnv && w.__demoEnsureSettingsSvc && w.__demoSelectEnvSvc) {
    const envId = w.__demoEnsureSettingsEnv(GQL_DEMO_ENV_NAME);
    const svcId = w.__demoEnsureSettingsSvc(GQL_DEMO_SVC_NAME, { [envId]: GQL_DEMO_BASE_URL });
    w.__demoSelectEnvSvc(envId, svcId);
    for (let i = 0; i < 16; i++) {
      if (
        isNamedHeaderOptionSelected(APP.HEADER_ENV_SELECT, GQL_DEMO_ENV_NAME)
        && isNamedHeaderOptionSelected(APP.HEADER_SVC_SELECT, GQL_DEMO_SVC_NAME)
      ) {
        break;
      }
      await ctx.delay(40);
    }
    await navigateToGraphqlStudio(ctx);
    return;
  }

  // No bridge (unit tests / degraded shell): configure via EM if needed, then select once.
  const envReady = isNamedHeaderOptionAvailable(APP.HEADER_ENV_SELECT, GQL_DEMO_ENV_NAME);
  const svcReady = isNamedHeaderOptionAvailable(APP.HEADER_SVC_SELECT, GQL_DEMO_SVC_NAME);
  if (!envReady || !svcReady) {
    await ensureGqlDemoEndpointConfigured(ctx);
  }
  await selectEnvInHeader(ctx, GQL_DEMO_ENV_NAME);
  await selectSvcInHeader(ctx, GQL_DEMO_SVC_NAME);
  await navigateToGraphqlStudio(ctx);
}

/** Shared gRPC demo lesson identifiers and endpoints (env-collections + related lessons). */
export const GRPC_DEMO_ENV_NAME = 'gRPC Demo';
export const GRPC_DEMO_SVC_NAME = 'grpc-demo';
export const GRPC_DEMO_STAGING_ENV_NAME = 'gRPC Staging';
export const GRPC_DEMO_LOCAL_HOST = 'localhost:50051';
export const GRPC_DEMO_STAGING_HOST = 'localhost:59999';

/**
 * Prepare grpc-demo for gRPC demo lessons: gRPC protocol only, gRPC Demo row deployed.
 * Does not set the endpoint URL — use before the "Configure endpoint" demo step.
 */
export async function ensureGrpcDemoProtocolReady(ctx: DemoActionContext): Promise<void> {
  await ensureDemoEnvironment(ctx, GRPC_DEMO_ENV_NAME);
  await ensureDemoMicroservice(ctx, GRPC_DEMO_SVC_NAME);
  await navigateToEnvironmentManager(ctx);
  await ctx.delay(120);
  await expandNamedMicroservice(ctx, GRPC_DEMO_SVC_NAME);
  await ensureProtocolDisabled(ctx, 'http');
  await ensureProtocolEnabled(ctx, 'grpc');
  await undeployAllExceptNamedEnv(ctx, GRPC_DEMO_ENV_NAME);
  await ensureNamedEnvDeployedOnProtocol(ctx, 'grpc', GRPC_DEMO_ENV_NAME);
  await selectProtocolTab(ctx, 'grpc');
}

/**
 * Recreate the gRPC Demo environment + grpc-demo microservice with gRPC endpoint configured.
 * gRPC-only — does not add an HTTP protocol tab.
 */
export async function ensureGrpcDemoEndpointConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcDemoProtocolReady(ctx);
  await editNamedProtocolEndpoint(ctx, GRPC_DEMO_ENV_NAME, GRPC_DEMO_LOCAL_HOST);
}

/**
 * Add and configure a staging environment on the grpc-demo microservice with a distinct host.
 * Idempotent — only adds the env and deploys it if not already present.
 */
export async function ensureGrpcStagingEnvConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcDemoEndpointConfigured(ctx);
  await ensureDemoEnvironment(ctx, GRPC_DEMO_STAGING_ENV_NAME);
  await ensureNamedEnvDeployedOnProtocol(ctx, 'grpc', GRPC_DEMO_STAGING_ENV_NAME, GRPC_DEMO_STAGING_HOST);
}

/**
 * Add or update a protocol (global) variable via the Protocol Vars modal.
 * Opens the modal if not already open, adds/updates the key, then saves.
 * To avoid opening/closing the modal for each key, call openProtocolVarsModal
 * manually and use this helper only once; it will save after each call.
 */
export async function setProtocolVarInModal(
  ctx: DemoActionContext,
  key: string,
  value: string,
): Promise<void> {
  // Open modal if not already visible.
  const modalOpen = !!document.querySelector('[data-testid="protocol-vars-modal"]');
  if (!modalOpen) {
    await ctx.click('[data-testid="protocol-vars-badge"]');
    await ctx.delay(200);
  }
  // If the row already exists, update its value inline then save.
  const existingRow = document.querySelector(`[data-testid="protocol-var-row-${key}"]`);
  if (existingRow) {
    const valueInput = document.querySelector<HTMLInputElement>(`[data-testid="protocol-var-value-${key}"]`);
    if (valueInput && valueInput.value !== value) {
      await ctx.fill(`[data-testid="protocol-var-value-${key}"]`, value);
      await ctx.delay(150);
    }
    await ctx.click('[data-testid="protocol-vars-save-btn"]');
    await ctx.delay(250);
    return;
  }
  // Add a new row, then save.
  await ctx.fill('[data-testid="protocol-vars-key-input"]', key);
  await ctx.fill('[data-testid="protocol-vars-val-input"]', value);
  await ctx.click('[data-testid="protocol-vars-add-btn"]');
  await ctx.delay(150);
  await ctx.click('[data-testid="protocol-vars-save-btn"]');
  await ctx.delay(250);
}

/**
 * Add or update an environment-scoped variable via the Env Vars modal.
 * Opens the modal for the given envId if not already open, adds/updates the key, then saves.
 */
export async function setEnvVarInModal(
  ctx: DemoActionContext,
  envId: string,
  key: string,
  value: string,
): Promise<void> {
  // Open modal if not already visible.
  const modalOpen = !!document.querySelector('[data-testid="env-vars-modal"]');
  if (!modalOpen) {
    await ctx.click(`[data-testid="env-vars-badge-${envId}"]`);
    await ctx.delay(200);
  }
  // If the row already exists, update its value inline.
  const existingRow = document.querySelector(`[data-testid="env-var-row-${key}"]`);
  if (existingRow) {
    const valueInput = document.querySelector<HTMLInputElement>(`[data-testid="env-var-value-${key}"]`);
    if (valueInput && valueInput.value !== value) {
      await ctx.fill(`[data-testid="env-var-value-${key}"]`, value);
      await ctx.delay(200);
    }
    await ctx.click('[data-testid="env-vars-save-btn"]');
    await ctx.delay(200);
    return;
  }
  // Add a new row.
  await ctx.fill('[data-testid="env-vars-key-input"]', key);
  await ctx.fill('[data-testid="env-vars-val-input"]', value);
  await ctx.click('[data-testid="env-vars-add-btn"]');
  await ctx.delay(200);
  await ctx.click('[data-testid="env-vars-save-btn"]');
  await ctx.delay(200);
}

/** Ensure demo env/svc exist and are selected in the app header so {{grpcHost}} resolves. */
export async function ensureGrpcDemoHeaderContext(ctx: DemoActionContext): Promise<void> {
  const envReady = isNamedHeaderOptionAvailable(APP.HEADER_ENV_SELECT, GRPC_DEMO_ENV_NAME);
  const svcReady = isNamedHeaderOptionAvailable(APP.HEADER_SVC_SELECT, GRPC_DEMO_SVC_NAME);
  if (!envReady || !svcReady) {
    await ensureGrpcDemoEndpointConfigured(ctx);
  }
  await selectEnvInHeader(ctx, GRPC_DEMO_ENV_NAME);
  await selectSvcInHeader(ctx, GRPC_DEMO_SVC_NAME);
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
  await ctx.delay(120);
  // Handle up to two-stage confirm dialog (warning → continue → delete permanently).
  for (let i = 0; i < 2; i++) {
    const dialogBtn = document.querySelector<HTMLElement>('.confirm-dialog .btn-danger');
    if (!dialogBtn) break;
    dialogBtn.click();
    await ctx.delay(120);
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
  // Prefer the settings bridge — zero tab navigation / EM UI churn.
  // Exit → Contents must not flash Environments while teardown runs.
  const w = getDemoBridgeWindow();
  if (typeof w.__demoRemoveSettingsSvc === 'function') {
    w.__demoRemoveSettingsSvc(name);
    return;
  }

  await navigateToEnvironmentManager(ctx);
  const svcCard = document.querySelector<HTMLElement>(`[data-svc-name="${name}"]`);
  if (!svcCard) return;
  // Collapse any open panel first so the Delete button is accessible.
  const collapseBtn = svcCard.querySelector<HTMLElement>('[data-testid^="em-svc-configure-"]');
  if (collapseBtn?.textContent?.includes('Collapse')) {
    collapseBtn.click();
    await ctx.delay(120);
  }
  await clickDeleteAndConfirm(ctx, `[data-svc-name="${name}"] .btn-danger`);
  await ctx.delay(120);
}

/**
 * Delete a named environment chip from the Environment Manager.
 * No-op if the environment chip is not found.
 */
export async function cleanupDemoEnvironment(
  ctx: DemoActionContext,
  name: string,
): Promise<void> {
  // Prefer the settings bridge — same reason as cleanupDemoMicroservice.
  const w = getDemoBridgeWindow();
  if (typeof w.__demoRemoveSettingsEnv === 'function') {
    w.__demoRemoveSettingsEnv(name);
    return;
  }

  await navigateToEnvironmentManager(ctx);
  const chip = document.querySelector<HTMLElement>(`[data-env-name="${name}"]`);
  if (!chip) return;
  await clickDeleteAndConfirm(ctx, `[data-env-name="${name}"] .settings-chip-delete`);
  await ctx.delay(120);
}

/**
 * Remove GraphQL demo environments after any GraphQL Studio lesson ends:
 * - Studio env modal "Demo" (authToken / {{vars}} from GQL-4+)
 * - Environment Manager "GraphQL Demo" + graphql-demo microservice (GQL-1+)
 *
 * Uses storage + App-level bridge so cleanup works when GraphQL Studio / EM are unmounted.
 */
export async function cleanupGqlDemoLessonEnvironment(_ctx: DemoActionContext): Promise<void> {
  const w = window as unknown as Record<string, unknown>;
  const purgeBridge = w.__demoPurgeGqlLessonEnvironments as (() => Promise<void>) | undefined;
  if (purgeBridge) {
    await purgeBridge();
    return;
  }

  const { purgeGqlDemoLessonEnvironmentsFromStorage } = await import('./gql-demo-app-environment-cleanup');
  await purgeGqlDemoLessonEnvironmentsFromStorage();
  const { deleteGqlEnvironmentByName } = await import('../adapters');
  deleteGqlEnvironmentByName(GQL_STUDIO_DEMO_ENV_NAME);
}

// ── Demo-dedicated env / microservice creation ─────────────────────────────

async function waitForEnabledButton(
  ctx: DemoActionContext,
  selector: string,
  timeoutMs = 3000,
): Promise<HTMLButtonElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const btn = document.querySelector<HTMLButtonElement>(selector);
    if (btn && !btn.disabled) return btn;
    await ctx.delay(100);
  }
  return null;
}

/** Fill an EM add-row input and click Add once the button is enabled. */
async function submitEmAddRow(
  ctx: DemoActionContext,
  inputSelector: string,
  addButtonSelector: string,
  name: string,
): Promise<void> {
  await ctx.waitFor(inputSelector);
  await ctx.delay(100);
  const input = document.querySelector<HTMLInputElement>(inputSelector);
  if (!input) return;
  fillControlledInput(input, name);
  await ctx.delay(100);
  let addBtn = await waitForEnabledButton(ctx, addButtonSelector);
  if (!addBtn) {
    fillControlledInput(input, name);
    await ctx.delay(100);
    addBtn = await waitForEnabledButton(ctx, addButtonSelector);
  }
  addBtn?.click();
  await ctx.delay(120);
}

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
  await submitEmAddRow(ctx, EM.ADD_ENV_INPUT, EM.ADD_ENV_BTN, name);
  // Wait for the chip to appear in the DOM.
  for (let i = 0; i < 30; i++) {
    if (document.querySelector(`[data-env-name="${name}"]`)) break;
    await ctx.delay(100);
  }
  await ctx.delay(120);
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
  await submitEmAddRow(ctx, EM.ADD_SVC_INPUT, EM.ADD_SVC_BTN, name);
  for (let i = 0; i < 30; i++) {
    if (document.querySelector(`[data-svc-name="${name}"]`)) break;
    await ctx.delay(100);
  }
  await ctx.delay(120);
}

/** Collapse whichever microservice card currently has the protocol panel open. */
export async function collapseExpandedMicroservice(ctx: DemoActionContext): Promise<void> {
  const panel = document.querySelector(EM.PROTOCOL_PANEL);
  if (!panel) return;
  const expandedCard = panel.closest<HTMLElement>('[data-svc-name]');
  if (!expandedCard) return;
  const collapseBtn = expandedCard.querySelector<HTMLElement>('[data-testid^="em-svc-configure-"]');
  if (collapseBtn?.textContent?.includes('Collapse')) {
    collapseBtn.click();
    await ctx.delay(400);
  }
}

/**
 * Expand the Configure panel for a specific named microservice.
 * Collapses a different expanded card first so stale HTTP/WS state on another
 * service does not block the demo from configuring ws-demo.
 */
export async function expandNamedMicroservice(
  ctx: DemoActionContext,
  name: string,
): Promise<void> {
  await navigateToEnvironmentManager(ctx);
  const svcCard = document.querySelector<HTMLElement>(`[data-svc-name="${name}"]`);
  if (!svcCard) {
    await expandFirstMicroservice(ctx);
    return;
  }
  const panel = document.querySelector(EM.PROTOCOL_PANEL);
  if (panel && !svcCard.contains(panel)) {
    await collapseExpandedMicroservice(ctx);
  }
  if (svcCard.contains(document.querySelector(EM.PROTOCOL_PANEL)!)) return;
  const configBtn = svcCard.querySelector<HTMLElement>('[data-testid^="em-svc-configure-"]');
  if (configBtn) {
    configBtn.click();
    await ctx.waitFor(EM.PROTOCOL_PANEL);
    await ctx.delay(150);
    return;
  }
  await expandFirstMicroservice(ctx);
}

const PROTOCOL_TAB: Record<ProtocolKey, string> = {
  http: EM.PROTOCOL_TAB_HTTP,
  websocket: EM.PROTOCOL_TAB_WS,
  sse: EM.PROTOCOL_TAB_SSE,
  graphql: EM.PROTOCOL_TAB_GQL,
  grpc: EM.PROTOCOL_TAB_GRPC,
};

import { firstVisibleSelector } from '../utils/domVisibility';

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
  if (!isDemoTargetVisible(EM.MANAGER)) {
    ctx.navigateToTab('environments');
    await ctx.delay(120);
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
  await ctx.delay(150);
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
    await ctx.delay(120);
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
    await ctx.delay(120);
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
  await ctx.delay(220);
  await ctx.fill(EM.ENDPOINT_EDIT_INPUT, url);
  await ctx.delay(180);
  await ctx.click(EM.ENDPOINT_SAVE);
  await ctx.delay(220);
}

/** Ensure at least one environment is deployed on the HTTP tab with a base URL. */
export async function ensureFirstEnvDeployed(
  ctx: DemoActionContext,
  httpBaseUrl: string,
): Promise<void> {
  await ensureFirstEnvDeployedOnProtocol(ctx, 'http', httpBaseUrl);
}

/**
 * Remove a protocol tab if it is present (e.g. stale HTTP from an older demo run).
 * Idempotent — no-op when the remove button is absent.
 */
export async function ensureProtocolDisabled(
  ctx: DemoActionContext,
  protocol: ProtocolKey,
): Promise<void> {
  const tabSel = PROTOCOL_TAB[protocol];
  const tab = document.querySelector<HTMLElement>(tabSel);
  if (!tab) return;
  // Remove × is `display:none` until the tab wrap is hovered or active — activate
  // first so the control is in the layout tree and clicks stick.
  if (tab.getAttribute('aria-selected') !== 'true') {
    tab.click();
    await ctx.delay(80);
  }
  const removeSel = emRemoveProtocolSel(protocol);
  const removeBtn = document.querySelector<HTMLElement>(removeSel);
  if (!removeBtn) return;
  // Use a plain DOM click (not ctx.click) so no viewer ripple/highlight fires.
  // This helper only ever runs in setup / preAction to normalize the starting
  // protocol tab set — a lesson that disables several protocols during boot
  // (e.g. env-collections removes http/ws/sse/graphql/grpc) would otherwise flash
  // a burst of "quick unnecessary highlights" before step 1's narration begins.
  removeBtn.click();
  await ctx.delay(120);
  for (let i = 0; i < 20; i++) {
    if (!document.querySelector(tabSel)) break;
    await ctx.delay(100);
  }
  await ctx.delay(120);
}

/** Uncheck deploy on every env row except the named one inside the open protocol panel. */
export async function undeployAllExceptNamedEnv(ctx: DemoActionContext, keepEnvName: string): Promise<void> {
  const panel = document.querySelector(EM.PROTOCOL_PANEL);
  if (!panel) return;
  for (const checkbox of Array.from(
    panel.querySelectorAll<HTMLInputElement>('input[type="checkbox"][aria-label^="Deploy "]'),
  )) {
    const label = checkbox.getAttribute('aria-label') ?? '';
    const envName = label.replace(/^Deploy /, '');
    if (envName === keepEnvName || !checkbox.checked) continue;
    checkbox.click();
    await ctx.delay(200);
  }
  await ctx.delay(300);
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
  await ctx.delay(200);
  // Scroll the target item into view and spotlight it so viewers can read the selection
  const itemSel = emAddProtocolItemSel(protocol);
  const item = document.querySelector<HTMLElement>(itemSel);
  item?.scrollIntoView({ block: 'nearest' });
  await ctx.delay(100);
  if (item) {
    const dispose = showSpotlightRing(item);
    await ctx.delay(1600);
    dispose();
  } else {
    await ctx.delay(1600);
  }
  await ctx.click(itemSel);
  // Wait for the tab to appear in the DOM (max ~2 s)
  for (let i = 0; i < 20; i++) {
    if (document.querySelector(tabSel)) break;
    await ctx.delay(100);
  }
  // Spotlight the newly-added protocol tab so viewers can see it appeared
  const tab = document.querySelector<HTMLElement>(tabSel);
  if (tab) {
    tab.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const dispose = showSpotlightRing(tab);
    await ctx.delay(1600);
    dispose();
  } else {
    await ctx.delay(300);
  }
}

/** Switch protocol tab inside the expanded microservice card. */
export async function selectProtocolTab(ctx: DemoActionContext, protocol: ProtocolKey): Promise<void> {
  await ctx.waitFor(EM.PROTOCOL_PANEL);
  await ctx.click(PROTOCOL_TAB[protocol]);
  await ctx.delay(150);
}

/** Inline-edit the first endpoint row in the active protocol panel. */
export async function editFirstProtocolEndpoint(ctx: DemoActionContext, url: string): Promise<void> {
  await ctx.waitFor(EM.PROTOCOL_PANEL);
  const editSel = panelScoped(EM.ENDPOINT_EDIT);
  await ctx.click(editSel);
  await ctx.waitFor(EM.ENDPOINT_EDIT_INPUT);
  await ctx.delay(220);
  await ctx.fill(EM.ENDPOINT_EDIT_INPUT, url);
  await ctx.delay(180);
  await ctx.click(EM.ENDPOINT_SAVE);
  await ctx.delay(220);
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
  await ctx.delay(120);
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
  await selectNamedHeaderOption(ctx, APP.HEADER_ENV_SELECT, envName);
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
  await selectNamedHeaderOption(ctx, APP.HEADER_SVC_SELECT, svcName);
}

export async function navigateToWebSocketStudio(ctx: DemoActionContext): Promise<void> {
  if (!isDemoTargetVisible('[data-testid="ws-studio"]')) {
    ctx.navigateToTab('websocket-studio');
    await ctx.delay(120);
    await ctx.waitFor('[data-testid="ws-studio"]');
  }
}

export async function navigateToSseStudio(ctx: DemoActionContext): Promise<void> {
  if (!isDemoTargetVisible('[data-testid="sse-studio"]')) {
    ctx.navigateToTab('sse-studio');
    await ctx.delay(120);
    await ctx.waitFor('[data-testid="sse-studio"]');
  }
}

export async function navigateToGraphqlStudio(ctx: DemoActionContext): Promise<void> {
  if (!isDemoTargetVisible('[data-testid="gql-studio-page"]')) {
    ctx.navigateToTab('graphql-studio');
    await ctx.delay(120);
    await ctx.waitFor('[data-testid="gql-studio-page"]');
  }
}

export async function navigateToGrpcStudio(ctx: DemoActionContext): Promise<void> {
  if (!isDemoTargetVisible('[data-testid="grpc-studio-page"]')) {
    ctx.navigateToTab('grpc-studio');
    await ctx.delay(120);
    await ctx.waitFor('[data-testid="grpc-studio-page"]');
  }
}
