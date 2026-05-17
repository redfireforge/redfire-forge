/**
 * End-to-end Data Mapper sample scenarios.
 *
 * Each factory creates a FeatureGroup with pre-configured requests hitting
 * real public APIs. Scenarios include extractions, validations, body
 * templates, and — critically — embedded sampleJson so the Data Mapper
 * Source/Target panels are pre-populated when opened (before any execution).
 */

import type {
  FeatureGroup,
  Scenario,
  TestScenario,
  Assertion,
  Extraction,
  KeyValue,
} from '../../../shared/types';

const noAuth = { type: 'none' as const };

function ts(partial: Omit<TestScenario, 'kind'>): TestScenario {
  return { ...partial, kind: 'standard' };
}

function sc(partial: {
  id: string;
  name: string;
  url: string;
  method: Scenario['method'];
  headers?: KeyValue[];
  body?: string;
  bodyType?: Scenario['bodyType'];
  assertions?: Assertion[];
  extractions?: Extraction[];
  validation?: Partial<Scenario['validation']>;
}): Scenario {
  return {
    id: partial.id,
    name: partial.name,
    url: partial.url,
    method: partial.method,
    headers: partial.headers ?? [],
    body: partial.body ?? '',
    bodyType: partial.bodyType,
    auth: noAuth,
    extractions: partial.extractions,
    validation: {
      mode: partial.validation?.mode ?? (partial.assertions ? 'full' : 'none'),
      assertions: partial.assertions,
      expectedFields: partial.validation?.expectedFields,
      selectiveMode: partial.validation?.selectiveMode,
      sampleJson: partial.validation?.sampleJson,
    },
  };
}

export const buildPresetScenario = sc;

// ─── Embedded API Response Snapshots ──────────────────────────────────────
// These are real responses from the public APIs, embedded so the Data Mapper
// has source data to display without needing to execute the request first.

const USER_1_RESPONSE = {
  id: 1,
  name: 'Leanne Graham',
  username: 'Bret',
  email: 'Sincere@april.biz',
  address: {
    street: 'Kulas Light',
    suite: 'Apt. 556',
    city: 'Gwenborough',
    zipcode: '92998-3874',
    geo: { lat: '-37.3159', lng: '81.1496' },
  },
  phone: '1-770-736-8031 x56442',
  website: 'hildegard.org',
  company: {
    name: 'Romaguera-Crona',
    catchPhrase: 'Multi-layered client-server neural-net',
    bs: 'harness real-time e-markets',
  },
};

const USER_3_RESPONSE = {
  id: 3,
  name: 'Clementine Bauch',
  username: 'Samantha',
  email: 'Nathan@yesenia.net',
  address: {
    street: 'Douglas Extension',
    suite: 'Suite 847',
    city: 'McKenziehaven',
    zipcode: '59590-4157',
    geo: { lat: '-68.6102', lng: '-47.0653' },
  },
  phone: '1-463-123-4447',
  website: 'ramiro.info',
  company: {
    name: 'Romaguera-Jacobson',
    catchPhrase: 'Face to face bifurcated interface',
    bs: 'e-enable strategic applications',
  },
};

const POSTS_BY_USER_RESPONSE = [
  { userId: 1, id: 1, title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit', body: 'quia et suscipit\nsuscipit recusandae consequuntur...' },
  { userId: 1, id: 2, title: 'qui est esse', body: 'est rerum tempore vitae\nsequi sint nihil reprehenderit dolor...' },
  { userId: 1, id: 3, title: 'ea molestias quasi exercitationem repellat qui ipsa sit aut', body: 'et iusto sed quo iure\nvoluptatem occaecati omnis eligendi...' },
];

const COMMENTS_RESPONSE = [
  { postId: 21, id: 101, name: 'perspiciatis rerum', email: 'Elise_Russel@yahoo.com', body: 'et officiis id praesentium voluptatum...' },
  { postId: 21, id: 102, name: 'voluptate laborum', email: 'Frieda@arlene.com', body: 'est ut sequi repellat in tenetur...' },
  { postId: 21, id: 103, name: 'laudantium iste', email: 'Deon@andrea.biz', body: 'officiis ipsa exercitationem impedit...' },
];

const PRODUCT_1_RESPONSE = {
  id: 1,
  title: 'Essence Mascara Lash Princess',
  description: 'The Essence Mascara Lash Princess is a popular mascara known for its volumizing and lengthening effects.',
  category: 'beauty',
  price: 9.99,
  discountPercentage: 7.17,
  rating: 4.94,
  stock: 5,
  tags: ['beauty', 'mascara'],
  brand: 'Essence',
  sku: 'RCH45Q1A',
  weight: 2,
  dimensions: { width: 23.17, height: 14.43, depth: 28.01 },
  warrantyInformation: '1 month warranty',
  shippingInformation: 'Ships in 1 month',
  availabilityStatus: 'Low Stock',
  reviews: [
    { rating: 2, comment: 'Very unhappy with my purchase!', date: '2024-05-23', reviewerName: 'John Doe', reviewerEmail: 'john.doe@x.dummyjson.com' },
    { rating: 5, comment: 'Very satisfied!', date: '2024-05-23', reviewerName: 'Nolan Gonzalez', reviewerEmail: 'nolan.gonzalez@x.dummyjson.com' },
  ],
  returnPolicy: '30 days return policy',
  minimumOrderQuantity: 24,
  meta: { createdAt: '2024-05-23T08:56:21.618Z', updatedAt: '2024-05-23T08:56:21.618Z', barcode: '9164035109868' },
  thumbnail: 'https://cdn.dummyjson.com/products/images/beauty/Essence%20Mascara%20Lash%20Princess/thumbnail.png',
  images: ['https://cdn.dummyjson.com/products/images/beauty/Essence%20Mascara%20Lash%20Princess/1.png'],
};

const PRODUCTS_LIST_RESPONSE = {
  products: [
    { id: 1, title: 'Essence Mascara Lash Princess', category: 'beauty', price: 9.99, rating: 4.94, stock: 5, brand: 'Essence' },
    { id: 2, title: 'Eyeshadow Palette with Mirror', category: 'beauty', price: 19.99, rating: 3.28, stock: 44, brand: 'Glamour Beauty' },
    { id: 3, title: 'Powder Canister', category: 'beauty', price: 14.99, rating: 3.82, stock: 59, brand: 'Velvet Touch' },
    { id: 4, title: 'Red Lipstick', category: 'beauty', price: 12.99, rating: 4.94, stock: 68, brand: 'Chic Cosmetics' },
    { id: 5, title: 'Red Nail Polish', category: 'beauty', price: 8.99, rating: 3.91, stock: 71, brand: 'Nail Couture' },
  ],
  total: 194,
  skip: 0,
  limit: 5,
};

// ─── 1. Extraction Mapping (Easy) ──────────────────────────────────────────

export function createExtractionMappingSample(): FeatureGroup {
  return {
    id: 'dm-extraction-mapping',
    name: 'Data Mapper — Extraction',
    scenarios: [
      ts({
        id: 'dm-ext-fetch-user',
        name: 'Fetch & Extract User Fields',
        tests: [
          sc({
            id: 'dm-ext-get-user',
            name: 'GET user → extract id, name, email, company',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'numeric', jsonPath: '$.id', operator: '=', value: 1 },
            ],
            extractions: [
              { name: 'userId', source: 'body', expression: '$.id' },
              { name: 'userName', source: 'body', expression: '$.name' },
              { name: 'userEmail', source: 'body', expression: '$.email' },
              { name: 'companyName', source: 'body', expression: '$.company.name' },
              { name: 'city', source: 'body', expression: '$.address.city' },
            ],
            validation: {
              sampleJson: JSON.stringify(USER_1_RESPONSE),
            },
          }),
          sc({
            id: 'dm-ext-get-posts',
            name: 'GET posts by extracted userId',
            url: 'https://jsonplaceholder.typicode.com/posts?userId={{userId}}',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '>', value: 0 },
            ],
            extractions: [
              { name: 'firstPostId', source: 'body', expression: '$[0].id' },
              { name: 'firstPostTitle', source: 'body', expression: '$[0].title' },
            ],
            validation: {
              sampleJson: JSON.stringify(POSTS_BY_USER_RESPONSE),
            },
          }),
        ],
      }),
    ],
  };
}

// ─── 2. Validation Mapping (Easy) ──────────────────────────────────────────

export function createValidationMappingSample(): FeatureGroup {
  return {
    id: 'dm-validation-mapping',
    name: 'Data Mapper — Validation',
    scenarios: [
      ts({
        id: 'dm-val-product',
        name: 'Validate Product Fields',
        tests: [
          sc({
            id: 'dm-val-get-product',
            name: 'GET product/1 → validate name, price, category',
            url: 'https://dummyjson.com/products/1',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
            ],
            validation: {
              mode: 'selective',
              selectiveMode: 'include',
              expectedFields: [
                { jsonPath: '$.title', expectedValue: 'Essence Mascara Lash Princess' },
                { jsonPath: '$.price', expectedValue: '9.99' },
                { jsonPath: '$.category', expectedValue: 'beauty' },
                { jsonPath: '$.brand', expectedValue: 'Essence' },
                { jsonPath: '$.stock', expectedValue: '5' },
              ],
              sampleJson: JSON.stringify(PRODUCT_1_RESPONSE),
            },
          }),
        ],
      }),
    ],
  };
}

// ─── 3. Body Builder Mapping (Medium) ──────────────────────────────────────

export function createBodyBuilderMappingSample(): FeatureGroup {
  return {
    id: 'dm-body-builder',
    name: 'Data Mapper — Body Builder',
    scenarios: [
      ts({
        id: 'dm-body-chain',
        name: 'Extract → Build Body → POST',
        tests: [
          sc({
            id: 'dm-body-fetch',
            name: 'GET user → extract fields for next request',
            url: 'https://jsonplaceholder.typicode.com/users/1',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
            ],
            extractions: [
              { name: 'userId', source: 'body', expression: '$.id' },
              { name: 'userName', source: 'body', expression: '$.name' },
              { name: 'userEmail', source: 'body', expression: '$.email' },
              { name: 'userPhone', source: 'body', expression: '$.phone' },
              { name: 'companyName', source: 'body', expression: '$.company.name' },
              { name: 'companyCatchPhrase', source: 'body', expression: '$.company.catchPhrase' },
            ],
            validation: {
              sampleJson: JSON.stringify(USER_1_RESPONSE),
            },
          }),
          sc({
            id: 'dm-body-post',
            name: 'POST /posts with mapped body template',
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            headers: [
              { key: 'Content-Type', value: 'application/json' },
            ],
            body: JSON.stringify({
              userId: '{{userId}}',
              title: 'Post by {{userName}}',
              body: 'Contact: {{userEmail}} / {{userPhone}}. Company: {{companyName}} — {{companyCatchPhrase}}',
            }, null, 2),
            bodyType: 'json',
            assertions: [
              { type: 'status', expected: '201' },
            ],
          }),
        ],
      }),
    ],
  };
}

// ─── 4. Multi-Step Chain (Medium) ──────────────────────────────────────────

export function createMultiStepChainSample(): FeatureGroup {
  return {
    id: 'dm-multi-step-chain',
    name: 'Data Mapper — Multi-Step Chain',
    scenarios: [
      ts({
        id: 'dm-chain-flow',
        name: 'User → Posts → Comments Chain',
        tests: [
          sc({
            id: 'dm-chain-user',
            name: 'Step 1: GET user → extract userId',
            url: 'https://jsonplaceholder.typicode.com/users/3',
            method: 'GET',
            assertions: [{ type: 'status', expected: '200' }],
            extractions: [
              { name: 'userId', source: 'body', expression: '$.id' },
              { name: 'userName', source: 'body', expression: '$.name' },
              { name: 'userCity', source: 'body', expression: '$.address.city' },
            ],
            validation: {
              sampleJson: JSON.stringify(USER_3_RESPONSE),
            },
          }),
          sc({
            id: 'dm-chain-posts',
            name: 'Step 2: GET posts by userId → extract postId',
            url: 'https://jsonplaceholder.typicode.com/posts?userId={{userId}}',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '>', value: 0 },
            ],
            extractions: [
              { name: 'postId', source: 'body', expression: '$[0].id' },
              { name: 'postTitle', source: 'body', expression: '$[0].title' },
            ],
            validation: {
              sampleJson: JSON.stringify(POSTS_BY_USER_RESPONSE),
            },
          }),
          sc({
            id: 'dm-chain-comments',
            name: 'Step 3: GET comments by postId → validate',
            url: 'https://jsonplaceholder.typicode.com/comments?postId={{postId}}',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '>', value: 0 },
              { type: 'regex', jsonPath: '$[0].email', pattern: '.+@.+' },
            ],
            extractions: [
              { name: 'commentEmail', source: 'body', expression: '$[0].email' },
              { name: 'commentBody', source: 'body', expression: '$[0].body' },
            ],
            validation: {
              sampleJson: JSON.stringify(COMMENTS_RESPONSE),
            },
          }),
        ],
      }),
    ],
  };
}

// ─── 5. Full Combo (Advanced) ──────────────────────────────────────────────

export function createComboMapperSample(): FeatureGroup {
  return {
    id: 'dm-combo-mapper',
    name: 'Data Mapper — Full Combo',
    scenarios: [
      ts({
        id: 'dm-combo-flow',
        name: 'Extract + Validate + Build Body',
        tests: [
          sc({
            id: 'dm-combo-products',
            name: 'GET products → extract & validate fields',
            url: 'https://dummyjson.com/products?limit=5',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'numeric', jsonPath: '$.total', operator: '>', value: 0 },
            ],
            extractions: [
              { name: 'totalProducts', source: 'body', expression: '$.total' },
              { name: 'firstProductId', source: 'body', expression: '$.products[0].id' },
              { name: 'firstProductName', source: 'body', expression: '$.products[0].title' },
              { name: 'firstProductPrice', source: 'body', expression: '$.products[0].price' },
            ],
            validation: {
              mode: 'selective',
              selectiveMode: 'include',
              expectedFields: [
                { jsonPath: '$.limit', expectedValue: '5' },
                { jsonPath: '$.skip', expectedValue: '0' },
              ],
              sampleJson: JSON.stringify(PRODUCTS_LIST_RESPONSE),
            },
          }),
          sc({
            id: 'dm-combo-search',
            name: 'GET product search using extracted name',
            url: 'https://dummyjson.com/products/search?q={{firstProductName}}',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.products', operator: '>', value: 0 },
            ],
          }),
          sc({
            id: 'dm-combo-post',
            name: 'POST add product with mapped body',
            url: 'https://dummyjson.com/products/add',
            method: 'POST',
            headers: [{ key: 'Content-Type', value: 'application/json' }],
            body: JSON.stringify({
              title: 'Copy of {{firstProductName}}',
              price: '{{firstProductPrice}}',
              description: 'Cloned from product #{{firstProductId}}',
              category: 'test',
            }, null, 2),
            bodyType: 'json',
            assertions: [
              { type: 'status', expected: '201' },
            ],
          }),
        ],
      }),
    ],
  };
}

// ─── 6. Validation Operators Showcase (Medium) ─────────────────────────────
// Uses DummyJSON products — demonstrates all operator categories with real data.

const PRODUCTS_SEARCH_RESPONSE = {
  products: [
    {
      id: 1, title: 'Essence Mascara Lash Princess', category: 'beauty',
      price: 9.99, discountPercentage: 7.17, rating: 4.94, stock: 5,
      tags: ['beauty', 'mascara'], brand: 'Essence', sku: 'RCH45Q1A',
      availabilityStatus: 'Low Stock',
      dimensions: { width: 23.17, height: 14.43, depth: 28.01 },
      reviews: [
        { rating: 2, comment: 'Very unhappy with my purchase!', date: '2024-05-23', reviewerName: 'John Doe' },
        { rating: 5, comment: 'Very satisfied!', date: '2024-05-23', reviewerName: 'Nolan Gonzalez' },
      ],
      meta: { createdAt: '2024-05-23T08:56:21.618Z', updatedAt: '2024-05-23T08:56:21.618Z', barcode: '9164035109868' },
    },
    {
      id: 2, title: 'Eyeshadow Palette with Mirror', category: 'beauty',
      price: 19.99, discountPercentage: 5.5, rating: 3.28, stock: 44,
      tags: ['beauty', 'eyeshadow'], brand: 'Glamour Beauty', sku: 'MVCFH27F',
      availabilityStatus: 'In Stock',
      dimensions: { width: 12.1, height: 8.2, depth: 2.3 },
      reviews: [
        { rating: 4, comment: 'Great palette!', date: '2024-05-23', reviewerName: 'Alice Brown' },
        { rating: 3, comment: 'Colors are decent', date: '2024-05-23', reviewerName: 'Bob Wilson' },
      ],
      meta: { createdAt: '2024-05-23T08:56:21.618Z', updatedAt: '2024-05-23T08:56:21.618Z', barcode: '2817839095220' },
    },
    {
      id: 3, title: 'Powder Canister', category: 'beauty',
      price: 14.99, discountPercentage: 18.14, rating: 3.82, stock: 59,
      tags: ['beauty', 'powder'], brand: 'Velvet Touch', sku: 'SFXM1CCB',
      availabilityStatus: 'In Stock',
      dimensions: { width: 8.5, height: 10.5, depth: 8.5 },
      reviews: [
        { rating: 5, comment: 'Love this powder!', date: '2024-05-23', reviewerName: 'Carol Davis' },
      ],
      meta: { createdAt: '2024-05-23T08:56:21.618Z', updatedAt: '2024-05-23T08:56:21.618Z', barcode: '0516267971277' },
    },
  ],
  total: 194,
  skip: 0,
  limit: 3,
};

export function createValidationOperatorsSample(): FeatureGroup {
  return {
    id: 'dm-validation-operators',
    name: 'Data Mapper — Validation Operators',
    scenarios: [
      ts({
        id: 'dm-valops-products',
        name: 'Product Operators Showcase',
        tests: [
          sc({
            id: 'dm-valops-search',
            name: 'GET products → validate with operators',
            url: 'https://dummyjson.com/products?limit=3',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'numeric', jsonPath: '$.total', operator: '>', value: 0 },
              { type: 'arrayLength', jsonPath: '$.products', operator: '>=', value: 1 },
            ],
            validation: {
              mode: 'selective',
              selectiveMode: 'include',
              expectedFields: [
                { jsonPath: '$.products[0].category', expectedValue: 'beauty', operator: 'equals' },
                { jsonPath: '$.products[0].availabilityStatus', expectedValue: 'Discontinued', operator: 'not_equals' },
                { jsonPath: '$.products[0].price', expectedValue: '', operator: 'greater_than', operatorValue: '0' },
                { jsonPath: '$.products[0].rating', expectedValue: '', operator: 'between', operatorValue: '1, 5' },
                { jsonPath: '$.products[0].stock', expectedValue: '', operator: 'greater_than_or_equal', operatorValue: '0' },
                { jsonPath: '$.total', expectedValue: '', operator: 'greater_than', operatorValue: '100' },
                { jsonPath: '$.products[0].title', expectedValue: '', operator: 'contains', operatorValue: 'Mascara' },
                { jsonPath: '$.products[0].brand', expectedValue: '', operator: 'starts_with', operatorValue: 'Ess' },
                { jsonPath: '$.products[0].sku', expectedValue: '', operator: 'regex', operatorValue: '^[A-Z0-9]+$' },
                { jsonPath: '$.products[0].meta', expectedValue: '', operator: 'exists' },
                { jsonPath: '$.products[0].tags', expectedValue: '', operator: 'is_not_empty' },
                { jsonPath: '$.products[0].price', expectedValue: '', operator: 'is_type', operatorValue: 'number' },
                { jsonPath: '$.products[0].category', expectedValue: '', operator: 'in', operatorValue: 'beauty, electronics, furniture' },
              ],
              sampleJson: JSON.stringify(PRODUCTS_SEARCH_RESPONSE),
            },
          }),
        ],
      }),
    ],
  };
}

// ─── 7. Array Assertions & DSL Showcase (Advanced) ─────────────────────────

export function createArrayAssertionsDslSample(): FeatureGroup {
  return {
    id: 'dm-array-assertions-dsl',
    name: 'Data Mapper — Array Assertions & DSL',
    scenarios: [
      ts({
        id: 'dm-arraydsl-products',
        name: 'Array Assertions & DSL Rules',
        tests: [
          sc({
            id: 'dm-arraydsl-search',
            name: 'GET products → array assertions + ASSERT',
            url: 'https://dummyjson.com/products?limit=3',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$.products', operator: '>=', value: 3 },
              { type: 'each', jsonPath: '$.products', fieldPath: 'price', operator: 'greater_than', value: '0' },
              { type: 'each', jsonPath: '$.products', fieldPath: 'rating', operator: 'between', value: '0, 5' },
              { type: 'containsSubset', jsonPath: '$.products', expected: JSON.stringify({ category: 'beauty' }) },
              { type: 'custom', expression: '$gt($count($.body.products), 0)', description: 'Products array is non-empty' },
              { type: 'custom', expression: '$all($.body.products, x => $gte(x.price, 0))', description: 'All prices are non-negative' },
              { type: 'custom', expression: '$all($.body.products, x => $gte(x.rating, 1))', description: 'All ratings >= 1' },
            ],
            validation: {
              mode: 'selective',
              selectiveMode: 'include',
              expectedFields: [
                { jsonPath: '$.total', expectedValue: '', operator: 'greater_than', operatorValue: '0' },
                { jsonPath: '$.products[0].title', expectedValue: '', operator: 'is_not_empty' },
                { jsonPath: '$.products[0].price', expectedValue: '', operator: 'greater_than', operatorValue: '0' },
                { jsonPath: '$.products[0].category', expectedValue: 'beauty', operator: 'equals' },
                { jsonPath: '$.products[0].brand', expectedValue: '', operator: 'exists' },
                { jsonPath: '$.products[0].title', expectedValue: '', operator: 'is_empty', negate: true },
                { jsonPath: '$.products[0].availabilityStatus', expectedValue: 'Discontinued', operator: 'equals', negate: true },
              ],
              sampleJson: JSON.stringify(PRODUCTS_SEARCH_RESPONSE),
            },
          }),
        ],
      }),
    ],
  };
}

// ─── 8. Users Validation (Medium) ─────────────────────────────────────────

const USERS_LIST_RESPONSE = [
  {
    id: 1, name: 'Leanne Graham', username: 'Bret', email: 'Sincere@april.biz',
    address: { street: 'Kulas Light', suite: 'Apt. 556', city: 'Gwenborough', zipcode: '92998-3874', geo: { lat: '-37.3159', lng: '81.1496' } },
    phone: '1-770-736-8031 x56442', website: 'hildegard.org',
    company: { name: 'Romaguera-Crona', catchPhrase: 'Multi-layered client-server neural-net', bs: 'harness real-time e-markets' },
  },
  {
    id: 2, name: 'Ervin Howell', username: 'Antonette', email: 'Shanna@melissa.tv',
    address: { street: 'Victor Plains', suite: 'Suite 879', city: 'Wisokyburgh', zipcode: '90566-7771', geo: { lat: '-43.9509', lng: '-34.4618' } },
    phone: '010-692-6593 x09125', website: 'anastasia.net',
    company: { name: 'Deckow-Crist', catchPhrase: 'Proactive didactic contingency', bs: 'synergize scalable supply-chains' },
  },
  {
    id: 3, name: 'Clementine Bauch', username: 'Samantha', email: 'Nathan@yesenia.net',
    address: { street: 'Douglas Extension', suite: 'Suite 847', city: 'McKenziehaven', zipcode: '59590-4157', geo: { lat: '-68.6102', lng: '-47.0653' } },
    phone: '1-463-123-4447', website: 'ramiro.info',
    company: { name: 'Romaguera-Jacobson', catchPhrase: 'Face to face bifurcated interface', bs: 'e-enable strategic applications' },
  },
];

export function createUsersValidationSample(): FeatureGroup {
  return {
    id: 'dm-users-validation',
    name: 'Data Mapper — Users Validation',
    scenarios: [
      ts({
        id: 'dm-usrval-list',
        name: 'Validate User Fields',
        tests: [
          sc({
            id: 'dm-usrval-get-users',
            name: 'GET users → validate nested structure',
            url: 'https://jsonplaceholder.typicode.com/users',
            method: 'GET',
            assertions: [
              { type: 'status', expected: '200' },
              { type: 'arrayLength', jsonPath: '$', operator: '>=', value: 3 },
              { type: 'each', jsonPath: '$', fieldPath: 'email', operator: 'regex', value: '.+@.+' },
              { type: 'custom', expression: '$all($.body, x => $gt(x.id, 0))', description: 'All user IDs are positive' },
            ],
            validation: {
              mode: 'selective',
              selectiveMode: 'include',
              expectedFields: [
                { jsonPath: '$[0].name', expectedValue: '', operator: 'is_not_empty' },
                { jsonPath: '$[0].email', expectedValue: '', operator: 'contains', operatorValue: '@' },
                { jsonPath: '$[0].address.city', expectedValue: '', operator: 'exists' },
                { jsonPath: '$[0].address.geo.lat', expectedValue: '', operator: 'is_type', operatorValue: 'string' },
                { jsonPath: '$[0].company.name', expectedValue: '', operator: 'is_not_empty' },
                { jsonPath: '$[0].website', expectedValue: '', operator: 'regex', operatorValue: '^[a-z]' },
                { jsonPath: '$[0].id', expectedValue: '', operator: 'greater_than', operatorValue: '0' },
                { jsonPath: '$[0].phone', expectedValue: '', operator: 'exists' },
              ],
              sampleJson: JSON.stringify(USERS_LIST_RESPONSE),
            },
          }),
        ],
      }),
    ],
  };
}
