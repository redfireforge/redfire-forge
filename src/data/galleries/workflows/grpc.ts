import type { Workflow } from '@workflow/types/workflow';
import {
  makeStartNode,
  makeEndNode,
  makeConditionNode,
  makeLogDebugNode,
  makeEdge,
} from './nodeFactories';

/**
 * gRPC gallery workflow samples.
 *
 * Six samples spanning easy → advanced:
 *  1. gRPC Health Check (easy)          — Unary Health/Check + grpcAssert status SERVING
 *  2. gRPC User Lookup (easy)           — GetUser unary + field assertions
 *  3. gRPC Server Stream (medium)       — ListOrders streaming + stream-length assert
 *  4. gRPC CRUD Flow (medium)           — CreateProduct → GetProduct → DeleteProduct
 *  5. gRPC Schema Drift Watchdog (adv)  — Schedule → grpcSchemaDiff → condition → log
 *  6. gRPC Load Test (advanced)         — grpcLoadTest + condition SLA gate
 */

// ────────────────────────────────────────────────────────────────────────────
// 1. Easy: gRPC Health Check
//    Start → grpcUnary (Health/Check) → grpcAssert → End
// ────────────────────────────────────────────────────────────────────────────
export function createGrpcHealthCheckWorkflow(): Workflow {
  return {
    id: 'sample-grpc-health-check',
    name: 'Sample: gRPC Health Check',
    description: 'Calls grpc.health.v1.Health/Check on a configurable gRPC endpoint and asserts the service status is SERVING',
    variables: {
      grpcTarget: 'grpcb.in:443',
      healthStatus: '',
    },
    nodes: [
      makeStartNode('ghc-start', { grpcTarget: 'grpcb.in:443' }, { x: 240, y: 30 }),
      {
        id: 'ghc-unary',
        type: 'grpcUnary',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Health Check',
          target: '{{grpcTarget}}',
          descriptorKey: 'grpc.health.v1',
          service: 'grpc.health.v1.Health',
          method: 'Check',
          body: {},
          callType: 'unary',
          timeoutMs: 10000,
          saveAs: 'healthResult',
        },
      },
      {
        id: 'ghc-assert',
        type: 'grpcAssert',
        position: { x: 240, y: 290 },
        data: {
          label: '2. Assert Healthy',
          source: 'healthResult',
          assertions: [
            { grpcStatus: 0 },
            { grpcField: '$.status', equals: 'SERVING' },
          ],
          onError: 'fail',
        },
      },
      makeEndNode('ghc-end', 'Service Healthy', { x: 240, y: 420 }),
    ],
    edges: [
      makeEdge('ghc-e1', 'ghc-start', 'ghc-unary'),
      makeEdge('ghc-e2', 'ghc-unary', 'ghc-assert'),
      makeEdge('ghc-e3', 'ghc-assert', 'ghc-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Easy: gRPC User Lookup
//    Start → grpcUnary (GetUser) → grpcAssert (id + name exists) → End
// ────────────────────────────────────────────────────────────────────────────
export function createGrpcUserLookupWorkflow(): Workflow {
  return {
    id: 'sample-grpc-user-lookup',
    name: 'Sample: gRPC User Lookup',
    description: 'Fetches a user by ID via a unary gRPC call, extracts the name via saveAs binding, and asserts expected field values',
    variables: {
      grpcTarget: '{{grpcTarget}}',
      userId: '1',
    },
    nodes: [
      makeStartNode('gul-start', { grpcTarget: 'localhost:50051', userId: '1' }, { x: 240, y: 30 }),
      {
        id: 'gul-get-user',
        type: 'grpcUnary',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Get User',
          target: '{{grpcTarget}}',
          descriptorKey: 'users.v1',
          service: 'users.v1.UserService',
          method: 'GetUser',
          body: { id: '{{userId}}' },
          callType: 'unary',
          timeoutMs: 10000,
          saveAs: 'userResult',
        },
      },
      {
        id: 'gul-assert',
        type: 'grpcAssert',
        position: { x: 240, y: 290 },
        data: {
          label: '2. Assert User Fields',
          source: 'userResult',
          assertions: [
            { grpcStatus: 0 },
            { grpcField: '$.user.id', equals: '{{userId}}' },
            { grpcField: '$.user.name', exists: true },
            { grpcField: '$.user.email', exists: true },
          ],
          onError: 'fail',
        },
      },
      makeEndNode('gul-end', 'User Verified', { x: 240, y: 420 }),
    ],
    edges: [
      makeEdge('gul-e1', 'gul-start', 'gul-get-user'),
      makeEdge('gul-e2', 'gul-get-user', 'gul-assert'),
      makeEdge('gul-e3', 'gul-assert', 'gul-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Medium: gRPC Server Streaming — List Orders
//    Start → grpcServerStream (ListOrders, collect ≤20) → grpcAssert → End
// ────────────────────────────────────────────────────────────────────────────
export function createGrpcServerStreamWorkflow(): Workflow {
  return {
    id: 'sample-grpc-server-stream',
    name: 'Sample: gRPC Server Stream — Order Feed',
    description: 'Calls a server-streaming ListOrders RPC, collects up to 20 messages, then asserts at least one message was received',
    variables: {
      grpcTarget: 'localhost:50051',
      orderStatus: 'PENDING',
    },
    nodes: [
      makeStartNode('gss-start', { grpcTarget: 'localhost:50051', orderStatus: 'PENDING' }, { x: 240, y: 30 }),
      {
        id: 'gss-stream',
        type: 'grpcServerStream',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Stream Orders',
          target: '{{grpcTarget}}',
          descriptorKey: 'orders.v1',
          service: 'orders.v1.OrderService',
          method: 'ListOrders',
          body: { status: '{{orderStatus}}' },
          callType: 'server_streaming',
          collect: {
            maxMessages: 20,
            maxDurationMs: 5000,
          },
          timeoutMs: 10000,
          saveAs: 'orderFeed',
        },
      },
      {
        id: 'gss-assert',
        type: 'grpcAssert',
        position: { x: 240, y: 290 },
        data: {
          label: '2. Assert Stream Not Empty',
          source: 'orderFeed',
          assertions: [
            { grpcStatus: 0 },
            { grpcStreamLength: { min: 1 } },
          ],
          onError: 'fail',
        },
      },
      makeEndNode('gss-end', 'Orders Collected', { x: 240, y: 420 }),
    ],
    edges: [
      makeEdge('gss-e1', 'gss-start', 'gss-stream'),
      makeEdge('gss-e2', 'gss-stream', 'gss-assert'),
      makeEdge('gss-e3', 'gss-assert', 'gss-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Medium: gRPC CRUD Flow
//    Start → grpcUnary (Create) → grpcUnary (Get) → grpcAssert → grpcUnary (Delete) → grpcAssert → End
// ────────────────────────────────────────────────────────────────────────────
export function createGrpcCrudWorkflow(): Workflow {
  return {
    id: 'sample-grpc-crud',
    name: 'Sample: gRPC Create → Fetch → Delete',
    description: 'Three chained unary gRPC calls: create a product, fetch it back to verify, then delete it. Threads productId between steps via saveAs bindings.',
    variables: {
      grpcTarget: 'localhost:50051',
      productName: 'Test Widget',
    },
    nodes: [
      makeStartNode('gcrud-start', { grpcTarget: 'localhost:50051', productName: 'Test Widget' }, { x: 240, y: 30 }),
      {
        id: 'gcrud-create',
        type: 'grpcUnary',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Create Product',
          target: '{{grpcTarget}}',
          descriptorKey: 'products.v1',
          service: 'products.v1.ProductService',
          method: 'CreateProduct',
          body: { name: '{{productName}}', price: 9.99 },
          callType: 'unary',
          timeoutMs: 10000,
          saveAs: 'createResult',
        },
      },
      {
        id: 'gcrud-get',
        type: 'grpcUnary',
        position: { x: 240, y: 290 },
        data: {
          label: '2. Get Product',
          target: '{{grpcTarget}}',
          descriptorKey: 'products.v1',
          service: 'products.v1.ProductService',
          method: 'GetProduct',
          body: { id: '{{grpc.createResult.product.id}}' },
          callType: 'unary',
          timeoutMs: 10000,
          saveAs: 'getResult',
        },
      },
      {
        id: 'gcrud-assert-get',
        type: 'grpcAssert',
        position: { x: 240, y: 430 },
        data: {
          label: '3. Verify Product Name',
          source: 'getResult',
          assertions: [
            { grpcStatus: 0 },
            { grpcField: '$.product.name', equals: '{{productName}}' },
          ],
          onError: 'fail',
        },
      },
      {
        id: 'gcrud-delete',
        type: 'grpcUnary',
        position: { x: 240, y: 570 },
        data: {
          label: '4. Delete Product',
          target: '{{grpcTarget}}',
          descriptorKey: 'products.v1',
          service: 'products.v1.ProductService',
          method: 'DeleteProduct',
          body: { id: '{{grpc.createResult.product.id}}' },
          callType: 'unary',
          timeoutMs: 10000,
          saveAs: 'deleteResult',
        },
      },
      {
        id: 'gcrud-assert-delete',
        type: 'grpcAssert',
        position: { x: 240, y: 710 },
        data: {
          label: '5. Verify Deleted',
          source: 'deleteResult',
          assertions: [
            { grpcStatus: 0 },
            { grpcField: '$.success', equals: true },
          ],
          onError: 'fail',
        },
      },
      makeEndNode('gcrud-end', 'CRUD Complete', { x: 240, y: 840 }),
    ],
    edges: [
      makeEdge('gcrud-e1', 'gcrud-start', 'gcrud-create'),
      makeEdge('gcrud-e2', 'gcrud-create', 'gcrud-get'),
      makeEdge('gcrud-e3', 'gcrud-get', 'gcrud-assert-get'),
      makeEdge('gcrud-e4', 'gcrud-assert-get', 'gcrud-delete'),
      makeEdge('gcrud-e5', 'gcrud-delete', 'gcrud-assert-delete'),
      makeEdge('gcrud-e6', 'gcrud-assert-delete', 'gcrud-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 5. Advanced: gRPC Schema Drift Watchdog
//    Schedule → grpcSchemaDiff → condition → logDebug (warn/info) → End
// ────────────────────────────────────────────────────────────────────────────
export function createGrpcSchemaDiffWorkflow(): Workflow {
  return {
    id: 'sample-grpc-schema-diff',
    name: 'Sample: gRPC Schema Drift Watchdog',
    description: 'Runs hourly via schedule trigger; compares a baseline proto descriptor against the live reflection and logs an error if breaking changes are detected',
    variables: {
      baselineDescriptor: 'proto-baseline-v1',
      liveDescriptor: 'proto-live',
    },
    nodes: [
      {
        id: 'gsd-schedule',
        type: 'schedule',
        position: { x: 240, y: 30 },
        data: {
          label: 'Hourly Schedule',
          cronExpression: '0 * * * *',
          timezone: 'UTC',
          scheduleDescription: 'Every hour',
        },
      },
      {
        id: 'gsd-diff',
        type: 'grpcSchemaDiff',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Compare Proto Schemas',
          leftDescriptorKey: '{{baselineDescriptor}}',
          rightDescriptorKey: '{{liveDescriptor}}',
          failOnBreaking: false,
          saveAs: 'diffResult',
          onError: 'continue',
        },
      },
      makeConditionNode(
        'gsd-condition',
        '2. Breaking Changes?',
        '{{grpc.diffResult.hasBreakingChanges}}',
        'true',
        { operator: '==', x: 240, y: 290 },
      ),
      makeLogDebugNode(
        'gsd-log-breaking',
        '3a. Breaking Change Alert',
        '⚠️ Breaking proto schema change detected! Baseline: {{baselineDescriptor}} → Live: {{liveDescriptor}}',
        'error',
        { x: 80, y: 430 },
      ),
      makeLogDebugNode(
        'gsd-log-ok',
        '3b. Schema OK',
        '✓ Proto schema is compatible. Baseline: {{baselineDescriptor}} matches live reflection.',
        'info',
        { x: 400, y: 430 },
      ),
      makeEndNode('gsd-end', 'Watchdog Done', { x: 240, y: 560 }),
    ],
    edges: [
      makeEdge('gsd-e1', 'gsd-schedule', 'gsd-diff'),
      makeEdge('gsd-e2', 'gsd-diff', 'gsd-condition'),
      makeEdge('gsd-e3', 'gsd-condition', 'gsd-log-breaking', 'true'),
      makeEdge('gsd-e4', 'gsd-condition', 'gsd-log-ok', 'false'),
      makeEdge('gsd-e5', 'gsd-log-breaking', 'gsd-end'),
      makeEdge('gsd-e6', 'gsd-log-ok', 'gsd-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 6. Advanced: gRPC Load Test — Bounded Unary
//    Start → grpcLoadTest → condition (p95 + errorRate SLA) → logDebug → End
// ────────────────────────────────────────────────────────────────────────────
export function createGrpcLoadTestWorkflow(): Workflow {
  return {
    id: 'sample-grpc-load-test',
    name: 'Sample: gRPC Load Test — Bounded Unary',
    description: 'Runs a 50-concurrency / 10-second bounded load test against a unary RPC, then gates on p95 ≤ 200ms via a condition node (grpcAssert has no numeric comparison operators)',
    variables: {
      grpcTarget: 'localhost:50051',
      p95ThresholdMs: '200',
      errorRateThreshold: '1',
    },
    nodes: [
      makeStartNode(
        'glt-start',
        { grpcTarget: 'localhost:50051', p95ThresholdMs: '200', errorRateThreshold: '1' },
        { x: 240, y: 30 },
      ),
      {
        id: 'glt-load-test',
        type: 'grpcLoadTest',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Load Test GetUser',
          target: '{{grpcTarget}}',
          descriptorKey: 'users.v1',
          service: 'users.v1.UserService',
          method: 'GetUser',
          body: { id: '1' },
          callType: 'unary',
          timeoutMs: 15000,
          loadTest: {
            concurrency: 50,
            durationMs: 10000,
            rampUpMs: 2000,
            warmupCalls: 5,
          },
          saveAs: 'loadResult',
        },
      },
      makeConditionNode(
        'glt-condition',
        '2. SLA Gate',
        '{{grpc.loadResult.p95Ms}}',
        '{{p95ThresholdMs}}',
        { operator: '<=', x: 240, y: 290 },
      ),
      makeLogDebugNode(
        'glt-log-pass',
        '3a. SLA Passed',
        '✓ Load test SLA met — p95={{grpc.loadResult.p95Ms}}ms, errors={{grpc.loadResult.failed}}/{{grpc.loadResult.totalCalls}}',
        'info',
        { x: 80, y: 430 },
      ),
      makeLogDebugNode(
        'glt-log-fail',
        '3b. SLA Violation',
        '⚠️ Load test SLA violated — p95={{grpc.loadResult.p95Ms}}ms exceeded {{p95ThresholdMs}}ms threshold',
        'error',
        { x: 400, y: 430 },
      ),
      makeEndNode('glt-end', 'Load Test Done', { x: 240, y: 560 }),
    ],
    edges: [
      makeEdge('glt-e1', 'glt-start', 'glt-load-test'),
      makeEdge('glt-e2', 'glt-load-test', 'glt-condition'),
      makeEdge('glt-e3', 'glt-condition', 'glt-log-pass', 'true'),
      makeEdge('glt-e4', 'glt-condition', 'glt-log-fail', 'false'),
      makeEdge('glt-e5', 'glt-log-pass', 'glt-end'),
      makeEdge('glt-e6', 'glt-log-fail', 'glt-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
