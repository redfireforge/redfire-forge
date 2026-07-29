/**
 * TH-8: Load Profiles & Advanced Execution
 *
 * Teaches the advanced execution configuration UI — load profiles
 * (ramp-up/sustained/spike), think time delays, error policies,
 * and constant arrival rate (desktop-only narration).
 *
 * This lesson is configuration-focused; it does NOT run a test.
 * Actual execution is covered in TH-4 and TH-7.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  seedDemoEnvAndService,
  seedTh8FeatureGroup,
  deleteTh8DemoFg,
  ensureTh8FgExists,
  selectFirstScenarioInRunner,
  spotlight,
  spotlightSel,
  clickRadioByLabel,
  clickProfileType,
  tourLoadProfileType,
  setFieldByLabel,
  setThinkTimeMs,
} from './th-demo-helpers';

const EXEC_CONFIG = HAR.EXEC_CONFIG;
const EXEC_MODE_BOX = '.execution-group .runner-option-box';
const THINK_TIME_BOX = '.think-time-section .runner-option-box';

async function ensureTh8Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh8FgExists(ctx);
  if (!document.querySelector('.test-runner-page')) {
    ctx.navigateToTab('runner');
    await ctx.delay(600);
  }
  await selectFirstScenarioInRunner(ctx);
}

function switchExecMode(label: string): void {
  clickRadioByLabel(EXEC_MODE_BOX, label);
}

function ensureLoadProfileMode(ctx: DemoActionContext): Promise<void> {
  if (!document.querySelector(HAR.LOAD_PROFILE_SEC)) {
    switchExecMode('Load Profile');
    return ctx.delay(500);
  }
  return Promise.resolve();
}

export const thLoadTestingLesson: DemoLesson = {
  id: 'th-load-testing',
  domainId: 'harness',
  category: 'execution',
  name: 'Load Profiles & Advanced Execution',
  description:
    'Configure advanced execution modes — load profiles with ramp-up, sustained, and spike patterns, ' +
    'think time delays, error policies, and constant arrival rate.',
  estimatedMinutes: 5,
  initialTab: 'runner',
  allowedTabs: ['runner'],
  concept: {
    title: 'Advanced Execution Configuration',
    body:
      'Beyond simple sequential or batch execution, RedfireForge offers **Load Profiles** that shape ' +
      'concurrency over time (ramp-up, sustained, spike), **Think Time** delays for realistic user simulation, ' +
      '**Error Policies** to control run behavior on failures, and **Constant Arrival Rate** for open-model load testing.\n\n' +
      'This lesson walks through each configuration section so you know how to set up any load testing scenario.',
    keyTerms: [
      { term: 'Load Profile', definition: 'Shapes concurrency over time: ramp-up, sustained, spike.' },
      { term: 'Think Time', definition: 'Pauses between requests to simulate real user behavior.' },
      { term: 'Error Policy', definition: 'Controls whether the run stops or continues on failures.' },
    ],
    diagram: `<svg viewBox="0 0 380 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="10" width="80" height="60" rx="5" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="45" y="28" text-anchor="middle" fill="#f59e0b" font-size="7" font-weight="700">Load Profile</text>
      <text x="45" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Ramp / Spike</text>
      <text x="45" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">Sustained</text>
      <path d="M90 40 L115 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th8arr)"/>
      <rect x="120" y="10" width="75" height="60" rx="5" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="157" y="28" text-anchor="middle" fill="#10b981" font-size="7" font-weight="700">Think Time</text>
      <text x="157" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Fixed / Random</text>
      <text x="157" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">Pacing delay</text>
      <path d="M200 40 L225 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th8arr)"/>
      <rect x="230" y="10" width="70" height="60" rx="5" fill="#1e293b" stroke="#ef4444" stroke-width="1.5"/>
      <text x="265" y="28" text-anchor="middle" fill="#ef4444" font-size="7" font-weight="700">Resilience</text>
      <text x="265" y="42" text-anchor="middle" fill="#94a3b8" font-size="5.5">Error policy</text>
      <text x="265" y="54" text-anchor="middle" fill="#94a3b8" font-size="5.5">Max errors</text>
      <path d="M305 40 L325 40" stroke="#64748b" stroke-width="1.2" marker-end="url(#th8arr)"/>
      <rect x="330" y="15" width="45" height="50" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="352" y="35" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="700">Run</text>
      <text x="352" y="49" text-anchor="middle" fill="#94a3b8" font-size="5.5">Execute</text>
      <defs><marker id="th8arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    deleteTh8DemoFg();
    await ctx.delay(200);
    await seedDemoEnvAndService(ctx);
    await seedTh8FeatureGroup(ctx);
    await ctx.delay(300);
    ctx.navigateToTab('runner');
    await ctx.delay(600);
    await selectFirstScenarioInRunner(ctx);
  },

  cleanup: async (ctx) => {
    switchExecMode('Batch');
    await ctx.delay(200);
    clickRadioByLabel(THINK_TIME_BOX, 'None');
    await ctx.delay(100);
    clickRadioByLabel(EXEC_CONFIG, 'Continue');
    await ctx.delay(100);
    deleteTh8DemoFg();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: Load Profile Mode ────────────────────────────────
    {
      id: 'th8-load-profile',
      title: 'Load Profile Mode',
      description:
        'The **Execution Mode** row offers five modes. Switch to **Load Profile** to reveal ' +
        'the profile configurator — a time-based execution model where concurrency follows a ' +
        'defined shape. The SVG preview chart shows exactly how concurrency scales over the run duration.',
      highlight: HAR.EXEC_MODE_LOAD_PROFILE,
      action: async (ctx) => {
        await ensureTh8Ready(ctx);

        switchExecMode('Load Profile');
        await ctx.delay(800);

        setFieldByLabel(HAR.LOAD_PROFILE_SEC, 'Duration (sec)', 10);
        await ctx.delay(300);
        setFieldByLabel(HAR.LOAD_PROFILE_SEC, 'Max Concurrency', 5);
        await ctx.delay(300);
        setFieldByLabel(HAR.LOAD_PROFILE_SEC, 'Ramp (sec)', 5);
        await ctx.delay(500);

        // Spotlight the whole load-profile configurator (type tabs + fields + chart)
        await spotlightSel(ctx, HAR.LOAD_PROFILE_SEC, 2200);
      },
      preAction: async (ctx) => {
        await ensureTh8Ready(ctx);
      },
      verify: HAR.LOAD_PROFILE_SEC,
    },

    // ── Step 2: Profile Types ────────────────────────────────────
    {
      id: 'th8-profile-types',
      title: 'Profile Types',
      description:
        'We will walk each profile type in order — **Ramp-Up**, then **Sustained**, then **Spike**.\n\n' +
        'For every type, watch the **button**, the **description**, the **parameter fields**, ' +
        'and the **preview chart** update together.\n\n' +
        '- **Ramp-Up** — gradually increase concurrency from 1 to max (capacity testing)\n' +
        '- **Sustained** — hold steady concurrency (endurance testing)\n' +
        '- **Spike** — base load with a short burst (sudden traffic surges)',
      highlight: HAR.PROFILE_TYPE_SEL,
      pauseAfter: true,

      preAction: async (ctx) => {
        await ensureTh8Ready(ctx);
        await ensureLoadProfileMode(ctx);
        // Start from Ramp-Up so the ordered tour matches narration.
        clickProfileType('Ramp-Up');
        await ctx.delay(200);
      },

      action: async (ctx) => {
        const section = document.querySelector<HTMLElement>(HAR.LOAD_PROFILE_SEC);
        section?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        await ctx.delay(400);

        // 1) Ramp-Up — button → description → fields (Duration / Max / Ramp) → chart
        await tourLoadProfileType(ctx, 'Ramp-Up');

        // 2) Sustained — fewer fields; chart flattens
        await tourLoadProfileType(ctx, 'Sustained');

        // 3) Spike — Spike Concurrency / Start / Duration fields appear
        await tourLoadProfileType(ctx, 'Spike');

        // Leave Ramp-Up selected as the practical default for the rest of the lesson.
        clickProfileType('Ramp-Up');
        await ctx.delay(400);
        const rampBtn = document.querySelector<HTMLElement>(`${HAR.PROFILE_TYPE_BTN}.active`);
        if (rampBtn) await spotlight(rampBtn, 1000, ctx);
      },

      verify: HAR.PROFILE_TYPE_SEL,
    },

    // ── Step 3: Think Time ───────────────────────────────────────
    {
      id: 'th8-think-time',
      title: 'Think Time Delays',
      description:
        'Think Time adds realistic delays between requests, simulating how real users pause ' +
        'between actions.\n\n' +
        'We will click each option so you can see the inline controls:\n' +
        '- **None** — no delay (default)\n' +
        '- **Constant** — fixed delay in ms\n' +
        '- **Uniform** — random delay between min and max\n' +
        '- **Gaussian** — bell-curve around a mean (μ) with spread (σ)',
      highlight: HAR.THINK_TIME_SEC,
      action: async (ctx) => {
        const section = document.querySelector<HTMLElement>(HAR.THINK_TIME_SEC);
        section?.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
        await ctx.delay(400);

        await spotlightSel(ctx, HAR.THINK_TIME_SEC, 1400);
        await ctx.delay(400);

        const findThinkLabel = (name: string): HTMLElement | null => {
          const root = document.querySelector<HTMLElement>(THINK_TIME_BOX);
          if (!root) return null;
          return Array.from(root.querySelectorAll<HTMLElement>('.radio-label'))
            .find((l) => l.textContent?.trim() === name) ?? null;
        };

        // 1) None — starting point
        const noneLabel = findThinkLabel('None');
        if (noneLabel) {
          clickRadioByLabel(THINK_TIME_BOX, 'None');
          await spotlight(noneLabel, 1400, ctx);
          await ctx.delay(500);
        }

        // 2) Constant — fixed ms delay
        const constantLabel = findThinkLabel('Constant');
        if (constantLabel) {
          await spotlight(constantLabel, 1600, ctx);
          await ctx.delay(300);
          clickRadioByLabel(THINK_TIME_BOX, 'Constant');
          await ctx.delay(700);
          setThinkTimeMs(500);
          await ctx.delay(500);
          const params = document.querySelector<HTMLElement>('.think-time-inline-params');
          if (params) await spotlight(params, 1600, ctx);
          const hint = document.querySelector<HTMLElement>('.think-time-section .exec-mode-hint');
          if (hint) await spotlight(hint, 1400, ctx);
          await ctx.delay(500);
        }

        // 3) Uniform — min–max range
        const uniformLabel = findThinkLabel('Uniform');
        if (uniformLabel) {
          await spotlight(uniformLabel, 1600, ctx);
          await ctx.delay(300);
          clickRadioByLabel(THINK_TIME_BOX, 'Uniform');
          await ctx.delay(700);
          const params = document.querySelector<HTMLElement>('.think-time-inline-params');
          if (params) await spotlight(params, 1800, ctx);
          const hint = document.querySelector<HTMLElement>('.think-time-section .exec-mode-hint');
          if (hint) await spotlight(hint, 1400, ctx);
          await ctx.delay(500);
        }

        // 4) Gaussian — μ / σ
        const gaussianLabel = findThinkLabel('Gaussian');
        if (gaussianLabel) {
          await spotlight(gaussianLabel, 1600, ctx);
          await ctx.delay(300);
          clickRadioByLabel(THINK_TIME_BOX, 'Gaussian');
          await ctx.delay(700);
          const params = document.querySelector<HTMLElement>('.think-time-inline-params');
          if (params) await spotlight(params, 1800, ctx);
          const hint = document.querySelector<HTMLElement>('.think-time-section .exec-mode-hint');
          if (hint) await spotlight(hint, 1400, ctx);
          await ctx.delay(500);
        }

        // Reset to None for the rest of the lesson
        clickRadioByLabel(THINK_TIME_BOX, 'None');
        await ctx.delay(500);
        if (noneLabel) await spotlight(noneLabel, 1200, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh8Ready(ctx);
        await ensureLoadProfileMode(ctx);
        clickRadioByLabel(THINK_TIME_BOX, 'None');
        await ctx.delay(100);
      },
      verify: HAR.THINK_TIME_SEC,
    },

    // ── Step 4: Error Policies ───────────────────────────────────
    {
      id: 'th8-error-policy',
      title: 'Error Policies',
      description:
        'The **On Error** section in the resilience row controls what happens when requests fail. ' +
        '**Continue** keeps running regardless. **Stop 1st** halts immediately on the first failure — ' +
        'useful for strict validation. **Threshold** stops when the error rate exceeds a percentage you set, ' +
        'plus a max error count safety net.',
      highlight: HAR.ERROR_POLICY,
      action: async (ctx) => {
        clickRadioByLabel(EXEC_CONFIG, 'Threshold');
        await ctx.delay(600);

        const xsFields = document.querySelectorAll<HTMLElement>('.resilience-field-xs');
        if (xsFields.length >= 2) {
          await spotlight(xsFields[0], 800, ctx);
          await spotlight(xsFields[1], 800, ctx);
        }

        setFieldByLabel(HAR.RESILIENCE_ROW, 'Error Rate', 10);
        await ctx.delay(600);

        const timeoutEl = Array.from(document.querySelectorAll<HTMLElement>('.resilience-field-sm'))
          .find(f => f.querySelector('label')?.textContent?.includes('Timeout'));
        if (timeoutEl) await spotlight(timeoutEl, 800, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh8Ready(ctx);
        await ensureLoadProfileMode(ctx);
      },
      verify: HAR.ERROR_POLICY,
    },

    // ── Step 5: Constant Arrival Rate ────────────────────────────
    {
      id: 'th8-constant-arrival',
      title: 'Constant Arrival Rate',
      description:
        'The **Constant Arrival** mode fires requests at a fixed rate regardless of response time — ' +
        'an open model similar to k6\'s constant-arrival-rate. It configures Target RPS, Duration, ' +
        'Max In-Flight, and an optional ramp. This mode requires the **desktop app** and is shown ' +
        'dimmed in the web version. For most testing, Batch or Load Profile covers your needs; ' +
        'use Constant Arrival for strict throughput targets.',
      highlight: HAR.EXEC_MODE_ROW,
      action: async (ctx) => {
        const labels = document.querySelectorAll<HTMLElement>(EXEC_MODE_BOX + ' .radio-label');
        const arrivalLabel = Array.from(labels).find(l => l.textContent?.includes('Constant Arrival'));
        if (arrivalLabel) {
          await spotlight(arrivalLabel, 1500, ctx);
        }

        switchExecMode('Batch');
        await ctx.delay(500);

        clickRadioByLabel(EXEC_CONFIG, 'Continue');
        await ctx.delay(300);

        await spotlightSel(ctx, EXEC_MODE_BOX, 1000);
      },
      preAction: async (ctx) => {
        await ensureTh8Ready(ctx);
      },
      verify: EXEC_MODE_BOX,
    },
  ],
};
