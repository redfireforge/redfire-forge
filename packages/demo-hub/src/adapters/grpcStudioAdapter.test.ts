import { describe, it, expect } from 'vitest';
import {
  GRPC_DEMO_HEALTH_URL,
  GRPC_DEMO_PREREQUISITE_ENDPOINTS,
  GRPC_DEMO_TARGET,
  GRPC_EXPRESS_HEALTH_URL,
  GRPC_EXPRESS_ONLY_COMMAND,
  GRPC_SPRING_DOCKER_COMMAND,
  GRPC_STUDIO_LESSON_ALLOWED_TABS,
} from './grpcStudioAdapter';

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

  it('documents spring lesson setup with express proxy', () => {
    expect(GRPC_SPRING_DOCKER_COMMAND).toContain('--profile spring');
    expect(GRPC_SPRING_DOCKER_COMMAND).toContain('npm run server');
  });

  it('defines allowed studio lesson tabs', () => {
    expect(GRPC_STUDIO_LESSON_ALLOWED_TABS).toEqual(['grpc-studio', 'demo-hub']);
  });
});
