/** Lesson K7: Schema Registry — browse Avro/Protobuf subjects, view and version schemas */
import type { DemoLesson, DemoActionContext } from '../../types';
import { kafkaSchemaSetup, kafkaCleanup } from '../setup-helpers';
import { KAFKA } from '@shared/selectors';

const REGISTRY_URL = 'http://localhost:8085';
const DEMO_SAMPLE_SUBJECT = 'orders-value';

function hasSubjectRows(): boolean {
  return document.querySelectorAll(`${KAFKA.SCHEMA_SUBJECT_TABLE} tbody tr[data-testid^="subject-row-"]`).length > 0;
}

/** Returns true if the expected demo subjects (3) are already loaded. */
function hasDemoSubjects(): boolean {
  return document.querySelectorAll(`${KAFKA.SCHEMA_SUBJECT_TABLE} tbody tr[data-testid^="subject-row-"]`).length >= 3;
}

async function seedDemoSampleSubject(config: {
  registryUrl: string;
  auth?: { username: string; password: string };
}): Promise<boolean> {
  if (typeof fetch !== 'function') return false;
  try {
    const response = await fetch('/api/kafka/schema-seed-sample', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaConfig: config,
        subject: DEMO_SAMPLE_SUBJECT,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Quietly ensure the Schema Registry tab is active (no ripple — for later-step guards). */
async function ensureSchemaTabQuiet(ctx: DemoActionContext): Promise<void> {
  const tab = document.querySelector<HTMLElement>(KAFKA.SCHEMA_TAB);
  if (!tab) return;
  const already =
    tab.classList.contains('active') || tab.getAttribute('aria-selected') === 'true';
  if (already) return;
  tab.click();
  await ctx.delay(120);
}

/**
 * Ensure the schema registry URL is filled and subjects are loaded.
 * Idempotent — skips if subjects are already visible.
 */
async function ensureRegistryConnected(ctx: DemoActionContext): Promise<void> {
  await ensureSchemaTabQuiet(ctx);
  if (document.querySelector(KAFKA.SCHEMA_SUBJECT_TABLE) && hasSubjectRows()) return;

  const urlInput = document.querySelector<HTMLInputElement>(KAFKA.SCHEMA_URL_INPUT);
  if (urlInput && !urlInput.value.trim()) {
    await ctx.fill(KAFKA.SCHEMA_URL_INPUT, REGISTRY_URL);
    await ctx.delay(200);
  }

  const connectBtn = document.querySelector<HTMLButtonElement>(KAFKA.SCHEMA_CONNECT_BTN);
  if (connectBtn && !connectBtn.disabled) {
    await ctx.click(KAFKA.SCHEMA_CONNECT_BTN);
    try {
      await ctx.waitFor(KAFKA.SCHEMA_SUBJECT_TABLE, 10000);
    } catch { /* subjects may not load if docker is down */ }
    await ctx.delay(400);
  }

  if (!hasDemoSubjects()) {
    const authUser = document.querySelector<HTMLInputElement>(KAFKA.SCHEMA_AUTH_USER)?.value?.trim() ?? '';
    const authPass = document.querySelector<HTMLInputElement>(KAFKA.SCHEMA_AUTH_PASS)?.value?.trim() ?? '';
    const seeded = await seedDemoSampleSubject({
      registryUrl: urlInput?.value?.trim() || REGISTRY_URL,
      auth: authUser || authPass ? { username: authUser, password: authPass } : undefined,
    });

    if (seeded && connectBtn && !connectBtn.disabled) {
      await ctx.click(KAFKA.SCHEMA_CONNECT_BTN);
      try {
        await ctx.waitFor(KAFKA.SCHEMA_SUBJECT_TABLE, 10000);
      } catch { /* no-op */ }
      await ctx.delay(350);
    }
  }
}

/** Click the first visible subject row if none is selected. */
async function ensureSubjectSelected(ctx: DemoActionContext): Promise<void> {
  await ensureRegistryConnected(ctx);
  if (document.querySelector(KAFKA.SCHEMA_DETAIL_PANEL)) return;

  // Prefer orders-value (has multiple versions for the version-switch demo)
  const row = document.querySelector<HTMLElement>(
    `${KAFKA.SCHEMA_SUBJECT_TABLE} tbody tr[data-testid="subject-row-orders-value"]`,
  ) ?? document.querySelector<HTMLElement>(
    `${KAFKA.SCHEMA_SUBJECT_TABLE} tbody tr[style]`,
  );
  if (row) {
    row.click();
    try {
      await ctx.waitFor(KAFKA.SCHEMA_DETAIL_PANEL, 5000);
    } catch { /* detail panel may not appear */ }
    await ctx.delay(400);
  }
}

export const kafkaSchemaRegistryLesson: DemoLesson = {
  id: 'kafka-schema-registry',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Schema Registry',
  description:
    'Connect to Confluent Schema Registry, browse Avro and Protobuf subjects, inspect schema versions, and copy schemas for use in your workflows.',
  estimatedMinutes: 5,
  initialTab: 'kafka-message-studio',
  allowedTabs: ['kafka-settings'],

  dockerEndpoint: 'http://localhost:8085',
  dockerCommand: 'cd docker/kafka/schema-registry && docker compose up -d',
  tag: '🐳 Docker',

  setup: kafkaSchemaSetup,
  cleanup: kafkaCleanup,

  concept: {
    title: 'Schema Registry: A Contract Store for Kafka',
    body: `A **Schema Registry** stores and versions the data schemas used by Kafka producers and consumers. Without it, every team must agree on schema changes out-of-band — with it, the registry enforces **compatibility rules** automatically.

**Core concepts:**
- A **Subject** is a named schema stream, typically \`<topic>-value\` or \`<topic>-key\`
- Each subject can have multiple **versions** (v1, v2, …). The registry tracks all of them
- **Compatibility** rules (Backward, Forward, Full) control which schema changes are allowed
- When a producer encodes with Avro/Protobuf, it embeds the **schema ID** in each message (5-byte magic prefix). The consumer uses this ID to fetch the correct schema for decoding

**Supported formats:**
| Format | Use case |
|---|---|
| **Avro** | Most common in Java ecosystems; compact binary, rich type system |
| **Protobuf** | Cross-language binary; versioning via field numbers |
| **JSON Schema** | Human-readable; useful for hybrid REST+Kafka pipelines |

RedfireForge reads the registry to populate the **Schema** selector in the Publish Studio, letting you encode messages in Avro/Protobuf without writing serialization code.`,
    keyTerms: [
      {
        term: 'Subject',
        definition:
          'A named schema stream in the registry, typically following the convention `<topic>-value` or `<topic>-key`. Each subject holds all versions of a schema for that topic side.',
      },
      {
        term: 'Schema ID',
        definition:
          'A compact integer ID embedded in every Avro/Protobuf message (after a 1-byte magic value). The consumer uses this ID to fetch the schema from the registry and decode the message.',
      },
      {
        term: 'Backward Compatibility',
        definition:
          'The most common compatibility rule: a new schema can read data produced by the previous schema version. Adding optional fields is backward-compatible; removing required fields is not.',
      },
      {
        term: 'Schema Evolution',
        definition:
          'The process of changing a schema over time (v1 → v2 → v3) while maintaining compatibility with older producers or consumers. The registry enforces the evolution rules.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 160" xmlns="http://www.w3.org/2000/svg">
  <!-- Producer -->
  <rect x="8" y="55" width="75" height="50" rx="5" fill="var(--primary)" opacity="0.18" stroke="var(--primary)" stroke-width="1.2"/>
  <text x="45" y="76" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui">Producer</text>
  <text x="45" y="90" text-anchor="middle" fill="var(--text-muted)" font-size="8">Avro encode</text>
  <text x="45" y="101" text-anchor="middle" fill="var(--text-muted)" font-size="8">+ schemaId</text>
  <!-- Arrow to broker -->
  <line x1="83" y1="80" x2="118" y2="80" stroke="var(--primary)" stroke-width="1.3" marker-end="url(#sr-a1)"/>
  <!-- Broker -->
  <rect x="120" y="55" width="80" height="50" rx="5" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.2"/>
  <text x="160" y="76" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui">Kafka Topic</text>
  <text x="160" y="90" text-anchor="middle" fill="var(--text-muted)" font-size="8">[5B prefix +</text>
  <text x="160" y="101" text-anchor="middle" fill="var(--text-muted)" font-size="8">Avro bytes]</text>
  <!-- Arrow to consumer -->
  <line x1="200" y1="80" x2="235" y2="80" stroke="var(--primary)" stroke-width="1.3" marker-end="url(#sr-a2)"/>
  <!-- Consumer -->
  <rect x="237" y="55" width="75" height="50" rx="5" fill="var(--success,#a6e3a1)" opacity="0.2" stroke="var(--success,#a6e3a1)" stroke-width="1.2"/>
  <text x="274" y="76" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui">Consumer</text>
  <text x="274" y="90" text-anchor="middle" fill="var(--text-muted)" font-size="8">fetch schema</text>
  <text x="274" y="101" text-anchor="middle" fill="var(--text-muted)" font-size="8">decode Avro</text>
  <!-- Arrow fetch schema -->
  <line x1="274" y1="55" x2="340" y2="30" stroke="var(--accent)" stroke-width="1" stroke-dasharray="4,2" marker-end="url(#sr-a3)"/>
  <!-- Schema Registry -->
  <rect x="330" y="8" width="82" height="42" rx="5" fill="var(--surface2,#1e1e2e)" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="371" y="24" text-anchor="middle" fill="var(--text)" font-size="9" font-family="system-ui">Schema Registry</text>
  <text x="371" y="37" text-anchor="middle" fill="var(--text-muted)" font-size="8">orders-value v3</text>
  <!-- Producer also fetches -->
  <line x1="45" y1="55" x2="340" y2="30" stroke="var(--primary)" stroke-width="1" stroke-dasharray="4,2" marker-end="url(#sr-a3)"/>
  <defs>
    <marker id="sr-a1" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="none" stroke="var(--primary)" stroke-width="1.3"/></marker>
    <marker id="sr-a2" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="none" stroke="var(--primary)" stroke-width="1.3"/></marker>
    <marker id="sr-a3" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="none" stroke="var(--accent)" stroke-width="1.3"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    // Step 1: Navigate to Schema Registry tab
    {
      id: 'sr-intro',
      title: 'The Schema Registry Tab',
      description:
        'The **Schema Registry** tab is where you connect to a Confluent-compatible registry, browse all registered subjects, and inspect schema versions. It starts empty — you need to enter a registry URL first.',
      highlight: KAFKA.SCHEMA_TAB,
      preAction: async () => {
        document.querySelectorAll('.kafka-schema-subject-table tbody tr.selected').forEach((el) => {
          el.classList.remove('selected');
        });
      },
      // Visible teaching beat — setup intentionally does NOT click this tab
      // (that caused a pre-narration flash at lesson start).
      action: async (ctx) => {
        await ctx.click(KAFKA.SCHEMA_TAB);
        await ctx.waitFor(KAFKA.SCHEMA_URL_INPUT, 3000);
        await ctx.delay(600);
      },
    },

    // Step 2: Enter registry URL and connect
    {
      id: 'sr-connect',
      title: 'Connect to Registry',
      description:
        'Enter the Schema Registry URL — for the local Docker stack it\'s `http://localhost:8085`. Then click **Refresh Subjects**. RedfireForge queries the `/subjects` endpoint and loads the subject list. In Demo Hub, if the registry is empty, the lesson auto-seeds one sample subject so you can continue the walkthrough end-to-end.',
      highlight: KAFKA.SCHEMA_CONNECT_BTN,
      preAction: async (ctx) => {
        await ensureSchemaTabQuiet(ctx);
        await ctx.fill(KAFKA.SCHEMA_URL_INPUT, REGISTRY_URL);
        await ctx.delay(300);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.SCHEMA_CONNECT_BTN);
        await ctx.waitFor(KAFKA.SCHEMA_SUBJECT_TABLE, 10000);
        await ensureRegistryConnected(ctx);
        await ctx.delay(600);
      },
    },

    // Step 4: View subject list
    {
      id: 'sr-list',
      title: 'Subject List',
      description:
        'Each row shows the subject name and its **format badge** (Avro / Protobuf / JSON Schema). The naming convention `<topic>-value` and `<topic>-key` links each subject to its Kafka topic. If you see no rows, the registry is reachable but currently has no registered subjects.',
      highlight: KAFKA.SCHEMA_SUBJECT_TABLE,
      preAction: async (ctx) => {
        await ensureRegistryConnected(ctx);
      },
    },

    // Step 5: Filter subjects
    {
      id: 'sr-filter',
      title: 'Filter Subjects',
      description:
        'Use the **Filter** input to search subjects by name. For registries with hundreds of subjects, filtering by topic prefix (e.g., "orders") narrows the list immediately.',
      highlight: KAFKA.SCHEMA_SEARCH,
      preAction: async (ctx) => {
        await ensureRegistryConnected(ctx);
        await ctx.fill(KAFKA.SCHEMA_SEARCH, 'orders');
        await ctx.delay(400);
      },
    },

    // Step 6: Select a subject
    {
      id: 'sr-select',
      title: 'Select a Subject',
      description:
        'Click any subject row to open its detail panel. The **format badge**, **compatibility level**, and **latest version** appear at the top. The schema content renders below.',
      highlight: KAFKA.SCHEMA_SUBJECT_TABLE,
      preAction: async (ctx) => {
        await ensureRegistryConnected(ctx);
        // Clear the filter so all subjects are visible
        const filterInput = document.querySelector<HTMLInputElement>(KAFKA.SCHEMA_SEARCH);
        if (filterInput && filterInput.value) {
          await ctx.fill(KAFKA.SCHEMA_SEARCH, '');
          await ctx.delay(200);
        }
      },
      action: async (ctx) => {
        // Select the orders-value subject specifically (the primary demo subject with multiple versions)
        const ordersRow = document.querySelector<HTMLElement>(
          `${KAFKA.SCHEMA_SUBJECT_TABLE} tbody tr[data-testid="subject-row-orders-value"]`,
        );
        if (ordersRow) {
          ordersRow.click();
        } else {
          // Fallback: click any visible row
          const row = document.querySelector<HTMLElement>(
            `${KAFKA.SCHEMA_SUBJECT_TABLE} tbody tr[style]`,
          );
          if (row) row.click();
          else await ctx.click(KAFKA.SCHEMA_SUBJECT_TABLE);
        }
        try {
          await ctx.waitFor(KAFKA.SCHEMA_DETAIL_PANEL, 5000);
        } catch { /* detail panel may not appear if no subjects */ }
        await ctx.delay(500);
      },
    },

    // Step 7: Read the schema content
    {
      id: 'sr-schema',
      title: 'Read the Schema',
      description:
        'The **schema viewer** shows the raw Avro JSON, Protobuf IDL, or JSON Schema definition. You can read the field names, types, defaults, and documentation strings directly — no CLI required.',
      highlight: KAFKA.SCHEMA_CONTENT,
      preAction: async (ctx) => {
        await ensureSubjectSelected(ctx);
      },
    },

    // Step 8: Switch schema version
    {
      id: 'sr-version',
      title: 'Switch Schema Versions',
      description:
        'Use the **Version** dropdown to navigate between schema versions. Comparing v1 and v2 shows exactly which fields were added, removed, or changed — useful for debugging compatibility issues.',
      highlight: KAFKA.SCHEMA_VERSION_SELECT,
      preAction: async (ctx) => {
        await ensureSubjectSelected(ctx);
      },
      action: async (ctx) => {
        // Open the version dropdown — must click the inner .cs-trigger button, not the wrapper div
        const trigger = document.querySelector<HTMLButtonElement>(
          `${KAFKA.SCHEMA_VERSION_SELECT} .cs-trigger`,
        );
        if (trigger) {
          trigger.click();
          await ctx.delay(500);
          // Select v1 (the first/older version) to demonstrate switching
          const v1Option = document.querySelector<HTMLButtonElement>('[role="option"][data-value="1"]');
          if (v1Option) {
            v1Option.click();
            await ctx.delay(500);
          }
        }
      },
    },

    // Step 9: Copy the schema
    {
      id: 'sr-copy',
      title: 'Copy the Schema',
      description:
        'Click **Copy to Clipboard** to copy the full schema definition. You can paste it into your producer code, a workflow node\'s schema config, or share it with the team. The **Export** button downloads it as a `.json` or `.proto` file.',
      highlight: KAFKA.SCHEMA_COPY_BTN,
      preAction: async (ctx) => {
        await ensureSubjectSelected(ctx);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.SCHEMA_COPY_BTN);
        await ctx.delay(400);
      },
    },
  ],
};
