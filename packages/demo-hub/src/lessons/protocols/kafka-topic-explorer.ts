/** Lesson K6: Topic Explorer — browse topics, partitions, and consumer group lag */
import type { DemoLesson, DemoActionContext } from '../../types';
import { kafkaPublishSetup, kafkaCleanup, preparePlaintextKafkaStudio } from '../setup-helpers';
import { KAFKA } from '@shared/selectors';
import { dispatchKafkaOperation } from '@shared/kafka/kafkaClient';

const TOPIC_ROW_SELECTOR = `${KAFKA.TOPIC_TABLE} tbody tr[style]`;

/** Get the active cluster ID from the server connection state. */
async function getActiveClusterId(): Promise<string | null> {
  try {
    const status = await dispatchKafkaOperation<{ state: string; clusterId?: string }>('status');
    if (status.data?.state === 'connected' && status.data.clusterId) {
      return status.data.clusterId;
    }
  } catch { /* server not running */ }
  return null;
}

/** Seed sample messages into audit.login so the detail panel has data to show. */
async function seedAuditLoginMessages(): Promise<void> {
  const clusterId = await getActiveClusterId();
  if (!clusterId) return;

  const messages = [
    { key: 'user-1001', value: JSON.stringify({ userId: 1001, action: 'login', ip: '192.168.1.42', browser: 'Chrome/126', ts: new Date().toISOString() }), headers: { source: 'web-app', region: 'us-east-1' } },
    { key: 'user-2045', value: JSON.stringify({ userId: 2045, action: 'login', ip: '10.0.3.88', browser: 'Firefox/125', ts: new Date().toISOString() }), headers: { source: 'mobile-api', region: 'eu-west-1' } },
    { key: 'user-3120', value: JSON.stringify({ userId: 3120, action: 'login_failed', ip: '172.16.0.5', reason: 'invalid_password', ts: new Date().toISOString() }), headers: { source: 'web-app', region: 'us-west-2' } },
  ];

  try {
    await dispatchKafkaOperation('produce', { clusterId, topic: 'audit.login', messages });
  } catch { /* broker may not be running */ }
}

/** Ensure the Topics tab is active and topics are loaded. Idempotent. */
async function ensureTopicsTab(ctx: DemoActionContext): Promise<void> {
  if (document.querySelector(TOPIC_ROW_SELECTOR)) return;

  await ctx.click(KAFKA.TOPICS_TAB);
  try {
    await ctx.waitFor(TOPIC_ROW_SELECTOR, 4000);
  } catch {
    try { await ctx.waitFor(KAFKA.TOPIC_TABLE, 1500); } catch { /* may not appear */ }
  }
  await ctx.delay(200);
}

/** Set Topic Explorer Messages time window via the CustomSelect control. */
async function setDetailTimeWindow(ctx: DemoActionContext, label: string): Promise<void> {
  const trigger = document.querySelector<HTMLElement>(
    `${KAFKA.DETAIL_TIME_WINDOW} .cs-trigger, ${KAFKA.DETAIL_MESSAGES_TAB} [data-testid="detail-time-window"] .cs-trigger`,
  ) ?? document.querySelector<HTMLElement>('[data-testid="detail-time-window"] .cs-trigger');
  if (!trigger) return;
  if (trigger.textContent?.includes(label)) return;
  trigger.click();
  await ctx.delay(250);
  const menu = document.querySelector<HTMLElement>('.cs-menu');
  if (!menu) return;
  for (const item of menu.querySelectorAll<HTMLElement>('.cs-item')) {
    if (item.textContent?.includes(label)) {
      item.click();
      await ctx.delay(250);
      return;
    }
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
  estimatedMinutes: 7,
  initialTab: 'kafka-message-studio',
  allowedTabs: ['kafka-message-studio'],

  dockerEndpoint: 'http://localhost:18080',
  dockerCommand: 'cd docker/kafka/plaintext && docker compose up -d',
  tag: '🐳 Docker',

  // Connect + seed before Message Studio mounts so Preparing stays short.
  // Do NOT open Topics here — step 1 (te-intro) teaches that click.
  prepareBeforeNavigate: async () => {
    await preparePlaintextKafkaStudio();
    await seedAuditLoginMessages();
  },

  setup: async (ctx) => {
    // Idempotent belt for Restart — quiet connect, land on Publish (default).
    // Avoid polling for topic rows: they only exist after Topics is clicked.
    await kafkaPublishSetup(ctx);
    await seedAuditLoginMessages();
    for (let i = 0; i < 6; i++) {
      if (!document.querySelector('.kafka-studio-guard')) break;
      await ctx.delay(80);
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
      preAction: async () => {
        document.querySelectorAll('.kafka-explorer-topic-table tbody tr.selected').forEach((el) => {
          el.classList.remove('selected');
        });
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.TOPICS_TAB);
        await ctx.delay(800);
        await ctx.waitFor(KAFKA.TOPICS_TAB, 3000);
        await ctx.delay(600);
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
        'Type `orders` in the **Search** box to filter topics by name in real time. Watch the list narrow to only `orders.*` topics — each one highlighted below. For large clusters with hundreds of topics, this finds what you need instantly.',
      highlight: KAFKA.TOPIC_SEARCH,
      preAction: async (ctx) => {
        await ensureTopicsTab(ctx);
        // Clear search first so the action shows the filtering visually
        await ctx.fill(KAFKA.TOPIC_SEARCH, '');
        await ctx.delay(200);
      },
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        // 1. Spotlight search input and type the query
        const searchEl = document.querySelector<HTMLElement>(KAFKA.TOPIC_SEARCH);
        if (searchEl) {
          searchEl.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(searchEl);
          await ctx.delay(800);
          rm();
        }
        await ctx.fill(KAFKA.TOPIC_SEARCH, 'orders');
        await ctx.delay(800);

        // 2. Spotlight the entire filtered topic table
        const tableWrap = document.querySelector<HTMLElement>(KAFKA.TOPIC_TABLE_WRAP);
        if (tableWrap) {
          const rm2 = showSpotlightRing(tableWrap);
          await ctx.delay(2000);
          rm2();
        }
      },
    },

    // Step 4: Domain chips
    {
      id: 'te-chips',
      title: 'Domain Chips',
      description:
        'Domain Chips are auto-generated from topic name prefixes. Watch as the **orders** chip is clicked — the table instantly filters to only `orders.*` topics. Then **All** is clicked to restore the full list. This groups your topics by business domain automatically.',
      highlight: KAFKA.TOPIC_CHIPBAR,
      preAction: async (ctx) => {
        await ensureTopicsTab(ctx);
        await ctx.fill(KAFKA.TOPIC_SEARCH, '');
        await ctx.delay(300);
        // Reset to "All" chip so the demo starts from unfiltered state
        const allChip = document.querySelector<HTMLElement>('.kafka-topic-chip.active');
        if (allChip && allChip.textContent?.trim() !== 'All') {
          const all = document.querySelector<HTMLElement>('.kafka-topic-chip');
          if (all) { all.click(); await ctx.delay(200); }
        }
      },
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        // 1. Find and spotlight the "orders" chip
        const chips = document.querySelectorAll<HTMLElement>('.kafka-topic-chip');
        let ordersChip: HTMLElement | null = null;
        for (const chip of chips) {
          if (chip.textContent?.trim() === 'orders') { ordersChip = chip; break; }
        }

        if (ordersChip) {
          ordersChip.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(ordersChip);
          await ctx.delay(1000);
          rm();

          // 2. Click the "orders" chip — table filters
          ordersChip.click();
          await ctx.delay(1200);

          // 3. Spotlight the filtered results so viewer sees the narrowed list
          const tableWrap = document.querySelector<HTMLElement>(KAFKA.TOPIC_TABLE_WRAP);
          if (tableWrap) {
            const rm2 = showSpotlightRing(tableWrap);
            await ctx.delay(1500);
            rm2();
          }

          // 4. Click "All" to restore full list
          const allChip = document.querySelector<HTMLElement>('.kafka-topic-chip');
          if (allChip) {
            const rm3 = showSpotlightRing(allChip);
            await ctx.delay(800);
            rm3();
            allChip.click();
            await ctx.delay(600);
          }
        }
      },
    },

    // Step 5: Health and partition filters
    {
      id: 'te-filters',
      title: 'Health & Partition Filters',
      description:
        'The **Partition** filter is always available — watch it filter to topics with only 1–4 partitions. ' +
        '**Health** and **Retention** become active after you select a topic (the broker fetches detail data). ' +
        'Combine these filters with search and domain chips for fast operational triage.',
      highlight: KAFKA.TOPIC_FILTER_ROW,
      preAction: async (ctx) => {
        await ensureTopicsTab(ctx);
        // Reset domain chip to All if needed
        const activeChip = document.querySelector<HTMLElement>('.kafka-topic-chip.active');
        if (activeChip && activeChip.textContent?.trim() !== 'All') {
          const all = document.querySelector<HTMLElement>('.kafka-topic-chip');
          if (all) { all.click(); await ctx.delay(200); }
        }
      },
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        // 1. Spotlight the Partition filter (always enabled)
        const partFilter = document.querySelector<HTMLElement>(KAFKA.TOPIC_PARTITION_FILTER);
        if (partFilter) {
          const rm1 = showSpotlightRing(partFilter);
          await ctx.delay(1000);
          rm1();

          // 2. Open dropdown and select "1–4"
          const trigger = partFilter.querySelector<HTMLElement>('.cs-trigger');
          if (trigger) {
            trigger.click();
            await ctx.delay(600);
            const menu = partFilter.querySelector<HTMLElement>('.cs-menu');
            if (menu) {
              const items = menu.querySelectorAll<HTMLElement>('.cs-item');
              for (const item of items) {
                if (item.textContent?.includes('1–4') || item.textContent?.includes('1-4')) {
                  item.click();
                  break;
                }
              }
            }
            await ctx.delay(1200);

            // 3. Spotlight the filtered table
            const tableWrap = document.querySelector<HTMLElement>(KAFKA.TOPIC_TABLE_WRAP);
            if (tableWrap) {
              const rm2 = showSpotlightRing(tableWrap);
              await ctx.delay(1500);
              rm2();
            }

            // 4. Reset partition filter back to "Any"
            const trigger2 = partFilter.querySelector<HTMLElement>('.cs-trigger');
            if (trigger2) {
              trigger2.click();
              await ctx.delay(400);
              const menu2 = partFilter.querySelector<HTMLElement>('.cs-menu');
              if (menu2) {
                const anyOpt = menu2.querySelectorAll<HTMLElement>('.cs-item');
                for (const item of anyOpt) {
                  if (item.textContent?.includes('Any')) {
                    item.click();
                    break;
                  }
                }
              }
              await ctx.delay(600);
            }
          }
        }

        // 5. Spotlight disabled Health filter briefly to show it's not yet available
        const healthFilter = document.querySelector<HTMLElement>(KAFKA.TOPIC_HEALTH_FILTER);
        if (healthFilter) {
          const rm3 = showSpotlightRing(healthFilter);
          await ctx.delay(1000);
          rm3();
        }

        // 6. Spotlight disabled Retention filter briefly
        const retFilter = document.querySelector<HTMLElement>(KAFKA.TOPIC_RETENTION_FILTER);
        if (retFilter) {
          const rm4 = showSpotlightRing(retFilter);
          await ctx.delay(1000);
          rm4();
        }
      },
    },

    // Step 6: Select a topic to open detail panel
    {
      id: 'te-select',
      title: 'Select a Topic',
      description:
        'Click **audit.login** to open its **Detail Panel** on the right. The panel has four tabs — Messages, Partitions, Consumer Groups, and Config — all fetched live from the broker.',
      preAction: async (ctx) => {
        await ensureTopicsTab(ctx);
        // Clear any search filter so all topics are visible
        const searchInput = document.querySelector<HTMLInputElement>(KAFKA.TOPIC_SEARCH);
        if (searchInput && searchInput.value) {
          await ctx.fill(KAFKA.TOPIC_SEARCH, '');
          await ctx.delay(200);
        }
        // Reset domain chip to All
        const activeChip = document.querySelector<HTMLElement>('.kafka-topic-chip.active');
        if (activeChip && activeChip.textContent?.trim() !== 'All') {
          const all = document.querySelector<HTMLElement>('.kafka-topic-chip');
          if (all) { all.click(); await ctx.delay(200); }
        }
      },
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        // 1. Find and spotlight the "audit.login" row
        const rows = document.querySelectorAll<HTMLElement>(
          `${KAFKA.TOPIC_TABLE} tbody tr[style]`,
        );
        let auditRow: HTMLElement | null = null;
        for (const row of rows) {
          const nameCell = row.querySelector<HTMLElement>('.kafka-explorer-topic-name');
          if (nameCell?.textContent?.trim() === 'audit.login') {
            auditRow = row;
            break;
          }
        }

        if (auditRow) {
          auditRow.scrollIntoView({ block: 'nearest' });
          const rm1 = showSpotlightRing(auditRow);
          await ctx.delay(1000);
          rm1();

          // 2. Click the row
          auditRow.click();
        } else {
          // Fallback: click first row
          const first = document.querySelector<HTMLElement>(
            `${KAFKA.TOPIC_TABLE} tbody tr[style]`,
          );
          if (first) first.click();
        }

        try { await ctx.waitFor(KAFKA.DETAIL_TABS, 5000); } catch { /* detail may not load */ }
        await ctx.delay(800);

        // 3. Spotlight the detail panel header (topic name + health badge)
        const detailHeader = document.querySelector<HTMLElement>('.kafka-explorer-detail-header');
        if (detailHeader) {
          const rm2 = showSpotlightRing(detailHeader);
          await ctx.delay(1200);
          rm2();
        }

        // 4. Spotlight the detail tabs
        const detailTabs = document.querySelector<HTMLElement>(KAFKA.DETAIL_TABS);
        if (detailTabs) {
          const rm3 = showSpotlightRing(detailTabs);
          await ctx.delay(1200);
          rm3();
        }
      },
    },

    // Step 7: Collapse/Expand the topic list
    {
      id: 'te-collapse',
      title: 'Focus Mode — Collapse the Topic List',
      description:
        'Click the **◀** divider button between the two panels to collapse the topic list. ' +
        'The detail panel expands to full width — perfect when you want to focus on messages, ' +
        'partitions, or consumer group lag without distraction. Click **▶** to bring the list back.',
      highlight: KAFKA.TOPIC_LIST_COLLAPSE_BTN,
      preAction: async (ctx) => {
        await ensureTopicSelected(ctx);
        // Make sure list is expanded before this step
        const layout = document.querySelector('.kafka-explorer-layout');
        if (layout?.classList.contains('kafka-explorer-layout--collapsed')) {
          const btn = document.querySelector<HTMLElement>(KAFKA.TOPIC_LIST_COLLAPSE_BTN);
          if (btn) { btn.click(); await ctx.delay(400); }
        }
      },
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        // 1. Spotlight the collapse button
        const collapseBtn = document.querySelector<HTMLElement>(KAFKA.TOPIC_LIST_COLLAPSE_BTN);
        if (collapseBtn) {
          collapseBtn.scrollIntoView({ block: 'nearest' });
          const rm = showSpotlightRing(collapseBtn);
          await ctx.delay(1200);
          rm();
        }

        // 2. Click to collapse — viewer sees the list shrink
        await ctx.click(KAFKA.TOPIC_LIST_COLLAPSE_BTN);
        await ctx.delay(1500);

        // 3. Spotlight the expand button so viewer knows how to bring it back
        const expandBtn = document.querySelector<HTMLElement>(KAFKA.TOPIC_LIST_COLLAPSE_BTN);
        if (expandBtn) {
          const rm = showSpotlightRing(expandBtn);
          await ctx.delay(1200);
          rm();
        }

        // 4. Click to expand back — restore normal layout
        await ctx.click(KAFKA.TOPIC_LIST_COLLAPSE_BTN);
        await ctx.delay(800);
      },
    },

    // Step 8: Metric boxes
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
        'The **Messages** browse form lets you pick a time window, partition, filters, max count, **timeout**, and sort order — then click **Consume Once**. ' +
        '**Latest** returns the newest available records (not only brand-new publishes). Filters cover Key, Header, JSONPath, and Body Contains. ' +
        'Watch the results appear inline below.',
      preAction: async (ctx) => {
        await ensureTopicsTab(ctx);
        // Select audit.login specifically (it has seeded messages)
        // Check if already selected to avoid toggling it OFF
        const detailTitle = document.querySelector<HTMLElement>('.kafka-explorer-detail-title');
        const alreadySelected = detailTitle?.textContent?.trim() === 'audit.login';
        if (!alreadySelected) {
          const rows = document.querySelectorAll<HTMLElement>(
            `${KAFKA.TOPIC_TABLE} tbody tr[style]`,
          );
          for (const row of rows) {
            const nameCell = row.querySelector<HTMLElement>('.kafka-explorer-topic-name');
            if (nameCell?.textContent?.trim() === 'audit.login') {
              row.click();
              try { await ctx.waitFor(KAFKA.DETAIL_TABS, 5000); } catch { /* */ }
              break;
            }
          }
        }
        await ctx.delay(300);
        // Ensure Messages tab
        const messagesTab = document.querySelector<HTMLElement>(KAFKA.DETAIL_TAB_MESSAGES);
        if (messagesTab) messagesTab.click();
        await ctx.delay(300);
        // Latest now returns newest available records; Earliest still demos full replay.
        await setDetailTimeWindow(ctx, 'Earliest');

        // Produce fresh messages so consume always has data
        await seedAuditLoginMessages();
      },
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        // 1. Spotlight the browse form (time window, max, timeout, filters)
        const browseForm = document.querySelector<HTMLElement>('[data-testid="detail-messages-filters"]');
        if (browseForm) {
          const rm1 = showSpotlightRing(browseForm, { steady: true });
          await ctx.delay(1500);
          rm1();
        }

        // 2. Spotlight Timeout so viewers see it matches Consume Studio
        const timeoutInput = document.querySelector<HTMLElement>(KAFKA.DETAIL_TIMEOUT);
        if (timeoutInput) {
          const rmT = showSpotlightRing(timeoutInput, { steady: true });
          await ctx.delay(1000);
          rmT();
        }

        // 3. Click Consume Once and wait for real React-managed rows
        await ctx.click(KAFKA.DETAIL_CONSUME_BTN);
        // Wait for real rows (data-testid="detail-row-0" is set by React)
        for (let i = 0; i < 50; i++) {
          if (document.querySelector('[data-testid="detail-row-0"]')) break;
          await ctx.delay(250);
        }
        await ctx.delay(800);

        // 6. Spotlight the results
        const results = document.querySelector<HTMLElement>(KAFKA.DETAIL_RESULTS);
        if (results) {
          const rm4 = showSpotlightRing(results);
          await ctx.delay(1500);
          rm4();
        }
      },
    },

    // Step 9: Click a row to open message detail modal
    {
      id: 'te-msg-detail',
      title: 'Message Detail',
      description:
        'Click any message row to open the **Message Detail** modal — a movable, resizable popup showing the full payload (pretty-printed JSON), key, offset, partition, timestamp, and headers. ' +
        'Use the **Copy** buttons to grab the key or payload instantly.',
      preAction: async (ctx) => {
        await ensureTopicsTab(ctx);

        // Close any open modal from a prior run
        const closeBtn = document.querySelector<HTMLElement>('[data-testid="kmd-close-btn"]');
        if (closeBtn) { closeBtn.click(); await ctx.delay(200); }

        // 1. Select audit.login (check if already selected to avoid toggling OFF)
        const detailTitle = document.querySelector<HTMLElement>('.kafka-explorer-detail-title');
        if (detailTitle?.textContent?.trim() !== 'audit.login') {
          const rows = document.querySelectorAll<HTMLElement>(
            `${KAFKA.TOPIC_TABLE} tbody tr[style]`,
          );
          for (const row of rows) {
            const nameCell = row.querySelector<HTMLElement>('.kafka-explorer-topic-name');
            if (nameCell?.textContent?.trim() === 'audit.login') {
              row.click();
              try { await ctx.waitFor(KAFKA.DETAIL_TABS, 5000); } catch { /* */ }
              await ctx.delay(400);
              break;
            }
          }
        }

        // 2. Ensure Messages tab is active
        const messagesTab = document.querySelector<HTMLElement>(KAFKA.DETAIL_TAB_MESSAGES);
        if (messagesTab) { messagesTab.click(); await ctx.delay(300); }

        // 3. If real React rows already exist, we're good — skip consume
        if (document.querySelector('[data-testid="detail-row-0"]')) return;

        // 4. Prefer Earliest so replay demos always have rows; Latest also works now
        //    (newest-available seek) but Earliest matches the lesson narration.
        await setDetailTimeWindow(ctx, 'Earliest');

        // 5. Produce fresh messages so consume always has data
        await seedAuditLoginMessages();

        // 6. Clear old injected results
        const clearBtn = document.querySelector<HTMLElement>('.kafka-ms-ghost-btn');
        if (clearBtn && clearBtn.textContent?.includes('Clear')) {
          clearBtn.click();
          await ctx.delay(300);
        }

        // 7. Consume and wait for real React-managed rows
        const consumeBtn = document.querySelector<HTMLElement>(KAFKA.DETAIL_CONSUME_BTN);
        if (consumeBtn && !consumeBtn.hasAttribute('disabled')) {
          consumeBtn.click();
          for (let i = 0; i < 50; i++) {
            if (document.querySelector('[data-testid="detail-row-0"]')) break;
            await ctx.delay(250);
          }
        }
      },
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        // 1. Click the first message row
        const firstRow = document.querySelector<HTMLElement>('[data-testid="detail-row-0"]');
        if (firstRow) {
          const rm1 = showSpotlightRing(firstRow);
          await ctx.delay(800);
          rm1();
          firstRow.click();
          await ctx.delay(1000);
        }

        // 2. Spotlight the modal
        const modal = document.querySelector<HTMLElement>('[data-testid="kafka-message-detail-modal"]');
        if (modal) {
          const rm2 = showSpotlightRing(modal);
          await ctx.delay(1500);
          rm2();

          // 3. Spotlight Key section
          const keySection = modal.querySelector<HTMLElement>('[data-testid="kmd-key"]');
          if (keySection) {
            const rm3 = showSpotlightRing(keySection);
            await ctx.delay(1000);
            rm3();
          }

          // 4. Spotlight Body section
          const bodySection = modal.querySelector<HTMLElement>('[data-testid="kmd-body"]');
          if (bodySection) {
            const rm4 = showSpotlightRing(bodySection);
            await ctx.delay(1200);
            rm4();
          }

          // 5. Close the modal
          const closeBtn = modal.querySelector<HTMLElement>('[data-testid="kmd-close-btn"]');
          if (closeBtn) {
            closeBtn.click();
            await ctx.delay(600);
          }
        }
      },
    },

    // Step 10: Partition detail tab
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

    // Step 12: Config tab
    {
      id: 'te-config',
      title: 'Topic Configuration',
      description:
        'Click the **Config** tab to view broker-side topic settings. Key values include:\n\n' +
        '- **retention.ms** — how long messages are kept (e.g., 604800000 = 7 days)\n' +
        '- **cleanup.policy** — `delete` (time-based) or `compact` (key-based dedup)\n' +
        '- **max.message.bytes** — maximum size of a single message\n' +
        '- **compression.type** — `producer`, `gzip`, `snappy`, `lz4`, or `zstd`\n\n' +
        'These settings are read-only here — use the CLI or admin API to change them. ' +
        'Knowing them at a glance helps you debug retention, throughput, and storage issues.',
      highlight: KAFKA.DETAIL_TAB_CONFIG,
      preAction: async (ctx) => {
        await ensureTopicSelected(ctx);
      },
      action: async (ctx) => {
        const { showSpotlightRing } = await import('../../demoRipple');

        await ctx.click(KAFKA.DETAIL_TAB_CONFIG);
        try { await ctx.waitFor(KAFKA.DETAIL_CONFIG_TAB, 3000); } catch { /* tab content */ }
        await ctx.delay(800);

        // Spotlight the config table
        const configTab = document.querySelector<HTMLElement>(KAFKA.DETAIL_CONFIG_TAB);
        if (configTab) {
          const table = configTab.querySelector<HTMLElement>('.kafka-config-table');
          if (table) {
            const rm = showSpotlightRing(table);
            await ctx.delay(2000);
            rm();
          }
        }
      },
    },
  ],
};
