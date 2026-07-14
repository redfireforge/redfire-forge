/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';



import {
  setupGraphqlWorkflowIntegrationBeforeEach,
  teardownGraphqlWorkflowIntegrationAfterEach,
} from './graphql-workflow-integration.testHelpers';
import { gqlWorkflowIntegrationLesson } from './graphql-workflow-integration';
import { GQL, WF } from '@shared/selectors';
describe('gql-workflow-integration lesson', () => {
  beforeEach(() => {
    setupGraphqlWorkflowIntegrationBeforeEach();
  });
  afterEach(async () => {
    await teardownGraphqlWorkflowIntegrationAfterEach();
  });

afterEach(() => {
    vi.unstubAllGlobals();
    delete (window as unknown as Record<string, unknown>).__wfConnect;
    delete (window as unknown as Record<string, unknown>).__wfOpenNodeConfig;
    delete (window as unknown as Record<string, unknown>).__wfDeleteByName;
    delete (window as unknown as Record<string, unknown>).__wfGetWorkflowByName;
    delete (window as unknown as Record<string, unknown>).__wfQuickTest;
  });

  // ── Lesson structure ──────────────────────────────────────────────────────

  it('has valid lesson structure', () => {
    expect(gqlWorkflowIntegrationLesson.id).toBe('gql-workflow-integration');
    expect(gqlWorkflowIntegrationLesson.category).toBe('graphql');
    expect(gqlWorkflowIntegrationLesson.name).toBe('Workflow Integration');
    expect(gqlWorkflowIntegrationLesson.steps.length).toBe(13);
    expect(gqlWorkflowIntegrationLesson.estimatedMinutes).toBe(8);
  });

  it('allows workflow and workflow-runner tabs', () => {
    expect(gqlWorkflowIntegrationLesson.allowedTabs).toContain('workflow');
    expect(gqlWorkflowIntegrationLesson.allowedTabs).toContain('workflow-runner');
    expect(gqlWorkflowIntegrationLesson.initialTab).toBe('workflow');
  });

  it('has correct step IDs in order', () => {
    expect(gqlWorkflowIntegrationLesson.steps.map((s) => s.id)).toEqual([
      'gql11-create',
      'gql11-workflow-variables',
      'gql11-query-node',
      'gql11-config-query',
      'gql11-assert-node',
      'gql11-assert-source',
      'gql11-assert-rule',
      'gql11-console',
      'gql11-run-pass-exec',
      'gql11-observe-pass',
      'gql11-tighten-threshold',
      'gql11-observe-failure',
      'gql11-debug-mode',
    ]);
  });

  it('all 13 steps have pauseAfter: true', () => {
    gqlWorkflowIntegrationLesson.steps.forEach((step) => {
      expect(step.pauseAfter).toBe(true);
    });
  });

  it('stateful steps have preAction guards', () => {
    gqlWorkflowIntegrationLesson.steps.forEach((step) => {
      expect(step.preAction).toBeTypeOf('function');
    });
  });

  // ── Concept content ───────────────────────────────────────────────────────

  it('concept title frames lesson as automation path', () => {
    expect(gqlWorkflowIntegrationLesson.concept.title).toContain('Workflow Integration');
    expect(gqlWorkflowIntegrationLesson.concept.title).toContain('Automated Test');
  });

  it('concept diagram uses fixed dark-theme hex palette (ConceptSlide-safe)', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('#0f172a');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).not.toContain('var(--');
  });

  it('concept body explains WHY GraphQL Query node vs generic HTTP', () => {
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('generic HTTP node');
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('latencyMs');
  });

  it('concept body explains WHY Output binding matters', () => {
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('Output binding');
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('isolated island');
  });

  it('concept body explains WHY GraphQL Assert is better than generic Assert', () => {
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('GraphQL Assert');
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('triage');
  });

  it('concept body explains WHY Debug Mode exists', () => {
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('Debug Mode');
    expect(gqlWorkflowIntegrationLesson.concept.body).toContain('step by step');
  });

  it('has 5 key terms including Debug Mode', () => {
    expect(gqlWorkflowIntegrationLesson.concept.keyTerms.length).toBe(5);
    const terms = gqlWorkflowIntegrationLesson.concept.keyTerms.map((k) => k.term);
    expect(terms).toContain('Output binding');
    expect(terms).toContain('Source variable');
    expect(terms).toContain('Quick Test');
    expect(terms).toContain('less_than');
    expect(terms).toContain('Debug Mode');
  });

  it('Debug Mode key term explains step-by-step execution', () => {
    const debugTerm = gqlWorkflowIntegrationLesson.concept.keyTerms.find(
      (k) => k.term === 'Debug Mode',
    );
    expect(debugTerm?.definition).toContain('Step-by-step');
    expect(debugTerm?.definition).toContain('variable');
  });

  // ── Diagram ───────────────────────────────────────────────────────────────

  it('concept diagram is a 700x430 SVG', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('viewBox="0 0 700 430"');
  });

  it('diagram shows Workflow Designer chrome with toolbar', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('Workflow Designer');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('Quick Test');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('Debug');
  });

  it('diagram shows 4-node workflow wired in sequence', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('Start');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('GraphQL Query');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('GraphQL Assert');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('End');
  });

  it('diagram shows green pass + red fail node state overlay', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('#22c55e');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('#ef4444');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('✓ 28ms');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('✗ FAIL');
  });

  it('diagram shows output binding annotation', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('latencyMs → gqlLatency');
  });

  it('diagram shows Console panel at bottom', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('Console');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('Console ●');
  });

  it('diagram shows palette with GraphQL Query and Assert blocks', () => {
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('ACTIONS');
    expect(gqlWorkflowIntegrationLesson.concept.diagram).toContain('LOGIC');
  });

  // ── Step spotlights & verify selectors ───────────────────────────────────

  it('gql11-create highlights sidebar new btn', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-create')!;
    expect(step.highlight).toBe(WF.SIDEBAR_NEW_BTN);
    expect(step.verify).toBe(WF.CANVAS);
  });

  it('gql11-workflow-variables highlights variables btn and verifies canvas', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-workflow-variables')!;
    expect(step.highlight).toBe(WF.VARIABLES_BTN);
    expect(step.verify).toBe(WF.CANVAS);
  });

  it('gql11-workflow-variables description explains workflow-level defaults', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-workflow-variables')!;
    expect(step.description).toContain('Workflow Variables');
    expect(step.description).toContain('graphqlUrl');
    expect(step.description).toContain('{{name}}');
  });

  it('gql11-query-node highlights GQL Query palette item', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-query-node')!;
    expect(step.highlight).toBe(WF.PAL_GQL_QUERY);
    expect(step.verify).toBe(GQL.WF_CANVAS_QUERY_NODE);
  });

  it('gql11-config-query highlights query panel', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-config-query')!;
    expect(step.highlight).toBe(GQL.WF_QUERY_PANEL);
    expect(step.verify).toBe(GQL.WF_CANVAS_QUERY_NODE);
  });

  it('gql11-assert-node highlights GQL Assert palette item', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-node')!;
    expect(step.highlight).toBe(WF.PAL_GQL_ASSERT);
    expect(step.verify).toBe(GQL.WF_CANVAS_ASSERT_NODE);
  });

  it('gql11-assert-source highlights assert panel', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-source')!;
    expect(step.highlight).toBe(GQL.WF_ASSERT_PANEL);
    expect(step.verify).toBe(GQL.WF_CANVAS_ASSERT_NODE);
  });

  it('gql11-assert-rule highlights assert row', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-rule')!;
    expect(step.highlight).toBe(GQL.WF_ASSERT_ROW);
    expect(step.verify).toBe(GQL.WF_CANVAS_ASSERT_NODE);
  });

  it('gql11-console highlights console badge and verifies console panel', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-console')!;
    expect(step.highlight).toBe(WF.CONSOLE_BADGE);
    expect(step.verify).toBe(WF.CONSOLE);
  });

  it('gql11-run-pass-exec highlights quick test btn and verifies exec summary', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-run-pass-exec')!;
    expect(step.highlight).toBe(WF.QUICK_TEST_BTN);
    expect(step.verify).toBe(WF.EXEC_SUMMARY);
  });

  it('gql11-observe-pass highlights query node on canvas', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-observe-pass')!;
    expect(step.highlight).toBe(GQL.WF_CANVAS_QUERY_NODE);
  });

  it('gql11-tighten-threshold highlights assert row and verifies assert node', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-tighten-threshold')!;
    expect(step.highlight).toBe(GQL.WF_ASSERT_ROW);
    expect(step.verify).toBe(GQL.WF_CANVAS_ASSERT_NODE);
  });

  it('gql11-observe-failure highlights assert node and verifies assert node', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-observe-failure')!;
    expect(step.highlight).toBe(GQL.WF_CANVAS_ASSERT_NODE);
    expect(step.verify).toBe(GQL.WF_CANVAS_ASSERT_NODE);
  });

  it('gql11-debug-mode highlights debug btn and verifies canvas', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-debug-mode')!;
    expect(step.highlight).toBe(WF.DEBUG_BTN);
    expect(step.verify).toBe(WF.CANVAS);
  });

  // ── Step descriptions — WHY framing ──────────────────────────────────────

  it('gql11-create description explains palette structure', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-create')!;
    expect(step.description).toContain('Blocks Palette');
    expect(step.description).toContain('Actions');
  });

  it('gql11-query-node description explains WHY dedicated node over HTTP node', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-query-node')!;
    expect(step.description).toContain('generic HTTP node');
    expect(step.description).toContain('latencyMs');
  });

  it('gql11-config-query description explains WHY Output binding is the superpower', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-config-query')!;
    expect(step.description).toContain('Output');
    expect(step.description).toContain('isolated island');
  });

  it('gql11-assert-node description explains WHY GraphQL Assert vs generic', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-node')!;
    expect(step.description).toContain('GraphQL Assert');
    expect(step.description).toContain('triage');
  });

  it('gql11-assert-source description explains WHY source variable is live', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-source')!;
    expect(step.description).toContain('Source variable');
    expect(step.description).toContain('live runtime');
  });

  it('gql11-assert-rule description explains JSONPath $ and pass threshold reasoning', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-assert-rule')!;
    expect(step.description).toContain('less_than');
    expect(step.description).toContain('2000');
  });

  it('gql11-console description explains WHY console must be opened before run', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-console')!;
    expect(step.description).toContain('before');
    expect(step.description).toContain('Console');
  });

  it('gql11-observe-pass description explains what green nodes mean', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-observe-pass')!;
    expect(step.description).toContain('green');
  });

  it('gql11-tighten-threshold description explains threshold change only', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-tighten-threshold')!;
    expect(step.description).toContain('2000');
    expect(step.description).toContain('1');
    expect(step.description).toContain('configures');
  });

  it('gql11-observe-failure description explains Console failure detail', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-observe-failure')!;
    expect(step.description).toContain('red');
    expect(step.description).toContain('Console');
  });

  it('gql11-debug-mode description explains WHY Debug Mode is used for diagnosis', () => {
    const step = gqlWorkflowIntegrationLesson.steps.find((s) => s.id === 'gql11-debug-mode')!;
    expect(step.description).toContain('Debug');
    expect(step.description).toContain('node by node');
  });
});
