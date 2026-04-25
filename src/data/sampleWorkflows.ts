import type { Workflow } from '../types/workflow';

export type SampleCategory = 'basics' | 'triggers' | 'logic' | 'advanced';

export interface SampleWorkflowEntry {
  id: string;
  name: string;
  description: string;
  category: SampleCategory;
  icon: string;
  nodeCount: number;
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
    variables: {},
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
            url: 'https://jsonplaceholder.typicode.com/posts',
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
            url: 'https://jsonplaceholder.typicode.com/posts/1',
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
    variables: {},
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
            url: 'https://jsonplaceholder.typicode.com/posts/1',
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
            url: 'https://jsonplaceholder.typicode.com/users',
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
            url: 'https://jsonplaceholder.typicode.com/posts/1/comments',
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
            url: 'https://jsonplaceholder.typicode.com/posts',
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
    variables: {},
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
            url: 'https://jsonplaceholder.typicode.com/users/1',
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
            url: 'https://jsonplaceholder.typicode.com/users/1/posts',
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
            url: 'https://jsonplaceholder.typicode.com/users',
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
    variables: {},
    nodes: [
      {
        id: 'wh-webhook',
        type: 'webhook',
        position: { x: 240, y: 50 },
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
        position: { x: 200, y: 180 },
        data: {
          label: '1. Check Inventory',
          scenario: {
            id: 'wh-s1',
            name: 'Check Inventory',
            url: 'https://jsonplaceholder.typicode.com/users/1',
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
        position: { x: 240, y: 320 },
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
        position: { x: 100, y: 460 },
        data: {
          label: '3a. Process Order',
          scenario: {
            id: 'wh-s2',
            name: 'Process Order',
            url: 'https://jsonplaceholder.typicode.com/posts',
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
        position: { x: 380, y: 460 },
        data: {
          label: '3b. Out of Stock Alert',
          scenario: {
            id: 'wh-s3',
            name: 'Send Alert',
            url: 'https://jsonplaceholder.typicode.com/posts',
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
        id: 'wh-end',
        type: 'end',
        position: { x: 240, y: 600 },
        data: { label: 'Order Handled', isSuccess: true },
      },
    ],
    edges: [
      { id: 'wh-e1', source: 'wh-webhook', target: 'wh-check-inventory' },
      { id: 'wh-e2', source: 'wh-check-inventory', target: 'wh-condition' },
      { id: 'wh-e3', source: 'wh-condition', target: 'wh-process', sourceHandle: 'true', label: 'Yes' },
      { id: 'wh-e4', source: 'wh-condition', target: 'wh-alert', sourceHandle: 'false', label: 'No' },
      { id: 'wh-e5', source: 'wh-process', target: 'wh-end' },
      { id: 'wh-e6', source: 'wh-alert', target: 'wh-end' },
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
            url: 'https://jsonplaceholder.typicode.com/posts?userId=1',
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
            url: 'https://jsonplaceholder.typicode.com/posts',
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
            url: 'https://jsonplaceholder.typicode.com/posts',
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
            url: 'https://jsonplaceholder.typicode.com/posts',
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

/**
 * Sample: Switch-based order routing.
 * Start → HTTP (fetch order) → Switch on orderType (standard / express / gift / default) → End
 */
function createSwitchRoutingWorkflow(): Workflow {
  return {
    id: 'sample-workflow-switch',
    name: 'Sample: Switch Order Router',
    description: 'Routes orders through different processing paths based on order type using a Switch node.',
    variables: {},
    nodes: [
      { id: 'sw-start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start', inputVariables: {} } },
      {
        id: 'sw-fetch', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: 'Fetch Order', scenario: {
            id: 'sw-s1', name: 'Fetch Order', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET',
            headers: [], body: '', bodyType: 'none', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'orderType', source: 'body', expression: '$.userId' },
              { name: 'orderTitle', source: 'body', expression: '$.title' },
            ],
          },
        },
      },
      {
        id: 'sw-switch', type: 'switch', position: { x: 280, y: 280 },
        data: {
          label: 'Route by Type', expression: '{{orderType}}',
          cases: [
            { id: 'c1', value: '1', label: 'Standard' },
            { id: 'c2', value: '2', label: 'Express' },
            { id: 'c3', value: '3', label: 'Gift' },
          ],
        },
      },
      {
        id: 'sw-standard', type: 'http', position: { x: 50, y: 450 },
        data: {
          label: 'Standard Processing', scenario: {
            id: 'sw-s2', name: 'Standard', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"type":"standard","order":"{{orderTitle}}"}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      {
        id: 'sw-express', type: 'http', position: { x: 280, y: 450 },
        data: {
          label: 'Express Processing', scenario: {
            id: 'sw-s3', name: 'Express', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"type":"express","priority":"high","order":"{{orderTitle}}"}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      {
        id: 'sw-gift', type: 'http', position: { x: 510, y: 450 },
        data: {
          label: 'Gift Processing', scenario: {
            id: 'sw-s4', name: 'Gift', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"type":"gift","wrapping":true,"order":"{{orderTitle}}"}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      {
        id: 'sw-default', type: 'http', position: { x: 740, y: 450 },
        data: {
          label: 'Default Handler', scenario: {
            id: 'sw-s5', name: 'Default', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"type":"unknown","order":"{{orderTitle}}"}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      { id: 'sw-end', type: 'end', position: { x: 350, y: 620 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'sw-e1', source: 'sw-start', target: 'sw-fetch' },
      { id: 'sw-e2', source: 'sw-fetch', target: 'sw-switch' },
      { id: 'sw-e3', source: 'sw-switch', target: 'sw-standard', sourceHandle: 'case-c1' },
      { id: 'sw-e4', source: 'sw-switch', target: 'sw-express', sourceHandle: 'case-c2' },
      { id: 'sw-e5', source: 'sw-switch', target: 'sw-gift', sourceHandle: 'case-c3' },
      { id: 'sw-e6', source: 'sw-switch', target: 'sw-default', sourceHandle: 'default' },
      { id: 'sw-e7', source: 'sw-standard', target: 'sw-end' },
      { id: 'sw-e8', source: 'sw-express', target: 'sw-end' },
      { id: 'sw-e9', source: 'sw-gift', target: 'sw-end' },
      { id: 'sw-e10', source: 'sw-default', target: 'sw-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample: Loop + Aggregate paginated API fetcher.
 * Start → SetVariable (init) → Loop (while hasMore) → HTTP (page) → Aggregate (concat items, sum totals)
 *       → SetVariable (next page) → done → Condition → End
 */
function createLoopAggregateWorkflow(): Workflow {
  return {
    id: 'sample-workflow-loop-agg',
    name: 'Sample: Paginated API Fetcher',
    description: 'Fetches pages of data in a while-loop, aggregates results with concat/sum/count, then checks totals.',
    variables: {},
    nodes: [
      { id: 'la-start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start', inputVariables: {} } },
      {
        id: 'la-init', type: 'setVariable', position: { x: 260, y: 120 },
        data: {
          label: 'Init Variables',
          assignments: [
            { id: 'a1', name: 'page', expression: '1' },
            { id: 'a2', name: 'hasMore', expression: 'true' },
            { id: 'a3', name: 'allItems', expression: '[]' },
            { id: 'a4', name: 'totalCount', expression: '0' },
          ],
        },
      },
      {
        id: 'la-loop', type: 'loop', position: { x: 280, y: 260 },
        data: {
          label: 'Fetch Pages', mode: 'while' as const,
          whileLeft: '{{hasMore}}', whileOperator: '==' as const, whileRight: 'true',
          maxIterations: 10,
        },
      },
      {
        id: 'la-fetch', type: 'http', position: { x: 240, y: 400 },
        data: {
          label: 'GET Page', scenario: {
            id: 'la-s1', name: 'Fetch Page', url: 'https://jsonplaceholder.typicode.com/posts?_page=1&_limit=10', method: 'GET',
            headers: [], body: '', bodyType: 'none', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'pageItems', source: 'body', expression: '$' },
              { name: 'itemCount', source: 'body', expression: '$.length' },
            ],
          },
        },
      },
      {
        id: 'la-agg', type: 'aggregate', position: { x: 240, y: 560 },
        data: {
          label: 'Accumulate',
          mappings: [
            { id: 'm1', sourceExpression: '{{pageItems}}', targetVariable: 'allItems', strategy: 'concat' as const },
            { id: 'm2', sourceExpression: '{{itemCount}}', targetVariable: 'totalCount', strategy: 'sum' as const },
          ],
        },
      },
      {
        id: 'la-next', type: 'setVariable', position: { x: 240, y: 700 },
        data: {
          label: 'Next Page',
          assignments: [
            { id: 'a1', name: 'page', expression: '{{page}}' },
            { id: 'a2', name: 'hasMore', expression: '{{itemCount}}' },
          ],
        },
      },
      {
        id: 'la-check', type: 'condition', position: { x: 260, y: 880 },
        data: { label: 'Many Items?', left: '{{totalCount}}', operator: '>' as const, right: '50' },
      },
      {
        id: 'la-alert', type: 'http', position: { x: 60, y: 1030 },
        data: {
          label: 'Send Alert', scenario: {
            id: 'la-s2', name: 'Alert', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"alert":"Large dataset: {{totalCount}} items fetched"}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      { id: 'la-end', type: 'end', position: { x: 300, y: 1180 }, data: { label: 'Complete' } },
    ],
    edges: [
      { id: 'la-e1', source: 'la-start', target: 'la-init' },
      { id: 'la-e2', source: 'la-init', target: 'la-loop' },
      { id: 'la-e3', source: 'la-loop', target: 'la-fetch', sourceHandle: 'body' },
      { id: 'la-e4', source: 'la-fetch', target: 'la-agg' },
      { id: 'la-e5', source: 'la-agg', target: 'la-next' },
      { id: 'la-e6', source: 'la-loop', target: 'la-check', sourceHandle: 'done' },
      { id: 'la-e7', source: 'la-check', target: 'la-alert', sourceHandle: 'true' },
      { id: 'la-e8', source: 'la-check', target: 'la-end', sourceHandle: 'false' },
      { id: 'la-e9', source: 'la-alert', target: 'la-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample: Batch user provisioning — forEach loop with success/failure tracking.
 * Start → SetVariable (init) → Loop (forEach user) → HTTP (create) → Condition (201?)
 *       → Aggregate (success) / Aggregate (failure) → done → Switch (results) → End
 */
function createBatchProvisioningWorkflow(): Workflow {
  return {
    id: 'sample-workflow-batch',
    name: 'Sample: Batch User Provisioning',
    description: 'Creates users from a list, tracks successes/failures with aggregation, then routes the result via Switch.',
    variables: {},
    nodes: [
      {
        id: 'bp-start', type: 'start', position: { x: 300, y: 0 },
        data: {
          label: 'Start',
          inputVariables: {
            users: '[{"name":"Alice","email":"alice@test.com"},{"name":"Bob","email":"bob@test.com"},{"name":"Carol","email":"carol@test.com"}]',
          },
        },
      },
      {
        id: 'bp-init', type: 'setVariable', position: { x: 260, y: 130 },
        data: {
          label: 'Init Trackers',
          assignments: [
            { id: 'a1', name: 'successCount', expression: '0' },
            { id: 'a2', name: 'failCount', expression: '0' },
            { id: 'a3', name: 'createdIds', expression: '[]' },
          ],
        },
      },
      {
        id: 'bp-loop', type: 'loop', position: { x: 280, y: 270 },
        data: {
          label: 'Each User', mode: 'forEach' as const,
          sourceExpression: '{{users}}', itemVariable: 'user', indexVariable: 'userIndex',
          maxIterations: 50,
        },
      },
      {
        id: 'bp-create', type: 'http', position: { x: 240, y: 410 },
        data: {
          label: 'Create User', scenario: {
            id: 'bp-s1', name: 'Create User', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{{user}}', bodyType: 'json', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'createStatus', source: 'status', expression: '' },
              { name: 'userId', source: 'body', expression: '$.id' },
            ],
          },
        },
      },
      {
        id: 'bp-check', type: 'condition', position: { x: 260, y: 570 },
        data: { label: 'Created?', left: '{{createStatus}}', operator: '==' as const, right: '201' },
      },
      {
        id: 'bp-agg-ok', type: 'aggregate', position: { x: 80, y: 720 },
        data: {
          label: 'Track Success',
          mappings: [
            { id: 'm1', sourceExpression: '{{userId}}', targetVariable: 'createdIds', strategy: 'concat' as const },
            { id: 'm2', sourceExpression: '1', targetVariable: 'successCount', strategy: 'count' as const },
          ],
        },
      },
      {
        id: 'bp-agg-fail', type: 'aggregate', position: { x: 440, y: 720 },
        data: {
          label: 'Track Failure',
          mappings: [
            { id: 'm1', sourceExpression: '1', targetVariable: 'failCount', strategy: 'count' as const },
          ],
        },
      },
      {
        id: 'bp-summary', type: 'setVariable', position: { x: 240, y: 920 },
        data: {
          label: 'Build Summary',
          assignments: [
            { id: 'a1', name: 'resultType', expression: '{{failCount}}' },
            { id: 'a2', name: 'summary', expression: 'Created {{successCount}} users ({{failCount}} failed)' },
          ],
        },
      },
      {
        id: 'bp-switch', type: 'switch', position: { x: 260, y: 1060 },
        data: {
          label: 'Result Router', expression: '{{resultType}}',
          cases: [
            { id: 'rc1', value: '0', label: 'All OK' },
          ],
        },
      },
      {
        id: 'bp-report-ok', type: 'http', position: { x: 80, y: 1230 },
        data: {
          label: 'Success Report', scenario: {
            id: 'bp-s2', name: 'Report OK', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"status":"success","summary":"{{summary}}","ids":{{createdIds}}}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      {
        id: 'bp-report-partial', type: 'http', position: { x: 440, y: 1230 },
        data: {
          label: 'Partial Report', scenario: {
            id: 'bp-s3', name: 'Report Partial', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"status":"partial","summary":"{{summary}}","failures":{{failCount}}}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      { id: 'bp-end', type: 'end', position: { x: 280, y: 1400 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'bp-e1', source: 'bp-start', target: 'bp-init' },
      { id: 'bp-e2', source: 'bp-init', target: 'bp-loop' },
      { id: 'bp-e3', source: 'bp-loop', target: 'bp-create', sourceHandle: 'body' },
      { id: 'bp-e4', source: 'bp-create', target: 'bp-check' },
      { id: 'bp-e5', source: 'bp-check', target: 'bp-agg-ok', sourceHandle: 'true' },
      { id: 'bp-e6', source: 'bp-check', target: 'bp-agg-fail', sourceHandle: 'false' },
      { id: 'bp-e7', source: 'bp-loop', target: 'bp-summary', sourceHandle: 'done' },
      { id: 'bp-e8', source: 'bp-summary', target: 'bp-switch' },
      { id: 'bp-e9', source: 'bp-switch', target: 'bp-report-ok', sourceHandle: 'case-rc1' },
      { id: 'bp-e10', source: 'bp-switch', target: 'bp-report-partial', sourceHandle: 'default' },
      { id: 'bp-e11', source: 'bp-report-ok', target: 'bp-end' },
      { id: 'bp-e12', source: 'bp-report-partial', target: 'bp-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow: Resilient API call with Error Handler, Log/Debug diagnostics, and outcome branching.
 * Flow: Start → Log(begin) → ErrorHandler[ body: POST /posts → catch: Log(error) ] → done → Condition → Log(success) / Log(failure) → End
 */
function createErrorHandlerWorkflow(): Workflow {
  return {
    id: 'sample-workflow-error-handler',
    name: 'Sample: Resilient API with Error Handling',
    description: 'Demonstrates Error Handler with retry, Log/Debug for diagnostics, and conditional outcome.',
    variables: {},
    nodes: [
      { id: 'eh-start', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Start', inputVariables: { apiKey: 'demo-key' } } },
      {
        id: 'eh-log-begin', type: 'logDebug', position: { x: 200, y: 100 },
        data: { label: 'Log: Begin', message: 'Starting resilient API call with key={{apiKey}}', logLevel: 'info', snapshotVariables: false },
      },
      {
        id: 'eh-guard', type: 'errorHandler', position: { x: 200, y: 240 },
        data: { label: 'API Guard', errorFilter: 'all', maxRetries: 2, retryBackoffStrategy: 'fixed', retryDelayMs: 500, failWorkflowOnError: false },
      },
      {
        id: 'eh-post', type: 'http', position: { x: 50, y: 400 },
        data: {
          label: 'Create Post',
          scenario: {
            id: 'eh-s1', name: 'Create Post',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({ title: 'Resilient Post', body: 'Created with error handling', userId: 1 }, null, 2),
            bodyType: 'json', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'postId', source: 'body', expression: '$.id' }, { name: 'httpStatus', source: 'status', expression: '' }],
          },
        },
      },
      {
        id: 'eh-log-error', type: 'logDebug', position: { x: 400, y: 400 },
        data: { label: 'Log: Error', message: 'API call failed — will retry. Status={{httpStatus}}', logLevel: 'error', snapshotVariables: true },
      },
      {
        id: 'eh-check', type: 'condition', position: { x: 240, y: 560 },
        data: { label: 'Created OK?', left: '{{httpStatus}}', operator: '==', right: '201' },
      },
      {
        id: 'eh-log-ok', type: 'logDebug', position: { x: 100, y: 700 },
        data: { label: 'Log: Success', message: 'Post {{postId}} created successfully', logLevel: 'info', snapshotVariables: false },
      },
      {
        id: 'eh-log-fail', type: 'logDebug', position: { x: 400, y: 700 },
        data: { label: 'Log: Failure', message: 'Post creation failed with status={{httpStatus}}', logLevel: 'warn', snapshotVariables: true },
      },
      { id: 'eh-end', type: 'end', position: { x: 250, y: 850 }, data: { label: 'End' } },
    ],
    edges: [
      { id: 'eh-e1', source: 'eh-start', target: 'eh-log-begin' },
      { id: 'eh-e2', source: 'eh-log-begin', target: 'eh-guard' },
      { id: 'eh-e3', source: 'eh-guard', target: 'eh-post', sourceHandle: 'body' },
      { id: 'eh-e4', source: 'eh-guard', target: 'eh-log-error', sourceHandle: 'catch' },
      { id: 'eh-e5', source: 'eh-guard', target: 'eh-check', sourceHandle: 'done' },
      { id: 'eh-e6', source: 'eh-check', target: 'eh-log-ok', sourceHandle: 'true' },
      { id: 'eh-e7', source: 'eh-check', target: 'eh-log-fail', sourceHandle: 'false' },
      { id: 'eh-e8', source: 'eh-log-ok', target: 'eh-end' },
      { id: 'eh-e9', source: 'eh-log-fail', target: 'eh-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow: Debug trace pipeline that logs before and after each API call.
 * Flow: Start → Log(step1) → GET users → Log(step2) → GET user/1 → Log(step3) → GET posts → Log(done) → End
 */
function createLogDebugWorkflow(): Workflow {
  return {
    id: 'sample-workflow-log-debug',
    name: 'Sample: Debug Trace Pipeline',
    description: 'Adds Log/Debug nodes between HTTP calls for full request tracing.',
    variables: {},
    nodes: [
      { id: 'ld-start', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Start', inputVariables: { traceId: 'trace-001' } } },
      {
        id: 'ld-log1', type: 'logDebug', position: { x: 200, y: 100 },
        data: { label: 'Trace: Step 1', message: '[{{traceId}}] Fetching user list...', logLevel: 'debug', snapshotVariables: false },
      },
      {
        id: 'ld-get-users', type: 'http', position: { x: 180, y: 220 },
        data: {
          label: 'GET Users',
          scenario: {
            id: 'ld-s1', name: 'Get Users',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET', headers: [{ key: 'Accept', value: 'application/json' }],
            body: '', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'userCount', source: 'body', expression: '$.length' }],
          },
        },
      },
      {
        id: 'ld-log2', type: 'logDebug', position: { x: 200, y: 340 },
        data: { label: 'Trace: Step 2', message: '[{{traceId}}] Got {{userCount}} users. Fetching user details...', logLevel: 'debug', snapshotVariables: true },
      },
      {
        id: 'ld-get-user1', type: 'http', position: { x: 180, y: 460 },
        data: {
          label: 'GET User #1',
          scenario: {
            id: 'ld-s2', name: 'Get User 1',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET', headers: [{ key: 'Accept', value: 'application/json' }],
            body: '', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'userName', source: 'body', expression: '$.name' }],
          },
        },
      },
      {
        id: 'ld-log3', type: 'logDebug', position: { x: 200, y: 580 },
        data: { label: 'Trace: Step 3', message: '[{{traceId}}] User: {{userName}}. Fetching posts...', logLevel: 'info', snapshotVariables: false },
      },
      {
        id: 'ld-get-posts', type: 'http', position: { x: 180, y: 700 },
        data: {
          label: 'GET Posts',
          scenario: {
            id: 'ld-s3', name: 'Get Posts',
            url: 'https://jsonplaceholder.typicode.com/posts?userId=1',
            method: 'GET', headers: [{ key: 'Accept', value: 'application/json' }],
            body: '', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'postCount', source: 'body', expression: '$.length' }],
          },
        },
      },
      {
        id: 'ld-log-done', type: 'logDebug', position: { x: 200, y: 820 },
        data: { label: 'Trace: Done', message: '[{{traceId}}] Pipeline complete. {{postCount}} posts found for {{userName}}.', logLevel: 'info', snapshotVariables: true },
      },
    ],
    edges: [
      { id: 'ld-e1', source: 'ld-start', target: 'ld-log1' },
      { id: 'ld-e2', source: 'ld-log1', target: 'ld-get-users' },
      { id: 'ld-e3', source: 'ld-get-users', target: 'ld-log2' },
      { id: 'ld-e4', source: 'ld-log2', target: 'ld-get-user1' },
      { id: 'ld-e5', source: 'ld-get-user1', target: 'ld-log3' },
      { id: 'ld-e6', source: 'ld-log3', target: 'ld-get-posts' },
      { id: 'ld-e7', source: 'ld-get-posts', target: 'ld-log-done' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow: Polling with Wait for Condition.
 * Flow: Start → POST create → Log(created) → WaitForCondition[ body: GET status → done: ] → Condition(completed?) → Log(result) → End
 */
function createWaitConditionWorkflow(): Workflow {
  return {
    id: 'sample-workflow-wait-condition',
    name: 'Sample: Polling with Wait for Condition',
    description: 'Creates a resource and polls until processing completes with timeout protection.',
    variables: {},
    nodes: [
      { id: 'wc-start', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Start', inputVariables: { jobName: 'data-import' } } },
      {
        id: 'wc-create', type: 'http', position: { x: 180, y: 100 },
        data: {
          label: '1. Create Job',
          scenario: {
            id: 'wc-s1', name: 'Create Job',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({ title: 'Import Job', body: 'Processing data...', userId: 1 }, null, 2),
            bodyType: 'json', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'jobId', source: 'body', expression: '$.id' }],
          },
        },
      },
      {
        id: 'wc-log-created', type: 'logDebug', position: { x: 200, y: 240 },
        data: { label: 'Log: Job Created', message: 'Job {{jobId}} ({{jobName}}) created. Starting polling...', logLevel: 'info', snapshotVariables: false },
      },
      {
        id: 'wc-wait', type: 'waitForCondition', position: { x: 200, y: 370 },
        data: { label: 'Wait: Job Complete', conditionExpression: '{{jobStatus}} == completed', pollIntervalMs: 2000, timeoutMs: 30000, maxAttempts: 15 },
      },
      {
        id: 'wc-poll', type: 'http', position: { x: 50, y: 530 },
        data: {
          label: '2. Poll Status',
          scenario: {
            id: 'wc-s2', name: 'Poll Job Status',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'jobStatus', source: 'body', expression: '$.title' }],
          },
        },
      },
      {
        id: 'wc-check', type: 'condition', position: { x: 240, y: 530 },
        data: { label: 'Completed?', left: '{{wait.conditionMet}}', operator: '==', right: 'true' },
      },
      {
        id: 'wc-log-ok', type: 'logDebug', position: { x: 100, y: 680 },
        data: { label: 'Log: Success', message: 'Job {{jobId}} completed after {{wait.attempts}} polls ({{wait.elapsed}}ms)', logLevel: 'info', snapshotVariables: true },
      },
      {
        id: 'wc-log-timeout', type: 'logDebug', position: { x: 400, y: 680 },
        data: { label: 'Log: Timeout', message: 'Job {{jobId}} timed out after {{wait.attempts}} polls', logLevel: 'warn', snapshotVariables: true },
      },
      { id: 'wc-end', type: 'end', position: { x: 250, y: 820 }, data: { label: 'End' } },
    ],
    edges: [
      { id: 'wc-e1', source: 'wc-start', target: 'wc-create' },
      { id: 'wc-e2', source: 'wc-create', target: 'wc-log-created' },
      { id: 'wc-e3', source: 'wc-log-created', target: 'wc-wait' },
      { id: 'wc-e4', source: 'wc-wait', target: 'wc-poll', sourceHandle: 'body' },
      { id: 'wc-e5', source: 'wc-wait', target: 'wc-check', sourceHandle: 'done' },
      { id: 'wc-e6', source: 'wc-check', target: 'wc-log-ok', sourceHandle: 'true' },
      { id: 'wc-e7', source: 'wc-check', target: 'wc-log-timeout', sourceHandle: 'false' },
      { id: 'wc-e8', source: 'wc-log-ok', target: 'wc-end' },
      { id: 'wc-e9', source: 'wc-log-timeout', target: 'wc-end' },
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
    category: 'basics',
    icon: '↗',
    nodeCount: 6,
    factory: createOrderWorkflow,
  },
  {
    id: 'sample-workflow-parallel',
    name: 'Parallel API Calls',
    description: 'Fork/Join pattern splits execution into concurrent HTTP requests and merges results',
    category: 'basics',
    icon: '⑃',
    nodeCount: 8,
    factory: createParallelForkWorkflow,
  },
  {
    id: 'sample-workflow-branching',
    name: 'Conditional Branching',
    description: 'If/Else paths leading to different API endpoints',
    category: 'basics',
    icon: '◆',
    nodeCount: 6,
    factory: createConditionalBranchWorkflow,
  },
  {
    id: 'sample-workflow-webhook',
    name: 'Webhook Trigger',
    description: 'Order processing triggered by incoming HTTP webhooks with payload extraction',
    category: 'triggers',
    icon: '🪝',
    nodeCount: 7,
    factory: createWebhookTriggerWorkflow,
  },
  {
    id: 'sample-workflow-schedule',
    name: 'Schedule Trigger',
    description: 'Daily report generation with cron-based scheduling and automatic time variables',
    category: 'triggers',
    icon: '⏰',
    nodeCount: 8,
    factory: createScheduleTriggerWorkflow,
  },
  {
    id: 'sample-workflow-switch',
    name: 'Switch Order Router',
    description: 'Routes orders through different processing paths using multi-way Switch branching',
    category: 'logic',
    icon: '⇅',
    nodeCount: 8,
    factory: createSwitchRoutingWorkflow,
  },
  {
    id: 'sample-workflow-loop-agg',
    name: 'Paginated API Fetcher',
    description: 'While-loop fetches paginated data, Aggregate accumulates results with concat/sum/count',
    category: 'logic',
    icon: '🔄',
    nodeCount: 9,
    factory: createLoopAggregateWorkflow,
  },
  {
    id: 'sample-workflow-batch',
    name: 'Batch User Provisioning',
    description: 'ForEach loop creates users, Aggregates track success/failure, Switch routes the final report',
    category: 'advanced',
    icon: '📝',
    nodeCount: 12,
    factory: createBatchProvisioningWorkflow,
  },
  {
    id: 'sample-workflow-error-handler',
    name: 'Resilient API with Error Handling',
    description: 'HTTP call wrapped in Error Handler with retry, Log/Debug captures diagnostics, condition checks outcome',
    category: 'advanced',
    icon: '🛡️',
    nodeCount: 9,
    factory: createErrorHandlerWorkflow,
  },
  {
    id: 'sample-workflow-log-debug',
    name: 'Debug Trace Pipeline',
    description: 'Sequential API calls with Log/Debug nodes tracing request/response at each step',
    category: 'advanced',
    icon: '📋',
    nodeCount: 8,
    factory: createLogDebugWorkflow,
  },
  {
    id: 'sample-workflow-wait-condition',
    name: 'Polling with Wait for Condition',
    description: 'Creates a resource then polls until processing completes, with timeout and status tracking',
    category: 'advanced',
    icon: '⏳',
    nodeCount: 9,
    factory: createWaitConditionWorkflow,
  },
];
