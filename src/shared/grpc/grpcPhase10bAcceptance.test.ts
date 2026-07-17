/**
 * Phase 10B — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pkg from '../../../package.json';
import {
  GRPC_STUDIO_TRANSPORT_MODES,
} from './grpcWebTransportContracts';
import {
  assertGrpcTransportDispatchReady,
  listGrpcBrowserTransportAdapters,
  resolveGrpcBrowserTransportAdapter,
} from './grpcBrowserTransportRouter';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('Phase 10B acceptance checklist', () => {
  describe('checklist-1: adapter registry covers all transport modes', () => {
    it.each(GRPC_STUDIO_TRANSPORT_MODES)('registers adapter for %s', (mode) => {
      const adapter = resolveGrpcBrowserTransportAdapter(mode);
      expect(adapter.mode).toBe(mode);
    });

    it('express and tauri adapters are dispatch-ready', () => {
      expect(resolveGrpcBrowserTransportAdapter('express').dispatchReady).toBe(true);
      expect(resolveGrpcBrowserTransportAdapter('tauri').dispatchReady).toBe(true);
    });

    it('grpc-web and spring-servlet adapters are dispatch-ready after 10C/10D', () => {
      expect(resolveGrpcBrowserTransportAdapter('grpc-web').dispatchReady).toBe(true);
      expect(resolveGrpcBrowserTransportAdapter('spring-servlet').dispatchReady).toBe(true);
    });
  });

  describe('checklist-2: facade and stream client delegate through router', () => {
    it('grpcTransportFacade imports router adapter resolution', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcTransportFacade.ts`, 'utf8');
      expect(source).toContain('resolveGrpcBrowserTransportAdapterForTab');
      expect(source).toContain('assertGrpcTransportDispatchReady');
      expect(source).not.toContain('resolveDispatchableGrpcTransportForTab');
    });

    it('grpcStreamClient startGrpcStream uses router adapters', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcStreamClient.ts`, 'utf8');
      expect(source).toContain('resolveGrpcBrowserTransportAdapterForTab');
      expect(source).toContain('transportMode?: GrpcStudioTransportMode');
    });

    it('studio hooks pass snapshot transportMode to invoke/stream start', async () => {
      const unarySource = await readFile(`${root}/features/grpc/hooks/grpcStudioUnaryCommands.ts`, 'utf8');
      const streamSource = await readFile(`${root}/features/grpc/hooks/useGrpcStreamSession.ts`, 'utf8');
      const helpersSource = await readFile(`${root}/features/grpc/hooks/grpcStudioSessionHelpers.ts`, 'utf8');
      expect(unarySource).toContain('transportMode: snapshot.transportMode');
      expect(streamSource).toContain('transportMode: snapshot.transportMode');
      expect(unarySource).toContain('lastExecuteSnapshot?.transportMode');
      expect(helpersSource).toContain('lastExecuteSnapshot?.transportMode');
      expect(unarySource).toContain('releaseCompletedGrpcCall(snapshot.requestId, tabId');
    });

    it('health probe cleanup uses express transport for server-side release', async () => {
      const healthSource = await readFile(`${root}/features/grpc/utils/grpcHealthProbe.ts`, 'utf8');
      expect(healthSource).toContain("transportMode: 'express'");
      expect(healthSource).toContain('releaseCompletedGrpcCall');
    });

    it('transport panel gates selection via adapter dispatchReady', async () => {
      const panelSource = await readFile(`${root}/features/grpc/components/GrpcTransportPanel.tsx`, 'utf8');
      expect(panelSource).toContain('isGrpcTransportDispatchImplemented');
    });
  });

  describe('checklist-3: gate script and package entry', () => {
    it('package.json exposes test:grpc:phase10b', () => {
      expect(pkg.scripts?.['test:grpc:phase10b']).toContain('test-grpc-phase10b.sh');
    });

    it('listGrpcBrowserTransportAdapters returns stable count', () => {
      expect(listGrpcBrowserTransportAdapters()).toHaveLength(4);
    });

    it('spring-servlet dispatch guard passes after Phase 10D wiring', () => {
      expect(() => assertGrpcTransportDispatchReady('spring-servlet')).not.toThrow();
    });
  });
});
