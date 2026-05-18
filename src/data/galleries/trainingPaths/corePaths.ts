import type { TrainingPath } from './types';

/** Core training paths: Versioning, Workflow Patterns, Auth Strategies, Assertion Mastery. */
export const corePaths: TrainingPath[] = [
  {
    id: 'versioning',
    name: 'Versioning',
    icon: '🔖',
    description: 'Master version control across all 6 entity types — workflows, tests, requests, environments, feature groups, and scripts.',
    phases: [
      {
        id: 1,
        name: 'Workflow Versioning',
        manuals: [
          {
            title: 'Versioning Overview',
            description: 'How versioning works across all entity types — snapshots, diffs, and restore.',
            difficulty: 'easy',
            manualPath: 'versioning/versioning.html',
          },
          {
            title: 'Workflow Version History',
            description: 'Create, browse, rename, and restore workflow version snapshots',
            difficulty: 'easy',
            sampleId: 'sample-workflow-001',
            manualPath: 'versioning/workflow/workflow-version-history-easy.html',
          },
          {
            title: 'Workflow Version Diff',
            description: '4-tab diff modal — Nodes, Edges, Variables, Services comparison',
            difficulty: 'medium',
            sampleId: 'sample-workflow-webhook',
            manualPath: 'versioning/workflow/workflow-version-diff-medium.html',
          },
          {
            title: 'Workflow Version Advanced',
            description: 'Bulk operations, export/import with history, undo persistence',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-sub-workflow',
            manualPath: 'versioning/workflow/workflow-version-advanced.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Test Definition Versioning',
        manuals: [
          {
            title: 'Test Definition History',
            description: 'Snapshots, 20-version cap, canonical JSON fingerprinting, change summaries',
            difficulty: 'easy',
            sampleId: 'test-user-api-smoke',
            manualPath: 'versioning/test/test-definition-history-easy.html',
          },
          {
            title: 'Test Definition Diff',
            description: '5-tab diff — Overview, Headers, Body, Auth, Extractions with tab badges',
            difficulty: 'medium',
            sampleId: 'test-ecommerce-full',
            manualPath: 'versioning/test/test-definition-diff-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Environment Audit Log',
        manuals: [
          {
            title: 'Environment Audit Log',
            description: 'Browse audit entries, filtering, field-level change tracking',
            difficulty: 'easy',
            manualPath: 'versioning/catalog/environment-audit-log-easy.html',
          },
          {
            title: 'Audit Export',
            description: 'JSON/CSV export, 500-entry rotation management',
            difficulty: 'medium',
            manualPath: 'versioning/catalog/environment-audit-export-medium.html',
          },
        ],
      },
      {
        id: 4,
        name: 'Run Baselines',
        manuals: [
          {
            title: 'Run Baselines',
            description: 'Mark test runs as baselines for performance comparison',
            difficulty: 'easy',
            sampleId: 'test-product-listing',
            manualPath: 'versioning/test/run-baselines-easy.html',
          },
          {
            title: 'Baseline Comparison',
            description: 'Trend charts, regression detection via MetricDelta',
            difficulty: 'medium',
            sampleId: 'test-auth-flow',
            manualPath: 'versioning/test/run-baselines-comparison-medium.html',
          },
        ],
      },
      {
        id: 5,
        name: 'Request Definition Versioning',
        manuals: [
          {
            title: 'Request Definition History',
            description: 'Request versioning basics using Get All Users',
            difficulty: 'easy',
            sampleId: 'req-get-all-users',
            manualPath: 'versioning/request/request-definition-history-easy.html',
          },
          {
            title: 'Request Definition Diff',
            description: '4-tab diff (Overview/Headers/Body/Auth) for requests',
            difficulty: 'medium',
            sampleId: 'req-create-post',
            manualPath: 'versioning/request/request-definition-diff-medium.html',
          },
        ],
      },
      {
        id: 6,
        name: 'Feature Group Structure',
        manuals: [
          {
            title: 'Feature Group History',
            description: 'Per-feature-group changelog and structure tracking',
            difficulty: 'easy',
            sampleId: 'test-user-api-smoke',
            manualPath: 'versioning/catalog/feature-group-history-easy.html',
          },
          {
            title: 'Feature Group Comparison',
            description: 'Structure comparison and restore operations',
            difficulty: 'medium',
            sampleId: 'test-country-search',
            manualPath: 'versioning/catalog/feature-group-history-medium.html',
          },
        ],
      },
      {
        id: 7,
        name: 'Script Library Versioning',
        manuals: [
          {
            title: 'Script Library Versioning',
            description: 'Script snapshots, restore, and version management',
            difficulty: 'easy',
            manualPath: 'versioning/advanced/script-library-versioning-easy.html',
          },
          {
            title: 'Script Impact Analysis',
            description: 'Which workflows use this script? Impact analysis across entities',
            difficulty: 'medium',
            manualPath: 'versioning/advanced/script-library-impact-medium.html',
          },
        ],
      },
      {
        id: 8,
        name: 'Cross-Entity Versioning',
        manuals: [
          {
            title: 'Cross-Feature Versioning',
            description: 'Track version changes across entity boundaries — tests, requests, workflows, and feature groups together.',
            difficulty: 'advanced',
            manualPath: 'versioning/cross-entity/cross-feature-versioning-advanced.html',
          },
        ],
      },
    ],
  },
  {
    id: 'workflow-patterns',
    name: 'Workflow Patterns',
    icon: '⚡',
    description: 'Learn conditional branching, parallel execution, error handling, loops, and sub-workflow composition patterns.',
    phases: [
      {
        id: 1,
        name: 'Foundation Nodes',
        manuals: [
          {
            title: 'HTTP Request Chaining',
            description: 'Start/End nodes, HTTP configuration, variable extraction, VariableContext resolution',
            difficulty: 'easy',
            sampleId: 'sample-workflow-001',
            manualPath: 'workflow-patterns/foundation/workflow-http-chaining-easy.html',
          },
          {
            title: 'Delay & Timing Control',
            description: 'Fixed vs random delay modes, rate limiting, abort handling',
            difficulty: 'easy',
            manualPath: 'workflow-patterns/foundation/workflow-delay-timing-easy.html',
          },
          {
            title: 'Variables & Debug Logging',
            description: 'VariableContext 3-layer resolution, SetVariable, LogDebug, built-in generators',
            difficulty: 'easy',
            manualPath: 'workflow-patterns/foundation/workflow-variables-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Branching and Flow Control',
        manuals: [
          {
            title: 'If/Else Condition Branching',
            description: 'ConditionNode operators, Yes/No branches, evaluateCondition, markSubtreeSkipped',
            difficulty: 'medium',
            sampleId: 'sample-workflow-order-pipeline',
            manualPath: 'workflow-patterns/flow-control/workflow-condition-branching-medium.html',
          },
          {
            title: 'Switch Multi-Way Routing',
            description: 'SwitchNode expression matching, case branches, default fallback, Switch vs Condition',
            difficulty: 'medium',
            manualPath: 'workflow-patterns/flow-control/workflow-switch-multiway-medium.html',
          },
          {
            title: 'Parallel Execution (Fork/Join)',
            description: 'Fork parallel branches, Join barrier, thread IDs, waiting state, result aggregation',
            difficulty: 'medium',
            sampleId: 'sample-workflow-deploy-orchestrator',
            manualPath: 'workflow-patterns/flow-control/workflow-fork-join-medium.html',
          },
        ],
      },
      {
        id: 'wf-loops-errors',
        name: 'Phase 3 — Loops and Error Handling',
        manuals: [
          {
            title: 'Loop Patterns',
            description: 'Count, ForEach, and While loop modes — iterate over collections, repeat N times, or poll until a condition changes.',
            difficulty: 'medium',
            manualPath: 'workflow-patterns/loops-errors/workflow-loop-patterns-medium.html',
          },
          {
            title: 'Aggregation Patterns',
            description: 'Collect and combine results with concat, first, last, count, sum, and custom strategies.',
            difficulty: 'medium',
            manualPath: 'workflow-patterns/loops-errors/workflow-aggregate-medium.html',
          },
          {
            title: 'Error Handling Strategies',
            description: 'Node-level retry with backoff, error classification, catch paths, and workflow-level error handlers.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-wf-error-handler',
            manualPath: 'workflow-patterns/loops-errors/workflow-error-handling-advanced.html',
          },
        ],
      },
      {
        id: 'wf-advanced',
        name: 'Phase 4 — Sub-Workflows and Advanced Patterns',
        manuals: [
          {
            title: 'Sub-Workflow Composition',
            description: 'Nest workflows inside workflows — input/output mappings, depth limits, and reusable sub-workflow libraries.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-sub-workflow',
            manualPath: 'workflow-patterns/advanced/workflow-sub-workflow-advanced.html',
          },
          {
            title: 'Webhooks and Correlation Wait',
            description: 'Trigger workflows from external events, pause execution until a matching webhook callback arrives, and handle timeouts.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-webhook',
            manualPath: 'workflow-patterns/advanced/workflow-webhook-correlation-advanced.html',
          },
          {
            title: 'Debugging Workflows',
            description: 'Step-through execution with the debug controller — breakpoints, variable inspection, and fork/join thread debugging.',
            difficulty: 'advanced',
            manualPath: 'workflow-patterns/advanced/workflow-debug-advanced.html',
          },
        ],
      },
    ],
  },
  {
    id: 'auth-strategies',
    name: 'Auth Strategies',
    icon: '🔐',
    description: 'API Key, Bearer Token, OAuth2, Basic Auth, and chained auth flows across tests and workflows.',
    phases: [
      {
        id: 1,
        name: 'Auth Basics',
        manuals: [
          {
            title: 'Bearer Token Authentication',
            description: 'Token field, custom prefix, Authorization header, login-then-extract pattern',
            difficulty: 'easy',
            sampleId: 'req-auth-login',
            manualPath: 'auth-strategies/basics/auth-bearer-token-easy.html',
          },
          {
            title: 'Basic Authentication',
            description: 'Username/password, Base64 encoding, Authorization header, credential validation',
            difficulty: 'easy',
            manualPath: 'auth-strategies/basics/auth-basic-easy.html',
          },
          {
            title: 'API Key Authentication',
            description: 'Key name/value, header vs query placement, custom header names',
            difficulty: 'easy',
            sampleId: 'req-echo-headers',
            manualPath: 'auth-strategies/basics/auth-apikey-easy.html',
          },
          {
            title: 'OAuth2 Client Credentials',
            description: 'Token URL, client ID/secret, TokenManager caching, JWT expiry, auto-refresh',
            difficulty: 'easy',
            manualPath: 'auth-strategies/basics/auth-oauth2-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Auth Inheritance and Profiles',
        manuals: [
          {
            title: 'The Auth Hierarchy',
            description: 'The 5-level inheritance chain: Test → Scenario → Feature Group → Global Profile → Env Fallback.',
            difficulty: 'medium',
            manualPath: 'auth-strategies/inheritance/auth-inheritance-chain-medium.html',
          },
          {
            title: 'Global Auth Profiles',
            description: 'Create reusable named auth configs, link to feature groups, share across projects.',
            difficulty: 'medium',
            manualPath: 'auth-strategies/inheritance/auth-global-profiles-medium.html',
          },
          {
            title: 'Catalog Security Schemes',
            description: 'OpenAPI security schemes, Inherit from Spec mode, schemeToAuthType() mapping.',
            difficulty: 'medium',
            manualPath: 'auth-strategies/inheritance/auth-catalog-security-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Workflow Auth Patterns',
        manuals: [
          {
            title: 'Workflow Auth Patterns',
            description: 'Per-node auth overrides, Service Registry auth resolution, Auth Profiles, and the complete auth resolution order.',
            difficulty: 'advanced',
            manualPath: 'auth-strategies/advanced/auth-workflow-advanced.html',
          },
        ],
      },
    ],
  },
  {
    id: 'assertion-mastery',
    name: 'Assertion Mastery',
    icon: '✅',
    description: 'From simple status checks to structured JSON assertions, regex patterns, and custom validation scripts.',
    phases: [
      {
        id: 'assertion-basics',
        name: 'Phase 1 — Assertion Basics',
        manuals: [
          {
            title: 'Assertion Mastery Overview',
            description: 'How assertions and body validation work together — the two independent validation layers.',
            difficulty: 'easy',
            manualPath: 'assertion-mastery/assertion-mastery.html',
          },
          {
            title: 'Status Code Assertions',
            description: 'Pattern matching for HTTP status codes — exact, range, class wildcard, and comma-separated patterns.',
            difficulty: 'easy',
            manualPath: 'assertion-mastery/basics/assertion-status-codes-easy.html',
          },
          {
            title: 'Response Time Assertions',
            description: 'Set latency thresholds and catch performance regressions with maxMs checks.',
            difficulty: 'easy',
            manualPath: 'assertion-mastery/basics/assertion-response-time-easy.html',
          },
          {
            title: 'Validation Modes',
            description: 'None, Full, and Selective JSON body validation — two independent layers merged into one result.',
            difficulty: 'easy',
            manualPath: 'assertion-mastery/basics/assertion-validation-modes-easy.html',
          },
        ],
      },
      {
        id: 'assertion-intermediate',
        name: 'Phase 2 — Advanced Assertions',
        manuals: [
          {
            title: 'Header Assertions',
            description: 'Validate response headers with equals, contains, exists, and not-exists operators.',
            difficulty: 'medium',
            manualPath: 'assertion-mastery/intermediate/assertion-header-checks-medium.html',
          },
          {
            title: 'JSONPath + Regex Assertions',
            description: 'Extract JSON values by path and match them against regex patterns for flexible validation.',
            difficulty: 'medium',
            manualPath: 'assertion-mastery/intermediate/assertion-jsonpath-regex-medium.html',
          },
          {
            title: 'Numeric and Array Length Assertions',
            description: 'Compare numeric values and array sizes with six operators — range checks, pagination, and price guards.',
            difficulty: 'medium',
            manualPath: 'assertion-mastery/intermediate/assertion-numeric-array-medium.html',
          },
          {
            title: 'Date Assertions',
            description: 'Compare response dates against today or fixed references with UTC/local timezone support.',
            difficulty: 'medium',
            manualPath: 'assertion-mastery/intermediate/assertion-date-comparison-medium.html',
          },
        ],
      },
      {
        id: 'assertion-advanced',
        name: 'Phase 3 — Presets, Composition, and Advanced Patterns',
        manuals: [
          {
            title: 'Assertion Presets',
            description: 'Import ready-made assertion sets from the built-in catalog — API Health Check, Paginated List, Token Expiry, Price Guard, and API Contract.',
            difficulty: 'advanced',
            manualPath: 'assertion-mastery/advanced/assertion-presets-advanced.html',
          },
          {
            title: 'Complex Assertion Strategies',
            description: 'Combine multiple assertion types with validation modes — evaluation order, failure accumulation, and error response testing.',
            difficulty: 'advanced',
            manualPath: 'assertion-mastery/advanced/assertion-composition-advanced.html',
          },
          {
            title: 'Advanced JSONPath and Unordered Arrays',
            description: 'Interactive JSON tree for path selection, unordered array row-based matching, and response/rules versioning.',
            difficulty: 'advanced',
            manualPath: 'assertion-mastery/advanced/assertion-jsonpath-advanced.html',
          },
        ],
      },
      {
        id: 'assertion-preset-samples',
        name: 'Phase 4 — Preset Sample Walkthroughs',
        manuals: [
          {
            title: 'Assertion Presets Overview',
            description: 'Overview of the built-in assertion preset catalog and how to import/customize them.',
            difficulty: 'easy',
            manualPath: 'assertions/assertions.html',
          },
          {
            title: 'API Health Check Preset',
            description: 'Status code + response time check — the simplest ready-made assertion set.',
            difficulty: 'easy',
            sampleId: 'preset-api-healthcheck',
            manualPath: 'assertions/api-healthcheck-easy.html',
          },
          {
            title: 'Paginated List Preset',
            description: 'Array length + pagination field validation for list endpoints.',
            difficulty: 'easy',
            sampleId: 'preset-paginated-list',
            manualPath: 'assertions/paginated-list-easy.html',
          },
          {
            title: 'Token Expiry Preset',
            description: 'JWT regex matching + date assertion for token validation.',
            difficulty: 'medium',
            sampleId: 'preset-token-expiry',
            manualPath: 'assertions/token-expiry-medium.html',
          },
          {
            title: 'Price Guard Preset',
            description: 'Numeric range checks + field presence validation for e-commerce APIs.',
            difficulty: 'medium',
            sampleId: 'preset-price-guard',
            manualPath: 'assertions/price-guard-medium.html',
          },
          {
            title: 'API Contract Preset',
            description: 'Full contract assertion composition — combine all assertion types into comprehensive API validation.',
            difficulty: 'advanced',
            sampleId: 'preset-api-contract',
            manualPath: 'assertions/api-contract-advanced.html',
          },
        ],
      },
    ],
  },
];
