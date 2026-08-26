/**
 * WF-HAR — Import Browser Traffic as a Workflow
 *
 * 6 steps: concept → toolbar Import HAR button → inject fixture via bridge
 * → preview modal with entries + chain detection → name + confirm → Fit View
 * → Console + Quick Test against JSONPlaceholder.
 *
 * The lesson uses the `__wfTriggerHarImport` bridge to open the preview modal
 * programmatically (bypasses the native OS file picker, which cannot be
 * automated in demo mode).
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  collapseWfDemoAppSidebar,
  closeWfSamplePreviewIfOpen,
  closeWfConfigModalIfOpen,
  cleanupWorkflowDemoRunUi,
  openWfConsoleIfClosed,
} from '../wf-demo-helpers';
import {
  triggerHarImportWithFixture,
  waitForWorkflowBridge,
  selectWorkflowByName,
  triggerWorkflowQuickTest,
  resetWorkflowRunState,
} from '../../adapters';
import {
  HAR_FIXTURE,
  HAR_FIXTURE_FILENAME,
  HAR_IMPORT_WF_NAME,
  deleteHarImportLessonWorkflows,
  ensureHarPreviewModal,
  ensureHarImportWorkflow,
  fillHarWorkflowNameQuiet,
  clickHarImportFitView,
  waitForHarImportQuickTest,
} from './wf-har-import-helpers';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function spotlightSel(
  ctx: DemoActionContext,
  sel: string,
  holdMs: number,
): Promise<void> {
  const el = document.querySelector<HTMLElement>(sel);
  if (!el) return;
  const remove = showSpotlightRing(el);
  await ctx.delay(holdMs);
  remove();
}

// ─── Lesson ─────────────────────────────────────────────────────────────────

export const wfHarImportLesson: DemoLesson = {
  id: 'wf-har-import',
  domainId: 'workflow',
  category: 'fundamentals',
  name: 'Import Browser Traffic (HAR)',
  description:
    'Convert a recorded browser session into a parameterized workflow — ' +
    'no URL typing, chain variables auto-detected from response bodies.',
  estimatedMinutes: 5,
  initialTab: 'workflow',
  allowedTabs: ['workflow'],
  collapseAppSidebarOnStart: true,

  concept: {
    title: 'Browser to Workflow in Seconds',
    body:
      'A **HAR file** (HTTP Archive) is a JSON snapshot of every request your browser made — ' +
      'URL, method, headers, body, and response.\n\n' +
      'RedfireForge reads the HAR and generates a ready-to-run workflow:\n\n' +
      '- **One node per request** — connected in sequence\n' +
      '- **`{{baseUrl}}`** extracted from the common hostname\n' +
      '- **Sensitive headers** (`Authorization`, `Cookie`, API keys) replaced with `{{variable}}` placeholders\n' +
      '- **Chain variables** — when a response value (e.g. `id`) appears in a downstream URL, ' +
      'it becomes `{{id}}` automatically\n\n' +
      '**In this lesson:** You will import a JSONPlaceholder HAR (get post → get comment → list comments) ' +
      'and run **Quick Test** against the live public API — `{{baseUrl}}` pre-filled, `{{id}}` ' +
      'chained from the first response, and `Authorization` redacted to `{{authToken}}`.',
    keyTerms: [
      {
        term: 'HAR file',
        definition:
          'HTTP Archive — a JSON file exported from Chrome, Firefox, or Safari DevTools that ' +
          'records every network request made during a session.',
      },
      {
        term: '{{baseUrl}}',
        definition:
          'A workflow variable set to the common hostname of all imported requests ' +
          '(e.g. `https://jsonplaceholder.typicode.com`). Change it once to target a different environment.',
      },
      {
        term: 'Chain variable',
        definition:
          'A value extracted from one response that automatically replaces a matching segment ' +
          'in a downstream request URL — detected by scanning response body JSON fields.',
      },
    ],
    diagram: `<svg viewBox="0 0 440 90" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="HAR file flows into Import HAR button, then preview modal, then a workflow on the canvas">
      <rect x="0" y="0" width="440" height="90" fill="#0f172a"/>
      <rect x="8" y="20" width="76" height="50" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/>
      <text x="46" y="40" text-anchor="middle" fill="#94a3b8" font-family="system-ui" font-size="8.5">Browser</text>
      <text x="46" y="53" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="7.5">DevTools</text>
      <text x="46" y="64" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="7.5">export HAR</text>
      <path d="M88 45 L114 45" stroke="#475569" stroke-width="1.4" marker-end="url(#harr)"/>
      <rect x="118" y="20" width="76" height="50" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1.4"/>
      <text x="156" y="40" text-anchor="middle" fill="#38bdf8" font-family="system-ui" font-size="8.5">Import HAR</text>
      <text x="156" y="53" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="7.5">preview +</text>
      <text x="156" y="64" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="7.5">confirm</text>
      <path d="M198 45 L224 45" stroke="#475569" stroke-width="1.4" marker-end="url(#harr)"/>
      <rect x="228" y="8" width="64" height="30" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.2"/>
      <text x="260" y="26" text-anchor="middle" fill="#10b981" font-family="system-ui" font-size="8">Start</text>
      <path d="M296 23 L312 23" stroke="#475569" stroke-width="1.2" marker-end="url(#harr)"/>
      <rect x="316" y="8" width="64" height="30" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.2"/>
      <text x="348" y="22" text-anchor="middle" fill="#3b82f6" font-family="system-ui" font-size="7.5">GET /posts/100</text>
      <text x="348" y="33" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="6.5">→ {{id}}</text>
      <path d="M384 23 L400 23" stroke="#475569" stroke-width="1.2" marker-end="url(#harr)"/>
      <rect x="228" y="52" width="90" height="30" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.2"/>
      <text x="273" y="66" text-anchor="middle" fill="#3b82f6" font-family="system-ui" font-size="7.5">GET /comments/{{id}}</text>
      <text x="273" y="77" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="6.5">auto-parameterized</text>
      <path d="M322 52 L322 38" stroke="#475569" stroke-width="1.2" marker-end="url(#harr)"/>
      <defs><marker id="harr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
        <polygon points="0 0, 7 2.5, 0 5" fill="#475569"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ctx.navigateToTab('workflow');
    await ctx.delay(300);
    await closeWfSamplePreviewIfOpen(ctx);
    // Clean up leftovers from a previous run (default host name + authored name)
    deleteHarImportLessonWorkflows();
    await ctx.delay(100);
  },

  cleanup: async (ctx) => {
    // Close preview modal if it's still open
    const cancelBtn = document.querySelector<HTMLElement>(WF.HAR_MODAL_CANCEL);
    if (cancelBtn) { cancelBtn.click(); await ctx.delay(200); }
    await closeWfConfigModalIfOpen(ctx);
    await cleanupWorkflowDemoRunUi(ctx);
    deleteHarImportLessonWorkflows();
    await collapseWfDemoAppSidebar(ctx);
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: Import HAR button ────────────────────────────────────────────
    {
      id: 'toolbar-btn',
      title: 'Import HAR — toolbar button',
      description:
        'Find the **Import HAR** button in the Workflow Designer toolbar — ' +
        'the download arrow icon on the right side.\n\n' +
        'Clicking it opens a native file picker where you select any `.har` file ' +
        'exported from Chrome, Firefox, or Safari DevTools.',
      highlight: WF.HAR_IMPORT_BTN,
      preAction: async (ctx) => {
        ctx.navigateToTab('workflow');
        await ctx.delay(300);
        await closeWfSamplePreviewIfOpen(ctx);
        await waitForWorkflowBridge(ctx, 5000);
      },
      action: async (ctx) => {
        await spotlightSel(ctx, WF.HAR_IMPORT_BTN, 1200);
      },
    },

    // ── Step 2: Inject fixture + preview modal ───────────────────────────────
    {
      id: 'preview-modal',
      title: 'Preview: review requests before importing',
      description:
        'The **preview modal** shows every request in the HAR file as a checkbox row.\n\n' +
        'You can uncheck static assets, error responses, or anything you don\'t want ' +
        'in the workflow before confirming.\n\n' +
        'Automatically filtered entries (OPTIONS preflights, tracking domains, duplicates) ' +
        'are removed before the modal opens.',
      highlight: WF.HAR_MODAL_ENTRY_LIST,
      preAction: async (ctx) => {
        // Inject the JSONPlaceholder fixture — opens the preview modal
        const ok = triggerHarImportWithFixture(HAR_FIXTURE, HAR_FIXTURE_FILENAME);
        if (!ok) {
          // Bridge not yet mounted — wait for it
          await waitForWorkflowBridge(ctx, 5000);
          triggerHarImportWithFixture(HAR_FIXTURE, HAR_FIXTURE_FILENAME);
        }
        await ctx.waitFor(WF.HAR_MODAL, 4000);
        await ctx.delay(400);
      },
      action: async (ctx) => {
        await spotlightSel(ctx, WF.HAR_MODAL_ENTRY_LIST, 1500);
      },
      verify: WF.HAR_MODAL,
    },

    // ── Step 3: Redacted headers ─────────────────────────────────────────────
    {
      id: 'redacted-headers',
      title: 'Sensitive headers are always redacted',
      description:
        'The warning box lists headers whose values were replaced with `{{variable}}` ' +
        'placeholders — `Authorization`, `Cookie`, `X-Api-Key`, and similar.\n\n' +
        'Credentials are **never stored** in workflow definitions. ' +
        'Empty rows for those names appear in the **Variables** panel after import — paste a real `Bearer …` token there when the API requires auth.',
      highlight: WF.HAR_REDACTED_WARNING,
      action: async (ctx) => {
        const el = document.querySelector<HTMLElement>(WF.HAR_REDACTED_WARNING);
        if (el) await spotlightSel(ctx, WF.HAR_REDACTED_WARNING, 1500);
      },
      verify: WF.HAR_MODAL,
    },

    // ── Step 4: Chain detection ──────────────────────────────────────────────
    {
      id: 'chain-detection',
      title: '⚡ Chain variables detected automatically',
      description:
        'When a value from one response JSON (like `id: 100`) matches a path segment ' +
        'in a later request, RedfireForge detects the link and shows it here.\n\n' +
        'The downstream URL becomes `/comments/{{id}}` instead of a hardcoded `/comments/100` — ' +
        'so the workflow works for any post, not just the one you recorded.',
      highlight: WF.HAR_CHAIN_SUMMARY,
      action: async (ctx) => {
        const el = document.querySelector<HTMLElement>(WF.HAR_CHAIN_SUMMARY);
        if (el) await spotlightSel(ctx, WF.HAR_CHAIN_SUMMARY, 1800);
      },
      verify: WF.HAR_CHAIN_SUMMARY,
    },

    // ── Step 5: Name + confirm import ─────────────────────────────────────────
    {
      id: 'confirm-import',
      title: 'Name it, then import',
      description:
        'The modal suggests a host-based default. Replace it with a real workflow name — ' +
        'here **JSONPlaceholder Session** — so the sidebar stays readable.\n\n' +
        'Click **Import as Workflow**. RedfireForge builds one HTTP Request node ' +
        'per checked entry, connects them in sequence, then **Fit View** frames the graph.',
      highlight: WF.HAR_WORKFLOW_NAME,
      preAction: async (ctx) => {
        await ensureHarPreviewModal(ctx);
        await ctx.delay(200);
        fillHarWorkflowNameQuiet();
      },
      action: async (ctx) => {
        await ctx.waitFor(WF.HAR_WORKFLOW_NAME, 2000);
        await spotlightSel(ctx, WF.HAR_WORKFLOW_NAME, 700);
        fillHarWorkflowNameQuiet();
        await ctx.delay(800);
        await spotlightSel(ctx, WF.HAR_MODAL_CONFIRM, 600);
        fillHarWorkflowNameQuiet();
        const btn = document.querySelector<HTMLElement>(WF.HAR_MODAL_CONFIRM);
        if (btn && !btn.hasAttribute('disabled')) {
          await ctx.click(WF.HAR_MODAL_CONFIRM);
          await ctx.delay(700);
        }
        await ctx.waitFor('.react-flow__node', 4000);
        await clickHarImportFitView(ctx);
      },
      verify: '.react-flow__node',
    },

    // ── Step 6: Console + Quick Test ─────────────────────────────────────────
    {
      id: 'quick-test',
      title: 'Open Console, then Quick Test',
      description:
        'Open the **Console** so logs stream in live, then click **▶ Quick Test**.\n\n' +
        '`{{baseUrl}}` already points at `https://jsonplaceholder.typicode.com` — a real public API — ' +
        'and `{{id}}` is extracted from the first response (`$.id` → `100`) into later URLs.\n\n' +
        '`{{authToken}}` is an **empty row in Variables** (not Initial Variables on the node). ' +
        'HAR import redacts the captured secret on purpose. JSONPlaceholder ignores Authorization, ' +
        'so leave it blank here; for a private API, paste the full `Bearer …` value in Variables once.\n\n' +
        'Watch the three HTTP nodes turn **green** and the Console fill with 200 OK lines.',
      highlight: WF.QUICK_TEST_BTN,
      preAction: async (ctx) => {
        await ensureHarImportWorkflow(ctx);
        selectWorkflowByName(HAR_IMPORT_WF_NAME);
        await collapseWfDemoAppSidebar(ctx);
        await openWfConsoleIfClosed(ctx);
      },
      action: async (ctx) => {
        selectWorkflowByName(HAR_IMPORT_WF_NAME);
        await collapseWfDemoAppSidebar(ctx);
        await openWfConsoleIfClosed(ctx);
        await ctx.delay(600);

        await spotlightSel(ctx, WF.CONSOLE_BADGE, 700);

        await spotlightSel(ctx, WF.QUICK_TEST_BTN, 1000);
        resetWorkflowRunState();
        triggerWorkflowQuickTest();
        await waitForHarImportQuickTest(ctx);

        const consolePanel = document.querySelector<HTMLElement>(WF.CONSOLE);
        if (consolePanel) await spotlightSel(ctx, WF.CONSOLE, 1500);

        const passBadge = document.querySelector<HTMLElement>('.wf-node-badge-pass, .wf-node-status-pass');
        if (passBadge) {
          const remove = showSpotlightRing(passBadge);
          await ctx.delay(1200);
          remove();
        }

        const summary = document.querySelector<HTMLElement>(WF.EXEC_SUMMARY);
        if (summary) await spotlightSel(ctx, WF.EXEC_SUMMARY, 1000);
      },
      verify: WF.CONSOLE,
    },
  ],
};
