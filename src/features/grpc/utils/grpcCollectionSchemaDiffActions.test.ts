import { describe, expect, it } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_DESCRIPTOR_KEY,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY,
} from '@shared/grpc/contractFixtures';
import {
  buildGrpcHistoryDescriptorDriftReport,
  buildGrpcSavedRequestSchemaCompareIntent,
  compareGrpcSavedRequestSchema,
  detectGrpcHistoryDescriptorDrift,
} from './grpcCollectionSchemaDiffActions';
import type { GrpcSavedRequest } from '@shared/grpc/grpcSavedRequest';

const saved: GrpcSavedRequest = {
  id: 'saved-1',
  name: 'Echo',
  revisionId: 'rev',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  callType: 'unary',
  service: 'echo.EchoService',
  method: 'Echo',
  descriptorKey: FIXTURE_DESCRIPTOR_KEY,
  body: {},
  metadata: {},
  timeoutMs: 30_000,
};

describe('grpcCollectionSchemaDiffActions', () => {
  it('builds compare intent when both descriptor keys are blank after trim', () => {
    const intent = buildGrpcSavedRequestSchemaCompareIntent(
      { ...saved, descriptorKey: '   ' },
      '   ',
    );
    expect(intent.baselineDescriptorKey).toBe('');
    expect(intent.currentDescriptorKey).toBe('');
    expect(intent.keysDiffer).toBe(false);
  });

  it('builds compare intent when descriptor keys differ', () => {
    const intent = buildGrpcSavedRequestSchemaCompareIntent(saved, FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY);
    expect(intent.keysDiffer).toBe(true);
    expect(intent.baselineDescriptorKey).toBe(FIXTURE_DESCRIPTOR_KEY);
  });

  it('builds compare intent when keys match after trim', () => {
    const intent = buildGrpcSavedRequestSchemaCompareIntent(
      { ...saved, descriptorKey: `  ${FIXTURE_DESCRIPTOR_KEY}  ` },
      `  ${FIXTURE_DESCRIPTOR_KEY}  `,
    );
    expect(intent.keysDiffer).toBe(false);
  });

  it('compares saved baseline vs current descriptor', async () => {
    const report = await compareGrpcSavedRequestSchema({
      saved,
      currentDescriptorKey: FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY,
      resolveDescriptor: async (key) => {
        if (key === FIXTURE_DESCRIPTOR_KEY) return FIXTURE_DESCRIPTOR;
        return FIXTURE_MULTI_SERVICE_DESCRIPTOR;
      },
    });
    expect(report.rightDescriptorKey).toBe(FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY);
  });

  it('detects history drift and builds optional diff report', async () => {
    const entry = {
      id: 'hist-1',
      callType: 'unary' as const,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      capturedAt: '2026-07-01T00:00:00.000Z',
      bodyTruncated: false,
      record: { body: {}, metadata: {} },
    };
    expect(detectGrpcHistoryDescriptorDrift(entry, FIXTURE_DESCRIPTOR_KEY)).toBeUndefined();
    expect(detectGrpcHistoryDescriptorDrift({ ...entry, descriptorKey: '   ' }, FIXTURE_DESCRIPTOR_KEY)).toBeUndefined();
    const drift = detectGrpcHistoryDescriptorDrift(entry, FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY);
    expect(drift?.historyEntryId).toBe('hist-1');

    const report = await buildGrpcHistoryDescriptorDriftReport({
      entry,
      currentDescriptorKey: FIXTURE_MULTI_SERVICE_DESCRIPTOR_KEY,
      resolveDescriptor: async (key) => {
        if (key === FIXTURE_DESCRIPTOR_KEY) return FIXTURE_DESCRIPTOR;
        return FIXTURE_MULTI_SERVICE_DESCRIPTOR;
      },
    });
    expect(report?.leftDescriptorKey).toBe(FIXTURE_DESCRIPTOR_KEY);

    const noReport = await buildGrpcHistoryDescriptorDriftReport({
      entry,
      currentDescriptorKey: FIXTURE_DESCRIPTOR_KEY,
      resolveDescriptor: async () => FIXTURE_DESCRIPTOR,
    });
    expect(noReport).toBeUndefined();
  });

  it('returns undefined only when baseline history descriptor key is blank', () => {
    const entry = {
      id: 'hist-2',
      callType: 'unary' as const,
      target: 'localhost:50051',
      service: 'echo.EchoService',
      method: 'Echo',
      descriptorKey: FIXTURE_DESCRIPTOR_KEY,
      capturedAt: '2026-07-01T00:00:00.000Z',
      bodyTruncated: false,
      record: { body: {}, metadata: {} },
    };
    expect(detectGrpcHistoryDescriptorDrift(entry, '   ')).toBeDefined();
    expect(detectGrpcHistoryDescriptorDrift({ ...entry, descriptorKey: '   ' }, '   ')).toBeUndefined();
  });
});
