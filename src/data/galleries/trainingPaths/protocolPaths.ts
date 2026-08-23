import type { TrainingPath } from './types';

/** Protocol-specific training paths: GraphQL, gRPC, WebSocket. */
export const protocolPaths: TrainingPath[] = [
  {
    id: 'graphql',
    name: 'GraphQL Studio',
    icon: '🔷',
    description: 'Master the GraphQL Studio — from your first query and schema introspection through mutations, subscriptions, and advanced workflow automation.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'GraphQL Studio Overview',
            description: 'Tour the GraphQL Studio interface — editor, schema explorer, response panel, and environment selector.',
            difficulty: 'easy',
            manualPath: 'graphql/graphql.html',
          },
          {
            title: 'Your First Query',
            description: 'Connect to a live endpoint, run your first query with a literal argument, then refactor it to use a GraphQL variable.',
            difficulty: 'easy',
            sampleId: 'test-graphql-first-query',
            manualPath: 'graphql/graphql-first-query-easy.html',
          },
          {
            title: 'Schema Explorer',
            description: 'Browse types, fields, and arguments from live introspection — understand the schema before you write a query.',
            difficulty: 'easy',
            sampleId: 'test-graphql-health',
            manualPath: 'graphql/graphql-schema-explorer-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Core Operations',
        manuals: [
          {
            title: 'Query Builder',
            description: 'Use the visual query builder to construct multi-field queries, add arguments, and nest selection sets.',
            difficulty: 'medium',
            sampleId: 'test-graphql-crud',
            manualPath: 'graphql/graphql-query-builder-medium.html',
          },
          {
            title: 'Mutations',
            description: 'Write and execute mutations — create, update, and delete resources, then verify the returned payload.',
            difficulty: 'medium',
            sampleId: 'sample-graphql-user-crud',
            manualPath: 'graphql/graphql-mutations-medium.html',
          },
          {
            title: 'Subscriptions',
            description: 'Set up live subscriptions over WebSocket (graphql-ws) or SSE, monitor events, and build assertion rules.',
            difficulty: 'medium',
            sampleId: 'sample-graphql-subscription-ws',
            manualPath: 'graphql/graphql-subscriptions-medium.html',
          },
          {
            title: 'Collections & Environments',
            description: 'Organise queries in collections, switch environments, and share variable sets across tabs.',
            difficulty: 'medium',
            sampleId: 'sample-graphql-e-commerce-flow',
            manualPath: 'graphql/graphql-collections-medium.html',
          },
          {
            title: 'Authentication',
            description: 'Configure Bearer tokens, API-key headers, and cookie-based auth for protected GraphQL endpoints.',
            difficulty: 'medium',
            manualPath: 'graphql/graphql-auth-medium.html',
          },
          {
            title: 'Multi-Tab Workflows',
            description: 'Run parallel queries in multiple tabs, compare responses side-by-side, and coordinate variable sharing.',
            difficulty: 'medium',
            manualPath: 'graphql/graphql-multi-tab-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Advanced Topics',
        manuals: [
          {
            title: 'Mock Server for GraphQL',
            description: 'Stand up a GraphQL mock server, define resolver stubs, and test your client against controlled responses.',
            difficulty: 'advanced',
            manualPath: 'graphql/graphql-mock-server-advanced.html',
          },
          {
            title: 'Code Generation',
            description: 'Generate typed client code from your queries using the built-in code-gen panel.',
            difficulty: 'advanced',
            manualPath: 'graphql/graphql-code-gen-advanced.html',
          },
          {
            title: 'Schema Drift Detection',
            description: 'Compare two introspection snapshots to detect breaking changes, added types, and removed fields.',
            difficulty: 'advanced',
            sampleId: 'sample-graphql-schema-watchdog',
            manualPath: 'graphql/graphql-schema-diff-advanced.html',
          },
          {
            title: 'GraphQL Workflow Nodes',
            description: 'Build end-to-end workflows using graphqlQuery, graphqlMutation, graphqlSubscription, and graphqlAssert nodes.',
            difficulty: 'advanced',
            sampleId: 'sample-graphql-health-check',
            manualPath: 'graphql/graphql-workflow-nodes-advanced.html',
          },
        ],
      },
    ],
  },

  {
    id: 'grpc',
    name: 'gRPC Studio',
    icon: '🔌',
    description: 'Send unary and streaming gRPC calls, manage .proto schemas, and build gRPC test workflows — coming soon.',
    comingSoon: true,
    phases: [
      {
        id: 1,
        name: 'Coming Soon',
        manuals: [
          {
            title: 'gRPC Studio — Coming Soon',
            description: 'Training manuals for gRPC Studio are in progress.',
            difficulty: 'easy',
          },
        ],
      },
    ],
  },

  {
    id: 'websocket',
    name: 'WebSocket Studio',
    icon: '⚡',
    description: 'Open persistent WebSocket connections, send and receive frames, set up event-driven assertions, and automate over WS — coming soon.',
    comingSoon: true,
    phases: [
      {
        id: 1,
        name: 'Coming Soon',
        manuals: [
          {
            title: 'WebSocket Studio — Coming Soon',
            description: 'Training manuals for WebSocket Studio are in progress.',
            difficulty: 'easy',
          },
        ],
      },
    ],
  },
];
