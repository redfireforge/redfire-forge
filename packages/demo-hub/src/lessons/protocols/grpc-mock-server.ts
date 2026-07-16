/**
 * Lesson GRPC-13: Mocking gRPC APIs: Rules & Network Listener
 *
 * Teaches learners to build predicate-based mock rules in the visual Builder,
 * explore Builder UX (collapse/expand, search, drag-to-reorder, predicate
 * summary, conflict detection, inline dry-run tester), start the in-process
 * mock runtime, verify that the correct rule fires from the Studio call panel,
 * export rules via the syntax-highlighted JSON editor, generate rule stubs
 * from a loaded proto descriptor, and understand the Network Listener for
 * external gRPC clients.
 *
 *   grpc13-intro            — Advanced → Mock server; tour Builder / JSON / Runtime tabs
 *   grpc13-rule-ping        — Add "Ping match" rule: body_path_equals message=ping → pong OK
 *   grpc13-rule-fallback    — Add "Fallback" rule: body_path_exists message → INTERNAL
 *   grpc13-builder-ux       — Collapse/expand, predicate summary, search bar, drag-to-reorder
 *   grpc13-dry-run          — Inline dry-run tester: fill context, evaluate rule in isolation
 *   grpc13-latency          — Runtime tab: set global default latency 100ms + jitter 20ms
 *   grpc13-start            — Start mock runtime; spotlight Running status
 *   grpc13-test-ping        — Studio: send message=ping; mock returns {message:"pong"}
 *   grpc13-test-fallback    — Studio: send message=other; fallback fires with INTERNAL error
 *   grpc13-json-highlight   — JSON tab: syntax-highlighted editor, edit live, Copy rules JSON
 *   grpc13-proto-stubs      — Generate from proto: auto-create rule stubs from loaded descriptor
 *   grpc13-network-listen   — Network Listener & external clients (overview)
 */
import {
  buildGrpcLessonShellFromRoster,
  buildGrpcContractMetaFromRoster,
  getGrpcLessonRosterEntry,
  type GrpcDemoLesson,
} from './grpc-lesson-contract';
import {
  closeGrpcSettingsDrawerQuiet,
  clearGrpcSchemaDriftQuiet,
  ensureGrpcReflected,
  ensureGrpcStudioSubNavQuiet,
  grpcFirstCallCleanup,
  grpcFirstCallSetup,
} from './grpc-lesson-helpers';
import { navigateToGrpcStudio } from '../env-manager-lesson-helpers';
import { navigateToMockServerPanelQuiet, stopMockQuiet } from './grpc-mock-server-helpers';
import { grpcMockServerSteps } from './grpc-mock-server-steps';

const GRPC13_ROSTER = getGrpcLessonRosterEntry('grpc-mock-server')!;

export const grpcMockServerLesson: GrpcDemoLesson = {
  ...buildGrpcLessonShellFromRoster(GRPC13_ROSTER),
  domainId: 'protocols',
  category: 'grpc',
  description:
    'Build predicate-based mock rules in the visual Builder, explore collapse/expand, search, ' +
    'drag-to-reorder, and inline dry-run testing, start the in-process mock runtime, verify ' +
    'that the correct rule fires from the Studio call panel, edit rules in the syntax-highlighted ' +
    'JSON editor, generate rule stubs from a loaded proto descriptor, and export the rule set ' +
    'as portable JSON for use in CI or on other machines.',
  concept: {
    title: 'Mocking gRPC APIs: Rules & Network Listener',
    body:
      'gRPC Studio\'s **Mock server** panel lets you define **predicate-based rules** that ' +
      'intercept outbound calls and return canned responses — no real server required.\n\n' +
      'Rules have two parts:\n' +
      '1. **Predicate** — a condition on the request (body path equals/exists, method, metadata key)\n' +
      '2. **Response** — a JSON body, gRPC status code, and optional error message\n\n' +
      'Rules are evaluated in **priority order** (higher priority first); the first matching rule wins. ' +
      'Global **latency simulation** adds a configurable delay to all responses.\n\n' +
      'The Builder provides a rich UX: **collapse/expand** with predicate summaries, ' +
      '**search and filter** across rule names and predicates, **drag-to-reorder** rules, ' +
      '**inline dry-run tester** to evaluate a rule in isolation, **conflict detection** badges, ' +
      'and **hover actions** (Duplicate, Delete, Test) that fade in on each rule card.\n\n' +
      'The **JSON tab** features a **syntax-highlighted editor** that color-codes keys, strings, ' +
      'numbers, booleans, and nulls — making it easy to scan and edit large rule sets. ' +
      'When a proto descriptor is loaded, the **⚙ Generate from proto** button auto-creates one ' +
      'rule stub per RPC method with scaffold response bodies.\n\n' +
      'The mock intercepts calls in-process — the real server is bypassed for matched calls. ' +
      'Enable the **Network Listener** (Runtime tab → Expose network endpoint) to also bind a ' +
      'real TCP port so external gRPC clients can connect directly. ' +
      'This requires the web companion server (`npm run server`) in web mode, ' +
      'or is always available in the Tauri desktop app.',
    keyTerms: [
      {
        term: 'Predicate',
        definition:
          'A condition evaluated against each incoming call. Types include body-path-equals, body-path-exists, method match, and metadata-key match. The first rule whose predicate matches wins.',
      },
      {
        term: 'Priority order',
        definition:
          'Rules are evaluated top-to-bottom. Drag-to-reorder changes priority. A catch-all fallback rule at the bottom ensures no call goes unmatched.',
      },
      {
        term: 'Latency simulation',
        definition:
          'A global delay (in ms) applied to every mock response. Simulates network or processing latency so downstream code exercises timeout and retry paths.',
      },
      {
        term: 'Dry-run tester',
        definition:
          'An inline evaluator on each rule card. Paste a sample request body, click Test, and see whether the predicate matches — without starting the mock runtime.',
      },
      {
        term: 'Network Listener',
        definition:
          'A real TCP gRPC server that binds to a local port (e.g. :50099). External tools like grpcurl or other microservices can connect to it, not just Studio\'s internal transport.',
      },
    ],
    diagram: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 400" style="display:block;width:100%;height:auto;font-family:system-ui,sans-serif">
  <defs>
    <marker id="grpc13-arr" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#3b82f6"/>
    </marker>
    <marker id="grpc13-arr-g" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#22c55e"/>
    </marker>
    <marker id="grpc13-arr-r" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#ef4444"/>
    </marker>
    <marker id="grpc13-arr-y" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M1,1 L6,3.5 L1,6 Z" fill="#fbbf24"/>
    </marker>
  </defs>

  <!-- Background -->
  <rect width="700" height="400" rx="10" fill="#0d1520"/>

  <!-- Title -->
  <text x="350" y="28" text-anchor="middle" font-size="13" fill="#e2e8f0" font-weight="600">Mock Server Architecture</text>

  <!-- ── Left: Studio Call ── -->
  <rect x="20" y="55" width="140" height="70" rx="6" fill="#0f172a" stroke="#3b82f6" stroke-width="1.2"/>
  <text x="90" y="78" text-anchor="middle" font-size="10" fill="#93c5fd" font-weight="600">📡 Studio Call</text>
  <text x="90" y="96" text-anchor="middle" font-size="8" fill="#a8b8cc">echo.EchoService/Echo</text>
  <text x="90" y="110" text-anchor="middle" font-family="monospace" font-size="7.5" fill="#64748b">{"message":"ping"}</text>

  <!-- Arrow: call → mock interceptor -->
  <line x1="160" y1="90" x2="210" y2="90" stroke="#3b82f6" stroke-width="1.4" marker-end="url(#grpc13-arr)"/>

  <!-- ── Center: Mock Interceptor ── -->
  <rect x="215" y="42" width="260" height="180" rx="8" fill="#0f172a" stroke="#fbbf24" stroke-width="1.4"/>
  <text x="345" y="62" text-anchor="middle" font-size="11" fill="#fbbf24" font-weight="600">🛡 Mock Interceptor</text>

  <!-- Rule 1 — Ping match -->
  <rect x="228" y="75" width="234" height="42" rx="4" fill="#1e293b" stroke="#22c55e" stroke-width="1"/>
  <text x="238" y="91" font-size="8.5" fill="#4ade80" font-weight="600">Rule 1 — Ping match</text>
  <text x="238" y="105" font-size="7.5" fill="#a8b8cc">body.message == "ping"  →  {"message":"pong"}  OK</text>
  <rect x="430" y="80" width="26" height="14" rx="7" fill="#1c3a2a" stroke="#22c55e" stroke-width="0.7"/>
  <text x="443" y="90" text-anchor="middle" font-size="7" fill="#22c55e">✓</text>

  <!-- Rule 2 — Fallback -->
  <rect x="228" y="125" width="234" height="42" rx="4" fill="#1e293b" stroke="#ef4444" stroke-width="1"/>
  <text x="238" y="141" font-size="8.5" fill="#f87171" font-weight="600">Rule 2 — Fallback</text>
  <text x="238" y="155" font-size="7.5" fill="#a8b8cc">body.message exists  →  INTERNAL (13)  no body</text>
  <rect x="430" y="130" width="26" height="14" rx="7" fill="#2a1c1c" stroke="#ef4444" stroke-width="0.7"/>
  <text x="443" y="140" text-anchor="middle" font-size="7" fill="#ef4444">✗</text>

  <!-- Latency badge -->
  <rect x="228" y="178" width="120" height="18" rx="9" fill="#1e293b" stroke="#fbbf24" stroke-width="0.8"/>
  <text x="288" y="190" text-anchor="middle" font-size="7.5" fill="#fbbf24">⏱ +100ms latency</text>

  <!-- Priority arrow -->
  <line x1="470" y1="90" x2="470" y2="148" stroke="#64748b" stroke-width="1" stroke-dasharray="3 2" marker-end="url(#grpc13-arr-y)"/>
  <text x="480" y="122" font-size="7" fill="#64748b">priority ▼</text>

  <!-- Arrow: match → response -->
  <line x1="345" y1="222" x2="345" y2="258" stroke="#22c55e" stroke-width="1.4" marker-end="url(#grpc13-arr-g)"/>

  <!-- ── Bottom center: Response ── -->
  <rect x="270" y="262" width="150" height="50" rx="6" fill="#0f172a" stroke="#22c55e" stroke-width="1.2"/>
  <text x="345" y="282" text-anchor="middle" font-size="9" fill="#4ade80" font-weight="600">✅ Mock Response</text>
  <text x="345" y="298" text-anchor="middle" font-family="monospace" font-size="8" fill="#a8b8cc">{"message":"pong"}</text>

  <!-- Arrow: response → Studio -->
  <line x1="270" y1="287" x2="90" y2="287" stroke="#22c55e" stroke-width="1" stroke-dasharray="4 3"/>
  <line x1="90" y1="287" x2="90" y2="130" stroke="#22c55e" stroke-width="1" stroke-dasharray="4 3" marker-end="url(#grpc13-arr-g)"/>
  <text x="170" y="282" text-anchor="middle" font-size="7.5" fill="#4ade80">return to caller</text>

  <!-- ── Right: Network Listener ── -->
  <rect x="520" y="55" width="160" height="105" rx="6" fill="#0f172a" stroke="#a78bfa" stroke-width="1.2"/>
  <text x="600" y="75" text-anchor="middle" font-size="9.5" fill="#c4b5fd" font-weight="600">🌐 Network Listener</text>
  <text x="600" y="93" text-anchor="middle" font-size="8" fill="#a8b8cc">TCP :50099</text>
  <rect x="540" y="102" width="120" height="20" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="600" y="116" text-anchor="middle" font-family="monospace" font-size="7.5" fill="#c4b5fd">grpcurl → :50099</text>
  <rect x="540" y="128" width="120" height="20" rx="3" fill="#0a1118" stroke="#3b4a60"/>
  <text x="600" y="142" text-anchor="middle" font-family="monospace" font-size="7.5" fill="#c4b5fd">microservice → :50099</text>

  <!-- Arrow: listener → interceptor -->
  <line x1="520" y1="110" x2="478" y2="110" stroke="#a78bfa" stroke-width="1.2" stroke-dasharray="4 3" marker-end="url(#grpc13-arr)"/>
  <text x="498" y="104" text-anchor="middle" font-size="7" fill="#c4b5fd">routes to</text>

  <!-- ── Bottom: Builder + JSON tabs ── -->
  <rect x="20" y="330" width="200" height="50" rx="6" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="120" y="350" text-anchor="middle" font-size="9" fill="#a8b8cc" font-weight="600">🔧 Builder tab</text>
  <text x="120" y="366" text-anchor="middle" font-size="7.5" fill="#64748b">Visual rule cards · drag · dry-run</text>

  <rect x="240" y="330" width="200" height="50" rx="6" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="340" y="350" text-anchor="middle" font-size="9" fill="#a8b8cc" font-weight="600">{ } JSON tab</text>
  <text x="340" y="366" text-anchor="middle" font-size="7.5" fill="#64748b">Syntax-highlighted editor · export</text>

  <rect x="460" y="330" width="220" height="50" rx="6" fill="#0f172a" stroke="#3b4a60" stroke-width="1"/>
  <text x="570" y="350" text-anchor="middle" font-size="9" fill="#a8b8cc" font-weight="600">▶ Runtime tab</text>
  <text x="570" y="366" text-anchor="middle" font-size="7.5" fill="#64748b">Start/Stop · status · listener toggle</text>
</svg>`,
  },
  grpc: buildGrpcContractMetaFromRoster(GRPC13_ROSTER),
  setup: async (ctx) => {
    // Skip the Manage Schemas draft reset — this lesson uses server reflection,
    // never staged schema sources. Running it would open/close the Manage Schemas
    // modal (cycling Proto Files/Protoset/URL/BSR sub-tabs) for every tab, which
    // the viewer sees as a burst of modals flashing on and off before step 1.
    await grpcFirstCallSetup(ctx, { resetSchemaDrafts: false });
    await ensureGrpcReflected(ctx);
    await clearGrpcSchemaDriftQuiet(ctx);
    await closeGrpcSettingsDrawerQuiet(ctx);
    await navigateToGrpcStudio(ctx);
  },
  cleanup: async (ctx) => {
    // Stop the mock so it doesn't affect the next lesson.
    await navigateToMockServerPanelQuiet(ctx);
    await stopMockQuiet(ctx);
    await ensureGrpcStudioSubNavQuiet(ctx);
    await grpcFirstCallCleanup(ctx);
  },
  steps: grpcMockServerSteps,
};
