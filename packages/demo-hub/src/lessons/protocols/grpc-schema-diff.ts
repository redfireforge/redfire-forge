/**
 * Lesson GRPC-14: Proto Schema Diff & Breaking Change Detection
 *
 * Teaches learners to capture a proto schema baseline, simulate a breaking
 * server-side change, compare the old and new descriptors, read the three
 * severity levels, export the diff report, and acknowledge changes.
 *
 *   grpc14-intro        — Reflect on Studio; navigate to Advanced → Schema Diff; tour empty state
 *   grpc14-baseline     — Click "Capture baseline"; see key + timestamp chip
 *   grpc14-compare      — Simulate server v2 + Compare; diff results appear
 *   grpc14-read-diff    — Read the change list: breaking row + informational row
 *   grpc14-proto-modal  — Click Proto diff badge to open scoped modal details
 *   grpc14-filter       — Filter by Breaking severity; spotlight the critical row
 *   grpc14-export       — Copy JSON diff report; Copy Markdown changelog
 *   grpc14-ack          — Acknowledge a change; toggle Hide acknowledged
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
  closeGrpcSettingsDrawerQuiet,
  ensureGrpcReflected,
  ensureGrpcStudioSubNavQuiet,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
  guardGrpcTargetQuiet,
  spotlightAndPause,
  spotlightElementAndPause,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import { patchGrpcSchemaDiffReport } from '../../adapters';
import type { DemoActionContext } from '../../types';

// ---------------------------------------------------------------------------
// Roster entry
// ---------------------------------------------------------------------------

const GRPC14_ROSTER = getGrpcLessonRosterEntry('grpc-schema-diff')!;

/** Hold times tuned for 1× viewing — long enough to read, not a tour blur. */
const HOLD = {
  /** Brief look at a control before interacting */
  beforeClick: 1_200,
  /** After a tab / sub-nav switch settles */
  afterNav: 1_100,
  /** Outcome the step is teaching (badge, chip, summary) */
  outcome: 1_600,
  /** Dense text the viewer must read (diff rows, proto panes) */
  read: 2_000,
  /** Full modal / panel digest */
  modal: 1_800,
} as const;

// ---------------------------------------------------------------------------
// Pre-seeded diff report — simulates a v2 echo server that renamed the
// request field from "message" to "text".
// ---------------------------------------------------------------------------

const DEMO_DIFF_REPORT = {
  leftDescriptorKey: 'echo.v1@localhost:50051',
  rightDescriptorKey: 'echo.v2@localhost:50051',
  generatedAt: new Date().toISOString(),
  summary: { breaking: 1, nonBreaking: 0, informational: 1 },
  changes: [
    {
      severity: 'breaking' as const,
      entityType: 'field' as const,
      entityPath: 'echo.EchoRequest.message',
      changeType: 'removed' as const,
      description:
        'Field message (number 1, type string) removed. ' +
        'Existing clients that set this field will have data silently dropped on the wire.',
    },
    {
      severity: 'informational' as const,
      entityType: 'field' as const,
      entityPath: 'echo.EchoRequest.text',
      changeType: 'added' as const,
      description:
        'New optional field text (number 2, type string) added. ' +
        'Older clients that do not know about this field will ignore it safely.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Navigate to Advanced sub-nav and open the Schema Diff tab quietly. */
async function navigateToSchemaDiffPanelQuiet(ctx: DemoActionContext): Promise<void> {
  const advBtn = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
  if (!advBtn) {
    await navigateToGrpcStudio(ctx);
    await ctx.delay(400);
  }
  const advEl = document.querySelector<HTMLElement>(GRPC.SUB_NAV_ADVANCED);
  if (advEl && advEl.getAttribute('aria-selected') !== 'true') {
    advEl.click();
    await ctx.delay(500);
  }
  const diffTab = document.querySelector<HTMLElement>(GRPC.ADVANCED_TAB('schema_diff'));
  if (diffTab && diffTab.getAttribute('aria-selected') !== 'true') {
    diffTab.click();
    await ctx.delay(400);
  }
}

/** Quietly capture the baseline if not already captured. */
async function ensureBaselineCapturedQuiet(ctx: DemoActionContext): Promise<void> {
  const baselineChip = document.querySelector(GRPC.SCHEMA_DIFF_BASELINE_KEY);
  if (baselineChip && !baselineChip.textContent?.includes('not captured')) return;
  const captureBtn = document.querySelector<HTMLButtonElement>(GRPC.SCHEMA_DIFF_CAPTURE_BASELINE);
  if (captureBtn && !captureBtn.disabled) {
    captureBtn.click();
    await ctx.delay(600);
  }
}

/** Quietly clear any existing schema diff baseline. */
async function clearBaselineQuiet(ctx: DemoActionContext): Promise<void> {
  const clearBtn = document.querySelector<HTMLButtonElement>(GRPC.SCHEMA_DIFF_CLEAR_BASELINE);
  if (clearBtn) {
    clearBtn.click();
    await ctx.delay(400);
  }
}

/** Set the severity filter select value. */
function setSeverityFilter(value: 'all' | 'breaking' | 'non_breaking' | 'informational'): void {
  const el = document.querySelector<HTMLSelectElement>(GRPC.SCHEMA_DIFF_SEVERITY_FILTER);
  if (!el) return;
  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  nativeSetter?.call(el, value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Quietly dismiss the Proto Schema Diff modal if still open. */
async function closeProtoModalQuiet(ctx: DemoActionContext): Promise<void> {
  const closeBtn = document.querySelector<HTMLElement>(GRPC.SCHEMA_DIFF_PROTO_MODAL_CLOSE);
  if (!closeBtn) return;
  closeBtn.click();
  await ctx.delay(300);
}

/** Ensure Schema Diff results are present (quiet recreate for rapid Next / restart). */
async function ensureDiffResultsQuiet(ctx: DemoActionContext): Promise<void> {
  await closeProtoModalQuiet(ctx);
  if (document.querySelector(GRPC.SCHEMA_DIFF_RESULTS)) return;
  await navigateToSchemaDiffPanelQuiet(ctx);
  await ensureBaselineCapturedQuiet(ctx);
  patchGrpcSchemaDiffReport({ report: DEMO_DIFF_REPORT });
  await ctx.delay(400);
}

// ---------------------------------------------------------------------------
// Lesson steps
// ---------------------------------------------------------------------------

type DemoStep = GrpcDemoLesson['steps'][number];

const steps: DemoStep[] = [
  // =========================================================================
  // Step 1 — Reflect on Studio, then tour Schema Diff (empty state)
  // =========================================================================
  {
    id: 'grpc14-intro',
    title: 'Intro: Reflection → Schema Diff',
    pauseAfter: true,
    description:
      'gRPC is strongly typed — but proto files change. When a field is removed or ' +
      'its type changes, **existing clients break silently**: they still compile and ' +
      'send requests, but the server no longer understands them.\n\n' +
      'Before you can diff schemas, Studio needs the server\'s **current proto descriptor**. ' +
      'That starts on the **Studio** tab: click **Reflect** and Studio queries the server\'s ' +
      'reflection API — the **Service Explorer** fills with every service and method.\n\n' +
      'Once reflection is loaded, open **Advanced → Schema diff**. **Capture baseline** ' +
      'snapshots that descriptor as your reference point. Later, **Compare** re-reflects the ' +
      'server and classifies every change:\n\n' +
      '- 🔴 **Breaking** — field removed, field number reused, type changed\n' +
      '- 🟡 **Non-breaking** — structural change existing clients can tolerate\n' +
      '- 🔵 **Informational** — pure additions: new optional fields, new methods\n\n' +
      'Export the report as JSON (for CI gates) or Markdown (for changelogs), and ' +
      'acknowledge individual changes once reviewed.',
    highlight: GRPC.REFLECT_BTN,
    preAction: async (ctx) => {
      // Skip the Manage Schemas draft reset — this lesson diffs live reflection
      // against a captured baseline, never staged schema sources. Running it
      // would cycle the Manage Schemas modal across every tab, flashing a burst
      // of modals before step 1.
      await grpcFirstCallSetup(ctx, { resetSchemaDrafts: false });
      await guardGrpcTargetQuiet(ctx);
      await ensureGrpcStudioSubNavQuiet(ctx);
      await clearGrpcSchemaDriftQuiet(ctx);
      await closeGrpcSettingsDrawerQuiet(ctx);
      await clearBaselineQuiet(ctx);
    },
    action: async (ctx) => {
      // Beat 1 — Reflect: pull the live descriptor into Service Explorer.
      await spotlightAndPause(ctx, GRPC.REFLECT_BTN, HOLD.beforeClick);
      await ensureGrpcReflected(ctx);
      await ctx.delay(HOLD.afterNav);
      await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, HOLD.outcome);

      // Beat 2 — Advanced → Schema Diff (one path, no side tours).
      await spotlightAndPause(ctx, GRPC.SUB_NAV_ADVANCED, HOLD.beforeClick);
      await ctx.click(GRPC.SUB_NAV_ADVANCED);
      await ctx.delay(HOLD.afterNav);

      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('schema_diff'), HOLD.beforeClick);
      await ctx.click(GRPC.ADVANCED_TAB('schema_diff'));
      try {
        await ctx.waitFor(GRPC.SCHEMA_DIFF_PANEL, 4_000);
      } catch { /* panel renders quickly */ }
      await ctx.delay(HOLD.afterNav);

      // Beat 3 — empty panel + Capture baseline (next step's action).
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_PANEL, HOLD.modal);
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CAPTURE_BASELINE, HOLD.outcome);
    },
    verify: GRPC.SCHEMA_DIFF_PANEL,
  },

  // =========================================================================
  // Step 2 — Capture baseline
  // =========================================================================
  {
    id: 'grpc14-baseline',
    title: 'Capture Schema Baseline',
    pauseAfter: true,
    description:
      'Click **Capture baseline** to snapshot the current server\'s proto descriptor. ' +
      'Studio reads the schema from the active reflection source and stores it as a ' +
      'reference point.\n\n' +
      'Two chips appear below the toolbar:\n' +
      '- **Baseline** — a fingerprint of the server address + descriptor content\n' +
      '- **Captured** — timestamp of when the snapshot was taken\n\n' +
      'Capture baseline when you know the server is at a good, stable state. Any ' +
      'future **Compare** will diff the live server schema against this snapshot.',
    highlight: GRPC.SCHEMA_DIFF_CAPTURE_BASELINE,
    preAction: async (ctx) => {
      await navigateToSchemaDiffPanelQuiet(ctx);
      await clearBaselineQuiet(ctx);
    },
    action: async (ctx) => {
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CAPTURE_BASELINE, HOLD.beforeClick);
      await ctx.click(GRPC.SCHEMA_DIFF_CAPTURE_BASELINE);

      try {
        await ctx.waitFor(GRPC.SCHEMA_DIFF_BASELINE_KEY, 3_000);
      } catch { /* chip renders synchronously */ }
      await ctx.delay(HOLD.afterNav);

      // Outcome: baseline fingerprint + captured timestamp.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_BASELINE_KEY, HOLD.outcome);
    },
    verify: GRPC.SCHEMA_DIFF_BASELINE_KEY,
  },

  // =========================================================================
  // Step 3 — Simulate server v2 + Compare
  // =========================================================================
  {
    id: 'grpc14-compare',
    title: 'Compare: Detect Breaking Changes',
    pauseAfter: true,
    description:
      'The server team deployed proto **v2** — the `message` field was **removed** ' +
      'and a new `text` field was added in its place.\n\n' +
      'Click **Compare** to re-reflect the server and diff its new descriptor against ' +
      'the baseline. The diff engine classifies every change and computes a summary:\n\n' +
      '- **1 Breaking** — `message` field removed (clients lose data silently)\n' +
      '- **1 Informational** — `text` field added (safe addition, old clients ignore it)\n\n' +
      'Breaking changes should block deployment in CI until resolved or explicitly acknowledged.',
    highlight: GRPC.SCHEMA_DIFF_COMPARE,
    preAction: async (ctx) => {
      await navigateToSchemaDiffPanelQuiet(ctx);
      await ensureBaselineCapturedQuiet(ctx);
    },
    action: async (ctx) => {
      // Simulate Compare against a v2 server (injected report — no live v2 needed).
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_COMPARE, HOLD.beforeClick);
      patchGrpcSchemaDiffReport({ report: DEMO_DIFF_REPORT });

      try {
        await ctx.waitFor(GRPC.SCHEMA_DIFF_RESULTS, 3_000);
      } catch { /* results render synchronously after injection */ }
      await ctx.delay(HOLD.afterNav);

      // Outcome: severity summary cards (rows are the next step).
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_SUMMARY, HOLD.read);
    },
    verify: GRPC.SCHEMA_DIFF_RESULTS,
  },

  // =========================================================================
  // Step 4 — Read the diff: breaking row + informational row
  // =========================================================================
  {
    id: 'grpc14-read-diff',
    title: 'Reading the Diff: Severity Rows',
    pauseAfter: true,
    description:
      'Each row in the change list shows:\n\n' +
      '- **Entity path** — the fully-qualified proto name (e.g. `echo.EchoRequest.message`)\n' +
      '- **Description** — what changed and why it matters to clients\n' +
      '- **Severity badge** — color-coded: red for breaking, blue for informational\n' +
      '- **Acknowledge** — mark a change as reviewed\n\n' +
      'The **breaking** row is always sorted first, regardless of entity order in the proto ' +
      'file. **Field number reuse** (giving a new field the same number as a removed field) ' +
      'would also appear as breaking — proto uses numbers, not names, on the wire.',
    highlight: GRPC.SCHEMA_DIFF_CHANGE_LIST,
    preAction: async (ctx) => {
      await ensureDiffResultsQuiet(ctx);
    },
    action: async (ctx) => {
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, HOLD.outcome);

      const rows = document.querySelectorAll<HTMLElement>(GRPC.SCHEMA_DIFF_CHANGE_ROW);
      const breakingRow = Array.from(rows).find((r) =>
        r.classList.contains('grpc-advanced-diff-line--breaking') ||
        r.textContent?.includes('breaking'),
      );
      if (breakingRow) {
        await spotlightElementAndPause(ctx, breakingRow, HOLD.read);
      }

      const infoRow = Array.from(rows).find((r) =>
        r.classList.contains('grpc-advanced-diff-line--informational') ||
        r.textContent?.includes('informational'),
      );
      if (infoRow) {
        await spotlightElementAndPause(ctx, infoRow, HOLD.read);
      }
    },
    verify: GRPC.SCHEMA_DIFF_CHANGE_LIST,
  },

  // =========================================================================
  // Step 5 — Open Proto Schema Diff modal from group badge
  // =========================================================================
  {
    id: 'grpc14-proto-modal',
    title: 'Open Proto Schema Diff Modal',
    pauseAfter: true,
    description:
      'Each grouped change header now shows a **Proto diff** badge so users can discover this feature immediately. ' +
      'Click the grouped `echo.EchoRequest` header to open **Proto Schema Diff**.\n\n' +
      'Inside the modal you can review:\n' +
      '- Side-by-side baseline vs current proto text\n' +
      '- Severity summary counts\n' +
      '- Scoped impact rows for the selected entity path\n\n' +
      'Use this view whenever you need a focused explanation for one message/service instead of scanning the full table.',
    highlight: GRPC.SCHEMA_DIFF_PROTO_BADGE,
    preAction: async (ctx) => {
      await ensureDiffResultsQuiet(ctx);
    },
    action: async (ctx) => {
      // Open from the Proto diff badge on the grouped header.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_PROTO_BADGE, HOLD.beforeClick);
      await ctx.click(GRPC.SCHEMA_DIFF_PROTO_BTN);

      try {
        await ctx.waitFor(GRPC.SCHEMA_DIFF_PROTO_MODAL, 3_000);
      } catch { /* modal is usually immediate */ }
      await ctx.delay(HOLD.afterNav);

      // Tour the modal once: impact counts → before/after proto panes.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_PROTO_IMPACT_SUMMARY, HOLD.outcome);
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_PROTO_BEFORE, HOLD.read);
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_PROTO_AFTER, HOLD.read);

      await ctx.click(GRPC.SCHEMA_DIFF_PROTO_MODAL_CLOSE);
      await ctx.delay(HOLD.afterNav);
    },
    verify: GRPC.SCHEMA_DIFF_CHANGE_LIST,
  },

  // =========================================================================
  // Step 6 — Filter by Breaking severity
  // =========================================================================
  {
    id: 'grpc14-filter',
    title: 'Filter by Severity',
    pauseAfter: true,
    description:
      'Use the **Severity filter** dropdown to focus on the changes that matter most. ' +
      'Select **Breaking** to hide informational and non-breaking rows — only the ' +
      '`message` field removal remains visible.\n\n' +
      'In a real workflow you would:\n' +
      '1. Filter to **Breaking** and block deployment if any are unacknowledged\n' +
      '2. Switch to **Informational** to review additions safely\n' +
      '3. Export the full report as JSON for a CI gate check\n\n' +
      'Toggle **Hide acknowledged** to hide rows you have already reviewed.',
    highlight: GRPC.SCHEMA_DIFF_SEVERITY_FILTER,
    preAction: async (ctx) => {
      await ensureDiffResultsQuiet(ctx);
      setSeverityFilter('all');
      await ctx.delay(200);
    },
    action: async (ctx) => {
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_SEVERITY_FILTER, HOLD.beforeClick);
      setSeverityFilter('breaking');
      await ctx.delay(HOLD.afterNav);

      // Outcome: only the breaking row remains.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, HOLD.read);

      // Restore full list so later steps see both rows.
      setSeverityFilter('all');
      await ctx.delay(HOLD.afterNav);
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, HOLD.outcome);
    },
    verify: GRPC.SCHEMA_DIFF_CHANGE_LIST,
  },

  // =========================================================================
  // Step 7 — Export diff as JSON + Markdown
  // =========================================================================
  {
    id: 'grpc14-export',
    title: 'Export: JSON & Markdown',
    pauseAfter: true,
    description:
      'Click **Copy JSON** to copy the full diff report to clipboard. The JSON contains:\n\n' +
      '- `leftDescriptorKey` / `rightDescriptorKey` — baseline vs current fingerprints\n' +
      '- `summary` — counts per severity level\n' +
      '- `changes[]` — each change with entityPath, changeType, severity, description\n\n' +
      'Paste this into CI to gate deployments: reject if `summary.breaking > 0`.\n\n' +
      'Click **Copy Markdown** to get a human-readable changelog entry — ready to paste ' +
      'into a PR description, CHANGELOG.md, or Slack notification.',
    highlight: GRPC.SCHEMA_DIFF_EXPORT_JSON,
    preAction: async (ctx) => {
      await ensureDiffResultsQuiet(ctx);
    },
    action: async (ctx) => {
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_EXPORT_JSON, HOLD.beforeClick);
      await ctx.click(GRPC.SCHEMA_DIFF_EXPORT_JSON);
      await ctx.delay(HOLD.outcome);

      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_EXPORT_MARKDOWN, HOLD.beforeClick);
      await ctx.click(GRPC.SCHEMA_DIFF_EXPORT_MARKDOWN);
      await ctx.delay(HOLD.outcome);
    },
    verify: GRPC.SCHEMA_DIFF_EXPORT_JSON,
  },

  // =========================================================================
  // Step 8 — Acknowledge + Hide acknowledged
  // =========================================================================
  {
    id: 'grpc14-ack',
    title: 'Acknowledge Changes',
    pauseAfter: true,
    description:
      'Click **Acknowledge** on a change row to mark it as reviewed. This records ' +
      'that the team has seen the change — it does **not** mean the change is safe.\n\n' +
      'Once a change is acknowledged:\n' +
      '- The row shows **Unacknowledge** to let you reverse it\n' +
      '- The row is styled as reviewed (muted)\n' +
      '- Toggle **Hide acknowledged** to hide reviewed rows and focus on new changes\n\n' +
      'Acknowledgements are persisted in IndexedDB — they survive page refreshes ' +
      'and are keyed by baseline fingerprint, so acknowledging a change on the ' +
      'current baseline does not affect future comparisons.',
    highlight: GRPC.SCHEMA_DIFF_ACK_BTN,
    preAction: async (ctx) => {
      await ensureDiffResultsQuiet(ctx);
      setSeverityFilter('all');
      await ctx.delay(200);
    },
    action: async (ctx) => {
      const ackBtn = document.querySelector<HTMLButtonElement>(GRPC.SCHEMA_DIFF_ACK_BTN);
      if (ackBtn) {
        await spotlightElementAndPause(ctx, ackBtn, HOLD.beforeClick);
        ackBtn.click();
        await ctx.delay(HOLD.afterNav);
      }

      // Outcome: row flips to Unacknowledge / muted reviewed style.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, HOLD.outcome);

      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_HIDE_ACKNOWLEDGED, HOLD.beforeClick);
      const hideCheckbox = document.querySelector<HTMLInputElement>(GRPC.SCHEMA_DIFF_HIDE_ACKNOWLEDGED);
      if (hideCheckbox && !hideCheckbox.checked) {
        hideCheckbox.click();
        await ctx.delay(HOLD.afterNav);
      }

      // Outcome: acknowledged row hidden — focus on remaining changes.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, HOLD.read);

      // Quiet restore so the panel is left in a sensible end state.
      if (hideCheckbox?.checked) {
        hideCheckbox.click();
        await ctx.delay(500);
      }
    },
    verify: GRPC.SCHEMA_DIFF_CHANGE_LIST,
  },
];

// ---------------------------------------------------------------------------
// Lesson export
// ---------------------------------------------------------------------------

export const grpcSchemaDiffLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC14_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  grpc: buildGrpcContractMetaFromRoster(GRPC14_ROSTER),
  description:
    'Capture a proto schema baseline, simulate a breaking server-side change, compare ' +
    'old and new descriptors, read the three severity levels, export the diff report as ' +
    'JSON or Markdown, and acknowledge individual changes.',
  concept: {
    title: 'Proto Schema Diff & Breaking Change Detection',
    body:
      'gRPC is strongly typed — but proto files change. When a field is **removed** or its ' +
      'type changes, existing clients break silently on the wire.\n\n' +
      'Studio\'s **Schema Diff** panel snapshots a server\'s proto descriptor as a baseline ' +
      'and diffs it against the current descriptor on demand. Every change is classified:\n\n' +
      '- 🔴 **Breaking** — field removed, field number reused, type changed — blocks deployment\n' +
      '- 🟡 **Non-breaking** — structural change existing clients tolerate but surface changes\n' +
      '- 🔵 **Informational** — pure additions (new optional fields, new methods)\n\n' +
      'The diff report exports as **JSON** (for CI gates) or **Markdown** (for changelogs). ' +
      'Individual changes can be **acknowledged** to mark them as reviewed without discarding history.',
    keyTerms: [
      {
        term: 'Baseline snapshot',
        definition:
          'A frozen copy of the server\'s proto descriptor at a known-good point in time. All future diffs compare the current live descriptor against this baseline.',
      },
      {
        term: 'Breaking change',
        definition:
          'A schema modification that causes existing compiled clients to fail at runtime — field removed, field number reused, or type changed. Blocks deployment until resolved.',
      },
      {
        term: 'Non-breaking change',
        definition:
          'A structural modification that existing clients can tolerate — for example renaming a message or changing a field from optional to repeated with the same wire type.',
      },
      {
        term: 'Informational change',
        definition:
          'A pure addition that cannot break any existing client — new optional fields, new methods, or new services. Safe to deploy without coordination.',
      },
      {
        term: 'Acknowledge',
        definition:
          'Mark an individual diff entry as reviewed. Acknowledged changes remain in the report history but no longer trigger severity alerts in subsequent comparisons.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 380" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc14-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc14-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
  </defs>

  <!-- Background -->
  <rect width="700" height="380" rx="10" fill="#0d1520"/>

  <!-- Title -->
  <text x="350" y="28" text-anchor="middle" font-size="13" fill="#e2e8f0" font-weight="600">Schema Diff Workflow</text>

  <!-- ── Left: Baseline ── -->
  <rect x="20" y="55" width="180" height="120" rx="6" fill="#0f172a" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="110" y="78" text-anchor="middle" font-size="10" fill="#93c5fd" font-weight="600">📋 Baseline Snapshot</text>
  <text x="110" y="98" text-anchor="middle" font-size="8" fill="#a8b8cc">echo.proto  v1</text>

  <rect x="35" y="108" width="150" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="110" y="120" text-anchor="middle" font-family="monospace" font-size="7.5" fill="#64748b">message EchoRequest {</text>
  <rect x="35" y="128" width="150" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="110" y="140" text-anchor="middle" font-family="monospace" font-size="7.5" fill="#64748b">  string message = 1;</text>
  <rect x="35" y="148" width="150" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="110" y="160" text-anchor="middle" font-family="monospace" font-size="7.5" fill="#64748b">}</text>

  <!-- ── Right: Current ── -->
  <rect x="500" y="55" width="180" height="140" rx="6" fill="#0f172a" stroke="#fbbf24" stroke-width="1.2"/>
  <text x="590" y="78" text-anchor="middle" font-size="10" fill="#fbbf24" font-weight="600">🔄 Current Descriptor</text>
  <text x="590" y="98" text-anchor="middle" font-size="8" fill="#a8b8cc">echo.proto  v2</text>

  <rect x="515" y="108" width="150" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="590" y="120" text-anchor="middle" font-family="monospace" font-size="7.5" fill="#64748b">message EchoRequest {</text>
  <rect x="515" y="128" width="150" height="16" rx="3" fill="#1c1c2a" stroke="#ef4444" stroke-width="0.8"/>
  <text x="590" y="140" text-anchor="middle" font-family="monospace" font-size="7.5" fill="#f87171">  int32 message = 1;</text>
  <rect x="515" y="148" width="150" height="16" rx="3" fill="#1c2a1c" stroke="#22c55e" stroke-width="0.8"/>
  <text x="590" y="160" text-anchor="middle" font-family="monospace" font-size="7.5" fill="#4ade80">  string tag = 2;</text>
  <rect x="515" y="168" width="150" height="16" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="590" y="180" text-anchor="middle" font-family="monospace" font-size="7.5" fill="#64748b">}</text>

  <!-- Arrows: baseline → compare ← current -->
  <line x1="200" y1="115" x2="260" y2="115" stroke="#3b82f6" stroke-width="1.3" marker-end="url(#grpc14-arr)"/>
  <line x1="500" y1="115" x2="440" y2="115" stroke="#fbbf24" stroke-width="1.3" marker-end="url(#grpc14-arr)"/>

  <!-- ── Center: Diff Engine ── -->
  <rect x="265" y="70" width="170" height="55" rx="6" fill="#0f172a" stroke="#a78bfa" stroke-width="1.4"/>
  <text x="350" y="92" text-anchor="middle" font-size="10" fill="#c4b5fd" font-weight="600">⚙ Schema Diff</text>
  <text x="350" y="108" text-anchor="middle" font-size="8" fill="#a8b8cc">compare descriptors</text>

  <!-- Arrow: diff → results -->
  <line x1="350" y1="125" x2="350" y2="160" stroke="#a78bfa" stroke-width="1.3" marker-end="url(#grpc14-arr)"/>

  <!-- ── Center: Diff Results ── -->
  <rect x="220" y="165" width="260" height="130" rx="6" fill="#0f172a" stroke="#a78bfa" stroke-width="1.2"/>
  <text x="350" y="185" text-anchor="middle" font-size="10" fill="#c4b5fd" font-weight="600">📊 Diff Report</text>

  <!-- Breaking row -->
  <circle cx="238" cy="207" r="5" fill="#ef4444"/>
  <text x="250" y="211" font-size="8.5" fill="#f87171" font-weight="600">Breaking</text>
  <text x="320" y="211" font-size="8" fill="#a8b8cc">message field 1: string → int32</text>

  <!-- Non-breaking row -->
  <circle cx="238" cy="232" r="5" fill="#fbbf24"/>
  <text x="250" y="236" font-size="8.5" fill="#fbbf24" font-weight="600">Non-breaking</text>
  <text x="335" y="236" font-size="8" fill="#a8b8cc">(none in this diff)</text>

  <!-- Informational row -->
  <circle cx="238" cy="257" r="5" fill="#3b82f6"/>
  <text x="250" y="261" font-size="8.5" fill="#93c5fd" font-weight="600">Informational</text>
  <text x="335" y="261" font-size="8" fill="#a8b8cc">new field: tag (string) = 2</text>

  <!-- Acknowledge button -->
  <rect x="235" y="273" width="80" height="16" rx="8" fill="#1e293b" stroke="#22c55e" stroke-width="0.8"/>
  <text x="275" y="284" text-anchor="middle" font-size="7" fill="#4ade80">✓ Acknowledge</text>

  <!-- ── Bottom: Export ── -->
  <rect x="180" y="315" width="140" height="40" rx="6" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="250" y="335" text-anchor="middle" font-size="9" fill="#a8b8cc" font-weight="600">{ } Export JSON</text>
  <text x="250" y="349" text-anchor="middle" font-size="7.5" fill="#64748b">CI gate integration</text>

  <rect x="380" y="315" width="140" height="40" rx="6" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="450" y="335" text-anchor="middle" font-size="9" fill="#a8b8cc" font-weight="600">📝 Export Markdown</text>
  <text x="450" y="349" text-anchor="middle" font-size="7.5" fill="#64748b">Changelog / PR description</text>

  <!-- Arrows: results → exports -->
  <line x1="310" y1="295" x2="250" y2="315" stroke="#3b4a60" stroke-width="1" stroke-dasharray="4 3" marker-end="url(#grpc14-arr)"/>
  <line x1="390" y1="295" x2="450" y2="315" stroke="#3b4a60" stroke-width="1" stroke-dasharray="4 3" marker-end="url(#grpc14-arr)"/>
</svg>`,
  },
  steps,
  setup: async (ctx) => {
    // Skip the Manage Schemas draft reset — this lesson diffs live reflection
    // against a captured baseline, never staged schema sources. Running it would
    // open/close the Manage Schemas modal (cycling Proto Files/Protoset/URL/BSR
    // sub-tabs) for every tab, which the viewer sees as a burst of modals
    // flashing on and off before step 1.
    await grpcFirstCallSetup(ctx, { resetSchemaDrafts: false });
    await ensureGrpcStudioSubNavQuiet(ctx);
  },
  cleanup: async (ctx) => {
    await grpcFirstCallCleanup(ctx);
  },
};
