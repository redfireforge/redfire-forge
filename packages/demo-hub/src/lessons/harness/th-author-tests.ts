/**
 * TH-2 — Author Your First Tests
 *
 * 6 steps: create a Feature Group from scratch → add a Scenario →
 * open the Test Editor → configure URL + name + headers →
 * fetch a sample response via Selective Fields validation →
 * save and see the test in the tree hierarchy.
 *
 * Teaches the complete authoring flow through visible UI interactions.
 */
import type { DemoLesson } from '../../types';
import { HAR } from '@shared/selectors';
import {
  spotlight,
  spotlightSel,
  seedDemoEnvAndService,
  deleteTh2DemoFg,
  closeInlineNameFormQuiet,
  closeTestEditorQuiet,
  isTestEditorOpen,
  ensureTh2FgExists,
  ensureTh2ScenarioExists,
  expandFirstFg,
  expandFirstScenario,
  TH2_FG_NAME,
  TH2_TEST_URL,
} from './th-demo-helpers';

// ─── Lesson ──────────────────────────────────────────────────────

export const thAuthorTestsLesson: DemoLesson = {
  id: 'th-author-tests',
  domainId: 'harness',
  category: 'fundamentals',
  name: 'Author Your First Tests',
  description:
    'Create a Feature Group, add a Scenario, and write your first HTTP test — ' +
    'learn the Test Editor, configure a request, and fetch a sample response.',
  estimatedMinutes: 6,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],

  concept: {
    title: 'Building Tests From Scratch',
    body:
      'Every test in RedfireForge starts in the **Test Editor** — a full-featured ' +
      'HTTP request builder with tabs for parameters, headers, auth, body, and validation.\n\n' +
      '**The authoring workflow:**\n' +
      '1. Create a **Feature Group** to organize your tests\n' +
      '2. Add a **Scenario** — a logical container for related tests\n' +
      '3. Open the **Test Editor** and configure the HTTP request\n' +
      '4. Use **Fetch Response** to capture a live sample for validation setup\n' +
      '5. **Save** and see your test appear in the hierarchy\n\n' +
      '**In this lesson:** You will create everything from scratch using the UI — ' +
      'no imports, no templates. This is the foundation for all other Test Harness features.',
    keyTerms: [
      { term: 'Test Editor', definition: 'Modal dialog for configuring a single HTTP test — URL, method, headers, body, validation.' },
      { term: 'Property Card', definition: 'The top section of the Test Editor showing Name, Transport, URL, and HTTP Method.' },
      { term: 'Selective Fields', definition: 'Validation mode that lets you define rules for specific JSON fields in the response.' },
      { term: 'Fetch Response', definition: 'Sends the request once to capture a sample response — used to set up validation rules.' },
    ],
    diagram: `<svg viewBox="0 0 360 70" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="8" width="70" height="54" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="40" y="28" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">+ Feature</text>
      <text x="40" y="40" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Group</text>
      <text x="40" y="54" text-anchor="middle" fill="#94a3b8" font-size="6">organize</text>
      <path d="M80 35 L105 35" stroke="#64748b" stroke-width="1.2" marker-end="url(#th2arr)"/>
      <rect x="110" y="8" width="70" height="54" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="145" y="28" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">+ Scenario</text>
      <text x="145" y="42" text-anchor="middle" fill="#94a3b8" font-size="6">Standard</text>
      <text x="145" y="54" text-anchor="middle" fill="#94a3b8" font-size="6">container</text>
      <path d="M185 35 L210 35" stroke="#64748b" stroke-width="1.2" marker-end="url(#th2arr)"/>
      <rect x="215" y="8" width="70" height="54" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="250" y="24" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Test Editor</text>
      <text x="250" y="36" text-anchor="middle" fill="#94a3b8" font-size="6">URL · Method</text>
      <text x="250" y="48" text-anchor="middle" fill="#94a3b8" font-size="6">Headers · Body</text>
      <text x="250" y="58" text-anchor="middle" fill="#94a3b8" font-size="6">Validation</text>
      <path d="M290 35 L315 35" stroke="#64748b" stroke-width="1.2" marker-end="url(#th2arr)"/>
      <rect x="320" y="15" width="35" height="40" rx="5" fill="#1e293b" stroke="#a855f7" stroke-width="1.5"/>
      <text x="337" y="33" text-anchor="middle" fill="#a855f7" font-size="7" font-weight="700">Save</text>
      <text x="337" y="46" text-anchor="middle" fill="#94a3b8" font-size="6">✓</text>
      <defs><marker id="th2arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  // ── Setup ──────────────────────────────────────────────────────
  setup: async (ctx) => {
    ctx.navigateToTab('scenarios');
    await ctx.delay(300);
    deleteTh2DemoFg();
    closeInlineNameFormQuiet();
    await closeTestEditorQuiet(ctx);
    await ctx.delay(200);
  },

  // ── Cleanup ────────────────────────────────────────────────────
  cleanup: async (ctx) => {
    await closeTestEditorQuiet(ctx);
    closeInlineNameFormQuiet();
    deleteTh2DemoFg();
    delete (window as unknown as Record<string, unknown>).__demoTh2Ids;
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Create a Feature Group ─────────────────────────────
    {
      id: 'th2-create-fg',
      title: 'Create a Feature Group',
      description:
        'Let\'s start from scratch. Click **+ Add Feature Group** to create a new container ' +
        'for your tests.\n\n' +
        'Feature Groups are the top-level organizer — group your tests by **API area** ' +
        '(User API, Orders API), **business domain** (Checkout, Payments), or **team ownership** ' +
        '(Backend Team, Mobile API).\n\n' +
        'We\'ll name ours "JSONPlaceholder API" — a free test API we\'ll use throughout this lesson.',
      highlight: HAR.ADD_FG_BTN,

      preAction: async (ctx) => {
        ctx.navigateToTab('scenarios');
        await ctx.delay(200);
        closeInlineNameFormQuiet();
        await closeTestEditorQuiet(ctx);
        const ids = await seedDemoEnvAndService(ctx);
        if (ids) {
          (window as unknown as Record<string, unknown>).__demoTh2Ids = ids;
        }
      },

      action: async (ctx) => {
        let ids = (window as unknown as Record<string, unknown>).__demoTh2Ids as { envId: string; svcId: string } | undefined;
        if (!ids) {
          ids = (await seedDemoEnvAndService(ctx)) ?? undefined;
          if (ids) (window as unknown as Record<string, unknown>).__demoTh2Ids = ids;
        }
        await ctx.delay(400);

        await ctx.click(HAR.ADD_FG_BTN);
        await ctx.waitFor(HAR.FG_NAME_INPUT, 3000);
        await ctx.delay(600);

        await ctx.fill(HAR.FG_NAME_INPUT, TH2_FG_NAME);
        await ctx.delay(600);

        await ctx.click('.inline-name-form .btn.btn-primary');
        await ctx.delay(800);

        const fgCard = document.querySelector<HTMLElement>(HAR.FG_CARD);
        if (fgCard) await spotlight(fgCard, 1500, ctx);
      },

      verify: HAR.FG_CARD,
    },

    // ── Step 2: Create a Test Scenario ─────────────────────────────
    {
      id: 'th2-create-scenario',
      title: 'Create a Test Scenario',
      description:
        'Inside your Feature Group, click **+ Scenario** to create a logical container ' +
        'for related tests.\n\n' +
        'Scenarios come in two kinds:\n' +
        '- **Standard** — each test runs once per iteration (what we\'ll use now)\n' +
        '- **Parameterized** — tests run once per data row from a CSV/JSON source\n\n' +
        'We\'ll create a Standard scenario called "User Endpoints" to hold our user API tests.',
      highlight: HAR.ADD_SCENARIO_BTN,

      preAction: async (ctx) => {
        ctx.navigateToTab('scenarios');
        await ctx.delay(200);
        closeInlineNameFormQuiet();
        await closeTestEditorQuiet(ctx);
        await ensureTh2FgExists(ctx);
        await expandFirstFg(ctx);
      },

      action: async (ctx) => {
        await expandFirstFg(ctx);
        await ctx.delay(400);

        await ctx.click(HAR.ADD_SCENARIO_BTN);
        await ctx.waitFor(HAR.SCENARIO_NAME_INPUT, 3000);
        await ctx.delay(600);

        await ctx.fill(HAR.SCENARIO_NAME_INPUT, 'User Endpoints');
        await ctx.delay(600);

        await ctx.click('.inline-name-form.nested .btn.btn-primary');
        await ctx.delay(800);

        const scenarioCard = document.querySelector<HTMLElement>(HAR.SCENARIO_CARD);
        if (scenarioCard) await spotlight(scenarioCard, 1500, ctx);
      },

      verify: HAR.SCENARIO_CARD,
    },

    // ── Step 3: Open the Test Editor ───────────────────────────────
    {
      id: 'th2-open-editor',
      title: 'Open the Test Editor',
      description:
        'Click **+ Test** to open the **Test Editor** — a full-featured HTTP request builder.\n\n' +
        'At the top is the **Property Card** with the test name, transport type (HTTP, WebSocket, Kafka), ' +
        'the HTTP method selector, and the URL field.\n\n' +
        'Below that, tabs configure different aspects of the request: ' +
        '**Params** for query parameters, **Auth** for authentication, **Headers** for custom headers, ' +
        '**Validation** for response rules, and **Extract** for extracting values from responses.',
      highlight: HAR.ADD_TEST_BTN,

      preAction: async (ctx) => {
        ctx.navigateToTab('scenarios');
        await ctx.delay(200);
        closeInlineNameFormQuiet();
        await ensureTh2ScenarioExists(ctx);
        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
      },

      action: async (ctx) => {
        if (!isTestEditorOpen()) {
          await expandFirstFg(ctx);
          await expandFirstScenario(ctx);
          await ctx.delay(300);

          await ctx.click(HAR.ADD_TEST_BTN);
          await ctx.waitFor(HAR.TE_PROP_CARD, 5000);
          await ctx.delay(800);
        }

        await spotlightSel(ctx, HAR.TE_PROP_CARD, 1500);

        await spotlightSel(ctx, HAR.TE_TABS, 1200);
      },

      verify: HAR.TE_PROP_CARD,
    },

    // ── Step 4: Configure the HTTP Request ─────────────────────────
    {
      id: 'th2-configure-request',
      title: 'Configure the HTTP Request',
      description:
        'Now let\'s configure the request. The **URL** field accepts a full URL or a relative ' +
        'path (resolved against the environment\'s base URL).\n\n' +
        'We\'ll target the JSONPlaceholder API to fetch a single user\'s data. ' +
        'Then we\'ll give the test a descriptive **name** and add an `Accept` header ' +
        'to explicitly request JSON.\n\n' +
        'The **GET** method is already selected by default — perfect for a read-only endpoint.',
      highlight: HAR.TE_URL_INPUT,

      preAction: async (ctx) => {
        if (!isTestEditorOpen()) {
          ctx.navigateToTab('scenarios');
          await ctx.delay(200);
          await ensureTh2ScenarioExists(ctx);
          await expandFirstFg(ctx);
          await expandFirstScenario(ctx);
          await ctx.delay(200);
          const addBtn = document.querySelector<HTMLElement>(HAR.ADD_TEST_BTN);
          if (addBtn) {
            addBtn.click();
            await ctx.delay(500);
          }
        }
      },

      action: async (ctx) => {
        await spotlightSel(ctx, HAR.TE_URL_INPUT, 800);
        await ctx.fill(HAR.TE_URL_INPUT, TH2_TEST_URL);
        await ctx.delay(800);

        await spotlightSel(ctx, HAR.TE_NAME_INPUT, 600);
        await ctx.fill(HAR.TE_NAME_INPUT, 'Get User by ID');
        await ctx.delay(800);

        // Switch to Headers tab
        const headerTab = Array.from(document.querySelectorAll<HTMLElement>('.builder-tab'))
          .find(t => t.textContent?.includes('Headers'));
        if (headerTab) {
          headerTab.click();
          await ctx.delay(800);
        }

        // Spotlight the headers section
        await spotlightSel(ctx, HAR.TE_HEADERS_SECTION, 600);

        // Fill the first header row (default empty row exists)
        const keyInputs = document.querySelectorAll<HTMLInputElement>('.kv-section .kv-row input');
        if (keyInputs.length >= 2) {
          keyInputs[0].focus();
          await ctx.delay(200);
          await ctx.fill('.kv-section .kv-row input:first-child', 'Accept');
          await ctx.delay(400);
          await ctx.fill('.kv-section .kv-row input:nth-child(2)', 'application/json');
          await ctx.delay(600);
        }
      },

      verify: HAR.TE_URL_INPUT,
    },

    // ── Step 5: Fetch a Sample Response ────────────────────────────
    {
      id: 'th2-fetch-response',
      title: 'Fetch a Sample Response',
      description:
        'Switch to the **Validation** tab and select **Selective Fields** mode — this ' +
        'enables field-level validation where you can define rules for specific JSON paths.\n\n' +
        'Click **Fetch Response** to send the request once and capture a live sample. ' +
        'The response preview shows the actual JSON data — you can see fields like ' +
        '`name`, `email`, `phone`, and `company` that you\'ll later validate.\n\n' +
        'This captured response becomes the foundation for building validation rules.',
      highlight: HAR.TE_TABS,

      preAction: async (ctx) => {
        if (!isTestEditorOpen()) {
          ctx.navigateToTab('scenarios');
          await ctx.delay(200);
          await ensureTh2ScenarioExists(ctx);
          await expandFirstFg(ctx);
          await expandFirstScenario(ctx);
          await ctx.delay(200);
          const addBtn = document.querySelector<HTMLElement>(HAR.ADD_TEST_BTN);
          if (addBtn) {
            addBtn.click();
            await ctx.delay(500);
          }
        }
        // Ensure URL and name are filled (quiet — preAction uses quiet ctx)
        const urlInput = document.querySelector<HTMLInputElement>(HAR.TE_URL_INPUT);
        if (urlInput && !urlInput.value) {
          await ctx.fill(HAR.TE_URL_INPUT, TH2_TEST_URL);
          await ctx.delay(200);
        }
        const nameInput = document.querySelector<HTMLInputElement>(HAR.TE_NAME_INPUT);
        if (nameInput && !nameInput.value) {
          await ctx.fill(HAR.TE_NAME_INPUT, 'Get User by ID');
          await ctx.delay(200);
        }
      },

      action: async (ctx) => {
        // Switch to the Validation tab
        const validationTab = Array.from(document.querySelectorAll<HTMLElement>('.builder-tab'))
          .find(t => t.textContent?.includes('Validation'));
        if (validationTab) {
          validationTab.click();
          await ctx.delay(800);
        }

        // Select Selective Fields mode
        const radios = document.querySelectorAll<HTMLInputElement>('input[name="validationMode"]');
        if (radios.length >= 3 && !radios[2].checked) {
          radios[2].click();
          await ctx.delay(800);
        }

        // Spotlight the Fetch Response button
        const fetchBtn = document.querySelector<HTMLElement>(HAR.TE_FETCH_BTN);
        if (fetchBtn) {
          await spotlight(fetchBtn, 1000, ctx);

          await ctx.click(HAR.TE_FETCH_BTN);

          // Wait for response to arrive (max 8 seconds)
          const start = Date.now();
          while (Date.now() - start < 8000) {
            const preview = document.querySelector<HTMLElement>(HAR.TE_RESPONSE_PREVIEW);
            if (preview && preview.textContent && preview.textContent.length > 20) break;
            await ctx.delay(500);
          }
          await ctx.delay(500);
        }

        // Spotlight the response preview
        const preview = document.querySelector<HTMLElement>(HAR.TE_RESPONSE_PREVIEW);
        if (preview) {
          await spotlight(preview, 2000, ctx);
        }
      },

      verify: HAR.TE_FETCH_BTN,
    },

    // ── Step 6: Save and See the Tree ──────────────────────────────
    {
      id: 'th2-save-test',
      title: 'Save and See the Tree',
      description:
        'Click **Save** in the editor header to save your test and close the modal.\n\n' +
        'Your new test appears in the tree hierarchy: ' +
        '**JSONPlaceholder API** → **User Endpoints** → **Get User by ID** with a GET badge.\n\n' +
        'From here you can edit the test anytime by clicking it, add more tests with + Test, ' +
        'or head to the Test Runner to execute your suite.',
      highlight: HAR.TEST_CARD,

      preAction: async (ctx) => {
        if (!isTestEditorOpen()) {
          await ensureTh2ScenarioExists(ctx);
        }
      },

      action: async (ctx) => {
        if (isTestEditorOpen()) {
          await ctx.click(HAR.TE_SAVE_BTN);
          await ctx.delay(1000);
        }

        // Expand the tree to show the full hierarchy
        await expandFirstFg(ctx);
        await expandFirstScenario(ctx);
        await ctx.delay(600);

        // Spotlight the test card — the lesson payoff
        const testCard = document.querySelector<HTMLElement>(HAR.TEST_CARD);
        if (testCard) await spotlight(testCard, 1800, ctx);
      },

      verify: HAR.TEST_CARD,
    },
  ],
};
