/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  GRPC_DEMO_DOCKER_COMMAND,
  GRPC_DEMO_HEALTH_URL,
  GRPC_DEMO_PREREQUISITE_ENDPOINTS,
  GRPC_DEMO_TARGET,
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_EXPRESS_ONLY_COMMAND,
  GRPC_SPRING_DOCKER_COMMAND,
  GRPC_STUDIO_LESSON_ALLOWED_TABS,
  patchGrpcActiveTabExportContext,
  resetGrpcActiveTabRuntimeState,
} from './grpcStudioAdapter';

afterEach(() => {
  delete (window as unknown as { __demoPatchGrpcActiveTab?: unknown }).__demoPatchGrpcActiveTab;
  delete (window as unknown as { __demoResetGrpcActiveTab?: unknown }).__demoResetGrpcActiveTab;
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

  it('surfaces the one-command dev script alongside the manual steps', () => {
    expect(GRPC_DEMO_DOCKER_COMMAND).toContain('npm run dev:grpc');
    expect(GRPC_DEMO_DOCKER_COMMAND).toContain('docker compose up -d');
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

  it('bridge helpers return false when bridge is unavailable', () => {
    expect(resetGrpcActiveTabRuntimeState()).toBe(false);
    expect(patchGrpcActiveTabExportContext({})).toBe(false);
  });
});
