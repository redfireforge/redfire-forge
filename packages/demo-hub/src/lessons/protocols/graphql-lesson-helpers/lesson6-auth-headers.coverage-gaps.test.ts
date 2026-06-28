/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeCtx } from '../ws-test-utils';
import { gqlAuthHeadersLesson } from '../graphql-auth-headers';

vi.mock('./gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql4'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

describe('lesson6-auth-headers — coverage gaps', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('walks auth headers lesson steps for helper coverage', async () => {
    const ctx = makeCtx();
    for (const step of gqlAuthHeadersLesson.steps) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
  });

  it('setup and cleanup run without error', async () => {
    const ctx = makeCtx();
    if (gqlAuthHeadersLesson.setup) await gqlAuthHeadersLesson.setup(ctx);
    if (gqlAuthHeadersLesson.cleanup) await gqlAuthHeadersLesson.cleanup(ctx);
  });

  it('walks auth lesson steps with auth panel DOM seeded', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <button data-testid="gql-auth-badge-btn"></button>
      <button data-testid="gql-bottom-tab-auth"></button>
      <button data-testid="gql-bottom-tab-vars"></button>
      <select data-testid="gql-auth-type-select"></select>
      <input data-testid="gql-auth-bearer-input" />
      <div data-testid="gql-auth-preview">Bearer demo-token</div>
    `;
    for (const step of gqlAuthHeadersLesson.steps.slice(0, 4)) {
      if (step.preAction) await step.preAction(ctx);
      if (step.action) await step.action(ctx);
    }
  });

  it('loadConnectionProfileOntoActiveTab clicks load when profile is not linked', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="gql-profile-row">
        <span class="gql-profile-row__name">Demo Profile</span>
        <button aria-label="Load profile: Demo Profile"></button>
      </div>
    `;
    const { loadConnectionProfileOntoActiveTab } = await import('./lesson6-auth-headers');
    await loadConnectionProfileOntoActiveTab(ctx, 'Demo Profile');
    expect(ctx.click).toHaveBeenCalled();
  });

  it('loadConnectionProfileOntoActiveTab skips when profile row is already linked', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div class="gql-profile-row">
        <span class="gql-profile-row__name">Demo Profile</span>
        <span class="gql-profile-loaded-badge"></span>
        <button aria-label="Load profile: Demo Profile"></button>
      </div>
    `;
    const { loadConnectionProfileOntoActiveTab } = await import('./lesson6-auth-headers');
    await loadConnectionProfileOntoActiveTab(ctx, 'Demo Profile');
    expect(ctx.click).not.toHaveBeenCalled();
  });

  it('prepareMetadataRequestHeadersReading opens response metadata and expands headers', async () => {
    const ctx = makeCtx();
    document.body.innerHTML = `
      <div data-testid="gql-response-viewer"></div>
      <button data-testid="gql-right-tab-response" aria-selected="false"></button>
      <button data-testid="gql-rv-tab-metadata" aria-selected="false"></button>
      <button data-testid="gql-rv-request-headers-toggle" aria-expanded="false"></button>
      <div data-testid="gql-rv-metadata-req-header-val-authorization">Bearer token</div>
      <button data-testid="gql-bottom-tab-auth"></button>
    `;
    const { prepareMetadataRequestHeadersReading } = await import('./lesson6-auth-headers');
    await prepareMetadataRequestHeadersReading(ctx, 'authorization');
    expect(ctx.click).toHaveBeenCalled();
  });
});
