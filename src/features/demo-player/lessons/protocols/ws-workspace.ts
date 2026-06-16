/**
 * Lesson 14: Workspace — Profiles, Templates & Env Vars
 *
 * Demonstrates the three "remember my work" features that make
 * RedfireForge a daily driver:
 *  - Saved connection profiles (save, load, manage)
 *  - Message templates (save & reuse payloads)
 *  - Environment variable interpolation in URLs
 *
 * No Docker required — uses the built-in mock server.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WS } from '../../../../shared/selectors';
import { wsSetup, wsCleanup } from '../setup-helpers';

// ── Constants ──────────────────────────────────────────────────
const DEMO_URL = 'ws://localhost:9876';
const DEMO_PROFILE_NAME = 'Demo Echo Server';
const DEMO_TEMPLATE_NAME = 'greeting';
const DEMO_TEMPLATE_BODY = '{"action":"greet","name":"RedfireForge"}';
const ENV_VAR_URL = '{{wsBaseUrl}}/ws';
const UNRESOLVED_URL = '{{unknownHost}}/ws';

// ── Helpers ─────────────────────────────────────────────────────

/** Delete all saved profiles to ensure clean demo state. */
async function clearSavedProfiles(ctx: DemoActionContext): Promise<void> {
  await ctx.click(WS.MODE_SAVED);
  await ctx.delay(400);
  // Delete profiles one by one via the detail pane's delete flow
  for (let i = 0; i < 10; i++) {
    const card = document.querySelector('[data-testid^="profile-card-"]') as HTMLElement | null;
    if (!card) break;
    card.click();
    await ctx.delay(300);
    const id = card.getAttribute('data-testid')!.replace('profile-card-', '');
    const deleteBtn = document.querySelector(`[data-testid="delete-btn-${id}"]`) as HTMLElement | null;
    if (deleteBtn) {
      deleteBtn.click();
      await ctx.delay(200);
      const confirm = document.querySelector(`[data-testid="confirm-delete-${id}"]`) as HTMLElement | null;
      confirm?.click();
      await ctx.delay(300);
    }
  }
}

/** Delete all saved templates from the compose dropdown. */
async function clearTemplates(ctx: DemoActionContext): Promise<void> {
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(300);
  await ctx.click(WS.LEFT_TAB_COMPOSE);
  await ctx.delay(500);  // wait for Compose panel to mount and templates prop to populate
  // Wait up to 3 s for the trigger to appear (belt-and-suspenders)
  await ctx.waitFor(WS.TEMPLATE_TRIGGER);
  const trigger = document.querySelector(WS.TEMPLATE_TRIGGER) as HTMLElement | null;
  if (!trigger) return;
  // Open templates dropdown
  trigger.click();
  await ctx.delay(400);  // wait for React re-render to show the dropdown
  // Delete templates one by one; wait for each button to disappear before continuing
  for (let i = 0; i < 10; i++) {
    const delBtn = document.querySelector('[data-testid^="template-delete-"]') as HTMLElement | null;
    if (!delBtn) break;
    const btnTestId = delBtn.getAttribute('data-testid')!;
    delBtn.click();
    // Wait until this specific button is removed from the DOM (confirms React re-rendered)
    for (let w = 0; w < 30; w++) {
      await ctx.delay(100);
      if (!document.querySelector(`[data-testid="${btnTestId}"]`)) break;
    }
  }
  // Close dropdown if it is still open
  if (document.querySelector(WS.TEMPLATE_DROPDOWN)) {
    trigger.click();
    await ctx.delay(200);
  }
}

// ── Setup / Cleanup ─────────────────────────────────────────────

async function workspaceSetup(ctx: DemoActionContext): Promise<void> {
  await ctx.delay(400);
  // Start mock server + switch to client mode
  await wsSetup(ctx);
  await ctx.delay(200);
  // Clear any existing profiles and templates for a clean demo
  await clearSavedProfiles(ctx);
  await ctx.delay(200);
  await clearTemplates(ctx);
  await ctx.delay(200);
  // Return to Client mode on Connect tab
  await ctx.click(WS.MODE_CLIENT);
  await ctx.delay(200);
  await ctx.click(WS.LEFT_TAB_CONNECT);
  await ctx.delay(200);
}

async function workspaceCleanup(ctx: DemoActionContext): Promise<void> {
  // Clean up demo profiles/templates
  await clearSavedProfiles(ctx);
  await ctx.delay(200);
  await clearTemplates(ctx);
  await ctx.delay(200);
  // Standard cleanup: disconnect, clear, stop mock, client mode
  await wsCleanup(ctx);
}

// ── Lesson ──────────────────────────────────────────────────────

export const wsWorkspaceLesson: DemoLesson = {
  id: 'ws-workspace',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Profiles, Templates & Env Vars',
  description: 'Save connection profiles, reuse message templates, and use environment variables in URLs.',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',

  setup: workspaceSetup,
  cleanup: workspaceCleanup,

  concept: {
    title: 'Workspace: Your Saved Work',
    body: `RedfireForge has three features that turn one-off testing into a **repeatable workflow**: saved profiles, message templates, and environment variables.

**Saved Connection Profiles**

The **Saved** mode tab stores named connection configurations — URL, auth, headers, query params — so you can switch between servers with one click. Every profile you save appears in a searchable rail with "Load & Connect" to instantly apply it.

**Message Templates**

In the Compose panel, the **Templates ▾** dropdown lets you save the current message payload with a name (like "auth-handshake" or "order-create"). Next time, one click loads it back — no re-typing JSON. Templates persist across sessions.

**Environment Variables**

Type \`{{wsBaseUrl}}\` in the URL field and RedfireForge resolves it from your selected environment (the Environment dropdown in the app header). A resolved-URL preview appears below the input. If a variable can't be resolved, a warning badge appears immediately — you'll know before you click Connect.

| Feature | Access | What it saves |
|---|---|---|
| Profiles | **Saved** mode tab (top bar) or **Save as Profile** button | URL + auth + headers + params |
| Templates | **Templates ▾** dropdown in Compose panel | Message body text |
| Env Vars | \`{{varName}}\` in URL/headers/params | Auto-resolved from selected environment |`,
    keyTerms: [
      {
        term: 'Connection Profile',
        definition: 'A named snapshot of URL, auth config, headers, and query params. Saved to localStorage and available across sessions.',
      },
      {
        term: 'Message Template',
        definition: 'A named, reusable message body stored in the Compose panel. Templates persist across sessions and can be loaded with one click.',
      },
      {
        term: 'Environment Variable',
        definition: 'A {{varName}} placeholder in URL, headers, or params. Resolved at connection time from the selected environment\'s key-value map.',
      },
      {
        term: 'Save as Profile',
        definition: 'Button in the Connect panel that captures the current connection config and opens the profile editor modal.',
      },
    ],
    diagram: `<pre>┌─────────────────────────────────────────────────────┐
│  Client   │  Mock Server  │  Saved (profiles)       │  ← mode tabs
├────────┬──┴───────────────┴─────────────────────────┤
│Connect │  Events / Console / Stats / Load Test / …  │
│ URL: {{wsBaseUrl}}/ws                               │
│ → Resolved: ws://localhost:9876/ws                  │
│ [Connect]  [Save as Profile]                        │
├────────┤                                            │
│Compose │  Templates ▾  [Save] [Load]                │
│ {"action":"greet","name":"RedfireForge"}             │
│ [Send]                                              │
└────────┴────────────────────────────────────────────┘

  Profile Store          Template Store         Env Map
  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
  │ Demo Echo    │      │ greeting     │      │ wsBaseUrl:   │
  │ ws://local…  │      │ {"action":…} │      │ localhost:9876│
  │ [Load & Conn]│      │ [Load] [Del] │      │ host: local… │
  └──────────────┘      └──────────────┘      └──────────────┘</pre>`,
  },

  steps: [
    // ── 1. Saved Mode ────────────────────────────────────────
    {
      id: 'ws-profile-intro',
      title: 'The Saved Mode',
      description:
        'The **Saved** tab in the top mode bar opens the profiles panel — a searchable library of named connection configurations. Each profile stores URL, auth, headers, and query params. Right now it\'s empty because the demo started with a clean slate. Let\'s create our first profile.',
      highlight: WS.MODE_SAVED,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.MODE_SAVED);
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.delay(400);
      },
    },

    // ── 2. Save a Profile ──────────────────────────────────
    {
      id: 'ws-profile-save',
      title: 'Save a Connection Profile',
      description:
        'Back in Client mode, the Connect panel shows a **Save as Profile** button below the Connect/Disconnect buttons. The demo fills in the mock server URL and clicks Save as Profile — a modal opens where you name the profile and confirm. The profile is now saved and appears in the Saved tab.',
      highlight: WS.SAVE_AS_PROFILE_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(300);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
        await ctx.fill(WS.URL_INPUT, DEMO_URL);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.click(WS.SAVE_AS_PROFILE_BTN);
        // Rule 5: ProfileEditorModal is conditionally rendered — wait for it to mount.
        // Clicking the button switches to Saved mode, sets prefillDraft, which triggers
        // a useEffect that sets editorOpen = true, then the modal mounts.
        await ctx.waitFor(WS.PROFILE_NAME_INPUT);
        await ctx.delay(400);
        // The profile editor modal is now open — fill name and save
        await ctx.fill(WS.PROFILE_NAME_INPUT, DEMO_PROFILE_NAME);
        await ctx.delay(400);
        await ctx.click(WS.PROFILE_SAVE_BTN);
        await ctx.delay(600);
      },
    },

    // ── 3. Load a Profile ──────────────────────────────────
    {
      id: 'ws-profile-load',
      title: 'Load a Saved Profile',
      description:
        'Switch to Saved mode and the profile we just created appears in the rail. Selecting it shows a detail pane with URL, auth badges, and action buttons. Clicking **Load & Connect** applies the profile to the Client connect form and switches you back — ready to connect in one click.',
      highlight: WS.SAVED_CONNECTIONS,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.MODE_SAVED);
        await ctx.delay(400);
      },
      action: async (ctx: DemoActionContext) => {
        // Click the first profile card to select it (with visual ripple)
        const card = document.querySelector('[data-testid^="profile-card-"]') as HTMLElement | null;
        if (!card) return;
        const id = card.getAttribute('data-testid')!.replace('profile-card-', '');
        await ctx.click(`[data-testid="profile-card-${id}"]`);
        await ctx.delay(500);
        // Click "Load & Connect" (with visual ripple)
        await ctx.click(`[data-testid="load-btn-${id}"]`);
        await ctx.delay(600);
      },
    },

    // ── 4. Templates Introduction ──────────────────────────
    {
      id: 'ws-template-intro',
      title: 'Message Templates',
      description:
        'The Compose panel has a **Templates ▾** dropdown at the top. It shows your saved message templates — reusable payloads you can load with one click. Templates store the raw message body and persist across sessions. Currently the dropdown shows "No saved templates" because we haven\'t saved any yet.',
      highlight: WS.TEMPLATE_TRIGGER,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_COMPOSE);
        await ctx.delay(300);
      },
      action: async (ctx: DemoActionContext) => {
        // Open the dropdown briefly to show the empty state
        await ctx.click(WS.TEMPLATE_TRIGGER);
        // Rule 5: dropdown is conditionally rendered — wait for it to appear.
        await ctx.waitFor(WS.TEMPLATE_DROPDOWN);
        await ctx.delay(1200);
        // Close it
        await ctx.click(WS.TEMPLATE_TRIGGER);
        await ctx.delay(300);
      },
    },

    // ── 5. Save a Template ─────────────────────────────────
    {
      id: 'ws-template-save',
      title: 'Save a Template',
      description:
        'The demo types a JSON payload into the compose textarea, then enters a name in the save row at the bottom of the Templates dropdown and clicks **Save**. The template is now stored and ready to reuse anytime.',
      highlight: WS.TEMPLATE_SAVE_BTN,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_COMPOSE);
        await ctx.delay(200);
        // Fill the compose textarea with demo payload
        await ctx.fill(WS.MESSAGE_INPUT, DEMO_TEMPLATE_BODY);
        await ctx.delay(300);
        // Open templates dropdown to expose the save row
        await ctx.click(WS.TEMPLATE_TRIGGER);
        // Rule 5: dropdown is conditionally rendered — wait for the save input to appear.
        await ctx.waitFor(WS.TEMPLATE_SAVE_NAME);
      },
      action: async (ctx: DemoActionContext) => {
        // Type the template name
        await ctx.fill(WS.TEMPLATE_SAVE_NAME, DEMO_TEMPLATE_NAME);
        await ctx.delay(400);
        // Save
        await ctx.click(WS.TEMPLATE_SAVE_BTN);
        await ctx.delay(600);
      },
    },

    // ── 6. Load a Template ─────────────────────────────────
    {
      id: 'ws-template-load',
      title: 'Load a Template',
      description:
        'The demo clears the compose textarea, opens the Templates dropdown, and clicks the saved "greeting" template. The payload `{"action":"greet","name":"RedfireForge"}` is loaded back instantly — no re-typing. Templates are great for complex JSON bodies you use repeatedly.',
      highlight: WS.TEMPLATE_TRIGGER,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.LEFT_TAB_COMPOSE);
        await ctx.delay(200);
        // Clear the compose area so the load is visible
        await ctx.fill(WS.MESSAGE_INPUT, '');
        await ctx.delay(200);
        // Guard: step 5 leaves the template dropdown open (the save is visible).
        // If still open, close it so step 6's action reliably opens (not closes) it.
        if (document.querySelector(WS.TEMPLATE_DROPDOWN)) {
          const trigger = document.querySelector(WS.TEMPLATE_TRIGGER) as HTMLElement | null;
          if (trigger) trigger.click();
          await ctx.delay(200);
        }
      },
      action: async (ctx: DemoActionContext) => {
        // Open templates dropdown
        await ctx.click(WS.TEMPLATE_TRIGGER);
        // Rule 5: dropdown is conditionally rendered — wait for load button to appear.
        await ctx.waitFor('.ws-template-item-load');
        await ctx.delay(400);
        // Click the load button inside the first template item (with visual ripple)
        await ctx.click('.ws-template-item-load');
        await ctx.delay(600);
      },
    },

    // ── 7. Environment Variables ────────────────────────────
    {
      id: 'ws-env-intro',
      title: 'Environment Variables in URLs',
      description:
        'The URL field supports `{{varName}}` placeholders. Type `{{wsBaseUrl}}/ws` and — if an environment is selected in the app header with a base URL configured — RedfireForge resolves it automatically, showing a **→ Resolved:** preview below the input. Built-in variables include `{{wsBaseUrl}}`, `{{host}}`, and `{{envName}}`. If no environment is selected, you\'ll see a warning instead — a reminder to configure one in the Environment Manager.',
      highlight: WS.URL_INPUT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(200);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.fill(WS.URL_INPUT, ENV_VAR_URL);
        await ctx.delay(800);
      },
    },

    // ── 8. Unresolved Variable Warning ─────────────────────
    {
      id: 'ws-env-warn',
      title: 'Unresolved Variable Warning',
      description:
        'Now the URL uses `{{unknownHost}}` — a variable name that doesn\'t match any built-in or custom variable. RedfireForge shows a **warning** below the URL field immediately, so you catch typos before clicking Connect. Whether the issue is a wrong variable name, a missing environment config, or no environment selected at all, you\'ll always know.',
      highlight: WS.URL_INPUT,
      pauseAfter: true,
      preAction: async (ctx: DemoActionContext) => {
        // Guard: ensure we are on Client mode + Connect tab so the URL input is visible.
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(200);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
      action: async (ctx: DemoActionContext) => {
        await ctx.fill(WS.URL_INPUT, UNRESOLVED_URL);
        await ctx.delay(800);
      },
    },
  ],
};
