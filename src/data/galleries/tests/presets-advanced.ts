/**
 * Advanced / demo test gallery preset factories.
 * Catalog export, trash recovery, and API health SLA demos.
 */

import { ts, s } from './presets-helpers';
import type { FeatureGroup } from './presets-helpers';

// ─── 9. Catalog Export Demo (Easy) ─────────────────────────────────────────

export function createCatalogExportDemoTest(): FeatureGroup {
  return {
    id: 'test-catalog-export-demo',
    name: 'Catalog Export Demo',
    scenarios: [
      ts({
        id: 'ts-catalog-post-product',
        name: 'POST Product (Schema Body)',
        tests: [
          s({
            id: 'ts-catalog-post-product-add',
            name: 'POST /products/add — schema-generated body',
            url: 'https://dummyjson.com/products/add',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              title: 'string',
              description: 'string',
              price: 0,
              discountPercentage: 0,
              rating: 0,
              stock: 0,
              brand: 'string',
              category: 'string',
            }, null, 2),
            bodyType: 'json',
            assertions: [
              { type: 'status', expected: '201' },
              { type: 'numeric', jsonPath: '$.id', operator: '>', value: 0 },
            ],
            sampleJson: JSON.stringify({
              id: 195, title: 'string', description: 'string',
              price: 0, discountPercentage: 0, rating: 0,
              stock: 0, brand: 'string', category: 'string',
            }),
          }),
        ],
      }),
      ts({
        id: 'ts-catalog-get-query',
        name: 'GET with Query Params',
        tests: [
          s({
            id: 'ts-catalog-get-query-search',
            name: 'GET /products/search?q=phone — query params from spec',
            url: 'https://dummyjson.com/products/search?q=phone',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.products', operator: '>=', value: 1 },
            ],
            sampleJson: JSON.stringify({
              products: [{ id: 1, title: 'iPhone 9', price: 549, category: 'smartphones' }],
              total: 4, skip: 0, limit: 30,
            }),
          }),
        ],
      }),
      ts({
        id: 'ts-catalog-put-update',
        name: 'PUT Update (Schema Body)',
        tests: [
          s({
            id: 'ts-catalog-put-update-product',
            name: 'PUT /products/1 — schema-generated update body',
            url: 'https://dummyjson.com/products/1',
            method: 'PUT',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({ title: 'Updated Title', price: 99 }, null, 2),
            bodyType: 'json',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'regex', jsonPath: '$.title', pattern: 'Updated Title' },
            ],
            sampleJson: JSON.stringify({
              id: 1, title: 'Updated Title', price: 99,
              description: 'An apple mobile', brand: 'Apple',
            }),
          }),
        ],
      }),
    ],
  };
}

// ─── 10. Trash Recovery Demo (Easy) ──────────────────────────────────────────

export function createTrashRecoveryDemo(): FeatureGroup {
  return {
    id: 'test-trash-recovery-demo',
    name: 'Trash Box — Recovery Demo',
    scenarios: [
      ts({
        id: 'ts-trash-sample',
        name: 'Sample Scenario',
        tests: [
          s({
            id: 'ts-trash-get-post',
            name: 'GET /posts/1',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'regex', jsonPath: '$.title', pattern: '.+' },
            ],
            sampleJson: JSON.stringify({
              userId: 1, id: 1,
              title: 'sunt aut facere repellat provident occaecati',
              body: 'quia et suscipit\nsuscipit recusandae',
            }),
          }),
        ],
      }),
      ts({
        id: 'ts-trash-another',
        name: 'Another Scenario',
        tests: [
          s({
            id: 'ts-trash-get-users',
            name: 'GET /users',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '=', value: 10 },
            ],
            sampleJson: JSON.stringify([
              { id: 1, name: 'Leanne Graham', email: 'Sincere@april.biz' },
              { id: 2, name: 'Ervin Howell', email: 'Shanna@melissa.tv' },
            ]),
          }),
        ],
      }),
    ],
  };
}

// ─── 11. API Health Check with SLA (Easy) ────────────────────────────────────

/**
 * Demonstrates SLA targets on Test Runner scenarios.
 * Three scenarios hitting JSONPlaceholder — each has response-time SLA targets
 * so users can see the SLA badge, Configure panel, and pass/fail results.
 */
export function createApiHealthSlaTest(): FeatureGroup {
  return {
    id: 'test-api-health-sla',
    name: 'API Health Check with SLA',
    scenarios: [
      ts({
        id: 'ts-health-users',
        name: 'Users Endpoint Health',
        slaTargets: [
          { id: 'sla-users-p95', metric: 'p95', operator: 'lte', value: 800 },
          { id: 'sla-users-err', metric: 'errorRate', operator: 'lte', value: 1 },
        ],
        tests: [
          s({
            id: 'ts-health-list-users',
            name: 'List Users',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '=', value: 10 },
              { type: 'regex', jsonPath: '$[0].email', pattern: '.+@.+' },
            ],
            sampleJson: JSON.stringify([
              { id: 1, name: 'Leanne Graham', email: 'Sincere@april.biz', username: 'Bret' },
              { id: 2, name: 'Ervin Howell', email: 'Shanna@melissa.tv', username: 'Antonette' },
            ]),
          }),
          s({
            id: 'ts-health-get-user',
            name: 'Get User by ID',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'regex', jsonPath: '$.name', pattern: '.+' },
              { type: 'regex', jsonPath: '$.email', pattern: '.+@.+' },
            ],
            sampleJson: JSON.stringify({
              id: 1, name: 'Leanne Graham', email: 'Sincere@april.biz',
              phone: '1-770-736-8031', website: 'hildegard.org',
            }),
          }),
        ],
      }),
      ts({
        id: 'ts-health-posts',
        name: 'Posts Endpoint Health',
        slaTargets: [
          { id: 'sla-posts-p95', metric: 'p95', operator: 'lte', value: 600 },
          { id: 'sla-posts-p99', metric: 'p99', operator: 'lte', value: 1000 },
        ],
        tests: [
          s({
            id: 'ts-health-list-posts',
            name: 'List Posts',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '=', value: 100 },
            ],
            sampleJson: JSON.stringify([
              { userId: 1, id: 1, title: 'sunt aut facere', body: 'quia et suscipit' },
              { userId: 1, id: 2, title: 'qui est esse', body: 'est rerum tempore vitae' },
            ]),
          }),
          s({
            id: 'ts-health-create-post',
            name: 'Create Post',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({ title: 'Health Check Post', body: 'Automated test', userId: 1 }),
            bodyType: 'json',
            assertions: [
              { type: 'status', expected: '201' },
              { type: 'regex', jsonPath: '$.id', pattern: '\\d+' },
            ],
            sampleJson: JSON.stringify({ id: 101, title: 'Health Check Post', body: 'Automated test', userId: 1 }),
          }),
        ],
      }),
      ts({
        id: 'ts-health-todos',
        name: 'Todos Endpoint Health',
        slaTargets: [
          { id: 'sla-todos-p50', metric: 'p50', operator: 'lte', value: 400 },
          { id: 'sla-todos-p95', metric: 'p95', operator: 'lte', value: 700, warnAt: 500 },
        ],
        tests: [
          s({
            id: 'ts-health-list-todos',
            name: 'List Todos',
            url: 'https://jsonplaceholder.typicode.com/todos',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '=', value: 200 },
            ],
            sampleJson: JSON.stringify([
              { userId: 1, id: 1, title: 'delectus aut autem', completed: false },
              { userId: 1, id: 2, title: 'quis ut nam facilis', completed: false },
            ]),
          }),
        ],
      }),
    ],
  };
}

// ─── 12. Performance Regression Baseline (Medium) ──────────────────────────

export function createPerformanceRegressionBaselineTest(): FeatureGroup {
  return {
    id: 'test-performance-regression-baseline',
    name: 'Performance Baseline Demo',
    scenarios: [
      ts({
        id: 'ts-perf-catalog-read',
        name: 'Catalog Read Path',
        slaTargets: [
          { id: 'sla-catalog-p95', metric: 'p95', operator: 'lte', value: 520, warnAt: 460 },
          { id: 'sla-catalog-err', metric: 'errorRate', operator: 'lte', value: 1 },
        ],
        tests: [
          s({
            id: 'ts-perf-catalog-search',
            name: 'GET /products/search?q=phone',
            url: 'https://dummyjson.com/products/search?q=phone',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.products', operator: '>=', value: 1 },
            ],
          }),
          s({
            id: 'ts-perf-catalog-single',
            name: 'GET /products/1',
            url: 'https://dummyjson.com/products/1',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'numeric', jsonPath: '$.id', operator: '=', value: 1 },
            ],
          }),
          s({
            id: 'ts-perf-catalog-categories',
            name: 'GET /products/categories',
            url: 'https://dummyjson.com/products/categories',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '>=', value: 1 },
            ],
          }),
        ],
      }),
      ts({
        id: 'ts-perf-checkout-write',
        name: 'Checkout Write Path',
        slaTargets: [
          { id: 'sla-checkout-p95', metric: 'p95', operator: 'lte', value: 650, warnAt: 560 },
          { id: 'sla-checkout-p99', metric: 'p99', operator: 'lte', value: 900 },
        ],
        tests: [
          s({
            id: 'ts-perf-cart-create',
            name: 'POST /carts/add',
            url: 'https://dummyjson.com/carts/add',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            bodyType: 'json',
            body: JSON.stringify({
              userId: 1,
              products: [{ id: 1, quantity: 1 }],
            }),
            assertions: [
              { type: 'status', expected: '201' },
              { type: 'numeric', jsonPath: '$.id', operator: '>', value: 0 },
            ],
          }),
          s({
            id: 'ts-perf-order-create',
            name: 'POST /posts (order simulation)',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            bodyType: 'json',
            body: JSON.stringify({ title: 'Order created', body: 'Perf baseline demo', userId: 1 }),
            assertions: [
              { type: 'status', expected: '201' },
              { type: 'numeric', jsonPath: '$.id', operator: '>', value: 0 },
            ],
          }),
          s({
            id: 'ts-perf-order-readback',
            name: 'GET /posts/1 (readback)',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'numeric', jsonPath: '$.id', operator: '=', value: 1 },
            ],
          }),
        ],
      }),
    ],
  };
}
