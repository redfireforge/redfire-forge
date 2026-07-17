/** Lesson K6: Topic Explorer — browse topics, partitions, and consumer group lag */
import type { DemoLesson, DemoActionContext } from '../../types';
import { kafkaPublishSetup, kafkaCleanup } from '../setup-helpers';
import { KAFKA } from '@shared/selectors';

const TOPIC_ROW_SELECTOR = `${KAFKA.TOPIC_TABLE} tbody tr[style]`;

/** Ensure the Topics tab is active and topics are loaded. Idempotent. */
async function ensureTopicsTab(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(TOPIC_ROW_SELECTOR)) return;

  await ctx.click(KAFKA.TOPICS_TAB);
  try { await ctx.waitFor(KAFKA.TOPIC_TABLE, 5000); } catch { /* may not appear */ }
  await ctx.delay(600);

  // Topics load asynchronously — wait for at least one row to render
  for (let i = 0; i < 20; i++) {
    if (document.querySelector(TOPIC_ROW_SELECTOR)) break;
    await ctx.delay(500);
  }
}

/** Click the first visible topic row if no detail panel is open. */
async function ensureTopicSelected(ctx: DemoActionContext): Promise<void> {
  await ensureTopicsTab(ctx);

  // Clear any active search filter so all topics are visible
  const searchInput = document.querySelector<HTMLInputElement>(KAFKA.TOPIC_SEARCH);
  if (searchInput && searchInput.value) {
    await ctx.fill(KAFKA.TOPIC_SEARCH, '');
    await ctx.delay(200);
  }

  if (document.querySelector(KAFKA.DETAIL_TABS)) return;

  const row = document.querySelector<HTMLElement>(TOPIC_ROW_SELECTOR);
  if (row) {
    row.click();
    try { await ctx.waitFor(KAFKA.DETAIL_TABS, 5000); } catch { /* detail may not load */ }
    await ctx.delay(500);
  }
}

export const kafkaTopicExplorerLesson: DemoLesson = {
  id: 'kafka-topic-explorer',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Topic Explorer',
  description:
    'Browse topics, inspect partition metrics, and drill into consumer group lag without touching the CLI.',
  estimatedMinutes: 5,
  initialTab: 'kafka-message-studio',
  allowedTabs: ['kafka-settings'],

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',
  tag: '🐳 Docker',

  setup: async (ctx) => {
    await kafkaPublishSetup(ctx);
    await ctx.click(KAFKA.TOPICS_TAB);
    await ctx.delay(600);
    // Topics load asynchronously — wait for at least one row
    for (let i = 0; i < 20; i++) {
      if (document.querySelector(TOPIC_ROW_SELECTOR)) break;
      await ctx.delay(500);
    }
  },
  cleanup: kafkaCleanup,

  concept: {
    title: 'Topic Explorer: Live Cluster Visibility',
    body: `The **Topic Explorer** tab gives you a live view of every topic in your Kafka cluster — without opening a terminal.

Each topic row shows:
| Column | Meaning |
|---|---|
| **Partitions** | Number of partitions the topic is split into |
| **Replication** | How many broker replicas hold each partition |
| **Traffic** | Recent produce / consume byte rate |
| **Consumer Groups** | Number of CGs subscribed to this topic |
| **Health** | ✅ Healthy / ⚠️ Degraded / ❓ Unknown |

Clicking a topic row opens the **Detail Panel** on the right, which has four tabs:
- **Messages** — browse the latest messages inline
- **Partitions** — see leader, high-water mark, and ISR fraction per partition
- **Consumer Groups** — see lag, state, and member count per subscribed group
- **Config** — view broker-side topic configuration (retention.ms, cleanup.policy, etc.)

**Domain Chips** group topics by their name prefix (e.g., \`orders.*\` becomes an "orders" chip). Clicking a chip filters the table to that domain instantly.`,
    keyTerms: [
      {
        term: 'High-Water Mark (HWM)',
        definition:
          'The offset of the last message that has been successfully replicated to all in-sync replicas. A consumer reading from the latest position receives messages up to the HWM.',
      },
      {
        term: 'Consumer Group Lag',
        definition:
          'The number of messages between a consumer group\'s committed offset and the topic\'s high-water mark. A growing lag indicates the consumer is falling behind producers.',
      },
      {
        term: 'In-Sync Replica (ISR)',
        definition:
          'A broker replica that is fully caught up with the partition leader. A healthy partition has an ISR fraction of 1.0. Anything lower means replicas are lagging.',
      },
      {
        term: 'Domain Chip',
        definition:
          'An auto-generated filter chip derived from the topic name prefix (e.g., "orders" from orders.created). Clicking it filters the topic list to that business domain.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 160" xmlns="http://www.w3.org/2000/svg">
  <!-- Topic list panel -->
  <rect x="8" y="10" width="160" height="140" rx="5" fill="var(--surface2,#1e1e2e)" stroke="var(--border,#45475a)" stroke-width="1.2"/>
  <text x="88" y="28" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui">Topic List</text>
  <rect x="16" y="34" width="144" height="16" rx="3" fill="var(--primary)" opacity="0.2"/>
  <text x="88" y="45" text-anchor="middle" fill="var(--text)" font-size="9">orders.created ✅</text>
  <rect x="16" y="54" width="144" height="16" rx="3" fill="var(--surface3,#313244)" opacity="0.8"/>
  <text x="88" y="65" text-anchor="middle" fill="var(--text)" font-size="9">orders.events ✅</text>
  <rect x="16" y="74" width="144" height="16" rx="3" fill="var(--surface3,#313244)" opacity="0.8"/>
  <text x="88" y="85" text-anchor="middle" fill="var(--text)" font-size="9">payments.confirmed ✅</text>
  <rect x="16" y="94" width="144" height="16" rx="3" fill="var(--surface3,#313244)" opacity="0.8"/>
  <text x="88" y="105" text-anchor="middle" fill="var(--text-muted)" font-size="9">headers.demo ⚠️</text>
  <!-- Arrow -->
  <line x1="172" y1="80" x2="208" y2="80" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#te-arr)"/>
  <!-- Detail panel -->
  <rect x="210" y="10" width="200" height="140" rx="5" fill="var(--surface2,#1e1e2e)" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="310" y="28" text-anchor="middle" fill="var(--text)" font-size="10" font-family="system-ui">orders.created</text>
  <!-- Metric boxes -->
  <rect x="220" y="34" width="40" height="30" rx="3" fill="var(--primary)" opacity="0.18"/>
  <text x="240" y="48" text-anchor="middle" fill="var(--text)" font-size="8">6 parts</text>
  <rect x="266" y="34" width="40" height="30" rx="3" fill="var(--primary)" opacity="0.18"/>
  <text x="286" y="48" text-anchor="middle" fill="var(--text)" font-size="8">RF: 1</text>
  <rect x="312" y="34" width="40" height="30" rx="3" fill="var(--primary)" opacity="0.18"/>
  <text x="332" y="48" text-anchor="middle" fill="var(--text)" font-size="8">3 CGs</text>
  <rect x="358" y="34" width="44" height="30" rx="3" fill="var(--success,#a6e3a1)" opacity="0.25"/>
  <text x="380" y="48" text-anchor="middle" fill="var(--text)" font-size="8">✅ OK</text>
  <!-- Tabs -->
  <rect x="220" y="74" width="40" height="14" rx="2" fill="var(--primary)" opacity="0.4"/>
  <text x="240" y="84" text-anchor="middle" fill="var(--text)" font-size="7">Msgs</text>
  <rect x="264" y="74" width="46" height="14" rx="2" fill="var(--surface3,#313244)" opacity="0.6"/>
  <text x="287" y="84" text-anchor="middle" fill="var(--text-muted)" font-size="7">Partitions</text>
  <rect x="314" y="74" width="40" height="14" rx="2" fill="var(--surface3,#313244)" opacity="0.6"/>
  <text x="334" y="84" text-anchor="middle" fill="var(--text-muted)" font-size="7">Groups</text>
  <rect x="358" y="74" width="40" height="14" rx="2" fill="var(--surface3,#313244)" opacity="0.6"/>
  <text x="378" y="84" text-anchor="middle" fill="var(--text-muted)" font-size="7">Config</text>
  <!-- Partition rows -->
  <text x="220" y="103" fill="var(--text-muted)" font-size="8">P0: leader=0, HWM=1284, ISR=1.0</text>
  <text x="220" y="115" fill="var(--text-muted)" font-size="8">P1: leader=0, HWM=1190, ISR=1.0</text>
  <text x="220" y="127" fill="var(--text-muted)" font-size="8">P2: leader=0, HWM=998, ISR=1.0</text>
  <defs>
    <marker id="te-arr" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--primary)" stroke-width="1.5"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    // Step 1: Navigate to Topics tab
    {
      id: 'te-intro',
      title: 'The Topics Tab',
      description:
        'The **Topics** tab gives you a live view of your entire cluster — topics, health, traffic, and consumer groups — all without opening a terminal. Click it to see the two-panel layout: a searchable topic list on the left and a detail panel on the right.',
      highlight: KAFKA.TOPICS_TAB,
      preAction: async (ctx) => {
        await ctx.click(KAFKA.TOPICS_TAB);
        await ctx.delay(400);
        document.querySelectorAll('.kafka-explorer-topic-table tbody tr.selected').forEach((el) => {
          el.classList.remove('selected');
        });
      },
    },

    // Step 2: Explore the topic list
    {
      id: 'te-list',
      title: 'Topic List',
      description:
        'Each row shows the topic name, partition count, replication factor, recent traffic, number of consumer groups, and a health badge. A ✅ **Healthy** badge means all replicas are in-sync. Click any column header to sort.',
      highlight: KAFKA.TOPIC_TABLE_WRAP,
      preAction: async (ctx) => {
        await ensureTopicsTab(ctx);
      },
    },

    // Step 3: Search topics
    {
      id: 'te-search',
      title: 'Search Topics',
      description:
        'Type in the **Search** box to filter topics by name in real time. For large clusters with hundreds of topics, this narrows the list instantly — no need to scroll through pages.',
      highlight: KAFKA.TOPIC_SEARCH,
      preAction: async (ctx) => {
        await ensureTopicsTab(ctx);
        await ctx.fill(KAFKA.TOPIC_SEARCH, 'orders');
        await ctx.delay(400);
      },
    },

    // Step 4: Domain chips
    {
      id: 'te-chips',
      title: 'Domain Chips',
      description:
        'Clear the search — you\'ll see **Domain Chips** generated from topic name prefixes. Clicking a chip (e.g., "orders") filters the table to all `orders.*` topics at once. This groups your topics by business domain automatically.',
      highlight: KAFKA.TOPIC_CHIPBAR,
      preAction: async (ctx) => {
        await ensureTopicsTab(ctx);
        await ctx.fill(KAFKA.TOPIC_SEARCH, '');
        await ctx.delay(300);
      },
    },

    // Step 5: Health and partition filters
    {
      id: 'te-filters',
      title: 'Health & Partition Filters',
      description:
        'The **Health**, **Partition**, and **Retention** dropdowns narrow the list by criteria — for example, show only ⚠️ Degraded topics (ISR fraction < 1) or topics with more than 6 partitions. Combine filters with search for fast operational triage.',
      highlight: KAFKA.TOPIC_FILTER_ROW,
      preAction: async (ctx) => {
        await ensureTopicsTab(ctx);
      },
    },

    // Step 6: Select a topic to open detail panel
    {
      id: 'te-select',
      title: 'Select a Topic',
      description:
        'Click any topic row to open its **Detail Panel** on the right. The panel has four tabs: Messages, Partitions, Consumer Groups, and Config. All data is fetched live from the broker.',
      highlight: KAFKA.TOPIC_TABLE_WRAP,
      preAction: async (ctx) => {
        await ensureTopicsTab(ctx);
        // Clear any search filter so all topics are visible
        const searchInput = document.querySelector<HTMLInputElement>(KAFKA.TOPIC_SEARCH);
        if (searchInput && searchInput.value) {
          await ctx.fill(KAFKA.TOPIC_SEARCH, '');
          await ctx.delay(200);
        }
      },
      action: async (ctx) => {
        const row = document.querySelector<HTMLElement>(
          `${KAFKA.TOPIC_TABLE} tbody tr[style]`,
        );
        if (row) {
          row.click();
        } else {
          await ctx.click(KAFKA.TOPIC_TABLE);
        }
        try { await ctx.waitFor(KAFKA.DETAIL_TABS, 5000); } catch { /* detail may not load */ }
        await ctx.delay(600);
      },
    },

    // Step 7: Metric boxes
    {
      id: 'te-metrics',
      title: 'Partition Metrics',
      description:
        'The four metric boxes at the top of the detail panel summarise **Messages** (estimated total), **Partitions**, **Replication Factor**, and **Consumer Groups**. These are the key capacity numbers you need for capacity planning.',
      highlight: KAFKA.TOPIC_METRICS_ROW,
      preAction: async (ctx) => {
        await ensureTopicSelected(ctx);
      },
    },

    // Step 8: Browse messages inline
    {
      id: 'te-browse',
      title: 'Browse Messages',
      description:
        'Click **Consume Once** to fetch messages from the broker and display them inline. ' +
        'Each row shows the **offset**, **partition**, **timestamp**, **key**, and a **value preview**. ' +
        'Click any row to inspect the full JSON payload, copy the key or value, and see message headers.\n\n' +
        'Use the filters above (Time Window, Key Match, Header Match, JSONPath) to narrow results ' +
        'before consuming — essential for high-volume topics where you need to find specific messages quickly.',
      highlight: KAFKA.DETAIL_CONSUME_BTN,
      preAction: async (ctx) => {
        await ensureTopicSelected(ctx);
        // Ensure we're on the Messages tab
        const messagesTab = document.querySelector<HTMLElement>(KAFKA.DETAIL_TAB_MESSAGES);
        if (messagesTab) messagesTab.click();
        await ctx.delay(300);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.DETAIL_CONSUME_BTN);
        await ctx.delay(2000);

        // If no messages were returned, inject sample data for the demo
        const resultsZone = document.querySelector<HTMLElement>(KAFKA.DETAIL_RESULTS);
        const emptyMsg = resultsZone?.querySelector('.kafka-ms-empty-state');
        if (!resultsZone || emptyMsg) {
          const messagesTab = document.querySelector<HTMLElement>(KAFKA.DETAIL_MESSAGES_TAB);
          if (messagesTab) {
            const actionRow = messagesTab.querySelector('.kafka-ms-action-row');
            let zone = messagesTab.querySelector<HTMLElement>(KAFKA.DETAIL_RESULTS);
            if (!zone) {
              zone = document.createElement('div');
              zone.className = 'kafka-ms-results-zone';
              zone.setAttribute('data-testid', 'detail-results');
              if (actionRow) actionRow.after(zone);
              else messagesTab.appendChild(zone);
            }
            zone.innerHTML = `
              <div class="kafka-ms-results-header">
                <span class="kafka-ms-results-count">5 messages</span>
              </div>
              <div class="kafka-ms-results-table-wrap">
                <table class="kafka-ms-results-table">
                  <thead><tr><th>#</th><th>Offset</th><th>Partition</th><th>Timestamp</th><th>Key</th><th>Value</th></tr></thead>
                  <tbody>
                    <tr style="cursor:pointer"><td>1</td><td>142</td><td>0</td><td>2026-06-17 21:43:12</td><td>user-8291</td><td>{"event":"login","ip":"10.0.1.52","status":"su…</td></tr>
                    <tr style="cursor:pointer"><td>2</td><td>143</td><td>0</td><td>2026-06-17 21:43:14</td><td>user-1037</td><td>{"event":"login","ip":"192.168.4.8","status":"…</td></tr>
                    <tr style="cursor:pointer"><td>3</td><td>87</td><td>1</td><td>2026-06-17 21:43:15</td><td>user-5520</td><td>{"event":"logout","ip":"172.16.0.3","duration"…</td></tr>
                    <tr style="cursor:pointer"><td>4</td><td>88</td><td>1</td><td>2026-06-17 21:43:18</td><td>user-8291</td><td>{"event":"login_failed","ip":"10.0.1.99","reas…</td></tr>
                    <tr style="cursor:pointer"><td>5</td><td>144</td><td>0</td><td>2026-06-17 21:43:20</td><td>user-3344</td><td>{"event":"login","ip":"10.0.2.15","status":"su…</td></tr>
                  </tbody>
                </table>
              </div>`;
            await ctx.delay(800);
          }
        }
      },
    },

    // Step 9: Partition detail tab
    {
      id: 'te-tabs',
      title: 'Partition Details',
      description:
        'Click the **Partitions** tab to see per-partition data: leader broker ID, high-water mark offset, and ISR fraction. An ISR fraction below 1.0 means at least one replica is lagging — a signal worth investigating.',
      highlight: KAFKA.DETAIL_TAB_PARTITIONS,
      preAction: async (ctx) => {
        await ensureTopicSelected(ctx);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.DETAIL_TAB_PARTITIONS);
        try { await ctx.waitFor(KAFKA.DETAIL_PARTITIONS_TAB, 3000); } catch { /* tab content */ }
        await ctx.delay(400);
      },
    },

    // Step 9: Consumer Groups tab
    {
      id: 'te-cg',
      title: 'Consumer Groups',
      description:
        'Click the **Consumer Groups** tab to see every group subscribed to this topic. ' +
        'The table shows three columns:\n\n' +
        '- **Group ID** — the unique identifier of the consumer group\n' +
        '- **State** — `Stable` (all members active), `Rebalancing` (partitions being reassigned), ' +
        'or `Dead` / `Empty` (no active consumers)\n' +
        '- **Total Lag** — the number of messages the group has not yet consumed. A growing lag means ' +
        'consumers are falling behind producers — a critical signal for capacity planning.\n\n' +
        'In a production environment, every topic consumed by a microservice will have at least one ' +
        'consumer group listed here. Watch for **growing lag** (amber) and **Rebalancing** state — ' +
        'both signal that consumers need attention.',
      highlight: KAFKA.DETAIL_TAB_GROUPS,
      preAction: async (ctx) => {
        await ensureTopicSelected(ctx);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.DETAIL_TAB_GROUPS);
        try { await ctx.waitFor(KAFKA.DETAIL_GROUPS_TAB, 3000); } catch { /* tab content */ }
        await ctx.delay(400);

        // If no real consumer groups exist, inject sample data for the demo
        const groupsTab = document.querySelector<HTMLElement>(KAFKA.DETAIL_GROUPS_TAB);
        const emptyState = groupsTab?.querySelector('.kafka-ms-empty-state');
        if (groupsTab && emptyState) {
          groupsTab.innerHTML = `
            <table class="kafka-consumer-group-table">
              <thead><tr><th>Group ID</th><th>State</th><th>Total Lag</th></tr></thead>
              <tbody>
                <tr>
                  <td>order-processing-svc</td>
                  <td><span class="kafka-cg-state-badge kafka-cg-state-green">Stable</span></td>
                  <td class="kafka-lag-green">0</td>
                </tr>
                <tr>
                  <td>analytics-pipeline</td>
                  <td><span class="kafka-cg-state-badge kafka-cg-state-green">Stable</span></td>
                  <td class="kafka-lag-amber">1,247</td>
                </tr>
                <tr>
                  <td>audit-archiver</td>
                  <td><span class="kafka-cg-state-badge kafka-cg-state-amber">Rebalancing</span></td>
                  <td class="kafka-lag-amber">8,503</td>
                </tr>
                <tr>
                  <td>notification-fanout</td>
                  <td><span class="kafka-cg-state-badge kafka-cg-state-green">Stable</span></td>
                  <td class="kafka-lag-green">12</td>
                </tr>
                <tr>
                  <td>legacy-sync-bridge</td>
                  <td><span class="kafka-cg-state-badge kafka-cg-state-grey">Empty</span></td>
                  <td class="kafka-lag-amber">34,891</td>
                </tr>
              </tbody>
            </table>`;
          await ctx.delay(800);
        }
      },
    },
  ],
};
