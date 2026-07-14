/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./graphql-lesson-helpers/gql-demo-tab', () => ({
  ensureGqlDemoTab: vi.fn(async () => 'demo-tab-gql7'),
  closeGqlDemoTabs: vi.fn(async () => {}),
}));

import {
  setupGraphqlSubscriptionsBeforeEach,
  teardownGraphqlSubscriptionsAfterEach,
} from './graphql-subscriptions.testHelpers';
import { gqlSubscriptionsLesson } from './graphql-subscriptions';
import { GQL } from '@shared/selectors';
describe('gql-subscriptions lesson', () => {
  beforeEach(() => {
    setupGraphqlSubscriptionsBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlSubscriptionsAfterEach();
  });

afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has valid lesson structure', () => {
    expect(gqlSubscriptionsLesson.id).toBe('gql-subscriptions');
    expect(gqlSubscriptionsLesson.domainId).toBe('protocols');
    expect(gqlSubscriptionsLesson.category).toBe('graphql');
    expect(gqlSubscriptionsLesson.name).toBe('Subscriptions — Real-Time Data');
    expect(gqlSubscriptionsLesson.steps.length).toBe(15);
    expect(gqlSubscriptionsLesson.estimatedMinutes).toBe(8);
    expect(gqlSubscriptionsLesson.initialTab).toBe('graphql-studio');
    expect(gqlSubscriptionsLesson.tabBudget).toBe(1);
  });

  it('has docker prerequisite fields for port 4010 test server', () => {
    expect(gqlSubscriptionsLesson.tag).toBe('🐳 Docker');
    expect(gqlSubscriptionsLesson.dockerEndpoint).toContain('localhost:4010');
    expect(gqlSubscriptionsLesson.dockerCommand).toContain('docker/graphql');
  });

  it('has setup and cleanup functions', () => {
    expect(typeof gqlSubscriptionsLesson.setup).toBe('function');
    expect(typeof gqlSubscriptionsLesson.cleanup).toBe('function');
  });

  it('has correct step IDs in order', () => {
    const ids = gqlSubscriptionsLesson.steps.map((s) => s.id);
    expect(ids).toEqual([
      'gql5-intro',
      'gql5-connection-bar',
      'gql5-endpoint',
      'gql5-create-order',
      'gql5-exec-create-order',
      'gql5-observe-create-order',
      'gql5-write-sub',
      'gql5-transport-select',
      'gql5-subscription-auth',
      'gql5-subscribe',
      'gql5-watch-log',
      'gql5-pause',
      'gql5-filter',
      'gql5-assertions',
      'gql5-disconnect',
    ]);
  });

  it('all 15 steps have pauseAfter: true', () => {
    gqlSubscriptionsLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps 2–15 have preAction guards', () => {
    gqlSubscriptionsLesson.steps.slice(1).forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  it('step gql5-intro has preAction for demo endpoint', () => {
    expect(gqlSubscriptionsLesson.steps[0].preAction).toBeTypeOf('function');
  });

  // ─── Spotlight / highlight correctness ───────────────────────────────────

  it('gql5-intro highlights connection bar (Subscribe orientation)', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-intro')!;
    expect(step.highlight).toBe(GQL.CONNECTION_BAR);
  });

  it('gql5-connection-bar highlights connection bar (Subscribe button tour)', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-connection-bar')!;
    expect(step.highlight).toBe(GQL.CONNECTION_BAR);
  });

  it('gql5-endpoint highlights endpoint input for URL + introspect', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-endpoint')!;
    expect(step.highlight).toBe(GQL.ENDPOINT_INPUT);
  });

  it('gql5-transport-select highlights transport select dropdown', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-transport-select')!;
    expect(step.highlight).toBe(GQL.TRANSPORT_SELECT);
  });

  it('gql5-subscription-auth highlights auth preview row', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-subscription-auth')!;
    expect(step.highlight).toBe(GQL.AUTH_PREVIEW);
    expect(step.verify).toBe(GQL.AUTH_PREVIEW);
  });

  it('gql5-subscribe highlights subscribe button', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-subscribe')!;
    expect(step.highlight).toBe(GQL.SUBSCRIBE_BTN);
  });

  it('gql5-disconnect highlights stop subscription button', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-disconnect')!;
    expect(step.highlight).toBe(GQL.STOP_SUB_BTN);
  });

  it('gql5-observe-create-order highlights compact data.createOrder card', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-observe-create-order')!;
    expect(step.highlight).toBe(GQL.RESPONSE_DATA_CREATE_ORDER);
    expect(step.verify).toBe(GQL.RESPONSE_DATA_CREATE_ORDER);
    expect(step.description).toContain('data.createOrder.id');
  });

  // ─── Concept ────────────────────────────────────────────────────────────

  it('concept body explains WHY subscriptions differ from queries', () => {
    expect(gqlSubscriptionsLesson.concept.body).toContain('server-initiated');
    expect(gqlSubscriptionsLesson.concept.body).toContain('real-time');
  });

  it('concept body explains graphql-transport-ws vs graphql-ws', () => {
    expect(gqlSubscriptionsLesson.concept.body).toContain('graphql-transport-ws');
    expect(gqlSubscriptionsLesson.concept.body).toContain('graphql-ws');
  });

  it('concept diagram is 700×430 studio chrome SVG with Subscribe button and log', () => {
    const diag = gqlSubscriptionsLesson.concept.diagram;
    expect(diag).toContain('viewBox="0 0 700 430"');
    expect(diag).toContain('GraphQL Studio — Subscriptions');
    expect(diag).toContain('Subscribe');
    expect(diag).toContain('LIVE');
    expect(diag).toContain('PENDING');
    expect(diag).toContain('COMPLETE');
  });

  it('concept diagram shows purple S badge color', () => {
    expect(gqlSubscriptionsLesson.concept.diagram).toContain('#7c3aed');
  });

  it('concept keyTerms cover Subscription, transport, message log, assertions', () => {
    const terms = (gqlSubscriptionsLesson.concept.keyTerms ?? []).map((t) => t.term);
    expect(terms).toContain('Subscription');
    expect(terms).toContain('graphql-transport-ws');
    expect(terms).toContain('Message log');
    expect(terms).toContain('Subscription assertion');
  });

  // ─── Step description content ────────────────────────────────────────────

  it('gql5-intro description explains server-push and S badge', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-intro')!;
    expect(step.description).toContain('S');
    expect(step.description).toContain('subscription');
  });

  it('gql5-connection-bar description explains transport dropdown and Subscribe button', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-connection-bar')!;
    expect(step.description).toContain('Transport');
    expect(step.description).toContain('Subscribe');
  });

  it('gql5-transport-select description explains both sub-protocols', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-transport-select')!;
    expect(step.description).toContain('graphql-transport-ws');
    expect(step.description).toContain('graphql-ws');
  });

  it('gql5-create-order description explains why orderId is required', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-create-order')!;
    expect(step.description).toContain('orderId');
    expect(step.description).toContain('createOrder');
  });

  it('gql5-write-sub description explains S badge switch', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-write-sub')!;
    expect(step.description).toContain('subscription');
    expect(step.description).toContain('$orderId');
  });

  it('gql5-assertions description explains re-subscribe and pass/fail badges', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-assertions')!;
    expect(step.description).toContain('COMPLETE');
    expect(step.description).toContain('$.orderStatus.status');
    expect(step.description.toLowerCase()).toContain('re-subscrib');
    expect(step.verify).toBe(GQL.ASSERTION_BADGE);
  });

  it('gql5-disconnect description explains log persists after stop', () => {
    const step = gqlSubscriptionsLesson.steps.find((s) => s.id === 'gql5-disconnect')!;
    expect(step.description).toContain('log');
    expect(step.description).toContain('Stop');
  });
});
