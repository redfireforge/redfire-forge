// ── Lesson 13: Mock Server ───────────────────────────────────────────────────

import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import { isTauri } from '../../../../../shared/utils/platform';
import { loadCachedGraphqlSchemaSdl } from '../../../../graphql/utils/graphqlSchemaCache';
import { fillControlledInput, setControlledCheckbox } from '../../setup-helpers';
import {
  GQL_DEMO_HTTP,
  GQL_HEALTH_QUERY,
  configureDemoTabEndpointOverride,
  ensureDemoEndpoint,
  ensureEditorMode,
  ensureIntrospected,
  fillGqlEditor,
  getEndpointInput,
  getGqlEditorQuery,
  responseBodyText,
  resetGqlLesson2SessionFlags,
  resetGqlLessonSessionFlags,
} from './core';
import { resetGqlLesson3SessionFlags } from './lesson3-mutations';
import { resetGqlLesson4SessionFlags } from './lesson4-schema-exploration';
import { resetGqlLesson5SessionFlags } from './lesson5-subscriptions';
import { resetGqlLesson6SessionFlags } from './lesson6-auth-headers';
import { resetGqlLesson7SessionFlags } from './lesson7-query-builder';
import { resetGqlLesson8SessionFlags } from './lesson8-collections-history';
import { resetGqlLesson9SessionFlags } from './lesson9-export-share';
import { resetGqlLesson10SessionFlags } from './lesson10-performance-tracing';
import { resetGqlLesson11SessionFlags } from './lesson11-workflow-integration';
import { resetGqlLesson12SessionFlags } from './lesson12-schema-diff';
import { closeGqlDemoTabs, ensureGqlDemoTab } from './gql-demo-tab';

/** Desktop mock endpoint proxied by the Tauri app. */
export const GQL_MOCK_HTTP = 'http://localhost:3001/api/graphql/mock';
const GQL13_DESKTOP_MOCK_CONFIG_URL = 'http://localhost:3001/api/graphql/mock/config';
const GQL13_DESKTOP_MOCK_STATUS_URL = 'http://localhost:3001/api/graphql/mock/status';
/** Playwright E2E configures mock via the Vite `/api` proxy (not absolute :3001). */
const GQL13_E2E_MOCK_CONFIG_URL = '/api/graphql/mock/config';
/** Fixed resolver value used in the lesson so restore-vs-live is obvious. */
export const LESSON13_HEALTH_OVERRIDE = 'mock-ok';
/** Spotlight targets on the Query.health resolver row (set during lesson actions). */
export const LESSON13_MOCK_HEALTH_ROW = GQL.LESSON13_MOCK_HEALTH_ROW;
export const LESSON13_MOCK_HEALTH_RESOLVER = `${LESSON13_MOCK_HEALTH_ROW} ${GQL.MOCK_RESOLVER_SELECT}`;
export const LESSON13_MOCK_HEALTH_FIXED = `${LESSON13_MOCK_HEALTH_ROW} ${GQL.MOCK_FIXED_INPUT}`;
/** Docker test-server SDL — matches docker/graphql/server.js (used by Playwright E2E). */
export const LESSON13_E2E_DOCKER_SDL = `
  type Query {
    health: String
    user(id: ID!): User
  }

  type User {
    id: ID!
    name: String!
    email: String!
  }

  input OrderInput {
    customerId: ID!
    items: [String!]
  }

  type Order {
    id: ID!
    status: OrderStatusEnum!
    customerId: ID!
  }

  enum OrderStatusEnum {
    PENDING
    PROCESSING
    COMPLETE
  }

  type OrderStatus {
    status: OrderStatusEnum!
    updatedAt: String!
  }

  type Mutation {
    createOrder(input: OrderInput!): Order!
    createUser(name: String!, email: String!): User!
    deleteUser(id: ID!): DeleteResult!
  }

  type DeleteResult {
    success: Boolean!
  }

  type Subscription {
    orderStatus(orderId: ID!): OrderStatus!
  }
`;

function isGql13E2eWebMock(): boolean {
  return typeof window !== 'undefined'
    && (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_DESKTOP__ === true;
}

function gql13E2eSdl(): string {
  const fromWindow = (window as unknown as Record<string, unknown>).__RF_E2E_MOCK_SDL__;
  if (typeof fromWindow === 'string' && fromWindow.trim()) return fromWindow;
  return LESSON13_E2E_DOCKER_SDL;
}

async function gql13E2ePostMockConfig(payload: Record<string, unknown>): Promise<void> {
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
async function lesson13BootstrapDesktopMock(): Promise<void> {
  if (isGql13E2eWebMock() || !isTauri()) return;
  if (await lesson13DesktopMockEnabled()) return;

  await lesson13SyncDesktopMockEnabled();
}

/** POST enabled mock config with cached Docker SDL (used when the UI toggle cannot sync). */
async function lesson13SyncDesktopMockEnabled(
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

async function lesson13SyncDesktopMockHealthOverride(globalLatencyMs = 0): Promise<void> {
  await lesson13SyncDesktopMockEnabled({
    Query: { health: { type: 'fixed', value: LESSON13_HEALTH_OVERRIDE } },
  }, globalLatencyMs);
}

function gql13E2eOpenMockActivity(): void {
  const btn = document.querySelector<HTMLButtonElement>(GQL.ACTIVITY_MOCK);
  if (!btn) return;
  btn.disabled = false;
  btn.removeAttribute('disabled');
  btn.classList.remove('gql-activity-tab--disabled');
  btn.click();
}

let _lesson13MockOpen = false;
let _lesson13MockEnabled = false;
let _lesson13MockEndpointSet = false;
let _lesson13MockIntrospected = false;
let _lesson13ResolverFixed = false;
let _lesson13FixedValueSet = false;
let _lesson13Executed = false;
let _lesson13LatencySliderSet = false;
let _lesson13LatencyExecuted = false;
let _lesson13MockDisabled = false;
let _lesson13Restored = false;

export function resetGqlLesson13SessionFlags(): void {
  _lesson13MockOpen = false;
  _lesson13MockEnabled = false;
  _lesson13MockEndpointSet = false;
  _lesson13MockIntrospected = false;
  _lesson13ResolverFixed = false;
  _lesson13FixedValueSet = false;
  _lesson13Executed = false;
  _lesson13LatencySliderSet = false;
  _lesson13LatencyExecuted = false;
  _lesson13MockDisabled = false;
  _lesson13Restored = false;
}

function mockToggleChecked(): boolean {
  if (isGql13E2eWebMock()) {
    if (_lesson13MockDisabled) return false;
    return _lesson13MockEnabled;
  }
  return document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)?.checked ?? false;
}

function mockUiEnabled(): boolean {
  if (isGql13E2eWebMock()) {
    return _lesson13MockEnabled && !_lesson13MockDisabled;
  }
  return mockToggleChecked() && !!document.querySelector(GQL.MOCK_STATUS_ROW);
}

function dispatchMockToggleOn(): void {
  const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE);
  if (!toggle || toggle.checked || toggle.disabled) return;
  toggle.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function requestMockUiReconcile(): void {
  window.dispatchEvent(new Event('rf-gql-mock-reconcile'));
}

function mockUiDisabled(): boolean {
  if (isGql13E2eWebMock()) {
    return _lesson13MockDisabled || !_lesson13MockEnabled;
  }
  return !mockToggleChecked() && !document.querySelector(GQL.MOCK_STATUS_ROW);
}

async function waitForMockUiEnabled(ctx: DemoActionContext, timeout = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (mockUiEnabled()) return;
    await ctx.delay(150);
  }
}

async function clickMockToggleOn(ctx: DemoActionContext): Promise<void> {
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

async function waitForMockUiDisabled(ctx: DemoActionContext, timeout = 8000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (mockUiDisabled()) return;
    await ctx.delay(150);
  }
}

async function clickMockToggleOff(ctx: DemoActionContext): Promise<void> {
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
async function lesson13SyncDesktopMockDisabled(): Promise<void> {
  if (isGql13E2eWebMock() || !isTauri()) return;
  await fetch(GQL13_DESKTOP_MOCK_CONFIG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false }),
  });
}

function responseLatencyMs(): number {
  const text = document.querySelector(GQL.RESPONSE_LATENCY)?.textContent ?? '';
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function responseShowsLiveHealthOk(): boolean {
  try {
    const parsed = JSON.parse(responseBodyText()) as { data?: { health?: string } };
    return parsed.data?.health === 'ok';
  } catch {
    return false;
  }
}

function responseShowsMockHealthOk(): boolean {
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

function liveRestoreComplete(): boolean {
  return isLiveEndpointConfigured() && responseShowsLiveHealthOk();
}

async function ensureResponseTabSelected(ctx: DemoActionContext): Promise<void> {
  const tab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (tab && tab.getAttribute('aria-selected') !== 'true') {
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(400);
  }
}

async function waitForLiveHealthOk(ctx: DemoActionContext, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (responseShowsLiveHealthOk()) {
      await ctx.delay(400);
      return;
    }
    await ctx.delay(100);
  }
}

async function waitForLesson13LatencyAtLeast(
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

async function expandMockQueryGroup(ctx: DemoActionContext): Promise<void> {
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

/** Open the Mock activity panel. Desktop only; web shows a guard banner. */
export async function ensureLesson13MockPanelOpen(ctx: DemoActionContext): Promise<void> {
  if (_lesson13MockOpen && (document.querySelector(GQL.MOCK_PANEL) || document.querySelector(GQL.MOCK_GUARD))) {
    return;
  }
  if (isGql13E2eWebMock()) {
    gql13E2eOpenMockActivity();
  } else {
    await ctx.click(GQL.ACTIVITY_MOCK);
  }
  await ctx.waitFor(`${GQL.MOCK_PANEL}, ${GQL.MOCK_GUARD}`, 5000);
  await ctx.delay(700);
  _lesson13MockOpen = true;
}

/** Enable mock mode using the current introspected Docker SDL as the source schema. */
export async function ensureLesson13MockEnabled(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockPanelOpen(ctx);
  if (mockUiEnabled()) {
    _lesson13MockEnabled = true;
    _lesson13MockDisabled = false;
    return;
  }

  if (isGql13E2eWebMock()) {
    await gql13E2ePostMockConfig({
      sdl: gql13E2eSdl(),
      config: {
        connectionId: 'e2e-gql13',
        enabled: true,
        resolvers: {},
        globalLatencyMs: 0,
        jitterMs: 0,
      },
    });
    _lesson13MockEnabled = true;
    _lesson13MockDisabled = false;
    return;
  }

  await lesson13SyncDesktopMockEnabled();
  requestMockUiReconcile();
  await ctx.delay(400);

  for (let attempt = 0; attempt < 3 && !mockUiEnabled(); attempt++) {
    await ctx.waitFor(GQL.MOCK_TOGGLE, 5000);
    if (!mockToggleChecked()) {
      await clickMockToggleOn(ctx);
    }
    await waitForMockUiEnabled(ctx, 4000);
    if (!mockUiEnabled()) {
      await lesson13SyncDesktopMockEnabled();
      requestMockUiReconcile();
      await ctx.delay(400);
    }
  }

  if (mockUiEnabled()) {
    _lesson13MockEnabled = true;
    _lesson13MockDisabled = false;
  }
}

/** Switch the connection bar to the mock URL (no introspect yet). */
export async function ensureLesson13MockEndpointSet(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockEnabled(ctx);
  if (_lesson13MockEndpointSet && (getEndpointInput()?.value ?? '').trim() === GQL_MOCK_HTTP) return;
  await configureDemoTabEndpointOverride(ctx, GQL_MOCK_HTTP);
  await ctx.delay(800);
  _lesson13MockEndpointSet = true;
}

/** Introspect the mock endpoint after the URL is set. */
export async function ensureLesson13MockIntrospectOnly(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockEndpointSet(ctx);
  if (_lesson13MockIntrospected) return;
  await lesson13BootstrapDesktopMock();
  await ctx.click(GQL.INTROSPECT_BTN);
  await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 15000);
  await ctx.delay(900);
  _lesson13MockIntrospected = true;
}

/** Switch the connection bar to the mock URL and introspect the mock endpoint. */
export async function ensureLesson13MockEndpointIntrospected(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockIntrospectOnly(ctx);
}

async function gql13E2eSetHealthResolver(
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

/** Expand `Query` and set `health` resolver type to **Fixed** (value entered in the next step). */
export async function ensureLesson13ResolverFixedSelect(ctx: DemoActionContext): Promise<void> {
  if (_lesson13ResolverFixed) return;
  await ensureLesson13MockIntrospectOnly(ctx);
  await ensureLesson13MockPanelOpen(ctx);

  if (isGql13E2eWebMock()) {
    await gql13E2ePostMockConfig({
      sdl: gql13E2eSdl(),
      config: {
        connectionId: 'e2e-gql13',
        enabled: true,
        resolvers: {
          Query: {
            health: { type: 'fixed', value: '' },
          },
        },
        globalLatencyMs: 0,
        jitterMs: 0,
      },
    });
    _lesson13ResolverFixed = true;
    return;
  }

  await expandMockQueryGroup(ctx);
  await ctx.selectOption(LESSON13_MOCK_HEALTH_RESOLVER, 'fixed');
  await ctx.waitFor(LESSON13_MOCK_HEALTH_FIXED, 5000);
  await ctx.delay(700);
  _lesson13ResolverFixed = true;
}

/** Type the deterministic `"mock-ok"` value into the Fixed resolver input. */
export async function ensureLesson13FixedValueSet(ctx: DemoActionContext): Promise<void> {
  if (_lesson13FixedValueSet) return;
  await ensureLesson13ResolverFixedSelect(ctx);

  if (isGql13E2eWebMock()) {
    await gql13E2eSetHealthResolver(0);
    _lesson13FixedValueSet = true;
    return;
  }

  await ctx.fill(LESSON13_MOCK_HEALTH_FIXED, `"${LESSON13_HEALTH_OVERRIDE}"`);
  const healthRow = document.querySelector<HTMLElement>(LESSON13_MOCK_HEALTH_ROW);
  const input = healthRow?.querySelector<HTMLInputElement>(GQL.MOCK_FIXED_INPUT);
  input?.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  await ctx.delay(800);
  await lesson13SyncDesktopMockHealthOverride();
  requestMockUiReconcile();
  await ctx.delay(400);
  _lesson13FixedValueSet = true;
}

/** Quietly open mock panel so schema source row is visible (reading phase). */
export async function prepareLesson13MockSchemaSourceSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockEnabled(ctx);
  await ensureLesson13MockPanelOpen(ctx);
  await ctx.waitFor(`${GQL.MOCK_SCHEMA_SOURCE}, ${GQL.MOCK_GUARD}`, 5000).catch(() => {});
  await ctx.delay(200);
}

/** Quietly open mock panel with resolvers list visible (reading phase). */
export async function prepareLesson13MockResolversListSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13FixedValueSet(ctx);
  await ensureLesson13MockPanelOpen(ctx);
  if (!isGql13E2eWebMock()) {
    await expandMockQueryGroup(ctx);
    await ctx.waitFor(GQL.MOCK_RESOLVERS_LIST, 5000).catch(() => {});
  }
  await ctx.delay(200);
}

/** Quietly open mock panel + expand Query.health for resolver spotlight (reading phase). */
export async function prepareLesson13MockHealthSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockIntrospectOnly(ctx);
  await ensureLesson13MockPanelOpen(ctx);
  if (isGql13E2eWebMock()) {
    await ctx.delay(200);
    return;
  }
  await expandMockQueryGroup(ctx);
  await ctx.waitFor(LESSON13_MOCK_HEALTH_RESOLVER, 5000).catch(() => {});
  await ctx.delay(200);
}

/** Quietly ensure Fixed value input is visible for the fixed-value spotlight. */
export async function prepareLesson13MockFixedValueSpotlight(ctx: DemoActionContext): Promise<void> {
  if (isGql13E2eWebMock()) {
    await ensureLesson13MockIntrospectOnly(ctx);
    await ctx.delay(200);
    return;
  }
  await prepareLesson13MockHealthSpotlight(ctx);
  if (!_lesson13ResolverFixed) {
    const select = document.querySelector<HTMLSelectElement>(LESSON13_MOCK_HEALTH_RESOLVER);
    if (select?.value === 'fixed') {
      _lesson13ResolverFixed = true;
    } else if (select) {
      await ctx.selectOption(LESSON13_MOCK_HEALTH_RESOLVER, 'fixed');
      await ctx.waitFor(LESSON13_MOCK_HEALTH_FIXED, 5000);
      _lesson13ResolverFixed = true;
    }
  }
  await ctx.waitFor(LESSON13_MOCK_HEALTH_FIXED, 5000).catch(() => {});
  await ctx.delay(200);
}

/** Quietly open mock panel with latency slider visible (reading phase). */
export async function prepareLesson13MockLatencySpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockExecuted(ctx);
  await ensureLesson13MockPanelOpen(ctx);
  await ctx.waitFor(GQL.MOCK_LATENCY_SLIDER, 5000).catch(() => {});
  await ctx.delay(200);
}

/** Quietly open mock panel with toggle visible for disable-mock spotlight. */
export async function prepareLesson13MockToggleSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13LatencyExecute(ctx);
  await ensureLesson13MockPanelOpen(ctx);
  await ctx.waitFor(GQL.MOCK_TOGGLE_CARD, 5000).catch(() => {});
  await ctx.delay(200);
}

/** Quietly show mock response body for read steps (reading phase). */
export async function prepareLesson13MockResponseSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockExecuted(ctx);
  await ensureResponseTabSelected(ctx);
  await ctx.waitFor(GQL.RESPONSE_BODY, 5000).catch(() => {});
  await ctx.delay(200);
}

/** Quietly restore live endpoint and show live response body (reading phase). */
export async function prepareLesson13ReadLiveSpotlight(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13LiveEndpointRestored(ctx);
  await ensureResponseTabSelected(ctx);
  await ctx.waitFor(GQL.RESPONSE_BODY, 5000).catch(() => {});
  await ctx.delay(200);
}

/** Expand `Query`, set `health` resolver to Fixed, and store `"mock-ok"` as the value. */
export async function ensureLesson13HealthOverrideConfigured(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13FixedValueSet(ctx);
}

/** Execute `query { health }` against the mock endpoint and verify the overridden value. */
export async function ensureLesson13MockExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockEndpointIntrospected(ctx);
  await ensureLesson13HealthOverrideConfigured(ctx);
  const current = getGqlEditorQuery();
  if (!_lesson13Executed || !responseShowsMockHealthOk() || current.trim() !== GQL_HEALTH_QUERY.trim()) {
    await lesson13SyncDesktopMockHealthOverride();
    await ctx.delay(400);
    await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(200);
    await ctx.click(GQL.EXECUTE_BTN);
    await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
    await ctx.delay(800);
  }
  _lesson13Executed = true;
}

/** Drag the latency slider to ~650 ms (no execute yet). */
export async function ensureLesson13LatencySliderOnly(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockExecuted(ctx);
  await ensureLesson13MockPanelOpen(ctx);
  if (_lesson13LatencySliderSet) return;

  if (isGql13E2eWebMock()) {
    _lesson13LatencySliderSet = true;
    return;
  }

  const slider = document.querySelector<HTMLInputElement>(GQL.MOCK_LATENCY_SLIDER);
  if (slider) {
    fillControlledInput(slider, '650');
    await ctx.delay(500);
  }
  await lesson13SyncDesktopMockHealthOverride(650);
  requestMockUiReconcile();
  await ctx.delay(400);
  _lesson13LatencySliderSet = true;
}

/** Re-execute after latency is raised and wait for the response metadata to reflect the delay. */
export async function ensureLesson13LatencyExecute(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13LatencySliderOnly(ctx);
  if (_lesson13LatencyExecuted && responseLatencyMs() >= 500) return;

  if (isGql13E2eWebMock()) {
    await gql13E2eSetHealthResolver(650);
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(400);
    await ctx.click(GQL.EXECUTE_BTN);
    await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
    await waitForLesson13LatencyAtLeast(ctx, 500);
    await ctx.delay(600);
    _lesson13LatencyExecuted = true;
    return;
  }

  await lesson13SyncDesktopMockHealthOverride(650);
  await ctx.delay(400);
  await ctx.click(GQL.RIGHT_TAB_RESPONSE);
  await ctx.delay(400);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await waitForLesson13LatencyAtLeast(ctx, 500);
  await ctx.delay(600);
  _lesson13LatencyExecuted = true;
}

/** Raise mock latency, re-run, and wait for the response metadata latency to reflect the delay. */
export async function ensureLesson13LatencyDemo(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13LatencyExecute(ctx);
}

/** Turn mock mode OFF (endpoint unchanged). */
export async function ensureLesson13MockDisabledOnly(ctx: DemoActionContext): Promise<void> {
  if (mockUiDisabled()) {
    _lesson13MockDisabled = true;
    _lesson13MockEnabled = false;
    return;
  }

  await ensureLesson13LatencyExecute(ctx);

  if (isGql13E2eWebMock()) {
    await gql13E2ePostMockConfig({ enabled: false });
    _lesson13MockDisabled = true;
    _lesson13MockEnabled = false;
    return;
  }

  await ensureLesson13MockPanelOpen(ctx);
  await lesson13SyncDesktopMockDisabled();
  requestMockUiReconcile();
  await ctx.delay(400);

  for (let attempt = 0; attempt < 3 && !mockUiDisabled(); attempt++) {
    await ctx.waitFor(GQL.MOCK_TOGGLE, 5000);
    if (mockToggleChecked()) {
      await clickMockToggleOff(ctx);
    }
    await waitForMockUiDisabled(ctx, 4000);
    if (!mockUiDisabled()) {
      await lesson13SyncDesktopMockDisabled();
      requestMockUiReconcile();
      await ctx.delay(400);
    }
  }

  if (mockUiDisabled()) {
    _lesson13MockDisabled = true;
    _lesson13MockEnabled = false;
  }
}

/** Restore live Docker endpoint after mock is already OFF (step 14 action). */
export async function ensureLesson13LiveEndpointOnly(ctx: DemoActionContext): Promise<void> {
  if (_lesson13Restored && liveRestoreComplete()) return;
  if (liveRestoreComplete()) {
    _lesson13Restored = true;
    return;
  }

  await configureDemoTabEndpointOverride(ctx, GQL_DEMO_HTTP);
  await ctx.delay(500);
  await ctx.click(GQL.INTROSPECT_BTN);
  await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 15000);
  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
  await ensureResponseTabSelected(ctx);
  await ctx.click(GQL.EXECUTE_BTN);
  await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
  await waitForLiveHealthOk(ctx);
  await ctx.delay(600);
  if (liveRestoreComplete()) {
    _lesson13Restored = true;
  }
}

/** Disable mock mode, restore the live endpoint, and verify the original `ok` response is back. */
export async function ensureLesson13LiveEndpointRestored(ctx: DemoActionContext): Promise<void> {
  if (_lesson13Restored && liveRestoreComplete()) return;
  if (liveRestoreComplete()) {
    _lesson13Restored = true;
    return;
  }
  await ensureLesson13MockDisabledOnly(ctx);
  await ensureLesson13LiveEndpointOnly(ctx);
}

/** Disable mock mode, restore the live endpoint, and verify the original `ok` response is back. */
export async function ensureLesson13MockDisabledAndRestored(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13LiveEndpointRestored(ctx);
}

/** Setup for Lesson 13 (GQL-13) — demo tab with live Docker endpoint and health query. */
export async function gqlMockServerLessonSetup(ctx: DemoActionContext): Promise<void> {
  resetGqlLessonSessionFlags();
  resetGqlLesson2SessionFlags();
  resetGqlLesson3SessionFlags();
  resetGqlLesson4SessionFlags();
  resetGqlLesson5SessionFlags();
  resetGqlLesson6SessionFlags();
  resetGqlLesson7SessionFlags();
  resetGqlLesson8SessionFlags();
  resetGqlLesson9SessionFlags();
  resetGqlLesson10SessionFlags();
  resetGqlLesson11SessionFlags();
  resetGqlLesson12SessionFlags();
  resetGqlLesson13SessionFlags();

  await ensureEditorMode(ctx);
  const responseTab = document.querySelector<HTMLElement>(GQL.RIGHT_TAB_RESPONSE);
  if (responseTab && responseTab.getAttribute('aria-selected') !== 'true') {
    responseTab.click();
    await ctx.delay(200);
  }
  await ensureGqlDemoTab(ctx, 'gql-mock-server', 'Mock Server');
  await ensureDemoEndpoint(ctx);
  await ensureIntrospected(ctx);
  await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
}

/** Cleanup for Lesson 13 (GQL-13) — disable mock on demo tab, then close it. */
export async function gqlMockServerLessonCleanup(ctx: DemoActionContext): Promise<void> {
  try {
    if (document.querySelector(GQL.ACTIVITY_MOCK)) {
      await ensureLesson13MockPanelOpen(ctx);
      if (mockToggleChecked()) {
        await ctx.click(GQL.MOCK_TOGGLE);
        await ctx.delay(300);
      }
    }
  } catch {
    // Non-fatal in tests or if the panel is unavailable.
  }
  resetGqlLesson13SessionFlags();
  await closeGqlDemoTabs(ctx, 'gql-mock-server');
}
