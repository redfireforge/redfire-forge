/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { reqQuickStartLesson } from './req-quick-start';
import { makeCtx } from '../protocols/ws-test-utils';

describe('req-quick-start lesson (v2)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('has expected quick-start identity', () => {
    expect(reqQuickStartLesson.id).toBe('req-quick-start');
    expect(reqQuickStartLesson.domainId).toBe('api');
    expect(reqQuickStartLesson.name).toBe('Quick Start');
    expect(reqQuickStartLesson.estimatedMinutes).toBe(3);
    expect(reqQuickStartLesson.steps).toHaveLength(4);
    expect(reqQuickStartLesson.allowedTabs).toEqual(['requests']);
  });

  it('has the 4 consolidated v2 steps (from scratch) in order', () => {
    const ids = reqQuickStartLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'req1-create-collection',
      'req1-add-request',
      'req1-send',
      'req1-explore',
    ]);
  });

  it('step 1 preAction navigates to requests tab', async () => {
    const ctx = makeCtx();
    const step = reqQuickStartLesson.steps[0];
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('requests');
  });

  it('step 2 preAction navigates to requests tab', async () => {
    const ctx = makeCtx();
    const step = reqQuickStartLesson.steps[1];
    await step.preAction!(ctx);
    expect(ctx.navigateToTab).toHaveBeenCalledWith('requests');
  });

  it('concept has 3 key terms', () => {
    expect(reqQuickStartLesson.concept.keyTerms).toHaveLength(3);
    const terms = reqQuickStartLesson.concept.keyTerms!.map((kt) => kt.term);
    expect(terms).toContain('Collection');
    expect(terms).toContain('Request');
    expect(terms).toContain('Response History');
  });

  it('does not reference gallery in allowedTabs', () => {
    expect(reqQuickStartLesson.allowedTabs).not.toContain('gallery');
  });
});
