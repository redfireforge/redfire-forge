/**
 * Lesson K11: Secure Cluster (SASL/SCRAM)
 *
 * Walks through creating a SASL/SCRAM-256 authenticated Kafka cluster config,
 * testing the connection, saving it, connecting, and sending a message to confirm
 * the secure cluster is fully functional.
 */
import type { DemoLesson } from '../../types';
import { kafkaSecureSetup, kafkaCleanup } from '../setup-helpers';
import { KAFKA } from '@shared/selectors';

export const kafkaSecureLesson: DemoLesson = {
  id: 'kafka-secure',
  domainId: 'protocols',
  category: 'kafka',
  name: 'Secure Cluster (SASL)',
  description:
    'Configure a SASL/SCRAM-256 authenticated Kafka cluster, test the connection, save, connect, and publish a message — no plain-text traffic.',
  estimatedMinutes: 5,
  initialTab: 'kafka-settings',
  allowedTabs: ['kafka-settings', 'kafka-message-studio'],

  dockerEndpoint: 'http://localhost:19645',
  dockerCommand: 'cd docker/kafka/secure && docker compose up -d',
  tag: '🐳 Docker',

  setup: kafkaSecureSetup,
  cleanup: kafkaCleanup,

  concept: {
    title: 'SASL Authentication for Kafka',
    body: `By default, Kafka clusters allow unauthenticated TCP connections. In production you almost always enable **SASL** (Simple Authentication and Security Layer) to require credentials before accepting connections.

**RedfireForge supports three SASL mechanisms:**
| Mechanism | Description |
|---|---|
| **PLAIN** | Username + password in clear text over TLS. Simple but requires TLS to be safe. |
| **SCRAM-SHA-256** | Password hashing with a challenge-response handshake. Does not expose the password in transit — secure without TLS in a trusted network. |
| **SCRAM-SHA-512** | Same as SCRAM-256 but with a stronger hash. Recommended for high-security deployments. |

**How it works in the Cluster Editor:**
1. Set **Auth Mode** to the desired SASL mechanism
2. Enter **Username** and **Password** — these are stored encrypted in the local settings store
3. Click **Test Connection** — RedfireForge performs the full SASL handshake and reports success or an authentication error
4. Save and Connect

**The demo Docker stack** (\`docker/kafka/secure\`) starts a Redpanda node with SASL enabled on port **19093**. Pre-created users:
- \`redfireforge-app\` / \`app-password\` — standard app user
- \`admin\` / \`admin-password\` — admin user (ACL management)`,
    keyTerms: [
      {
        term: 'SASL',
        definition:
          'Simple Authentication and Security Layer — a framework for adding authentication to network protocols. Kafka uses SASL for broker authentication, supporting multiple mechanisms (PLAIN, SCRAM, GSSAPI, OAUTHBEARER).',
      },
      {
        term: 'SCRAM-SHA-256',
        definition:
          'Salted Challenge Response Authentication Mechanism — a SASL mechanism that uses a challenge-response protocol with a SHA-256 hash. The password is never sent in clear text, making it safe even on unencrypted connections.',
      },
      {
        term: 'Test Connection',
        definition:
          'A one-time authentication check that validates the broker address, port, and credentials without saving or making the cluster active. Use it before saving to confirm the config is correct.',
      },
      {
        term: 'Credentials Storage',
        definition:
          'Username and password entered in the Cluster Editor are stored encrypted in the local settings database (not in plaintext config files or logs).',
      },
    ],
    diagram: `<svg viewBox="0 0 360 130" xmlns="http://www.w3.org/2000/svg">
  <!-- Client box -->
  <rect x="8" y="30" width="110" height="70" rx="5" fill="var(--surface2,#1e1e2e)" stroke="var(--border,#45475a)" stroke-width="1.3"/>
  <text x="63" y="52" text-anchor="middle" fill="var(--text)" font-size="10">RedfireForge</text>
  <text x="63" y="66" text-anchor="middle" fill="var(--text-muted)" font-size="8">credentials →</text>
  <text x="63" y="79" text-anchor="middle" fill="var(--text-muted)" font-size="8">SCRAM-SHA-256</text>
  <text x="63" y="92" text-anchor="middle" fill="var(--text-muted)" font-size="8">handshake</text>
  <!-- Arrow: challenge -->
  <line x1="118" y1="60" x2="190" y2="60" stroke="var(--warning,#fab387)" stroke-width="1.3" stroke-dasharray="4 2" marker-end="url(#sec-a)"/>
  <text x="154" y="55" text-anchor="middle" fill="var(--warning,#fab387)" font-size="7">Challenge</text>
  <!-- Arrow: response -->
  <line x1="190" y1="76" x2="118" y2="76" stroke="var(--success,#a6e3a1)" stroke-width="1.3" stroke-dasharray="4 2" marker-end="url(#sec-b)"/>
  <text x="154" y="90" text-anchor="middle" fill="var(--success,#a6e3a1)" font-size="7">Response (hashed)</text>
  <!-- Broker box -->
  <rect x="192" y="30" width="100" height="70" rx="5" fill="var(--surface2,#1e1e2e)" stroke="var(--primary)" stroke-width="1.3"/>
  <text x="242" y="52" text-anchor="middle" fill="var(--text)" font-size="10">Redpanda</text>
  <text x="242" y="66" text-anchor="middle" fill="var(--text-muted)" font-size="8">:19093</text>
  <text x="242" y="80" text-anchor="middle" fill="var(--success,#a6e3a1)" font-size="8">SASL enabled</text>
  <!-- Lock icon area -->
  <rect x="302" y="48" width="50" height="36" rx="4" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1"/>
  <text x="327" y="63" text-anchor="middle" fill="var(--primary)" font-size="9">🔒</text>
  <text x="327" y="76" text-anchor="middle" fill="var(--text-muted)" font-size="7">No plain</text>
  <defs>
    <marker id="sec-a" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="var(--warning,#fab387)" stroke-width="1.3"/></marker>
    <marker id="sec-b" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto"><path d="M6,0 L0,3 L6,6" fill="none" stroke="var(--success,#a6e3a1)" stroke-width="1.3"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    // Step 1: Navigate to Settings
    {
      id: 'sec-intro',
      title: 'Secure Kafka Cluster',
      description:
        'Time to lock things down. In this lesson you\'ll create a new cluster config for the **SASL/SCRAM-256** secured Kafka node running on port **19093**. Make sure the secure Docker stack is running: `cd docker/kafka/secure && docker compose up -d`.',
      highlight: KAFKA.SETTINGS_PAGE,
      preAction: async () => {
        document.querySelectorAll('.kafka-cluster-card.selected').forEach((el) => {
          el.classList.remove('selected');
        });
      },
      action: async (ctx) => {
        await ctx.waitFor(KAFKA.SETTINGS_PAGE, 3000);
        await ctx.delay(600);
      },
    },

    // Step 2: Create new cluster
    {
      id: 'sec-new',
      title: 'Create Secure Cluster',
      description:
        'Click **New Cluster** (or the + button) to open the Cluster Editor with a blank form. This is where you\'ll configure the broker address and authentication settings.',
      highlight: KAFKA.NEW_CLUSTER_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.NEW_CLUSTER_BTN);
        await ctx.delay(400);
      },
    },

    // Step 3: Set broker and name
    {
      id: 'sec-broker',
      title: 'Set Broker and Name',
      description:
        'Set the **Name** to `Local Secure` (to distinguish it from the plain-text cluster) and the **Broker** to `127.0.0.1:19093`. The Cluster Editor validates the format in real time — no scheme prefix needed.',
      highlight: KAFKA.BROKER_INPUT,
      preAction: async (ctx) => {
        const nameInput = document.querySelector<HTMLInputElement>('input[placeholder*="cluster" i], input[placeholder*="name" i], #kafka-cluster-name');
        if (nameInput) {
          nameInput.focus();
          nameInput.value = '';
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          await ctx.delay(100);
          await ctx.fill('input[placeholder*="cluster" i], input[placeholder*="name" i], #kafka-cluster-name', 'Local Secure');
          await ctx.delay(100);
        }
        await ctx.fill(KAFKA.BROKER_INPUT, '127.0.0.1:19093');
        await ctx.delay(200);
      },
    },

    // Step 4: Enable SCRAM-SHA-256
    {
      id: 'sec-auth',
      title: 'Enable SCRAM-SHA-256',
      description:
        'Open the **Auth Mode** dropdown and select **SCRAM-SHA-256**. This reveals the username and password fields. SCRAM is the right choice for this demo stack — it provides authenticated access without requiring TLS.',
      highlight: KAFKA.AUTH_TYPE_SELECT,
      action: async (ctx) => {
        await ctx.selectOption(KAFKA.AUTH_TYPE_SELECT, 'scram-sha-256');
        await ctx.delay(300);
      },
    },

    // Step 5: Enter credentials
    {
      id: 'sec-creds',
      title: 'Enter Credentials',
      description:
        'Fill in the pre-created credentials: **Username** `redfireforge-app`, **Password** `app-password`. These match the SASL user pre-configured in the secure Docker stack. In a real cluster you\'d use your Kafka admin\'s issued credentials.',
      highlight: KAFKA.AUTH_USER_INPUT,
      preAction: async (ctx) => {
        await ctx.fill(KAFKA.AUTH_USER_INPUT, 'redfireforge-app');
        await ctx.delay(100);
        await ctx.fill(KAFKA.AUTH_PASS_INPUT, 'app-password');
        await ctx.delay(200);
      },
    },

    // Step 6: Test connection
    {
      id: 'sec-test',
      title: 'Test Connection',
      description:
        'Click **Test Connection** to verify the broker is reachable and the credentials are accepted. RedfireForge performs the full SASL handshake and shows a success indicator (green) or an error message (red) — before saving anything.',
      highlight: KAFKA.TEST_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.TEST_BTN);
        await ctx.delay(1500);
      },
    },

    // Step 7: Save and connect
    {
      id: 'sec-save',
      title: 'Save and Connect',
      description:
        'Click **Save** to persist the cluster config, then **Connect** to activate it. The cluster becomes the active cluster in the Studio. A green connected badge appears next to the cluster name in the sidebar.',
      highlight: KAFKA.SAVE_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.SAVE_BTN);
        await ctx.delay(500);
        const connectBtn = document.querySelector<HTMLElement>(KAFKA.CONNECT_BTN);
        if (connectBtn && !(connectBtn as HTMLButtonElement).disabled) {
          connectBtn.click();
          // Wait for Disconnect button to become ENABLED (not just exist in DOM)
          // — indicates the SASL handshake completed and connection is active.
          const start = Date.now();
          while (Date.now() - start < 10000) {
            const dcBtn = document.querySelector<HTMLButtonElement>(KAFKA.DISCONNECT_BTN);
            if (dcBtn && !dcBtn.disabled) break;
            await new Promise(r => setTimeout(r, 200));
          }
          await ctx.delay(400);
        }
      },
    },

    // Step 8: Publish to secure topic
    {
      id: 'sec-publish',
      title: 'Publish to Secure Topic',
      description:
        'Navigate back to the **Publish** tab, set Topic to `secure.demo.orders`, and send a message. This confirms end-to-end: connection → SASL authentication → topic write — all over the secured port 19093.',
      highlight: KAFKA.PUB_SEND_BTN,
      preAction: async (ctx) => {
        ctx.navigateToTab('kafka-message-studio');
        await ctx.delay(500);
        await ctx.click(KAFKA.PUBLISH_TAB);
        await ctx.delay(300);
        await ctx.fill(KAFKA.PUB_TOPIC_INPUT, 'secure.demo.orders');
        await ctx.delay(100);
        await ctx.fill(KAFKA.PUB_BODY_TEXTAREA, '{"secureTest":true,"cluster":"SCRAM-256"}');
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.PUB_SEND_BTN);
        await ctx.waitFor(`${KAFKA.PUB_RESULT}, ${KAFKA.PUB_ERROR}`, 15000);
        await ctx.delay(400);
      },
    },

    // Step 9: Verify result
    {
      id: 'sec-result',
      title: 'Verify Secure Publish',
      description:
        'The **Publish Result** panel shows partition, offset, and timestamp — confirming the message was accepted by the secure broker. If you see an authentication error here, double-check that the Docker stack is running and the credentials match.',
      highlight: KAFKA.PUB_RESULT,
    },
  ],
};
