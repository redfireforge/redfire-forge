import type { Workflow } from '../../../features/workflow/types/workflow';

/**
 * Kafka gallery workflow samples.
 *
 * Four samples spanning easy → advanced:
 *  1. Kafka Produce (easy)         — Publish an order event to a topic
 *  2. Kafka Trigger (easy)         — Consume-triggered order processor
 *  3. Kafka Event Pipeline (medium)— Trigger → validate via HTTP → produce result event
 *  4. Kafka Async Correlation (adv)— Trigger → produce request → KafkaWait for correlated reply
 */

// ────────────────────────────────────────────────────────────────────────────
// 1. Easy: Publish Order Event
//    HTTP Start trigger → HTTP (create order) → KafkaProduce → Log → End
// ────────────────────────────────────────────────────────────────────────────
export function createKafkaProduceWorkflow(): Workflow {
  return {
    id: 'sample-kafka-produce',
    name: 'Sample: Kafka Publish Order Event',
    description: 'Create an order via HTTP then publish an event to a Kafka topic for downstream consumers',
    variables: {
      orderId: 'ORD-2001',
      customerId: 'CUST-100',
      amount: '149.99',
      status: 'CREATED',
    },
    nodes: [
      {
        id: 'kp-start',
        type: 'start',
        position: { x: 240, y: 30 },
        data: {
          label: 'Start',
          inputVariables: {
            orderId: 'ORD-2001',
            customerId: 'CUST-100',
            amount: '149.99',
            status: 'CREATED',
          },
        },
      },
      {
        id: 'kp-create-order',
        type: 'http',
        position: { x: 240, y: 150 },
        data: {
          label: '1. Create Order',
          scenario: {
            id: 'kp-s1',
            name: 'Create Order',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              orderId: '{{orderId}}',
              customerId: '{{customerId}}',
              amount: '{{amount}}',
              status: '{{status}}',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'postId', source: 'body', expression: '$.id' },
            ],
          },
        },
      },
      {
        id: 'kp-produce',
        type: 'kafkaProduce',
        position: { x: 240, y: 300 },
        data: {
          label: '2. Publish to orders.created',
          clusterId: 'local-plaintext',
          topic: 'orders.created',
          keyTemplate: '{{customerId}}',
          bodyTemplate: JSON.stringify({
            orderId: '{{orderId}}',
            customerId: '{{customerId}}',
            amount: '{{amount}}',
            status: '{{status}}',
            postId: '{{postId}}',
            publishedAt: '{{$now}}',
          }, null, 2),
          ackMode: 'all',
          timeoutMs: 10000,
          headers: [
            { id: 'h1', key: 'source', value: 'order-service', enabled: true },
            { id: 'h2', key: 'eventType', value: 'order.created', enabled: true },
          ],
          outputBindings: [
            { id: 'ob1', source: 'partition', targetVariable: 'kafkaPartition', enabled: true },
            { id: 'ob2', source: 'offset', targetVariable: 'kafkaOffset', enabled: true },
          ],
        },
      },
      {
        id: 'kp-log',
        type: 'logDebug',
        position: { x: 240, y: 460 },
        data: {
          label: '3. Log Publish Result',
          message: 'Published order {{orderId}} to orders.created — partition={{kafkaPartition}}, offset={{kafkaOffset}}',
          logLevel: 'info',
          snapshotVariables: false,
        },
      },
      {
        id: 'kp-end',
        type: 'end',
        position: { x: 240, y: 580 },
        data: { label: 'Event Published', isSuccess: true },
      },
    ],
    edges: [
      { id: 'kp-e1', source: 'kp-start', target: 'kp-create-order' },
      { id: 'kp-e2', source: 'kp-create-order', target: 'kp-produce' },
      { id: 'kp-e3', source: 'kp-produce', target: 'kp-log' },
      { id: 'kp-e4', source: 'kp-log', target: 'kp-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 2. Easy: Kafka-Triggered Order Processor
//    KafkaTrigger (orders.created) → SetVariable → HTTP (enrich) → Log → End
// ────────────────────────────────────────────────────────────────────────────
export function createKafkaTriggerWorkflow(): Workflow {
  return {
    id: 'sample-kafka-trigger',
    name: 'Sample: Kafka-Triggered Order Processor',
    description: 'Start a workflow automatically when a Kafka message arrives on orders.created, then enrich and log it',
    variables: {},
    nodes: [
      {
        id: 'kt-trigger',
        type: 'kafkaTrigger',
        position: { x: 240, y: 30 },
        data: {
          label: 'Order Event Trigger',
          clusterId: 'local-plaintext',
          topic: 'orders.created',
          startPosition: 'latest',
          maxConcurrentRuns: 5,
          headerFilters: [],
          jsonPathFilters: [
            { id: 'f1', jsonPath: '$.status', expectedValue: 'CREATED', enabled: true },
          ],
          extractVariables: [
            { name: 'orderId', jsonPath: '$.orderId' },
            { name: 'customerId', jsonPath: '$.customerId' },
            { name: 'amount', jsonPath: '$.amount' },
          ],
          samplePayload: JSON.stringify({
            orderId: 'ORD-2001',
            customerId: 'CUST-100',
            amount: '149.99',
            status: 'CREATED',
          }, null, 2),
          notes: 'Fires for every message on orders.created where status == CREATED',
        },
      },
      {
        id: 'kt-log-received',
        type: 'logDebug',
        position: { x: 240, y: 180 },
        data: {
          label: '1. Log Received Event',
          message: 'Received order event: orderId={{orderId}}, customerId={{customerId}}, amount={{amount}}',
          logLevel: 'info',
          snapshotVariables: true,
        },
      },
      {
        id: 'kt-enrich',
        type: 'http',
        position: { x: 240, y: 320 },
        data: {
          label: '2. Enrich: Get Customer',
          scenario: {
            id: 'kt-s1',
            name: 'Get Customer',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'customerName', source: 'body', expression: '$.name' },
              { name: 'customerEmail', source: 'body', expression: '$.email' },
            ],
          },
        },
      },
      {
        id: 'kt-check-amount',
        type: 'condition',
        position: { x: 240, y: 460 },
        data: {
          label: '3. High Value Order?',
          left: '{{amount}}',
          operator: '>',
          right: '100',
        },
      },
      {
        id: 'kt-priority',
        type: 'logDebug',
        position: { x: 80, y: 600 },
        data: {
          label: '4a. Priority Processing',
          message: 'HIGH VALUE: Order {{orderId}} (${{amount}}) from {{customerName}} ({{customerEmail}}) — flagged for priority processing',
          logLevel: 'warn',
          snapshotVariables: false,
        },
      },
      {
        id: 'kt-standard',
        type: 'logDebug',
        position: { x: 400, y: 600 },
        data: {
          label: '4b. Standard Processing',
          message: 'Order {{orderId}} (${{amount}}) from {{customerName}} — routed to standard queue',
          logLevel: 'info',
          snapshotVariables: false,
        },
      },
      {
        id: 'kt-end',
        type: 'end',
        position: { x: 240, y: 740 },
        data: { label: 'Order Processed', isSuccess: true },
      },
    ],
    edges: [
      { id: 'kt-e1', source: 'kt-trigger', target: 'kt-log-received' },
      { id: 'kt-e2', source: 'kt-log-received', target: 'kt-enrich' },
      { id: 'kt-e3', source: 'kt-enrich', target: 'kt-check-amount' },
      { id: 'kt-e4', source: 'kt-check-amount', target: 'kt-priority', sourceHandle: 'true', label: '> $100' },
      { id: 'kt-e5', source: 'kt-check-amount', target: 'kt-standard', sourceHandle: 'false', label: '≤ $100' },
      { id: 'kt-e6', source: 'kt-priority', target: 'kt-end' },
      { id: 'kt-e7', source: 'kt-standard', target: 'kt-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 3. Medium: Kafka Event Pipeline
//    KafkaTrigger → HTTP (validate) → KafkaProduce (result event) → KafkaConsume (confirm) → End
// ────────────────────────────────────────────────────────────────────────────
export function createKafkaEventPipelineWorkflow(): Workflow {
  return {
    id: 'sample-kafka-event-pipeline',
    name: 'Sample: Kafka Event Pipeline',
    description: 'Full event pipeline: trigger on incoming order → validate via HTTP → publish result event → confirm delivery',
    variables: {},
    nodes: [
      {
        id: 'kep-trigger',
        type: 'kafkaTrigger',
        position: { x: 240, y: 30 },
        data: {
          label: 'New Order Trigger',
          clusterId: 'local-plaintext',
          topic: 'orders.created',
          startPosition: 'latest',
          maxConcurrentRuns: 10,
          headerFilters: [],
          jsonPathFilters: [],
          extractVariables: [
            { name: 'orderId', jsonPath: '$.orderId' },
            { name: 'customerId', jsonPath: '$.customerId' },
            { name: 'amount', jsonPath: '$.amount' },
            { name: 'status', jsonPath: '$.status' },
          ],
          samplePayload: JSON.stringify({
            orderId: 'ORD-3001',
            customerId: 'CUST-200',
            amount: '299.50',
            status: 'CREATED',
          }, null, 2),
        },
      },
      {
        id: 'kep-validate',
        type: 'http',
        position: { x: 240, y: 170 },
        data: {
          label: '1. Validate Order',
          scenario: {
            id: 'kep-s1',
            name: 'Validate Order',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: {
              mode: 'status',
              expectedStatus: 200,
            },
            extractions: [
              { name: 'validationStatus', source: 'status', expression: '' },
            ],
          },
        },
      },
      {
        id: 'kep-check-valid',
        type: 'condition',
        position: { x: 240, y: 310 },
        data: {
          label: '2. Validation Passed?',
          left: '{{validationStatus}}',
          operator: '==',
          right: '200',
        },
      },
      {
        id: 'kep-set-validated',
        type: 'setVariable',
        position: { x: 80, y: 450 },
        data: {
          label: '3a. Mark Validated',
          assignments: [
            { id: 'sv1', name: 'processedStatus', expression: 'VALIDATED' },
            { id: 'sv2', name: 'processedAt', expression: '{{$now}}' },
          ],
        },
      },
      {
        id: 'kep-set-rejected',
        type: 'setVariable',
        position: { x: 400, y: 450 },
        data: {
          label: '3b. Mark Rejected',
          assignments: [
            { id: 'sv3', name: 'processedStatus', expression: 'REJECTED' },
            { id: 'sv4', name: 'processedAt', expression: '{{$now}}' },
          ],
        },
      },
      {
        id: 'kep-produce-result',
        type: 'kafkaProduce',
        position: { x: 240, y: 590 },
        data: {
          label: '4. Publish Result Event',
          clusterId: 'local-plaintext',
          topic: 'orders.processed',
          keyTemplate: '{{orderId}}',
          bodyTemplate: JSON.stringify({
            orderId: '{{orderId}}',
            customerId: '{{customerId}}',
            amount: '{{amount}}',
            originalStatus: '{{status}}',
            processedStatus: '{{processedStatus}}',
            processedAt: '{{processedAt}}',
          }, null, 2),
          ackMode: 'all',
          timeoutMs: 10000,
          headers: [
            { id: 'h1', key: 'pipeline', value: 'order-processor', enabled: true },
          ],
          outputBindings: [
            { id: 'ob1', source: 'offset', targetVariable: 'resultOffset', enabled: true },
          ],
        },
      },
      {
        id: 'kep-consume-confirm',
        type: 'kafkaConsume',
        position: { x: 240, y: 740 },
        data: {
          label: '5. Confirm Delivery',
          clusterId: 'local-plaintext',
          topic: 'orders.processed',
          keyRegex: '{{orderId}}',
          timeoutMs: 15000,
          maxMessages: 1,
          startPosition: 'committed',
          loadTestBehavior: { mode: 'auto-resume', mockPayload: { orderId: '{{orderId}}', processedStatus: '{{processedStatus}}' } },
          outputBindings: [
            { id: 'ob2', source: 'offset', targetVariable: 'confirmedOffset', enabled: true },
          ],
        },
      },
      {
        id: 'kep-log',
        type: 'logDebug',
        position: { x: 240, y: 890 },
        data: {
          label: '6. Log Pipeline Complete',
          message: 'Pipeline complete — orderId={{orderId}}, status={{processedStatus}}, resultOffset={{resultOffset}}, confirmedOffset={{confirmedOffset}}',
          logLevel: 'info',
          snapshotVariables: true,
        },
      },
      {
        id: 'kep-end',
        type: 'end',
        position: { x: 240, y: 1010 },
        data: { label: 'Pipeline Done', isSuccess: true },
      },
    ],
    edges: [
      { id: 'kep-e1', source: 'kep-trigger', target: 'kep-validate' },
      { id: 'kep-e2', source: 'kep-validate', target: 'kep-check-valid' },
      { id: 'kep-e3', source: 'kep-check-valid', target: 'kep-set-validated', sourceHandle: 'true', label: 'Valid' },
      { id: 'kep-e4', source: 'kep-check-valid', target: 'kep-set-rejected', sourceHandle: 'false', label: 'Rejected' },
      { id: 'kep-e5', source: 'kep-set-validated', target: 'kep-produce-result' },
      { id: 'kep-e6', source: 'kep-set-rejected', target: 'kep-produce-result' },
      { id: 'kep-e7', source: 'kep-produce-result', target: 'kep-consume-confirm' },
      { id: 'kep-e8', source: 'kep-consume-confirm', target: 'kep-log' },
      { id: 'kep-e9', source: 'kep-log', target: 'kep-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 4. Advanced: Kafka Async Request–Reply (Correlation)
//    KafkaTrigger (payment.requests) → HTTP (call payment API) → KafkaProduce (submit request)
//    → KafkaWait (payment.responses, correlate by orderId) → Condition (success?) → Log → End
// ────────────────────────────────────────────────────────────────────────────
export function createKafkaAsyncCorrelationWorkflow(): Workflow {
  return {
    id: 'sample-kafka-async-correlation',
    name: 'Sample: Kafka Async Request–Reply',
    description: 'Async request-reply pattern: publish a payment request then wait for a correlated Kafka response message',
    variables: {},
    nodes: [
      {
        id: 'kac-trigger',
        type: 'kafkaTrigger',
        position: { x: 260, y: 30 },
        data: {
          label: 'Payment Request Trigger',
          clusterId: 'local-plaintext',
          topic: 'payments.requests',
          startPosition: 'latest',
          maxConcurrentRuns: 5,
          headerFilters: [],
          jsonPathFilters: [],
          extractVariables: [
            { name: 'orderId', jsonPath: '$.orderId' },
            { name: 'amount', jsonPath: '$.amount' },
            { name: 'currency', jsonPath: '$.currency' },
            { name: 'customerId', jsonPath: '$.customerId' },
          ],
          samplePayload: JSON.stringify({
            orderId: 'ORD-5001',
            amount: '499.99',
            currency: 'USD',
            customerId: 'CUST-300',
          }, null, 2),
          notes: 'Triggered by payment service when a new payment is initiated',
        },
      },
      {
        id: 'kac-log-start',
        type: 'logDebug',
        position: { x: 260, y: 170 },
        data: {
          label: '1. Log Payment Request',
          message: 'Processing payment request: orderId={{orderId}}, amount={{amount}} {{currency}}',
          logLevel: 'info',
          snapshotVariables: false,
        },
      },
      {
        id: 'kac-validate',
        type: 'http',
        position: { x: 260, y: 300 },
        data: {
          label: '2. Pre-validate Payment',
          scenario: {
            id: 'kac-s1',
            name: 'Validate Payment',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET',
            headers: [],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'merchantName', source: 'body', expression: '$.company.name' },
            ],
          },
        },
      },
      {
        id: 'kac-produce-request',
        type: 'kafkaProduce',
        position: { x: 260, y: 440 },
        data: {
          label: '3. Submit to Payment Processor',
          clusterId: 'local-plaintext',
          topic: 'payments.processing',
          keyTemplate: '{{orderId}}',
          bodyTemplate: JSON.stringify({
            orderId: '{{orderId}}',
            amount: '{{amount}}',
            currency: '{{currency}}',
            customerId: '{{customerId}}',
            merchant: '{{merchantName}}',
            requestedAt: '{{$now}}',
          }, null, 2),
          ackMode: 'all',
          timeoutMs: 10000,
          headers: [
            { id: 'h1', key: 'correlationId', value: '{{orderId}}', enabled: true },
            { id: 'h2', key: 'workflow', value: 'payment-processor', enabled: true },
          ],
          outputBindings: [],
        },
      },
      {
        id: 'kac-wait',
        type: 'kafkaWait',
        position: { x: 260, y: 600 },
        data: {
          label: '4. Wait for Payment Result',
          clusterId: 'local-plaintext',
          topic: 'payments.responses',
          correlationIdExpression: '{{orderId}}',
          correlationSource: 'body',
          correlationJsonPath: '$.orderId',
          extractVariables: [
            { name: 'paymentStatus', jsonPath: '$.status' },
            { name: 'transactionId', jsonPath: '$.transactionId' },
            { name: 'failureReason', jsonPath: '$.failureReason' },
          ],
          timeoutMs: 60000,
          headerFilters: [],
          loadTestBehavior: {
            mode: 'synthetic-inject',
            mockPayload: {
              orderId: '{{orderId}}',
              status: 'APPROVED',
              transactionId: 'TXN-{{orderId}}-001',
            },
            syntheticDelayMs: 500,
            syntheticJitterMs: 100,
          },
          samplePayload: JSON.stringify({
            orderId: 'ORD-5001',
            status: 'APPROVED',
            transactionId: 'TXN-ORD-5001-001',
            failureReason: null,
          }, null, 2),
          notes: 'Waits up to 60s for a matching message keyed by orderId in payments.responses',
        },
      },
      {
        id: 'kac-check-result',
        type: 'condition',
        position: { x: 260, y: 770 },
        data: {
          label: '5. Payment Approved?',
          left: '{{paymentStatus}}',
          operator: '==',
          right: 'APPROVED',
        },
      },
      {
        id: 'kac-success',
        type: 'logDebug',
        position: { x: 80, y: 910 },
        data: {
          label: '6a. Payment Approved',
          message: 'Payment APPROVED for order {{orderId}} — transactionId={{transactionId}}, amount={{amount}} {{currency}}',
          logLevel: 'info',
          snapshotVariables: false,
        },
      },
      {
        id: 'kac-failed',
        type: 'logDebug',
        position: { x: 440, y: 910 },
        data: {
          label: '6b. Payment Failed',
          message: 'Payment FAILED for order {{orderId}} — reason: {{failureReason}}',
          logLevel: 'error',
          snapshotVariables: false,
        },
      },
      {
        id: 'kac-end',
        type: 'end',
        position: { x: 260, y: 1060 },
        data: { label: 'Payment Handled', isSuccess: true },
      },
    ],
    edges: [
      { id: 'kac-e1', source: 'kac-trigger', target: 'kac-log-start' },
      { id: 'kac-e2', source: 'kac-log-start', target: 'kac-validate' },
      { id: 'kac-e3', source: 'kac-validate', target: 'kac-produce-request' },
      { id: 'kac-e4', source: 'kac-produce-request', target: 'kac-wait' },
      { id: 'kac-e5', source: 'kac-wait', target: 'kac-check-result' },
      { id: 'kac-e6', source: 'kac-check-result', target: 'kac-success', sourceHandle: 'true', label: 'Approved' },
      { id: 'kac-e7', source: 'kac-check-result', target: 'kac-failed', sourceHandle: 'false', label: 'Failed' },
      { id: 'kac-e8', source: 'kac-success', target: 'kac-end' },
      { id: 'kac-e9', source: 'kac-failed', target: 'kac-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
