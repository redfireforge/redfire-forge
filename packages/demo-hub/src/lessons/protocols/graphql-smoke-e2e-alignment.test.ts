/**
 * Guards e2e/graphql-lesson-smoke-helpers.ts against lesson metadata drift.
 * Smoke walk loops use hardcoded step counts — they must match live lesson definitions.
 *
 * Avoid importing lesson modules here — barrels pull tabPersistence → monaco-graphql (no window in node).
 */
import { describe, it, expect } from 'vitest';
import {
  GQL1_LESSON,
  GQL2_LESSON,
  GQL3_LESSON,
  GQL4_LESSON,
  GQL5_LESSON,
  GQL6_LESSON,
  GQL7_LESSON,
  GQL8_LESSON,
  GQL9_LESSON,
  GQL10_LESSON,
  GQL11_LESSON,
  GQL12_LESSON,
  GQL13_LESSON,
  GQL14_LESSON,
  GQL15_LESSON,
  GQL16_LESSON,
  GQL17_LESSON,
  GQL18_LESSON,
  GQL19_LESSON,
} from '../../../../../e2e/graphql-lesson-smoke-helpers';

/** Canonical step counts — keep in sync with lesson files (§3.1 / §9.5). */
const GQL1_LESSON_SOURCE = { name: 'Your First GraphQL Query', steps: 13 } as const;
const GQL2_LESSON_SOURCE = { name: 'Variables & Arguments', steps: 18 } as const;
const GQL3_LESSON_SOURCE = { name: 'Schema Exploration', steps: 10 } as const;
const GQL4_LESSON_SOURCE = { name: 'Authentication & Headers', steps: 14 } as const;
const GQL5_LESSON_SOURCE = {
  name: 'HTTPS, TLS & Certificates',
  steps: 16,
} as const;

const GQL6_LESSON_SOURCE = {
  name: 'Mutations — Create, Update, Delete',
  steps: 19,
} as const;

/** Step metadata from graphql-subscriptions (avoid barrel import — pulls monaco in node vitest). */
const GQL7_LESSON_SOURCE = {
  name: 'Subscriptions — Real-Time Data',
  steps: 15,
} as const;

/** Step metadata from graphql-query-builder (avoid barrel import — pulls monaco in node vitest). */
const GQL8_LESSON_SOURCE = {
  name: 'Query Builder — Visual Operations',
  steps: 11,
} as const;

/** Step metadata from graphql-collections-history (avoid barrel import — pulls monaco in node vitest). */
const GQL9_LESSON_SOURCE = {
  name: 'Collections & History',
  steps: 11,
} as const;

/** Step metadata from graphql-export-share (avoid barrel import — pulls monaco in node vitest). */
const GQL10_LESSON_SOURCE = {
  name: 'Export & Share Queries',
  steps: 7,
} as const;

/** Step metadata from graphql-performance-tracing (avoid barrel import — pulls monaco in node vitest). */
const GQL11_LESSON_SOURCE = {
  name: 'Performance Tracing',
  steps: 8,
} as const;

/** Step metadata from graphql-schema-diff (avoid barrel import — pulls monaco in node vitest). */
const GQL12_LESSON_SOURCE = {
  name: 'Schema Diff & Breaking Changes',
  steps: 7,
} as const;

/** Step metadata from graphql-mock-server (avoid barrel import — pulls monaco in node vitest). */
const GQL13_LESSON_SOURCE = {
  name: 'Mock Server',
  steps: 15,
} as const;

const GQL14_LESSON_SOURCE = {
  name: 'Multi-Tab Workspaces',
  steps: 10,
} as const;

const GQL15_LESSON_SOURCE = {
  name: 'Batch Execution',
  steps: 9,
} as const;

const GQL16_LESSON_SOURCE = {
  name: 'Workflow Integration',
  steps: 12,
} as const;

const GQL17_LESSON_SOURCE = {
  name: 'Workflow Runner & Results',
  steps: 10,
} as const;

const GQL18_LESSON_SOURCE = {
  name: 'Mutation Node in Workflow',
  steps: 8,
} as const;

const GQL19_LESSON_SOURCE = {
  name: 'Subscription Node in Workflow',
  steps: 9,
} as const;

describe('GQL smoke E2E — lesson metadata alignment', () => {
  it('GQL-1 smoke constants match graphql-first-query lesson', () => {
    expect(GQL1_LESSON.name).toBe(GQL1_LESSON_SOURCE.name);
    expect(GQL1_LESSON.steps).toBe(GQL1_LESSON_SOURCE.steps);
  });

  it('GQL-2 smoke constants match graphql-variables lesson', () => {
    expect(GQL2_LESSON.name).toBe(GQL2_LESSON_SOURCE.name);
    expect(GQL2_LESSON.steps).toBe(GQL2_LESSON_SOURCE.steps);
  });

  it('GQL-3 smoke constants match graphql-schema-exploration lesson', () => {
    expect(GQL3_LESSON.name).toBe(GQL3_LESSON_SOURCE.name);
    expect(GQL3_LESSON.steps).toBe(GQL3_LESSON_SOURCE.steps);
  });

  it('GQL-4 smoke constants match graphql-auth-headers lesson', () => {
    expect(GQL4_LESSON.name).toBe(GQL4_LESSON_SOURCE.name);
    expect(GQL4_LESSON.steps).toBe(GQL4_LESSON_SOURCE.steps);
  });

  it('GQL-5 smoke constants match graphql-https-tls lesson', () => {
    expect(GQL5_LESSON.name).toBe(GQL5_LESSON_SOURCE.name);
    expect(GQL5_LESSON.steps).toBe(GQL5_LESSON_SOURCE.steps);
  });

  it('GQL-6 smoke constants match graphql-mutations lesson', () => {
    expect(GQL6_LESSON.name).toBe(GQL6_LESSON_SOURCE.name);
    expect(GQL6_LESSON.steps).toBe(GQL6_LESSON_SOURCE.steps);
  });

  it('GQL-7 smoke constants match graphql-subscriptions lesson', () => {
    expect(GQL7_LESSON.name).toBe(GQL7_LESSON_SOURCE.name);
    expect(GQL7_LESSON.steps).toBe(GQL7_LESSON_SOURCE.steps);
  });

  it('GQL-8 smoke constants match graphql-query-builder lesson', () => {
    expect(GQL8_LESSON.name).toBe(GQL8_LESSON_SOURCE.name);
    expect(GQL8_LESSON.steps).toBe(GQL8_LESSON_SOURCE.steps);
  });

  it('GQL-9 smoke constants match graphql-collections-history lesson', () => {
    expect(GQL9_LESSON.name).toBe(GQL9_LESSON_SOURCE.name);
    expect(GQL9_LESSON.steps).toBe(GQL9_LESSON_SOURCE.steps);
  });

  it('GQL-10 smoke constants match graphql-export-share lesson', () => {
    expect(GQL10_LESSON.name).toBe(GQL10_LESSON_SOURCE.name);
    expect(GQL10_LESSON.steps).toBe(GQL10_LESSON_SOURCE.steps);
  });

  it('GQL-11 smoke constants match graphql-performance-tracing lesson', () => {
    expect(GQL11_LESSON.name).toBe(GQL11_LESSON_SOURCE.name);
    expect(GQL11_LESSON.steps).toBe(GQL11_LESSON_SOURCE.steps);
  });

  it('GQL-12 smoke constants match graphql-schema-diff lesson', () => {
    expect(GQL12_LESSON.name).toBe(GQL12_LESSON_SOURCE.name);
    expect(GQL12_LESSON.steps).toBe(GQL12_LESSON_SOURCE.steps);
  });

  it('GQL-13 smoke constants match graphql-mock-server lesson', () => {
    expect(GQL13_LESSON.name).toBe(GQL13_LESSON_SOURCE.name);
    expect(GQL13_LESSON.steps).toBe(GQL13_LESSON_SOURCE.steps);
  });

  it('GQL-14 smoke constants match graphql-multi-tab lesson', () => {
    expect(GQL14_LESSON.name).toBe(GQL14_LESSON_SOURCE.name);
    expect(GQL14_LESSON.steps).toBe(GQL14_LESSON_SOURCE.steps);
  });

  it('GQL-15 smoke constants match graphql-batch-execution lesson', () => {
    expect(GQL15_LESSON.name).toBe(GQL15_LESSON_SOURCE.name);
    expect(GQL15_LESSON.steps).toBe(GQL15_LESSON_SOURCE.steps);
  });

  it('GQL-16 smoke constants match graphql-workflow-integration lesson', () => {
    expect(GQL16_LESSON.name).toBe(GQL16_LESSON_SOURCE.name);
    expect(GQL16_LESSON.steps).toBe(GQL16_LESSON_SOURCE.steps);
  });

  it('GQL-17 smoke constants match graphql-workflow-runner lesson', () => {
    expect(GQL17_LESSON.name).toBe(GQL17_LESSON_SOURCE.name);
    expect(GQL17_LESSON.steps).toBe(GQL17_LESSON_SOURCE.steps);
  });

  it('GQL-18 smoke constants match graphql-workflow-mutation lesson', () => {
    expect(GQL18_LESSON.name).toBe(GQL18_LESSON_SOURCE.name);
    expect(GQL18_LESSON.steps).toBe(GQL18_LESSON_SOURCE.steps);
  });

  it('GQL-19 smoke constants match graphql-workflow-subscription lesson', () => {
    expect(GQL19_LESSON.name).toBe(GQL19_LESSON_SOURCE.name);
    expect(GQL19_LESSON.steps).toBe(GQL19_LESSON_SOURCE.steps);
  });
});
