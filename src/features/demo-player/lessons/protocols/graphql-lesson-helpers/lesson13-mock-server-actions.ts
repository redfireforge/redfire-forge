// Lesson 13 mock server — lesson step actions
import type { DemoActionContext } from '../../../types';
import { GQL } from '../../../../../shared/selectors';
import { fillControlledInput } from '../../setup-helpers';
import {
  GQL_DEMO_HTTP,
  GQL_HEALTH_QUERY,
  configureDemoTabEndpointOverride,
  fillGqlEditor,
  getEndpointInput,
  getGqlEditorQuery,
} from './core';
import {
  GQL_MOCK_HTTP,
  LESSON13_HEALTH_OVERRIDE,
  LESSON13_MOCK_HEALTH_FIXED,
  LESSON13_MOCK_HEALTH_RESOLVER,
  LESSON13_MOCK_HEALTH_ROW,
} from './lesson13-mock-server-constants';
import {
  L13,
  clickMockToggleOff,
  clickMockToggleOn,
  ensureResponseTabSelected,
  expandMockQueryGroup,
  gql13E2eOpenMockActivity,
  gql13E2ePostMockConfig,
  gql13E2eSetHealthResolver,
  gql13E2eSdl,
  isGql13E2eWebMock,
  lesson13BootstrapDesktopMock,
  lesson13SyncDesktopMockDisabled,
  lesson13SyncDesktopMockEnabled,
  lesson13SyncDesktopMockHealthOverride,
  liveRestoreComplete,
  mockToggleChecked,
  mockUiDisabled,
  mockUiEnabled,
  requestMockUiReconcile,
  responseLatencyMs,
  responseShowsMockHealthOk,
  waitForLesson13LatencyAtLeast,
  waitForLiveHealthOk,
  waitForMockUiDisabled,
  waitForMockUiEnabled,
} from './lesson13-mock-server-session';

export async function ensureLesson13MockPanelOpen(ctx: DemoActionContext): Promise<void> {
  if (L13.mockOpen && (document.querySelector(GQL.MOCK_PANEL) || document.querySelector(GQL.MOCK_GUARD))) {
    return;
  }
  if (isGql13E2eWebMock()) {
    gql13E2eOpenMockActivity();
  } else {
    await ctx.click(GQL.ACTIVITY_MOCK);
  }
  await ctx.waitFor(`${GQL.MOCK_PANEL}, ${GQL.MOCK_GUARD}`, 5000);
  await ctx.delay(700);
  L13.mockOpen = true;
}

/** Enable mock mode using the current introspected Docker SDL as the source schema. */
export async function ensureLesson13MockEnabled(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockPanelOpen(ctx);
  if (mockUiEnabled()) {
    L13.mockEnabled = true;
    L13.mockDisabled = false;
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
    L13.mockEnabled = true;
    L13.mockDisabled = false;
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
    L13.mockEnabled = true;
    L13.mockDisabled = false;
  }
}

/** Switch the connection bar to the mock URL (no introspect yet). */
export async function ensureLesson13MockEndpointSet(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockEnabled(ctx);
  if (L13.mockEndpointSet && (getEndpointInput()?.value ?? '').trim() === GQL_MOCK_HTTP) return;
  await configureDemoTabEndpointOverride(ctx, GQL_MOCK_HTTP);
  await ctx.delay(800);
  L13.mockEndpointSet = true;
}

/** Introspect the mock endpoint after the URL is set. */
export async function ensureLesson13MockIntrospectOnly(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockEndpointSet(ctx);
  if (L13.mockIntrospected) return;
  await lesson13BootstrapDesktopMock();
  await ctx.click(GQL.INTROSPECT_BTN);
  await ctx.waitFor(GQL.SCHEMA_BADGE_OK, 15000);
  await ctx.delay(900);
  L13.mockIntrospected = true;
}

/** Switch the connection bar to the mock URL and introspect the mock endpoint. */
export async function ensureLesson13MockEndpointIntrospected(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockIntrospectOnly(ctx);
}

/** Expand `Query` and set `health` resolver type to **Fixed** (value entered in the next step). */
export async function ensureLesson13ResolverFixedSelect(ctx: DemoActionContext): Promise<void> {
  if (L13.resolverFixed) return;
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
    L13.resolverFixed = true;
    return;
  }

  await expandMockQueryGroup(ctx);
  await ctx.selectOption(LESSON13_MOCK_HEALTH_RESOLVER, 'fixed');
  await ctx.waitFor(LESSON13_MOCK_HEALTH_FIXED, 5000);
  await ctx.delay(700);
  L13.resolverFixed = true;
}

/** Type the deterministic `"mock-ok"` value into the Fixed resolver input. */
export async function ensureLesson13FixedValueSet(ctx: DemoActionContext): Promise<void> {
  if (L13.fixedValueSet) return;
  await ensureLesson13ResolverFixedSelect(ctx);

  if (isGql13E2eWebMock()) {
    await gql13E2eSetHealthResolver(0);
    L13.fixedValueSet = true;
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
  L13.fixedValueSet = true;
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
  if (!L13.resolverFixed) {
    const select = document.querySelector<HTMLSelectElement>(LESSON13_MOCK_HEALTH_RESOLVER);
    if (select?.value === 'fixed') {
      L13.resolverFixed = true;
    } else if (select) {
      await ctx.selectOption(LESSON13_MOCK_HEALTH_RESOLVER, 'fixed');
      await ctx.waitFor(LESSON13_MOCK_HEALTH_FIXED, 5000);
      L13.resolverFixed = true;
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
  if (!L13.executed || !responseShowsMockHealthOk() || current.trim() !== GQL_HEALTH_QUERY.trim()) {
    await lesson13SyncDesktopMockHealthOverride();
    await ctx.delay(400);
    await fillGqlEditor(ctx, GQL_HEALTH_QUERY, { focus: false });
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(200);
    await ctx.click(GQL.EXECUTE_BTN);
    await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
    await ctx.delay(800);
  }
  L13.executed = true;
}

/** Drag the latency slider to ~650 ms (no execute yet). */
export async function ensureLesson13LatencySliderOnly(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13MockExecuted(ctx);
  await ensureLesson13MockPanelOpen(ctx);
  if (L13.latencySliderSet) return;

  if (isGql13E2eWebMock()) {
    L13.latencySliderSet = true;
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
  L13.latencySliderSet = true;
}

/** Re-execute after latency is raised and wait for the response metadata to reflect the delay. */
export async function ensureLesson13LatencyExecute(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13LatencySliderOnly(ctx);
  if (L13.latencyExecuted && responseLatencyMs() >= 500) return;

  if (isGql13E2eWebMock()) {
    await gql13E2eSetHealthResolver(650);
    await ctx.click(GQL.RIGHT_TAB_RESPONSE);
    await ctx.delay(400);
    await ctx.click(GQL.EXECUTE_BTN);
    await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
    await waitForLesson13LatencyAtLeast(ctx, 500);
    await ctx.delay(600);
    L13.latencyExecuted = true;
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
  L13.latencyExecuted = true;
}

/** Raise mock latency, re-run, and wait for the response metadata latency to reflect the delay. */
export async function ensureLesson13LatencyDemo(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13LatencyExecute(ctx);
}

/** Turn mock mode OFF (endpoint unchanged). */
export async function ensureLesson13MockDisabledOnly(ctx: DemoActionContext): Promise<void> {
  if (mockUiDisabled()) {
    L13.mockDisabled = true;
    L13.mockEnabled = false;
    return;
  }

  await ensureLesson13LatencyExecute(ctx);

  if (isGql13E2eWebMock()) {
    await gql13E2ePostMockConfig({ enabled: false });
    L13.mockDisabled = true;
    L13.mockEnabled = false;
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
    L13.mockDisabled = true;
    L13.mockEnabled = false;
  }
}

/** Restore live Docker endpoint after mock is already OFF (step 14 action). */
export async function ensureLesson13LiveEndpointOnly(ctx: DemoActionContext): Promise<void> {
  if (L13.restored && liveRestoreComplete()) return;
  if (liveRestoreComplete()) {
    L13.restored = true;
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
    L13.restored = true;
  }
}

/** Disable mock mode, restore the live endpoint, and verify the original `ok` response is back. */
export async function ensureLesson13LiveEndpointRestored(ctx: DemoActionContext): Promise<void> {
  if (L13.restored && liveRestoreComplete()) return;
  if (liveRestoreComplete()) {
    L13.restored = true;
    return;
  }
  await ensureLesson13MockDisabledOnly(ctx);
  await ensureLesson13LiveEndpointOnly(ctx);
}

/** Disable mock mode, restore the live endpoint, and verify the original `ok` response is back. */
export async function ensureLesson13MockDisabledAndRestored(ctx: DemoActionContext): Promise<void> {
  await ensureLesson13LiveEndpointRestored(ctx);
}
