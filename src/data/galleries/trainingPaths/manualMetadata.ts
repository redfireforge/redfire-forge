import type { ManualMetadata } from './types';

/**
 * Metadata for tracking when training manuals were added or updated.
 * Used by the "What's New" feature to highlight recent content.
 *
 * Guidelines:
 * - Add an entry when creating a new manual
 * - Update `updatedAt` and `changeNote` when making significant changes
 * - Minor typo fixes don't need metadata updates
 */

// Helper to create dates as Unix timestamps
const date = (isoString: string): number => new Date(isoString).getTime();

export const manualMetadata: ManualMetadata[] = [
  // ============================================================================
  // Requests Path
  // ============================================================================
  { manualPath: 'requests/get-all-users-easy.html', addedAt: date('2024-01-15') },
  { manualPath: 'requests/get-pokemon-easy.html', addedAt: date('2024-01-15') },
  { manualPath: 'requests/random-dog-easy.html', addedAt: date('2024-01-15') },
  { manualPath: 'requests/search-countries-easy.html', addedAt: date('2024-01-15') },
  { manualPath: 'requests/create-post-easy.html', addedAt: date('2024-01-15') },
  { manualPath: 'requests/search-books-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'requests/paginated-users-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'requests/product-search-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'requests/update-resource-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'requests/delete-resource-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'requests/auth-login-medium.html', addedAt: date('2024-01-25') },
  { manualPath: 'requests/echo-headers-advanced.html', addedAt: date('2024-02-01') },
  { manualPath: 'requests/response-detail-easy.html', addedAt: date('2026-04-15') },

  // ============================================================================
  // Tests Path
  // ============================================================================
  { manualPath: 'tests/tests.html', addedAt: date('2024-01-10') },
  { manualPath: 'tests/json-data-files-easy.html', addedAt: date('2024-01-10') },
  { manualPath: 'tests/user-api-smoke-easy.html', addedAt: date('2024-01-15') },
  { manualPath: 'tests/product-listing-easy.html', addedAt: date('2024-01-15') },
  { manualPath: 'tests/paginated-regression-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'tests/pokemon-contract-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'tests/country-search-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'tests/auth-flow-medium.html', addedAt: date('2024-01-25') },
  { manualPath: 'tests/performance-regression-tracking.html', addedAt: date('2026-05-29') },
  { manualPath: 'tests/ecommerce-full-advanced.html', addedAt: date('2024-02-01') },
  { manualPath: 'tests/multi-api-load-advanced.html', addedAt: date('2024-02-01') },
  { manualPath: 'tests/export-options-easy.html', addedAt: date('2026-04-20') },

  // Parameterized Testing (Phase 4)
  {
    manualPath: 'tests/parameterized-basics-easy.html',
    addedAt: date('2024-03-01'),
    updatedAt: date('2026-05-09'),
    changeNote: 'Updated Runner references for three-runner architecture (Parameterized Runner)',
  },
  { manualPath: 'tests/parameterized-user-sweep-easy.html', addedAt: date('2026-05-04') },
  { manualPath: 'tests/parameterized-product-search-easy.html', addedAt: date('2026-05-04') },
  { manualPath: 'tests/parameterized-row-tags-easy.html', addedAt: date('2026-05-04') },
  { manualPath: 'tests/parameterized-create-copy-easy.html', addedAt: date('2026-04-15') },
  { manualPath: 'tests/parameterized-rerun-failed-easy.html', addedAt: date('2026-04-15') },
  { manualPath: 'tests/parameterized-file-import-easy.html', addedAt: date('2024-03-15') },
  { manualPath: 'tests/parameterized-country-validation-medium.html', addedAt: date('2026-05-04') },
  { manualPath: 'tests/parameterized-pokemon-contract-medium.html', addedAt: date('2026-05-04') },
  { manualPath: 'tests/parameterized-pre-validate-medium.html', addedAt: date('2024-03-15') },
  { manualPath: 'tests/parameterized-multi-endpoint-advanced.html', addedAt: date('2024-03-20') },
  { manualPath: 'tests/parameterized-auth-rotation-advanced.html', addedAt: date('2026-05-04') },
  { manualPath: 'tests/parameterized-populate-api-medium.html', addedAt: date('2026-04-20') },
  { manualPath: 'tests/parameterized-validation-medium.html', addedAt: date('2026-04-20') },
  { manualPath: 'tests/parameterized-advanced-features-medium.html', addedAt: date('2026-04-25') },
  { manualPath: 'tests/parameterized-verify-contract-advanced.html', addedAt: date('2026-04-25') },

  // Trash Box Recovery
  { manualPath: 'tests/trash-recovery-easy.html', addedAt: date('2026-05-20') },

  // Shared Data Sources (Phase 5)
  { manualPath: 'tests/shared-data-sources-easy.html', addedAt: date('2024-04-01') },
  { manualPath: 'tests/shared-data-sources-fetch-medium.html', addedAt: date('2024-04-05') },
  { manualPath: 'tests/shared-data-sources-cross-fg-medium.html', addedAt: date('2024-04-05') },
  { manualPath: 'tests/shared-data-sources-advanced.html', addedAt: date('2024-04-10') },

  // ============================================================================
  // API Catalog Path
  // ============================================================================
  { manualPath: 'catalog/catalog.html', addedAt: date('2024-01-10'), updatedAt: date('2026-05-17'), changeNote: 'Added Section 6: Send to Harness, Host Warnings, Additional Environments' },
  { manualPath: 'catalog/jsonplaceholder-easy.html', addedAt: date('2024-01-15') },
  { manualPath: 'catalog/fakestore-easy.html', addedAt: date('2024-01-15') },
  { manualPath: 'catalog/dummyjson-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'catalog/pokeapi-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'catalog/rest-countries-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'catalog/pet-store-api-easy.html', addedAt: date('2026-05-04') },
  { manualPath: 'catalog/correlation-wait-api-medium.html', addedAt: date('2026-05-04') },
  { manualPath: 'catalog/httpbin-advanced.html', addedAt: date('2024-02-01') },
  { manualPath: 'catalog/send-to-harness-easy.html', addedAt: date('2026-05-17') },
  { manualPath: 'catalog/additional-environments-easy.html', addedAt: date('2026-05-17') },

  // ============================================================================
  // Versioning Path
  // ============================================================================
  { manualPath: 'versioning/overview.html', addedAt: date('2024-02-15') },
  { manualPath: 'versioning/requests-easy.html', addedAt: date('2024-02-15') },
  { manualPath: 'versioning/tests-easy.html', addedAt: date('2024-02-15') },
  { manualPath: 'versioning/workflow-medium.html', addedAt: date('2024-02-20') },
  { manualPath: 'versioning/structure-log-easy.html', addedAt: date('2026-04-20') },

  // ============================================================================
  // Workflow Paths
  // ============================================================================
  // Flow Control
  { manualPath: 'workflow/flow/sequential-requests.html', addedAt: date('2024-03-01') },
  { manualPath: 'workflow/flow/branch-conditions.html', addedAt: date('2024-03-01') },
  { manualPath: 'workflow/flow/parallel-fork.html', addedAt: date('2024-03-05') },
  { manualPath: 'workflow/flow/loops.html', addedAt: date('2024-03-05') },

  // API Patterns
  { manualPath: 'workflow/api/chain-extraction.html', addedAt: date('2024-03-10') },
  { manualPath: 'workflow/api/auth-refresh.html', addedAt: date('2024-03-10') },
  { manualPath: 'workflow/api/retry-logic.html', addedAt: date('2024-03-15') },

  // Async Correlation
  { manualPath: 'workflow/async-correlation/basics.html', addedAt: date('2024-04-01') },
  { manualPath: 'workflow/async-correlation/payment-callback-simulator-easy.html', addedAt: date('2026-05-04') },
  { manualPath: 'workflow/async-correlation/approval-simulator-easy.html', addedAt: date('2026-05-04') },
  { manualPath: 'workflow/async-correlation/parallel-payment-simulator-medium.html', addedAt: date('2026-05-04') },

  // Workflow Misc
  { manualPath: 'workflow/console-easy.html', addedAt: date('2026-04-20') },
  { manualPath: 'workflow/execution-history-easy.html', addedAt: date('2026-04-20') },
  { manualPath: 'workflow/webhook-delivery-logs-easy.html', addedAt: date('2026-04-25') },
  { manualPath: 'workflow/viewport-persistence-easy.html', addedAt: date('2026-05-17') },

  // Edge Traversal Percentages
  { manualPath: 'edge-traversal-percentages-guide.html', addedAt: date('2026-05-07') },

  // Results Explorer
  { manualPath: 'workflow/runner/results-explorer-medium.html', addedAt: date('2026-05-08'), updatedAt: date('2026-05-09'), changeNote: 'Added Timeline view, sub-workflow drill-down, and parallel swim lanes sections' },

  // Results Explorer — Timeline View
  { manualPath: 'workflow/runner/results-explorer-timeline-medium.html', addedAt: date('2026-05-09') },

  // Results Explorer — Sub-Workflow Drill-Down
  { manualPath: 'workflow/runner/results-explorer-drilldown-medium.html', addedAt: date('2026-05-09') },

  // Parallel Showcase (Swim Lanes & Critical Path)
  { manualPath: 'workflow/api-patterns/parallel-showcase-medium.html', addedAt: date('2026-05-09') },

  // Runner Redesign — new manuals
  { manualPath: 'tests/test-runner-guide-easy.html', addedAt: date('2026-05-09') },
  { manualPath: 'tests/parameterized-runner-guide-easy.html', addedAt: date('2026-05-09') },
  { manualPath: 'tests/scenario-types-guide-easy.html', addedAt: date('2026-05-09') },

  // Runner Comparison — updated for three-runner architecture
  {
    manualPath: 'tests/runner-comparison-easy.html',
    addedAt: date('2024-01-10'),
    updatedAt: date('2026-05-09'),
    changeNote: 'Rewritten for three-runner architecture (Test Runner, Parameterized Runner, Workflow Runner)',
  },

  // ============================================================================
  // Requests Path — Overview
  // ============================================================================
  { manualPath: 'requests/requests.html', addedAt: date('2024-01-10') },

  // ============================================================================
  // Versioning Path (corePaths)
  // ============================================================================
  { manualPath: 'versioning/versioning.html', addedAt: date('2024-02-15') },
  { manualPath: 'versioning/workflow/workflow-version-history-easy.html', addedAt: date('2024-02-15') },
  { manualPath: 'versioning/workflow/workflow-version-diff-medium.html', addedAt: date('2024-02-20') },
  { manualPath: 'versioning/workflow/workflow-version-advanced.html', addedAt: date('2024-02-20') },
  { manualPath: 'versioning/test/test-definition-history-easy.html', addedAt: date('2024-02-15') },
  { manualPath: 'versioning/test/test-definition-diff-medium.html', addedAt: date('2024-02-20') },
  { manualPath: 'versioning/catalog/environment-audit-log-easy.html', addedAt: date('2024-02-15') },
  { manualPath: 'versioning/catalog/environment-audit-export-medium.html', addedAt: date('2024-02-20') },
  { manualPath: 'versioning/test/run-baselines-easy.html', addedAt: date('2024-02-15') },
  { manualPath: 'versioning/test/run-baselines-comparison-medium.html', addedAt: date('2024-02-20') },
  { manualPath: 'versioning/request/request-definition-history-easy.html', addedAt: date('2024-02-15') },
  { manualPath: 'versioning/request/request-definition-diff-medium.html', addedAt: date('2024-02-20') },
  { manualPath: 'versioning/catalog/feature-group-history-easy.html', addedAt: date('2024-02-15') },
  { manualPath: 'versioning/catalog/feature-group-history-medium.html', addedAt: date('2024-02-20') },
  { manualPath: 'versioning/advanced/script-library-versioning-easy.html', addedAt: date('2024-02-25') },
  { manualPath: 'versioning/advanced/script-library-impact-medium.html', addedAt: date('2024-02-25') },
  { manualPath: 'versioning/cross-entity/cross-feature-versioning-advanced.html', addedAt: date('2024-03-01') },

  // ============================================================================
  // Workflow Patterns Path (corePaths)
  // ============================================================================
  { manualPath: 'workflow-patterns/workflow-patterns.html', addedAt: date('2024-03-01') },
  { manualPath: 'workflow-patterns/foundation/workflow-http-chaining-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'workflow-patterns/foundation/workflow-delay-timing-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'workflow-patterns/foundation/workflow-variables-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'workflow-patterns/flow-control/workflow-condition-branching-medium.html', addedAt: date('2024-03-05') },
  { manualPath: 'workflow-patterns/flow-control/workflow-switch-multiway-medium.html', addedAt: date('2024-03-05') },
  { manualPath: 'workflow-patterns/flow-control/workflow-fork-join-medium.html', addedAt: date('2024-03-05') },
  { manualPath: 'workflow-patterns/loops-errors/workflow-loop-patterns-medium.html', addedAt: date('2024-03-10') },
  { manualPath: 'workflow-patterns/loops-errors/workflow-aggregate-medium.html', addedAt: date('2024-03-10') },
  { manualPath: 'workflow-patterns/loops-errors/workflow-error-handling-advanced.html', addedAt: date('2024-03-15') },
  { manualPath: 'workflow-patterns/advanced/workflow-sub-workflow-advanced.html', addedAt: date('2024-03-15') },
  { manualPath: 'workflow-patterns/advanced/workflow-webhook-correlation-advanced.html', addedAt: date('2024-03-15') },
  { manualPath: 'workflow-patterns/advanced/workflow-debug-advanced.html', addedAt: date('2024-03-15') },

  // ============================================================================
  // Auth Strategies Path (corePaths)
  // ============================================================================
  { manualPath: 'auth-strategies/auth-strategies.html', addedAt: date('2024-03-01') },
  { manualPath: 'auth-strategies/basics/auth-bearer-token-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'auth-strategies/basics/auth-basic-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'auth-strategies/basics/auth-apikey-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'auth-strategies/basics/auth-oauth2-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'auth-strategies/inheritance/auth-inheritance-chain-medium.html', addedAt: date('2024-03-05') },
  { manualPath: 'auth-strategies/inheritance/auth-global-profiles-medium.html', addedAt: date('2024-03-05') },
  { manualPath: 'auth-strategies/inheritance/auth-catalog-security-medium.html', addedAt: date('2024-03-05') },
  { manualPath: 'auth-strategies/advanced/auth-workflow-advanced.html', addedAt: date('2024-03-10') },

  // ============================================================================
  // Assertion Mastery Path (corePaths)
  // ============================================================================
  { manualPath: 'assertion-mastery/assertion-mastery.html', addedAt: date('2024-03-01') },
  { manualPath: 'assertion-mastery/basics/assertion-status-codes-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'assertion-mastery/basics/assertion-response-time-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'assertion-mastery/basics/assertion-validation-modes-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'assertion-mastery/intermediate/assertion-header-checks-medium.html', addedAt: date('2024-03-05') },
  { manualPath: 'assertion-mastery/intermediate/assertion-jsonpath-regex-medium.html', addedAt: date('2024-03-05') },
  { manualPath: 'assertion-mastery/intermediate/assertion-numeric-array-medium.html', addedAt: date('2024-03-05') },
  { manualPath: 'assertion-mastery/intermediate/assertion-date-comparison-medium.html', addedAt: date('2024-03-05') },
  { manualPath: 'assertion-mastery/advanced/assertion-presets-advanced.html', addedAt: date('2024-03-10') },
  { manualPath: 'assertion-mastery/advanced/assertion-composition-advanced.html', addedAt: date('2024-03-10') },
  { manualPath: 'assertion-mastery/advanced/assertion-jsonpath-advanced.html', addedAt: date('2024-03-10') },
  { manualPath: 'assertions/assertions.html', addedAt: date('2024-03-10') },
  { manualPath: 'assertions/api-healthcheck-easy.html', addedAt: date('2024-03-10') },
  { manualPath: 'assertions/paginated-list-easy.html', addedAt: date('2024-03-10') },
  { manualPath: 'assertions/token-expiry-medium.html', addedAt: date('2024-03-15') },
  { manualPath: 'assertions/price-guard-medium.html', addedAt: date('2024-03-15') },
  { manualPath: 'assertions/api-contract-advanced.html', addedAt: date('2024-03-15') },

  // ============================================================================
  // Workflow: Flow Control (workflowPaths)
  // ============================================================================
  { manualPath: 'workflow/flow-control/flow-control.html', addedAt: date('2024-03-01') },
  { manualPath: 'workflow/flow-control/conditional-branching-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'workflow/flow-control/switch-order-router-medium.html', addedAt: date('2024-03-05') },
  { manualPath: 'workflow/flow-control/paginated-fetcher-medium.html', addedAt: date('2024-03-05') },
  { manualPath: 'workflow/flow-control/error-handler-advanced.html', addedAt: date('2024-03-10') },
  { manualPath: 'workflow/flow-control/wf-error-handler-advanced.html', addedAt: date('2024-03-10') },

  // ============================================================================
  // Workflow: API Patterns (workflowPaths)
  // ============================================================================
  { manualPath: 'workflow/api-patterns/api-patterns.html', addedAt: date('2024-03-01') },
  { manualPath: 'workflow/api-patterns/create-extract-verify-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'workflow/api-patterns/parallel-api-calls-easy.html', addedAt: date('2024-03-01') },
  { manualPath: 'workflow/api-patterns/expression-functions-advanced.html', addedAt: date('2024-03-10') },
  { manualPath: 'workflow/api-patterns/debug-trace-advanced.html', addedAt: date('2024-03-10') },

  // ============================================================================
  // Workflow: Diverse APIs (workflowPaths)
  // ============================================================================
  { manualPath: 'workflow/diverse-apis/pokemon-evolution-easy.html', addedAt: date('2024-03-15') },
  { manualPath: 'workflow/diverse-apis/country-currency-easy.html', addedAt: date('2024-03-15') },
  { manualPath: 'workflow/diverse-apis/book-search-medium.html', addedAt: date('2024-03-20') },
  { manualPath: 'workflow/diverse-apis/product-cart-medium.html', addedAt: date('2024-03-20') },
  { manualPath: 'workflow/diverse-apis/multi-api-dashboard-medium.html', addedAt: date('2024-03-20') },

  // ============================================================================
  // Workflow: Script Node (workflowPaths)
  // ============================================================================
  { manualPath: 'workflow/script-node/script-node.html', addedAt: date('2024-03-15') },
  { manualPath: 'workflow/script-node/json-formatter-easy.html', addedAt: date('2024-03-15') },
  { manualPath: 'workflow/script-node/cross-api-validator-medium.html', addedAt: date('2024-03-20') },
  { manualPath: 'workflow/script-node/data-pipeline-report-advanced.html', addedAt: date('2024-03-20') },

  // ============================================================================
  // Workflow: Event-Driven (workflowPaths)
  // ============================================================================
  { manualPath: 'workflow/event-driven/event-driven.html', addedAt: date('2024-03-15') },
  { manualPath: 'workflow/event-driven/webhook-trigger-easy.html', addedAt: date('2024-03-15') },
  { manualPath: 'workflow/event-driven/schedule-trigger-easy.html', addedAt: date('2024-03-15') },
  { manualPath: 'workflow/event-driven/wait-condition-advanced.html', addedAt: date('2024-03-20') },

  // ============================================================================
  // Workflow: Async Correlation (workflowPaths)
  // ============================================================================
  { manualPath: 'workflow/async-correlation/async-correlation.html', addedAt: date('2024-04-01') },
  { manualPath: 'workflow/async-correlation/payment-callback-easy.html', addedAt: date('2024-04-01') },
  { manualPath: 'workflow/async-correlation/approval-workflow-medium.html', addedAt: date('2024-04-05') },
  { manualPath: 'workflow/async-correlation/parallel-payment-advanced.html', addedAt: date('2024-04-05') },

  // ============================================================================
  // Workflow: Orchestration (workflowPaths)
  // ============================================================================
  { manualPath: 'workflow/orchestration/orchestration.html', addedAt: date('2024-04-01') },
  { manualPath: 'workflow/orchestration/sub-workflow-advanced.html', addedAt: date('2024-04-01') },
  { manualPath: 'workflow/orchestration/order-pipeline-advanced.html', addedAt: date('2024-04-01') },
  { manualPath: 'workflow/orchestration/deploy-orchestrator-advanced.html', addedAt: date('2024-04-05') },
  { manualPath: 'workflow/orchestration/batch-provisioning-advanced.html', addedAt: date('2024-04-05') },

  // ============================================================================
  // Workflow: Node Reference (workflowPaths)
  // ============================================================================
  { manualPath: 'workflow/workflow.html', addedAt: date('2024-03-01') },
  { manualPath: 'workflow/node-reference/node-reference.html', addedAt: date('2024-03-10') },
  { manualPath: 'sub-workflow-samples-guide.html', addedAt: date('2026-05-04') },

  // ============================================================================
  // Workflow: Runner (workflowPaths)
  // ============================================================================
  { manualPath: 'workflow/runner/workflow-runner-basics-easy.html', addedAt: date('2026-05-09') },
  { manualPath: 'workflow/runner/workflow-runner-variables-medium.html', addedAt: date('2026-05-09') },
  { manualPath: 'workflow/runner/workflow-runner-iterations-medium.html', addedAt: date('2026-05-09') },
  { manualPath: 'workflow/runner/workflow-runner-results-medium.html', addedAt: date('2026-05-09') },
  { manualPath: 'workflow/runner/workflow-sla-end-to-end-easy.html', addedAt: date('2026-06-06') },

  // ============================================================================
  // Data Mapper
  // ============================================================================
  { manualPath: 'data-mapper/data-mapper-basics-easy.html', addedAt: date('2026-05-10'), updatedAt: date('2026-05-14'), changeNote: 'Added keyboard navigation, hover-to-highlight, and line visibility toggle sections' },
  { manualPath: 'data-mapper/data-mapper-expressions-medium.html', addedAt: date('2026-05-10'), updatedAt: date('2026-05-14'), changeNote: 'Added expression editor (125 functions) and mapping profiles sections' },
  { manualPath: 'data-mapper/data-mapper-arrays-medium.html', addedAt: date('2026-05-10'), updatedAt: date('2026-05-14'), changeNote: 'Added validation operators and verify rules sections' },
  { manualPath: 'data-mapper/data-mapper-workflow-advanced.html', addedAt: date('2026-05-10'), updatedAt: date('2026-05-14'), changeNote: 'Added operator selection, code mode, and verify scope sections' },
  { manualPath: 'data-mapper/data-mapper-target-schema-medium.html', addedAt: date('2026-05-11'), updatedAt: date('2026-05-14'), changeNote: 'Added field operators, DSL code editor, floating editor, verify & failure navigation sections' },
  { manualPath: 'data-mapper/data-mapper-schema-drift-advanced.html', addedAt: date('2026-05-11'), updatedAt: date('2026-05-14'), changeNote: 'Added schema contract (strict/lenient) and type mismatch auto-fix sections' },
  { manualPath: 'data-mapper/data-mapper-debugger-advanced.html', addedAt: date('2026-05-11'), updatedAt: date('2026-05-14'), changeNote: 'Added keyboard navigation, hover-highlight, mapping profiles, and Code vs Rules distinction' },
  { manualPath: 'data-mapper/data-mapper-operators-dsl-advanced.html', addedAt: date('2026-05-14') },
  { manualPath: 'data-mapper/data-mapper-custom-assertions-advanced.html', addedAt: date('2026-05-14') },
  { manualPath: 'data-mapper/data-mapper-operators-products-medium.html', addedAt: date('2026-05-14') },
  { manualPath: 'data-mapper/data-mapper-users-validation-medium.html', addedAt: date('2026-05-14') },
  { manualPath: 'data-mapper/data-mapper-array-assertions-advanced.html', addedAt: date('2026-05-14') },

  // ============================================================================
  // Workflow: Kafka Event-Driven (workflowPaths)
  // ============================================================================
  { manualPath: 'workflow/event-driven/kafka-produce-easy.html', addedAt: date('2026-06-06') },
  { manualPath: 'workflow/event-driven/kafka-trigger-easy.html', addedAt: date('2026-06-06') },
  { manualPath: 'workflow/event-driven/kafka-event-pipeline-medium.html', addedAt: date('2026-06-06') },
  { manualPath: 'workflow/event-driven/kafka-async-correlation-advanced.html', addedAt: date('2026-06-06') },

  // ============================================================================
  // Kafka Protocols (contentPaths)
  // ============================================================================
  { manualPath: 'kafka/kafka-getting-started-easy.html', addedAt: date('2026-06-06') },
  { manualPath: 'kafka/kafka-topic-explorer-medium.html', addedAt: date('2026-06-06') },
  { manualPath: 'kafka/kafka-schema-registry-medium.html', addedAt: date('2026-06-06') },

  // ============================================================================
  // GraphQL Studio Path (protocolPaths)
  // ============================================================================
  { manualPath: 'graphql/graphql.html', addedAt: date('2026-08-23') },
  { manualPath: 'graphql/graphql-first-query-easy.html', addedAt: date('2026-08-23') },
  { manualPath: 'graphql/graphql-schema-explorer-easy.html', addedAt: date('2026-08-23') },
  { manualPath: 'graphql/graphql-query-builder-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'graphql/graphql-mutations-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'graphql/graphql-subscriptions-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'graphql/graphql-collections-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'graphql/graphql-auth-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'graphql/graphql-multi-tab-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'graphql/graphql-mock-server-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'graphql/graphql-code-gen-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'graphql/graphql-schema-diff-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'graphql/graphql-workflow-nodes-advanced.html', addedAt: date('2026-08-23') },
  // gRPC Studio — added 2026-08-23
  { manualPath: 'grpc/grpc.html', addedAt: date('2026-08-23') },
  { manualPath: 'grpc/grpc-first-call-easy.html', addedAt: date('2026-08-23') },
  { manualPath: 'grpc/grpc-schema-management-easy.html', addedAt: date('2026-08-23') },
  { manualPath: 'grpc/grpc-server-streaming-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'grpc/grpc-client-streaming-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'grpc/grpc-bidi-streaming-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'grpc/grpc-collections-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'grpc/grpc-tls-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'grpc/grpc-mock-server-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'grpc/grpc-schema-drift-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'grpc/grpc-interpolation-advanced.html', addedAt: date('2026-08-23') },
  // WebSocket Studio — added 2026-08-23
  { manualPath: 'websocket/websocket.html', addedAt: date('2026-08-23') },
  { manualPath: 'websocket/websocket-first-connection-easy.html', addedAt: date('2026-08-23') },
  { manualPath: 'websocket/websocket-multi-tab-easy.html', addedAt: date('2026-08-23') },
  { manualPath: 'websocket/websocket-protocols-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'websocket/websocket-auth-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'websocket/websocket-recording-replay-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'websocket/websocket-stats-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'websocket/websocket-tls-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'websocket/websocket-mock-server-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'websocket/websocket-schema-validation-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'websocket/websocket-diff-console-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'websocket/websocket-load-test-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'websocket/websocket-workflow-runner-advanced.html', addedAt: date('2026-08-23') },

  // Environment Manager — added 2026-08-23
  { manualPath: 'environments/environments.html', addedAt: date('2026-08-23') },
  { manualPath: 'environments/environments-basics-easy.html', addedAt: date('2026-08-23') },
  { manualPath: 'environments/environments-variables-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'environments/environments-protocols-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'environments/environments-multi-run-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'environments/environments-additional-env-medium.html', addedAt: date('2026-08-23') },

  // Results Dashboard — added 2026-08-23
  { manualPath: 'results/results.html', addedAt: date('2026-08-23') },
  { manualPath: 'results/results-overview-easy.html', addedAt: date('2026-08-23') },
  { manualPath: 'results/results-request-details-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'results/results-sla-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'results/results-comparison-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'results/results-explorer-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'results/results-console-timeline-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'results/results-explorer-advanced.html', addedAt: date('2026-08-23') },
  // API Mock (HTTP) — added 2026-08-23
  { manualPath: 'api-mock/api-mock.html', addedAt: date('2026-08-23') },
  { manualPath: 'api-mock/api-mock-first-server-easy.html', addedAt: date('2026-08-23') },
  { manualPath: 'api-mock/api-mock-response-variants-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'api-mock/api-mock-simulate-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'api-mock/api-mock-journal-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'api-mock/api-mock-import-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'api-mock/api-mock-folder-organization-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'api-mock/api-mock-auth-gated-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'api-mock/api-mock-graphql-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'api-mock/api-mock-stateful-sequence-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'api-mock/api-mock-webhook-receiver-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'api-mock/api-mock-faults-timing-advanced.html', addedAt: date('2026-08-23') },
  { manualPath: 'api-mock/api-mock-export-library-advanced.html', addedAt: date('2026-08-23') },

  // ============================================================================
  // SSE Studio Path
  // ============================================================================
  { manualPath: 'sse/sse.html', addedAt: date('2026-08-23') },
  { manualPath: 'sse/sse-first-connection-easy.html', addedAt: date('2026-08-23') },
  { manualPath: 'sse/sse-event-filtering-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'sse/sse-auth-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'sse/sse-console-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'sse/sse-multi-tab-advanced.html', addedAt: date('2026-08-23') },

  // ============================================================================
  // Webhook Delivery Logs Path (protocolPaths)
  // ============================================================================
  { manualPath: 'webhooks/webhooks.html', addedAt: date('2026-08-23') },
  { manualPath: 'webhooks/webhooks-delivery-logs-easy.html', addedAt: date('2026-08-23') },
  { manualPath: 'webhooks/webhooks-date-sort-medium.html', addedAt: date('2026-08-23') },
  { manualPath: 'webhooks/webhooks-trigger-setup-medium.html', addedAt: date('2026-08-23') },
];

/** Map of manualPath -> ManualMetadata for fast lookup */
export const metadataByPath: Map<string, ManualMetadata> = new Map(
  manualMetadata.map(m => [m.manualPath, m])
);

/**
 * Get metadata for a specific manual path.
 * Returns undefined if no metadata exists.
 */
export function getManualMetadata(manualPath: string): ManualMetadata | undefined {
  return metadataByPath.get(manualPath);
}
