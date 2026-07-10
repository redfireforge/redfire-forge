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
  },
  grpc: buildGrpcContractMetaFromRoster(GRPC13_ROSTER),
  setup: async (ctx) => {
    await grpcFirstCallSetup(ctx);
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
