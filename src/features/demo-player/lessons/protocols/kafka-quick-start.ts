/** Lesson K1: Kafka Quick Start — configure a cluster, connect, navigate to the Studio */
import type { DemoLesson } from '../../types';
import { KAFKA } from '../../../../shared/selectors';

/** Default broker address for the plaintext demo stack. */
const DEMO_BROKER = '127.0.0.1:19092';
/** Cluster name to create in the demo. */
const DEMO_CLUSTER_NAME = 'Demo Cluster';

export const kafkaQuickStartLesson: DemoLesson = {
  id: 'kafka-quick-start',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Quick Start',
  description:
    'Configure a Kafka cluster connection, connect to the broker, and navigate to the Kafka Studio in under 3 minutes.',
  estimatedMinutes: 3,
  initialTab: 'kafka-settings',
  // Step 7 navigates to kafka-message-studio — declare it as allowed so
  // useDemoShortcuts does not auto-exit when the tab changes.
  allowedTabs: ['kafka-settings', 'kafka-message-studio'],

  // Requires the plaintext Kafka broker (Redpanda Console health endpoint).
  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',

  // No setup — lesson starts directly on kafka-settings.
  // No cleanup — cluster config persists intentionally for K2/K3/K4.

  concept: {
    title: 'Connecting to a Kafka Broker',
    body: `Before you can publish or consume messages, RedfireForge needs to know where your broker lives. The **Kafka Cluster Studio** (Settings → Kafka) is where you create and manage connection profiles.

A **Cluster Profile** stores:
- **Bootstrap broker** address (\`host:port\`) — the entry point to your Kafka cluster
- **Authentication** — Plaintext, SASL/PLAIN, SCRAM-SHA-256/512
- **TLS** — optional encryption layer for secure brokers

Once saved and connected, your cluster is available across the entire app: Publish Studio, Consume Studio, Topic Explorer, Schema Registry, and Workflow nodes all share the same connection.

**Settings → Kafka** is for configuration. **Protocols → Kafka** is where you test and inspect messages. You'll visit Settings first — then the Studio.`,
    keyTerms: [
      {
        term: 'Bootstrap Broker',
        definition:
          'The initial host:port that Kafka clients connect to. The broker then provides the full cluster metadata — topics, partitions, leader locations.',
      },
      {
        term: 'Cluster ID',
        definition:
          'A unique slug (e.g. demo-cluster) that RedfireForge uses internally to route API calls to the right broker profile. Auto-generated from the cluster name.',
      },
      {
        term: 'Connection State',
        definition:
          'The live health badge: Idle (not tried), Connected (healthy), Disconnected, Error. The badge updates in real time as the broker responds.',
      },
      {
        term: 'SASL / TLS',
        definition:
          'Security layers for production brokers. SASL authenticates the client (username + password or SCRAM token). TLS encrypts the wire traffic.',
      },
    ],
    diagram: `<svg viewBox="0 0 400 130" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="ks-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <path d="M0,0 L0,6 L8,3 z" fill="var(--primary)"/>
    </marker>
  </defs>
  <!-- RedfireForge box -->
  <rect x="10" y="40" width="120" height="50" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="70" y="60" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">RedfireForge</text>
  <text x="70" y="76" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">Cluster Profile</text>
  <text x="70" y="88" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="system-ui">127.0.0.1:19092</text>
  <!-- Arrow: app → broker -->
  <line x1="130" y1="65" x2="195" y2="65" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#ks-arrow)"/>
  <text x="162" y="58" text-anchor="middle" fill="var(--text-muted)" font-size="9">connect</text>
  <!-- Kafka broker box -->
  <rect x="195" y="30" width="100" height="70" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="245" y="54" text-anchor="middle" fill="var(--text)" font-size="11" font-family="system-ui" font-weight="600">Kafka Broker</text>
  <text x="245" y="70" text-anchor="middle" fill="var(--text-muted)" font-size="9">Redpanda</text>
  <text x="245" y="84" text-anchor="middle" fill="var(--text-muted)" font-size="9">:19092</text>
  <!-- Status badge -->
  <rect x="305" y="55" width="80" height="22" rx="11" fill="var(--success)" opacity="0.2" stroke="var(--success)" stroke-width="1"/>
  <text x="345" y="70" text-anchor="middle" fill="var(--success)" font-size="10" font-weight="600">Connected</text>
  <!-- Labels -->
  <text x="70" y="112" text-anchor="middle" fill="var(--text-muted)" font-size="9">Settings → Kafka</text>
  <text x="245" y="112" text-anchor="middle" fill="var(--text-muted)" font-size="9">Docker: plaintext stack</text>
</svg>`,
  },

  steps: [
    // ── Step 1: Kafka Cluster Studio overview ────────────────────
    {
      id: 'ks-intro',
      title: 'Kafka Cluster Studio',
      description:
        'This is **Settings → Kafka** — the Kafka Cluster Studio. Create and manage broker connection profiles here. The left panel lists your saved clusters; the right panel is the editor.',
      highlight: KAFKA.SETTINGS_PAGE,
    },

    // ── Step 2: Open the cluster editor ─────────────────────────
    {
      id: 'ks-create',
      title: 'Create a Cluster Profile',
      description:
        'Click **Create First Cluster** (if this is your first time) or **+ New** to open the editor. RedfireForge pre-fills the default broker address — you just need to name it.',
      highlight: KAFKA.CLUSTER_EDITOR,
      action: async (ctx) => {
        // Use the empty-state button if present (first run), otherwise the toolbar "+ New" button.
        // This prevents creating a duplicate cluster if one already exists.
        const emptyBtn = document.querySelector<HTMLElement>('[data-testid="kafka-empty-create-btn"]');
        const addBtn = document.querySelector<HTMLElement>('[data-testid="kafka-add-cluster-btn"]');
        const btn = emptyBtn ?? addBtn;
        if (btn) {
          btn.click();
          await ctx.delay(400);
        }
      },
    },

    // ── Step 3: Name the cluster ─────────────────────────────────
    {
      id: 'ks-fill',
      title: 'Name Your Cluster',
      description:
        `Give the cluster a recognisable name — **${DEMO_CLUSTER_NAME}**. The broker address \`${DEMO_BROKER}\` is already pre-filled for the local plaintext stack. Leave Auth as "No authentication".`,
      highlight: KAFKA.CLUSTER_EDITOR,
      action: async (ctx) => {
        await ctx.fill('#kafka-cluster-name', DEMO_CLUSTER_NAME);
      },
    },

    // ── Step 4: Save the cluster ─────────────────────────────────
    {
      id: 'ks-save',
      title: 'Save the Profile',
      description:
        'Click **Save Cluster** to persist the profile. It will appear in the cluster list on the left — ready to connect.',
      highlight: KAFKA.SAVE_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.SAVE_BTN);
        await ctx.delay(400);
      },
    },

    // ── Step 5: Connect ──────────────────────────────────────────
    {
      id: 'ks-connect',
      title: 'Connect to the Broker',
      description:
        'Click **Connect**. RedfireForge opens a connection to the broker and updates the badge to **Connected**. This connection is shared across Publish, Consume, Topics, and all Workflow nodes.',
      highlight: KAFKA.CONNECT_BTN,
      action: async (ctx) => {
        // Poll briefly in case the button appears after cluster save animation
        await ctx.waitFor(KAFKA.CONNECT_BTN, 3000);
        const btn = document.querySelector<HTMLButtonElement>(KAFKA.CONNECT_BTN);
        if (btn && !btn.disabled) {
          btn.click();
          await ctx.delay(800);
        }
      },
      verify: KAFKA.SETTINGS_LIST,
    },

    // ── Step 6: Connected status ─────────────────────────────────
    {
      id: 'ks-status',
      title: 'Connection Status',
      description:
        'The **Connected** badge confirms the broker is reachable. The cluster card shows the broker address and auth mode. The same status badge appears in the top bar across the whole app.',
      highlight: KAFKA.SETTINGS_LIST,
    },

    // ── Step 7: Return to the Studio ─────────────────────────────
    {
      id: 'ks-studio',
      title: 'Into the Kafka Studio',
      description:
        'Head to **Protocols → Kafka**. You\'ll see four tabs: **Publish**, **Consume**, **Topics**, and **Schema Registry**. The next lessons cover each one.',
      highlight: KAFKA.PUBLISH_TAB,
      // preAction: navigate before the reading phase starts so the tab switch
      // is already complete when the user reads the description.
      preAction: async (ctx) => {
        ctx.navigateToTab('kafka-message-studio');
        await ctx.delay(400);
      },
    },
  ],
};
