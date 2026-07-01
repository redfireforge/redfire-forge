/**
 * Phase 11F - Schema diff engine and severity classification acceptance tests.
 *
 * Validates:
 *   11F-A Descriptor index and wire-shape signatures
 *   11F-B Breaking change corpus
 *   11F-C Non-breaking change corpus
 *   11F-D Informational changes
 *   11F-E Determinism and summary accounting
 *   11F-F JSON/Markdown export
 *   11F-G Source-scan traceability
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type {
  GrpcDescriptor,
  GrpcEnumSchema,
  GrpcFieldSchema,
  GrpcMessageSchema,
  GrpcMethodInfo,
} from './contracts';
import { FIXTURE_DESCRIPTOR, FIXTURE_MULTI_SERVICE_DESCRIPTOR } from './contractFixtures';
import {
  GRPC_SCHEMA_DIFF_CHANGE_TYPES,
  GRPC_SCHEMA_DIFF_ENTITY_TYPES,
  GRPC_SCHEMA_DIFF_SEVERITIES,
  buildGrpcSchemaDiffReport,
  sortGrpcSchemaDiffChanges,
  summarizeGrpcSchemaDiffChanges,
  type GrpcSchemaDiffChange,
} from './grpcSchemaDiffContracts';
import {
  GrpcSchemaDiffDescriptorKeyError,
  buildGrpcDescriptorIndex,
  collectGrpcSchemaDiffChanges,
  computeGrpcSchemaDiff,
  fieldWireShapeSignature,
} from './grpcSchemaDiffEngine';
import {
  serializeGrpcSchemaDiffReportJson,
  serializeGrpcSchemaDiffReportMarkdown,
} from './grpcSchemaDiffExport';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function readSrc(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function field(
  overrides: Partial<GrpcFieldSchema> & Pick<GrpcFieldSchema, 'name' | 'number' | 'type'>,
): GrpcFieldSchema {
  return {
    label: 'optional',
    ...overrides,
  };
}

function message(typeName: string, fields: GrpcFieldSchema[], docComment?: string): GrpcMessageSchema {
  return { typeName, fields, ...(docComment != null ? { docComment } : {}) };
}

function method(
  name: string,
  requestSchema: GrpcMessageSchema,
  responseSchema: GrpcMessageSchema,
  overrides: Partial<GrpcMethodInfo> = {},
): GrpcMethodInfo {
  return {
    name,
    callType: 'unary',
    requestTypeName: requestSchema.typeName,
    responseTypeName: responseSchema.typeName,
    requestSchema,
    responseSchema,
    ...overrides,
  };
}

function descriptor(
  key: string,
  services: GrpcDescriptor['services'],
  extras?: Pick<GrpcDescriptor, 'messageTypes' | 'enumTypes'>,
): GrpcDescriptor {
  return {
    source: 'protoset',
    key,
    services,
    ...extras,
  };
}

const ORDER_REQUEST = message('order.GetOrderRequest', [
  field({ name: 'order_id', number: 1, type: 'string' }),
  field({ name: 'tenant', number: 2, type: 'string' }),
]);

const ORDER_RESPONSE = message('order.GetOrderResponse', [
  field({ name: 'order_id', number: 1, type: 'string' }),
  field({ name: 'status', number: 2, type: 'string' }),
]);

const BASELINE_DESCRIPTOR = descriptor('baseline:v1', [
  {
    fullName: 'order.OrderService',
    methods: [
      method('GetOrder', ORDER_REQUEST, ORDER_RESPONSE),
      method('ListOrders', ORDER_REQUEST, ORDER_RESPONSE, { callType: 'server_streaming' }),
    ],
  },
], {
  enumTypes: [{
    typeName: 'order.Status',
    values: [
      { name: 'UNKNOWN', number: 0 },
      { name: 'OPEN', number: 1 },
    ],
  }],
});

describe('Phase 11F-A - descriptor index and wire-shape signatures', () => {
  it('documents severity, entity, and change type constants', () => {
    expect(GRPC_SCHEMA_DIFF_SEVERITIES).toEqual(['breaking', 'non_breaking', 'informational']);
    expect(GRPC_SCHEMA_DIFF_ENTITY_TYPES).toContain('field');
    expect(GRPC_SCHEMA_DIFF_CHANGE_TYPES).toContain('renamed');
  });

  it('indexes services, embedded messages, and enum types', () => {
    const index = buildGrpcDescriptorIndex(BASELINE_DESCRIPTOR);
    expect(index.services.has('order.OrderService')).toBe(true);
    expect(index.messages.has('order.GetOrderRequest')).toBe(true);
    expect(index.enums.has('order.Status')).toBe(true);
  });

  it('prefers messageTypes entries over method-embedded duplicates', () => {
    const extended = message('order.GetOrderRequest', [
      field({ name: 'order_id', number: 1, type: 'string' }),
      field({ name: 'include_meta', number: 3, type: 'bool' }),
    ]);
    const desc = descriptor('extended', BASELINE_DESCRIPTOR.services, {
      messageTypes: [extended],
    });
    const index = buildGrpcDescriptorIndex(desc);
    expect(index.messages.get('order.GetOrderRequest')?.fields).toHaveLength(2);
  });

  it('builds stable wire-shape signatures for map and message fields', () => {
    const mapField = field({
      name: 'tags',
      number: 5,
      type: 'string',
      label: 'repeated',
      isMap: true,
      mapKeyType: 'string',
    });
    const messageField = field({
      name: 'nested',
      number: 6,
      type: 'message',
      label: 'optional',
      messageTypeName: 'order.Nested',
    });

    expect(fieldWireShapeSignature(mapField)).toBe('map<string,string>:repeated');
    expect(fieldWireShapeSignature(messageField)).toBe('order.Nested:optional');
  });
});

describe('Phase 11F-B - breaking change corpus', () => {
  it('flags removed services as breaking', () => {
    const right = descriptor('candidate', []);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: BASELINE_DESCRIPTOR.key,
      rightDescriptorKey: right.key,
      left: BASELINE_DESCRIPTOR,
      right,
      generatedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(report.summary.breaking).toBeGreaterThanOrEqual(1);
    expect(report.changes.some((c) => c.entityType === 'service' && c.changeType === 'removed')).toBe(true);
  });

  it('flags removed RPCs as breaking', () => {
    const right = descriptor('candidate', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', ORDER_REQUEST, ORDER_RESPONSE)],
    }]);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    const removed = report.changes.find((c) => c.entityPath === 'order.OrderService/ListOrders');
    expect(removed?.severity).toBe('breaking');
    expect(removed?.changeType).toBe('removed');
  });

  it('flags RPC call type changes as breaking', () => {
    const right = descriptor('candidate', [{
      fullName: 'order.OrderService',
      methods: [
        method('GetOrder', ORDER_REQUEST, ORDER_RESPONSE),
        method('ListOrders', ORDER_REQUEST, ORDER_RESPONSE, { callType: 'unary' }),
      ],
    }]);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    expect(report.changes.some((c) => (
      c.entityPath === 'order.OrderService/ListOrders'
      && c.severity === 'breaking'
      && c.description.includes('call type')
    ))).toBe(true);
  });

  it('flags RPC request type changes as breaking', () => {
    const altRequest = message('order.ListOrdersRequest', [
      field({ name: 'page', number: 1, type: 'int32' }),
    ]);
    const right = descriptor('candidate', [{
      fullName: 'order.OrderService',
      methods: [
        method('GetOrder', ORDER_REQUEST, ORDER_RESPONSE),
        method('ListOrders', altRequest, ORDER_RESPONSE, { callType: 'server_streaming' }),
      ],
    }]);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    expect(report.changes.some((c) => c.description.includes('request type changed'))).toBe(true);
  });

  it('flags removed fields as breaking', () => {
    const trimmedRequest = message('order.GetOrderRequest', [
      field({ name: 'order_id', number: 1, type: 'string' }),
    ]);
    const right = descriptor('candidate', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', trimmedRequest, ORDER_RESPONSE)],
    }]);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    expect(report.changes.some((c) => (
      c.entityType === 'field'
      && c.severity === 'breaking'
      && c.entityPath === 'order.GetOrderRequest.tenant'
    ))).toBe(true);
  });

  it('flags field wire-shape changes as breaking', () => {
    const changedRequest = message('order.GetOrderRequest', [
      field({ name: 'order_id', number: 1, type: 'int64' }),
      field({ name: 'tenant', number: 2, type: 'string' }),
    ]);
    const right = descriptor('candidate', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', changedRequest, ORDER_RESPONSE)],
    }]);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    expect(report.changes.some((c) => c.description.includes('wire shape changed'))).toBe(true);
  });

  it('flags required field additions as breaking', () => {
    const requiredRequest = message('order.GetOrderRequest', [
      field({ name: 'order_id', number: 1, type: 'string' }),
      field({ name: 'tenant', number: 2, type: 'string' }),
      field({ name: 'signature', number: 3, type: 'string', label: 'required' }),
    ]);
    const right = descriptor('candidate', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', requiredRequest, ORDER_RESPONSE)],
    }]);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    const added = report.changes.find((c) => c.entityPath === 'order.GetOrderRequest.signature');
    expect(added?.severity).toBe('breaking');
  });

  it('flags removed enum values as breaking', () => {
    const right = descriptor('candidate', BASELINE_DESCRIPTOR.services, {
      enumTypes: [{
        typeName: 'order.Status',
        values: [{ name: 'UNKNOWN', number: 0 }],
      }],
    });
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    expect(report.changes.some((c) => (
      c.entityType === 'enum_value'
      && c.severity === 'breaking'
      && c.entityPath === 'order.Status.OPEN'
    ))).toBe(true);
  });

  it('flags enum value number reassignment as breaking via removal', () => {
    const right = descriptor('candidate', BASELINE_DESCRIPTOR.services, {
      enumTypes: [{
        typeName: 'order.Status',
        values: [
          { name: 'UNKNOWN', number: 0 },
          { name: 'OPEN', number: 99 },
        ],
      }],
    });
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    expect(report.changes.some((c) => (
      c.entityType === 'enum_value'
      && c.severity === 'breaking'
      && c.entityPath === 'order.Status.OPEN'
      && c.changeType === 'removed'
    ))).toBe(true);
  });

  it('flags removed messages as breaking', () => {
    const orphan = message('order.Orphan', [
      field({ name: 'legacy_id', number: 1, type: 'string' }),
    ]);
    const left = descriptor('baseline', BASELINE_DESCRIPTOR.services, {
      messageTypes: [orphan],
    });
    const right = descriptor('candidate', BASELINE_DESCRIPTOR.services);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left,
      right,
    });

    expect(report.changes.some((c) => (
      c.entityType === 'message'
      && c.entityPath === 'order.Orphan'
      && c.severity === 'breaking'
      && c.changeType === 'removed'
    ))).toBe(true);
  });

  it('flags RPC response type changes as breaking', () => {
    const altResponse = message('order.OrderSummary', [
      field({ name: 'summary', number: 1, type: 'string' }),
    ]);
    const right = descriptor('candidate', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', ORDER_REQUEST, altResponse)],
    }]);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    expect(report.changes.some((c) => c.description.includes('response type changed'))).toBe(true);
  });

  it('emits method removals when an entire service is removed', () => {
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right: descriptor('candidate', []),
    });

    expect(report.changes.some((c) => (
      c.entityType === 'method'
      && c.changeType === 'removed'
      && c.entityPath === 'order.OrderService/GetOrder'
    ))).toBe(true);
  });
});

describe('Phase 11F-C - non-breaking change corpus', () => {
  it('classifies added services as non-breaking', () => {
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: FIXTURE_DESCRIPTOR.key,
      rightDescriptorKey: FIXTURE_MULTI_SERVICE_DESCRIPTOR.key,
      left: FIXTURE_DESCRIPTOR,
      right: FIXTURE_MULTI_SERVICE_DESCRIPTOR,
      generatedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(report.changes.some((c) => (
      c.entityType === 'service'
      && c.entityPath === 'health.v1.Health'
      && c.severity === 'non_breaking'
    ))).toBe(true);
  });

  it('classifies added RPCs as non-breaking', () => {
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: FIXTURE_DESCRIPTOR.key,
      rightDescriptorKey: FIXTURE_MULTI_SERVICE_DESCRIPTOR.key,
      left: FIXTURE_DESCRIPTOR,
      right: FIXTURE_MULTI_SERVICE_DESCRIPTOR,
    });

    expect(report.changes.some((c) => (
      c.entityType === 'method'
      && c.severity === 'non_breaking'
      && c.changeType === 'added'
    ))).toBe(true);
  });

  it('classifies optional field additions as non-breaking', () => {
    const extendedRequest = message('order.GetOrderRequest', [
      field({ name: 'order_id', number: 1, type: 'string' }),
      field({ name: 'tenant', number: 2, type: 'string' }),
      field({ name: 'trace_id', number: 3, type: 'string' }),
    ]);
    const right = descriptor('candidate', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', extendedRequest, ORDER_RESPONSE)],
    }]);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    const added = report.changes.find((c) => c.entityPath === 'order.GetOrderRequest.trace_id');
    expect(added?.severity).toBe('non_breaking');
  });

  it('classifies added enum values as non-breaking with caveat', () => {
    const right = descriptor('candidate', BASELINE_DESCRIPTOR.services, {
      enumTypes: [{
        typeName: 'order.Status',
        values: [
          { name: 'UNKNOWN', number: 0 },
          { name: 'OPEN', number: 1 },
          { name: 'CLOSED', number: 2 },
        ],
      }],
    });
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    const added = report.changes.find((c) => c.entityPath === 'order.Status.CLOSED');
    expect(added?.severity).toBe('non_breaking');
    expect(added?.caveat).toContain('unknown enum values');
  });

  it('classifies added enum types as non-breaking', () => {
    const right = descriptor('candidate', BASELINE_DESCRIPTOR.services, {
      enumTypes: [
        ...(BASELINE_DESCRIPTOR.enumTypes ?? []),
        {
          typeName: 'order.Priority',
          values: [{ name: 'LOW', number: 0 }, { name: 'HIGH', number: 1 }],
        } satisfies GrpcEnumSchema,
      ],
    });
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    expect(report.changes.some((c) => (
      c.entityType === 'enum'
      && c.entityPath === 'order.Priority'
      && c.severity === 'non_breaking'
    ))).toBe(true);
    expect(report.changes.some((c) => (
      c.entityType === 'enum_value'
      && c.entityPath === 'order.Priority.HIGH'
      && c.changeType === 'added'
    ))).toBe(true);
  });

  it('classifies added messages as non-breaking', () => {
    const extraMessage = message('order.AuditInfo', [
      field({ name: 'actor', number: 1, type: 'string' }),
    ]);
    const right = descriptor('candidate', BASELINE_DESCRIPTOR.services, {
      messageTypes: [extraMessage],
    });
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    expect(report.changes.some((c) => (
      c.entityType === 'message'
      && c.entityPath === 'order.AuditInfo'
      && c.severity === 'non_breaking'
    ))).toBe(true);
  });

  it('emits enum value removals when an entire enum is removed', () => {
    const right = descriptor('candidate', BASELINE_DESCRIPTOR.services);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    expect(report.changes.some((c) => (
      c.entityType === 'enum_value'
      && c.entityPath === 'order.Status.OPEN'
      && c.changeType === 'removed'
    ))).toBe(true);
  });

  it('reports no changes for identical descriptors', () => {
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: BASELINE_DESCRIPTOR.key,
      rightDescriptorKey: BASELINE_DESCRIPTOR.key,
      left: BASELINE_DESCRIPTOR,
      right: BASELINE_DESCRIPTOR,
      generatedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(report.changes).toEqual([]);
    expect(report.summary).toEqual({ breaking: 0, nonBreaking: 0, informational: 0 });
  });
});

describe('Phase 11F-D - informational changes', () => {
  it('classifies wire-compatible field renames as informational', () => {
    const renamedRequest = message('order.GetOrderRequest', [
      field({ name: 'orderId', number: 1, type: 'string' }),
      field({ name: 'tenant', number: 2, type: 'string' }),
    ]);
    const right = descriptor('candidate', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', renamedRequest, ORDER_RESPONSE)],
    }]);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    expect(report.changes.some((c) => (
      c.severity === 'informational'
      && c.changeType === 'renamed'
      && c.entityPath === 'order.GetOrderRequest#1'
    ))).toBe(true);
  });

  it('classifies doc comment changes as informational', () => {
    const documented = message('order.GetOrderRequest', [
      field({ name: 'order_id', number: 1, type: 'string', docComment: 'Primary identifier' }),
      field({ name: 'tenant', number: 2, type: 'string' }),
    ], 'Request payload');
    const right = descriptor('candidate', [{
      fullName: 'order.OrderService',
      methods: [method('GetOrder', documented, ORDER_RESPONSE)],
    }]);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
    });

    expect(report.changes.some((c) => c.changeType === 'doc_comment_changed')).toBe(true);
  });
  it('classifies method doc comment changes as informational', () => {
    const right = descriptor('candidate', [{
      fullName: 'order.OrderService',
      methods: [
        method('GetOrder', ORDER_REQUEST, ORDER_RESPONSE, { docComment: 'Fetch one order' }),
      ],
    }]);
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: descriptor('baseline', [{
        fullName: 'order.OrderService',
        methods: [method('GetOrder', ORDER_REQUEST, ORDER_RESPONSE)],
      }]),
      right,
    });

    expect(report.changes.some((c) => (
      c.entityType === 'method'
      && c.changeType === 'doc_comment_changed'
    ))).toBe(true);
  });
});

describe('Phase 11F-E - determinism and summary accounting', () => {
  it('sorts changes by severity, entity, and path', () => {
    const changes: GrpcSchemaDiffChange[] = [
      {
        severity: 'informational',
        entityType: 'field',
        entityPath: 'z',
        changeType: 'renamed',
        description: 'z',
      },
      {
        severity: 'breaking',
        entityType: 'method',
        entityPath: 'a',
        changeType: 'removed',
        description: 'a',
      },
      {
        severity: 'non_breaking',
        entityType: 'field',
        entityPath: 'm',
        changeType: 'added',
        description: 'm',
      },
    ];

    const sorted = sortGrpcSchemaDiffChanges(changes);
    expect(sorted.map((c) => c.severity)).toEqual(['breaking', 'non_breaking', 'informational']);
  });

  it('summarizes change counts consistently', () => {
    const changes = collectGrpcSchemaDiffChanges(BASELINE_DESCRIPTOR, descriptor('candidate', []));
    const summary = summarizeGrpcSchemaDiffChanges(changes);
    const report = buildGrpcSchemaDiffReport({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      generatedAt: '2026-06-30T00:00:00.000Z',
      changes,
    });

    expect(report.summary.breaking + report.summary.nonBreaking + report.summary.informational)
      .toBe(changes.length);
    expect(report.summary.breaking).toBe(summary.breaking);
  });

  it('returns zero summary for empty change lists', () => {
    expect(summarizeGrpcSchemaDiffChanges([])).toEqual({
      breaking: 0,
      nonBreaking: 0,
      informational: 0,
    });
  });

  it('indexes fixture descriptors used in integration comparisons', () => {
    const index = buildGrpcDescriptorIndex(FIXTURE_DESCRIPTOR);
    expect(index.services.get('echo.EchoService')?.methods.length).toBe(4);
  });

  it('produces deterministic reports across repeated runs', () => {
    const right = descriptor('candidate', [{
      fullName: 'order.OrderService',
      methods: [
        method('GetOrder', message('order.GetOrderRequest', [
          field({ name: 'order_id', number: 1, type: 'string' }),
          field({ name: 'tenant', number: 2, type: 'string' }),
          field({ name: 'trace_id', number: 3, type: 'string' }),
        ]), ORDER_RESPONSE),
      ],
    }], {
      enumTypes: [{
        typeName: 'order.Status',
        values: [
          { name: 'UNKNOWN', number: 0 },
          { name: 'OPEN', number: 1 },
          { name: 'CLOSED', number: 2 },
        ],
      }],
    });

    const first = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
      generatedAt: '2026-06-30T00:00:00.000Z',
    });
    const second = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right,
      generatedAt: '2026-06-30T00:00:00.000Z',
    });

    expect(serializeGrpcSchemaDiffReportJson(first)).toBe(serializeGrpcSchemaDiffReportJson(second));
  });

  it('rejects reports without descriptor keys', () => {
    const left = { ...BASELINE_DESCRIPTOR, key: '' };
    const right = { ...BASELINE_DESCRIPTOR, key: '' };
    expect(() => computeGrpcSchemaDiff({
      left,
      right,
    })).toThrow(GrpcSchemaDiffDescriptorKeyError);
  });

  it('falls back to descriptor.key when explicit keys are omitted', () => {
    const report = computeGrpcSchemaDiff({
      left: BASELINE_DESCRIPTOR,
      right: BASELINE_DESCRIPTOR,
    });
    expect(report.leftDescriptorKey).toBe(BASELINE_DESCRIPTOR.key);
    expect(report.rightDescriptorKey).toBe(BASELINE_DESCRIPTOR.key);
  });
});

describe('Phase 11F-F - JSON and Markdown export', () => {
  it('serializes JSON with summary and sorted changes', () => {
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: FIXTURE_DESCRIPTOR.key,
      rightDescriptorKey: FIXTURE_MULTI_SERVICE_DESCRIPTOR.key,
      left: FIXTURE_DESCRIPTOR,
      right: FIXTURE_MULTI_SERVICE_DESCRIPTOR,
      generatedAt: '2026-06-30T00:00:00.000Z',
    });

    const json = serializeGrpcSchemaDiffReportJson(report);
    const parsed = JSON.parse(json) as typeof report;
    expect(parsed.summary.nonBreaking).toBeGreaterThan(0);
    expect(parsed.changes).toEqual(report.changes);
    expect(json.endsWith('\n')).toBe(true);
  });

  it('serializes Markdown with summary table and change rows', () => {
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right: descriptor('candidate', []),
      generatedAt: '2026-06-30T00:00:00.000Z',
    });

    const markdown = serializeGrpcSchemaDiffReportMarkdown(report);
    expect(markdown).toContain('# gRPC Schema Diff Report');
    expect(markdown).toContain('## Summary');
    expect(markdown).toContain('| Breaking |');
    expect(markdown).toContain('## Changes');
    expect(markdown).toContain('BREAKING');
  });

  it('renders empty-state Markdown when no changes exist', () => {
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'same',
      rightDescriptorKey: 'same',
      left: BASELINE_DESCRIPTOR,
      right: BASELINE_DESCRIPTOR,
      generatedAt: '2026-06-30T00:00:00.000Z',
    });

    const markdown = serializeGrpcSchemaDiffReportMarkdown(report);
    expect(markdown).toContain('No schema changes detected');
  });
  it('includes caveat text in Markdown export when present', () => {
    const report = computeGrpcSchemaDiff({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      left: BASELINE_DESCRIPTOR,
      right: descriptor('candidate', BASELINE_DESCRIPTOR.services, {
        enumTypes: [{
          typeName: 'order.Status',
          values: [
            { name: 'UNKNOWN', number: 0 },
            { name: 'OPEN', number: 1 },
            { name: 'CLOSED', number: 2 },
          ],
        }],
      }),
      generatedAt: '2026-06-30T00:00:00.000Z',
    });

    const markdown = serializeGrpcSchemaDiffReportMarkdown(report);
    expect(markdown).toContain('unknown enum values');
  });
  it('escapes pipe characters in Markdown table cells', () => {
    const report = buildGrpcSchemaDiffReport({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      generatedAt: '2026-06-30T00:00:00.000Z',
      changes: [{
        severity: 'informational',
        entityType: 'field',
        entityPath: 'order.GetOrderRequest.note',
        changeType: 'doc_comment_changed',
        description: 'Documentation changed for order|GetOrderRequest',
      }],
    });

    const markdown = serializeGrpcSchemaDiffReportMarkdown(report);
    expect(markdown).toContain('order\\|GetOrderRequest');
    expect(markdown.split('\n').filter((line) => line.startsWith('| INFORMATIONAL')).length).toBe(1);
  });

  it('escapes newlines in Markdown table cells', () => {
    const report = buildGrpcSchemaDiffReport({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      generatedAt: '2026-06-30T00:00:00.000Z',
      changes: [{
        severity: 'informational',
        entityType: 'field',
        entityPath: 'order.GetOrderRequest.note',
        changeType: 'doc_comment_changed',
        description: 'line one\nline two',
      }],
    });

    const markdown = serializeGrpcSchemaDiffReportMarkdown(report);
    expect(markdown).toContain('line one line two');
    expect(markdown).not.toMatch(/\| INFORMATIONAL[^\n]*\nline two/);

    const crReport = buildGrpcSchemaDiffReport({
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      generatedAt: '2026-06-30T00:00:00.000Z',
      changes: [{
        severity: 'informational',
        entityType: 'field',
        entityPath: 'order.GetOrderRequest.note',
        changeType: 'doc_comment_changed',
        description: 'alpha\rbeta',
      }],
    });
    const crMarkdown = serializeGrpcSchemaDiffReportMarkdown(crReport);
    expect(crMarkdown).toContain('alpha beta');
    expect(crMarkdown).not.toContain('alpha\r');
  });
});

describe('Phase 11F-G - source-scan traceability', () => {
  it('contracts module exports report builders and sort helpers', () => {
    const src = readSrc('src/shared/grpc/grpcSchemaDiffContracts.ts');
    expect(src.includes('buildGrpcSchemaDiffReport')).toBe(true);
    expect(src.includes('sortGrpcSchemaDiffChanges')).toBe(true);
  });

  it('engine module exports comparator without eval usage', () => {
    const src = readSrc('src/shared/grpc/grpcSchemaDiffEngine.ts');
    expect(src.includes('computeGrpcSchemaDiff')).toBe(true);
    expect(src.includes('fieldWireShapeSignature')).toBe(true);
    expect(src.includes('eval(')).toBe(false);
  });

  it('export module exposes JSON and Markdown serializers', () => {
    const src = readSrc('src/shared/grpc/grpcSchemaDiffExport.ts');
    expect(src.includes('serializeGrpcSchemaDiffReportJson')).toBe(true);
    expect(src.includes('serializeGrpcSchemaDiffReportMarkdown')).toBe(true);
  });
});
