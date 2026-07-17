/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql14'),
  closeGqlDemoTabs: vi.fn(async () => {}),
  GQL14_LESSON_ID: 'gql-multi-tab',
}));

import {
  setupGraphqlMultiTabBeforeEach,
  teardownGraphqlMultiTabAfterEach,
} from './graphql-multi-tab.testHelpers';
import { gqlMultiTabLesson } from './graphql-multi-tab';
describe('gql-multi-tab lesson', () => {
  beforeEach(() => {
    setupGraphqlMultiTabBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlMultiTabAfterEach();
  });

// ── Lesson structure ───────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlMultiTabLesson.id).toBe('gql-multi-tab');
    expect(gqlMultiTabLesson.category).toBe('graphql');
    expect(gqlMultiTabLesson.name).toBe('Multi-Tab Workspaces');
    expect(gqlMultiTabLesson.steps.length).toBe(12);
    expect(gqlMultiTabLesson.estimatedMinutes).toBe(9);
    expect(gqlMultiTabLesson.tabBudget).toBe(2);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlMultiTabLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlMultiTabLesson.tag).toBe('🐳 Docker');
  });

  it('has correct step IDs in order', () => {
    expect(gqlMultiTabLesson.steps.map((s) => s.id)).toEqual([
      'gql14-intro',
      'gql14-tab1-endpoint',
      'gql14-add-tab2',
      'gql14-tab2-endpoint',
      'gql14-switch-responses',
      'gql14-tab-badge',
      'gql14-real-world',
      'gql14-per-tab-auth',
      'gql14-profiles-save',
      'gql14-profiles-load',
      'gql14-profile-auth',
      'gql14-polling',
    ]);
  });

  it('all 12 steps have pauseAfter enabled', () => {
    gqlMultiTabLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBeTruthy();
    });
  });

  it('all steps have a preAction guard', () => {
    gqlMultiTabLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  // ── Concept content ────────────────────────────────────────────────────────

  it('concept title captures multi-tab as multi-environment workspace', () => {
    expect(gqlMultiTabLesson.concept.title).toContain('Multi-Tab');
    expect(gqlMultiTabLesson.concept.title).toContain('Environments');
  });

  it('concept body explains WHY tabs beat separate windows', () => {
    expect(gqlMultiTabLesson.concept.body).toContain('share state');
    expect(gqlMultiTabLesson.concept.body).toContain('isolated');
  });

  it('concept body explains WHY per-tab endpoint isolation matters', () => {
    expect(gqlMultiTabLesson.concept.body).toContain('cached response');
    expect(gqlMultiTabLesson.concept.body).toContain('introspecting');
  });

  it('concept body explains WHY badge appears only on overridden tabs', () => {
    expect(gqlMultiTabLesson.concept.body).toContain('page-level default');
    expect(gqlMultiTabLesson.concept.body).toContain('badge');
  });

  it('concept body explains WHY lesson comes after GQL-1..13', () => {
    expect(gqlMultiTabLesson.concept.body).toContain('staging and production');
  });

  it('has exactly 6 key terms', () => {
    expect(gqlMultiTabLesson.concept.keyTerms.length).toBe(6);
  });

  it('key terms cover: Tab workspace, endpoint override, badge, response cache, page-level default, per-tab auth', () => {
    const terms = gqlMultiTabLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Tab workspace');
    expect(terms).toContain('Per-tab endpoint override');
    expect(terms).toContain('Endpoint badge');
    expect(terms).toContain('Response cache (per tab)');
    expect(terms).toContain('Page-level default endpoint');
    expect(terms).toContain('Per-tab auth override');
  });

  it('Endpoint badge key term explains absence vs presence', () => {
    const term = gqlMultiTabLesson.concept.keyTerms.find((k) => k.term === 'Endpoint badge')!;
    expect(term.definition).toContain('default');
    expect(term.definition).toContain('Absent');
  });

  // ── Diagram ────────────────────────────────────────────────────────────────

  it('diagram has 700x430 studio chrome dimensions', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
  });

  it('diagram includes window chrome traffic lights', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain('#ff5f57');
    expect(gqlMultiTabLesson.concept.diagram).toContain('#febc2e');
    expect(gqlMultiTabLesson.concept.diagram).toContain('#28c840');
  });

  it('diagram shows tab bar with Staging and Production tabs', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain('Staging');
    expect(gqlMultiTabLesson.concept.diagram).toContain('Production');
  });

  it('diagram shows endpoint override badge on Tab 2', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain(':4010');
  });

  it('diagram shows both tab responses side by side', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain('Production ▸ Response');
    expect(gqlMultiTabLesson.concept.diagram).toContain('Staging ▸ Cached');
  });

  it('diagram shows tab isolation annotation', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain('own endpoint');
    expect(gqlMultiTabLesson.concept.diagram).toContain('caches persist');
  });

  it('diagram includes bottom pipeline legend', () => {
    expect(gqlMultiTabLesson.concept.diagram).toContain('Open Tab 2');
    expect(gqlMultiTabLesson.concept.diagram).toContain('Compare');
  });
});
