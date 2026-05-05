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
];
