import type { Workflow } from '../../../features/workflow/types/workflow';
import {
  makeStartNode, makeEndNode, makePostNode, makeSetVariableNode,
  makeDelayNode, makeForkNode, makeJoinNode, makeEdge, jsonBody, bodyExtraction,
} from './nodeFactories';

/**
 * Sample workflow: Payment Gateway Callback (Easy).
 * Submit a payment to an async gateway, wait for the webhook callback,
 * then confirm the order. Demonstrates basic CorrelationWait with body-based
 * correlation.
 *
 * Flow: Start → POST /payments/create → CorrelationWait → POST /orders/confirm → End
 */
export function createPaymentCallbackEasyWorkflow(): Workflow {
  return {
    id: 'sample-workflow-payment-callback-easy',
    name: 'Sample: Payment Gateway Callback',
    description: 'Submit a payment to an async gateway, wait for the webhook callback, then confirm the order.',
    variables: {
      apiBase: 'https://jsonplaceholder.typicode.com',
      gatewayBase: 'https://jsonplaceholder.typicode.com',
    },
    nodes: [
      makeStartNode('pcb-start', { orderId: 'ORD-2024-5678', amount: '99.99', currency: 'USD' }, { y: 0 }),
      makePostNode('pcb-create', 'Submit Payment', '{{gatewayBase}}/posts',
        jsonBody({ orderId: '{{orderId}}', amount: '{{amount}}', currency: '{{currency}}', callbackUrl: 'http://localhost:3001/webhooks/callback/payment' }),
        { y: 140, extractions: [bodyExtraction('paymentId', '$.id'), bodyExtraction('gatewayRef', '$.id'), bodyExtraction('gatewayStatus', '$.title')] }),
      {
        id: 'pcb-wait', type: 'correlationWait', position: { x: 300, y: 320 },
        data: {
          label: 'Wait for Payment Callback',
          correlationIdExpression: '{{paymentId}}',
          webhookPath: '/webhooks/callback/payment',
          correlationSource: 'body',
          correlationJsonPath: '$.paymentId',
          extractVariables: [
            { name: 'paymentStatus', jsonPath: '$.status' },
            { name: 'transactionId', jsonPath: '$.transactionId' },
            { name: 'processedAt', jsonPath: '$.processedAt' },
          ],
          timeoutMs: 300000,
          notes: 'Waits for the payment gateway to POST to /webhooks/callback/payment with matching paymentId.',
        },
      },
      makePostNode('pcb-confirm', 'Confirm Order', '{{apiBase}}/posts',
        jsonBody({ orderId: '{{orderId}}', paymentId: '{{paymentId}}', paymentStatus: '{{paymentStatus}}', transactionId: '{{transactionId}}', gatewayRef: '{{gatewayRef}}', processedAt: '{{processedAt}}', confirmedVia: 'async-webhook-callback' }),
        { y: 500, extraHeaders: [{ key: 'X-Idempotency-Key', value: '{{orderId}}-confirm-{{transactionId}}' }], extractions: [bodyExtraction('confirmationNumber', '$.confirmationNumber')] }),
      makeEndNode('pcb-end', 'Done', { y: 660 }),
    ],
    edges: [
      makeEdge('pcb-e1', 'pcb-start', 'pcb-create'),
      makeEdge('pcb-e2', 'pcb-create', 'pcb-wait'),
      makeEdge('pcb-e3', 'pcb-wait', 'pcb-confirm'),
      makeEdge('pcb-e4', 'pcb-confirm', 'pcb-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow: Manager Approval Workflow (Medium).
 * Submit a request, notify the approver, wait up to 72h for the approval
 * webhook, then route to approve/reject paths via Switch.
 * Demonstrates header-based correlation with webhook filter expression.
 *
 * Flow:
 *   Start → POST /requests → POST /notifications → CorrelationWait
 *     → Switch(decision) → [Approved → notify, Rejected → notify, Unknown → log]
 *     → End
 */
export function createApprovalWorkflowMediumWorkflow(): Workflow {
  return {
    id: 'sample-workflow-approval-medium',
    name: 'Sample: Manager Approval Workflow',
    description: 'Submit a request, notify the approver, wait for the approval webhook (header correlation), then route via Switch.',
    variables: { apiBase: 'https://jsonplaceholder.typicode.com' },
    nodes: [
      makeStartNode('apr-start', { requestId: 'REQ-2024-0042', requestType: 'budget_increase', requestedBy: 'john.doe@company.com', approverEmail: 'manager@company.com', approverName: 'Jane Smith' }, { x: 400 }),
      makePostNode('apr-submit', 'Submit Request', '{{apiBase}}/posts',
        jsonBody({ requestId: '{{requestId}}', type: '{{requestType}}', requestedBy: '{{requestedBy}}', status: 'pending_approval' }),
        { x: 400, y: 140, extractions: [bodyExtraction('internalId', '$.id'), bodyExtraction('requestUrl', '$.id')] }),
      makePostNode('apr-notify', 'Notify Approver', '{{apiBase}}/posts',
        jsonBody({ to: '{{approverEmail}}', subject: 'Approval Required: {{requestType}} by {{requestedBy}}', body: 'Please review and approve/reject request {{requestId}}.', callbackUrl: 'http://localhost:3001/webhooks/callback/approval', correlationHeader: 'X-Correlation-ID', correlationValue: '{{requestId}}' }),
        { x: 400, y: 300 }),
      {
        id: 'apr-wait', type: 'correlationWait', position: { x: 400, y: 460 },
        data: {
          label: 'Wait for Approval',
          correlationIdExpression: '{{requestId}}',
          webhookPath: '/webhooks/callback/approval',
          correlationSource: 'header',
          correlationHeader: 'X-Correlation-ID',
          extractVariables: [
            { name: 'approvalDecision', jsonPath: '$.decision' },
            { name: 'approverComment', jsonPath: '$.comment' },
            { name: 'decidedAt', jsonPath: '$.decidedAt' },
          ],
          timeoutMs: 259200000,
          webhookFilter: '{{webhook.type}} == approval',
          notes: 'Waits up to 72h for the approver to respond. Header X-Correlation-ID matches requestId. Filter accepts only "approval" type webhooks.',
        },
      },
      {
        id: 'apr-switch', type: 'switch', position: { x: 400, y: 640 },
        data: {
          label: 'Route by Decision',
          expression: '{{approvalDecision}}',
          cases: [
            { id: 'approved', value: 'approved', label: 'Approved' },
            { id: 'rejected', value: 'rejected', label: 'Rejected' },
          ],
        },
      },
      makePostNode('apr-approve', 'Mark Approved', '{{apiBase}}/posts',
        jsonBody({ approvedBy: '{{approverName}}', approvedByEmail: '{{approverEmail}}', comment: '{{approverComment}}', decidedAt: '{{decidedAt}}', requestId: '{{requestId}}', internalId: '{{internalId}}' }),
        { x: 200, y: 800, extractions: [bodyExtraction('approvalRecordId', '$.id')] }),
      makePostNode('apr-notify-ok', 'Notify — Approved', '{{apiBase}}/posts',
        jsonBody({ to: '{{requestedBy}}', subject: 'Request {{requestId}} Approved', body: 'Your {{requestType}} request has been approved by {{approverName}}.' }),
        { x: 200, y: 960 }),
      makePostNode('apr-reject', 'Mark Rejected', '{{apiBase}}/posts',
        jsonBody({ rejectedBy: '{{approverName}}', rejectedByEmail: '{{approverEmail}}', comment: '{{approverComment}}', decidedAt: '{{decidedAt}}', requestId: '{{requestId}}', internalId: '{{internalId}}' }),
        { x: 600, y: 800 }),
      makePostNode('apr-notify-rej', 'Notify — Rejected', '{{apiBase}}/posts',
        jsonBody({ to: '{{requestedBy}}', subject: 'Request {{requestId}} Rejected', body: 'Your {{requestType}} request was rejected by {{approverName}}. Reason: {{approverComment}}' }),
        { x: 600, y: 960 }),
      {
        id: 'apr-log-unknown', type: 'logDebug', position: { x: 400, y: 800 },
        data: {
          label: 'Unknown Decision',
          message: 'Unexpected approval decision: {{approvalDecision}} for request {{requestId}}',
          logLevel: 'warn',
          snapshotVariables: false,
        },
      },
      makeEndNode('apr-end', 'Done', { x: 400, y: 1120 }),
    ],
    edges: [
      makeEdge('apr-e1', 'apr-start', 'apr-submit'),
      makeEdge('apr-e2', 'apr-submit', 'apr-notify'),
      makeEdge('apr-e3', 'apr-notify', 'apr-wait'),
      makeEdge('apr-e4', 'apr-wait', 'apr-switch'),
      { id: 'apr-e5', source: 'apr-switch', target: 'apr-approve', sourceHandle: 'case-approved' },
      { id: 'apr-e6', source: 'apr-switch', target: 'apr-reject', sourceHandle: 'case-rejected' },
      { id: 'apr-e7', source: 'apr-switch', target: 'apr-log-unknown', sourceHandle: 'default' },
      makeEdge('apr-e8', 'apr-approve', 'apr-notify-ok'),
      makeEdge('apr-e9', 'apr-reject', 'apr-notify-rej'),
      makeEdge('apr-e10', 'apr-notify-ok', 'apr-end'),
      makeEdge('apr-e11', 'apr-notify-rej', 'apr-end'),
      makeEdge('apr-e12', 'apr-log-unknown', 'apr-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow: Parallel Payment Processing (Hard).
 * Process a split payment: charge a credit card and deduct loyalty points
 * in parallel, wait for both gateway callbacks, then confirm or refund.
 * Demonstrates Fork/Join with multiple CorrelationWait nodes.
 *
 * Flow:
 *   Start → SetVariable(split) → Fork
 *     ├─ POST /payments/card    → CorrelationWait(card)    →┐
 *     └─ POST /payments/loyalty → CorrelationWait(loyalty) →┴ Join
 *   → Aggregate(summary) → Condition(both ok?)
 *     ├─ true  → POST /orders/confirm → End
 *     └─ false → POST /orders/cancel → POST /payments/refund → End
 */
export function createParallelPaymentAdvancedWorkflow(): Workflow {
  return {
    id: 'sample-workflow-parallel-payment-advanced',
    name: 'Sample: Parallel Payment Processing',
    description: 'Charge card + deduct loyalty points in parallel; wait for both gateway callbacks; confirm or refund.',
    variables: {
      apiBase: 'https://jsonplaceholder.typicode.com',
      paymentBase: 'https://jsonplaceholder.typicode.com',
    },
    nodes: [
      makeStartNode('pp-start', { orderId: 'ORD-2024-9999', totalAmount: '150.00', loyaltyPointsToUse: '2000', cardToken: 'tok_visa_4242' }, { x: 400 }),
      makeSetVariableNode('pp-split', 'Split Payment Amounts', [
        { id: 'a1', name: 'loyaltyAmount', expression: '20.00' },
        { id: 'a2', name: 'cardAmount', expression: '130.00' },
        { id: 'a3', name: 'cardStatus', expression: 'pending' },
        { id: 'a4', name: 'loyaltyStatus', expression: 'pending' },
      ], { x: 400, y: 140 }),
      makeForkNode('pp-fork', 'Fork Payments', { x: 400, y: 280 }),
      makePostNode('pp-card-charge', 'Submit Card Charge', '{{paymentBase}}/posts',
        jsonBody({ orderId: '{{orderId}}', amount: '{{cardAmount}}', currency: 'USD', cardToken: '{{cardToken}}', callbackUrl: 'http://localhost:3001/webhooks/callback/card-payment' }),
        { x: 150, y: 420, extractions: [bodyExtraction('cardPaymentId', '$.id')] }),
      makeSetVariableNode('pp-set-card-id', 'Tag Card Payment ID', [
        { id: 'pp-card-id', name: 'cardPaymentId', expression: 'card-{{cardPaymentId}}' },
      ], { x: 150, y: 510 }),
      {
        id: 'pp-cw-card', type: 'correlationWait', position: { x: 150, y: 600 },
        data: {
          label: 'Wait for Card Payment',
          correlationIdExpression: '{{cardPaymentId}}',
          webhookPath: '/webhooks/callback/card-payment',
          correlationSource: 'body',
          correlationJsonPath: '$.paymentId',
          extractVariables: [
            { name: 'cardStatus', jsonPath: '$.status' },
            { name: 'cardTransactionId', jsonPath: '$.transactionId' },
            { name: 'cardAuthCode', jsonPath: '$.authorizationCode' },
          ],
          timeoutMs: 120000,
          notes: 'Wait for the card payment gateway callback (timeout 2 min).',
        },
      },
      makePostNode('pp-loyalty-deduct', 'Submit Loyalty Deduction', '{{paymentBase}}/posts',
        jsonBody({ orderId: '{{orderId}}', points: '{{loyaltyPointsToUse}}', monetaryValue: '{{loyaltyAmount}}', callbackUrl: 'http://localhost:3001/webhooks/callback/loyalty-payment' }),
        { x: 650, y: 420, extractions: [bodyExtraction('loyaltyPaymentId', '$.id')] }),
      makeSetVariableNode('pp-set-loyalty-id', 'Tag Loyalty Payment ID', [
        { id: 'pp-loyalty-id', name: 'loyaltyPaymentId', expression: 'loyalty-{{loyaltyPaymentId}}' },
      ], { x: 650, y: 510 }),
      {
        id: 'pp-cw-loyalty', type: 'correlationWait', position: { x: 650, y: 600 },
        data: {
          label: 'Wait for Loyalty Deduction',
          correlationIdExpression: '{{loyaltyPaymentId}}',
          webhookPath: '/webhooks/callback/loyalty-payment',
          correlationSource: 'body',
          correlationJsonPath: '$.paymentId',
          extractVariables: [
            { name: 'loyaltyStatus', jsonPath: '$.status' },
            { name: 'loyaltyDeductionId', jsonPath: '$.deductionId' },
            { name: 'remainingPoints', jsonPath: '$.remainingPoints' },
          ],
          timeoutMs: 120000,
          notes: 'Wait for the loyalty payment system callback (timeout 2 min).',
        },
      },
      makeJoinNode('pp-join', 'Join Payments', { x: 400, y: 780 }),
      {
        id: 'pp-agg', type: 'aggregate', position: { x: 400, y: 900 },
        data: {
          label: 'Aggregate Payment Results',
          mappings: [
            {
              id: 'agg1',
              sourceExpression: 'Card: {{cardStatus}} ({{cardTransactionId}}), Loyalty: {{loyaltyStatus}} ({{loyaltyDeductionId}}), Remaining points: {{remainingPoints}}',
              targetVariable: 'paymentSummary',
              strategy: 'custom',
            },
          ],
        },
      },
      {
        id: 'pp-cond', type: 'condition', position: { x: 400, y: 1040 },
        data: { label: 'Both Payments OK?', left: '{{cardStatus}}', operator: '==', right: 'approved' },
      },
      makePostNode('pp-confirm', 'Confirm Order', '{{apiBase}}/posts',
        jsonBody({ orderId: '{{orderId}}', cardPaymentId: '{{cardPaymentId}}', loyaltyPaymentId: '{{loyaltyPaymentId}}', totalCharged: '{{totalAmount}}', cardAmount: '{{cardAmount}}', loyaltyAmount: '{{loyaltyAmount}}', cardTransactionId: '{{cardTransactionId}}', loyaltyDeductionId: '{{loyaltyDeductionId}}', paymentSummary: '{{paymentSummary}}' }),
        { x: 200, y: 1200, extractions: [bodyExtraction('confirmationNumber', '$.id')] }),
      makePostNode('pp-cancel', 'Cancel Order', '{{apiBase}}/posts',
        jsonBody({ orderId: '{{orderId}}', reason: 'Payment failed: {{paymentSummary}}', cardStatus: '{{cardStatus}}', loyaltyStatus: '{{loyaltyStatus}}', cardPaymentId: '{{cardPaymentId}}', loyaltyPaymentId: '{{loyaltyPaymentId}}' }),
        { x: 600, y: 1200 }),
      makePostNode('pp-refund', 'Refund Payments', '{{paymentBase}}/posts',
        jsonBody({ orderId: '{{orderId}}', cardPaymentId: '{{cardPaymentId}}', loyaltyPaymentId: '{{loyaltyPaymentId}}', cardTransactionId: '{{cardTransactionId}}', loyaltyDeductionId: '{{loyaltyDeductionId}}' }),
        { x: 600, y: 1360 }),
      makeEndNode('pp-end', 'Done', { x: 400, y: 1520 }),
    ],
    edges: [
      makeEdge('pp-e1', 'pp-start', 'pp-split'),
      makeEdge('pp-e2', 'pp-split', 'pp-fork'),
      makeEdge('pp-e3', 'pp-fork', 'pp-card-charge'),
      makeEdge('pp-e4', 'pp-card-charge', 'pp-set-card-id'),
      makeEdge('pp-e4b', 'pp-set-card-id', 'pp-cw-card'),
      makeEdge('pp-e5', 'pp-cw-card', 'pp-join'),
      makeEdge('pp-e6', 'pp-fork', 'pp-loyalty-deduct'),
      makeEdge('pp-e7', 'pp-loyalty-deduct', 'pp-set-loyalty-id'),
      makeEdge('pp-e7b', 'pp-set-loyalty-id', 'pp-cw-loyalty'),
      makeEdge('pp-e8', 'pp-cw-loyalty', 'pp-join'),
      makeEdge('pp-e9', 'pp-join', 'pp-agg'),
      makeEdge('pp-e10', 'pp-agg', 'pp-cond'),
      { id: 'pp-e11', source: 'pp-cond', target: 'pp-confirm', sourceHandle: 'true' },
      { id: 'pp-e12', source: 'pp-cond', target: 'pp-cancel', sourceHandle: 'false' },
      makeEdge('pp-e13', 'pp-cancel', 'pp-refund'),
      makeEdge('pp-e14', 'pp-confirm', 'pp-end'),
      makeEdge('pp-e15', 'pp-refund', 'pp-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Counterpart "simulator" workflows.
// Each simulator runs separately (in another tab/window) to POST a fake
// webhook callback to localhost:3001, resuming the main workflow that is
// paused on its CorrelationWait node.
//
// USAGE:
//   1. Run the main workflow (e.g. Payment Gateway Callback). It pauses on
//      the CorrelationWait node and prints the extracted correlation id
//      (e.g. paymentId = "101" — jsonplaceholder always returns id: 101).
//   2. Run the matching simulator workflow. It waits 3s then POSTs the
//      simulated callback body. The main workflow resumes.
// ─────────────────────────────────────────────────────────────────────────────

const WEBHOOK_HOST = 'http://localhost:3001';

/**
 * Simulator for Payment Gateway Callback (Easy).
 * Waits 3s, then POSTs a fake gateway callback to /webhooks/callback/payment.
 *
 * Flow: Start → Delay → HTTP POST callback → End
 */
export function createPaymentCallbackSimulatorWorkflow(): Workflow {
  return {
    id: 'sample-workflow-payment-callback-simulator',
    name: 'Sample: Payment Callback (Simulator)',
    description: 'Counterpart demo — POSTs a fake gateway callback to /webhooks/callback/payment to resume the Payment Gateway Callback sample.',
    variables: { webhookHost: WEBHOOK_HOST },
    nodes: [
      makeStartNode('pcs-start', { paymentId: '101', status: 'approved', transactionId: 'txn_8mK3vP7wXjRs', processedAt: '2024-01-15T10:26:14.392Z' }),
      makeDelayNode('pcs-delay', 'Wait 3s for main workflow to pause', 3000, { y: 140 }),
      makePostNode('pcs-post', 'POST Fake Callback', '{{webhookHost}}/webhooks/callback/payment',
        jsonBody({ paymentId: '{{paymentId}}', status: '{{status}}', transactionId: '{{transactionId}}', processedAt: '{{processedAt}}', amount: 99.99, currency: 'USD' }),
        { y: 280, extraHeaders: [{ key: 'x-idempotency-key', value: 'sim-pay-{{paymentId}}-{{$timestamp}}' }], extractions: [bodyExtraction('resumed', '$.resumed'), bodyExtraction('executionId', '$.executionId')] }),
      makeEndNode('pcs-end', 'Done', { y: 460 }),
    ],
    edges: [
      makeEdge('pcs-e1', 'pcs-start', 'pcs-delay'),
      makeEdge('pcs-e2', 'pcs-delay', 'pcs-post'),
      makeEdge('pcs-e3', 'pcs-post', 'pcs-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Simulator for Manager Approval Workflow (Medium).
 * Waits 3s, then POSTs a fake approval webhook with X-Correlation-ID header.
 *
 * Flow: Start → Delay → HTTP POST approval callback → End
 */
export function createApprovalSimulatorWorkflow(): Workflow {
  return {
    id: 'sample-workflow-approval-simulator',
    name: 'Sample: Manager Approval (Simulator)',
    description: 'Counterpart demo — POSTs a fake approval webhook (header correlation) to resume the Manager Approval Workflow sample.',
    variables: { webhookHost: WEBHOOK_HOST },
    nodes: [
      makeStartNode('aps-start', { requestId: 'REQ-2024-0042', decision: 'approved', comment: 'Approved by simulator — looks good', decidedAt: '2024-01-15T11:00:00Z' }),
      makeDelayNode('aps-delay', 'Wait 3s for main workflow to pause', 3000, { y: 140 }),
      makePostNode('aps-post', 'POST Fake Approval', '{{webhookHost}}/webhooks/callback/approval',
        jsonBody({ type: 'approval', requestId: '{{requestId}}', decision: '{{decision}}', comment: '{{comment}}', decidedAt: '{{decidedAt}}' }),
        { y: 280, extraHeaders: [{ key: 'X-Correlation-ID', value: '{{requestId}}' }, { key: 'x-idempotency-key', value: 'sim-apr-{{requestId}}-{{$timestamp}}' }], extractions: [bodyExtraction('resumed', '$.resumed')] }),
      makeEndNode('aps-end', 'Done', { y: 460 }),
    ],
    edges: [
      makeEdge('aps-e1', 'aps-start', 'aps-delay'),
      makeEdge('aps-e2', 'aps-delay', 'aps-post'),
      makeEdge('aps-e3', 'aps-post', 'aps-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Simulator for Parallel Payment Processing (Advanced).
 * Waits 3s, then POSTs both card-payment and loyalty-payment callbacks in
 * parallel via Fork/Join. Both must arrive for the main workflow to proceed.
 *
 * Flow: Start → Delay → Fork → [HTTP card, HTTP loyalty] → Join → End
 */
export function createParallelPaymentSimulatorWorkflow(): Workflow {
  return {
    id: 'sample-workflow-parallel-payment-simulator',
    name: 'Sample: Parallel Payment (Simulator)',
    description: 'Counterpart demo — POSTs both card and loyalty callbacks in parallel to resume the Parallel Payment Processing sample.',
    variables: { webhookHost: WEBHOOK_HOST },
    nodes: [
      makeStartNode('pps-start', { cardPaymentId: 'card-101', loyaltyPaymentId: 'loyalty-101', cardStatus: 'approved', loyaltyStatus: 'approved' }, { x: 400 }),
      makeDelayNode('pps-delay', 'Wait 3s for main workflow to pause', 3000, { x: 400, y: 140 }),
      makeForkNode('pps-fork', 'Fork Callbacks', { x: 400, y: 280 }),
      makePostNode('pps-card', 'POST Card Callback', '{{webhookHost}}/webhooks/callback/card-payment',
        jsonBody({ paymentId: '{{cardPaymentId}}', status: '{{cardStatus}}', transactionId: 'txn_card_8mK3vP7wXjRs', authorizationCode: 'AUTH-779231' }),
        { x: 200, y: 420, extraHeaders: [{ key: 'x-idempotency-key', value: 'sim-card-{{cardPaymentId}}-{{$timestamp}}' }] }),
      makePostNode('pps-loyalty', 'POST Loyalty Callback', '{{webhookHost}}/webhooks/callback/loyalty-payment',
        jsonBody({ paymentId: '{{loyaltyPaymentId}}', status: '{{loyaltyStatus}}', deductionId: 'ded_loyalty_8mK3vP7wXjRs', remainingPoints: 8000 }),
        { x: 600, y: 420, extraHeaders: [{ key: 'x-idempotency-key', value: 'sim-loyalty-{{loyaltyPaymentId}}-{{$timestamp}}' }] }),
      makeJoinNode('pps-join', 'Join', { x: 400, y: 580 }),
      makeEndNode('pps-end', 'Done', { x: 400, y: 720 }),
    ],
    edges: [
      makeEdge('pps-e1', 'pps-start', 'pps-delay'),
      makeEdge('pps-e2', 'pps-delay', 'pps-fork'),
      makeEdge('pps-e3', 'pps-fork', 'pps-card'),
      makeEdge('pps-e4', 'pps-fork', 'pps-loyalty'),
      makeEdge('pps-e5', 'pps-card', 'pps-join'),
      makeEdge('pps-e6', 'pps-loyalty', 'pps-join'),
      makeEdge('pps-e7', 'pps-join', 'pps-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

