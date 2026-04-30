/**
 * Catalog Specs Gallery — 8 OpenAPI specifications for real public APIs.
 */

import type { CatalogSpecEntry, CatalogSpecCategory } from './types';
import {
  JSONPLACEHOLDER_API_SPEC,
  FAKESTORE_API_SPEC,
  POKEAPI_SPEC,
  DUMMYJSON_API_SPEC,
  REST_COUNTRIES_API_SPEC,
  HTTPBIN_API_SPEC,
  CORRELATION_WAIT_API_SPEC,
  PET_STORE_API_SPEC,
} from './specs';

export type { CatalogSpecEntry } from './types';
export type { CatalogSpecCategory } from './types';

export const CATALOG_SPEC_CATEGORIES: { key: CatalogSpecCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'rest-api', label: 'REST API' },
  { key: 'microservices', label: 'Microservices' },
  { key: 'public-api', label: 'Public API' },
];

/** The 6 new catalog spec entries (real public APIs). */
const newCatalogSpecs: CatalogSpecEntry[] = [
  {
    id: 'catalog-jsonplaceholder',
    domain: 'catalog',
    name: 'JSONPlaceholder API',
    description: 'Users, posts, comments, todos, albums — versatile REST API with full CRUD',
    icon: '📋',
    category: 'rest-api',
    difficulty: 'easy',
    tags: ['rest', 'crud', 'users', 'posts', 'jsonplaceholder'],
    liveApis: ['jsonplaceholder.typicode.com'],
    endpointCount: 12,
    specVersion: '3.0.3',
    specYaml: JSONPLACEHOLDER_API_SPEC,
    factory: () => JSONPLACEHOLDER_API_SPEC,
  },
  {
    id: 'catalog-fakestore',
    domain: 'catalog',
    name: 'FakeStore API',
    description: 'Products, carts, users, and login — e-commerce REST API for prototyping',
    icon: '🛍️',
    category: 'rest-api',
    difficulty: 'easy',
    tags: ['rest', 'ecommerce', 'products', 'carts', 'fakestore'],
    liveApis: ['fakestoreapi.com'],
    endpointCount: 6,
    specVersion: '3.0.3',
    specYaml: FAKESTORE_API_SPEC,
    factory: () => FAKESTORE_API_SPEC,
  },
  {
    id: 'catalog-pokeapi',
    domain: 'catalog',
    name: 'PokéAPI',
    description: 'Pokémon, types, abilities, moves, species, and evolution chains',
    icon: '⚡',
    category: 'public-api',
    difficulty: 'medium',
    tags: ['pokemon', 'nested', 'linked-resources', 'pagination'],
    liveApis: ['pokeapi.co'],
    endpointCount: 10,
    specVersion: '3.0.3',
    specYaml: POKEAPI_SPEC,
    factory: () => POKEAPI_SPEC,
  },
  {
    id: 'catalog-dummyjson',
    domain: 'catalog',
    name: 'DummyJSON Products',
    description: 'Products, carts, users, auth, and search — rich e-commerce data',
    icon: '🛒',
    category: 'rest-api',
    difficulty: 'medium',
    tags: ['ecommerce', 'products', 'carts', 'auth', 'search'],
    liveApis: ['dummyjson.com'],
    endpointCount: 14,
    specVersion: '3.0.3',
    specYaml: DUMMYJSON_API_SPEC,
    factory: () => DUMMYJSON_API_SPEC,
  },
  {
    id: 'catalog-rest-countries',
    domain: 'catalog',
    name: 'REST Countries',
    description: 'Search countries by name, code, currency, language, capital, and region',
    icon: '🌍',
    category: 'public-api',
    difficulty: 'medium',
    tags: ['countries', 'search', 'filter', 'geography'],
    liveApis: ['restcountries.com'],
    endpointCount: 8,
    specVersion: '3.0.3',
    specYaml: REST_COUNTRIES_API_SPEC,
    factory: () => REST_COUNTRIES_API_SPEC,
  },
  {
    id: 'catalog-httpbin',
    domain: 'catalog',
    name: 'HTTPBin Toolkit',
    description: 'Echo requests, test auth, status codes, delays, redirects, and cookies',
    icon: '🔧',
    category: 'microservices',
    difficulty: 'advanced',
    tags: ['testing', 'echo', 'auth', 'status', 'headers', 'debug'],
    liveApis: ['httpbin.org'],
    endpointCount: 20,
    specVersion: '3.0.3',
    specYaml: HTTPBIN_API_SPEC,
    factory: () => HTTPBIN_API_SPEC,
  },
];

/**
 * Complete catalog spec gallery — 8 entries total.
 */
export const catalogSpecCatalog: CatalogSpecEntry[] = [
  {
    id: 'sample-catalog-correlation-wait',
    domain: 'catalog',
    name: 'Correlation Wait API',
    description: 'Webhook correlation endpoints — pause workflows, receive callbacks, manage async operations.',
    icon: '🔗',
    category: 'webhooks',
    difficulty: 'medium',
    tags: ['correlation', 'webhook', 'async', 'callback'],
    liveApis: ['localhost:3001'],
    endpointCount: 9,
    specVersion: '3.0.3',
    specYaml: CORRELATION_WAIT_API_SPEC,
    factory: () => CORRELATION_WAIT_API_SPEC,
  },
  {
    id: 'sample-catalog-pet-store',
    domain: 'catalog',
    name: 'Pet Store API',
    description: 'Classic REST API example — CRUD for pets, orders, and users with pagination and auth.',
    icon: '🐾',
    category: 'rest-api',
    difficulty: 'easy',
    tags: ['rest', 'crud', 'pets', 'classic'],
    liveApis: ['petstore.swagger.io'],
    endpointCount: 13,
    specVersion: '3.0.3',
    specYaml: PET_STORE_API_SPEC,
    factory: () => PET_STORE_API_SPEC,
  },
  ...newCatalogSpecs,
];
