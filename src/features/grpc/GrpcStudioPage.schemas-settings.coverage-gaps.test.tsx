/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  FIXTURE_DESCRIPTOR,
  FIXTURE_MULTI_SERVICE_DESCRIPTOR,
  FIXTURE_REFLECT_SUCCESS_ENVELOPE,
} from '@shared/grpc/contractFixtures';
import { GRPC_ERROR_CODES } from '@shared/grpc/contracts';
import { GrpcApiClientError, setGrpcClientTransport } from '@shared/grpc/grpcApiClient';
import { createGrpcSuccessEnvelope } from '@shared/grpc/contracts';
import * as grpcStreamClient from '@shared/grpc/grpcStreamClient';
import { setGrpcStreamTransport } from '@shared/grpc/grpcStreamClient';
const downloadProtosetFileMock = vi.hoisted(() => vi.fn());
vi.mock('./utils/downloadProtoset', () => ({
  downloadProtosetFile: (...args: unknown[]) => downloadProtosetFileMock(...args),
}));
import { GrpcStudioPage, buildLegacyGrpcEnvVarMap } from './GrpcStudioPage';
import {
  clickByTestId,
  grpcStudioTabs,
  setupGrpcStudioPageCoverageGapsTest,
} from './grpcStudioPage/grpcStudioPageCoverageGaps.testHelpers';

setupGrpcStudioPageCoverageGapsTest(downloadProtosetFileMock);

describe('GrpcStudioPage coverage gaps — schemas and settings', () => {
  it('opens manage schemas modal and loads descriptor from ingest', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'describe') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    await clickByTestId('grpc-manage-schemas-btn');
    await waitFor(() => {
      expect(screen.getByTestId('grpc-proto-manage-modal')).toBeTruthy();
    });

    await clickByTestId('grpc-proto-cancel-btn');
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-proto-manage-modal')).toBeNull();
    });
  });

  it('shows export protoset error in manage schemas modal', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'export_protoset') {
        throw new GrpcApiClientError('export', 'stale descriptor', {
          code: GRPC_ERROR_CODES.INVALID_DESCRIPTOR,
        });
      }
      return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-manage-schemas-btn-footer'));
    fireEvent.click(screen.getByTestId('grpc-proto-tab-schema-browser'));
    fireEvent.click(await screen.findByTestId('grpc-schema-export-protoset-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-proto-export-error').textContent).toMatch(/stale descriptor/i);
    });
  });

  it('shows generic export protoset error for non-Error failures', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'export_protoset') {
        throw 'export exploded';
      }
      return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy());

    fireEvent.click(screen.getByTestId('grpc-manage-schemas-btn-footer'));
    fireEvent.click(screen.getByTestId('grpc-proto-tab-schema-browser'));
    fireEvent.click(await screen.findByTestId('grpc-schema-export-protoset-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-proto-export-error').textContent).toMatch(/failed to export protoset/i);
    });
  });

  it('patches TLS config via TLS modal (drawer no longer has TLS panel)', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-tls-badge'));
    await waitFor(() => expect(screen.getByTestId('grpc-tls-body')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-tls-mode-tls'));
    fireEvent.change(screen.getByTestId('grpc-tls-server-name'), { target: { value: 'modal.example.com' } });
    fireEvent.click(screen.getByTestId('grpc-tls-mode-disabled'));
    fireEvent.click(screen.getByTestId('grpc-tls-close'));

    await waitFor(() => {
      expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
    });
  });

  it('buildLegacyGrpcEnvVarMap maps grpc host and env metadata', async () => {
    const { buildLegacyGrpcEnvVarMap } = await import('./GrpcStudioPage');
    expect(buildLegacyGrpcEnvVarMap('grpc://localhost:50051')).toEqual({});
    expect(buildLegacyGrpcEnvVarMap('localhost:50051', 'dev', 'orders')).toEqual({
      grpcHost: 'localhost:50051',
      envName: 'dev',
      svcName: 'orders',
    });
  });

  it('uses microservice env map when selectedSvc and selectedEnvId are provided', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'describe') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    const selectedSvc = {
      id: 'svc-1',
      name: 'orders',
      baseUrls: { e1: 'https://api.example.com' },
      protocolEndpoints: {
        grpc: { e1: { baseUrl: 'grpc.example.com:50051' } },
      },
    };

    render(
      <GrpcStudioPage
        selectedSvc={selectedSvc}
        selectedEnvId="e1"
        envName="prod"
      />,
    );

    expect(screen.getByTestId('grpc-target-status-ok').textContent).toContain('grpc.example.com:50051');
  });

  it('renames an active tab from the tab bar', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    const activeTab = grpcStudioTabs().getByRole('tab', { selected: true });
    fireEvent.doubleClick(activeTab);

    const renameInput = screen.getByLabelText('Rename tab') as HTMLInputElement;
    fireEvent.change(renameInput, { target: { value: 'Echo tab' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('Echo tab')).toBeTruthy();
    });
  });

  it('opens connection settings drawer from settings button', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    expect(screen.getByTestId('grpc-connection-settings-drawer')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-settings-close'));
    expect(screen.queryByTestId('grpc-connection-settings-drawer')).toBeNull();
  });

  it('opens call settings nav from deadline badge', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    await clickByTestId('grpc-deadline-badge');
    await waitFor(() => {
      expect(screen.getByTestId('grpc-settings-panel-call')).toBeTruthy();
    });
  });

  it('reflects health service and runs health check from settings drawer', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_MULTI_SERVICE_DESCRIPTOR };
      }
      if (op === 'call') {
        return {
          ...FIXTURE_REFLECT_SUCCESS_ENVELOPE,
          op: 'call',
          data: {
            callType: 'unary',
            status: 0,
            statusMessage: 'OK',
            headers: {},
            trailers: {},
            body: { status: 'SERVING' },
            durationMs: 5,
          },
        };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    fireEvent.click(screen.getByTestId('grpc-settings-nav-health'));
    fireEvent.click(screen.getByTestId('grpc-health-check-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-health-result').textContent).toMatch(/SERVING/i);
    });
  });

  it('closes proto modal when switching tabs', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-manage-schemas-btn'));
    expect(screen.getByTestId('grpc-proto-manage-modal')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-add-tab'));
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-proto-manage-modal')).toBeNull();
    });
  });

  it('opens schema browser from manage schemas after reflect and opens method in tab', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-manage-schemas-btn-footer'));
    expect(screen.getByTestId('grpc-schema-browser')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--echo'));
    fireEvent.click(screen.getByTestId('grpc-schema-open-tab-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-proto-manage-modal')).toBeNull();
    });

    fireEvent.click(screen.getByTestId('grpc-request-tab-form'));
    expect((screen.getByTestId('grpc-proto-field-input-message') as HTMLInputElement).value).toBe('hello');
  });

  it('applies streaming timeout default when schema browser opens a streaming method in tab', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-manage-schemas-btn-footer'));
    expect(screen.getByTestId('grpc-schema-browser')).toBeTruthy();
    fireEvent.click(screen.getByTestId('grpc-schema-tree-node-method--echo-echoservice--serverstream'));
    fireEvent.click(screen.getByTestId('grpc-schema-open-tab-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-proto-manage-modal')).toBeNull();
    });

    expect((screen.getByTestId('grpc-call-timeout-input') as HTMLInputElement).value).toBe('120000');
  });

  it('loads descriptor from proto modal and keeps modal open for schema browser review', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'describe') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-manage-schemas-btn'));
    fireEvent.click(screen.getByTestId('grpc-proto-tab-proto-files'));

    const protoFile = new File(['syntax = "proto3";'], 'echo.proto', { type: 'text/plain' });
    const input = document.querySelector('input[type="file"][accept=".proto"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [protoFile] });
    fireEvent.change(input);

    await waitFor(() => {
      expect((screen.getByTestId('grpc-proto-load-btn') as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.click(screen.getByTestId('grpc-proto-load-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('grpc-proto-manage-modal')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-proto-tab-schema-browser'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-schema-browser')).toBeTruthy();
    });
  });

  it('exports protoset successfully from manage schemas modal', async () => {
    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_DESCRIPTOR };
      }
      if (op === 'export_protoset') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, op: 'export_protoset', data: { base64: 'abc' } };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('grpc-manage-schemas-btn-footer'));
    fireEvent.click(screen.getByTestId('grpc-proto-tab-schema-browser'));
    fireEvent.click(screen.getByTestId('grpc-schema-export-protoset-btn'));
    await waitFor(() => {
      expect(screen.queryByTestId('grpc-proto-export-error')).toBeNull();
    });
  });

  it('starts health watch stream from settings drawer', async () => {
    vi.spyOn(grpcStreamClient, 'openGrpcStreamEvents').mockImplementation(() => vi.fn());

    setGrpcClientTransport(async (op) => {
      if (op === 'reflect') {
        return { ...FIXTURE_REFLECT_SUCCESS_ENVELOPE, data: FIXTURE_MULTI_SERVICE_DESCRIPTOR };
      }
      return FIXTURE_REFLECT_SUCCESS_ENVELOPE;
    });
    setGrpcStreamTransport(async (path) => {
      if (path.includes('/stream/start')) {
        return createGrpcSuccessEnvelope('stream_start', {
          streamId: 'health-stream',
          requestId: 'req-health',
          tabId: 'grpc-tab-1',
        });
      }
      return createGrpcSuccessEnvelope('stream_cancel', {
        streamId: 'health-stream',
        requestId: 'req-health',
        tabId: 'grpc-tab-1',
        cancelled: true,
      });
    });

    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-reflect-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-explorer-tree')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('grpc-connection-settings-btn'));
    fireEvent.click(screen.getByTestId('grpc-settings-nav-health'));
    fireEvent.click(screen.getByTestId('grpc-health-watch-btn'));

    await waitFor(() => {
      expect(screen.queryByTestId('grpc-connection-settings-drawer')).toBeNull();
      expect(screen.getByTestId('grpc-method-detail-service').textContent).toBe('health.v1.Health');
    });
  });

  it('buildLegacyGrpcEnvVarMap ignores invalid grpc host candidates', () => {
    expect(buildLegacyGrpcEnvVarMap('not-a-host', 'dev', 'svc')).toEqual({
      envName: 'dev',
      svcName: 'svc',
    });
  });

  it('updates compression from settings drawer', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    await clickByTestId('grpc-connection-settings-btn');
    await clickByTestId('grpc-settings-nav-compression');
    await waitFor(() => {
      expect(screen.getByTestId('grpc-settings-panel-compression')).toBeTruthy();
      expect(screen.getByTestId('grpc-compression-panel')).toBeTruthy();
    });
    await clickByTestId('grpc-compression-enabled');
    expect(screen.getByTestId('grpc-compression-enabled')).toBeTruthy();
  });

  it('duplicates active tab from tab bar', async () => {
    setGrpcClientTransport(async () => FIXTURE_REFLECT_SUCCESS_ENVELOPE);
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-tab-duplicate-grpc-tab-1'));
    await waitFor(() => {
      expect(grpcStudioTabs().getAllByRole('tab')).toHaveLength(2);
    });
  });

  it('opens TLS modal from connection bar badge and runs local validation test', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-tls-badge'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-tls-body')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('grpc-tls-test'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-tls-test-result').textContent).toMatch(/Plaintext/i);
    });
    fireEvent.click(screen.getByTestId('grpc-tls-reset'));
    fireEvent.click(screen.getByTestId('grpc-tls-close'));
    expect(screen.queryByTestId('grpc-tls-body')).toBeNull();
  });

  it('restores TLS snapshot when TLS modal cancel is clicked', async () => {
    render(<GrpcStudioPage resolvedBaseUrl="localhost:50051" />);
    fireEvent.click(screen.getByTestId('grpc-tls-badge'));
    await waitFor(() => expect(screen.getByTestId('grpc-tls-body')).toBeTruthy());
    fireEvent.click(screen.getByTestId('grpc-tls-mode-tls'));
    fireEvent.click(screen.getByTestId('grpc-tls-cancel'));
    await waitFor(() => {
      expect(screen.getByTestId('grpc-tls-badge').textContent).toMatch(/Plaintext/i);
    });
  });
});
