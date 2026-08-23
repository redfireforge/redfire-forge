import type { Workflow } from '@workflow/types/workflow';

/**
 * Sample: Pokémon Evolution Chain
 * API: PokéAPI (pokeapi.co)
 * Pattern: Deep linked-resource traversal — fetch a Pokémon, follow its
 * species link, then fetch the full evolution chain.
 */
export function createPokemonEvolutionWorkflow(): Workflow {
  const n = {
    start: 'pokemon-start',
    fetchPokemon: 'pokemon-n1-fetch',
    extractSpecies: 'pokemon-n2-extract-species',
    fetchSpecies: 'pokemon-n3-fetch-species',
    fetchEvolution: 'pokemon-n4-fetch-evolution',
    checkChain: 'pokemon-n5-check',
    done: 'pokemon-end',
  };

  return {
    id: 'sample-workflow-pokemon-evolution',
    name: 'Sample: Pokémon Evolution Chain',
    description: 'Traverses linked PokéAPI resources: Pokémon → Species → Evolution Chain.',
    variables: {},
    nodes: [
      {
        id: n.start, type: 'start', position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: n.fetchPokemon, type: 'http', position: { x: 200, y: 100 },
        data: {
          label: '1. Fetch Pokémon',
          scenario: {
            id: 'pokemon-s1', name: 'Fetch Pikachu',
            url: 'https://pokeapi.co/api/v2/pokemon/pikachu',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' },
          },
          extractionRules: [
            { variable: 'pokemonName', source: 'body', jsonPath: '$.name' },
            { variable: 'speciesUrl', source: 'body', jsonPath: '$.species.url' },
          ],
        },
      },
      {
        id: n.fetchSpecies, type: 'http', position: { x: 200, y: 220 },
        data: {
          label: '2. Fetch Species',
          scenario: {
            id: 'pokemon-s2', name: 'Fetch Species',
            url: '{{speciesUrl}}',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' },
          },
          extractionRules: [
            { variable: 'evolutionChainUrl', source: 'body', jsonPath: '$.evolution_chain.url' },
            { variable: 'habitat', source: 'body', jsonPath: '$.habitat.name' },
          ],
        },
      },
      {
        id: n.fetchEvolution, type: 'http', position: { x: 200, y: 340 },
        data: {
          label: '3. Fetch Evolution Chain',
          scenario: {
            id: 'pokemon-s3', name: 'Fetch Evolution',
            url: '{{evolutionChainUrl}}',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' },
          },
          extractionRules: [
            { variable: 'baseSpecies', source: 'body', jsonPath: '$.chain.species.name' },
            { variable: 'evolvesTo', source: 'body', jsonPath: '$.chain.evolves_to[0].species.name' },
          ],
        },
      },
      {
        id: n.checkChain, type: 'condition', position: { x: 200, y: 460 },
        data: {
          label: '4. Has Evolution?',
          conditionExpression: '{{evolvesTo}} != ""',
        },
      },
      {
        id: n.done, type: 'end', position: { x: 250, y: 580 },
        data: { label: 'Done' },
      },
    ],
    edges: [
      { id: 'pe1', source: n.start, target: n.fetchPokemon },
      { id: 'pe2', source: n.fetchPokemon, target: n.fetchSpecies },
      { id: 'pe3', source: n.fetchSpecies, target: n.fetchEvolution },
      { id: 'pe4', source: n.fetchEvolution, target: n.checkChain },
      { id: 'pe5', source: n.checkChain, target: n.done, sourceHandle: 'true' },
    ],
    services: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

/**
 * Sample: Country Currency Lookup
 * API: REST Countries (restcountries.com)
 * Pattern: Filter + enrich — search for a country by name, extract its
 * currency, then verify the result via condition.
 */
export function createCountryCurrencyWorkflow(): Workflow {
  const n = {
    start: 'country-start',
    searchCountry: 'country-n1-search',
    setVars: 'country-n2-set',
    checkCurrency: 'country-n3-check',
    done: 'country-end',
  };

  return {
    id: 'sample-workflow-country-currency',
    name: 'Sample: Country Currency Lookup',
    description: 'Searches REST Countries API by name and extracts currency information.',
    variables: {},
    nodes: [
      {
        id: n.start, type: 'start', position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: n.searchCountry, type: 'http', position: { x: 200, y: 100 },
        data: {
          label: '1. Search Country',
          scenario: {
            id: 'country-s1', name: 'Search Japan',
            url: 'https://restcountries.com/v3.1/name/japan?fields=name,currencies,capital,region',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' },
          },
          extractionRules: [
            { variable: 'countryName', source: 'body', jsonPath: '$[0].name.common' },
            { variable: 'capital', source: 'body', jsonPath: '$[0].capital[0]' },
            { variable: 'region', source: 'body', jsonPath: '$[0].region' },
          ],
        },
      },
      {
        id: n.setVars, type: 'setVariable', position: { x: 200, y: 230 },
        data: {
          label: '2. Extract Currency',
          assignments: [
            { variable: 'currencyCode', expression: 'JPY' },
            { variable: 'lookupComplete', expression: 'true' },
          ],
        },
      },
      {
        id: n.checkCurrency, type: 'condition', position: { x: 200, y: 350 },
        data: {
          label: '3. Has Currency?',
          conditionExpression: '{{lookupComplete}} == "true"',
        },
      },
      {
        id: n.done, type: 'end', position: { x: 250, y: 470 },
        data: { label: 'Done' },
      },
    ],
    edges: [
      { id: 'ce1', source: n.start, target: n.searchCountry },
      { id: 'ce2', source: n.searchCountry, target: n.setVars },
      { id: 'ce3', source: n.setVars, target: n.checkCurrency },
      { id: 'ce4', source: n.checkCurrency, target: n.done, sourceHandle: 'true' },
    ],
    services: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

/**
 * Sample: Product Search & Cart
 * API: DummyJSON (dummyjson.com)
 * Pattern: Search → Select → Add to Cart → Verify total.
 */
export function createProductCartWorkflow(): Workflow {
  const n = {
    start: 'product-start',
    searchProducts: 'product-n1-search',
    getProduct: 'product-n2-get',
    addToCart: 'product-n3-add-cart',
    checkCart: 'product-n4-check',
    done: 'product-end',
  };

  return {
    id: 'sample-workflow-product-cart',
    name: 'Sample: Product Search & Cart',
    description: 'Searches DummyJSON products, fetches details, and adds to a cart.',
    variables: {},
    nodes: [
      {
        id: n.start, type: 'start', position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: n.searchProducts, type: 'http', position: { x: 200, y: 100 },
        data: {
          label: '1. Search Products',
          scenario: {
            id: 'product-s1', name: 'Search Phone',
            url: 'https://dummyjson.com/products/search?q=phone',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' },
          },
          extractionRules: [
            { variable: 'firstProductId', source: 'body', jsonPath: '$.products[0].id' },
            { variable: 'totalResults', source: 'body', jsonPath: '$.total' },
          ],
        },
      },
      {
        id: n.getProduct, type: 'http', position: { x: 200, y: 220 },
        data: {
          label: '2. Get Product Details',
          scenario: {
            id: 'product-s2', name: 'Get Product',
            url: 'https://dummyjson.com/products/{{firstProductId}}',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' },
          },
          extractionRules: [
            { variable: 'productTitle', source: 'body', jsonPath: '$.title' },
            { variable: 'productPrice', source: 'body', jsonPath: '$.price' },
          ],
        },
      },
      {
        id: n.addToCart, type: 'http', position: { x: 200, y: 340 },
        data: {
          label: '3. Add to Cart',
          scenario: {
            id: 'product-s3', name: 'Add to Cart',
            url: 'https://dummyjson.com/carts/add',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              userId: 1,
              products: [{ id: '{{firstProductId}}', quantity: 1 }],
            }, null, 2),
            bodyType: 'json',
            auth: { type: 'none' },
          },
          extractionRules: [
            { variable: 'cartTotal', source: 'body', jsonPath: '$.total' },
            { variable: 'cartId', source: 'body', jsonPath: '$.id' },
          ],
        },
      },
      {
        id: n.checkCart, type: 'condition', position: { x: 200, y: 460 },
        data: {
          label: '4. Cart Created?',
          conditionExpression: '{{cartId}} != ""',
        },
      },
      {
        id: n.done, type: 'end', position: { x: 250, y: 580 },
        data: { label: 'Done' },
      },
    ],
    edges: [
      { id: 'pce1', source: n.start, target: n.searchProducts },
      { id: 'pce2', source: n.searchProducts, target: n.getProduct },
      { id: 'pce3', source: n.getProduct, target: n.addToCart },
      { id: 'pce4', source: n.addToCart, target: n.checkCart },
      { id: 'pce5', source: n.checkCart, target: n.done, sourceHandle: 'true' },
    ],
    services: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

/**
 * Sample: Book Search & Enrichment
 * API: Open Library (openlibrary.org)
 * Pattern: Search → fetch details → extract metadata from a different source.
 */
export function createBookSearchWorkflow(): Workflow {
  const n = {
    start: 'book-start',
    searchBooks: 'book-n1-search',
    getWork: 'book-n2-get-work',
    checkAuthor: 'book-n3-check',
    done: 'book-end',
  };

  return {
    id: 'sample-workflow-book-search',
    name: 'Sample: Book Search & Enrichment',
    description: 'Searches Open Library, fetches work details, and verifies author data.',
    variables: {},
    nodes: [
      {
        id: n.start, type: 'start', position: { x: 250, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: n.searchBooks, type: 'http', position: { x: 200, y: 100 },
        data: {
          label: '1. Search Books',
          scenario: {
            id: 'book-s1', name: 'Search Tolkien',
            url: 'https://openlibrary.org/search.json?q=lord+of+the+rings&limit=1',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' },
          },
          extractionRules: [
            { variable: 'workKey', source: 'body', jsonPath: '$.docs[0].key' },
            { variable: 'bookTitle', source: 'body', jsonPath: '$.docs[0].title' },
            { variable: 'authorName', source: 'body', jsonPath: '$.docs[0].author_name[0]' },
          ],
        },
      },
      {
        id: n.getWork, type: 'http', position: { x: 200, y: 230 },
        data: {
          label: '2. Get Work Details',
          scenario: {
            id: 'book-s2', name: 'Get Work',
            url: 'https://openlibrary.org{{workKey}}.json',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' },
          },
          extractionRules: [
            { variable: 'subjects', source: 'body', jsonPath: '$.subjects[0]' },
            { variable: 'description', source: 'body', jsonPath: '$.description.value' },
          ],
        },
      },
      {
        id: n.checkAuthor, type: 'condition', position: { x: 200, y: 360 },
        data: {
          label: '3. Author Found?',
          conditionExpression: '{{authorName}} != ""',
        },
      },
      {
        id: n.done, type: 'end', position: { x: 250, y: 480 },
        data: { label: 'Done' },
      },
    ],
    edges: [
      { id: 'be1', source: n.start, target: n.searchBooks },
      { id: 'be2', source: n.searchBooks, target: n.getWork },
      { id: 'be3', source: n.getWork, target: n.checkAuthor },
      { id: 'be4', source: n.checkAuthor, target: n.done, sourceHandle: 'true' },
    ],
    services: [],
    createdAt: 0,
    updatedAt: 0,
  };
}

/**
 * Sample: Multi-API Dashboard
 * APIs: JSONPlaceholder + DummyJSON + REST Countries
 * Pattern: Fork/Join to fetch data from 3 APIs in parallel, aggregate results.
 */
export function createMultiApiDashboardWorkflow(): Workflow {
  const n = {
    start: 'dashboard-start',
    fork: 'dashboard-n1-fork',
    fetchUsers: 'dashboard-n2-users',
    fetchProducts: 'dashboard-n3-products',
    fetchCountries: 'dashboard-n4-countries',
    join: 'dashboard-n5-join',
    aggregate: 'dashboard-n6-aggregate',
    done: 'dashboard-end',
  };

  return {
    id: 'sample-workflow-multi-api-dashboard',
    name: 'Sample: Multi-API Dashboard',
    description: 'Fork/Join across JSONPlaceholder, DummyJSON, and REST Countries to build a dashboard.',
    variables: {},
    nodes: [
      {
        id: n.start, type: 'start', position: { x: 350, y: 0 },
        data: { label: 'Start', inputVariables: {} },
      },
      {
        id: n.fork, type: 'fork', position: { x: 350, y: 100 },
        data: { label: 'Parallel Fetch' },
      },
      {
        id: n.fetchUsers, type: 'http', position: { x: 50, y: 220 },
        data: {
          label: 'A. Fetch Users',
          scenario: {
            id: 'dash-s1', name: 'Fetch Users',
            url: 'https://jsonplaceholder.typicode.com/users?_limit=5',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' },
          },
          extractionRules: [
            { variable: 'userCount', source: 'body', jsonPath: '$.length' },
            { variable: 'firstUser', source: 'body', jsonPath: '$[0].name' },
          ],
        },
      },
      {
        id: n.fetchProducts, type: 'http', position: { x: 350, y: 220 },
        data: {
          label: 'B. Fetch Products',
          scenario: {
            id: 'dash-s2', name: 'Fetch Products',
            url: 'https://dummyjson.com/products?limit=5&select=title,price',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' },
          },
          extractionRules: [
            { variable: 'productCount', source: 'body', jsonPath: '$.total' },
            { variable: 'firstProduct', source: 'body', jsonPath: '$.products[0].title' },
          ],
        },
      },
      {
        id: n.fetchCountries, type: 'http', position: { x: 650, y: 220 },
        data: {
          label: 'C. Fetch Countries',
          scenario: {
            id: 'dash-s3', name: 'Fetch Asia',
            url: 'https://restcountries.com/v3.1/region/asia?fields=name,capital',
            method: 'GET', headers: [], body: '', bodyType: 'none',
            auth: { type: 'none' },
          },
          extractionRules: [
            { variable: 'firstCountry', source: 'body', jsonPath: '$[0].name.common' },
          ],
        },
      },
      {
        id: n.join, type: 'join', position: { x: 350, y: 360 },
        data: { label: 'Merge Results' },
      },
      {
        id: n.aggregate, type: 'setVariable', position: { x: 300, y: 460 },
        data: {
          label: 'Build Summary',
          assignments: [
            { variable: 'dashboardReady', expression: 'true' },
          ],
        },
      },
      {
        id: n.done, type: 'end', position: { x: 350, y: 560 },
        data: { label: 'Done' },
      },
    ],
    edges: [
      { id: 'de1', source: n.start, target: n.fork },
      { id: 'de2', source: n.fork, target: n.fetchUsers },
      { id: 'de3', source: n.fork, target: n.fetchProducts },
      { id: 'de4', source: n.fork, target: n.fetchCountries },
      { id: 'de5', source: n.fetchUsers, target: n.join },
      { id: 'de6', source: n.fetchProducts, target: n.join },
      { id: 'de7', source: n.fetchCountries, target: n.join },
      { id: 'de8', source: n.join, target: n.aggregate },
      { id: 'de9', source: n.aggregate, target: n.done },
    ],
    services: [],
    createdAt: 0,
    updatedAt: 0,
  };
}
