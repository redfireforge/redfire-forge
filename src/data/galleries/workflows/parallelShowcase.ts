import type { Workflow } from '@workflow/types/workflow';

/**
 * Complex parallel execution showcase workflow.
 *
 * Demonstrates multi-branch fork/join with uneven branch depths to
 * make swim-lane visualization impactful:
 *   - Branch A: 3 sequential steps (heavy path)
 *   - Branch B: 1 fast step
 *   - Branch C: 2 medium steps
 *
 * Uses JSONPlaceholder API for all HTTP calls.
 */
export function createParallelShowcaseWorkflow(): Workflow {
  return {
    id: 'sample-workflow-parallel-showcase',
    name: 'Sample: Parallel Showcase (3 Branches)',
    description: 'Three parallel branches with different depths — demonstrates swim-lane grouping and critical path detection.',
    variables: {
      userId: '1',
    },
    nodes: [
      {
        id: 'ps-start',
        type: 'start',
        position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: 'ps-auth',
        type: 'http',
        position: { x: 250, y: 100 },
        data: {
          label: '1. Authenticate',
          scenario: {
            id: 'ps-s1',
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
              { name: 'userEmail', source: 'body', expression: '$.email' },
            ],
          },
        },
      },
      {
        id: 'ps-fork',
        type: 'fork',
        position: { x: 300, y: 230 },
        data: { label: '2. Parallel Data Fetch' },
      },
      // ── Branch A: Content Pipeline (3 steps) ──
      {
        id: 'ps-posts',
        type: 'http',
        position: { x: 20, y: 370 },
        data: {
          label: '3a. Fetch Posts',
          scenario: {
            id: 'ps-s2',
            name: 'Get Posts',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}/posts',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'firstPostId', source: 'body', expression: '$[0].id' },
              { name: 'postCount', source: 'body', expression: '$.length' },
            ],
          },
        },
      },
      {
        id: 'ps-comments',
        type: 'http',
        position: { x: 20, y: 490 },
        data: {
          label: '3b. Fetch Comments',
          scenario: {
            id: 'ps-s3',
            name: 'Get Post Comments',
            url: 'https://jsonplaceholder.typicode.com/posts/{{firstPostId}}/comments',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'commentCount', source: 'body', expression: '$.length' },
            ],
          },
        },
      },
      {
        id: 'ps-post-summary',
        type: 'http',
        position: { x: 20, y: 610 },
        data: {
          label: '3c. Create Summary',
          scenario: {
            id: 'ps-s4',
            name: 'Post Content Summary',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              title: 'Content Summary',
              body: '{{postCount}} posts, {{commentCount}} comments for {{userName}}',
              userId: 1,
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
            validation: { mode: 'none' },
          },
        },
      },
      // ── Branch B: Quick Profile Check (1 step) ──
      {
        id: 'ps-albums',
        type: 'http',
        position: { x: 530, y: 370 },
        data: {
          label: '4a. Fetch Albums',
          scenario: {
            id: 'ps-s5',
            name: 'Get Albums',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}/albums',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'albumCount', source: 'body', expression: '$.length' },
            ],
          },
        },
      },
      // ── Branch C: Activity Pipeline (2 steps) ──
      {
        id: 'ps-todos',
        type: 'http',
        position: { x: 290, y: 370 },
        data: {
          label: '5a. Fetch Todos',
          scenario: {
            id: 'ps-s6',
            name: 'Get Todos',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}/todos',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'todoCount', source: 'body', expression: '$.length' },
              { name: 'firstTodoTitle', source: 'body', expression: '$[0].title' },
            ],
          },
        },
      },
      {
        id: 'ps-todo-detail',
        type: 'http',
        position: { x: 290, y: 490 },
        data: {
          label: '5b. Check Todo Status',
          scenario: {
            id: 'ps-s7',
            name: 'Get First Todo',
            url: 'https://jsonplaceholder.typicode.com/todos/1',
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
              { name: 'todoCompleted', source: 'body', expression: '$.completed' },
            ],
          },
        },
      },
      // ── Join + Final ──
      {
        id: 'ps-join',
        type: 'join',
        position: { x: 300, y: 740 },
        data: { label: '6. Wait for All' },
      },
      {
        id: 'ps-report',
        type: 'http',
        position: { x: 250, y: 850 },
        data: {
          label: '7. Publish Report',
          scenario: {
            id: 'ps-s8',
            name: 'Post User Report',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              title: 'User Activity Report',
              body: 'User: {{userName}} ({{userEmail}})\nPosts: {{postCount}}, Albums: {{albumCount}}, Todos: {{todoCount}}',
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
      { id: 'ps-e1', source: 'ps-start', target: 'ps-auth' },
      { id: 'ps-e2', source: 'ps-auth', target: 'ps-fork' },
      // Branch A
      { id: 'ps-e3', source: 'ps-fork', target: 'ps-posts' },
      { id: 'ps-e4', source: 'ps-posts', target: 'ps-comments' },
      { id: 'ps-e5', source: 'ps-comments', target: 'ps-post-summary' },
      { id: 'ps-e6', source: 'ps-post-summary', target: 'ps-join' },
      // Branch B
      { id: 'ps-e7', source: 'ps-fork', target: 'ps-albums' },
      { id: 'ps-e8', source: 'ps-albums', target: 'ps-join' },
      // Branch C
      { id: 'ps-e9', source: 'ps-fork', target: 'ps-todos' },
      { id: 'ps-e10', source: 'ps-todos', target: 'ps-todo-detail' },
      { id: 'ps-e11', source: 'ps-todo-detail', target: 'ps-join' },
      // After join
      { id: 'ps-e12', source: 'ps-join', target: 'ps-report' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
