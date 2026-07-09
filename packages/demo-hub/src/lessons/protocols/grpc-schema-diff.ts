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
      await grpcFirstCallSetup(ctx);
      await guardGrpcTargetQuiet(ctx);
      await ensureGrpcStudioSubNavQuiet(ctx);
      await clearGrpcSchemaDriftQuiet(ctx);
      await closeGrpcSettingsDrawerQuiet(ctx);
      await clearBaselineQuiet(ctx);
    },
    action: async (ctx) => {
      // Beat 1 — connection row: target must be valid before reflection.
      await spotlightAndPause(ctx, GRPC.CONNECTION_BAR, 800);
      await spotlightAndPause(ctx, GRPC.TARGET_STATUS_OK, 700);

      // Beat 2 — Reflect: pull the live descriptor into Service Explorer.
      await spotlightAndPause(ctx, GRPC.REFLECT_BTN, 900);
      await ensureGrpcReflected(ctx);
      await ctx.delay(600);
      await spotlightAndPause(ctx, GRPC.SERVICE_EXPLORER, 900);
      await spotlightAndPause(ctx, GRPC.EXPLORER_TREE, 800);
      await spotlightAndPause(ctx, GRPC.EXPLORER_SOURCE, 800);

      // Beat 3 — Advanced → Schema diff: baseline captures what reflection loaded.
      await spotlightAndPause(ctx, GRPC.SUB_NAV_ADVANCED, 800);
      await ctx.click(GRPC.SUB_NAV_ADVANCED);
      await ctx.delay(600);

      await spotlightAndPause(ctx, GRPC.ADVANCED_NAV, 700);
      await spotlightAndPause(ctx, GRPC.ADVANCED_TAB('schema_diff'), 800);
      await ctx.click(GRPC.ADVANCED_TAB('schema_diff'));
      await ctx.delay(500);

      try {
        await ctx.waitFor(GRPC.SCHEMA_DIFF_PANEL, 4_000);
      } catch { /* panel renders quickly */ }
      await ctx.delay(300);

      // Beat 4 — tour the empty panel; Capture baseline is the next step.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_PANEL, 900);
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CAPTURE_BASELINE, 900);
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_COMPARE, 800);
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_STATUS, 700);
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
      // Spotlight the Capture baseline button and click it.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CAPTURE_BASELINE, 900);
      await ctx.click(GRPC.SCHEMA_DIFF_CAPTURE_BASELINE);
      await ctx.delay(700);

      // Wait for the baseline chip to reflect the captured key.
      try {
        await ctx.waitFor(GRPC.SCHEMA_DIFF_BASELINE_KEY, 3_000);
      } catch { /* chip renders synchronously */ }
      await ctx.delay(400);

      // Spotlight the chip row to show key + timestamp.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_BASELINE_KEY, 1_000);

      // Spotlight the status area.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_STATUS, 700);
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
      // Spotlight and simulate clicking Compare (we inject the diff rather than
      // requiring an actual v2 server to be running).
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_COMPARE, 900);

      // Inject the pre-seeded diff report — simulates Compare against v2 server.
      patchGrpcSchemaDiffReport({ report: DEMO_DIFF_REPORT });
      await ctx.delay(600);

      // Wait for the results panel to appear.
      try {
        await ctx.waitFor(GRPC.SCHEMA_DIFF_RESULTS, 3_000);
      } catch { /* results render synchronously after injection */ }
      await ctx.delay(400);

      // Spotlight the results panel with summary metrics.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_RESULTS, 900);
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_SUMMARY, 1_000);

      // Spotlight the change list.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, 900);
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
      // Ensure diff results are present.
      if (!document.querySelector(GRPC.SCHEMA_DIFF_RESULTS)) {
        await navigateToSchemaDiffPanelQuiet(ctx);
        await ensureBaselineCapturedQuiet(ctx);
        patchGrpcSchemaDiffReport({ report: DEMO_DIFF_REPORT });
        await ctx.delay(400);
      }
    },
    action: async (ctx) => {
      // Spotlight the full change list.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, 900);

      // Spotlight the first (breaking) row.
      const rows = document.querySelectorAll<HTMLElement>(GRPC.SCHEMA_DIFF_CHANGE_ROW);
      const breakingRow = Array.from(rows).find((r) =>
        r.classList.contains('grpc-advanced-diff-line--breaking') ||
        r.textContent?.includes('breaking'),
      );
      if (breakingRow) {
        await spotlightElementAndPause(ctx, breakingRow, 1_000);
      }

      // Spotlight the informational row.
      const infoRow = Array.from(rows).find((r) =>
        r.classList.contains('grpc-advanced-diff-line--informational') ||
        r.textContent?.includes('informational'),
      );
      if (infoRow) {
        await spotlightElementAndPause(ctx, infoRow, 900);
      }

      // Final: spotlight the full list again.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, 800);
    },
    verify: GRPC.SCHEMA_DIFF_CHANGE_LIST,
  },

  // =========================================================================
  // Step 5 — Filter by Breaking severity
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
      if (!document.querySelector(GRPC.SCHEMA_DIFF_RESULTS)) {
        await navigateToSchemaDiffPanelQuiet(ctx);
        await ensureBaselineCapturedQuiet(ctx);
        patchGrpcSchemaDiffReport({ report: DEMO_DIFF_REPORT });
        await ctx.delay(400);
      }
      // Reset filter to 'all'.
      setSeverityFilter('all');
      await ctx.delay(200);
    },
    action: async (ctx) => {
      // Spotlight the filter dropdown.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_SEVERITY_FILTER, 900);

      // Set filter to "breaking".
      setSeverityFilter('breaking');
      await ctx.delay(600);

      // Spotlight the filtered change list — only one breaking row.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, 900);

      // Reset to "all" for the viewer to see both rows again.
      setSeverityFilter('all');
      await ctx.delay(500);
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, 800);
    },
    verify: GRPC.SCHEMA_DIFF_CHANGE_LIST,
  },

  // =========================================================================
  // Step 6 — Export diff as JSON + Markdown
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
      if (!document.querySelector(GRPC.SCHEMA_DIFF_RESULTS)) {
        await navigateToSchemaDiffPanelQuiet(ctx);
        await ensureBaselineCapturedQuiet(ctx);
        patchGrpcSchemaDiffReport({ report: DEMO_DIFF_REPORT });
        await ctx.delay(400);
      }
    },
    action: async (ctx) => {
      // Spotlight the Diff report header + export buttons.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_RESULTS, 800);

      // Spotlight and click Copy JSON.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_EXPORT_JSON, 900);
      await ctx.click(GRPC.SCHEMA_DIFF_EXPORT_JSON);
      await ctx.delay(600);

      // Spotlight Copy Markdown.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_EXPORT_MARKDOWN, 900);
      await ctx.click(GRPC.SCHEMA_DIFF_EXPORT_MARKDOWN);
      await ctx.delay(600);

      // Spotlight summary one more time to show the counts.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_SUMMARY, 900);
    },
    verify: GRPC.SCHEMA_DIFF_EXPORT_JSON,
  },

  // =========================================================================
  // Step 7 — Acknowledge + Hide acknowledged
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
      if (!document.querySelector(GRPC.SCHEMA_DIFF_RESULTS)) {
        await navigateToSchemaDiffPanelQuiet(ctx);
        await ensureBaselineCapturedQuiet(ctx);
        patchGrpcSchemaDiffReport({ report: DEMO_DIFF_REPORT });
        await ctx.delay(400);
      }
      // Ensure severity filter is "all".
      setSeverityFilter('all');
      await ctx.delay(200);
    },
    action: async (ctx) => {
      // Spotlight the full change list.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, 800);

      // Find and spotlight the first Acknowledge button.
      const ackBtn = document.querySelector<HTMLButtonElement>(GRPC.SCHEMA_DIFF_ACK_BTN);
      if (ackBtn) {
        await spotlightElementAndPause(ctx, ackBtn, 800);
        ackBtn.click();
        await ctx.delay(600);
      }

      // Spotlight the acknowledged row (now shows "Unacknowledge").
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, 800);

      // Spotlight and toggle "Hide acknowledged".
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_HIDE_ACKNOWLEDGED, 900);
      const hideCheckbox = document.querySelector<HTMLInputElement>(GRPC.SCHEMA_DIFF_HIDE_ACKNOWLEDGED);
      if (hideCheckbox) {
        hideCheckbox.click();
        await ctx.delay(500);
      }

      // Show the filtered (acknowledged-hidden) list.
      await spotlightAndPause(ctx, GRPC.SCHEMA_DIFF_CHANGE_LIST, 800);

      // Uncheck "Hide acknowledged" to restore full view.
      if (hideCheckbox) {
        hideCheckbox.click();
        await ctx.delay(400);
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
  },
  steps,
  setup: async (ctx) => {
    await grpcFirstCallSetup(ctx);
    await ensureGrpcStudioSubNavQuiet(ctx);
  },
  cleanup: async (ctx) => {
    await grpcFirstCallCleanup(ctx);
  },
};
