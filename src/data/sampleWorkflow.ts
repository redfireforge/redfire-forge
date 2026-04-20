import type { Workflow } from '../types/workflow';

/**
 * Pre-built sample workflow demonstrating the core pain point:
 * multi-step API testing with variable chaining.
 *
 * Flow: Create Order → Check Status → Extract Order ID →
 *       Wait for Processing → Verify Order Details
 */
export function createSampleWorkflow(): Workflow {
  const nodeIds = {
    create: 'sample-n1-create',
    checkStatus: 'sample-n2-check-status',
    getDetails: 'sample-n3-get-details',
    delay: 'sample-n4-delay',
    verify: 'sample-n5-verify',
  };

  return {
    id: 'sample-workflow-001',
    name: 'Sample: Create → Extract → Verify',
    description: 'Demonstrates multi-step API testing with variable chaining. Edit the URLs and auth to match your real APIs.',
    variables: {
      baseUrl: 'https://api.example.com',
      customerId: 'CUST-12345',
    },
    nodes: [
      {
        id: nodeIds.create,
        type: 'http',
        position: { x: 300, y: 60 },
        data: {
          label: '1. Create Order',
          scenario: {
            id: 'sample-s1',
            name: 'Create Order',
            url: '{{baseUrl}}/v1/orders',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'X-Request-Id', value: '{{$uuid}}' },
            ],
            body: JSON.stringify({
              customerId: '{{customerId}}',
              items: [{ sku: 'WIDGET-100', quantity: 2 }],
              timestamp: '{{$timestamp}}'
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'bearer', token: '{{authToken}}', prefix: 'Bearer' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'orderId', source: 'body', expression: '$.id' },
              { name: 'orderStatus', source: 'body', expression: '$.status' },
              { name: 'httpStatus', source: 'status', expression: '' },
            ],
          },
        },
      },
      {
        id: nodeIds.checkStatus,
        type: 'condition',
        position: { x: 300, y: 230 },
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
        position: { x: 300, y: 400 },
        data: {
          label: '3. Wait for Processing',
          delayMs: 2000,
          mode: 'fixed',
        },
      },
      {
        id: nodeIds.getDetails,
        type: 'http',
        position: { x: 300, y: 540 },
        data: {
          label: '4. Get Order Details',
          scenario: {
            id: 'sample-s3',
            name: 'Get Order Details',
            url: '{{baseUrl}}/v1/orders/{{orderId}}',
            method: 'GET',
            headers: [
              { key: 'Accept', value: 'application/json' },
            ],
            body: '',
            auth: { type: 'bearer', token: '{{authToken}}', prefix: 'Bearer' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'finalStatus', source: 'body', expression: '$.status' },
              { name: 'totalAmount', source: 'body', expression: '$.total' },
            ],
          },
        },
      },
      {
        id: nodeIds.verify,
        type: 'condition',
        position: { x: 300, y: 710 },
        data: {
          label: '5. Is Order Confirmed?',
          left: '{{finalStatus}}',
          operator: '==',
          right: 'CONFIRMED',
        },
      },
    ],
    edges: [
      {
        id: 'sample-e1',
        source: nodeIds.create,
        target: nodeIds.checkStatus,
      },
      {
        id: 'sample-e2',
        source: nodeIds.checkStatus,
        target: nodeIds.delay,
        sourceHandle: 'true',
        label: 'Yes',
      },
      {
        id: 'sample-e3',
        source: nodeIds.delay,
        target: nodeIds.getDetails,
      },
      {
        id: 'sample-e4',
        source: nodeIds.getDetails,
        target: nodeIds.verify,
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
