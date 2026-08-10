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
  clearRunnerSlaOverrides,
  ensureTh13FgExists,
  expandFirstFg,
  expandFirstScenario,
  TH13_SC_NAME,
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
    await ctx.delay(300);
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

function hasAtLeastTwoSlaTargetsOnCard(): boolean {
  const slaBtn = findSlaButton();
  if (!slaBtn) return false;
  const count = Number(slaBtn.textContent?.match(/\d+/)?.[0] ?? 0);
  return count >= 2;
}

const TH13_PACE_MULTIPLIER = 1.0;
const pace = (ms: number): number => Math.round(ms * TH13_PACE_MULTIPLIER);
const TH13_HIGHLIGHT_SETTLE_MS = 220;

async function spotlightWithPause(
  ctx: DemoActionContext,
  el: HTMLElement,
  holdMs: number,
): Promise<void> {
  await spotlight(el, pace(holdMs), ctx);
  await ctx.delay(pace(TH13_HIGHLIGHT_SETTLE_MS));
}

async function spotlightSelWithPause(
  ctx: DemoActionContext,
  selector: string,
  holdMs: number,
): Promise<void> {
  await spotlightSel(ctx, selector, pace(holdMs));
  await ctx.delay(pace(TH13_HIGHLIGHT_SETTLE_MS));
}

async function ensureTh13RunnerSelection(ctx: DemoActionContext): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const root = document.querySelector<HTMLElement>(HAR.SCENARIO_SELECTOR);
    if (!root) {
      await ctx.delay(pace(100));
      continue;
    }

    const scenarios = Array.from(root.querySelectorAll<HTMLElement>('.selection-scenario'));
    if (scenarios.length === 0) {
      await ctx.delay(pace(100));
      continue;
    }

    const deselectBtn = Array.from(root.querySelectorAll<HTMLElement>('button'))
      .find((b) => b.textContent?.trim() === 'Deselect All');
    deselectBtn?.click();
    await ctx.delay(pace(80));

    const preferred = scenarios.find((row) =>
      row.textContent?.toLowerCase().includes(TH13_SC_NAME.toLowerCase()),
    );

    const target = preferred ?? scenarios[0];
    const cb = target?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (cb && !cb.checked) cb.click();
    await ctx.delay(pace(140));

    const hasSelectedScenario = !!root.querySelector('.selection-scenario input[type="checkbox"]:checked');
    if (hasSelectedScenario) return;
  }
}

async function ensureTh13SlaTargets(ctx: DemoActionContext): Promise<void> {
  await ensureTh13Ready(ctx);

  const slaBtn = findSlaButton();
  if (!slaBtn) return;

  slaBtn.click();
  await ctx.delay(pace(280));

  const addBtn = document.querySelector<HTMLElement>(HAR.SLA_ADD_BTN);
  if (!addBtn) return;

  // Remove any leftover targets from prior lesson runs so we always start clean.
  let deleteBtns = document.querySelectorAll<HTMLElement>(HAR.SLA_DELETE_BTN);
  while (deleteBtns.length > 0) {
    deleteBtns[0].click();
    await ctx.delay(pace(60));
    deleteBtns = document.querySelectorAll<HTMLElement>(HAR.SLA_DELETE_BTN);
  }

  addBtn.click();
  await ctx.delay(pace(160));
  await selectSlaMetric(ctx, 0, 'P95 Response Time');
  fillSlaInput(0, 0, '500');
  fillSlaInput(0, 1, '300');
  await ctx.delay(pace(120));

  addBtn.click();
  await ctx.delay(pace(160));
  await selectSlaMetric(ctx, 1, 'Error Rate');
  fillSlaInput(1, 0, '1');
  fillSlaInput(1, 1, '0.5');
  await ctx.delay(pace(120));

  saveSlaModal();
  await ctx.delay(pace(200));
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
  const wrap = row.querySelector<HTMLElement>(HAR.SLA_METRIC_SELECT);
  if (!wrap) return;
  const trigger = wrap.querySelector<HTMLElement>('.cs-trigger') ?? wrap;
  trigger.click();
  await ctx.delay(pace(200));

  // CustomSelect portals `.cs-menu` to document.body — options are not inside the row wrap.
  const menu = document.querySelector<HTMLElement>('body > .cs-menu');
  const options = Array.from(
    (menu ?? document).querySelectorAll<HTMLElement>('.cs-item, [role="option"]'),
  );
  const option = options.find((opt) => {
    const text = opt.textContent?.trim() ?? '';
    return text === label || text.startsWith(label);
  });
  if (option) {
    option.click();
    await ctx.delay(pace(120));
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
    clearRunnerSlaOverrides();
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
    clearRunnerSlaOverrides();
    deleteTh13DemoFg();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: The SLA Targets Modal ────────────────────────────
    {
      id: 'th13-open-sla-modal',
      title: 'The SLA Targets Modal',
      description:
        'Look for the **🎯** button on each test card — that opens the SLA Targets modal.\n\n' +
        'SLA targets define absolute acceptance criteria like "P95 must always be ≤ 500ms" ' +
        'or "error rate must be ≤ 1%" — hard contracts, not relative comparisons between runs.',
      highlight: HAR.TEST_SLA_BTN,
      preAction: async (ctx) => {
        await ensureTh13Ready(ctx);
        if (isSlaModalOpen()) closeSlaModal();
        await ctx.delay(100);
      },
      action: async (ctx) => {
        // Reading ring already on 🎯 — click without re-spotlighting
        const slaBtn = findSlaButton();
        if (slaBtn) {
          slaBtn.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          await ctx.delay(pace(280));
          slaBtn.click();
          await ctx.delay(pace(500));
        }

        await ctx.waitFor(HAR.SLA_MODAL);
        await spotlightSelWithPause(ctx, HAR.SLA_MODAL, 900);
        await ctx.delay(pace(200));

        const addBtn = document.querySelector<HTMLElement>(HAR.SLA_ADD_BTN);
        if (addBtn) await spotlightWithPause(ctx, addBtn, 800);
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
          await ctx.delay(pace(280));
        }

        const firstRow = document.querySelector<HTMLElement>(`${HAR.SLA_TABLE} tbody tr`);
        if (firstRow) await spotlightWithPause(ctx, firstRow, 700);

        await selectSlaMetric(ctx, 0, 'P95 Response Time');
        await ctx.delay(pace(200));
        fillSlaInput(0, 0, '500');
        await ctx.delay(pace(160));
        fillSlaInput(0, 1, '300');
        await ctx.delay(pace(240));

        const operator = document.querySelector<HTMLElement>(HAR.SLA_OPERATOR);
        if (operator) await spotlightWithPause(ctx, operator, 500);

        if (addBtn) {
          addBtn.click();
          await ctx.delay(pace(220));
        }
        await selectSlaMetric(ctx, 1, 'Error Rate');
        await ctx.delay(pace(160));
        fillSlaInput(1, 0, '1');
        await ctx.delay(pace(120));
        fillSlaInput(1, 1, '0.5');
        await ctx.delay(pace(280));

        // Pause on both configured rows before closing — viewer absorbs the contract
        const rows = document.querySelectorAll<HTMLElement>(`${HAR.SLA_TABLE} tbody tr`);
        if (rows[0]) {
          await spotlightWithPause(ctx, rows[0], 1200);
          await ctx.delay(pace(400));
        }
        if (rows[1]) {
          await spotlightWithPause(ctx, rows[1], 1200);
          await ctx.delay(pace(500));
        }
        const table = document.querySelector<HTMLElement>(HAR.SLA_TABLE);
        if (table) await spotlightWithPause(ctx, table, 900);
        await ctx.delay(pace(400));

        saveSlaModal();
        await ctx.delay(pace(280));
      },
      preAction: async (ctx) => {
        await ensureTh13Ready(ctx);
        if (!isSlaModalOpen()) {
          const slaBtn = findSlaButton();
          if (slaBtn) {
            slaBtn.click();
            await ctx.delay(pace(280));
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
        if (slaBtn) await spotlightWithPause(ctx, slaBtn, 500);

        const panel = document.querySelector<HTMLElement>(HAR.SLA_SUMMARY_PANEL);
        if (panel) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await ctx.delay(pace(220));

          const header = panel.querySelector<HTMLElement>('.scenario-sla-panel-header');
          if (header) {
            const expanded = header.getAttribute('aria-expanded');
            if (expanded === 'false') {
              header.click();
              await ctx.delay(pace(220));
            }
          }

          const table = panel.querySelector<HTMLElement>(HAR.SLA_SUMMARY_TABLE);
          if (table) await spotlightWithPause(ctx, table, 900);
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

    // ── Step 4: Runner SLA Override + Create Override ─────────────
    {
      id: 'th13-runner-trigger',
      title: 'Runner SLA Override & Create Override',
      description:
        'The **🎯 SLA Override** trigger bar on the Test Runner shows how many targets are ' +
        'configured and how many overrides are active. Click **Configure** to open the override ' +
        'modal, then click **Override** on a configured target to clone it into the overrides ' +
        'section with editable thresholds. Runner overrides are temporary and apply only to the current run.',
      highlight: HAR.SLA_TRIGGER,
      action: async (ctx) => {
        if (!document.querySelector(HAR.SLA_TRIGGER)) {
          await ensureTh13RunnerSelection(ctx);
          await ctx.delay(pace(140));
        }

        await spotlightSelWithPause(ctx, HAR.SLA_TRIGGER, 700);

        const configBtn = document.querySelector<HTMLElement>(HAR.SLA_TRIGGER_BTN);
        if (configBtn) {
          await spotlightWithPause(ctx, configBtn, 500);
          configBtn.click();
          await ctx.delay(pace(320));
        }

        const modal = document.querySelector<HTMLElement>(HAR.SLA_OVERRIDE_MODAL);
        if (!modal) return;
        await spotlightWithPause(ctx, modal, 700);

        const defsToggle = modal.querySelector<HTMLElement>('.sla-defs-toggle');
        if (defsToggle) {
          const chevron = defsToggle.querySelector('.sla-chevron');
          if (chevron?.textContent?.trim() === '▼') {
            defsToggle.click();
            await ctx.delay(pace(220));
          }
        }

        const overrideBtns = modal.querySelectorAll<HTMLElement>('.sla-btn-override');
        if (overrideBtns.length > 0) {
          await spotlightWithPause(ctx, overrideBtns[0], 500);
          overrideBtns[0].click();
          await ctx.delay(pace(500));
        }

        // Let the viewer absorb the cloned override row before closing
        const overriddenBadge = modal.querySelector<HTMLElement>('.sla-btn-overridden');
        if (overriddenBadge) {
          await spotlightWithPause(ctx, overriddenBadge, 900);
        }

        const overrideRow = modal.querySelector<HTMLElement>('.sla-ovr-table tbody tr');
        if (overrideRow) {
          await spotlightWithPause(ctx, overrideRow, 1400);
          await ctx.delay(pace(400));
        }

        const overrideSection = modal.querySelector<HTMLElement>('.sla-overrides-section');
        if (overrideSection) {
          await spotlightWithPause(ctx, overrideSection, 1200);
          await ctx.delay(pace(350));
        }

        const footerActions = modal.querySelector<HTMLElement>('.sla-modal-footer-actions');
        if (footerActions) {
          const btns = footerActions.querySelectorAll<HTMLElement>('.btn');
          for (const btn of btns) {
            if (btn.textContent?.trim() === 'Save') { btn.click(); break; }
          }
        }
        await ctx.delay(pace(220));

        const trigger = document.querySelector<HTMLElement>(HAR.SLA_TRIGGER);
        if (trigger) await spotlightWithPause(ctx, trigger, 500);
      },
      preAction: async (ctx) => {
        if (isSlaModalOpen()) closeSlaModal();
        if (isSlaOverrideOpen()) closeSlaOverrideModal();
        clearRunnerSlaOverrides();
        if (!hasAtLeastTwoSlaTargetsOnCard()) {
          await ensureTh13SlaTargets(ctx);
        }
        await ctx.delay(60);
        ctx.navigateToTab('runner');
        await ctx.delay(pace(280));
        await ensureTh13RunnerSelection(ctx);
        await ctx.delay(pace(220));
      },
      verify: HAR.SLA_TRIGGER,
    },
  ],
};
