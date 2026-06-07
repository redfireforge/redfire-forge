import type { Workflow } from '../../../features/workflow/types/workflow';
import {
  makeStartNode,
  makeEndNode,
  makeGetNode,
  makePostNode,
  makeSetVariableNode,
  makeLogDebugNode,
  makeConditionNode,
  makeForkNode,
  makeJoinNode,
  makeEdge,
  jsonBody,
  bodyExtraction,
} from './nodeFactories';

/**
 * Sample workflow demonstrating conditional branching with Yes/No paths.
 * Uses jsonplaceholder.typicode.com for real API responses.
 * Flow: Start → Get User → If found (200)? → Yes: Get Posts, No: Create User
 */
export function createConditionalBranchWorkflow(): Workflow {
  return {
    id: 'sample-workflow-branching',
    name: 'Sample: Conditional Branching',
    description: 'Demonstrates If/Else branching with different API paths based on conditions.',
    variables: {},
    nodes: [
      makeStartNode('sb-start', {}, { x: 250, y: 0 }),
      makeGetNode('sb-check', '1. Get User', 'https://jsonplaceholder.typicode.com/users/1', {
        x: 200,
        y: 100,
        extractions: [
          bodyExtraction('userName', '$.name'),
          { name: 'httpStatus', source: 'status', expression: '' },
        ],
      }),
      makeConditionNode('sb-cond', '2. User Found?', '{{httpStatus}}', '200', {
        x: 240,
        y: 250,
      }),
      makeGetNode('sb-profile', '3a. Get User Posts', 'https://jsonplaceholder.typicode.com/users/1/posts', {
        x: 50,
        y: 380,
        extractions: [bodyExtraction('firstPostTitle', '$[0].title')],
      }),
      makePostNode(
        'sb-create',
        '3b. Create User',
        'https://jsonplaceholder.typicode.com/users',
        jsonBody({ name: 'New User', username: 'newuser', email: 'new@example.com' }),
        { x: 350, y: 380 },
      ),
    ],
    edges: [
      makeEdge('sb-e0', 'sb-start', 'sb-check'),
      makeEdge('sb-e1', 'sb-check', 'sb-cond'),
      { id: 'sb-e2', source: 'sb-cond', target: 'sb-profile', sourceHandle: 'true', label: 'Yes' },
      { id: 'sb-e3', source: 'sb-cond', target: 'sb-create', sourceHandle: 'false', label: 'No' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample: Switch-based order routing.
 * Start → HTTP (fetch order) → Switch on orderType (standard / express / gift / default) → End
 */
export function createSwitchRoutingWorkflow(): Workflow {
  return {
    id: 'sample-workflow-switch',
    name: 'Sample: Switch Order Router',
    description: 'Routes orders through different processing paths based on order type using a Switch node.',
    variables: {},
    nodes: [
      makeStartNode('sw-start'),
      {
        id: 'sw-fetch', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: 'Fetch Order', scenario: {
            id: 'sw-s1', name: 'Fetch Order', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET',
            headers: [], body: '', bodyType: 'none', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              bodyExtraction('orderType', '$.userId'),
              bodyExtraction('orderTitle', '$.title'),
            ],
          },
        },
      },
      {
        id: 'sw-switch', type: 'switch', position: { x: 280, y: 280 },
        data: {
          label: 'Route by Type', expression: '{{orderType}}',
          cases: [
            { id: 'c1', value: '1', label: 'Standard' },
            { id: 'c2', value: '2', label: 'Express' },
            { id: 'c3', value: '3', label: 'Gift' },
          ],
        },
      },
      makePostNode('sw-standard', 'Standard Processing', 'https://jsonplaceholder.typicode.com/posts', '{"type":"standard","order":"{{orderTitle}}"}', { x: 50, y: 450 }),
      makePostNode('sw-express', 'Express Processing', 'https://jsonplaceholder.typicode.com/posts', '{"type":"express","priority":"high","order":"{{orderTitle}}"}', { x: 280, y: 450 }),
      makePostNode('sw-gift', 'Gift Processing', 'https://jsonplaceholder.typicode.com/posts', '{"type":"gift","wrapping":true,"order":"{{orderTitle}}"}', { x: 510, y: 450 }),
      makePostNode('sw-default', 'Default Handler', 'https://jsonplaceholder.typicode.com/posts', '{"type":"unknown","order":"{{orderTitle}}"}', { x: 740, y: 450 }),
      makeEndNode('sw-end', 'Done', { x: 350, y: 620 }),
    ],
    edges: [
      makeEdge('sw-e1', 'sw-start', 'sw-fetch'),
      makeEdge('sw-e2', 'sw-fetch', 'sw-switch'),
      { id: 'sw-e3', source: 'sw-switch', target: 'sw-standard', sourceHandle: 'case-c1' },
      { id: 'sw-e4', source: 'sw-switch', target: 'sw-express', sourceHandle: 'case-c2' },
      { id: 'sw-e5', source: 'sw-switch', target: 'sw-gift', sourceHandle: 'case-c3' },
      { id: 'sw-e6', source: 'sw-switch', target: 'sw-default', sourceHandle: 'default' },
      makeEdge('sw-e7', 'sw-standard', 'sw-end'),
      makeEdge('sw-e8', 'sw-express', 'sw-end'),
      makeEdge('sw-e9', 'sw-gift', 'sw-end'),
      makeEdge('sw-e10', 'sw-default', 'sw-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample: Loop + Aggregate paginated API fetcher.
 * Start → SetVariable (init) → Loop (while hasMore) → HTTP (page) → Aggregate (concat items, sum totals)
 *       → SetVariable (next page) → done → Condition → End
 */
export function createLoopAggregateWorkflow(): Workflow {
  return {
    id: 'sample-workflow-loop-agg',
    name: 'Sample: Paginated API Fetcher',
    description: 'Fetches pages of data in a while-loop, aggregates results with concat/sum/count, then checks totals.',
    variables: {},
    nodes: [
      makeStartNode('la-start'),
      makeSetVariableNode('la-init', 'Init Variables', [
        { id: 'a1', name: 'page', expression: '1' },
        { id: 'a2', name: 'hasMore', expression: 'true' },
        { id: 'a3', name: 'allItems', expression: '[]' },
        { id: 'a4', name: 'totalCount', expression: '0' },
      ], { x: 260, y: 120 }),
      {
        id: 'la-loop', type: 'loop', position: { x: 280, y: 260 },
        data: {
          label: 'Fetch Pages', mode: 'while' as const,
          whileLeft: '{{hasMore}}', whileOperator: '==' as const, whileRight: 'true',
          maxIterations: 10,
        },
      },
      {
        id: 'la-fetch', type: 'http', position: { x: 240, y: 400 },
        data: {
          label: 'GET Page', scenario: {
            id: 'la-s1', name: 'Fetch Page', url: 'https://jsonplaceholder.typicode.com/posts?_page=1&_limit=10', method: 'GET',
            headers: [], body: '', bodyType: 'none', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              bodyExtraction('pageItems', '$'),
              bodyExtraction('itemCount', '$.length'),
            ],
          },
        },
      },
      {
        id: 'la-agg', type: 'aggregate', position: { x: 240, y: 560 },
        data: {
          label: 'Accumulate',
          mappings: [
            { id: 'm1', sourceExpression: '{{pageItems}}', targetVariable: 'allItems', strategy: 'concat' as const },
            { id: 'm2', sourceExpression: '{{itemCount}}', targetVariable: 'totalCount', strategy: 'sum' as const },
          ],
        },
      },
      makeSetVariableNode('la-next', 'Next Page', [
        { id: 'a1', name: 'page', expression: '{{page}}' },
        { id: 'a2', name: 'hasMore', expression: '{{itemCount}}' },
      ], { x: 240, y: 700 }),
      makeConditionNode('la-check', 'Many Items?', '{{totalCount}}', '50', { operator: '>', x: 260, y: 880 }),
      makePostNode('la-alert', 'Send Alert', 'https://jsonplaceholder.typicode.com/posts', '{"alert":"Large dataset: {{totalCount}} items fetched"}', { x: 60, y: 1030 }),
      makeEndNode('la-end', 'Complete', { x: 300, y: 1180 }),
    ],
    edges: [
      makeEdge('la-e1', 'la-start', 'la-init'),
      makeEdge('la-e2', 'la-init', 'la-loop'),
      { id: 'la-e3', source: 'la-loop', target: 'la-fetch', sourceHandle: 'body' },
      makeEdge('la-e4', 'la-fetch', 'la-agg'),
      makeEdge('la-e5', 'la-agg', 'la-next'),
      { id: 'la-e6', source: 'la-loop', target: 'la-check', sourceHandle: 'done' },
      { id: 'la-e7', source: 'la-check', target: 'la-alert', sourceHandle: 'true' },
      { id: 'la-e8', source: 'la-check', target: 'la-end', sourceHandle: 'false' },
      makeEdge('la-e9', 'la-alert', 'la-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample: Batch user provisioning — forEach loop with success/failure tracking.
 * Start → SetVariable (init) → Loop (forEach user) → HTTP (create) → Condition (201?)
 *       → Aggregate (success) / Aggregate (failure) → done → Switch (results) → End
 */
export function createBatchProvisioningWorkflow(): Workflow {
  return {
    id: 'sample-workflow-batch',
    name: 'Sample: Batch User Provisioning',
    description: 'Creates users from a list, tracks successes/failures with aggregation, then routes the result via Switch.',
    variables: {},
    nodes: [
      makeStartNode('bp-start', {
        users: '[{"title":"Alice task","body":"Provision Alice","userId":1},{"title":"Bob task","body":"Provision Bob","userId":2},{"title":"Carol task","body":"Provision Carol","userId":3}]',
      }),
      makeSetVariableNode('bp-init', 'Init Trackers', [
        { id: 'a1', name: 'successCount', expression: '0' },
        { id: 'a2', name: 'failCount', expression: '0' },
        { id: 'a3', name: 'createdIds', expression: '[]' },
      ], { x: 260, y: 130 }),
      {
        id: 'bp-loop', type: 'loop', position: { x: 280, y: 270 },
        data: {
          label: 'Each User', mode: 'forEach' as const,
          sourceExpression: '{{users}}', itemVariable: 'user', indexVariable: 'userIndex',
          maxIterations: 50,
        },
      },
      makePostNode('bp-create', 'Create User', 'https://jsonplaceholder.typicode.com/users', '{{user}}', {
        x: 240,
        y: 410,
        extractions: [
          { name: 'createStatus', source: 'status', expression: '' },
          bodyExtraction('userId', '$.id'),
        ],
      }),
      makeConditionNode('bp-check', 'Created?', '{{createStatus}}', '201', { x: 260, y: 570 }),
      {
        id: 'bp-agg-ok', type: 'aggregate', position: { x: 80, y: 720 },
        data: {
          label: 'Track Success',
          mappings: [
            { id: 'm1', sourceExpression: '{{userId}}', targetVariable: 'createdIds', strategy: 'concat' as const },
            { id: 'm2', sourceExpression: '1', targetVariable: 'successCount', strategy: 'count' as const },
          ],
        },
      },
      {
        id: 'bp-agg-fail', type: 'aggregate', position: { x: 440, y: 720 },
        data: {
          label: 'Track Failure',
          mappings: [
            { id: 'm1', sourceExpression: '1', targetVariable: 'failCount', strategy: 'count' as const },
          ],
        },
      },
      makeSetVariableNode('bp-summary', 'Build Summary', [
        { id: 'a1', name: 'resultType', expression: '{{failCount}}' },
        { id: 'a2', name: 'summary', expression: 'Created {{successCount}} users ({{failCount}} failed)' },
      ], { x: 240, y: 920 }),
      {
        id: 'bp-switch', type: 'switch', position: { x: 260, y: 1060 },
        data: {
          label: 'Result Router', expression: '{{resultType}}',
          cases: [
            { id: 'rc1', value: '0', label: 'All OK' },
          ],
        },
      },
      makePostNode('bp-report-ok', 'Success Report', 'https://jsonplaceholder.typicode.com/posts', '{"title":"Batch Report","body":"{{summary}}","userId":1}', { x: 80, y: 1230 }),
      makePostNode('bp-report-partial', 'Partial Report', 'https://jsonplaceholder.typicode.com/posts', '{"title":"Batch Report (Partial)","body":"{{summary}}","userId":1}', { x: 440, y: 1230 }),
      makeEndNode('bp-end', 'Done', { x: 280, y: 1400 }),
    ],
    edges: [
      makeEdge('bp-e1', 'bp-start', 'bp-init'),
      makeEdge('bp-e2', 'bp-init', 'bp-loop'),
      { id: 'bp-e3', source: 'bp-loop', target: 'bp-create', sourceHandle: 'body' },
      makeEdge('bp-e4', 'bp-create', 'bp-check'),
      { id: 'bp-e5', source: 'bp-check', target: 'bp-agg-ok', sourceHandle: 'true' },
      { id: 'bp-e6', source: 'bp-check', target: 'bp-agg-fail', sourceHandle: 'false' },
      { id: 'bp-e7', source: 'bp-loop', target: 'bp-summary', sourceHandle: 'done' },
      makeEdge('bp-e8', 'bp-summary', 'bp-switch'),
      { id: 'bp-e9', source: 'bp-switch', target: 'bp-report-ok', sourceHandle: 'case-rc1' },
      { id: 'bp-e10', source: 'bp-switch', target: 'bp-report-partial', sourceHandle: 'default' },
      makeEdge('bp-e11', 'bp-report-ok', 'bp-end'),
      makeEdge('bp-e12', 'bp-report-partial', 'bp-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow: Resilient API call with Error Handler, Log/Debug diagnostics, and outcome branching.
 * Flow: Start → Log(begin) → ErrorHandler[ body: POST /posts → catch: Log(error) ] → done → Condition → Log(success) / Log(failure) → End
 */
export function createErrorHandlerWorkflow(): Workflow {
  return {
    id: 'sample-workflow-error-handler',
    name: 'Sample: Resilient API with Error Handling',
    description: 'Demonstrates Error Handler with retry, Log/Debug for diagnostics, and conditional outcome.',
    variables: {},
    nodes: [
      makeStartNode('eh-start', { apiKey: 'demo-key' }, { x: 250, y: 0 }),
      makeLogDebugNode('eh-log-begin', 'Log: Begin', 'Starting resilient API call with key={{apiKey}}', 'info', { x: 200, y: 100 }),
      {
        id: 'eh-guard', type: 'errorHandler', position: { x: 200, y: 240 },
        data: { label: 'API Guard', errorFilter: 'all', maxRetries: 2, retryBackoffStrategy: 'fixed', retryDelayMs: 500, failWorkflowOnError: false },
      },
      makePostNode('eh-post', 'Create Post', 'https://jsonplaceholder.typicode.com/posts', jsonBody({ title: 'Resilient Post', body: 'Created with error handling', userId: 1 }), {
        x: 50,
        y: 400,
        extractions: [bodyExtraction('postId', '$.id'), { name: 'httpStatus', source: 'status', expression: '' }],
      }),
      makeLogDebugNode('eh-log-error', 'Log: Error', 'API call failed — will retry. Status={{httpStatus}}', 'error', { x: 400, y: 400, snapshotVariables: true }),
      makeConditionNode('eh-check', 'Created OK?', '{{httpStatus}}', '201', { x: 240, y: 560 }),
      makeLogDebugNode('eh-log-ok', 'Log: Success', 'Post {{postId}} created successfully', 'info', { x: 100, y: 700 }),
      makeLogDebugNode('eh-log-fail', 'Log: Failure', 'Post creation failed with status={{httpStatus}}', 'warn', { x: 400, y: 700, snapshotVariables: true }),
      makeEndNode('eh-end', 'End', { x: 250, y: 850 }),
    ],
    edges: [
      makeEdge('eh-e1', 'eh-start', 'eh-log-begin'),
      makeEdge('eh-e2', 'eh-log-begin', 'eh-guard'),
      { id: 'eh-e3', source: 'eh-guard', target: 'eh-post', sourceHandle: 'body' },
      { id: 'eh-e4', source: 'eh-guard', target: 'eh-log-error', sourceHandle: 'catch' },
      { id: 'eh-e5', source: 'eh-guard', target: 'eh-check', sourceHandle: 'done' },
      { id: 'eh-e6', source: 'eh-check', target: 'eh-log-ok', sourceHandle: 'true' },
      { id: 'eh-e7', source: 'eh-check', target: 'eh-log-fail', sourceHandle: 'false' },
      makeEdge('eh-e8', 'eh-log-ok', 'eh-end'),
      makeEdge('eh-e9', 'eh-log-fail', 'eh-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow: Workflow-level error handler with notification subgraph.
 * Main flow calls a deliberate bad URL to trigger failure.
 * An isolated error-handler subgraph (LogDebug → HTTP POST notification) fires
 * when ANY unhandled node error occurs, demonstrating the "On Unhandled Error →
 * Run error handler subgraph" feature with {{error.message}}, {{error.statusCode}},
 * and {{error.failedCount}} variables.
 *
 * Flow (main):       Start → Fetch Valid → Call Bad URL (fails!) → End
 * Flow (error):      Log Error Info → POST Notification
 * ErrorConfig:       mode=run-handler, handlerEntryNodeId=weh-log-err
 */
export function createWorkflowErrorHandlerSample(): Workflow {
  return {
    id: 'sample-workflow-wf-error-handler',
    name: 'Sample: Workflow Error Handler – Failure Notification',
    description: 'Demonstrates workflow-level error handling: when any step fails, an isolated notification subgraph executes with error details.',
    variables: {
      notifyUrl: 'https://jsonplaceholder.typicode.com/posts',
    },
    errorConfig: {
      mode: 'run-handler',
      handlerEntryNodeId: 'weh-log-err',
    },
    nodes: [
      // ── Main flow ──
      makeStartNode('weh-start', { userId: '1' }, { x: 250, y: 0 }),
      {
        id: 'weh-fetch', type: 'http', position: { x: 200, y: 120 },
        data: {
          label: '1. Fetch User (OK)',
          scenario: {
            id: 'weh-s1', name: 'Fetch User',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [bodyExtraction('userName', '$.name')],
          },
        },
      },
      makeLogDebugNode('weh-log-ok', '2. Log Success', 'Fetched user: {{userName}}', 'info', { x: 200, y: 260 }),
      {
        id: 'weh-bad', type: 'http', position: { x: 200, y: 380 },
        data: {
          label: '3. Call Bad URL (will fail)',
          scenario: {
            id: 'weh-s2', name: 'Bad Request',
            url: 'https://jsonplaceholder.typicode.com/invalid-endpoint-404',
            method: 'GET',
            headers: [],
            body: '', auth: { type: 'none' },
            validation: { mode: 'none', assertions: [{ type: 'status', expected: '200' }] },
            extractions: [],
          },
        },
      },
      makeLogDebugNode('weh-never', '4. This Never Runs', 'You should not see this — the workflow stopped at step 3.', 'info', { x: 200, y: 500 }),
      makeEndNode('weh-end', 'End', { x: 250, y: 620 }),

      // ── Error handler subgraph (disconnected from main flow) ──
      makeLogDebugNode(
        'weh-log-err',
        '⚠ Error Caught',
        '🔴 Workflow-level error handler triggered!\n  Error: {{error.message}}\n  Status Code: {{error.statusCode}}\n  Failed Nodes: {{error.failedCount}}',
        'error',
        { x: 620, y: 120, snapshotVariables: true },
      ),
      {
        id: 'weh-notify', type: 'http', position: { x: 620, y: 280 },
        data: {
          label: '📧 POST Notification',
          scenario: {
            id: 'weh-s3', name: 'Error Notification',
            url: '{{notifyUrl}}',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: jsonBody({
              channel: '#alerts',
              text: 'Workflow failed! Error: {{error.message}} | Status: {{error.statusCode}} | Failed: {{error.failedCount}} node(s)',
            }),
            bodyType: 'json', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [bodyExtraction('notificationId', '$.id')],
          },
        },
      },
      makeLogDebugNode('weh-log-sent', '✅ Notification Sent', 'Error notification posted (id={{notificationId}}). Recovery complete.', 'info', { x: 620, y: 440 }),
    ],
    edges: [
      // Main flow edges
      makeEdge('weh-e1', 'weh-start', 'weh-fetch'),
      makeEdge('weh-e2', 'weh-fetch', 'weh-log-ok'),
      makeEdge('weh-e3', 'weh-log-ok', 'weh-bad'),
      makeEdge('weh-e4', 'weh-bad', 'weh-never'),
      makeEdge('weh-e5', 'weh-never', 'weh-end'),
      // Error subgraph edges (no connection to main flow)
      makeEdge('weh-e6', 'weh-log-err', 'weh-notify'),
      makeEdge('weh-e7', 'weh-notify', 'weh-log-sent'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * ★★☆ Medium: Cross-API Validator
 * Fetches a user and their posts, uses a Script node in "validate" mode
 * to cross-check that the posts belong to the user, wrapped in an
 * ErrorHandler. LogDebug traces the outcome.
 *
 * Flow: Start → Fork → [GET user, GET posts] → Join
 *         → Script (validate) [inside ErrorHandler]
 *           → LogDebug → End
 */
export function createScriptMediumWorkflow(): Workflow {
  return {
    id: 'sample-workflow-script-medium',
    name: 'Script: Cross-API Validator',
    description: 'Fetch user and their posts in parallel, validate data consistency with a Script node, ErrorHandler catches failures.',
    variables: {},
    nodes: [
      makeStartNode('sm-start', { userId: '1' }),
      makeForkNode('sm-fork', '1. Parallel Fetch', { x: 300, y: 120 }),
      {
        id: 'sm-get-user',
        type: 'http',
        position: { x: 100, y: 250 },
        data: {
          label: '2a. Get User',
          scenario: {
            id: 'sm-s1',
            name: 'Get User',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [bodyExtraction('userJson', '$'), bodyExtraction('userName', '$.name')],
          },
        },
      },
      {
        id: 'sm-get-posts',
        type: 'http',
        position: { x: 500, y: 250 },
        data: {
          label: '2b. Get User Posts',
          scenario: {
            id: 'sm-s2',
            name: 'Get Posts',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}/posts',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [bodyExtraction('postsJson', '$')],
          },
        },
      },
      makeJoinNode('sm-join', '3. Merge Results', { x: 300, y: 390 }),
      {
        id: 'sm-error-handler',
        type: 'errorHandler',
        position: { x: 300, y: 500 },
        data: {
          label: '4. Validation Guard',
          retryCount: 0,
          errorFilter: 'all',
          retryDelayMs: 0,
          retryBackoff: 'fixed',
          retryTimeoutMs: 0,
          continueOnError: false,
        },
      },
      {
        id: 'sm-script-validate',
        type: 'script',
        position: { x: 200, y: 620 },
        data: {
          label: '4a. Validate Data',
          code: [
            '// Validate that all posts belong to the correct user',
            'const user = JSON.parse(input.userJson);',
            'const posts = JSON.parse(input.postsJson);',
            '',
            'console.log("Checking " + posts.length + " posts for user: " + user.name);',
            '',
            'let mismatchCount = 0;',
            'for (const post of posts) {',
            '  if (post.userId !== user.id) {',
            '    console.warn("Post " + post.id + " userId mismatch: " + post.userId + " != " + user.id);',
            '    mismatchCount++;',
            '  }',
            '}',
            '',
            'output.postCount = String(posts.length);',
            'output.mismatchCount = String(mismatchCount);',
            'output.result = mismatchCount === 0;',
            '',
            'console.log("Validation " + (mismatchCount === 0 ? "PASSED" : "FAILED") + " — " + mismatchCount + " mismatches");',
          ].join('\n'),
          mode: 'validate',
          inputVariables: ['userJson', 'postsJson'],
          outputVariables: ['postCount', 'mismatchCount', 'result'],
          timeoutMs: 5000,
          captureConsole: true,
        },
      },
      makeLogDebugNode('sm-catch', '4b. Log Failure', 'Validation failed: {{mismatchCount}} mismatches in {{postCount}} posts for user {{userName}}', 'error', { x: 450, y: 620, snapshotVariables: true }),
      makeLogDebugNode('sm-log-success', '5. Log Result', 'User {{userName}}: {{postCount}} posts validated, {{mismatchCount}} mismatches', 'info', { x: 300, y: 770 }),
      makeEndNode('sm-end', 'Done', { x: 300, y: 900 }),
    ],
    edges: [
      makeEdge('sm-e1', 'sm-start', 'sm-fork'),
      makeEdge('sm-e2', 'sm-fork', 'sm-get-user'),
      makeEdge('sm-e3', 'sm-fork', 'sm-get-posts'),
      makeEdge('sm-e4', 'sm-get-user', 'sm-join'),
      makeEdge('sm-e5', 'sm-get-posts', 'sm-join'),
      makeEdge('sm-e6', 'sm-join', 'sm-error-handler'),
      { id: 'sm-e7', source: 'sm-error-handler', target: 'sm-script-validate', sourceHandle: 'body' },
      { id: 'sm-e8', source: 'sm-error-handler', target: 'sm-catch', sourceHandle: 'catch' },
      { id: 'sm-e9', source: 'sm-error-handler', target: 'sm-log-success', sourceHandle: 'done' },
      makeEdge('sm-e10', 'sm-log-success', 'sm-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
