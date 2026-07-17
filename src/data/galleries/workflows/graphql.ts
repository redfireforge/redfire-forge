import type { Workflow } from '../../../features/workflow/types/workflow';
import {
  makeStartNode,
  makeEndNode,
  makeConditionNode,
  makeLogDebugNode,
  makeEdge,
} from './nodeFactories';

/**
 * GraphQL gallery workflow samples.
 *
 * Four samples spanning easy → medium:
 *  1. GraphQL Health Check (easy)     — Introspect + sentinel query + assert latency
 *  2. GraphQL E-Commerce Flow (medium)— Mutation → Subscription → Assert
 *  3. GraphQL Schema Watchdog (medium)— Schedule → Introspect → Condition (hash diff)
 *  4. GraphQL User CRUD (medium)      — Create → Fetch → Assert → Delete
 */

// ────────────────────────────────────────────────────────────────────────────
// 1. Easy: GraphQL Health Check
//    Start → graphqlIntrospect → graphqlQuery → graphqlAssert → End
// ────────────────────────────────────────────────────────────────────────────
export function createGraphqlHealthCheckWorkflow(): Workflow {
  return {
    id: 'sample-graphql-health-check',
    name: 'Sample: GraphQL Health Check',
    description: 'Verifies a GraphQL API is reachable via introspection, runs a sentinel query, and asserts response latency is under 500ms',
    variables: {
      gqlEndpoint: 'http://localhost:4000/graphql',
      apiSchemaHash: '',
      sentinelLatency: '',
      sentinelData: '',
    },
    nodes: [
      makeStartNode('ghc-start', { gqlEndpoint: 'http://localhost:4000/graphql' }, { x: 240, y: 30 }),
      {
        id: 'ghc-introspect',
        type: 'graphqlIntrospect',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Introspect API',
          endpoint: '{{gqlEndpoint}}',
          headers: [],
          timeoutMs: 30000,
          outputBindings: [
            { field: 'schemaHash', variableName: 'apiSchemaHash', enabled: true },
          ],
        },
      },
      {
        id: 'ghc-query',
        type: 'graphqlQuery',
        position: { x: 240, y: 290 },
        data: {
          label: '2. Sentinel Query',
          endpoint: '{{gqlEndpoint}}',
          query: 'query HealthCheck {\n  __typename\n}',
          variables: '{}',
          headers: [],
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [
            { field: 'latencyMs', variableName: 'sentinelLatency', enabled: true },
            { field: 'data', variableName: 'sentinelData', enabled: true },
          ],
        },
      },
      {
        id: 'ghc-assert',
        type: 'graphqlAssert',
        position: { x: 240, y: 430 },
        data: {
          label: '3. Assert Health',
          sourceVariable: 'sentinelLatency',
          assertions: [
            {
              id: 'a1',
              jsonPath: '$',
              operator: 'less_than',
              expectedValue: '500',
              description: 'Latency under 500ms',
            },
          ],
          failBehavior: 'error',
        },
      },
      makeEndNode('ghc-end', 'API Healthy', { x: 240, y: 560 }),
    ],
    edges: [
      makeEdge('ghc-e1', 'ghc-start', 'ghc-introspect'),
      makeEdge('ghc-e2', 'ghc-introspect', 'ghc-query'),
      makeEdge('ghc-e3', 'ghc-query', 'ghc-assert'),
      makeEdge('ghc-e4', 'ghc-assert', 'ghc-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Medium: GraphQL E-Commerce Flow
//    Start → graphqlMutation (create order) → graphqlSubscription (watch status)
//         → graphqlAssert (assert complete) → End
// ────────────────────────────────────────────────────────────────────────────
export function createGraphqlECommerceFlowWorkflow(): Workflow {
  return {
    id: 'sample-graphql-e-commerce-flow',
    name: 'Sample: GraphQL E-Commerce Order Flow',
    description: 'Creates an order via GraphQL mutation, subscribes to status updates until COMPLETE, then asserts the final status',
    variables: {
      gqlEndpoint: 'http://localhost:4000/graphql',
      customerId: 'CUST-001',
      orderId: '',
      finalStatus: '',
    },
    nodes: [
      makeStartNode('gec-start', { gqlEndpoint: 'http://localhost:4000/graphql', customerId: 'CUST-001' }, { x: 240, y: 30 }),
      {
        id: 'gec-create-order',
        type: 'graphqlMutation',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Create Order',
          endpoint: '{{gqlEndpoint}}',
          query: 'mutation CreateOrder($input: OrderInput!) {\n  createOrder(input: $input) {\n    id\n    status\n  }\n}',
          variables: '{\n  "input": {\n    "customerId": "{{customerId}}",\n    "items": []\n  }\n}',
          headers: [],
          timeoutMs: 30000,
          extractionRules: [
            { variableName: 'orderId', jsonPath: '$.createOrder.id' },
          ],
          outputBindings: [],
        },
      },
      {
        id: 'gec-watch-status',
        type: 'graphqlSubscription',
        position: { x: 240, y: 310 },
        data: {
          label: '2. Watch Order Status',
          endpoint: '{{gqlEndpoint}}',
          subscriptionQuery: 'subscription WatchOrder($orderId: ID!) {\n  orderStatus(orderId: $orderId) {\n    status\n    updatedAt\n  }\n}',
          variables: '{\n  "orderId": {{orderId}}\n}',
          headers: [],
          subscriptionTransport: 'auto',
          stopAfterMessages: 50,
          // stopCondition uses a JSONPath applied to msg.data (the handler strips the outer data wrapper).
          // $.orderStatus.status returns a truthy string value on any message that has a status, so the
          // subscription stops as soon as an orderStatus.status field appears. The downstream assert
          // verifies the value equals COMPLETE.
          stopCondition: '$.orderStatus.status',
          extractionRules: [],
          outputBindings: [
            { field: 'lastMessage', variableName: 'finalStatus', enabled: true },
          ],
        },
      },
      {
        id: 'gec-assert',
        type: 'graphqlAssert',
        position: { x: 240, y: 470 },
        data: {
          label: '3. Assert Order Complete',
          sourceVariable: 'finalStatus',
          assertions: [
            {
              id: 'a1',
              // lastMessage binding stores msg.data (inner data, outer data wrapper stripped by handler).
              // JSONPath root is the orderStatus object directly, not $.data.orderStatus.
              jsonPath: '$.orderStatus.status',
              operator: 'equals',
              expectedValue: 'COMPLETE',
              description: 'Order reached COMPLETE status',
            },
          ],
          failBehavior: 'error',
        },
      },
      makeEndNode('gec-end', 'Order Completed', { x: 240, y: 600 }),
    ],
    edges: [
      makeEdge('gec-e1', 'gec-start', 'gec-create-order'),
      makeEdge('gec-e2', 'gec-create-order', 'gec-watch-status'),
      makeEdge('gec-e3', 'gec-watch-status', 'gec-assert'),
      makeEdge('gec-e4', 'gec-assert', 'gec-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Medium: GraphQL Schema Watchdog
//    scheduleTrigger → graphqlIntrospect → condition (hash changed?) → logDebug → End
// ────────────────────────────────────────────────────────────────────────────
export function createGraphqlSchemaWatchdogWorkflow(): Workflow {
  return {
    id: 'sample-graphql-schema-watchdog',
    name: 'Sample: GraphQL Schema Watchdog',
    description: 'Polls a GraphQL schema on a cron schedule; logs a warning whenever the schema hash changes (indicating a schema modification)',
    variables: {
      gqlEndpoint: 'http://localhost:4000/graphql',
      lastKnownHash: '',
      currentHash: '',
    },
    nodes: [
      {
        id: 'gsw-schedule',
        type: 'schedule',
        position: { x: 240, y: 30 },
        data: {
          label: 'Every Hour',
          cronExpression: '0 * * * *',
          timezone: 'UTC',
          scheduleDescription: 'Every hour',
        },
      },
      {
        id: 'gsw-introspect',
        type: 'graphqlIntrospect',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Check Schema',
          endpoint: '{{gqlEndpoint}}',
          headers: [],
          timeoutMs: 30000,
          outputBindings: [
            { field: 'schemaHash', variableName: 'currentHash', enabled: true },
          ],
        },
      },
      makeConditionNode(
        'gsw-condition',
        '2. Schema Changed?',
        '{{currentHash}}',
        '{{lastKnownHash}}',
        { operator: '!=', x: 240, y: 290 },
      ),
      makeLogDebugNode(
        'gsw-log',
        '3. Schema Change Detected',
        'Schema hash changed! Previous: {{lastKnownHash}} → New: {{currentHash}}',
        'warn',
        { x: 120, y: 430 },
      ),
      makeEndNode('gsw-end', 'Done', { x: 240, y: 560 }),
    ],
    edges: [
      makeEdge('gsw-e1', 'gsw-schedule', 'gsw-introspect'),
      makeEdge('gsw-e2', 'gsw-introspect', 'gsw-condition'),
      { id: 'gsw-e3', source: 'gsw-condition', target: 'gsw-log', sourceHandle: 'true', label: 'Changed' },
      { id: 'gsw-e4', source: 'gsw-condition', target: 'gsw-end', sourceHandle: 'false', label: 'No change' },
      makeEdge('gsw-e5', 'gsw-log', 'gsw-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Medium: GraphQL User CRUD
//    Start → graphqlMutation (create) → graphqlQuery (fetch) → graphqlAssert (verify)
//         → graphqlMutation (delete) → End
// ────────────────────────────────────────────────────────────────────────────
export function createGraphqlUserCrudWorkflow(): Workflow {
  return {
    id: 'sample-graphql-user-crud',
    name: 'Sample: GraphQL User CRUD',
    description: 'Full user lifecycle via GraphQL: create a user, fetch it back, assert the ID matches, then delete it',
    variables: {
      gqlEndpoint: 'http://localhost:4000/graphql',
      createdUserId: '',
      fetchedUser: '',
    },
    nodes: [
      makeStartNode('guc-start', { gqlEndpoint: 'http://localhost:4000/graphql' }, { x: 240, y: 30 }),
      {
        id: 'guc-create',
        type: 'graphqlMutation',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Create User',
          endpoint: '{{gqlEndpoint}}',
          query: 'mutation CreateUser($name: String!, $email: String!) {\n  createUser(name: $name, email: $email) {\n    id\n    name\n    email\n  }\n}',
          variables: '{\n  "name": "Test User",\n  "email": "test@example.com"\n}',
          headers: [],
          timeoutMs: 30000,
          extractionRules: [
            { variableName: 'createdUserId', jsonPath: '$.createUser.id' },
          ],
          outputBindings: [],
        },
      },
      {
        id: 'guc-fetch',
        type: 'graphqlQuery',
        position: { x: 240, y: 290 },
        data: {
          label: '2. Fetch User',
          endpoint: '{{gqlEndpoint}}',
          query: 'query GetUser($id: ID!) {\n  user(id: $id) {\n    id\n    name\n    email\n  }\n}',
          variables: '{\n  "id": {{createdUserId}}\n}',
          headers: [],
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [
            { field: 'data', variableName: 'fetchedUser', enabled: true },
          ],
        },
      },
      {
        id: 'guc-assert',
        type: 'graphqlAssert',
        position: { x: 240, y: 430 },
        data: {
          label: '3. Verify User',
          sourceVariable: 'fetchedUser',
          assertions: [
            {
              id: 'a1',
              jsonPath: '$.user.id',
              operator: 'equals',
              expectedValue: '{{createdUserId}}',
              description: 'Fetched user ID matches created ID',
            },
          ],
          failBehavior: 'error',
        },
      },
      {
        id: 'guc-delete',
        type: 'graphqlMutation',
        position: { x: 240, y: 570 },
        data: {
          label: '4. Delete User',
          endpoint: '{{gqlEndpoint}}',
          query: 'mutation DeleteUser($id: ID!) {\n  deleteUser(id: $id) {\n    success\n  }\n}',
          variables: '{\n  "id": {{createdUserId}}\n}',
          headers: [],
          timeoutMs: 30000,
          extractionRules: [],
          outputBindings: [],
        },
      },
      makeEndNode('guc-end', 'User Lifecycle Complete', { x: 240, y: 700 }),
    ],
    edges: [
      makeEdge('guc-e1', 'guc-start', 'guc-create'),
      makeEdge('guc-e2', 'guc-create', 'guc-fetch'),
      makeEdge('guc-e3', 'guc-fetch', 'guc-assert'),
      makeEdge('guc-e4', 'guc-assert', 'guc-delete'),
      makeEdge('guc-e5', 'guc-delete', 'guc-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
