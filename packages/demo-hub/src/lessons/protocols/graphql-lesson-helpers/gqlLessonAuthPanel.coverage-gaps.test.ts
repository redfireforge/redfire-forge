/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { gqlAuthHeadersLesson } from '../graphql-auth-headers';
import { openAuthPanelQuiet, closeAuthPanelQuiet, isAuthEditorOpen } from './gqlLessonAuthPanel';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql4'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  activateGqlDemoTabQuiet: vi.fn(async () => {}),
  navigateToGraphqlStudio: vi.fn(async () => {}),
}));

describe('gqlLessonAuthPanel — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('openAuthPanelQuiet opens auth panel when closed', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<button data-testid="gql-auth-badge-btn"></button>`;
    await openAuthPanelQuiet(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('openAuthPanelQuiet skips when auth editor already open', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-auth" aria-selected="true"></button>
    `;
    await openAuthPanelQuiet(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('closeAuthPanelQuiet switches back to variables tab', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-bottom-tab-auth" aria-selected="true"></button>
      <button data-testid="gql-bottom-tab-vars"></button>
    `;
    expect(isAuthEditorOpen()).toBe(true);
    await closeAuthPanelQuiet(ctx);
    expect(ctx.click).toHaveBeenCalled();
  });

  it('walks auth lesson auth-panel steps', async () => {
    const ctx = makeCtx();
    for (const step of gqlAuthHeadersLesson.steps.filter((s) => s.id.includes('auth'))) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
  });

  it('waitForAuthTypeFields waits for bearer input', async () => {
    const ctx = makeCtx();
    const { waitForAuthTypeFields } = await import('./gqlLessonAuthPanel');
    document.body.innerHTML = `<input data-testid="gql-auth-bearer-input" />`;
    await waitForAuthTypeFields(ctx, 'bearer');
    expect(ctx.waitFor).toHaveBeenCalled();
  });

  it('waitForAuthTypeFields handles apiKey basic oauth2 inherit and none', async () => {
    const ctx = makeCtx();
    const { waitForAuthTypeFields } = await import('./gqlLessonAuthPanel');
    document.body.innerHTML = `
      <input data-testid="gql-auth-apikey-name" />
      <input data-testid="gql-auth-basic-user" />
      <input data-testid="gql-auth-oauth-token-url" />
      <select data-testid="gql-auth-profile-select"></select>
    `;
    for (const type of ['apiKey', 'basic', 'oauth2', 'inherit', 'none'] as const) {
      await waitForAuthTypeFields(ctx, type);
    }
  });

  it('clearActiveTabAuthOverride no-ops when reset inherit button missing', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<button data-testid="gql-auth-badge-btn"></button>`;
    const { clearActiveTabAuthOverride } = await import('./gqlLessonAuthPanel');
    await clearActiveTabAuthOverride(ctx);
    expect(ctx.click).not.toHaveBeenCalledWith('[data-testid="gql-auth-reset-inherit-btn"]');
  });
});
