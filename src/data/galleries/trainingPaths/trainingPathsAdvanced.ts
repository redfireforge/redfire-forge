import type { TrainingPath } from './types';

/** Advanced training paths: Environment Manager, Results Dashboard, API Mock Studio, Kafka Protocols, Gallery. */
export const advancedTrainingPaths: TrainingPath[] = [
  /* ── Environment Manager ── */
  {
    id: 'environments',
    name: 'Environment Manager',
    icon: '🌍',
    description: 'Configure environments, microservices, base URLs, variables, and protocol endpoints — the foundation that makes all multi-environment testing possible.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'Environment Manager Overview',
            description: 'Two-panel layout, environment chips, microservice cards, variable system, and active environment selector.',
            difficulty: 'easy',
            manualPath: 'environments/environments.html',
          },
          {
            title: 'Environments Basics',
            description: 'Create environments and microservices, toggle deploy, set a base URL, and verify {{baseUrl}} resolves in a request.',
            difficulty: 'easy',
            manualPath: 'environments/environments-basics-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Variables &amp; Configuration',
        manuals: [
          {
            title: 'Variables &amp; Overrides',
            description: 'Define global vars in the Protocol Vars modal, add per-environment overrides, and use {{varName}} in requests, headers, and bodies.',
            difficulty: 'medium',
            manualPath: 'environments/environments-variables-medium.html',
          },
          {
            title: 'Protocols &amp; Auth',
            description: 'Add gRPC, GraphQL, WebSocket, and SSE protocol tabs; configure per-protocol endpoints per environment; assign auth profiles.',
            difficulty: 'medium',
            manualPath: 'environments/environments-protocols-medium.html',
          },
          {
            title: 'Additional Environments',
            description: 'Add microservice-specific deployment slots, drag-reorder environments and services, and safely delete environments.',
            difficulty: 'medium',
            manualPath: 'environments/environments-additional-env-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Advanced Usage',
        manuals: [
          {
            title: 'Multi-Env Test Runs',
            description: 'Cascade environment in the harness modal, parameterized env rotation, and diagnosing unresolved variable warnings.',
            difficulty: 'advanced',
            manualPath: 'environments/environments-multi-run-advanced.html',
          },
        ],
      },
    ],
  },

  /* ── Results Dashboard ── */
  {
    id: 'results',
    name: 'Results Dashboard',
    icon: '📊',
    description:
      'Analyse test and workflow runs: read metrics, set SLA targets, compare against baselines, detect regressions, and deep-dive execution with the Results Explorer.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'Results Dashboard Overview',
            description:
              'Four-tab layout, run selector, run type filter tabs, header actions, and the Results Explorer modal at a glance.',
            difficulty: 'easy',
            manualPath: 'results/results.html',
          },
          {
            title: 'Reading the Overview Tab',
            description:
              'Navigate runs, read metrics cards (TPS, latency percentiles, error rate), SLA bar, histogram, and export or delete a run.',
            difficulty: 'easy',
            manualPath: 'results/results-overview-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Core Features',
        manuals: [
          {
            title: 'Request Details Tab',
            description:
              'Filter by pass/fail, search by name, group by scenario or feature, paginate, and inspect individual request/response/assertion detail.',
            difficulty: 'medium',
            manualPath: 'results/results-request-details-medium.html',
          },
          {
            title: 'SLA Targets & Check Tree',
            description:
              'Add SLA targets per metric and scope, read the Feature→Scenario→Check accordion, and diagnose SLA failures.',
            difficulty: 'medium',
            manualPath: 'results/results-sla-medium.html',
          },
          {
            title: 'Comparison & Regression',
            description:
              'Mark baselines (★), compare runs, read metric deltas, configure regression thresholds, enable the Trend Chart, and export comparison reports.',
            difficulty: 'medium',
            manualPath: 'results/results-comparison-medium.html',
          },
          {
            title: 'Results Explorer',
            description:
              'Open the full-screen Explorer for workflow runs: execution canvas, node detail tabs, iteration picker, iteration matrix, and console.',
            difficulty: 'medium',
            manualPath: 'results/results-explorer-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Advanced',
        manuals: [
          {
            title: 'Console & Timeline View',
            description:
              'Use the console panel in docked or floating mode, filter by node, search logs, and switch to the Timeline Gantt view with zoom.',
            difficulty: 'medium',
            manualPath: 'results/results-console-timeline-medium.html',
          },
          {
            title: 'Explorer Advanced',
            description:
              'Drill into sub-workflows via the trace stack, inspect parallel branch comparisons, open the data mapper overlay, and export/import traces.',
            difficulty: 'advanced',
            manualPath: 'results/results-explorer-advanced.html',
          },
        ],
      },
    ],
  },

  /* ── API Mock (HTTP) ── */
  {
    id: 'api-mock',
    name: 'API Mock Studio',
    icon: '🔌',
    description:
      'Build and run HTTP mock servers: define routes with rich predicate matching, configure multi-variant responses with template expressions, simulate without running, and manage server libraries.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'API Mock Studio Overview',
            description:
              'Studio layout, route editor tabs, runtime dock tabs, import sources, and key concepts at a glance.',
            difficulty: 'easy',
            manualPath: 'api-mock/api-mock.html',
          },
          {
            title: 'Your First Mock Server',
            description:
              'Create a server, add a route, start the live listener, and send your first request.',
            difficulty: 'easy',
            manualPath: 'api-mock/api-mock-first-server-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Core Features',
        manuals: [
          {
            title: 'Response Variants & Templates',
            description:
              'Create multiple response variants per route, set selection modes (default/condition/sequence/state), and use template expressions in response bodies.',
            difficulty: 'medium',
            manualPath: 'api-mock/api-mock-response-variants-medium.html',
          },
          {
            title: 'Simulate Without Running',
            description:
              'Use the ⚗ Simulate modal to fire test requests against rule config without starting a live server — read predicate traces and near-miss analysis.',
            difficulty: 'medium',
            manualPath: 'api-mock/api-mock-simulate-medium.html',
          },
          {
            title: 'Journal & Conflict Inspector',
            description:
              'Inspect live transactions (matched/unmatched/ambiguous), detect and resolve conflicting routes, manage scenario state and server variables.',
            difficulty: 'medium',
            manualPath: 'api-mock/api-mock-journal-medium.html',
          },
          {
            title: 'Import Routes',
            description:
              'Import from all 7 sources: cURL, OpenAPI, Catalog, Requests collection, native export, WireMock mappings, and HAR captures.',
            difficulty: 'medium',
            manualPath: 'api-mock/api-mock-import-medium.html',
          },
          {
            title: 'Folder Organisation',
            description:
              'Organise routes into folders with context menus, drag-reorder, and the undo toast for safe editing.',
            difficulty: 'medium',
            manualPath: 'api-mock/api-mock-folder-organization-medium.html',
          },
          {
            title: 'Auth-Gated Routes',
            description:
              'Gate routes on Bearer tokens, API Key headers, and mTLS certificate subjects using the security predicate source.',
            difficulty: 'medium',
            manualPath: 'api-mock/api-mock-auth-gated-medium.html',
          },
          {
            title: 'GraphQL Over HTTP Mock',
            description:
              'Dispatch different variant responses per GraphQL operationName using jsonPath body predicates — no special GraphQL mode required.',
            difficulty: 'medium',
            manualPath: 'api-mock/api-mock-graphql-medium.html',
          },
          {
            title: 'Webhook Receiver & Outbound Callbacks',
            description:
              'Capture inbound webhook payloads with body predicates, inspect them in the journal, and fire outbound HTTP callbacks after each matched response.',
            difficulty: 'medium',
            manualPath: 'api-mock/api-mock-webhook-receiver-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Advanced',
        manuals: [
          {
            title: 'Stateful Sequences',
            description:
              'Use state and sequence selection modes to model multi-step workflows, inspect scenario state in the dock, and reset state between test runs.',
            difficulty: 'advanced',
            manualPath: 'api-mock/api-mock-stateful-sequence-advanced.html',
          },
          {
            title: 'Faults, Timing & Pattern Toolbox',
            description:
              'Inject connection-level faults (6 types), configure timing delays and match limits, and use the Pattern Toolbox for regex, JSONPath, XPath, and schema matching.',
            difficulty: 'advanced',
            manualPath: 'api-mock/api-mock-faults-timing-advanced.html',
          },
          {
            title: 'Library & Server Settings',
            description:
              'Manage the server library (park/open/delete), configure host, port, match policies, fallback mode, and export/import server configs natively.',
            difficulty: 'advanced',
            manualPath: 'api-mock/api-mock-export-library-advanced.html',
          },
        ],
      },
    ],
  },

  /* ── Kafka Protocols ── */
  {
    id: 'kafka-protocols',
    name: 'Kafka Protocols',
    icon: '🚀',
    description:
      'Use the Kafka Protocol Studio to publish/consume messages, explore topics, and manage Schema Registry — without writing workflow code.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'Kafka Studio: Getting Started',
            description: 'Set up a cluster, publish your first message, consume it back, and browse topics in one guided session.',
            difficulty: 'easy',
            manualPath: 'kafka/kafka-getting-started-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Exploration Tools',
        manuals: [
          {
            title: 'Kafka Topic Explorer',
            description: 'Browse all topics, inspect partition metadata, filter by domain chips, and read messages from within the explorer.',
            difficulty: 'medium',
            manualPath: 'kafka/kafka-topic-explorer-medium.html',
          },
          {
            title: 'Kafka Schema Registry',
            description: 'Connect a Schema Registry, browse Avro/Protobuf/JSON Schema subjects, compare versions, and copy schemas.',
            difficulty: 'medium',
            manualPath: 'kafka/kafka-schema-registry-medium.html',
          },
        ],
      },
    ],
  },

  /* ── Gallery ── */
  {
    id: 'gallery',
    name: 'Gallery',
    icon: '🖼️',
    description: 'Master the Gallery — browse and import pre-built samples across 9 domains, follow structured Training Tracks with progress tracking, and understand the badge lifecycle for loaded samples.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'Gallery — Overview',
            description: 'Two modes (Samples / Training Paths), 9 domains, card anatomy, filter sidebar, detail panel.',
            difficulty: 'easy',
            manualPath: 'gallery/gallery.html',
          },
          {
            title: 'Browsing the Gallery',
            description: 'Navigate domains, search, apply filters, read detail panels, preview entries, and find related training manuals.',
            difficulty: 'easy',
            manualPath: 'gallery/gallery-samples-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Importing and Learning',
        manuals: [
          {
            title: 'Importing Gallery Samples',
            description: 'Per-domain import actions, ✓ Loaded badge lifecycle, ↻ Reload Updated modal, and navigation after import.',
            difficulty: 'easy',
            manualPath: 'gallery/gallery-import-easy.html',
          },
          {
            title: 'Training Tracks',
            description: 'Open the Training Tracks tab to track progress, mark manuals complete, use Continue Learning and What\'s New, and search with difficulty and status filters.',
            difficulty: 'medium',
            manualPath: 'gallery/gallery-training-paths-medium.html',
          },
        ],
      },
    ],
  },
];
