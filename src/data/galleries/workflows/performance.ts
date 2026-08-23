/**
 * Performance testing workflow samples.
 * These workflows are designed specifically for load testing demonstrations.
 */

import type { Workflow } from '@workflow/types/workflow';
import {
  makeStartNode,
  makeGetNode,
  makeSetVariableNode,
  makeConditionNode,
  makeForkNode,
  makeJoinNode,
  makeEdge,
  jsonBody,
  bodyExtraction,
} from './nodeFactories';

/**
 * Simple 2-step workflow for basic load testing introduction.
 * POST creates a post, GET verifies it.
 * Uses JSONPlaceholder API.
 */
export function createPerfSimpleWorkflow(): Workflow {
  return {
    id: 'perf-workflow-simple',
    name: 'Perf: Simple POST → GET',
    description: 'Simplest workflow for load testing: create a post, then verify it exists.',
    variables: {
      userId: '1',
    },
    nodes: [
      makeStartNode('ps-start', {}, { x: 250, y: 0 }),
      {
        id: 'ps-create',
        type: 'http',
        position: { x: 200, y: 100 },
        data: {
          label: '1. Create Post',
          scenario: {
            id: 'ps-s1',
            name: 'Create Post',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: JSON.stringify({
              title: 'Load Test Post',
              body: 'This post was created during a performance test iteration.',
              userId: 1,
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [
                { path: '$.status', operator: 'equals', expected: '201' },
              ],
            },
            extractions: [
              { name: 'newPostId', source: 'body', expression: '$.id' },
            ],
          },
        },
      },
      {
        id: 'ps-verify',
        type: 'http',
        position: { x: 200, y: 250 },
        data: {
          label: '2. Get User Posts',
          scenario: {
            id: 'ps-s2',
            name: 'Get User Posts',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}/posts',
            method: 'GET',
            headers: [
              { key: 'Accept', value: 'application/json' },
            ],
            body: '',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [
                { path: '$.status', operator: 'equals', expected: '200' },
              ],
            },
            extractions: [
              { name: 'postCount', source: 'body', expression: '$.length' },
            ],
          },
        },
      },
    ],
    edges: [
      makeEdge('ps-e1', 'ps-start', 'ps-create'),
      makeEdge('ps-e2', 'ps-create', 'ps-verify'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Workflow with conditional branching for load testing.
 * Searches for a country, branches based on found/not-found.
 * Uses REST Countries API.
 */
export function createPerfBranchingWorkflow(): Workflow {
  return {
    id: 'perf-workflow-branching',
    name: 'Perf: Conditional Branching',
    description: 'Load test a workflow with conditional paths: search country, branch on result.',
    variables: {
      searchTerm: 'germany',
      fallbackCode: 'US',
    },
    nodes: [
      makeStartNode('pb-start', {}, { x: 250, y: 0 }),
      makeGetNode('pb-search', '1. Search Country', 'https://restcountries.com/v3.1/name/{{searchTerm}}?fullText=false', {
        x: 200,
        y: 100,
        extractions: [
          bodyExtraction('countryCode', '$[0].cca2'),
          { name: 'searchStatus', source: 'status', expression: '' },
        ],
      }),
      makeConditionNode('pb-cond', '2. Country Found?', '{{searchStatus}}', '200', { x: 240, y: 250 }),
      {
        id: 'pb-details',
        type: 'http',
        position: { x: 50, y: 380 },
        data: {
          label: '3a. Get Details',
          scenario: {
            id: 'pb-s2',
            name: 'Get Country Details',
            url: 'https://restcountries.com/v3.1/alpha/{{countryCode}}',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [
                { path: '$.status', operator: 'equals', expected: '200' },
              ],
            },
            extractions: [
              { name: 'countryName', source: 'body', expression: '$[0].name.common' },
            ],
          },
        },
      },
      {
        id: 'pb-fallback',
        type: 'http',
        position: { x: 350, y: 380 },
        data: {
          label: '3b. Fallback (US)',
          scenario: {
            id: 'pb-s3',
            name: 'Fallback Country',
            url: 'https://restcountries.com/v3.1/alpha/{{fallbackCode}}',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [
                { path: '$.status', operator: 'equals', expected: '200' },
              ],
            },
            extractions: [
              { name: 'countryName', source: 'body', expression: '$[0].name.common' },
            ],
          },
        },
      },
    ],
    edges: [
      makeEdge('pb-e1', 'pb-start', 'pb-search'),
      makeEdge('pb-e2', 'pb-search', 'pb-cond'),
      { id: 'pb-e3', source: 'pb-cond', target: 'pb-details', sourceHandle: 'true', label: 'Yes' },
      { id: 'pb-e4', source: 'pb-cond', target: 'pb-fallback', sourceHandle: 'false', label: 'No' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Fork/Join parallel workflow for load testing.
 * Fetches user, then forks to get posts, todos, and albums in parallel.
 * Uses JSONPlaceholder API.
 */
export function createPerfParallelWorkflow(): Workflow {
  return {
    id: 'perf-workflow-parallel',
    name: 'Perf: Parallel Fork/Join',
    description: 'Load test a workflow with parallel paths: fetch user data across 3 endpoints simultaneously.',
    variables: {
      userId: '1',
    },
    nodes: [
      makeStartNode('pp-start', {}, { x: 300, y: 0 }),
      {
        id: 'pp-user',
        type: 'http',
        position: { x: 250, y: 100 },
        data: {
          label: '1. Get User',
          scenario: {
            id: 'pp-s1',
            name: 'Get User',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [
                { path: '$.status', operator: 'equals', expected: '200' },
              ],
            },
            extractions: [
              { name: 'userName', source: 'body', expression: '$.name' },
            ],
          },
        },
      },
      makeForkNode('pp-fork', 'Fork: Parallel Fetch', { x: 300, y: 220 }),
      makeGetNode('pp-posts', '2a. Get Posts', 'https://jsonplaceholder.typicode.com/users/{{userId}}/posts', {
        x: 50,
        y: 340,
        extractions: [bodyExtraction('postCount', '$.length')],
      }),
      makeGetNode('pp-todos', '2b. Get Todos', 'https://jsonplaceholder.typicode.com/users/{{userId}}/todos', {
        x: 250,
        y: 340,
        extractions: [bodyExtraction('todoCount', '$.length')],
      }),
      makeGetNode('pp-albums', '2c. Get Albums', 'https://jsonplaceholder.typicode.com/users/{{userId}}/albums', {
        x: 450,
        y: 340,
        extractions: [bodyExtraction('albumCount', '$.length')],
      }),
      makeJoinNode('pp-join', 'Join: Wait for All', { x: 300, y: 480 }),
      {
        id: 'pp-verify',
        type: 'http',
        position: { x: 250, y: 580 },
        data: {
          label: '3. Verify User',
          scenario: {
            id: 'pp-s5',
            name: 'Verify User Still Exists',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [
                { path: '$.status', operator: 'equals', expected: '200' },
              ],
            },
            extractions: [],
          },
        },
      },
    ],
    edges: [
      makeEdge('pp-e1', 'pp-start', 'pp-user'),
      makeEdge('pp-e2', 'pp-user', 'pp-fork'),
      makeEdge('pp-e3', 'pp-fork', 'pp-posts'),
      makeEdge('pp-e4', 'pp-fork', 'pp-todos'),
      makeEdge('pp-e5', 'pp-fork', 'pp-albums'),
      makeEdge('pp-e6', 'pp-posts', 'pp-join'),
      makeEdge('pp-e7', 'pp-todos', 'pp-join'),
      makeEdge('pp-e8', 'pp-albums', 'pp-join'),
      makeEdge('pp-e9', 'pp-join', 'pp-verify'),
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Bottleneck analysis demo workflow.
 * Multiple HTTP nodes with varying response characteristics:
 * - Fast endpoint (JSONPlaceholder /posts/1) — consistently fast
 * - Slow endpoint (httpbin.org/delay/1) — intentionally slow (1s delay), will dominate timing
 * - Variable endpoint (JSONPlaceholder /comments?postId=random) — response size varies
 * - Failing endpoint (JSONPlaceholder /posts/999999) — always 404, triggers high-failure bottleneck
 * Run with 10+ iterations. Open Results Explorer to see:
 * - Heatmap coloring (slow node = red, fast = green)
 * - Bottleneck pulsing borders and insights panel
 * - Search/filter to isolate problem nodes
 */
export function createPerfBottleneckDemoWorkflow(): Workflow {
  return {
    id: 'perf-workflow-bottleneck',
    name: 'Perf: Bottleneck Analysis Demo',
    description: 'Workflow with fast, slow, and failing endpoints to demonstrate bottleneck detection, heatmap coloring, and the Results Explorer insights panel.',
    variables: {},
    nodes: [
      makeStartNode('bn-start', {}, { x: 250, y: 0 }),
      {
        id: 'bn-fast',
        type: 'http',
        position: { x: 200, y: 100 },
        data: {
          label: '1. Fast Fetch',
          scenario: {
            id: 'bn-s1',
            name: 'Fast Fetch',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [{ path: '$.status', operator: 'equals', expected: '200' }],
            },
            extractions: [{ name: 'postTitle', source: 'body', expression: '$.title' }],
          },
        },
      },
      {
        id: 'bn-slow',
        type: 'http',
        position: { x: 200, y: 250 },
        data: {
          label: '2. Slow Service',
          scenario: {
            id: 'bn-s2',
            name: 'Slow Service',
            url: 'https://httpbin.org/delay/1',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [{ path: '$.status', operator: 'equals', expected: '200' }],
            },
            extractions: [],
          },
        },
      },
      {
        id: 'bn-variable',
        type: 'http',
        position: { x: 200, y: 400 },
        data: {
          label: '3. Variable Load',
          scenario: {
            id: 'bn-s3',
            name: 'Variable Load',
            url: 'https://jsonplaceholder.typicode.com/posts/1/comments',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [{ path: '$.status', operator: 'equals', expected: '200' }],
            },
            extractions: [{ name: 'commentCount', source: 'body', expression: '$.length' }],
          },
        },
      },
      makeConditionNode('bn-cond', '4. Check Title?', '{{postTitle}}', '', { operator: '!=', x: 240, y: 540 }),
      {
        id: 'bn-failing',
        type: 'http',
        position: { x: 50, y: 680 },
        data: {
          label: '5a. Verify (404)',
          scenario: {
            id: 'bn-s4',
            name: 'Verify Nonexistent',
            url: 'https://jsonplaceholder.typicode.com/posts/999999',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [{ path: '$.status', operator: 'equals', expected: '200' }],
            },
            extractions: [],
          },
        },
      },
      {
        id: 'bn-final',
        type: 'http',
        position: { x: 350, y: 680 },
        data: {
          label: '5b. Final Check',
          scenario: {
            id: 'bn-s5',
            name: 'Final Check',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [{ path: '$.status', operator: 'equals', expected: '200' }],
            },
            extractions: [],
          },
        },
      },
    ],
    edges: [
      makeEdge('bn-e1', 'bn-start', 'bn-fast'),
      makeEdge('bn-e2', 'bn-fast', 'bn-slow'),
      makeEdge('bn-e3', 'bn-slow', 'bn-variable'),
      makeEdge('bn-e4', 'bn-variable', 'bn-cond'),
      { id: 'bn-e5', source: 'bn-cond', target: 'bn-failing', sourceHandle: 'true', label: 'Yes' },
      { id: 'bn-e6', source: 'bn-cond', target: 'bn-final', sourceHandle: 'false', label: 'No' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Branching workflow designed to show edge traversal percentages.
 * A SetVariable node generates a random postId (1–150) each iteration.
 * JSONPlaceholder IDs 1–100 exist (200), 101+ return 404.
 * Condition branches: found → get comments, not found → create post.
 * Expected split: ~67% Found / ~33% Not Found.
 * Run with 20+ iterations to see natural percentage split in Results Explorer.
 */
export function createPerfEdgePercentageWorkflow(): Workflow {
  return {
    id: 'perf-workflow-edge-pct',
    name: 'Perf: Edge Traversal Demo',
    description: 'Demonstrates edge traversal percentages: random postId branches found vs not-found (~67/33 split). Open Results Explorer aggregate view to see % on edges.',
    variables: {},
    nodes: [
      makeStartNode('ep-start', {}, { x: 250, y: 0 }),
      makeSetVariableNode('ep-setvar', 'Random Post ID', [{ id: 'ep-a1', name: 'postId', expression: '{{$randomInt(1, 150)}}' }], {
        x: 200,
        y: 80,
      }),
      makeGetNode('ep-fetch', '1. Fetch Post', 'https://jsonplaceholder.typicode.com/posts/{{postId}}', {
        x: 200,
        y: 180,
        extractions: [
          { name: 'fetchStatus', source: 'status', expression: '' },
          bodyExtraction('postTitle', '$.title'),
        ],
      }),
      makeConditionNode('ep-cond', '2. Post Found?', '{{fetchStatus}}', '200', { x: 240, y: 310 }),
      {
        id: 'ep-found',
        type: 'http',
        position: { x: 50, y: 450 },
        data: {
          label: '3a. Get Comments',
          scenario: {
            id: 'ep-s2',
            name: 'Get Post Comments',
            url: 'https://jsonplaceholder.typicode.com/posts/{{postId}}/comments',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [
                { path: '$.status', operator: 'equals', expected: '200' },
              ],
            },
            extractions: [],
          },
        },
      },
      {
        id: 'ep-notfound',
        type: 'http',
        position: { x: 420, y: 450 },
        data: {
          label: '3b. Create Post',
          scenario: {
            id: 'ep-s3',
            name: 'Create New Post',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: jsonBody({
              title: 'Fallback Post',
              body: 'Created because the random post ID was not found.',
              userId: 1,
            }),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: {
              mode: 'selective',
              assertions: [
                { path: '$.status', operator: 'equals', expected: '201' },
              ],
            },
            extractions: [],
          },
        },
      },
    ],
    edges: [
      makeEdge('ep-e1', 'ep-start', 'ep-setvar'),
      makeEdge('ep-e2', 'ep-setvar', 'ep-fetch'),
      makeEdge('ep-e3', 'ep-fetch', 'ep-cond'),
      { id: 'ep-e4', source: 'ep-cond', target: 'ep-found', sourceHandle: 'true', label: 'Found' },
      { id: 'ep-e5', source: 'ep-cond', target: 'ep-notfound', sourceHandle: 'false', label: 'Not Found' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
