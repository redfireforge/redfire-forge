/**
 * TH-17: Data Mapper Expressions & DSL Editor
 *
 * Story-driven lesson: validate a user API response using the Expression
 * Editor to build a transformation ($upper) with live preview and step
 * debugger, then author DSL rules and verify them inline.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  seedDemoEnvAndService,
  seedTh17FeatureGroup,
  deleteTh17DemoFg,
  ensureTh17FgExists,
  expandFirstFg,
  expandFirstScenario,
  spotlight,
  spotlightSel,
  isTestEditorOpen,
  closeTestEditorQuiet,
  clickValidationTab,
  closeDataMapperModal,
  isDataMapperOpen,
  isExpressionEditorOpen,
  closeExpressionEditor,
  isRulesModalOpen,
  closeRulesModal,
  clickRulesToolbarButton,
} from './th-demo-helpers';

/* ── local helpers ──────────────────────────────────────────── */

async function ensureTh17Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh17FgExists(ctx);
  if (!document.querySelector(HAR.FG_CARD)) {
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
  }
  await expandFirstFg(ctx);
}

async function ensureEditorOnValidation(ctx: DemoActionContext): Promise<void> {
  if (!isTestEditorOpen()) {
    await expandFirstFg(ctx);
    await expandFirstScenario(ctx);
    await ctx.delay(300);
    const editBtn = document.querySelector<HTMLElement>(HAR.TEST_EDIT_BTN);
    if (editBtn) {
      editBtn.click();
      await ctx.delay(700);
    }
  }
  await clickValidationTab(ctx);
}

async function ensureMapperOpen(ctx: DemoActionContext): Promise<void> {
  if (isDataMapperOpen()) return;
  await ensureEditorOnValidation(ctx);
  const mapperBtn = document.querySelector<HTMLElement>(HAR.TE_MAPPER_BTN);
  if (mapperBtn && !mapperBtn.hasAttribute('disabled')) {
    mapperBtn.click();
    await ctx.delay(800);
  }
}

function openExpressionEditorViaDoubleClick(): void {
  const badge = document.querySelector<HTMLElement>('.dm-mapped-badge');
  if (badge) {
    badge.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  }
}

/**
 * Set the Expression Editor Monaco value programmatically.
 * Falls back to textarea if Monaco isn't loaded.
 */
function setExpressionValue(value: string): void {
  const w = window as unknown as {
    monaco?: { editor: { getEditors(): Array<{ getModel(): { uri: { toString(): string }; setValue(v: string): void } | null }> } };
  };
  if (w.monaco?.editor) {
    const editors = w.monaco.editor.getEditors();
    for (const ed of editors) {
      const model = ed.getModel();
      if (model && model.uri.toString().includes('expression-editor')) {
        model.setValue(value);
        return;
      }
    }
    if (editors.length > 0) {
      const exprModal = document.querySelector(HAR.EXPR_MODAL);
      if (exprModal) {
        for (const ed of editors) {
          const model = ed.getModel();
          if (model) {
            model.setValue(value);
            return;
          }
        }
      }
    }
  }
  const textarea = document.querySelector<HTMLTextAreaElement>('.dm-expr-textarea');
  if (textarea) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value',
    )?.set;
    nativeInputValueSetter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function saveExpression(): void {
  const footer = document.querySelector<HTMLElement>(HAR.EXPR_FOOTER);
  if (!footer) return;
  const btns = footer.querySelectorAll<HTMLElement>('button');
  for (const btn of btns) {
    if (btn.textContent?.trim().includes('Save')) { btn.click(); return; }
  }
}

function setDslEditorValue(value: string): void {
  const w = window as unknown as {
    monaco?: { editor: { getEditors(): Array<{ getModel(): { uri: { toString(): string }; setValue(v: string): void; getLanguageId(): string } | null }> } };
  };
  if (w.monaco?.editor) {
    const editors = w.monaco.editor.getEditors();
    for (const ed of editors) {
      const model = ed.getModel();
      if (model && (model as unknown as { getLanguageId(): string }).getLanguageId?.() === 'validation-dsl') {
        model.setValue(value);
        return;
      }
    }
    const vrModal = document.querySelector(HAR.VR_MODAL);
    if (vrModal && editors.length > 0) {
      const model = editors[editors.length - 1].getModel();
      if (model) model.setValue(value);
    }
  }
}

/** Find and spotlight the Rules toolbar button. */
async function spotlightRulesBtn(ctx: DemoActionContext, holdMs: number): Promise<HTMLElement | null> {
  const btn =
    document.querySelector<HTMLElement>(HAR.MAPPER_RULES_BTN)
    ?? Array.from(document.querySelectorAll<HTMLElement>('.dm-toolbar-btn--quiet'))
      .find((el) => el.textContent?.trim() === 'Rules')
    ?? null;
  if (btn) await spotlight(btn, holdMs, ctx);
  return btn;
}

/* ── lesson definition ──────────────────────────────────────── */

export const thMapperExpressionsDslLesson: DemoLesson = {
  id: 'th-mapper-expressions-dsl',
  domainId: 'harness',
  category: 'validation',
  name: 'Expressions & DSL Editor',
  description:
    'Build a real transformation expression ($upper) with the Expression Editor, watch the live ' +
    'preview update, debug it step-by-step, then write DSL validation rules and verify them ' +
    'inline against a live API response.',
  estimatedMinutes: 7,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],
  concept: {
    title: 'Transformations & Rule Authoring',
    body:
      'This lesson walks through a real scenario: you have a **Get User Details** API that returns ' +
      'JSON (name, email, id). You\'ll enhance a basic `equals` check into a full transformation + ' +
      'multi-rule validation — all inside the Data Mapper.\n\n' +
      '**What you\'ll do:**\n' +
      '1. Open the Data Mapper from the existing Validation Rules\n' +
      '2. Write `$upper($.name)` in the Expression Editor — live preview updates instantly\n' +
      '3. Use the Step Debugger to trace how `$.name` resolves and `$upper` transforms it\n' +
      '4. Explore the Function Catalog (35+ built-in functions) and save reusable snippets\n' +
      '5. Open the DSL Rules Editor and write 3 validation rules in one-line syntax\n' +
      '6. Click Verify to see pass/fail gutter markers on every rule line\n\n' +
      '**Two powerful editors in one workflow:**\n' +
      '- **Expression Editor** — Transform values with functions before comparing (e.g. uppercase, trim, substring)\n' +
      '- **DSL Rules Editor** — Author text rules like `$.email contains "@"` and verify instantly\n\n' +
      '**Reusable Snippets** — Save frequently-used expressions (e.g. `$upper($.name)`) with a name ' +
      'for quick access across all mappings. Type a snippet name, click Save, and reuse it anywhere ' +
      'without rewriting complex expressions from scratch.',
    keyTerms: [
      { term: '$upper', definition: 'Built-in function that converts a string to uppercase.' },
      { term: 'Live Preview', definition: 'Shows the evaluated result of your expression using sample data in real time.' },
      { term: 'Step Debugger', definition: 'Breaks expressions into steps showing each intermediate value — trace exactly where evaluation fails.' },
      { term: 'Function Catalog', definition: '35+ built-in functions organized by category (String, Math, Array, etc.) with documentation and Insert.' },
      { term: 'Reusable Snippets', definition: 'Save named expressions for reuse across mappings — e.g. save "$upper($.name)" as "Uppercase Name" and insert it later with one click.' },
      { term: 'DSL Rules', definition: 'One rule per line: path + operator + expected value. Supports equals, contains, greater_than, and more.' },
      { term: 'Inline Verify', definition: 'One-click evaluation of all DSL rules against the sample response — green/red markers per line.' },
    ],
    diagram: `<svg viewBox="0 0 380 125" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="160" height="115" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="85" y="16" text-anchor="middle" fill="#3b82f6" font-size="6.5" font-weight="700">Expression Editor</text>
      <text x="85" y="30" text-anchor="middle" fill="#94a3b8" font-size="5">$.name → $upper($.name)</text>
      <text x="85" y="42" text-anchor="middle" fill="#a6e3a1" font-size="5">Preview: "LEANNE GRAHAM"</text>
      <text x="85" y="56" text-anchor="middle" fill="#94a3b8" font-size="4.5">--- Step Debugger ---</text>
      <text x="85" y="66" text-anchor="middle" fill="#94a3b8" font-size="4.5">1. $.name → "Leanne Graham"</text>
      <text x="85" y="76" text-anchor="middle" fill="#a6e3a1" font-size="4.5">2. $upper → "LEANNE GRAHAM"</text>
      <text x="85" y="90" text-anchor="middle" fill="#94a3b8" font-size="4.5">Catalog · Templates</text>
      <text x="85" y="102" text-anchor="middle" fill="#c4b5fd" font-size="4.5">Snippet: "Uppercase Name" → Save</text>
      <text x="85" y="112" text-anchor="middle" fill="#94a3b8" font-size="4">Reuse across all mappings</text>
      <path d="M172 60 L195 60" stroke="#64748b" stroke-width="1" marker-end="url(#arrow17)"/>
      <defs><marker id="arrow17" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#64748b"/></marker></defs>
      <rect x="200" y="5" width="175" height="115" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="288" y="16" text-anchor="middle" fill="#f59e0b" font-size="6.5" font-weight="700">DSL Rules Editor</text>
      <text x="288" y="32" text-anchor="middle" fill="#94a3b8" font-size="5">$.name equals "Leanne Graham"</text>
      <text x="288" y="44" text-anchor="middle" fill="#94a3b8" font-size="5">$.email contains "@"</text>
      <text x="288" y="56" text-anchor="middle" fill="#94a3b8" font-size="5">$.id greater_than 0</text>
      <text x="288" y="72" text-anchor="middle" fill="#a6e3a1" font-size="5.5" font-weight="600">▶ Verify → ✓ 3/3 passed</text>
      <text x="288" y="86" text-anchor="middle" fill="#94a3b8" font-size="4.5">Reference panel: 8 categories</text>
      <text x="288" y="96" text-anchor="middle" fill="#94a3b8" font-size="4.5">Gutter markers per rule line</text>
    </svg>`,
  },

  setup: async (ctx) => {
    deleteTh17DemoFg();
    await ctx.delay(200);
    await seedDemoEnvAndService(ctx);
    await seedTh17FeatureGroup(ctx);
    await ctx.delay(300);
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
    await expandFirstFg(ctx);
  },

  cleanup: async (ctx) => {
    if (isRulesModalOpen()) closeRulesModal();
    await ctx.delay(200);
    if (isExpressionEditorOpen()) closeExpressionEditor();
    await ctx.delay(200);
    if (isDataMapperOpen()) closeDataMapperModal();
    await ctx.delay(200);
    if (isTestEditorOpen()) await closeTestEditorQuiet(ctx);
    await ctx.delay(100);
    deleteTh17DemoFg();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Open the Data Mapper ─────────────────────────────
    {
      id: 'th17-open-mapper',
      title: 'Open the Data Mapper',
      description:
        'We have a **Get User Details** test pre-configured with validation mappings. ' +
        'The `name` field is mapped with a simple `equals "Leanne Graham"` check. ' +
        'Let\'s open the **Data Mapper** to enhance this with an expression that transforms ' +
        'the value before comparing — making our validation smarter and reusable.',
      highlight: HAR.TE_VALIDATION_RULES,
      action: async (ctx) => {
        // Brief nod to Validation Rules (already shown during reading) then move on
        await spotlightSel(ctx, HAR.TE_VALIDATION_RULES, 900);
        await ctx.delay(300);

        // Highlight the Data Mapper button before clicking
        const mapperBtn = document.querySelector<HTMLElement>(HAR.TE_MAPPER_BTN);
        if (mapperBtn) {
          await spotlight(mapperBtn, 1500, ctx);
          await ctx.delay(400);
          mapperBtn.click();
          await ctx.delay(1200);
        }

        // Highlight the "3 mapped" status badge — confirms mappings exist
        await spotlightSel(ctx, HAR.MAPPER_STATUS, 1500);
        await ctx.delay(600);
      },
      preAction: async (ctx) => {
        await ensureTh17Ready(ctx);
        if (isRulesModalOpen()) closeRulesModal();
        if (isExpressionEditorOpen()) closeExpressionEditor();
        if (isDataMapperOpen()) closeDataMapperModal();
        await ensureEditorOnValidation(ctx);
        // Ensure Validation Rules are visible for the reading-phase highlight
        const rules = document.querySelector<HTMLElement>(HAR.TE_VALIDATION_RULES);
        rules?.scrollIntoView({ block: 'nearest', behavior: 'instant' as ScrollBehavior });
      },
      // After open, mapper toolbar is the visible surface — avoid ghosting Validation Rules
      // behind the Data Mapper during the done phase.
      verify: HAR.MAPPER_TOOLBAR,
    },

    // ── Step 2: Open Expression Editor & Write $upper ─────────────
    {
      id: 'th17-write-expression',
      title: 'Write a Transformation Expression',
      description:
        'Double-click the **mapped badge** on the `name` target field to open the ' +
        '**Expression Editor**. Instead of a plain `$.name` reference, we\'ll write ' +
        '`$upper($.name)` — this applies the built-in `$upper` function to convert the ' +
        'API response\'s `name` field to uppercase. Watch the **Live Preview** update instantly ' +
        'from "Leanne Graham" to "LEANNE GRAHAM".',
      highlight: '.dm-mapped-badge',
      action: async (ctx) => {
        // Highlight the mapped badge — this is what user double-clicks
        const badge = document.querySelector<HTMLElement>('.dm-mapped-badge');
        if (badge) {
          await spotlight(badge, 1500, ctx);
          await ctx.delay(400);
          badge.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          await ctx.delay(1000);
        }

        // Highlight Live Preview showing current value "Leanne Graham"
        const previewValue = document.querySelector<HTMLElement>('.dm-expr-preview-value');
        if (previewValue) await spotlight(previewValue, 1500, ctx);
        await ctx.delay(800);

        // Type $upper($.name) into the editor
        setExpressionValue('$upper($.name)');
        await ctx.delay(600);

        // Highlight the Monaco editor area to show the new expression text
        const monacoEl = document.querySelector<HTMLElement>('.dm-expr-editor-area .monaco-editor');
        const exprTarget = monacoEl ?? document.querySelector<HTMLElement>('.dm-expr-textarea');
        if (exprTarget) await spotlight(exprTarget, 2000, ctx);
        await ctx.delay(800);

        // Highlight the updated preview value — shows "LEANNE GRAHAM"
        if (previewValue) await spotlight(previewValue, 2000, ctx);
        await ctx.delay(600);
      },
      preAction: async (ctx) => {
        await ensureTh17Ready(ctx);
        if (isRulesModalOpen()) closeRulesModal();
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
        if (isExpressionEditorOpen()) closeExpressionEditor();
      },
      verify: HAR.EXPR_MODAL,
    },

    // ── Step 3: Step Debugger — Trace Evaluation ──────────────────
    {
      id: 'th17-step-debug',
      title: 'Step Debugger — Trace Evaluation',
      description:
        'Click **Step Debug** to see how the expression evaluates step-by-step. ' +
        'The debugger breaks `$upper($.name)` into two steps:\n\n' +
        '1. Resolve `$.name` → "Leanne Graham" (read from API response)\n' +
        '2. Apply `$upper(...)` → "LEANNE GRAHAM" (transform result)\n\n' +
        'This is invaluable for debugging complex nested expressions — you can pinpoint ' +
        'exactly where a transformation goes wrong.',
      highlight: HAR.EXPR_DEBUG_TOGGLE,
      action: async (ctx) => {
        // Highlight the Step Debug button before clicking
        const debugToggle = document.querySelector<HTMLElement>(HAR.EXPR_DEBUG_TOGGLE);
        if (debugToggle) {
          await spotlight(debugToggle, 1800, ctx);
          await ctx.delay(600);
          debugToggle.click();
          await ctx.delay(800);
        }

        // Scroll the debugger panel into view so user sees the full content
        const stepDebugger = document.querySelector<HTMLElement>(HAR.EXPR_STEP_DEBUGGER);
        if (stepDebugger) {
          stepDebugger.scrollIntoView({ behavior: 'smooth', block: 'end' });
          await ctx.delay(800);
        }

        // Highlight and click "Expand All" to show both steps with values
        const expandAllBtn = document.querySelector<HTMLElement>('.dm-expr-step-btn--toggle-all');
        if (expandAllBtn) {
          await spotlight(expandAllBtn, 1500, ctx);
          await ctx.delay(400);
          expandAllBtn.click();
          await ctx.delay(1000);

          // Scroll again after expanding to ensure all step details are visible
          stepDebugger?.scrollIntoView({ behavior: 'smooth', block: 'end' });
          await ctx.delay(600);
        }

        // Highlight and click the Next step arrow (▶) to go to Step 2/2
        const nextStepBtn = document.querySelector<HTMLElement>('.dm-expr-step-btn[aria-label="Next step"]');
        if (nextStepBtn && !nextStepBtn.hasAttribute('disabled')) {
          await spotlight(nextStepBtn, 900, ctx);
          await ctx.delay(300);
          nextStepBtn.click();
          await ctx.delay(700);
        }

        // Brief spotlight on the debugger panel with Step 2 active — then end
        if (stepDebugger) await spotlight(stepDebugger, 1400, ctx);
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh17Ready(ctx);
        if (isRulesModalOpen()) closeRulesModal();
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
        if (!isExpressionEditorOpen()) {
          openExpressionEditorViaDoubleClick();
          await ctx.delay(800);
          setExpressionValue('$upper($.name)');
          await ctx.delay(400);
        }
      },
      verify: HAR.EXPR_MODAL,
    },

    // ── Step 4: Function Catalog & Templates ──────────────────────
    {
      id: 'th17-catalog-templates',
      title: 'Function Catalog & Templates',
      description:
        'The **function catalog** on the left has 35+ built-in functions across 8 categories ' +
        '(String, Math, Array, Object, Conditional, JSON, Date/Time, Encoding). Click any ' +
        'function to see its documentation on the right with **Insert** to add it. ' +
        'The **Function Templates** section below offers pre-built patterns like "Parse number", ' +
        '"String → boolean", etc. — click to insert at cursor. Save frequently-used expressions ' +
        'as **Reusable Snippets** for quick access across all mappings.',
      highlight: HAR.EXPR_SIDEBAR,
      action: async (ctx) => {
        // Highlight the category bar — shows the 8 filter pills
        const catBar = document.querySelector<HTMLElement>('.dm-expr-category-bar');
        if (catBar) await spotlight(catBar, 1800, ctx);
        await ctx.delay(800);

        // Highlight a specific function item before clicking
        const firstFn = document.querySelector<HTMLElement>('.dm-expr-fn-item');
        if (firstFn) {
          await spotlight(firstFn, 1500, ctx);
          await ctx.delay(400);
          firstFn.click();
          await ctx.delay(1000);
        }

        // Highlight the doc name+signature that appeared (not the entire panel)
        const docName = document.querySelector<HTMLElement>('.dm-expr-doc-header');
        if (docName) await spotlight(docName, 1800, ctx);
        await ctx.delay(800);

        // Highlight a specific template item (not the whole section)
        const templateItem = document.querySelector<HTMLElement>('.dm-expr-template-item');
        if (templateItem) await spotlight(templateItem, 1500, ctx);
        await ctx.delay(800);

        // ── Reusable Snippets demo: type name → Save → show saved snippet ──

        // Highlight the snippet save row (input + Save button)
        const snippetSave = document.querySelector<HTMLElement>('.dm-expr-snippet-save');
        if (snippetSave) await spotlight(snippetSave, 1500, ctx);
        await ctx.delay(600);

        // Type "Uppercase Name" into the snippet name input
        const snippetInput = document.querySelector<HTMLInputElement>('.dm-expr-snippet-name');
        if (snippetInput) {
          const nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value',
          )?.set;
          nativeSetter?.call(snippetInput, 'Uppercase Name');
          snippetInput.dispatchEvent(new Event('input', { bubbles: true }));
          snippetInput.dispatchEvent(new Event('change', { bubbles: true }));
          await ctx.delay(600);
          await spotlight(snippetInput, 1500, ctx);
          await ctx.delay(800);
        }

        // Click the Save button next to the snippet input
        const snippetSaveBtn = snippetSave?.querySelector<HTMLElement>('button');
        if (snippetSaveBtn && !snippetSaveBtn.hasAttribute('disabled')) {
          await spotlight(snippetSaveBtn, 1200, ctx);
          await ctx.delay(400);
          snippetSaveBtn.click();
          await ctx.delay(1200);
        }

        // Highlight the newly saved snippet item showing name + expression
        const savedSnippet = document.querySelector<HTMLElement>('.dm-expr-snippet-item');
        if (savedSnippet) {
          await spotlight(savedSnippet, 2200, ctx);
          await ctx.delay(800);
        }

        // Now save the expression and close
        saveExpression();
        await ctx.delay(1000);

        // Highlight the "fx expression" badge on the target tree — shows saved result
        const fxBadge = document.querySelector<HTMLElement>('.dm-mapped-fx-pill');
        const fxParent = fxBadge?.closest<HTMLElement>('.dm-mapped-badge');
        if (fxParent) {
          await spotlight(fxParent, 2000, ctx);
        } else if (fxBadge) {
          await spotlight(fxBadge, 2000, ctx);
        }
        await ctx.delay(600);
      },
      preAction: async (ctx) => {
        await ensureTh17Ready(ctx);
        if (isRulesModalOpen()) closeRulesModal();
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
        if (!isExpressionEditorOpen()) {
          openExpressionEditorViaDoubleClick();
          await ctx.delay(800);
          setExpressionValue('$upper($.name)');
          await ctx.delay(400);
        }
        // Turn off debugger if on (from previous step)
        const debugToggle = document.querySelector<HTMLElement>(HAR.EXPR_DEBUG_TOGGLE);
        if (debugToggle?.classList.contains('dm-expr-debug-toggle--active')) {
          debugToggle.click();
        }
      },
      verify: HAR.MAPPER_TOOLBAR,
    },

    // ── Step 5: DSL Rules Editor — Write Validation Rules ─────────
    {
      id: 'th17-dsl-write-rules',
      title: 'Write DSL Validation Rules',
      description:
        'Click **Rules** in the toolbar to open the **DSL Rules Editor**. This is a text-based ' +
        'editor where you write one validation rule per line using the syntax:\n\n' +
        '`path operator expected_value`\n\n' +
        'We\'ll write three rules:\n' +
        '- `$.name equals "Leanne Graham"` — exact match\n' +
        '- `$.email contains "@"` — partial string match\n' +
        '- `$.id greater_than 0` — numeric comparison\n\n' +
        'The editor provides **syntax highlighting** and **autocomplete** for paths and operators.',
      highlight: HAR.MAPPER_RULES_BTN,
      action: async (ctx) => {
        // Rules button already highlighted during reading — brief pause then click
        const rulesBtn =
          document.querySelector<HTMLElement>(HAR.MAPPER_RULES_BTN)
          ?? await spotlightRulesBtn(ctx, 800);
        if (rulesBtn) {
          await ctx.delay(400);
          rulesBtn.click();
          await ctx.delay(1200);
        } else {
          clickRulesToolbarButton();
          await ctx.delay(1200);
        }

        // Write the 3 rules into the DSL editor
        const rules = [
          '$.name equals "Leanne Graham"',
          '$.email contains "@"',
          '$.id greater_than 0',
        ].join('\n');
        setDslEditorValue(rules);
        await ctx.delay(1200);

        // Spotlight the code lines area (all 3 rules as one group)
        const viewLines = document.querySelector<HTMLElement>('.vr-modal-editor-pane .view-lines');
        if (viewLines) await spotlight(viewLines, 3000, ctx);
        await ctx.delay(800);

        // Highlight the Reference button before clicking
        const refBtns = document.querySelectorAll<HTMLElement>('.vr-modal-header-actions button');
        for (const btn of refBtns) {
          if (btn.textContent?.trim().includes('Reference')) {
            await spotlight(btn, 1800, ctx);
            await ctx.delay(500);
            btn.click();
            await ctx.delay(1200);
            break;
          }
        }

        // Highlight a specific reference card — show operator categories
        const refCard = document.querySelector<HTMLElement>('.vr-ref-card');
        if (refCard) {
          await spotlight(refCard, 2000, ctx);
        } else {
          const firstCategory = document.querySelector<HTMLElement>('.vr-ref-category, .vr-reference-pane h3, .vr-reference-pane .vr-ref-section');
          if (firstCategory) await spotlight(firstCategory, 2000, ctx);
        }
        await ctx.delay(800);
      },
      preAction: async (ctx) => {
        await ensureTh17Ready(ctx);
        if (isExpressionEditorOpen()) {
          closeExpressionEditor();
          await ctx.delay(300);
        }
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
        if (isRulesModalOpen()) closeRulesModal();
        await ctx.delay(200);
      },
      verify: HAR.MAPPER_RULES_BTN,
    },

    // ── Step 6: Verify Rules — See Pass/Fail Results ──────────────
    {
      id: 'th17-dsl-verify',
      title: 'Verify Rules — Pass/Fail Results',
      description:
        'Click **▶ Verify** to evaluate all three rules against the sample API response. ' +
        'Each line gets a colored **gutter marker**: green ✓ for passing rules, red ✗ with ' +
        '"← Got: …" for failing rules. The header shows **3/3 passed**. This instant feedback ' +
        'lets you iterate quickly — change a value, re-verify, see what breaks. No need to ' +
        'run the full test suite just to check your validation logic.',
      highlight: HAR.VR_VERIFY_BTN,
      action: async (ctx) => {
        // Rules modal should already be open from preAction / step 5
        if (!isRulesModalOpen()) {
          clickRulesToolbarButton();
          await ctx.delay(1000);
          setDslEditorValue([
            '$.name equals "Leanne Graham"',
            '$.email contains "@"',
            '$.id greater_than 0',
          ].join('\n'));
          await ctx.delay(500);
        }

        // Highlight and click Verify
        const verifyBtn = document.querySelector<HTMLElement>(HAR.VR_VERIFY_BTN);
        if (verifyBtn) {
          await spotlight(verifyBtn, 2000, ctx);
          await ctx.delay(600);
          verifyBtn.click();
          await ctx.delay(1800);
        }

        // Highlight pass/fail header stats (e.g. 3/3 passed) — keep tight, not the whole shell
        const passStat = document.querySelector<HTMLElement>(HAR.VR_STAT_PASS);
        const failStat = document.querySelector<HTMLElement>(HAR.VR_STAT_FAIL);
        const statsEl = passStat ?? failStat;
        if (statsEl) await spotlight(statsEl, 2200, ctx);
        await ctx.delay(800);

        // Spotlight the code lines area (all 3 verified rules as one group)
        const viewLines = document.querySelector<HTMLElement>('.vr-modal-editor-pane .view-lines');
        if (viewLines) await spotlight(viewLines, 3000, ctx);
        await ctx.delay(800);
        // Stay in the Rules modal — do not close or return to Data Mapper
      },
      preAction: async (ctx) => {
        await ensureTh17Ready(ctx);
        if (isExpressionEditorOpen()) {
          closeExpressionEditor();
          await ctx.delay(300);
        }
        if (!isDataMapperOpen()) await ensureMapperOpen(ctx);
        if (!isRulesModalOpen()) {
          clickRulesToolbarButton();
          await ctx.delay(700);
        }
        setDslEditorValue([
          '$.name equals "Leanne Graham"',
          '$.email contains "@"',
          '$.id greater_than 0',
        ].join('\n'));
        await ctx.delay(300);
      },
      verify: HAR.VR_VERIFY_BTN,
    },
  ],
};
