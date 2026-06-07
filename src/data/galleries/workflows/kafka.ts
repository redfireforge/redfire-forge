import type { Workflow } from '../../../features/workflow/types/workflow';
import {
  makeStartNode,
  makeGetNode,
  makePostNode,
  makeSetVariableNode,
  makeLogDebugNode,
  makeConditionNode,
  makeEdge,
  jsonBody,
  bodyExtraction,
} from './nodeFactories';

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
      makeStartNode(
        'kp-start',
        {
          orderId: 'ORD-2001',
          customerId: 'CUST-100',
          amount: '149.99',
          status: 'CREATED',
        },
        { x: 240, y: 30 },
      ),
      makePostNode(
        'kp-create-order',
        '1. Create Order',
        'https://jsonplaceholder.typicode.com/posts',
        jsonBody({
          orderId: '{{orderId}}',
          customerId: '{{customerId}}',
          amount: '{{amount}}',
          status: '{{status}}',
        }),
        {
          x: 240,
          y: 150,
          extractions: [bodyExtraction('postId', '$.id')],
        },
      ),
      {
        id: 'kp-produce',
        type: 'kafkaProduce',
        position: { x: 240, y: 300 },
        data: {
          label: '2. Publish to orders.created',
          clusterId: '',
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
      makeLogDebugNode(
        'kp-log',
        '3. Log Publish Result',
        'Published order {{orderId}} to orders.created — partition={{kafkaPartition}}, offset={{kafkaOffset}}',
        'info',
        { x: 240, y: 460 },
      ),
      {
        id: 'kp-end',
        type: 'end',
        position: { x: 240, y: 580 },
        data: { label: 'Event Published', isSuccess: true },
      },
    ],
    edges: [
      makeEdge('kp-e1', 'kp-start', 'kp-create-order'),
      makeEdge('kp-e2', 'kp-create-order', 'kp-produce'),
      makeEdge('kp-e3', 'kp-produce', 'kp-log'),
      makeEdge('kp-e4', 'kp-log', 'kp-end'),
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
          clusterId: '',
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
      makeLogDebugNode(
        'kt-log-received',
        '1. Log Received Event',
        'Received order event: orderId={{orderId}}, customerId={{customerId}}, amount={{amount}}',
        'info',
        { x: 240, y: 180, snapshotVariables: true },
      ),
      makeGetNode('kt-enrich', '2. Enrich: Get Customer', 'https://jsonplaceholder.typicode.com/users/1', {
        x: 240,
        y: 320,
        extractions: [
          bodyExtraction('customerName', '$.name'),
          bodyExtraction('customerEmail', '$.email'),
        ],
      }),
      makeConditionNode('kt-check-amount', '3. High Value Order?', '{{amount}}', '100', {
        operator: '>',
        x: 240,
        y: 460,
      }),
      makeLogDebugNode(
        'kt-priority',
        '4a. Priority Processing',
        'HIGH VALUE: Order {{orderId}} (${{amount}}) from {{customerName}} ({{customerEmail}}) — flagged for priority processing',
        'warn',
        { x: 80, y: 600 },
      ),
      makeLogDebugNode(
        'kt-standard',
        '4b. Standard Processing',
        'Order {{orderId}} (${{amount}}) from {{customerName}} — routed to standard queue',
        'info',
        { x: 400, y: 600 },
      ),
      {
        id: 'kt-end',
        type: 'end',
        position: { x: 240, y: 740 },
        data: { label: 'Order Processed', isSuccess: true },
      },
    ],
    edges: [
      makeEdge('kt-e1', 'kt-trigger', 'kt-log-received'),
      makeEdge('kt-e2', 'kt-log-received', 'kt-enrich'),
      makeEdge('kt-e3', 'kt-enrich', 'kt-check-amount'),
      { id: 'kt-e4', source: 'kt-check-amount', target: 'kt-priority', sourceHandle: 'true', label: '> $100' },
      { id: 'kt-e5', source: 'kt-check-amount', target: 'kt-standard', sourceHandle: 'false', label: '≤ $100' },
      makeEdge('kt-e6', 'kt-priority', 'kt-end'),
      makeEdge('kt-e7', 'kt-standard', 'kt-end'),
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
          clusterId: '',
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
      makeConditionNode('kep-check-valid', '2. Validation Passed?', '{{validationStatus}}', '200', { x: 240, y: 310 }),
      makeSetVariableNode(
        'kep-set-validated',
        '3a. Mark Validated',
        [
          { id: 'sv1', name: 'processedStatus', expression: 'VALIDATED' },
          { id: 'sv2', name: 'processedAt', expression: '{{$now}}' },
        ],
        { x: 80, y: 450 },
      ),
      makeSetVariableNode(
        'kep-set-rejected',
        '3b. Mark Rejected',
        [
          { id: 'sv3', name: 'processedStatus', expression: 'REJECTED' },
          { id: 'sv4', name: 'processedAt', expression: '{{$now}}' },
        ],
        { x: 400, y: 450 },
      ),
      {
        id: 'kep-produce-result',
        type: 'kafkaProduce',
        position: { x: 240, y: 590 },
        data: {
          label: '4. Publish Result Event',
          clusterId: '',
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
          clusterId: '',
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
      makeLogDebugNode(
        'kep-log',
        '6. Log Pipeline Complete',
        'Pipeline complete — orderId={{orderId}}, status={{processedStatus}}, resultOffset={{resultOffset}}, confirmedOffset={{confirmedOffset}}',
        'info',
        { x: 240, y: 890, snapshotVariables: true },
      ),
      {
        id: 'kep-end',
        type: 'end',
        position: { x: 240, y: 1010 },
        data: { label: 'Pipeline Done', isSuccess: true },
      },
    ],
    edges: [
      makeEdge('kep-e1', 'kep-trigger', 'kep-validate'),
      makeEdge('kep-e2', 'kep-validate', 'kep-check-valid'),
      { id: 'kep-e3', source: 'kep-check-valid', target: 'kep-set-validated', sourceHandle: 'true', label: 'Valid' },
      { id: 'kep-e4', source: 'kep-check-valid', target: 'kep-set-rejected', sourceHandle: 'false', label: 'Rejected' },
      makeEdge('kep-e5', 'kep-set-validated', 'kep-produce-result'),
      makeEdge('kep-e6', 'kep-set-rejected', 'kep-produce-result'),
      makeEdge('kep-e7', 'kep-produce-result', 'kep-consume-confirm'),
      makeEdge('kep-e8', 'kep-consume-confirm', 'kep-log'),
      makeEdge('kep-e9', 'kep-log', 'kep-end'),
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
          clusterId: '',
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
      makeLogDebugNode(
        'kac-log-start',
        '1. Log Payment Request',
        'Processing payment request: orderId={{orderId}}, amount={{amount}} {{currency}}',
        'info',
        { x: 260, y: 170 },
      ),
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
          clusterId: '',
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
          clusterId: '',
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
              // value must be a JSON string — the handler reads message.value and
              // runs JSONPath extractions against it (extractVariables configuration).
              // Without this, message.value defaults to '{}' and paymentStatus is never set.
              value: JSON.stringify({
                orderId: 'ORD-5001',
                status: 'APPROVED',
                transactionId: 'TXN-ORD-5001-001',
                failureReason: null,
              }),
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
      makeConditionNode('kac-check-result', '5. Payment Approved?', '{{paymentStatus}}', 'APPROVED', { x: 260, y: 770 }),
      makeLogDebugNode(
        'kac-success',
        '6a. Payment Approved',
        'Payment APPROVED for order {{orderId}} — transactionId={{transactionId}}, amount={{amount}} {{currency}}',
        'info',
        { x: 80, y: 910 },
      ),
      makeLogDebugNode(
        'kac-failed',
        '6b. Payment Failed',
        'Payment FAILED for order {{orderId}} — reason: {{failureReason}}',
        'error',
        { x: 440, y: 910 },
      ),
      {
        id: 'kac-end',
        type: 'end',
        position: { x: 260, y: 1060 },
        data: { label: 'Payment Handled', isSuccess: true },
      },
    ],
    edges: [
      makeEdge('kac-e1', 'kac-trigger', 'kac-log-start'),
      makeEdge('kac-e2', 'kac-log-start', 'kac-validate'),
      makeEdge('kac-e3', 'kac-validate', 'kac-produce-request'),
      makeEdge('kac-e4', 'kac-produce-request', 'kac-wait'),
      makeEdge('kac-e5', 'kac-wait', 'kac-check-result'),
      { id: 'kac-e6', source: 'kac-check-result', target: 'kac-success', sourceHandle: 'true', label: 'Approved' },
      { id: 'kac-e7', source: 'kac-check-result', target: 'kac-failed', sourceHandle: 'false', label: 'Failed' },
      makeEdge('kac-e8', 'kac-success', 'kac-end'),
      makeEdge('kac-e9', 'kac-failed', 'kac-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
