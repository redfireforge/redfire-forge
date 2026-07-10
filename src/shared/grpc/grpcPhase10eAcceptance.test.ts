/**
 * Phase 10E — Acceptance checklist traceability.
 */
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pkg from '../../../package.json';
import {
  buildBrowserTransportGrpcApiError,
  formatBrowserTransportFailureHint,
  GRPC_BROWSER_TRANSPORT_FAILURE_KINDS,
} from './grpcBrowserTransportErrorMapper';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('Phase 10E acceptance checklist', () => {
  describe('checklist-1: browser transport error mapper', () => {
    it('exports all five browserTransportFailure kinds', () => {
      expect(GRPC_BROWSER_TRANSPORT_FAILURE_KINDS).toEqual([
        'cors',
        'proxy_unreachable',
        'protocol_mismatch',
        'timeout',
        'server_status',
      ]);
    });

    it('mapper module exposes classify, build, and hint formatters', async () => {
      const source = await readFile(`${root}/shared/grpc/grpcBrowserTransportErrorMapper.ts`, 'utf8');
      expect(source).toContain('classifyBrowserTransportFetchFailure');
      expect(source).toContain('classifyBrowserTransportHttpResponse');
      expect(source).toContain('buildBrowserTransportGrpcApiError');
      expect(source).toContain('formatBrowserTransportFailureHint');
      expect(source).toContain('grpcApiErrorToBrowserExpressFallbackBody');
    });

    it('grpc-web and spring-servlet clients route failures through mapper', async () => {
      const webSource = await readFile(`${root}/shared/grpc/grpcGrpcWebUnaryClient.ts`, 'utf8');
      const servletSource = await readFile(`${root}/shared/grpc/grpcGrpcSpringServletUnaryClient.ts`, 'utf8');
      expect(webSource).toContain('mapBrowserTransportFetchFailure');
      expect(servletSource).toContain('mapBrowserTransportFetchFailure');
      expect(webSource).toContain('classifyBrowserTransportHttpResponse');
      expect(servletSource).toContain('classifyBrowserTransportHttpResponse');
      expect(webSource).toContain('assertIncompatibleBrowserTransportContentType');
      expect(servletSource).toContain('assertIncompatibleBrowserTransportContentType');
    });
  });

  describe('checklist-2: hints and Express fallback wiring', () => {
    it('each failure kind produces non-empty hint text', () => {
      for (const kind of GRPC_BROWSER_TRANSPORT_FAILURE_KINDS) {
        const body = buildBrowserTransportGrpcApiError('call', kind, {
          transportMode: 'grpc-web',
          httpStatus: kind === 'server_status' ? 502 : undefined,
        }).toErrorBody();
        expect(formatBrowserTransportFailureHint(body)).toBeTruthy();
      }
    });

    it('unary commands offer browser Express fallback via mapper', async () => {
      const unarySource = await readFile(`${root}/features/grpc/hooks/grpcStudioUnaryCommands.ts`, 'utf8');
      expect(unarySource).toContain('grpcApiErrorToBrowserExpressFallbackBody');
      expect(unarySource).toContain('isBrowserDirectTransportMode');
    });

    it('stream session offers browser Express fallback via mapper', async () => {
      const streamSource = await readFile(`${root}/features/grpc/hooks/useGrpcStreamSession.ts`, 'utf8');
      expect(streamSource).toContain('grpcApiErrorToBrowserExpressFallbackBody');
      expect(streamSource).toContain('isBrowserDirectTransportMode');
    });

    it('response panel renders browser transport hint test id', async () => {
      const source = await readFile(`${root}/features/grpc/components/GrpcResponsePanel.tsx`, 'utf8');
      expect(source).toContain('formatGrpcBrowserTransportFailureHint');
      expect(source).toContain('grpc-response-browser-transport-hint');
    });

    it('grpcResponseUtils bridges browser transport hint formatter', async () => {
      const source = await readFile(`${root}/features/grpc/utils/grpcResponseUtils.ts`, 'utf8');
      expect(source).toContain('formatGrpcBrowserTransportFailureHint');
      expect(source).toContain('formatBrowserTransportFailureHint');
    });

    it('stream error block renders browser transport hint test id', async () => {
      const hookSource = await readFile(
        `${root}/features/grpc/components/grpcCallPanel/useGrpcCallPanel.ts`,
        'utf8',
      );
      const paneSource = await readFile(
        `${root}/features/grpc/components/grpcCallPanel/GrpcCallResponsePane.tsx`,
        'utf8',
      );
      expect(hookSource).toContain('formatGrpcBrowserTransportFailureHint');
      expect(paneSource).toContain('grpc-stream-browser-transport-hint');
    });
  });

  describe('checklist-3: gate script and package entry', () => {
    it('package.json exposes test:grpc:phase10e', () => {
      expect(pkg.scripts?.['test:grpc:phase10e']).toContain('test-grpc-phase10e.sh');
    });
  });
});
