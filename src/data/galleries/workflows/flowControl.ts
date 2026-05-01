import type { Workflow } from '../../../features/workflow/types/workflow';

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
      {
        id: 'sb-start',
        type: 'start',
        position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: 'sb-check',
        type: 'http',
        position: { x: 200, y: 100 },
        data: {
          label: '1. Get User',
          scenario: {
            id: 'sb-s1',
            name: 'Get User',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'userName', source: 'body', expression: '$.name' },
              { name: 'httpStatus', source: 'status', expression: '' },
            ],
          },
        },
      },
      {
        id: 'sb-cond',
        type: 'condition',
        position: { x: 240, y: 250 },
        data: {
          label: '2. User Found?',
          left: '{{httpStatus}}',
          operator: '==',
          right: '200',
        },
      },
      {
        id: 'sb-profile',
        type: 'http',
        position: { x: 50, y: 380 },
        data: {
          label: '3a. Get User Posts',
          scenario: {
            id: 'sb-s2',
            name: 'Get User Posts',
            url: 'https://jsonplaceholder.typicode.com/users/1/posts',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'firstPostTitle', source: 'body', expression: '$[0].title' },
            ],
          },
        },
      },
      {
        id: 'sb-create',
        type: 'http',
        position: { x: 350, y: 380 },
        data: {
          label: '3b. Create User',
          scenario: {
            id: 'sb-s3',
            name: 'Create User',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: JSON.stringify({ name: 'New User', username: 'newuser', email: 'new@example.com' }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [],
          },
        },
      },
    ],
    edges: [
      { id: 'sb-e0', source: 'sb-start', target: 'sb-check' },
      { id: 'sb-e1', source: 'sb-check', target: 'sb-cond' },
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
      { id: 'sw-start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start', inputVariables: {} } },
      {
        id: 'sw-fetch', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: 'Fetch Order', scenario: {
            id: 'sw-s1', name: 'Fetch Order', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET',
            headers: [], body: '', bodyType: 'none', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'orderType', source: 'body', expression: '$.userId' },
              { name: 'orderTitle', source: 'body', expression: '$.title' },
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
      {
        id: 'sw-standard', type: 'http', position: { x: 50, y: 450 },
        data: {
          label: 'Standard Processing', scenario: {
            id: 'sw-s2', name: 'Standard', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"type":"standard","order":"{{orderTitle}}"}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      {
        id: 'sw-express', type: 'http', position: { x: 280, y: 450 },
        data: {
          label: 'Express Processing', scenario: {
            id: 'sw-s3', name: 'Express', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"type":"express","priority":"high","order":"{{orderTitle}}"}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      {
        id: 'sw-gift', type: 'http', position: { x: 510, y: 450 },
        data: {
          label: 'Gift Processing', scenario: {
            id: 'sw-s4', name: 'Gift', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"type":"gift","wrapping":true,"order":"{{orderTitle}}"}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      {
        id: 'sw-default', type: 'http', position: { x: 740, y: 450 },
        data: {
          label: 'Default Handler', scenario: {
            id: 'sw-s5', name: 'Default', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"type":"unknown","order":"{{orderTitle}}"}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      { id: 'sw-end', type: 'end', position: { x: 350, y: 620 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'sw-e1', source: 'sw-start', target: 'sw-fetch' },
      { id: 'sw-e2', source: 'sw-fetch', target: 'sw-switch' },
      { id: 'sw-e3', source: 'sw-switch', target: 'sw-standard', sourceHandle: 'case-c1' },
      { id: 'sw-e4', source: 'sw-switch', target: 'sw-express', sourceHandle: 'case-c2' },
      { id: 'sw-e5', source: 'sw-switch', target: 'sw-gift', sourceHandle: 'case-c3' },
      { id: 'sw-e6', source: 'sw-switch', target: 'sw-default', sourceHandle: 'default' },
      { id: 'sw-e7', source: 'sw-standard', target: 'sw-end' },
      { id: 'sw-e8', source: 'sw-express', target: 'sw-end' },
      { id: 'sw-e9', source: 'sw-gift', target: 'sw-end' },
      { id: 'sw-e10', source: 'sw-default', target: 'sw-end' },
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
      { id: 'la-start', type: 'start', position: { x: 300, y: 0 }, data: { label: 'Start', inputVariables: {} } },
      {
        id: 'la-init', type: 'setVariable', position: { x: 260, y: 120 },
        data: {
          label: 'Init Variables',
          assignments: [
            { id: 'a1', name: 'page', expression: '1' },
            { id: 'a2', name: 'hasMore', expression: 'true' },
            { id: 'a3', name: 'allItems', expression: '[]' },
            { id: 'a4', name: 'totalCount', expression: '0' },
          ],
        },
      },
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
              { name: 'pageItems', source: 'body', expression: '$' },
              { name: 'itemCount', source: 'body', expression: '$.length' },
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
      {
        id: 'la-next', type: 'setVariable', position: { x: 240, y: 700 },
        data: {
          label: 'Next Page',
          assignments: [
            { id: 'a1', name: 'page', expression: '{{page}}' },
            { id: 'a2', name: 'hasMore', expression: '{{itemCount}}' },
          ],
        },
      },
      {
        id: 'la-check', type: 'condition', position: { x: 260, y: 880 },
        data: { label: 'Many Items?', left: '{{totalCount}}', operator: '>' as const, right: '50' },
      },
      {
        id: 'la-alert', type: 'http', position: { x: 60, y: 1030 },
        data: {
          label: 'Send Alert', scenario: {
            id: 'la-s2', name: 'Alert', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"alert":"Large dataset: {{totalCount}} items fetched"}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      { id: 'la-end', type: 'end', position: { x: 300, y: 1180 }, data: { label: 'Complete' } },
    ],
    edges: [
      { id: 'la-e1', source: 'la-start', target: 'la-init' },
      { id: 'la-e2', source: 'la-init', target: 'la-loop' },
      { id: 'la-e3', source: 'la-loop', target: 'la-fetch', sourceHandle: 'body' },
      { id: 'la-e4', source: 'la-fetch', target: 'la-agg' },
      { id: 'la-e5', source: 'la-agg', target: 'la-next' },
      { id: 'la-e6', source: 'la-loop', target: 'la-check', sourceHandle: 'done' },
      { id: 'la-e7', source: 'la-check', target: 'la-alert', sourceHandle: 'true' },
      { id: 'la-e8', source: 'la-check', target: 'la-end', sourceHandle: 'false' },
      { id: 'la-e9', source: 'la-alert', target: 'la-end' },
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
      {
        id: 'bp-start', type: 'start', position: { x: 300, y: 0 },
        data: {
          label: 'Start',
          inputVariables: {
            users: '[{"title":"Alice task","body":"Provision Alice","userId":1},{"title":"Bob task","body":"Provision Bob","userId":2},{"title":"Carol task","body":"Provision Carol","userId":3}]',
          },
        },
      },
      {
        id: 'bp-init', type: 'setVariable', position: { x: 260, y: 130 },
        data: {
          label: 'Init Trackers',
          assignments: [
            { id: 'a1', name: 'successCount', expression: '0' },
            { id: 'a2', name: 'failCount', expression: '0' },
            { id: 'a3', name: 'createdIds', expression: '[]' },
          ],
        },
      },
      {
        id: 'bp-loop', type: 'loop', position: { x: 280, y: 270 },
        data: {
          label: 'Each User', mode: 'forEach' as const,
          sourceExpression: '{{users}}', itemVariable: 'user', indexVariable: 'userIndex',
          maxIterations: 50,
        },
      },
      {
        id: 'bp-create', type: 'http', position: { x: 240, y: 410 },
        data: {
          label: 'Create User', scenario: {
            id: 'bp-s1', name: 'Create User', url: 'https://jsonplaceholder.typicode.com/users', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{{user}}', bodyType: 'json', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'createStatus', source: 'status', expression: '' },
              { name: 'userId', source: 'body', expression: '$.id' },
            ],
          },
        },
      },
      {
        id: 'bp-check', type: 'condition', position: { x: 260, y: 570 },
        data: { label: 'Created?', left: '{{createStatus}}', operator: '==' as const, right: '201' },
      },
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
      {
        id: 'bp-summary', type: 'setVariable', position: { x: 240, y: 920 },
        data: {
          label: 'Build Summary',
          assignments: [
            { id: 'a1', name: 'resultType', expression: '{{failCount}}' },
            { id: 'a2', name: 'summary', expression: 'Created {{successCount}} users ({{failCount}} failed)' },
          ],
        },
      },
      {
        id: 'bp-switch', type: 'switch', position: { x: 260, y: 1060 },
        data: {
          label: 'Result Router', expression: '{{resultType}}',
          cases: [
            { id: 'rc1', value: '0', label: 'All OK' },
          ],
        },
      },
      {
        id: 'bp-report-ok', type: 'http', position: { x: 80, y: 1230 },
        data: {
          label: 'Success Report', scenario: {
            id: 'bp-s2', name: 'Report OK', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"title":"Batch Report","body":"{{summary}}","userId":1}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      {
        id: 'bp-report-partial', type: 'http', position: { x: 440, y: 1230 },
        data: {
          label: 'Partial Report', scenario: {
            id: 'bp-s3', name: 'Report Partial', url: 'https://jsonplaceholder.typicode.com/posts', method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"title":"Batch Report (Partial)","body":"{{summary}}","userId":1}', bodyType: 'json',
            auth: { type: 'none' }, validation: { mode: 'none' }, extractions: [],
          },
        },
      },
      { id: 'bp-end', type: 'end', position: { x: 280, y: 1400 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'bp-e1', source: 'bp-start', target: 'bp-init' },
      { id: 'bp-e2', source: 'bp-init', target: 'bp-loop' },
      { id: 'bp-e3', source: 'bp-loop', target: 'bp-create', sourceHandle: 'body' },
      { id: 'bp-e4', source: 'bp-create', target: 'bp-check' },
      { id: 'bp-e5', source: 'bp-check', target: 'bp-agg-ok', sourceHandle: 'true' },
      { id: 'bp-e6', source: 'bp-check', target: 'bp-agg-fail', sourceHandle: 'false' },
      { id: 'bp-e7', source: 'bp-loop', target: 'bp-summary', sourceHandle: 'done' },
      { id: 'bp-e8', source: 'bp-summary', target: 'bp-switch' },
      { id: 'bp-e9', source: 'bp-switch', target: 'bp-report-ok', sourceHandle: 'case-rc1' },
      { id: 'bp-e10', source: 'bp-switch', target: 'bp-report-partial', sourceHandle: 'default' },
      { id: 'bp-e11', source: 'bp-report-ok', target: 'bp-end' },
      { id: 'bp-e12', source: 'bp-report-partial', target: 'bp-end' },
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
      { id: 'eh-start', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Start', inputVariables: { apiKey: 'demo-key' } } },
      {
        id: 'eh-log-begin', type: 'logDebug', position: { x: 200, y: 100 },
        data: { label: 'Log: Begin', message: 'Starting resilient API call with key={{apiKey}}', logLevel: 'info', snapshotVariables: false },
      },
      {
        id: 'eh-guard', type: 'errorHandler', position: { x: 200, y: 240 },
        data: { label: 'API Guard', errorFilter: 'all', maxRetries: 2, retryBackoffStrategy: 'fixed', retryDelayMs: 500, failWorkflowOnError: false },
      },
      {
        id: 'eh-post', type: 'http', position: { x: 50, y: 400 },
        data: {
          label: 'Create Post',
          scenario: {
            id: 'eh-s1', name: 'Create Post',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({ title: 'Resilient Post', body: 'Created with error handling', userId: 1 }, null, 2),
            bodyType: 'json', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'postId', source: 'body', expression: '$.id' }, { name: 'httpStatus', source: 'status', expression: '' }],
          },
        },
      },
      {
        id: 'eh-log-error', type: 'logDebug', position: { x: 400, y: 400 },
        data: { label: 'Log: Error', message: 'API call failed — will retry. Status={{httpStatus}}', logLevel: 'error', snapshotVariables: true },
      },
      {
        id: 'eh-check', type: 'condition', position: { x: 240, y: 560 },
        data: { label: 'Created OK?', left: '{{httpStatus}}', operator: '==', right: '201' },
      },
      {
        id: 'eh-log-ok', type: 'logDebug', position: { x: 100, y: 700 },
        data: { label: 'Log: Success', message: 'Post {{postId}} created successfully', logLevel: 'info', snapshotVariables: false },
      },
      {
        id: 'eh-log-fail', type: 'logDebug', position: { x: 400, y: 700 },
        data: { label: 'Log: Failure', message: 'Post creation failed with status={{httpStatus}}', logLevel: 'warn', snapshotVariables: true },
      },
      { id: 'eh-end', type: 'end', position: { x: 250, y: 850 }, data: { label: 'End' } },
    ],
    edges: [
      { id: 'eh-e1', source: 'eh-start', target: 'eh-log-begin' },
      { id: 'eh-e2', source: 'eh-log-begin', target: 'eh-guard' },
      { id: 'eh-e3', source: 'eh-guard', target: 'eh-post', sourceHandle: 'body' },
      { id: 'eh-e4', source: 'eh-guard', target: 'eh-log-error', sourceHandle: 'catch' },
      { id: 'eh-e5', source: 'eh-guard', target: 'eh-check', sourceHandle: 'done' },
      { id: 'eh-e6', source: 'eh-check', target: 'eh-log-ok', sourceHandle: 'true' },
      { id: 'eh-e7', source: 'eh-check', target: 'eh-log-fail', sourceHandle: 'false' },
      { id: 'eh-e8', source: 'eh-log-ok', target: 'eh-end' },
      { id: 'eh-e9', source: 'eh-log-fail', target: 'eh-end' },
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
      {
        id: 'weh-start', type: 'start', position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: { userId: '1' } },
      },
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
            extractions: [
              { name: 'userName', source: 'body', expression: '$.name' },
            ],
          },
        },
      },
      {
        id: 'weh-log-ok', type: 'logDebug', position: { x: 200, y: 260 },
        data: { label: '2. Log Success', message: 'Fetched user: {{userName}}', logLevel: 'info', snapshotVariables: false },
      },
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
      {
        id: 'weh-never', type: 'logDebug', position: { x: 200, y: 500 },
        data: { label: '4. This Never Runs', message: 'You should not see this — the workflow stopped at step 3.', logLevel: 'info', snapshotVariables: false },
      },
      {
        id: 'weh-end', type: 'end', position: { x: 250, y: 620 },
        data: { label: 'End' },
      },

      // ── Error handler subgraph (disconnected from main flow) ──
      {
        id: 'weh-log-err', type: 'logDebug', position: { x: 620, y: 120 },
        data: {
          label: '⚠ Error Caught',
          message: '🔴 Workflow-level error handler triggered!\n  Error: {{error.message}}\n  Status Code: {{error.statusCode}}\n  Failed Nodes: {{error.failedCount}}',
          logLevel: 'error', snapshotVariables: true,
        },
      },
      {
        id: 'weh-notify', type: 'http', position: { x: 620, y: 280 },
        data: {
          label: '📧 POST Notification',
          scenario: {
            id: 'weh-s3', name: 'Error Notification',
            url: '{{notifyUrl}}',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              channel: '#alerts',
              text: 'Workflow failed! Error: {{error.message}} | Status: {{error.statusCode}} | Failed: {{error.failedCount}} node(s)',
            }, null, 2),
            bodyType: 'json', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'notificationId', source: 'body', expression: '$.id' }],
          },
        },
      },
      {
        id: 'weh-log-sent', type: 'logDebug', position: { x: 620, y: 440 },
        data: {
          label: '✅ Notification Sent',
          message: 'Error notification posted (id={{notificationId}}). Recovery complete.',
          logLevel: 'info', snapshotVariables: false,
        },
      },
    ],
    edges: [
      // Main flow edges
      { id: 'weh-e1', source: 'weh-start', target: 'weh-fetch' },
      { id: 'weh-e2', source: 'weh-fetch', target: 'weh-log-ok' },
      { id: 'weh-e3', source: 'weh-log-ok', target: 'weh-bad' },
      { id: 'weh-e4', source: 'weh-bad', target: 'weh-never' },
      { id: 'weh-e5', source: 'weh-never', target: 'weh-end' },
      // Error subgraph edges (no connection to main flow)
      { id: 'weh-e6', source: 'weh-log-err', target: 'weh-notify' },
      { id: 'weh-e7', source: 'weh-notify', target: 'weh-log-sent' },
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
      {
        id: 'sm-start',
        type: 'start',
        position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: { userId: '1' } },
      },
      {
        id: 'sm-fork',
        type: 'fork',
        position: { x: 300, y: 120 },
        data: { label: '1. Parallel Fetch' },
      },
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
            extractions: [
              { name: 'userJson', source: 'body', expression: '$' },
              { name: 'userName', source: 'body', expression: '$.name' },
            ],
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
            extractions: [
              { name: 'postsJson', source: 'body', expression: '$' },
            ],
          },
        },
      },
      {
        id: 'sm-join',
        type: 'join',
        position: { x: 300, y: 390 },
        data: { label: '3. Merge Results' },
      },
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
      {
        id: 'sm-catch',
        type: 'logDebug',
        position: { x: 450, y: 620 },
        data: {
          label: '4b. Log Failure',
          message: 'Validation failed: {{mismatchCount}} mismatches in {{postCount}} posts for user {{userName}}',
          logLevel: 'error',
          snapshotVariables: true,
        },
      },
      {
        id: 'sm-log-success',
        type: 'logDebug',
        position: { x: 300, y: 770 },
        data: {
          label: '5. Log Result',
          message: 'User {{userName}}: {{postCount}} posts validated, {{mismatchCount}} mismatches',
          logLevel: 'info',
          snapshotVariables: false,
        },
      },
      {
        id: 'sm-end',
        type: 'end',
        position: { x: 300, y: 900 },
        data: { label: 'Done' },
      },
    ],
    edges: [
      { id: 'sm-e1', source: 'sm-start', target: 'sm-fork' },
      { id: 'sm-e2', source: 'sm-fork', target: 'sm-get-user' },
      { id: 'sm-e3', source: 'sm-fork', target: 'sm-get-posts' },
      { id: 'sm-e4', source: 'sm-get-user', target: 'sm-join' },
      { id: 'sm-e5', source: 'sm-get-posts', target: 'sm-join' },
      { id: 'sm-e6', source: 'sm-join', target: 'sm-error-handler' },
      { id: 'sm-e7', source: 'sm-error-handler', target: 'sm-script-validate', sourceHandle: 'body' },
      { id: 'sm-e8', source: 'sm-error-handler', target: 'sm-catch', sourceHandle: 'catch' },
      { id: 'sm-e9', source: 'sm-error-handler', target: 'sm-log-success', sourceHandle: 'done' },
      { id: 'sm-e10', source: 'sm-log-success', target: 'sm-end' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
