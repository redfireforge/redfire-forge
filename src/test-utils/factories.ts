/**
 * Shared test factories for commonly-used domain objects.
 *
 * Import from this module instead of re-defining `makeScenario`, `makeResult`,
 * `makeConfig`, etc. in every test file.
 */
import type { RequestResult, Scenario, TestConfig, TestSummary, TestRun, TestScenario, FeatureGroup, TrashItem } from '../shared/types';
import type { Workflow, WorkflowNode, WorkflowEdge, WorkflowFolder } from '../features/workflow/types/workflow';

export function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'sc-1',
    name: 'Test Scenario',
    url: 'https://api.example.com/users',
    method: 'GET',
    headers: [],
    body: '',
    auth: { type: 'none' },
    validation: { mode: 'none' },
    ...overrides,
  };
}

export function makeResult(overrides: Partial<RequestResult> = {}): RequestResult {
  return {
    id: 'result-1',
    scenarioId: 'sc-1',
    scenarioName: 'Test Scenario',
    url: 'https://api.example.com/users',
    method: 'GET',
    httpStatus: 200,
    responseTimeMs: 100,
    responseBody: '{}',
    timestamp: Date.now(),
    passed: true,
    validationMode: 'none',
    failureDetails: [],
    ...overrides,
  };
}

export function makeConfig(overrides: Partial<TestConfig> = {}): TestConfig {
  return {
    concurrency: 1,
    iterations: 10,
    scenarioWeights: [{ scenarioId: 'sc-1', weight: 1 }],
    executionMode: 'sequential',
    errorPolicy: 'continue',
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<TestSummary> = {}): TestSummary {
  return {
    totalRequests: 10,
    successfulRequests: 9,
    failedRequests: 1,
    failedValidations: 0,
    totalDurationMs: 5000,
    avgResponseTime: 50,
    minResponseTime: 10,
    maxResponseTime: 100,
    p50ResponseTime: 45,
    p95ResponseTime: 90,
    p99ResponseTime: 95,
    p999ResponseTime: 99,
    tps: 2,
    errorRate: 10,
    errorsByStatus: { 500: 1 },
    ...overrides,
  };
}

let runCounter = 0;
export function makeTestRun(overrides: Partial<TestRun> = {}): TestRun {
  return {
    id: `run-${++runCounter}`,
    timestamp: Date.now(),
    config: makeConfig(),
    summary: makeSummary(),
    results: [makeResult()],
    ...overrides,
  } as TestRun;
}

let testScenarioCounter = 0;
export function makeTestScenario(overrides: Partial<TestScenario> = {}): TestScenario {
  const id = `ts-${++testScenarioCounter}`;
  return {
    id,
    name: overrides.name ?? `Test Scenario ${testScenarioCounter}`,
    kind: 'standard',
    tests: [],
    auth: { type: 'inherit' },
    ...overrides,
  };
}

let featureGroupCounter = 0;
export function makeFeatureGroup(overrides: Partial<FeatureGroup> = {}): FeatureGroup {
  const id = `fg-${++featureGroupCounter}`;
  return {
    id,
    name: overrides.name ?? `Feature Group ${featureGroupCounter}`,
    scenarios: overrides.scenarios ?? [],
    ...overrides,
  };
}

let trashCounter = 0;
export function makeTrashItem(overrides: Partial<TrashItem> = {}): TrashItem {
  return {
    id: `trash-${++trashCounter}`,
    deletedAt: Date.now(),
    expiresAt: Date.now() + 30 * 86_400_000,
    entityType: 'featureGroup',
    entityName: 'Test FG',
    parentPath: '',
    data: { id: 'fg-1', name: 'Test FG', scenarios: [] },
    ...overrides,
  };
}

let workflowCounter = 0;
export function makeWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  const now = Date.now();
  return {
    id: `wf-${++workflowCounter}`,
    name: overrides.name ?? `Test Workflow ${workflowCounter}`,
    nodes: overrides.nodes ?? [],
    edges: overrides.edges ?? [],
    variables: overrides.variables ?? {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

let nodeCounter = 0;
export function makeWorkflowNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: `node-${++nodeCounter}`,
    type: overrides.type ?? 'http',
    position: overrides.position ?? { x: 0, y: 0 },
    data: overrides.data ?? { label: 'Test Node', method: 'GET', url: '/test' },
    ...overrides,
  } as WorkflowNode;
}

let edgeCounter = 0;
export function makeWorkflowEdge(overrides: Partial<WorkflowEdge> = {}): WorkflowEdge {
  return {
    id: `edge-${++edgeCounter}`,
    source: overrides.source ?? 'node-1',
    target: overrides.target ?? 'node-2',
    ...overrides,
  };
}

export function makeWorkflowFolder(overrides: Partial<WorkflowFolder> = {}): WorkflowFolder {
  return {
    id: overrides.id ?? 'folder-1',
    name: overrides.name ?? 'Test Folder',
    order: overrides.order ?? 0,
    ...overrides,
  };
}

