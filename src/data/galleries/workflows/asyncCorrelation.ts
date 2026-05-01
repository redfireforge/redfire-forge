import type { Workflow } from '../../../features/workflow/types/workflow';

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
      {
        id: 'pcb-start', type: 'start', position: { x: 300, y: 0 },
        data: {
          label: 'Start',
          inputVariables: { orderId: 'ORD-2024-5678', amount: '99.99', currency: 'USD' },
        },
      },
      {
        id: 'pcb-create', type: 'http', position: { x: 300, y: 140 },
        data: {
          label: 'Submit Payment',
          scenario: {
            id: 'pcb-sc-create', name: 'Create Payment',
            url: '{{gatewayBase}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              orderId: '{{orderId}}',
              amount: '{{amount}}',
              currency: '{{currency}}',
              callbackUrl: 'http://localhost:3001/webhooks/callback/payment',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'paymentId', source: 'body', expression: '$.id' },
              { name: 'gatewayRef', source: 'body', expression: '$.id' },
              { name: 'gatewayStatus', source: 'body', expression: '$.title' },
            ],
          },
        },
      },
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
      {
        id: 'pcb-confirm', type: 'http', position: { x: 300, y: 500 },
        data: {
          label: 'Confirm Order',
          scenario: {
            id: 'pcb-sc-confirm', name: 'Confirm Order',
            url: '{{apiBase}}/posts',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'X-Idempotency-Key', value: '{{orderId}}-confirm-{{transactionId}}' },
            ],
            body: JSON.stringify({
              orderId: '{{orderId}}',
              paymentId: '{{paymentId}}',
              paymentStatus: '{{paymentStatus}}',
              transactionId: '{{transactionId}}',
              gatewayRef: '{{gatewayRef}}',
              processedAt: '{{processedAt}}',
              confirmedVia: 'async-webhook-callback',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'confirmationNumber', source: 'body', expression: '$.confirmationNumber' },
            ],
          },
        },
      },
      { id: 'pcb-end', type: 'end', position: { x: 300, y: 660 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'pcb-e1', source: 'pcb-start', target: 'pcb-create' },
      { id: 'pcb-e2', source: 'pcb-create', target: 'pcb-wait' },
      { id: 'pcb-e3', source: 'pcb-wait', target: 'pcb-confirm' },
      { id: 'pcb-e4', source: 'pcb-confirm', target: 'pcb-end' },
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
      {
        id: 'apr-start', type: 'start', position: { x: 400, y: 0 },
        data: {
          label: 'Start',
          inputVariables: {
            requestId: 'REQ-2024-0042',
            requestType: 'budget_increase',
            requestedBy: 'john.doe@company.com',
            approverEmail: 'manager@company.com',
            approverName: 'Jane Smith',
          },
        },
      },
      {
        id: 'apr-submit', type: 'http', position: { x: 400, y: 140 },
        data: {
          label: 'Submit Request',
          scenario: {
            id: 'apr-sc-submit', name: 'Submit Request',
            url: '{{apiBase}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              requestId: '{{requestId}}',
              type: '{{requestType}}',
              requestedBy: '{{requestedBy}}',
              status: 'pending_approval',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'internalId', source: 'body', expression: '$.id' },
              { name: 'requestUrl', source: 'body', expression: '$.id' },
            ],
          },
        },
      },
      {
        id: 'apr-notify', type: 'http', position: { x: 400, y: 300 },
        data: {
          label: 'Notify Approver',
          scenario: {
            id: 'apr-sc-notify', name: 'Send Approval Notification',
            url: '{{apiBase}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              to: '{{approverEmail}}',
              subject: 'Approval Required: {{requestType}} by {{requestedBy}}',
              body: 'Please review and approve/reject request {{requestId}}.',
              callbackUrl: 'http://localhost:3001/webhooks/callback/approval',
              correlationHeader: 'X-Correlation-ID',
              correlationValue: '{{requestId}}',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [],
          },
        },
      },
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
      {
        id: 'apr-approve', type: 'http', position: { x: 200, y: 800 },
        data: {
          label: 'Mark Approved',
          scenario: {
            id: 'apr-sc-approve', name: 'Approve Request',
            url: '{{apiBase}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              approvedBy: '{{approverName}}',
              approvedByEmail: '{{approverEmail}}',
              comment: '{{approverComment}}',
              decidedAt: '{{decidedAt}}',
              requestId: '{{requestId}}',
              internalId: '{{internalId}}',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'approvalRecordId', source: 'body', expression: '$.id' },
            ],
          },
        },
      },
      {
        id: 'apr-notify-ok', type: 'http', position: { x: 200, y: 960 },
        data: {
          label: 'Notify — Approved',
          scenario: {
            id: 'apr-sc-notify-ok', name: 'Send Approval Notification',
            url: '{{apiBase}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              to: '{{requestedBy}}',
              subject: 'Request {{requestId}} Approved',
              body: 'Your {{requestType}} request has been approved by {{approverName}}.',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [],
          },
        },
      },
      {
        id: 'apr-reject', type: 'http', position: { x: 600, y: 800 },
        data: {
          label: 'Mark Rejected',
          scenario: {
            id: 'apr-sc-reject', name: 'Reject Request',
            url: '{{apiBase}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              rejectedBy: '{{approverName}}',
              rejectedByEmail: '{{approverEmail}}',
              comment: '{{approverComment}}',
              decidedAt: '{{decidedAt}}',
              requestId: '{{requestId}}',
              internalId: '{{internalId}}',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [],
          },
        },
      },
      {
        id: 'apr-notify-rej', type: 'http', position: { x: 600, y: 960 },
        data: {
          label: 'Notify — Rejected',
          scenario: {
            id: 'apr-sc-notify-rej', name: 'Send Rejection Notification',
            url: '{{apiBase}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              to: '{{requestedBy}}',
              subject: 'Request {{requestId}} Rejected',
              body: 'Your {{requestType}} request was rejected by {{approverName}}. Reason: {{approverComment}}',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [],
          },
        },
      },
      {
        id: 'apr-log-unknown', type: 'logDebug', position: { x: 400, y: 800 },
        data: {
          label: 'Unknown Decision',
          message: 'Unexpected approval decision: {{approvalDecision}} for request {{requestId}}',
          logLevel: 'warn',
          snapshotVariables: false,
        },
      },
      { id: 'apr-end', type: 'end', position: { x: 400, y: 1120 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'apr-e1', source: 'apr-start', target: 'apr-submit' },
      { id: 'apr-e2', source: 'apr-submit', target: 'apr-notify' },
      { id: 'apr-e3', source: 'apr-notify', target: 'apr-wait' },
      { id: 'apr-e4', source: 'apr-wait', target: 'apr-switch' },
      { id: 'apr-e5', source: 'apr-switch', target: 'apr-approve', sourceHandle: 'case-approved' },
      { id: 'apr-e6', source: 'apr-switch', target: 'apr-reject', sourceHandle: 'case-rejected' },
      { id: 'apr-e7', source: 'apr-switch', target: 'apr-log-unknown', sourceHandle: 'default' },
      { id: 'apr-e8', source: 'apr-approve', target: 'apr-notify-ok' },
      { id: 'apr-e9', source: 'apr-reject', target: 'apr-notify-rej' },
      { id: 'apr-e10', source: 'apr-notify-ok', target: 'apr-end' },
      { id: 'apr-e11', source: 'apr-notify-rej', target: 'apr-end' },
      { id: 'apr-e12', source: 'apr-log-unknown', target: 'apr-end' },
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
      {
        id: 'pp-start', type: 'start', position: { x: 400, y: 0 },
        data: {
          label: 'Start',
          inputVariables: {
            orderId: 'ORD-2024-9999',
            totalAmount: '150.00',
            loyaltyPointsToUse: '2000',
            cardToken: 'tok_visa_4242',
          },
        },
      },
      {
        id: 'pp-split', type: 'setVariable', position: { x: 400, y: 140 },
        data: {
          label: 'Split Payment Amounts',
          assignments: [
            { id: 'a1', name: 'loyaltyAmount', expression: '20.00' },
            { id: 'a2', name: 'cardAmount', expression: '130.00' },
            { id: 'a3', name: 'cardStatus', expression: 'pending' },
            { id: 'a4', name: 'loyaltyStatus', expression: 'pending' },
          ],
        },
      },
      { id: 'pp-fork', type: 'fork', position: { x: 400, y: 280 }, data: { label: 'Fork Payments' } },
      {
        id: 'pp-card-charge', type: 'http', position: { x: 150, y: 420 },
        data: {
          label: 'Submit Card Charge',
          scenario: {
            id: 'pp-sc-card', name: 'Charge Credit Card',
            url: '{{paymentBase}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              orderId: '{{orderId}}',
              amount: '{{cardAmount}}',
              currency: 'USD',
              cardToken: '{{cardToken}}',
              callbackUrl: 'http://localhost:3001/webhooks/callback/card-payment',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'cardPaymentId', source: 'body', expression: '$.id' },
            ],
          },
        },
      },
      {
        // Prefix the gateway-returned id so the parallel card/loyalty waits use
        // distinct correlation IDs even when the upstream test gateway echoes
        // the same numeric id (e.g. jsonplaceholder always returns id=101).
        id: 'pp-set-card-id', type: 'setVariable', position: { x: 150, y: 510 },
        data: {
          label: 'Tag Card Payment ID',
          assignments: [
            { id: 'pp-card-id', name: 'cardPaymentId', expression: 'card-{{cardPaymentId}}' },
          ],
        },
      },
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
      {
        id: 'pp-loyalty-deduct', type: 'http', position: { x: 650, y: 420 },
        data: {
          label: 'Submit Loyalty Deduction',
          scenario: {
            id: 'pp-sc-loyalty', name: 'Deduct Loyalty Points',
            url: '{{paymentBase}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              orderId: '{{orderId}}',
              points: '{{loyaltyPointsToUse}}',
              monetaryValue: '{{loyaltyAmount}}',
              callbackUrl: 'http://localhost:3001/webhooks/callback/loyalty-payment',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'loyaltyPaymentId', source: 'body', expression: '$.id' },
            ],
          },
        },
      },
      {
        // Prefix the gateway-returned id so the parallel waits don't collide.
        id: 'pp-set-loyalty-id', type: 'setVariable', position: { x: 650, y: 510 },
        data: {
          label: 'Tag Loyalty Payment ID',
          assignments: [
            { id: 'pp-loyalty-id', name: 'loyaltyPaymentId', expression: 'loyalty-{{loyaltyPaymentId}}' },
          ],
        },
      },
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
      { id: 'pp-join', type: 'join', position: { x: 400, y: 780 }, data: { label: 'Join Payments' } },
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
        data: {
          label: 'Both Payments OK?',
          left: '{{cardStatus}}',
          operator: '==',
          right: 'approved',
        },
      },
      {
        id: 'pp-confirm', type: 'http', position: { x: 200, y: 1200 },
        data: {
          label: 'Confirm Order',
          scenario: {
            id: 'pp-sc-confirm', name: 'Confirm Order',
            url: '{{apiBase}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              orderId: '{{orderId}}',
              cardPaymentId: '{{cardPaymentId}}',
              loyaltyPaymentId: '{{loyaltyPaymentId}}',
              totalCharged: '{{totalAmount}}',
              cardAmount: '{{cardAmount}}',
              loyaltyAmount: '{{loyaltyAmount}}',
              cardTransactionId: '{{cardTransactionId}}',
              loyaltyDeductionId: '{{loyaltyDeductionId}}',
              paymentSummary: '{{paymentSummary}}',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'confirmationNumber', source: 'body', expression: '$.id' },
            ],
          },
        },
      },
      {
        id: 'pp-cancel', type: 'http', position: { x: 600, y: 1200 },
        data: {
          label: 'Cancel Order',
          scenario: {
            id: 'pp-sc-cancel', name: 'Cancel Order',
            url: '{{apiBase}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              orderId: '{{orderId}}',
              reason: 'Payment failed: {{paymentSummary}}',
              cardStatus: '{{cardStatus}}',
              loyaltyStatus: '{{loyaltyStatus}}',
              cardPaymentId: '{{cardPaymentId}}',
              loyaltyPaymentId: '{{loyaltyPaymentId}}',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [],
          },
        },
      },
      {
        id: 'pp-refund', type: 'http', position: { x: 600, y: 1360 },
        data: {
          label: 'Refund Payments',
          scenario: {
            id: 'pp-sc-refund', name: 'Refund',
            url: '{{paymentBase}}/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              orderId: '{{orderId}}',
              cardPaymentId: '{{cardPaymentId}}',
              loyaltyPaymentId: '{{loyaltyPaymentId}}',
              cardTransactionId: '{{cardTransactionId}}',
              loyaltyDeductionId: '{{loyaltyDeductionId}}',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [],
          },
        },
      },
      { id: 'pp-end', type: 'end', position: { x: 400, y: 1520 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'pp-e1', source: 'pp-start', target: 'pp-split' },
      { id: 'pp-e2', source: 'pp-split', target: 'pp-fork' },
      { id: 'pp-e3', source: 'pp-fork', target: 'pp-card-charge' },
      { id: 'pp-e4', source: 'pp-card-charge', target: 'pp-set-card-id' },
      { id: 'pp-e4b', source: 'pp-set-card-id', target: 'pp-cw-card' },
      { id: 'pp-e5', source: 'pp-cw-card', target: 'pp-join' },
      { id: 'pp-e6', source: 'pp-fork', target: 'pp-loyalty-deduct' },
      { id: 'pp-e7', source: 'pp-loyalty-deduct', target: 'pp-set-loyalty-id' },
      { id: 'pp-e7b', source: 'pp-set-loyalty-id', target: 'pp-cw-loyalty' },
      { id: 'pp-e8', source: 'pp-cw-loyalty', target: 'pp-join' },
      { id: 'pp-e9', source: 'pp-join', target: 'pp-agg' },
      { id: 'pp-e10', source: 'pp-agg', target: 'pp-cond' },
      { id: 'pp-e11', source: 'pp-cond', target: 'pp-confirm', sourceHandle: 'true' },
      { id: 'pp-e12', source: 'pp-cond', target: 'pp-cancel', sourceHandle: 'false' },
      { id: 'pp-e13', source: 'pp-cancel', target: 'pp-refund' },
      { id: 'pp-e14', source: 'pp-confirm', target: 'pp-end' },
      { id: 'pp-e15', source: 'pp-refund', target: 'pp-end' },
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
      {
        id: 'pcs-start', type: 'start', position: { x: 300, y: 0 },
        data: {
          label: 'Start',
          inputVariables: {
            paymentId: '101',
            status: 'approved',
            transactionId: 'txn_8mK3vP7wXjRs',
            processedAt: '2024-01-15T10:26:14.392Z',
          },
        },
      },
      {
        id: 'pcs-delay', type: 'delay', position: { x: 300, y: 140 },
        data: { label: 'Wait 3s for main workflow to pause', delayMs: 3000, mode: 'fixed' },
      },
      {
        id: 'pcs-post', type: 'http', position: { x: 300, y: 280 },
        data: {
          label: 'POST Fake Callback',
          scenario: {
            id: 'pcs-sc-post', name: 'Send Webhook',
            url: '{{webhookHost}}/webhooks/callback/payment',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'x-idempotency-key', value: 'sim-pay-{{paymentId}}-{{$timestamp}}' },
            ],
            body: JSON.stringify({
              paymentId: '{{paymentId}}',
              status: '{{status}}',
              transactionId: '{{transactionId}}',
              processedAt: '{{processedAt}}',
              amount: 99.99,
              currency: 'USD',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'resumed', source: 'body', expression: '$.resumed' },
              { name: 'executionId', source: 'body', expression: '$.executionId' },
            ],
          },
        },
      },
      { id: 'pcs-end', type: 'end', position: { x: 300, y: 460 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'pcs-e1', source: 'pcs-start', target: 'pcs-delay' },
      { id: 'pcs-e2', source: 'pcs-delay', target: 'pcs-post' },
      { id: 'pcs-e3', source: 'pcs-post', target: 'pcs-end' },
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
      {
        id: 'aps-start', type: 'start', position: { x: 300, y: 0 },
        data: {
          label: 'Start',
          inputVariables: {
            requestId: 'REQ-2024-0042',
            decision: 'approved',
            comment: 'Approved by simulator — looks good',
            decidedAt: '2024-01-15T11:00:00Z',
          },
        },
      },
      {
        id: 'aps-delay', type: 'delay', position: { x: 300, y: 140 },
        data: { label: 'Wait 3s for main workflow to pause', delayMs: 3000, mode: 'fixed' },
      },
      {
        id: 'aps-post', type: 'http', position: { x: 300, y: 280 },
        data: {
          label: 'POST Fake Approval',
          scenario: {
            id: 'aps-sc-post', name: 'Send Approval Webhook',
            url: '{{webhookHost}}/webhooks/callback/approval',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'X-Correlation-ID', value: '{{requestId}}' },
              { key: 'x-idempotency-key', value: 'sim-apr-{{requestId}}-{{$timestamp}}' },
            ],
            body: JSON.stringify({
              type: 'approval',
              requestId: '{{requestId}}',
              decision: '{{decision}}',
              comment: '{{comment}}',
              decidedAt: '{{decidedAt}}',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'resumed', source: 'body', expression: '$.resumed' },
            ],
          },
        },
      },
      { id: 'aps-end', type: 'end', position: { x: 300, y: 460 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'aps-e1', source: 'aps-start', target: 'aps-delay' },
      { id: 'aps-e2', source: 'aps-delay', target: 'aps-post' },
      { id: 'aps-e3', source: 'aps-post', target: 'aps-end' },
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
      {
        id: 'pps-start', type: 'start', position: { x: 400, y: 0 },
        data: {
          label: 'Start',
          inputVariables: {
            cardPaymentId: 'card-101',
            loyaltyPaymentId: 'loyalty-101',
            cardStatus: 'approved',
            loyaltyStatus: 'approved',
          },
        },
      },
      {
        id: 'pps-delay', type: 'delay', position: { x: 400, y: 140 },
        data: { label: 'Wait 3s for main workflow to pause', delayMs: 3000, mode: 'fixed' },
      },
      { id: 'pps-fork', type: 'fork', position: { x: 400, y: 280 }, data: { label: 'Fork Callbacks' } },
      {
        id: 'pps-card', type: 'http', position: { x: 200, y: 420 },
        data: {
          label: 'POST Card Callback',
          scenario: {
            id: 'pps-sc-card', name: 'Send Card Webhook',
            url: '{{webhookHost}}/webhooks/callback/card-payment',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'x-idempotency-key', value: 'sim-card-{{cardPaymentId}}-{{$timestamp}}' },
            ],
            body: JSON.stringify({
              paymentId: '{{cardPaymentId}}',
              status: '{{cardStatus}}',
              transactionId: 'txn_card_8mK3vP7wXjRs',
              authorizationCode: 'AUTH-779231',
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [],
          },
        },
      },
      {
        id: 'pps-loyalty', type: 'http', position: { x: 600, y: 420 },
        data: {
          label: 'POST Loyalty Callback',
          scenario: {
            id: 'pps-sc-loyalty', name: 'Send Loyalty Webhook',
            url: '{{webhookHost}}/webhooks/callback/loyalty-payment',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
              { key: 'x-idempotency-key', value: 'sim-loyalty-{{loyaltyPaymentId}}-{{$timestamp}}' },
            ],
            body: JSON.stringify({
              paymentId: '{{loyaltyPaymentId}}',
              status: '{{loyaltyStatus}}',
              deductionId: 'ded_loyalty_8mK3vP7wXjRs',
              remainingPoints: 8000,
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [],
          },
        },
      },
      { id: 'pps-join', type: 'join', position: { x: 400, y: 580 }, data: { label: 'Join' } },
      { id: 'pps-end', type: 'end', position: { x: 400, y: 720 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'pps-e1', source: 'pps-start', target: 'pps-delay' },
      { id: 'pps-e2', source: 'pps-delay', target: 'pps-fork' },
      { id: 'pps-e3', source: 'pps-fork', target: 'pps-card' },
      { id: 'pps-e4', source: 'pps-fork', target: 'pps-loyalty' },
      { id: 'pps-e5', source: 'pps-card', target: 'pps-join' },
      { id: 'pps-e6', source: 'pps-loyalty', target: 'pps-join' },
      { id: 'pps-e7', source: 'pps-join', target: 'pps-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

