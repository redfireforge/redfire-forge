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

  // Shared Data Sources (Phase 5)
  { manualPath: 'tests/shared-data-sources-easy.html', addedAt: date('2024-04-01') },
  { manualPath: 'tests/shared-data-sources-fetch-medium.html', addedAt: date('2024-04-05') },
  { manualPath: 'tests/shared-data-sources-cross-fg-medium.html', addedAt: date('2024-04-05') },
  { manualPath: 'tests/shared-data-sources-advanced.html', addedAt: date('2024-04-10') },

  // ============================================================================
  // API Catalog Path
  // ============================================================================
  { manualPath: 'catalog/catalog.html', addedAt: date('2024-01-10') },
  { manualPath: 'catalog/jsonplaceholder-easy.html', addedAt: date('2024-01-15') },
  { manualPath: 'catalog/fakestore-easy.html', addedAt: date('2024-01-15') },
  { manualPath: 'catalog/dummyjson-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'catalog/pokeapi-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'catalog/rest-countries-medium.html', addedAt: date('2024-01-20') },
  { manualPath: 'catalog/pet-store-api-easy.html', addedAt: date('2026-05-04') },
  { manualPath: 'catalog/correlation-wait-api-medium.html', addedAt: date('2026-05-04') },
  { manualPath: 'catalog/httpbin-advanced.html', addedAt: date('2024-02-01') },

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
