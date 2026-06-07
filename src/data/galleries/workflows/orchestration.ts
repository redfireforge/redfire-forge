import type { Workflow } from '../../../features/workflow/types/workflow';
import {
  makeStartNode, makeEndNode, makePostNode, makeSetVariableNode,
  makeLogDebugNode, makeForkNode, makeJoinNode, makeEdge, bodyExtraction,
} from './nodeFactories';

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
      makeStartNode('swf-start', { apiBase: 'https://jsonplaceholder.typicode.com' }),
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
              bodyExtraction('usersJson', ''),
              bodyExtraction('userCount', '$.length'),
            ],
          },
        },
      },
      makeSetVariableNode('swf-set-ids', '2. Extract User IDs', [
        { id: 'a1', name: 'userIds', expression: '[1,2,3]' },
        { id: 'a2', name: 'processedCount', expression: '0' },
      ], { x: 250, y: 280 }),
      {
        id: 'swf-sub', type: 'subWorkflow', position: { x: 250, y: 440 },
        data: {
          label: '3. Process Each User',
          workflowId: CHILD_ID,
          workflowName: 'User Processor',
          inputMappings: [{ sourceExpression: '{{apiBase}}', targetVariable: 'apiBase' }],
          outputMappings: [{ sourceVariable: 'userStatus', targetVariable: 'lastUserStatus' }],
          propagateAllOutputs: false,
          multiInstance: { collection: '{{userIds}}', elementVariable: 'userId', mode: 'sequential' },
          maxDepth: 5,
          timeoutMs: 30000,
          retryCount: 1,
          retryDelayMs: 2000,
          onChildFailure: 'continue',
        },
      },
      {
        id: 'swf-log', type: 'logDebug', position: { x: 250, y: 600 },
        data: { label: '4. Log Results', logLevel: 'info', message: 'Sub-workflow completed. Last status: {{lastUserStatus}}', snapshotVariables: true },
      },
      {
        id: 'swf-cond', type: 'condition', position: { x: 300, y: 740 },
        data: { label: '5. All Succeeded?', left: '{{__subWorkflowFailed}}', operator: '!=', right: 'true' },
      },
      makeLogDebugNode('swf-log-ok', 'All Good', 'All users processed successfully', 'info', { x: 100, y: 880 }),
      {
        id: 'swf-log-fail', type: 'logDebug', position: { x: 480, y: 880 },
        data: { label: 'Partial Failure', logLevel: 'warn', message: 'Some user processing failed. Check __subWorkflowResults.', snapshotVariables: true },
      },
      makeEndNode('swf-end', 'End', { x: 300, y: 1020 }),
    ],
    edges: [
      makeEdge('swf-e1', 'swf-start', 'swf-fetch-users'),
      makeEdge('swf-e2', 'swf-fetch-users', 'swf-set-ids'),
      makeEdge('swf-e3', 'swf-set-ids', 'swf-sub'),
      makeEdge('swf-e4', 'swf-sub', 'swf-log'),
      makeEdge('swf-e5', 'swf-log', 'swf-cond'),
      { id: 'swf-e6', source: 'swf-cond', target: 'swf-log-ok', sourceHandle: 'true', label: 'Yes' },
      { id: 'swf-e7', source: 'swf-cond', target: 'swf-log-fail', sourceHandle: 'false', label: 'No' },
      makeEdge('swf-e8', 'swf-log-ok', 'swf-end'),
      makeEdge('swf-e9', 'swf-log-fail', 'swf-end'),
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
      makeStartNode('child-start', { apiBase: 'https://jsonplaceholder.typicode.com', userId: '1' }),
      {
        id: 'child-fetch', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: 'Fetch User',
          scenario: {
            id: 'child-s1', name: 'Get User',
            url: '{{apiBase}}/users/{{userId}}',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [bodyExtraction('userName', '$.name'), bodyExtraction('userEmail', '$.email')],
          },
        },
      },
      makeSetVariableNode('child-set', 'Build Status', [{ id: 'c1', name: 'userStatus', expression: 'processed:{{userName}}' }], { x: 250, y: 280 }),
      makeEndNode('child-end', 'End', { x: 300, y: 400 }),
    ],
    edges: [
      makeEdge('child-e1', 'child-start', 'child-fetch'),
      makeEdge('child-e2', 'child-fetch', 'child-set'),
      makeEdge('child-e3', 'child-set', 'child-end'),
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
      makeStartNode('op-start', { orderId: '12345', shippingType: 'express' }),
      {
        id: 'op-fetch', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: '1. Fetch Order',
          scenario: {
            id: 'op-s1', name: 'Get Order',
            url: 'https://jsonplaceholder.typicode.com/posts/{{orderId}}',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [bodyExtraction('orderTitle', '$.title'), bodyExtraction('orderBody', '$.body')],
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
          outputMappings: [{ sourceVariable: 'trackingNumber', targetVariable: 'trackingNumber' }],
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
          outputMappings: [{ sourceVariable: 'trackingNumber', targetVariable: 'trackingNumber' }],
          timeoutMs: 30000,
        },
      },
      makeSetVariableNode('op-confirm', '4. Build Confirmation', [
        { id: 'a1', name: 'confirmation', expression: 'Order {{orderId}} shipped via {{shippingType}}. Tracking: {{trackingNumber}}' },
      ], { x: 250, y: 600 }),
      {
        id: 'op-log', type: 'logDebug', position: { x: 250, y: 740 },
        data: { label: '5. Log', logLevel: 'info', message: '{{confirmation}}', snapshotVariables: true },
      },
      makeEndNode('op-end', 'End', { x: 300, y: 860 }),
    ],
    edges: [
      makeEdge('op-e1', 'op-start', 'op-fetch'),
      makeEdge('op-e2', 'op-fetch', 'op-cond'),
      { id: 'op-e3', source: 'op-cond', target: 'op-sub-express', sourceHandle: 'true', label: 'Express' },
      { id: 'op-e4', source: 'op-cond', target: 'op-sub-standard', sourceHandle: 'false', label: 'Standard' },
      makeEdge('op-e5', 'op-sub-express', 'op-confirm'),
      makeEdge('op-e6', 'op-sub-standard', 'op-confirm'),
      makeEdge('op-e7', 'op-confirm', 'op-log'),
      makeEdge('op-e8', 'op-log', 'op-end'),
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
      makeStartNode('ship-start', { orderId: '1', tier: 'standard' }),
      makePostNode('ship-http', 'Ship Order', 'https://jsonplaceholder.typicode.com/posts',
        '{"orderId": "{{orderId}}", "tier": "{{tier}}"}',
        { x: 250, y: 120, extractions: [bodyExtraction('shipmentId', '$.id')] }),
      makeSetVariableNode('ship-set', 'Build Tracking', [
        { id: 's1', name: 'trackingNumber', expression: 'TRK-{{tier}}-{{shipmentId}}' },
      ], { x: 250, y: 280 }),
      makeEndNode('ship-end', 'End', { x: 300, y: 400 }),
    ],
    edges: [
      makeEdge('ship-e1', 'ship-start', 'ship-http'),
      makeEdge('ship-e2', 'ship-http', 'ship-set'),
      makeEdge('ship-e3', 'ship-set', 'ship-end'),
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
      makeStartNode('dep-start', {
        version: 'v2.5.0',
        regions: '["us-east-1","eu-west-1","ap-southeast-1"]',
        rollbackWorkflowId: 'sample-rollback-child',
        successThreshold: '80',
      }),
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
            extractions: [bodyExtraction('buildTitle', '$.title')],
          },
        },
      },
      makeForkNode('dep-fork', '2. Pre-Check Fork', { x: 300, y: 280 }),
      {
        id: 'dep-smoke', type: 'http', position: { x: 100, y: 400 },
        data: {
          label: '2a. Smoke Test',
          scenario: {
            id: 'dep-s2', name: 'Smoke',
            url: 'https://jsonplaceholder.typicode.com/posts/2',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [bodyExtraction('smokeResult', '$.title')],
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
            extractions: [bodyExtraction('flagsResult', '$.title')],
          },
        },
      },
      makeJoinNode('dep-join', '2c. Pre-Check Join', { x: 300, y: 540 }),
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
          multiInstance: { collection: '{{regions}}', elementVariable: 'region', mode: 'parallel' },
          maxDepth: 5,
          timeoutMs: 60000,
          retryCount: 1,
          retryDelayMs: 5000,
          onChildFailure: 'continue',
        },
      },
      makeSetVariableNode('dep-analyze', '4. Analyze Results', [
        { id: 'a1', name: 'deployStatus', expression: '{{__subWorkflowFailed}}' },
      ], { x: 250, y: 840 }),
      {
        id: 'dep-cond', type: 'condition', position: { x: 300, y: 960 },
        data: { label: '5. All Succeeded?', left: '{{deployStatus}}', operator: '!=', right: 'true' },
      },
      makeLogDebugNode('dep-log-ok', 'Deploy Success', '✅ {{version}} deployed to all regions', 'info', { x: 80, y: 1100, snapshotVariables: true }),
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
          outputMappings: [{ sourceVariable: 'rollbackStatus', targetVariable: 'rollbackStatus' }],
          maxDepth: 5,
          timeoutMs: 120000,
          retryCount: 2,
          retryDelayMs: 10000,
          onChildFailure: 'continue',
        },
      },
      makeEndNode('dep-end', 'End', { x: 300, y: 1260 }),
    ],
    edges: [
      makeEdge('dep-e1', 'dep-start', 'dep-validate'),
      makeEdge('dep-e2', 'dep-validate', 'dep-fork'),
      makeEdge('dep-e3', 'dep-fork', 'dep-smoke'),
      makeEdge('dep-e4', 'dep-fork', 'dep-flags'),
      makeEdge('dep-e5', 'dep-smoke', 'dep-join'),
      makeEdge('dep-e6', 'dep-flags', 'dep-join'),
      makeEdge('dep-e7', 'dep-join', 'dep-deploy'),
      makeEdge('dep-e8', 'dep-deploy', 'dep-analyze'),
      makeEdge('dep-e9', 'dep-analyze', 'dep-cond'),
      { id: 'dep-e10', source: 'dep-cond', target: 'dep-log-ok', sourceHandle: 'true', label: 'All OK' },
      { id: 'dep-e11', source: 'dep-cond', target: 'dep-rollback', sourceHandle: 'false', label: 'Failed' },
      makeEdge('dep-e12', 'dep-log-ok', 'dep-end'),
      makeEdge('dep-e13', 'dep-rollback', 'dep-end'),
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
      makeStartNode('rd-start', { region: 'us-east-1', version: 'v1.0', buildInfo: '' }),
      makePostNode('rd-deploy', 'Deploy to {{region}}', 'https://jsonplaceholder.typicode.com/posts',
        '{"region": "{{region}}", "version": "{{version}}"}',
        { x: 250, y: 120, extractions: [bodyExtraction('deployId', '$.id')] }),
      makeSetVariableNode('rd-set', 'Set Status', [
        { id: 'r1', name: 'regionStatus', expression: '{{region}}:deployed:{{deployId}}' },
      ], { x: 250, y: 280 }),
      makeEndNode('rd-end', 'End', { x: 300, y: 400 }),
    ],
    edges: [
      makeEdge('rd-e1', 'rd-start', 'rd-deploy'),
      makeEdge('rd-e2', 'rd-deploy', 'rd-set'),
      makeEdge('rd-e3', 'rd-set', 'rd-end'),
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
      makeStartNode('rb-start', { version: 'v1.0', regions: '[]' }),
      makeLogDebugNode('rb-log', 'Log Rollback', '⚠ Rolling back {{version}} across regions: {{regions}}', 'warn', { x: 250, y: 120, snapshotVariables: true }),
      makePostNode('rb-http', 'Execute Rollback', 'https://jsonplaceholder.typicode.com/posts',
        '{"action": "rollback", "version": "{{version}}"}',
        { x: 250, y: 260, extractions: [bodyExtraction('rollbackId', '$.id')] }),
      makeSetVariableNode('rb-set', 'Set Status', [
        { id: 'rb1', name: 'rollbackStatus', expression: 'rolled-back:{{rollbackId}}' },
      ], { x: 250, y: 400 }),
      makeEndNode('rb-end', 'End', { x: 300, y: 520 }),
    ],
    edges: [
      makeEdge('rb-e1', 'rb-start', 'rb-log'),
      makeEdge('rb-e2', 'rb-log', 'rb-http'),
      makeEdge('rb-e3', 'rb-http', 'rb-set'),
      makeEdge('rb-e4', 'rb-set', 'rb-end'),
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
      makeStartNode('sa-start', { pageSize: '3', totalPages: '3' }),
      makeSetVariableNode('sa-init', '1. Init Counters', [
        { id: 'a1', name: 'pageIndex', expression: '0' },
        { id: 'a2', name: 'allTitles', expression: '[]' },
        { id: 'a3', name: 'totalWordCount', expression: '0' },
      ], { x: 300, y: 120 }),
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
            extractions: [bodyExtraction('pageJson', '$')],
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
      makePostNode('sa-publish', '5a. Publish Report', 'https://jsonplaceholder.typicode.com/posts', '{{reportJson}}', { x: 350, y: 720 }),
      makeLogDebugNode('sa-skip-log', '5b. Skip — Too Short', 'Report has only {{wordCount}} words (threshold: 100). Skipping publish.', 'warn', { x: 650, y: 720 }),
      makeEndNode('sa-end', 'Done', { x: 500, y: 870 }),
    ],
    edges: [
      makeEdge('sa-e1', 'sa-start', 'sa-init'),
      makeEdge('sa-e2', 'sa-init', 'sa-loop'),
      { id: 'sa-e3', source: 'sa-loop', target: 'sa-get-page', sourceHandle: 'body' },
      makeEdge('sa-e4', 'sa-get-page', 'sa-script-transform'),
      makeEdge('sa-e5', 'sa-script-transform', 'sa-aggregate'),
      { id: 'sa-e6', source: 'sa-loop', target: 'sa-script-report', sourceHandle: 'done' },
      makeEdge('sa-e7', 'sa-script-report', 'sa-check-threshold'),
      { id: 'sa-e8', source: 'sa-check-threshold', target: 'sa-publish', sourceHandle: 'true' },
      { id: 'sa-e9', source: 'sa-check-threshold', target: 'sa-skip-log', sourceHandle: 'false' },
      makeEdge('sa-e10', 'sa-publish', 'sa-end'),
      makeEdge('sa-e11', 'sa-skip-log', 'sa-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
