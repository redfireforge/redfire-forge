import { GRPC } from '@shared/selectors';
import { isTauri } from '@shared/utils/platform';
import {
  ensureGrpcRequestFormTabQuiet,
  ensureGrpcStudioSubNavQuiet,
  spotlightAndPause,
  spotlightRequestJsonContentTight,
} from './grpc-lesson-helpers';
import type { DemoActionContext } from '../../types';

export const grpcTauriDesktopSession = {
  transportSwitched: false,
  firstCallDone: false,
  inDiagnostics: false,
  mockRuleAdded: false,
  mockRunning: false,
  listenerEnabled: false,
  authConfigured: false,
};

export function resetGrpcTauriDesktopSession(): void {
  grpcTauriDesktopSession.transportSwitched = false;
  grpcTauriDesktopSession.firstCallDone = false;
  grpcTauriDesktopSession.inDiagnostics = false;
  grpcTauriDesktopSession.mockRuleAdded = false;
  grpcTauriDesktopSession.mockRunning = false;
  grpcTauriDesktopSession.listenerEnabled = false;
  grpcTauriDesktopSession.authConfigured = false;
}

export async function navigateToAdvancedQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureGrpcStudioSubNavQuiet(ctx);
  const advBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
  if (advBtn && advBtn.getAttribute('aria-selected') !== 'true') {
    advBtn.click();
    await ctx.delay(400);
  }
}

const GRPC_ECHO_SERVICE_FQN = 'echo.EchoService';
const GRPC_ECHO_SERVICE_SEL_LOCAL = GRPC.SERVICE(GRPC_ECHO_SERVICE_FQN);
const GRPC_ECHO_METHOD_SEL_LOCAL = GRPC.METHOD(GRPC_ECHO_SERVICE_FQN, 'Echo');

function isGrpcEchoComposerReady(): boolean {
  return Boolean(document.querySelector(GRPC.REQUEST_FORM_SCROLL));
}

export async function reflectAndSelectEchoAtCurrentTarget(ctx: DemoActionContext): Promise<void> {
  if (isGrpcEchoComposerReady()) {
    await ensureGrpcRequestFormTabQuiet(ctx);
    return;
  }
  const hasReflectionData = () =>
    Boolean(document.querySelector(GRPC.EXPLORER_TREE) || document.querySelector(GRPC.EXPLORER_SOURCE));
  if (!hasReflectionData()) {
    const reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
    if (reflectBtn && !reflectBtn.disabled) {
      await ctx.click(GRPC.REFLECT_BTN);
    }
    try {
      await ctx.waitFor(`${GRPC.EXPLORER_TREE}, ${GRPC.EXPLORER_SOURCE}`, 12_000);
    } catch {
      // Best effort only.
    }
  }
  let methodBtn = document.querySelector<HTMLElement>(GRPC_ECHO_METHOD_SEL_LOCAL);
  if (!methodBtn) {
    const serviceBtn = document.querySelector<HTMLElement>(GRPC_ECHO_SERVICE_SEL_LOCAL);
    if (serviceBtn) {
      await ctx.click(GRPC_ECHO_SERVICE_SEL_LOCAL);
      await ctx.delay(400);
    }
  }
  try {
    await ctx.waitFor(GRPC_ECHO_METHOD_SEL_LOCAL, 10_000);
    methodBtn = document.querySelector<HTMLElement>(GRPC_ECHO_METHOD_SEL_LOCAL);
    if (methodBtn) {
      await ctx.click(GRPC_ECHO_METHOD_SEL_LOCAL);
      await ctx.waitFor(GRPC.REQUEST_FORM_SCROLL, 10_000);
    }
  } catch {
    // Best effort only.
  }
  await ensureGrpcRequestFormTabQuiet(ctx);
}

export async function openNativeDiagnosticsQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToAdvancedQuiet(ctx);
  const diagTab = document.querySelector<HTMLElement>(GRPC.ADVANCED_TAB('native_diagnostics'));
  if (diagTab && diagTab.getAttribute('aria-selected') !== 'true') {
    diagTab.click();
    await ctx.delay(400);
  }
}

export async function openMockBuilderQuiet(ctx: DemoActionContext): Promise<void> {
  await navigateToAdvancedQuiet(ctx);
  const mockTab = document.querySelector<HTMLElement>(GRPC.ADVANCED_TAB('mock_server'));
  if (mockTab && mockTab.getAttribute('aria-selected') !== 'true') {
    mockTab.click();
    await ctx.delay(400);
  }
  const builderTab = document.querySelector<HTMLElement>(GRPC.MOCK_TAB_BUILDER);
  if (builderTab && builderTab.getAttribute('aria-selected') !== 'true') {
    builderTab.click();
    await ctx.delay(300);
  }
}

export async function openMockRuntimeTabQuiet(ctx: DemoActionContext): Promise<void> {
  const runtimeTab = document.querySelector<HTMLElement>(GRPC.MOCK_TAB_RUNTIME);
  if (runtimeTab && runtimeTab.getAttribute('aria-selected') !== 'true') {
    runtimeTab.click();
    await ctx.delay(400);
  }
}

export async function clearMockRulesQuiet(ctx: DemoActionContext): Promise<void> {
  if (!isTauri()) return;
  await openMockBuilderQuiet(ctx);
  const jsonTab = document.querySelector<HTMLElement>(GRPC.MOCK_TAB_JSON);
  if (jsonTab && jsonTab.getAttribute('aria-selected') !== 'true') {
    jsonTab.click();
    await ctx.delay(200);
  }
  const jsonInput = document.querySelector<HTMLTextAreaElement>(GRPC.MOCK_RULES_JSON);
  if (jsonInput) {
    jsonInput.value = JSON.stringify({ version: 1, rules: [] }, null, 2);
    jsonInput.dispatchEvent(new Event('input', { bubbles: true }));
    await ctx.delay(250);
  }
  const builderTab = document.querySelector<HTMLElement>(GRPC.MOCK_TAB_BUILDER);
  if (builderTab && builderTab.getAttribute('aria-selected') !== 'true') {
    builderTab.click();
    await ctx.delay(200);
  }
  grpcTauriDesktopSession.mockRuleAdded = false;
}

export async function switchToTauriNativeQuiet(ctx: DemoActionContext): Promise<void> {
  if (!isTauri()) return;
  const settingsBtn = document.querySelector<HTMLElement>(GRPC.CONNECTION_SETTINGS_BTN);
  if (!settingsBtn) return;
  settingsBtn.click();
  await ctx.delay(500);
  const transportNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('transport'));
  if (transportNav) {
    transportNav.click();
    await ctx.delay(300);
  }
  const tauriCard = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE('tauri'));
  if (tauriCard && !tauriCard.disabled) {
    tauriCard.click();
    await ctx.delay(300);
  }
  const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
  if (closeBtn) {
    closeBtn.click();
    await ctx.delay(400);
  }
  grpcTauriDesktopSession.transportSwitched = true;
}

export async function resetTransportToExpressQuiet(ctx: DemoActionContext): Promise<void> {
  if (!isTauri()) return;
  const settingsBtn = document.querySelector<HTMLElement>(GRPC.CONNECTION_SETTINGS_BTN);
  if (!settingsBtn) return;
  settingsBtn.click();
  await ctx.delay(400);
  const transportNav = document.querySelector<HTMLElement>(GRPC.SETTINGS_NAV_ITEM('transport'));
  if (transportNav) {
    transportNav.click();
    await ctx.delay(300);
  }
  const expressCard = document.querySelector<HTMLButtonElement>(GRPC.TRANSPORT_MODE('express'));
  if (expressCard && !expressCard.disabled) {
    expressCard.click();
    await ctx.delay(300);
  }
  const closeBtn = document.querySelector<HTMLElement>(GRPC.SETTINGS_CLOSE);
  if (closeBtn) {
    closeBtn.click();
    await ctx.delay(400);
  }
  grpcTauriDesktopSession.transportSwitched = false;
}

export async function stopMockRuntimeQuiet(ctx: DemoActionContext): Promise<void> {
  if (!isTauri()) return;
  const stopBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_STOP);
  if (stopBtn && !stopBtn.disabled) {
    stopBtn.click();
    await ctx.delay(500);
  }
  grpcTauriDesktopSession.mockRunning = false;
  grpcTauriDesktopSession.listenerEnabled = false;
}

export async function ensureMockRuntimeStoppedQuiet(ctx: DemoActionContext): Promise<void> {
  if (!isTauri()) return;
  await openMockRuntimeTabQuiet(ctx);
  await stopMockRuntimeQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
}

export function readMockListenTargetValue(): string {
  const listenValueEl = document.querySelector<HTMLElement>('.grpc-mock-listen-target-chip__value');
  return listenValueEl?.textContent?.trim() ?? '';
}

export async function ensureMockListenerReadyQuiet(ctx: DemoActionContext): Promise<string> {
  if (!isTauri()) return '';
  await openMockRuntimeTabQuiet(ctx);
  const startBtn = document.querySelector<HTMLButtonElement>(GRPC.MOCK_START);
  if (startBtn && !startBtn.disabled) {
    startBtn.click();
    await ctx.delay(350);
  }
  grpcTauriDesktopSession.mockRunning = true;
  const toggle = document.querySelector<HTMLInputElement>(GRPC.MOCK_EXPOSE_NETWORK);
  if (toggle && !toggle.checked) {
    toggle.click();
    await ctx.delay(450);
  }
  await ctx.waitFor(GRPC.MOCK_LISTEN_TARGET, 6_000);
  const listenTarget = readMockListenTargetValue();
  if (!listenTarget) {
    throw new Error('Mock listener target is not available yet.');
  }
  grpcTauriDesktopSession.listenerEnabled = true;
  return listenTarget;
}

export async function waitForGrpcSendEnabled(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(GRPC.SEND_BTN);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const sendBtn = document.querySelector<HTMLButtonElement>(GRPC.SEND_BTN);
    if (sendBtn && !sendBtn.disabled) return;
    await ctx.delay(100);
  }
}

export async function waitForStreamStartEnabled(ctx: DemoActionContext): Promise<void> {
  await ctx.waitFor(GRPC.STREAM_START_BTN);
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const startBtn = document.querySelector<HTMLButtonElement>(GRPC.STREAM_START_BTN);
    if (startBtn && !startBtn.disabled) return;
    await ctx.delay(120);
  }
}

export async function waitForStreamMessageCount(ctx: DemoActionContext, minCount: number, timeoutMs: number): Promise<number> {
  const maxAttempts = Math.max(1, Math.floor(timeoutMs / 250));
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const text = document.querySelector<HTMLElement>(GRPC.STREAM_LOG_COUNT)?.textContent ?? '';
    const parsed = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(parsed) && parsed >= minCount) return parsed;
    await ctx.delay(250);
  }
  return 0;
}

export async function spotlightRequestMessageLine(ctx: DemoActionContext, fallbackMs: number): Promise<void> {
  const editor = document.querySelector<HTMLElement>(GRPC.REQUEST_JSON);
  const lineSelector = GRPC.REQUEST_JSON_MESSAGE_LINE;
  const cleanup = (target: Element | null) => {
    if (target) target.removeAttribute('data-testid');
  };
  const candidateLine = editor?.closest('.cm-editor')?.querySelectorAll<HTMLElement>('.cm-line');
  if (candidateLine && candidateLine.length > 0) {
    const messageLine = Array.from(candidateLine).find((line) => line.textContent?.includes('"message"') ?? false) ?? null;
    if (messageLine) {
      messageLine.setAttribute('data-testid', 'grpc-request-json-message-line');
      try {
        await spotlightAndPause(ctx, lineSelector, fallbackMs);
      } finally {
        cleanup(messageLine);
      }
      return;
    }
  }
  await spotlightRequestJsonContentTight(ctx, fallbackMs);
}

export function ensureRequestMessageLineHighlight(): void {
  const editor = document.querySelector<HTMLElement>(GRPC.REQUEST_JSON);
  const candidateLine = editor?.closest('.cm-editor')?.querySelectorAll<HTMLElement>('.cm-line');
  if (candidateLine && candidateLine.length > 0) {
    const messageLine = Array.from(candidateLine).find((line) => line.textContent?.includes('"message"') ?? false) ?? null;
    if (messageLine) messageLine.setAttribute('data-testid', 'grpc-request-json-message-line');
  }
}

export function hasMockRulesInDom(): boolean {
  return Boolean(
    document.querySelector('[data-testid="grpc-mock-rules-list"] .grpc-advanced-rule-item')
    || document.querySelector('[data-testid^="grpc-mock-builder-rule-"]'),
  );
}

export function isMockServerPanelVisible(): boolean {
  return Boolean(
    document.querySelector(GRPC.MOCK_TAB_BUILDER)
    || document.querySelector(GRPC.MOCK_TAB_RUNTIME)
    || document.querySelector(GRPC.MOCK_TAB_JSON),
  );
}

export function isMockRuntimeTabActive(): boolean {
  const runtimeTab = document.querySelector<HTMLElement>(GRPC.MOCK_TAB_RUNTIME);
  return runtimeTab?.getAttribute('aria-selected') === 'true';
}

export const CURRENT_RULE_HIGHLIGHT_SELECTOR = '[data-rule-highlight="true"]';

export function tagCurrentRuleHighlight(ruleId: string): void {
  document.querySelectorAll('[data-rule-highlight]').forEach((el) => el.removeAttribute('data-rule-highlight'));
  const ruleEl = document.querySelector<HTMLElement>(`[data-testid="grpc-mock-builder-rule-${ruleId}"]`);
  ruleEl?.setAttribute('data-rule-highlight', 'true');
}