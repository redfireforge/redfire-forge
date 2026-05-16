/**
 * Data Mapper gallery samples — pre-built mapping presets demonstrating
 * common patterns. Used by the toolbar "Samples" dropdown.
 */

import type { Mapping, MapperSource, MapperTarget } from '../types';

export interface MapperGallerySample {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'advanced';
  tags: string[];
  sources: MapperSource[];
  target: MapperTarget;
  mappings: Mapping[];
}

export const mapperGallerySamples: MapperGallerySample[] = [
  {
    id: 'gallery-direct-field',
    name: 'Direct Field Mapping',
    description: 'Simple one-to-one field mapping between a user API response and a contact card.',
    difficulty: 'easy',
    tags: ['direct', 'basic', 'one-to-one'],
    sources: [
      {
        id: 'src',
        label: 'User API',
        sampleData: {
          id: 42,
          name: 'Alice Smith',
          email: 'alice@example.com',
          phone: '+1-555-0123',
          company: 'Acme Corp',
        },
      },
    ],
    target: {
      label: 'Contact Card',
      sampleData: { displayName: '', emailAddress: '', phoneNumber: '', organization: '' },
      allowCustomFields: false,
      fields: [
        { path: 'displayName', label: 'Display Name', type: 'string', required: true },
        { path: 'emailAddress', label: 'Email Address', type: 'string', required: true },
        { path: 'phoneNumber', label: 'Phone Number', type: 'string' },
        { path: 'organization', label: 'Organization', type: 'string' },
      ],
    },
    mappings: [
      { id: 'g1-m1', sourceId: 'src', sourcePath: 'name', targetPath: 'displayName' },
      { id: 'g1-m2', sourceId: 'src', sourcePath: 'email', targetPath: 'emailAddress' },
      { id: 'g1-m3', sourceId: 'src', sourcePath: 'phone', targetPath: 'phoneNumber' },
      { id: 'g1-m4', sourceId: 'src', sourcePath: 'company', targetPath: 'organization' },
    ],
  },

  {
    id: 'gallery-expression-transform',
    name: 'Expression Transformations',
    description: 'Transform fields using expression functions: concatenation, case conversion, and math.',
    difficulty: 'medium',
    tags: ['expression', 'transform', 'concat', 'upper', 'math'],
    sources: [
      {
        id: 'src',
        label: 'Employee Record',
        sampleData: {
          firstName: 'bob',
          lastName: 'jones',
          salary: 75000,
          bonus: 5000,
          department: 'engineering',
        },
      },
    ],
    target: {
      label: 'Payroll Entry',
      sampleData: { fullName: '', department: '', totalCompensation: 0, initials: '' },
      allowCustomFields: false,
      fields: [
        { path: 'fullName', label: 'Full Name', type: 'string', required: true },
        { path: 'department', label: 'Department', type: 'string' },
        { path: 'totalCompensation', label: 'Total Compensation', type: 'number' },
        { path: 'initials', label: 'Initials', type: 'string' },
      ],
    },
    mappings: [
      { id: 'g2-m1', sourceId: 'src', sourcePath: 'firstName', targetPath: 'fullName', expression: '$concat($upper($.firstName), " ", $upper($.lastName))' },
      { id: 'g2-m2', sourceId: 'src', sourcePath: 'department', targetPath: 'department', expression: '$upper($.department)' },
      { id: 'g2-m3', sourceId: 'src', sourcePath: 'salary', targetPath: 'totalCompensation', expression: '$add($.salary, $.bonus)' },
      { id: 'g2-m4', sourceId: 'src', sourcePath: 'firstName', targetPath: 'initials', expression: '$concat($substring($.firstName, 0, 1), $substring($.lastName, 0, 1))' },
    ],
  },

  {
    id: 'gallery-array-mapping',
    name: 'Array Mapping',
    description: 'Map array fields: count items, join strings, and extract nested array values with $jsonpath.',
    difficulty: 'medium',
    tags: ['array', 'loop', 'aggregate', 'count', 'join', 'flatten'],
    sources: [
      {
        id: 'src',
        label: 'Order Response',
        sampleData: {
          orderId: 'ORD-9001',
          items: [
            { name: 'Widget', qty: 3 },
            { name: 'Gadget', qty: 1 },
            { name: 'Gizmo', qty: 2 },
          ],
          tags: ['rush', 'fragile', 'insured'],
        },
      },
    ],
    target: {
      label: 'Order Summary',
      sampleData: { orderId: '', itemCount: 0, itemNames: '', allTags: '' },
      allowCustomFields: false,
      fields: [
        { path: 'orderId', label: 'Order ID', type: 'string', required: true },
        { path: 'itemCount', label: 'Item Count', type: 'number' },
        { path: 'itemNames', label: 'Item Names', type: 'string' },
        { path: 'allTags', label: 'Tags', type: 'string' },
      ],
    },
    mappings: [
      { id: 'g3-m1', sourceId: 'src', sourcePath: 'orderId', targetPath: 'orderId' },
      { id: 'g3-m2', sourceId: 'src', sourcePath: 'items', targetPath: 'itemCount', expression: '$count($.items)' },
      { id: 'g3-m3', sourceId: 'src', sourcePath: 'items', targetPath: 'itemNames', expression: '$join($jsonpath($.items, "$[*].name"), ", ")' },
      { id: 'g3-m4', sourceId: 'src', sourcePath: 'tags', targetPath: 'allTags', expression: '$join($.tags, " | ")' },
    ],
  },

  {
    id: 'gallery-multi-source',
    name: 'Multi-Source Combine',
    description: 'Combine fields from two different API responses into a single target object.',
    difficulty: 'advanced',
    tags: ['multi-source', 'combine', 'merge', 'two-apis'],
    sources: [
      {
        id: 'user-api',
        label: 'User API',
        sampleData: { userId: 101, username: 'alice', email: 'alice@acme.com' },
      },
      {
        id: 'profile-api',
        label: 'Profile API',
        sampleData: { bio: 'Software engineer', avatar: 'https://example.com/alice.png', location: 'New York' },
      },
    ],
    target: {
      label: 'Unified Profile',
      sampleData: { name: '', email: '', bio: '', avatar: '', location: '' },
      allowCustomFields: false,
      fields: [
        { path: 'name', label: 'Name', type: 'string', required: true },
        { path: 'email', label: 'Email', type: 'string', required: true },
        { path: 'bio', label: 'Bio', type: 'string' },
        { path: 'avatar', label: 'Avatar URL', type: 'string' },
        { path: 'location', label: 'Location', type: 'string' },
      ],
    },
    mappings: [
      { id: 'g4-m1', sourceId: 'user-api', sourcePath: 'username', targetPath: 'name' },
      { id: 'g4-m2', sourceId: 'user-api', sourcePath: 'email', targetPath: 'email' },
      { id: 'g4-m3', sourceId: 'profile-api', sourcePath: 'bio', targetPath: 'bio' },
      { id: 'g4-m4', sourceId: 'profile-api', sourcePath: 'avatar', targetPath: 'avatar' },
      { id: 'g4-m5', sourceId: 'profile-api', sourcePath: 'location', targetPath: 'location' },
    ],
  },

  {
    id: 'gallery-type-conversion',
    name: 'Type Conversion',
    description: 'Convert between types: numbers to strings, booleans to strings, string parsing.',
    difficulty: 'easy',
    tags: ['type', 'conversion', 'cast', 'parseFloat', 'toString', 'toBool'],
    sources: [
      {
        id: 'src',
        label: 'Raw Data',
        sampleData: {
          price: '49.99',
          quantity: '12',
          isAvailable: 'true',
          rating: 4.7,
          sku: 10042,
        },
      },
    ],
    target: {
      label: 'Typed Record',
      sampleData: { price: 0, quantity: 0, available: false, ratingText: '', skuCode: '' },
      allowCustomFields: false,
      fields: [
        { path: 'price', label: 'Price', type: 'number', required: true },
        { path: 'quantity', label: 'Quantity', type: 'number' },
        { path: 'available', label: 'Available', type: 'boolean' },
        { path: 'ratingText', label: 'Rating Text', type: 'string' },
        { path: 'skuCode', label: 'SKU Code', type: 'string' },
      ],
    },
    mappings: [
      { id: 'g5-m1', sourceId: 'src', sourcePath: 'price', targetPath: 'price', expression: '$parseFloat($.price)' },
      { id: 'g5-m2', sourceId: 'src', sourcePath: 'quantity', targetPath: 'quantity', expression: '$toInt($.quantity)' },
      { id: 'g5-m3', sourceId: 'src', sourcePath: 'isAvailable', targetPath: 'available', expression: '$toBool($.isAvailable)' },
      { id: 'g5-m4', sourceId: 'src', sourcePath: 'rating', targetPath: 'ratingText', expression: '$toString($.rating)' },
      { id: 'g5-m5', sourceId: 'src', sourcePath: 'sku', targetPath: 'skuCode', expression: '$toString($.sku)' },
    ],
  },

  {
    id: 'gallery-conditional',
    name: 'Conditional Mapping',
    description: 'Use expressions to apply conditional logic: default values, fallbacks, and computed fields.',
    difficulty: 'advanced',
    tags: ['conditional', 'default', 'fallback', 'computed', 'ternary'],
    sources: [
      {
        id: 'src',
        label: 'Product API',
        sampleData: {
          name: 'Wireless Headphones',
          price: 129.99,
          discount: 0.15,
          stock: 0,
          category: 'electronics',
        },
      },
    ],
    target: {
      label: 'Product Display',
      sampleData: { title: '', finalPrice: 0, availability: '', badge: '' },
      allowCustomFields: false,
      fields: [
        { path: 'title', label: 'Title', type: 'string', required: true },
        { path: 'finalPrice', label: 'Final Price', type: 'number', required: true },
        { path: 'availability', label: 'Availability', type: 'string' },
        { path: 'badge', label: 'Badge', type: 'string' },
      ],
    },
    mappings: [
      { id: 'g6-m1', sourceId: 'src', sourcePath: 'name', targetPath: 'title', expression: '$default($.name, "Unknown Product")' },
      { id: 'g6-m2', sourceId: 'src', sourcePath: 'price', targetPath: 'finalPrice', expression: '$multiply($.price, $subtract(1, $default($.discount, 0)))' },
      { id: 'g6-m3', sourceId: 'src', sourcePath: 'stock', targetPath: 'availability', expression: '$if($.stock, "In Stock", "Out of Stock")' },
      { id: 'g6-m4', sourceId: 'src', sourcePath: 'category', targetPath: 'badge', expression: '$if($.discount, $concat("SALE: ", $toString($multiply($.discount, 100)), "% OFF"), "")' },
    ],
  },

  {
    id: 'gallery-location-groups',
    name: 'Location-Aware Target',
    description: 'Map CSV columns to HTTP request slots grouped by location: path, query, header, and body.',
    difficulty: 'medium',
    tags: ['location', 'path', 'query', 'header', 'body', 'column-mapping'],
    sources: [
      {
        id: 'csv',
        label: 'CSV Columns',
        sampleData: {
          user_id: '42',
          page: '1',
          auth_token: 'Bearer abc123',
          display_name: 'Alice',
          email: 'alice@example.com',
        },
      },
    ],
    target: {
      label: 'HTTP Request Slots',
      sampleData: null,
      allowCustomFields: true,
      fields: [
        { path: 'userId', label: 'userId', type: 'path', location: 'path' as never },
        { path: 'page', label: 'page', type: 'param', location: 'query' as never },
        { path: 'Authorization', label: 'Authorization', type: 'header', location: 'header' as never },
        { path: 'name', label: 'name', type: 'string', location: 'body' as never },
        { path: 'email', label: 'email', type: 'string', location: 'body' as never },
      ],
    },
    mappings: [
      { id: 'g7-m1', sourceId: 'csv', sourcePath: 'user_id', targetPath: 'userId' },
      { id: 'g7-m2', sourceId: 'csv', sourcePath: 'page', targetPath: 'page' },
      { id: 'g7-m3', sourceId: 'csv', sourcePath: 'auth_token', targetPath: 'Authorization' },
      { id: 'g7-m4', sourceId: 'csv', sourcePath: 'display_name', targetPath: 'name' },
      { id: 'g7-m5', sourceId: 'csv', sourcePath: 'email', targetPath: 'email' },
    ],
  },

  {
    id: 'gallery-custom-fields',
    name: 'Custom Target Fields',
    description: 'Add custom target fields alongside adapter-defined ones. Mix adapter, custom, and fetched field origins.',
    difficulty: 'medium',
    tags: ['custom', 'target', 'editable', 'origin', 'add-field'],
    sources: [
      {
        id: 'api',
        label: 'Auth Response',
        sampleData: {
          token: 'eyJhbGciOiJIUzI1NiJ9...',
          refreshToken: 'rt_abc123',
          expiresIn: 3600,
          user: { id: 99, role: 'admin' },
        },
      },
    ],
    target: {
      label: 'Extraction Variables',
      sampleData: null,
      allowCustomFields: true,
      fields: [
        { path: 'authToken', label: 'Auth Token', type: 'string' },
        { path: 'refreshToken', label: 'Refresh Token', type: 'string' },
        { path: 'sessionDuration', label: 'Session Duration', type: 'number' },
        { path: 'userId', label: 'User ID', type: 'number' },
        { path: 'userRole', label: 'User Role', type: 'string' },
      ],
    },
    mappings: [
      { id: 'g8-m1', sourceId: 'api', sourcePath: 'token', targetPath: 'authToken' },
      { id: 'g8-m2', sourceId: 'api', sourcePath: 'refreshToken', targetPath: 'refreshToken' },
      { id: 'g8-m3', sourceId: 'api', sourcePath: 'expiresIn', targetPath: 'sessionDuration' },
      { id: 'g8-m4', sourceId: 'api', sourcePath: 'user.id', targetPath: 'userId' },
      { id: 'g8-m5', sourceId: 'api', sourcePath: 'user.role', targetPath: 'userRole' },
    ],
  },

  {
    id: 'gallery-default-values',
    name: 'Pre-Filled Defaults',
    description: 'Target fields with default values from API response. Demonstrates validation adapter pattern.',
    difficulty: 'easy',
    tags: ['default', 'validation', 'expected', 'pre-filled'],
    sources: [
      {
        id: 'response',
        label: 'API Response',
        sampleData: {
          status: 'success',
          data: { id: 1, name: 'Widget', price: 29.99, inStock: true },
        },
      },
    ],
    target: {
      label: 'Validation Expected',
      sampleData: null,
      allowCustomFields: true,
      fields: [
        { path: 'status', label: 'status', type: 'string', defaultValue: 'success' },
        { path: 'data.id', label: 'id', type: 'number', defaultValue: '1' },
        { path: 'data.name', label: 'name', type: 'string', defaultValue: 'Widget' },
        { path: 'data.price', label: 'price', type: 'number', defaultValue: '29.99' },
        { path: 'data.inStock', label: 'inStock', type: 'boolean', defaultValue: 'true' },
      ],
    },
    mappings: [
      { id: 'g9-m1', sourceId: 'response', sourcePath: 'status', targetPath: 'status' },
      { id: 'g9-m2', sourceId: 'response', sourcePath: 'data.name', targetPath: 'data.name' },
      { id: 'g9-m3', sourceId: 'response', sourcePath: 'data.price', targetPath: 'data.price' },
    ],
  },
];
