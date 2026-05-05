/**
 * RedfireForge Correlation Wait API — paused workflow webhooks and correlations (local dev).
 */
export const CORRELATION_WAIT_API_SPEC = `openapi: "3.0.3"
info:
  title: RedfireForge Correlation Wait API
  version: "1.0.0"
  description: >
    Server-side API for managing paused workflow correlations and processing
    webhook callbacks. Supports correlation matching by body JSONPath, HTTP
    header, or query parameter. Optional HMAC-SHA256 security, idempotency,
    and webhook filter expressions.

servers:
  - url: http://localhost:3001
    description: Local Development

tags:
  - name: correlations
    description: Manage paused workflow correlations
  - name: webhooks
    description: Webhook callback endpoints for external systems
  - name: diagnostics
    description: Idempotency stats and unmatched webhook logs

paths:
  /api/correlations/pause:
    post:
      operationId: pauseCorrelation
      summary: Register a paused correlation
      description: >
        Register a workflow as paused and waiting for a webhook callback.
        The correlation ID is used to match incoming webhooks to the paused
        workflow. When WEBHOOK_SECURITY_ENABLED=true, the response includes
        a signed webhook token.
      tags: [correlations]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [correlationId, webhookPath, executionId]
              properties:
                correlationId:
                  type: string
                  description: Unique ID to match against incoming webhooks
                webhookPath:
                  type: string
                  description: Webhook path to match
                executionId:
                  type: string
                  description: Workflow execution ID
                workflowId:
                  type: string
                pausedNodeId:
                  type: string
                timeoutMs:
                  type: integer
                  default: 0
                correlationSource:
                  type: string
                  enum: [body, header, query]
                  default: body
                correlationJsonPath:
                  type: string
                correlationHeader:
                  type: string
                correlationQueryParam:
                  type: string
                webhookFilter:
                  type: string
            example:
              correlationId: "pay_4kF9xR2mNqLp"
              webhookPath: "/webhooks/callback/payment"
              executionId: "exec-abc-001"
              timeoutMs: 300000
              correlationSource: "body"
              correlationJsonPath: "$.paymentId"
      responses:
        "201":
          description: Correlation registered successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  paused:
                    type: boolean
                  correlationId:
                    type: string
                  timeoutAt:
                    type: integer
        "409":
          description: Correlation ID already exists

  /api/correlations/resume:
    post:
      operationId: resumeCorrelation
      summary: Resume a paused correlation directly
      description: >
        Directly resume a paused workflow by its correlation ID.
        Used by the "Resume Manually" button and Test Webhook feature.
      tags: [correlations]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [correlationId]
              properties:
                correlationId:
                  type: string
                webhookData:
                  type: object
            example:
              correlationId: "pay_4kF9xR2mNqLp"
              webhookData:
                paymentId: "pay_4kF9xR2mNqLp"
                status: "approved"
                transactionId: "txn_8mK3vP7wXjRs"
                amount: 99.99
                currency: "USD"
                cardBrand: "visa"
                last4: "4242"
                authorizationCode: "AUTH-779231"
                riskScore: 12
                processedAt: "2024-01-15T10:26:14.392Z"
                receiptUrl: "https://pay.example.com/receipts/txn_8mK3vP7wXjRs"
      responses:
        "200":
          description: Resume result
          content:
            application/json:
              schema:
                type: object
                properties:
                  resumed:
                    type: boolean
                  correlationId:
                    type: string
                  executionId:
                    type: string

  /api/correlations:
    get:
      operationId: listCorrelations
      summary: List all paused correlations
      tags: [correlations]
      responses:
        "200":
          description: List of paused correlations
          content:
            application/json:
              schema:
                type: object
                properties:
                  correlations:
                    type: array
                    items:
                      type: object
                      properties:
                        correlationId:
                          type: string
                        webhookPath:
                          type: string
                        executionId:
                          type: string
                        pausedAt:
                          type: integer
                  count:
                    type: integer

  /api/correlations/{correlationId}:
    delete:
      operationId: cancelCorrelation
      summary: Cancel a paused correlation
      tags: [correlations]
      parameters:
        - name: correlationId
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Correlation cancelled
        "404":
          description: Correlation not found

  /api/correlations/cleanup:
    post:
      operationId: cleanupCorrelations
      summary: Cleanup expired correlations
      tags: [correlations]
      responses:
        "200":
          description: Cleanup result
          content:
            application/json:
              schema:
                type: object
                properties:
                  cleaned:
                    type: integer
                  remaining:
                    type: integer

  /api/correlations/unmatched:
    get:
      operationId: getUnmatchedWebhooks
      summary: Get unmatched webhook log
      description: >
        Returns a log of webhook callbacks that did not match any paused workflow.
      tags: [diagnostics]
      responses:
        "200":
          description: Unmatched webhook list
          content:
            application/json:
              schema:
                type: object
                properties:
                  unmatched:
                    type: array
                    items:
                      type: object
                      properties:
                        path:
                          type: string
                        correlationId:
                          type: string
                        receivedAt:
                          type: integer
                  count:
                    type: integer

  /api/correlations/idempotency:
    get:
      operationId: getIdempotencyStats
      summary: Get idempotency cache stats
      tags: [diagnostics]
      responses:
        "200":
          description: Idempotency stats
          content:
            application/json:
              schema:
                type: object
                properties:
                  size:
                    type: integer

  /webhooks/callback/{path}:
    post:
      operationId: webhookCallbackPost
      summary: Webhook callback (POST)
      description: >
        Primary endpoint that external systems call to resume paused workflows.
        Extracts correlation ID from body, header, or query parameter.
      tags: [webhooks]
      parameters:
        - name: path
          in: path
          required: true
          schema:
            type: string
          description: Webhook path suffix
        - name: x-webhook-signature
          in: header
          required: false
          schema:
            type: string
          description: HMAC-SHA256 hex digest (when security enabled)
        - name: x-idempotency-key
          in: header
          required: false
          schema:
            type: string
          description: Idempotency key for deduplication
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
            example:
              paymentId: "pay_4kF9xR2mNqLp"
              status: "approved"
              transactionId: "txn_8mK3vP7wXjRs"
              amount: 99.99
              currency: "USD"
              cardBrand: "visa"
              last4: "4242"
              authorizationCode: "AUTH-779231"
              riskScore: 12
              processedAt: "2024-01-15T10:26:14.392Z"
              receiptUrl: "https://pay.example.com/receipts/txn_8mK3vP7wXjRs"
      responses:
        "200":
          description: Webhook processed — workflow resumed
          content:
            application/json:
              schema:
                type: object
                properties:
                  resumed:
                    type: boolean
                  correlationId:
                    type: string
                  executionId:
                    type: string
        "401":
          description: Signature verification failed
        "403":
          description: IP not allowed
        "404":
          description: No matching paused workflow
        "422":
          description: Webhook filter rejected the payload
    get:
      operationId: webhookCallbackGet
      summary: Webhook callback (GET)
      description: Alternative GET endpoint for query-parameter-based callbacks.
      tags: [webhooks]
      parameters:
        - name: path
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Webhook processed
        "404":
          description: No matching paused workflow
`;
