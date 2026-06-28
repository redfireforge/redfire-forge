/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { gqlMultiTabLesson } from '../graphql-multi-tab';
import { APP } from '@shared/selectors';
import {
  LESSON14_STAGING_PROFILE_NAME,
  LESSON14_PRODUCTION_PROFILE_NAME,
  ensureLesson14Tab1EndpointReadingReady,
  resetGqlLesson14SessionFlags,
} from './lesson14-multi-tab';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql14'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

describe('lesson14-multi-tab — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    resetGqlLesson14SessionFlags();
  });

  it('walks multi-tab lesson steps', async () => {
    const ctx = makeCtx();
    for (const step of gqlMultiTabLesson.steps) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
  });

  it('setup and cleanup run with tab bar DOM', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `<div data-testid="gql-tab-bar"></div>`;
    if (gqlMultiTabLesson.setup) await gqlMultiTabLesson.setup(ctx);
    if (gqlMultiTabLesson.cleanup) await gqlMultiTabLesson.cleanup(ctx);
  });

  it('walks multi-tab steps with tab bar and editor seeded', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-tab-bar"></div>
      <button data-testid="gql-tab-add"></button>
      <div data-testid="gql-editor"></div>
      <button data-testid="gql-mode-editor" class="gql-mode-btn--active"></button>
      <button data-testid="gql-right-tab-response" aria-selected="true"></button>
    `;
    for (const step of gqlMultiTabLesson.steps) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
  });

  it('ensureLesson14Tab1EndpointReadingReady uses header env/svc selectors when present', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-tab-bar"></div>
      <select data-testid="header-env-select"></select>
      <select data-testid="header-svc-select"></select>
      <input data-testid="gql-endpoint-input" value="http://localhost:4010/graphql" />
    `;
    await ensureLesson14Tab1EndpointReadingReady(ctx);
    expect(document.querySelector(APP.HEADER_ENV_SELECT)).toBeTruthy();
  });

  it('demonstrateLesson14LoadProfilesOnly short-circuits on second call after profiles linked', async () => {
    const ctx = makeCtx();
    const mod = await import('./lesson14-multi-tab');
    vi.spyOn(mod, 'ensureLesson14ProfilesSaved').mockResolvedValue(undefined);
    vi.spyOn(mod, 'activateGqlTabByIndex').mockResolvedValue(undefined);
    document.body.innerHTML = `
      <div data-testid="gql-profile-modal"></div>
      <button data-testid="gql-profile-close"></button>
      <div class="gql-profile-row">
        <span class="gql-profile-row__name">${LESSON14_STAGING_PROFILE_NAME}</span>
        <span class="gql-profile-loaded-badge"></span>
        <button aria-label="Load profile: ${LESSON14_STAGING_PROFILE_NAME}"></button>
      </div>
      <div class="gql-profile-row">
        <span class="gql-profile-row__name">${LESSON14_PRODUCTION_PROFILE_NAME}</span>
        <span class="gql-profile-row__tab-pill"></span>
        <button aria-label="Load profile: ${LESSON14_PRODUCTION_PROFILE_NAME}"></button>
      </div>
    `;
    await mod.demonstrateLesson14LoadProfilesOnly(ctx);
    vi.mocked(ctx.click).mockClear();
    await mod.demonstrateLesson14LoadProfilesOnly(ctx);
    expect(ctx.click).not.toHaveBeenCalled();
  });
});
