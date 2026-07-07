/**
 * Lesson GRPC-16: Schema Discovery — Reflection & Proto Import
 *
 * End-to-end descriptor-sources lesson covering reflection and schema import workflows.
 *
 * Steps (17):
 *   grpc16-intro         — descriptor source overview
 *   grpc16-target        — set target, verify OK
 *   grpc16-reflect       — click Reflect, verify explorer tree
 *   grpc16-source        — confirm source badge + search demo
 *   grpc16-manage-open   — open Manage Schemas modal
 *   grpc16-proto-roots   — root-aware proto ingest model (protoRoots)
 *   grpc16-tabs          — quick orientation across source tabs
 *   grpc16-proto-files   — Proto Files: upload two sample files
 *   grpc16-select-root   — Proto Files: select root and review canonical paths
 *   grpc16-proto-load    — Proto Files: load descriptor bundle
 *   grpc16-schema-browser— open Schema Browser and inspect Echo
 *   grpc16-copy-grpcurl  — spotlight copy as grpcurl action
 *   grpc16-open-method   — open method in call panel and execute unary
 *   grpc16-protoset      — open Protoset tab for concrete upload workflow
 *   grpc16-url           — open URL tab for concrete remote proto workflow
 *   grpc16-bsr           — open BSR tab for concrete registry workflow
 *   grpc16-drift         — schema drift awareness (informational; simulation deferred)
 */
import { GRPC } from '@shared/selectors';
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import {
  clearGrpcSchemaDriftQuiet,
  GRPC_DEMO_TARGET,
  closeGrpcSettingsDrawerQuiet,
  ensureEchoMethodSelected,
  ensureGrpcReflected,
  ensureGrpcStudioSubNavQuiet,
  ensureGrpcTarget,
  fillGrpcRequestJsonBody,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  guardGrpcReflectedQuiet,
  guardGrpcTargetQuiet,
  openFreshGrpcTabQuietWithOptions,
  rebindGrpcMethodQuiet,
  spotlightAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';

const GRPCD_ROSTER = getGrpcLessonRosterEntry('grpc-schema-discovery')!;
const LOOKUP_SCHEMA_NODE_SEL = GRPC.SCHEMA_TREE_NODE('method', 'api.ApiService', 'Lookup');
const ECHO_SCHEMA_NODE_SEL = GRPC.SCHEMA_TREE_NODE('method', 'echo.EchoService', 'Echo');
const SAMPLE_PROTO_SERVICE = 'examples/grpc/schema-discovery/proto-files/api/service.proto';
const SAMPLE_PROTO_SHARED = 'examples/grpc/schema-discovery/proto-files/shared/common.proto';
const SAMPLE_PROTOSET = 'examples/grpc/schema-discovery/protoset/echo.protoset';
const SAMPLE_PROTOSET_BASE64 = 'CsYDCgplY2hvLnByb3RvEgRlY2hvIh4KC0VjaG9SZXF1ZXN0Eg8KB21lc3NhZ2UYASABKAkiHwoMRWNob1Jlc3BvbnNlEg8KB21lc3NhZ2UYASABKAkiZAoNU3RyZWFtUmVxdWVzdBIPCgdtZXNzYWdlGAEgASgJEiEKDHJlcGVhdF9jb3VudBgCIAEoBVILcmVwZWF0Q291bnQSHwoLaW50ZXJ2YWxfbXMYAyABKAVSCmludGVydmFsTXMy6QEKC0VjaG9TZXJ2aWNlEi0KBEVjaG8SES5lY2hvLkVjaG9SZXF1ZXN0GhIuZWNoby5FY2hvUmVzcG9uc2USOQoMU2VydmVyU3RyZWFtEhMuZWNoby5TdHJlYW1SZXF1ZXN0GhIuZWNoby5FY2hvUmVzcG9uc2UwARI3CgxDbGllbnRTdHJlYW0SES5lY2hvLkVjaG9SZXF1ZXN0GhIuZWNoby5FY2hvUmVzcG9uc2UoARI3CgpCaWRpU3RyZWFtEhEuZWNoby5FY2hvUmVxdWVzdBoSLmVjaG8uRWNob1Jlc3BvbnNlKAEwAUIXWhVncnBjLXRlc3Qtc2VydmVyL2VjaG9iBnByb3RvMw==';
const SAMPLE_URL_PROTO = 'http://localhost:5173/grpc-samples/url/echo.proto';
const SAMPLE_BSR_MODULE = 'buf.build/connectrpc/eliza';
const SAMPLE_BSR_VERSION = 'main';
const ELIZA_SERVICE_SEL = '[data-testid="grpc-service-connectrpc-eliza-v1-elizaservice"]';
const LOOKUP_REQUEST_JSON = '{"ref":{"id":"A-100"}}';

const SAMPLE_COMMON_PROTO_CONTENT = `syntax = "proto3";

package common;

message SharedRef {
  string id = 1;
  string source = 2;
}
`;

const SAMPLE_SERVICE_PROTO_CONTENT = `syntax = "proto3";

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

async function ensureManageModalOpen(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  if (document.querySelector(GRPC.PROTO_MANAGE_MODAL)) return;
  await ctx.waitFor(GRPC.MANAGE_SCHEMAS_BTN, 10_000);
  await ctx.click(GRPC.MANAGE_SCHEMAS_BTN);
  await ctx.waitFor(GRPC.PROTO_MANAGE_MODAL, 10_000);
  await ctx.delay(350);
}

/** Quiet open for preAction guards — no viewer ripple. */
async function ensureManageModalOpenQuiet(
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

async function ensureProtoFilesTabQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  await ensureManageModalOpenQuiet(ctx);
  const tab = document.querySelector<HTMLElement>(GRPC.PROTO_TAB_PROTO_FILES);
  if (tab && tab.getAttribute('aria-selected') !== 'true') {
    tab.click();
    await ctx.delay(200);
  }
}

async function selectSchemaBrowserMethodQuiet(
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

function isLookupCallPanelReady(): boolean {
  const methodLabel = document.querySelector(GRPC.CALL_METHOD_NAME)?.textContent ?? '';
  return Boolean(document.querySelector(GRPC.CALL_PANEL))
    && (methodLabel.includes('Lookup') || methodLabel.includes('Echo'));
}

function isLookupResponseReady(): boolean {
  const text = document.querySelector<HTMLElement>(GRPC.RESPONSE_BODY)?.textContent ?? '';
  return text.includes('A-100') || text.includes('resolved');
}

/** Quietly bind Schema Browser method into the call panel (preAction guard). */
async function openSchemaMethodInCallPanelQuiet(
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

async function ensureLookupCallReadyQuiet(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  await openSchemaMethodInCallPanelQuiet(ctx);
  await fillGrpcRequestJsonBody(ctx, LOOKUP_REQUEST_JSON);
}

/** Re-run reflection after a failed protoset/url/bsr ingest so the explorer is usable again. */
async function recoverGrpcReflectionQuiet(
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

async function grpcSchemaDiscoverySetup(
  ctx: Parameters<NonNullable<GrpcDemoLesson['setup']>>[0],
): Promise<void> {
  await grpcFirstCallSetup(ctx, { resetSchemaDrafts: false });
  await ensureManageModalClosed(ctx);
}

async function ensureManageModalClosed(
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

async function injectProtoFilesIntoManageSchemas(
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

async function injectProtosetIntoManageSchemas(
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

async function waitForManageSchemasLoadSuccess(
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

// ---------------------------------------------------------------------------
// Lesson definition
// ---------------------------------------------------------------------------

export const grpcSchemaDiscoveryLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPCD_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Learn the five descriptor sources in gRPC Studio — server reflection, Proto file upload, Protoset bundle, URL descriptor, and BSR — then use Schema Browser to explore types, copy a grpcurl command, and open a method in the call panel.',

  setup: grpcSchemaDiscoverySetup,
  cleanup: grpcFirstCallCleanup,

  grpc: buildGrpcContractMetaFromRoster(GRPCD_ROSTER),

  concept: {
    title: 'How gRPC Studio Loads Schemas',
    body: `Before you can invoke an RPC, gRPC Studio needs the **service descriptor** — the compiled protobuf schema that defines method signatures, request shapes, and response shapes.

Studio supports five descriptor sources, in priority order:
1. **Server reflection** — pull live from the running server (fastest in dev/staging)
2. **Proto files** — upload raw .proto files + configure import paths
3. **Protoset** — upload a pre-compiled binary descriptor bundle (ideal for CI)
4. **URL** — reference a hosted descriptor file
5. **BSR (Buf Schema Registry)** — load from a module registry

Concrete samples used in this lesson:
- **Proto Files:** \`${SAMPLE_PROTO_SERVICE}\` + \`${SAMPLE_PROTO_SHARED}\`
- **Protoset:** \`${SAMPLE_PROTOSET}\`
- **URL:** \`${SAMPLE_URL_PROTO}\`
- **BSR:** \`${SAMPLE_BSR_MODULE}\` @ \`${SAMPLE_BSR_VERSION}\` (requires internet / public module availability)

In this lesson you will:
1. Set target \`${GRPC_DEMO_TARGET}\` and run **Reflect** to populate the explorer.
2. Confirm reflection as the active source and use explorer search.
3. Open **Manage Schemas** and orient across all source tabs.
4. Review the **root-aware Proto Files model** (\`protoRoots\`) with canonical preview and collision diagnostics.
5. Complete a full **Proto Files** workflow: select/create the **shared** root, upload two files, and load.
6. Use **Schema Browser** to inspect descriptors, copy a grpcurl command, and open a method in the call panel.
7. Run a concrete **Protoset** upload and verify source switch only after a successful load.
8. Run a concrete **URL** descriptor workflow and verify validation/parse behavior.
9. Run a concrete **BSR** registry workflow and verify real network-backed load behavior.
10. Review drift awareness and how descriptor source changes are surfaced in Studio.

Notes on runtime behavior:
- Source tab actions use real load outcomes (no simulated success path).
- Manage Schemas draft inputs are persisted per tab across refresh.
- Demo-run hygiene clears stale gRPC Studio draft/session keys before setup to keep lessons deterministic.

**Schema drift** — when a server's reflection changes after Studio has already cached descriptors, a drift banner appears. Studio lets you rebind per-service or dismiss the warning. Live drift simulation is covered in **Lesson 13 (\`grpc-schema-diff\`)**.`,
    keyTerms: [
      {
        term: 'Descriptor source',
        definition:
          'Where gRPC Studio gets proto type information — reflection, local file, binary protoset, URL, or BSR.',
      },
      {
        term: 'Server reflection',
        definition:
          'A built-in gRPC API that returns service descriptors at runtime so clients can discover services without local .proto files.',
      },
      {
        term: 'Import path',
        definition:
          'A search directory used to resolve relative imports across multi-file protobuf packages (e.g. "shared" for shared/common.proto).',
      },
      {
        term: 'Proto root',
        definition:
          'A virtual mount (`protoRoots`) that groups uploaded proto files by folder-like context and generates canonical paths for import resolution.',
      },
      {
        term: 'Canonical path preview',
        definition:
          'A live list of effective `<mountPath>/<file.path>` values used during descriptor resolution, helping catch path mistakes before loading.',
      },
      {
        term: 'Collision diagnostics',
        definition:
          'Warnings when file basenames or canonical paths conflict across roots, signaling potential ambiguous import resolution.',
      },
      {
        term: 'Protoset',
        definition:
          'A pre-compiled binary bundle (.pb) containing all proto descriptors — useful for CI and offline environments.',
      },
      {
        term: 'Schema Browser',
        definition:
          'A navigable tree of all services, messages, and enum types in the loaded descriptor — supports grpcurl copy and open-in-tab.',
      },
      {
        term: 'Schema drift',
        definition:
          'When the descriptors on file no longer match the running server\'s reflection. Studio surfaces a banner to guide rebinding.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 460" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpcd-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpcd-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="grpcd-arr-v" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#c084fc"/>
    </marker>
    <marker id="grpcd-arr-o" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#f59e0b"/>
    </marker>
  </defs>

  <!-- Window chrome -->
  <rect x="1" y="1" width="698" height="308" rx="8" fill="#0d1520" stroke="#3b4a60" stroke-width="1.5"/>
  <rect x="1" y="1" width="698" height="30" rx="8" fill="#0a1118"/>
  <rect x="1" y="20" width="698" height="11" fill="#0a1118"/>
  <circle cx="18" cy="15" r="4.5" fill="#ef4444" opacity="0.8"/>
  <circle cx="34" cy="15" r="4.5" fill="#f59e0b" opacity="0.8"/>
  <circle cx="50" cy="15" r="4.5" fill="#22c55e" opacity="0.8"/>
  <text x="350" y="19" text-anchor="middle" font-size="11" fill="#a8b8cc">gRPC Studio — Schema Discovery: Reflection &amp; Proto Import</text>

  <!-- Connection bar -->
  <rect x="1" y="31" width="698" height="40" fill="#0f172a"/>
  <rect x="12" y="39" width="200" height="24" rx="4" fill="#0a1118" stroke="#3b82f6" stroke-width="1"/>
  <text x="22" y="55" font-family="monospace" font-size="10" fill="#f1f5f9">${GRPC_DEMO_TARGET}</text>
  <rect x="220" y="40" width="72" height="22" rx="11" fill="#052e16" stroke="#22c55e"/>
  <text x="256" y="55" text-anchor="middle" font-size="9" fill="#22c55e">Target OK</text>
  <rect x="302" y="40" width="72" height="22" rx="4" fill="#1e293b" stroke="#3b82f6"/>
  <text x="338" y="55" text-anchor="middle" font-size="10" fill="#3b82f6">Reflect</text>
  <rect x="384" y="40" width="116" height="22" rx="4" fill="#1e293b" stroke="#c084fc"/>
  <text x="442" y="55" text-anchor="middle" font-size="9.5" fill="#c084fc">Manage Schemas</text>

  <!-- Left: Service Explorer panel -->
  <rect x="12" y="84" width="200" height="212" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="24" y="103" font-size="10" fill="#a8b8cc">Service Explorer</text>
  <rect x="22" y="110" width="180" height="22" rx="4" fill="#0a1118" stroke="#334155"/>
  <text x="32" y="124" font-size="9" fill="#64748b">Search...</text>
  <text x="24" y="148" font-size="9.5" fill="#22d3ee">echo.EchoService</text>
  <text x="34" y="165" font-size="9" fill="#f1f5f9">Echo</text>
  <text x="34" y="181" font-size="8.5" fill="#64748b">ServerStream</text>
  <text x="34" y="196" font-size="8.5" fill="#64748b">ClientStream</text>
  <text x="34" y="211" font-size="8.5" fill="#64748b">BidiStream</text>
  <rect x="22" y="268" width="116" height="18" rx="9" fill="#1e293b" stroke="#22c55e"/>
  <text x="80" y="280" text-anchor="middle" font-size="8.5" fill="#22c55e">source: reflection</text>
  <circle cx="196" cy="148" r="8" fill="#3b82f6"/><text x="196" y="152" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">2</text>

  <!-- Middle: Manage Schemas modal -->
  <rect x="224" y="84" width="236" height="212" rx="5" fill="#0f172a" stroke="#c084fc"/>
  <text x="236" y="103" font-size="10" fill="#a8b8cc">Manage Schemas modal</text>
  <!-- tabs -->
  <rect x="236" y="110" width="60" height="18" rx="3" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="266" y="122" text-anchor="middle" font-size="8" fill="#93c5fd">Proto Files</text>
  <rect x="300" y="110" width="48" height="18" rx="3" fill="#111827" stroke="#334155"/>
  <text x="324" y="122" text-anchor="middle" font-size="8" fill="#64748b">Protoset</text>
  <rect x="352" y="110" width="28" height="18" rx="3" fill="#111827" stroke="#334155"/>
  <text x="366" y="122" text-anchor="middle" font-size="8" fill="#64748b">URL</text>
  <rect x="384" y="110" width="28" height="18" rx="3" fill="#111827" stroke="#334155"/>
  <text x="398" y="122" text-anchor="middle" font-size="8" fill="#64748b">BSR</text>
  <rect x="416" y="110" width="38" height="18" rx="3" fill="#111827" stroke="#c084fc"/>
  <text x="435" y="122" text-anchor="middle" font-size="8" fill="#c084fc">Schema</text>
  <!-- import path row -->
  <rect x="236" y="136" width="212" height="18" rx="3" fill="#0a1118" stroke="#334155"/>
  <text x="246" y="148" font-size="8.5" fill="#cbd5e1">Import path: shared</text>
  <!-- upload zone -->
  <rect x="236" y="162" width="212" height="80" rx="4" fill="#0a1118" stroke="#334155" stroke-dasharray="4,3"/>
  <text x="342" y="202" text-anchor="middle" font-size="9" fill="#64748b">Drop .proto files here</text>
  <text x="342" y="218" text-anchor="middle" font-size="8" fill="#475569">or browse</text>
  <circle cx="454" cy="136" r="8" fill="#c084fc"/><text x="454" y="140" text-anchor="middle" font-size="9" font-weight="700" fill="#0f172a">3</text>

  <!-- Right: Schema Browser -->
  <rect x="472" y="84" width="216" height="212" rx="5" fill="#0f172a" stroke="#3b4a60"/>
  <text x="484" y="103" font-size="10" fill="#a8b8cc">Schema Browser</text>
  <rect x="484" y="110" width="192" height="22" rx="4" fill="#0a1118" stroke="#334155"/>
  <text x="494" y="124" font-size="8.5" fill="#60a5fa">Search: Echo</text>
  <text x="484" y="150" font-size="9.5" fill="#22d3ee">echo.EchoService</text>
  <text x="494" y="167" font-size="9" fill="#f1f5f9">Echo</text>
  <text x="494" y="183" font-size="8.5" fill="#64748b">ServerStream</text>
  <rect x="484" y="242" width="82" height="20" rx="10" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="525" y="256" text-anchor="middle" font-size="8.5" fill="#93c5fd">Copy grpcurl</text>
  <rect x="574" y="242" width="72" height="20" rx="10" fill="#052e16" stroke="#22c55e"/>
  <text x="610" y="256" text-anchor="middle" font-size="8.5" fill="#86efac">Open in tab</text>
  <circle cx="678" cy="150" r="8" fill="#22c55e"/><text x="678" y="154" text-anchor="middle" font-size="9" font-weight="700" fill="#052e16">4</text>

  <!-- Arrows -->
  <line x1="338" y1="55" x2="140" y2="84" stroke="#3b82f6" stroke-width="1.2" marker-end="url(#grpcd-arr)"/>
  <line x1="442" y1="62" x2="342" y2="84" stroke="#c084fc" stroke-width="1.2" marker-end="url(#grpcd-arr-v)"/>
  <line x1="460" y1="160" x2="472" y2="165" stroke="#22c55e" stroke-width="1.2" marker-end="url(#grpcd-arr-g)"/>
  <line x1="574" y1="252" x2="212" y2="200" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="4,3" marker-end="url(#grpcd-arr-o)"/>
  <text x="388" y="238" font-size="8" fill="#f59e0b" transform="rotate(-14, 388, 238)">open in call panel</text>

  <!-- Bottom: step legend -->
  <text x="350" y="338" text-anchor="middle" font-size="11" fill="#a8b8cc">Discovery workflow</text>

  <circle cx="70" cy="366" r="13" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="70" y="370" text-anchor="middle" font-size="10" fill="#3b82f6">1</text>
  <text x="70" y="390" text-anchor="middle" font-size="9" fill="#cbd5e1">Set target</text>
  <text x="70" y="402" text-anchor="middle" font-size="9" fill="#cbd5e1">+ Reflect</text>
  <line x1="84" y1="366" x2="146" y2="366" stroke="#3b82f6" marker-end="url(#grpcd-arr)"/>

  <circle cx="160" cy="366" r="13" fill="#052e16" stroke="#22c55e"/>
  <text x="160" y="370" text-anchor="middle" font-size="10" fill="#22c55e">2</text>
  <text x="160" y="390" text-anchor="middle" font-size="9" fill="#cbd5e1">Explorer</text>
  <text x="160" y="402" text-anchor="middle" font-size="9" fill="#cbd5e1">+ source badge</text>
  <line x1="174" y1="366" x2="236" y2="366" stroke="#c084fc" marker-end="url(#grpcd-arr-v)"/>

  <circle cx="250" cy="366" r="13" fill="#1f1736" stroke="#c084fc"/>
  <text x="250" y="370" text-anchor="middle" font-size="10" fill="#c084fc">3</text>
  <text x="250" y="390" text-anchor="middle" font-size="9" fill="#cbd5e1">Manage</text>
  <text x="250" y="402" text-anchor="middle" font-size="9" fill="#cbd5e1">Schemas</text>
  <line x1="264" y1="366" x2="326" y2="366" stroke="#3b82f6" marker-end="url(#grpcd-arr)"/>

  <circle cx="340" cy="366" r="13" fill="#1e3a5f" stroke="#3b82f6"/>
  <text x="340" y="370" text-anchor="middle" font-size="10" fill="#3b82f6">4</text>
  <text x="340" y="390" text-anchor="middle" font-size="9" fill="#cbd5e1">Schema</text>
  <text x="340" y="402" text-anchor="middle" font-size="9" fill="#cbd5e1">Browser</text>
  <line x1="354" y1="366" x2="416" y2="366" stroke="#22c55e" marker-end="url(#grpcd-arr-g)"/>

  <circle cx="430" cy="366" r="13" fill="#052e16" stroke="#22c55e"/>
  <text x="430" y="370" text-anchor="middle" font-size="10" fill="#22c55e">5</text>
  <text x="430" y="390" text-anchor="middle" font-size="9" fill="#cbd5e1">Open Echo</text>
  <text x="430" y="402" text-anchor="middle" font-size="9" fill="#cbd5e1">in call panel</text>
</svg>`,
  },

  steps: [
    {
      id: 'grpc16-intro',
      title: 'Descriptor Sources Overview',
      description:
        'gRPC Studio needs a **service descriptor** before it can show you method forms. ' +
        'It can load that descriptor from five sources — reflection, proto files, protoset bundles, URL, and BSR. ' +
        'This lesson covers all five and ends with you opening a callable method from Schema Browser.',
      highlight: GRPC.CONNECTION_BAR,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToGrpcStudio(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
        await ensureGrpcStudioSubNavQuiet(ctx);
        await ensureManageModalClosed(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, 850);
        await spotlightAndPause(ctx, GRPC.MANAGE_SCHEMAS_BTN, 800);
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 900);
        await spotlightAndPause(ctx, GRPC.CALL_PANEL, 850);
      },
    },

    {
      id: 'grpc16-target',
      title: 'Set Target',
      description:
        `Set the gRPC target to \`${GRPC_DEMO_TARGET}\`. ` +
        'Watch the field fill, then pause on the green **Target OK** badge so the address is validated before reflection.',
      highlight: GRPC.TARGET_INPUT,
      pauseAfter: true,
      preAction: async (ctx) => {
        await navigateToGrpcStudio(ctx);
        await closeGrpcSettingsDrawerQuiet(ctx);
        await ensureManageModalClosed(ctx);
      },
      action: async (ctx) => {
        await ensureGrpcTarget(ctx);
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 800);
        await spotlightAndPause(ctx, GRPC.TARGET_STATUS_OK, 900);
      },
      verify: GRPC.TARGET_STATUS_OK,
    },

    {
      id: 'grpc16-reflect',
      title: 'Reflect: Pull Live Descriptors',
      description:
        'Click **Reflect** to have Studio query the `grpc.reflection.v1alpha.ServerReflection` service. ' +
        'The Explorer tree populates with `echo.EchoService` and its four methods — no `.proto` files uploaded.',
      highlight: GRPC.REFLECT_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardGrpcTargetQuiet(ctx);
        await clearGrpcSchemaDriftQuiet(ctx);
        await ensureManageModalClosed(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 750);
        await ensureGrpcReflected(ctx);
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 850);
        await spotlightAndPause(ctx, GRPC.EXPLORER_TREE, 900);
      },
      verify: GRPC.EXPLORER_TREE,
    },

    {
      id: 'grpc16-source',
      title: 'Confirm Source Badge and Search',
      description:
        'Check the Explorer footer — it shows **Reflection** as the active descriptor source. ' +
        'Type **Echo** in the search box to filter the tree. Then clear the filter to restore the full list. ' +
        'Explorer search is pure client-side filtering — it never re-triggers network reflection.',
      highlight: GRPC.EXPLORER_SOURCE,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardGrpcReflectedQuiet(ctx);
        await ensureManageModalClosed(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(GRPC.EXPLORER_SOURCE, 10_000);
        await spotlightAndPause(ctx, GRPC.EXPLORER_FOOTER, 750);
        await spotlightAndPause(ctx, GRPC.EXPLORER_SOURCE, 850);
        await ctx.waitFor(GRPC.EXPLORER_SEARCH, 10_000);
        await spotlightAndPause(ctx, GRPC.EXPLORER_SEARCH, 750);
        await ctx.fill(GRPC.EXPLORER_SEARCH, 'Echo');
        await ctx.waitFor(GRPC.EXPLORER_TREE, 5_000);
        await spotlightAndPause(ctx, GRPC.EXPLORER_TREE, 800);
        await ctx.fill(GRPC.EXPLORER_SEARCH, '');
        await ctx.delay(500);
        await spotlightAndPause(ctx, GRPC.EXPLORER_TREE, 750);
      },
      verify: GRPC.EXPLORER_SOURCE,
    },

    {
      id: 'grpc16-manage-open',
      title: 'Open Manage Schemas',
      description:
        'Click the **Manage Schemas** button to open the schema management modal. ' +
        'Here you control which descriptor source is active — five tabs: **Proto Files**, **Protoset**, **URL**, **BSR**, and **Schema Browser**. ' +
        'Reflection has no tab here; it is triggered from the main explorer. ' +
        'Draft inputs in this modal are persisted per tab, so a hard refresh restores your staged values.',
      highlight: GRPC.MANAGE_SCHEMAS_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await guardGrpcReflectedQuiet(ctx);
        await ensureManageModalClosed(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.MANAGE_SCHEMAS_BTN, 800);
        await ensureManageModalOpen(ctx);
        await spotlightAndPause(ctx, GRPC.PROTO_MANAGE_MODAL, 850);
        await spotlightAndPause(ctx, GRPC.PROTO_TAB_PROTO_FILES, 750);
        await spotlightAndPause(ctx, GRPC.PROTO_TAB_PROTOSET, 700);
        await spotlightAndPause(ctx, GRPC.PROTO_TAB_URL, 700);
        await spotlightAndPause(ctx, GRPC.PROTO_TAB_BSR, 700);
        await spotlightAndPause(ctx, GRPC.PROTO_TAB_SCHEMA_BROWSER, 800);
      },
      verify: GRPC.PROTO_MANAGE_MODAL,
    },

    {
      id: 'grpc16-proto-roots',
      title: 'Proto Files: Root-Aware Ingest',
      description:
        'On **Proto Files**, Studio now uses a root-aware `protoRoots` model. ' +
        'Each uploaded file belongs to a virtual root and is normalized to a canonical path (`<mount>/<file>`). ' +
        'Use this panel to add roots, verify selected-root ownership, and inspect canonical preview output before pressing **Load**. ' +
        'If two roots create ambiguous basenames or duplicate canonical paths, collision warnings appear immediately.',
      highlight: GRPC.PROTO_ROOT_MANAGER,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureProtoFilesTabQuiet(ctx);
        await ctx.waitFor(GRPC.PROTO_ROOT_MANAGER, 5_000).catch(() => undefined);
      },
      action: async (ctx) => {
        await ctx.click(GRPC.PROTO_TAB_PROTO_FILES);
        await ctx.waitFor(GRPC.PROTO_ROOT_MANAGER, 10_000);
        await spotlightAndPause(ctx, GRPC.PROTO_ROOT_MANAGER, 800);
        await spotlightAndPause(ctx, GRPC.PROTO_ROOT_LIST, 850);
        await ctx.waitFor(GRPC.PROTO_CANONICAL_PREVIEW, 10_000);
        await spotlightAndPause(ctx, GRPC.PROTO_CANONICAL_PREVIEW, 900);
      },
      verify: GRPC.PROTO_CANONICAL_PREVIEW,
    },

    {
      id: 'grpc16-tabs',
      title: 'Quick Orientation: Source Tabs',
      description:
        'Use one concrete sample per tab:\n\n' +
        `- **Proto Files**: \`${SAMPLE_PROTO_SERVICE}\` + \`${SAMPLE_PROTO_SHARED}\`\n` +
        `- **Protoset**: \`${SAMPLE_PROTOSET}\`\n` +
        `- **URL**: \`${SAMPLE_URL_PROTO}\`\n` +
        `- **BSR**: \`${SAMPLE_BSR_MODULE}\` @ \`${SAMPLE_BSR_VERSION}\`\n\n` +
        'This is an orientation pass only. The next steps perform a full Proto Files workflow end-to-end.\n\n' +
        'Each tab targets a different deployment pattern.\n\n' +
        '_Note: the BSR example needs internet access._',
      highlight: GRPC.PROTO_TAB_PROTO_FILES,
      pauseAfter: true,
      preAction: async (ctx) => {
        await clearGrpcSchemaDriftQuiet(ctx);
        await ensureManageModalOpenQuiet(ctx);
      },
      action: async (ctx) => {
        await ctx.click(GRPC.PROTO_TAB_PROTOSET);
        await ctx.waitFor(GRPC.PROTO_PROTOSET_ZONE, 10_000);
        await spotlightAndPause(ctx, GRPC.PROTO_PROTOSET_ZONE, 800);
        await ctx.click(GRPC.PROTO_TAB_URL);
        await ctx.waitFor(GRPC.PROTO_URL_INPUT, 10_000);
        await spotlightAndPause(ctx, GRPC.PROTO_URL_INPUT, 800);
        await ctx.click(GRPC.PROTO_TAB_BSR);
        await ctx.waitFor(GRPC.PROTO_BSR_MODULE_INPUT, 10_000);
        await spotlightAndPause(ctx, GRPC.PROTO_BSR_MODULE_INPUT, 800);
        await ctx.click(GRPC.PROTO_TAB_PROTO_FILES);
        await ctx.waitFor(GRPC.PROTO_UPLOAD_ZONE, 10_000);
        await spotlightAndPause(ctx, GRPC.PROTO_UPLOAD_ZONE, 850);
      },
      verify: GRPC.PROTO_UPLOAD_ZONE,
    },

    {
      id: 'grpc16-proto-files',
      title: 'Proto Files: Upload Two Files',
      description:
        'Stay on **Proto Files** and keep the **shared** virtual root selected. Then add the two sample files to the drop zone in sequence:\n\n' +
        `1. \`${SAMPLE_PROTO_SHARED}\`\n` +
        `2. \`${SAMPLE_PROTO_SERVICE}\`\n\n` +
        'The demo stages each drop with a short pause so viewers can follow each addition. ' +
        'After upload, both filenames should appear in the selected root file list and in the canonical preview panel.',
      highlight: GRPC.PROTO_UPLOAD_ZONE,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureProtoFilesTabQuiet(ctx);
        await ctx.waitFor(GRPC.PROTO_UPLOAD_ZONE, 5_000).catch(() => undefined);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.PROTO_UPLOAD_ZONE, 800);
        const uploaded = await injectProtoFilesIntoManageSchemas(ctx);
        if (!uploaded) {
          await ctx.waitFor(GRPC.PROTO_UPLOAD_ZONE, 10_000);
          await spotlightAndPause(ctx, GRPC.PROTO_UPLOAD_ZONE, 850);
          return;
        }
        await ctx.waitFor(GRPC.PROTO_FILE_LIST, 10_000);
        await spotlightAndPause(ctx, GRPC.PROTO_FILE_LIST, 850);
        await spotlightAndPause(ctx, GRPC.PROTO_CANONICAL_PREVIEW, 900);
      },
      verify: GRPC.PROTO_FILE_LIST,
    },

    {
      id: 'grpc16-select-root',
      title: 'Proto Files: Select Root and Review Paths',
      description:
        'Click the **shared** virtual root from the left list to make it active. ' +
        'The right side immediately switches context to that selected root.\n\n' +
        'Review the **Canonical paths** panel for the shared root to confirm file paths are normalized as expected before loading.',
      highlight: GRPC.PROTO_ROOT_LIST,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureProtoFilesTabQuiet(ctx);
        await ctx.waitFor(GRPC.PROTO_ROOT_LIST, 5_000).catch(() => undefined);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.PROTO_ROOT_LIST, 800);
        const modal = document.querySelector<HTMLElement>(GRPC.PROTO_MANAGE_MODAL);
        const sharedRoot = modal
          ? Array.from(modal.querySelectorAll<HTMLElement>('[data-testid^="grpc-proto-root-item-"]'))
            .find((entry) => entry.textContent?.toLowerCase().includes('shared'))
          : null;
        if (sharedRoot) {
          sharedRoot.click();
          await ctx.delay(400);
        }
        await spotlightAndPause(ctx, GRPC.PROTO_SELECTED_ROOT, 750);
        await ctx.waitFor(GRPC.PROTO_CANONICAL_PREVIEW, 10_000);
        await spotlightAndPause(ctx, GRPC.PROTO_CANONICAL_PREVIEW, 900);
      },
      verify: GRPC.PROTO_CANONICAL_PREVIEW,
    },

    {
      id: 'grpc16-proto-load',
      title: 'Proto Files: Load Schema',
      description:
        'Click **Load** to parse the selected files in the root-aware model into an active descriptor source.\n\n' +
        'Expected result:\n' +
        '- No parse error shown\n' +
        '- Schema Browser can now browse the uploaded service\n\n' +
        'If files are missing or imports are unresolved, fix the file set/import root and retry.',
      highlight: GRPC.PROTO_LOAD_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureProtoFilesTabQuiet(ctx);
        await ctx.waitFor(GRPC.PROTO_LOAD_BTN, 5_000).catch(() => undefined);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.PROTO_LOAD_BTN, 800);
        const hasFiles = (document.querySelector(GRPC.PROTO_FILE_LIST)?.children.length ?? 0) > 0;
        if (hasFiles) {
          await ctx.click(GRPC.PROTO_LOAD_BTN);
          await ctx.delay(700);
          await spotlightAndPause(ctx, GRPC.EXPLORER_SOURCE, 850);
        }
      },
      verify: GRPC.PROTO_LOAD_BTN,
    },

    {
      id: 'grpc16-schema-browser',
      title: 'Use Loaded Schema in Schema Browser',
      description:
        'Switch to the **Schema Browser** tab. The browser tree lists every service, message, and enum type from the active descriptor source. ' +
        'If you loaded the Proto Files sample successfully, you can browse the uploaded `api.ApiService` service here. ' +
        'For automation stability, the lesson keeps a reflected fallback path. ' +
        'Type **Lookup** in the search box to filter to the `api.ApiService / Lookup` method node. ' +
        'Select it and inspect the signature in the detail panel on the right.',
      highlight: GRPC.PROTO_TAB_SCHEMA_BROWSER,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureManageModalClosed(ctx);
        await guardGrpcReflectedQuiet(ctx);
        await ensureManageModalOpenQuiet(ctx);
      },
      action: async (ctx) => {
        await ctx.click(GRPC.PROTO_TAB_SCHEMA_BROWSER);
        await ctx.waitFor(GRPC.SCHEMA_BROWSER, 10_000);
        await spotlightAndPause(ctx, GRPC.SCHEMA_BROWSER, 800);
        await ctx.waitFor(GRPC.SCHEMA_BROWSER_TREE, 10_000);
        await spotlightAndPause(ctx, GRPC.SCHEMA_BROWSER_SEARCH, 750);
        await ctx.fill(GRPC.SCHEMA_BROWSER_SEARCH, 'Lookup');
        try {
          await ctx.waitFor(LOOKUP_SCHEMA_NODE_SEL, 8_000);
          await spotlightAndPause(ctx, LOOKUP_SCHEMA_NODE_SEL, 800);
          await ctx.click(LOOKUP_SCHEMA_NODE_SEL);
          await ctx.delay(500);
        } catch {
          try {
            await ctx.fill(GRPC.SCHEMA_BROWSER_SEARCH, 'Echo');
            await ctx.waitFor(ECHO_SCHEMA_NODE_SEL, 4_000);
            await spotlightAndPause(ctx, ECHO_SCHEMA_NODE_SEL, 800);
            await ctx.click(ECHO_SCHEMA_NODE_SEL);
            await ctx.delay(500);
          } catch {
            // Schema Browser node selection is best-effort; lesson stays navigable if slow to render.
          }
        }
        await spotlightAndPause(ctx, GRPC.SCHEMA_BROWSER_DETAIL, 900);
        await spotlightAndPause(ctx, GRPC.SCHEMA_METHOD_SIGNATURE, 850);
      },
      verify: GRPC.SCHEMA_BROWSER,
    },

    {
      id: 'grpc16-copy-grpcurl',
      title: 'Copy grpcurl Command',
      description:
        'With the **Lookup** method selected in Schema Browser, click **Copy as grpcurl** to copy a ready-to-run terminal command to your clipboard. ' +
        'If running it locally, make sure the `grpcurl` CLI is installed first.',
      highlight: GRPC.SCHEMA_COPY_GRPCURL_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await selectSchemaBrowserMethodQuiet(ctx);
      },
      action: async (ctx) => {
        await spotlightAndPause(ctx, GRPC.SCHEMA_BROWSER_DETAIL, 750);
        await spotlightAndPause(ctx, GRPC.SCHEMA_METHOD_SIGNATURE, 800);
        await spotlightAndPause(ctx, GRPC.SCHEMA_COPY_GRPCURL_BTN, 900);
        const copyBtn = document.querySelector<HTMLElement>(GRPC.SCHEMA_COPY_GRPCURL_BTN);
        if (copyBtn) {
          copyBtn.click();
          await ctx.delay(600);
        }
      },
      verify: GRPC.SCHEMA_COPY_GRPCURL_BTN,
    },

    {
      id: 'grpc16-open-method',
      title: 'Open in Tab and Execute Unary',
      description:
        'Click **Open in tab** to bind the method into the call panel. The modal closes and the **Form Input** composer appears. ' +
        `Fill the request with \`${LOOKUP_REQUEST_JSON}\` (or Echo fallback), send the unary call, then pause on **OK** status and the response body.`,
      highlight: GRPC.SCHEMA_OPEN_TAB_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureManageModalClosed(ctx);
        await ensureLookupCallReadyQuiet(ctx);
      },
      action: async (ctx) => {
        if (document.querySelector(GRPC.PROTO_MANAGE_MODAL) && document.querySelector(GRPC.SCHEMA_OPEN_TAB_BTN)) {
          await spotlightAndPause(ctx, GRPC.SCHEMA_OPEN_TAB_BTN, 700);
          await ctx.click(GRPC.SCHEMA_OPEN_TAB_BTN);
          await ensureManageModalClosed(ctx);
          try {
            await ctx.waitFor(GRPC.CALL_PANEL, 4_000);
          } catch {
            await ctx.delay(300);
          }
        } else if (!isLookupCallPanelReady()) {
          await ensureEchoMethodSelected(ctx);
        }

        await spotlightAndPause(ctx, GRPC.REQUEST_TAB_FORM, 650);
        if (document.querySelector(GRPC.REQUEST_JSON)) {
          await spotlightAndPause(ctx, GRPC.REQUEST_JSON, 750);
        } else {
          await spotlightAndPause(ctx, GRPC.PROTO_FORM, 750);
        }

        if (!document.querySelector<HTMLTextAreaElement>(GRPC.REQUEST_JSON)?.value.includes('A-100')) {
          await fillGrpcRequestJsonBody(ctx, LOOKUP_REQUEST_JSON);
        }

        await spotlightAndPause(ctx, GRPC.SEND_BTN, 700);
        if (!isLookupResponseReady()) {
          await ctx.click(GRPC.SEND_BTN);
          try {
            await ctx.waitFor(GRPC.RESPONSE_BODY, 8_000);
          } catch {
            await ctx.waitFor(GRPC.RESPONSE_STATUS, 10_000);
          }
        }
        await ctx.delay(400);
        await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 700);
        await spotlightAndPause(ctx, GRPC.RESPONSE_BODY, 850);
      },
      verify: GRPC.RESPONSE_BODY,
    },

    {
      id: 'grpc16-protoset',
      title: 'Protoset: Upload Descriptor Bundle',
      description:
        'Return to **Manage Schemas** and switch to the **Protoset** tab. ' +
        `Use the sample bundle path \`${SAMPLE_PROTOSET}\` as the concrete artifact for this step. ` +
        'After selecting a `.protoset` file, click **Load** to activate that descriptor source. ' +
        'This step performs a real descriptor load and only proceeds after success.',
      highlight: GRPC.PROTO_TAB_PROTOSET,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureManageModalClosed(ctx);
        await openFreshGrpcTabQuietWithOptions(ctx, { forceFresh: true });
        await clearGrpcSchemaDriftQuiet(ctx);
        await ensureManageModalOpenQuiet(ctx);
      },
      action: async (ctx) => {
        await ctx.click(GRPC.PROTO_TAB_PROTOSET);
        await ctx.waitFor(GRPC.PROTO_PROTOSET_ZONE, 10_000);
        await spotlightAndPause(ctx, GRPC.PROTO_PROTOSET_ZONE, 850);
        const uploaded = await injectProtosetIntoManageSchemas(ctx);
        if (!uploaded) {
          await spotlightAndPause(ctx, GRPC.PROTO_PROTOSET_ZONE, 800);
          return;
        }
        await spotlightAndPause(ctx, GRPC.PROTO_LOAD_BTN, 800);
        const loadBtn = document.querySelector<HTMLButtonElement>(GRPC.PROTO_LOAD_BTN);
        if (!loadBtn || loadBtn.disabled) return;

        loadBtn.click();
        const loaded = await waitForManageSchemasLoadSuccess(ctx, 'protoset');
        if (loaded) {
          await spotlightAndPause(ctx, GRPC.EXPLORER_SOURCE, 850);
        }
      },
      verify: GRPC.PROTO_PROTOSET_ZONE,
    },

    {
      id: 'grpc16-url',
      title: 'URL: Load Descriptor from Remote Proto',
      description:
        'Switch to the **URL** tab and provide the sample descriptor URL. ' +
        `Use \`${SAMPLE_URL_PROTO}\` and click **Load** to run a real remote descriptor fetch flow. ` +
        'Depending on your fixture/network policy, this may either load successfully or return a guarded fetch error.',
      highlight: GRPC.PROTO_TAB_URL,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureManageModalClosed(ctx);
        await clearGrpcSchemaDriftQuiet(ctx);
        await rebindGrpcMethodQuiet(ctx);
        await ensureManageModalOpenQuiet(ctx);
      },
      action: async (ctx) => {
        await ctx.click(GRPC.PROTO_TAB_URL);
        await ctx.waitFor(GRPC.PROTO_URL_INPUT, 10_000);
        await spotlightAndPause(ctx, GRPC.PROTO_URL_INPUT, 800);
        await ctx.fill(GRPC.PROTO_URL_INPUT, SAMPLE_URL_PROTO);
        await ctx.delay(400);
        await spotlightAndPause(ctx, GRPC.PROTO_LOAD_BTN, 800);
        const loadBtn = document.querySelector<HTMLButtonElement>(GRPC.PROTO_LOAD_BTN);
        if (loadBtn && !loadBtn.disabled) {
          loadBtn.click();
          await ctx.delay(800);
        }
      },
      verify: GRPC.PROTO_URL_INPUT,
    },

    {
      id: 'grpc16-bsr',
      title: 'BSR: Load Descriptor from Registry Module',
      description:
        'Switch to the **BSR** tab and fill the module + version fields. ' +
        `Use module \`${SAMPLE_BSR_MODULE}\` at version \`${SAMPLE_BSR_VERSION}\`, then click **Load**. ` +
        'The companion server fetches the descriptor from Buf Schema Registry — direct when you are online, ' +
        'or via your configured proxy when on a corporate network. If the proxy is unreachable, it retries ' +
        'direct automatically. After **Load**, the source badge should update to **bsr** and `ElizaService` ' +
        'appears in the Service Explorer.',
      highlight: GRPC.PROTO_TAB_BSR,
      pauseAfter: true,
      preAction: async (ctx) => {
        await ensureManageModalClosed(ctx);
        await clearGrpcSchemaDriftQuiet(ctx);
        await ensureManageModalOpenQuiet(ctx);
      },
      action: async (ctx) => {
        await ctx.click(GRPC.PROTO_TAB_BSR);
        await ctx.waitFor(GRPC.PROTO_BSR_MODULE_INPUT, 6_000);
        await spotlightAndPause(ctx, GRPC.PROTO_BSR_MODULE_INPUT, 750);
        await ctx.fill(GRPC.PROTO_BSR_MODULE_INPUT, SAMPLE_BSR_MODULE);
        await ctx.delay(300);
        await spotlightAndPause(ctx, GRPC.PROTO_BSR_VERSION_INPUT, 650);
        await ctx.fill(GRPC.PROTO_BSR_VERSION_INPUT, SAMPLE_BSR_VERSION);
        await ctx.delay(300);
        await spotlightAndPause(ctx, GRPC.PROTO_LOAD_BTN, 700);

        const loadBtn = document.querySelector<HTMLButtonElement>(GRPC.PROTO_LOAD_BTN);
        if (!loadBtn || loadBtn.disabled) return;

        loadBtn.click();
        const loaded = await waitForManageSchemasLoadSuccess(ctx, 'bsr', 12_000);
        if (!loaded) {
          if (document.querySelector(GRPC.PROTO_LOAD_ERROR)) {
            await spotlightAndPause(ctx, GRPC.PROTO_LOAD_ERROR, 900);
          }
          return;
        }

        await spotlightAndPause(ctx, GRPC.EXPLORER_SOURCE, 900);
        if (document.querySelector(ELIZA_SERVICE_SEL)) {
          await spotlightAndPause(ctx, ELIZA_SERVICE_SEL, 850);
        }
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 850);
        await ensureManageModalClosed(ctx);
        await ctx.delay(400);
      },
      verify: GRPC.EXPLORER_SOURCE,
    },

    {
      id: 'grpc16-drift',
      title: 'Understanding Schema Drift',
      description:
        '**Schema drift** happens when the running server changes its reflection output after Studio has already cached its descriptors. ' +
        'When present, Studio surfaces a drift banner directly under the connection row in the **main workspace pane** (above method details/call panel). ' +
        'If you do not currently see it, that means no drift is active in this fixture state. ' +
        'The banner offers two options:\n' +
        '- **Rebind** a specific service to pull the updated descriptor.\n' +
        '- **Dismiss** to acknowledge the drift without changing the active schema.\n\n' +
        '⚠️ _Live drift simulation is deferred here and is covered in Lesson 13 (`grpc-schema-diff`) with the modified-proto fixture._',
      highlight: GRPC.SERVICE_EXPLORER,
      pauseAfter: true,
      preAction: async (ctx) => {
        await recoverGrpcReflectionQuiet(ctx);
        await clearGrpcSchemaDriftQuiet(ctx);
      },
      action: async (ctx) => {
        await ctx.waitFor(GRPC.SERVICE_EXPLORER, 6_000);
        await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, 750);
        const driftBanner = document.querySelector(GRPC.SCHEMA_DRIFT_BANNER);
        if (driftBanner) {
          await spotlightAndPause(ctx, GRPC.SCHEMA_DRIFT_BANNER, 900);
          await spotlightAndPause(ctx, GRPC.SCHEMA_DRIFT_REBINDS, 800);
        }
        await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 850);
        await spotlightAndPause(ctx, GRPC.EXPLORER_SOURCE, 800);
      },
      verify: GRPC.SERVICE_EXPLORER,
    },
  ],
};
