/**
 * WF-8 — Protocol Nodes Overview
 *
 * 4 steps: palette tour of protocol blocks → add Kafka Produce and inspect config →
 * build a multi-protocol workflow (HTTP → Kafka → WS → GQL) → concept diagram
 * linking to deep-dive lessons in the Protocols domain.
 *
 * Prerequisite: seeded workflow with Start → HTTP (GET /posts/1).
 * This lesson is purely exploratory — no real Kafka/WS/GQL endpoints needed.
 */
import type { DemoActionContext, DemoLesson } from '../../types';
import { WF } from '@shared/selectors';
import { showSpotlightRing } from '../../demoRipple';
import {
  collapseWfDemoAppSidebar,
  openWfNodeConfigModal,
  closeWfConfigModalIfOpen,
  cleanupWorkflowDemoRunUi,
  resetWfPaletteToBlocks,
  revealPaletteBlock,
  ensureLessonWorkflowShown,
} from '../wf-demo-helpers';
import {
  deleteWorkflowByName,
  seedNamedWorkflow,
  waitForWorkflowBridge,
  addWorkflowNodeWithPreset,
  connectWorkflowNodes,
  fitWorkflowCanvasView,
} from '../../adapters';

// ─── Constants ──────────────────────────────────────────────────────

const WF_NAME = 'Protocol Nodes Demo';
const BASE_URL = 'https://jsonplaceholder.typicode.com';

const HTTP_ID = 'wf8-http-get';
const KAFKA_ID = 'wf8-kafka-produce';
const WS_ID = 'wf8-ws-connect';
const GQL_ID = 'wf8-gql-query';

const SEED_WORKFLOW = {
  name: WF_NAME,
  nodes: [
    { id: 'start-1', type: 'start', position: { x: 80, y: 200 }, data: { label: 'Start' } },
    {
      id: HTTP_ID,
      type: 'http',
      position: { x: 280, y: 200 },
      data: {
        label: 'Get Post',
        scenario: {
          id: 'wf8-get-scenario',
          name: 'Get Post',
          url: `${BASE_URL}/posts/1`,
          method: 'GET',
          headers: [],
          body: '',
          auth: { type: 'none' },
          validation: { mode: 'none' },
          extractions: [],
        },
        timeoutSec: 0,
      },
    },
  ],
  edges: [{ id: 'e-start-http', source: 'start-1', target: HTTP_ID }],
  variables: {},
};

// Protocol chip badges to click in Step 1 (Actions category filter)
const PROTOCOL_CHIPS: { id: string; label: string }[] = [
  { id: 'kafka', label: 'Kafka' },
  { id: 'websocket', label: 'WebSocket' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'grpc', label: 'gRPC' },
];

// ─── Helpers ────────────────────────────────────────────────────────

let activeCleanup: (() => void) | null = null;

function spotlight(el: HTMLElement, holdMs: number, ctx: DemoActionContext): Promise<void> {
  activeCleanup?.();
  activeCleanup = null;
  if (!el.closest('.react-flow')) {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  const remove = showSpotlightRing(el);
  activeCleanup = remove;
  return ctx.delay(holdMs).then(() => { remove(); if (activeCleanup === remove) activeCleanup = null; });
}

function fitCanvasCentered(): void {
  const btn = document.querySelector<HTMLElement>(WF.FIT_VIEW_BTN);
  if (btn) { btn.click(); return; }
  fitWorkflowCanvasView();
}

async function ensureSeededWorkflow(ctx: DemoActionContext): Promise<void> {
  ctx.navigateToTab('workflow');
  await ctx.delay(200);
  await waitForWorkflowBridge(ctx);

  const state = await ensureLessonWorkflowShown(ctx, WF_NAME);
  if (state !== 'missing') {
    // Only re-fit when we actually SWITCHED to this lesson's workflow from a
    // different one. When it's already shown ('ready'), the canvas is exactly where
    // the previous step left it — re-fitting every step causes visible jumping.
    if (state === 'selected') {
      fitCanvasCentered();
      await ctx.delay(400);
    }
    return;
  }

  await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
  await ctx.delay(600);
  fitCanvasCentered();
  await ctx.delay(500);
}

// ─── Lesson ─────────────────────────────────────────────────────────

export const wfProtocolNodesLesson: DemoLesson = {
  id: 'wf-protocol-nodes',
  domainId: 'workflow',
  category: 'tooling',
  name: 'Protocol Nodes Overview',
  description:
    'Tour the protocol-specific workflow blocks — Kafka, gRPC, WebSocket, GraphQL — ' +
    'and see how one workflow can orchestrate across multiple protocols.',
  estimatedMinutes: 4,
  initialTab: 'workflow',
  allowedTabs: ['workflow'],

  concept: {
    title: 'Multi-Protocol Workflow Orchestration',
    body:
      'The Workflow Designer palette includes full-featured nodes for **four protocols** ' +
      'beyond HTTP: **Kafka**, **gRPC**, **WebSocket**, and **GraphQL**. These are not ' +
      'thin wrappers — each has its own config form, connection settings, and schema support.\n\n' +
      '**Key concepts:**\n' +
      '- **Kafka** — Produce, Consume, Trigger, and Wait nodes for event-driven messaging\n' +
      '- **gRPC** — Unary calls, Server Streams, and Assert nodes for RPC-based services\n' +
      '- **WebSocket** — Connect, Send, Receive, and Trigger for real-time bidirectional comms\n' +
      '- **GraphQL** — Query, Mutation, Subscription, Introspect, and Assert for API operations\n\n' +
      'Protocol blocks are mixed into the palette\'s functional categories (**Actions**, ' +
      '**Triggers**, **Logic**) alongside HTTP — not in a separate group. This means you can ' +
      'build a single workflow that chains HTTP → Kafka → WebSocket → GraphQL seamlessly.\n\n' +
      '**In this lesson:** A quick tour of protocol blocks in the palette, a close-up of ' +
      'Kafka Produce\'s config form, and a multi-protocol workflow that ties them together.',
    keyTerms: [
      { term: 'Protocol Node', definition: 'A workflow block specialized for a specific protocol (Kafka, gRPC, WS, GQL) with its own config form and semantics.' },
      { term: 'Multi-Protocol Workflow', definition: 'A single workflow that orchestrates actions across different protocols — e.g. HTTP → Kafka → WebSocket in one flow.' },
      { term: 'Kafka Produce', definition: 'Publishes a message to a Kafka topic with configurable key, partition, headers, and body template.' },
      { term: 'gRPC Unary', definition: 'Makes a single request-response gRPC call with target, service, method, and metadata config.' },
      { term: 'WS Connect', definition: 'Opens a WebSocket connection with URL, headers, and connection ID for subsequent Send/Receive nodes.' },
    ],
    diagram: `<svg viewBox="0 0 520 100" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="38" width="50" height="24" rx="5" fill="#1e293b" stroke="#3b82f6" stroke-width="1.5"/>
      <text x="30" y="54" text-anchor="middle" fill="#3b82f6" font-size="7" font-weight="600">Start</text>
      <path d="M60 50 L90 50" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf8arr)"/>
      <rect x="95" y="34" width="70" height="32" rx="6" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/>
      <text x="130" y="48" text-anchor="middle" fill="#10b981" font-size="6.5" font-weight="600">HTTP</text>
      <text x="130" y="58" text-anchor="middle" fill="#94a3b8" font-size="5">GET /posts/1</text>
      <path d="M170 50 L200 50" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf8arr)"/>
      <rect x="205" y="34" width="70" height="32" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>
      <text x="240" y="48" text-anchor="middle" fill="#f59e0b" font-size="6.5" font-weight="600">Kafka</text>
      <text x="240" y="58" text-anchor="middle" fill="#94a3b8" font-size="5">Produce Event</text>
      <path d="M280 50 L310 50" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf8arr)"/>
      <rect x="315" y="34" width="70" height="32" rx="6" fill="#1e293b" stroke="#8b5cf6" stroke-width="1.5"/>
      <text x="350" y="48" text-anchor="middle" fill="#8b5cf6" font-size="6.5" font-weight="600">WebSocket</text>
      <text x="350" y="58" text-anchor="middle" fill="#94a3b8" font-size="5">Open Socket</text>
      <path d="M390 50 L420 50" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#wf8arr)"/>
      <rect x="425" y="34" width="70" height="32" rx="6" fill="#1e293b" stroke="#ec4899" stroke-width="1.5"/>
      <text x="460" y="48" text-anchor="middle" fill="#ec4899" font-size="6.5" font-weight="600">GraphQL</text>
      <text x="460" y="58" text-anchor="middle" fill="#94a3b8" font-size="5">Query Data</text>
      <defs><marker id="wf8arr" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
        <polygon points="0 0, 7 2.5, 0 5" fill="#94a3b8"/></marker></defs>
    </svg>`,
  },

  setup: async (ctx) => {
    ctx.navigateToTab('workflow');
    await ctx.delay(200);
    resetWfPaletteToBlocks();
    await waitForWorkflowBridge(ctx);
    deleteWorkflowByName(WF_NAME);
    await ctx.delay(300);
    await seedNamedWorkflow(ctx, WF_NAME, SEED_WORKFLOW as Record<string, unknown>);
    await ctx.delay(600);
    fitCanvasCentered();
    await ctx.delay(500);
    await collapseWfDemoAppSidebar(ctx);
  },

  cleanup: async (ctx) => {
    await closeWfConfigModalIfOpen(ctx);
    await cleanupWorkflowDemoRunUi(ctx);
    deleteWorkflowByName(WF_NAME);
    await collapseWfDemoAppSidebar(ctx);
    await ctx.delay(100);
  },

  steps: [
    // ── Step 1: Protocol Blocks in the Palette ──────────────────────
    {
      id: 'wf8-palette-tour',
      title: 'Protocol Blocks in the Palette',
      description:
        'The palette\'s **Actions** category contains protocol-specific blocks alongside HTTP. ' +
        'Each protocol has multiple node types:\n\n' +
        '- **Kafka** — Produce, Consume, Trigger, Wait (4 blocks)\n' +
        '- **gRPC** — Unary, Server Stream, Assert (3 blocks)\n' +
        '- **WebSocket** — Connect, Send, Receive, Trigger (4 blocks)\n' +
        '- **GraphQL** — Query, Mutation, Subscription, Introspect, Assert (5 blocks)\n\n' +
        'These are **full-featured nodes** — each has its own config form with ' +
        'protocol-specific fields (topics, methods, schemas, connection IDs). ' +
        'Watch the spotlight scroll through one representative block from each protocol.',
      highlight: WF.PALETTE,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await closeWfConfigModalIfOpen(ctx);
        resetWfPaletteToBlocks();
      },

      action: async (ctx) => {
        // Ensure the Actions category is active (contains protocol chips)
        const actionsRail = document.querySelector<HTMLElement>('[data-testid="wf-palette-rail-actions"]');
        if (actionsRail) {
          actionsRail.click();
          await ctx.delay(600);
        }

        // Spotlight the chips bar area
        const chipsBar = document.querySelector<HTMLElement>('.wf-palette-chips');
        if (chipsBar) await spotlight(chipsBar, 1200, ctx);

        // Click through each protocol badge — viewer sees filtered blocks per protocol
        for (const proto of PROTOCOL_CHIPS) {
          const chip = document.querySelector<HTMLElement>(`[data-testid="wf-palette-chip-${proto.id}"]`);
          if (chip) {
            chip.click();
            await ctx.delay(400);
            await spotlight(chip, 1400, ctx);
          }
        }

        // Reset back to "All" so the full palette is visible for subsequent steps
        const firstChip = document.querySelector<HTMLElement>('.wf-palette-chips .wf-palette-chip');
        if (firstChip && firstChip.textContent?.trim() === 'All') {
          firstChip.click();
          await ctx.delay(400);
        }
      },

      verify: WF.PALETTE,
    },

    // ── Step 2: Add a Kafka Produce Node ─────────────────────────────
    {
      id: 'wf8-kafka-node',
      title: 'Add a Kafka Produce Node',
      description:
        'Click **Kafka Produce** to place it on the canvas and open its config. ' +
        'Compare with HTTP\'s URL + Method layout — Kafka has:\n\n' +
        '- **Cluster ID** — which Kafka cluster to connect to\n' +
        '- **Topic** — the destination topic name\n' +
        '- **Key Template** — partition routing key\n' +
        '- **Headers** — key-value metadata on the message\n' +
        '- **Body Template** — the message payload (supports `{{variables}}`)\n\n' +
        'Each protocol\'s config form reflects its native semantics — ' +
        'gRPC has Target/Service/Method, WebSocket has URL/Connection ID, ' +
        'GraphQL has Operation/Variables/Headers sub-tabs.',
      highlight: WF.PAL_KAFKA_PRODUCE,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await closeWfConfigModalIfOpen(ctx);
        resetWfPaletteToBlocks();
        // Remove Kafka node if it was left from a previous run
        if (document.querySelector(WF.NODE_KAFKA_PRODUCE)) return;
      },

      action: async (ctx) => {
        // Spotlight the Kafka Produce palette block
        const kafkaBlock = await revealPaletteBlock(ctx, WF.PAL_KAFKA_PRODUCE);
        if (kafkaBlock) {
          await spotlight(kafkaBlock, 1200, ctx);
        }

        // Add → connect → fit view → configure
        addWorkflowNodeWithPreset('kafkaProduce', KAFKA_ID, 'Publish Event', { x: 520, y: 200 });
        await ctx.delay(800);

        connectWorkflowNodes(HTTP_ID, KAFKA_ID);
        await ctx.delay(600);

        fitCanvasCentered();
        await ctx.delay(800);

        // Open its config modal to show the Kafka-specific form
        await openWfNodeConfigModal(ctx, { nodeSelector: WF.NODE_KAFKA_PRODUCE });
        await ctx.delay(1000);

        const configBody = document.querySelector<HTMLElement>('.wf-config-body');
        if (configBody) {
          await spotlight(configBody, 2000, ctx);
        }

        await closeWfConfigModalIfOpen(ctx);
        await ctx.delay(600);
      },

      verify: WF.NODE_KAFKA_PRODUCE,
    },

    // ── Step 3: Multi-Protocol Orchestration ─────────────────────────
    {
      id: 'wf8-multi-protocol',
      title: 'Multi-Protocol Orchestration',
      description:
        'Now let\'s build a workflow that chains **four different protocols** in a single flow:\n\n' +
        '**Start → HTTP** (Get Post) **→ Kafka** (Publish Event) **→ WebSocket** (Open Socket) **→ GraphQL** (Fetch Data)\n\n' +
        'Each node can pass data downstream using `{{variables}}` — the HTTP response feeds the ' +
        'Kafka message, which triggers a WebSocket notification, followed by a GraphQL query. ' +
        'This is the power of multi-protocol orchestration: one workflow, multiple protocols, ' +
        'seamless data flow.',

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await closeWfConfigModalIfOpen(ctx);
        // Ensure Kafka exists and is connected (user may have skipped Step 2)
        if (!document.querySelector(WF.NODE_KAFKA_PRODUCE)) {
          addWorkflowNodeWithPreset('kafkaProduce', KAFKA_ID, 'Publish Event', { x: 520, y: 200 });
          await ctx.delay(400);
        }
        connectWorkflowNodes(HTTP_ID, KAFKA_ID);
        await ctx.delay(200);
      },

      action: async (ctx) => {
        // WS: highlight palette block → add → connect → fit → spotlight canvas node
        const wsBlock = await revealPaletteBlock(ctx, WF.PAL_WS_CONNECT);
        if (wsBlock) await spotlight(wsBlock, 1200, ctx);

        addWorkflowNodeWithPreset('wsConnect', WS_ID, 'Open Socket', { x: 760, y: 200 });
        await ctx.delay(800);
        connectWorkflowNodes(KAFKA_ID, WS_ID);
        await ctx.delay(600);
        fitCanvasCentered();
        await ctx.delay(800);

        const wsNode = document.querySelector<HTMLElement>(WF.NODE_WS_CONNECT);
        if (wsNode) await spotlight(wsNode, 1200, ctx);

        // GQL: highlight palette block → add → connect → fit → spotlight canvas node
        const gqlBlock = await revealPaletteBlock(ctx, WF.PAL_GQL_QUERY);
        if (gqlBlock) await spotlight(gqlBlock, 1200, ctx);

        addWorkflowNodeWithPreset('graphqlQuery', GQL_ID, 'Fetch Data', { x: 1000, y: 200 });
        await ctx.delay(800);
        connectWorkflowNodes(WS_ID, GQL_ID);
        await ctx.delay(600);
        fitCanvasCentered();
        await ctx.delay(800);

        const gqlNode = document.querySelector<HTMLElement>(WF.NODE_GQL_QUERY);
        if (gqlNode) await spotlight(gqlNode, 1200, ctx);
      },

      verify: WF.NODE_GQL_QUERY,
    },

    // ── Step 4: Where to Learn More ──────────────────────────────────
    {
      id: 'wf8-deep-dive-links',
      title: 'Where to Learn More',
      description:
        'Each protocol has **dedicated deep-dive lessons** in the **Protocols** domain ' +
        'of the Learning Hub:\n\n' +
        '- **Kafka** — producing messages, consuming with filters, headers, templates, and workflow integration\n' +
        '- **gRPC** — unary calls, server streams, TLS, proto management, and workflow integration\n' +
        '- **WebSocket** — connect, send, receive, triggers, and workflow integration\n' +
        '- **GraphQL** — queries, mutations, subscriptions, variables, and workflow integration\n\n' +
        'This lesson gave you the **big picture** — protocol nodes exist, they have rich configs, ' +
        'and they chain together seamlessly. Head to the Protocols domain for hands-on ' +
        'practice with each protocol.',

      diagram: `<svg viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg">
        <text x="200" y="16" text-anchor="middle" fill="#f1f5f9" font-size="9" font-weight="700">Protocol Deep-Dive Lessons</text>
        <line x1="60" y1="24" x2="340" y2="24" stroke="#3b4a60" stroke-width="0.5"/>

        <rect x="20" y="38" width="160" height="56" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-width="1.2"/>
        <text x="100" y="55" text-anchor="middle" fill="#f59e0b" font-size="8" font-weight="600">Kafka</text>
        <text x="100" y="68" text-anchor="middle" fill="#94a3b8" font-size="5.5">Produce · Consume · Filters</text>
        <text x="100" y="79" text-anchor="middle" fill="#94a3b8" font-size="5.5">Headers · Templates · Workflows</text>
        <text x="100" y="90" text-anchor="middle" fill="#64748b" font-size="5">Protocols → Kafka</text>

        <rect x="220" y="38" width="160" height="56" rx="8" fill="#1e293b" stroke="#3b82f6" stroke-width="1.2"/>
        <text x="300" y="55" text-anchor="middle" fill="#3b82f6" font-size="8" font-weight="600">gRPC</text>
        <text x="300" y="68" text-anchor="middle" fill="#94a3b8" font-size="5.5">Unary · Streams · TLS · Proto</text>
        <text x="300" y="79" text-anchor="middle" fill="#94a3b8" font-size="5.5">Assert · Mock · Workflows</text>
        <text x="300" y="90" text-anchor="middle" fill="#64748b" font-size="5">Protocols → gRPC</text>

        <rect x="20" y="110" width="160" height="56" rx="8" fill="#1e293b" stroke="#8b5cf6" stroke-width="1.2"/>
        <text x="100" y="127" text-anchor="middle" fill="#8b5cf6" font-size="8" font-weight="600">WebSocket</text>
        <text x="100" y="140" text-anchor="middle" fill="#94a3b8" font-size="5.5">Connect · Send · Receive · Trigger</text>
        <text x="100" y="151" text-anchor="middle" fill="#94a3b8" font-size="5.5">Workflow Builder · Runner</text>
        <text x="100" y="162" text-anchor="middle" fill="#64748b" font-size="5">Protocols → WebSocket</text>

        <rect x="220" y="110" width="160" height="56" rx="8" fill="#1e293b" stroke="#ec4899" stroke-width="1.2"/>
        <text x="300" y="127" text-anchor="middle" fill="#ec4899" font-size="8" font-weight="600">GraphQL</text>
        <text x="300" y="140" text-anchor="middle" fill="#94a3b8" font-size="5.5">Query · Mutation · Subscription</text>
        <text x="300" y="151" text-anchor="middle" fill="#94a3b8" font-size="5.5">Variables · Introspect · Workflows</text>
        <text x="300" y="162" text-anchor="middle" fill="#64748b" font-size="5">Protocols → GraphQL</text>
      </svg>`,

      preAction: async (ctx) => {
        await ensureSeededWorkflow(ctx);
        await closeWfConfigModalIfOpen(ctx);
        // Ensure all protocol nodes exist (user may have skipped Steps 2-3)
        if (!document.querySelector(WF.NODE_KAFKA_PRODUCE)) {
          addWorkflowNodeWithPreset('kafkaProduce', KAFKA_ID, 'Publish Event', { x: 520, y: 200 });
          await ctx.delay(200);
        }
        if (!document.querySelector(WF.NODE_WS_CONNECT)) {
          addWorkflowNodeWithPreset('wsConnect', WS_ID, 'Open Socket', { x: 760, y: 200 });
          await ctx.delay(200);
        }
        if (!document.querySelector(WF.NODE_GQL_QUERY)) {
          addWorkflowNodeWithPreset('graphqlQuery', GQL_ID, 'Fetch Data', { x: 1000, y: 200 });
          await ctx.delay(200);
        }
        connectWorkflowNodes(HTTP_ID, KAFKA_ID);
        connectWorkflowNodes(KAFKA_ID, WS_ID);
        connectWorkflowNodes(WS_ID, GQL_ID);
      },

      action: async (ctx) => {
        // Fit View to show the full multi-protocol chain
        fitCanvasCentered();
        await ctx.delay(1200);
      },

      verify: WF.CANVAS,
    },
  ],
};
