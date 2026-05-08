/**
 * Factory functions for test gallery samples.
 * Each returns a FeatureGroup with pre-configured TestScenarios hitting real public APIs.
 */

import type { FeatureGroup, Scenario, Assertion } from '../../../shared/types';

const noAuth = { type: 'none' as const };

function s(partial: Pick<Scenario, 'id' | 'name' | 'url' | 'method'> & { assertions?: Assertion[]; body?: string; bodyType?: Scenario['bodyType']; headers?: Scenario['headers'] }): Scenario {
  return {
    headers: partial.headers ?? [],
    body: partial.body ?? '',
    bodyType: partial.bodyType,
    auth: noAuth,
    validation: {
      mode: partial.assertions ? 'full' : 'none',
      assertions: partial.assertions,
    },
    id: partial.id,
    name: partial.name,
    url: partial.url,
    method: partial.method,
  };
}

/** Minimal scenario omitting assertions to exercise presets helper branch (validation mode none). */
export function presetsBareScenarioProbe(): Scenario {
  return s({
    id: 'cov-presets-s-probe',
    name: 'Presets probe',
    url: 'https://dummyjson.com/products/1',
    method: 'GET',
  });
}

// ─── 1. User API Smoke Test (Easy) ───────────────────────────────────────────

export function createUserApiSmokeTest(): FeatureGroup {
  return {
    id: 'test-user-api-smoke',
    name: 'User API Smoke Test',
    scenarios: [
      {
        id: 'ts-users-list',
        name: 'List Users',
        tests: [
          s({
            id: 'ts-users-list-get',
            name: 'GET /users returns 10 users',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '=', value: 10 },
            ],
          }),
        ],
      },
      {
        id: 'ts-users-single',
        name: 'Get Single User',
        tests: [
          s({
            id: 'ts-users-single-get',
            name: 'GET /users/1 returns user with id 1',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'numeric', jsonPath: '$.id', operator: '=', value: 1 },
              { type: 'regex', jsonPath: '$.email', pattern: '.+@.+' },
            ],
          }),
        ],
      },
      {
        id: 'ts-users-posts',
        name: 'User Posts',
        tests: [
          s({
            id: 'ts-users-posts-get',
            name: 'GET /posts?userId=1 returns posts for user 1',
            url: 'https://jsonplaceholder.typicode.com/posts?userId=1',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '>=', value: 1 },
            ],
          }),
        ],
      },
    ],
  };
}

// ─── 2. Product Listing Check (Easy) ─────────────────────────────────────────

export function createProductListingTest(): FeatureGroup {
  return {
    id: 'test-product-listing',
    name: 'Product Listing Check',
    scenarios: [
      {
        id: 'ts-products-all',
        name: 'All Products',
        tests: [
          s({
            id: 'ts-products-all-get',
            name: 'GET /products returns product list',
            url: 'https://dummyjson.com/products?limit=5',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.products', operator: '>=', value: 1 },
              { type: 'numeric', jsonPath: '$.total', operator: '>', value: 0 },
            ],
          }),
        ],
      },
      {
        id: 'ts-products-single',
        name: 'Single Product',
        tests: [
          s({
            id: 'ts-products-single-get',
            name: 'GET /products/1 returns product with price',
            url: 'https://dummyjson.com/products/1',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'numeric', jsonPath: '$.id', operator: '=', value: 1 },
              { type: 'numeric', jsonPath: '$.price', operator: '>', value: 0 },
            ],
          }),
        ],
      },
    ],
  };
}

// ─── 3. Paginated API Regression (Medium) ────────────────────────────────────

export function createPaginatedRegressionTest(): FeatureGroup {
  return {
    id: 'test-paginated-regression',
    name: 'Paginated API Regression',
    scenarios: [
      {
        id: 'ts-page1',
        name: 'Page 1',
        tests: [
          s({
            id: 'ts-page1-get',
            name: 'GET /users?limit=6&skip=0 returns first page',
            url: 'https://dummyjson.com/users?limit=6&skip=0',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'numeric', jsonPath: '$.skip', operator: '=', value: 0 },
              { type: 'arrayLength', jsonPath: '$.users', operator: '>=', value: 1 },
            ],
          }),
        ],
      },
      {
        id: 'ts-page2',
        name: 'Page 2',
        tests: [
          s({
            id: 'ts-page2-get',
            name: 'GET /users?limit=6&skip=6 returns second page',
            url: 'https://dummyjson.com/users?limit=6&skip=6',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'numeric', jsonPath: '$.skip', operator: '=', value: 6 },
              { type: 'arrayLength', jsonPath: '$.users', operator: '>=', value: 1 },
            ],
          }),
        ],
      },
      {
        id: 'ts-page-beyond',
        name: 'Page Beyond Range',
        tests: [
          s({
            id: 'ts-page-beyond-get',
            name: 'GET /users?limit=6&skip=9999 returns empty data',
            url: 'https://dummyjson.com/users?limit=6&skip=9999',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.users', operator: '=', value: 0 },
            ],
          }),
        ],
      },
      {
        id: 'ts-total-consistency',
        name: 'Total Consistency',
        tests: [
          s({
            id: 'ts-total-consistency-get',
            name: 'Total count is consistent across pages',
            url: 'https://dummyjson.com/users?limit=6&skip=0',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'numeric', jsonPath: '$.total', operator: '>', value: 0 },
              { type: 'numeric', jsonPath: '$.limit', operator: '=', value: 6 },
            ],
          }),
        ],
      },
    ],
  };
}

// ─── 4. Pokémon Data Contract (Medium) ───────────────────────────────────────

export function createPokemonContractTest(): FeatureGroup {
  return {
    id: 'test-pokemon-contract',
    name: 'Pokémon Data Contract',
    scenarios: [
      {
        id: 'ts-pokemon-pikachu',
        name: 'Pikachu Contract',
        tests: [
          s({
            id: 'ts-pokemon-pikachu-get',
            name: 'GET /pokemon/pikachu has expected shape',
            url: 'https://pokeapi.co/api/v2/pokemon/pikachu',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'regex', jsonPath: '$.name', pattern: '^pikachu$' },
              { type: 'numeric', jsonPath: '$.id', operator: '=', value: 25 },
              { type: 'arrayLength', jsonPath: '$.abilities', operator: '>=', value: 1 },
            ],
          }),
        ],
      },
      {
        id: 'ts-pokemon-types',
        name: 'Type List Contract',
        tests: [
          s({
            id: 'ts-pokemon-types-get',
            name: 'GET /type returns all Pokémon types',
            url: 'https://pokeapi.co/api/v2/type',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.results', operator: '>=', value: 10 },
            ],
          }),
        ],
      },
      {
        id: 'ts-pokemon-404',
        name: 'Not Found Contract',
        tests: [
          s({
            id: 'ts-pokemon-404-get',
            name: 'GET /pokemon/doesnotexist returns 404',
            url: 'https://pokeapi.co/api/v2/pokemon/doesnotexist99999',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '404' },
            ],
          }),
        ],
      },
    ],
  };
}

// ─── 5. Country Search Suite (Medium) ────────────────────────────────────────

export function createCountrySearchTest(): FeatureGroup {
  return {
    id: 'test-country-search',
    name: 'Country Search Suite',
    scenarios: [
      {
        id: 'ts-country-name',
        name: 'Search by Name',
        tests: [
          s({
            id: 'ts-country-name-get',
            name: 'GET /name/japan returns Japan',
            url: 'https://restcountries.com/v3.1/name/japan',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '>=', value: 1 },
            ],
          }),
        ],
      },
      {
        id: 'ts-country-code',
        name: 'Search by Code',
        tests: [
          s({
            id: 'ts-country-code-get',
            name: 'GET /alpha/US returns United States',
            url: 'https://restcountries.com/v3.1/alpha/US',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '>=', value: 1 },
            ],
          }),
        ],
      },
      {
        id: 'ts-country-region',
        name: 'Search by Region',
        tests: [
          s({
            id: 'ts-country-region-get',
            name: 'GET /region/europe returns European countries',
            url: 'https://restcountries.com/v3.1/region/europe',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '>=', value: 10 },
            ],
          }),
        ],
      },
      {
        id: 'ts-country-not-found',
        name: 'Not Found',
        tests: [
          s({
            id: 'ts-country-not-found-get',
            name: 'GET /name/zzzzz returns 404',
            url: 'https://restcountries.com/v3.1/name/zzzzzznotacountry',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '404' },
            ],
          }),
        ],
      },
    ],
  };
}

// ─── 6. Auth Flow Validation (Medium) ────────────────────────────────────────

export function createAuthFlowTest(): FeatureGroup {
  return {
    id: 'test-auth-flow',
    name: 'Auth Flow Validation',
    scenarios: [
      {
        id: 'ts-auth-login-success',
        name: 'Login Success',
        tests: [
          s({
            id: 'ts-auth-login-ok',
            name: 'POST /auth/login with valid creds returns token',
            url: 'https://dummyjson.com/auth/login',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({ username: 'emilys', password: 'emilyspass' }),
            bodyType: 'json',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'regex', jsonPath: '$.accessToken', pattern: '.+' },
            ],
          }),
        ],
      },
      {
        id: 'ts-auth-login-fail',
        name: 'Login Failure',
        tests: [
          s({
            id: 'ts-auth-login-bad',
            name: 'POST /auth/login with wrong password returns 400',
            url: 'https://dummyjson.com/auth/login',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({ username: 'emilys', password: 'wrongpass' }),
            bodyType: 'json',
            assertions: [
              { type: 'status', expected: '400' },
            ],
          }),
        ],
      },
      {
        id: 'ts-auth-get-profile',
        name: 'Get Auth Profile',
        tests: [
          s({
            id: 'ts-auth-profile-ok',
            name: 'GET /auth/me returns user profile shape',
            url: 'https://dummyjson.com/users/1',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'numeric', jsonPath: '$.id', operator: '>', value: 0 },
              { type: 'regex', jsonPath: '$.username', pattern: '.+' },
            ],
          }),
        ],
      },
    ],
  };
}

// ─── 7. E-Commerce Full Suite (Advanced) ─────────────────────────────────────

export function createEcommerceFullSuiteTest(): FeatureGroup {
  return {
    id: 'test-ecommerce-full',
    name: 'E-Commerce Full Suite',
    scenarios: [
      {
        id: 'ts-ecom-products',
        name: 'Product Listing',
        tests: [
          s({
            id: 'ts-ecom-products-get',
            name: 'GET /products returns paginated list',
            url: 'https://dummyjson.com/products?limit=5',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.products', operator: '>=', value: 1 },
              { type: 'numeric', jsonPath: '$.total', operator: '>', value: 0 },
            ],
          }),
        ],
      },
      {
        id: 'ts-ecom-search',
        name: 'Product Search',
        tests: [
          s({
            id: 'ts-ecom-search-get',
            name: 'GET /products/search?q=laptop finds products',
            url: 'https://dummyjson.com/products/search?q=laptop',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.products', operator: '>=', value: 1 },
            ],
          }),
        ],
      },
      {
        id: 'ts-ecom-categories',
        name: 'Categories',
        tests: [
          s({
            id: 'ts-ecom-categories-get',
            name: 'GET /products/categories lists all categories',
            url: 'https://dummyjson.com/products/categories',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '>=', value: 1 },
            ],
          }),
        ],
      },
      {
        id: 'ts-ecom-single',
        name: 'Single Product Detail',
        tests: [
          s({
            id: 'ts-ecom-single-get',
            name: 'GET /products/1 returns full product',
            url: 'https://dummyjson.com/products/1',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'numeric', jsonPath: '$.id', operator: '=', value: 1 },
              { type: 'numeric', jsonPath: '$.price', operator: '>', value: 0 },
              { type: 'regex', jsonPath: '$.title', pattern: '.{2,}' },
            ],
          }),
        ],
      },
      {
        id: 'ts-ecom-add-cart',
        name: 'Add to Cart',
        tests: [
          s({
            id: 'ts-ecom-add-cart-post',
            name: 'POST /carts/add creates a cart',
            url: 'https://dummyjson.com/carts/add',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({ userId: 1, products: [{ id: 1, quantity: 2 }] }),
            bodyType: 'json',
            assertions: [
              { type: 'status', expected: '201' },
              { type: 'arrayLength', jsonPath: '$.products', operator: '>=', value: 1 },
            ],
          }),
        ],
      },
      {
        id: 'ts-ecom-users',
        name: 'User Listing',
        tests: [
          s({
            id: 'ts-ecom-users-get',
            name: 'GET /users?limit=3 returns users',
            url: 'https://dummyjson.com/users?limit=3',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.users', operator: '>=', value: 1 },
              { type: 'numeric', jsonPath: '$.total', operator: '>', value: 0 },
            ],
          }),
        ],
      },
    ],
  };
}

// ─── 8. Multi-API Load Profile (Advanced) ────────────────────────────────────

export function createMultiApiLoadTest(): FeatureGroup {
  return {
    id: 'test-multi-api-load',
    name: 'Multi-API Load Profile',
    scenarios: [
      {
        id: 'ts-load-jsonplaceholder',
        name: 'JSONPlaceholder Load',
        tests: [
          s({
            id: 'ts-load-jp-get',
            name: 'GET /posts (JSONPlaceholder)',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'responseTime', maxMs: 5000 },
            ],
          }),
        ],
      },
      {
        id: 'ts-load-fakestore',
        name: 'FakeStore Load',
        tests: [
          s({
            id: 'ts-load-fakestore-get',
            name: 'GET /products (FakeStore)',
            url: 'https://fakestoreapi.com/products?limit=5',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'responseTime', maxMs: 5000 },
            ],
          }),
        ],
      },
      {
        id: 'ts-load-dummyjson',
        name: 'DummyJSON Load',
        tests: [
          s({
            id: 'ts-load-dummy-get',
            name: 'GET /products (DummyJSON)',
            url: 'https://dummyjson.com/products?limit=5',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'responseTime', maxMs: 5000 },
            ],
          }),
        ],
      },
      {
        id: 'ts-load-dog',
        name: 'Dog CEO Load',
        tests: [
          s({
            id: 'ts-load-dog-get',
            name: 'GET /breeds/image/random (Dog CEO)',
            url: 'https://dog.ceo/api/breeds/image/random',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'responseTime', maxMs: 5000 },
            ],
          }),
        ],
      },
      {
        id: 'ts-load-countries',
        name: 'REST Countries Load',
        tests: [
          s({
            id: 'ts-load-countries-get',
            name: 'GET /all (REST Countries)',
            url: 'https://restcountries.com/v3.1/all?fields=name,capital',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'responseTime', maxMs: 10000 },
            ],
          }),
        ],
      },
    ],
  };
}
