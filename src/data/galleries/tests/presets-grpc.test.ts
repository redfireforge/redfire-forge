import { describe, it, expect } from 'vitest';
import {
  createGrpcHealthTest,
  createGrpcCrudTest,
} from './presets-grpc';

describe('presets-grpc factories', () => {
  describe('createGrpcHealthTest (TG-GRPC-01)', () => {
    it('returns a valid FeatureGroup with id test-grpc-health', () => {
      const fg = createGrpcHealthTest();
      expect(fg.id).toBe('test-grpc-health');
      expect(fg.name).toBe('gRPC: Unary Smoke Test');
      expect(fg.scenarios).toHaveLength(1);
    });

    it('scenario uses GRPC method and grpcCall actionType', () => {
      const fg = createGrpcHealthTest();
      const test = fg.scenarios[0].tests[0];
      expect(test.method).toBe('GRPC');
      expect(test.actionType).toBe('grpcCall');
    });

    it('URL is an HTTPS URL for the gRPC server', () => {
      const fg = createGrpcHealthTest();
      const test = fg.scenarios[0].tests[0];
      expect(test.url).toMatch(/^https:\/\//);
    });

    it('grpcCallAction targets grpcb.in with health service', () => {
      const fg = createGrpcHealthTest();
      const test = fg.scenarios[0].tests[0];
      const action = test.grpcCallAction!;
      expect(action.target).toBe('grpcb.in:443');
      expect(action.callType).toBe('unary');
      expect(action.service).toBe('grpc.health.v1.Health');
      expect(action.method).toBe('Check');
    });

    it('grpcCallAction assertions check grpcStatus 0 and SERVING', () => {
      const fg = createGrpcHealthTest();
      const action = fg.scenarios[0].tests[0].grpcCallAction!;
      expect(action.assertions).toBeDefined();
      const assertions = action.assertions!;
      expect(assertions.some(a => 'grpcStatus' in a && a.grpcStatus === 0)).toBe(true);
      expect(assertions.some(a => 'grpcField' in a && (a as { equals?: unknown }).equals === 'SERVING')).toBe(true);
    });
  });

  describe('createGrpcCrudTest (TG-GRPC-02)', () => {
    it('returns a valid FeatureGroup with id test-grpc-crud', () => {
      const fg = createGrpcCrudTest();
      expect(fg.id).toBe('test-grpc-crud');
      expect(fg.name).toBe('gRPC: CRUD Scenarios');
      expect(fg.scenarios).toHaveLength(3);
    });

    it('all scenarios use GRPC method and grpcCall actionType', () => {
      const fg = createGrpcCrudTest();
      for (const scenario of fg.scenarios) {
        for (const test of scenario.tests) {
          expect(test.method).toBe('GRPC');
          expect(test.actionType).toBe('grpcCall');
        }
      }
    });

    it('all scenario URLs are HTTPS', () => {
      const fg = createGrpcCrudTest();
      for (const scenario of fg.scenarios) {
        for (const test of scenario.tests) {
          expect(test.url).toMatch(/^https:\/\//);
        }
      }
    });

    it('GetUser scenario targets Greeter/SayHello with Alice', () => {
      const fg = createGrpcCrudTest();
      const action = fg.scenarios[0].tests[0].grpcCallAction!;
      expect(action.service).toBe('helloworld.Greeter');
      expect(action.method).toBe('SayHello');
      expect(action.body).toEqual({ name: 'Alice' });
    });

    it('GetUser scenario extracts greetingMessage', () => {
      const fg = createGrpcCrudTest();
      const test = fg.scenarios[0].tests[0];
      expect(test.extractions).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: 'greetingMessage' })]),
      );
    });

    it('CreateUser scenario targets Greeter/SayHello with Bob', () => {
      const fg = createGrpcCrudTest();
      const action = fg.scenarios[1].tests[0].grpcCallAction!;
      expect(action.body).toEqual({ name: 'Bob' });
    });

    it('DeleteUser scenario uses health check service', () => {
      const fg = createGrpcCrudTest();
      const action = fg.scenarios[2].tests[0].grpcCallAction!;
      expect(action.service).toBe('grpc.health.v1.Health');
    });
  });
});
