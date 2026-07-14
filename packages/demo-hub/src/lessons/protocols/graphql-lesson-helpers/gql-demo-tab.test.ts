/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { GQL } from '@shared/selectors';

vi.mock('../../../adapters', () => ({
  prepareDemoWorkspace: vi.fn(async () => ({ ok: true, demoTabId: 'demo-tab-99' })),
  closeDemoWorkspace: vi.fn(async () => {}),
  dispatchGqlTabsReload: vi.fn(),
  loadDemoSession: vi.fn(async () => ({
    lessonId: 'gql-first-query',
    priorActiveTabId: 'user-tab-1',
    demoTabId: 'demo-tab-99',
  })),
}));

import {
  prepareDemoWorkspace,
  closeDemoWorkspace,
  dispatchGqlTabsReload,
  loadDemoSession,
} from '../../../adapters';
import {
  ensureGqlDemoTab,
  closeGqlDemoTabs,
  closeGqlDemoWorkspaceQuiet,
  activateGqlDemoTabQuiet,
  GQL14_LESSON_ID,
  GQL15_LESSON_ID,
} from './gql-demo-tab';

describe('gql-demo-tab', () => {
  beforeEach(() => {
    resetAllMocks();
    document.body.innerHTML = `<div data-testid="gql-tab-bar"></div>`;
  });

  it('ensureGqlDemoTab prepares workspace and activates demo tab', async () => {
    const ctx = makeCtx();
    const id = await ensureGqlDemoTab(ctx, 'gql-first-query', 'Your First GraphQL Query');
    expect(prepareDemoWorkspace).toHaveBeenCalledWith(
      'gql-first-query',
      'Demo: Your First GraphQL Query',
      1,
    );
    expect(dispatchGqlTabsReload).toHaveBeenCalled();
    expect(ctx.click).toHaveBeenCalledWith(GQL.tab('demo-tab-99'));
    expect(id).toBe('demo-tab-99');
  });

  it('closeGqlDemoTabs closes workspace and reloads tabs', async () => {
    const ctx = makeCtx();
    await closeGqlDemoTabs(ctx, 'gql-first-query');
    expect(closeDemoWorkspace).toHaveBeenCalledWith('gql-first-query');
    expect(dispatchGqlTabsReload).toHaveBeenCalled();
  });

  it('closeGqlDemoWorkspaceQuiet closes without ctx', async () => {
    await closeGqlDemoWorkspaceQuiet();
    expect(closeDemoWorkspace).toHaveBeenCalledWith(undefined);
    expect(dispatchGqlTabsReload).toHaveBeenCalled();
  });

  it('ensureGqlDemoTab returns undefined when prepareDemoWorkspace fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(prepareDemoWorkspace).mockResolvedValueOnce({ ok: false, reason: 'max_tabs' });
    const ctx = makeCtx();
    const id = await ensureGqlDemoTab(ctx, 'gql-multi-tab', 'Multi-Tab Workspaces', 2);
    expect(id).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      '[DemoHub] Could not prepare GQL demo workspace:',
      'max_tabs',
    );
    expect(dispatchGqlTabsReload).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ensureGqlDemoTab preserves displayName when it already starts with Demo:', async () => {
    const ctx = makeCtx();
    await ensureGqlDemoTab(ctx, GQL14_LESSON_ID, 'Demo: Multi-Tab Workspaces', 2);
    expect(prepareDemoWorkspace).toHaveBeenCalledWith(
      GQL14_LESSON_ID,
      'Demo: Multi-Tab Workspaces',
      2,
    );
  });

  it('ensureGqlDemoTab skips tab click when session has no demoTabId', async () => {
    vi.mocked(loadDemoSession).mockResolvedValueOnce({
      lessonId: GQL15_LESSON_ID,
      priorActiveTabId: 'user-tab-1',
      demoTabId: '',
    });
    const ctx = makeCtx();
    const id = await ensureGqlDemoTab(ctx, GQL15_LESSON_ID, 'Batch Execution');
    expect(id).toBe('demo-tab-99');
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('ensureGqlDemoTab skips tab click when loadDemoSession returns null', async () => {
    vi.mocked(loadDemoSession).mockResolvedValueOnce(null);
    const ctx = makeCtx();
    await ensureGqlDemoTab(ctx, GQL14_LESSON_ID, 'Multi-Tab Workspaces');
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('exports GQL14 and GQL15 lesson id constants', () => {
    expect(GQL14_LESSON_ID).toBe('gql-multi-tab');
    expect(GQL15_LESSON_ID).toBe('gql-batch-execution');
  });

  it('ensureGqlDemoTab delays without click when session has no demoTabId', async () => {
    vi.mocked(loadDemoSession).mockResolvedValueOnce({
      lessonId: 'gql-first-query',
      priorActiveTabId: 'user-tab-1',
      demoTabId: '',
    });
    const ctx = makeCtx();
    await ensureGqlDemoTab(ctx, 'gql-first-query', 'Your First GraphQL Query');
    expect(ctx.click).not.toHaveBeenCalled();
    expect(ctx.delay).toHaveBeenCalledWith(400);
  });

  it('activateGqlDemoTabQuiet returns early when session has no demoTabId', async () => {
    vi.mocked(loadDemoSession).mockResolvedValueOnce({
      lessonId: 'gql-first-query',
      priorActiveTabId: 'user-tab-1',
      demoTabId: '',
    });
    const ctx = makeCtx();
    await activateGqlDemoTabQuiet(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('activateGqlDemoTabQuiet returns early when loadDemoSession is null', async () => {
    vi.mocked(loadDemoSession).mockResolvedValueOnce(null);
    const ctx = makeCtx();
    await activateGqlDemoTabQuiet(ctx);
    expect(ctx.waitFor).not.toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });

  it('activateGqlDemoTabQuiet clicks tab when not already selected', async () => {
    document.body.innerHTML = `
      <div data-testid="gql-tab-bar"></div>
      <button data-testid="gql-tab-demo-tab-99" aria-selected="false"></button>
      <input data-testid="gql-endpoint-input" />
    `;
    const ctx = makeCtx();
    await activateGqlDemoTabQuiet(ctx);
    expect(ctx.click).toHaveBeenCalledWith(GQL.tab('demo-tab-99'));
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });

  it('activateGqlDemoTabQuiet skips click when tab already selected', async () => {
    document.body.innerHTML = `
      <div data-testid="gql-tab-bar"></div>
      <button data-testid="gql-tab-demo-tab-99" aria-selected="true"></button>
      <input data-testid="gql-endpoint-input" />
    `;
    const ctx = makeCtx();
    await activateGqlDemoTabQuiet(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
    expect(ctx.waitFor).toHaveBeenCalledWith(GQL.ENDPOINT_INPUT, 5000);
  });
});
