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
  LESSON14_TAB2_BADGE,
} from './graphql-multi-tab.testHelpers';
import { gqlMultiTabLesson } from './graphql-multi-tab';
import { GQL } from '@shared/selectors';
import {
  demonstrateLesson14AddSecondTab,
  ensureLesson14TabPolling,
  ensureLesson14PerTabAuthConfigured,
  LESSON14_PRODUCTION_PROFILE_NAME,
} from './graphql-lesson-helpers';

describe('gql-multi-tab lesson — spotlights', () => {
  beforeEach(() => {
    setupGraphqlMultiTabBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlMultiTabAfterEach();
  });

// ── Step spotlights ────────────────────────────────────────────────────────

  it('gql14-intro highlights TAB_BAR', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-intro')!;
    expect(step.highlight).toBe(GQL.TAB_BAR);
  });

  it('gql14-tab1-endpoint uses action spotlights (no frozen highlight)', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab1-endpoint')!;
    expect(step.highlight).toBeUndefined();
    expect(step.action).toBeTypeOf('function');
  });

  it('gql14-add-tab2 highlights TAB_ADD_BTN and verifies new Tab 2', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-add-tab2')!;
    expect(step.highlight).toBe(GQL.TAB_ADD_BTN);
    expect(step.verify).toBe(GQL.LESSON14_TAB2);
    expect(step.action).toBe(demonstrateLesson14AddSecondTab);
  });

  it('gql14-tab2-endpoint uses action spotlights and verifies schema badge', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab2-endpoint')!;
    expect(step.highlight).toBeUndefined();
    expect(step.verify).toBe(GQL.SCHEMA_BADGE_OK);
  });

  it('gql14-switch-responses uses action spotlights and verifies response body', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-switch-responses')!;
    expect(step.highlight).toBeUndefined();
    expect(step.verify).toBe(GQL.RESPONSE_BODY);
    expect(step.pauseAfter).toBe(6000);
  });

  it('gql14-tab-badge highlights demo Tab 2 endpoint badge', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab-badge')!;
    expect(step.highlight).toBe(LESSON14_TAB2_BADGE);
    expect(step.verify).toBe(LESSON14_TAB2_BADGE);
  });

  it('gql14-real-world uses action spotlights for Staging/Production compare', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-real-world')!;
    expect(step.highlight).toBeUndefined();
  });

  it('gql14-profiles-save uses action spotlights and saves with Not linked pause', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-profiles-save')!;
    expect(step.highlight).toBeUndefined();
    expect(step.verify).toBe(GQL.PROFILE_MODAL);
    expect(step.preAction).toBe(ensureLesson14PerTabAuthConfigured);
    expect(step.description).toContain('Not linked to any tab');
    expect(step.description).toContain('Load');
    expect(step.pauseAfter).toBe(6000);
  });

  it('gql14-profiles-load uses action spotlights and verifies profile modal', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-profiles-load')!;
    expect(step.highlight).toBeUndefined();
    expect(step.verify).toBe(GQL.PROFILE_MODAL);
    expect(step.description).toContain('Load');
    expect(step.description).toContain('Used by');
    expect(step.description).not.toContain('Editing profile');
    expect(step.pauseAfter).toBe(6500);
  });

  it('gql14-profile-auth highlights inherit banner and verifies auth panel link', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-profile-auth')!;
    expect(step.highlight).toBe(GQL.AUTH_INHERIT_BANNER);
    expect(step.verify).toBe(GQL.AUTH_INHERIT_BANNER);
    expect(step.description).toContain('Editing profile');
    expect(step.pauseAfter).toBe(6000);
  });

  it('gql14-per-tab-auth uses action spotlights and verifies auth panel', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-per-tab-auth')!;
    expect(step.highlight).toBeUndefined();
    expect(step.verify).toBe(GQL.AUTH_PANEL);
    expect(step.preAction).toBeTypeOf('function');
    expect(step.pauseAfter).toBe(6500);
  });

  it('gql14-per-tab-auth description mentions per-tab auth', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-per-tab-auth')!;
    expect(step.description.toLowerCase()).toContain('per-tab');
  });

  it('gql14-polling uses action spotlights and verifies polling popover', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-polling')!;
    expect(step.highlight).toBeUndefined();
    expect(step.verify).toBe(GQL.POLLING_POPOVER);
    expect(step.preAction).toBe(ensureLesson14TabPolling);
  });

  // ── Step verify selectors ──────────────────────────────────────────────────

  it('gql14-tab1-endpoint verify is RESPONSE_BODY', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab1-endpoint')!;
    expect(step.verify).toBe(GQL.RESPONSE_BODY);
  });

  it('gql14-tab2-endpoint verify is SCHEMA_BADGE_OK', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab2-endpoint')!;
    expect(step.verify).toBe(GQL.SCHEMA_BADGE_OK);
  });

  it('gql14-add-tab2 verify is LESSON14_TAB2', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-add-tab2')!;
    expect(step.verify).toBe(GQL.LESSON14_TAB2);
  });

  it('gql14-switch-responses verify is RESPONSE_BODY', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-switch-responses')!;
    expect(step.verify).toBe(GQL.RESPONSE_BODY);
  });

  // ── Step description WHY content ───────────────────────────────────────────

  it('gql14-intro description explains WHY tabs beat separate windows', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-intro')!;
    expect(step.description).toContain('share state');
    expect(step.description).toContain('sidebar');
  });

  it('gql14-tab1-endpoint description explains WHY env-var is the page default', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab1-endpoint')!;
    expect(step.description).toContain('page-level default');
    expect(step.description).toContain('badge');
  });

  it('gql14-add-tab2 description explains WHY Tab 2 has no hostname subtitle yet', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-add-tab2')!;
    expect(step.description).toContain('no hostname subtitle');
    expect(step.description).toContain('schema badge');
  });

  it('gql14-tab2-endpoint description explains WHY this is a per-tab override', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab2-endpoint')!;
    expect(step.description).toContain('override');
    expect(step.description).toContain('cross-contaminate');
  });

  it('gql14-switch-responses description explains WHY per-tab caching is useful', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-switch-responses')!;
    expect(step.description).toContain('compare');
    expect(step.description).toContain('re-running');
  });

  it('gql14-tab-badge description explains hostname subtitle on overridden tabs', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-tab-badge')!;
    expect(step.description).toContain('localhost:4010');
    expect(step.description).toContain('second line');
    expect(step.description).toContain('page default');
  });

  it('gql14-real-world description explains staging vs production workflow', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-real-world')!;
    expect(step.description).toContain('Staging');
    expect(step.description).toContain('Production');
  });

  it('gql14-profiles-load description explains Load wires Used by', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-profiles-load')!;
    expect(step.description).toContain('connectionId');
    expect(step.description).not.toContain('Editing profile');
  });

  it('gql14-profile-auth description explains profile-linked auth editing', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-profile-auth')!;
    expect(step.description).toContain('Editing profile');
    expect(step.description).toContain(LESSON14_PRODUCTION_PROFILE_NAME);
  });

  it('gql14-polling description explains per-tab polling follows active tab', () => {
    const step = gqlMultiTabLesson.steps.find((s) => s.id === 'gql14-polling')!;
    expect(step.description).toContain('active');
    expect(step.description).toMatch(/polling/i);
  });
});
