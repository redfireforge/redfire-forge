// Lesson 13 mock server — session state and internal helpers
import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import { isTauri } from '../../../../../shared/utils/platform';
import { loadCachedGraphqlSchemaSdl } from '../../../../graphql/utils/graphqlSchemaCache';
import { setControlledCheckbox } from '../../setup-helpers';
import { GQL_DEMO_HTTP, getEndpointInput, responseBodyText } from './core';
import {
  GQL_MOCK_HTTP,
  GQL13_E2E_MOCK_CONFIG_URL,
  LESSON13_E2E_DOCKER_SDL,
  LESSON13_HEALTH_OVERRIDE,
} from './lesson13-mock-server-constants';

const GQL13_DESKTOP_MOCK_CONFIG_URL = 'http://localhost:3001/api/graphql/mock/config';
const GQL13_DESKTOP_MOCK_STATUS_URL = 'http://localhost:3001/api/graphql/mock/status';

export const L13 = {
  mockOpen: false,
  mockEnabled: false,
  mockEndpointSet: false,
  mockIntrospected: false,
  resolverFixed: false,
  fixedValueSet: false,
  executed: false,
  latencySliderSet: false,
  latencyExecuted: false,
  mockDisabled: false,
  restored: false,
};

export function resetGqlLesson13SessionFlags(): void {
  L13.mockOpen = false;
  L13.mockEnabled = false;
  L13.mockEndpointSet = false;
  L13.mockIntrospected = false;
  L13.resolverFixed = false;
  L13.fixedValueSet = false;
  L13.executed = false;
  L13.latencySliderSet = false;
  L13.latencyExecuted = false;
  L13.mockDisabled = false;
  L13.restored = false;
}

export function isGql13E2eWebMock(): boolean {
  return typeof window !== 'undefined'
    && (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ === true;
}

export function gql13E2eSdl(): string {
  const fromWindow = (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_SDL__;
  if (typeof fromWindow === 'string' && fromWindow.trim()) return fromWindow;
  return LESSON13_E2E_DOCKER_SDL;
}

export async function gql13E2ePostMockConfig(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(GQL13_E2E_MOCK_CONFIG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`GQL-13 E2E mock config failed (${res.status})`);
  }
}

async function lesson13DesktopMockEnabled(): Promise<boolean> {
  try {
    const res = await fetch(GQL13_DESKTOP_MOCK_STATUS_URL);
    if (!res.ok) return false;
    const body = await res.json() as { enabled?: boolean };
    return Boolean(body.enabled);
  } catch {
    return false;
  }
}

/** Ensure the in-process mock server is running when the UI toggle cannot sync SDL in time. */
export async function lesson13BootstrapDesktopMock(): Promise<void> {
  if (isGql13E2eWebMock() || !isTauri()) return;
  if (await lesson13DesktopMockEnabled()) return;

  await lesson13SyncDesktopMockEnabled();
}

/** POST enabled mock config with cached Docker SDL (used when the UI toggle cannot sync). */
export async function lesson13SyncDesktopMockEnabled(
  resolvers: Record<string, Record<string, { type: string; value?: string }>> = {},
  globalLatencyMs = 0,
): Promise<void> {
  if (isGql13E2eWebMock() || !isTauri()) return;

  const endpoint = (getEndpointInput()?.value ?? '').trim() || GQL_DEMO_HTTP;
  const sdl = loadCachedGraphqlSchemaSdl(GQL_DEMO_HTTP)
    ?? loadCachedGraphqlSchemaSdl(endpoint);
  if (!sdl) return;

  await fetch(GQL13_DESKTOP_MOCK_CONFIG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sdl,
      config: {
        connectionId: GQL_DEMO_HTTP,
        enabled: true,
        resolvers,
        globalLatencyMs,
        jitterMs: 0,
      },
    }),
  });
}

export async function lesson13SyncDesktopMockHealthOverride(globalLatencyMs = 0): Promise<void> {
  await lesson13SyncDesktopMockEnabled({
    Query: { health: { type: 'fixed', value: LESSON13_HEALTH_OVERRIDE } },
  }, globalLatencyMs);
}

export function gql13E2eOpenMockActivity(): void {
  const btn = document.querySelector<HTMLButtonElement>(GQL.ACTIVITY_MOCK);
  if (!btn) return;
  btn.disabled = false;
  btn.removeAttribute('disabled');
  btn.classList.remove('gql-activity-tab--disabled');
  btn.click();
}



export function mockToggleChecked(): boolean {
  if (isGql13E2eWebMock()) {
    if (L13.mockDisabled) return false;
    return L13.mockEnabled;
  }
  return document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)?.checked ?? false;
}

export function mockUiEnabled(): boolean {
  if (isGql13E2eWebMock()) {
    return L13.mockEnabled && !L13.mockDisabled;
  }
  return mockToggleChecked() && !!document.querySelector(GQL.MOCK_STATUS_ROW);
}

function dispatchMockToggleOn(): void {
  const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE);
  if (!toggle || toggle.checked || toggle.disabled) return;
  toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function requestMockUiReconcile(): void {
  window.dispatchEvent(new Event('rf-gql-mock-reconcile'));
}

export function mockUiDisabled(): boolean {
  if (isGql13E2eWebMock()) {
    return L13.mockDisabled || !L13.mockEnabled;
  }
  return !mockToggleChecked() && !document.querySelector(GQL.MOCK_STATUS_ROW);
}

export async function waitForMockUiEnabled(ctx: DemoActionContext, timeout = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (mockUiEnabled()) return;
    await ctx.delay(150);
  }
}

export async function clickMockToggleOn(ctx: DemoActionContext): Promise<void> {
  const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE);
  if (!toggle || toggle.checked) return;

  dispatchMockToggleOn();
  await ctx.delay(300);
  if (!mockToggleChecked() && !toggle.disabled) {
    setControlledCheckbox(toggle, true);
    await ctx.delay(300);
  }
  if (!mockToggleChecked() && !toggle.disabled) {
    await ctx.click(GQL.MOCK_TOGGLE);
    await ctx.delay(700);
  }
}

function dispatchMockToggleOff(): void {
  const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE);
  if (!toggle || !toggle.checked || toggle.disabled) return;
  toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export async function waitForMockUiDisabled(ctx: DemoActionContext, timeout = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (mockUiDisabled()) return;
    await ctx.delay(150);
  }
}

export async function clickMockToggleOff(ctx: DemoActionContext): Promise<void> {
  const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE);
  if (!toggle || !toggle.checked) return;

  dispatchMockToggleOff();
  await ctx.delay(300);
  if (mockToggleChecked()) {
    setControlledCheckbox(toggle, false);
    await ctx.delay(300);
  }
  if (mockToggleChecked()) {
    await ctx.click(GQL.MOCK_TOGGLE);
    await ctx.delay(700);
  }
}

/** POST `{ enabled: false }` so the proxy stops even when the UI toggle cannot sync in time. */
export async function lesson13SyncDesktopMockDisabled(): Promise<void> {
  if (isGql13E2eWebMock() || !isTauri()) return;
  await fetch(GQL13_DESKTOP_MOCK_CONFIG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false }),
  });
}

export function responseLatencyMs(): number {
  const text = document.querySelector(GQL.RESPONSE_LATENCY)?.textContent ?? '';
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function responseShowsLiveHealthOk(): boolean {
  try {
    const parsed = JSON.parse(responseBodyText()) as { data?: { health?: string } };
    return parsed.data?.health === 'ok';
  } catch {
    return false;
  }
}

export function responseShowsMockHealthOk(): boolean {
  try {
    const parsed = JSON.parse(responseBodyText()) as { data?: { health?: string } };
    return parsed.data?.health === LESSON13_HEALTH_OVERRIDE;
  } catch {
    return false;
  }
}

function isLiveEndpointConfigured(): boolean {
  const value = (getEndpointInput()?.value ?? '').trim();
  if (!value) return false;
  if (value === GQL_MOCK_HTTP.trim()) return false;
  if (value.includes('3001')) return false;
  return true;
}

export function liveRestoreComplete(): boolean {
  return isLiveEndpointConfigured() && responseShowsLiveHealthOk();
}

export async function ensureResponseTabSelected(ctx: DemoActionContext): Promise<void> {
  const tab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (tab && tab.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(400);
  }
}

export async function waitForLiveHealthOk(ctx: DemoActionContext, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (responseShowsLiveHealthOk()) {
      await ctx.delay(400);
      return;
    }
    await ctx.delay(100);
  }
}

export async function waitForLesson13LatencyAtLeast(
  ctx: DemoActionContext,
  minMs: number,
  timeoutMs = 3_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (responseLatencyMs() >= minMs) {
      await ctx.delay(400);
      return;
    }
    await ctx.delay(100);
  }
  await ctx.delay(400);
}

function findMockTypeGroup(typeName: string): HTMLElement | null {
  const groups = document.querySelectorAll<HTMLElement>(GQL.MOCK_TYPE_GROUP);
  for (const group of groups) {
    const header = group.querySelector<HTMLElement>(GQL.MOCK_TYPE_HEADER);
    if (header?.textContent?.includes(typeName)) return group;
  }
  return null;
}

function findMockFieldRow(typeName: string, fieldName: string): HTMLElement | null {
  const group = findMockTypeGroup(typeName);
  if (!group) return null;
  const rows = group.querySelectorAll<HTMLElement>(GQL.MOCK_FIELD_ROW);
  for (const row of rows) {
    if (row.textContent?.includes(fieldName)) return row;
  }
  return null;
}

function tagMockHealthRow(): HTMLElement | null {
  const healthRow = findMockFieldRow('Query', 'health');
  if (healthRow) {
    healthRow.setAttribute('data-lesson-target', 'mock-health');
  }
  return healthRow;
}

export async function expandMockQueryGroup(ctx: DemoActionContext): Promise<void> {
  const queryGroup = findMockTypeGroup('Query');
  if (!queryGroup) return;
  queryGroup.setAttribute('data-lesson-target', 'mock-query');
  const existingRow = findMockFieldRow('Query', 'health');
  if (!existingRow) {
    await ctx.click('[data-lesson-target="mock-query"] [data-testid="gql-mock-type-header"]');
    await ctx.waitFor(GQL.MOCK_FIELD_ROW, 5000);
    await ctx.delay(600);
  }
  tagMockHealthRow();
}
export async function gql13E2eSetHealthResolver(
  globalLatencyMs = 0,
): Promise<void> {
  await gql13E2ePostMockConfig({
    sdl: gql13E2eSdl(),
    config: {
      connectionId: 'e2e-gql13',
      enabled: true,
      resolvers: {
        Query: {
          health: { type: 'fixed', value: LESSON13_HEALTH_OVERRIDE },
        },
      },
      globalLatencyMs,
      jitterMs: 0,
    },
  });
}
