import type { Workflow } from '@workflow/types/workflow';

/**
 * Sample workflow demonstrating webhook trigger with payload extraction.
 * Flow: Webhook receives order → Check inventory → If in stock: Process order, Else: Send alert
 */
export function createWebhookTriggerWorkflow(): Workflow {
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
export function createScheduleTriggerWorkflow(): Workflow {
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
 * Sample workflow: Polling with Wait for Condition.
 * Flow: Start → POST create → Log(created) → WaitForCondition[ body: GET status → done: ] → Condition(completed?) → Log(result) → End
 */
export function createWaitConditionWorkflow(): Workflow {
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
