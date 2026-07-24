/** Lesson K5: Templates — save, load, and delete Kafka form configurations */
import type { DemoLesson, DemoActionContext } from '../../types';
import { KAFKA } from '@shared/selectors';
import { KAFKA_PUBLISH_TEMPLATES_KEY } from '@shared/kafka/kafkaStorage';

/** Selector for the save name input (shown after clicking the Save button). */
const SAVE_INPUT = '.kafka-ms-template-save-input';

/** Selector for the ✓ confirm button in the save row. */
const SAVE_CONFIRM_BTN = '.kafka-ms-template-confirm-btn';

/** Selector for the first template row item in the dropdown. */
const TEMPLATE_ITEM = '.kafka-ms-template-item';

/** Selector for the delete (×) button on the first template row. */
const TEMPLATE_DELETE_BTN = '.kafka-ms-template-item-delete';

/** Selector for the template controls container. */
const TEMPLATE_CONTROLS = '.kafka-ms-template-controls';

/** Selector for the template toast notification. */
const TEMPLATE_TOAST = '[data-testid="pub-tmpl-toast"]';

/**
 * Remove any "Orders Template" leftover from a previous run.
 * Uses localStorage directly (safe because templates also use localStorage).
 */
function removeOrdersTemplate(): void {
  try {
    const raw = localStorage.getItem(KAFKA_PUBLISH_TEMPLATES_KEY);
    if (raw) {
      const templates = JSON.parse(raw) as Array<{ id: string; name: string }>;
      const filtered = templates.filter((t) => t.name !== 'Orders Template');
      localStorage.setItem(KAFKA_PUBLISH_TEMPLATES_KEY, JSON.stringify(filtered));
    }
  } catch {
    // non-fatal
  }
}

/**
 * Setup: navigate to Publish tab, clear any stale templates, and reset form
 * fields so the demo starts from a clean state.
 */
async function kafkaTemplatesSetup(ctx: DemoActionContext): Promise<void> {
  removeOrdersTemplate();
  await ctx.click(KAFKA.PUBLISH_TAB);
  await ctx.delay(300);
  await ctx.fill(KAFKA.PUB_TOPIC_INPUT, '');
  await ctx.delay(100);
  await ctx.fill(KAFKA.PUB_BODY_TEXTAREA, '');
  await ctx.delay(100);
}

export const kafkaTemplatesLesson: DemoLesson = {
  id: 'kafka-templates',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Templates',
  description:
    'Save and load publish and consume form configurations — eliminate repetitive setup in repeated test runs.',
  estimatedMinutes: 3,
  initialTab: 'kafka-message-studio',
  // No Docker needed — templates work without a live broker connection.

  setup: kafkaTemplatesSetup,

  cleanup: async () => {
    removeOrdersTemplate();
  },

  concept: {
    title: 'Save Your Kafka Setups as Templates',
    body: `Configuring a Kafka message over and over wastes time. **Templates** let you save the full publish or consume form — topic, key, acks, headers, body, filters — and reload it instantly.

**Publish templates** capture the entire form: topic, message key, ack level, custom headers, and message body. Load a template and the form repopulates in one click — ready to send.

**Consume templates** save all consume fields except the consumer group ID, which is stripped on load so each session gets a fresh group (avoids offset conflicts).

**Persistence:** Templates are stored in \`localStorage\` and survive page reloads, browser restarts, and app updates.

**Where to find them:** Both the Publish tab and the Consume tab have **Load ▾** and **Save** buttons in the card header, directly above the form fields.`,
    keyTerms: [
      {
        term: 'Publish Template',
        definition:
          'A saved snapshot of the Kafka Publish form — topic, key, acks, headers, and body.',
      },
      {
        term: 'Consume Template',
        definition:
          'A saved snapshot of consume fields (topic, position, max messages, filters). Group ID is stripped on load to avoid offset conflicts.',
      },
      {
        term: 'localStorage',
        definition:
          'Browser storage that persists data across page reloads. Templates are stored here, scoped to your browser profile.',
      },
    ],
    diagram: `<svg viewBox="0 0 400 130" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="165" height="48" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="92" y="30" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">Publish Form</text>
  <text x="92" y="48" text-anchor="middle" fill="var(--text-muted)" font-size="10">topic · key · body · acks</text>
  <rect x="10" y="72" width="165" height="48" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="92" y="92" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">Consume Form</text>
  <text x="92" y="110" text-anchor="middle" fill="var(--text-muted)" font-size="10">topic · position · filters</text>
  <rect x="230" y="35" width="155" height="55" rx="6" fill="var(--success,#22c55e)" opacity="0.15" stroke="var(--success,#22c55e)" stroke-width="1.5"/>
  <text x="307" y="57" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui">localStorage</text>
  <text x="307" y="74" text-anchor="middle" fill="var(--text-muted)" font-size="9">persists across reloads</text>
  <line x1="175" y1="30" x2="228" y2="55" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#tmpl-save)"/>
  <text x="202" y="38" text-anchor="middle" fill="var(--text-muted)" font-size="9">Save</text>
  <line x1="228" y1="72" x2="175" y2="92" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#tmpl-load)"/>
  <text x="202" y="88" text-anchor="middle" fill="var(--text-muted)" font-size="9">Load ▾</text>
  <defs>
    <marker id="tmpl-save" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--primary)" stroke-width="1.5"/></marker>
    <marker id="tmpl-load" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--accent)" stroke-width="1.5"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    {
      id: 'tmpl-intro',
      title: 'Template Controls',
      description:
        'The Publish tab has two template buttons in the card header: **Load ▾** (opens a dropdown of saved templates) and **Save** (captures the current form state). No broker connection is required — templates work entirely in the browser.',
      highlight: TEMPLATE_CONTROLS,
      preAction: async (ctx) => {
        await ctx.click(KAFKA.PUBLISH_TAB);
        await ctx.delay(300);
      },
    },
    {
      id: 'tmpl-fill-pub',
      title: 'Fill a Publish Form',
      description:
        'Watch the form fill in automatically: **Topic** is set to `orders.events` and a simple JSON body is entered. These values will be captured when you save the template in the next step.',
      highlight: KAFKA.PUB_TOPIC_INPUT,
      action: async (ctx) => {
        await ctx.fill(KAFKA.PUB_TOPIC_INPUT, 'orders.events');
        await ctx.delay(400);
        await ctx.fill(KAFKA.PUB_BODY_TEXTAREA, '{"type":"test","source":"template-demo","priority":"high"}');
        await ctx.delay(400);
        // Click Pretty Format to auto-indent the JSON
        const prettyBtn = document.querySelector<HTMLElement>('[data-testid="pub-pretty-format-badge"]');
        if (prettyBtn) {
          prettyBtn.click();
          await ctx.delay(600);
        }
      },
    },
    {
      id: 'tmpl-save-pub',
      title: 'Save as "Orders Template"',
      description:
        'Click **Save** in the header — a name input slides in. The name "Orders Template" is typed and confirmed with ✓. A toast notification confirms the save, and the template is immediately available in the **Load ▾** dropdown.',
      highlight: KAFKA.PUB_SAVE_BTN,
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        // 1. Click Save to reveal the inline name input
        await ctx.click(KAFKA.PUB_SAVE_BTN);
        await ctx.waitFor(SAVE_INPUT, 3000);
        await ctx.delay(300);

        // 2. Fill the template name
        await ctx.fill(SAVE_INPUT, 'Orders Template');
        await ctx.delay(400);

        // 3. Click the ✓ confirm button
        await ctx.click(SAVE_CONFIRM_BTN);
        await ctx.waitFor(KAFKA.PUB_SAVE_BTN, 3000);
        await ctx.delay(300);

        // 4. Spotlight the "saved" toast
        const toast = document.querySelector<HTMLElement>(TEMPLATE_TOAST);
        if (toast) {
          const rm = showSpotlightRing(toast);
          await ctx.delay(1500);
          rm();
        }
      },
    },
    {
      id: 'tmpl-load-pub',
      title: 'Load ▾ the Template',
      description:
        'The topic field is cleared first so you can see the template restore it. Click **Load ▾** in the header — "Orders Template" appears in the dropdown. Click it to instantly refill topic and body. A toast confirms the template was loaded.',
      highlight: KAFKA.PUB_LOAD_BTN,
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        // Clear the topic so the template reload is visually obvious
        await ctx.fill(KAFKA.PUB_TOPIC_INPUT, '');
        await ctx.delay(400);

        // Open the Load dropdown
        await ctx.click(KAFKA.PUB_LOAD_BTN);
        await ctx.waitFor(TEMPLATE_ITEM, 3000);
        await ctx.delay(300);

        // Click the template item (closes dropdown, restores form fields)
        await ctx.click(TEMPLATE_ITEM);
        await ctx.delay(400);

        // Spotlight the "loaded" toast
        const toast = document.querySelector<HTMLElement>(TEMPLATE_TOAST);
        if (toast) {
          const rm = showSpotlightRing(toast);
          await ctx.delay(1500);
          rm();
        }
      },
    },
    {
      id: 'tmpl-delete-pub',
      title: 'Delete the Template',
      description:
        'Open **Load ▾** again — "Orders Template" is listed. Click the **×** button next to it to delete. A toast confirms the deletion and the dropdown updates to "No saved templates".',
      highlight: KAFKA.PUB_LOAD_BTN,
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        // Re-open the Load dropdown
        await ctx.click(KAFKA.PUB_LOAD_BTN);
        await ctx.waitFor(TEMPLATE_DELETE_BTN, 3000);
        await ctx.delay(300);

        // Click the × delete button on the template item
        await ctx.click(TEMPLATE_DELETE_BTN);
        await ctx.delay(600);

        // Spotlight the "deleted" toast
        const toast = document.querySelector<HTMLElement>(TEMPLATE_TOAST);
        if (toast) {
          const rm = showSpotlightRing(toast);
          await ctx.delay(1500);
          rm();
        }
      },
    },
    {
      id: 'tmpl-consume',
      title: 'Consume Templates Work the Same',
      description:
        'Switch to the **Consume** tab — it has identical **Save** and **Load ▾** controls. Watch as the topic is filled, then saved as "Audit Consumer". Consume templates save all fields except the consumer group ID, which is stripped on load to avoid offset conflicts.',
      highlight: TEMPLATE_CONTROLS,
      preAction: async (ctx) => {
        await ctx.click(KAFKA.CONSUME_TAB);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        // 1. Fill the consume topic
        await ctx.fill(KAFKA.CON_TOPIC_INPUT, 'audit.login');
        await ctx.delay(600);

        // 2. Spotlight Save button
        const saveBtn = document.querySelector<HTMLElement>(KAFKA.CON_SAVE_BTN);
        if (saveBtn) {
          const rm1 = showSpotlightRing(saveBtn);
          await ctx.delay(800);
          rm1();

          // 3. Click Save
          saveBtn.click();
          const conSaveInput = '[data-testid="con-tmpl-save-input"]';
          try { await ctx.waitFor(conSaveInput, 3000); } catch { /* fallback */ }
          await ctx.delay(400);

          // 4. Fill template name
          const nameInput = document.querySelector<HTMLInputElement>(conSaveInput);
          if (nameInput) {
            const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            proto?.call(nameInput, 'Audit Consumer');
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            nameInput.dispatchEvent(new Event('change', { bubbles: true }));
            await ctx.delay(500);

            // 5. Click confirm
            const confirmBtn = document.querySelector<HTMLElement>('[data-testid="con-tmpl-save-confirm"]');
            if (confirmBtn) {
              confirmBtn.click();
              await ctx.delay(600);
            }
          }

          // 6. Spotlight toast
          const toast = document.querySelector<HTMLElement>('[data-testid="con-tmpl-toast"]');
          if (toast) {
            const rm2 = showSpotlightRing(toast);
            await ctx.delay(1500);
            rm2();
          }
        }
      },
    },
    {
      id: 'tmpl-persist',
      title: 'Templates Persist Across Reloads',
      description:
        'Templates are stored in your browser\'s **localStorage** — they survive page reloads, browser restarts, and app updates. To verify: click **Save**, enter any name, confirm — then reload the page and open **Load ▾**. Your template will still be there.',
      highlight: TEMPLATE_CONTROLS,
      preAction: async (ctx) => {
        await ctx.click(KAFKA.PUBLISH_TAB);
        await ctx.delay(300);
      },
    },
  ],
};
