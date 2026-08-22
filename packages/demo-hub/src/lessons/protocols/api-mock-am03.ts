/**
 * AM-03 `am-03-rule-library` — Rule Library: Folders, Search, Filters & Docs.
 *
 * Scenario: a storefront mock that has outgrown a flat list. The twelve-rule library
 * arrives as a quiet corpus (it is the *subject*); every navigation, edit, and
 * metadata feature is exercised live.
 * Curriculum: `docs/plan/future/apimock/apimock-demo-curriculum-v2.md` §5 Track A.
 */
import { API_MOCK } from '@shared/selectors';
import type { DemoLesson } from '../../types';
import {
  AM03_DOCS_OPERATION_ID,
  AM03_DOCS_SUMMARY,
  AM03_DOCS_TAGS,
  AM03_DOCS_TAG_PROBE,
  AM03_NEW_FOLDER,
  AM03_SEARCH_TERM,
  AM03_TAG_TERM,
  cleanupAm03,
  ensureAm03DeleteTarget,
  ensureAm03DocsTarget,
  ensureAm03DraftsVisible,
  ensureAm03Library,
  ensureAm03SearchCleared,
  ensureAm03Tally,
  ensureAm03ToggleTarget,
  prepareAm03Workspace,
  runAm03DeleteUndo,
  runAm03Docs,
  runAm03EnableDisable,
  runAm03ExplorerTour,
  runAm03Filters,
  runAm03Folders,
  runAm03Health,
  runAm03Search,
} from './api-mock-am03-helpers';

const DIAGRAM = `
<svg viewBox="0 0 700 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Rule library anatomy: folders, row anatomy, search, filters, and the footer tally">
  <rect x="0" y="0" width="700" height="440" fill="#0f172a" />

  <text x="26" y="34" fill="#f1f5f9" font-family="system-ui" font-size="16" font-weight="600">A rule library you can navigate</text>

  <rect x="26" y="54" width="300" height="286" rx="8" fill="#1e293b" stroke="#3b4a60" />
  <text x="42" y="78" fill="#f1f5f9" font-family="system-ui" font-size="12" font-weight="600">Rules</text>
  <rect x="88" y="66" width="26" height="16" rx="8" fill="#0f172a" stroke="#3b4a60" />
  <text x="95" y="78" fill="#a8b8cc" font-family="ui-monospace" font-size="10">12</text>
  <rect x="120" y="66" width="22" height="16" rx="8" fill="#0f172a" stroke="#f59e0b" />
  <text x="127" y="78" fill="#f59e0b" font-family="ui-monospace" font-size="10">2</text>
  <rect x="216" y="64" width="94" height="20" rx="5" fill="#0f172a" stroke="#3b4a60" />
  <text x="224" y="78" fill="#64748b" font-family="system-ui" font-size="10">search…</text>

  <text x="46" y="108" fill="#a8b8cc" font-family="system-ui" font-size="11">▾ Catalog</text>
  <text x="116" y="108" fill="#64748b" font-family="ui-monospace" font-size="10">4</text>
  <rect x="58" y="118" width="252" height="20" rx="4" fill="#0f172a" stroke="#3b4a60" />
  <text x="66" y="132" fill="#22c55e" font-family="ui-monospace" font-size="9">GET</text>
  <text x="98" y="132" fill="#f1f5f9" font-family="ui-monospace" font-size="10">/products</text>
  <text x="272" y="132" fill="#a8b8cc" font-family="ui-monospace" font-size="9">P10</text>
  <rect x="58" y="142" width="252" height="20" rx="4" fill="#0f172a" stroke="#3b4a60" opacity="0.5" />
  <text x="66" y="156" fill="#22c55e" font-family="ui-monospace" font-size="9">GET</text>
  <text x="98" y="156" fill="#f1f5f9" font-family="ui-monospace" font-size="10">/products/search</text>
  <text x="272" y="156" fill="#a8b8cc" font-family="ui-monospace" font-size="9">P30</text>

  <text x="46" y="184" fill="#a8b8cc" font-family="system-ui" font-size="11">▾ Cart</text>
  <text x="96" y="184" fill="#64748b" font-family="ui-monospace" font-size="10">4</text>
  <rect x="58" y="194" width="252" height="20" rx="4" fill="#0f172a" stroke="#3b4a60" />
  <text x="66" y="208" fill="#3b82f6" font-family="ui-monospace" font-size="9">POST</text>
  <text x="104" y="208" fill="#f1f5f9" font-family="ui-monospace" font-size="10">/cart/items</text>
  <text x="272" y="208" fill="#a8b8cc" font-family="ui-monospace" font-size="9">P10</text>

  <text x="46" y="236" fill="#a8b8cc" font-family="system-ui" font-size="11">▾ Orders</text>
  <text x="104" y="236" fill="#64748b" font-family="ui-monospace" font-size="10">4</text>
  <rect x="58" y="246" width="252" height="20" rx="4" fill="#0f172a" stroke="#f59e0b" />
  <text x="66" y="260" fill="#22c55e" font-family="ui-monospace" font-size="9">GET</text>
  <text x="98" y="260" fill="#f1f5f9" font-family="ui-monospace" font-size="10">/orders/:id</text>
  <text x="268" y="260" fill="#f59e0b" font-family="ui-monospace" font-size="9">P50</text>
  <rect x="58" y="270" width="252" height="20" rx="4" fill="#0f172a" stroke="#f59e0b" />
  <text x="66" y="284" fill="#22c55e" font-family="ui-monospace" font-size="9">GET</text>
  <text x="98" y="284" fill="#f1f5f9" font-family="ui-monospace" font-size="10">/orders/latest</text>
  <text x="268" y="284" fill="#f59e0b" font-family="ui-monospace" font-size="9">P50</text>

  <line x1="26" y1="308" x2="326" y2="308" stroke="#3b4a60" />
  <text x="42" y="326" fill="#a8b8cc" font-family="system-ui" font-size="11">10 enabled · 2 drafts</text>
  <text x="238" y="326" fill="#3b82f6" font-family="system-ui" font-size="11">Analyze all</text>

  <text x="360" y="78" fill="#f1f5f9" font-family="system-ui" font-size="13" font-weight="600">Row anatomy</text>
  <text x="360" y="100" fill="#a8b8cc" font-family="system-ui" font-size="11">method · path · priority</text>
  <text x="360" y="118" fill="#64748b" font-family="system-ui" font-size="11">Amber priority = the analyzer</text>
  <text x="360" y="134" fill="#64748b" font-family="system-ui" font-size="11">found an overlapping peer.</text>
  <text x="360" y="150" fill="#64748b" font-family="system-ui" font-size="11">Dimmed row = draft: kept,</text>
  <text x="360" y="166" fill="#64748b" font-family="system-ui" font-size="11">never matched.</text>

  <text x="360" y="200" fill="#f1f5f9" font-family="system-ui" font-size="13" font-weight="600">Finding one rule in fifty</text>
  <text x="360" y="222" fill="#a8b8cc" font-family="system-ui" font-size="11">Search reads path, name, tag,</text>
  <text x="360" y="238" fill="#a8b8cc" font-family="system-ui" font-size="11">method and operationId.</text>
  <text x="360" y="260" fill="#a8b8cc" font-family="system-ui" font-size="11">Filters narrow by method,</text>
  <text x="360" y="276" fill="#a8b8cc" font-family="system-ui" font-size="11">drafts, and conflicts only.</text>

  <text x="360" y="310" fill="#f1f5f9" font-family="system-ui" font-size="13" font-weight="600">Documentation is structure</text>
  <text x="360" y="332" fill="#a8b8cc" font-family="system-ui" font-size="11">operationId ties a rule to its</text>
  <text x="360" y="348" fill="#a8b8cc" font-family="system-ui" font-size="11">OpenAPI operation; tags drive</text>
  <text x="360" y="364" fill="#a8b8cc" font-family="system-ui" font-size="11">search and exports.</text>

  <text x="26" y="376" fill="#f1f5f9" font-family="system-ui" font-size="13" font-weight="600">Nothing here is destructive by accident</text>
  <text x="26" y="400" fill="#a8b8cc" font-family="system-ui" font-size="12">Disable takes a rule out of matching but keeps it. Delete asks first, then offers a 5-second Undo (or Cmd/Ctrl+Z).</text>
  <text x="26" y="424" fill="#64748b" font-family="system-ui" font-size="11">Folders, order, drafts, and documentation all travel with the workspace and with exports.</text>
</svg>
`;

export const apiMockAm03Lesson: DemoLesson = {
  id: 'am-03-rule-library',
  domainId: 'api-mock',
  category: 'api-mock',
  name: 'Rule Library: Folders, Search, Filters & Docs',
  description:
    'Make a twelve-rule mock navigable: read the tree, search by path and tag, filter by draft '
    + 'and method, file rules into folders, disable safely, undo a delete, and document a rule.',
  estimatedMinutes: 6,
  initialTab: 'api-mock-studio',
  contentVersion: 1,
  concept: {
    title: 'When a mock outgrows a flat list',
    body:
      'Your first mock has three rules and you know all of them. The one you actually keep has forty: '
      + 'a catalog, a cart, an order flow, two half-finished experiments, and a rule someone added last '
      + 'sprint that quietly shadows another. At that size the bottleneck stops being *authoring* and '
      + 'becomes *finding* — which rule answers this path, which ones are switched off, and which two '
      + 'are fighting over the same request.\n\n'
      + 'The rule explorer is built for that scale. Every row states the three facts that decide '
      + 'matching: **method**, **path**, and **priority**. Rows the analyzer flagged carry an amber '
      + 'priority badge, and disabled rules render dimmed — still there, never matched. The footer keeps '
      + 'a running tally of enabled versus draft rules, which is the fastest health check you have on a '
      + 'library you did not write today.\n\n'
      + '**Folders** are how you keep that readable. They group by domain rather than by accident of '
      + 'creation order, they carry a count, they collapse, and they travel with the workspace and with '
      + 'exports. A rule can be filed by dragging it onto a folder, or from the Documentation tab if you '
      + 'prefer not to drag.\n\n'
      + '**Search and filters** are the other half. Search matches on path, name, tag, method, and '
      + 'operationId — so a tag you invented becomes a way to pull a set of rules out of the pile. '
      + 'Filters answer the two questions that only matter at scale: *show me only one method*, and '
      + '*hide the drafts* (or, after an analysis, *show me only the conflicts*).\n\n'
      + 'Two edits look destructive and are not. **Disable** keeps a rule and takes it out of matching '
      + '— the right move for an experiment you want back next week. **Delete** asks first, then gives '
      + 'you a five-second Undo window, and **Cmd/Ctrl+Z** does the same thing from the keyboard.\n\n'
      + 'The last piece is the **Documentation** tab, which looks optional and is not. A `summary` names '
      + 'the rule, an `operationId` ties it to a specific operation in your OpenAPI contract, and `tags` '
      + 'are real metadata: they drive search here, and they follow the rule into exports.',
    keyTerms: [
      { term: 'Folder', definition: 'A named group inside one server. Carries a rule count, collapses, accepts dragged rules, and is saved and exported with the workspace.' },
      { term: 'Priority badge', definition: 'The `P<n>` chip on each row. Higher priority wins when two rules match the same request; the badge turns amber once the analyzer flags an overlap.' },
      { term: 'Draft rule', definition: 'A disabled rule. It stays in the library and in exports but is skipped by matching and by conflict analysis — a parked experiment, not a deletion.' },
      { term: 'Search scope', definition: 'The search box matches path, rule name, tag, method, and operationId — so documentation you write becomes a way to find rules later.' },
      { term: 'Conflicts only', definition: 'A filter that hides everything except rules the last Analyze flagged as overlapping. Empty until you analyze, since conflicts are computed, not stored.' },
      { term: 'Undo window', definition: 'Deleting a rule shows a toast for five seconds. Undo (or Cmd/Ctrl+Z) restores the rule exactly as it was, including its folder and samples.' },
      { term: 'operationId', definition: 'The stable identifier of an operation in an OpenAPI contract. Setting it links a mock rule to the real spec so imports, exports, and reviews line up.' },
    ],
    diagram: DIAGRAM,
  },
  prepareBeforeNavigate: prepareAm03Workspace,
  cleanup: cleanupAm03,
  steps: [
    {
      id: 'explorer-tour',
      title: 'Read the tree before you touch it',
      description:
        'This workspace holds a storefront mock with twelve rules — the count beside **Rules** is the '
        + 'whole library, folders and drafts included. Three folders carry their own counts: **Catalog**, '
        + '**Cart**, and **Orders**. Then the row anatomy, which is the part worth memorising: a coloured '
        + '**method** chip, the **path** the rule matches, and a `P<n>` **priority** badge that decides who '
        + 'wins when two rules could both answer. Folders collapse — useful when one domain has thirty '
        + 'rules and you are working in another. The footer closes the tour with the tally that tells you '
        + 'how much of this library is actually live.',
      highlight: API_MOCK.ROUTE_EXPLORER,
      preAction: ensureAm03Library,
      action: runAm03ExplorerTour,
      verify: API_MOCK.ROUTE_EXPLORER,
    },
    {
      id: 'search',
      title: 'Search reads more than the path',
      description:
        `Typing **${AM03_SEARCH_TERM}** narrows the tree to the cart rules, and folders with no match drop `
        + 'out entirely rather than lingering as empty headers. Now the part people miss: search is not '
        + `path-only. **${AM03_TAG_TERM}** is a *tag*, not a path — and it pulls the three rules tagged that `
        + 'way out of three different folders. Method and `operationId` match too, so `POST` or '
        + '`createOrder` are both valid ways in. A term that matches nothing says so explicitly instead of '
        + 'showing an empty tree, and clearing the box restores the full library.',
      highlight: API_MOCK.ROUTE_SEARCH,
      preAction: ensureAm03SearchCleared,
      action: runAm03Search,
      verify: API_MOCK.ROUTE_ROW,
    },
    {
      id: 'filters',
      title: 'Filters: hide drafts, isolate a method',
      description:
        'The funnel opens three filters. **Show disabled** is on by default, which is why the two dimmed '
        + 'draft rows are visible right now — switch it off and they vanish from the tree while staying in '
        + 'the library and in the footer tally. **Conflicts only** is the third one, and it stays empty '
        + 'until an analysis has run, because conflicts are computed rather than stored (the closing step '
        + 'comes back to it). Then **Method**: pick `POST` and the tree collapses to just the write rules '
        + '— the fastest way to audit "what can mutate state here?" on a library you inherited.',
      highlight: API_MOCK.ROUTE_FILTER,
      preAction: ensureAm03DraftsVisible,
      action: runAm03Filters,
      verify: API_MOCK.DRAFT_ROUTE,
    },
    {
      id: 'folders',
      title: 'File rules into folders',
      description:
        `**Add folder** creates one immediately with a placeholder name — double-click the header to `
        + `rename it, and this one becomes **${AM03_NEW_FOLDER}**. Then the move: drag \`POST /orders\` out `
        + `of **Orders** and drop it onto **${AM03_NEW_FOLDER}**. The counts on both folders adjust, because `
        + 'a rule belongs to exactly one folder. Folders are organisation only — they never affect '
        + 'matching, priority, or the URL — but they are saved with the workspace and carried into exports, '
        + 'so the structure you build is the structure your team reads. The **Ungrouped** zone at the '
        + 'bottom is the other end of the same gesture: drop a rule there to take it out of every folder.',
      highlight: API_MOCK.ADD_FOLDER,
      preAction: ensureAm03DraftsVisible,
      action: runAm03Folders,
      verify: API_MOCK.folderNamed(AM03_NEW_FOLDER),
    },
    {
      id: 'enable-disable',
      title: 'Disable keeps the rule, drops it from matching',
      description:
        'With `GET /cart` open, the **Enabled** switch in the editor header is the safest edit in the '
        + 'Studio. Turn it off and three things happen at once: the row dims in the tree, the footer tally '
        + 'moves a rule from enabled to draft, and the matcher stops considering it — a request to '
        + '`/cart` now falls through to whatever else matches, or to the no-match fallback. Nothing is '
        + 'lost: the rule, its responses, and its documentation are all still there, which is exactly what '
        + 'you want for an experiment you will re-enable next sprint. Double-clicking a row in the tree is '
        + 'the same toggle without opening the rule.',
      highlight: API_MOCK.ROUTE_ENABLED,
      preAction: ensureAm03ToggleTarget,
      action: runAm03EnableDisable,
      verify: API_MOCK.ROUTE_ENABLED,
    },
    {
      id: 'delete-undo',
      title: 'Delete asks first, then lets you take it back',
      description:
        'Each row has a trash affordance, and it never deletes on the click. The confirm spells out the '
        + 'consequence — saved simulation samples that pointed at this rule become unassociated — and it '
        + 'tells you an Undo is coming. Accept, and the rule leaves the tree while a toast counts down for '
        + 'five seconds. **Undo** restores it complete: same responses, same folder, same documentation. '
        + '**Cmd+Z** (Ctrl+Z on Windows and Linux) does the same from the keyboard while the toast is up. '
        + 'After those five seconds the deletion is final, so the toast is the window that matters.',
      highlight: API_MOCK.ROUTE_EXPLORER,
      preAction: ensureAm03DeleteTarget,
      action: runAm03DeleteUndo,
      verify: API_MOCK.ROUTE_ROW,
    },
    {
      id: 'docs',
      title: 'Documentation is contract metadata',
      description:
        'The **Documentation** tab is not a comment box. Each field is contract metadata:\n\n'
        + '- **Folder** — files the rule without dragging, the keyboard-friendly counterpart to the drag you just did. This rule lives in `Catalog`.\n'
        + `- **Summary** — the rule's name, the label everything else shows (\`${AM03_DOCS_SUMMARY}\`).\n`
        + `- **Operation ID** — the identifier of the matching operation in your OpenAPI contract (\`${AM03_DOCS_OPERATION_ID}\`), which is what lets a spec import update the right rule instead of duplicating it.\n`
        + `- **Tags** — structured metadata that follow the rule into exports (\`${AM03_DOCS_TAGS}\`).\n\n`
        + `They also feed search, which we prove immediately by typing **${AM03_DOCS_TAG_PROBE}** into the rule search and watching this one rule surface out of twelve.`,
      highlight: API_MOCK.BTAB_DOCS,
      preAction: ensureAm03DocsTarget,
      action: runAm03Docs,
      verify: API_MOCK.DOCS_TAGS,
    },
    {
      id: 'library-health',
      title: 'The library health check',
      description:
        'Two numbers and one button tell you whether this library is in good shape. The footer tally '
        + 'splits the rule count into enabled versus draft — a library that is half drafts behaves very '
        + 'differently from what its size suggests. **Analyze all** then does the static pass and opens '
        + 'the **Conflict Inspector**: it compares every pair of *enabled* rules and flags overlaps, which '
        + 'is how `GET /orders/:id` and `GET /orders/latest` get caught — the parameterized rule captures '
        + 'the literal one, both sit at priority 50, and the equal-priority policy is **Reject as ambiguous**. '
        + 'Resolving them — priority, predicates, or policy — is this page\'s job.',
      highlight: API_MOCK.ANALYZE,
      preAction: ensureAm03Tally,
      action: runAm03Health,
      verify: API_MOCK.CONFLICT_INSPECTOR,
    },
  ],
};
