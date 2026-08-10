/**
 * Lesson GRPC-22: grpcurl Interop, Replay & Sharing
 *
 * Teaches learners to import a grpcurl command into Studio, review the field
 * mapping, execute the imported call, and export back as a grpcurl command for
 * sharing — including understanding what gets filtered (auth tokens, PEM paths).
 *
 *   grpc22-open-modal         — Spot Import grpcurl + click → modal opens (combined intro)
 *   grpc22-paste-command      — Paste full grpcurl command (target, method, -d, -H auth, -plaintext)
 *   grpc22-review-preview     — Preview pane shows parsed fields; spot warnings block if any
 *   grpc22-import-fields      — Click Import; Studio fills target, method, metadata, body
 *   grpc22-send-call          — Execute the imported call; response arrives
 *   grpc22-history-copy       — Open History; select entry; click "Copy grpcurl"
 *   grpc22-secret-filtering   — Explain that auth token values are stripped from exported command
 */
import { GRPC } from '@shared/selectors';
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import {
  GRPC_DEMO_TARGET,
  closeGrpcSettingsDrawerQuiet,
  clearGrpcSchemaDriftQuiet,
  ensureGrpcReflected,
  guardGrpcReflectedQuiet,
  ensureGrpcStudioSubNavQuiet,
  ensureUnaryExecuted,
  grpcFirstCallCleanup,
  openGrpcHistoryPanelQuiet,
  resetGrpcConnectionSettingsQuiet,
  spotlightAndPause,
  spotlightResponseJsonContentTight,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import { closeModalByButtonQuiet } from '../modal-close-helpers';
import { clearGrpcCallHistory, dispatchGrpcCallHistoryReload } from '../../adapters';
import type { DemoActionContext } from '../../types';

// ---------------------------------------------------------------------------
// Roster entry
// ---------------------------------------------------------------------------

const GRPC22_ROSTER = getGrpcLessonRosterEntry('grpc-grpcurl')!;

// ---------------------------------------------------------------------------
// Demo fixture data
// ---------------------------------------------------------------------------

/**
 * Full grpcurl command used for the import demo.
 * Includes -plaintext, -d body, an authorization metadata header,
 * and a custom x-demo-id header so viewers can see multi-header mapping.
 */
const DEMO_GRPCURL_COMMAND =
  `grpcurl -plaintext -d '{"message":"hello from grpcurl"}' ` +
  `-H 'authorization: bearer demo-token-abc123' ` +
  `-H 'x-demo-id: lesson-22' ` +
  `${GRPC_DEMO_TARGET} echo.EchoService/Echo`;

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

async function ensureStudioNav(ctx: DemoActionContext): Promise<void> {
  await navigateToGrpcStudio(ctx);
  await closeGrpcSettingsDrawerQuiet(ctx);
  await ensureGrpcStudioSubNavQuiet(ctx);
}

/** Close the Import grpcurl modal quietly if it happens to be open. */
async function closeImportModalQuiet(ctx: DemoActionContext): Promise<void> {
  await closeModalByButtonQuiet(ctx, GRPC.IMPORT_GRPCURL_CANCEL, 200);
}

/**
 * Quietly ensure the modal is open and the textarea has the demo command.
 * Used in preActions for steps that build on an already-pasted command.
 */
async function ensureCommandPastedQuiet(ctx: DemoActionContext): Promise<void> {
  await ensureStudioNav(ctx);
  if (!document.querySelector(GRPC.IMPORT_GRPCURL_MODAL)) {
    const importBtn = document.querySelector<HTMLButtonElement>(GRPC.IMPORT_GRPCURL_BTN);
    if (importBtn) {
      importBtn.click();
      try { await ctx.waitFor(GRPC.IMPORT_GRPCURL_MODAL, 3_000); } catch { /* no-op */ }
      await ctx.delay(200);
    }
  }
  const textarea = document.querySelector<HTMLTextAreaElement>(GRPC.IMPORT_GRPCURL_TEXTAREA);
  if (textarea && textarea.value.trim() !== DEMO_GRPCURL_COMMAND) {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    nativeSet?.set?.call(textarea, DEMO_GRPCURL_COMMAND);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await ctx.delay(400);
  }
}

/** Submit the pasted grpcurl command and wait for reflection to finish. */
async function ensureGrpcurlImportedQuiet(ctx: DemoActionContext): Promise<void> {
  // Skip the full modal flow if the import has already been done in this session.
  if (document.querySelector(GRPC.EXPLORER_TREE) && !document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)) {
    return;
  }

  await ensureCommandPastedQuiet(ctx);

  if (document.querySelector(GRPC.IMPORT_GRPCURL_MODAL)) {
    const submitBtn = document.querySelector<HTMLButtonElement>(GRPC.IMPORT_GRPCURL_SUBMIT);
    if (submitBtn && !submitBtn.disabled) {
      submitBtn.click();
      for (let i = 0; i < 12; i++) {
        await ctx.delay(250);
        if (!document.querySelector(GRPC.IMPORT_GRPCURL_MODAL)) break;
      }
    }
  }

  // Product auto-reflects after plain grpcurl import; fall back to manual Reflect for resilience.
  try {
    await ctx.waitFor(GRPC.EXPLORER_TREE, 8_000);
  } catch {
    await ensureGrpcReflected(ctx);
  }
  await clearGrpcSchemaDriftQuiet(ctx);
  await ctx.delay(300);
}

/** Ensure the imported call has been sent (target set + executed). */
async function ensureImportedCallExecuted(ctx: DemoActionContext): Promise<void> {
  await ensureStudioNav(ctx);
  await closeImportModalQuiet(ctx);
  await ensureGrpcurlImportedQuiet(ctx);
  await ensureUnaryExecuted(ctx, 'hello from grpcurl');
}

// ---------------------------------------------------------------------------
// Lesson definition
// ---------------------------------------------------------------------------

export const grpcGrpcurlLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC22_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  // Avoid add-tab → rename-"demo" flashes before step 1 Reading.
  skipStudioTabIsolation: true,
  description:
    'Import a grpcurl command directly into gRPC Studio — target, method, metadata, ' +
    'and body are populated automatically. Execute the call, then export it back as ' +
    'a grpcurl command via History — the complete command, including all headers and ' +
    'the auth token, is copied to the clipboard ready to run in a terminal.',

  setup: async (ctx) => {
    // Quiet land on Studio — no normalize/rename/modal tour before Import highlight.
    await navigateToGrpcStudio(ctx);
    await closeGrpcSettingsDrawerQuiet(ctx);
    await ensureGrpcStudioSubNavQuiet(ctx);
    await resetGrpcConnectionSettingsQuiet(ctx);
    await clearGrpcSchemaDriftQuiet(ctx);
    // Full clear so step 7 shows only the single call made during this lesson.
    try { await clearGrpcCallHistory(); } catch { /* best-effort */ }
    dispatchGrpcCallHistoryReload();
  },
  cleanup: grpcFirstCallCleanup,

  grpc: buildGrpcContractMetaFromRoster(GRPC22_ROSTER),

  concept: {
    title: 'grpcurl Interop, Replay & Sharing',
    body: `**grpcurl** is the standard CLI tool for gRPC — developers share these one-liners in Slack, READMEs, and bug reports. Manually translating every flag into Studio fields is tedious and error-prone.

**RedfireForge solves this with bidirectional interop:**

| Direction | How |
|---|---|
| grpcurl → Studio | **Import grpcurl** button on the connection bar — parses flags into target, method, metadata, body, TLS mode |
| Studio → grpcurl | **Copy grpcurl** in History (and Collections) — exports the call as a ready-to-run terminal command |

**Field mapping on import:**

| grpcurl flag | Studio field |
|---|---|
| Last positional arg (\`host:port service/method\`) | Target + method selection |
| \`-d '{"…"}'\` | Request body (Form Input) |
| \`-H 'key: value'\` | Metadata header row |
| \`-plaintext\` | TLS mode → Plaintext |
| \`-cacert / -cert / -key\` | TLS file paths (never PEM content) |
| Unrecognized flags | Warnings panel (import still proceeds) |

**Exporting calls as grpcurl:**
The **Copy grpcurl** button in History (and Collections) produces a complete, ready-to-run command — all headers, including auth tokens, are preserved exactly as sent. This makes the export immediately usable in a terminal or shareable with a teammate who has the same credentials. When pasting into a public channel or PR, replace the token value with a placeholder before sharing.

**What you will do in this lesson:**
1. **Open** Import grpcurl from the connection bar and see the paste modal.
2. **Paste** a full grpcurl command with a body, an auth header, and a custom header.
3. **Review** the parsed-field preview before committing.
4. **Import** — watch Studio fill target, method, metadata rows, and body automatically.
5. **Send** the imported call and confirm the response arrives.
6. **Open** History, select the entry, and click **Copy grpcurl**.
7. **Inspect** the exported command — confirm all headers including the auth token are copied exactly as sent.`,

    keyTerms: [
      {
        term: 'grpcurl',
        definition:
          'A popular open-source CLI for making gRPC calls. Commands use flags like `-d` (body), `-H` (header), `-plaintext` (no TLS), and end with `host:port service/Method`.',
      },
      {
        term: 'Import grpcurl',
        definition:
          'The button on the gRPC Studio connection bar that opens a text area for pasting a grpcurl command. Studio parses the flags and populates all matching fields in the active tab.',
      },
      {
        term: 'Field mapping',
        definition:
          'The translation table from grpcurl flags to Studio fields: `-d` → body, `-H` → metadata rows, `-plaintext` → TLS mode, `-cacert/-cert/-key` → TLS file path hints.',
      },
      {
        term: 'Copy grpcurl export',
        definition:
          'The exported grpcurl command contains all headers exactly as sent, including auth token values. The command is immediately runnable — replace the token with a placeholder before sharing in public channels or PRs.',
      },
      {
        term: 'Copy grpcurl',
        definition:
          'The button in History (and Collections) that generates a ready-to-run grpcurl command from a saved call and copies it to the clipboard.',
      },
    ],

    diagram: `<svg viewBox="0 0 640 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="grpcurl import/export flow diagram" font-family="monospace,sans-serif">
  <!-- Background -->
  <rect width="640" height="210" rx="10" fill="#0f172a"/>

  <!-- grpcurl command box (left) -->
  <rect x="16" y="30" width="170" height="70" rx="7" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
  <text x="101" y="52" text-anchor="middle" font-size="10" fill="#94a3b8">grpcurl command</text>
  <text x="26" y="69" font-size="8.5" fill="#6ee7b7">grpcurl -plaintext \\</text>
  <text x="26" y="81" font-size="8.5" fill="#6ee7b7">  -d '{"message":"hi"}' \\</text>
  <text x="26" y="93" font-size="8.5" fill="#6ee7b7">  -H 'auth: bearer X' \\</text>

  <!-- Arrow: grpcurl → Import -->
  <path d="M186 65 L232 65" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="209" y="58" text-anchor="middle" font-size="8" fill="#60a5fa">Import</text>

  <!-- Studio fields box (center) -->
  <rect x="232" y="20" width="176" height="130" rx="7" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
  <text x="320" y="40" text-anchor="middle" font-size="10" font-weight="bold" fill="#93c5fd">gRPC Studio</text>
  <text x="248" y="58" font-size="8.5" fill="#94a3b8">Target    </text>
  <text x="300" y="58" font-size="8.5" fill="#e2e8f0">localhost:50051</text>
  <text x="248" y="72" font-size="8.5" fill="#94a3b8">Method    </text>
  <text x="300" y="72" font-size="8.5" fill="#e2e8f0">Echo</text>
  <text x="248" y="86" font-size="8.5" fill="#94a3b8">Metadata  </text>
  <text x="300" y="86" font-size="8.5" fill="#e2e8f0">auth: bearer X</text>
  <text x="248" y="100" font-size="8.5" fill="#94a3b8">Body      </text>
  <text x="300" y="100" font-size="8.5" fill="#e2e8f0">&#123;"message":"hi"&#125;</text>
  <text x="248" y="114" font-size="8.5" fill="#94a3b8">TLS       </text>
  <text x="300" y="114" font-size="8.5" fill="#e2e8f0">Plaintext</text>
  <!-- Send button -->
  <rect x="272" y="125" width="96" height="18" rx="4" fill="#2563eb"/>
  <text x="320" y="137" text-anchor="middle" font-size="9" fill="#fff">▶ Send</text>

  <!-- Arrow: Studio → History -->
  <path d="M408 90 L454 90" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr)"/>
  <text x="431" y="83" text-anchor="middle" font-size="8" fill="#60a5fa">logged</text>

  <!-- History box (right) -->
  <rect x="454" y="30" width="168" height="120" rx="7" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
  <text x="538" y="50" text-anchor="middle" font-size="10" fill="#94a3b8">History</text>
  <rect x="466" y="58" width="144" height="22" rx="4" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="538" y="73" text-anchor="middle" font-size="8.5" fill="#e2e8f0">Echo — 200 OK · 12ms</text>
  <!-- Copy grpcurl button in history detail -->
  <rect x="476" y="90" width="124" height="18" rx="4" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1"/>
  <text x="538" y="102" text-anchor="middle" font-size="8.5" fill="#93c5fd">Copy grpcurl</text>

  <!-- Arrow pointing down to secret-filtered export -->
  <path d="M538 108 L538 145" stroke="#f59e0b" stroke-width="1.5" marker-end="url(#arrY)"/>

  <!-- Secret-filtered command output -->
  <rect x="454" y="145" width="168" height="52" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1"/>
  <text x="538" y="161" text-anchor="middle" font-size="8.5" fill="#fbbf24">Exported command</text>
  <text x="464" y="174" font-size="7.5" fill="#6ee7b7">grpcurl -plaintext \\</text>
  <text x="464" y="185" font-size="7.5" fill="#6ee7b7">  -H 'auth: bearer demo-token-abc123'</text>

  <!-- Legend -->
  <rect x="16" y="165" width="10" height="10" rx="2" fill="#22c55e"/>
  <text x="32" y="174" font-size="8.5" fill="#94a3b8">All headers preserved on export</text>

  <!-- Arrow defs -->
  <defs>
    <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="arrY" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
      <path d="M0,0 L7,3 L0,6 Z" fill="#f59e0b"/>
    </marker>
  </defs>
</svg>`,
  },

  steps: [
    // -----------------------------------------------------------------------
    // Step 1 — Spot Import grpcurl + open the paste modal (was intro + open)
    // -----------------------------------------------------------------------
    {
      id: 'grpc22-open-modal',
      title: 'Open Import grpcurl',
      description:
        'Developers share gRPC calls as **grpcurl** one-liners — in Slack, READMEs, and bug reports. ' +
        'Manually recreating all the flags in Studio is tedious.\n\n' +
        'Click **Import grpcurl** on the connection bar. A modal opens with a large text area — ' +
        'paste any grpcurl command here and Studio parses it live, showing a preview of the fields ' +
        'it will populate before you commit.\n\n' +
        'A matching **Copy grpcurl** button lives in History for the export side of the round-trip.',
      highlight: GRPC.IMPORT_GRPCURL_BTN,
      pauseAfter: true,
      preAction: async (ctx) => {
        // Setup already lands on Studio. Keep guard minimal — no visible prep tour.
        await ensureStudioNav(ctx);
        await closeImportModalQuiet(ctx);
      },
      action: async (ctx) => {
        // Reading already rings Import grpcurl — click once, then hold on the modal.
        await ctx.click(GRPC.IMPORT_GRPCURL_BTN);

        try {
          await ctx.waitFor(GRPC.IMPORT_GRPCURL_MODAL, 4_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(700);

        // One modal beat, then the textarea — avoid bouncing back to the connection bar.
        await spotlightAndPause(ctx, GRPC.IMPORT_GRPCURL_MODAL, 1_000);
        await spotlightAndPause(ctx, GRPC.IMPORT_GRPCURL_TEXTAREA, 1_100);
      },
      verify: GRPC.IMPORT_GRPCURL_MODAL,
    },

    // -----------------------------------------------------------------------
    // Step 2 — Paste the grpcurl command
    // -----------------------------------------------------------------------
    {
      id: 'grpc22-paste-command',
      title: 'Paste the grpcurl Command',
      description:
        'Paste a full grpcurl command into the text area:\n\n' +
        '```\n' +
        `grpcurl -plaintext \\\n` +
        `  -d '{"message":"hello from grpcurl"}' \\\n` +
        `  -H 'authorization: bearer demo-token-abc123' \\\n` +
        `  -H 'x-demo-id: lesson-22' \\\n` +
        `  ${GRPC_DEMO_TARGET} echo.EchoService/Echo\n` +
        '```\n\n' +
        'As soon as you stop typing, the **preview pane** appears below the text area. ' +
        'It lists each flag next to the Studio field it maps to — target, method, body, ' +
        'and every `-H` header. The **Import** button activates once parsing succeeds.',
      highlight: GRPC.IMPORT_GRPCURL_TEXTAREA,
      preAction: ensureCommandPastedQuiet,
      action: async (ctx) => {
        // Spotlight the textarea — viewer knows where to look.
        await spotlightAndPause(ctx, GRPC.IMPORT_GRPCURL_TEXTAREA, 700);

        // Fill the textarea (simulates paste).
        await ctx.fill(GRPC.IMPORT_GRPCURL_TEXTAREA, DEMO_GRPCURL_COMMAND);
        await ctx.delay(500);

        // Wait for the preview to appear.
        try {
          await ctx.waitFor(GRPC.IMPORT_GRPCURL_PREVIEW, 3_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(500);

        // Spotlight the full modal with the filled command so viewer can read it.
        await spotlightAndPause(ctx, GRPC.IMPORT_GRPCURL_MODAL, 900);
      },
      verify: GRPC.IMPORT_GRPCURL_TEXTAREA,
    },

    // -----------------------------------------------------------------------
    // Step 3 — Review the parsed-field preview (modal stays open)
    // -----------------------------------------------------------------------
    {
      id: 'grpc22-review-preview',
      title: 'Review the Parsed Preview',
      description:
        'The **preview pane** below the text area shows exactly how each flag maps to a Studio field:\n\n' +
        '- **Target** ← positional `host:port` argument\n' +
        '- **Method** ← `service/Method` positional argument\n' +
        '- **Body** ← `-d \'{"message":"hello from grpcurl"}\'\n' +
        '- **Metadata: authorization** ← first `-H` header\n' +
        '- **Metadata: x-demo-id** ← second `-H` header\n' +
        '- **TLS mode** ← `-plaintext` flag\n\n' +
        'If you pasted a command with unsupported flags, a **warnings list** appears below the preview — ' +
        'Studio still imports everything it can. Leave the modal open — the next step clicks **Import**.',
      // Keep the reading ring on the preview inside the modal — never on Studio
      // chrome behind it (target / status badge would look like stray highlights).
      // Reading already rings the preview — do not re-spotlight it in action.
      highlight: GRPC.IMPORT_GRPCURL_PREVIEW,
      pauseAfter: true,
      preAction: ensureCommandPastedQuiet,
      action: async (ctx) => {
        // Hold on the reading ring so the viewer can read the mapping list.
        // Only move the ring if a warnings block is present.
        await ctx.delay(1_800);
        if (document.querySelector(GRPC.IMPORT_GRPCURL_WARNINGS)) {
          await spotlightAndPause(ctx, GRPC.IMPORT_GRPCURL_WARNINGS, 900);
        }
      },
      verify: GRPC.IMPORT_GRPCURL_PREVIEW,
    },

    // -----------------------------------------------------------------------
    // Step 4 — Click Import; modal closes; Studio fields populate
    // -----------------------------------------------------------------------
    {
      id: 'grpc22-import-fields',
      title: 'Import — Studio Fields Populate',
      pauseAfter: true,
      description:
        'Click **Import to Studio**. The modal closes and Studio instantly populates the active tab:\n\n' +
        '- **Target input** shows `localhost:50051`\n' +
        '- **Method** is pre-selected: `echo.EchoService / Echo`\n' +
        '- **Metadata** tab has two rows — `authorization` and `x-demo-id`\n' +
        '- **Form Input** body shows `{"message":"hello from grpcurl"}`\n\n' +
        'Studio also **reflects services automatically** for plain grpcurl commands (no `-proto` flag) so the method binds immediately — no drift banner.',
      // Modal is still open during Reading — spotlight Import, not the target behind it.
      highlight: GRPC.IMPORT_GRPCURL_SUBMIT,
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        const modalOpen = !!document.querySelector(GRPC.IMPORT_GRPCURL_MODAL);
        // Already imported and modal dismissed — nothing to prepare.
        if (
          !modalOpen
          && document.querySelector(GRPC.EXPLORER_TREE)
          && !document.querySelector(GRPC.SCHEMA_DRIFT_BANNER)
        ) {
          return;
        }
        // Keep / reopen the modal with the command so the action can click Import.
        await ensureCommandPastedQuiet(ctx);
      },
      action: async (ctx) => {
        const modalStillOpen = !!document.querySelector(GRPC.IMPORT_GRPCURL_MODAL);
        if (modalStillOpen) {
          await spotlightAndPause(ctx, GRPC.IMPORT_GRPCURL_SUBMIT, 900);
          await ctx.click(GRPC.IMPORT_GRPCURL_SUBMIT);
          await ctx.delay(400);

          // Wait for the product to dismiss the modal (up to ~4s).
          for (let i = 0; i < 16; i++) {
            await ctx.delay(250);
            if (!document.querySelector(GRPC.IMPORT_GRPCURL_MODAL)) break;
          }
          // Belt: never leave the modal covering Studio for the field tour.
          if (document.querySelector(GRPC.IMPORT_GRPCURL_MODAL)) {
            await closeImportModalQuiet(ctx);
          }
          await ctx.delay(600);
        }

        // Plain grpcurl import auto-triggers reflection — wait for the service tree.
        try {
          await ctx.waitFor(GRPC.EXPLORER_TREE, 12_000);
        } catch {
          await ensureGrpcReflected(ctx);
        }

        // Auto-reflection doesn't set the lesson reflected flag; bind descriptor
        // key so clearGrpcSchemaDriftQuiet can dismiss "No descriptor loaded".
        await guardGrpcReflectedQuiet(ctx);
        await clearGrpcSchemaDriftQuiet(ctx);
        await ctx.delay(400);

        // Modal must be gone before any Studio chrome spotlight (avoids rings
        // on target/status behind an open dialog).
        if (document.querySelector(GRPC.IMPORT_GRPCURL_MODAL)) {
          await closeImportModalQuiet(ctx);
          await ctx.delay(400);
        }

        // Tight post-import tour — one beat per outcome, no connection-bar +
        // target double-ring.
        await spotlightAndPause(ctx, GRPC.TARGET_INPUT, 1_000);

        if (document.querySelector(GRPC.CALL_METHOD_NAME)) {
          await spotlightAndPause(ctx, GRPC.CALL_METHOD_NAME, 900);
        }

        const metaTab = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_METADATA);
        if (metaTab) {
          await spotlightAndPause(ctx, GRPC.REQUEST_TAB_METADATA, 700);
          metaTab.click();
          await ctx.delay(500);
          await spotlightAndPause(ctx, GRPC.METADATA_EDITOR, 1_100);
        }

        const formTab = document.querySelector<HTMLButtonElement>(GRPC.REQUEST_TAB_FORM);
        if (formTab) {
          await spotlightAndPause(ctx, GRPC.REQUEST_TAB_FORM, 600);
          formTab.click();
          await ctx.delay(400);
          await spotlightAndPause(ctx, GRPC.REQUEST_FORM_SCROLL, 1_000);
        }
      },
      verify: GRPC.TARGET_INPUT,
    },

    // -----------------------------------------------------------------------
    // Step 5 — Execute the imported call
    // -----------------------------------------------------------------------
    {
      id: 'grpc22-send-call',
      title: 'Execute the Imported Call',
      pauseAfter: true,
      description:
        'The call is fully configured from the import. Click **Send** and watch the response arrive.\n\n' +
        'The response panel shows:\n' +
        '- **Status** — OK (0) for a successful echo\n' +
        '- **Body** — `{"message":"hello from grpcurl"}` echoed back\n' +
        '- **Duration** — how long the round-trip took\n\n' +
        'History logs this entry automatically. You\'ll use it in the next step to export back to grpcurl.',
      preAction: async (ctx) => {
        await ensureStudioNav(ctx);
        await closeImportModalQuiet(ctx);
        // Only ensure the import is done — the action is what sends the call
        // visibly to the viewer. Calling ensureImportedCallExecuted here would
        // fire a silent pre-send that duplicates the action's own Send click.
        await ensureGrpcurlImportedQuiet(ctx);
      },
      action: async (ctx) => {
        // Spotlight the Send button for the viewer.
        await spotlightAndPause(ctx, GRPC.SEND_BTN, 900);
        await ctx.click(GRPC.SEND_BTN);

        // Wait for the response panel to appear.
        try {
          await ctx.waitFor(GRPC.RESPONSE_BODY, 10_000);
        } catch {
          await ctx.delay(800);
        }
        await ctx.delay(600);

        // Spotlight the response status + body.
        if (document.querySelector(GRPC.RESPONSE_STATUS)) {
          await spotlightAndPause(ctx, GRPC.RESPONSE_STATUS, 800);
        }
        await spotlightResponseJsonContentTight(ctx, 1_000);

        // Note the history badge that appeared.
        if (document.querySelector(GRPC.SUB_NAV_HISTORY_BADGE)) {
          await spotlightAndPause(ctx, GRPC.SUB_NAV_HISTORY_BADGE, 800);
        }
      },
      verify: GRPC.RESPONSE_BODY,
    },

    // -----------------------------------------------------------------------
    // Step 6 — Open History; click Copy grpcurl
    // -----------------------------------------------------------------------
    {
      id: 'grpc22-history-copy',
      title: 'Copy grpcurl from History',
      description:
        'Open the **History** tab. The call you just made is logged there — target, method, timestamp, and status.\n\n' +
        'Click the entry to expand the detail panel. In the detail header you\'ll see two action buttons: ' +
        '**Copy grpcurl** and **Replay**.\n\n' +
        'Click **Copy grpcurl** — the command goes straight to your clipboard, ready to paste into a terminal ' +
        'or share with a teammate.',
      // Reading starts on Studio — ring History sub-nav (Copy btn is not mounted yet).
      highlight: GRPC.SUB_NAV_HISTORY,
      preAction: async (ctx) => {
        await ensureImportedCallExecuted(ctx);
      },
      action: async (ctx) => {
        // Reading already rings History — open it without a full-panel spotlight.
        await ctx.click(GRPC.SUB_NAV_HISTORY);
        try {
          await ctx.waitFor(GRPC.HISTORY_PANEL, 3_000);
        } catch {
          await ctx.delay(400);
        }
        await ctx.delay(500);

        try {
          await ctx.waitFor(GRPC.HISTORY_ENTRY_ROW, 3_000);
        } catch {
          await ctx.delay(400);
        }
        if (document.querySelector(GRPC.HISTORY_ENTRY_ROW)) {
          await ctx.click(GRPC.HISTORY_ENTRY_ROW);
          await ctx.delay(500);
        }

        try {
          await ctx.waitFor(GRPC.HISTORY_COPY_GRPCURL, 3_000);
        } catch {
          await ctx.delay(300);
        }

        // Only the action buttons — never HISTORY_PANEL / HISTORY_DETAIL shells
        // (those draw huge rings over the list, Outcome nav, and connection chrome).
        await spotlightAndPause(ctx, GRPC.HISTORY_COPY_GRPCURL, 1_200);
        if (document.querySelector(GRPC.HISTORY_COPY_GRPCURL)) {
          await ctx.click(GRPC.HISTORY_COPY_GRPCURL);
          await ctx.delay(700);
        }
        if (document.querySelector(GRPC.HISTORY_REPLAY_BTN)) {
          await spotlightAndPause(ctx, GRPC.HISTORY_REPLAY_BTN, 700);
        }
        await spotlightAndPause(ctx, GRPC.HISTORY_COPY_GRPCURL, 800);
      },
      verify: GRPC.HISTORY_COPY_GRPCURL,
    },

    // -----------------------------------------------------------------------
    // Step 7 — Secret filtering
    // -----------------------------------------------------------------------
    {
      id: 'grpc22-secret-filtering',
      title: 'What the Exported Command Contains',
      description:
        'The grpcurl command was just copied to your clipboard. It contains the complete call — ' +
        'exactly as sent:\n\n' +
        '```\n' +
        'grpcurl -plaintext \\\n' +
        "  -H 'authorization: bearer demo-token-abc123' \\\n" +
        "  -H 'x-demo-id: lesson-22' \\\n" +
        "  -d '{\"message\":\"hello from grpcurl\"}' \\\n" +
        '  localhost:50051 echo.EchoService/Echo\n' +
        '```\n\n' +
        'Both metadata headers — including the bearer token — are preserved exactly as sent. ' +
        'The command is immediately runnable in a terminal.\n\n' +
        '**When sharing:** if you paste this into Slack, a PR, or a README, replace the token ' +
        'value with a placeholder (e.g. `bearer <your-token>`) before sharing publicly.\n\n' +
        'The same **Copy grpcurl** button is also available in the **Collections** panel for any saved call.',
      highlight: GRPC.HISTORY_COPY_GRPCURL,
      preAction: async (ctx) => {
        await ensureImportedCallExecuted(ctx);
        await openGrpcHistoryPanelQuiet(ctx);
        // Ensure an entry is selected so the detail pane is visible.
        if (!document.querySelector(GRPC.HISTORY_COPY_GRPCURL)) {
          try { await ctx.waitFor(GRPC.HISTORY_ENTRY_ROW, 3_000); } catch { /* no-op */ }
          const row = document.querySelector<HTMLElement>(GRPC.HISTORY_ENTRY_ROW);
          if (row) { row.click(); await ctx.delay(300); }
        }
      },
      action: async (ctx) => {
        // Keep the ring on the small export controls — no panel/detail shells.
        await spotlightAndPause(ctx, GRPC.HISTORY_COPY_GRPCURL, 1_200);
        if (document.querySelector(GRPC.HISTORY_REPLAY_BTN)) {
          await spotlightAndPause(ctx, GRPC.HISTORY_REPLAY_BTN, 800);
        }
        await spotlightAndPause(ctx, GRPC.HISTORY_COPY_GRPCURL, 900);
      },
      verify: GRPC.HISTORY_COPY_GRPCURL,
    },
  ],
};
