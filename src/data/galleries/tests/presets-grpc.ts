/**
 * gRPC test gallery preset factories.
 *
 * Two samples showing how to configure gRPC call scenarios in the test harness:
 *  1. TG-GRPC-01 — gRPC Unary Smoke Test (easy)   — Health/Check, assert status SERVING
 *  2. TG-GRPC-02 — gRPC CRUD Scenarios (medium)   — SayHello (Get/Create/Delete patterns)
 *
 * Both use grpcb.in:443 — a public, reflection-enabled gRPC test server.
 * Replace `grpcCallAction.target`, `service`, and `method` with your own server details.
 */

import { ts, s } from './presets-helpers';
import type { FeatureGroup } from './presets-helpers';

// ─── TG-GRPC-01: gRPC Unary Smoke Test ───────────────────────────────────────

export function createGrpcHealthTest(): FeatureGroup {
  return {
    id: 'test-grpc-health',
    name: 'gRPC: Unary Smoke Test',
    scenarios: [
      ts({
        id: 'sc-grpc-health',
        name: 'Health/Check — assert SERVING',
        tests: [
          s({
            id: 'sc-grpc-health-check',
            name: 'grpc.health.v1.Health/Check → status SERVING',
            url: 'https://grpcb.in',
            method: 'GRPC',
            actionType: 'grpcCall',
            grpcCallAction: {
              callType: 'unary',
              target: 'grpcb.in:443',
              descriptorKey: 'grpc.health.v1',
              service: 'grpc.health.v1.Health',
              method: 'Check',
              body: {},
              timeoutMs: 10000,
              assertions: [
                { grpcStatus: 0 },
                { grpcField: '$.status', equals: 'SERVING' },
              ],
            },
          }),
        ],
      }),
    ],
  };
}

// ─── TG-GRPC-02: gRPC CRUD Scenarios ─────────────────────────────────────────

export function createGrpcCrudTest(): FeatureGroup {
  return {
    id: 'test-grpc-crud',
    name: 'gRPC: CRUD Scenarios',
    scenarios: [
      ts({
        id: 'sc-grpc-get-user',
        name: 'GetUser — SayHello pattern',
        tests: [
          s({
            id: 'sc-grpc-get-user-call',
            name: 'Greeter/SayHello (Alice) → $.message contains Hello',
            url: 'https://grpcb.in',
            method: 'GRPC',
            actionType: 'grpcCall',
            grpcCallAction: {
              callType: 'unary',
              target: 'grpcb.in:443',
              descriptorKey: 'helloworld',
              service: 'helloworld.Greeter',
              method: 'SayHello',
              body: { name: 'Alice' },
              timeoutMs: 10000,
              assertions: [
                { grpcStatus: 0 },
                { grpcField: '$.message', contains: 'Hello Alice' },
              ],
            },
            extractions: [
              { name: 'greetingMessage', source: 'body', expression: '$.message' },
            ],
          }),
        ],
      }),
      ts({
        id: 'sc-grpc-create-user',
        name: 'CreateUser — SayHello pattern',
        tests: [
          s({
            id: 'sc-grpc-create-user-call',
            name: 'Greeter/SayHello (Bob) → $.message exists',
            url: 'https://grpcb.in',
            method: 'GRPC',
            actionType: 'grpcCall',
            grpcCallAction: {
              callType: 'unary',
              target: 'grpcb.in:443',
              descriptorKey: 'helloworld',
              service: 'helloworld.Greeter',
              method: 'SayHello',
              body: { name: 'Bob' },
              timeoutMs: 10000,
              assertions: [
                { grpcStatus: 0 },
                { grpcField: '$.message', exists: true },
                { grpcField: '$.message', contains: 'Hello Bob' },
              ],
            },
          }),
        ],
      }),
      ts({
        id: 'sc-grpc-delete-user',
        name: 'DeleteUser — Health/Check pattern',
        tests: [
          s({
            id: 'sc-grpc-delete-user-call',
            name: 'Health/Check (service status) → gRPC status OK',
            url: 'https://grpcb.in',
            method: 'GRPC',
            actionType: 'grpcCall',
            grpcCallAction: {
              callType: 'unary',
              target: 'grpcb.in:443',
              descriptorKey: 'grpc.health.v1',
              service: 'grpc.health.v1.Health',
              method: 'Check',
              body: {},
              timeoutMs: 10000,
              assertions: [
                { grpcStatus: 0 },
              ],
            },
          }),
        ],
      }),
    ],
  };
}
