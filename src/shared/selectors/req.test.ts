/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import { REQ } from './req';

describe('shared selectors req', () => {
  it('exposes stable selector constants for requests and harness', () => {
    expect(REQ.SIDEBAR).toBe('[data-testid="req-sidebar"]');
    expect(REQ.METHOD_SELECT).toBe('[data-testid="req-method-select"]');
    expect(REQ.AUTH_TYPE_SELECT).toBe('[data-testid="req-auth-type-select"]');
    expect(REQ.CURL_IMPORT_BTN).toBe('[data-testid="req-curl-import-btn"]');
    expect(REQ.HARNESS_MODAL).toBe('[data-testid="req-send-harness-modal"]');
    expect(REQ.VERSION_PANEL).toBe('[data-testid="version-history-panel"]');
  });

  it('builds dynamic selectors consistently', () => {
    expect(REQ.galleryCard('req-1')).toBe('[data-testid="gallery-card-req-1"]');
    expect(REQ.colByName('Orders')).toBe('[data-col-name="Orders"]');
    expect(REQ.reqByName('Get all')).toBe('[data-req-name="Get all"]');
    expect(REQ.tabById('tab-1')).toBe('[data-testid="req-tab-item"][data-tab-id="tab-1"]');
    expect(REQ.envPillByName('prod')).toBe('[data-testid="req-env-pill"][data-env-name="prod"]');
    expect(REQ.reqInCollection('Orders', 'Get all')).toBe('.req-col-group:has([data-col-name="Orders"]) [data-req-name="Get all"]');
  });
});
