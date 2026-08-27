/**
 * AM-10 `am-10-response-content` — Response Content: Status, Headers, Cookies & Body Kinds.
 *
 * Scenario: one rule already answers `GET /orders` with a plain `200 {}`. Status,
 * reason phrase, Format, headers, cookies, HTML/binary kinds, Apply, and the live
 * proof are authored in the UI. The listener is started quietly so Apply is a
 * hot-swap, not a first Start (AM-01 already taught that).
 * Curriculum: API Mock demo curriculum v2 §5 Track C.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM10_COOKIE_NAME,
  AM10_HEADER_CACHE_KEY,
  AM10_HEADER_TRACE_KEY,
  AM10_PATH,
  AM10_REASON,
  cleanupAm10,
  ensureAm10Cookie,
  ensureAm10Formatted,
  ensureAm10ForApply,
  ensureAm10Headers,
  ensureAm10JournalOpen,
  ensureAm10StatusLine,
  ensureAm10Workspace,
  prepareAm10Workspace,
  runAm10Apply,
  runAm10Cookies,
  runAm10FormatJson,
  runAm10Headers,
  runAm10OtherBodyKinds,
  runAm10Preview,
  runAm10Prove,
  runAm10StatusLine,
} from './api-mock-am10-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A mock response is a status line, headers, cookies, and a body kind">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">The client receives more than a JSON blob</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">Status, reason, headers, cookies, and the body kind are the contract. Preview it. Then Apply.</text>

  <rect x="26" y="72" width="648" height="56" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="96" fill="#22c55e" font-family="ui-monospace" font-size="14" font-weight="600">201 Resource created</text>
  <text x="280" y="96" fill="#a8b8cc" font-family="ui-monospace" font-size="12">Content-Type: application/json</text>
  <text x="42" y="116" fill="#64748b" font-family="system-ui" font-size="11">The reason phrase is for legacy clients. Quick chips set both the code and the default phrase.</text>

  <rect x="26" y="142" width="318" height="118" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="166" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">Headers</text>
  <text x="42" y="188" fill="#f1f5f9" font-family="ui-monospace" font-size="11">x-request-id: req-1001</text>
  <text x="42" y="208" fill="#f1f5f9" font-family="ui-monospace" font-size="11">cache-control: no-store</text>
  <text x="42" y="232" fill="#64748b" font-family="system-ui" font-size="10">Tracing and cache headers are part of the contract, not decoration.</text>

  <rect x="356" y="142" width="318" height="118" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="372" y="166" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Cookies</text>
  <text x="372" y="188" fill="#f1f5f9" font-family="ui-monospace" font-size="11">Set-Cookie: sid=sess-42; HttpOnly</text>
  <text x="372" y="208" fill="#a8b8cc" font-family="system-ui" font-size="11">Secure · SameSite=Lax</text>
  <text x="372" y="232" fill="#64748b" font-family="system-ui" font-size="10">The builder ticks HttpOnly. You name the cookie.</text>

  <rect x="26" y="274" width="318" height="118" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="42" y="298" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">Body kinds</text>
  <text x="42" y="320" fill="#f1f5f9" font-family="ui-monospace" font-size="11">JSON  ·  HTML  ·  XML  ·  base64</text>
  <text x="42" y="342" fill="#a8b8cc" font-family="system-ui" font-size="11">Format pretty-prints JSON without breaking templates.</text>
  <text x="42" y="364" fill="#64748b" font-family="system-ui" font-size="10">Octet-stream is decoded from base64 on the wire.</text>

  <rect x="356" y="274" width="318" height="118" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="372" y="298" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Preview → Apply → prove</text>
  <text x="372" y="320" fill="#f1f5f9" font-family="system-ui" font-size="11">The preview is the bytes before a client asks.</text>
  <text x="372" y="342" fill="#a8b8cc" font-family="system-ui" font-size="11">Apply hot-swaps a running listener. Generation bumps.</text>
  <text x="372" y="364" fill="#64748b" font-family="system-ui" font-size="10">A real GET /orders writes the journal with every piece.</text>
</svg>
`;

export const apiMockAm10Lesson: DemoLesson = {
  id: 'am-10-response-content',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Response Content: Status, Headers, Cookies & Body Kinds',
  description:
    'Start from a rule that answers GET /orders with a plain 200 {}. Author the '
    + 'status line (201 plus a reason phrase legacy clients still read), Format a '
    + 'minified JSON body, add tracing and cache headers, name an HttpOnly cookie, '
    + 'read the rendered preview, tour HTML and base64 body kinds, then Apply the '
    + 'running listener and prove the real response in the journal.',
  estimatedMinutes: 7,
  initialTab: 'api-mock-studio',
  contentVersion: 1,
  concept: {
    title: 'The client receives a status line, headers, cookies, and a body kind.',
    body:
      'A mock that only ships a JSON blob is half a contract. Clients read the '
      + '**status code**, a **reason phrase** (legacy stacks still parse it), '
      + '**Content-Type**, extra **headers** (tracing, cache, rate-limit), '
      + '**Set-Cookie** flags, and then the body — which might be JSON, HTML, XML, '
      + 'or raw bytes.\n\n'
      + `This lesson starts from one rule: \`GET ${AM10_PATH}\` answering empty \`200 {}\`. `
      + 'Nothing about the response is finished yet. The **201** chip '
      + `sets the code *and* the default phrase; you then type **${AM10_REASON}** `
      + 'so the phrase is yours, not a lookup table. **Content-Type** is a picker, '
      + 'not a comment — it also switches the body kind the renderer uses.\n\n'
      + '**Format** pretty-prints JSON without touching `{{template}}` expressions. '
      + 'Paste a minified blob, click it, and the size badge proves the bytes '
      + 'changed. Headers and cookies are authored on their own tab: '
      + `\`${AM10_HEADER_TRACE_KEY}\` and \`${AM10_HEADER_CACHE_KEY}\`, then a `
      + `\`${AM10_COOKIE_NAME}\` cookie whose **HttpOnly** flag the builder already `
      + 'ticks.\n\n'
      + 'The right-hand **preview** is the delivered message before a client asks. '
      + 'HTML and `application/octet-stream` are one Content-Type change away — '
      + 'binary bodies are base64 in the editor and bytes on the wire. Switch back '
      + 'to JSON so **Apply** hot-swaps the running listener (generation bumps, no '
      + 'restart). A real `GET /orders` then writes the journal with every piece '
      + 'you authored.',
    keyTerms: [
      { term: 'Status line', definition: 'HTTP status code plus reason phrase. Quick chips set both; the phrase is editable for legacy clients.' },
      { term: 'Content-Type', definition: 'Declares how the body should be parsed. Changing it also switches the editor body kind (JSON, HTML, XML, text, or base64).' },
      { term: 'Format JSON', definition: 'Pretty-prints the body without breaking {{template}} expressions. The size badge updates to prove the bytes changed.' },
      { term: 'Response headers', definition: 'Name/value pairs delivered with the body — tracing, cache, and rate-limit headers are part of the contract.' },
      { term: 'HttpOnly cookie', definition: 'A Set-Cookie the browser will not expose to JavaScript. The cookie builder ticks this flag when you add a row.' },
      { term: 'Body kind', definition: 'How the editor treats the payload: JSON, HTML, XML, text, or binary_base64 decoded to bytes on the wire.' },
      { term: 'Rendered preview', definition: 'The status, header tally, cookies, and body the client will receive, shown before Apply or a real request.' },
      { term: 'Hot Apply', definition: 'Commit the dirty draft to a listener that is already running. Generation bumps; the port does not rebind.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm10Workspace,
  cleanup: cleanupAm10,
  steps: [
    {
      id: 'status-line',
      title: 'The whole status line is yours: code, reason, type',
      description:
        'Open **Content**. The corpus still says 200 OK and empty `{}` — that is '
        + 'the problem, not the lesson. Click **201**. The chip writes both the '
        + 'code and the default phrase **Created**.\n\n'
        + `Replace the phrase with **${AM10_REASON}**. Legacy HTTP clients still `
        + 'read that string; a lookup table is a starting point, not the contract. '
        + 'Then set **Content-Type** to `application/json` so the picker, not a '
        + 'comment, is what the renderer trusts. Hold the preview status line — '
        + '201 plus your phrase.',
      highlight: API_MOCK.RESPONSE_TAB_CONTENT,
      preAction: ensureAm10Workspace,
      action: runAm10StatusLine,
      verify: API_MOCK.PREVIEW_STATUS,
    },
    {
      id: 'format-json',
      title: 'Paste minified, ship readable — Format never breaks templates',
      description:
        'The body is still `{}`. A minified order payload lands in the editor as '
        + 'one unreadable line. Hold that blob so you can see why **Format** '
        + 'exists.\n\n'
        + 'Click **Format**. Templates stay intact — Format is pretty-print, not a '
        + 'rewriter. The body becomes indented JSON and the **byte-size** badge '
        + 'updates. That badge is the proof the bytes actually changed, not just '
        + 'the font.',
      highlight: API_MOCK.BODY_FORMAT,
      preAction: ensureAm10StatusLine,
      action: runAm10FormatJson,
      verify: API_MOCK.BODY_SIZE,
    },
    {
      id: 'headers',
      title: 'Cache and tracing headers are part of the contract',
      description:
        'Switch to **Headers & cookies**. **+ Header** adds an empty row. Name it '
        + `\`${AM10_HEADER_TRACE_KEY}\` with \`req-1001\` — the id a client will `
        + 'echo in logs.\n\n'
        + `Add a second row for \`${AM10_HEADER_CACHE_KEY}: no-store\`. Two rows `
        + 'is the point: the response is not only a body. Hold the list. The '
        + 'preview header tally on the right should now read **2 headers**.',
      highlight: API_MOCK.RESPONSE_TAB_HEADERS,
      preAction: ensureAm10Formatted,
      action: runAm10Headers,
      verify: API_MOCK.HEADER_LIST,
    },
    {
      id: 'cookies',
      title: 'The cookie builder covers HttpOnly, Secure, and SameSite',
      description:
        '**+ Cookie** drops a row with **HttpOnly** already ticked — that is the '
        + 'safe default, not a hidden setting. Rename it '
        + `\`${AM10_COOKIE_NAME}\` and set the value to \`sess-42\`.\n\n`
        + 'Hold the **HttpOnly** flag. You did not have to hunt for it. Secure and '
        + 'SameSite sit on the same row; this lesson names the cookie and leaves '
        + 'the flags the builder chose.',
      highlight: API_MOCK.ADD_COOKIE,
      preAction: ensureAm10Headers,
      action: runAm10Cookies,
      verify: API_MOCK.COOKIE_ROW,
    },
    {
      id: 'preview',
      title: 'Read the delivered bytes before a client does',
      description:
        'The right-hand **Rendered preview** is the message, not a comment on it. '
        + 'Hold the status line, then the header tally, then the cookie badge, '
        + 'then the body.\n\n'
        + 'If the preview disagrees with the form, the form is lying. This is the '
        + 'last chance to catch a 200 you meant as 201, or a missing cookie, '
        + 'without sending traffic.',
      highlight: API_MOCK.RESPONSE_PREVIEW,
      preAction: ensureAm10Cookie,
      action: runAm10Preview,
      verify: API_MOCK.RESPONSE_PREVIEW,
    },
    {
      id: 'other-body-kinds',
      title: 'HTML and base64 binary are one Content-Type change away',
      description:
        'Not every endpoint speaks JSON. Switch **Content-Type** to `text/html` '
        + 'and the body becomes markup — hold the preview so you see the HTML, not '
        + 'an escaped string.\n\n'
        + 'Then pick `application/octet-stream`. The editor treats the body as '
        + '**base64** and decodes it to bytes on the wire; the callout says so. '
        + 'Switch back to JSON and the order body so Apply ships the contract you '
        + 'authored, not the tour.',
      highlight: API_MOCK.VARIANT_CONTENT_TYPE_SELECT,
      preAction: ensureAm10Cookie,
      action: runAm10OtherBodyKinds,
      verify: API_MOCK.PREVIEW_BODY,
    },
    {
      id: 'apply-live',
      title: 'Apply hot-swaps the running listener without a restart',
      description:
        'The listener has been running since the first step, on the original empty '
        + '`200 {}`. **Draft changed** means the bound generation is stale. '
        + '**Apply** commits the new status, headers, cookie, and body without '
        + 'rebind.\n\n'
        + 'Hold **Generation** as it bumps, then **Running**. That is a hot-swap, '
        + 'not a Stop/Start. The port never moved.',
      highlight: API_MOCK.APPLY,
      preAction: ensureAm10ForApply,
      action: runAm10Apply,
      verify: API_MOCK.GENERATION,
    },
    {
      id: 'prove',
      title: 'The real response carries every piece you authored',
      description:
        `A real \`GET ${AM10_PATH}\` hits the bound listener. The Live strip counts `
        + 'it. Open the journal row.\n\n'
        + 'The transaction **Response** pane is the wire: 201, the tracing header, '
        + `the \`${AM10_COOKIE_NAME}\` cookie, and the formatted order body. That is `
        + 'the same preview you read, now proven.',
      highlight: API_MOCK.LIVE_TRANSACTIONS,
      preAction: ensureAm10JournalOpen,
      action: async (ctx) => {
        await runAm10Prove(ctx);
      },
      verify: API_MOCK.TX_DETAIL,
    },
  ],
};
