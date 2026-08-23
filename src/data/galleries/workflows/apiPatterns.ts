import type { Workflow } from '@workflow/types/workflow';
import {
  makeStartNode,
  makeEndNode,
  makeGetNode,
  makePostNode,
  makeSetVariableNode,
  makeLogDebugNode,
  makeConditionNode,
  makeDelayNode,
  makeForkNode,
  makeJoinNode,
  makeEdge,
  jsonBody,
  bodyExtraction,
} from './nodeFactories';

/**
 * Pre-built sample workflow: sequential HTTP calls with variable chaining.
 * Uses jsonplaceholder.typicode.com — a free public REST API with real responses.
 * Flow: Create Post → Check Created? → Wait → Get Post → Verify
 */
export function createOrderWorkflow(): Workflow {
  const nodeIds = {
    start: 'sample-order-start',
    create: 'sample-n1-create',
    checkStatus: 'sample-n2-check-status',
    delay: 'sample-n4-delay',
    getDetails: 'sample-n3-get-details',
    verify: 'sample-n5-verify',
  };

  return {
    id: 'sample-workflow-001',
    name: 'Sample: Create → Extract → Verify',
    description: 'Demonstrates multi-step API testing with variable chaining using a public REST API.',
    variables: {},
    nodes: [
      makeStartNode(nodeIds.start, {}, { x: 250, y: 0 }),
      makePostNode(
        nodeIds.create,
        '1. Create Post',
        'https://jsonplaceholder.typicode.com/posts',
        jsonBody({
          title: 'Sample Post',
          body: 'This is a test post created by the workflow.',
          userId: 1,
        }),
        {
          x: 200,
          y: 100,
          extractions: [
            bodyExtraction('postId', '$.id'),
            { name: 'httpStatus', source: 'status', expression: '' },
          ],
        },
      ),
      makeConditionNode(nodeIds.checkStatus, '2. Was it Created?', '{{httpStatus}}', '201', { x: 240, y: 250 }),
      makeDelayNode(nodeIds.delay, '3. Wait for Processing', 1000, { x: 250, y: 380 }),
      makeGetNode(nodeIds.getDetails, '4. Get Post Details', 'https://jsonplaceholder.typicode.com/posts/1', {
        x: 200,
        y: 480,
        extractions: [
          bodyExtraction('postTitle', '$.title'),
          bodyExtraction('postUserId', '$.userId'),
        ],
      }),
      makeConditionNode(nodeIds.verify, '5. Has Valid User?', '{{postUserId}}', '1', { x: 240, y: 630 }),
    ],
    edges: [
      makeEdge('sample-e0', nodeIds.start, nodeIds.create),
      makeEdge('sample-e1', nodeIds.create, nodeIds.checkStatus),
      { id: 'sample-e2', source: nodeIds.checkStatus, target: nodeIds.delay, sourceHandle: 'true', label: 'Yes' },
      makeEdge('sample-e3', nodeIds.delay, nodeIds.getDetails),
      makeEdge('sample-e4', nodeIds.getDetails, nodeIds.verify),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow demonstrating parallel execution with Fork and Join nodes.
 * Uses jsonplaceholder.typicode.com for real API responses.
 * Flow: Start → GET post → Fork → [GET Users, GET Comments] → Join → POST summary
 */
export function createParallelForkWorkflow(): Workflow {
  return {
    id: 'sample-workflow-parallel',
    name: 'Sample: Parallel API Calls',
    description: 'Demonstrates Fork and Join nodes for running multiple API calls simultaneously and merging results.',
    variables: {},
    nodes: [
      makeStartNode('sp-start', {}, { x: 250, y: 0 }),
      makeGetNode('sp-get-post', '1. Get Post', 'https://jsonplaceholder.typicode.com/posts/1', {
        x: 200,
        y: 100,
        extractions: [
          bodyExtraction('postTitle', '$.title'),
          bodyExtraction('postUserId', '$.userId'),
        ],
      }),
      makeForkNode('sp-fork', '2. Parallel Fork', { x: 240, y: 250 }),
      makeGetNode('sp-users', '3a. Get Users', 'https://jsonplaceholder.typicode.com/users', {
        x: 50,
        y: 370,
        extractions: [
          bodyExtraction('firstUserName', '$[0].name'),
          bodyExtraction('firstUserEmail', '$[0].email'),
        ],
      }),
      makeGetNode('sp-comments', '3b. Get Comments', 'https://jsonplaceholder.typicode.com/posts/1/comments', {
        x: 350,
        y: 370,
        extractions: [
          bodyExtraction('firstCommentEmail', '$[0].email'),
          bodyExtraction('firstCommentName', '$[0].name'),
        ],
      }),
      makeJoinNode('sp-join', '4. Join', { x: 240, y: 520 }),
      makePostNode(
        'sp-summary',
        '5. Post Summary',
        'https://jsonplaceholder.typicode.com/posts',
        jsonBody({
          title: 'Workflow Summary',
          body: 'First user: {{firstUserName}} ({{firstUserEmail}}), First commenter: {{firstCommentName}} ({{firstCommentEmail}})',
          userId: 1,
        }),
        { x: 200, y: 620 },
      ),
    ],
    edges: [
      makeEdge('sp-e0', 'sp-start', 'sp-get-post'),
      makeEdge('sp-e1', 'sp-get-post', 'sp-fork'),
      makeEdge('sp-e2', 'sp-fork', 'sp-users'),
      makeEdge('sp-e3', 'sp-fork', 'sp-comments'),
      makeEdge('sp-e4', 'sp-users', 'sp-join'),
      makeEdge('sp-e5', 'sp-comments', 'sp-join'),
      makeEdge('sp-e6', 'sp-join', 'sp-summary'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow: Debug trace pipeline that logs before and after each API call.
 * Flow: Start → Log(step1) → GET users → Log(step2) → GET user/1 → Log(step3) → GET posts → Log(done) → End
 */
export function createLogDebugWorkflow(): Workflow {
  return {
    id: 'sample-workflow-log-debug',
    name: 'Sample: Debug Trace Pipeline',
    description: 'Adds Log/Debug nodes between HTTP calls for full request tracing.',
    variables: {},
    nodes: [
      makeStartNode('ld-start', { traceId: 'trace-001' }, { x: 250, y: 0 }),
      makeLogDebugNode('ld-log1', 'Trace: Step 1', '[{{traceId}}] Fetching user list...', 'debug', {
        x: 200,
        y: 100,
        snapshotVariables: false,
      }),
      makeGetNode('ld-get-users', 'GET Users', 'https://jsonplaceholder.typicode.com/users', {
        x: 180,
        y: 220,
        extractions: [bodyExtraction('userCount', '$.length')],
      }),
      makeLogDebugNode('ld-log2', 'Trace: Step 2', '[{{traceId}}] Got {{userCount}} users. Fetching user details...', 'debug', {
        x: 200,
        y: 340,
        snapshotVariables: true,
      }),
      makeGetNode('ld-get-user1', 'GET User #1', 'https://jsonplaceholder.typicode.com/users/1', {
        x: 180,
        y: 460,
        extractions: [bodyExtraction('userName', '$.name')],
      }),
      makeLogDebugNode('ld-log3', 'Trace: Step 3', '[{{traceId}}] User: {{userName}}. Fetching posts...', 'info', {
        x: 200,
        y: 580,
        snapshotVariables: false,
      }),
      makeGetNode('ld-get-posts', 'GET Posts', 'https://jsonplaceholder.typicode.com/posts?userId=1', {
        x: 180,
        y: 700,
        extractions: [bodyExtraction('postCount', '$.length')],
      }),
      makeLogDebugNode('ld-log-done', 'Trace: Done', '[{{traceId}}] Pipeline complete. {{postCount}} posts found for {{userName}}.', 'info', {
        x: 200,
        y: 820,
        snapshotVariables: true,
      }),
    ],
    edges: [
      makeEdge('ld-e1', 'ld-start', 'ld-log1'),
      makeEdge('ld-e2', 'ld-log1', 'ld-get-users'),
      makeEdge('ld-e3', 'ld-get-users', 'ld-log2'),
      makeEdge('ld-e4', 'ld-log2', 'ld-get-user1'),
      makeEdge('ld-e5', 'ld-get-user1', 'ld-log3'),
      makeEdge('ld-e6', 'ld-log3', 'ld-get-posts'),
      makeEdge('ld-e7', 'ld-get-posts', 'ld-log-done'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Sample workflow showcasing Expression functions for array aggregation,
 * string manipulation, math, and conditional logic.
 * Flow: Start → GET users → SetVariable (user stats) → GET posts → SetVariable (post stats) → Condition → Log
 */
export function createExpressionFunctionsWorkflow(): Workflow {
  return {
    id: 'sample-workflow-expressions',
    name: 'Sample: Expression Functions Showcase',
    description: 'Demonstrates $count, $upper, $default, $indexOf, $add, $substring, $concat, $divide, $round, $contains, $if, $padStart, $min, $max via sequential intermediate variables.',
    variables: {},
    nodes: [
      makeStartNode('ex-start', { reportTitle: 'User Activity Report' }, { x: 300, y: 0 }),
      makeGetNode('ex-users', '1. Fetch Users', 'https://jsonplaceholder.typicode.com/users', {
        x: 250,
        y: 120,
        extraHeaders: [],
        extractions: [
          bodyExtraction('usersJson', ''),
          bodyExtraction('firstUserName', '$.0.name'),
          bodyExtraction('firstUserEmail', '$.0.email'),
          bodyExtraction('firstUserCity', '$.0.address.city'),
        ],
      }),
      makeSetVariableNode('ex-user-stats', '2. Compute User Stats', [
        { id: 'a1', name: 'totalUsers', expression: '{{$count(usersJson)}}' },
        { id: 'a2', name: 'upperName', expression: '{{$upper(firstUserName)}}' },
        { id: 'a3', name: 'displayCity', expression: '{{$default(firstUserCity, "N/A")}}' },
        { id: 'a4', name: 'emailAtPos', expression: '{{$indexOf(firstUserEmail, "@")}}' },
        { id: 'a5', name: 'domainStart', expression: '{{$add(emailAtPos, 1)}}' },
        { id: 'a6', name: 'firstUserDomain', expression: '{{$substring(firstUserEmail, domainStart)}}' },
        { id: 'a7', name: 'userSummary', expression: '{{$concat(upperName, " <", firstUserEmail, ">")}}' },
        { id: 'a8', name: 'reportHeader', expression: 'REPORT: {{reportTitle}} | {{totalUsers}} users' },
      ], { x: 250, y: 280 }),
      makeGetNode('ex-posts', '3. Fetch Posts', 'https://jsonplaceholder.typicode.com/posts', {
        x: 250,
        y: 440,
        extraHeaders: [],
        extractions: [
          bodyExtraction('postsJson', ''),
          bodyExtraction('firstPostTitle', '$.0.title'),
        ],
      }),
      makeSetVariableNode('ex-post-stats', '4. Aggregate Post Stats', [
        { id: 'b1', name: 'totalPosts', expression: '{{$count(postsJson)}}' },
        { id: 'b2', name: 'avgRaw', expression: '{{$divide(totalPosts, totalUsers)}}' },
        { id: 'b3', name: 'avgPostsPerUser', expression: '{{$round(avgRaw, 1)}}' },
        { id: 'b4', name: 'titleHasProvident', expression: '{{$contains(firstPostTitle, "provident")}}' },
        { id: 'b5', name: 'activityLevel', expression: '{{$if(titleHasProvident, "Active", "Normal")}}' },
        { id: 'b6', name: 'titlePreview', expression: '{{$substring(firstPostTitle, 0, 30)}}' },
        { id: 'b7', name: 'paddedUserCount', expression: '{{$padStart(totalUsers, 5, "0")}}' },
        { id: 'b8', name: 'minMetric', expression: '{{$min(totalPosts, totalUsers)}}' },
        { id: 'b9', name: 'maxMetric', expression: '{{$max(totalPosts, totalUsers)}}' },
      ], { x: 250, y: 600 }),
      makeConditionNode('ex-cond', '5. Enough Data?', '{{totalPosts}}', '5', { operator: '>=', x: 300, y: 760 }),
      makeLogDebugNode(
        'ex-log-success',
        'Log: Success',
        '{{reportHeader}} | Posts: {{totalPosts}}, Avg: {{avgPostsPerUser}}/user ({{activityLevel}}), User: {{userSummary}} from {{displayCity}}, Domain: {{firstUserDomain}}, Preview: {{titlePreview}}, Range: {{minMetric}}–{{maxMetric}}',
        'info',
        { x: 80, y: 900, snapshotVariables: true },
      ),
      makeLogDebugNode(
        'ex-log-insufficient',
        'Log: Insufficient',
        'Only {{totalPosts}} posts found. Activity: {{activityLevel}}. Contains "provident": {{titleHasProvident}}',
        'warn',
        { x: 450, y: 900, snapshotVariables: true },
      ),
      makeEndNode('ex-end', 'End', { x: 300, y: 1050 }),
    ],
    edges: [
      makeEdge('ex-e1', 'ex-start', 'ex-users'),
      makeEdge('ex-e2', 'ex-users', 'ex-user-stats'),
      makeEdge('ex-e3', 'ex-user-stats', 'ex-posts'),
      makeEdge('ex-e4', 'ex-posts', 'ex-post-stats'),
      makeEdge('ex-e5', 'ex-post-stats', 'ex-cond'),
      { id: 'ex-e6', source: 'ex-cond', target: 'ex-log-success', sourceHandle: 'true', label: 'Yes' },
      { id: 'ex-e7', source: 'ex-cond', target: 'ex-log-insufficient', sourceHandle: 'false', label: 'No' },
      makeEdge('ex-e8', 'ex-log-success', 'ex-end'),
      makeEdge('ex-e9', 'ex-log-insufficient', 'ex-end'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * ★☆☆ Easy: JSON Formatter
 * Fetches a user from jsonplaceholder, uses a Script node to parse and
 * reformat the JSON (extract + build a summary object), then checks
 * the output with a Condition.
 *
 * Flow: Start → GET /users/1 → Script (transform) → Condition (valid?)
 *         → End
 */
export function createScriptEasyWorkflow(): Workflow {
  return {
    id: 'sample-workflow-script-easy',
    name: 'Script: JSON Formatter',
    description: 'Fetch a user profile, use a Script to parse and reformat the JSON, then verify the result.',
    variables: {},
    nodes: [
      makeStartNode('se-start', {}, { x: 300, y: 0 }),
      makeGetNode('se-get-user', '1. Fetch User', 'https://jsonplaceholder.typicode.com/users/1', {
        x: 250,
        y: 120,
        extractions: [bodyExtraction('userJson', '$')],
      }),
      {
        id: 'se-script-format',
        type: 'script',
        position: { x: 250, y: 280 },
        data: {
          label: '2. Format User Card',
          code: [
            '// Parse the raw API response and build a summary card',
            'const user = JSON.parse(input.userJson);',
            '',
            'output.displayName = user.name;',
            'output.contactInfo = JSON.stringify({',
            '  email: user.email,',
            '  phone: user.phone,',
            '  website: user.website,',
            '});',
            'output.location = user.address.city + ", " + user.address.zipcode;',
            'output.company = user.company.name;',
            '',
            'console.log("Formatted card for: " + user.name);',
            'console.log("Location: " + output.location);',
          ].join('\n'),
          mode: 'transform',
          inputVariables: ['userJson'],
          outputVariables: ['displayName', 'contactInfo', 'location', 'company'],
          timeoutMs: 5000,
          captureConsole: true,
        },
      },
      makeConditionNode('se-check', '3. Has Display Name?', '{{displayName}}', '', { operator: '!=', x: 250, y: 460 }),
      makeEndNode('se-end', 'Done', { x: 300, y: 600 }),
    ],
    edges: [
      makeEdge('se-e1', 'se-start', 'se-get-user'),
      makeEdge('se-e2', 'se-get-user', 'se-script-format'),
      makeEdge('se-e3', 'se-script-format', 'se-check'),
      { id: 'se-e4', source: 'se-check', target: 'se-end', sourceHandle: 'true' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ─── SLA-Monitored API Pipeline ───────────────────────────────────────────────

/**
 * Demonstrates SLA targets in the Workflow Runner.
 * Three HTTP calls against JSONPlaceholder with workflow-level slaTargets
 * so users can see the SLA Override panel, configure thresholds, and review
 * pass/fail per target in the Workflow Replay results.
 */
export function createSlaMonitorWorkflow(): Workflow {
  return {
    id: 'sample-workflow-sla-monitor',
    name: 'SLA-Monitored API Pipeline',
    description: 'Sequential API calls with SLA targets — demonstrates the Workflow Runner SLA Override panel and result analysis.',
    variables: {},
    nodes: [
      makeStartNode('slm-start', {}, { x: 300, y: 50 }),
      makeGetNode('slm-get-users', '1. List Users', 'https://jsonplaceholder.typicode.com/users', {
        x: 300,
        y: 180,
        extractions: [bodyExtraction('userCount', '$.length')],
      }),
      makeGetNode('slm-get-posts', '2. List Posts', 'https://jsonplaceholder.typicode.com/posts', {
        x: 300,
        y: 320,
        extractions: [bodyExtraction('postCount', '$.length')],
      }),
      makePostNode(
        'slm-create-post',
        '3. Create Post',
        'https://jsonplaceholder.typicode.com/posts',
        jsonBody({ title: 'SLA Check', body: 'Automated workflow run', userId: 1 }),
        {
          x: 300,
          y: 460,
          extractions: [bodyExtraction('newPostId', '$.id')],
        },
      ),
      makeEndNode('slm-end', 'Done', { x: 300, y: 600 }),
    ],
    edges: [
      makeEdge('slm-e1', 'slm-start', 'slm-get-users'),
      makeEdge('slm-e2', 'slm-get-users', 'slm-get-posts'),
      makeEdge('slm-e3', 'slm-get-posts', 'slm-create-post'),
      makeEdge('slm-e4', 'slm-create-post', 'slm-end'),
    ],
    slaTargets: [
      { id: 'slm-sla-agg-p95', metric: 'p95', operator: 'lte', value: 900 },
      { id: 'slm-sla-agg-err', metric: 'errorRate', operator: 'lte', value: 1 },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
