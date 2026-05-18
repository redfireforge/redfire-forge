/**
 * Demo/reference adapter for the Data Mapper.
 *
 * Self-contained with sample source/target data for developer documentation,
 * sandbox testing, and as a reference implementation for new adapters.
 */

import type { MapperAdapter, Mapping, ValidationIssue } from '../types';

interface DemoOutput {
  mappings: Array<{ from: string; to: string; expression?: string }>;
}

const SOURCE_SAMPLE = {
  user: {
    firstName: 'Alice',
    lastName: 'Smith',
    age: 30,
    email: 'alice@example.com',
    isActive: true,
  },
  address: {
    street: '123 Main St',
    city: 'Springfield',
    zip: '62704',
    country: 'US',
  },
  orders: [
    { id: 1001, total: 59.99, status: 'shipped' },
    { id: 1002, total: 24.5, status: 'pending' },
  ],
};

const TARGET_SAMPLE = {
  fullName: '',
  email: '',
  age: 0,
  active: false,
  shippingAddress: {
    line1: '',
    city: '',
    postalCode: '',
  },
  totalOrders: 0,
  metadata: {
    source: '',
  },
};

export function createDemoAdapter(): MapperAdapter<DemoOutput> {
  return {
    contextId: 'demo',
    title: 'Demo Adapter — User → Order Summary',
    category: 'custom',
    capabilities: { expressions: true, schemaDrift: true, profiles: true },

    sources: [
      {
        id: 'api-response',
        label: 'API Response',
        sampleData: SOURCE_SAMPLE,
        format: 'json',
        fieldDescriptions: {
          'user.firstName': 'Customer first name',
          'user.lastName': 'Customer last name',
          'user.age': 'Customer age in years',
          'user.email': 'Primary email address',
          'user.isActive': 'Account active flag',
          'address.zip': 'US ZIP code',
          'orders': 'List of recent orders',
        },
      },
    ],

    target: {
      label: 'Order Summary',
      sampleData: TARGET_SAMPLE,
      allowCustomFields: false,
      fields: [
        { path: 'fullName', label: 'Full Name', type: 'string', required: true },
        { path: 'email', label: 'Email', type: 'string', required: true },
        { path: 'age', label: 'Age', type: 'number' },
        { path: 'active', label: 'Active', type: 'boolean' },
        { path: 'shippingAddress.line1', label: 'Address Line 1', type: 'string' },
        { path: 'shippingAddress.city', label: 'City', type: 'string' },
        { path: 'shippingAddress.postalCode', label: 'Postal Code', type: 'string' },
        { path: 'totalOrders', label: 'Total Orders', type: 'number' },
        { path: 'metadata.source', label: 'Source System', type: 'string' },
      ],
      fieldConstraints: {
        fullName: { type: 'string', required: true, maxLength: 100 },
        email: { type: 'string', required: true, pattern: '^.+@.+$' },
        age: { type: 'number' },
        active: { type: 'boolean' },
        'shippingAddress.postalCode': { type: 'string', maxLength: 10 },
        totalOrders: { type: 'number' },
      },
    },

    serialize(mappings: Mapping[]): DemoOutput {
      return {
        mappings: mappings.map((m) => ({
          from: `${m.sourceId}::${m.sourcePath}`,
          to: m.targetPath,
          ...(m.expression ? { expression: m.expression } : {}),
        })),
      };
    },

    deserialize(existing: DemoOutput): Mapping[] {
      if (!existing?.mappings) return [];
      return existing.mappings.map((m, i) => {
        // Support both :: (new) and . (legacy) delimiters
        const colonIdx = m.from.indexOf('::');
        if (colonIdx >= 0) {
          return {
            id: `demo-${i}`,
            sourceId: m.from.slice(0, colonIdx),
            sourcePath: m.from.slice(colonIdx + 2),
            targetPath: m.to,
            expression: m.expression,
          };
        }
        const dotIdx = m.from.indexOf('.');
        return {
          id: `demo-${i}`,
          sourceId: dotIdx >= 0 ? m.from.slice(0, dotIdx) : 'api-response',
          sourcePath: dotIdx >= 0 ? m.from.slice(dotIdx + 1) : m.from,
          targetPath: m.to,
          expression: m.expression,
        };
      });
    },

    validate(mappings: Mapping[]): ValidationIssue[] {
      const issues: ValidationIssue[] = [];
      const emailMapping = mappings.find((m) => m.targetPath === 'email');
      if (emailMapping && !emailMapping.expression) {
        const path = emailMapping.sourcePath;
        if (!path.toLowerCase().includes('email')) {
          issues.push({
            mappingId: emailMapping.id,
            severity: 'warning',
            message: `Source field "${path}" does not appear to be an email field.`,
          });
        }
      }
      return issues;
    },
  };
}
