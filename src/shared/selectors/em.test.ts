/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
  EM,
  emAddProtocolItemSel,
  emRemoveProtocolSel,
  emWsDefaultDeleteSel,
  emWsDefaultRowSel,
  emWsDefaultRowValueSel,
} from './em';

describe('shared selectors em', () => {
  it('exposes stable selector constants for environment manager', () => {
    expect(EM.MANAGER).toBe('.env-manager');
    expect(EM.PROTOCOL_TAB_GRPC).toBe('[data-testid="em-protocol-tab-grpc"]');
    expect(EM.ADD_PROTOCOL_BTN).toBe('[data-testid="em-add-protocol-btn"]');
  });

  it('builds add protocol selector for a given protocol key', () => {
    expect(emAddProtocolItemSel('sse')).toBe('[data-testid="em-add-protocol-item-sse"]');
    expect(emAddProtocolItemSel('graphql')).toBe('[data-testid="em-add-protocol-item-graphql"]');
  });

  it('builds remove protocol selector for a given protocol key', () => {
    expect(emRemoveProtocolSel('http')).toBe('[data-testid="em-remove-protocol-http"]');
    expect(emRemoveProtocolSel('grpc')).toBe('[data-testid="em-remove-protocol-grpc"]');
  });

  it('builds workspace default selectors for a given key', () => {
    expect(emWsDefaultRowSel('requestId')).toBe('[data-testid="em-ws-default-row-requestId"]');
    expect(emWsDefaultRowValueSel('requestId')).toBe('[data-testid="em-ws-default-row-value-requestId"]');
    expect(emWsDefaultDeleteSel('requestId')).toBe('[data-testid="em-ws-default-delete-requestId"]');
  });
});
