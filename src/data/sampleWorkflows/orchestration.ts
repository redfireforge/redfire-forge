import type { Workflow } from '../../features/workflow/types/workflow';

/**
 * Sample workflow demonstrating Sub-Workflow orchestration with input/output mappings.
 * Parent: fetches users list → Sub-Workflow iterates each user (multi-instance)
 *         → Aggregate results → Condition on success rate.
 * The child workflow is a second Workflow object returned alongside the parent.
 */
export function createSubWorkflowOrchestrator(): Workflow {
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
export function createSubWorkflowChild(): Workflow {
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
export function createOrderPipelineWorkflow(): Workflow {
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
export function createShippingChildWorkflow(): Workflow {
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
export function createDeployOrchestratorWorkflow(): Workflow {
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
export function createRegionDeployChildWorkflow(): Workflow {
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
export function createRollbackChildWorkflow(): Workflow {
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
 * ★★★ Advanced: Data Aggregation Pipeline & Report Generator
 * Loops over multiple "pages" of posts, uses a Script node to transform
 * each page (extract titles + compute word counts), aggregates results,
 * then uses a second Script node in "generate" mode to build a summary
 * report and decides whether to POST it based on a threshold.
 *
 * Flow: Start → SetVariable (init) → Loop (count=3, simulates pages)
 *         ├─ Body: GET /posts?_start=N&_limit=3 → Script (transform page)
 *         │        → Aggregate (collect titles, sum wordCount)
 *         └─ Done: Script (generate report) → Condition (wordCount>100?)
 *                   ├─ Yes → POST /posts (publish report)
 *                   └─ No  → LogDebug (skip publish)
 *                     → End
 */
export function createScriptAdvancedWorkflow(): Workflow {
  return {
    id: 'sample-workflow-script-advanced',
    name: 'Script: Data Pipeline & Report',
    description: 'Loop over paginated API, Script transforms each page, Aggregate collects, Script generates a summary report.',
    variables: {},
    nodes: [
      {
        id: 'sa-start',
        type: 'start',
        position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: { pageSize: '3', totalPages: '3' } },
      },
      {
        id: 'sa-init',
        type: 'setVariable',
        position: { x: 300, y: 120 },
        data: {
          label: '1. Init Counters',
          assignments: [
            { id: 'a1', name: 'pageIndex', expression: '0' },
            { id: 'a2', name: 'allTitles', expression: '[]' },
            { id: 'a3', name: 'totalWordCount', expression: '0' },
          ],
        },
      },
      {
        id: 'sa-loop',
        type: 'loop',
        position: { x: 300, y: 260 },
        data: {
          label: '2. Page Loop',
          mode: 'count',
          count: 3,
          maxIterations: 10,
        },
      },
      {
        id: 'sa-get-page',
        type: 'http',
        position: { x: 100, y: 400 },
        data: {
          label: '2a. Fetch Page',
          scenario: {
            id: 'sa-s1',
            name: 'Get Posts Page',
            url: 'https://jsonplaceholder.typicode.com/posts?_start={{pageIndex}}&_limit={{pageSize}}',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'pageJson', source: 'body', expression: '$' },
            ],
          },
        },
      },
      {
        id: 'sa-script-transform',
        type: 'script',
        position: { x: 100, y: 560 },
        data: {
          label: '2b. Transform Page',
          code: [
            '// Parse the page of posts and extract titles + word counts',
            'const posts = JSON.parse(input.pageJson);',
            'const currentPage = parseInt(input.pageIndex) || 0;',
            'const pageSize = parseInt(input.pageSize) || 3;',
            '',
            'const titles = posts.map(function(p) { return p.title; });',
            'let wordCount = 0;',
            'for (const p of posts) {',
            '  wordCount += p.body.split(/\\s+/).length;',
            '}',
            '',
            'output.pageTitles = JSON.stringify(titles);',
            'output.pageWordCount = String(wordCount);',
            'output.pageIndex = String(currentPage + pageSize);',
            '',
            'console.log("Page " + (currentPage / pageSize + 1) + ": " + posts.length + " posts, " + wordCount + " words");',
          ].join('\n'),
          mode: 'transform',
          inputVariables: ['pageJson', 'pageIndex', 'pageSize'],
          outputVariables: ['pageTitles', 'pageWordCount', 'pageIndex'],
          timeoutMs: 5000,
          captureConsole: true,
        },
      },
      {
        id: 'sa-aggregate',
        type: 'aggregate',
        position: { x: 100, y: 720 },
        data: {
          label: '2c. Collect Results',
          mappings: [
            {
              id: 'ag1',
              sourceExpression: '{{pageTitles}}',
              targetVariable: 'allTitles',
              strategy: 'concat',
            },
            {
              id: 'ag2',
              sourceExpression: '{{pageWordCount}}',
              targetVariable: 'totalWordCount',
              strategy: 'sum',
            },
          ],
        },
      },
      {
        id: 'sa-script-report',
        type: 'script',
        position: { x: 500, y: 400 },
        data: {
          label: '3. Generate Report',
          code: [
            '// Build a summary report from aggregated data',
            'let titles;',
            'try { titles = JSON.parse(input.allTitles); } catch(e) { titles = []; }',
            'const wordCount = parseInt(input.totalWordCount) || 0;',
            '',
            'const report = {',
            '  generatedAt: new Date().toISOString(),',
            '  totalPosts: titles.length,',
            '  totalWordCount: wordCount,',
            '  avgWordsPerPost: titles.length > 0 ? Math.round(wordCount / titles.length) : 0,',
            '  topTitles: titles.slice(0, 5),',
            '};',
            '',
            'output.reportJson = JSON.stringify(report, null, 2);',
            'output.postCount = String(report.totalPosts);',
            'output.wordCount = String(report.totalWordCount);',
            '',
            'console.log("Report: " + report.totalPosts + " posts, " + report.totalWordCount + " words");',
            'console.log("Avg: " + report.avgWordsPerPost + " words/post");',
          ].join('\n'),
          mode: 'generate',
          inputVariables: ['allTitles', 'totalWordCount'],
          outputVariables: ['reportJson', 'postCount', 'wordCount'],
          timeoutMs: 5000,
          captureConsole: true,
        },
      },
      {
        id: 'sa-check-threshold',
        type: 'condition',
        position: { x: 500, y: 570 },
        data: {
          label: '4. Worth Publishing?',
          left: '{{wordCount}}',
          operator: '>',
          right: '100',
        },
      },
      {
        id: 'sa-publish',
        type: 'http',
        position: { x: 350, y: 720 },
        data: {
          label: '5a. Publish Report',
          scenario: {
            id: 'sa-s2',
            name: 'Publish Report',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: '{{reportJson}}',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
      {
        id: 'sa-skip-log',
        type: 'logDebug',
        position: { x: 650, y: 720 },
        data: {
          label: '5b. Skip — Too Short',
          message: 'Report has only {{wordCount}} words (threshold: 100). Skipping publish.',
          logLevel: 'warn',
          snapshotVariables: false,
        },
      },
      {
        id: 'sa-end',
        type: 'end',
        position: { x: 500, y: 870 },
        data: { label: 'Done' },
      },
    ],
    edges: [
      { id: 'sa-e1', source: 'sa-start', target: 'sa-init' },
      { id: 'sa-e2', source: 'sa-init', target: 'sa-loop' },
      { id: 'sa-e3', source: 'sa-loop', target: 'sa-get-page', sourceHandle: 'body' },
      { id: 'sa-e4', source: 'sa-get-page', target: 'sa-script-transform' },
      { id: 'sa-e5', source: 'sa-script-transform', target: 'sa-aggregate' },
      { id: 'sa-e6', source: 'sa-loop', target: 'sa-script-report', sourceHandle: 'done' },
      { id: 'sa-e7', source: 'sa-script-report', target: 'sa-check-threshold' },
      { id: 'sa-e8', source: 'sa-check-threshold', target: 'sa-publish', sourceHandle: 'true' },
      { id: 'sa-e9', source: 'sa-check-threshold', target: 'sa-skip-log', sourceHandle: 'false' },
      { id: 'sa-e10', source: 'sa-publish', target: 'sa-end' },
      { id: 'sa-e11', source: 'sa-skip-log', target: 'sa-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
