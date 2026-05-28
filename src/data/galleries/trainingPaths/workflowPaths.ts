import type { TrainingPath } from './types';

/** Workflow category training paths (8 paths covering all workflow sample domains). */
export const workflowPaths: TrainingPath[] = [
  /* ── Workflow: Flow Control ── */
  {
    id: 'wf-flow-control',
    name: 'Workflow: Flow Control',
    icon: '🔀',
    description: 'Conditional branching, switch routing, loops, and error handling patterns in workflow execution.',
    phases: [
      {
        id: 1,
        name: 'Branching Basics',
        manuals: [
          {
            title: 'Flow Control Overview',
            description: 'Category overview of conditional branching, loops, and error recovery nodes.',
            difficulty: 'easy',
            manualPath: 'workflow/flow-control/flow-control.html',
          },
          {
            title: 'Conditional Branching',
            description: 'If/Else conditions with comparison operators, boolean logic, and branch paths.',
            difficulty: 'easy',
            sampleId: 'sample-workflow-branching',
            manualPath: 'workflow/flow-control/conditional-branching-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Routing and Loops',
        manuals: [
          {
            title: 'Switch Order Router',
            description: 'Multi-way routing with switch expressions, case matching, and default fallback.',
            difficulty: 'medium',
            sampleId: 'sample-workflow-switch',
            manualPath: 'workflow/flow-control/switch-order-router-medium.html',
          },
          {
            title: 'Paginated API Fetcher',
            description: 'Loop through paginated API responses with automatic page tracking and aggregation.',
            difficulty: 'medium',
            sampleId: 'sample-workflow-loop-agg',
            manualPath: 'workflow/flow-control/paginated-fetcher-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Error Handling',
        manuals: [
          {
            title: 'Error Handler Node',
            description: 'Per-node error catching with retry logic, backoff strategies, and error classification.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-error-handler',
            manualPath: 'workflow/flow-control/error-handler-advanced.html',
          },
          {
            title: 'Workflow Error Handler',
            description: 'Global workflow-level error handler — catch-all recovery, error context, and graceful degradation.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-wf-error-handler',
            manualPath: 'workflow/flow-control/wf-error-handler-advanced.html',
          },
        ],
      },
    ],
  },

  /* ── Workflow: API Patterns ── */
  {
    id: 'wf-api-patterns',
    name: 'Workflow: API Patterns',
    icon: '🔗',
    description: 'Common API integration patterns — create-extract-verify, parallel calls, debug tracing, and expression functions.',
    phases: [
      {
        id: 1,
        name: 'Core Patterns',
        manuals: [
          {
            title: 'API Patterns Overview',
            description: 'Category overview of common API integration patterns for workflows.',
            difficulty: 'easy',
            manualPath: 'workflow/api-patterns/api-patterns.html',
          },
          {
            title: 'Create → Extract → Verify',
            description: 'POST a resource, extract its ID, then GET to verify creation — the fundamental API test pattern.',
            difficulty: 'easy',
            sampleId: 'sample-workflow-001',
            manualPath: 'workflow/api-patterns/create-extract-verify-easy.html',
          },
          {
            title: 'Parallel API Calls',
            description: 'Fork/Join pattern to call multiple APIs concurrently and aggregate results.',
            difficulty: 'easy',
            sampleId: 'sample-workflow-parallel',
            manualPath: 'workflow/api-patterns/parallel-api-calls-easy.html',
          },
          {
            title: 'Parallel Showcase: Swim Lanes & Critical Path',
            description: 'Three uneven parallel branches demonstrating swim-lane grouping, critical path detection, and branch comparison in the Results Explorer.',
            difficulty: 'medium',
            sampleId: 'sample-workflow-parallel-showcase',
            manualPath: 'workflow/api-patterns/parallel-showcase-medium.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Advanced Patterns',
        manuals: [
          {
            title: 'Expression Functions Showcase',
            description: 'Built-in expression functions for string manipulation, math, dates, and JSON transformation.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-expressions',
            manualPath: 'workflow/api-patterns/expression-functions-advanced.html',
          },
          {
            title: 'Debug Trace Pipeline',
            description: 'Diagnostic workflow with logging, variable inspection, and execution tracing.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-log-debug',
            manualPath: 'workflow/api-patterns/debug-trace-advanced.html',
          },
        ],
      },
    ],
  },

  /* ── Workflow: Diverse APIs ── */
  {
    id: 'wf-diverse-apis',
    name: 'Workflow: Diverse APIs',
    icon: '🌐',
    description: 'Real-world workflow samples integrating multiple public APIs — Pokémon, books, countries, products, and dashboards.',
    phases: [
      {
        id: 1,
        name: 'Single-API Workflows',
        manuals: [
          {
            title: 'Pokémon Evolution Chain',
            description: 'Traverse PokéAPI evolution chains with loops and variable extraction.',
            difficulty: 'easy',
            sampleId: 'sample-workflow-pokemon-evolution',
            manualPath: 'workflow/diverse-apis/pokemon-evolution-easy.html',
          },
          {
            title: 'Country Currency Lookup',
            description: 'Search REST Countries by name and extract currency information.',
            difficulty: 'easy',
            sampleId: 'sample-workflow-country-currency',
            manualPath: 'workflow/diverse-apis/country-currency-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Multi-API Workflows',
        manuals: [
          {
            title: 'Book Search & Enrichment',
            description: 'Search Open Library, extract ISBNs, and enrich with additional book metadata.',
            difficulty: 'medium',
            sampleId: 'sample-workflow-book-search',
            manualPath: 'workflow/diverse-apis/book-search-medium.html',
          },
          {
            title: 'Product Search & Cart',
            description: 'Search products on DummyJSON, filter by criteria, and build a cart workflow.',
            difficulty: 'medium',
            sampleId: 'sample-workflow-product-cart',
            manualPath: 'workflow/diverse-apis/product-cart-medium.html',
          },
          {
            title: 'Multi-API Dashboard',
            description: 'Aggregate data from 3+ APIs into a unified dashboard response.',
            difficulty: 'medium',
            sampleId: 'sample-workflow-multi-api-dashboard',
            manualPath: 'workflow/diverse-apis/multi-api-dashboard-medium.html',
          },
        ],
      },
    ],
  },

  /* ── Workflow: Script Node ── */
  {
    id: 'wf-script-node',
    name: 'Workflow: Script Node',
    icon: '📜',
    description: 'Custom JavaScript execution within workflows — JSON transformation, cross-API validation, and data pipeline reporting.',
    phases: [
      {
        id: 1,
        name: 'Script Basics',
        manuals: [
          {
            title: 'Script Node Overview',
            description: 'Feature manual covering script node capabilities, context API, and execution model.',
            difficulty: 'easy',
            manualPath: 'workflow/script-node/script-node.html',
          },
          {
            title: 'JSON Formatter',
            description: 'Transform and reshape JSON data with a simple script node.',
            difficulty: 'easy',
            sampleId: 'sample-workflow-script-easy',
            manualPath: 'workflow/script-node/json-formatter-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Advanced Scripts',
        manuals: [
          {
            title: 'Cross-API Validator',
            description: 'Script node that compares responses from multiple APIs and flags discrepancies.',
            difficulty: 'medium',
            sampleId: 'sample-workflow-script-medium',
            manualPath: 'workflow/script-node/cross-api-validator-medium.html',
          },
          {
            title: 'Data Pipeline & Report',
            description: 'Multi-stage data pipeline with aggregation, filtering, and report generation via scripts.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-script-advanced',
            manualPath: 'workflow/script-node/data-pipeline-report-advanced.html',
          },
        ],
      },
    ],
  },

  /* ── Workflow: Event-Driven ── */
  {
    id: 'wf-event-driven',
    name: 'Workflow: Event-Driven',
    icon: '📡',
    description: 'Webhook triggers, scheduled execution, and wait-for-condition polling patterns.',
    phases: [
      {
        id: 1,
        name: 'Triggers',
        manuals: [
          {
            title: 'Event-Driven Overview',
            description: 'Category overview of event-driven workflow patterns — triggers, schedules, and wait conditions.',
            difficulty: 'easy',
            manualPath: 'workflow/event-driven/event-driven.html',
          },
          {
            title: 'Webhook Trigger',
            description: 'Start workflows from external HTTP webhooks with payload extraction.',
            difficulty: 'easy',
            sampleId: 'sample-workflow-webhook',
            manualPath: 'workflow/event-driven/webhook-trigger-easy.html',
          },
          {
            title: 'Schedule Trigger',
            description: 'Run workflows on a schedule with cron expressions and interval-based timing.',
            difficulty: 'easy',
            sampleId: 'sample-workflow-schedule',
            manualPath: 'workflow/event-driven/schedule-trigger-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Advanced Event Patterns',
        manuals: [
          {
            title: 'Wait for Condition (Polling)',
            description: 'Pause workflow execution and poll an API until a condition is met or timeout expires.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-wait-condition',
            manualPath: 'workflow/event-driven/wait-condition-advanced.html',
          },
        ],
      },
    ],
  },

  /* ── Workflow: Async Correlation ── */
  {
    id: 'wf-async-correlation',
    name: 'Workflow: Async Correlation',
    icon: '⏳',
    description: 'Pause workflows and resume on matching webhook callbacks — payment flows, approval chains, and parallel async patterns.',
    phases: [
      {
        id: 1,
        name: 'Correlation Basics',
        manuals: [
          {
            title: 'Async Correlation Overview',
            description: 'Feature manual covering correlation wait nodes, webhook matching, and timeout handling.',
            difficulty: 'easy',
            manualPath: 'workflow/async-correlation/async-correlation.html',
          },
          {
            title: 'Payment Gateway Callback',
            description: 'Initiate a payment, pause for webhook callback, and process the result.',
            difficulty: 'easy',
            sampleId: 'sample-workflow-payment-callback-easy',
            manualPath: 'workflow/async-correlation/payment-callback-easy.html',
          },
          {
            title: 'Payment Callback Simulator',
            description: 'Companion simulator that POSTs a fake gateway callback to test the Payment Gateway workflow.',
            difficulty: 'easy',
            sampleId: 'sample-workflow-payment-callback-simulator',
            manualPath: 'workflow/async-correlation/payment-callback-simulator-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Advanced Correlation',
        manuals: [
          {
            title: 'Manager Approval Workflow',
            description: 'Multi-step approval chain with correlation waits at each approval stage.',
            difficulty: 'medium',
            sampleId: 'sample-workflow-approval-medium',
            manualPath: 'workflow/async-correlation/approval-workflow-medium.html',
          },
          {
            title: 'Manager Approval Simulator',
            description: 'Companion simulator that POSTs a fake approval webhook with header correlation.',
            difficulty: 'easy',
            sampleId: 'sample-workflow-approval-simulator',
            manualPath: 'workflow/async-correlation/approval-simulator-easy.html',
          },
          {
            title: 'Parallel Payment Processing',
            description: 'Fork payments to multiple gateways, wait for all callbacks, then reconcile.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-parallel-payment-advanced',
            manualPath: 'workflow/async-correlation/parallel-payment-advanced.html',
          },
          {
            title: 'Parallel Payment Simulator',
            description: 'Companion simulator that sends both card and loyalty callbacks in parallel.',
            difficulty: 'medium',
            sampleId: 'sample-workflow-parallel-payment-simulator',
            manualPath: 'workflow/async-correlation/parallel-payment-simulator-medium.html',
          },
        ],
      },
    ],
  },

  /* ── Workflow: Orchestration ── */
  {
    id: 'wf-orchestration',
    name: 'Workflow: Orchestration',
    icon: '🎭',
    description: 'Complex multi-stage workflows — sub-workflow composition, order pipelines, batch provisioning, and multi-region deployments.',
    phases: [
      {
        id: 1,
        name: 'Orchestration Patterns',
        manuals: [
          {
            title: 'Orchestration Overview',
            description: 'Category overview of orchestration patterns — sub-workflows, pipelines, and batch processing.',
            difficulty: 'easy',
            manualPath: 'workflow/orchestration/orchestration.html',
          },
          {
            title: 'Sub-Workflow Orchestrator',
            description: 'Nest workflows as reusable building blocks with input/output variable mappings.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-sub-workflow',
            manualPath: 'workflow/orchestration/sub-workflow-advanced.html',
          },
          {
            title: 'Order Pipeline with Sub-Workflow',
            description: 'Multi-stage order processing — validate, charge, fulfill, notify — using sub-workflows.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-order-pipeline',
            manualPath: 'workflow/orchestration/order-pipeline-advanced.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Enterprise Orchestration',
        manuals: [
          {
            title: 'Multi-Region Deploy Orchestrator',
            description: 'Deploy to multiple regions in parallel with rollback on failure.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-deploy-orchestrator',
            manualPath: 'workflow/orchestration/deploy-orchestrator-advanced.html',
          },
          {
            title: 'Batch User Provisioning',
            description: 'Loop through user lists, create accounts, assign roles, and report results.',
            difficulty: 'advanced',
            sampleId: 'sample-workflow-batch',
            manualPath: 'workflow/orchestration/batch-provisioning-advanced.html',
          },
        ],
      },
    ],
  },

  /* ── Workflow: Node Reference ── */
  {
    id: 'wf-node-reference',
    name: 'Workflow: Node Reference',
    icon: '📋',
    description: 'Comprehensive reference guide covering every workflow node type, configuration options, and assertion integration.',
    phases: [
      {
        id: 1,
        name: 'Reference Guide',
        manuals: [
          {
            title: 'Workflow Overview',
            description: 'High-level overview of the workflow gallery, sample categories, and getting started.',
            difficulty: 'easy',
            manualPath: 'workflow/workflow.html',
          },
          {
            title: 'Node Reference Guide',
            description: 'Complete reference for all node types — HTTP, Script, Condition, Switch, Loop, Fork/Join, Delay, and more.',
            difficulty: 'medium',
            manualPath: 'workflow/node-reference/node-reference.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Designer Tools',
        manuals: [
          {
            title: 'Designer Console',
            description: 'Live log output during Quick Test — prefix icons, search, dock/float/maximize.',
            difficulty: 'easy',
            manualPath: 'workflow/console-easy.html',
          },
          {
            title: 'Execution History',
            description: 'Browse past Quick Test runs — status, timing, variable snapshots, and re-run.',
            difficulty: 'easy',
            manualPath: 'workflow/execution-history-easy.html',
          },
          {
            title: 'Webhook Delivery Logs',
            description: 'Inspect inbound webhook payloads — headers, body, correlation matches, and replay.',
            difficulty: 'easy',
            manualPath: 'workflow/webhook-delivery-logs-easy.html',
          },
          {
            title: 'Viewport Persistence',
            description: 'Canvas viewport memory — pan/zoom preserved on tab switch, saved with workflow for cross-session restore.',
            difficulty: 'easy',
            manualPath: 'workflow/viewport-persistence-easy.html',
          },
          {
            title: 'Sub-Workflow Samples Guide',
            description: 'Standalone guide to all sub-workflow gallery samples with architecture diagrams.',
            difficulty: 'advanced',
            manualPath: 'sub-workflow-samples-guide.html',
          },
        ],
      },
    ],
  },

  /* ── Workflow: Runner ── */
  {
    id: 'wf-runner',
    name: 'Workflow: Runner',
    icon: '⚡',
    description: 'Run workflows as performance tests — iterations, concurrency, variables, and results analysis.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'Workflow Runner Basics',
            description: 'Navigate to the Workflow Runner, select a workflow, run with defaults, and view results.',
            difficulty: 'easy',
            sampleId: 'perf-workflow-simple',
            manualPath: 'workflow/runner/workflow-runner-basics-easy.html',
          },
          {
            title: 'Runner Comparison',
            description: 'Choose between Test Runner, Parameterized Runner, and Workflow Runner based on your testing goals.',
            difficulty: 'easy',
            manualPath: 'tests/runner-comparison-easy.html',
          },
          {
            title: 'SLA Targets in Workflow Runner',
            description: 'Load the SLA-Monitored Pipeline from the Gallery, configure SLA Override thresholds, run as a load test, inspect pass/fail results, export, run via CLI, and re-import results — end to end.',
            difficulty: 'easy',
            sampleId: 'sample-workflow-sla-monitor',
            manualPath: 'workflow/runner/workflow-sla-end-to-end-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Configuration',
        manuals: [
          {
            title: 'Workflow Variables',
            description: 'Edit initial variables, use variable history, label configurations, and reset to defaults.',
            difficulty: 'medium',
            sampleId: 'perf-workflow-branching',
            manualPath: 'workflow/runner/workflow-runner-variables-medium.html',
          },
          {
            title: 'Iterations & Load',
            description: 'Configure iterations, concurrency, load profiles, and think time for performance testing.',
            difficulty: 'medium',
            sampleId: 'perf-workflow-parallel',
            manualPath: 'workflow/runner/workflow-runner-iterations-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Results Analysis',
        manuals: [
          {
            title: 'Workflow Results',
            description: 'Interpret workflow execution summary, per-step metrics, iteration chart, and drill-down.',
            difficulty: 'medium',
            manualPath: 'workflow/runner/workflow-runner-results-medium.html',
          },
          {
            title: 'Results Explorer',
            description: 'Visual execution analysis — diagram/timeline views, detail panel, iteration matrix, search/filter, heatmap, bottleneck insights, swim lanes, sub-workflow drill-down, and export.',
            difficulty: 'medium',
            sampleId: 'perf-workflow-bottleneck',
            manualPath: 'workflow/runner/results-explorer-medium.html',
          },
          {
            title: 'Timeline View (Gantt Chart)',
            description: 'Visualize workflow execution as a horizontal Gantt chart — time axis, bar colors, aggregate markers, zoom, and sub-workflow indicators.',
            difficulty: 'medium',
            sampleId: 'perf-workflow-bottleneck',
            manualPath: 'workflow/runner/results-explorer-timeline-medium.html',
          },
          {
            title: 'Sub-Workflow Drill-Down',
            description: 'Navigate into nested workflow executions from the Results Explorer — breadcrumb navigation, visual cues, and timeline drill-down.',
            difficulty: 'medium',
            sampleId: 'sample-workflow-sub-workflow',
            manualPath: 'workflow/runner/results-explorer-drilldown-medium.html',
          },
          {
            title: 'Edge Traversal Percentages',
            description: 'Visualize branch path distribution across iterations — see which paths are taken and how often.',
            difficulty: 'easy',
            sampleId: 'perf-workflow-edge-pct',
            manualPath: 'edge-traversal-percentages-guide.html',
          },
        ],
      },
    ],
  },
];
