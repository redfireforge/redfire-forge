/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../demoRipple', () => ({ showSpotlightRing: () => () => {} }));
vi.mock('../../adapters', () => ({
  ensureSettingsEnvironment: vi.fn(() => 'env-demo'),
  removeSettingsEnvironment: vi.fn(),
  ensureSettingsMicroservice: vi.fn(),
  removeSettingsMicroservice: vi.fn(),
}));
vi.mock('../../adapters/bridgeWindow', () => ({
  getDemoBridgeWindow: () => ({ __demoDeleteFeatureGroupsByName: vi.fn() }),
}));
vi.mock('../setup-helpers', () => ({ fillControlledInput: vi.fn() }));
vi.mock('./req-demo-helpers', () => ({
  ensureRequestsTab: vi.fn(),
  triggerContextMenu: vi.fn(),
  dismissContextMenu: vi.fn(),
  shrinkAllCollections: vi.fn(async () => {}),
  selectRequestByName: vi.fn(async () => {}),
  ensureCollectionExpanded: vi.fn(async () => {}),
  closeExtraRequestTabs: vi.fn(async () => {}),
  fillNewRequestPrompt: vi.fn(async () => {}),
  cleanupOtherRequestDemoCollections: vi.fn(async () => {}),
}));

import { reqSendHarnessLesson } from './req-send-harness';
import { apiLessons } from './index';
import { makeCtx } from '../protocols/ws-test-utils';

describe('req-send-harness lesson', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has the expected identity and registration', () => {
    expect(reqSendHarnessLesson.id).toBe('req-send-harness');
    expect(reqSendHarnessLesson.domainId).toBe('api');
    expect(reqSendHarnessLesson.category).toBe('requests');
    expect(reqSendHarnessLesson.name).toBe('Send to Harness (Promotion)');
    expect(reqSendHarnessLesson.estimatedMinutes).toBe(7);
    expect(reqSendHarnessLesson.allowedTabs).toEqual(['requests', 'environments', 'scenarios']);
    expect(apiLessons).toContain(reqSendHarnessLesson);
  });

  it('has the seven promotion steps in order', () => {
    expect(reqSendHarnessLesson.steps.map((step) => step.id)).toEqual([
      'req5-env',
      'req5-setup',
      'req5-promote',
      'req5-confirm',
      'req5-explore',
      'req5-edit',
      'req5-batch',
    ]);
  });

  it('declares the promotion concept terms', () => {
    const terms = reqSendHarnessLesson.concept.keyTerms?.map((term) => term.term) ?? [];
    expect(terms).toContain('Feature Group');
    expect(terms).toContain('Scenario');
    expect(terms).toContain('Test');
    expect(terms).toContain('Promotion');
    expect(terms).toContain('Auth Mode');
    expect(terms).toContain('IN HARNESS Badge');
  });

  it('setup and cleanup navigate back to requests', async () => {
    const ctx = makeCtx();
    await reqSendHarnessLesson.setup?.(ctx);
    await reqSendHarnessLesson.cleanup?.(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('requests');
  });
});