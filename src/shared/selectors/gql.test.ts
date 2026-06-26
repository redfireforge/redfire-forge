import { describe, it, expect } from 'vitest';
import { GQL } from './gql';

describe('GQL selectors', () => {
  it('exposes stable page-level test ids', () => {
    expect(GQL.STUDIO_PAGE).toBe('[data-testid="gql-studio-page"]');
    expect(GQL.EXECUTE_BTN).toBe('[data-testid="gql-execute-btn"]');
  });

  it('builds per-tab label and subtitle selectors from tab id', () => {
    expect(GQL.tab('tab-a')).toBe('[data-testid="gql-tab-tab-a"]');
    expect(GQL.tabLabel('tab-a')).toBe('[data-testid="gql-tab-tab-a"] .gql-tab-label');
    expect(GQL.tabSubtitle('tab-b')).toBe('[data-testid="gql-tab-subtitle-tab-b"]');
  });

  it('exposes deprecated tab badge helpers aliasing subtitle selector', () => {
    expect(GQL.tabEndpointBadge('tab-x')).toBe('[data-testid="gql-tab-subtitle-tab-x"]');
    expect(GQL.tabProfileBadge('tab-y')).toBe('[data-testid="gql-tab-subtitle-tab-y"]');
  });

  it('exposes GQL-14 lesson Tab 2 badge spotlight selector', () => {
    expect(GQL.LESSON14_TAB2_BADGE).toBe('[data-lesson-target="gql14-tab2-badge"]');
  });

  it('exposes polling and profile-link selectors for GQL-14 optional steps', () => {
    expect(GQL.POLLING_TOGGLE).toBe('[data-testid="gql-polling-toggle"]');
    expect(GQL.AUTH_PROFILE_HINT).toBe('[data-testid="gql-auth-profile-hint"]');
  });

  it('builds advanced batch tab row and checkbox selectors from tab id', () => {
    expect(GQL.advBatchTabRow('tab-42')).toBe('[data-testid="gql-adv-batch-tab-row-tab-42"]');
    expect(GQL.advBatchTabCb('tab-42')).toBe('[data-testid="gql-adv-batch-tab-cb-tab-42"]');
  });

  it('scopes metadata request-header value selectors to the response viewer', () => {
    expect(GQL.rvMetadataRequestHeaderVal('Authorization')).toBe(
      '[data-testid="gql-response-viewer"] [data-testid="gql-rv-request-header-val-Authorization"]',
    );
  });
});
