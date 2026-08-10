import type { DemoLesson } from '../../types';

export const STEP_REQ3_CREATE_DESC = `Click **+** to see Group / URL Collection / **ENV Collection**. Choose **ENV Collection**, then name it **"DummyJSON"**.
Open the **Linked Microservice** dropdown to see the two ways a collection gets its base URLs:

- **None (manual config)** — you type each environment's base URL **by hand** on this collection. Best for quick,
one-off APIs that aren't modeled as a shared microservice.
- **A microservice** (e.g. *product-api*) — the collection **inherits** its base URLs from **Settings → Environments**
automatically. Those rows become **read-only** and stay in sync: change a host once in Settings and every linked
collection updates.

We keep **None (manual config)** here, then review the **Base URLs per Environment** map, fill the **production** and
**staging** rows (both \`https://dummyjson.com\`), review Default Auth, and save. (We'll build a Linked Microservice
collection later in this lesson.)`;

export const STEP_REQ3_LINKED_SVC_DESC = `Now create a **second** ENV collection — but this time, select a **Linked Microservice** instead of
"None (manual config)". Open Settings to create the **product-api** microservice, click **Configure**,
add the **HTTP** protocol, enable deploy checkboxes for **production** and **staging**,
then **Edit** each base URL (\`https://dummyjson.com\`). Finally, create the **Product Service** collection
linked to it. Notice the base URLs are **read-only** — they come from the microservice config automatically.`;

export const reqMultiEnvConcept: DemoLesson['concept'] = {
  title: 'One Request, Multiple Targets',
  body:
    'A **Multi-Environment (ENV) Collection** stores a base URL map and lets requests use '
    + 'relative paths. You write one path once, then switch environments with a single click.\n\n'
    + '**What this lesson demonstrates:**\n'
    + '- Creating Settings environments before collection setup\n'
    + '- **Manual config:** Creating an ENV collection with base URLs typed by hand\n'
    + '- **Linked Microservice:** Creating an ENV collection that pulls base URLs from a Settings microservice\n'
    + '- Adding a request with a relative path (`/products/search?...`)\n'
    + '- Using the env pill to switch targets and re-send quickly\n\n'
    + '**Why this matters:**\n'
    + '- No URL rewrites when moving between environments\n'
    + '- Linked Microservice mode auto-syncs URLs from Settings — change once, update everywhere\n'
    + '- Ready for per-environment auth inheritance in larger projects',
  keyTerms: [
    { term: 'ENV Collection', definition: 'Collection mode where requests use relative paths with environment base URLs' },
    { term: 'Linked Microservice', definition: 'Collection setting that pulls base URLs from a Settings microservice instead of manual entry' },
    { term: 'Base URL Map', definition: 'Environment-to-host mapping stored at collection level or from a microservice' },
    { term: 'Relative Path', definition: 'Request path without host, resolved with the active environment base URL' },
    { term: 'Resolved URL', definition: 'Live preview of full URL after host + path composition' },
    { term: 'Env Pill', definition: 'Clickable badge that switches the active environment base URL' },
  ],
  diagram: `<svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="130" y="5" width="140" height="28" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="200" y="23" text-anchor="middle" fill="#10b981" font-size="10">ENV Collection: DummyJSON</text>
      <path d="M160 33 L80 55" stroke="#3b4a60" stroke-width="1"/>
      <path d="M240 33 L320 55" stroke="#3b4a60" stroke-width="1"/>
      <rect x="20" y="55" width="120" height="24" rx="4" fill="#1e293b" stroke="#3b82f6" stroke-width="1"/>
      <text x="80" y="71" text-anchor="middle" fill="#3b82f6" font-size="9">production: dummyjson.com</text>
      <rect x="260" y="55" width="120" height="24" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="1"/>
      <text x="320" y="71" text-anchor="middle" fill="#f59e0b" font-size="9">staging: dummyjson.com</text>
      <path d="M200 33 L200 90" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3"/>
      <rect x="110" y="90" width="180" height="22" rx="4" fill="#1e293b" stroke="#94a3b8" stroke-width="1"/>
      <text x="200" y="105" text-anchor="middle" fill="#f1f5f9" font-size="9">/products/search?q=laptop&limit=3</text>
    </svg>`,
};
