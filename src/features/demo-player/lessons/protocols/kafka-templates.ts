/** Lesson K5: Templates — save, load, and delete Kafka form configurations */
import type { DemoLesson } from '../../types';
import { KAFKA } from '../../../../shared/selectors';
import { KAFKA_PUBLISH_TEMPLATES_KEY } from '../../../../shared/kafka/kafkaStorage';

/** Selector for the save name input (shown after clicking the Save button). */
const SAVE_INPUT = '.kafka-ms-template-save-input';

/** Selector for the ✓ confirm button in the save row. */
const SAVE_CONFIRM_BTN = '.kafka-ms-template-save-row .kafka-ms-template-btn:not(.kafka-ms-template-btn-cancel)';

/** Selector for the first template row item in the dropdown. */
const TEMPLATE_ITEM = '.kafka-ms-template-item';

/** Selector for the delete (×) button on the first template row. */
const TEMPLATE_DELETE_BTN = '.kafka-ms-template-item-delete';

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

  /**
   * Cleanup: remove any "Orders Template" that may have been left in localStorage
   * if the lesson was stopped mid-way (e.g., abandoned between Step 3 and Step 5).
   */
  cleanup: async () => {
    try {
      const raw = localStorage.getItem(KAFKA_PUBLISH_TEMPLATES_KEY);
      if (raw) {
        const templates = JSON.parse(raw) as Array<{ id: string; name: string }>;
        const filtered = templates.filter((t) => t.name !== 'Orders Template');
        localStorage.setItem(KAFKA_PUBLISH_TEMPLATES_KEY, JSON.stringify(filtered));
      }
    } catch {
      // Ignore parse or storage errors — non-fatal.
    }
  },

  concept: {
    title: 'Save Your Kafka Setups as Templates',
    body: `Configuring a Kafka message over and over wastes time. **Templates** let you save the full publish or consume form — topic, key, acks, headers, body, filters — and reload it instantly.

**Publish templates** capture the entire form: topic, message key, ack level, custom headers, and message body. Load a template and the form repopulates in one click — ready to send.

**Consume templates** save all consume fields except the consumer group ID, which is stripped on load so each session gets a fresh group (avoids offset conflicts).

**Persistence:** Templates are stored in \`localStorage\` and survive page reloads, browser restarts, and app updates.

**Where to find them:** Both the Publish tab and the Consume tab have **Save** and **Load ▾** buttons directly above the form fields.`,
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
      title: 'Saving a Publish Template',
      description:
        'The Publish tab has two template buttons above the form: **Save** (captures the current form state) and **Load ▾** (opens a dropdown of saved templates). No broker connection is required — templates work entirely in the browser.',
      highlight: KAFKA.PUB_SAVE_BTN,
      // Informational — no action.
    },
    {
      id: 'tmpl-fill-pub',
      title: 'Fill a Publish Form',
      description:
        'Watch the form fill in automatically: **topic** is set to `orders.events` and a simple JSON body is entered. These values will be captured when you save the template.',
      highlight: KAFKA.PUB_TOPIC_INPUT,
      action: async (ctx) => {
        await ctx.fill(KAFKA.PUB_TOPIC_INPUT, 'orders.events');
        await ctx.delay(400);
        await ctx.fill(KAFKA.PUB_BODY_TEXTAREA, '{"type":"test"}');
        await ctx.delay(300);
      },
    },
    {
      id: 'tmpl-save-pub',
      title: 'Save as "Orders Template"',
      description:
        'Click **Save** — a name input slides in. Type a name and click ✓ to confirm. The template is immediately available in the **Load ▾** dropdown.',
      highlight: KAFKA.PUB_SAVE_BTN,
      action: async (ctx) => {
        // 1. Click Save to reveal the inline name input (showSaveInput → true)
        await ctx.click(KAFKA.PUB_SAVE_BTN);
        await ctx.delay(500); // wait for React re-render

        // 2. Fill the template name (React-controlled input via native setter + input event)
        await ctx.fill(SAVE_INPUT, 'Orders Template');
        await ctx.delay(300); // ensure React re-renders and removes disabled from ✓ button

        // 3. Click the ✓ confirm button to submit
        await ctx.click(SAVE_CONFIRM_BTN);
        await ctx.delay(400);
      },
    },
    {
      id: 'tmpl-load-pub',
      title: 'Load ▾ the Template',
      description:
        'The topic field is cleared first so you can see the template restore it. Click **Load ▾** — "Orders Template" appears. Click it and watch topic and body instantly refill.',
      highlight: KAFKA.PUB_LOAD_BTN,
      action: async (ctx) => {
        // Clear the topic so the template reload is visually obvious
        await ctx.fill(KAFKA.PUB_TOPIC_INPUT, '');
        await ctx.delay(400);

        // Open the Load dropdown
        await ctx.click(KAFKA.PUB_LOAD_BTN);
        await ctx.delay(400);

        // Click the template item (closes dropdown, restores form fields)
        await ctx.click(TEMPLATE_ITEM);
        await ctx.delay(300);
      },
    },
    {
      id: 'tmpl-delete-pub',
      title: 'Delete the Template',
      description:
        'Open **Load ▾** again — "Orders Template" is listed. Click the **×** next to it to delete it. The dropdown immediately shows "No saved templates".',
      highlight: KAFKA.PUB_LOAD_BTN,
      action: async (ctx) => {
        // Re-open the Load dropdown
        await ctx.click(KAFKA.PUB_LOAD_BTN);
        await ctx.delay(400);

        // Click the × delete button on the first (and only) template item
        await ctx.click(TEMPLATE_DELETE_BTN);
        await ctx.delay(300);
      },
    },
    {
      id: 'tmpl-consume',
      title: 'Consume Templates Work the Same',
      description:
        'Switch to the **Consume** tab — it has identical **Save** and **Load ▾** template controls. Consume templates save all fields except the consumer group ID, which is stripped on load to avoid offset conflicts.',
      highlight: KAFKA.CON_SAVE_BTN,
      preAction: async (ctx) => {
        await ctx.click(KAFKA.CONSUME_TAB);
        await ctx.delay(300);
      },
    },
    {
      id: 'tmpl-persist',
      title: 'Templates Persist Across Reloads',
      description:
        'Templates are stored in your browser\'s **localStorage** — they survive page reloads, browser restarts, and app updates. To verify: click **Save**, enter any name, confirm — then reload the page and open **Load ▾**. Your template will still be there.',
      highlight: KAFKA.PUB_LOAD_BTN,
      preAction: async (ctx) => {
        // Return to Publish tab so the PUB_LOAD_BTN highlight is visible
        await ctx.click(KAFKA.PUBLISH_TAB);
        await ctx.delay(300);
      },
    },
  ],
};
