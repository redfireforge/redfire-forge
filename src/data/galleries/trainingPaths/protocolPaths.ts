import type { TrainingPath } from './types';

/** Protocol-specific training paths: GraphQL, gRPC, WebSocket, SSE. */
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
    description: 'Send unary and streaming gRPC calls, manage .proto schemas, configure TLS and mTLS, run a local mock server, and detect schema drift — all from one studio.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'gRPC Studio Overview',
            description: 'Tour the gRPC Studio interface — connection bar, schema panel, method types, and stream log.',
            difficulty: 'easy',
            manualPath: 'grpc/grpc.html',
          },
          {
            title: 'Your First gRPC Call',
            description: 'Connect to a live server, load a schema via reflection, select a unary method, and send your first request.',
            difficulty: 'easy',
            sampleId: 'test-grpc-health',
            manualPath: 'grpc/grpc-first-call-easy.html',
          },
          {
            title: 'Schema Management',
            description: 'Load proto schemas from files, protoset binaries, reflection, BSR, or URL — manage multiple descriptors side by side.',
            difficulty: 'easy',
            manualPath: 'grpc/grpc-schema-management-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Streaming',
        manuals: [
          {
            title: 'Server Streaming',
            description: 'Subscribe to a server-stream RPC — monitor incoming frames, track the stream log, and cancel cleanly.',
            difficulty: 'medium',
            manualPath: 'grpc/grpc-server-streaming-medium.html',
          },
          {
            title: 'Client Streaming',
            description: 'Send multiple messages over a client stream, half-close to receive the server response, and cancel mid-stream.',
            difficulty: 'medium',
            manualPath: 'grpc/grpc-client-streaming-medium.html',
          },
          {
            title: 'Bidirectional Streaming',
            description: 'Open a full-duplex bidi stream — send and receive messages simultaneously, read the interleaved log, and close gracefully.',
            difficulty: 'medium',
            manualPath: 'grpc/grpc-bidi-streaming-medium.html',
          },
          {
            title: 'Collections & History',
            description: 'Save requests to collections, replay from history, import grpcurl commands, and export collections for sharing.',
            difficulty: 'medium',
            manualPath: 'grpc/grpc-collections-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Advanced Topics',
        manuals: [
          {
            title: 'TLS & Transport',
            description: 'Configure Plaintext, TLS, and mTLS modes — set CA certs, client certs, and switch between proxy and native transport.',
            difficulty: 'advanced',
            manualPath: 'grpc/grpc-tls-advanced.html',
          },
          {
            title: 'Mock Server',
            description: 'Start the built-in gRPC mock server, define unary and streaming stubs, and test client code without a real backend.',
            difficulty: 'advanced',
            manualPath: 'grpc/grpc-mock-server-advanced.html',
          },
          {
            title: 'Schema Drift Detection',
            description: 'Compare two schema snapshots to find breaking changes, missing methods, and changed field types — gate deployments in CI.',
            difficulty: 'advanced',
            manualPath: 'grpc/grpc-schema-drift-advanced.html',
          },
          {
            title: 'Interpolation & Variables',
            description: 'Use {{variable}} syntax in targets, headers, and request bodies — switch environments and inject CI secrets without editing requests.',
            difficulty: 'advanced',
            manualPath: 'grpc/grpc-interpolation-advanced.html',
          },
        ],
      },
    ],
  },

  {
    id: 'websocket',
    name: 'WebSocket Studio',
    icon: '⚡',
    description: 'Open persistent WebSocket connections, send and receive frames, set up event-driven assertions, and automate over WS.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'WebSocket Studio Overview',
            description: 'Interface tour, mode switcher, panel layout, protocol support, and learning path map.',
            difficulty: 'easy',
          },
          {
            title: 'Your First Connection',
            description: 'Connect to a public echo server, send a message, observe the echoed response, and disconnect.',
            difficulty: 'easy',
          },
          {
            title: 'Multi-Tab Connections',
            description: 'Run up to 8 independent WebSocket connections simultaneously with isolated state per tab.',
            difficulty: 'easy',
          },
        ],
      },
      {
        id: 2,
        name: 'Intermediate',
        manuals: [
          {
            title: 'Protocol Adapters',
            description: 'Switch between Plain WS, Socket.IO, STOMP, and GraphQL-WS with adapter-specific compose UI.',
            difficulty: 'medium',
          },
          {
            title: 'Authentication',
            description: 'Configure Bearer, API Key, and Basic auth — injected as HTTP upgrade headers via the built-in proxy.',
            difficulty: 'medium',
          },
          {
            title: 'Recording & Replay',
            description: 'Capture a full session to a portable JSON file and replay it at variable speed for bug reproduction and regression testing.',
            difficulty: 'medium',
          },
          {
            title: 'Connection Stats',
            description: 'Monitor real-time message rate, bytes in/out, frame count, and uptime for every connection.',
            difficulty: 'medium',
          },
          {
            title: 'TLS / WSS Configuration',
            description: 'Configure skip-cert, custom CA, and mutual TLS (mTLS) for wss:// connections via the proxy architecture.',
            difficulty: 'medium',
          },
        ],
      },
      {
        id: 3,
        name: 'Advanced',
        manuals: [
          {
            title: 'Mock Server',
            description: 'Run a built-in WebSocket server with match rules, custom responses, latency simulation, and broadcast to all clients.',
            difficulty: 'advanced',
          },
          {
            title: 'Schema Validation',
            description: 'Infer JSON schemas from live traffic or define them manually; validate every frame against your schemas in real time.',
            difficulty: 'advanced',
          },
          {
            title: 'Diff & Console',
            description: 'Compare any two messages side-by-side with the diff modal; use the console command input for scripted send sequences.',
            difficulty: 'advanced',
          },
          {
            title: 'Load Testing',
            description: 'Launch concurrent WebSocket workers to measure throughput, error rate, and P50/P95/P99 latency under load.',
            difficulty: 'advanced',
          },
          {
            title: 'Workflow Runner Integration',
            description: 'Automate WS interactions with wsConnect, wsSend, wsReceive, and wsTrigger nodes in the Workflow Runner.',
            difficulty: 'advanced',
          },
        ],
      },
    ],
  },

  {
    id: 'sse',
    name: 'SSE Studio',
    icon: '📡',
    description: 'Connect to Server-Sent Events streams, monitor live event feeds, filter and bookmark events, configure auth, and inspect connection lifecycle logs — all in one split-pane studio.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'SSE Studio — Overview',
            description: 'Layout map, connection states, event log concepts, SSE wire format quick reference, and learning path.',
            difficulty: 'easy',
            manualPath: 'sse/sse.html',
          },
          {
            title: 'Your First SSE Connection',
            description: 'Enter an endpoint URL, connect, read the status strip, configure auto-reconnect and custom headers, and use env var interpolation.',
            difficulty: 'easy',
            manualPath: 'sse/sse-first-connection-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Event Log & Auth',
        manuals: [
          {
            title: 'Event Log, Filtering & Bookmarks',
            description: 'Search events by text, filter by event type, bookmark rows, export events as JSON, and inspect full event details with JSON auto-detection.',
            difficulty: 'medium',
            manualPath: 'sse/sse-event-filtering-medium.html',
          },
          {
            title: 'Authentication for Protected Streams',
            description: 'Configure Bearer tokens, API Key headers, and global auth profiles — with the "will send" resolved-auth preview and console handshake verification.',
            difficulty: 'medium',
            manualPath: 'sse/sse-auth-medium.html',
          },
          {
            title: 'Console Tab & Lifecycle Logging',
            description: 'Read lifecycle entries (connecting, handshake, error, reconnect), toggle structured/raw views, and use /help /clear /status /reconnect commands.',
            difficulty: 'medium',
            manualPath: 'sse/sse-console-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Advanced Topics',
        manuals: [
          {
            title: 'Multi-Tab Streams & SSE Wire Format',
            description: 'Run up to 8 independent SSE connections simultaneously, understand per-tab isolation and persistence, and master the W3C SSE wire format: fields, multi-line data, retry, and keep-alive comments.',
            difficulty: 'advanced',
            manualPath: 'sse/sse-multi-tab-advanced.html',
          },
        ],
      },
    ],
  },
];
