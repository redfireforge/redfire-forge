import type { TrainingPath } from './types';

/** Content training paths: Requests, Tests, API Catalog. */
export const contentPaths: TrainingPath[] = [
  {
    id: 'requests',
    name: 'Request Basics',
    icon: '📡',
    description: 'Learn to build, send, and inspect API requests against real public endpoints — from simple GETs to authenticated flows.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'Get All Users',
            description: 'Your first GET request — fetch a JSON list, inspect status codes and response body.',
            difficulty: 'easy',
            sampleId: 'req-get-all-users',
            manualPath: 'requests/get-all-users-easy.html',
          },
          {
            title: 'Get Pokémon Details',
            description: 'Nested JSON responses, path parameters, and deep data exploration.',
            difficulty: 'easy',
            sampleId: 'req-get-pokemon',
            manualPath: 'requests/get-pokemon-easy.html',
          },
          {
            title: 'Random Dog Image',
            description: 'Simple GET returning image URLs — the simplest possible API call.',
            difficulty: 'easy',
            sampleId: 'req-random-dog',
            manualPath: 'requests/random-dog-easy.html',
          },
          {
            title: 'Search Countries',
            description: 'Query parameters, search filtering, and rich data models.',
            difficulty: 'easy',
            sampleId: 'req-search-countries',
            manualPath: 'requests/search-countries-easy.html',
          },
          {
            title: 'Create a Post',
            description: 'POST request with JSON body — creating resources via API.',
            difficulty: 'easy',
            sampleId: 'req-create-post',
            manualPath: 'requests/create-post-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'CRUD and Pagination',
        manuals: [
          {
            title: 'Search Books',
            description: 'Search queries against Open Library — handling large payloads and nested results.',
            difficulty: 'medium',
            sampleId: 'req-search-books',
            manualPath: 'requests/search-books-medium.html',
          },
          {
            title: 'Paginated Users',
            description: 'Pagination parameters, page traversal, and result windowing.',
            difficulty: 'medium',
            sampleId: 'req-paginated-users',
            manualPath: 'requests/paginated-users-medium.html',
          },
          {
            title: 'Product Search',
            description: 'E-commerce product search with category filtering and sorting.',
            difficulty: 'medium',
            sampleId: 'req-product-search',
            manualPath: 'requests/product-search-medium.html',
          },
          {
            title: 'Update Resource',
            description: 'PUT and PATCH requests — updating existing resources via API.',
            difficulty: 'medium',
            sampleId: 'req-update-resource',
            manualPath: 'requests/update-resource-medium.html',
          },
          {
            title: 'Delete Resource',
            description: 'DELETE requests, status validation, and idempotency.',
            difficulty: 'medium',
            sampleId: 'req-delete-resource',
            manualPath: 'requests/delete-resource-medium.html',
          },
          {
            title: 'Auth Login Flow',
            description: 'Login endpoint, token extraction, and authenticated follow-up requests.',
            difficulty: 'medium',
            sampleId: 'req-auth-login',
            manualPath: 'requests/auth-login-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Advanced Request Patterns',
        manuals: [
          {
            title: 'Echo Headers',
            description: 'Custom headers, header inspection, and advanced debugging with httpbin.',
            difficulty: 'advanced',
            sampleId: 'req-echo-headers',
            manualPath: 'requests/echo-headers-advanced.html',
          },
        ],
      },
    ],
  },

  /* ── Tests ── */
  {
    id: 'tests',
    name: 'Test Suites',
    icon: '🧪',
    description: 'Build and run test suites — from simple smoke tests to full regression and load profiles.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'Tests Gallery Overview',
            description: 'What are test samples, how the gallery works, and how to import & run.',
            difficulty: 'easy',
            manualPath: 'tests/tests.html',
          },
          {
            title: 'JSON Data Files',
            description: 'Parameterize tests with external JSON/CSV data files for data-driven execution.',
            difficulty: 'easy',
            manualPath: 'tests/json-data-files-easy.html',
          },
          {
            title: 'User API Smoke Test',
            description: 'Three quick checks on JSONPlaceholder — list users, get one, fetch posts.',
            difficulty: 'easy',
            sampleId: 'test-user-api-smoke',
            manualPath: 'tests/user-api-smoke-easy.html',
          },
          {
            title: 'Product Listing Check',
            description: 'Verify DummyJSON returns a valid product list and single product detail.',
            difficulty: 'easy',
            sampleId: 'test-product-listing',
            manualPath: 'tests/product-listing-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Intermediate Suites',
        manuals: [
          {
            title: 'Paginated API Regression',
            description: 'Test pagination edge cases — page 1, page 2, out-of-range, and total consistency.',
            difficulty: 'medium',
            sampleId: 'test-paginated-regression',
            manualPath: 'tests/paginated-regression-medium.html',
          },
          {
            title: 'Pokémon Data Contract',
            description: 'Contract tests for PokéAPI — verify Pikachu shape, type list, and 404 handling.',
            difficulty: 'medium',
            sampleId: 'test-pokemon-contract',
            manualPath: 'tests/pokemon-contract-medium.html',
          },
          {
            title: 'Country Search Suite',
            description: 'Search REST Countries by name, code, and region — plus 404 edge case.',
            difficulty: 'medium',
            sampleId: 'test-country-search',
            manualPath: 'tests/country-search-medium.html',
          },
          {
            title: 'Auth Flow Validation',
            description: 'Login success, login failure, and profile fetch — auth lifecycle coverage.',
            difficulty: 'medium',
            sampleId: 'test-auth-flow',
            manualPath: 'tests/auth-flow-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Advanced Suites',
        manuals: [
          {
            title: 'E-Commerce Full Suite',
            description: 'End-to-end DummyJSON coverage — products, search, categories, cart, and users.',
            difficulty: 'advanced',
            sampleId: 'test-ecommerce-full',
            manualPath: 'tests/ecommerce-full-advanced.html',
          },
          {
            title: 'Multi-API Load Profile',
            description: 'Response time checks across 5 public APIs — baseline for load testing.',
            difficulty: 'advanced',
            sampleId: 'test-multi-api-load',
            manualPath: 'tests/multi-api-load-advanced.html',
          },
        ],
      },
      {
        id: 4,
        name: 'Parameterized Testing',
        manuals: [
          {
            title: 'Parameterized Testing Basics',
            description: 'Introduction to data sources — column types, row iteration, and your first data-driven test.',
            difficulty: 'easy',
            sampleId: 'test-user-lookup-sweep',
            manualPath: 'tests/parameterized-basics-easy.html',
          },
          {
            title: 'Create Parameterized Copy',
            description: 'Convert an existing test into a data-driven version — auto-detect variables and generate data tables.',
            difficulty: 'easy',
            manualPath: 'tests/parameterized-create-copy-easy.html',
          },
          {
            title: 'Re-Run Failed Rows',
            description: 'After a test run, selectively re-run only the rows that failed — saves time on large data sets.',
            difficulty: 'easy',
            manualPath: 'tests/parameterized-rerun-failed-easy.html',
          },
          {
            title: 'File Import (CSV / JSON)',
            description: 'Import data from CSV, JSON, and Excel files — column prefix conventions and sample data.',
            difficulty: 'easy',
            sampleId: 'test-product-search-matrix',
            manualPath: 'tests/parameterized-file-import-easy.html',
          },
          {
            title: 'Response Validation',
            description: 'Validate columns for per-row JSON path assertions — Country Validation Suite walkthrough.',
            difficulty: 'medium',
            sampleId: 'test-country-validation-suite',
            manualPath: 'tests/parameterized-validation-medium.html',
          },
          {
            title: 'Pre-Validation (Dry Run)',
            description: 'Run pre-validate to discover expected values before committing to a full test run.',
            difficulty: 'medium',
            sampleId: 'test-pokemon-contract-sweep',
            manualPath: 'tests/parameterized-pre-validate-medium.html',
          },
          {
            title: 'Multi-Endpoint Regression',
            description: 'Data-driven regression across 4 DummyJSON endpoints — design patterns for large suites.',
            difficulty: 'advanced',
            sampleId: 'test-multi-endpoint-regression',
            manualPath: 'tests/parameterized-multi-endpoint-advanced.html',
          },
          {
            title: 'Auth Token Rotation',
            description: 'POST body parameterization — rotate credentials via {{variable}} substitution in request body.',
            difficulty: 'advanced',
            sampleId: 'test-auth-token-rotation',
            manualPath: 'tests/parameterized-auth-rotation-advanced.html',
          },
        ],
      },
      {
        id: 5,
        name: 'Shared Data Sources',
        manuals: [
          {
            title: 'Shared Data Sources Basics',
            description: 'Centralized test data management — create, link, and reuse data across multiple tests.',
            difficulty: 'easy',
            sampleId: 'test-shared-user-ids',
            manualPath: 'tests/shared-data-sources-easy.html',
          },
          {
            title: 'Shared DS with Fetch Config',
            description: 'API-driven data population — verify and refresh shared data against live endpoints.',
            difficulty: 'medium',
            sampleId: 'test-shared-product-catalog',
            manualPath: 'tests/shared-data-sources-fetch-medium.html',
          },
          {
            title: 'Cross-FG Shared Data',
            description: 'One shared data source used across multiple feature groups for harness-wide test data.',
            difficulty: 'medium',
            sampleId: 'test-shared-pokemon-cross-fg',
            manualPath: 'tests/shared-data-sources-cross-fg-medium.html',
          },
          {
            title: 'Shared DS Advanced',
            description: 'Tags, CSV import, export, promote/demote, auth inheritance, and impact warnings.',
            difficulty: 'advanced',
            sampleId: 'test-shared-auth-users',
            manualPath: 'tests/shared-data-sources-advanced.html',
          },
        ],
      },
    ],
  },

  /* ── API Catalog ── */
  {
    id: 'catalog',
    name: 'API Catalog',
    icon: '📚',
    description: 'Explore public API endpoints pre-configured in the gallery — from REST basics to advanced HTTP toolkits.',
    phases: [
      {
        id: 1,
        name: 'Getting Started',
        manuals: [
          {
            title: 'API Catalog Overview',
            description: 'What the API Catalog gallery is, how to browse, import, and use catalog specs.',
            difficulty: 'easy',
            manualPath: 'catalog/catalog.html',
          },
          {
            title: 'JSONPlaceholder API',
            description: 'Free REST API for testing — users, posts, comments, todos, and albums.',
            difficulty: 'easy',
            sampleId: 'catalog-jsonplaceholder',
            manualPath: 'catalog/jsonplaceholder-easy.html',
          },
          {
            title: 'FakeStore API',
            description: 'E-commerce REST API — products, categories, carts, and user endpoints.',
            difficulty: 'easy',
            sampleId: 'catalog-fakestore',
            manualPath: 'catalog/fakestore-easy.html',
          },
        ],
      },
      {
        id: 2,
        name: 'Intermediate APIs',
        manuals: [
          {
            title: 'DummyJSON Products',
            description: 'Rich product data with search, pagination, categories, and authentication.',
            difficulty: 'medium',
            sampleId: 'catalog-dummyjson',
            manualPath: 'catalog/dummyjson-medium.html',
          },
          {
            title: 'PokéAPI',
            description: 'Pokémon data — species, types, abilities, and evolution chains via REST.',
            difficulty: 'medium',
            sampleId: 'catalog-pokeapi',
            manualPath: 'catalog/pokeapi-medium.html',
          },
          {
            title: 'REST Countries',
            description: 'Country data — search by name, code, region, and language with rich metadata.',
            difficulty: 'medium',
            sampleId: 'catalog-rest-countries',
            manualPath: 'catalog/rest-countries-medium.html',
          },
        ],
      },
      {
        id: 3,
        name: 'Advanced APIs',
        manuals: [
          {
            title: 'HTTPBin Toolkit',
            description: 'HTTP testing toolkit — echo requests, inspect headers, test auth, and simulate delays/errors.',
            difficulty: 'advanced',
            sampleId: 'catalog-httpbin',
            manualPath: 'catalog/httpbin-advanced.html',
          },
        ],
      },
    ],
  },
];
