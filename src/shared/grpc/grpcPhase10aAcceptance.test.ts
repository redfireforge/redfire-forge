/**
 * Phase 10A — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { createGrpcStudioTab, captureGrpcTabExecuteSnapshotFromResolution } from '@grpc/grpcStudioTypes';
import { FIXTURE_DESCRIPTOR_KEY } from './contractFixtures';
import {
  GRPC_STUDIO_TRANSPORT_MODES,
  GRPC_TRANSPORT_CAPABILITY_MATRIX,
  GrpcWebTransportPreflightError,
  assertGrpcTransportExecutePreflight,
  captureGrpcTransportExecuteSnapshotFields,
} from './grpcWebTransportContracts';

describe('Phase 10A acceptance checklist', () => {
  describe('checklist-1: capability matrix frozen for all transport modes', () => {
    it.each(GRPC_STUDIO_TRANSPORT_MODES)('declares capabilities for %s', (mode) => {
      const caps = GRPC_TRANSPORT_CAPABILITY_MATRIX[mode];
      expect(caps.mode).toBe(mode);
      expect(caps.label.length).toBeGreaterThan(0);
    });

    it('grpc-web and spring-servlet disallow client/bidi streaming', () => {
      for (const mode of ['grpc-web', 'spring-servlet'] as const) {
        const caps = GRPC_TRANSPORT_CAPABILITY_MATRIX[mode];
        expect(caps.clientStreaming).toBe(false);
        expect(caps.bidiStreaming).toBe(false);
        expect(caps.unary).toBe(true);
        expect(caps.serverStreaming).toBe(true);
      }
    });
  });

  describe('checklist-2: preflight blocks unsupported call types before network', () => {
    it('throws validation category error for grpc-web client streaming', () => {
      try {
        assertGrpcTransportExecutePreflight({
          transportMode: 'grpc-web',
          callType: 'client_streaming',
        });
        expect.fail('expected preflight to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(GrpcWebTransportPreflightError);
        expect((error as GrpcWebTransportPreflightError).category).toBe('validation');
        expect((error as GrpcWebTransportPreflightError).message).toMatch(/client streaming/i);
      }
    });

    it('allows express client streaming', () => {
      expect(() => assertGrpcTransportExecutePreflight({
        transportMode: 'express',
        callType: 'client_streaming',
      })).not.toThrow();
    });
  });

  describe('checklist-3: execution snapshot carries frozen transport fields', () => {
    it('captureGrpcTabExecuteSnapshot includes transportMode and schema version', () => {
      const tab = createGrpcStudioTab({
        target: 'localhost:50051',
        descriptorKey: FIXTURE_DESCRIPTOR_KEY,
        service: 'echo.EchoService',
        method: 'Echo',
        transportMode: 'grpc-web',
      });
      const snapshot = captureGrpcTabExecuteSnapshotFromResolution(
        tab,
        'req-10a',
        {
          targetValidation: { valid: true, normalized: 'localhost:50051', kind: 'host_port' },
          resolvedTarget: 'localhost:50051',
        },
        'unary',
      );
      expect(snapshot.transportMode).toBe('grpc-web');
      expect(snapshot.transportSchemaVersion).toBe(1);
    });

    it('helper matches snapshot field shape', () => {
      expect(captureGrpcTransportExecuteSnapshotFields('spring-servlet')).toEqual({
        transportMode: 'spring-servlet',
        transportSchemaVersion: 1,
      });
    });
  });
});

describe('Phase 10A hardening deliverables', () => {
  it('registers npm gate script for phase 10A', async () => {
    const pkg = JSON.parse(
      await import('fs/promises').then((fs) =>
        fs.readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
      ),
    ) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['test:grpc:phase10a']).toContain('test-grpc-phase10a.sh');
  });

  it('prepareExecuteSnapshot wires transport preflight', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/grpcStudioUnaryCommands.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('assertGrpcTransportExecutePreflight');
    expect(source).toContain('assertGrpcTransportDispatchReady');
    expect(source).toContain('resolveGrpcStudioTabTransportMode');
  });

  it('stream start wires transport dispatch guard', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(
        new URL('../../features/grpc/hooks/useGrpcStreamSession.ts', import.meta.url),
        'utf8',
      ),
    );
    expect(source).toContain('assertGrpcTransportDispatchReady');
  });

  it('transport facade rejects browser-direct dispatch before network', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./grpcTransportFacade.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('assertGrpcTransportDispatchReady');
    expect(source).toContain('resolveGrpcBrowserTransportAdapterForTab');
  });

  it('stream client rejects browser-direct dispatch before stream_start network', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./grpcStreamClient.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('assertGrpcTransportDispatchReady');
    expect(source).toContain('resolveGrpcBrowserTransportAdapterForTab');
  });

  it('GrpcTabExecuteSnapshot contract includes transport fields', async () => {
    const source = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('./contracts.ts', import.meta.url), 'utf8'),
    );
    expect(source).toContain('transportMode?:');
    expect(source).toContain('transportSchemaVersion?:');
  });
});
