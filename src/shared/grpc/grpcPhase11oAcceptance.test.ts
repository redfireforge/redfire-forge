/**
 * Phase 11O — Server-streaming load testing acceptance checklist.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GRPC_LOAD_TEST_STREAM_SAFETY_LIMITS,
  deriveGrpcLoadTestOperationOutcome,
  deriveGrpcLoadTestSummaryStatus,
  validateGrpcLoadTestConfig,
} from './grpcAdvancedFeatureContracts';
import { resolveGrpcLoadTestStreamCollectConfig } from './grpcLoadTestStreamScheduler';
import { validateLoadTestPreconditions } from '../../features/grpc/utils/grpcStudioAdvancedCommands';
import { formatGrpcLoadTestCallTypeBadge } from '../../features/grpc/utils/grpcStudioAdvancedModel';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

describe('Phase 11O acceptance — checklist-1: validation', () => {
  it('accepts server_streaming load-test config', () => {
    const issues = validateGrpcLoadTestConfig('server_streaming', {
      concurrency: 4,
      totalCalls: 20,
      maxMessagesPerStream: 10,
    });
    expect(issues).toEqual([]);
  });

  it('rejects client_streaming and bidi_streaming', () => {
    for (const callType of ['client_streaming', 'bidi_streaming'] as const) {
      const issues = validateGrpcLoadTestConfig(callType, { concurrency: 2, totalCalls: 5 });
      expect(issues.some((issue) => issue.path === 'callType')).toBe(true);
    }
  });

  it('validateLoadTestPreconditions allows server_streaming on express transport', () => {
    expect(validateLoadTestPreconditions('server_streaming', { concurrency: 2, totalCalls: 5 }))
      .toBeUndefined();
    expect(validateLoadTestPreconditions('server_streaming', { concurrency: 2, totalCalls: 5 }, {
      transportMode: 'express',
    })).toBeUndefined();
    expect(validateLoadTestPreconditions('server_streaming', { concurrency: 2, totalCalls: 5 }, {
      transportMode: 'native',
    })).toBeUndefined();
    expect(validateLoadTestPreconditions('server_streaming', { concurrency: 2, totalCalls: 5 }, {
      transportMode: 'grpc-web',
    })).toMatch(/Express proxy or native transport/i);
    expect(validateLoadTestPreconditions('server_streaming', { concurrency: 2, totalCalls: 5 }, {
      transportMode: 'spring-servlet',
    })).toMatch(/Express proxy or native transport/i);
    expect(validateLoadTestPreconditions('bidi_streaming', { concurrency: 2, totalCalls: 5 }))
      .toMatch(/server-streaming/i);
  });

  it('validateGrpcLoadTestConfig rejects oversize maxMessagesPerStream on unary profiles', () => {
    const issues = validateGrpcLoadTestConfig('unary', {
      concurrency: 2,
      totalCalls: 5,
      maxMessagesPerStream: GRPC_LOAD_TEST_STREAM_SAFETY_LIMITS.maxMaxMessagesPerStream + 1,
    });
    expect(issues.some((issue) => issue.path === 'maxMessagesPerStream')).toBe(true);
  });
});

describe('Phase 11O acceptance — checklist-2: stream caps', () => {
  it('defaults per-stream message cap to harness window', () => {
    expect(resolveGrpcLoadTestStreamCollectConfig({ concurrency: 1, totalCalls: 1 }))
      .toEqual({ maxMessages: GRPC_LOAD_TEST_STREAM_SAFETY_LIMITS.defaultMaxMessagesPerStream });
  });

  it('rejects maxMessagesPerStream above safety cap', () => {
    const issues = validateGrpcLoadTestConfig('server_streaming', {
      concurrency: 2,
      totalCalls: 5,
      maxMessagesPerStream: GRPC_LOAD_TEST_STREAM_SAFETY_LIMITS.maxMaxMessagesPerStream + 1,
    });
    expect(issues.some((issue) => issue.path === 'maxMessagesPerStream')).toBe(true);
  });

  it('deriveGrpcLoadTestSummaryStatus fails on partial failures and cancel', () => {
    expect(deriveGrpcLoadTestSummaryStatus({
      counts: {
        scheduled: 2,
        completed: 2,
        succeeded: 1,
        failed: 1,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 1,
      },
      stopReason: 'completed_total_calls',
    })).toBe('failed');
    expect(deriveGrpcLoadTestOperationOutcome({
      counts: {
        scheduled: 2,
        completed: 2,
        succeeded: 1,
        failed: 1,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 1,
      },
      stopReason: 'completed_total_calls',
    })).toBe('failed');
    expect(deriveGrpcLoadTestOperationOutcome({
      counts: {
        scheduled: 2,
        completed: 2,
        succeeded: 2,
        failed: 0,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 1,
      },
      stopReason: 'cancelled',
    })).toBe('cancelled');
  });
});

describe('Phase 11O acceptance — checklist-3: Studio wiring', () => {
  it('startGrpcStudioLoadTestRun dispatches server_streaming to stream scheduler', () => {
    expect(readSrc('src/features/grpc/utils/grpcStudioAdvancedCommands.ts'))
      .toContain('captureAndStartGrpcLoadTestStreamSchedulerRun');
    expect(readSrc('src/features/grpc/utils/grpcStudioAdvancedCommands.ts'))
      .toContain('transportMode: frozenTransportMode');
    expect(readSrc('src/features/grpc/utils/grpcStudioAdvancedCommands.ts'))
      .toContain('resolveFrozenLoadTestTransportMode');
    expect(readSrc('src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts'))
      .toContain('postSnapshotValidationError');
    expect(readSrc('src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts'))
      .toContain('resolveGrpcStudioTabTransportMode(studio.activeTab)');
    expect(readSrc('src/features/grpc/components/GrpcLoadTestPanel.tsx'))
      .toContain('grpc-load-test-call-type-badge');
    expect(readSrc('src/features/grpc/components/GrpcLoadTestPanel.tsx'))
      .toContain('grpc-load-test-max-messages-per-stream');
    expect(formatGrpcLoadTestCallTypeBadge('server_streaming')).toBe('Server stream');
  });
});

describe('Phase 11O acceptance — checklist-4: deliverables', () => {
  it('exports stream scheduler + gate wiring', () => {
    expect(readSrc('package.json')).toContain('"test:grpc:phase11o"');
    expect(readSrc('scripts/test-grpc-phase11o.sh')).toContain('Phase 11O gate');
    expect(readSrc('src/shared/grpc/grpcLoadTestStreamScheduler.ts'))
      .toContain('startGrpcLoadTestStreamSchedulerRun');
    expect(readSrc('docs/plan/future/grpc/grpc-studio-plan.md')).toContain('Phase 11O');
    expect(readSrc('docs/plan/future/grpc/grpc-cross-feature-matrix.md')).toContain('Phase 11O');
    expect(readSrc('src/shared/grpc/grpcAdvancedFeatureContracts.ts'))
      .toContain('deriveGrpcLoadTestOperationOutcome');
  });
});
