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

  it('exposes batch results close selector', () => {
    expect(GQL.BATCH_RESULTS_CLOSE_BTN).toBe('[data-testid="gql-batch-results-close-btn"]');
    expect(GQL.BATCH_RESULTS_TRANSPORT).toBe('[data-testid="gql-batch-results-transport"]');
    expect(GQL.RESPONSE_BATCH_BANNER).toBe('[data-testid="gql-rv-batch-banner"]');
    expect(GQL.RESPONSE_OPEN_BATCH_RESULTS).toBe('[data-testid="gql-rv-open-batch-results"]');
    expect(GQL.RESPONSE_WIRE_BATCH_BODY).toBe('[data-testid="gql-rv-wire-batch-body"]');
    expect(GQL.RESPONSE_WIRE_BATCH_BODY_TOGGLE).toBe('[data-testid="gql-rv-wire-batch-body-toggle"]');
    expect(GQL.BATCH_RESULTS_FAILED_PILL).toBe('[data-testid="gql-batch-results-failed-pill"]');
  });

  it('builds profile tab usage selectors from profile and tab ids', () => {
    expect(GQL.PROFILE_ROW_TAB_USAGE).toBe('.gql-profile-row__tab-usage');
    expect(GQL.profileTabUsage('prof-1')).toBe('[data-testid="gql-profile-tab-usage-prof-1"]');
    expect(GQL.profileTabPill('prof-1', 'tab-2')).toBe(
      '[data-testid="gql-profile-tab-pill-prof-1-tab-2"]',
    );
    expect(GQL.profileLoadBtn('Staging')).toBe('[aria-label="Load profile: Staging"]');
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
