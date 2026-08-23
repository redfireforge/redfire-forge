import { describe, it, expect } from 'vitest';
import {
  createGrpcHealthCheckWorkflow,
  createGrpcUserLookupWorkflow,
  createGrpcServerStreamWorkflow,
  createGrpcCrudWorkflow,
  createGrpcSchemaDiffWorkflow,
  createGrpcLoadTestWorkflow,
} from './grpc';

// ─── Shared structural checks ─────────────────────────────────────────────────

function assertValidWorkflow(wf: ReturnType<typeof createGrpcHealthCheckWorkflow>) {
  expect(wf.id).toBeTruthy();
  expect(wf.name).toBeTruthy();
  expect(wf.description).toBeTruthy();
  expect(wf.nodes.length).toBeGreaterThanOrEqual(3);
  expect(wf.edges.length).toBeGreaterThanOrEqual(2);
  expect(wf.createdAt).toBeGreaterThan(0);
  expect(wf.updatedAt).toBeGreaterThan(0);
}

function nodeTypes(wf: ReturnType<typeof createGrpcHealthCheckWorkflow>): string[] {
  return wf.nodes.map(n => n.type as string);
}

// ─── WF-GRPC-01: gRPC Health Check ───────────────────────────────────────────

describe('createGrpcHealthCheckWorkflow', () => {
  it('returns a valid workflow structure', () => {
    assertValidWorkflow(createGrpcHealthCheckWorkflow());
  });

  it('has id sample-grpc-health-check', () => {
    expect(createGrpcHealthCheckWorkflow().id).toBe('sample-grpc-health-check');
  });

  it('has exactly 4 nodes', () => {
    expect(createGrpcHealthCheckWorkflow().nodes).toHaveLength(4);
  });

  it('contains start, grpcUnary, grpcAssert, end node types', () => {
    const types = nodeTypes(createGrpcHealthCheckWorkflow());
    expect(types).toContain('start');
    expect(types).toContain('grpcUnary');
    expect(types).toContain('grpcAssert');
    expect(types).toContain('end');
  });

  it('grpcUnary uses grpcTarget variable and saveAs healthResult', () => {
    const wf = createGrpcHealthCheckWorkflow();
    const unary = wf.nodes.find(n => n.type === 'grpcUnary');
    // target uses {{grpcTarget}} template; default variable resolves to grpcb.in:443
    expect(unary?.data.target).toContain('grpcTarget');
    expect(String(wf.variables?.grpcTarget)).toContain('grpcb.in');
    expect(unary?.data.saveAs).toBe('healthResult');
    expect(unary?.data.callType).toBe('unary');
  });

  it('grpcAssert sources healthResult and checks status SERVING', () => {
    const wf = createGrpcHealthCheckWorkflow();
    const assert = wf.nodes.find(n => n.type === 'grpcAssert');
    expect(assert?.data.source).toBe('healthResult');
    const assertions = assert?.data.assertions as Array<Record<string, unknown>>;
    expect(assertions.some(a => 'grpcStatus' in a && a.grpcStatus === 0)).toBe(true);
    expect(assertions.some(a => 'grpcField' in a && a.grpcField === '$.status' && a.equals === 'SERVING')).toBe(true);
  });

  it('edges form a linear chain of 3', () => {
    expect(createGrpcHealthCheckWorkflow().edges).toHaveLength(3);
  });
});

// ─── WF-GRPC-02: gRPC User Lookup ────────────────────────────────────────────

describe('createGrpcUserLookupWorkflow', () => {
  it('returns a valid workflow structure', () => {
    assertValidWorkflow(createGrpcUserLookupWorkflow());
  });

  it('has id sample-grpc-user-lookup', () => {
    expect(createGrpcUserLookupWorkflow().id).toBe('sample-grpc-user-lookup');
  });

  it('has exactly 4 nodes', () => {
    expect(createGrpcUserLookupWorkflow().nodes).toHaveLength(4);
  });

  it('grpcUnary uses GetUser method and saveAs userResult', () => {
    const wf = createGrpcUserLookupWorkflow();
    const unary = wf.nodes.find(n => n.type === 'grpcUnary');
    expect(unary?.data.method).toBe('GetUser');
    expect(unary?.data.saveAs).toBe('userResult');
  });

  it('grpcAssert sources userResult and checks id and name/email existence', () => {
    const wf = createGrpcUserLookupWorkflow();
    const assert = wf.nodes.find(n => n.type === 'grpcAssert');
    expect(assert?.data.source).toBe('userResult');
    const assertions = assert?.data.assertions as Array<Record<string, unknown>>;
    expect(assertions.some(a => 'grpcField' in a && a.grpcField === '$.user.name' && a.exists === true)).toBe(true);
    expect(assertions.some(a => 'grpcField' in a && a.grpcField === '$.user.email' && a.exists === true)).toBe(true);
  });
});

// ─── WF-GRPC-03: gRPC Server Streaming ───────────────────────────────────────

describe('createGrpcServerStreamWorkflow', () => {
  it('returns a valid workflow structure', () => {
    assertValidWorkflow(createGrpcServerStreamWorkflow());
  });

  it('has id sample-grpc-server-stream', () => {
    expect(createGrpcServerStreamWorkflow().id).toBe('sample-grpc-server-stream');
  });

  it('has exactly 4 nodes', () => {
    expect(createGrpcServerStreamWorkflow().nodes).toHaveLength(4);
  });

  it('contains a grpcServerStream node', () => {
    expect(nodeTypes(createGrpcServerStreamWorkflow())).toContain('grpcServerStream');
  });

  it('grpcServerStream has collect config with maxMessages and maxDurationMs', () => {
    const wf = createGrpcServerStreamWorkflow();
    const stream = wf.nodes.find(n => n.type === 'grpcServerStream');
    expect(stream?.data.callType).toBe('server_streaming');
    expect(stream?.data.collect).toMatchObject({ maxMessages: 20, maxDurationMs: 5000 });
    expect(stream?.data.saveAs).toBe('orderFeed');
  });

  it('grpcAssert uses grpcStreamLength assertion', () => {
    const wf = createGrpcServerStreamWorkflow();
    const assert = wf.nodes.find(n => n.type === 'grpcAssert');
    const assertions = assert?.data.assertions as Array<Record<string, unknown>>;
    expect(assertions.some(a => 'grpcStreamLength' in a)).toBe(true);
  });
});

// ─── WF-GRPC-04: gRPC CRUD Flow ──────────────────────────────────────────────

describe('createGrpcCrudWorkflow', () => {
  it('returns a valid workflow structure', () => {
    assertValidWorkflow(createGrpcCrudWorkflow());
  });

  it('has id sample-grpc-crud', () => {
    expect(createGrpcCrudWorkflow().id).toBe('sample-grpc-crud');
  });

  it('has exactly 7 nodes', () => {
    expect(createGrpcCrudWorkflow().nodes).toHaveLength(7);
  });

  it('has 3 grpcUnary nodes and 2 grpcAssert nodes', () => {
    const wf = createGrpcCrudWorkflow();
    const types = nodeTypes(wf);
    expect(types.filter(t => t === 'grpcUnary')).toHaveLength(3);
    expect(types.filter(t => t === 'grpcAssert')).toHaveLength(2);
  });

  it('Create node uses saveAs createResult', () => {
    const wf = createGrpcCrudWorkflow();
    const createNode = wf.nodes.find(n => n.type === 'grpcUnary' && n.data.method === 'CreateProduct');
    expect(createNode?.data.saveAs).toBe('createResult');
  });

  it('Get node body references grpc.createResult.product.id', () => {
    const wf = createGrpcCrudWorkflow();
    const getNode = wf.nodes.find(n => n.type === 'grpcUnary' && n.data.method === 'GetProduct');
    expect(JSON.stringify(getNode?.data.body)).toContain('grpc.createResult.product.id');
  });

  it('Delete node body references grpc.createResult.product.id', () => {
    const wf = createGrpcCrudWorkflow();
    const deleteNode = wf.nodes.find(n => n.type === 'grpcUnary' && n.data.method === 'DeleteProduct');
    expect(JSON.stringify(deleteNode?.data.body)).toContain('grpc.createResult.product.id');
  });

  it('has 6 edges', () => {
    expect(createGrpcCrudWorkflow().edges).toHaveLength(6);
  });
});

// ─── WF-GRPC-05: gRPC Schema Drift Watchdog ──────────────────────────────────

describe('createGrpcSchemaDiffWorkflow', () => {
  it('returns a valid workflow structure', () => {
    assertValidWorkflow(createGrpcSchemaDiffWorkflow());
  });

  it('has id sample-grpc-schema-diff', () => {
    expect(createGrpcSchemaDiffWorkflow().id).toBe('sample-grpc-schema-diff');
  });

  it('has exactly 6 nodes', () => {
    expect(createGrpcSchemaDiffWorkflow().nodes).toHaveLength(6);
  });

  it('contains schedule, grpcSchemaDiff, condition, two logDebug, end', () => {
    const types = nodeTypes(createGrpcSchemaDiffWorkflow());
    expect(types).toContain('schedule');
    expect(types).toContain('grpcSchemaDiff');
    expect(types).toContain('condition');
    expect(types.filter(t => t === 'logDebug')).toHaveLength(2);
    expect(types).toContain('end');
  });

  it('grpcSchemaDiff has failOnBreaking false and saveAs diffResult', () => {
    const wf = createGrpcSchemaDiffWorkflow();
    const diff = wf.nodes.find(n => n.type === 'grpcSchemaDiff');
    expect(diff?.data.failOnBreaking).toBe(false);
    expect(diff?.data.saveAs).toBe('diffResult');
  });

  it('condition branches on grpc.diffResult.hasBreakingChanges', () => {
    const wf = createGrpcSchemaDiffWorkflow();
    const cond = wf.nodes.find(n => n.type === 'condition');
    expect(String(cond?.data.left)).toContain('diffResult.hasBreakingChanges');
  });

  it('edges have true/false labels for condition branches', () => {
    const wf = createGrpcSchemaDiffWorkflow();
    const edgeLabels = wf.edges.map(e => (e as { label?: string }).label).filter(Boolean);
    expect(edgeLabels).toContain('true');
    expect(edgeLabels).toContain('false');
  });
});

// ─── WF-GRPC-06: gRPC Load Test ──────────────────────────────────────────────

describe('createGrpcLoadTestWorkflow', () => {
  it('returns a valid workflow structure', () => {
    assertValidWorkflow(createGrpcLoadTestWorkflow());
  });

  it('has id sample-grpc-load-test', () => {
    expect(createGrpcLoadTestWorkflow().id).toBe('sample-grpc-load-test');
  });

  it('has exactly 6 nodes', () => {
    expect(createGrpcLoadTestWorkflow().nodes).toHaveLength(6);
  });

  it('contains grpcLoadTest node', () => {
    expect(nodeTypes(createGrpcLoadTestWorkflow())).toContain('grpcLoadTest');
  });

  it('grpcLoadTest uses concurrency 50, durationMs 10000, saveAs loadResult', () => {
    const wf = createGrpcLoadTestWorkflow();
    const lt = wf.nodes.find(n => n.type === 'grpcLoadTest');
    expect(lt?.data.loadTest).toMatchObject({ concurrency: 50, durationMs: 10000 });
    expect(lt?.data.saveAs).toBe('loadResult');
  });

  it('condition gates on p95Ms with <= operator', () => {
    const wf = createGrpcLoadTestWorkflow();
    const cond = wf.nodes.find(n => n.type === 'condition');
    expect(String(cond?.data.left)).toContain('loadResult.p95Ms');
    expect(cond?.data.operator).toBe('<=');
  });

  it('has 6 edges with true/false labels', () => {
    const wf = createGrpcLoadTestWorkflow();
    expect(wf.edges).toHaveLength(6);
    const labels = wf.edges.map(e => (e as { label?: string }).label).filter(Boolean);
    expect(labels).toContain('true');
    expect(labels).toContain('false');
  });

  it('returns a fresh object on each call', () => {
    expect(createGrpcLoadTestWorkflow()).not.toBe(createGrpcLoadTestWorkflow());
  });
});
