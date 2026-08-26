/**
 * wf-har-import demo lesson helpers.
 *
 * Inlined HAR fixture for the lesson — bypasses the native OS file picker.
 * Uses JSONPlaceholder (a live public API) so Quick Test actually succeeds.
 *
 * The fixture produces:
 *   - 3 entries (GET /posts/100, GET /comments/100, GET /posts/100/comments)
 *   - {{baseUrl}} = https://jsonplaceholder.typicode.com
 *   - Authorization header redacted → {{authToken}}
 *   - Chain variables: {{id}} from response `id: 100` into downstream paths
 */
import type { DemoActionContext } from '../../types';
import { WF } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import { fillControlledInput } from '../setup-helpers';
import {
  deleteWorkflowByName,
  fitWorkflowCanvasView,
  getWorkflowByName,
  triggerHarImportWithFixture,
  waitForWorkflowBridge,
} from '../../adapters';

export const HAR_FIXTURE_FILENAME = 'jsonplaceholder-session.har';

const AUTH_HEADER = {
  name: 'Authorization',
  value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo',
};

const POST_100_BODY = JSON.stringify({
  userId: 10,
  id: 100,
  title: 'at nam consequatur ea labore ea harum',
  body: 'cupiditate quo est a modi nesciunt soluta',
});

const COMMENT_100_BODY = JSON.stringify({
  postId: 20,
  id: 100,
  name: 'et sint quia dolor et est ea nulla cum',
  email: 'Leone_Fay@orrin.com',
  body: 'architecto dolorem ab explicabo et provident',
});

const COMMENTS_LIST_BODY = JSON.stringify([
  { postId: 100, id: 496, name: 'comment-a', email: 'a@example.com', body: 'a' },
  { postId: 100, id: 497, name: 'comment-b', email: 'b@example.com', body: 'b' },
]);

function harGetEntry(
  startedDateTime: string,
  time: number,
  url: string,
  responseText: string,
): Record<string, unknown> {
  return {
    startedDateTime,
    time,
    request: {
      method: 'GET',
      url,
      httpVersion: 'HTTP/1.1',
      headers: [AUTH_HEADER, { name: 'Accept', value: 'application/json' }],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: 0,
    },
    response: {
      status: 200,
      statusText: 'OK',
      httpVersion: 'HTTP/1.1',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      cookies: [],
      content: { mimeType: 'application/json', text: responseText },
      redirectURL: '',
      headersSize: -1,
      bodySize: responseText.length,
    },
    cache: {},
    timings: { send: 5, wait: Math.max(time - 15, 10), receive: 10 },
  };
}

/**
 * Minimal valid HAR 1.2 of a JSONPlaceholder session.
 * GET /posts/100 → GET /comments/100 → GET /posts/100/comments
 *
 * Authorization is illustrative (jsonplaceholder ignores it) so the preview
 * still demonstrates header redaction. Chain detection matches `id: 100`
 * (length ≥ 3) in downstream path segments.
 */
export const HAR_FIXTURE = JSON.stringify({
  log: {
    version: '1.2',
    creator: { name: 'RedfireForge Demo', version: '1.0' },
    entries: [
      harGetEntry(
        '2026-08-26T09:00:00.000Z',
        120,
        'https://jsonplaceholder.typicode.com/posts/100',
        POST_100_BODY,
      ),
      harGetEntry(
        '2026-08-26T09:00:00.200Z',
        85,
        'https://jsonplaceholder.typicode.com/comments/100',
        COMMENT_100_BODY,
      ),
      harGetEntry(
        '2026-08-26T09:00:00.400Z',
        95,
        'https://jsonplaceholder.typicode.com/posts/100/comments',
        COMMENTS_LIST_BODY,
      ),
    ],
  },
});

/** Authored name the lesson types into the preview modal (not the host default). */
export const HAR_IMPORT_WF_NAME = 'JSONPlaceholder Session';

/** Modal default when the name field is left untouched. */
export const HAR_IMPORT_DEFAULT_NAME = 'jsonplaceholder.typicode.com import';

const CLEANUP_NAMES = [
  HAR_IMPORT_WF_NAME,
  HAR_IMPORT_DEFAULT_NAME,
  // Leftovers from the previous petstore placeholder fixture
  'Petstore Session',
  'api.petstore.example.com import',
];

/** Remove every leftover HAR-import workflow from prior lesson / product runs. */
export function deleteHarImportLessonWorkflows(): void {
  for (const name of CLEANUP_NAMES) {
    deleteWorkflowByName(name);
  }
}

export function fillHarWorkflowNameQuiet(name = HAR_IMPORT_WF_NAME): void {
  const input = document.querySelector<HTMLInputElement>(WF.HAR_WORKFLOW_NAME);
  if (!input) return;
  fillControlledInput(input, name);
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: name, inputType: 'insertFromPaste' }));
}

export async function ensureHarPreviewModal(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(WF.HAR_MODAL)) return;
  const ok = triggerHarImportWithFixture(HAR_FIXTURE, HAR_FIXTURE_FILENAME);
  if (!ok) {
    await waitForWorkflowBridge(ctx, 5000);
    triggerHarImportWithFixture(HAR_FIXTURE, HAR_FIXTURE_FILENAME);
  }
  await ctx.waitFor(WF.HAR_MODAL, 4000);
}

/** Quiet path for rapid Next — create the named workflow if it is missing. */
export async function ensureHarImportWorkflow(ctx: DemoActionContext): Promise<void> {
  if (getWorkflowByName(HAR_IMPORT_WF_NAME)) return;
  await ensureHarPreviewModal(ctx);
  fillHarWorkflowNameQuiet();
  const btn = document.querySelector<HTMLElement>(WF.HAR_MODAL_CONFIRM);
  if (btn && !btn.hasAttribute('disabled')) {
    btn.click();
    await ctx.delay(400);
  }
}

/** Spotlight + click Fit View so the viewer sees the canvas reframe. */
export async function clickHarImportFitView(ctx: DemoActionContext): Promise<void> {
  const btn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
  if (btn) {
    const remove = showSpotlightRing(btn);
    await ctx.delay(800);
    remove();
    btn.click();
    await ctx.delay(1000);
    return;
  }
  fitWorkflowCanvasView({ duration: 400, padding: 0.15, maxZoom: 1, minZoom: 0.4 });
  await ctx.delay(600);
}

/** Wait until Quick Test prints a terminal Workflow PASS/FAIL line. */
export async function waitForHarImportQuickTest(ctx: DemoActionContext): Promise<void> {
  for (let i = 0; i < 48; i++) {
    const consoleText = document.querySelector(WF.CONSOLE)?.textContent ?? '';
    if (/Workflow (PASS|FAIL)/i.test(consoleText)) {
      await ctx.delay(1000);
      return;
    }
    await ctx.delay(250);
  }
}
