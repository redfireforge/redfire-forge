/**
 * Phase 10D — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pkg from '../../../package.json';
import {
  resolveGrpcBrowserTransportAdapter,
  isGrpcTransportDispatchImplemented,
} from './grpcBrowserTransportRouter';
import { SPRING_SERVLET_CONTENT_TYPE } from './grpcSpringServletTransportContracts';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('Phase 10D acceptance checklist', () => {
  describe('checklist-1: path resolver', () => {
    it('exports canonical servlet path builder and candidate resolver', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcSpringServletPathResolver.ts`, 'utf8');
      expect(source).toContain('buildSpringServletMethodPath');
      expect(source).toContain('resolveSpringServletPathCandidates');
      expect(source).toContain('SpringServletPathResolutionError');
    });

    it('uses application/grpc content type contract', () => {
      expect(SPRING_SERVLET_CONTENT_TYPE).toBe('application/grpc');
    });
  });

  describe('checklist-2: spring-servlet adapter dispatch + unary client', () => {
    it('spring-servlet adapter is dispatch-ready with unary invoke', () => {
      const adapter = resolveGrpcBrowserTransportAdapter('spring-servlet');
      expect(adapter.dispatchReady).toBe(true);
      expect(isGrpcTransportDispatchImplemented('spring-servlet')).toBe(true);
      expect(adapter.invokeUnary).toBeTypeOf('function');
      expect(adapter.cancelUnary).toBeTypeOf('function');
      expect(adapter.startStream).toBeUndefined();
    });

    it('grpcBrowserTransportAdapters wires spring-servlet unary client', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcBrowserTransportAdapters.ts`, 'utf8');
      expect(source).toContain('invokeGrpcSpringServletUnary');
      expect(source).toContain('cancelGrpcSpringServletUnary');
      expect(source).toContain("mode: 'spring-servlet'");
      expect(source).toContain('createSpringServletAdapter');
      expect(source).toMatch(/function createSpringServletAdapter[\s\S]*dispatchReady: true/);
    });

    it('transport panel gates spring-servlet via dispatchReady and platform support', async () => {
      const source = await readFile(`${root}/features/grpc/components/GrpcTransportPanel.tsx`, 'utf8');
      expect(source).toContain('isGrpcTransportDispatchImplemented');
      expect(source).toContain('isGrpcTransportPlatformSupported');
    });

    it('unary client maps path resolution failures to validation errors', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcGrpcSpringServletUnaryClient.ts`, 'utf8');
      expect(source).toContain('SpringServletPathResolutionError');
      expect(source).toContain("category: 'validation'");
    });

    it('unary client uses length-prefixed grpc frame and TE trailers', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcGrpcSpringServletUnaryClient.ts`, 'utf8');
      expect(source).toContain('encodeGrpcWebDataFrame');
      expect(source).toContain('SPRING_SERVLET_TE_TRAILERS');
      expect(source).toContain('buildSpringServletMethodUrl');
      expect(source).not.toContain('X-Grpc-Web');
      expect(source).not.toContain('grpc-web+proto');
    });

    it('stream start fails closed for spring-servlet with Phase 10H guidance', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcStreamClient.ts`, 'utf8');
      expect(source).toContain('Phase 10H');
    });
  });

  describe('checklist-3: gate script and package entry', () => {
    it('package.json exposes test:grpc:phase10d', () => {
      expect(pkg.scripts?.['test:grpc:phase10d']).toContain('test-grpc-phase10d.sh');
    });
  });
});
