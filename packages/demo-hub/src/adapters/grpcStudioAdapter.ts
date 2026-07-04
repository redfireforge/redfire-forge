/**
 * Demo Hub ↔ gRPC Studio adapter.
 * Lessons import from here — not from `features/grpc/**` directly.
 */

/** Default gRPC target for Docker echo lesson (port 50051). */
export const GRPC_DEMO_TARGET = 'localhost:50051';

/** Health probe URL for PrerequisiteGate — Docker echo server (port 50052). */
export const GRPC_DEMO_HEALTH_URL = 'http://localhost:50052/health';

/** Express webhook/gRPC proxy health (port 3001) — required for Reflect/Send in the browser. */
export const GRPC_EXPRESS_HEALTH_URL = 'http://localhost:3001/health';

/** All endpoints that must be up before the GRPC-1 demo can start. */
export const GRPC_DEMO_PREREQUISITE_ENDPOINTS = [
  GRPC_DEMO_HEALTH_URL,
  GRPC_EXPRESS_HEALTH_URL,
] as const;

/** Setup commands shown in the lesson prerequisite gate. */
export const GRPC_DEMO_DOCKER_COMMAND = [
  '# One command — Docker echo + Express proxy + Vite',
  'npm run dev:grpc',
  '',
  '# — or start each dependency yourself —',
  '# Terminal 1 — gRPC echo server (Docker)',
  'cd docker/grpc && docker compose up -d',
  '',
  '# Terminal 2 — Express gRPC proxy (browser Reflect/Send)',
  'npm run server',
].join('\n');

/** Spring Boot lesson — Go + Spring containers plus Express proxy. */
export const GRPC_SPRING_DOCKER_COMMAND = [
  '# Terminal 1 — Go echo + Spring gRPC servers (Docker)',
  'cd docker/grpc && docker compose --profile spring up -d',
  '',
  '# Terminal 2 — Express gRPC proxy (browser Reflect/Send)',
  'npm run server',
].join('\n');

/** Express-only browser studio lessons (no Docker fixture). */
export const GRPC_EXPRESS_ONLY_COMMAND = 'npm run server';

/** Tabs a unary/grpc studio lesson may visit without triggering auto-exit. */
export const GRPC_STUDIO_LESSON_ALLOWED_TABS = ['grpc-studio', 'demo-hub'] as const;

export {
  purgeGrpcDemoCallHistory,
  GRPC_DEMO_CALL_HISTORY_TARGETS,
  dispatchGrpcCallHistoryReload,
} from '@grpc/utils/grpcDemoCallHistoryCleanup';
