/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql13'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import {
  setupGraphqlMockServerBeforeEach,
  teardownGraphqlMockServerAfterEach,
} from './graphql-mock-server.testHelpers';
import { gqlMockServerLesson } from './graphql-mock-server';
import { GQL } from '@shared/selectors';
import {LESSON13_MOCK_HEALTH_FIXED,
  LESSON13_MOCK_HEALTH_RESOLVER,
} from './graphql-lesson-helpers';

describe('gql-mock-server lesson', () => {
  beforeEach(() => {
    setupGraphqlMockServerBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlMockServerAfterEach();
  });

// ── Lesson structure ───────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlMockServerLesson.id).toBe('gql-mock-server');
    expect(gqlMockServerLesson.category).toBe('graphql');
    expect(gqlMockServerLesson.name).toBe('Mock Server');
    expect(gqlMockServerLesson.steps.length).toBe(15);
    expect(gqlMockServerLesson.estimatedMinutes).toBe(8);
    expect(gqlMockServerLesson.tabBudget).toBe(1);
  });

  it('has docker prerequisite fields', () => {
    expect(gqlMockServerLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlMockServerLesson.tag).toBe('🐳 Docker · 🖥 Desktop');
    expect(gqlMockServerLesson.desktopOnly).toBe(true);
  });

  it('has correct step IDs in order', () => {
    expect(gqlMockServerLesson.steps.map((s) => s.id)).toEqual([
      'gql13-open-mock',
      'gql13-enable-mock',
      'gql13-schema-source',
      'gql13-mock-endpoint',
      'gql13-mock-introspect',
      'gql13-resolver-fixed',
      'gql13-fixed-value',
      'gql13-resolver-types',
      'gql13-execute-mock',
      'gql13-observe-response',
      'gql13-latency-slider',
      'gql13-observe-latency',
      'gql13-disable-mock',
      'gql13-restore-endpoint',
      'gql13-read-live',
    ]);
  });

  it('all 15 steps have pauseAfter: true', () => {
    gqlMockServerLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards except the intro step', () => {
    gqlMockServerLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  // ── Concept content ────────────────────────────────────────────────────────

  it('concept title positions mock as test-without-backend feature', () => {
    expect(gqlMockServerLesson.concept.title).toContain('Mock Server');
    expect(gqlMockServerLesson.concept.title).toContain('Test Without');
  });

  it('concept body explains WHY local proxy beats shared test servers', () => {
    expect(gqlMockServerLesson.concept.body).toContain('deterministic');
    expect(gqlMockServerLesson.concept.body).toContain('flaky');
  });

  it('concept body explains WHY introspection is required first', () => {
    expect(gqlMockServerLesson.concept.body).toContain('contract');
    expect(gqlMockServerLesson.concept.body).toContain('introspect');
  });

  it('concept body explains all four resolver types', () => {
    expect(gqlMockServerLesson.concept.body).toContain('Random');
    expect(gqlMockServerLesson.concept.body).toContain('Fixed');
    expect(gqlMockServerLesson.concept.body).toContain('Error');
    expect(gqlMockServerLesson.concept.body).toContain('Script');
  });

  it('concept body explains WHY latency simulation is important', () => {
    expect(gqlMockServerLesson.concept.body).toContain('loading spinner');
    expect(gqlMockServerLesson.concept.body).toContain('skeleton screen');
  });

  it('concept body explains WHY mock is desktop-only', () => {
    expect(gqlMockServerLesson.concept.body).toContain('TCP');
    expect(gqlMockServerLesson.concept.body).toContain('Tauri');
  });

  it('has exactly 5 key terms', () => {
    expect(gqlMockServerLesson.concept.keyTerms.length).toBe(5);
  });

  it('key terms cover: Mock mode, Resolver override, Schema source, Latency simulation, Mock endpoint', () => {
    const terms = gqlMockServerLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Mock mode');
    expect(terms).toContain('Resolver override');
    expect(terms).toContain('Schema source');
    expect(terms).toContain('Latency simulation');
    expect(terms).toContain('Mock endpoint');
  });

  it('Mock endpoint key term contains the mock URL', () => {
    const term = gqlMockServerLesson.concept.keyTerms.find((k) => k.term === 'Mock endpoint')!;
    expect(term.definition).toContain('3001');
  });

  it('Resolver override key term explains all override types', () => {
    const term = gqlMockServerLesson.concept.keyTerms.find((k) => k.term === 'Resolver override')!;
    expect(term.definition).toContain('Fixed');
    expect(term.definition).toContain('Error');
  });

  // ── Diagram ────────────────────────────────────────────────────────────────

  it('diagram has 700x430 studio chrome dimensions', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
  });

  it('diagram includes window chrome traffic lights', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('#ff5f57');
    expect(gqlMockServerLesson.concept.diagram).toContain('#febc2e');
    expect(gqlMockServerLesson.concept.diagram).toContain('#28c840');
  });

  it('diagram shows mock endpoint in connection bar', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('localhost:3001/api/graphql/mock');
    expect(gqlMockServerLesson.concept.diagram).toContain('Mock');
  });

  it('diagram shows mock panel with toggle card and Mock active badge', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('Mock mode ON');
    expect(gqlMockServerLesson.concept.diagram).toContain('Mock active');
    expect(gqlMockServerLesson.concept.diagram).toContain('Mock server');
  });

  it('diagram shows Fixed resolver on health field', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('health');
    expect(gqlMockServerLesson.concept.diagram).toContain('Fixed');
    expect(gqlMockServerLesson.concept.diagram).toContain('mock-ok');
  });

  it('diagram shows latency slider at 650ms', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('650 ms');
    expect(gqlMockServerLesson.concept.diagram).toContain('RESPONSE TIMING');
  });

  it('diagram shows response body with mock-ok value', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('"health"');
    expect(gqlMockServerLesson.concept.diagram).toContain('"mock-ok"');
    expect(gqlMockServerLesson.concept.diagram).toContain('Fixed resolver value');
  });

  it('diagram includes bottom pipeline legend', () => {
    expect(gqlMockServerLesson.concept.diagram).toContain('Enable');
    expect(gqlMockServerLesson.concept.diagram).toContain('Restore');
    expect(gqlMockServerLesson.concept.diagram).toContain('live :4010');
  });

  // ── Step spotlights (all 15) ───────────────────────────────────────────────

  it('gql13-open-mock highlights ACTIVITY_MOCK', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-open-mock')!;
    expect(step.highlight).toBe(GQL.ACTIVITY_MOCK);
  });

  it('gql13-enable-mock highlights MOCK_TOGGLE_CARD', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-enable-mock')!;
    expect(step.highlight).toBe(GQL.MOCK_TOGGLE_CARD);
  });

  it('gql13-schema-source highlights MOCK_SCHEMA_SOURCE', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-schema-source')!;
    expect(step.highlight).toBe(GQL.MOCK_SCHEMA_SOURCE);
  });

  it('gql13-mock-endpoint highlights ENDPOINT_INPUT', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-endpoint')!;
    expect(step.highlight).toBe(GQL.ENDPOINT_INPUT);
  });

  it('gql13-mock-introspect highlights INTROSPECT_BTN', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-introspect')!;
    expect(step.highlight).toBe(GQL.INTROSPECT_BTN);
  });

  it('gql13-resolver-fixed highlights health resolver select', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-resolver-fixed')!;
    expect(step.highlight).toBe(LESSON13_MOCK_HEALTH_RESOLVER);
  });

  it('gql13-fixed-value highlights health fixed input', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-fixed-value')!;
    expect(step.highlight).toBe(LESSON13_MOCK_HEALTH_FIXED);
  });

  it('gql13-resolver-types highlights MOCK_RESOLVERS_LIST', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-resolver-types')!;
    expect(step.highlight).toBe(GQL.MOCK_RESOLVERS_LIST);
  });

  it('gql13-execute-mock highlights EXECUTE_BTN', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-execute-mock')!;
    expect(step.highlight).toBe(GQL.EXECUTE_BTN);
  });

  it('gql13-observe-response highlights RESPONSE_BODY', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-response')!;
    expect(step.highlight).toBe(GQL.RESPONSE_BODY);
  });

  it('gql13-latency-slider highlights MOCK_LATENCY_SLIDER', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-latency-slider')!;
    expect(step.highlight).toBe(GQL.MOCK_LATENCY_SLIDER);
  });

  it('gql13-observe-latency highlights RESPONSE_LATENCY after slow execute', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-latency')!;
    expect(step.highlight).toBe(GQL.RESPONSE_LATENCY);
  });

  it('gql13-disable-mock highlights MOCK_TOGGLE_CARD', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-disable-mock')!;
    expect(step.highlight).toBe(GQL.MOCK_TOGGLE_CARD);
  });

  it('gql13-restore-endpoint highlights INTROSPECT_BTN', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-restore-endpoint')!;
    expect(step.highlight).toBe(GQL.INTROSPECT_BTN);
  });

  it('gql13-read-live highlights RESPONSE_BODY', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-read-live')!;
    expect(step.highlight).toBe(GQL.RESPONSE_BODY);
  });

  // ── Step descriptions WHY content ─────────────────────────────────────────

  it('gql13-open-mock description explains WHY mock has its own panel', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-open-mock')!;
    expect(step.description).toContain('dedicated activity panel');
  });

  it('gql13-enable-mock description explains WHY toggle matters', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-enable-mock')!;
    expect(step.description).toContain('3001');
    expect(step.description).toContain('listening');
  });

  it('gql13-schema-source description explains WHY schema source is needed', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-schema-source')!;
    expect(step.description).toContain('Introspected SDL');
    expect(step.description).toContain('validates');
  });

  it('gql13-mock-endpoint description explains endpoint comes before introspect', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-endpoint')!;
    expect(step.description).toContain('3001');
    expect(step.description).toContain('next step');
  });

  it('gql13-mock-introspect description explains introspect after URL change', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-introspect')!;
    expect(step.description).toContain('Introspect');
    expect(step.description).toContain('schema');
  });

  it('gql13-resolver-fixed description explains splitting type from value', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-resolver-fixed')!;
    expect(step.description).toContain('dropdown');
    expect(step.description).toContain('Fixed');
  });

  it('gql13-fixed-value description explains WHY Fixed beats Random', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-fixed-value')!;
    expect(step.description).toContain('deterministic');
    expect(step.description).toContain('mock-ok');
  });

  it('gql13-resolver-types description explains all four types', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-resolver-types')!;
    expect(step.description).toContain('Random');
    expect(step.description).toContain('Fixed');
    expect(step.description).toContain('Error');
    expect(step.description).toContain('Script');
  });

  it('gql13-execute-mock description explains WHY execute comes after override', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-execute-mock')!;
    expect(step.description).toContain('proof step');
    expect(step.description).toContain('end-to-end');
  });

  it('gql13-observe-response description explains WHY mock-ok is the key proof', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-response')!;
    expect(step.description).toContain('mock-ok');
    expect(step.description).toContain('sentinel');
  });

  it('gql13-latency-slider description explains slider before execute', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-latency-slider')!;
    expect(step.description).toContain('650');
    expect(step.description).toContain('slider');
  });

  it('gql13-observe-latency description explains WHY latency simulation matters', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-latency')!;
    expect(step.description).toContain('Loading spinners');
    expect(step.description).toContain('skeleton screens');
  });

  it('gql13-disable-mock description explains disable before restore', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-disable-mock')!;
    expect(step.description).toContain('OFF');
    expect(step.description).toContain('endpoint');
  });

  it('gql13-restore-endpoint description explains live URL restore', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-restore-endpoint')!;
    expect(step.description).toContain('4010');
    expect(step.description).toContain('Docker');
  });

  it('gql13-read-live description explains closing proof with live ok', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-read-live')!;
    expect(step.description).toContain('mock-ok');
    expect(step.description).toContain('"ok"');
  });

  // ── Verify selectors ───────────────────────────────────────────────────────

  it('gql13-enable-mock verify selector includes MOCK_STATUS_ROW', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-enable-mock')!;
    expect(step.verify).toContain(GQL.MOCK_STATUS_ROW);
    expect(step.verify).toContain(GQL.MOCK_GUARD);
  });

  it('gql13-mock-introspect verify selector is SCHEMA_BADGE_OK', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-mock-introspect')!;
    expect(step.verify).toBe(GQL.SCHEMA_BADGE_OK);
  });

  it('gql13-execute-mock verify selector is RESPONSE_BODY', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-execute-mock')!;
    expect(step.verify).toBe(GQL.RESPONSE_BODY);
  });

  it('gql13-observe-latency verify selector is RESPONSE_LATENCY', () => {
    const step = gqlMockServerLesson.steps.find((s) => s.id === 'gql13-observe-latency')!;
    expect(step.verify).toBe(GQL.RESPONSE_LATENCY);
  });
});
