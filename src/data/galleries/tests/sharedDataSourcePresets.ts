/**
 * Factory functions for Shared Data Source gallery samples.
 * Each returns a FeatureGroup with top-level SharedDataSource[] and tests linked via sharedDataSourceId.
 * All samples use real public APIs so they work out-of-the-box.
 */

import type { FeatureGroup, SharedDataSource, DataSource, DataSourceColumn, DataSourceRow, TestScenario } from '../../../shared/types';

const noAuth = { type: 'none' as const };

function ts(partial: Omit<TestScenario, 'kind'>): TestScenario {
  return { ...partial, kind: 'parameterized' };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function col(id: string, name: string, type: DataSourceColumn['type'], mapping: string, description?: string): DataSourceColumn {
  return { id, name, type, mapping, description: description ?? '' };
}

function row(id: string, values: Record<string, string>, opts?: { tags?: string[]; enabled?: boolean }): DataSourceRow {
  return { id, values, enabled: opts?.enabled ?? true, tags: opts?.tags };
}

function ds(id: string, columns: DataSourceColumn[], rows: DataSourceRow[], urlTemplate?: string): DataSource {
  return {
    id,
    columns,
    rows,
    source: { type: 'inline' },
    distribution: 'sequential',
    urlTemplate,
  };
}

// ── 1. Shared User IDs (Easy) ────────────────────────────────────────────────
// One shared data source used by 2 tests in same scenario

export function createSharedUserIdsFeatureGroup(): FeatureGroup {
  return {
    id: 'fg-shared-user-ids',
    name: 'Shared User IDs',
    source: 'gallery',
    scenarios: [
      ts({
        id: 'sc-shared-users',
        name: 'User Profile Tests',
        tests: [
          {
            id: 'test-shared-user-profile',
            name: 'GET /users/{{id}} — Profile',
            url: 'https://jsonplaceholder.typicode.com/users/{{id}}',
            method: 'GET',
            headers: [],
            body: '',
            auth: noAuth,
            validation: { mode: 'full', assertions: [{ type: 'status', expected: '200' }] },
            sharedDataSourceId: 'sds-user-ids-10',
          },
          {
            id: 'test-shared-user-posts',
            name: 'GET /users/{{id}}/posts — User Posts',
            url: 'https://jsonplaceholder.typicode.com/users/{{id}}/posts',
            method: 'GET',
            headers: [],
            body: '',
            auth: noAuth,
            validation: { mode: 'full', assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '>=', value: 1 },
            ]},
            sharedDataSourceId: 'sds-user-ids-10',
          },
        ],
      }),
    ],
  };
}

export function createSharedUserIdsDataSource(): SharedDataSource {
  const columns = [
    col('c-id', 'id', 'path', 'id', 'User ID (1–10)'),
    col('c-name', 'expectedName', 'validate', '$.name', 'Expected user name'),
    col('c-email', 'expectedEmail', 'validate', '$.email', 'Expected email'),
  ];
  const rows: DataSourceRow[] = [
    row('r1',  { 'c-id': '1',  'c-name': 'Leanne Graham',         'c-email': 'Sincere@april.biz' }),
    row('r2',  { 'c-id': '2',  'c-name': 'Ervin Howell',          'c-email': 'Shanna@melissa.tv' }),
    row('r3',  { 'c-id': '3',  'c-name': 'Clementine Bauch',      'c-email': 'Nathan@yesenia.net' }),
    row('r4',  { 'c-id': '4',  'c-name': 'Patricia Lebsack',      'c-email': 'Julianne.OConner@kory.org' }),
    row('r5',  { 'c-id': '5',  'c-name': 'Chelsey Dietrich',      'c-email': 'Lucio_Hettinger@annie.ca' }),
    row('r6',  { 'c-id': '6',  'c-name': 'Mrs. Dennis Schulist',  'c-email': 'Karley_Dach@jasper.info' }),
    row('r7',  { 'c-id': '7',  'c-name': 'Kurtis Weissnat',       'c-email': 'Telly.Hoeger@billy.biz' }),
    row('r8',  { 'c-id': '8',  'c-name': 'Nicholas Runolfsdottir V', 'c-email': 'Sherwood@rosamond.me' }),
    row('r9',  { 'c-id': '9',  'c-name': 'Glenna Reichert',       'c-email': 'Chaim_McDermott@dana.io' }),
    row('r10', { 'c-id': '10', 'c-name': 'Clementina DuBuque',    'c-email': 'Rey.Padberg@karina.biz' }, { enabled: false }),
  ];

  return {
    id: 'sds-user-ids-10',
    name: 'User IDs (1–10)',
    tags: ['jsonplaceholder', 'users'],
    dataSource: ds('ds-user-ids-10', columns, rows, 'https://jsonplaceholder.typicode.com/users/{{id}}'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fetchConfig: {
      url: 'https://jsonplaceholder.typicode.com/users/{{id}}',
      method: 'GET',
      headers: [],
      auth: { type: 'none' },
    },
  };
}

// ── 2. Shared Product Catalog (Medium) ───────────────────────────────────────
// One shared data source with fetchConfig for API-driven population

export function createSharedProductCatalogFeatureGroup(): FeatureGroup {
  return {
    id: 'fg-shared-product-catalog',
    name: 'Shared Product Catalog',
    source: 'gallery',
    scenarios: [
      ts({
        id: 'sc-shared-products',
        name: 'Product Validation',
        tests: [
          {
            id: 'test-shared-product-detail',
            name: 'GET /products/{{id}} — Detail',
            url: 'https://dummyjson.com/products/{{id}}',
            method: 'GET',
            headers: [],
            body: '',
            auth: noAuth,
            validation: { mode: 'full', assertions: [
              { type: 'status', expected: '200' },
              { type: 'regex', jsonPath: '$.title', pattern: '.+' },
            ]},
            sharedDataSourceId: 'sds-product-catalog',
          },
        ],
      }),
      ts({
        id: 'sc-shared-product-reviews',
        name: 'Product Reviews',
        tests: [
          {
            id: 'test-shared-product-reviews',
            name: 'GET /products/{{id}} — Check Reviews',
            url: 'https://dummyjson.com/products/{{id}}',
            method: 'GET',
            headers: [],
            body: '',
            auth: noAuth,
            validation: { mode: 'full', assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.reviews', operator: '>=', value: 0 },
            ]},
            sharedDataSourceId: 'sds-product-catalog',
          },
        ],
      }),
    ],
  };
}

export function createSharedProductCatalogDataSource(): SharedDataSource {
  const columns = [
    col('c-id', 'id', 'path', 'id', 'Product ID'),
    col('c-title', 'expectedTitle', 'validate', '$.title', 'Expected product title'),
    col('c-category', 'expectedCategory', 'validate', '$.category', 'Expected category'),
    col('c-brand', 'expectedBrand', 'validate', '$.brand', 'Expected brand'),
  ];
  const rows: DataSourceRow[] = [
    row('r1',  { 'c-id': '1',  'c-title': 'Essence Mascara Lash Princess',    'c-category': 'beauty',              'c-brand': 'Essence' }),
    row('r2',  { 'c-id': '2',  'c-title': 'Eyeshadow Palette with Mirror',    'c-category': 'beauty',              'c-brand': 'Glamour Beauty' }),
    row('r3',  { 'c-id': '6',  'c-title': 'Calvin Klein CK One',              'c-category': 'fragrances',          'c-brand': 'Calvin Klein' }),
    row('r4',  { 'c-id': '11', 'c-title': 'Annibale Colombo Bed',             'c-category': 'furniture',           'c-brand': 'Annibale Colombo' }),
    row('r5',  { 'c-id': '19', 'c-title': 'Skin Beauty Serum.',               'c-category': 'skin-care',           'c-brand': 'JEANNE PIAUBERT' }, { tags: ['skincare'] }),
    row('r6',  { 'c-id': '27', 'c-title': 'Flying Wooden Bird',               'c-category': 'home-decoration',     'c-brand': 'Flying Icons' }, { tags: ['home'] }),
    row('r7',  { 'c-id': '42', 'c-title': 'Stylish Keyboard',                 'c-category': 'laptops',             'c-brand': 'Stylist' }, { tags: ['tech'] }),
    row('r8',  { 'c-id': '73', 'c-title': 'Stainless Steel Wrist Watch',      'c-category': 'mens-watches',        'c-brand': 'Naviforce' }, { tags: ['accessories'] }),
  ];

  return {
    id: 'sds-product-catalog',
    name: 'Product Catalog (8 products)',
    tags: ['dummyjson', 'products', 'ecommerce'],
    dataSource: ds('ds-product-catalog', columns, rows, 'https://dummyjson.com/products/{{id}}'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fetchConfig: {
      url: 'https://dummyjson.com/products/{{id}}',
      method: 'GET',
      headers: [{ key: 'Accept', value: 'application/json' }],
      auth: { type: 'none' },
    },
  };
}

// ── 3. Cross-FG Pokémon Data (Medium) ────────────────────────────────────────
// One shared data source referenced by tests across 2 feature groups

export function createCrossFgPokemonFeatureGroup1(): FeatureGroup {
  return {
    id: 'fg-pokemon-stats',
    name: 'Pokémon Stats',
    source: 'gallery',
    scenarios: [
      ts({
        id: 'sc-pokemon-types',
        name: 'Type Verification',
        tests: [
          {
            id: 'test-pokemon-primary-type',
            name: 'GET /pokemon/{{name}} — Primary Type',
            url: 'https://pokeapi.co/api/v2/pokemon/{{name}}',
            method: 'GET',
            headers: [],
            body: '',
            auth: noAuth,
            validation: { mode: 'full', assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.types', operator: '>=', value: 1 },
            ]},
            sharedDataSourceId: 'sds-pokemon-roster',
          },
        ],
      }),
    ],
  };
}

export function createCrossFgPokemonFeatureGroup2(): FeatureGroup {
  return {
    id: 'fg-pokemon-abilities',
    name: 'Pokémon Abilities',
    source: 'gallery',
    scenarios: [
      ts({
        id: 'sc-pokemon-abilities',
        name: 'Ability Check',
        tests: [
          {
            id: 'test-pokemon-abilities',
            name: 'GET /pokemon/{{name}} — Abilities',
            url: 'https://pokeapi.co/api/v2/pokemon/{{name}}',
            method: 'GET',
            headers: [],
            body: '',
            auth: noAuth,
            validation: { mode: 'full', assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.abilities', operator: '>=', value: 1 },
            ]},
            sharedDataSourceId: 'sds-pokemon-roster',
          },
        ],
      }),
      ts({
        id: 'sc-pokemon-moves',
        name: 'Move Count',
        tests: [
          {
            id: 'test-pokemon-moves',
            name: 'GET /pokemon/{{name}} — Moves Count',
            url: 'https://pokeapi.co/api/v2/pokemon/{{name}}',
            method: 'GET',
            headers: [],
            body: '',
            auth: noAuth,
            validation: { mode: 'full', assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.moves', operator: '>=', value: 10 },
            ]},
            sharedDataSourceId: 'sds-pokemon-roster',
          },
        ],
      }),
    ],
  };
}

export function createSharedPokemonRosterDataSource(): SharedDataSource {
  const columns = [
    col('c-name', 'name', 'path', 'name', 'Pokémon name (lowercase)'),
    col('c-type', 'expectedType', 'validate', '$.types[0].type.name', 'Expected primary type'),
    col('c-id', 'expectedId', 'validate', '$.id', 'Expected Pokédex ID'),
  ];
  const rows: DataSourceRow[] = [
    row('r1',  { 'c-name': 'pikachu',    'c-type': 'electric', 'c-id': '25' },  { tags: ['starter', 'electric'] }),
    row('r2',  { 'c-name': 'charizard',  'c-type': 'fire',     'c-id': '6' },   { tags: ['fire', 'flying'] }),
    row('r3',  { 'c-name': 'bulbasaur',  'c-type': 'grass',    'c-id': '1' },   { tags: ['starter', 'grass'] }),
    row('r4',  { 'c-name': 'squirtle',   'c-type': 'water',    'c-id': '7' },   { tags: ['starter', 'water'] }),
    row('r5',  { 'c-name': 'gengar',     'c-type': 'ghost',    'c-id': '94' },  { tags: ['ghost', 'poison'] }),
    row('r6',  { 'c-name': 'eevee',      'c-type': 'normal',   'c-id': '133' }, { tags: ['evolution'] }),
  ];

  return {
    id: 'sds-pokemon-roster',
    name: 'Pokémon Roster (6 Pokémon)',
    tags: ['pokeapi', 'pokemon'],
    dataSource: ds('ds-pokemon-roster', columns, rows, 'https://pokeapi.co/api/v2/pokemon/{{name}}'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fetchConfig: {
      url: 'https://pokeapi.co/api/v2/pokemon/{{name}}',
      method: 'GET',
      headers: [],
      auth: { type: 'none' },
    },
  };
}

// ── 4. Auth Users Shared (Advanced) ──────────────────────────────────────────
// Shared data source with POST body rotation for DummyJSON auth

export function createSharedAuthUsersFeatureGroup(): FeatureGroup {
  return {
    id: 'fg-shared-auth-users',
    name: 'Shared Auth Users',
    source: 'gallery',
    scenarios: [
      ts({
        id: 'sc-shared-auth-login',
        name: 'Login Tests',
        tests: [
          {
            id: 'test-shared-auth-login',
            name: 'POST /auth/login — Multi-User',
            url: 'https://dummyjson.com/auth/login',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: '{"username":"{{username}}","password":"{{password}}"}',
            bodyType: 'json',
            auth: noAuth,
            validation: { mode: 'full', assertions: [
              { type: 'status', expected: '200' },
              { type: 'regex', jsonPath: '$.accessToken', pattern: '.+' },
            ]},
            sharedDataSourceId: 'sds-auth-users',
          },
        ],
      }),
    ],
  };
}

export function createSharedAuthUsersDataSource(): SharedDataSource {
  const columns = [
    col('c-user', 'username', 'body', 'username', 'Login username'),
    col('c-pass', 'password', 'body', 'password', 'Login password'),
    col('c-first', 'expectedFirst', 'validate', '$.firstName'),
  ];
  // DummyJSON test credentials: https://dummyjson.com/docs/auth
  const rows: DataSourceRow[] = [
    row('r1', { 'c-user': 'emilys',    'c-pass': 'emilyspass',    'c-first': 'Emily' },    { tags: ['admin'] }),
    row('r2', { 'c-user': 'michaelw',  'c-pass': 'michaelwpass',  'c-first': 'Michael' },  { tags: ['user'] }),
    row('r3', { 'c-user': 'sophiab',   'c-pass': 'sophiabpass',   'c-first': 'Sophia' },   { tags: ['user'] }),
    row('r4', { 'c-user': 'jamesd',    'c-pass': 'jamesdpass',    'c-first': 'James' },    { tags: ['user'] }),
    row('r5', { 'c-user': 'emmaj',     'c-pass': 'emmajpass',     'c-first': 'Emma' }),
  ];

  return {
    id: 'sds-auth-users',
    name: 'Auth Users (5 credentials)',
    tags: ['dummyjson', 'auth', 'login'],
    dataSource: ds('ds-auth-users', columns, rows),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fetchConfig: {
      url: 'https://dummyjson.com/auth/login',
      method: 'POST',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      body: '{"username":"{{username}}","password":"{{password}}"}',
      bodyType: 'json',
      auth: { type: 'none' },
    },
  };
}
