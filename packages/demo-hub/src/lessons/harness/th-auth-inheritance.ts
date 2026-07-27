/**
 * TH-14: Auth & Inheritance Chain
 *
 * 4-level auth inheritance: test → scenario → FG → global profile.
 * Configure auth at each level and see effective resolution badges.
 */
import type { DemoLesson, DemoActionContext } from '../../types';
import { HAR } from '@shared/selectors';
import {
  seedDemoEnvAndService,
  seedTh14FeatureGroup,
  seedTh14GlobalProfile,
  deleteTh14DemoFg,
  purgeTh14GlobalProfile,
  ensureTh14FgExists,
  expandFirstFg,
  expandFirstScenario,
  spotlight,
  findAuthButton,
  closeFgAuthPanel,
  closeScenarioAuthPanel,
} from './th-demo-helpers';
import { fillControlledInput } from '../setup-helpers';

const TEST_EDITOR_SEL = '.rf-builder-modal';

/* ── local helpers ──────────────────────────────────────────── */

async function ensureTh14Ready(ctx: DemoActionContext): Promise<void> {
  await ensureTh14FgExists(ctx);
  if (!document.querySelector(HAR.FG_CARD)) {
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
  }
  await expandFirstFg(ctx);
  await expandFirstScenario(ctx);
}

function isFgAuthOpen(): boolean {
  return !!document.querySelector(HAR.FEATURE_AUTH_PANEL);
}

function isScAuthOpen(): boolean {
  const panel = document.querySelector(HAR.AUTH_PANEL);
  return !!panel && !panel.classList.contains('feature-auth-panel');
}

function isTestEditorOpen(): boolean {
  return !!document.querySelector(TEST_EDITOR_SEL);
}

function closeTestEditor(): void {
  const cancelBtn = document.querySelector<HTMLElement>('[data-testid="te-cancel-btn"]');
  if (cancelBtn) { cancelBtn.click(); return; }
  const modal = document.querySelector<HTMLElement>(TEST_EDITOR_SEL);
  if (!modal) return;
  const close = modal.querySelector<HTMLElement>('.modal-close-btn');
  if (close) close.click();
}

function getFgActionsContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="har-fg-card"] .feature-group-actions');
}

function getScActionsContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-testid="har-scenario-card"] .scenario-group-actions');
}

/** Click the Auth tab in the test editor. */
function clickAuthTab(): void {
  const tabs = document.querySelectorAll<HTMLElement>('.builder-tabs .builder-tab');
  for (const tab of tabs) {
    if (tab.textContent?.trim().startsWith('Auth')) {
      tab.click();
      return;
    }
  }
}

/** Select an auth type from the CustomSelect in the auth panel or test editor. */
async function selectAuthType(ctx: DemoActionContext, label: string, scope?: HTMLElement): Promise<void> {
  const container = scope ?? document.querySelector<HTMLElement>(HAR.AUTH_TYPE_SELECT);
  if (!container) return;
  const select = container.querySelector<HTMLElement>('.custom-select') ?? container;
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

export const thAuthInheritanceLesson: DemoLesson = {
  id: 'th-auth-inheritance',
  domainId: 'harness',
  category: 'authoring',
  name: 'Auth & Inheritance Chain',
  description:
    'Understand the 4-level auth inheritance system — test, scenario, Feature Group, ' +
    'and global profile — and see effective auth resolution badges at a glance.',
  estimatedMinutes: 5,
  initialTab: 'scenarios',
  allowedTabs: ['scenarios'],
  concept: {
    title: 'Auth Inheritance Chain',
    body:
      'Auth resolves **bottom-up** through 4 levels:\n\n' +
      '1. **Test** — highest priority, overrides everything\n' +
      '2. **Scenario** — applies to all tests unless a test has its own auth\n' +
      '3. **Feature Group** — applies to all scenarios unless overridden\n' +
      '4. **Global Profile** — defined in Settings, linked to FGs via dropdown\n\n' +
      'Badge colors show the source: green (own), blue (scenario), purple (feature), orange (global).',
    keyTerms: [
      { term: 'Auth Inheritance', definition: 'Bottom-up resolution: Test > Scenario > Feature Group > Global Profile.' },
      { term: 'Auth Badge', definition: 'Color-coded indicator showing where a test gets its auth from.' },
      { term: 'Global Profile', definition: 'Reusable auth config defined in Settings, linked to Feature Groups.' },
    ],
    diagram: `<svg viewBox="0 0 380 90" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="80" height="80" rx="5" fill="#1e293b" stroke="#f97316" stroke-width="1.5"/>
      <text x="45" y="20" text-anchor="middle" fill="#f97316" font-size="6.5" font-weight="700">Global Profile</text>
      <text x="45" y="34" text-anchor="middle" fill="#94a3b8" font-size="5">Bearer token</text>
      <rect x="15" y="42" width="60" height="38" rx="4" fill="#1e293b" stroke="#a855f7" stroke-width="1.2"/>
      <text x="45" y="55" text-anchor="middle" fill="#a855f7" font-size="6" font-weight="600">Feature Group</text>
      <text x="45" y="68" text-anchor="middle" fill="#94a3b8" font-size="5">inherits</text>
      <path d="M90 45 L120 45" stroke="#64748b" stroke-width="1.2" marker-end="url(#th14arr)"/>
      <rect x="125" y="5" width="90" height="80" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="170" y="20" text-anchor="middle" fill="#3b82f6" font-size="6.5" font-weight="700">Scenario</text>
      <text x="170" y="34" text-anchor="middle" fill="#94a3b8" font-size="5">can override</text>
      <rect x="135" y="42" width="70" height="38" rx="4" fill="#1e293b" stroke="#10b981" stroke-width="1.2"/>
      <text x="170" y="55" text-anchor="middle" fill="#10b981" font-size="6" font-weight="600">Test</text>
      <text x="170" y="68" text-anchor="middle" fill="#94a3b8" font-size="5">highest priority</text>
      <path d="M220 45 L250 45" stroke="#64748b" stroke-width="1.2" marker-end="url(#th14arr)"/>
      <rect x="255" y="15" width="60" height="20" rx="4" fill="#10b981" fill-opacity="0.15" stroke="#10b981" stroke-width="1"/>
      <text x="285" y="29" text-anchor="middle" fill="#10b981" font-size="6">Own auth</text>
      <rect x="255" y="40" width="60" height="20" rx="4" fill="#3b82f6" fill-opacity="0.15" stroke="#3b82f6" stroke-width="1"/>
      <text x="285" y="54" text-anchor="middle" fill="#3b82f6" font-size="6">Scenario</text>
      <rect x="255" y="65" width="60" height="20" rx="4" fill="#f97316" fill-opacity="0.15" stroke="#f97316" stroke-width="1"/>
      <text x="285" y="79" text-anchor="middle" fill="#f97316" font-size="6">Global</text>
      <text x="340" y="29" text-anchor="start" fill="#94a3b8" font-size="5.5">Badges</text>
      <defs><marker id="th14arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#64748b"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    deleteTh14DemoFg();
    purgeTh14GlobalProfile();
    await ctx.delay(200);
    seedTh14GlobalProfile();
    await seedDemoEnvAndService(ctx);
    await seedTh14FeatureGroup(ctx);
    await ctx.delay(300);
    ctx.navigateToTab('scenarios');
    await ctx.delay(500);
    await expandFirstFg(ctx);
    await expandFirstScenario(ctx);
  },

  cleanup: async (ctx) => {
    if (isTestEditorOpen()) closeTestEditor();
    if (isFgAuthOpen()) closeFgAuthPanel();
    if (isScAuthOpen()) closeScenarioAuthPanel();
    await ctx.delay(200);
    deleteTh14DemoFg();
    purgeTh14GlobalProfile();
    await ctx.delay(200);
  },

  steps: [
    // ── Step 1: FG Auth & Global Profile ─────────────────────────
    {
      id: 'th14-fg-auth-profile',
      title: 'FG Auth & Global Profile',
      description:
        'The **Auth** button on a Feature Group card opens a panel where you can link a ' +
        '**global auth profile** — defined in Settings and shared across Feature Groups. ' +
        'This forms the bottom of the 4-level inheritance chain: all tests in this FG ' +
        'inherit the profile\'s credentials unless overridden at a lower level.',
      highlight: HAR.FEATURE_AUTH_PANEL,
      action: async (ctx) => {
        const profileSelect = document.querySelector<HTMLElement>(HAR.AUTH_PROFILE_SELECT);
        if (profileSelect) await spotlight(profileSelect, 1200, ctx);

        const hint = document.querySelector<HTMLElement>(`${HAR.FEATURE_AUTH_PANEL} ${HAR.AUTH_INHERIT_HINT}`);
        if (hint) await spotlight(hint, 800, ctx);

        closeFgAuthPanel();
        await ctx.delay(400);
      },
      preAction: async (ctx) => {
        await ensureTh14Ready(ctx);
        if (isTestEditorOpen()) closeTestEditor();
        if (isScAuthOpen()) closeScenarioAuthPanel();
        await ctx.delay(100);
        if (!isFgAuthOpen()) {
          const fgActions = getFgActionsContainer();
          if (fgActions) {
            const authBtn = findAuthButton(fgActions);
            if (authBtn) {
              authBtn.click();
              await ctx.delay(500);
            }
          }
        }
      },
      verify: HAR.FG_CARD,
    },

    // ── Step 2: Auth Badges & Inheritance ─────────────────────────
    {
      id: 'th14-auth-badges',
      title: 'Auth Badges & Inheritance',
      description:
        'Every test card shows a colored **auth badge** indicating which auth method it uses ' +
        'and where it comes from. Auth resolves bottom-up: test → scenario → FG → global ' +
        'profile. The first non-"inherit" level wins. Badge colors: **green** = own, ' +
        '**blue** = scenario, **purple** = feature, **orange** = global.',
      highlight: HAR.AUTH_BADGE,
      action: async (ctx) => {
        const badges = document.querySelectorAll<HTMLElement>('.test-card-meta .auth-badge');
        if (badges.length > 0) {
          await spotlight(badges[0], 1200, ctx);
        }
        if (badges.length > 1) {
          await spotlight(badges[1], 800, ctx);
        }
      },
      preAction: async (ctx) => {
        await ensureTh14Ready(ctx);
        if (isTestEditorOpen()) closeTestEditor();
        if (isFgAuthOpen()) closeFgAuthPanel();
        if (isScAuthOpen()) closeScenarioAuthPanel();
        await ctx.delay(100);
      },
      verify: HAR.AUTH_BADGE,
    },

    // ── Step 3: Scenario Auth Override ────────────────────────────
    {
      id: 'th14-scenario-override',
      title: 'Scenario Auth Override',
      description:
        'The **Auth** button on a scenario card opens a panel to set scenario-level auth. ' +
        'Changing from **Inherit** to **Bearer Token** overrides the FG/global chain for ' +
        'all tests in this scenario — watch the badge colors change from orange (global) ' +
        'to blue (scenario).',
      highlight: HAR.AUTH_PANEL,
      action: async (ctx) => {
        const typeSelect = document.querySelector<HTMLElement>(`${HAR.AUTH_PANEL}:not(${HAR.FEATURE_AUTH_PANEL}) ${HAR.AUTH_TYPE_SELECT}`);
        if (typeSelect) await spotlight(typeSelect, 1000, ctx);

        await selectAuthType(ctx, 'Bearer Token', typeSelect ?? undefined);
        await ctx.delay(400);

        const panel = document.querySelector<HTMLElement>(`${HAR.AUTH_PANEL}:not(${HAR.FEATURE_AUTH_PANEL})`);
        if (panel) {
          const formRow = panel.querySelector<HTMLElement>('.form-row.two-col');
          const tokenInput = formRow?.querySelector<HTMLInputElement>('input');
          if (tokenInput) {
            fillControlledInput(tokenInput, 'demo-bearer-token-xyz');
            await ctx.delay(500);
          }
        }

        const badges = document.querySelectorAll<HTMLElement>('.test-card-meta .auth-badge');
        if (badges.length > 0) await spotlight(badges[0], 1000, ctx);
      },
      preAction: async (ctx) => {
        await ensureTh14Ready(ctx);
        if (isTestEditorOpen()) closeTestEditor();
        if (isFgAuthOpen()) closeFgAuthPanel();
        await ctx.delay(100);
        if (!isScAuthOpen()) {
          const scActions = getScActionsContainer();
          if (scActions) {
            const authBtn = findAuthButton(scActions);
            if (authBtn) {
              authBtn.click();
              await ctx.delay(500);
            }
          }
        }
      },
      verify: HAR.AUTH_BADGE,
    },

    // ── Step 4: Test-Level Auth Override ──────────────────────────
    {
      id: 'th14-test-override',
      title: 'Test-Level Auth Override',
      description:
        'Open a test\'s **Auth** tab to override at the test level — the highest priority. ' +
        'Change from **Inherit from Scenario** to **API Key** and fill in the credentials. ' +
        'After saving, this test shows a **green** badge while its sibling still shows blue.',
      highlight: HAR.AUTH_TYPE_SELECT,
      action: async (ctx) => {
        const typeSelect = document.querySelector<HTMLElement>(`${TEST_EDITOR_SEL} ${HAR.AUTH_TYPE_SELECT}`);
        if (typeSelect) await spotlight(typeSelect, 1000, ctx);

        const hint = document.querySelector<HTMLElement>(`${TEST_EDITOR_SEL} ${HAR.AUTH_INHERIT_HINT}`);
        if (hint) await spotlight(hint, 800, ctx);

        await selectAuthType(ctx, 'API Key', typeSelect ?? undefined);
        await ctx.delay(400);

        const formRows = document.querySelectorAll<HTMLElement>(`${TEST_EDITOR_SEL} .form-row.two-col`);
        const lastRow = formRows[formRows.length - 1];
        if (lastRow) {
          const inputs = lastRow.querySelectorAll<HTMLInputElement>('input');
          if (inputs.length >= 2) {
            fillControlledInput(inputs[0], 'X-API-Key');
            await ctx.delay(300);
            fillControlledInput(inputs[1], 'demo-key-123');
            await ctx.delay(500);
          }
        }

        const saveBtn = document.querySelector<HTMLElement>('[data-testid="te-save-btn"]');
        if (saveBtn) {
          saveBtn.click();
          await ctx.delay(500);
        }

        const badges = document.querySelectorAll<HTMLElement>('.test-card-meta .auth-badge');
        for (const badge of badges) {
          if (badge.classList.contains('auth-badge-test-own')) {
            await spotlight(badge, 1000, ctx);
            break;
          }
        }
      },
      preAction: async (ctx) => {
        await ensureTh14Ready(ctx);
        if (isFgAuthOpen()) closeFgAuthPanel();
        if (isScAuthOpen()) closeScenarioAuthPanel();
        await ctx.delay(100);

        if (!isTestEditorOpen()) {
          const editBtn = document.querySelector<HTMLElement>('[data-testid="har-test-edit-btn"]');
          if (editBtn) {
            editBtn.click();
            await ctx.delay(600);
          }
        }
        clickAuthTab();
        await ctx.delay(300);
      },
      verify: HAR.FG_CARD,
    },

    // ── Step 5: Mixed Auth Summary ───────────────────────────────
    {
      id: 'th14-mixed-badges',
      title: 'Mixed Auth Summary',
      description:
        'Now the test cards show mixed auth badges side by side: **green** for the test with ' +
        'its own API Key, **blue** for the one still inheriting Bearer Token from the scenario. ' +
        'Badge colors and labels make it clear at a glance — no need to open each test to check.',
      highlight: '.test-card-meta',
      action: async (ctx) => {
        const badges = document.querySelectorAll<HTMLElement>('.test-card-meta .auth-badge');
        for (const badge of badges) {
          await spotlight(badge, 1000, ctx);
        }
      },
      preAction: async (ctx) => {
        await ensureTh14Ready(ctx);
        if (isTestEditorOpen()) closeTestEditor();
        if (isFgAuthOpen()) closeFgAuthPanel();
        if (isScAuthOpen()) closeScenarioAuthPanel();
        await ctx.delay(100);

        const badges = document.querySelectorAll<HTMLElement>('.test-card-meta .auth-badge');
        const hasOwn = Array.from(badges).some(b => b.classList.contains('auth-badge-test-own'));
        const hasScenario = Array.from(badges).some(b => b.classList.contains('auth-badge-test-scenario'));

        if (!hasOwn || !hasScenario) {
          const scActions = getScActionsContainer();
          if (scActions && !isScAuthOpen()) {
            const authBtn = findAuthButton(scActions);
            if (authBtn) {
              authBtn.click();
              await ctx.delay(300);
              const panel = document.querySelector<HTMLElement>(`${HAR.AUTH_PANEL}:not(${HAR.FEATURE_AUTH_PANEL})`);
              if (panel) {
                const typeSelect = panel.querySelector<HTMLElement>(HAR.AUTH_TYPE_SELECT);
                if (typeSelect) await selectAuthType(ctx, 'Bearer Token', typeSelect);
                await ctx.delay(200);
                const formRow = panel.querySelector<HTMLElement>('.form-row.two-col');
                const tokenInput = formRow?.querySelector<HTMLInputElement>('input');
                if (tokenInput) fillControlledInput(tokenInput, 'demo-bearer-token-xyz');
              }
              closeScenarioAuthPanel();
              await ctx.delay(200);
            }
          }

          if (!hasOwn) {
            const editBtn = document.querySelector<HTMLElement>('[data-testid="har-test-edit-btn"]');
            if (editBtn) {
              editBtn.click();
              await ctx.delay(400);
              clickAuthTab();
              await ctx.delay(200);
              const typeSelect = document.querySelector<HTMLElement>(`${TEST_EDITOR_SEL} ${HAR.AUTH_TYPE_SELECT}`);
              if (typeSelect) await selectAuthType(ctx, 'API Key', typeSelect);
              const formRows = document.querySelectorAll<HTMLElement>(`${TEST_EDITOR_SEL} .form-row.two-col`);
              const lastRow = formRows[formRows.length - 1];
              if (lastRow) {
                const inputs = lastRow.querySelectorAll<HTMLInputElement>('input');
                if (inputs.length >= 2) {
                  fillControlledInput(inputs[0], 'X-API-Key');
                  fillControlledInput(inputs[1], 'demo-key-123');
                }
              }
              const saveBtn = document.querySelector<HTMLElement>('[data-testid="te-save-btn"]');
              if (saveBtn) saveBtn.click();
              await ctx.delay(300);
            }
          }
        }
      },
      verify: HAR.AUTH_BADGE,
    },
  ],
};
