import type { Workflow } from '../../../features/workflow/types/workflow';

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
      {
        id: nodeIds.start,
        type: 'start',
        position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: nodeIds.create,
        type: 'http',
        position: { x: 200, y: 100 },
        data: {
          label: '1. Create Post',
          scenario: {
            id: 'sample-s1',
            name: 'Create Post',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: JSON.stringify({
              title: 'Sample Post',
              body: 'This is a test post created by the workflow.',
              userId: 1,
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'postId', source: 'body', expression: '$.id' },
              { name: 'httpStatus', source: 'status', expression: '' },
            ],
          },
        },
      },
      {
        id: nodeIds.checkStatus,
        type: 'condition',
        position: { x: 240, y: 250 },
        data: {
          label: '2. Was it Created?',
          left: '{{httpStatus}}',
          operator: '==',
          right: '201',
        },
      },
      {
        id: nodeIds.delay,
        type: 'delay',
        position: { x: 250, y: 380 },
        data: {
          label: '3. Wait for Processing',
          delayMs: 1000,
          mode: 'fixed',
        },
      },
      {
        id: nodeIds.getDetails,
        type: 'http',
        position: { x: 200, y: 480 },
        data: {
          label: '4. Get Post Details',
          scenario: {
            id: 'sample-s3',
            name: 'Get Post Details',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
            method: 'GET',
            headers: [
              { key: 'Accept', value: 'application/json' },
            ],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'postTitle', source: 'body', expression: '$.title' },
              { name: 'postUserId', source: 'body', expression: '$.userId' },
            ],
          },
        },
      },
      {
        id: nodeIds.verify,
        type: 'condition',
        position: { x: 240, y: 630 },
        data: {
          label: '5. Has Valid User?',
          left: '{{postUserId}}',
          operator: '==',
          right: '1',
        },
      },
    ],
    edges: [
      { id: 'sample-e0', source: nodeIds.start, target: nodeIds.create },
      { id: 'sample-e1', source: nodeIds.create, target: nodeIds.checkStatus },
      { id: 'sample-e2', source: nodeIds.checkStatus, target: nodeIds.delay, sourceHandle: 'true', label: 'Yes' },
      { id: 'sample-e3', source: nodeIds.delay, target: nodeIds.getDetails },
      { id: 'sample-e4', source: nodeIds.getDetails, target: nodeIds.verify },
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
      {
        id: 'sp-start',
        type: 'start',
        position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: 'sp-get-post',
        type: 'http',
        position: { x: 200, y: 100 },
        data: {
          label: '1. Get Post',
          scenario: {
            id: 'sp-s1',
            name: 'Get Post',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'postTitle', source: 'body', expression: '$.title' },
              { name: 'postUserId', source: 'body', expression: '$.userId' },
            ],
          },
        },
      },
      {
        id: 'sp-fork',
        type: 'fork',
        position: { x: 240, y: 250 },
        data: { label: '2. Parallel Fork' },
      },
      {
        id: 'sp-users',
        type: 'http',
        position: { x: 50, y: 370 },
        data: {
          label: '3a. Get Users',
          scenario: {
            id: 'sp-s2',
            name: 'Get Users',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'firstUserName', source: 'body', expression: '$[0].name' },
              { name: 'firstUserEmail', source: 'body', expression: '$[0].email' },
            ],
          },
        },
      },
      {
        id: 'sp-comments',
        type: 'http',
        position: { x: 350, y: 370 },
        data: {
          label: '3b. Get Comments',
          scenario: {
            id: 'sp-s3',
            name: 'Get Comments',
            url: 'https://jsonplaceholder.typicode.com/posts/1/comments',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'firstCommentEmail', source: 'body', expression: '$[0].email' },
              { name: 'firstCommentName', source: 'body', expression: '$[0].name' },
            ],
          },
        },
      },
      {
        id: 'sp-join',
        type: 'join',
        position: { x: 240, y: 520 },
        data: { label: '4. Join' },
      },
      {
        id: 'sp-summary',
        type: 'http',
        position: { x: 200, y: 620 },
        data: {
          label: '5. Post Summary',
          scenario: {
            id: 'sp-s4',
            name: 'Post Summary',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              title: 'Workflow Summary',
              body: 'First user: {{firstUserName}} ({{firstUserEmail}}), First commenter: {{firstCommentName}} ({{firstCommentEmail}})',
              userId: 1,
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
    ],
    edges: [
      { id: 'sp-e0', source: 'sp-start', target: 'sp-get-post' },
      { id: 'sp-e1', source: 'sp-get-post', target: 'sp-fork' },
      { id: 'sp-e2', source: 'sp-fork', target: 'sp-users' },
      { id: 'sp-e3', source: 'sp-fork', target: 'sp-comments' },
      { id: 'sp-e4', source: 'sp-users', target: 'sp-join' },
      { id: 'sp-e5', source: 'sp-comments', target: 'sp-join' },
      { id: 'sp-e6', source: 'sp-join', target: 'sp-summary' },
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
      { id: 'ld-start', type: 'start', position: { x: 250, y: 0 }, data: { label: 'Start', inputVariables: { traceId: 'trace-001' } } },
      {
        id: 'ld-log1', type: 'logDebug', position: { x: 200, y: 100 },
        data: { label: 'Trace: Step 1', message: '[{{traceId}}] Fetching user list...', logLevel: 'debug', snapshotVariables: false },
      },
      {
        id: 'ld-get-users', type: 'http', position: { x: 180, y: 220 },
        data: {
          label: 'GET Users',
          scenario: {
            id: 'ld-s1', name: 'Get Users',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET', headers: [{ key: 'Accept', value: 'application/json' }],
            body: '', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'userCount', source: 'body', expression: '$.length' }],
          },
        },
      },
      {
        id: 'ld-log2', type: 'logDebug', position: { x: 200, y: 340 },
        data: { label: 'Trace: Step 2', message: '[{{traceId}}] Got {{userCount}} users. Fetching user details...', logLevel: 'debug', snapshotVariables: true },
      },
      {
        id: 'ld-get-user1', type: 'http', position: { x: 180, y: 460 },
        data: {
          label: 'GET User #1',
          scenario: {
            id: 'ld-s2', name: 'Get User 1',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET', headers: [{ key: 'Accept', value: 'application/json' }],
            body: '', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'userName', source: 'body', expression: '$.name' }],
          },
        },
      },
      {
        id: 'ld-log3', type: 'logDebug', position: { x: 200, y: 580 },
        data: { label: 'Trace: Step 3', message: '[{{traceId}}] User: {{userName}}. Fetching posts...', logLevel: 'info', snapshotVariables: false },
      },
      {
        id: 'ld-get-posts', type: 'http', position: { x: 180, y: 700 },
        data: {
          label: 'GET Posts',
          scenario: {
            id: 'ld-s3', name: 'Get Posts',
            url: 'https://jsonplaceholder.typicode.com/posts?userId=1',
            method: 'GET', headers: [{ key: 'Accept', value: 'application/json' }],
            body: '', auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [{ name: 'postCount', source: 'body', expression: '$.length' }],
          },
        },
      },
      {
        id: 'ld-log-done', type: 'logDebug', position: { x: 200, y: 820 },
        data: { label: 'Trace: Done', message: '[{{traceId}}] Pipeline complete. {{postCount}} posts found for {{userName}}.', logLevel: 'info', snapshotVariables: true },
      },
    ],
    edges: [
      { id: 'ld-e1', source: 'ld-start', target: 'ld-log1' },
      { id: 'ld-e2', source: 'ld-log1', target: 'ld-get-users' },
      { id: 'ld-e3', source: 'ld-get-users', target: 'ld-log2' },
      { id: 'ld-e4', source: 'ld-log2', target: 'ld-get-user1' },
      { id: 'ld-e5', source: 'ld-get-user1', target: 'ld-log3' },
      { id: 'ld-e6', source: 'ld-log3', target: 'ld-get-posts' },
      { id: 'ld-e7', source: 'ld-get-posts', target: 'ld-log-done' },
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
      {
        id: 'ex-start', type: 'start', position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: { reportTitle: 'User Activity Report' } },
      },
      {
        id: 'ex-users', type: 'http', position: { x: 250, y: 120 },
        data: {
          label: '1. Fetch Users',
          scenario: {
            id: 'ex-s1', name: 'Fetch Users',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'usersJson', source: 'body', expression: '' },
              { name: 'firstUserName', source: 'body', expression: '$.0.name' },
              { name: 'firstUserEmail', source: 'body', expression: '$.0.email' },
              { name: 'firstUserCity', source: 'body', expression: '$.0.address.city' },
            ],
          },
        },
      },
      {
        id: 'ex-user-stats', type: 'setVariable', position: { x: 250, y: 280 },
        data: {
          label: '2. Compute User Stats',
          assignments: [
            { id: 'a1', name: 'totalUsers', expression: '{{$count(usersJson)}}' },
            { id: 'a2', name: 'upperName', expression: '{{$upper(firstUserName)}}' },
            { id: 'a3', name: 'displayCity', expression: '{{$default(firstUserCity, "N/A")}}' },
            { id: 'a4', name: 'emailAtPos', expression: '{{$indexOf(firstUserEmail, "@")}}' },
            { id: 'a5', name: 'domainStart', expression: '{{$add(emailAtPos, 1)}}' },
            { id: 'a6', name: 'firstUserDomain', expression: '{{$substring(firstUserEmail, domainStart)}}' },
            { id: 'a7', name: 'userSummary', expression: '{{$concat(upperName, " <", firstUserEmail, ">")}}' },
            { id: 'a8', name: 'reportHeader', expression: 'REPORT: {{reportTitle}} | {{totalUsers}} users' },
          ],
        },
      },
      {
        id: 'ex-posts', type: 'http', position: { x: 250, y: 440 },
        data: {
          label: '3. Fetch Posts',
          scenario: {
            id: 'ex-s2', name: 'Fetch Posts',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' }, validation: { mode: 'none' },
            extractions: [
              { name: 'postsJson', source: 'body', expression: '' },
              { name: 'firstPostTitle', source: 'body', expression: '$.0.title' },
            ],
          },
        },
      },
      {
        id: 'ex-post-stats', type: 'setVariable', position: { x: 250, y: 600 },
        data: {
          label: '4. Aggregate Post Stats',
          assignments: [
            { id: 'b1', name: 'totalPosts', expression: '{{$count(postsJson)}}' },
            { id: 'b2', name: 'avgRaw', expression: '{{$divide(totalPosts, totalUsers)}}' },
            { id: 'b3', name: 'avgPostsPerUser', expression: '{{$round(avgRaw, 1)}}' },
            { id: 'b4', name: 'titleHasProvident', expression: '{{$contains(firstPostTitle, "provident")}}' },
            { id: 'b5', name: 'activityLevel', expression: '{{$if(titleHasProvident, "Active", "Normal")}}' },
            { id: 'b6', name: 'titlePreview', expression: '{{$substring(firstPostTitle, 0, 30)}}' },
            { id: 'b7', name: 'paddedUserCount', expression: '{{$padStart(totalUsers, 5, "0")}}' },
            { id: 'b8', name: 'minMetric', expression: '{{$min(totalPosts, totalUsers)}}' },
            { id: 'b9', name: 'maxMetric', expression: '{{$max(totalPosts, totalUsers)}}' },
          ],
        },
      },
      {
        id: 'ex-cond', type: 'condition', position: { x: 300, y: 760 },
        data: { label: '5. Enough Data?', left: '{{totalPosts}}', operator: '>=', right: '5' },
      },
      {
        id: 'ex-log-success', type: 'logDebug', position: { x: 80, y: 900 },
        data: {
          label: 'Log: Success',
          logLevel: 'info',
          message: '{{reportHeader}} | Posts: {{totalPosts}}, Avg: {{avgPostsPerUser}}/user ({{activityLevel}}), User: {{userSummary}} from {{displayCity}}, Domain: {{firstUserDomain}}, Preview: {{titlePreview}}, Range: {{minMetric}}–{{maxMetric}}',
          snapshotVariables: true,
        },
      },
      {
        id: 'ex-log-insufficient', type: 'logDebug', position: { x: 450, y: 900 },
        data: {
          label: 'Log: Insufficient',
          logLevel: 'warn',
          message: 'Only {{totalPosts}} posts found. Activity: {{activityLevel}}. Contains "provident": {{titleHasProvident}}',
          snapshotVariables: true,
        },
      },
      {
        id: 'ex-end', type: 'end', position: { x: 300, y: 1050 },
        data: { label: 'End' },
      },
    ],
    edges: [
      { id: 'ex-e1', source: 'ex-start', target: 'ex-users' },
      { id: 'ex-e2', source: 'ex-users', target: 'ex-user-stats' },
      { id: 'ex-e3', source: 'ex-user-stats', target: 'ex-posts' },
      { id: 'ex-e4', source: 'ex-posts', target: 'ex-post-stats' },
      { id: 'ex-e5', source: 'ex-post-stats', target: 'ex-cond' },
      { id: 'ex-e6', source: 'ex-cond', target: 'ex-log-success', sourceHandle: 'true', label: 'Yes' },
      { id: 'ex-e7', source: 'ex-cond', target: 'ex-log-insufficient', sourceHandle: 'false', label: 'No' },
      { id: 'ex-e8', source: 'ex-log-success', target: 'ex-end' },
      { id: 'ex-e9', source: 'ex-log-insufficient', target: 'ex-end' },
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
      {
        id: 'se-start',
        type: 'start',
        position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: 'se-get-user',
        type: 'http',
        position: { x: 250, y: 120 },
        data: {
          label: '1. Fetch User',
          scenario: {
            id: 'se-s1',
            name: 'Get User',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'userJson', source: 'body', expression: '$' },
            ],
          },
        },
      },
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
      {
        id: 'se-check',
        type: 'condition',
        position: { x: 250, y: 460 },
        data: {
          label: '3. Has Display Name?',
          left: '{{displayName}}',
          operator: '!=',
          right: '',
        },
      },
      {
        id: 'se-end',
        type: 'end',
        position: { x: 300, y: 600 },
        data: { label: 'Done' },
      },
    ],
    edges: [
      { id: 'se-e1', source: 'se-start', target: 'se-get-user' },
      { id: 'se-e2', source: 'se-get-user', target: 'se-script-format' },
      { id: 'se-e3', source: 'se-script-format', target: 'se-check' },
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
      {
        id: 'slm-start',
        type: 'start',
        position: { x: 300, y: 50 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: 'slm-get-users',
        type: 'http',
        position: { x: 300, y: 180 },
        data: {
          label: '1. List Users',
          scenario: {
            id: 'slm-s-users',
            name: 'List Users',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'userCount', source: 'body', expression: '$.length' },
            ],
          },
        },
      },
      {
        id: 'slm-get-posts',
        type: 'http',
        position: { x: 300, y: 320 },
        data: {
          label: '2. List Posts',
          scenario: {
            id: 'slm-s-posts',
            name: 'List Posts',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'postCount', source: 'body', expression: '$.length' },
            ],
          },
        },
      },
      {
        id: 'slm-create-post',
        type: 'http',
        position: { x: 300, y: 460 },
        data: {
          label: '3. Create Post',
          scenario: {
            id: 'slm-s-create',
            name: 'Create Post',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({ title: 'SLA Check', body: 'Automated workflow run', userId: 1 }),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'newPostId', source: 'body', expression: '$.id' },
            ],
          },
        },
      },
      {
        id: 'slm-end',
        type: 'end',
        position: { x: 300, y: 600 },
        data: { label: 'Done' },
      },
    ],
    edges: [
      { id: 'slm-e1', source: 'slm-start', target: 'slm-get-users' },
      { id: 'slm-e2', source: 'slm-get-users', target: 'slm-get-posts' },
      { id: 'slm-e3', source: 'slm-get-posts', target: 'slm-create-post' },
      { id: 'slm-e4', source: 'slm-create-post', target: 'slm-end' },
    ],
    slaTargets: [
      { id: 'slm-sla-agg-p95', metric: 'p95', operator: 'lte', value: 900 },
      { id: 'slm-sla-agg-err', metric: 'errorRate', operator: 'lte', value: 1 },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
