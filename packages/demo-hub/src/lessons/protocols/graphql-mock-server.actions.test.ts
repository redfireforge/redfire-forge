/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql13'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import {
  setupGraphqlMockServerBeforeEach,
  teardownGraphqlMockServerAfterEach,
  stubMonacoEditor,
  stubMockDom,
  mockLesson13LiveExecute,
} from './graphql-mock-server.testHelpers';
import { gqlMockServerLesson } from './graphql-mock-server';
import { makeCtx } from './ws-test-utils';
import { GQL } from '@shared/selectors';
import {GQL_MOCK_HTTP,
  LESSON13_HEALTH_OVERRIDE,
  LESSON13_MOCK_HEALTH_FIXED,
  LESSON13_MOCK_HEALTH_RESOLVER,
} from './graphql-lesson-helpers';

describe('gql-mock-server lesson', () => {
  beforeEach(() => {
    setupGraphqlMockServerBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlMockServerAfterEach();
  });

// ── Step actions ───────────────────────────────────────────────────────────

  it('gql13-open-mock clicks the activity button', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-open-mock')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.ACTIVITY_MOCK);
  });

  it('gql13-enable-mock toggles mock mode on', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-enable-mock')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(toggle.checked).toBe(true);
  });

  it('gql13-schema-source action calls delay (observation step)', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-schema-source')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql13-mock-endpoint points to the mock URL only', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-endpoint')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, GQL_MOCK_HTTP);
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gql13-mock-introspect introspects after endpoint is set', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-introspect')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.INTROSPECT_BTN);
  });

  it('gql13-resolver-fixed selects fixed on health row', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-resolver-fixed')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(LESSON13_MOCK_HEALTH_RESOLVER, 'fixed');
  });

  it('gql13-fixed-value fills the health fixed input', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-fixed-value')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(
      LESSON13_MOCK_HEALTH_FIXED,
      `"${LESSON13_HEALTH_OVERRIDE}"`,
    );
  });

  it('gql13-resolver-types action calls delay (observation step)', async () => {
    const ctx = makeCtx();
    stubMockDom();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-resolver-types')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql13-execute-mock runs the health query', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-execute-mock')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql13-observe-response action calls delay (observation step)', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-response')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });

  it('gql13-latency-slider changes the mock slider without execute', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    const slider = document.querySelector<HTMLInputElement>(GQL.MOCK_LATENCY_SLIDER)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-latency-slider')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(slider.value).toBe('650');
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql13-observe-latency re-executes after slider change', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = true;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-latency')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.EXECUTE_BTN);
  });

  it('gql13-disable-mock toggles mock off', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    toggle.checked = true;
    vi.mocked(ctx.click).mockImplementation(async (selector: string) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = !toggle.checked;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-disable-mock')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(toggle.checked).toBe(false);
  });

  it('gql13-disable-mock verify waits for mock panel not status row', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-disable-mock')!;
    expect(step.verify).toContain(GQL.MOCK_PANEL);
    expect(step.verify).not.toContain(GQL.MOCK_STATUS_ROW);
  });

  it('gql13-restore-endpoint restores live endpoint without re-disabling mock', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    toggle.checked = false;
    document.querySelector<HTMLInputElement>(GQL.ENDPOINT_INPUT)!.value = GQL_MOCK_HTTP;
    mockLesson13LiveExecute(ctx);
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-restore-endpoint')!;
    await step.preAction!(ctx);
    vi.mocked(ctx.click).mockClear();
    await step.action!(ctx);
    expect(ctx.fill).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 'http://localhost:4010/graphql');
    expect(ctx.click).not.toHaveBeenCalledWith(GQL.MOCK_TOGGLE);
  });

  it('gql13-read-live action calls delay (observation step)', async () => {
    const ctx = makeCtx();
    stubMockDom();
    stubMonacoEditor();
    const toggle = document.querySelector<HTMLInputElement>(GQL.MOCK_TOGGLE)!;
    mockLesson13LiveExecute(ctx, (selector) => {
      if (selector === GQL.MOCK_TOGGLE) toggle.checked = !toggle.checked;
    });
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-read-live')!;
    await step.preAction!(ctx);
    await step.action!(ctx);
    expect(ctx.delay).toHaveBeenCalled();
  });
});
