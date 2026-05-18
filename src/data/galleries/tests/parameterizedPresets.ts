/**
 * Factory functions for parameterized (data-driven) test gallery samples.
 * Each returns a FeatureGroup with a DataSource attached to the test Scenario,
 * hitting real public APIs so they work out-of-the-box.
 */

import type { FeatureGroup, DataSource, DataSourceColumn, DataSourceRow, TestScenario } from '../../../shared/types';

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

// ── 1. User Lookup Sweep (Easy) ─────────────────────────────────────────────

export function createUserLookupSweepTest(): FeatureGroup {
  const columns = [
    col('c-id', 'id', 'path', 'id', 'User ID (1–10)'),
    col('c-name', 'expectedName', 'validate', '$.name'),
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
    row('r10', { 'c-id': '10', 'c-name': 'Clementina DuBuque',    'c-email': 'Rey.Padberg@karina.biz' }),
  ];

  return {
    id: 'test-param-user-sweep',
    name: 'User Lookup Sweep',
    source: 'gallery',
    scenarios: [ts({
      id: 'sc-param-user-sweep',
      name: 'Sweep User IDs 1–10',
      tests: [{
        id: 'req-param-user-sweep',
        name: 'GET /users/{{id}}',
        url: 'https://jsonplaceholder.typicode.com/users/{{id}}',
        method: 'GET',
        headers: [],
        body: '',
        auth: noAuth,
        validation: { mode: 'full', assertions: [{ type: 'status', expected: '200' }] },
        dataSource: ds('ds-user-sweep', columns, rows, 'https://jsonplaceholder.typicode.com/users/{{id}}'),
      }],
    })],
  };
}

// ── 2. Product Search Matrix (Easy) ─────────────────────────────────────────

export function createProductSearchMatrixTest(): FeatureGroup {
  const columns = [
    col('c-query', 'query', 'param', 'q', 'Search keyword'),
    col('c-minResults', 'minResults', 'validate', '$.total', 'Minimum expected results'),
  ];
  const rows: DataSourceRow[] = [
    row('r1', { 'c-query': 'phone',   'c-minResults': '1' }, { tags: ['electronics'] }),
    row('r2', { 'c-query': 'laptop',  'c-minResults': '1' }, { tags: ['electronics'] }),
    row('r3', { 'c-query': 'watch',   'c-minResults': '1' }, { tags: ['accessories'] }),
    row('r4', { 'c-query': 'shoes',   'c-minResults': '1' }, { tags: ['fashion'] }),
    row('r5', { 'c-query': 'perfume', 'c-minResults': '1' }, { tags: ['beauty'] }),
  ];

  return {
    id: 'test-param-product-search',
    name: 'Product Search Matrix',
    source: 'gallery',
    scenarios: [ts({
      id: 'sc-param-product-search',
      name: 'Search Products by Keyword',
      tests: [{
        id: 'req-param-product-search',
        name: 'GET /products/search?q={{query}}',
        url: 'https://dummyjson.com/products/search',
        method: 'GET',
        headers: [],
        body: '',
        auth: noAuth,
        validation: { mode: 'full', assertions: [
          { type: 'status', expected: '200' },
          { type: 'numeric', jsonPath: '$.total', operator: '>=', value: 1 },
        ]},
        dataSource: ds('ds-product-search', columns, rows),
      }],
    })],
  };
}

// ── 3. Country Validation Suite (Medium) ────────────────────────────────────

export function createCountryValidationSuiteTest(): FeatureGroup {
  const columns = [
    col('c-name', 'name', 'path', 'name', 'Country name'),
    col('c-capital', 'expectedCapital', 'validate', '$[0].capital[0]', 'Expected capital city'),
    col('c-region', 'expectedRegion', 'validate', '$[0].region', 'Expected region'),
  ];
  const rows: DataSourceRow[] = [
    row('r1', { 'c-name': 'japan',     'c-capital': 'Tokyo',      'c-region': 'Asia' }),
    row('r2', { 'c-name': 'france',    'c-capital': 'Paris',      'c-region': 'Europe' }),
    row('r3', { 'c-name': 'brazil',    'c-capital': 'Brasília',   'c-region': 'Americas' }),
    row('r4', { 'c-name': 'australia', 'c-capital': 'Canberra',   'c-region': 'Oceania' }),
    row('r5', { 'c-name': 'egypt',     'c-capital': 'Cairo',      'c-region': 'Africa' }),
    row('r6', { 'c-name': 'canada',    'c-capital': 'Ottawa',     'c-region': 'Americas' }),
    row('r7', { 'c-name': 'germany',   'c-capital': 'Berlin',     'c-region': 'Europe' }),
    row('r8', { 'c-name': 'india',     'c-capital': 'New Delhi',  'c-region': 'Asia' }),
  ];

  return {
    id: 'test-param-country-validation',
    name: 'Country Validation Suite',
    source: 'gallery',
    scenarios: [ts({
      id: 'sc-param-country-validation',
      name: 'Validate Country Capitals & Regions',
      tests: [{
        id: 'req-param-country-validation',
        name: 'GET /v3.1/name/{{name}}',
        url: 'https://restcountries.com/v3.1/name/{{name}}',
        method: 'GET',
        headers: [],
        body: '',
        auth: noAuth,
        validation: { mode: 'full', assertions: [{ type: 'status', expected: '200' }] },
        dataSource: ds('ds-country-validation', columns, rows, 'https://restcountries.com/v3.1/name/{{name}}'),
      }],
    })],
  };
}

// ── 4. Pokémon Contract Sweep (Medium) ──────────────────────────────────────

export function createPokemonContractSweepTest(): FeatureGroup {
  const columns = [
    col('c-name', 'name', 'path', 'name', 'Pokémon name'),
    col('c-type', 'expectedType', 'validate', '$.types[0].type.name', 'Expected primary type'),
    col('c-id', 'expectedId', 'validate', '$.id', 'Expected Pokédex ID'),
  ];
  const rows: DataSourceRow[] = [
    row('r1',  { 'c-name': 'pikachu',    'c-type': 'electric', 'c-id': '25' }),
    row('r2',  { 'c-name': 'charizard',  'c-type': 'fire',     'c-id': '6' }),
    row('r3',  { 'c-name': 'bulbasaur',  'c-type': 'grass',    'c-id': '1' }),
    row('r4',  { 'c-name': 'squirtle',   'c-type': 'water',    'c-id': '7' }),
    row('r5',  { 'c-name': 'gengar',     'c-type': 'ghost',    'c-id': '94' }),
    row('r6',  { 'c-name': 'snorlax',    'c-type': 'normal',   'c-id': '143' }),
    row('r7',  { 'c-name': 'machamp',    'c-type': 'fighting', 'c-id': '68' }),
    row('r8',  { 'c-name': 'alakazam',   'c-type': 'psychic',  'c-id': '65' }),
    row('r9',  { 'c-name': 'jigglypuff', 'c-type': 'normal',   'c-id': '39' }),
    row('r10', { 'c-name': 'eevee',      'c-type': 'normal',   'c-id': '133' }),
  ];

  return {
    id: 'test-param-pokemon-contract',
    name: 'Pokémon Contract Sweep',
    source: 'gallery',
    scenarios: [ts({
      id: 'sc-param-pokemon-contract',
      name: 'Verify Pokémon Types & IDs',
      tests: [{
        id: 'req-param-pokemon-contract',
        name: 'GET /api/v2/pokemon/{{name}}',
        url: 'https://pokeapi.co/api/v2/pokemon/{{name}}',
        method: 'GET',
        headers: [],
        body: '',
        auth: noAuth,
        validation: { mode: 'full', assertions: [{ type: 'status', expected: '200' }] },
        dataSource: ds('ds-pokemon-contract', columns, rows, 'https://pokeapi.co/api/v2/pokemon/{{name}}'),
      }],
    })],
  };
}

// ── 5. Multi-Endpoint Regression (Advanced) ─────────────────────────────────

export function createMultiEndpointRegressionTest(): FeatureGroup {
  // Scenario 1: Users endpoint
  const userCols = [
    col('c-uid', 'id', 'path', 'id', 'User ID'),
    col('c-first', 'expectedFirst', 'validate', '$.firstName', 'Expected first name'),
  ];
  const userRows: DataSourceRow[] = [
    row('r1', { 'c-uid': '1',  'c-first': 'Emily' }),
    row('r2', { 'c-uid': '2',  'c-first': 'Michael' }),
    row('r3', { 'c-uid': '3',  'c-first': 'Sophia' }),
    row('r4', { 'c-uid': '4',  'c-first': 'James' }),
    row('r5', { 'c-uid': '5',  'c-first': 'Emma' }),
  ];

  // Scenario 2: Products endpoint
  const prodCols = [
    col('c-pid', 'id', 'path', 'id', 'Product ID'),
    col('c-cat', 'expectedCategory', 'validate', '$.category', 'Expected category'),
  ];
  const prodRows: DataSourceRow[] = [
    row('r1', { 'c-pid': '1',  'c-cat': 'beauty' }),
    row('r2', { 'c-pid': '6',  'c-cat': 'fragrances' }),
    row('r3', { 'c-pid': '11', 'c-cat': 'kitchen-accessories' }),
    row('r4', { 'c-pid': '19', 'c-cat': 'skin-care' }),
    row('r5', { 'c-pid': '27', 'c-cat': 'furniture' }),
  ];

  // Scenario 3: Recipes endpoint
  const recipeCols = [
    col('c-rid', 'id', 'path', 'id', 'Recipe ID'),
    col('c-cuisine', 'expectedCuisine', 'validate', '$.cuisine', 'Expected cuisine'),
  ];
  const recipeRows: DataSourceRow[] = [
    row('r1', { 'c-rid': '1', 'c-cuisine': 'Italian' }),
    row('r2', { 'c-rid': '2', 'c-cuisine': 'Japanese' }),
    row('r3', { 'c-rid': '3', 'c-cuisine': 'Pakistani' }),
    row('r4', { 'c-rid': '4', 'c-cuisine': 'Mexican' }),
    row('r5', { 'c-rid': '5', 'c-cuisine': 'American' }),
  ];

  // Scenario 4: Quotes endpoint
  const quoteCols = [
    col('c-qid', 'id', 'path', 'id', 'Quote ID'),
    col('c-author', 'expectedAuthor', 'validate', '$.author', 'Expected author'),
  ];
  const quoteRows: DataSourceRow[] = [
    row('r1', { 'c-qid': '1', 'c-author': 'Albert Einstein' }),
    row('r2', { 'c-qid': '2', 'c-author': 'Thomas A. Edison' }),
    row('r3', { 'c-qid': '3', 'c-author': 'Eleanor Roosevelt' }),
    row('r4', { 'c-qid': '4', 'c-author': 'Steve Jobs' }),
    row('r5', { 'c-qid': '5', 'c-author': 'Maya Angelou' }),
  ];

  return {
    id: 'test-param-multi-endpoint',
    name: 'Multi-Endpoint Regression',
    source: 'gallery',
    scenarios: [
      ts({
        id: 'sc-param-multi-users',
        name: 'Users Sweep',
        tests: [{
          id: 'req-param-multi-users',
          name: 'GET /users/{{id}}',
          url: 'https://dummyjson.com/users/{{id}}',
          method: 'GET',
          headers: [],
          body: '',
          auth: noAuth,
          validation: { mode: 'full', assertions: [{ type: 'status', expected: '200' }] },
          dataSource: ds('ds-multi-users', userCols, userRows, 'https://dummyjson.com/users/{{id}}'),
        }],
      }),
      ts({
        id: 'sc-param-multi-products',
        name: 'Products Sweep',
        tests: [{
          id: 'req-param-multi-products',
          name: 'GET /products/{{id}}',
          url: 'https://dummyjson.com/products/{{id}}',
          method: 'GET',
          headers: [],
          body: '',
          auth: noAuth,
          validation: { mode: 'full', assertions: [{ type: 'status', expected: '200' }] },
          dataSource: ds('ds-multi-products', prodCols, prodRows, 'https://dummyjson.com/products/{{id}}'),
        }],
      }),
      ts({
        id: 'sc-param-multi-recipes',
        name: 'Recipes Sweep',
        tests: [{
          id: 'req-param-multi-recipes',
          name: 'GET /recipes/{{id}}',
          url: 'https://dummyjson.com/recipes/{{id}}',
          method: 'GET',
          headers: [],
          body: '',
          auth: noAuth,
          validation: { mode: 'full', assertions: [{ type: 'status', expected: '200' }] },
          dataSource: ds('ds-multi-recipes', recipeCols, recipeRows, 'https://dummyjson.com/recipes/{{id}}'),
        }],
      }),
      ts({
        id: 'sc-param-multi-quotes',
        name: 'Quotes Sweep',
        tests: [{
          id: 'req-param-multi-quotes',
          name: 'GET /quotes/{{id}}',
          url: 'https://dummyjson.com/quotes/{{id}}',
          method: 'GET',
          headers: [],
          body: '',
          auth: noAuth,
          validation: { mode: 'full', assertions: [{ type: 'status', expected: '200' }] },
          dataSource: ds('ds-multi-quotes', quoteCols, quoteRows, 'https://dummyjson.com/quotes/{{id}}'),
        }],
      }),
    ],
  };
}

// ── 6. Row Tags Demo (Easy) ──────────────────────────────────────────────────

export function createRowTagsDemoTest(): FeatureGroup {
  const columns = [
    col('c-id', 'id', 'path', 'id', 'Post ID'),
    col('c-title', 'expectedTitle', 'validate', '$.title', 'Expected post title (partial match)'),
  ];
  const rows: DataSourceRow[] = [
    row('r1',  { 'c-id': '1',  'c-title': 'sunt aut' },           { tags: ['smoke', 'critical'] }),
    row('r2',  { 'c-id': '2',  'c-title': 'qui est' },            { tags: ['smoke'] }),
    row('r3',  { 'c-id': '3',  'c-title': 'ea molestias' },       { tags: ['regression'] }),
    row('r4',  { 'c-id': '10', 'c-title': 'optio' },              { tags: ['regression'] }),
    row('r5',  { 'c-id': '20', 'c-title': 'doloremque' },         { tags: ['edge-case'] }),
    row('r6',  { 'c-id': '50', 'c-title': 'repellendus' },        { tags: ['edge-case', 'slow'] }),
    row('r7',  { 'c-id': '99', 'c-title': 'temporibus' },         { tags: ['edge-case'] }),
    row('r8',  { 'c-id': '100', 'c-title': 'at nam' },            { tags: ['boundary', 'critical'], enabled: false }),
  ];

  return {
    id: 'test-param-row-tags',
    name: 'Row Tags Demo',
    source: 'gallery',
    scenarios: [ts({
      id: 'sc-param-row-tags',
      name: 'Posts with Categorized Rows',
      tests: [{
        id: 'req-param-row-tags',
        name: 'GET /posts/{{id}}',
        url: 'https://jsonplaceholder.typicode.com/posts/{{id}}',
        method: 'GET',
        headers: [],
        body: '',
        auth: noAuth,
        validation: { mode: 'full', assertions: [{ type: 'status', expected: '200' }] },
        dataSource: ds('ds-row-tags', columns, rows, 'https://jsonplaceholder.typicode.com/posts/{{id}}'),
      }],
    })],
  };
}

// ── 7. Auth Token Rotation (Advanced) ───────────────────────────────────────

export function createAuthTokenRotationTest(): FeatureGroup {
  const columns = [
    col('c-user', 'username', 'body', 'username', 'Login username'),
    col('c-pass', 'password', 'body', 'password', 'Login password'),
    col('c-first', 'expectedFirst', 'validate', '$.firstName', 'Expected first name in response'),
  ];
  // DummyJSON test credentials: https://dummyjson.com/docs/auth
  const rows: DataSourceRow[] = [
    row('r1', { 'c-user': 'emilys',    'c-pass': 'emilyspass',    'c-first': 'Emily' },    { tags: ['admin'] }),
    row('r2', { 'c-user': 'michaelw',  'c-pass': 'michaelwpass',  'c-first': 'Michael' },  { tags: ['user'] }),
    row('r3', { 'c-user': 'sophiab',   'c-pass': 'sophiabpass',   'c-first': 'Sophia' },   { tags: ['user'] }),
    row('r4', { 'c-user': 'jamesd',    'c-pass': 'jamesdpass',    'c-first': 'James' },    { tags: ['user'] }),
    row('r5', { 'c-user': 'emmaj',     'c-pass': 'emmajpass',     'c-first': 'Emma' },     { tags: ['admin'] }),
  ];

  return {
    id: 'test-param-auth-rotation',
    name: 'Auth Token Rotation',
    source: 'gallery',
    scenarios: [ts({
      id: 'sc-param-auth-rotation',
      name: 'Login Multiple Users',
      tests: [{
        id: 'req-param-auth-rotation',
        name: 'POST /auth/login',
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
        dataSource: ds('ds-auth-rotation', columns, rows),
      }],
    })],
  };
}
