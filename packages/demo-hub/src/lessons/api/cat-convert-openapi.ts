/**
 * CAT — Convert Swagger 2.0 → OpenAPI 3 (P4-E)
 *
 * 9 steps: select the seeded Swagger 2.0 API → open Convert / Upgrade → pick the
 * engine → target 3.1 → confirm the emitted version via search → deep-lint the
 * result → review the YAML → prettify (canonical key order) → save it as a new
 * Catalog version.
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
  estimatedMinutes: 5,
  initialTab: 'catalog',
  allowedTabs: ['catalog'],

  concept: {
    title: 'From Swagger 2.0 to OpenAPI 3 — Without Leaving the App',
    body:
      'Most codegen toolchains (OpenAPI Generator, `openapi-generator-maven-plugin`, Spring Boot 3) ' +
      'expect **OpenAPI 3.x** — but plenty of legacy APIs still ship **Swagger 2.0**. The Catalog ' +
      'converts them for you, offline, with a validation gate so you never save a broken spec.\n\n' +
      '**What you do in this lesson:**\n' +
      '- Open the **Convert / Upgrade** modal on a Swagger 2.0 entry\n' +
      '- Choose the engine — **swagger2openapi** (default, battle-tested 2.0→3.0) or **Scalar**\n' +
      '- Choose the target — **OpenAPI 3.0** or **3.1**\n' +
      '- Watch the **validation badge** confirm the output is structurally valid\n' +
      '- Run an optional **Deep lint** (schema + best-practice rules)\n' +
      '- Toggle **Prettify** to emit canonical, diff-friendly YAML\n' +
      '- **Save as a new version** so the converted spec lives alongside the original\n\n' +
      '**Why two engines?** `swagger2openapi` is the reference 2.0→3.0 converter and is the safe ' +
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
      <path d="M115 50 L160 50" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arr)"/>
      <rect x="165" y="30" width="90" height="40" rx="6" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="210" y="55" text-anchor="middle" fill="#f1f5f9" font-size="9">convert + validate</text>
      <path d="M260 50 L305 50" stroke="#10b981" stroke-width="1.5" marker-end="url(#arr)"/>
      <rect x="310" y="30" width="80" height="40" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="350" y="49" text-anchor="middle" fill="#f1f5f9" font-size="10">OpenAPI 3</text>
      <text x="350" y="62" text-anchor="middle" fill="#94a3b8" font-size="8">components</text>
      <defs><marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#94a3b8"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ensureCatalogTab(ctx);
    await ctx.delay(80);
    // Always start from a fresh Swagger 2.0 entry (a prior run may have saved a 3.x version).
    await resetDemoCatalog(ctx);
  },

  cleanup: async (ctx) => {
    await cleanupDemoCatalog(ctx);
    ensureCatalogTab(ctx);
    await ctx.delay(60);
  },

  steps: [
    // ── Step 1: Select the API ──
    {
      id: 'cat-convert-select',
      title: 'Select the Swagger 2.0 API',
      description:
        'The Catalog sidebar lists every imported API. We seeded **' + DEMO_CATALOG_NAME + '** — a ' +
        'classic **Swagger 2.0** pet store. Click it to open its **Overview**, then watch the ' +
        '**Swagger 2.0** format badge next to the title — that badge is what marks this API as a ' +
        'conversion candidate. Endpoint stats and quick actions live here too.',
      highlight: CAT.entryByName(DEMO_CATALOG_NAME),
      preAction: async (ctx) => {
        await ensureSeededEntryExists(ctx);
      },
      action: async (ctx) => {
        await spotlight(ctx, CAT.entryByName(DEMO_CATALOG_NAME), 1200);
        await ctx.click(CAT.entryByName(DEMO_CATALOG_NAME));
        await ctx.waitFor(CAT.OVERVIEW, 2000);
        // A prior run may have left the panel on the Endpoints sub-tab (the panes
        // are display:none, so the badge exists but is invisible) — force Overview.
        await ensureCatalogOverviewView(ctx);
        await ctx.delay(700);
        await spotlight(ctx, CAT.OVERVIEW, 900);
        // Draw the eye to the format badge — this is what makes the entry a
        // conversion candidate.
        await ctx.waitFor(CAT.OVERVIEW_SPEC_FORMAT, 1500);
        await spotlight(ctx, CAT.OVERVIEW_SPEC_FORMAT, 1400);
      },
    },

    // ── Step 2: Open Convert / Upgrade ──
    {
      id: 'cat-convert-open',
      title: 'Open Convert / Upgrade',
      description:
        'In the Overview quick actions, click **Convert / Upgrade OpenAPI**. The modal detects the ' +
        'source format automatically — because this is Swagger 2.0, it opens in **Convert** mode ' +
        'and immediately produces a live OpenAPI 3 preview.',
      highlight: CAT.CONVERT_BTN,
      preAction: async (ctx) => {
        await ensureSeededAndSelected(ctx);
        await ctx.waitFor(CAT.CONVERT_BTN, 2000);
      },
      action: async (ctx) => {
        await spotlight(ctx, CAT.CONVERT_BTN, 1100);
        await ctx.click(CAT.CONVERT_BTN);
        await ctx.waitFor(CAT.CONVERT_MODAL, 3000);
        await ctx.delay(900);
        await spotlight(ctx, CAT.CONVERT_PREVIEW, 1200);
      },
    },

    // ── Step 3: Choose the engine ──
    {
      id: 'cat-convert-engine',
      title: 'Choose the Conversion Engine',
      description:
        'Two engines are offered. **swagger2openapi** is the reference 2.0→3.0 converter and the safe ' +
        '**default** — it is what most CI pipelines use. **Scalar** is the only in-app engine that can ' +
        'emit **3.1/3.2**. Let\'s switch to **Scalar** first to explore a 3.1 upgrade — we\'ll drop ' +
        'back to swagger2openapi\'s 3.0 output before saving.',
      highlight: CAT.CONVERT_ENGINE_S2O,
      preAction: async (ctx) => {
        await ensureConvertModalOpen(ctx);
      },
      action: async (ctx) => {
        await spotlight(ctx, CAT.CONVERT_ENGINE_S2O, 900);
        await spotlight(ctx, CAT.CONVERT_ENGINE_SCALAR, 1000);
        await ctx.click(CAT.CONVERT_ENGINE_SCALAR);
        await ctx.delay(900);
        await spotlight(ctx, CAT.convertTarget('3.1'), 1100);
      },
    },

    // ── Step 4: Target OpenAPI 3.1 ──
    {
      id: 'cat-convert-target',
      title: 'Target OpenAPI 3.1',
      description:
        'With **Scalar** active you can emit newer OpenAPI versions. Click **OpenAPI 3.1** and watch ' +
        'the **validation badge** turn green — it reads **Valid OpenAPI 3.1.1**, confirming the exact ' +
        'version the converter produced. The structural gate has verified the output is safe to save.',
      highlight: CAT.convertTarget('3.1'),
      preAction: async (ctx) => {
        await ensureConvertEngineScalar(ctx);
      },
      action: async (ctx) => {
        await spotlight(ctx, CAT.convertTarget('3.1'), 900);
        await ctx.click(CAT.convertTarget('3.1'));
        await ctx.waitFor(CAT.CONVERT_BADGE, 3000);
        await ctx.delay(800);
        await spotlight(ctx, CAT.CONVERT_BADGE, 1400);
      },
    },

    // ── Step 5: Confirm the emitted version via search ──
    {
      id: 'cat-convert-search',
      title: 'Find `openapi: 3.1.1` in the Preview',
      description:
        'The YAML preview has a search bar (**Cmd+F**). Type **3.1.1** — the matches light up, the ' +
        'match counter appears, and it jumps you straight to the `openapi: 3.1.1` line at the top of ' +
        'the document. This is how you confirm the emitted version and navigate large specs. Then we ' +
        'drop the target back to **OpenAPI 3.0** — what Spring Boot 3 and OpenAPI Generator expect.',
      highlight: CAT.CONVERT_SEARCH_INPUT,
      preAction: async (ctx) => {
        await ensureConvertEngineScalar(ctx);
        await ensureConvertTarget(ctx, '3.1');
      },
      action: async (ctx) => {
        await spotlight(ctx, CAT.CONVERT_SEARCH_INPUT, 900);
        await ctx.fill(CAT.CONVERT_SEARCH_INPUT, '3.1.1');
        await ctx.delay(1300);
        // Pause on the highlighted `openapi: 3.1.1` line in the preview.
        await spotlight(ctx, CAT.CONVERT_PREVIEW, 1600);
        // Clear the search, then settle on 3.0 for the deep-lint + save steps.
        await ctx.fill(CAT.CONVERT_SEARCH_INPUT, '');
        await ctx.delay(500);
        await spotlight(ctx, CAT.convertTarget('3.0'), 900);
        await ctx.click(CAT.convertTarget('3.0'));
        await ctx.waitFor(CAT.CONVERT_BADGE, 3000);
        await ctx.delay(900);
        await spotlight(ctx, CAT.CONVERT_BADGE, 1100);
      },
    },

    // ── Step 6: Deep lint (on the 3.0 output) ──
    {
      id: 'cat-convert-lint',
      title: 'Deep Lint the Output',
      description:
        'The green badge means the spec is **structurally valid**. For extra confidence, click ' +
        '**Deep lint** — it runs full JSON-schema validation plus best-practice rules (missing ' +
        '`operationId`, undocumented responses, etc.) on the OpenAPI 3.0 output. Deep lint is ' +
        '**advisory only** — it never blocks Download or Save.',
      highlight: CAT.CONVERT_LINT_BTN,
      preAction: async (ctx) => {
        await ensureConvertModalOpen(ctx);
        await ensureConvertTarget(ctx, '3.0');
        await ctx.waitFor(CAT.CONVERT_BADGE, 3000);
      },
      action: async (ctx) => {
        await spotlight(ctx, CAT.CONVERT_LINT_BTN, 900);
        await ctx.click(CAT.CONVERT_LINT_BTN);
        await ctx.waitFor(CAT.CONVERT_LINT_RESULT, 4000);
        await ctx.delay(900);
        await spotlight(ctx, CAT.CONVERT_LINT_RESULT, 1400);
      },
    },

    // ── Step 7: Review the YAML ──
    {
      id: 'cat-convert-preview',
      title: 'Review the OpenAPI 3 YAML',
      description:
        'The preview shows the fully converted OpenAPI 3 document — note how Swagger 2.0 `definitions` ' +
        'became `components/schemas`, and `host` + `basePath` became a `servers` entry. Use the search ' +
        'bar (**Cmd+F**) to jump around large specs. This is exactly what Download / Save writes.',
      highlight: CAT.CONVERT_PREVIEW,
      preAction: async (ctx) => {
        await ensureConvertModalOpen(ctx);
        await ctx.waitFor(CAT.CONVERT_BADGE, 3000);
      },
      action: async (ctx) => {
        await spotlight(ctx, CAT.CONVERT_PREVIEW, 1200);
        await spotlight(ctx, CAT.CONVERT_COPY_BTN, 1000);
        await ctx.click(CAT.CONVERT_COPY_BTN);
        await ctx.delay(900);
        await spotlight(ctx, CAT.CONVERT_PREVIEW, 1200);
      },
    },

    // ── Step 8: Prettify (canonical key order) ──
    {
      id: 'cat-convert-prettify',
      title: 'Prettify the YAML',
      description:
        'By default the converter emits **canonical, diff-friendly YAML** — keys sorted into the ' +
        'standard OpenAPI order (`openapi` → `info` → `servers` → … → `components`). Watch: toggle ' +
        '**Prettify** *off* to see the engine\'s raw ordering, then back *on* to re-sort. This runs ' +
        '`openapi-format` under the hood so converted specs stay review- and diff-friendly. It is ' +
        '**purely cosmetic** — it never changes meaning and never blocks Save. We leave it **on**.',
      highlight: CAT.CONVERT_PRETTY_TOGGLE,
      preAction: async (ctx) => {
        await ensureConvertModalOpen(ctx);
        await ensureConvertTarget(ctx, '3.0');
        await ctx.waitFor(CAT.CONVERT_BADGE, 3000);
        // Always begin from the default (on) so the off→on demonstration reads correctly.
        await ensureConvertPrettyToggle(ctx, true);
      },
      action: async (ctx) => {
        await spotlight(ctx, CAT.CONVERT_PRETTY_TOGGLE, 1100);
        // Off → viewer sees the engine's raw key ordering.
        await ctx.click(CAT.CONVERT_PRETTY_TOGGLE);
        await ctx.delay(900);
        await spotlight(ctx, CAT.CONVERT_PREVIEW, 1300);
        // Back on → viewer sees the canonical, sorted ordering re-applied.
        await ctx.click(CAT.CONVERT_PRETTY_TOGGLE);
        await ctx.delay(900);
        await spotlight(ctx, CAT.CONVERT_PREVIEW, 1400);
      },
    },

    // ── Step 9: Save as new version ──
    {
      id: 'cat-convert-save',
      title: 'Save as a New Version',
      description:
        'Click **Save as new version**. The converted spec is stored as a fresh Catalog version — ' +
        'tagged with a changelog like *"Converted Swagger 2.0 → OpenAPI 3.0.x"*. The modal closes, and ' +
        'the Overview header now shows an **OpenAPI 3.0.3** format badge where **Swagger 2.0** used to ' +
        'be — the original 2.0 and the new 3.0 live side-by-side in Version History.',
      highlight: CAT.CONVERT_SAVE_BTN,
      preAction: async (ctx) => {
        await ensureConvertModalOpen(ctx);
        await ctx.waitFor(CAT.CONVERT_BADGE, 3000);
      },
      action: async (ctx) => {
        await spotlight(ctx, CAT.CONVERT_SAVE_BTN, 1100);
        await ctx.click(CAT.CONVERT_SAVE_BTN);
        // Modal closes + a success toast fires when the version is persisted.
        await ctx.delay(1200);
        await ctx.waitFor(CAT.OVERVIEW, 3000);
        await ensureCatalogOverviewView(ctx);
        await spotlight(ctx, CAT.OVERVIEW, 800);
        // The format badge now reads the converted version (e.g. "OpenAPI 3.0.3").
        await ctx.waitFor(CAT.OVERVIEW_SPEC_FORMAT, 2000);
        await spotlight(ctx, CAT.OVERVIEW_SPEC_FORMAT, 1500);
      },
      verify: CAT.OVERVIEW,
    },
  ],
};
