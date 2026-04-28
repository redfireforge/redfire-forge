/**
 * Sample OpenAPI specifications for the API Catalog Gallery.
 * Users can import these as starting-point references.
 */

// ─── Types ───────────────────────────────────────────────

export type SampleCatalogCategory = 'webhooks' | 'rest-api' | 'microservices';

export interface SampleCatalogEntry {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: SampleCatalogCategory;
  endpointCount: number;
  specYaml: string;
}

export const SAMPLE_CATALOG_CATEGORIES: { key: SampleCatalogCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'rest-api', label: 'REST API' },
  { key: 'microservices', label: 'Microservices' },
];

// ─── Sample Specs ────────────────────────────────────────

const CORRELATION_WAIT_API_SPEC = `openapi: "3.0.3"
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

const PET_STORE_API_SPEC = `openapi: "3.0.3"
info:
  title: Pet Store API
  version: "1.0.0"
  description: >
    Classic sample REST API for managing pets, orders, and users.
    Demonstrates CRUD operations, tags, pagination, and authentication.

servers:
  - url: https://api.petstore.example.com/v1
    description: Production
  - url: https://staging.petstore.example.com/v1
    description: Staging

tags:
  - name: pets
    description: Pet CRUD operations
  - name: orders
    description: Store order management
  - name: users
    description: User management and authentication

paths:
  /pets:
    get:
      operationId: listPets
      summary: List all pets
      description: Returns a paginated list of pets with optional filtering.
      tags: [pets]
      parameters:
        - name: limit
          in: query
          required: false
          schema:
            type: integer
            default: 20
            maximum: 100
          description: Maximum number of results
        - name: offset
          in: query
          required: false
          schema:
            type: integer
            default: 0
        - name: status
          in: query
          required: false
          schema:
            type: string
            enum: [available, pending, sold]
        - name: tag
          in: query
          required: false
          schema:
            type: string
      responses:
        "200":
          description: A list of pets
          content:
            application/json:
              schema:
                type: object
                properties:
                  pets:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: integer
                        name:
                          type: string
                        status:
                          type: string
                        tags:
                          type: array
                          items:
                            type: string
                  total:
                    type: integer
    post:
      operationId: createPet
      summary: Create a new pet
      tags: [pets]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name:
                  type: string
                category:
                  type: string
                status:
                  type: string
                  enum: [available, pending, sold]
                tags:
                  type: array
                  items:
                    type: string
            example:
              name: "Buddy"
              category: "dog"
              status: "available"
              tags: ["friendly", "trained"]
      responses:
        "201":
          description: Pet created
        "400":
          description: Invalid input

  /pets/{petId}:
    get:
      operationId: getPetById
      summary: Get pet by ID
      tags: [pets]
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Pet details
        "404":
          description: Pet not found
    put:
      operationId: updatePet
      summary: Update an existing pet
      tags: [pets]
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                status:
                  type: string
                  enum: [available, pending, sold]
      responses:
        "200":
          description: Pet updated
        "404":
          description: Pet not found
    delete:
      operationId: deletePet
      summary: Delete a pet
      tags: [pets]
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: integer
      responses:
        "204":
          description: Pet deleted
        "404":
          description: Pet not found

  /pets/{petId}/images:
    post:
      operationId: uploadPetImage
      summary: Upload a pet image
      tags: [pets]
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: true
        content:
          application/octet-stream:
            schema:
              type: string
              format: binary
      responses:
        "200":
          description: Image uploaded

  /orders:
    get:
      operationId: listOrders
      summary: List store orders
      tags: [orders]
      responses:
        "200":
          description: List of orders
    post:
      operationId: placeOrder
      summary: Place a new order
      tags: [orders]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [petId, quantity]
              properties:
                petId:
                  type: integer
                quantity:
                  type: integer
                shipDate:
                  type: string
                  format: date-time
            example:
              petId: 42
              quantity: 1
      responses:
        "201":
          description: Order placed
        "400":
          description: Invalid order

  /orders/{orderId}:
    get:
      operationId: getOrderById
      summary: Get order by ID
      tags: [orders]
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: integer
      responses:
        "200":
          description: Order details
        "404":
          description: Order not found
    delete:
      operationId: cancelOrder
      summary: Cancel an order
      tags: [orders]
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: integer
      responses:
        "204":
          description: Order cancelled

  /users:
    post:
      operationId: createUser
      summary: Create user
      tags: [users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, email]
              properties:
                username:
                  type: string
                email:
                  type: string
                  format: email
                password:
                  type: string
                  format: password
      responses:
        "201":
          description: User created

  /users/login:
    post:
      operationId: loginUser
      summary: Log in
      tags: [users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [username, password]
              properties:
                username:
                  type: string
                password:
                  type: string
                  format: password
      responses:
        "200":
          description: Login successful
        "401":
          description: Invalid credentials

  /users/{username}:
    get:
      operationId: getUserByName
      summary: Get user by username
      tags: [users]
      parameters:
        - name: username
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: User info
        "404":
          description: User not found

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    apiKeyAuth:
      type: apiKey
      name: X-API-Key
      in: header
`;

// ─── Catalog ─────────────────────────────────────────────

export const sampleCatalogSpecs: SampleCatalogEntry[] = [
  {
    id: 'sample-catalog-correlation-wait',
    name: 'Correlation Wait API',
    description: 'Webhook correlation endpoints — pause workflows, receive callbacks, manage async operations.',
    icon: '🔗',
    category: 'webhooks',
    endpointCount: 9,
    specYaml: CORRELATION_WAIT_API_SPEC,
  },
  {
    id: 'sample-catalog-pet-store',
    name: 'Pet Store API',
    description: 'Classic REST API example — CRUD for pets, orders, and users with pagination and auth.',
    icon: '🐾',
    category: 'rest-api',
    endpointCount: 13,
    specYaml: PET_STORE_API_SPEC,
  },
];
