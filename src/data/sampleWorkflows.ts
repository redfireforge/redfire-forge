import type { Workflow } from '../types/workflow';

export interface SampleWorkflowEntry {
  id: string;
  name: string;
  description: string;
  factory: () => Workflow;
}

/**
 * Pre-built sample workflow: sequential HTTP calls with variable chaining.
 * Uses jsonplaceholder.typicode.com — a free public REST API with real responses.
 * Flow: Create Post → Check Created? → Wait → Get Post → Verify
 */
function createOrderWorkflow(): Workflow {
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
    variables: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
    },
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
            url: '{{baseUrl}}/posts',
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
            url: '{{baseUrl}}/posts/1',
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
function createParallelForkWorkflow(): Workflow {
  return {
    id: 'sample-workflow-parallel',
    name: 'Sample: Parallel API Calls',
    description: 'Demonstrates Fork and Join nodes for running multiple API calls simultaneously and merging results.',
    variables: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
    },
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
            url: '{{baseUrl}}/posts/1',
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
            url: '{{baseUrl}}/users',
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
            url: '{{baseUrl}}/posts/1/comments',
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
            url: '{{baseUrl}}/posts',
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
 * Sample workflow demonstrating conditional branching with Yes/No paths.
 * Uses jsonplaceholder.typicode.com for real API responses.
 * Flow: Start → Get User → If found (200)? → Yes: Get Posts, No: Create User
 */
function createConditionalBranchWorkflow(): Workflow {
  return {
    id: 'sample-workflow-branching',
    name: 'Sample: Conditional Branching',
    description: 'Demonstrates If/Else branching with different API paths based on conditions.',
    variables: {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      userId: '1',
    },
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
            url: '{{baseUrl}}/users/{{userId}}',
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
            url: '{{baseUrl}}/users/{{userId}}/posts',
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
            url: '{{baseUrl}}/users',
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

/** All available sample workflows. */
export const sampleWorkflowCatalog: SampleWorkflowEntry[] = [
  {
    id: 'sample-workflow-001',
    name: 'Create → Extract → Verify',
    description: 'Sequential HTTP calls with variable chaining, conditions, and delays',
    factory: createOrderWorkflow,
  },
  {
    id: 'sample-workflow-parallel',
    name: 'Parallel API Calls',
    description: 'Fork/Join pattern splits execution into concurrent HTTP requests and merges results',
    factory: createParallelForkWorkflow,
  },
  {
    id: 'sample-workflow-branching',
    name: 'Conditional Branching',
    description: 'If/Else paths leading to different API endpoints',
    factory: createConditionalBranchWorkflow,
  },
];
