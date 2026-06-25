/**
 * @vitest-environment jsdom
 */
/**
 * GQL-4..13 quality audit — bar defined by enhancement-complete GQL-1 / GQL-2 (§3.5–3.6).
 * Fails CI when a shipped lesson regresses diagram, pacing, or guard patterns.
 */
import { describe, it, expect } from 'vitest';
import type { DemoLesson } from '../../types';
import { gqlAuthHeadersLesson } from './graphql-auth-headers';
import { gqlHttpsTlsLesson } from './graphql-https-tls';
import { gqlMutationsLesson } from './graphql-mutations';
import { gqlSubscriptionsLesson } from './graphql-subscriptions';
import { gqlQueryBuilderLesson } from './graphql-query-builder';
import { gqlCollectionsHistoryLesson } from './graphql-collections-history';
import { gqlExportShareLesson } from './graphql-export-share';
import { gqlPerformanceTracingLesson } from './graphql-performance-tracing';
import { gqlSchemaDiffLesson } from './graphql-schema-diff';
import { gqlMockServerLesson } from './graphql-mock-server';
import { gqlFirstQueryLesson } from './graphql-first-query';
import { gqlVariablesLesson } from './graphql-variables';

const REFERENCE_LESSONS: DemoLesson[] = [gqlFirstQueryLesson, gqlVariablesLesson];

const AUDIT_LESSONS: Array<{ slot: number; lesson: DemoLesson }> = [
  { slot: 4, lesson: gqlAuthHeadersLesson },
  { slot: 5, lesson: gqlHttpsTlsLesson },
  { slot: 6, lesson: gqlMutationsLesson },
  { slot: 7, lesson: gqlSubscriptionsLesson },
  { slot: 8, lesson: gqlQueryBuilderLesson },
  { slot: 9, lesson: gqlCollectionsHistoryLesson },
  { slot: 10, lesson: gqlExportShareLesson },
  { slot: 11, lesson: gqlPerformanceTracingLesson },
  { slot: 12, lesson: gqlSchemaDiffLesson },
  { slot: 13, lesson: gqlMockServerLesson },
];

function minEstimatedMinutes(stepCount: number): number {
  return Math.max(3, Math.ceil((stepCount * 30) / 60));
}

function assertGql12Bar(lesson: DemoLesson, label: string): void {
  expect(lesson.concept?.title?.length ?? 0, `${label} concept.title`).toBeGreaterThan(10);
  expect(lesson.concept?.body?.length ?? 0, `${label} concept.body`).toBeGreaterThan(120);
  expect(lesson.concept?.keyTerms?.length ?? 0, `${label} keyTerms`).toBeGreaterThanOrEqual(4);
  expect(lesson.concept?.diagram ?? '', `${label} diagram`).toContain('viewBox="0 0 700 430"');

  expect(lesson.estimatedMinutes, `${label} estimatedMinutes`).toBeGreaterThanOrEqual(
    minEstimatedMinutes(lesson.steps.length),
  );

  for (const step of lesson.steps) {
    expect(step.highlight, `${label} ${step.id} highlight`).toBeTruthy();
    const hasPause =
      step.pauseAfter === true
      || (typeof step.pauseAfter === 'number' && step.pauseAfter > 0);
    expect(hasPause, `${label} ${step.id} pauseAfter`).toBe(true);
    if (step.action && !step.id.endsWith('-intro')) {
      expect(step.preAction, `${label} ${step.id} preAction`).toBeTypeOf('function');
    }
    if (!step.id.endsWith('-intro')) {
      expect(step.description.length, `${label} ${step.id} description`).toBeGreaterThan(80);
    }
  }

  if (lesson.initialTab === 'graphql') {
    expect(lesson.setup, `${label} setup`).toBeTypeOf('function');
    expect(lesson.cleanup, `${label} cleanup`).toBeTypeOf('function');
  }
}

describe('GQL lesson quality audit — reference bar (GQL-1, GQL-2)', () => {
  it('reference lessons satisfy the audit bar', () => {
    for (const lesson of REFERENCE_LESSONS) {
      assertGql12Bar(lesson, lesson.id);
    }
  });
});

describe('GQL-4..13 quality audit (GQL-1/GQL-2 bar)', () => {
  for (const { slot, lesson } of AUDIT_LESSONS) {
    describe(`GQL-${slot} ${lesson.id}`, () => {
      it('meets enhancement-complete bar', () => {
        assertGql12Bar(lesson, `GQL-${slot}`);
      });
    });
  }
});
