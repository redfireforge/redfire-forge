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
  GRPC_SPRING_FIXTURE_HTTP_PORT,
  GRPC_SPRING_FIXTURE_NETTY_PORT,
  GRPC_SPRING_FIXTURE_SERVLET_TARGET,
  GRPC_SPRING_FIXTURE_ACTUATOR_HEALTH_URL,
} from '@shared/grpc/grpcSpringFixturePorts';

export {
  purgeGrpcDemoCallHistory,
  GRPC_DEMO_CALL_HISTORY_TARGETS,
  dispatchGrpcCallHistoryReload,
} from '@grpc/utils/grpcDemoCallHistoryCleanup';
export {
  purgeGrpcDemoSavedRequests,
  purgeEmptyGrpcDemoCollectionsByName,
} from '@grpc/utils/grpcDemoCollectionsCleanup';

export { clearGrpcCallHistory } from '@grpc/data/grpcCallHistoryRecorder';

import { getDemoBridgeWindow } from './bridgeWindow';
import type { GrpcGrpcurlExportContext } from '@grpc/utils/grpcGrpcurlTypes';

const GRPC_ACTIVE_DESCRIPTOR_KEY_STORAGE = 'rfg-demo-grpc-active-descriptor-key';

function storeGrpcActiveDescriptorKey(key: string | null): void {
  try {
    if (key) {
      sessionStorage.setItem(GRPC_ACTIVE_DESCRIPTOR_KEY_STORAGE, key);
    } else {
      sessionStorage.removeItem(GRPC_ACTIVE_DESCRIPTOR_KEY_STORAGE);
    }
  } catch {
    // Session storage may be unavailable in some browser or test contexts.
  }
}

function loadStoredGrpcActiveDescriptorKey(): string | null {
  try {
    const value = sessionStorage.getItem(GRPC_ACTIVE_DESCRIPTOR_KEY_STORAGE);
    return value && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Patch the active gRPC Studio tab's grpcurlExportContext.
 * Used by TLS lessons to set file paths so the exported grpcurl command
 * includes --cacert / --cert / --key flags.
 */
export function patchGrpcActiveTabExportContext(ctx: GrpcGrpcurlExportContext): boolean {
  const bridge = getDemoBridgeWindow().__demoPatchGrpcActiveTab;
  if (!bridge) return false;
  return bridge({ grpcurlExportContext: ctx });
}

/**
 * Programmatically reset transport mode and compression on the active gRPC tab.
 * Avoids opening the Session Settings drawer — used in preAction to prevent
 * visible modal popups before a step's narration starts.
 */
export function resetGrpcActiveTabTransport(mode: string = 'express'): boolean {
  const w = getDemoBridgeWindow() as unknown as Record<string, (...args: unknown[]) => boolean>;
  const bridge = w.__demoPatchGrpcActiveTab;
  if (typeof bridge !== 'function') return false;
  return bridge({ transportMode: mode, compression: undefined });
}

/**
 * Directly set the request body on the active gRPC tab's React state.
 * Needed because the DOM fill (setInputValueAndDispatch) fires textarea onChange
 * which calls handleJsonChange — but that early-returns without patching the tab
 * if `method` is not yet resolved.  This ensures the tab state always carries the
 * correct body for Send / Retry with Express Proxy.
 *
 * `body` is a JSON string (e.g. `'{"message":"hello"}'`).  The tab stores body
 * as `Record<string, unknown>`, so we parse before patching.
 */
export function patchGrpcActiveTabBody(body: string): boolean {
  const w = getDemoBridgeWindow() as unknown as Record<string, (...args: unknown[]) => boolean>;
  const bridge = w.__demoPatchGrpcActiveTab;
  if (typeof bridge !== 'function') return false;
  try {
    const parsed = JSON.parse(body);
    return bridge({ body: parsed });
  } catch {
    return false;
  }
}

/**
 * Reset active gRPC tab runtime state used by demos:
 * unlink profile, force plaintext, clear auth and metadata.
 */
export function resetGrpcActiveTabRuntimeState(): boolean {
  const bridge = getDemoBridgeWindow().__demoResetGrpcActiveTab;
  if (!bridge) return false;
  return bridge();
}

/** Read the current reflected/imported descriptor key from the active gRPC Studio tab. */
export function getGrpcActiveDescriptorKey(): string | null {
  const bridge = getDemoBridgeWindow().__demoGetGrpcActiveDescriptorKey;
  if (bridge) {
    const key = bridge();
    if (key && key.trim()) {
      storeGrpcActiveDescriptorKey(key.trim());
      return key.trim();
    }
  }
  return loadStoredGrpcActiveDescriptorKey();
}

/** Capture and persist the active descriptor key for lessons that switch tabs. */
export function captureGrpcActiveDescriptorKey(): string | null {
  const bridge = getDemoBridgeWindow().__demoGetGrpcActiveDescriptorKey;
  if (!bridge) return loadStoredGrpcActiveDescriptorKey();
  const key = bridge();
  const normalized = key && key.trim() ? key.trim() : null;
  storeGrpcActiveDescriptorKey(normalized);
  return normalized;
}

/**
 * Inject a pre-seeded schema diff report into the active gRPC tab.
 * Used by the schema-diff lesson to simulate a breaking-change diff
 * without requiring a real v2 server.
 * The bridge uses the active tab's current descriptor as the baseline.
 */
export function patchGrpcSchemaDiffReport(input: {
  report: {
    leftDescriptorKey: string;
    rightDescriptorKey: string;
    generatedAt: string;
    summary: { breaking: number; nonBreaking: number; informational: number };
    changes: Array<{
      severity: 'breaking' | 'non_breaking' | 'informational';
      entityType: 'service' | 'method' | 'message' | 'field' | 'enum' | 'enum_value';
      entityPath: string;
      changeType: 'added' | 'removed' | 'modified' | 'renamed' | 'doc_comment_changed';
      description: string;
      caveat?: string;
    }>;
  };
  baselineCapturedAt?: string;
}): boolean {
  const w = getDemoBridgeWindow() as unknown as Record<string, unknown>;
  const bridge = w.__demoPatchGrpcSchemaDiffReport;
  if (typeof bridge !== 'function') return false;
  return bridge(input) as boolean;
}
