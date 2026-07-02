/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  makeScenario,
  makeResult,
  makeConfig,
  makeSummary,
  makeTestRun,
  makeTestScenario,
  makeFeatureGroup,
  makeTrashItem,
  makeWorkflow,
  makeWorkflowNode,
  makeWorkflowEdge,
  makeWorkflowFolder,
} from './factories';

describe('factories', () => {
  describe('makeScenario', () => {
    it('creates a default scenario', () => {
      const scenario = makeScenario();
      expect(scenario.id).toBe('sc-1');
      expect(scenario.name).toBe('Test Scenario');
      expect(scenario.url).toBe('https://api.example.com/users');
      expect(scenario.method).toBe('GET');
      expect(scenario.headers).toEqual([]);
      expect(scenario.body).toBe('');
      expect(scenario.auth).toEqual({ type: 'none' });
    });

    it('allows overrides', () => {
      const scenario = makeScenario({ id: 'custom-id', name: 'Custom Scenario', method: 'POST' });
      expect(scenario.id).toBe('custom-id');
      expect(scenario.name).toBe('Custom Scenario');
      expect(scenario.method).toBe('POST');
    });
  });

  describe('makeResult', () => {
    it('creates a default result', () => {
      const result = makeResult();
      expect(result.id).toBe('result-1');
      expect(result.scenarioId).toBe('sc-1');
      expect(result.scenarioName).toBe('Test Scenario');
      expect(result.httpStatus).toBe(200);
      expect(result.responseTimeMs).toBe(100);
      expect(result.passed).toBe(true);
      expect(result.failureDetails).toEqual([]);
    });

    it('allows overrides', () => {
      const result = makeResult({ id: 'r-custom', httpStatus: 500, passed: false });
      expect(result.id).toBe('r-custom');
      expect(result.httpStatus).toBe(500);
      expect(result.passed).toBe(false);
    });
  });

  describe('makeConfig', () => {
    it('creates a default config', () => {
      const config = makeConfig();
      expect(config.concurrency).toBe(1);
      expect(config.iterations).toBe(10);
      expect(config.executionMode).toBe('sequential');
      expect(config.errorPolicy).toBe('continue');
      expect(config.scenarioWeights).toEqual([{ scenarioId: 'sc-1', weight: 1 }]);
    });

    it('allows overrides', () => {
      const config = makeConfig({ concurrency: 5, executionMode: 'batch' });
      expect(config.concurrency).toBe(5);
      expect(config.executionMode).toBe('batch');
    });
  });

  describe('makeSummary', () => {
    it('creates a default summary', () => {
      const summary = makeSummary();
      expect(summary.totalRequests).toBe(10);
      expect(summary.successfulRequests).toBe(9);
      expect(summary.failedRequests).toBe(1);
      expect(summary.failedValidations).toBe(0);
      expect(summary.tps).toBe(2);
      expect(summary.avgResponseTime).toBe(50);
      expect(summary.errorRate).toBe(10);
    });

    it('allows overrides', () => {
      const summary = makeSummary({ tps: 100, errorRate: 0 });
      expect(summary.tps).toBe(100);
      expect(summary.errorRate).toBe(0);
    });
  });

  describe('makeTestRun', () => {
    it('creates a test run with unique IDs', () => {
      const run1 = makeTestRun();
      const run2 = makeTestRun();
      expect(run1.id).not.toBe(run2.id);
      expect(run1.config).toBeDefined();
      expect(run1.summary).toBeDefined();
      expect(run1.results.length).toBe(1);
    });

    it('allows overrides', () => {
      const run = makeTestRun({ id: 'custom-run', results: [] });
      expect(run.id).toBe('custom-run');
      expect(run.results).toEqual([]);
    });
  });

  describe('makeTestScenario', () => {
    it('creates a test scenario with unique IDs', () => {
      const ts1 = makeTestScenario();
      const ts2 = makeTestScenario();
      expect(ts1.id).not.toBe(ts2.id);
      expect(ts1.kind).toBe('standard');
      expect(ts1.tests).toEqual([]);
      expect(ts1.auth).toEqual({ type: 'inherit' });
    });

    it('uses custom name when provided', () => {
      const ts = makeTestScenario({ name: 'Custom Test Scenario' });
      expect(ts.name).toBe('Custom Test Scenario');
    });

    it('generates default name based on counter', () => {
      const ts = makeTestScenario();
      expect(ts.name).toMatch(/Test Scenario \d+/);
    });

    it('allows overrides', () => {
      const ts = makeTestScenario({ id: 'custom-ts', kind: 'parameterized' });
      expect(ts.id).toBe('custom-ts');
      expect(ts.kind).toBe('parameterized');
    });
  });

  describe('makeFeatureGroup', () => {
    it('creates a feature group with unique IDs', () => {
      const fg1 = makeFeatureGroup();
      const fg2 = makeFeatureGroup();
      expect(fg1.id).not.toBe(fg2.id);
      expect(fg1.scenarios).toEqual([]);
    });

    it('uses custom name when provided', () => {
      const fg = makeFeatureGroup({ name: 'Custom Feature Group' });
      expect(fg.name).toBe('Custom Feature Group');
    });

    it('generates default name based on counter', () => {
      const fg = makeFeatureGroup();
      expect(fg.name).toMatch(/Feature Group \d+/);
    });

    it('allows scenario overrides', () => {
      const scenarios = [makeTestScenario()];
      const fg = makeFeatureGroup({ scenarios });
      expect(fg.scenarios).toBe(scenarios);
    });
  });

  describe('makeTrashItem', () => {
    it('creates a trash item with unique IDs', () => {
      const item1 = makeTrashItem();
      const item2 = makeTrashItem();
      expect(item1.id).not.toBe(item2.id);
      expect(item1.entityType).toBe('featureGroup');
      expect(item1.entityName).toBe('Test FG');
      expect(item1.expiresAt).toBeGreaterThan(item1.deletedAt);
    });

    it('allows overrides', () => {
      const item = makeTrashItem({ entityType: 'scenario', entityName: 'My Scenario' });
      expect(item.entityType).toBe('scenario');
      expect(item.entityName).toBe('My Scenario');
    });
  });

  describe('makeWorkflow', () => {
    it('creates a workflow with unique IDs', () => {
      const wf1 = makeWorkflow();
      const wf2 = makeWorkflow();
      expect(wf1.id).not.toBe(wf2.id);
      expect(wf1.nodes).toEqual([]);
      expect(wf1.edges).toEqual([]);
      expect(wf1.variables).toEqual({});
      expect(wf1.createdAt).toBeDefined();
      expect(wf1.updatedAt).toBeDefined();
    });

    it('generates default name based on counter', () => {
      const wf = makeWorkflow();
      expect(wf.name).toMatch(/Test Workflow \d+/);
    });

    it('allows overrides', () => {
      const nodes = [makeWorkflowNode()];
      const wf = makeWorkflow({ id: 'custom-wf', name: 'Custom Workflow', nodes });
      expect(wf.id).toBe('custom-wf');
      expect(wf.name).toBe('Custom Workflow');
      expect(wf.nodes).toBe(nodes);
    });
  });

  describe('makeWorkflowNode', () => {
    it('creates a node with unique IDs', () => {
      const node1 = makeWorkflowNode();
      const node2 = makeWorkflowNode();
      expect(node1.id).not.toBe(node2.id);
      expect(node1.type).toBe('http');
      expect(node1.position).toEqual({ x: 0, y: 0 });
    });

    it('allows overrides', () => {
      const node = makeWorkflowNode({ id: 'custom-node', type: 'condition', position: { x: 100, y: 200 } });
      expect(node.id).toBe('custom-node');
      expect(node.type).toBe('condition');
      expect(node.position).toEqual({ x: 100, y: 200 });
    });
  });

  describe('makeWorkflowEdge', () => {
    it('creates an edge with unique IDs', () => {
      const edge1 = makeWorkflowEdge();
      const edge2 = makeWorkflowEdge();
      expect(edge1.id).not.toBe(edge2.id);
      expect(edge1.source).toBe('node-1');
      expect(edge1.target).toBe('node-2');
    });

    it('allows overrides', () => {
      const edge = makeWorkflowEdge({ id: 'custom-edge', source: 'a', target: 'b' });
      expect(edge.id).toBe('custom-edge');
      expect(edge.source).toBe('a');
      expect(edge.target).toBe('b');
    });
  });

  describe('makeWorkflowFolder', () => {
    it('creates a folder with defaults', () => {
      const folder = makeWorkflowFolder();
      expect(folder.id).toBe('folder-1');
      expect(folder.name).toBe('Test Folder');
      expect(folder.order).toBe(0);
    });

    it('allows overrides', () => {
      const folder = makeWorkflowFolder({ id: 'f-custom', name: 'Custom Folder', order: 3 });
      expect(folder.id).toBe('f-custom');
      expect(folder.name).toBe('Custom Folder');
      expect(folder.order).toBe(3);
    });
  });

  describe('makeWorkflowNode default branches', () => {
    it('uses default type, position, and data when omitted', () => {
      const node = makeWorkflowNode();
      expect(node.type).toBe('http');
      expect(node.position).toEqual({ x: 0, y: 0 });
      expect(node.data).toEqual({ label: 'Test Node', method: 'GET', url: '/test' });
    });
  });

  describe('makeWorkflowEdge default branches', () => {
    it('uses default source and target when omitted', () => {
      const edge = makeWorkflowEdge();
      expect(edge.source).toBe('node-1');
      expect(edge.target).toBe('node-2');
    });
  });

  describe('makeTestScenario default name branch', () => {
    it('uses generated name when name override is omitted', () => {
      const ts = makeTestScenario();
      expect(ts.name).toMatch(/Test Scenario \d+/);
    });
  });

  describe('makeTrashItem defaults', () => {
    it('uses default parentPath and feature group data shape', () => {
      const item = makeTrashItem();
      expect(item.parentPath).toBe('');
      expect(item.data).toEqual({ id: 'fg-1', name: 'Test FG', scenarios: [] });
    });
  });

  describe('makeWorkflowNode data override', () => {
    it('preserves custom node data when provided', () => {
      const node = makeWorkflowNode({
        data: { label: 'Custom', method: 'POST', url: '/custom' },
      });
      expect(node.data).toEqual({ label: 'Custom', method: 'POST', url: '/custom' });
    });
  });

  describe('makeWorkflow defaults', () => {
    it('uses empty nodes and edges arrays when omitted', () => {
      const wf = makeWorkflow();
      expect(wf.nodes).toEqual([]);
      expect(wf.edges).toEqual([]);
      expect(wf.variables).toEqual({});
    });
  });

  describe('makeWorkflowFolder partial overrides', () => {
    it('uses default id when only name is overridden', () => {
      const folder = makeWorkflowFolder({ name: 'Only Name' });
      expect(folder.id).toBe('folder-1');
      expect(folder.name).toBe('Only Name');
    });

    it('uses default order when only id is overridden', () => {
      const folder = makeWorkflowFolder({ id: 'custom-id' });
      expect(folder.id).toBe('custom-id');
      expect(folder.order).toBe(0);
    });
  });

  describe('makeFeatureGroup scenarios default branch', () => {
    it('uses empty scenarios array when scenarios override is omitted', () => {
      const fg = makeFeatureGroup({ name: 'Named Group' });
      expect(fg.scenarios).toEqual([]);
    });
  });
});
