import type { DemoLesson } from '../../types';

type LessonConcept = DemoLesson['concept'];

export const reqSendHarnessLessonDescription =
  'Create a request, set up a demo environment and microservice target, then promote '
  + 'into the Test Harness. Learn the full promotion flow: target selection, confirmation, '
  + 'the IN HARNESS badge, and batch collection promotion.';

export const reqSendHarnessConcept: LessonConcept = {
  title: 'From Exploration to Automated Testing',
  body:
    '**Requests** are for exploring APIs. The **Test Harness** runs repeatable, validated suites.\n\n'
    + '### Harness Hierarchy\n\n'
    + 'Tests live in a **three-level structure** — think of it like folders:\n\n'
    + '- **Feature Group** — the top-level container (e.g. *API Tests*). Holds one or more scenarios, plus shared settings like auth inheritance.\n'
    + '- **Scenario** — a logical grouping inside a feature group (e.g. *User Endpoints*). Organizes related tests together.\n'
    + '- **Test** — a single executable request snapshot with its own method, URL, headers, body, auth config, and validation rules.\n\n'
    + '### Promotion Wizard\n\n'
    + '**Send to Harness** uses a **2-step wizard** to place a request into this hierarchy:\n\n'
    + '**Step 1 — Target:** A cascading selector narrows where the test lands:\n'
    + '- **Environment** + **Microservice** — must already exist in Settings\n'
    + '- **Feature Group** + **Scenario** — select existing or create new\n\n'
    + '**Step 2 — Options:** Configure the snapshot:\n'
    + '- **Auth Mode** — *Snapshot* freezes current auth; *Inherit* uses Harness environment auth\n'
    + '- **Validation** — *None* or *Status 200* (auto-assert HTTP 200 OK)\n\n'
    + 'The promoted test is a **one-time snapshot** — editing the original request does **not** change the test.\n\n'
    + '**Batch Promote** (right-click a collection) sends all requests at once, preserving folder structure as scenarios.',
  keyTerms: [
    { term: 'Feature Group', definition: 'Top-level container that holds scenarios, shared auth, and toolbar actions (Rename, Import, Export, History)' },
    { term: 'Scenario', definition: 'A grouping of related tests inside a feature group (e.g. "User Endpoints")' },
    { term: 'Test', definition: 'A single frozen request snapshot with method, URL, headers, auth, and validation rules' },
    { term: 'Promotion', definition: 'Snapshot a request into the hierarchy via the 2-step wizard (one-time copy)' },
    { term: 'Auth Mode', definition: 'Snapshot (freeze current auth) or Inherit (use Harness environment auth at runtime)' },
    { term: 'IN HARNESS Badge', definition: 'Visual indicator on the sidebar that a request has been promoted' },
  ],
  diagram: `<svg viewBox="0 0 400 170" xmlns="http://www.w3.org/2000/svg">
    <text x="200" y="14" text-anchor="middle" fill="#94a3b8" font-size="8" font-weight="bold">HARNESS HIERARCHY</text>
    <rect x="100" y="22" width="200" height="28" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
    <text x="200" y="40" text-anchor="middle" fill="#f59e0b" font-size="9">Feature Group</text>
    <path d="M200 50 L200 58" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#arr5)"/>
    <rect x="120" y="60" width="160" height="24" rx="4" fill="#1e293b" stroke="#a855f7" stroke-width="1.3"/>
    <text x="200" y="76" text-anchor="middle" fill="#a855f7" font-size="8">Scenario</text>
    <path d="M200 84 L200 92" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#arr5)"/>
    <rect x="140" y="94" width="120" height="24" rx="4" fill="#1e293b" stroke="#10b981" stroke-width="1.3"/>
    <text x="200" y="110" text-anchor="middle" fill="#10b981" font-size="8">Test (snapshot)</text>
    <text x="200" y="138" text-anchor="middle" fill="#94a3b8" font-size="8" font-weight="bold">PROMOTION FLOW</text>
    <rect x="10" y="146" width="70" height="20" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1.2"/>
    <text x="45" y="160" text-anchor="middle" fill="#3b82f6" font-size="7">Request</text>
    <path d="M80 156 L105 156" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#arr5)"/>
    <rect x="107" y="146" width="90" height="20" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="1.2"/>
    <text x="152" y="160" text-anchor="middle" fill="#f59e0b" font-size="7">Step 1: Target</text>
    <path d="M197 156 L215 156" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#arr5)"/>
    <rect x="217" y="146" width="95" height="20" rx="4" fill="#1e293b" stroke="#a855f7" stroke-width="1.2"/>
    <text x="265" y="160" text-anchor="middle" fill="#a855f7" font-size="7">Step 2: Options</text>
    <path d="M312 156 L330 156" stroke="#94a3b8" stroke-width="1.2" marker-end="url(#arr5)"/>
    <rect x="332" y="146" width="60" height="20" rx="4" fill="#1e293b" stroke="#10b981" stroke-width="1.2"/>
    <text x="362" y="160" text-anchor="middle" fill="#10b981" font-size="7">Test</text>
    <defs><marker id="arr5" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#94a3b8" stroke-width="1"/></marker></defs>
  </svg>`,
};

export const reqSendHarnessStepDescriptions = {
  env:
    'Open **Settings** and create the promotion target. Add environment **"demo"**, then add microservice **"jsonplaceholder"**. Click **Configure**, add the **HTTP** protocol, enable the deploy checkbox, and set the base URL to `https://jsonplaceholder.typicode.com`.\n\nThis gives the Test Harness a destination before we create and promote a request.',
  setup:
    'Now create the request to promote. Add a **"Promotion Demo"** URL Collection and a **"Get Users"** request pointed at `jsonplaceholder.typicode.com/users` — notice it opens in its own **tab**. Send it to confirm it returns **200 OK**.\n\nWith the demo target already in place, this request is ready to promote into the Test Harness.',
  promote:
    'Back on the request, click **"Send to Harness"**. The promotion modal has a **2-step flow**:\n\n**Step 1 — Target:** Select where the test will live:\n- Environment (**demo**)\n- Microservice (**jsonplaceholder**)\n- Feature Group (create **"API Tests"**)\n- Scenario (create **"User Endpoints"**)\n\nEach cascade narrows the next — like a folder path for your test.',
  confirm:
    'Click **Next** to advance to the **Options** panel. At the top you\'ll see a **target breadcrumb** — the full path where the test will land: `demo / jsonplaceholder / API Tests / User Endpoints`.\n\nBelow that is a **preview card** showing the frozen snapshot: HTTP method, absolute URL, and auth type.\n\n**Auth Mode** — choose how auth is handled:\n- **Snapshot** (default): freezes the current auth config into the test\n- **Inherit**: uses whatever auth is configured on the Harness environment\n\n**Validation** — choose an initial assertion preset:\n- **None**: no assertions (add them manually later)\n- **Status 200**: auto-creates an assertion for HTTP 200 OK',
  explore:
    'Click **"Send to Harness"** to confirm. After promotion, notice the **IN HARNESS** badge on the request in the sidebar — a visual reminder that this request has been promoted to automated testing.\n\nNavigate to **Feature Groups** to see where your test landed. Expand the **API Tests** feature group and its **User Endpoints** scenario to reveal the promoted **Get Users** test.\n\n**Feature Group toolbar:**\n- **Rename** — change the group name\n- **Auth** — set auth inherited by all scenarios\n- **+ Scenario** — add a new test scenario\n- **Import** / **Export** — transfer scenarios as JSON\n- **History** — view structural change log\n- **Delete** — remove the entire group\n\n**Test row badges** show the HTTP method, auth source, and validation mode at a glance.',
  edit:
    'Click **Edit** to open the test editor. This is the promoted snapshot — completely independent from the original request.\n\nThe editor shows:\n- **Name** — the test name (editable)\n- **Method + URL** — the frozen HTTP method and endpoint\n- **Headers** — any request headers that were captured\n- **Body** — the request body (if POST/PUT/PATCH)\n- **Auth** — the auth config (snapshot or inherited)\n- **Validation** — assertion rules (status code, response time, headers, body fields)\n\nYou can modify any of these fields. Changes only affect this test — the original request stays untouched.',
  batch:
    'First, add a second request — **"Get Todos"** — so the collection has multiple items.\n\nThen right-click the collection and select **"Send to Harness"**. The batch wizard also has **2 steps**:\n\n**Step 1 — Target:** Pick the Environment and Microservice.\n\n**Step 2 — Requests:** The viewer sees:\n- A **request checklist** with select/deselect all — choose which requests to promote\n- A **preview summary** showing how many Feature Groups, Scenarios, and Tests will be created\n- **Auth Mode** and **Validation** options applied to all tests at once\n\nFolder structure is preserved: each folder becomes a Test Scenario.',
} as const;