import { act } from '@testing-library/react';
import { vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_UNARY_CALL_REQUEST,
} from '@shared/grpc/contractFixtures';
import { captureGrpcLoadTestExecuteSnapshot, createInitialGrpcAdvancedOperationState } from '@shared/grpc/grpcAdvancedFeatureContracts';
import { buildGrpcLoadTestRunSummaryExport } from '@shared/grpc/grpcLoadTestMetrics';
import type { GrpcLoadTestSchedulerRun } from '@shared/grpc/grpcLoadTestSchedulerCore';
import {
  createEmptyTabDescriptorState,
  createGrpcStudioTab,
  resetGrpcTabCounterForTests,
} from '../../grpcStudioTypes';

export const LOAD_TEST_HISTORY_STORAGE_KEY = 'grpc-load-test-run-history-v1';

export const startLoadTestMock = vi.fn();
export const finalizeLoadTestMock = vi.fn();

export function makeStudioSlice(overrides: Record<string, unknown> = {}) {
  resetGrpcTabCounterForTests();
  const tab = createGrpcStudioTab({
    target: 'localhost:50051',
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    title: 'Echo tab',
    ...overrides,
  });
  const prepareExecuteSnapshot = vi.fn(() => ({
    tabId: tab.id,
    requestId: 'req-1',
    capturedAt: '2026-07-01T00:00:00.000Z',
    callType: 'unary' as const,
    target: FIXTURE_UNARY_CALL_REQUEST.target,
    service: FIXTURE_UNARY_CALL_REQUEST.service,
    method: FIXTURE_UNARY_CALL_REQUEST.method,
    body: { message: 'hello' },
    metadata: {},
    timeoutMs: 30_000,
    descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    transportMode: 'express' as const,
  }));
  return {
    activeTab: tab,
    activeTabId: tab.id,
    activeTabDescriptor: {
      ...createEmptyTabDescriptorState(),
      loadState: 'loaded' as const,
      descriptor: FIXTURE_DESCRIPTOR,
      driftState: 'none' as const,
    },
    tabs: [tab],
    prepareExecuteSnapshot,
    profiles: [{ id: 'conn-1', name: 'Local', target: 'localhost:50051', tlsMode: 'disabled' as const }],
    ...overrides,
  };
}

export function makeLoadTestRun(tabId: string, stopReason: 'completed_total_calls' | 'cancelled' = 'completed_total_calls'): GrpcLoadTestSchedulerRun {
  const snapshot = captureGrpcLoadTestExecuteSnapshot({
    runId: `load-${tabId}`,
    executeSnapshot: {
      tabId,
      requestId: 'req-1',
      capturedAt: '2026-07-01T00:00:00.000Z',
      callType: 'unary',
      target: FIXTURE_UNARY_CALL_REQUEST.target,
      service: FIXTURE_UNARY_CALL_REQUEST.service,
      method: FIXTURE_UNARY_CALL_REQUEST.method,
      body: {},
      metadata: {},
      timeoutMs: 30_000,
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
    },
    config: { concurrency: 1, totalCalls: 1 },
  });
  const summary = buildGrpcLoadTestRunSummaryExport({
    snapshot,
    report: {
      runId: snapshot.runId,
      startedAt: '2026-07-01T00:00:00.000Z',
      completedAt: '2026-07-01T00:00:01.000Z',
      durationMs: 1000,
      stopReason,
      counts: {
        scheduled: 1,
        completed: 1,
        succeeded: 1,
        failed: 0,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 1,
      },
      attempts: [],
    },
  });
  return {
    runId: snapshot.runId,
    snapshot,
    cancel: vi.fn(),
    getState: () => ({
      operation: createInitialGrpcAdvancedOperationState(),
      counts: {
        scheduled: 1,
        completed: 1,
        succeeded: 1,
        failed: 0,
        warmupScheduled: 0,
        warmupCompleted: 0,
        peakInFlight: 1,
      },
      stopReason: undefined,
    }),
    completion: Promise.resolve(summary as never),
  };
}

export async function flushReactEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

export function setupAdvancedFeaturesCoverageGapsBeforeEach(): ReturnType<typeof vi.spyOn> {
  const originalError = console.error;
  return vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = args.map((value) => {
      if (typeof value === 'string') return value;
      if (value instanceof Error) return value.message;
      return String(value);
    }).join(' ');
    if (text.includes('not wrapped in act')) {
      return;
    }
    originalError(...(args as Parameters<typeof console.error>));
  });
}
