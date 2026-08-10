/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GRPC } from '@shared/selectors';
import { makeCtx } from './ws-test-utils';

const navigateSpy = vi.hoisted(() => vi.fn(async () => {}));
const helperSpies = vi.hoisted(() => ({
  closeGrpcSettingsDrawerQuiet: vi.fn(async () => {}),
  clearGrpcSchemaDriftQuiet: vi.fn(async () => {}),
  ensureGrpcPlaintextChannelReady: vi.fn(async () => {}),
  resetGrpcLessonSessionFlags: vi.fn(),
  captureGrpcActiveDescriptorKey: vi.fn(),
}));

vi.mock('../env-manager-lesson-helpers', () => ({
  navigateToGrpcStudio: navigateSpy,
}));

vi.mock('../../adapters', async () => {
  const actual = await vi.importActual<typeof import('../../adapters')>('../../adapters');
  return {
    ...actual,
    captureGrpcActiveDescriptorKey: helperSpies.captureGrpcActiveDescriptorKey,
  };
});

vi.mock('./grpc-lesson-helpers', async () => {
  const actual = await vi.importActual<typeof import('./grpc-lesson-helpers')>('./grpc-lesson-helpers');
  return {
    ...actual,
    closeGrpcSettingsDrawerQuiet: helperSpies.closeGrpcSettingsDrawerQuiet,
    clearGrpcSchemaDriftQuiet: helperSpies.clearGrpcSchemaDriftQuiet,
    ensureGrpcPlaintextChannelReady: helperSpies.ensureGrpcPlaintextChannelReady,
    resetGrpcLessonSessionFlags: helperSpies.resetGrpcLessonSessionFlags,
  };
});

import { grpcSchemaDiffLesson } from './grpc-schema-diff';

describe('grpc-schema-diff lesson boot', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button data-testid="grpc-sub-nav-advanced" aria-selected="false"></button>
      <button data-testid="grpc-advanced-tab-schema_diff" aria-selected="false"></button>
      <button data-testid="grpc-reflect-btn"></button>
      <div data-testid="grpc-explorer-tree"></div>
    `;
    Object.values(helperSpies).forEach((spy) => spy.mockClear());
    navigateSpy.mockClear();
  });

  it('skips studio tab isolation and boots without ctx.click ripples', async () => {
    const ctx = makeCtx();
    expect(grpcSchemaDiffLesson.skipStudioTabIsolation).toBe(true);

    await grpcSchemaDiffLesson.setup?.(ctx);

    expect(navigateSpy).toHaveBeenCalledWith(ctx);
    expect(helperSpies.resetGrpcLessonSessionFlags).toHaveBeenCalled();
    expect(helperSpies.ensureGrpcPlaintextChannelReady).toHaveBeenCalledWith(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('intro Reading rings Capture baseline on Schema Diff (not Studio Reflect)', () => {
    const intro = grpcSchemaDiffLesson.steps.find((step) => step.id === 'grpc14-intro');
    expect(intro?.highlight).toBe(GRPC.SCHEMA_DIFF_CAPTURE_BASELINE);
    expect(intro?.verify).toBe(GRPC.SCHEMA_DIFF_PANEL);
  });

  it('intro preAction does not call clearGrpcSchemaDriftQuiet (Studio bounce)', async () => {
    const intro = grpcSchemaDiffLesson.steps.find((step) => step.id === 'grpc14-intro');
    document.body.innerHTML = `
      <div data-testid="grpc-schema-diff-panel"></div>
      <button data-testid="grpc-schema-diff-capture-baseline"></button>
    `;
    helperSpies.clearGrpcSchemaDriftQuiet.mockClear();
    await intro?.preAction?.(makeCtx());
    expect(helperSpies.clearGrpcSchemaDriftQuiet).not.toHaveBeenCalled();
  });

  it('filter preAction sets CustomSelect without Illegal invocation', async () => {
    const filter = grpcSchemaDiffLesson.steps.find((step) => step.id === 'grpc14-filter');
    document.body.innerHTML = `
      <div data-testid="grpc-schema-diff-results"></div>
      <div class="cs-wrapper" data-testid="grpc-schema-diff-severity-filter" data-value="breaking"></div>
    `;
    const wrapper = document.querySelector('.cs-wrapper')!;
    const handler = vi.fn();
    wrapper.addEventListener('custom-select:set-value', (event) => {
      handler((event as CustomEvent<{ value: string }>).detail.value);
    });

    await expect(filter?.preAction?.(makeCtx())).resolves.toBeUndefined();
    expect(handler).toHaveBeenCalledWith('all');
  });

  it('filter action uses visible selectOption for Breaking only', async () => {
    const filter = grpcSchemaDiffLesson.steps.find((step) => step.id === 'grpc14-filter');
    document.body.innerHTML = `
      <div data-testid="grpc-schema-diff-results"></div>
      <div data-testid="grpc-schema-diff-change-list"></div>
      <div class="cs-wrapper" data-testid="grpc-schema-diff-severity-filter" data-value="all"></div>
    `;
    const ctx = makeCtx();
    await filter?.action?.(ctx);
    expect(ctx.selectOption).toHaveBeenCalledWith(
      GRPC.SCHEMA_DIFF_SEVERITY_FILTER,
      'breaking',
    );
  });
});
