/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  captureGrpcActiveDescriptorKey,
  GRPC_DEMO_DOCKER_COMMAND,
  GRPC_DEMO_HEALTH_URL,
  GRPC_DEMO_PREREQUISITE_ENDPOINTS,
  GRPC_DEMO_TARGET,
  GRPC_ENVOY_PROBE_URL,
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_EXPRESS_ONLY_COMMAND,
  GRPC_SPRING_DOCKER_COMMAND,
  GRPC_STUDIO_LESSON_ALLOWED_TABS,
  GRPC_TRANSPORT_MODES_PREREQUISITE_ENDPOINTS,
  getGrpcActiveDescriptorKey,
  patchGrpcActiveTabBody,
  patchGrpcActiveTabExportContext,
  patchGrpcSchemaDiffReport,
  resetGrpcActiveTabTransport,
  resetGrpcActiveTabRuntimeState,
  resetGrpcManageSchemasDraftsViaBridge,
} from './grpcStudioAdapter';

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
  delete (window as unknown as { __demoGetGrpcActiveDescriptorKey?: unknown }).__demoGetGrpcActiveDescriptorKey;
  delete (window as unknown as { __demoPatchGrpcActiveTab?: unknown }).__demoPatchGrpcActiveTab;
  delete (window as unknown as { __demoResetGrpcActiveTab?: unknown }).__demoResetGrpcActiveTab;
  delete (window as unknown as { __demoResetGrpcManageSchemasDrafts?: unknown }).__demoResetGrpcManageSchemasDrafts;
  delete (window as unknown as { __demoPatchGrpcSchemaDiffReport?: unknown }).__demoPatchGrpcSchemaDiffReport;
});

describe('grpcStudioAdapter', () => {
  it('exports echo lesson target and health probes', () => {
    expect(GRPC_DEMO_TARGET).toBe('localhost:50051');
    expect(GRPC_DEMO_HEALTH_URL).toContain('50052');
    expect(GRPC_EXPRESS_HEALTH_URL).toContain('3001');
  });

  it('documents docker + express prerequisites for browser studio lessons', () => {
    expect(GRPC_DEMO_PREREQUISITE_ENDPOINTS).toHaveLength(2);
    expect(GRPC_DEMO_PREREQUISITE_ENDPOINTS[0]).toBe(GRPC_DEMO_HEALTH_URL);
    expect(GRPC_DEMO_PREREQUISITE_ENDPOINTS[1]).toBe(GRPC_EXPRESS_HEALTH_URL);
    expect(GRPC_EXPRESS_ONLY_COMMAND).toBe('npm run server');
  });

  it('documents Envoy sidecar probe for transport-modes lessons', () => {
    expect(GRPC_ENVOY_PROBE_URL).toContain('50055');
    expect(GRPC_TRANSPORT_MODES_PREREQUISITE_ENDPOINTS).toEqual([
      ...GRPC_DEMO_PREREQUISITE_ENDPOINTS,
      GRPC_ENVOY_PROBE_URL,
    ]);
  });

  it('surfaces the one-command dev script alongside the manual steps', () => {
    expect(GRPC_DEMO_DOCKER_COMMAND).toContain('npm run dev:grpc');
    expect(GRPC_DEMO_DOCKER_COMMAND).toContain('docker compose up -d');
    expect(GRPC_DEMO_DOCKER_COMMAND).toContain('Envoy');
    expect(GRPC_DEMO_DOCKER_COMMAND).toContain('npm run server');
  });

  it('documents spring lesson setup with express proxy', () => {
    expect(GRPC_SPRING_DOCKER_COMMAND).toContain('--profile spring');
    expect(GRPC_SPRING_DOCKER_COMMAND).toContain('npm run server');
  });

  it('defines allowed studio lesson tabs', () => {
    expect(GRPC_STUDIO_LESSON_ALLOWED_TABS).toEqual(['grpc-studio', 'demo-hub']);
  });

  it('patchGrpcActiveTabExportContext forwards patch through demo bridge', () => {
    const bridge = vi.fn().mockReturnValue(true);
    (window as unknown as { __demoPatchGrpcActiveTab?: (patch: unknown) => boolean }).__demoPatchGrpcActiveTab = bridge;

    const result = patchGrpcActiveTabExportContext({
      tlsFilePaths: { caCertPath: '/tmp/ca.crt' },
    });

    expect(result).toBe(true);
    expect(bridge).toHaveBeenCalledWith({
      grpcurlExportContext: {
        tlsFilePaths: { caCertPath: '/tmp/ca.crt' },
      },
    });
  });

  it('resetGrpcActiveTabRuntimeState calls reset bridge when present', () => {
    const bridge = vi.fn().mockReturnValue(true);
    (window as unknown as { __demoResetGrpcActiveTab?: () => boolean }).__demoResetGrpcActiveTab = bridge;

    const result = resetGrpcActiveTabRuntimeState();

    expect(result).toBe(true);
    expect(bridge).toHaveBeenCalledTimes(1);
  });

  it('resetGrpcManageSchemasDraftsViaBridge calls draft-reset bridge when present', () => {
    const bridge = vi.fn().mockReturnValue(true);
    (window as unknown as { __demoResetGrpcManageSchemasDrafts?: () => boolean }).__demoResetGrpcManageSchemasDrafts = bridge;

    expect(resetGrpcManageSchemasDraftsViaBridge()).toBe(true);
    expect(bridge).toHaveBeenCalledTimes(1);
  });

  it('getGrpcActiveDescriptorKey reads the descriptor key bridge when present', () => {
    const bridge = vi.fn().mockReturnValue('descriptor-live');
    (window as unknown as { __demoGetGrpcActiveDescriptorKey?: () => string | null }).__demoGetGrpcActiveDescriptorKey = bridge;

    expect(getGrpcActiveDescriptorKey()).toBe('descriptor-live');
    expect(bridge).toHaveBeenCalledTimes(1);
  });

  it('captureGrpcActiveDescriptorKey persists the last live descriptor key', () => {
    const bridge = vi.fn().mockReturnValue('descriptor-live');
    (window as unknown as { __demoGetGrpcActiveDescriptorKey?: () => string | null }).__demoGetGrpcActiveDescriptorKey = bridge;

    expect(captureGrpcActiveDescriptorKey()).toBe('descriptor-live');

    delete (window as unknown as { __demoGetGrpcActiveDescriptorKey?: unknown }).__demoGetGrpcActiveDescriptorKey;
    expect(getGrpcActiveDescriptorKey()).toBe('descriptor-live');
  });

  it('bridge helpers return false when bridge is unavailable', () => {
    expect(resetGrpcActiveTabRuntimeState()).toBe(false);
    expect(resetGrpcManageSchemasDraftsViaBridge()).toBe(false);
    expect(patchGrpcActiveTabExportContext({})).toBe(false);
    expect(resetGrpcActiveTabTransport()).toBe(false);
    expect(patchGrpcActiveTabBody('{"a":1}')).toBe(false);
    expect(getGrpcActiveDescriptorKey()).toBeNull();
  });

  it('resetGrpcActiveTabTransport patches mode via bridge', () => {
    const bridge = vi.fn().mockReturnValue(true);
    (window as unknown as { __demoPatchGrpcActiveTab?: (patch: unknown) => boolean }).__demoPatchGrpcActiveTab = bridge;

    expect(resetGrpcActiveTabTransport('browser')).toBe(true);
    expect(bridge).toHaveBeenCalledWith({ transportMode: 'browser', compression: undefined });
  });

  it('patchGrpcActiveTabBody parses JSON and patches body via bridge', () => {
    const bridge = vi.fn().mockReturnValue(true);
    (window as unknown as { __demoPatchGrpcActiveTab?: (patch: unknown) => boolean }).__demoPatchGrpcActiveTab = bridge;

    expect(patchGrpcActiveTabBody('{"message":"hello"}')).toBe(true);
    expect(bridge).toHaveBeenCalledWith({ body: { message: 'hello' } });
  });

  it('patchGrpcActiveTabBody returns false on invalid JSON', () => {
    const bridge = vi.fn().mockReturnValue(true);
    (window as unknown as { __demoPatchGrpcActiveTab?: (patch: unknown) => boolean }).__demoPatchGrpcActiveTab = bridge;

    expect(patchGrpcActiveTabBody('{bad json')).toBe(false);
  });

  it('getGrpcActiveDescriptorKey falls back to sessionStorage when bridge returns blank', () => {
    sessionStorage.setItem('rfg-demo-grpc-active-descriptor-key', 'stored-key');
    (window as unknown as { __demoGetGrpcActiveDescriptorKey?: () => string }).__demoGetGrpcActiveDescriptorKey =
      () => '   ';

    expect(getGrpcActiveDescriptorKey()).toBe('stored-key');
  });

  it('captureGrpcActiveDescriptorKey clears storage when bridge returns blank', () => {
    sessionStorage.setItem('rfg-demo-grpc-active-descriptor-key', 'old-key');
    (window as unknown as { __demoGetGrpcActiveDescriptorKey?: () => string }).__demoGetGrpcActiveDescriptorKey =
      () => '';

    expect(captureGrpcActiveDescriptorKey()).toBeNull();
    expect(sessionStorage.getItem('rfg-demo-grpc-active-descriptor-key')).toBeNull();
  });

  it('captureGrpcActiveDescriptorKey reads stored key when bridge is unavailable', () => {
    sessionStorage.setItem('rfg-demo-grpc-active-descriptor-key', 'persisted');
    expect(captureGrpcActiveDescriptorKey()).toBe('persisted');
  });

  it('descriptor key storage tolerates sessionStorage failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => captureGrpcActiveDescriptorKey()).not.toThrow();
    expect(getGrpcActiveDescriptorKey()).toBeNull();
  });

  it('patchGrpcSchemaDiffReport forwards report through demo bridge', () => {
    const bridge = vi.fn().mockReturnValue(true);
    (window as unknown as { __demoPatchGrpcSchemaDiffReport?: (input: unknown) => boolean }).__demoPatchGrpcSchemaDiffReport =
      bridge;

    const report = {
      leftDescriptorKey: 'left',
      rightDescriptorKey: 'right',
      generatedAt: '2026-01-01T00:00:00.000Z',
      summary: { breaking: 1, nonBreaking: 0, informational: 0 },
      changes: [],
    };

    expect(patchGrpcSchemaDiffReport({ report, baselineCapturedAt: '2026-01-01' })).toBe(true);
    expect(bridge).toHaveBeenCalledWith({ report, baselineCapturedAt: '2026-01-01' });
  });

  it('patchGrpcSchemaDiffReport returns false when bridge is unavailable', () => {
    expect(patchGrpcSchemaDiffReport({
      report: {
        leftDescriptorKey: 'a',
        rightDescriptorKey: 'b',
        generatedAt: '2026-01-01T00:00:00.000Z',
        summary: { breaking: 0, nonBreaking: 0, informational: 0 },
        changes: [],
      },
    })).toBe(false);
  });
});
