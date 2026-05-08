/**
 * Performance testing workflow samples.
 * These workflows are designed specifically for load testing demonstrations.
 */

import type { Workflow } from '../../../features/workflow/types/workflow';

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
      {
        id: 'ps-start',
        type: 'start',
        position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
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
      { id: 'ps-e1', source: 'ps-start', target: 'ps-create' },
      { id: 'ps-e2', source: 'ps-create', target: 'ps-verify' },
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
      {
        id: 'pb-start',
        type: 'start',
        position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: 'pb-search',
        type: 'http',
        position: { x: 200, y: 100 },
        data: {
          label: '1. Search Country',
          scenario: {
            id: 'pb-s1',
            name: 'Search Country',
            url: 'https://restcountries.com/v3.1/name/{{searchTerm}}?fullText=false',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'countryCode', source: 'body', expression: '$[0].cca2' },
              { name: 'searchStatus', source: 'status', expression: '' },
            ],
          },
        },
      },
      {
        id: 'pb-cond',
        type: 'condition',
        position: { x: 240, y: 250 },
        data: {
          label: '2. Country Found?',
          left: '{{searchStatus}}',
          operator: '==',
          right: '200',
        },
      },
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
      { id: 'pb-e1', source: 'pb-start', target: 'pb-search' },
      { id: 'pb-e2', source: 'pb-search', target: 'pb-cond' },
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
      {
        id: 'pp-start',
        type: 'start',
        position: { x: 300, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
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
      {
        id: 'pp-fork',
        type: 'fork',
        position: { x: 300, y: 220 },
        data: { label: 'Fork: Parallel Fetch' },
      },
      {
        id: 'pp-posts',
        type: 'http',
        position: { x: 50, y: 340 },
        data: {
          label: '2a. Get Posts',
          scenario: {
            id: 'pp-s2',
            name: 'Get User Posts',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}/posts',
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
        id: 'pp-todos',
        type: 'http',
        position: { x: 250, y: 340 },
        data: {
          label: '2b. Get Todos',
          scenario: {
            id: 'pp-s3',
            name: 'Get User Todos',
            url: 'https://jsonplaceholder.typicode.com/users/{{userId}}/todos',
            method: 'GET',
            headers: [{ key: 'Accept', value: 'application/json' }],
            body: '',
            auth: { type: 'none' },
            validation: { mode: 'none' },
            extractions: [
              { name: 'todoCount', source: 'body', expression: '$.length' },
            ],
          },
        },
      },
      {
        id: 'pp-albums',
        type: 'http',
        position: { x: 450, y: 340 },
        data: {
          label: '2c. Get Albums',
          scenario: {
            id: 'pp-s4',
            name: 'Get User Albums',
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
      {
        id: 'pp-join',
        type: 'join',
        position: { x: 300, y: 480 },
        data: { label: 'Join: Wait for All' },
      },
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
      { id: 'pp-e1', source: 'pp-start', target: 'pp-user' },
      { id: 'pp-e2', source: 'pp-user', target: 'pp-fork' },
      { id: 'pp-e3', source: 'pp-fork', target: 'pp-posts' },
      { id: 'pp-e4', source: 'pp-fork', target: 'pp-todos' },
      { id: 'pp-e5', source: 'pp-fork', target: 'pp-albums' },
      { id: 'pp-e6', source: 'pp-posts', target: 'pp-join' },
      { id: 'pp-e7', source: 'pp-todos', target: 'pp-join' },
      { id: 'pp-e8', source: 'pp-albums', target: 'pp-join' },
      { id: 'pp-e9', source: 'pp-join', target: 'pp-verify' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
