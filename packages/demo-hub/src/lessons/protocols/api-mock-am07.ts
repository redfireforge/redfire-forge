/**
 * AM-07 `am-07-payload-formats` — Forms, Multipart, XML & Binary Matching.
 *
 * Scenario: four bare rules that answer non-JSON payloads — a urlencoded token form, a
 * multipart upload, a namespaced SOAP order, and a raw firmware blob. Every matcher is
 * authored live and proven in Simulate. Curriculum:
 * API Mock demo curriculum v2 §5 Track B.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM07_BINARY_RULE,
  AM07_FORM_FIELD,
  AM07_FORM_PATTERN,
  AM07_FORM_RULE,
  AM07_FORM_VALUE,
  AM07_MULTIPART_FIELD,
  AM07_MULTIPART_FILENAME,
  AM07_MULTIPART_FILE_PART,
  AM07_ORDER_ID,
  AM07_SCHEMA_PRESET,
  AM07_UPLOAD_RULE,
  AM07_XML_ELEMENTS,
  AM07_XML_RULE,
  AM07_XPATH,
  AM07_XPATH_PRESET,
  cleanupAm07,
  ensureAm07Corpus,
  ensureAm07FormExact,
  ensureAm07MultipartConditions,
  ensureAm07XPathCondition,
  ensureAm07XmlBare,
  prepareAm07Workspace,
  runAm07Binary,
  runAm07FormMatching,
  runAm07MultipartFields,
  runAm07ProveForm,
  runAm07ProveMultipart,
  runAm07XPath,
  runAm07XmlSchema,
} from './api-mock-am07-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 470" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Which matcher reads which payload format">
  <rect x="0" y="0" width="700" height="470" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">Four payload families, four families of matcher</text>
  <text x="26" y="54" fill="#64748b" font-family="system-ui" font-size="10">Content-Type is what tells the evaluator how to read the body — the source is always the whole payload.</text>

  <rect x="26" y="68" width="648" height="82" rx="8" fill="#1e293b" stroke="#22c55e" />
  <text x="42" y="90" fill="#22c55e" font-family="system-ui" font-size="12" font-weight="600">application/x-www-form-urlencoded</text>
  <text x="42" y="110" fill="#a8b8cc" font-family="ui-monospace" font-size="10">grant_type=password&amp;username=ada.lovelace&amp;client_id=web-2.1.4</text>
  <text x="42" y="130" fill="#f1f5f9" font-family="system-ui" font-size="10">Form field exact · Form field regex · Form field present — one named field, parsed like a query string</text>
  <text x="42" y="146" fill="#64748b" font-family="system-ui" font-size="10">Never match a form with a body substring: field order and encoding are not yours to control.</text>

  <rect x="26" y="162" width="648" height="82" rx="8" fill="#1e293b" stroke="#3b82f6" />
  <text x="42" y="184" fill="#3b82f6" font-family="system-ui" font-size="12" font-weight="600">multipart/form-data; boundary=…</text>
  <text x="42" y="204" fill="#a8b8cc" font-family="ui-monospace" font-size="10">name="title" → "Q3 revenue report"   ·   name="document"; filename="report.pdf"</text>
  <text x="42" y="224" fill="#f1f5f9" font-family="system-ui" font-size="10">Multipart field reads a text part's value · Multipart file reads a file part's filename</text>
  <text x="42" y="240" fill="#64748b" font-family="system-ui" font-size="10">The boundary comes from the header, so the parts are split before either matcher runs.</text>

  <rect x="26" y="256" width="648" height="82" rx="8" fill="#1e293b" stroke="#f59e0b" />
  <text x="42" y="278" fill="#f59e0b" font-family="system-ui" font-size="12" font-weight="600">application/xml — SOAP and legacy envelopes</text>
  <text x="42" y="298" fill="#a8b8cc" font-family="ui-monospace" font-size="10">//*[local-name()='orderId']/text()  equals  A-1098</text>
  <text x="42" y="318" fill="#f1f5f9" font-family="system-ui" font-size="10">XPath exists / equals for one value · XML Schema for a required-element list</text>
  <text x="42" y="334" fill="#64748b" font-family="system-ui" font-size="10">local-name() ignores namespace prefixes, which is why the presets are written that way.</text>

  <rect x="26" y="350" width="648" height="82" rx="8" fill="#1e293b" stroke="#a855f7" />
  <text x="42" y="372" fill="#a855f7" font-family="system-ui" font-size="12" font-weight="600">application/octet-stream — raw bytes</text>
  <text x="42" y="392" fill="#a8b8cc" font-family="ui-monospace" font-size="10">sha256 → d5a4c05a0eeeea787fce65ebe5c6d1d7bcfe5fbfd419a14125a46b74ff0b7d6d</text>
  <text x="42" y="412" fill="#f1f5f9" font-family="system-ui" font-size="10">Binary exact pins the payload itself · SHA-256 pins it by digest — one 64-char row</text>
  <text x="42" y="428" fill="#64748b" font-family="system-ui" font-size="10">A digest is readable in a diff and identifies a build; a pasted blob is neither.</text>

  <text x="26" y="456" fill="#a8b8cc" font-family="system-ui" font-size="11">Every one of these is an ordinary condition row — Simulate proves it before a listener is ever bound.</text>
</svg>
`;

export const apiMockAm07Lesson: DemoLesson = {
  id: 'am-07-payload-formats',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Forms, Multipart, XML & Binary Matching',
  description:
    'Not every request is JSON. Match a urlencoded token form by field, a multipart upload '
    + 'by its text and file parts, a namespaced SOAP envelope with XPath and a required-element '
    + 'list, and a firmware blob by its SHA-256 digest — each proven in Simulate.',
  estimatedMinutes: 9,
  initialTab: 'api-mock-studio',
  contentVersion: 11,
  concept: {
    title: 'Beyond JSON — the matcher follows the Content-Type',
    body:
      'JSON is the happy path. Real integration work is full of everything else: an OAuth token '
      + 'endpoint that takes a urlencoded form, an upload endpoint that takes `multipart/form-data`, '
      + 'a partner that still speaks SOAP, and a firmware channel that takes raw bytes. A mock that '
      + 'can only match JSON bodies has nothing to say about any of them.\n\n'
      + 'All four use the same **body** condition you already know — the whole payload is the '
      + 'value, so there is no key to name. What changes is the **operator**, and each family of '
      + 'operator parses the body the way the `Content-Type` says it should be parsed.\n\n'
      + '**Forms.** A urlencoded body is a query string in the payload, so it is matched the same '
      + 'way: by named field. `Form field exact` pins one field to one value, `Form field regex` '
      + 'accepts a pattern for the ones that vary per environment, and `Form field present` only '
      + 'asks that the field was sent at all. The temptation is to match a form with a substring '
      + 'of the body — do not. Field order and percent-encoding are the client\'s choice, and a '
      + 'substring matcher breaks the first time either one changes.\n\n'
      + '**Multipart.** A multipart body is a set of parts separated by a boundary declared in the '
      + 'header, and the two matchers read different things. `Multipart field` reads a text part\'s '
      + 'value — the caption, the metadata JSON, the idempotency key. `Multipart file` reads a file '
      + `part's **filename**, so \`${AM07_MULTIPART_FILE_PART}\` carrying \`${AM07_MULTIPART_FILENAME}\` `
      + 'matches without the megabytes behind it mattering at all. Leave the value box empty on '
      + 'either one and it becomes a presence check for that part.\n\n'
      + '**XML.** Two matchers, two questions. `XPath exists` / `XPath equals` pull one value out '
      + `of the document — \`${AM07_XPATH}\` — and the toolbox presets are written with `
      + '`local-name()` on purpose: a SOAP envelope is namespaced, and `//orderId` silently selects '
      + 'nothing when the prefix does not match. `XML Schema` asks the shape question instead, and '
      + 'it takes a plain comma-separated **element list** rather than a full XSD, which is usually '
      + 'all a mock needs to reject a truncated envelope.\n\n'
      + '**Binary.** `Binary exact` compares the payload byte for byte. `SHA-256` compares its '
      + 'digest instead — one 64-character row that pins an exact artifact, matches what a build '
      + 'pipeline already publishes, and stays readable in a diff. For anything larger than a '
      + 'sentence, the digest is the honest matcher.\n\n'
      + 'The **Pattern Toolbox** covers the two hard ones: an XPath tab with presets, a sample '
      + 'document, and a live **Resolved** read of what the expression selects, plus a Schema tab '
      + 'with an XML mode. And because these are ordinary conditions, the decision trace prints '
      + 'each one with the payload it read — so when a multipart upload does not match, the trace '
      + 'says whether it was the caption or the filename.',
    keyTerms: [
      { term: 'Form field matcher', definition: 'Reads one named field out of a `application/x-www-form-urlencoded` body — exact, regex, or present — instead of matching the raw string.' },
      { term: 'Multipart part', definition: 'One section of a `multipart/form-data` body, identified by its `name`; file parts also carry a `filename` and their own content type.' },
      { term: 'Multipart field vs file', definition: '`multipart_field` compares a text part\'s value; `multipart_file` compares a file part\'s filename. An empty value box makes either a presence check.' },
      { term: 'local-name()', definition: 'The XPath function that ignores namespace prefixes — required for SOAP envelopes, where a bare element name selects nothing.' },
      { term: 'Resolved (XPath)', definition: 'The toolbox\'s live read of the expression against the sample document, so a wrong path shows up before it becomes a rule.' },
      { term: 'XML element list', definition: 'The XML Schema matcher\'s expected value: comma-separated local element names that must all be present. No XSD required.' },
      { term: 'Binary exact', definition: 'Byte-for-byte comparison of the whole payload — precise, but unreadable for anything of real size.' },
      { term: 'SHA-256 matcher', definition: 'Pins the payload by its 64-character hex digest, which is what a build pipeline publishes beside the artifact.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm07Workspace,
  cleanup: cleanupAm07,
  steps: [
    {
      id: 'form-matching',
      title: 'A form is a query string in the body — match it by field',
      description:
        'Four rules in this workspace, and not one of them is JSON: a token endpoint that takes a '
        + 'urlencoded form, an upload endpoint that takes multipart, a SOAP order endpoint, and a '
        + 'firmware endpoint that takes raw bytes. All four currently answer **any** body at all, '
        + 'which is the problem for the rest of the lesson.\n\n'
        + `Open \`${AM07_FORM_RULE.method} ${AM07_FORM_RULE.path}\` and add a condition. Set the `
        + 'source to **Body** and watch the key box: it goes empty and greyed, reading '
        + '`(whole body)`. There is nothing to name at this level, because the payload *is* the '
        + 'value — the operator is where the meaning lives.\n\n'
        + `That operator is **Form field exact**, and it turns the row into a pair: \`${AM07_FORM_FIELD}\` `
        + `on the left, \`${AM07_FORM_VALUE}\` on the right. The body is parsed as a query string `
        + 'first, so encoding and field order stop mattering — which is exactly why matching a form '
        + 'with a plain body substring is a trap worth avoiding.',
      highlight: API_MOCK.ROUTE_EXPLORER,
      preAction: ensureAm07Corpus,
      action: async (ctx) => {
        await runAm07FormMatching(ctx);
      },
      verify: API_MOCK.FIRST_CONDITION,
    },
    {
      id: 'prove-form',
      title: 'Prove it, then widen the field to a pattern',
      description:
        'Simulate takes the request the way a client would send it: the form body **and** the '
        + '`Content-Type` that says it is a form. That header is not decoration — it is how the '
        + 'evaluator knows to parse the payload into fields instead of reading it as text. '
        + '**Save as sample** keeps that request under **Saved samples** — name it after saving — '
        + 'so you can reopen the full headers and body later. **From rules** rows are only suggested '
        + 'probes (method + path) until you save. Then **Run simulation**: the rule comes back '
        + '**MATCHED**, with the `form_field_exact` row ticked in the trace.\n\n'
        + `Now the realistic problem: the same endpoint in another region issues \`${AM07_FORM_VALUE}.eu\`. `
        + 'Exact matching rejects it, and duplicating the rule per region is not a plan. Switch the '
        + `operator to **Form field regex** and put \`${AM07_FORM_PATTERN}\` in the value box — the `
        + 'field is still `username`, but now the *shape* of the value is what matters.\n\n'
        + 'Re-run with the regional body and it matches, on a payload the exact reading turned '
        + 'away. `Form field present` is the third member of the family, for when you only need to '
        + 'know the field was sent — a consent flag, a client id — and not what it said.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm07FormExact,
      action: async (ctx) => {
        await runAm07ProveForm(ctx);
      },
      verify: API_MOCK.FIRST_CONDITION,
    },
    {
      id: 'multipart-fields',
      title: 'Text parts and file parts are matched separately',
      description:
        `Switch to \`${AM07_UPLOAD_RULE.method} ${AM07_UPLOAD_RULE.path}\` — a document upload, and `
        + 'a `multipart/form-data` body. A multipart payload is not one value; it is a set of '
        + '**parts**, each with a `name`, and the two matchers read different kinds of part.\n\n'
        + `**Multipart field** reads a *text* part's value: \`${AM07_MULTIPART_FIELD}\` must be `
        + '`Q3 revenue report`. This is where the metadata lives in real uploads — a caption, an '
        + 'idempotency key, a small JSON blob describing the file.\n\n'
        + `**Multipart file** reads a *file* part's **filename**: the \`${AM07_MULTIPART_FILE_PART}\` `
        + `part must arrive as \`${AM07_MULTIPART_FILENAME}\`. It never looks at the bytes, so a `
        + 'multi-megabyte PDF costs nothing to match, and a rule can distinguish "a report was '
        + 'uploaded" from "an invoice was uploaded" without parsing either.\n\n'
        + 'Both rows are pairs, and both treat an empty value box as a presence check: "this part '
        + 'was sent, whatever it contains". Two conditions on one rule, ANDed — the caption and the '
        + 'filename must both be right.',
      highlight: API_MOCK.ROUTE_EXPLORER,
      preAction: ensureAm07Corpus,
      action: runAm07MultipartFields,
      verify: API_MOCK.LAST_CONDITION,
    },
    {
      id: 'prove-multipart',
      title: 'A real multipart body, matched with no server running',
      description:
        'Paste the payload a browser would actually produce — boundary lines, a '
        + '`Content-Disposition` header per part, the file part carrying its own `Content-Type` — '
        + 'and set the request `Content-Type` to `multipart/form-data` with the matching boundary. '
        + 'Expand **Body** so the whole payload is readable. Search `title` and hold on that text '
        + `part, then search \`${AM07_MULTIPART_FILENAME}\` — that is the \`${AM07_MULTIPART_FILE_PART}\` `
        + 'file part. Close the popup, **Save as sample**, name it, then **Run simulation** — the '
        + 'saved row is how you get this '
        + 'payload back; clicking a **From rules** probe will not.\n\n'
        + 'It comes back **MATCHED**, and both multipart rows tick in the trace. The boundary is '
        + 'the load-bearing detail: it comes from the header, and it is what lets the evaluator '
        + 'split the payload into parts at all. Send the same body with a mismatched boundary and '
        + 'neither matcher finds anything to read.\n\n'
        + 'The **Normalized** tab shows what the mock actually received — method, path, headers, '
        + 'and the raw body it split — and **Rendered** shows the `201` the rule answers with. All '
        + 'of it verified with no listener bound and no file ever uploaded.',
      highlight: API_MOCK.SIMULATE,
      preAction: ensureAm07MultipartConditions,
      action: async (ctx) => {
        await runAm07ProveMultipart(ctx);
      },
      verify: API_MOCK.LAST_CONDITION,
    },
    {
      id: 'xpath',
      title: 'SOAP payloads: let the toolbox write the XPath',
      description:
        `The third rule, \`${AM07_XML_RULE.method} ${AM07_XML_RULE.path}\`, answers a SOAP envelope. `
        + 'XML has its own pair of matchers, and the Pattern Toolbox has a tab for the harder one.\n\n'
        + `Start from the **${AM07_XPATH_PRESET}** preset. It looks odd — `
        + '`//*[local-name()=\'…\']` instead of a plain element name — and that shape is the whole '
        + 'lesson: a SOAP envelope is namespaced, so `//orderId` selects **nothing** while '
        + '`local-name()` finds the element whatever prefix it was sent with. Getting that wrong is '
        + 'the single most common XML matching mistake.\n\n'
        + 'Paste the real envelope as the sample and point the expression at the order id. The '
        + '**Resolved** box is a live read of that expression against the sample, so a typo shows '
        + `up as \`(no match)\` here rather than as a rule that never fires. Leave **Equals value** `
        + 'empty and the tick reports on `xpath_exists` — "the element is there". Fill in '
        + `\`${AM07_ORDER_ID}\` and the same row becomes \`xpath_equals\`. **Apply** lands it as an `
        + 'ordinary condition row.\n\n'
        + 'Then **Simulate** the same envelope. Ring **Run simulation**, wait for **Results**, '
        + 'and hold **MATCHED** — the `xpath_equals` row in the Decision trace is the proof '
        + 'the expression selected `A-1098`.',
      highlight: API_MOCK.ROUTE_EXPLORER,
      preAction: ensureAm07XmlBare,
      action: runAm07XPath,
      verify: API_MOCK.LAST_CONDITION,
    },
    {
      id: 'xml-schema',
      title: 'Required elements without the XSD ceremony',
      description:
        'XPath checks one value. A contract cares whether the envelope is *complete* — and for XML '
        + 'that usually means "these elements must be present", not a 200-line XSD.\n\n'
        + `The Schema tab's **${AM07_SCHEMA_PRESET}** preset flips it into XML mode, where the `
        + `expected value is just a list: \`${AM07_XML_ELEMENTS}\`. Names are matched by local name, `
        + 'so namespace prefixes are irrelevant here too, and the payload must be well-formed XML '
        + 'before any of them are looked for.\n\n'
        + 'The previous step already **MATCHED** the full envelope on XPath. This step judges the '
        + 'truncated one. After the body is pasted, **Request body** opens so you can search '
        + '`customer` — it is missing — then **Save as sample** and ring **Run simulation**. '
        + 'Hold **Results**: **UNMATCHED**. The `xpath_equals` row still ticks (the order id is '
        + 'present), and the ring lands on the red `body xmlSchema failed` row. That is the '
        + 'division of labour: XPath for the values you route on, an element list for the shape.',
      highlight: API_MOCK.PATH_TOOLBOX,
      preAction: ensureAm07XPathCondition,
      action: async (ctx) => {
        await runAm07XmlSchema(ctx);
      },
      verify: API_MOCK.LAST_CONDITION,
    },
    {
      id: 'binary',
      title: 'Pin an upload by its bytes — or by its digest',
      description:
        `The last rule, \`${AM07_BINARY_RULE.method} ${AM07_BINARY_RULE.path}\`, takes raw bytes: a `
        + 'firmware artifact. **Binary exact** is the obvious matcher — the payload must equal this '
        + 'exactly — and pasting a short blob shows how it works. It also shows why it does not '
        + 'scale: nobody pastes a real firmware image into a condition row.\n\n'
        + 'Switch the operator to **SHA-256** and the row asks for something else entirely. The '
        + 'value box hints `64-char hex digest`, and that digest is already sitting in your build '
        + 'output next to the artifact — so the matcher becomes one readable line that pins an '
        + 'exact build, survives code review, and never bloats the workspace.\n\n'
        + '**Save as sample** the matching payload, then **Run simulation**: **MATCHED**. Save the '
        + 'payload with a single character changed — `v2.4.1` instead of `v2.4.0` — as '
        + '**Publish Firmware (altered)** and run it: **UNMATCHED**. The ring lands on the red '
        + '`body binary_sha256 failed` row — one character in the payload, digest no longer '
        + 'matches. Both stay in the sample list so you can replay either later. That is the '
        + 'whole appeal of a digest matcher: it cannot be *almost* right.\n\n'
        + 'Four payload families, one grammar. The body source never changed; only the operator '
        + 'did, and every one of them was verified in Simulate before a port was ever bound.',
      highlight: API_MOCK.ROUTE_EXPLORER,
      preAction: ensureAm07Corpus,
      action: async (ctx) => {
        await runAm07Binary(ctx);
      },
      verify: API_MOCK.ROUTE_EXPLORER,
    },
  ],
};
