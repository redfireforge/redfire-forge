/**
 * CAT-5 — Convert Swagger 2.0 → OpenAPI 3
 *
 * 5 steps (consolidated from 9): select the Swagger 2.0 API and see the format
 * badge → open the converter and choose engine + target → validate + search +
 * deep lint → prettify the output → save as a new version.
 *
 * Combined steps for better pacing: engine + target in one step, search + lint
 * in one step. The viewer sees a cohesive flow instead of 9 tiny actions.
 *
 * Seeding runs through the `catalogConvertAdapter` bridge; no Import modal steps.
 */
import type { DemoLesson } from '../../types';
import { CAT } from '@shared/selectors';
import {
  DEMO_CATALOG_NAME,
  resetDemoCatalog,
  ensureSeededEntryExists,
  ensureSeededAndSelected,
  ensureConvertModalOpen,
  ensureConvertEngineScalar,
  ensureConvertTarget,
  ensureConvertPrettyToggle,
  cleanupDemoCatalog,
  ensureCatalogTab,
  ensureCatalogOverviewView,
  spotlight,
} from './cat-demo-helpers';

export const catConvertOpenApiLesson: DemoLesson = {
  id: 'cat-convert-openapi',
  domainId: 'api',
  category: 'catalog',
  name: 'Convert Swagger 2.0 → OpenAPI 3',
  description:
    'Take a legacy Swagger 2.0 spec and convert it to OpenAPI 3.0/3.1 in-app — pick an engine, ' +
    'validate the output, deep-lint it, and save the result as a new Catalog version.',
  estimatedMinutes: 4,
  initialTab: 'catalog',
  allowedTabs: ['catalog'],

  concept: {
    title: 'From Swagger 2.0 to OpenAPI 3 — Without Leaving the App',
    body:
      'Most codegen toolchains (OpenAPI Generator, Spring Boot 3, Kubernetes API gateways) ' +
      'expect **OpenAPI 3.x** — but plenty of legacy APIs still ship **Swagger 2.0**. The Catalog ' +
      'converts them for you, offline, with a validation gate so you never save a broken spec.\n\n' +
      '**What you do in this lesson:**\n' +
      '- Identify a **Swagger 2.0** entry by its format badge\n' +
      '- Open the **Convert / Upgrade** modal and choose engine + target version\n' +
      '- **Validate** the output, **search** the preview, and run **Deep lint** for best practices\n' +
      '- Toggle **Prettify** for canonical, diff-friendly YAML key ordering\n' +
      '- **Save as a new version** — the converted spec lives alongside the original in history\n\n' +
      '**Why two engines?** `swagger2openapi` is the reference 2.0→3.0 converter and the safe ' +
      'default. Scalar is the only in-app engine that can emit **3.1 / 3.2**, so it powers upgrades ' +
      'of already-3.x specs.',
    keyTerms: [
      { term: 'Swagger 2.0', definition: 'The predecessor to OpenAPI 3; uses `definitions`, `host`, `basePath`, and `securityDefinitions`' },
      { term: 'OpenAPI 3.x', definition: 'Modern spec format with `components`, `servers`, and richer schema support — required by most codegen tools' },
      { term: 'Validation gate', definition: 'A fast structural check that blocks Download / Save until the converted document is valid' },
      { term: 'Deep lint', definition: 'Advisory schema + best-practice validation (oas-validator) for OpenAPI 3.0 output — never blocks saving' },
      { term: 'Prettify', definition: 'Sorts the output into a canonical, diff-friendly key order (openapi-format) — cosmetic only, never changes meaning' },
    ],
    diagram: `<svg viewBox="0 0 400 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="30" width="100" height="40" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="60" y="49" text-anchor="middle" fill="#f1f5f9" font-size="10">Swagger 2.0</text>
      <text x="60" y="62" text-anchor="middle" fill="#94a3b8" font-size="8">definitions</text>
      <path d="M115 50 L160 50" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr5)"/>
      <rect x="165" y="30" width="90" height="40" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="210" y="55" text-anchor="middle" fill="#f1f5f9" font-size="9">convert + validate</text>
      <path d="M260 50 L305 50" stroke="#10b981" stroke-width="1.5" marker-end="url(#arr5)"/>
      <rect x="310" y="30" width="80" height="40" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="350" y="49" text-anchor="middle" fill="#f1f5f9" font-size="10">OpenAPI 3</text>
      <text x="350" y="62" text-anchor="middle" fill="#94a3b8" font-size="8">components</text>
      <defs><marker id="arr5" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ensureCatalogTab(ctx);
    await ctx.delay(80);
    await resetDemoCatalog(ctx);
  },

  cleanup: async (ctx) => {
    await cleanupDemoCatalog(ctx);
    ensureCatalogTab(ctx);
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: The Swagger 2.0 API ─────────────────────────────
    {
      id: 'cat5-swagger-badge',
      title: 'The Swagger 2.0 API',
      description:
        'Select the seeded **' + DEMO_CATALOG_NAME + '** in the sidebar. On the Overview tab, ' +
        'notice the **Swagger 2.0** format badge — that badge marks this API as a conversion ' +
        'candidate. Legacy format, legacy limitations: no `components`, limited schema support, ' +
        'single `host` instead of `servers`.\n\n' +
        'Below the badge, the **Convert / Upgrade OpenAPI** button in Quick Actions is your ' +
        'gateway to the modern format.',
      highlight: CAT.OVERVIEW_SPEC_FORMAT,

      preAction: async (ctx) => {
        await ensureSeededEntryExists(ctx);
      },

      action: async (ctx) => {
        // Select and spotlight the entry in the sidebar
        await spotlight(ctx, CAT.entryByName(DEMO_CATALOG_NAME), 1000);
        await ctx.click(CAT.entryByName(DEMO_CATALOG_NAME));
        await ctx.waitFor(CAT.OVERVIEW, 2000);
        await ensureCatalogOverviewView(ctx);
        await ctx.delay(700);

        // Spotlight the format badge — "Swagger 2.0"
        await ctx.waitFor(CAT.OVERVIEW_SPEC_FORMAT, 1500);
        await spotlight(ctx, CAT.OVERVIEW_SPEC_FORMAT, 1400);

        // Spotlight the Convert/Upgrade button
        await ctx.delay(400);
        await spotlight(ctx, CAT.CONVERT_BTN, 1100);
      },
    },

    // ── Step 2: Open the Converter — Engine & Target ────────────
    {
      id: 'cat5-convert-open',
      title: 'Open the Converter',
      description:
        'Click **Convert / Upgrade OpenAPI**. The modal opens with a **live YAML preview** — ' +
        'the converted output is already visible with line numbers.\n\n' +
        'Choose your settings:\n' +
        '- **Engine**: `swagger2openapi` (reference, safe 2.0→3.0) or **Scalar** (can emit 3.1/3.2)\n' +
        '- **Target version**: OpenAPI 3.0, 3.1, or 3.2\n\n' +
        'Select **OpenAPI 3.1** and watch the **validation badge** turn green — confirming ' +
        'the output is structurally valid.',
      highlight: CAT.CONVERT_BTN,

      preAction: async (ctx) => {
        await ensureSeededAndSelected(ctx);
        await ctx.waitFor(CAT.CONVERT_BTN, 2000);
      },

      action: async (ctx) => {
        // Click Convert/Upgrade to open the modal
        await spotlight(ctx, CAT.CONVERT_BTN, 900);
        await ctx.click(CAT.CONVERT_BTN);
        await ctx.waitFor(CAT.CONVERT_MODAL, 3000);
        await ctx.delay(900);

        // Spotlight the live YAML preview
        await spotlight(ctx, CAT.CONVERT_PREVIEW, 1200);

        // Spotlight both engine buttons — explain the difference
        await spotlight(ctx, CAT.CONVERT_ENGINE_S2O, 900);
        await spotlight(ctx, CAT.CONVERT_ENGINE_SCALAR, 1000);

        // Switch to Scalar engine
        await ctx.click(CAT.CONVERT_ENGINE_SCALAR);
        await ctx.delay(600);

        // Spotlight target version options
        await spotlight(ctx, CAT.convertTarget('3.1'), 900);

        // Select OpenAPI 3.1
        await ctx.click(CAT.convertTarget('3.1'));
        await ctx.waitFor(CAT.CONVERT_BADGE, 3000);
        await ctx.delay(900);

        // Spotlight the validation badge turning green
        await spotlight(ctx, CAT.CONVERT_BADGE, 1400);
      },
    },

    // ── Step 3: Validate & Search ───────────────────────────────
    {
      id: 'cat5-lint-search',
      title: 'Validate & Search',
      description:
        'The YAML preview has a **search bar** (Cmd+F). Type `openapi: 3.1` to jump straight ' +
        'to the emitted version line — the match highlights and the counter shows **1/1**.\n\n' +
        'Clear the search, then switch the target to **3.0** and click **Deep lint**. This runs ' +
        'full JSON-schema validation plus best-practice rules (missing `operationId`, undocumented ' +
        'responses, etc.). Deep lint is **advisory only** — it never blocks saving. Check the ' +
        'conversion **warnings** list for any non-breaking issues.',
      highlight: CAT.CONVERT_SEARCH_INPUT,

      preAction: async (ctx) => {
        await ensureConvertEngineScalar(ctx);
        await ensureConvertTarget(ctx, '3.1');
      },

      action: async (ctx) => {
        // Spotlight the search bar
        await spotlight(ctx, CAT.CONVERT_SEARCH_INPUT, 900);

        // Type search term and see highlighted match
        await ctx.fill(CAT.CONVERT_SEARCH_INPUT, 'openapi: 3.1');
        await ctx.delay(1200);
        await spotlight(ctx, CAT.CONVERT_PREVIEW, 1200);

        // Clear search
        await ctx.fill(CAT.CONVERT_SEARCH_INPUT, '');
        await ctx.delay(500);

        // Switch to 3.0 target for Deep lint
        await spotlight(ctx, CAT.convertTarget('3.0'), 800);
        await ctx.click(CAT.convertTarget('3.0'));
        await ctx.waitFor(CAT.CONVERT_BADGE, 3000);
        await ctx.delay(700);

        // Click Deep lint
        await spotlight(ctx, CAT.CONVERT_LINT_BTN, 900);
        await ctx.click(CAT.CONVERT_LINT_BTN);
        await ctx.waitFor(CAT.CONVERT_LINT_RESULT, 4000);
        await ctx.delay(900);

        // Spotlight lint results
        await spotlight(ctx, CAT.CONVERT_LINT_RESULT, 1400);
      },
    },

    // ── Step 4: Prettify the Output ─────────────────────────────
    {
      id: 'cat5-prettify',
      title: 'Prettify the Output',
      description:
        'By default the converter emits **canonical, diff-friendly YAML** — keys sorted into ' +
        'the standard OpenAPI order: `openapi` → `info` → `servers` → `paths` → `components`.\n\n' +
        'Toggle **Prettify** *off* to see the engine\'s raw key ordering, then back *on* to ' +
        're-sort. This runs `openapi-format` under the hood — purely cosmetic, never changes ' +
        'meaning. The **Copy YAML** button copies the prettified output to your clipboard.',
      highlight: CAT.CONVERT_PRETTY_TOGGLE,

      preAction: async (ctx) => {
        await ensureConvertModalOpen(ctx);
        await ensureConvertTarget(ctx, '3.0');
        await ctx.waitFor(CAT.CONVERT_BADGE, 3000);
        await ensureConvertPrettyToggle(ctx, true);
      },

      action: async (ctx) => {
        // Spotlight the Prettify toggle
        await spotlight(ctx, CAT.CONVERT_PRETTY_TOGGLE, 1100);

        // Toggle OFF — viewer sees raw engine ordering
        await ctx.click(CAT.CONVERT_PRETTY_TOGGLE);
        await ctx.delay(900);
        await spotlight(ctx, CAT.CONVERT_PREVIEW, 1200);

        // Toggle ON — viewer sees canonical sorted ordering
        await ctx.click(CAT.CONVERT_PRETTY_TOGGLE);
        await ctx.delay(900);
        await spotlight(ctx, CAT.CONVERT_PREVIEW, 1200);

        // Spotlight the Copy YAML button
        await spotlight(ctx, CAT.CONVERT_COPY_BTN, 1000);
        await ctx.click(CAT.CONVERT_COPY_BTN);
        await ctx.delay(800);
      },
    },

    // ── Step 5: Save as New Version ─────────────────────────────
    {
      id: 'cat5-save',
      title: 'Save as New Version',
      description:
        'Click **Save as new version**. The converted spec is stored as a fresh Catalog version ' +
        'tagged with a changelog ("Converted Swagger 2.0 → OpenAPI 3.0.x"). The modal closes.\n\n' +
        'Back on the Overview, the **format badge** now shows **OpenAPI 3.0.3** where "Swagger 2.0" ' +
        'used to be. The **version count** has incremented. The original Swagger 2.0 spec is ' +
        'preserved in Version History — both versions live side by side.',
      highlight: CAT.CONVERT_SAVE_BTN,

      preAction: async (ctx) => {
        await ensureConvertModalOpen(ctx);
        await ctx.waitFor(CAT.CONVERT_BADGE, 3000);
      },

      action: async (ctx) => {
        // Spotlight the Save as new version button
        await spotlight(ctx, CAT.CONVERT_SAVE_BTN, 1100);

        // Click Save
        await ctx.click(CAT.CONVERT_SAVE_BTN);
        await ctx.delay(1400);

        // Modal closes — wait for Overview
        await ctx.waitFor(CAT.OVERVIEW, 3000);
        await ensureCatalogOverviewView(ctx);
        await ctx.delay(800);

        // Spotlight the Overview — confirm it's back
        await spotlight(ctx, CAT.OVERVIEW, 800);

        // Spotlight the format badge — now shows "OpenAPI 3.0.3"
        await ctx.waitFor(CAT.OVERVIEW_SPEC_FORMAT, 2000);
        await spotlight(ctx, CAT.OVERVIEW_SPEC_FORMAT, 1500);
      },
      verify: CAT.OVERVIEW,
    },
  ],
};
