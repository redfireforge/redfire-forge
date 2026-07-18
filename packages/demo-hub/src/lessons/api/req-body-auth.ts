/** Lesson REQ-4: Request Body & Authentication */
import type { DemoLesson, DemoActionContext } from '../../types';
import { REQ } from '@shared/selectors';
import { fillControlledInput } from '../setup-helpers';
import {
  ensureRequestsTab,
  navigateToGalleryRequests,
  selectGalleryCard,
  importGallerySample,
  selectRequestByName,
  cleanupRequestsInCollection,
  shrinkAllCollections,
} from './req-demo-helpers';

const SAMPLE_ID = 'req-create-post';
const SAMPLE_NAME = 'Create a New Post';
const GALLERY_COL = 'Gallery Samples';
const DEMO_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiZGVtbyJ9.demo-sample-token';
const CURL_IMPORT_CMD = `curl -X POST https://httpbin.org/post \\
  -H 'Content-Type: application/json' \\
  -H 'X-Custom-Header: RedfireForge-Demo' \\
  -d '{"message": "Hello from cURL", "timestamp": "2026-07-17"}'`;

/** Ensure sample is imported and selected, silently. */
async function ensureSampleReady(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
    await navigateToGalleryRequests(ctx);
    await selectGalleryCard(ctx, SAMPLE_ID);
    await ctx.delay(150);
    await importGallerySample(ctx);
    await ctx.delay(200);
    ensureRequestsTab(ctx);
  }
  await selectRequestByName(ctx, SAMPLE_NAME);
}

export const reqBodyAuthLesson: DemoLesson = {
  id: 'req-body-auth',
  domainId: 'api',
  category: 'requests',
  name: 'Request Body & Authentication',
  description:
    'Learn to compose request bodies in JSON and Form Data modes, configure Bearer token ' +
    'authentication, and import/export requests using cURL commands.',
  estimatedMinutes: 5,
  initialTab: 'requests',
  allowedTabs: ['requests', 'gallery'],

  concept: {
    title: 'Bodies, Auth & cURL',
    body:
      'Every API call can carry a **body** (the payload you send) and **auth** (your identity proof).\n\n' +
      '**Body Modes:**\n' +
      '- **JSON** — structured data (most common for REST)\n' +
      '- **Form Data** — key-value pairs (file uploads, HTML forms)\n' +
      '- **Form URL Encoded** — encoded key-value pairs\n' +
      '- **XML / Plain Text / File** — other formats\n\n' +
      '**Auth Types:**\n' +
      '- **Bearer Token** — `Authorization: Bearer <token>` header\n' +
      '- **Basic Auth** — base64-encoded username:password\n' +
      '- **API Key** — custom header or query parameter\n' +
      '- **Inherit** — use the parent collection\'s auth\n\n' +
      '**cURL** is the universal language of HTTP. Import any cURL command to auto-fill ' +
      'the request, or export your request as cURL to share with teammates.',
    keyTerms: [
      { term: 'Body Mode', definition: 'Format of the request payload — JSON, Form Data, URL-Encoded, XML, etc.' },
      { term: 'Bearer Token', definition: 'Authorization header carrying a JWT or opaque token for API access' },
      { term: 'Auth Inheritance', definition: 'Requests inherit auth from their parent collection unless overridden' },
      { term: 'cURL Import', definition: 'Paste a cURL command to auto-populate method, URL, headers, and body' },
    ],
    diagram: `<svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="120" height="45" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="70" y="28" text-anchor="middle" fill="#3b82f6" font-size="9">Request</text>
      <text x="70" y="42" text-anchor="middle" fill="#94a3b8" font-size="8">POST + JSON Body</text>
      <path d="M130 32 L170 32" stroke="#94a3b8" stroke-width="1" marker-end="url(#arr)"/>
      <rect x="170" y="10" width="100" height="45" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="220" y="28" text-anchor="middle" fill="#f59e0b" font-size="9">Auth Layer</text>
      <text x="220" y="42" text-anchor="middle" fill="#94a3b8" font-size="8">Bearer Token</text>
      <path d="M270 32 L310 32" stroke="#94a3b8" stroke-width="1" marker-end="url(#arr)"/>
      <rect x="310" y="10" width="80" height="45" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="350" y="28" text-anchor="middle" fill="#10b981" font-size="9">Server</text>
      <text x="350" y="42" text-anchor="middle" fill="#94a3b8" font-size="8">201 Created</text>
      <rect x="10" y="75" width="380" height="35" rx="5" fill="#1e293b" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3"/>
      <text x="200" y="96" text-anchor="middle" fill="#94a3b8" font-size="9">curl -X POST ... -H 'Authorization: Bearer ...' -d '{...}'</text>
      <defs><marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#94a3b8" stroke-width="1"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ctx.navigateToTab('requests');
    await ctx.delay(150);
    await cleanupRequestsInCollection(ctx, GALLERY_COL, [SAMPLE_NAME]);
    await shrinkAllCollections();
  },

  cleanup: async (ctx) => {
    await cleanupRequestsInCollection(ctx, GALLERY_COL, [SAMPLE_NAME]);
    ctx.navigateToTab('requests');
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: Import Create Post from Gallery ──
    {
      id: 'req4-import-post',
      title: 'Import a POST Request',
      description:
        'Navigate to the **Gallery** and import the **"Create a New Post"** sample. ' +
        'This is a POST request to JSONPlaceholder with a JSON body — perfect for ' +
        'learning how body editing works.',
      highlight: REQ.galleryCard(SAMPLE_ID),
      preAction: async (ctx) => {
        const existing = document.querySelector(REQ.reqByName(SAMPLE_NAME));
        if (existing) return;
        await navigateToGalleryRequests(ctx);
      },
      action: async (ctx) => {
        if (document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          ensureRequestsTab(ctx);
          await selectRequestByName(ctx, SAMPLE_NAME);
          return;
        }
        await selectGalleryCard(ctx, SAMPLE_ID);
        await ctx.delay(300);
        await importGallerySample(ctx);
        await ctx.delay(400);
      },
    },

    // ── Step 2: JSON Body Editor ──
    {
      id: 'req4-json-body',
      title: 'The JSON Body Editor',
      description:
        'Click the **Body** tab to see the request payload. This POST sends a JSON object ' +
        'with `title`, `body`, and `userId` fields to create a new blog post.\n\n' +
        'The editor provides syntax highlighting and auto-formatting. The body type ' +
        'selector (top-left) shows **JSON** — you can switch to Form Data, XML, or other modes.',
      highlight: REQ.BODY_EDITOR,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await ensureSampleReady(ctx);
      },
      action: async (ctx) => {
        const bodyTab = document.querySelector<HTMLElement>(REQ.TAB_BODY);
        if (bodyTab) bodyTab.click();
        await ctx.delay(500);
      },
      verify: REQ.BODY_EDITOR,
    },

    // ── Step 3: Send POST ──
    {
      id: 'req4-send-post',
      title: 'Send the POST Request',
      description:
        'Click **Send** to fire the POST request to `jsonplaceholder.typicode.com/posts`. ' +
        'Watch the response: **201 Created** means the server accepted the new post. ' +
        'The response body includes a generated `id` field — proof the resource was created.',
      highlight: REQ.SEND_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        await ensureSampleReady(ctx);
        const bodyTab = document.querySelector<HTMLElement>(REQ.TAB_BODY);
        if (bodyTab) bodyTab.click();
      },
      action: async (ctx) => {
        await ctx.click(REQ.SEND_BTN);
        await ctx.delay(1000);
      },
      verify: REQ.STATUS_PILL,
    },

    // ── Step 4: Body Type Modes ──
    {
      id: 'req4-body-modes',
      title: 'Body Type Modes',
      description:
        'Click the **body type selector** (shows "JSON") to see all available modes:\n\n' +
        '- **Form Data** — key-value pairs with file upload support\n' +
        '- **Form URL Encoded** — classic HTML form submission format\n' +
        '- **JSON / XML / Plain Text** — raw text bodies\n' +
        '- **File** — binary payload\n' +
        '- **No Body** — for GET/DELETE requests\n\n' +
        'Each mode has its own editor (code textarea vs key-value grid).',
      highlight: REQ.BODY_TYPE_TRIGGER,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          await selectRequestByName(ctx, SAMPLE_NAME);
        }
        const bodyTab = document.querySelector<HTMLElement>(REQ.TAB_BODY);
        if (bodyTab) bodyTab.click();
      },
      action: async (ctx) => {
        const trigger = document.querySelector<HTMLElement>(REQ.BODY_TYPE_TRIGGER);
        if (trigger) trigger.click();
        await ctx.delay(800);

        const trigger2 = document.querySelector<HTMLElement>(REQ.BODY_TYPE_TRIGGER);
        if (trigger2) trigger2.click();
        await ctx.delay(300);
      },
    },

    // ── Step 5: Auth Tab ──
    {
      id: 'req4-auth-tab',
      title: 'The Auth Tab',
      description:
        'Click the **Auth** tab to see authentication options. By default, requests use ' +
        '**"Inherit from Collection"** — meaning they automatically use whatever auth ' +
        'is set on their parent collection.\n\n' +
        'You can override this per-request by selecting a different auth type.',
      highlight: REQ.TAB_AUTH,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          await selectRequestByName(ctx, SAMPLE_NAME);
        }
      },
      action: async (ctx) => {
        const authTab = document.querySelector<HTMLElement>(REQ.TAB_AUTH);
        if (authTab) authTab.click();
        await ctx.delay(500);
      },
      verify: REQ.AUTH_EDITOR,
    },

    // ── Step 6: Bearer Token ──
    {
      id: 'req4-bearer-token',
      title: 'Set Bearer Token Auth',
      description:
        'Select **Bearer Token** from the auth type dropdown. This adds an ' +
        '`Authorization: Bearer <token>` header to every request automatically.\n\n' +
        'The **Prefix** field defaults to "Bearer" (standard for JWTs). The **Token** ' +
        'field is where you paste your access token — it\'s sent with every request.',
      highlight: REQ.AUTH_TYPE_SELECT,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          await selectRequestByName(ctx, SAMPLE_NAME);
        }
        const authTab = document.querySelector<HTMLElement>(REQ.TAB_AUTH);
        if (authTab) authTab.click();
      },
      action: async (ctx) => {
        const select = document.querySelector<HTMLSelectElement>(REQ.AUTH_TYPE_SELECT);
        if (select) {
          select.value = 'bearer';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await ctx.delay(400);

        const tokenInput = document.querySelector<HTMLInputElement>(REQ.AUTH_TOKEN_INPUT);
        if (tokenInput) {
          tokenInput.focus();
          await ctx.delay(200);
          fillControlledInput(tokenInput, DEMO_TOKEN);
        }
        await ctx.delay(600);
      },
      verify: REQ.AUTH_BEARER_FIELDS,
    },

    // ── Step 7: cURL Import ──
    {
      id: 'req4-curl-import',
      title: 'Import from cURL',
      description:
        'Click the **action menu** (▾) and select **cURL Import**. Paste any `curl` ' +
        'command and click **Import & Apply** — the request method, URL, headers, ' +
        'and body are all populated automatically.\n\n' +
        'This is the fastest way to reproduce API calls from docs, browser DevTools, ' +
        'or teammate-shared snippets.',
      highlight: REQ.ACTION_MENU_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          await selectRequestByName(ctx, SAMPLE_NAME);
        }
        if (document.querySelector(REQ.CURL_IMPORT_PANEL)) {
          const backBtn = document.querySelector<HTMLElement>('.req-curl-actions .btn-ghost');
          if (backBtn) backBtn.click();
          await ctx.delay(150);
        }
        if (document.querySelector(REQ.CURL_EXPORT_PANEL)) {
          const closeBtn = document.querySelector<HTMLElement>('.req-curl-actions .btn-ghost');
          if (closeBtn) closeBtn.click();
          await ctx.delay(150);
        }
      },
      action: async (ctx) => {
        await ctx.click(REQ.ACTION_MENU_BTN);
        await ctx.delay(300);
        await ctx.waitFor(REQ.ACTION_DROPDOWN, 1500);
        const importBtn = document.querySelector<HTMLElement>(REQ.CURL_IMPORT_BTN);
        if (importBtn) importBtn.click();
        await ctx.delay(400);
        await ctx.waitFor(REQ.CURL_TEXTAREA, 2000);

        const textarea = document.querySelector<HTMLTextAreaElement>(REQ.CURL_TEXTAREA);
        if (textarea) {
          textarea.focus();
          await ctx.delay(200);
          fillControlledInput(textarea, CURL_IMPORT_CMD);
        }
        await ctx.delay(600);

        const applyBtn = document.querySelector<HTMLButtonElement>(REQ.CURL_APPLY_BTN);
        if (applyBtn) applyBtn.click();
        await ctx.delay(400);
      },
    },

    // ── Step 8: cURL Export ──
    {
      id: 'req4-curl-export',
      title: 'Export as cURL',
      description:
        'Click the **action menu** (▾) again and select **cURL Export**. The generated ' +
        'command includes your method, URL, headers, body, and auth — ready to paste ' +
        'into a terminal or share with your team.\n\n' +
        'This is useful for debugging, documentation, and reproducing requests outside the app.',
      highlight: REQ.ACTION_MENU_BTN,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (document.querySelector(REQ.reqByName(SAMPLE_NAME))) {
          await selectRequestByName(ctx, SAMPLE_NAME);
        }
        if (document.querySelector(REQ.CURL_IMPORT_PANEL)) {
          const backBtn = document.querySelector<HTMLElement>('.req-curl-actions .btn-ghost');
          if (backBtn) backBtn.click();
          await ctx.delay(150);
        }
        if (document.querySelector(REQ.CURL_EXPORT_PANEL)) {
          const closeBtn = document.querySelector<HTMLElement>('.req-curl-actions .btn-ghost');
          if (closeBtn) closeBtn.click();
          await ctx.delay(150);
        }
      },
      action: async (ctx) => {
        await ctx.click(REQ.ACTION_MENU_BTN);
        await ctx.delay(300);
        await ctx.waitFor(REQ.ACTION_DROPDOWN, 1500);
        const exportBtn = document.querySelector<HTMLElement>(REQ.CURL_EXPORT_BTN);
        if (exportBtn) exportBtn.click();
        await ctx.delay(400);
        await ctx.waitFor(REQ.CURL_EXPORT_PANEL, 2000);
        await ctx.delay(800);

        const closeBtn = document.querySelector<HTMLElement>('.req-curl-actions .btn-ghost');
        if (closeBtn) closeBtn.click();
        await ctx.delay(300);
      },
    },

    // ── Step 9: Summary ──
    {
      id: 'req4-summary',
      title: 'Bodies, Auth & cURL',
      description:
        'You\'ve learned the three pillars of request composition:\n\n' +
        '- **Body modes** — JSON for structured data, Form Data for uploads, and more\n' +
        '- **Authentication** — Bearer tokens, Basic auth, API keys — with inheritance ' +
        'from parent collections so you configure once\n' +
        '- **cURL round-trip** — import any cURL to populate requests, export to share\n\n' +
        'Next lesson: learn how to promote requests into the Test Harness for automated validation.',
      highlight: REQ.reqByName(SAMPLE_NAME),
      pauseAfter: true,
      preAction: async (ctx) => {
        ensureRequestsTab(ctx);
        if (document.querySelector(REQ.CURL_EXPORT_PANEL)) {
          const closeBtn = document.querySelector<HTMLElement>('.req-curl-actions .btn-ghost');
          if (closeBtn) closeBtn.click();
          await ctx.delay(150);
        }
      },
    },
  ],
};
