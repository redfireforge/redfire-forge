/**
 * Factory functions for request gallery samples.
 * Each returns a ready-to-run Scenario hitting a real public API.
 */

import type { Scenario } from '@shared/types';

const noAuth = { type: 'none' as const };
const noValidation = { mode: 'none' as const };

function scenario(partial: Omit<Scenario, 'auth' | 'validation' | 'headers' | 'body'> & Partial<Pick<Scenario, 'auth' | 'validation' | 'headers' | 'body'>>): Scenario {
  return {
    headers: [],
    body: '',
    auth: noAuth,
    validation: noValidation,
    ...partial,
  };
}

// ─── 1. Get All Users (Easy) ─────────────────────────────────────────────────

export function createGetAllUsersScenario(): Scenario {
  return scenario({
    id: 'req-get-all-users',
    name: 'Get All Users',
    url: 'https://jsonplaceholder.typicode.com/users',
    method: 'GET',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'arrayLength', jsonPath: '$', operator: '=', value: 10 },
      ],
    },
  });
}

// ─── 2. Get Pokémon Details (Easy) ───────────────────────────────────────────

export function createGetPokemonScenario(): Scenario {
  return scenario({
    id: 'req-get-pokemon',
    name: 'Get Pokémon Details',
    url: 'https://pokeapi.co/api/v2/pokemon/pikachu',
    method: 'GET',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'regex', jsonPath: '$.name', pattern: '^pikachu$' },
      ],
    },
  });
}

// ─── 3. Random Dog Image (Easy) ──────────────────────────────────────────────

export function createRandomDogScenario(): Scenario {
  return scenario({
    id: 'req-random-dog',
    name: 'Random Dog Image',
    url: 'https://dog.ceo/api/breeds/image/random',
    method: 'GET',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'regex', jsonPath: '$.status', pattern: '^success$' },
      ],
    },
  });
}

// ─── 4. Search Countries by Name (Easy) ──────────────────────────────────────

export function createSearchCountriesScenario(): Scenario {
  return scenario({
    id: 'req-search-countries',
    name: 'Search Countries by Name',
    url: 'https://restcountries.com/v3.1/name/germany',
    method: 'GET',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'arrayLength', jsonPath: '$', operator: '>=', value: 1 },
      ],
    },
  });
}

// ─── 5. Create a New Post (Easy) ─────────────────────────────────────────────

export function createNewPostScenario(): Scenario {
  return scenario({
    id: 'req-create-post',
    name: 'Create a New Post',
    url: 'https://jsonplaceholder.typicode.com/posts',
    method: 'POST',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    body: JSON.stringify({ title: 'My New Post', body: 'This is the content.', userId: 1 }, null, 2),
    bodyType: 'json',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '201' },
        { type: 'numeric', jsonPath: '$.id', operator: '>', value: 0 },
      ],
    },
  });
}

// ─── 6. Search Books (Medium) ────────────────────────────────────────────────

export function createSearchBooksScenario(): Scenario {
  return scenario({
    id: 'req-search-books',
    name: 'Search Books',
    url: 'https://openlibrary.org/search.json?q=javascript&limit=5',
    method: 'GET',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'numeric', jsonPath: '$.numFound', operator: '>', value: 0 },
        { type: 'arrayLength', jsonPath: '$.docs', operator: '>=', value: 1 },
      ],
    },
  });
}

// ─── 7. Paginated User List (Medium) ─────────────────────────────────────────

export function createPaginatedUsersScenario(): Scenario {
  return scenario({
    id: 'req-paginated-users',
    name: 'Paginated User List',
    url: 'https://dummyjson.com/users?limit=6&skip=6',
    method: 'GET',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'numeric', jsonPath: '$.skip', operator: '=', value: 6 },
        { type: 'arrayLength', jsonPath: '$.users', operator: '>=', value: 1 },
        { type: 'numeric', jsonPath: '$.total', operator: '>', value: 0 },
      ],
    },
  });
}

// ─── 8. Product Search with Query (Medium) ───────────────────────────────────

export function createProductSearchScenario(): Scenario {
  return scenario({
    id: 'req-product-search',
    name: 'Product Search with Query',
    url: 'https://dummyjson.com/products/search?q=phone',
    method: 'GET',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'arrayLength', jsonPath: '$.products', operator: '>=', value: 1 },
        { type: 'numeric', jsonPath: '$.total', operator: '>', value: 0 },
      ],
    },
  });
}

// ─── 9. Update a Resource (Medium) ───────────────────────────────────────────

export function createUpdateResourceScenario(): Scenario {
  return scenario({
    id: 'req-update-resource',
    name: 'Update a Resource (PUT)',
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    method: 'PUT',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    body: JSON.stringify({ id: 1, title: 'Updated Title', body: 'Updated body content.', userId: 1 }, null, 2),
    bodyType: 'json',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'numeric', jsonPath: '$.id', operator: '=', value: 1 },
      ],
    },
  });
}

// ─── 10. Delete a Resource (Medium) ──────────────────────────────────────────

export function createDeleteResourceScenario(): Scenario {
  return scenario({
    id: 'req-delete-resource',
    name: 'Delete a Resource',
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    method: 'DELETE',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
      ],
    },
  });
}

// ─── 11. Auth Login (Medium) ─────────────────────────────────────────────────

export function createAuthLoginScenario(): Scenario {
  return scenario({
    id: 'req-auth-login',
    name: 'Auth Login (Token)',
    url: 'https://dummyjson.com/auth/login',
    method: 'POST',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    body: JSON.stringify({ username: 'emilys', password: 'emilyspass' }, null, 2),
    bodyType: 'json',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'regex', jsonPath: '$.accessToken', pattern: '.+' },
      ],
    },
  });
}

// ─── 12. Echo Headers & Body (Advanced) ──────────────────────────────────────

export function createEchoHeadersScenario(): Scenario {
  return scenario({
    id: 'req-echo-headers',
    name: 'Echo Headers & Body',
    url: 'https://httpbin.org/post',
    method: 'POST',
    headers: [
      { key: 'Content-Type', value: 'application/json' },
      { key: 'X-Custom-Header', value: 'RedfireForge-Test' },
    ],
    body: JSON.stringify({ message: 'Hello from RedfireForge', timestamp: '{{$timestamp}}' }, null, 2),
    bodyType: 'json',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'regex', jsonPath: '$.headers.X-Custom-Header', pattern: 'RedfireForge-Test' },
        { type: 'regex', jsonPath: '$.json.message', pattern: 'Hello from RedfireForge' },
      ],
    },
  });
}

// ─── 13. Multi-Env Product Lookup (Easy) ─────────────────────────────────────

export function createMultiEnvProductLookupScenario(): Scenario {
  return scenario({
    id: 'req-multi-env-product',
    name: 'Multi-Env Product Lookup',
    url: 'https://dummyjson.com/products/search?q=laptop&limit=3',
    method: 'GET',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'arrayLength', jsonPath: '$.products', operator: '>=', value: 1 },
        { type: 'numeric', jsonPath: '$.total', operator: '>=', value: 1 },
      ],
    },
  });
}

// ─── 14. GraphQL Introspection (Easy) ────────────────────────────────────────

export function createGraphQLIntrospectScenario(): Scenario {
  return scenario({
    id: 'req-graphql-introspect',
    name: 'GraphQL Introspection',
    url: 'https://countries.trevorblades.com/graphql',
    method: 'POST',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    body: JSON.stringify({ query: '{ __typename }' }),
    bodyType: 'json',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'existence', jsonPath: '$.data', expectExists: true },
        { type: 'existence', jsonPath: '$.errors', expectExists: false },
      ],
    },
  });
}

// ─── 15. GraphQL Query — Country Info (Easy) ─────────────────────────────────

export function createGraphQLCountryQueryScenario(): Scenario {
  return scenario({
    id: 'req-graphql-country',
    name: 'GraphQL: Country Info',
    url: 'https://countries.trevorblades.com/graphql',
    method: 'POST',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    body: JSON.stringify({ query: '{ country(code: "US") { name capital currency } }' }),
    bodyType: 'json',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'existence', jsonPath: '$.data.country', expectExists: true },
        { type: 'regex', jsonPath: '$.data.country.name', pattern: '.+' },
      ],
    },
  });
}

// ─── 16. GraphQL Mutation (Medium) ───────────────────────────────────────────

export function createGraphQLMutationScenario(): Scenario {
  return scenario({
    id: 'req-graphql-mutation',
    name: 'GraphQL: Add Post Mutation',
    url: 'https://graphqlzero.almansi.me/api',
    method: 'POST',
    headers: [{ key: 'Content-Type', value: 'application/json' }],
    body: JSON.stringify({
      query: 'mutation { createPost(input: { title: "Hello from RedfireForge", body: "Testing mutation", userId: 1 }) { id title } }',
    }),
    bodyType: 'json',
    validation: {
      mode: 'full',
      assertions: [
        { type: 'status', expected: '200' },
        { type: 'existence', jsonPath: '$.data.createPost.id', expectExists: true },
        { type: 'existence', jsonPath: '$.errors', expectExists: false },
      ],
    },
  });
}
