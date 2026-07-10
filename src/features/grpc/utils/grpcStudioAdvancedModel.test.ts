import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { FIXTURE_DESCRIPTOR } from '../../../shared/grpc/contractFixtures';
import {
  computeLoadTestProgressPercent,
  filterGrpcSchemaDiffChangesForUi,
  formatGrpcLoadTestCallTypeBadge,
  parseGrpcMockRuleSetJson,
  parseGrpcMockRuleSetJsonForBuilder,
  presentGrpcAdvancedOperationStatus,
  summarizeMockRulePredicate,
} from './grpcStudioAdvancedModel';
import {
  computeGrpcStudioSchemaDiffReport,
  resolveGrpcStudioMockConfig,
  resetAdvancedOpIfTerminal,
  buildMockConfigSourceFromEditor,
  isGrpcStudioTabLive,
  isGrpcAdvancedOperationInFlight,
  nextLoadTestRunGeneration,
  shouldApplyLoadTestRunResult,
  transitionAdvancedOpQuickComplete,
  transitionAdvancedOpToCancelled,
  transitionAdvancedOpToCompleted,
  transitionAdvancedOpToRunning,
  validateLoadTestPreconditions,
} from './grpcStudioAdvancedCommands';

const ROOT = fileURLToPath(new URL('../../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

describe('grpcStudioAdvancedModel (Phase 11G)', () => {
  it('presentGrpcAdvancedOperationStatus maps running and cancelling', () => {
    expect(presentGrpcAdvancedOperationStatus('running', false).label).toBe('Running');
    expect(presentGrpcAdvancedOperationStatus('running', true).label).toBe('Cancelling…');
  });

  it('computeLoadTestProgressPercent uses totalCalls when set', () => {
    const percent = computeLoadTestProgressPercent(
      { concurrency: 2, totalCalls: 100 },
      {
        scheduled: 50,
        completed: 50,
        succeeded: 48,
        failed: 2,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 2,
      },
      500,
    );
    expect(percent).toBe(50);
  });

  it('filterGrpcSchemaDiffChangesForUi hides acknowledged changes when requested', () => {
    const changes = [
      {
        severity: 'breaking' as const,
        entityType: 'field' as const,
        entityPath: 'a',
        changeType: 'removed' as const,
        description: 'a removed',
      },
      {
        severity: 'informational' as const,
        entityType: 'field' as const,
        entityPath: 'b',
        changeType: 'added' as const,
        description: 'b added',
      },
    ];
    const result = filterGrpcSchemaDiffChangesForUi(changes, 'all', {
      hideAcknowledged: true,
      acknowledgedChangeIds: new Set(['field::a::removed']),
      resolveChangeId: (change) => `${change.entityType}::${change.entityPath}::${change.changeType}`,
    });
    expect(result.visible).toHaveLength(1);
    expect(result.visible[0]?.entityPath).toBe('b');
  });

  it('filterGrpcSchemaDiffChangesForUi keeps full large lists for virtual rendering', () => {
    const totalChanges = 750;
    const changes = Array.from({ length: totalChanges }, (_, index) => ({
      severity: 'informational' as const,
      entityType: 'field' as const,
      entityPath: `msg.f${index}`,
      changeType: 'doc_comment_changed' as const,
      description: `change ${index}`,
    }));
    const result = filterGrpcSchemaDiffChangesForUi(changes, 'all');
    expect(result.visible).toHaveLength(totalChanges);
    expect(result.truncated).toBe(false);
    expect(result.total).toBe(totalChanges);
  });

  it('parseGrpcMockRuleSetJson rejects invalid JSON', () => {
    expect(parseGrpcMockRuleSetJson('{').ok).toBe(false);
    expect(parseGrpcMockRuleSetJsonForBuilder('{').ok).toBe(false);
  });

  it('parseGrpcMockRuleSetJsonForBuilder accepts JSON that fails schema validation', () => {
    const json = JSON.stringify({
      rules: [{
        id: 'r1',
        name: 'Incomplete',
        enabled: true,
        priority: 1,
        predicate: { kind: 'method_equals', method: '' },
        response: { statusCode: 0 },
      }],
    });
    expect(parseGrpcMockRuleSetJson(json).ok).toBe(false);
    expect(parseGrpcMockRuleSetJsonForBuilder(json).ok).toBe(true);
  });

  it('summarizeMockRulePredicate formats method_equals', () => {
    expect(summarizeMockRulePredicate({
      id: 'r1',
      name: 'Rule',
      enabled: true,
      priority: 1,
      predicate: { kind: 'method_equals', method: 'Echo' },
      response: {},
    })).toBe('method == "Echo"');
  });
});

describe('grpcStudioAdvancedCommands (Phase 11G)', () => {
  it('validateLoadTestPreconditions rejects client and bidi streaming call types', () => {
    expect(validateLoadTestPreconditions('client_streaming', { concurrency: 2, totalCalls: 5 }))
      .toMatch(/server-streaming/i);
    expect(validateLoadTestPreconditions('bidi_streaming', { concurrency: 2, totalCalls: 5 }))
      .toMatch(/server-streaming/i);
  });

  it('validateLoadTestPreconditions accepts server_streaming', () => {
    expect(validateLoadTestPreconditions('server_streaming', { concurrency: 2, totalCalls: 5 }))
      .toBeUndefined();
    expect(validateLoadTestPreconditions('server_streaming', { concurrency: 2, totalCalls: 5 }, {
      transportMode: 'spring-servlet',
    })).toMatch(/Express proxy or native transport/i);
  });

  it('formatGrpcLoadTestCallTypeBadge labels unary and server stream', () => {
    expect(formatGrpcLoadTestCallTypeBadge('unary')).toBe('Unary');
    expect(formatGrpcLoadTestCallTypeBadge('server_streaming')).toBe('Server stream');
    expect(formatGrpcLoadTestCallTypeBadge('bidi_streaming')).toBe('Unsupported');
  });

  it('validateLoadTestPreconditions rejects unresolved methods', () => {
    expect(validateLoadTestPreconditions('unary', { concurrency: 2, totalCalls: 5 }, {
      methodResolved: false,
    })).toMatch(/not found in the loaded descriptor/i);
  });

  it('isGrpcStudioTabLive tracks open tabs', () => {
    expect(isGrpcStudioTabLive([{ id: 'a' }, { id: 'b' }], 'b')).toBe(true);
    expect(isGrpcStudioTabLive([{ id: 'a' }], 'b')).toBe(false);
  });

  it('isGrpcAdvancedOperationInFlight detects running and validating', () => {
    expect(isGrpcAdvancedOperationInFlight('running')).toBe(true);
    expect(isGrpcAdvancedOperationInFlight('validating')).toBe(true);
    expect(isGrpcAdvancedOperationInFlight('completed')).toBe(false);
    expect(isGrpcAdvancedOperationInFlight('idle')).toBe(false);
  });

  it('load test generation guards stale async completions', () => {
    expect(nextLoadTestRunGeneration(undefined)).toBe(1);
    expect(nextLoadTestRunGeneration(1)).toBe(2);
    expect(shouldApplyLoadTestRunResult(2, 2)).toBe(true);
    expect(shouldApplyLoadTestRunResult(3, 2)).toBe(false);
    expect(shouldApplyLoadTestRunResult(undefined, 1)).toBe(false);
  });

  it('buildMockConfigSourceFromEditor omits empty latency policy', () => {
    const source = buildMockConfigSourceFromEditor(
      { rules: [] },
      { defaultLatencyMs: undefined, jitterMs: undefined },
    );
    expect(source.latencyPolicy).toBeUndefined();
  });

  it('resolveGrpcStudioMockConfig prefers tab override', () => {
    const resolved = resolveGrpcStudioMockConfig({
      tabId: 'tab-1',
      mockConfigOverride: { ruleSet: { rules: [{ id: 'r1', name: 'R', enabled: true, priority: 1, predicate: { kind: 'method_equals', method: 'Echo' }, response: {} }] } },
      workspaceDefault: { ruleSet: { rules: [] } },
    });
    expect(resolved.source).toBe('tab_override');
    expect(resolved.ruleSet.rules).toHaveLength(1);
  });

  it('computeGrpcStudioSchemaDiffReport is deterministic for identical descriptors', () => {
    const left = structuredClone(FIXTURE_DESCRIPTOR);
    const right = structuredClone(FIXTURE_DESCRIPTOR);
    const report = computeGrpcStudioSchemaDiffReport({ baseline: left, candidate: right });
    expect(report.changes).toHaveLength(0);
  });
});

describe('grpcStudioAdvancedCommands transitions (Phase 11G)', () => {
  it('transitionAdvancedOpToRunning resets terminal state before starting', () => {
    let state = transitionAdvancedOpToRunning(
      { status: 'idle', cancellationRequested: false },
      'op-1',
    );
    state = transitionAdvancedOpToCompleted(state);
    expect(state.status).toBe('completed');
    const restarted = transitionAdvancedOpToRunning(state, 'op-2');
    expect(restarted.status).toBe('running');
    expect(restarted.operationId).toBe('op-2');
  });

  it('transitionAdvancedOpQuickComplete advances idle to completed', () => {
    const state = transitionAdvancedOpQuickComplete({
      status: 'idle',
      cancellationRequested: false,
    });
    expect(state.status).toBe('completed');
  });

  it('transitionAdvancedOpToCancelled works from running state', () => {
    const running = transitionAdvancedOpToRunning(
      { status: 'idle', cancellationRequested: false },
      'op-cancel',
    );
    const cancelled = transitionAdvancedOpToCancelled(running);
    expect(cancelled.status).toBe('cancelled');
  });

  it('resetAdvancedOpIfTerminal clears completed state to idle', () => {
    const completed = transitionAdvancedOpToCompleted(
      transitionAdvancedOpToRunning({ status: 'idle', cancellationRequested: false }, 'op-3'),
    );
    expect(resetAdvancedOpIfTerminal(completed).status).toBe('idle');
  });
});

describe('Phase 11G deliverable source scan', () => {
  it('GrpcStudioPage wires advanced shell', () => {
    const barrel = readSrc('src/features/grpc/GrpcStudioPage.tsx');
    const page = readSrc('src/features/grpc/grpcStudioPage/GrpcStudioPage.tsx');
    const panels = readSrc('src/features/grpc/grpcStudioPage/GrpcStudioPagePanels.tsx');
    const src = `${barrel}\n${page}\n${panels}`;
    expect(src.includes('GrpcAdvancedFeaturesShell')).toBe(true);
    expect(src.includes('useGrpcStudioAdvancedFeatures')).toBe(true);
    expect(src.includes("panelView === 'advanced'")).toBe(true);
  });

  it('GrpcStudioSubNav exposes advanced tab', () => {
    const src = readSrc('src/features/grpc/components/GrpcStudioSubNav.tsx');
    expect(src.includes('grpc-sub-nav-advanced')).toBe(true);
  });

  it('selectors define advanced feature test ids', () => {
    const src = readSrc('src/shared/selectors/grpc.ts');
    expect(src.includes('LOAD_TEST_PANEL')).toBe(true);
    expect(src.includes('MOCK_SERVER_PANEL')).toBe(true);
    expect(src.includes('SCHEMA_DIFF_PANEL')).toBe(true);
  });

  it('grpc-studio.css defines advanced namespace', () => {
    const src = readSrc('src/styles/grpc-studio.css');
    expect(src.includes('.grpc-advanced-shell')).toBe(true);
    expect(src.includes('.grpc-advanced-diff-line')).toBe(true);
  });

  it('load test panel uses per-tab live progress and summary metric fields', () => {
    const src = readSrc('src/features/grpc/components/GrpcLoadTestPanel.tsx');
    expect(src.includes('advanced.loadTest.live')).toBe(true);
    expect(src.includes('measuredAttemptsPerSecond')).toBe(true);
    expect(src.includes('p50Ms')).toBe(true);
  });

  it('load test execute bridge forwards tab transport mode', () => {
    const src = readSrc('src/features/grpc/utils/grpcStudioAdvancedCommands.ts');
    expect(src.includes('transportMode: ctx.executeSnapshot.transportMode')).toBe(true);
  });

  it('hook guards closed-tab state patches', () => {
    const src = readSrc('src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts');
    expect(src.includes('liveTabIdsRef')).toBe(true);
    expect(src.includes('!liveTabIdsRef.current.has(tabId)')).toBe(true);
  });

  it('hook load-test poll checks generation before patching live progress', () => {
    const src = readSrc('src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts');
    expect(src.includes('shouldApplyLoadTestRunResult(loadTestGenerationRef.current.get(tabId), runGeneration)')).toBe(true);
  });
});
