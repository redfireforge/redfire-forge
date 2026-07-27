/**
 * TH-13: SLA Targets & Acceptance Criteria
 *
 * Define performance contracts — response time thresholds, throughput,
 * error rate — with warn/fail two-tier system and runner overrides.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  seedDemoEnvAndService,
  seedTh13FeatureGroup,
  deleteTh13DemoFg,
  ensureTh13FgExists,
  expandFirstFg,
  expandFirstScenario,
  spotlight,
  spotlightSel,
  findSlaButton,
  closeSlaModal,
  saveSlaModal,
  closeSlaOverrideModal,
} from './th-demo-helpers';
import { fillControlledInput } from '../setup-helpers';

/* ── local helpers ──────────────────────────────────────────── */

async function ensureTh13Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh13FgExists(ctx);
  if (!document.querySelector(HAR.FG_CARD)) {
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
  }
  await expandFirstFg(ctx);
  await expandFirstScenario(ctx);
}

function isSlaModalOpen(): boolean {
  return !!document.querySelector(HAR.SLA_MODAL);
}

function isSlaOverrideOpen(): boolean {
  return !!document.querySelector(HAR.SLA_OVERRIDE_MODAL);
}

/** Fill an SLA editor input by column index within a row. */
function fillSlaInput(rowIdx: number, inputIdx: number, value: string): void {
  const table = document.querySelector<HTMLElement>(HAR.SLA_TABLE);
  if (!table) return;
  const rows = table.querySelectorAll<HTMLElement>('tbody tr');
  const row = rows[rowIdx];
  if (!row) return;
  const inputs = row.querySelectorAll<HTMLInputElement>(HAR.SLA_INPUT);
  const input = inputs[inputIdx];
  if (!input) return;
  fillControlledInput(input, value);
}

/** Select a metric from the CustomSelect in a given row. */
async function selectSlaMetric(ctx: DemoActionContext, rowIdx: number, label: string): Promise<void> {
  const table = document.querySelector<HTMLElement>(HAR.SLA_TABLE);
  if (!table) return;
  const rows = table.querySelectorAll<HTMLElement>('tbody tr');
  const row = rows[rowIdx];
  if (!row) return;
  const select = row.querySelector<HTMLElement>(HAR.SLA_METRIC_SELECT);
  if (!select) return;
  select.click();
  await ctx.delay(300);

  const options = document.querySelectorAll<HTMLElement>('.custom-select-option');
  for (const opt of options) {
    if (opt.textContent?.trim() === label) {
      opt.click();
      await ctx.delay(200);
      return;
    }
  }
}

/* ── lesson definition ──────────────────────────────────────── */

export const thSlaConfigurationLesson: DemoLesson = {
  id: 'th-sla-configuration',
  domainId: 'harness',
  category: 'runner',
  name: 'SLA Targets & Acceptance Criteria',
  description:
    'Define absolute performance contracts — response time thresholds, throughput, ' +
    'and error rate — with a warn/fail two-tier system and runner overrides.',
  estimatedMinutes: 5,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios', 'runner'],
  concept: {
    title: 'SLA Targets',
    body:
      'SLA targets define **absolute acceptance criteria** for your API tests:\n\n' +
      '- **7 metrics**: P50, P95, P99, P99.9, Avg Response Time (ms), TPS, Error Rate (%)\n' +
      '- **Warn/Fail two tiers**: amber warning before the red failure threshold\n' +
      '- **Runner overrides**: temporary threshold changes for a single run\n' +
      '- **Results evaluation**: pass/warn/fail status per target after execution',
    keyTerms: [
      { term: 'SLA Target', definition: 'An absolute threshold for a metric (e.g., P95 < 200ms).' },
      { term: 'Warn/Fail', definition: 'Two-tier system: amber warning before the red failure threshold.' },
      { term: 'Runner Override', definition: 'Temporary threshold change for a single run without editing the definition.' },
    ],
    diagram: `<svg viewBox="0 0 380 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="80" height="60" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="45" y="28" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Define</text>
      <text x="45" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">P95 &lt; 200ms</text>
      <text x="45" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">TPS &gt; 50</text>
      <path d="M90 40 L120 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th13arr)"/>
      <rect x="125" y="10" width="75" height="60" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="162" y="25" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Thresholds</text>
      <rect x="135" y="33" width="55" height="10" rx="2" fill="#1e293b" stroke="#f59e0b" stroke-width="0.8"/>
      <text x="162" y="41" text-anchor="middle" fill="#f59e0b" font-size="5">Warn: 180ms</text>
      <rect x="135" y="48" width="55" height="10" rx="2" fill="#1e293b" stroke="#ef4444" stroke-width="0.8"/>
      <text x="162" y="56" text-anchor="middle" fill="#ef4444" font-size="5">Fail: 200ms</text>
      <path d="M205 40 L235 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th13arr)"/>
      <rect x="240" y="10" width="60" height="60" rx="5" fill="#1e293b" stroke="#a855f7" stroke-width="1.5"/>
      <text x="270" y="28" text-anchor="middle" fill="#a855f7" font-size="7" font-weight="700">Run</text>
      <text x="270" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Execute</text>
      <text x="270" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">Measure</text>
      <path d="M305 40 L330 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th13arr)"/>
      <rect x="335" y="10" width="40" height="60" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="355" y="30" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">SLA</text>
      <text x="355" y="44" text-anchor="middle" fill="#10b981" font-size="6">Pass</text>
      <text x="355" y="56" text-anchor="middle" fill="#94a3b8" font-size="5">or Fail</text>
      <defs><marker id="th13arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    deleteTh13DemoFg();
    await ctx.delay(200);
    await seedDemoEnvAndService(ctx);
    await seedTh13FeatureGroup(ctx);
    await ctx.delay(300);
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
    await expandFirstFg(ctx);
    await expandFirstScenario(ctx);
  },

  cleanup: async (ctx) => {
    if (isSlaModalOpen()) closeSlaModal();
    if (isSlaOverrideOpen()) closeSlaOverrideModal();
    await ctx.delay(200);
    deleteTh13DemoFg();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: The SLA Targets Modal ────────────────────────────
    {
      id: 'th13-open-sla-modal',
      title: 'The SLA Targets Modal',
      description:
        'The **🎯** button on each test card opens the SLA Targets modal. SLA targets define ' +
        'absolute acceptance criteria like "P95 must always be ≤ 500ms" or "error rate must be ' +
        '≤ 1%" — these are hard contracts, not relative comparisons between runs.',
      highlight: HAR.SLA_MODAL,
      action: async (ctx) => {
        const emptyHint = document.querySelector<HTMLElement>(HAR.SLA_EMPTY_HINT);
        if (emptyHint) await spotlight(emptyHint, 1200, ctx);

        const addBtn = document.querySelector<HTMLElement>(HAR.SLA_ADD_BTN);
        if (addBtn) await spotlight(addBtn, 800, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh13Ready(ctx);
        if (isSlaModalOpen()) closeSlaModal();
        await ctx.delay(100);
        const slaBtn = findSlaButton();
        if (slaBtn) {
          slaBtn.click();
          await ctx.delay(600);
        }
      },
      verify: HAR.SLA_MODAL,
    },

    // ── Step 2: Add SLA Targets ──────────────────────────────────
    {
      id: 'th13-add-targets',
      title: 'Add SLA Targets',
      description:
        'Click **+ Add Target** to create a new row with **Metric**, **Operator** (auto-set), ' +
        '**Fail at**, and **Warn at** columns. Choose from 7 metrics — latency percentiles ' +
        'default to ≤ ("at or below"), while TPS defaults to ≥ ("at or above"). The warn ' +
        'threshold is an early amber warning before the red fail.',
      highlight: HAR.SLA_TABLE,
      action: async (ctx) => {
        const addBtn = document.querySelector<HTMLElement>(HAR.SLA_ADD_BTN);

        if (addBtn) {
          addBtn.click();
          await ctx.delay(500);
        }

        const firstRow = document.querySelector<HTMLElement>(`${HAR.SLA_TABLE} tbody tr`);
        if (firstRow) await spotlight(firstRow, 1200, ctx);

        await selectSlaMetric(ctx, 0, 'P95 Response Time');
        await ctx.delay(400);
        fillSlaInput(0, 0, '500');
        await ctx.delay(300);
        fillSlaInput(0, 1, '300');
        await ctx.delay(500);

        const operator = document.querySelector<HTMLElement>(HAR.SLA_OPERATOR);
        if (operator) await spotlight(operator, 800, ctx);

        if (addBtn) {
          addBtn.click();
          await ctx.delay(400);
        }
        await selectSlaMetric(ctx, 1, 'Error Rate');
        await ctx.delay(300);
        fillSlaInput(1, 0, '1');
        await ctx.delay(200);
        fillSlaInput(1, 1, '0.5');
        await ctx.delay(500);

        const rows = document.querySelectorAll<HTMLElement>(`${HAR.SLA_TABLE} tbody tr`);
        if (rows.length > 0) {
          await spotlight(rows[rows.length - 1], 800, ctx);
        }

        saveSlaModal();
        await ctx.delay(500);
      },
      preAction: async (ctx) => {
        await ensureTh13Ready(ctx);
        if (!isSlaModalOpen()) {
          const slaBtn = findSlaButton();
          if (slaBtn) {
            slaBtn.click();
            await ctx.delay(600);
          }
        }
      },
      verify: HAR.FG_CARD,
    },

    // ── Step 3: SLA Badge & Summary ──────────────────────────────
    {
      id: 'th13-sla-badge',
      title: 'SLA Badge & Summary',
      description:
        'After saving, the test card shows a **🎯 2** badge indicating configured targets. ' +
        'The **🎯 SLA Summary** panel at the bottom of the scenario aggregates all targets ' +
        'across tests — click any row to edit that test\'s SLA configuration.',
      highlight: HAR.SLA_SUMMARY_PANEL,
      action: async (ctx) => {
        const slaBtn = findSlaButton();
        if (slaBtn) await spotlight(slaBtn, 800, ctx);

        const panel = document.querySelector<HTMLElement>(HAR.SLA_SUMMARY_PANEL);
        if (panel) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await ctx.delay(400);

          const header = panel.querySelector<HTMLElement>('.scenario-sla-panel-header');
          if (header) {
            const expanded = header.getAttribute('aria-expanded');
            if (expanded === 'false') {
              header.click();
              await ctx.delay(400);
            }
          }

          const table = panel.querySelector<HTMLElement>(HAR.SLA_SUMMARY_TABLE);
          if (table) await spotlight(table, 1500, ctx);
        }
      },
      preAction: async (ctx) => {
        await ensureTh13Ready(ctx);
        if (isSlaModalOpen()) closeSlaModal();
        await ctx.delay(100);

        const slaBtn = findSlaButton();
        if (slaBtn && !slaBtn.classList.contains('btn-sla-active')) {
          slaBtn.click();
          await ctx.delay(400);
          const addBtn = document.querySelector<HTMLElement>(HAR.SLA_ADD_BTN);
          if (addBtn) {
            addBtn.click();
            await ctx.delay(200);
            await selectSlaMetric(ctx, 0, 'P95 Response Time');
            fillSlaInput(0, 0, '500');
            fillSlaInput(0, 1, '300');
            await ctx.delay(100);
            addBtn.click();
            await ctx.delay(200);
            await selectSlaMetric(ctx, 1, 'Error Rate');
            fillSlaInput(1, 0, '1');
            fillSlaInput(1, 1, '0.5');
          }
          saveSlaModal();
          await ctx.delay(300);
        }
      },
      verify: HAR.SLA_SUMMARY_PANEL,
    },

    // ── Step 4: Runner SLA Override Trigger ───────────────────────
    {
      id: 'th13-runner-trigger',
      title: 'Runner SLA Override',
      description:
        'The **🎯 SLA Override** trigger bar on the Test Runner shows how many targets are ' +
        'configured and how many overrides are active. Click **Configure** to open the override ' +
        'modal — runner overrides are temporary, applying only to the current run.',
      highlight: HAR.SLA_TRIGGER,
      action: async (ctx) => {
        await spotlightSel(ctx, HAR.SLA_TRIGGER, 1200);

        const configBtn = document.querySelector<HTMLElement>(HAR.SLA_TRIGGER_BTN);
        if (configBtn) {
          await spotlight(configBtn, 800, ctx);
          configBtn.click();
          await ctx.delay(600);
        }

        const modal = document.querySelector<HTMLElement>(HAR.SLA_OVERRIDE_MODAL);
        if (modal) await spotlight(modal, 1200, ctx);
      },
      preAction: async (ctx) => {
        if (isSlaModalOpen()) closeSlaModal();
        if (isSlaOverrideOpen()) closeSlaOverrideModal();
        await ctx.delay(100);
        ctx.navigateToTab('runner');
        await ctx.delay(600);
      },
      verify: HAR.SLA_TRIGGER,
    },

    // ── Step 5: Create an Override ────────────────────────────────
    {
      id: 'th13-override-target',
      title: 'Create an Override',
      description:
        'Click **Override** on a target to clone it into the overrides section with the metric ' +
        'locked but thresholds editable. This lets you experiment with tighter thresholds ' +
        'without editing the test definition — overrides apply only to the current run.',
      highlight: HAR.SLA_OVERRIDE_MODAL,
      action: async (ctx) => {
        const modal = document.querySelector<HTMLElement>(HAR.SLA_OVERRIDE_MODAL);
        if (!modal) return;

        const defsToggle = modal.querySelector<HTMLElement>('.sla-defs-toggle');
        if (defsToggle) {
          const chevron = defsToggle.querySelector('.sla-chevron');
          if (chevron?.textContent?.trim() === '▼') {
            defsToggle.click();
            await ctx.delay(400);
          }
        }

        const overrideBtns = modal.querySelectorAll<HTMLElement>('.sla-btn-override');
        if (overrideBtns.length > 0) {
          await spotlight(overrideBtns[0], 800, ctx);
          overrideBtns[0].click();
          await ctx.delay(600);
        }

        const overrideSection = modal.querySelector<HTMLElement>('.sla-overrides-section');
        if (overrideSection) {
          await spotlight(overrideSection, 1000, ctx);
        }

        const footerActions = modal.querySelector<HTMLElement>('.sla-modal-footer-actions');
        if (footerActions) {
          const btns = footerActions.querySelectorAll<HTMLElement>('.btn');
          for (const btn of btns) {
            if (btn.textContent?.trim() === 'Save') { btn.click(); break; }
          }
        }
        await ctx.delay(400);

        const trigger = document.querySelector<HTMLElement>(HAR.SLA_TRIGGER);
        if (trigger) await spotlight(trigger, 800, ctx);
      },
      preAction: async (ctx) => {
        if (isSlaModalOpen()) closeSlaModal();
        if (!isSlaOverrideOpen()) {
          ctx.navigateToTab('runner');
          await ctx.delay(500);
          const configBtn = document.querySelector<HTMLElement>(HAR.SLA_TRIGGER_BTN);
          if (configBtn) {
            configBtn.click();
            await ctx.delay(600);
          }
        }
      },
      verify: HAR.SLA_TRIGGER,
    },
  ],
};
