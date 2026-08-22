/**
 * AM-11 `am-11-templating` — Dynamic Responses: Templates, Faker & Body Mapper.
 *
 * Scenario: one rule already answers `GET /products/:id` with a static JSON
 * object. Every helper is typed (or mapped) in the editor. Monaco `{{`
 * completions and Map body are the power-user beats. The listener is started
 * quietly so Apply is a hot-swap, not a first Start.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track C.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM11_PATH_TEMPLATE,
  AM11_PROVE_PATH,
  AM11_TENANT_KEY,
  cleanupAm11,
  ensureAm11EchoBody,
  ensureAm11FakerBody,
  ensureAm11ForApply,
  ensureAm11ForMapBody,
  ensureAm11GeneratedBody,
  ensureAm11Mapped,
  ensureAm11RepeatBody,
  ensureAm11Workspace,
  prepareAm11Workspace,
  runAm11Completions,
  runAm11Echo,
  runAm11Faker,
  runAm11Generated,
  runAm11MapBody,
  runAm11ProveTwice,
  runAm11Repeat,
  runAm11TemplateError,
  runAm11Variables,
} from './api-mock-am11-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 430" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A template body is evaluated per request">
  <rect x="0" y="0" width="700" height="430" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">The same rule, a different body every call</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">Helpers read the request, mint ids, and pull server variables. Completions and Map body author them.</text>

  <rect x="26" y="72" width="318" height="118" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="96" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">Echo the request</text>
  <text x="42" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">{{pathParam 'id'}}  →  42</text>
  <text x="42" y="138" fill="#f1f5f9" font-family="ui-monospace" font-size="11">{{query}} {{header}} {{cookie}}</text>
  <text x="42" y="162" fill="#64748b" font-family="system-ui" font-size="10">jsonPath reads $.items[0].sku from the body.</text>

  <rect x="356" y="72" width="318" height="118" rx="8" fill="#1e293b" stroke="#a78bfa" />
  <text x="372" y="96" fill="#a78bfa" font-family="system-ui" font-size="12" font-weight="600">Generate</text>
  <text x="372" y="118" fill="#f1f5f9" font-family="ui-monospace" font-size="11">{{uuid}}  {{now}}  {{randomInt}}</text>
  <text x="372" y="138" fill="#f1f5f9" font-family="ui-monospace" font-size="11">{{oneOf}}  {{repeat}}  {{faker}}</text>
  <text x="372" y="162" fill="#64748b" font-family="system-ui" font-size="10">Two calls, two uuids. Names instead of foo.</text>

  <rect x="26" y="204" width="318" height="118" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="228" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Variables + Map body</text>
  <text x="42" y="250" fill="#f1f5f9" font-family="ui-monospace" font-size="11">{{variables.tenant}}  →  acme</text>
  <text x="42" y="270" fill="#a8b8cc" font-family="system-ui" font-size="11">Map body auto-maps request fields onto JSON.</text>
  <text x="42" y="294" fill="#64748b" font-family="system-ui" font-size="10">Tenant stays out of every body you type.</text>

  <rect x="356" y="204" width="318" height="118" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="372" y="228" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">Errors are reported</text>
  <text x="372" y="250" fill="#f1f5f9" font-family="ui-monospace" font-size="11">{{faker 'not.a.path'}}  →  diagnostic</text>
  <text x="372" y="270" fill="#a8b8cc" font-family="system-ui" font-size="11">Fix it. The preview goes clean.</text>
  <text x="372" y="294" fill="#64748b" font-family="system-ui" font-size="10">Never a silently empty field.</text>

  <rect x="26" y="336" width="648" height="70" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="364" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">Type {{  ·  Browse helpers lists the same catalog</text>
  <text x="42" y="386" fill="#a8b8cc" font-family="system-ui" font-size="11">Apply, then GET /products/42 twice. The journal shows 42 echoed and a fresh uuid each call.</text>
</svg>
`;

export const apiMockAm11Lesson: DemoLesson = {
  id: 'am-11-templating',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Dynamic Responses: Templates, Faker & Body Mapper',
  description:
    'Start from a rule that answers GET /products/:id with a hard-coded JSON '
    + 'object. Type {{ to open Monaco completions, then Browse helpers for the '
    + 'full searchable catalog. Echo the request with pathParam / query / header '
    + '/ cookie / jsonPath, mint uuid and now values, grow a body with repeat, '
    + 'fill names with faker, add a tenant server variable, Apply and fetch twice '
    + 'so the uuid changes, Map body from the request, then break a helper and '
    + 'watch the diagnostic clear when you fix it.',
  estimatedMinutes: 8,
  initialTab: 'api-mock-studio',
  contentVersion: 2,
  concept: {
    title: 'A template is evaluated per request — never a second static blob.',
    body:
      'A mock that always returns `{"id":"static"}` cannot echo the id that '
      + 'arrived, mint a fresh correlation id, or keep a tenant out of every '
      + 'body you type. **Templates** are the same rule with helpers inside '
      + `the payload. This lesson starts from \`GET ${AM11_PATH_TEMPLATE}\` `
      + 'answering a hard-coded Widget. Nothing about the body is dynamic yet.\n\n'
      + 'Type `{{` in the Monaco editor and the **completion list** names every '
      + 'helper, documented inline. **Browse helpers** under the body opens the '
      + 'same catalog as a searchable list — Copy or Insert any snippet. You do '
      + 'not memorize the catalog. '
      + `\`{{pathParam 'id'}}\` echoes \`${AM11_PROVE_PATH.split('?')[0]}\`. `
      + '`{{query}}`, `{{header}}`, and `{{cookie}}` take the field name. '
      + '`{{jsonPath \'$.items[0].sku\'}}` reads the request body. '
      + '`{{uuid}}`, `{{now}}`, `{{randomInt}}`, and `{{oneOf}}` mint values. '
      + '`{{repeat}}` grows a list. `{{faker \'person.firstName\'}}` is a '
      + 'realistic name instead of `foo`.\n\n'
      + `Server **variables** keep \`${AM11_TENANT_KEY}\` in one place: `
      + '`{{variables.tenant}}` resolves in the preview. **Map body** is the '
      + 'visual authoring path — Auto-map request helpers onto JSON fields. A '
      + 'broken helper is **reported in the preview**, never silently empty. '
      + 'Apply, then fetch twice: the journal shows `42` echoed and a **different '
      + 'uuid** each call.',
    keyTerms: [
      { term: 'Template helper', definition: 'A {{name}} expression evaluated when the mock renders a response. Type {{ for completions, or Browse helpers for the full searchable catalog.' },
      { term: 'pathParam', definition: 'Reads a named capture from the matched path. GET /products/42 fills {{pathParam \'id\'}} with 42.' },
      { term: 'jsonPath', definition: 'Selects a value from the request JSON body. Array indexes like $.items[0].sku are supported.' },
      { term: 'faker', definition: 'A curated subset of realistic names, emails, and places. The preview draws a new value when the body changes.' },
      { term: 'Server variable', definition: 'A key/value on the mock server, referenced as {{variables.key}}. Tenant and env stay out of every body.' },
      { term: 'Map body', definition: 'Opens the Data Mapper so request helpers can be dropped onto JSON fields instead of typed by hand.' },
      { term: 'Template diagnostic', definition: 'An unknown or invalid helper is reported in the preview. Fix the expression and the error clears.' },
      { term: 'Hot Apply', definition: 'Commit the dirty draft to a listener that is already running. Generation bumps; two fetches then prove the uuid changes.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm11Workspace,
  cleanup: cleanupAm11,
  steps: [
    {
      id: 'static-problem',
      title: 'A static body cannot echo the request',
      description:
        'The corpus still says `{"id":"static","name":"Widget"}` — that is the '
        + 'problem, not the lesson. Hold the **body editor**. A client that '
        + 'called `/products/42` will never see `42` in that blob.\n\n'
        +         'Click the editor and type `{{`. The **completion list** names every '
        + 'helper, documented inline. Then **Browse helpers** under the editor '
        + 'opens the same catalog as a searchable list — Request, Faker, Copy, '
        + 'Insert. Search `uuid`, hold the row, then **Close**. You do not '
        + 'memorize this catalog.',
      highlight: API_MOCK.VARIANT_BODY,
      preAction: ensureAm11Workspace,
      action: runAm11Completions,
      verify: API_MOCK.VARIANT_BODY,
    },
    {
      id: 'echo-the-request',
      title: 'Templates read the request that arrived',
      description:
        `The body becomes JSON with helpers. \`{{pathParam 'id'}}\` is the `
        + 'capture from `/products/:id`. Hold the **TEMPLATE** badge — that is '
        + 'how you know the renderer will evaluate, not echo the braces.\n\n'
        + `Then query \`sku\`, header \`x-tenant\`, cookie \`session\`, and `
        + `\`{{jsonPath '$.items[0].sku'}}\` against the request body. The `
        + 'preview uses a sample `GET /products/42` so you can read the '
        + 'resolved values before a client asks.',
      highlight: API_MOCK.BODY_TEMPLATE_BADGE,
      preAction: ensureAm11EchoBody,
      action: runAm11Echo,
      verify: API_MOCK.BODY_TEMPLATE_BADGE,
    },
    {
      id: 'generated-values',
      title: 'Ids, timestamps, and controlled randomness',
      description:
        '`{{uuid}}` and `{{now}}` mint a correlation id and a clock. Hold the '
        + 'preview — those are not literals.\n\n'
        + '`{{randomInt}}` and `{{oneOf}}` pick from a range and a list. The '
        + 'preview draws again when the body changes. Two later fetches will '
        + 'prove the uuid is different on the wire.',
      highlight: API_MOCK.PREVIEW_BODY,
      preAction: ensureAm11GeneratedBody,
      action: runAm11Generated,
      verify: API_MOCK.PREVIEW_BODY,
    },
    {
      id: 'repeat',
      title: 'Build list payloads of any length from one block',
      description:
        '`{{repeat}}` copies a fragment. One helper, a body that grew. Hold '
        + 'the rendered pad, then the **byte-size** badge — that badge is the '
        + 'proof the bytes changed, not just the font.',
      highlight: API_MOCK.BODY_SIZE,
      preAction: ensureAm11RepeatBody,
      action: runAm11Repeat,
      verify: API_MOCK.BODY_SIZE,
    },
    {
      id: 'faker',
      title: 'Realistic names and emails instead of foo',
      description:
        `\`{{faker 'person.firstName'}}\` and \`{{faker 'internet.email'}}\` `
        + 'draw from a curated subset — not the whole faker catalog, and never '
        + 'eval. Hold the **rendered preview**. Ada or Grace is the point: the '
        + 'client sees a person, not `foo`.',
      highlight: API_MOCK.PREVIEW_BODY,
      preAction: ensureAm11FakerBody,
      action: runAm11Faker,
      verify: API_MOCK.PREVIEW_BODY,
    },
    {
      id: 'variables',
      title: 'Server variables keep tenant and env out of every body',
      description:
        'Open **Variables** on the live strip. **+ Variable** adds a row. Name '
        + `it \`${AM11_TENANT_KEY}\` and set the value to \`acme\`.\n\n`
        + 'Back on the rule, the body references `{{variables.tenant}}`. Hold '
        + 'the preview — `acme` is resolved. Change the variable later and '
        + 'every template picks it up; you do not hunt through payloads.',
      highlight: API_MOCK.LIVE_VARIABLES,
      preAction: ensureAm11FakerBody,
      action: runAm11Variables,
      verify: API_MOCK.PREVIEW_BODY,
    },
    {
      id: 'prove-twice',
      title: 'Dynamic means a different body each call',
      description:
        'The listener has been running since the first step, on the original '
        + 'static Widget. **Apply** hot-swaps the template without a rebind. '
        + 'Hold **Generation**.\n\n'
        + `A real \`GET ${AM11_PROVE_PATH.split('?')[0]}\` hits the bound `
        + 'listener. Open the journal row: `42` is echoed and the uuid is '
        + 'fresh. Fetch **again**. The second row has a **different uuid**. '
        + 'That is the definition of dynamic.',
      highlight: API_MOCK.APPLY,
      preAction: ensureAm11ForApply,
      action: runAm11ProveTwice,
      verify: API_MOCK.TX_DETAIL,
    },
    {
      id: 'map-body',
      title: 'Build a body visually from the request payload',
      description:
        '**Map body** opens the Data Mapper on a JSON object. You do not have '
        + 'to type helpers for every field.\n\n'
        + '**Auto-map** is the power-user beat — it matches request helpers '
        + 'onto fields with the same name. **Apply body** writes the template '
        + 'back. Hold the editor: `id` is now a helper, not `"static"`.',
      highlight: API_MOCK.BODY_MAP,
      preAction: ensureAm11ForMapBody,
      action: runAm11MapBody,
      verify: API_MOCK.VARIANT_BODY,
    },
    {
      id: 'template-error',
      title: 'A broken expression is reported, never silently empty',
      description:
        '`{{faker \'not.a.path\'}}` is not a blank string you debug later. The preview '
        + 'shows a **template error**. Hold it.\n\n'
        + 'Replace the body with the working tenant + uuid template. The '
        + 'diagnostic clears and the preview is clean. That is the contract: '
        + 'broken helpers surface, then they go away when you fix them.',
      highlight: API_MOCK.DIAG_TEMPLATE_ERRORS,
      preAction: ensureAm11Mapped,
      action: runAm11TemplateError,
      verify: API_MOCK.PREVIEW_BODY,
    },
  ],
};
