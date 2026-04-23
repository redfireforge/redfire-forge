import type { Workflow } from '../types/workflow';

export interface SampleWorkflowEntry {
  id: string;
  name: string;
  description: string;
  factory: () => Workflow;
}

/**
 * Pre-built sample workflow: sequential HTTP calls with variable chaining.
 * Uses jsonplaceholder.typicode.com — a free public REST API with real responses.
 * Flow: Create Post → Check Created? → Wait → Get Post → Verify
 */
function createOrderWorkflow(): Workflow {
  const nodeIds = {
    start: 'sample-order-start',
    create: 'sample-n1-create',
    checkStatus: 'sample-n2-check-status',
    delay: 'sample-n4-delay',
    getDetails: 'sample-n3-get-details',
    verify: 'sample-n5-verify',
  };

  return {
    id: 'sample-workflow-001',
    name: 'Sample: Create → Extract → Verify',
    description: 'Demonstrates multi-step API testing with variable chaining using a public REST API.',
    variables: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
    },
    nodes: [
      {
        id: nodeIds.start,
        type: 'start',
        position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: nodeIds.create,
        type: 'http',
        position: { x: 200, y: 100 },
        data: {
          label: '1. Create Post',
          scenario: {
            id: 'sample-s1',
            name: 'Create Post',
            url: '{{baseUrl}}/posts',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: JSON.stringify({
              title: 'Sample Post',
              body: 'This is a test post created by the workflow.',
              userId: 1,
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'postId', source: 'body', expression: '$.id' },
              { name: 'httpStatus', source: 'status', expression: '' },
            ],
          },
        },
      },
      {
        id: nodeIds.checkStatus,
        type: 'condition',
        position: { x: 240, y: 250 },
        data: {
          label: '2. Was it Created?',
          left: '{{httpStatus}}',
          operator: '==',
          right: '201',
        },
      },
      {
        id: nodeIds.delay,
        type: 'delay',
        position: { x: 250, y: 380 },
        data: {
          label: '3. Wait for Processing',
          delayMs: 1000,
          mode: 'fixed',
        },
      },
      {
        id: nodeIds.getDetails,
        type: 'http',
        position: { x: 200, y: 480 },
        data: {
          label: '4. Get Post Details',
          scenario: {
            id: 'sample-s3',
            name: 'Get Post Details',
            url: '{{baseUrl}}/posts/1',
            method: 'GET',
            headers: [
              { key: 'Accept', value: 'application/json' },
            ],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'postTitle', source: 'body', expression: '$.title' },
              { name: 'postUserId', source: 'body', expression: '$.userId' },
            ],
          },
        },
      },
      {
        id: nodeIds.verify,
        type: 'condition',
        position: { x: 240, y: 630 },
        data: {
          label: '5. Has Valid User?',
          left: '{{postUserId}}',
          operator: '==',
          right: '1',
        },
      },
    ],
    edges: [
      { id: 'sample-e0', source: nodeIds.start, target: nodeIds.create },
      { id: 'sample-e1', source: nodeIds.create, target: nodeIds.checkStatus },
      { id: 'sample-e2', source: nodeIds.checkStatus, target: nodeIds.delay, sourceHandle: 'true', label: 'Yes' },
      { id: 'sample-e3', source: nodeIds.delay, target: nodeIds.getDetails },
      { id: 'sample-e4', source: nodeIds.getDetails, target: nodeIds.verify },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow demonstrating parallel execution with Fork and Join nodes.
 * Uses jsonplaceholder.typicode.com for real API responses.
 * Flow: Start → GET post → Fork → [GET Users, GET Comments] → Join → POST summary
 */
function createParallelForkWorkflow(): Workflow {
  return {
    id: 'sample-workflow-parallel',
    name: 'Sample: Parallel API Calls',
    description: 'Demonstrates Fork and Join nodes for running multiple API calls simultaneously and merging results.',
    variables: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
    },
    nodes: [
      {
        id: 'sp-start',
        type: 'start',
        position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: 'sp-get-post',
        type: 'http',
        position: { x: 200, y: 100 },
        data: {
          label: '1. Get Post',
          scenario: {
            id: 'sp-s1',
            name: 'Get Post',
            url: '{{baseUrl}}/posts/1',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'postTitle', source: 'body', expression: '$.title' },
              { name: 'postUserId', source: 'body', expression: '$.userId' },
            ],
          },
        },
      },
      {
        id: 'sp-fork',
        type: 'fork',
        position: { x: 240, y: 250 },
        data: { label: '2. Parallel Fork' },
      },
      {
        id: 'sp-users',
        type: 'http',
        position: { x: 50, y: 370 },
        data: {
          label: '3a. Get Users',
          scenario: {
            id: 'sp-s2',
            name: 'Get Users',
            url: '{{baseUrl}}/users',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'firstUserName', source: 'body', expression: '$[0].name' },
              { name: 'firstUserEmail', source: 'body', expression: '$[0].email' },
            ],
          },
        },
      },
      {
        id: 'sp-comments',
        type: 'http',
        position: { x: 350, y: 370 },
        data: {
          label: '3b. Get Comments',
          scenario: {
            id: 'sp-s3',
            name: 'Get Comments',
            url: '{{baseUrl}}/posts/1/comments',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'firstCommentEmail', source: 'body', expression: '$[0].email' },
              { name: 'firstCommentName', source: 'body', expression: '$[0].name' },
            ],
          },
        },
      },
      {
        id: 'sp-join',
        type: 'join',
        position: { x: 240, y: 520 },
        data: { label: '4. Join' },
      },
      {
        id: 'sp-summary',
        type: 'http',
        position: { x: 200, y: 620 },
        data: {
          label: '5. Post Summary',
          scenario: {
            id: 'sp-s4',
            name: 'Post Summary',
            url: '{{baseUrl}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              title: 'Workflow Summary',
              body: 'First user: {{firstUserName}} ({{firstUserEmail}}), First commenter: {{firstCommentName}} ({{firstCommentEmail}})',
              userId: 1,
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
    ],
    edges: [
      { id: 'sp-e0', source: 'sp-start', target: 'sp-get-post' },
      { id: 'sp-e1', source: 'sp-get-post', target: 'sp-fork' },
      { id: 'sp-e2', source: 'sp-fork', target: 'sp-users' },
      { id: 'sp-e3', source: 'sp-fork', target: 'sp-comments' },
      { id: 'sp-e4', source: 'sp-users', target: 'sp-join' },
      { id: 'sp-e5', source: 'sp-comments', target: 'sp-join' },
      { id: 'sp-e6', source: 'sp-join', target: 'sp-summary' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow demonstrating conditional branching with Yes/No paths.
 * Uses jsonplaceholder.typicode.com for real API responses.
 * Flow: Start → Get User → If found (200)? → Yes: Get Posts, No: Create User
 */
function createConditionalBranchWorkflow(): Workflow {
  return {
    id: 'sample-workflow-branching',
    name: 'Sample: Conditional Branching',
    description: 'Demonstrates If/Else branching with different API paths based on conditions.',
    variables: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      userId: '1',
    },
    nodes: [
      {
        id: 'sb-start',
        type: 'start',
        position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: 'sb-check',
        type: 'http',
        position: { x: 200, y: 100 },
        data: {
          label: '1. Get User',
          scenario: {
            id: 'sb-s1',
            name: 'Get User',
            url: '{{baseUrl}}/users/{{userId}}',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'userName', source: 'body', expression: '$.name' },
              { name: 'httpStatus', source: 'status', expression: '' },
            ],
          },
        },
      },
      {
        id: 'sb-cond',
        type: 'condition',
        position: { x: 240, y: 250 },
        data: {
          label: '2. User Found?',
          left: '{{httpStatus}}',
          operator: '==',
          right: '200',
        },
      },
      {
        id: 'sb-profile',
        type: 'http',
        position: { x: 50, y: 380 },
        data: {
          label: '3a. Get User Posts',
          scenario: {
            id: 'sb-s2',
            name: 'Get User Posts',
            url: '{{baseUrl}}/users/{{userId}}/posts',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'firstPostTitle', source: 'body', expression: '$[0].title' },
            ],
          },
        },
      },
      {
        id: 'sb-create',
        type: 'http',
        position: { x: 350, y: 380 },
        data: {
          label: '3b. Create User',
          scenario: {
            id: 'sb-s3',
            name: 'Create User',
            url: '{{baseUrl}}/users',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: JSON.stringify({ name: 'New User', username: 'newuser', email: 'new@example.com' }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [],
          },
        },
      },
    ],
    edges: [
      { id: 'sb-e0', source: 'sb-start', target: 'sb-check' },
      { id: 'sb-e1', source: 'sb-check', target: 'sb-cond' },
      { id: 'sb-e2', source: 'sb-cond', target: 'sb-profile', sourceHandle: 'true', label: 'Yes' },
      { id: 'sb-e3', source: 'sb-cond', target: 'sb-create', sourceHandle: 'false', label: 'No' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow demonstrating webhook trigger with payload extraction.
 * Flow: Webhook receives order → Check inventory → If in stock: Process order, Else: Send alert
 */
function createWebhookTriggerWorkflow(): Workflow {
  return {
    id: 'sample-workflow-webhook',
    name: 'Sample: Webhook Trigger',
    description: 'Webhook-triggered order processing with payload extraction and conditional branching',
    variables: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
    },
    nodes: [
      {
        id: 'wh-webhook',
        type: 'webhook',
        position: { x: 240, y: 0 },
        data: {
          label: 'Order Webhook',
          method: 'POST',
          path: '/api/orders/incoming',
          samplePayload: JSON.stringify({
            orderId: 'ORD-12345',
            customerId: '1',
            items: [
              { sku: 'ITEM-001', quantity: 2, price: 29.99 },
            ],
            totalAmount: 59.98,
            orderDate: '2026-04-23T10:30:00Z',
          }, null, 2),
          extractVariables: [
            { name: 'orderId', jsonPath: '$.orderId' },
            { name: 'customerId', jsonPath: '$.customerId' },
            { name: 'totalAmount', jsonPath: '$.totalAmount' },
          ],
          notes: 'Extracts orderId, customerId, and totalAmount from incoming webhook payload',
        },
      },
      {
        id: 'wh-check-inventory',
        type: 'http',
        position: { x: 200, y: 150 },
        data: {
          label: '1. Check Inventory',
          scenario: {
            id: 'wh-s1',
            name: 'Check Inventory',
            url: '{{baseUrl}}/users/{{customerId}}',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'stockLevel', source: 'body', expression: '$.id' },
              { name: 'customerName', source: 'body', expression: '$.name' },
            ],
          },
        },
      },
      {
        id: 'wh-condition',
        type: 'condition',
        position: { x: 240, y: 300 },
        data: {
          label: '2. In Stock?',
          left: '{{stockLevel}}',
          operator: '>',
          right: '0',
        },
      },
      {
        id: 'wh-process',
        type: 'http',
        position: { x: 50, y: 450 },
        data: {
          label: '3a. Process Order',
          scenario: {
            id: 'wh-s2',
            name: 'Process Order',
            url: '{{baseUrl}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              title: 'Order {{orderId}} Processed',
              body: 'Customer: {{customerName}} (ID: {{customerId}}), Amount: ${{totalAmount}}, Status: processing',
              userId: 1,
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'wh-alert',
        type: 'http',
        position: { x: 400, y: 450 },
        data: {
          label: '3b. Out of Stock Alert',
          scenario: {
            id: 'wh-s3',
            name: 'Send Alert',
            url: '{{baseUrl}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              title: 'Out of Stock Alert: Order {{orderId}}',
              body: 'Customer {{customerName}} ({{customerId}}) - Order {{orderId}} cannot be processed. Item out of stock.',
              userId: 1,
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'wh-end-success',
        type: 'end',
        position: { x: 50, y: 600 },
        data: { label: 'Order Processed', isSuccess: true },
      },
      {
        id: 'wh-end-failure',
        type: 'end',
        position: { x: 400, y: 600 },
        data: { label: 'Out of Stock', isSuccess: false },
      },
    ],
    edges: [
      { id: 'wh-e1', source: 'wh-webhook', target: 'wh-check-inventory' },
      { id: 'wh-e2', source: 'wh-check-inventory', target: 'wh-condition' },
      { id: 'wh-e3', source: 'wh-condition', target: 'wh-process', sourceHandle: 'true', label: 'Yes' },
      { id: 'wh-e4', source: 'wh-condition', target: 'wh-alert', sourceHandle: 'false', label: 'No' },
      { id: 'wh-e5', source: 'wh-process', target: 'wh-end-success' },
      { id: 'wh-e6', source: 'wh-alert', target: 'wh-end-failure' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow demonstrating schedule trigger with cron-based execution.
 * Flow: Schedule trigger (daily) → Fetch data → Generate report → Fork → [Email + Archive] → Join
 */
function createScheduleTriggerWorkflow(): Workflow {
  return {
    id: 'sample-workflow-schedule',
    name: 'Sample: Schedule Trigger',
    description: 'Cron-scheduled daily report generation with parallel email delivery and archiving',
    variables: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      reportType: 'daily_sales',
    },
    nodes: [
      {
        id: 'sc-schedule',
        type: 'schedule',
        position: { x: 240, y: 0 },
        data: {
          label: 'Daily 9 AM Trigger',
          cronExpression: '0 9 * * *',
          timezone: 'America/New_York',
          scheduleDescription: 'Every day at 9:00 AM EST',
          inputVariables: {
            reportType: 'daily_sales',
            lookbackDays: '1',
          },
          notes: 'Runs daily at 9 AM EST. Automatic variables: triggerTime, triggerTimestamp',
        },
      },
      {
        id: 'sc-fetch',
        type: 'http',
        position: { x: 200, y: 150 },
        data: {
          label: '1. Fetch Sales Data',
          scenario: {
            id: 'sc-s1',
            name: 'Fetch Sales Data',
            url: '{{baseUrl}}/posts?userId=1',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'totalSales', source: 'body', expression: '$[0].id' },
              { name: 'orderCount', source: 'body', expression: '$[1].id' },
              { name: 'postTitle', source: 'body', expression: '$[0].title' },
            ],
          },
        },
      },
      {
        id: 'sc-generate',
        type: 'http',
        position: { x: 200, y: 300 },
        data: {
          label: '2. Generate Report',
          scenario: {
            id: 'sc-s2',
            name: 'Generate Report',
            url: '{{baseUrl}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              title: 'Daily {{reportType}} Report - {{triggerTime}}',
              body: 'Report generated at {{triggerTime}} (timestamp: {{triggerTimestamp}}). Total Sales: ${{totalSales}}, Orders: {{orderCount}}',
              userId: 1,
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'reportId', source: 'body', expression: '$.id' },
            ],
          },
        },
      },
      {
        id: 'sc-fork',
        type: 'fork',
        position: { x: 240, y: 450 },
        data: { label: '3. Parallel Delivery' },
      },
      {
        id: 'sc-email',
        type: 'http',
        position: { x: 50, y: 570 },
        data: {
          label: '4a. Email Report',
          scenario: {
            id: 'sc-s3',
            name: 'Email Report',
            url: '{{baseUrl}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              title: 'Email: Daily Report {{reportId}}',
              body: 'Sending report to recipients. Total Sales: ${{totalSales}}, Orders: {{orderCount}}. Report: {{postTitle}}',
              userId: 1,
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'sc-archive',
        type: 'http',
        position: { x: 400, y: 570 },
        data: {
          label: '4b. Archive Report',
          scenario: {
            id: 'sc-s4',
            name: 'Archive Report',
            url: '{{baseUrl}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              title: 'Archive: Report {{reportId}}',
              body: 'Archiving {{reportType}} report. Timestamp: {{triggerTimestamp}}, Sales: ${{totalSales}}, Orders: {{orderCount}}',
              userId: 1,
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'sc-join',
        type: 'join',
        position: { x: 240, y: 720 },
        data: { label: '5. Wait for Completion' },
      },
      {
        id: 'sc-end',
        type: 'end',
        position: { x: 240, y: 820 },
        data: { label: 'Report Complete', isSuccess: true },
      },
    ],
    edges: [
      { id: 'sc-e1', source: 'sc-schedule', target: 'sc-fetch' },
      { id: 'sc-e2', source: 'sc-fetch', target: 'sc-generate' },
      { id: 'sc-e3', source: 'sc-generate', target: 'sc-fork' },
      { id: 'sc-e4', source: 'sc-fork', target: 'sc-email' },
      { id: 'sc-e5', source: 'sc-fork', target: 'sc-archive' },
      { id: 'sc-e6', source: 'sc-email', target: 'sc-join' },
      { id: 'sc-e7', source: 'sc-archive', target: 'sc-join' },
      { id: 'sc-e8', source: 'sc-join', target: 'sc-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** All available sample workflows. */
export const sampleWorkflowCatalog: SampleWorkflowEntry[] = [
  {
    id: 'sample-workflow-001',
    name: 'Create → Extract → Verify',
    description: 'Sequential HTTP calls with variable chaining, conditions, and delays',
    factory: createOrderWorkflow,
  },
  {
    id: 'sample-workflow-parallel',
    name: 'Parallel API Calls',
    description: 'Fork/Join pattern splits execution into concurrent HTTP requests and merges results',
    factory: createParallelForkWorkflow,
  },
  {
    id: 'sample-workflow-branching',
    name: 'Conditional Branching',
    description: 'If/Else paths leading to different API endpoints',
    factory: createConditionalBranchWorkflow,
  },
  {
    id: 'sample-workflow-webhook',
    name: '🪝 Webhook Trigger',
    description: 'Order processing triggered by incoming HTTP webhooks with payload extraction',
    factory: createWebhookTriggerWorkflow,
  },
  {
    id: 'sample-workflow-schedule',
    name: '⏰ Schedule Trigger',
    description: 'Daily report generation with cron-based scheduling and automatic time variables',
    factory: createScheduleTriggerWorkflow,
  },
];
