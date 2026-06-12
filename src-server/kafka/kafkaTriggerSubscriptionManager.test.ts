/**
 * Unit tests for KafkaTriggerSubscriptionManager.
 *
 * Tests cover: activation, message dispatch, filter pass/fail, concurrency
 * accounting, pause/resume lifecycle, deactivation, deactivateAll, and
 * idempotent re-activation.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import {
  KafkaTriggerSubscriptionManager,
} from './kafkaTriggerSubscriptionManager.js';
import type { KafkaConsumerRecord, KafkaRuntimeAdapter, KafkaConsumerAdapter } from './kafka-adapter.js';
import type { KafkaConnectionConfig } from './contracts.js';
import type { Workflow } from '../../src/features/workflow/types/workflow.js';
import type { WorkflowExecutionOutput } from '../executeWorkflow.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../executeWorkflow.js', () => ({
  executeWorkflow: vi.fn(),
  saveErrorResult: vi.fn(async () => undefined),
}));

import { executeWorkflow, saveErrorResult } from '../executeWorkflow.js';
const mockExecuteWorkflow = executeWorkflow as Mock<typeof executeWorkflow>;
const mockSaveErrorResult = saveErrorResult as Mock<typeof saveErrorResult>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function flushPromises(): Promise<void> {
  return new Promise<void>((resolve) => setImmediate(resolve));
}

function makeResolvedExecution(): WorkflowExecutionOutput {
  return { executionId: 'test-exec', status: 'pass', passed: true, duration: 10, results: [] };
}

interface MockConsumer {
  connect: Mock;
  disconnect: Mock;
  subscribe: Mock;
  run: Mock;
  stop: Mock;
  pause: Mock;
  resume: Mock;
  /** Trigger a simulated incoming message directly in tests. */
  simulateMessage: (record: KafkaConsumerRecord) => Promise<void>;
}

function createMockConsumer(): MockConsumer {
  let capturedEachMessage: ((record: KafkaConsumerRecord) => Promise<void> | void) | null = null;

  const consumer: MockConsumer = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    subscribe: vi.fn(async () => undefined),
    run: vi.fn(async (eachMessage: (record: KafkaConsumerRecord) => Promise<void> | void) => {
      capturedEachMessage = eachMessage;
    }),
    stop: vi.fn(async () => undefined),
    pause: vi.fn(() => undefined),
    resume: vi.fn(() => undefined),
    simulateMessage: async (record: KafkaConsumerRecord) => {
      if (capturedEachMessage) {
        await capturedEachMessage(record);
      }
    },
  };

  return consumer;
}

function createMockRuntimeAdapter(consumer: KafkaConsumerAdapter): KafkaRuntimeAdapter {
  return {
    createAdmin: vi.fn(() => { throw new Error('not used'); }),
    createProducer: vi.fn(() => { throw new Error('not used'); }),
    createConsumer: vi.fn(() => consumer),
  } as unknown as KafkaRuntimeAdapter;
}

function makeConnection(): KafkaConnectionConfig {
  return {
    clusterId: 'test-cluster',
    clientId: 'test-client',
    brokers: ['localhost:9092'],
    connectionTimeoutMs: 1000,
    requestTimeoutMs: 1000,
  };
}

function makeWorkflow(overrides?: {
  nodeId?: string;
  topic?: string;
  consumerGroupId?: string;
  keyRegex?: string;
  maxConcurrentRuns?: number;
}): Workflow {
  const nodeId = overrides?.nodeId ?? 'trigger-1';
  return {
    id: 'wf-test',
    name: 'Test Workflow',
    variables: {},
    nodes: [
      {
        id: nodeId,
        type: 'kafkaTrigger',
        position: { x: 0, y: 0 },
        data: {
          label: 'Kafka Trigger',
          clusterId: 'test-cluster',
          topic: overrides?.topic ?? 'orders.created',
          consumerGroupId: overrides?.consumerGroupId,
          keyRegex: overrides?.keyRegex,
          maxConcurrentRuns: overrides?.maxConcurrentRuns,
        },
      },
    ],
    edges: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

function makeRecord(overrides?: Partial<KafkaConsumerRecord>): KafkaConsumerRecord {
  return {
    topic: 'orders.created',
    partition: 0,
    offset: '1',
    timestamp: '1717000000000',
    key: 'customer-1',
    value: '{"orderId":"123"}',
    headers: {},
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KafkaTriggerSubscriptionManager', () => {
  let consumer: MockConsumer;
  let manager: KafkaTriggerSubscriptionManager;

  beforeEach(() => {
    consumer = createMockConsumer();
    manager = new KafkaTriggerSubscriptionManager(createMockRuntimeAdapter(consumer as unknown as KafkaConsumerAdapter));
    mockExecuteWorkflow.mockResolvedValue(makeResolvedExecution());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Activation ────────────────────────────────────────────────────────────

  it('connects consumer and subscribes to the correct topic', async () => {
    const workflow = makeWorkflow({ topic: 'orders.created' });
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    expect(consumer.connect).toHaveBeenCalledTimes(1);
    expect(consumer.subscribe).toHaveBeenCalledWith('orders.created', false);
    expect(consumer.run).toHaveBeenCalledTimes(1);
  });

  it('uses consumerGroupId from node config when provided', async () => {
    const workflow = makeWorkflow({ consumerGroupId: 'my-custom-group' });
    const mockAdapter = createMockRuntimeAdapter(consumer as unknown as KafkaConsumerAdapter);
    const m = new KafkaTriggerSubscriptionManager(mockAdapter);
    await m.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    expect(mockAdapter.createConsumer).toHaveBeenCalledWith(
      expect.anything(),
      'my-custom-group',
    );
  });

  it('derives groupId deterministically when consumerGroupId is not set', async () => {
    const workflow = makeWorkflow();
    const mockAdapter = createMockRuntimeAdapter(consumer as unknown as KafkaConsumerAdapter);
    const m = new KafkaTriggerSubscriptionManager(mockAdapter);
    await m.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    expect(mockAdapter.createConsumer).toHaveBeenCalledWith(
      expect.anything(),
      'rf-trigger-wf-test-trigger-1',
    );
  });

  it('subscribes from beginning when startPosition is "earliest"', async () => {
    const workflow: Workflow = {
      ...makeWorkflow(),
      nodes: [{
        id: 'trigger-1', type: 'kafkaTrigger', position: { x: 0, y: 0 },
        data: { label: 'T', clusterId: 'c', topic: 'orders.created', startPosition: 'earliest' },
      }],
    };
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });
    expect(consumer.subscribe).toHaveBeenCalledWith('orders.created', true);
  });

  it('throws when node is not found or not a kafkaTrigger', async () => {
    const workflow: Workflow = {
      ...makeWorkflow(),
      nodes: [{ id: 'not-a-trigger', type: 'http', position: { x: 0, y: 0 }, data: { label: 'X' } }],
    };
    await expect(
      manager.activateTrigger({ workflow, nodeId: 'not-a-trigger', connection: makeConnection() }),
    ).rejects.toThrow('not found or is not a kafkaTrigger');
  });

  it('throws when trigger node has no topic', async () => {
    const workflow: Workflow = {
      ...makeWorkflow(),
      nodes: [{ id: 'trigger-1', type: 'kafkaTrigger', position: { x: 0, y: 0 }, data: { label: 'T', clusterId: 'c', topic: '' } }],
    };
    await expect(
      manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() }),
    ).rejects.toThrow('has no topic configured');
  });

  // ── Dispatch ──────────────────────────────────────────────────────────────

  it('dispatches executeWorkflow with __kafkaTriggerMessage for matching messages', async () => {
    const workflow = makeWorkflow();
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    const record = makeRecord();
    await consumer.simulateMessage(record);
    await flushPromises();

    expect(mockExecuteWorkflow).toHaveBeenCalledTimes(1);
    const call = mockExecuteWorkflow.mock.calls[0][0];
    expect(call.triggerType).toBe('kafka-trigger');
    expect(call.triggerId).toBe('trigger-1');
    expect(call.initialVariables.__kafkaTriggerMessage).toBe(JSON.stringify(record));
  });

  it('strips server-only rawValue from __kafkaTriggerMessage (no Buffer blob)', async () => {
    const workflow = makeWorkflow();
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    const record = makeRecord({
      value: '{"orderId":"123"}',
      rawValue: Buffer.from('{"orderId":"123"}', 'utf-8'),
    });
    await consumer.simulateMessage(record);
    await flushPromises();

    expect(mockExecuteWorkflow).toHaveBeenCalledTimes(1);
    const call = mockExecuteWorkflow.mock.calls[0][0];
    const serialized = call.initialVariables.__kafkaTriggerMessage as string;
    expect(serialized).not.toContain('rawValue');
    expect(serialized).not.toContain('"type":"Buffer"');
    const parsed = JSON.parse(serialized);
    expect(parsed.value).toBe('{"orderId":"123"}');
    expect('rawValue' in parsed).toBe(false);
  });

  it('does not dispatch executeWorkflow for messages that fail keyRegex filter', async () => {
    const workflow = makeWorkflow({ keyRegex: '^vip-' });
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    await consumer.simulateMessage(makeRecord({ key: 'ordinary-customer' }));
    await flushPromises();

    expect(mockExecuteWorkflow).not.toHaveBeenCalled();
  });

  // ── Concurrency accounting ────────────────────────────────────────────────

  it('increments activeRunCount on dispatch and decrements after execution', async () => {
    let resolve!: () => void;
    mockExecuteWorkflow.mockImplementation(
      () => new Promise<WorkflowExecutionOutput>((r) => { resolve = () => r(makeResolvedExecution()); }),
    );

    const workflow = makeWorkflow({ maxConcurrentRuns: 3 });
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    await consumer.simulateMessage(makeRecord());
    const [entry] = manager.getEntries();
    expect(entry.activeRunCount).toBe(1);

    // Resolve the execution
    resolve();
    await flushPromises();
    expect(manager.getEntries()[0].activeRunCount).toBe(0);
  });

  it('pauses consumer when activeRunCount reaches maxConcurrentRuns', async () => {
    // Hold all executions in-flight
    const resolvers: Array<() => void> = [];
    mockExecuteWorkflow.mockImplementation(
      () => new Promise<WorkflowExecutionOutput>((r) => { resolvers.push(() => r(makeResolvedExecution())); }),
    );

    const workflow = makeWorkflow({ maxConcurrentRuns: 2 });
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    await consumer.simulateMessage(makeRecord({ offset: '1' }));
    await consumer.simulateMessage(makeRecord({ offset: '2' }));

    expect(consumer.pause).toHaveBeenCalledWith([{ topic: 'orders.created' }]);
    expect(manager.getEntries()[0].paused).toBe(true);
  });

  it('resumes consumer when activeRunCount drops below maxConcurrentRuns', async () => {
    const resolvers: Array<() => void> = [];
    mockExecuteWorkflow.mockImplementation(
      () => new Promise<WorkflowExecutionOutput>((r) => { resolvers.push(() => r(makeResolvedExecution())); }),
    );

    const workflow = makeWorkflow({ maxConcurrentRuns: 2 });
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    await consumer.simulateMessage(makeRecord({ offset: '1' }));
    await consumer.simulateMessage(makeRecord({ offset: '2' }));

    expect(consumer.pause).toHaveBeenCalledTimes(1);

    // Resolve one execution to drop below the limit
    resolvers.shift()!();
    await flushPromises();

    expect(consumer.resume).toHaveBeenCalledWith([{ topic: 'orders.created' }]);
    expect(manager.getEntries()[0].paused).toBe(false);
  });

  it('drops messages in the race window when count is already at limit', async () => {
    // Hold all in-flight to keep count elevated
    mockExecuteWorkflow.mockImplementation(
      () => new Promise<WorkflowExecutionOutput>((r) => setTimeout(() => r(makeResolvedExecution()), 10_000)),
    );

    const workflow = makeWorkflow({ maxConcurrentRuns: 1 });
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    // First message fills the slot
    await consumer.simulateMessage(makeRecord({ offset: '1' }));
    // Second message arrives before kafkajs honors the pause
    await consumer.simulateMessage(makeRecord({ offset: '2' }));

    // Only one execution started
    expect(mockExecuteWorkflow).toHaveBeenCalledTimes(1);
  });

  // ── Deactivation ──────────────────────────────────────────────────────────

  it('deactivateTrigger calls stop and disconnect on the consumer', async () => {
    const workflow = makeWorkflow();
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });
    await manager.deactivateTrigger('wf-test', 'trigger-1');

    expect(consumer.stop).toHaveBeenCalledTimes(1);
    expect(consumer.disconnect).toHaveBeenCalledTimes(1);
    expect(manager.getEntries()).toHaveLength(0);
  });

  it('deactivateTrigger is a no-op when the subscription does not exist', async () => {
    await expect(manager.deactivateTrigger('non-existent', 'node-1')).resolves.toBeUndefined();
  });

  it('in-flight finally() does NOT call consumer.resume after deactivateTrigger (cancelled guard)', async () => {
    // Hold the execution in-flight so finally() fires after deactivateTrigger
    let resolveExec!: () => void;
    mockExecuteWorkflow.mockImplementation(
      () => new Promise<WorkflowExecutionOutput>((r) => { resolveExec = () => r(makeResolvedExecution()); }),
    );

    const workflow = makeWorkflow({ maxConcurrentRuns: 1 });
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    // Fill the slot — consumer will be paused
    await consumer.simulateMessage(makeRecord());
    expect(consumer.pause).toHaveBeenCalledTimes(1);

    // Deactivate while the execution is still in-flight
    await manager.deactivateTrigger('wf-test', 'trigger-1');
    expect(manager.getEntries()).toHaveLength(0);

    // Now resolve the in-flight execution — finally() should NOT call resume
    resolveExec();
    await flushPromises();

    expect(consumer.resume).not.toHaveBeenCalled();
  });

  it('activateTrigger does not leave a stale entry when consumer.connect throws', async () => {
    consumer.connect.mockRejectedValueOnce(new Error('broker unreachable'));

    const workflow = makeWorkflow();
    await expect(
      manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() }),
    ).rejects.toThrow('broker unreachable');

    // No stale entry should be in the map
    expect(manager.getEntries()).toHaveLength(0);
  });

  it('activateTrigger does not leave a stale entry when consumer.subscribe throws', async () => {
    consumer.subscribe.mockRejectedValueOnce(new Error('subscribe failed'));

    const workflow = makeWorkflow();
    await expect(
      manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() }),
    ).rejects.toThrow('subscribe failed');

    expect(manager.getEntries()).toHaveLength(0);
  });

  it('consumer.run() errors are caught and logged, not silently swallowed', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const onLog = (line: { prefix: string; text: string }) => logLines.push(line);

    consumer.run.mockRejectedValueOnce(new Error('consumer run exploded'));

    const workflow = makeWorkflow();
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection(), onLog });
    await flushPromises();

    const errorLog = logLines.find((l) => l.text.includes('Consumer run error'));
    expect(errorLog).toBeDefined();
    expect(errorLog?.text).toContain('consumer run exploded');
    expect(errorLog?.prefix).toBe('!');
  });

  it('deactivateAll cleans up all entries', async () => {
    const consumer2 = createMockConsumer();
    // second manager for second consumer
    let callCount = 0;
    const multiAdapter: KafkaRuntimeAdapter = {
      createAdmin: vi.fn(),
      createProducer: vi.fn(),
      createConsumer: vi.fn(() => {
        callCount++;
        return callCount === 1
          ? (consumer as unknown as KafkaConsumerAdapter)
          : (consumer2 as unknown as KafkaConsumerAdapter);
      }),
    } as unknown as KafkaRuntimeAdapter;
    const m = new KafkaTriggerSubscriptionManager(multiAdapter);

    const workflow1 = makeWorkflow({ nodeId: 'trigger-1' });
    const workflow2: Workflow = {
      ...makeWorkflow(),
      id: 'wf-2',
      nodes: [{ id: 'trigger-2', type: 'kafkaTrigger', position: { x: 0, y: 0 }, data: { label: 'T', clusterId: 'c', topic: 'payments.authorized' } }],
    };

    await m.activateTrigger({ workflow: workflow1, nodeId: 'trigger-1', connection: makeConnection() });
    await m.activateTrigger({ workflow: workflow2, nodeId: 'trigger-2', connection: makeConnection() });

    expect(m.getEntries()).toHaveLength(2);

    await m.deactivateAll();

    expect(m.getEntries()).toHaveLength(0);
    expect(consumer.stop).toHaveBeenCalledTimes(1);
    expect(consumer2.stop).toHaveBeenCalledTimes(1);
  });

  it('idempotent re-activation deactivates the old consumer before creating a new one', async () => {
    const consumer2 = createMockConsumer();
    let callCount = 0;
    const multiAdapter: KafkaRuntimeAdapter = {
      createAdmin: vi.fn(),
      createProducer: vi.fn(),
      createConsumer: vi.fn(() => {
        callCount++;
        return callCount === 1
          ? (consumer as unknown as KafkaConsumerAdapter)
          : (consumer2 as unknown as KafkaConsumerAdapter);
      }),
    } as unknown as KafkaRuntimeAdapter;
    const m = new KafkaTriggerSubscriptionManager(multiAdapter);

    const workflow = makeWorkflow();
    await m.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });
    // Re-activate the same trigger
    await m.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    // Old consumer should have been stopped
    expect(consumer.stop).toHaveBeenCalledTimes(1);
    expect(consumer.disconnect).toHaveBeenCalledTimes(1);
    // New consumer should be connected
    expect(consumer2.connect).toHaveBeenCalledTimes(1);
    // Only one entry in the map
    expect(m.getEntries()).toHaveLength(1);
  });

  // ── getEntries ────────────────────────────────────────────────────────────

  it('getEntries returns correct snapshot with topic, groupId, and concurrency info', async () => {
    const workflow = makeWorkflow({ topic: 'events.new', maxConcurrentRuns: 5 });
    const mockAdapter = createMockRuntimeAdapter(consumer as unknown as KafkaConsumerAdapter);
    const m = new KafkaTriggerSubscriptionManager(mockAdapter);
    await m.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection() });

    const entries = m.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      workflowId: 'wf-test',
      nodeId: 'trigger-1',
      topic: 'events.new',
      groupId: 'rf-trigger-wf-test-trigger-1',
      maxConcurrentRuns: 5,
      activeRunCount: 0,
      paused: false,
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('executeWorkflow rejection still decrements activeRunCount and logs error via onLog', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const onLog = (line: { prefix: string; text: string }) => logLines.push(line);

    mockExecuteWorkflow.mockRejectedValueOnce(new Error('workflow exploded'));

    const workflow = makeWorkflow({ maxConcurrentRuns: 5 });
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection(), onLog });

    await consumer.simulateMessage(makeRecord());
    await flushPromises();

    // activeRunCount should be back to 0 even though executeWorkflow threw
    expect(manager.getEntries()[0].activeRunCount).toBe(0);

    // Error should be logged via onLog
    const errorLog = logLines.find((l) => l.text.includes('Execution error'));
    expect(errorLog).toBeDefined();
    expect(errorLog?.text).toContain('workflow exploded');
    expect(errorLog?.prefix).toBe('!');

    // Error should also be persisted to execution history via saveErrorResult
    expect(mockSaveErrorResult).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'wf-test',
        triggerId: 'trigger-1',
        triggerType: 'kafka-trigger',
        error: 'workflow exploded',
      }),
    );
  });

  it('dropped messages in the race window emit a warning log via onLog', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const onLog = (line: { prefix: string; text: string }) => logLines.push(line);

    // Hold in-flight to keep count elevated
    mockExecuteWorkflow.mockImplementation(
      () => new Promise<WorkflowExecutionOutput>((r) => setTimeout(() => r(makeResolvedExecution()), 10_000)),
    );

    const workflow = makeWorkflow({ maxConcurrentRuns: 1 });
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection(), onLog });

    // First message claims the only slot
    await consumer.simulateMessage(makeRecord({ offset: '1' }));
    // Second message arrives in the race window and should be dropped
    await consumer.simulateMessage(makeRecord({ offset: '2' }));

    const dropLog = logLines.find((l) => l.text.includes('Dropped message'));
    expect(dropLog).toBeDefined();
    expect(dropLog?.prefix).toBe('!');
    // Only one execution was started
    expect(mockExecuteWorkflow).toHaveBeenCalledTimes(1);
  });

  it('pause and resume emit onLog lines', async () => {
    const logLines: Array<{ prefix: string; text: string }> = [];
    const onLog = (line: { prefix: string; text: string }) => logLines.push(line);

    const resolvers: Array<() => void> = [];
    mockExecuteWorkflow.mockImplementation(
      () => new Promise<WorkflowExecutionOutput>((r) => { resolvers.push(() => r(makeResolvedExecution())); }),
    );

    const workflow = makeWorkflow({ maxConcurrentRuns: 2 });
    await manager.activateTrigger({ workflow, nodeId: 'trigger-1', connection: makeConnection(), onLog });

    // Fill both slots to trigger pause
    await consumer.simulateMessage(makeRecord({ offset: '1' }));
    await consumer.simulateMessage(makeRecord({ offset: '2' }));

    const pauseLog = logLines.find((l) => l.text.includes('Pausing consumer'));
    expect(pauseLog).toBeDefined();
    expect(pauseLog?.prefix).toBe('!');

    // Resolve one execution to trigger resume
    resolvers.shift()!();
    await flushPromises();

    const resumeLog = logLines.find((l) => l.text.includes('Resuming consumer'));
    expect(resumeLog).toBeDefined();
    expect(resumeLog?.prefix).toBe('*');
  });
});
