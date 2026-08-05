/** GRPC-16 Schema Discovery — lesson helpers */
import { GRPC } from '@shared/selectors';
import {
  ensureEchoMethodSelected,
  fillGrpcRequestJsonBody,
  grpcFirstCallSetup,
  rebindGrpcMethodQuiet,
  setInputValueAndDispatch,
  spotlightAndPause,
  spotlightAndPauseWithCallPanelHidden,
} from './grpc-lesson-helpers';
import type { GrpcDemoLesson } from './grpc-lesson-contract';

export const LOOKUP_SCHEMA_NODE_SEL = GRPC.SCHEMA_TREE_NODE('method', 'api.ApiService', 'Lookup');
export const ECHO_SCHEMA_NODE_SEL = GRPC.SCHEMA_TREE_NODE('method', 'echo.EchoService', 'Echo');
export const SAMPLE_PROTO_SERVICE = 'examples/grpc/schema-discovery/proto-files/api/service.proto';
export const SAMPLE_PROTO_SHARED = 'examples/grpc/schema-discovery/proto-files/shared/common.proto';
export const SAMPLE_PROTOSET = 'examples/grpc/schema-discovery/protoset/echo.protoset';
export const SAMPLE_PROTOSET_BASE64 = 'CsYDCgplY2hvLnByb3RvEgRlY2hvIh4KC0VjaG9SZXF1ZXN0Eg8KB21lc3NhZ2UYASABKAkiHwoMRWNob1Jlc3BvbnNlEg8KB21lc3NhZ2UYASABKAkiZAoNU3RyZWFtUmVxdWVzdBIPCgdtZXNzYWdlGAEgASgJEiEKDHJlcGVhdF9jb3VudBgCIAEoBVILcmVwZWF0Q291bnQSHwoLaW50ZXJ2YWxfbXMYAyABKAVSCmludGVydmFsTXMy6QEKC0VjaG9TZXJ2aWNlEi0KBEVjaG8SES5lY2hvLkVjaG9SZXF1ZXN0GhIuZWNoby5FY2hvUmVzcG9uc2USOQoMU2VydmVyU3RyZWFtEhMuZWNoby5TdHJlYW1SZXF1ZXN0GhIuZWNoby5FY2hvUmVzcG9uc2UwARI3CgxDbGllbnRTdHJlYW0SES5lY2hvLkVjaG9SZXF1ZXN0GhIuZWNoby5FY2hvUmVzcG9uc2UoARI3CgpCaWRpU3RyZWFtEhEuZWNoby5FY2hvUmVxdWVzdBoSLmVjaG8uRWNob1Jlc3BvbnNlKAEwAUIXWhVncnBjLXRlc3Qtc2VydmVyL2VjaG9iBnByb3RvMw==';
export const SAMPLE_URL_PROTO = 'http://localhost:5173/grpc-samples/url/echo.proto';
export const SAMPLE_BSR_MODULE = 'buf.build/connectrpc/eliza';
export const SAMPLE_BSR_VERSION = 'main';
export const ELIZA_SERVICE_SEL = '[data-testid="grpc-service-connectrpc-eliza-v1-elizaservice"]';
/** Compact one-line form for inline narration text. */
export const LOOKUP_REQUEST_JSON_COMPACT = '{"ref": {"id": "A-100"}}';
/** Pretty-printed form filled into the Form Input JSON editor. */
export const LOOKUP_REQUEST_JSON = JSON.stringify({ ref: { id: 'A-100' } }, null, 2);

/**
 * Guided spotlight pacing for GRPC-16 — steady rings + holds long enough to read.
 * Kept well under DEMO_ACTION_TIMEOUT_MS (45s) even on multi-beat steps.
 */
export const GRPC16_SPOTLIGHT = {
  beat: 1000,
  outcome: 1200,
  brief: 850,
  afterFill: 500,
  afterClick: 700,
  afterTab: 550,
} as const;

export const SAMPLE_COMMON_PROTO_CONTENT = `syntax = "proto3";

package common;

message SharedRef {
  string id = 1;
  string source = 2;
}
`;

export const SAMPLE_SERVICE_PROTO_CONTENT = `syntax = "proto3";

package api;

import "common.proto";

message LookupRequest {
  common.SharedRef ref = 1;
}

message LookupResponse {
  string status = 1;
  string resolved_id = 2;
}

service ApiService {
  rpc Lookup(LookupRequest) returns (LookupResponse);
}
`;

// ---------------------------------------------------------------------------
// Local helpers — keep behavior aligned with existing gRPC lesson helper patterns
// ---------------------------------------------------------------------------

export async function ensureManageModalOpen(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) return;
  await ctx.waitFor(GRPC.MANAGE_SCHEMAS_BTN, 10_000);
  await ctx.click(GRPC.MANAGE_SCHEMAS_BTN);
  await ctx.waitFor(GRPC.PROTO_MANAGE_MODAL, 10_000);
  await ctx.delay(GRPC16_SPOTLIGHT.afterTab);
}

/** Quiet open for preAction guards — no viewer ripple. */
export async function ensureManageModalOpenQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) return;
  const manageBtn = document.querySelector<HTMLButtonElement>(GRPC.MANAGE_SCHEMAS_BTN);
  if (!manageBtn || manageBtn.disabled) return;
  manageBtn.click();
  try {
    await ctx.waitFor(GRPC.PROTO_MANAGE_MODAL, 5_000);
  } catch {
    return;
  }
  await ctx.delay(200);
}

export async function ensureProtoFilesTabQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  await ensureManageModalOpenQuiet(ctx);
  const tab = document.querySelector<HTMLElement>(GRPC.PROTO_TAB_PROTO_FILES);
  if (tab && tab.getAttribute('aria-selected') !== 'true') {
    tab.click();
    await ctx.delay(200);
  }
}

export async function selectSchemaBrowserMethodQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  await ensureManageModalOpenQuiet(ctx);
  const schemaTab = document.querySelector<HTMLElement>(GRPC.PROTO_TAB_SCHEMA_BROWSER);
  if (schemaTab && schemaTab.getAttribute('aria-selected') !== 'true') {
    schemaTab.click();
    await ctx.delay(250);
  }
  try {
    await ctx.waitFor(GRPC.SCHEMA_BROWSER, 5_000);
  } catch {
    return;
  }
  await ctx.fill(GRPC.SCHEMA_BROWSER_SEARCH, 'Lookup');
  try {
    await ctx.waitFor(LOOKUP_SCHEMA_NODE_SEL, 4_000);
    document.querySelector<HTMLElement>(LOOKUP_SCHEMA_NODE_SEL)?.click();
  } catch {
    await ctx.fill(GRPC.SCHEMA_BROWSER_SEARCH, 'Echo');
    try {
      await ctx.waitFor(ECHO_SCHEMA_NODE_SEL, 3_000);
      document.querySelector<HTMLElement>(ECHO_SCHEMA_NODE_SEL)?.click();
    } catch {
      // Best-effort — action step will retry visibly.
    }
  }
  await ctx.delay(200);
}

export function isLookupCallPanelReady(): boolean {
  const methodLabel = document.querySelector(GRPC.CALL_METHOD_NAME)?.textContent ?? '';
  return Boolean(document.querySelector(GRPC.CALL_PANEL))
    && (methodLabel.includes('Lookup') || methodLabel.includes('Echo'));
}

export function isLookupResponseReady(): boolean {
  const text = document.querySelector<HTMLElement>(GRPC.RESPONSE_BODY)?.textContent ?? '';
  return text.includes('A-100') || text.includes('resolved');
}

/** Quietly bind Schema Browser method into the call panel (preAction guard). */
export async function openSchemaMethodInCallPanelQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  if (isLookupCallPanelReady()) {
    await ensureManageModalClosed(ctx);
    return;
  }

  await selectSchemaBrowserMethodQuiet(ctx);
  const openBtn = document.querySelector<HTMLButtonElement>(GRPC.SCHEMA_OPEN_TAB_BTN);
  if (openBtn) {
    openBtn.click();
    await ctx.delay(250);
  }
  if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) {
    await ensureManageModalClosed(ctx);
  }
  try {
    await ctx.waitFor(GRPC.CALL_PANEL, 4_000);
  } catch {
    await ensureEchoMethodSelected(ctx);
  }
}

export async function ensureLookupCallReadyQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  await openSchemaMethodInCallPanelQuiet(ctx);
  await fillGrpcRequestJsonBody(ctx, LOOKUP_REQUEST_JSON);
}

/** Re-run reflection after a failed protoset/url/bsr ingest so the explorer is usable again. */
export async function recoverGrpcReflectionQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  await ensureManageModalClosed(ctx);

  const hasHealthyExplorer = () =>
    Boolean(document.querySelector(GRPC.EXPLORER_TREE))
    && !document.querySelector(GRPC.EXPLORER_ERROR);

  if (hasHealthyExplorer()) return;

  const reflectBtn = document.querySelector<HTMLButtonElement>(GRPC.REFLECT_BTN);
  if (reflectBtn && !reflectBtn.disabled) {
    reflectBtn.click();
    try {
      await ctx.waitFor(GRPC.EXPLORER_TREE, 6_000);
    } catch {
      await ctx.delay(300);
    }
  }

  if (!hasHealthyExplorer()) {
    await rebindGrpcMethodQuiet(ctx);
  }
}

/** Remove the "shared" virtual root and clear files from all roots so the modal starts clean. */
export async function resetProtoRootsToDefault(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  const modal = document.querySelector<HTMLElement>(GRPC.PROTO_MANAGE_MODAL);
  if (!modal) return;

  // Switch to the Proto Files tab so root controls are visible.
  const tab = modal.querySelector<HTMLElement>(GRPC.PROTO_TAB_PROTO_FILES);
  if (tab && tab.getAttribute('aria-selected') !== 'true') {
    tab.click();
    await ctx.delay(200);
  }

  const rootButtons = () =>
    Array.from(modal.querySelectorAll<HTMLElement>('[data-testid^="grpc-proto-root-item-"]'));

  // Clear files from each root, then remove non-default roots.
  for (const btn of rootButtons()) {
    btn.click();
    await ctx.delay(120);
    const clearBtn = modal.querySelector<HTMLButtonElement>('[data-testid="grpc-proto-file-clear-all"]');
    if (clearBtn && !clearBtn.disabled) {
      clearBtn.click();
      await ctx.delay(150);
    }
  }

  for (const btn of rootButtons()) {
    const name = btn.textContent?.trim().toLowerCase().replace(/\d+$/, '').trim() ?? '';
    if (name === 'root') continue;
    const testId = btn.getAttribute('data-testid') ?? '';
    const id = testId.replace('grpc-proto-root-item-', '');
    const removeBtn = modal.querySelector<HTMLButtonElement>(`[data-testid="grpc-proto-root-remove-${id}"]`);
    if (removeBtn) {
      removeBtn.click();
      await ctx.delay(200);
    }
  }
}

/** Session flag — Proto Files Load already succeeded this lesson run. */
let _lesson16ProtoFilesLoaded = false;

export function resetGrpcSchemaDiscoverySessionFlags(): void {
  _lesson16ProtoFilesLoaded = false;
}

export function markGrpcSchemaDiscoveryProtoFilesLoaded(): void {
  _lesson16ProtoFilesLoaded = true;
}

export function wasGrpcSchemaDiscoveryProtoFilesLoaded(): boolean {
  return _lesson16ProtoFilesLoaded;
}

/**
 * Switch a Manage Schemas source tab without visible-click ripple (saves ~560ms each).
 * Orientation / load steps must stay under DEMO_ACTION_TIMEOUT_MS (45s).
 */
export async function switchManageSchemasTabQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
  tabSelector: string,
  contentSelector: string,
  waitMs = 1_200,
): Promise<void> {
  const tab = document.querySelector<HTMLElement>(tabSelector);
  tab?.click();
  await ctx.delay(GRPC16_SPOTLIGHT.afterTab);
  await ctx.waitFor(contentSelector, waitMs);
}

/**
 * Visible orientation tour of Manage Schemas source tabs — steady highlight per tab.
 */
export async function performGrpc16TabsOrientation(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  const tabWait = 1_200;
  const hold = GRPC16_SPOTLIGHT.beat;

  await switchManageSchemasTabQuiet(ctx, GRPC.PROTO_TAB_PROTOSET, GRPC.PROTO_PROTOSET_ZONE, tabWait);
  await spotlightAndPause(ctx, GRPC.PROTO_PROTOSET_ZONE, hold);

  await switchManageSchemasTabQuiet(ctx, GRPC.PROTO_TAB_URL, GRPC.PROTO_URL_INPUT, tabWait);
  await spotlightAndPause(ctx, GRPC.PROTO_URL_INPUT, hold);

  await switchManageSchemasTabQuiet(ctx, GRPC.PROTO_TAB_BSR, GRPC.PROTO_BSR_MODULE_INPUT, tabWait);
  // Keep BSR empty so Load stays disabled during orientation.
  const bsrModule = document.querySelector<HTMLInputElement>(GRPC.PROTO_BSR_MODULE_INPUT);
  const bsrVersion = document.querySelector<HTMLInputElement>(GRPC.PROTO_BSR_VERSION_INPUT);
  if (bsrModule?.value) setInputValueAndDispatch(bsrModule, '');
  if (bsrVersion?.value) setInputValueAndDispatch(bsrVersion, '');
  await spotlightAndPause(ctx, GRPC.PROTO_BSR_MODULE_INPUT, hold);

  await switchManageSchemasTabQuiet(ctx, GRPC.PROTO_TAB_PROTO_FILES, GRPC.PROTO_UPLOAD_ZONE, tabWait);
  await spotlightAndPause(ctx, GRPC.PROTO_UPLOAD_ZONE, GRPC16_SPOTLIGHT.outcome);
}

/**
 * Proto Files Load beat — review canonical paths, Load, then source badge outcome.
 */
export async function performGrpc16ProtoLoad(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  const modal = document.querySelector<HTMLElement>(GRPC.PROTO_MANAGE_MODAL);
  const sharedRoot = modal
    ? Array.from(modal.querySelectorAll<HTMLElement>('[data-testid^="grpc-proto-root-item-"]'))
      .find((entry) => entry.textContent?.toLowerCase().includes('shared'))
    : null;
  if (sharedRoot) {
    sharedRoot.click();
    await ctx.delay(GRPC16_SPOTLIGHT.afterClick);
  }
  await spotlightAndPauseWithCallPanelHidden(ctx, GRPC.PROTO_CANONICAL_PREVIEW, GRPC16_SPOTLIGHT.outcome);
  await ctx.waitFor(GRPC.PROTO_CANONICAL_PREVIEW, 1_500);

  const loadBtn = document.querySelector<HTMLButtonElement>(GRPC.PROTO_LOAD_BTN);
  const loadBusy = loadBtn?.textContent?.toLowerCase().includes('loading') ?? false;
  const hasFiles = (document.querySelector(GRPC.PROTO_FILE_LIST)?.children.length ?? 0) > 0;

  await spotlightAndPauseWithCallPanelHidden(ctx, GRPC.PROTO_LOAD_BTN, GRPC16_SPOTLIGHT.beat);
  if (
    hasFiles
    && loadBtn
    && !loadBtn.disabled
    && !loadBusy
    && !wasGrpcSchemaDiscoveryProtoFilesLoaded()
  ) {
    // Native click — avoid 560ms ripple stacking on top of holds.
    loadBtn.click();
    markGrpcSchemaDiscoveryProtoFilesLoaded();
    await ctx.delay(GRPC16_SPOTLIGHT.afterClick);
  }
  await spotlightAndPause(ctx, GRPC.EXPLORER_SOURCE, GRPC16_SPOTLIGHT.outcome);
}

/** Drift explanation beat — steady holds on connection / banner / explorer. */
export async function performGrpc16DriftExplain(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  await ctx.waitFor(GRPC.SERVICE_EXPLORER, 2_000);
  await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, GRPC16_SPOTLIGHT.beat);
  if (document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)) {
    await spotlightAndPause(ctx, GRPC.SCHEMA_DRIFT_BANNER, GRPC16_SPOTLIGHT.outcome);
  }
  await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, GRPC16_SPOTLIGHT.beat);
  await spotlightAndPause(ctx, GRPC.EXPLORER_SOURCE, GRPC16_SPOTLIGHT.brief);
}

export async function grpcSchemaDiscoverySetup(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  resetGrpcSchemaDiscoverySessionFlags();
  // Wipe persisted URL/BSR/proto drafts so orientation doesn't show leftover Eliza fields.
  await grpcFirstCallSetup(ctx, { resetSchemaDrafts: true });
  await ensureManageModalClosed(ctx);
}

export async function ensureManageModalClosed(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  if (!document.querySelector(GRPC.PROTO_MANAGE_MODAL)) return;
  const cancelBtn = document.querySelector<HTMLElement>(GRPC.PROTO_CANCEL_BTN);
  if (cancelBtn) {
    cancelBtn.click();
  } else {
    await ctx.click(GRPC.PROTO_CANCEL_BTN);
  }
  await ctx.delay(400);
}

export async function injectProtoFilesIntoManageSchemas(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<boolean> {
  await ctx.waitFor(GRPC.PROTO_MANAGE_MODAL, 10_000);
  await ctx.waitFor(GRPC.PROTO_UPLOAD_ZONE, 10_000);
  await ctx.waitFor(GRPC.PROTO_ROOT_LIST, 10_000);

  const modal = document.querySelector<HTMLElement>(GRPC.PROTO_MANAGE_MODAL);
  const zone = document.querySelector<HTMLElement>(GRPC.PROTO_UPLOAD_ZONE);
  if (!modal || !zone) {
    return false;
  }

  const selectRootByName = (name: string): boolean => {
    const rootButtons = Array.from(modal.querySelectorAll<HTMLElement>('[data-testid^="grpc-proto-root-item-"]'));
    const match = rootButtons.find((btn) => btn.textContent?.toLowerCase().includes(name.toLowerCase()));
    if (!match) return false;
    match.click();
    return true;
  };

  const readRootSummaries = (): Array<{ id: string; mountPath: string }> => {
    return Array.from(modal.querySelectorAll<HTMLElement>('[data-testid^="grpc-proto-root-item-"]'))
      .map((btn) => {
        const testId = btn.getAttribute('data-testid') ?? '';
        const id = testId.replace('grpc-proto-root-item-', '').trim();
        const mountPath = btn.querySelector('span')?.textContent?.trim() ?? '';
        return { id, mountPath };
      })
      .filter((entry) => entry.id.length > 0);
  };

  const clickRootById = (id: string): boolean => {
    const button = modal.querySelector<HTMLElement>(`[data-testid="grpc-proto-root-item-${id}"]`);
    if (!button) return false;
    button.click();
    return true;
  };

  const clearSelectedRootFilesIfAny = (): void => {
    const clearBtn = modal.querySelector<HTMLButtonElement>('[data-testid="grpc-proto-file-clear-all"]');
    if (!clearBtn || clearBtn.disabled) return;
    clearBtn.click();
  };

  // Keep lesson deterministic when prior persisted drafts exist.
  for (const root of readRootSummaries()) {
    clickRootById(root.id);
    await ctx.delay(120);
    clearSelectedRootFilesIfAny();
    await ctx.delay(180);
  }

  // Remove custom roots left over from prior runs to prevent ambiguous-import warnings.
  for (const root of readRootSummaries()) {
    const normalized = root.mountPath.toLowerCase();
    if (normalized === 'root' || normalized === 'shared') {
      continue;
    }
    const removeBtn = modal.querySelector<HTMLButtonElement>(`[data-testid="grpc-proto-root-remove-${root.id}"]`);
    if (!removeBtn) continue;
    removeBtn.click();
    await ctx.delay(220);
  }

  const setInputValue = (input: HTMLInputElement, value: string): void => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  if (!selectRootByName('shared')) {
    const addInput = modal.querySelector<HTMLInputElement>('[data-testid="grpc-proto-root-add-input"]');
    const addBtn = modal.querySelector<HTMLButtonElement>('[data-testid="grpc-proto-root-add-btn"]');
    if (addInput && addBtn) {
      await ctx.delay(500);
      addInput.focus();
      setInputValue(addInput, 'shared');
      await ctx.delay(650);
      addBtn.click();
      await ctx.delay(1_050);
      if (!selectRootByName('shared')) {
        // Retry once in case the root list rerenders asynchronously.
        await ctx.delay(650);
        selectRootByName('shared');
      }
      await ctx.delay(550);
    }
  }

  const files = [
    new File([SAMPLE_COMMON_PROTO_CONTENT], 'common.proto', { type: 'text/plain' }),
    new File([SAMPLE_SERVICE_PROTO_CONTENT], 'service.proto', { type: 'text/plain' }),
  ];

  const dispatchDropForFiles = (dropFiles: File[]): void => {
    const dataTransfer = new DataTransfer();
    dropFiles.forEach((file) => dataTransfer.items.add(file));
    zone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer }));
    zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
  };

  try {
    // Stage the upload so users can visually follow each file being added.
    dispatchDropForFiles([files[0]]);
    await ctx.delay(1_200);
    dispatchDropForFiles([files[1]]);
    await ctx.delay(1_400);
    if (document.querySelector(GRPC.PROTO_FILE_LIST)) {
      return true;
    }
  } catch {
    // Fallback to the hidden file input if the browser blocks synthetic DragEvent transfer data.
  }

  const fileInput = modal.querySelector<HTMLInputElement>('input[type="file"][accept=".proto"]');
  if (!fileInput) {
    return false;
  }

  const fallbackDataTransfer = new DataTransfer();
  files.forEach((file) => fallbackDataTransfer.items.add(file));
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: fallbackDataTransfer.files,
  });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await ctx.delay(1_350);
  return Boolean(document.querySelector(GRPC.PROTO_FILE_LIST));
}

export async function injectProtosetIntoManageSchemas(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<boolean> {
  await ctx.waitFor(GRPC.PROTO_MANAGE_MODAL, 10_000);
  await ctx.waitFor(GRPC.PROTO_PROTOSET_ZONE, 10_000);

  const modal = document.querySelector<HTMLElement>(GRPC.PROTO_MANAGE_MODAL);
  const zone = document.querySelector<HTMLElement>(GRPC.PROTO_PROTOSET_ZONE);
  if (!modal || !zone) return false;

  const decodeBase64ToBytes = (base64: string): Uint8Array => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  };

  const protosetBytes = decodeBase64ToBytes(SAMPLE_PROTOSET_BASE64);
  const protosetArrayBuffer = protosetBytes.buffer.slice(
    protosetBytes.byteOffset,
    protosetBytes.byteOffset + protosetBytes.byteLength,
  ) as ArrayBuffer;

  const protosetFile = new File([
    protosetArrayBuffer,
  ], 'echo.protoset', { type: 'application/octet-stream' });

  const dispatchDrop = (file: File): void => {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    zone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer }));
    zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
  };

  try {
    dispatchDrop(protosetFile);
    await ctx.delay(400);
    if (document.querySelector('[data-testid="grpc-proto-protoset-name"]')) {
      return true;
    }
    // Give React one extra render cycle.
    await ctx.delay(300);
    if (document.querySelector('[data-testid="grpc-proto-protoset-name"]')) {
      return true;
    }
  } catch {
    // Fallback to hidden file input when synthetic DragEvent transfer data is blocked.
  }

  const fileInput = modal.querySelector<HTMLInputElement>('input[type="file"][accept=".pb,.protoset"]');
  if (!fileInput) return false;

  const fallbackDataTransfer = new DataTransfer();
  fallbackDataTransfer.items.add(protosetFile);
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: fallbackDataTransfer.files,
  });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await ctx.delay(400);
  return Boolean(document.querySelector('[data-testid="grpc-proto-protoset-name"]'));
}

export async function waitForManageSchemasLoadSuccess(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
  expectedSource: 'protoset' | 'bsr' | 'proto_files',
  timeoutMs = 10_000,
): Promise<boolean> {
  const startedAt = Date.now();
  let sawLoading = false;
  while (Date.now() - startedAt < timeoutMs) {
    const loadError = document.querySelector<HTMLElement>(GRPC.PROTO_LOAD_ERROR);
    if (loadError?.textContent?.trim()) {
      return false;
    }

    const sourceChipText = document
      .querySelector<HTMLElement>(GRPC.EXPLORER_SOURCE)
      ?.textContent
      ?.trim()
      .toLowerCase() ?? '';

    // Accept success as soon as source chip reflects the new source —
    // fast loads may complete before we ever observe the "loading" button text.
    if (sourceChipText.includes(expectedSource)) {
      return true;
    }

    const loadBtn = document.querySelector<HTMLButtonElement>(GRPC.PROTO_LOAD_BTN);
    const loadBtnText = loadBtn?.textContent?.trim().toLowerCase() ?? '';
    if (loadBtnText.includes('loading')) {
      sawLoading = true;
    }

    // If we saw loading start but button is no longer loading and source hasn't
    // matched yet, the load finished without changing the source (error path).
    if (sawLoading && loadBtn && !loadBtnText.includes('loading')) {
      return false;
    }

    await ctx.delay(80);
  }
  return false;
}
