import type { Workflow } from '../features/workflow/types/workflow';

export type SampleCategory = 'basics' | 'triggers' | 'logic' | 'advanced';

export interface SampleWorkflowEntry {
  id: string;
  name: string;
  description: string;
  category: SampleCategory;
  icon: string;
  nodeCount: number;
  factory: () => Workflow;
  /** Additional workflows bundled with this sample (e.g. child sub-workflows). */
  companionFactories?: Array<() => Workflow>;
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
            users: '[{"title":"Alice task","body":"Provision Alice","userId":1},{"title":"Bob task","body":"Provision Bob","userId":2},{"title":"Carol task","body":"Provision Carol","userId":3}]',
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
            id: 'bp-s1', name: 'Create User', url: 'https://jsonplaceholder.typicode.com/users', method: 'POST',
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
            body: '{"title":"Batch Report","body":"{{summary}}","userId":1}', bodyType: 'json',
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
            body: '{"title":"Batch Report (Partial)","body":"{{summary}}","userId":1}', bodyType: 'json',
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
        data: { label: 'Wait: Job Complete', conditionExpression: '{{jobStatus}} == 1', pollIntervalMs: 2000, timeoutMs: 30000, maxAttempts: 15 },
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
            extractions: [{ name: 'jobStatus', source: 'body', expression: '$.userId' }],
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

/**
 * Sample workflow showcasing Expression functions for array aggregation,
 * string manipulation, math, and conditional logic.
 * Flow: Start → GET users → SetVariable (user stats) → GET posts → SetVariable (post stats) → Condition → Log
 */
function createExpressionFunctionsWorkflow(): Workflow {
  return {
    id: 'sample-workflow-expressions',
    name: 'Sample: Expression Functions Showcase',
    description: 'Demonstrates $count, $upper, $default, $indexOf, $add, $substring, $concat, $divide, $round, $contains, $if, $padStart, $min, $max via sequential intermediate variables.',
    variables: {},
    nodes: [
      {
        id: 'ex-start', type: 'start', position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: { reportTitle: 'User Activity Report' } },
      },
      {
        id: 'ex-users', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: '1. Fetch Users',
          scenario: {
            id: 'ex-s1', name: 'Fetch Users',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'usersJson', source: 'body', expression: '' },
              { name: 'firstUserName', source: 'body', expression: '$.0.name' },
              { name: 'firstUserEmail', source: 'body', expression: '$.0.email' },
              { name: 'firstUserCity', source: 'body', expression: '$.0.address.city' },
            ],
          },
        },
      },
      {
        id: 'ex-user-stats', type: 'setVariable', position: { x: 250, y: 280 },
        data: {
          label: '2. Compute User Stats',
          assignments: [
            { id: 'a1', name: 'totalUsers', expression: '{{$count(usersJson)}}' },
            { id: 'a2', name: 'upperName', expression: '{{$upper(firstUserName)}}' },
            { id: 'a3', name: 'displayCity', expression: '{{$default(firstUserCity, "N/A")}}' },
            { id: 'a4', name: 'emailAtPos', expression: '{{$indexOf(firstUserEmail, "@")}}' },
            { id: 'a5', name: 'domainStart', expression: '{{$add(emailAtPos, 1)}}' },
            { id: 'a6', name: 'firstUserDomain', expression: '{{$substring(firstUserEmail, domainStart)}}' },
            { id: 'a7', name: 'userSummary', expression: '{{$concat(upperName, " <", firstUserEmail, ">")}}' },
            { id: 'a8', name: 'reportHeader', expression: 'REPORT: {{reportTitle}} | {{totalUsers}} users' },
          ],
        },
      },
      {
        id: 'ex-posts', type: 'http', position: { x: 250, y: 440 },
        data: {
          label: '3. Fetch Posts',
          scenario: {
            id: 'ex-s2', name: 'Fetch Posts',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'postsJson', source: 'body', expression: '' },
              { name: 'firstPostTitle', source: 'body', expression: '$.0.title' },
            ],
          },
        },
      },
      {
        id: 'ex-post-stats', type: 'setVariable', position: { x: 250, y: 600 },
        data: {
          label: '4. Aggregate Post Stats',
          assignments: [
            { id: 'b1', name: 'totalPosts', expression: '{{$count(postsJson)}}' },
            { id: 'b2', name: 'avgRaw', expression: '{{$divide(totalPosts, totalUsers)}}' },
            { id: 'b3', name: 'avgPostsPerUser', expression: '{{$round(avgRaw, 1)}}' },
            { id: 'b4', name: 'titleHasProvident', expression: '{{$contains(firstPostTitle, "provident")}}' },
            { id: 'b5', name: 'activityLevel', expression: '{{$if(titleHasProvident, "Active", "Normal")}}' },
            { id: 'b6', name: 'titlePreview', expression: '{{$substring(firstPostTitle, 0, 30)}}' },
            { id: 'b7', name: 'paddedUserCount', expression: '{{$padStart(totalUsers, 5, "0")}}' },
            { id: 'b8', name: 'minMetric', expression: '{{$min(totalPosts, totalUsers)}}' },
            { id: 'b9', name: 'maxMetric', expression: '{{$max(totalPosts, totalUsers)}}' },
          ],
        },
      },
      {
        id: 'ex-cond', type: 'condition', position: { x: 300, y: 760 },
        data: { label: '5. Enough Data?', left: '{{totalPosts}}', operator: '>=', right: '5' },
      },
      {
        id: 'ex-log-success', type: 'logDebug', position: { x: 80, y: 900 },
        data: {
          label: 'Log: Success',
          logLevel: 'info',
          message: '{{reportHeader}} | Posts: {{totalPosts}}, Avg: {{avgPostsPerUser}}/user ({{activityLevel}}), User: {{userSummary}} from {{displayCity}}, Domain: {{firstUserDomain}}, Preview: {{titlePreview}}, Range: {{minMetric}}–{{maxMetric}}',
          snapshotVariables: true,
        },
      },
      {
        id: 'ex-log-insufficient', type: 'logDebug', position: { x: 450, y: 900 },
        data: {
          label: 'Log: Insufficient',
          logLevel: 'warn',
          message: 'Only {{totalPosts}} posts found. Activity: {{activityLevel}}. Contains "provident": {{titleHasProvident}}',
          snapshotVariables: true,
        },
      },
      {
        id: 'ex-end', type: 'end', position: { x: 300, y: 1050 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'ex-e1', source: 'ex-start', target: 'ex-users' },
      { id: 'ex-e2', source: 'ex-users', target: 'ex-user-stats' },
      { id: 'ex-e3', source: 'ex-user-stats', target: 'ex-posts' },
      { id: 'ex-e4', source: 'ex-posts', target: 'ex-post-stats' },
      { id: 'ex-e5', source: 'ex-post-stats', target: 'ex-cond' },
      { id: 'ex-e6', source: 'ex-cond', target: 'ex-log-success', sourceHandle: 'true', label: 'Yes' },
      { id: 'ex-e7', source: 'ex-cond', target: 'ex-log-insufficient', sourceHandle: 'false', label: 'No' },
      { id: 'ex-e8', source: 'ex-log-success', target: 'ex-end' },
      { id: 'ex-e9', source: 'ex-log-insufficient', target: 'ex-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow demonstrating Sub-Workflow orchestration with input/output mappings.
 * Parent: fetches users list → Sub-Workflow iterates each user (multi-instance)
 *         → Aggregate results → Condition on success rate.
 * The child workflow is a second Workflow object returned alongside the parent.
 */
function createSubWorkflowOrchestrator(): Workflow {
  const CHILD_ID = 'sample-subwf-child';
  return {
    id: 'sample-workflow-sub-workflow',
    name: 'Sample: Sub-Workflow Orchestrator',
    description: 'Demonstrates Sub-Workflow nodes with input/output mappings, multi-instance forEach, retry, and on-failure continue.',
    variables: {},
    nodes: [
      {
        id: 'swf-start', type: 'start', position: { x: 300, y: 0 },
        data: {
          label: 'Start',
          inputVariables: { apiBase: 'https://jsonplaceholder.typicode.com' },
        },
      },
      {
        id: 'swf-fetch-users', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: '1. Fetch User List',
          scenario: {
            id: 'swf-s1', name: 'Get Users',
            url: '{{apiBase}}/users',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'usersJson', source: 'body', expression: '' },
              { name: 'userCount', source: 'body', expression: '$.length' },
            ],
          },
        },
      },
      {
        id: 'swf-set-ids', type: 'setVariable', position: { x: 250, y: 280 },
        data: {
          label: '2. Extract User IDs',
          assignments: [
            { id: 'a1', name: 'userIds', expression: '[1,2,3]' },
            { id: 'a2', name: 'processedCount', expression: '0' },
          ],
        },
      },
      {
        id: 'swf-sub', type: 'subWorkflow', position: { x: 250, y: 440 },
        data: {
          label: '3. Process Each User',
          workflowId: CHILD_ID,
          workflowName: 'User Processor',
          inputMappings: [
            { sourceExpression: '{{apiBase}}', targetVariable: 'apiBase' },
          ],
          outputMappings: [
            { sourceVariable: 'userStatus', targetVariable: 'lastUserStatus' },
          ],
          propagateAllOutputs: false,
          multiInstance: {
            collection: '{{userIds}}',
            elementVariable: 'userId',
            mode: 'sequential',
          },
          maxDepth: 5,
          timeoutMs: 30000,
          retryCount: 1,
          retryDelayMs: 2000,
          onChildFailure: 'continue',
        },
      },
      {
        id: 'swf-log', type: 'logDebug', position: { x: 250, y: 600 },
        data: {
          label: '4. Log Results',
          logLevel: 'info',
          message: 'Sub-workflow completed. Last status: {{lastUserStatus}}',
          snapshotVariables: true,
        },
      },
      {
        id: 'swf-cond', type: 'condition', position: { x: 300, y: 740 },
        data: {
          label: '5. All Succeeded?',
          left: '{{__subWorkflowFailed}}',
          operator: '!=',
          right: 'true',
        },
      },
      {
        id: 'swf-log-ok', type: 'logDebug', position: { x: 100, y: 880 },
        data: { label: 'All Good', logLevel: 'info', message: 'All users processed successfully', snapshotVariables: false },
      },
      {
        id: 'swf-log-fail', type: 'logDebug', position: { x: 480, y: 880 },
        data: { label: 'Partial Failure', logLevel: 'warn', message: 'Some user processing failed. Check __subWorkflowResults.', snapshotVariables: true },
      },
      {
        id: 'swf-end', type: 'end', position: { x: 300, y: 1020 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'swf-e1', source: 'swf-start', target: 'swf-fetch-users' },
      { id: 'swf-e2', source: 'swf-fetch-users', target: 'swf-set-ids' },
      { id: 'swf-e3', source: 'swf-set-ids', target: 'swf-sub' },
      { id: 'swf-e4', source: 'swf-sub', target: 'swf-log' },
      { id: 'swf-e5', source: 'swf-log', target: 'swf-cond' },
      { id: 'swf-e6', source: 'swf-cond', target: 'swf-log-ok', sourceHandle: 'true', label: 'Yes' },
      { id: 'swf-e7', source: 'swf-cond', target: 'swf-log-fail', sourceHandle: 'false', label: 'No' },
      { id: 'swf-e8', source: 'swf-log-ok', target: 'swf-end' },
      { id: 'swf-e9', source: 'swf-log-fail', target: 'swf-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Child workflow used by the Sub-Workflow Orchestrator sample.
 * Flow: Start → GET user by ID → SetVariable (build status) → End
 */
function createSubWorkflowChild(): Workflow {
  return {
    id: 'sample-subwf-child',
    name: 'Sample: User Processor (Child)',
    description: 'Child workflow that fetches a single user and returns a status. Called by Sub-Workflow Orchestrator.',
    variables: {},
    nodes: [
      {
        id: 'child-start', type: 'start', position: { x: 300, y: 0 },
        data: {
          label: 'Start',
          inputVariables: { apiBase: 'https://jsonplaceholder.typicode.com', userId: '1' },
        },
      },
      {
        id: 'child-fetch', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: 'Fetch User',
          scenario: {
            id: 'child-s1', name: 'Get User',
            url: '{{apiBase}}/users/{{userId}}',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'userName', source: 'body', expression: '$.name' },
              { name: 'userEmail', source: 'body', expression: '$.email' },
            ],
          },
        },
      },
      {
        id: 'child-set', type: 'setVariable', position: { x: 250, y: 280 },
        data: {
          label: 'Build Status',
          assignments: [
            { id: 'c1', name: 'userStatus', expression: 'processed:{{userName}}' },
          ],
        },
      },
      {
        id: 'child-end', type: 'end', position: { x: 300, y: 400 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'child-e1', source: 'child-start', target: 'child-fetch' },
      { id: 'child-e2', source: 'child-fetch', target: 'child-set' },
      { id: 'child-e3', source: 'child-set', target: 'child-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Medium sample: Order pipeline that delegates shipping to a sub-workflow.
 * Flow: Start → HTTP (fetch order) → Condition (is express?) →
 *       Yes: Sub-Workflow (express shipping) / No: Sub-Workflow (standard shipping) →
 *       SetVariable (build confirmation) → End
 */
function createOrderPipelineWorkflow(): Workflow {
  return {
    id: 'sample-workflow-order-pipeline',
    name: 'Sample: Order Pipeline with Sub-Workflow',
    description: 'Demonstrates conditional branching into different sub-workflows for express vs standard shipping.',
    variables: {},
    nodes: [
      {
        id: 'op-start', type: 'start', position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: { orderId: '12345', shippingType: 'express' } },
      },
      {
        id: 'op-fetch', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: '1. Fetch Order',
          scenario: {
            id: 'op-s1', name: 'Get Order',
            url: 'https://jsonplaceholder.typicode.com/posts/{{orderId}}',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'orderTitle', source: 'body', expression: '$.title' },
              { name: 'orderBody', source: 'body', expression: '$.body' },
            ],
          },
        },
      },
      {
        id: 'op-cond', type: 'condition', position: { x: 300, y: 280 },
        data: { label: '2. Express Shipping?', left: '{{shippingType}}', operator: '==', right: 'express' },
      },
      {
        id: 'op-sub-express', type: 'subWorkflow', position: { x: 80, y: 440 },
        data: {
          label: '3a. Express Shipping',
          workflowId: 'sample-shipping-child',
          workflowName: 'Shipping Processor',
          inputMappings: [
            { sourceExpression: '{{orderId}}', targetVariable: 'orderId' },
            { sourceExpression: 'express', targetVariable: 'tier' },
          ],
          outputMappings: [
            { sourceVariable: 'trackingNumber', targetVariable: 'trackingNumber' },
          ],
          timeoutMs: 15000,
          retryCount: 2,
          retryDelayMs: 1000,
          onChildFailure: 'fail',
        },
      },
      {
        id: 'op-sub-standard', type: 'subWorkflow', position: { x: 480, y: 440 },
        data: {
          label: '3b. Standard Shipping',
          workflowId: 'sample-shipping-child',
          workflowName: 'Shipping Processor',
          inputMappings: [
            { sourceExpression: '{{orderId}}', targetVariable: 'orderId' },
            { sourceExpression: 'standard', targetVariable: 'tier' },
          ],
          outputMappings: [
            { sourceVariable: 'trackingNumber', targetVariable: 'trackingNumber' },
          ],
          timeoutMs: 30000,
        },
      },
      {
        id: 'op-confirm', type: 'setVariable', position: { x: 250, y: 600 },
        data: {
          label: '4. Build Confirmation',
          assignments: [
            { id: 'a1', name: 'confirmation', expression: 'Order {{orderId}} shipped via {{shippingType}}. Tracking: {{trackingNumber}}' },
          ],
        },
      },
      {
        id: 'op-log', type: 'logDebug', position: { x: 250, y: 740 },
        data: { label: '5. Log', logLevel: 'info', message: '{{confirmation}}', snapshotVariables: true },
      },
      {
        id: 'op-end', type: 'end', position: { x: 300, y: 860 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'op-e1', source: 'op-start', target: 'op-fetch' },
      { id: 'op-e2', source: 'op-fetch', target: 'op-cond' },
      { id: 'op-e3', source: 'op-cond', target: 'op-sub-express', sourceHandle: 'true', label: 'Express' },
      { id: 'op-e4', source: 'op-cond', target: 'op-sub-standard', sourceHandle: 'false', label: 'Standard' },
      { id: 'op-e5', source: 'op-sub-express', target: 'op-confirm' },
      { id: 'op-e6', source: 'op-sub-standard', target: 'op-confirm' },
      { id: 'op-e7', source: 'op-confirm', target: 'op-log' },
      { id: 'op-e8', source: 'op-log', target: 'op-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Child workflow for the Order Pipeline sample — processes shipping for one order. */
function createShippingChildWorkflow(): Workflow {
  return {
    id: 'sample-shipping-child',
    name: 'Sample: Shipping Processor (Child)',
    description: 'Child workflow that simulates shipping an order and returns a tracking number.',
    variables: {},
    nodes: [
      {
        id: 'ship-start', type: 'start', position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: { orderId: '1', tier: 'standard' } },
      },
      {
        id: 'ship-http', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: 'Ship Order',
          scenario: {
            id: 'ship-s1', name: 'Create Shipment',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST', headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"orderId": "{{orderId}}", "tier": "{{tier}}"}',
            bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'shipmentId', source: 'body', expression: '$.id' }],
          },
        },
      },
      {
        id: 'ship-set', type: 'setVariable', position: { x: 250, y: 280 },
        data: {
          label: 'Build Tracking',
          assignments: [
            { id: 's1', name: 'trackingNumber', expression: 'TRK-{{tier}}-{{shipmentId}}' },
          ],
        },
      },
      {
        id: 'ship-end', type: 'end', position: { x: 300, y: 400 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'ship-e1', source: 'ship-start', target: 'ship-http' },
      { id: 'ship-e2', source: 'ship-http', target: 'ship-set' },
      { id: 'ship-e3', source: 'ship-set', target: 'ship-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Hard sample: Multi-region deployment orchestrator.
 * Flow: Start → HTTP (validate build) → Fork/Join (parallel pre-checks) →
 *       Sub-Workflow with multi-instance forEach (parallel, deploy to regions) →
 *       Condition (success rate >= threshold) →
 *       Yes: Log success / No: Sub-Workflow (rollback with dynamic ID) →
 *       End
 */
function createDeployOrchestratorWorkflow(): Workflow {
  return {
    id: 'sample-workflow-deploy-orchestrator',
    name: 'Sample: Multi-Region Deploy Orchestrator',
    description: 'Deployment pipeline with Fork/Join pre-checks, multi-instance parallel deploy via sub-workflow, and dynamic rollback sub-workflow.',
    variables: {},
    nodes: [
      {
        id: 'dep-start', type: 'start', position: { x: 300, y: 0 },
        data: {
          label: 'Start',
          inputVariables: {
            version: 'v2.5.0',
            regions: '["us-east-1","eu-west-1","ap-southeast-1"]',
            rollbackWorkflowId: 'sample-rollback-child',
            successThreshold: '80',
          },
        },
      },
      {
        id: 'dep-validate', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: '1. Validate Build',
          scenario: {
            id: 'dep-s1', name: 'Check Build',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' },
            validation: { mode: 'none', assertions: [{ type: 'status', expected: '200' }] },
            extractions: [
              { name: 'buildTitle', source: 'body', expression: '$.title' },
            ],
          },
        },
      },
      {
        id: 'dep-fork', type: 'fork', position: { x: 300, y: 280 },
        data: { label: '2. Pre-Check Fork' },
      },
      {
        id: 'dep-smoke', type: 'http', position: { x: 100, y: 400 },
        data: {
          label: '2a. Smoke Test',
          scenario: {
            id: 'dep-s2', name: 'Smoke',
            url: 'https://jsonplaceholder.typicode.com/posts/2',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'smokeResult', source: 'body', expression: '$.title' }],
          },
        },
      },
      {
        id: 'dep-flags', type: 'http', position: { x: 500, y: 400 },
        data: {
          label: '2b. Feature Flags',
          scenario: {
            id: 'dep-s3', name: 'Flags',
            url: 'https://jsonplaceholder.typicode.com/posts/3',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'flagsResult', source: 'body', expression: '$.title' }],
          },
        },
      },
      {
        id: 'dep-join', type: 'join', position: { x: 300, y: 540 },
        data: { label: '2c. Pre-Check Join' },
      },
      {
        id: 'dep-deploy', type: 'subWorkflow', position: { x: 250, y: 680 },
        data: {
          label: '3. Deploy to Regions',
          workflowId: 'sample-region-deploy-child',
          workflowName: 'Region Deployer',
          inputMappings: [
            { sourceExpression: '{{version}}', targetVariable: 'version' },
            { sourceExpression: '{{buildTitle}}', targetVariable: 'buildInfo' },
          ],
          outputMappings: [],
          propagateAllOutputs: false,
          multiInstance: {
            collection: '{{regions}}',
            elementVariable: 'region',
            mode: 'parallel',
          },
          maxDepth: 5,
          timeoutMs: 60000,
          retryCount: 1,
          retryDelayMs: 5000,
          onChildFailure: 'continue',
        },
      },
      {
        id: 'dep-analyze', type: 'setVariable', position: { x: 250, y: 840 },
        data: {
          label: '4. Analyze Results',
          assignments: [
            { id: 'a1', name: 'deployStatus', expression: '{{__subWorkflowFailed}}' },
          ],
        },
      },
      {
        id: 'dep-cond', type: 'condition', position: { x: 300, y: 960 },
        data: {
          label: '5. All Succeeded?',
          left: '{{deployStatus}}',
          operator: '!=',
          right: 'true',
        },
      },
      {
        id: 'dep-log-ok', type: 'logDebug', position: { x: 80, y: 1100 },
        data: { label: 'Deploy Success', logLevel: 'info', message: '✅ {{version}} deployed to all regions', snapshotVariables: true },
      },
      {
        id: 'dep-rollback', type: 'subWorkflow', position: { x: 480, y: 1100 },
        data: {
          label: '6. Rollback (Dynamic)',
          workflowId: '{{rollbackWorkflowId}}',
          workflowName: '',
          inputMappings: [
            { sourceExpression: '{{version}}', targetVariable: 'version' },
            { sourceExpression: '{{regions}}', targetVariable: 'regions' },
          ],
          outputMappings: [
            { sourceVariable: 'rollbackStatus', targetVariable: 'rollbackStatus' },
          ],
          maxDepth: 5,
          timeoutMs: 120000,
          retryCount: 2,
          retryDelayMs: 10000,
          onChildFailure: 'continue',
        },
      },
      {
        id: 'dep-end', type: 'end', position: { x: 300, y: 1260 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'dep-e1', source: 'dep-start', target: 'dep-validate' },
      { id: 'dep-e2', source: 'dep-validate', target: 'dep-fork' },
      { id: 'dep-e3', source: 'dep-fork', target: 'dep-smoke' },
      { id: 'dep-e4', source: 'dep-fork', target: 'dep-flags' },
      { id: 'dep-e5', source: 'dep-smoke', target: 'dep-join' },
      { id: 'dep-e6', source: 'dep-flags', target: 'dep-join' },
      { id: 'dep-e7', source: 'dep-join', target: 'dep-deploy' },
      { id: 'dep-e8', source: 'dep-deploy', target: 'dep-analyze' },
      { id: 'dep-e9', source: 'dep-analyze', target: 'dep-cond' },
      { id: 'dep-e10', source: 'dep-cond', target: 'dep-log-ok', sourceHandle: 'true', label: 'All OK' },
      { id: 'dep-e11', source: 'dep-cond', target: 'dep-rollback', sourceHandle: 'false', label: 'Failed' },
      { id: 'dep-e12', source: 'dep-log-ok', target: 'dep-end' },
      { id: 'dep-e13', source: 'dep-rollback', target: 'dep-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Child workflow for the Deploy Orchestrator — deploys to a single region. */
function createRegionDeployChildWorkflow(): Workflow {
  return {
    id: 'sample-region-deploy-child',
    name: 'Sample: Region Deployer (Child)',
    description: 'Child workflow that simulates deploying to a single region.',
    variables: {},
    nodes: [
      {
        id: 'rd-start', type: 'start', position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: { region: 'us-east-1', version: 'v1.0', buildInfo: '' } },
      },
      {
        id: 'rd-deploy', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: 'Deploy to {{region}}',
          scenario: {
            id: 'rd-s1', name: 'Deploy',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST', headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"region": "{{region}}", "version": "{{version}}"}',
            bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'deployId', source: 'body', expression: '$.id' }],
          },
        },
      },
      {
        id: 'rd-set', type: 'setVariable', position: { x: 250, y: 280 },
        data: {
          label: 'Set Status',
          assignments: [
            { id: 'r1', name: 'regionStatus', expression: '{{region}}:deployed:{{deployId}}' },
          ],
        },
      },
      {
        id: 'rd-end', type: 'end', position: { x: 300, y: 400 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'rd-e1', source: 'rd-start', target: 'rd-deploy' },
      { id: 'rd-e2', source: 'rd-deploy', target: 'rd-set' },
      { id: 'rd-e3', source: 'rd-set', target: 'rd-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Child workflow for rollback — referenced by dynamic workflow ID in the deploy orchestrator. */
function createRollbackChildWorkflow(): Workflow {
  return {
    id: 'sample-rollback-child',
    name: 'Sample: Rollback Handler (Child)',
    description: 'Child workflow that rolls back a deployment. Referenced dynamically via {{rollbackWorkflowId}}.',
    variables: {},
    nodes: [
      {
        id: 'rb-start', type: 'start', position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: { version: 'v1.0', regions: '[]' } },
      },
      {
        id: 'rb-log', type: 'logDebug', position: { x: 250, y: 120 },
        data: { label: 'Log Rollback', logLevel: 'warn', message: '⚠ Rolling back {{version}} across regions: {{regions}}', snapshotVariables: true },
      },
      {
        id: 'rb-http', type: 'http', position: { x: 250, y: 260 },
        data: {
          label: 'Execute Rollback',
          scenario: {
            id: 'rb-s1', name: 'Rollback',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST', headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"action": "rollback", "version": "{{version}}"}',
            bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'rollbackId', source: 'body', expression: '$.id' }],
          },
        },
      },
      {
        id: 'rb-set', type: 'setVariable', position: { x: 250, y: 400 },
        data: {
          label: 'Set Status',
          assignments: [{ id: 'rb1', name: 'rollbackStatus', expression: 'rolled-back:{{rollbackId}}' }],
        },
      },
      {
        id: 'rb-end', type: 'end', position: { x: 300, y: 520 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'rb-e1', source: 'rb-start', target: 'rb-log' },
      { id: 'rb-e2', source: 'rb-log', target: 'rb-http' },
      { id: 'rb-e3', source: 'rb-http', target: 'rb-set' },
      { id: 'rb-e4', source: 'rb-set', target: 'rb-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow: Workflow-level error handler with notification subgraph.
 * Main flow calls a deliberate bad URL to trigger failure.
 * An isolated error-handler subgraph (LogDebug → HTTP POST notification) fires
 * when ANY unhandled node error occurs, demonstrating the "On Unhandled Error →
 * Run error handler subgraph" feature with {{error.message}}, {{error.statusCode}},
 * and {{error.failedCount}} variables.
 *
 * Flow (main):       Start → Fetch Valid → Call Bad URL (fails!) → End
 * Flow (error):      Log Error Info → POST Notification
 * ErrorConfig:       mode=run-handler, handlerEntryNodeId=weh-log-err
 */
function createWorkflowErrorHandlerSample(): Workflow {
  return {
    id: 'sample-workflow-wf-error-handler',
    name: 'Sample: Workflow Error Handler – Failure Notification',
    description: 'Demonstrates workflow-level error handling: when any step fails, an isolated notification subgraph executes with error details.',
    variables: {
      notifyUrl: 'https://jsonplaceholder.typicode.com/posts',
    },
    errorConfig: {
      mode: 'run-handler',
      handlerEntryNodeId: 'weh-log-err',
    },
    nodes: [
      // ── Main flow ──
      {
        id: 'weh-start', type: 'start', position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: { userId: '1' } },
      },
      {
        id: 'weh-fetch', type: 'http', position: { x: 200, y: 120 },
        data: {
          label: '1. Fetch User (OK)',
          scenario: {
            id: 'weh-s1', name: 'Fetch User',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'userName', source: 'body', expression: '$.name' },
            ],
          },
        },
      },
      {
        id: 'weh-log-ok', type: 'logDebug', position: { x: 200, y: 260 },
        data: { label: '2. Log Success', message: 'Fetched user: {{userName}}', logLevel: 'info', snapshotVariables: false },
      },
      {
        id: 'weh-bad', type: 'http', position: { x: 200, y: 380 },
        data: {
          label: '3. Call Bad URL (will fail)',
          scenario: {
            id: 'weh-s2', name: 'Bad Request',
            url: 'https://jsonplaceholder.typicode.com/invalid-endpoint-404',
            method: 'GET',
            headers: [],
            body: '', auth: { type: 'none' },
            validation: { mode: 'none', assertions: [{ type: 'status', expected: '200' }] },
            extractions: [],
          },
        },
      },
      {
        id: 'weh-never', type: 'logDebug', position: { x: 200, y: 500 },
        data: { label: '4. This Never Runs', message: 'You should not see this — the workflow stopped at step 3.', logLevel: 'info', snapshotVariables: false },
      },
      {
        id: 'weh-end', type: 'end', position: { x: 250, y: 620 },
        data: { label: 'End' },
      },

      // ── Error handler subgraph (disconnected from main flow) ──
      {
        id: 'weh-log-err', type: 'logDebug', position: { x: 620, y: 120 },
        data: {
          label: '⚠ Error Caught',
          message: '🔴 Workflow-level error handler triggered!\n  Error: {{error.message}}\n  Status Code: {{error.statusCode}}\n  Failed Nodes: {{error.failedCount}}',
          logLevel: 'error', snapshotVariables: true,
        },
      },
      {
        id: 'weh-notify', type: 'http', position: { x: 620, y: 280 },
        data: {
          label: '📧 POST Notification',
          scenario: {
            id: 'weh-s3', name: 'Error Notification',
            url: '{{notifyUrl}}',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              channel: '#alerts',
              text: 'Workflow failed! Error: {{error.message}} | Status: {{error.statusCode}} | Failed: {{error.failedCount}} node(s)',
            }, null, 2),
            bodyType: 'json', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'notificationId', source: 'body', expression: '$.id' }],
          },
        },
      },
      {
        id: 'weh-log-sent', type: 'logDebug', position: { x: 620, y: 440 },
        data: {
          label: '✅ Notification Sent',
          message: 'Error notification posted (id={{notificationId}}). Recovery complete.',
          logLevel: 'info', snapshotVariables: false,
        },
      },
    ],
    edges: [
      // Main flow edges
      { id: 'weh-e1', source: 'weh-start', target: 'weh-fetch' },
      { id: 'weh-e2', source: 'weh-fetch', target: 'weh-log-ok' },
      { id: 'weh-e3', source: 'weh-log-ok', target: 'weh-bad' },
      { id: 'weh-e4', source: 'weh-bad', target: 'weh-never' },
      { id: 'weh-e5', source: 'weh-never', target: 'weh-end' },
      // Error subgraph edges (no connection to main flow)
      { id: 'weh-e6', source: 'weh-log-err', target: 'weh-notify' },
      { id: 'weh-e7', source: 'weh-notify', target: 'weh-log-sent' },
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
    nodeCount: 7,
    factory: createParallelForkWorkflow,
  },
  {
    id: 'sample-workflow-branching',
    name: 'Conditional Branching',
    description: 'If/Else paths leading to different API endpoints',
    category: 'basics',
    icon: '◆',
    nodeCount: 5,
    factory: createConditionalBranchWorkflow,
  },
  {
    id: 'sample-workflow-webhook',
    name: 'Webhook Trigger',
    description: 'Order processing triggered by incoming HTTP webhooks with payload extraction',
    category: 'triggers',
    icon: '🪝',
    nodeCount: 6,
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
  {
    id: 'sample-workflow-expressions',
    name: 'Expression Functions Showcase',
    description: 'Array aggregation ($count), math ($round, $divide, $min, $max), string ops ($concat, $substring), conditionals ($if, $default)',
    category: 'advanced',
    icon: 'ƒx',
    nodeCount: 9,
    factory: createExpressionFunctionsWorkflow,
  },
  {
    id: 'sample-workflow-sub-workflow',
    name: 'Sub-Workflow Orchestrator',
    description: 'Parent calls child workflow per user via multi-instance forEach with retry and on-failure continue',
    category: 'advanced',
    icon: '🔗',
    nodeCount: 9,
    factory: createSubWorkflowOrchestrator,
    companionFactories: [createSubWorkflowChild],
  },
  {
    id: 'sample-workflow-order-pipeline',
    name: 'Order Pipeline with Sub-Workflow',
    description: 'Conditional branching into express vs standard shipping sub-workflows with retry and output mapping',
    category: 'advanced',
    icon: '📦',
    nodeCount: 8,
    factory: createOrderPipelineWorkflow,
    companionFactories: [createShippingChildWorkflow],
  },
  {
    id: 'sample-workflow-deploy-orchestrator',
    name: 'Multi-Region Deploy Orchestrator',
    description: 'Fork/Join pre-checks, multi-instance parallel deploy via sub-workflow, dynamic rollback sub-workflow',
    category: 'advanced',
    icon: '🚀',
    nodeCount: 12,
    factory: createDeployOrchestratorWorkflow,
    companionFactories: [createRegionDeployChildWorkflow, createRollbackChildWorkflow],
  },
  {
    id: 'sample-workflow-wf-error-handler',
    name: 'Workflow Error Handler – Failure Notification',
    description: 'Workflow-level error handling: when any step fails, an isolated notification subgraph fires with error details',
    category: 'advanced',
    icon: '🚨',
    nodeCount: 9,
    factory: createWorkflowErrorHandlerSample,
  },
];
