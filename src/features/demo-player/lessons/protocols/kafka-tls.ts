/**
 * Lesson K12: TLS-Encrypted Cluster
 *
 * Shows how to create a cluster config with TLS enabled (SASL + TLS),
 * how to disable certificate verification for self-signed certs, and
 * how to confirm the encrypted connection works.
 */
import type { DemoLesson } from '../../types';
import { kafkaTlsSetup, kafkaCleanup } from '../setup-helpers';
import { KAFKA } from '../../../../shared/selectors';

export const kafkaTlsLesson: DemoLesson = {
  id: 'kafka-tls',
  domainId: 'protocols',
  category: 'kafka',
  name: 'TLS-Encrypted Cluster',
  description:
    'Add TLS encryption on top of SASL authentication: enable the TLS toggle, skip certificate verification for the self-signed demo cert, and confirm a successful encrypted publish.',
  estimatedMinutes: 5,
  initialTab: 'kafka-settings',
  allowedTabs: ['kafka-settings', 'kafka-message-studio'],

  dockerEndpoint: 'http://localhost:19648',
  dockerCommand: 'cd docker/kafka/tls && docker compose up -d',

  setup: kafkaTlsSetup,
  cleanup: kafkaCleanup,

  concept: {
    title: 'TLS Encryption for Kafka',
    body: `SASL protects **who** can connect. TLS protects **what** travels over the wire — it encrypts the connection so no one can sniff credentials or message payloads in transit.

**TLS in Kafka works like HTTPS:**
1. The broker presents an X.509 certificate during the TLS handshake
2. The client validates the certificate against a trusted CA
3. If valid, an encrypted channel is established
4. All data (including SASL credentials and message payloads) flows over that encrypted channel

**Self-signed certificates (development):**
The demo TLS stack uses a self-signed certificate — one not issued by a public CA. By default, certificate verification will fail for self-signed certs. RedfireForge provides a **Skip Certificate Verification** toggle (\`tls-verify-toggle\`) that disables hostname and CA verification, allowing the TLS handshake to succeed with self-signed certs.

> ⚠️ Skip cert verification only for development/local stacks. Production clusters should use certificates from a trusted CA (or your organisation's internal CA).

**TLS vs SASL+TLS:**
| Mode | Encryption | Authentication |
|---|---|---|
| Plain | ❌ | ❌ |
| SASL only | ❌ | ✅ |
| TLS only | ✅ | ❌ |
| SASL + TLS | ✅ | ✅ |

The demo TLS stack runs SASL/SCRAM-256 on an TLS-encrypted port **19095** — the most secure combination.`,
    keyTerms: [
      {
        term: 'TLS',
        definition:
          'Transport Layer Security — a cryptographic protocol that encrypts the connection between client and server. All data (including credentials) is encrypted in transit.',
      },
      {
        term: 'X.509 Certificate',
        definition:
          'A digital certificate that proves the identity of the broker. Signed by a Certificate Authority (CA) — or self-signed for development.',
      },
      {
        term: 'Skip Certificate Verification',
        definition:
          'A flag that disables CA validation and hostname checking during the TLS handshake. Use only with trusted self-signed development environments.',
      },
      {
        term: 'Self-Signed Certificate',
        definition:
          'A TLS certificate signed by its own private key rather than a CA. Used in development and test environments. Browsers and Kafka clients reject these by default unless verification is disabled.',
      },
    ],
    diagram: `<svg viewBox="0 0 380 130" xmlns="http://www.w3.org/2000/svg">
  <!-- Client -->
  <rect x="8" y="25" width="100" height="80" rx="5" fill="var(--surface2,#1e1e2e)" stroke="var(--border,#45475a)" stroke-width="1.3"/>
  <text x="58" y="48" text-anchor="middle" fill="var(--text)" font-size="10">RedfireForge</text>
  <text x="58" y="62" text-anchor="middle" fill="var(--text-muted)" font-size="8">TLS handshake</text>
  <text x="58" y="74" text-anchor="middle" fill="var(--text-muted)" font-size="8">SCRAM-256 auth</text>
  <text x="58" y="86" text-anchor="middle" fill="var(--primary)" font-size="8">🔒 Encrypted</text>
  <text x="58" y="98" text-anchor="middle" fill="var(--text-muted)" font-size="7">skip verify: ON</text>
  <!-- Encrypted channel arrows -->
  <line x1="108" y1="55" x2="200" y2="55" stroke="var(--success,#a6e3a1)" stroke-width="2" stroke-dasharray="5 2" marker-end="url(#tls-a)"/>
  <text x="154" y="48" text-anchor="middle" fill="var(--success,#a6e3a1)" font-size="7">Encrypted tunnel</text>
  <line x1="200" y1="75" x2="108" y2="75" stroke="var(--success,#a6e3a1)" stroke-width="2" stroke-dasharray="5 2" marker-end="url(#tls-b)"/>
  <text x="154" y="90" text-anchor="middle" fill="var(--success,#a6e3a1)" font-size="7">Broker response</text>
  <!-- Broker -->
  <rect x="202" y="25" width="100" height="80" rx="5" fill="var(--surface2,#1e1e2e)" stroke="var(--success,#a6e3a1)" stroke-width="1.5"/>
  <text x="252" y="48" text-anchor="middle" fill="var(--text)" font-size="10">Redpanda</text>
  <text x="252" y="62" text-anchor="middle" fill="var(--text-muted)" font-size="8">:19095</text>
  <text x="252" y="76" text-anchor="middle" fill="var(--success,#a6e3a1)" font-size="8">SASL + TLS</text>
  <text x="252" y="90" text-anchor="middle" fill="var(--text-muted)" font-size="8">Self-signed cert</text>
  <!-- Lock -->
  <rect x="314" y="40" width="58" height="50" rx="4" fill="var(--success,#a6e3a1)" opacity="0.1" stroke="var(--success,#a6e3a1)" stroke-width="1"/>
  <text x="343" y="62" text-anchor="middle" fill="var(--success,#a6e3a1)" font-size="12">🔐</text>
  <text x="343" y="76" text-anchor="middle" fill="var(--text-muted)" font-size="7">Auth +</text>
  <text x="343" y="87" text-anchor="middle" fill="var(--text-muted)" font-size="7">Encrypted</text>
  <defs>
    <marker id="tls-a" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="var(--success,#a6e3a1)" stroke-width="1.3"/></marker>
    <marker id="tls-b" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto"><path d="M6,0 L0,3 L6,6" fill="none" stroke="var(--success,#a6e3a1)" stroke-width="1.3"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    // Step 1: Navigate to Settings
    {
      id: 'tls-intro',
      title: 'TLS-Encrypted Cluster',
      description:
        'Adding TLS on top of SASL gives you encryption in transit — no one can sniff your messages or credentials on the network. In this lesson you\'ll configure a new cluster for the TLS-enabled stack running on port **19095**. Make sure the TLS Docker stack is up: `cd docker/kafka/tls && docker compose up -d`.',
      highlight: KAFKA.SETTINGS_PAGE,
      preAction: async (ctx) => {
        ctx.navigateToTab('kafka-settings');
        await ctx.delay(600);
        document.querySelectorAll('.kafka-cluster-card.selected').forEach((el) => {
          el.classList.remove('selected');
        });
      },
    },

    // Step 2: New cluster
    {
      id: 'tls-new',
      title: 'Create TLS Cluster',
      description:
        'Click **New Cluster** to open a fresh Cluster Editor. You\'ll configure this one with both SASL authentication AND TLS encryption.',
      highlight: KAFKA.NEW_CLUSTER_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.NEW_CLUSTER_BTN);
        await ctx.delay(400);
      },
    },

    // Step 3: Set broker and name
    {
      id: 'tls-broker',
      title: 'Set Broker and Name',
      description:
        'Set the **Name** to `Local TLS` and the **Broker** to `127.0.0.1:19095`. Port 19095 is the TLS-enabled listener on the demo stack.',
      highlight: KAFKA.BROKER_INPUT,
      preAction: async (ctx) => {
        const nameInput = document.querySelector<HTMLInputElement>('input[placeholder*="cluster" i], input[placeholder*="name" i], #kafka-cluster-name');
        if (nameInput) {
          nameInput.focus();
          nameInput.value = '';
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          await ctx.fill('input[placeholder*="cluster" i], input[placeholder*="name" i], #kafka-cluster-name', 'Local TLS');
          await ctx.delay(100);
        }
        await ctx.fill(KAFKA.BROKER_INPUT, '127.0.0.1:19095');
        await ctx.delay(200);
      },
    },

    // Step 4: SASL auth
    {
      id: 'tls-auth',
      title: 'Configure SASL Auth',
      description:
        'Set **Auth Mode** to **SCRAM-SHA-256** and fill in the credentials: **Username** `redfireforge-app`, **Password** `app-password`. The TLS stack uses the same SASL users as the SASL-only stack.',
      highlight: KAFKA.AUTH_TYPE_SELECT,
      action: async (ctx) => {
        await ctx.selectOption(KAFKA.AUTH_TYPE_SELECT, 'scram-sha-256');
        await ctx.delay(300);
        await ctx.fill(KAFKA.AUTH_USER_INPUT, 'redfireforge-app');
        await ctx.delay(100);
        await ctx.fill(KAFKA.AUTH_PASS_INPUT, 'app-password');
        await ctx.delay(200);
      },
    },

    // Step 5: Enable TLS toggle
    {
      id: 'tls-enable',
      title: 'Enable TLS',
      description:
        'Click the **Enable TLS** toggle to turn on encryption. This tells the Kafka client to use a TLS-upgraded connection for all communication with the broker — credentials and message payloads travel over an encrypted channel.',
      highlight: KAFKA.TLS_TOGGLE,
      action: async (ctx) => {
        const toggle = document.querySelector<HTMLElement>(KAFKA.TLS_TOGGLE);
        if (toggle) {
          // Only click if not already enabled
          const checked = toggle.getAttribute('aria-checked') === 'true' || (toggle as HTMLInputElement).checked;
          if (!checked) {
            toggle.click();
            await ctx.delay(300);
          }
        }
      },
    },

    // Step 6: Skip certificate verification
    {
      id: 'tls-ca',
      title: 'Skip Certificate Verification',
      description:
        'The demo TLS stack uses a **self-signed certificate** — one not issued by a public CA. Uncheck **Verify Certificate** (or enable **Skip Cert Verification**) to allow the TLS handshake to succeed. In production, leave this ON and provide a proper CA-signed certificate.',
      highlight: KAFKA.TLS_VERIFY_TOGGLE,
      action: async (ctx) => {
        const verifyToggle = document.querySelector<HTMLElement>(KAFKA.TLS_VERIFY_TOGGLE);
        if (verifyToggle) {
          // Uncheck if currently enabled (disable verification for self-signed cert)
          const checked = verifyToggle.getAttribute('aria-checked') === 'true' || (verifyToggle as HTMLInputElement).checked;
          if (checked) {
            verifyToggle.click();
            await ctx.delay(300);
          }
        }
      },
    },

    // Step 7: Test connection
    {
      id: 'tls-test',
      title: 'Test Connection',
      description:
        'Click **Test Connection**. RedfireForge performs the full TLS handshake (using the self-signed cert) and then the SASL authentication. A success indicator confirms both TLS encryption and SASL authentication are working.',
      highlight: KAFKA.TEST_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.TEST_BTN);
        await ctx.delay(1500);
      },
    },

    // Step 8: Save and connect
    {
      id: 'tls-save',
      title: 'Save and Connect',
      description:
        'Click **Save** to persist the cluster, then **Connect** to activate it. You now have an encrypted, authenticated connection to the Kafka broker.',
      highlight: KAFKA.SAVE_BTN,
      action: async (ctx) => {
        await ctx.click(KAFKA.SAVE_BTN);
        await ctx.delay(500);
        const connectBtn = document.querySelector<HTMLElement>(KAFKA.CONNECT_BTN);
        if (connectBtn && !(connectBtn as HTMLButtonElement).disabled) {
          connectBtn.click();
          // Wait for Disconnect button to become ENABLED (not just exist in DOM)
          // — indicates the TLS+SASL handshake completed and connection is active.
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

    // Step 9: Publish to TLS topic
    {
      id: 'tls-publish',
      title: 'Publish Over TLS',
      description:
        'Navigate to the **Publish** tab, set Topic to `tls.demo.orders`, and publish a message. The message travels over the encrypted TLS channel — partition and offset in the result confirm the broker accepted it.',
      highlight: KAFKA.PUB_SEND_BTN,
      preAction: async (ctx) => {
        ctx.navigateToTab('kafka-message-studio');
        await ctx.delay(500);
        await ctx.click(KAFKA.PUBLISH_TAB);
        await ctx.delay(300);
        await ctx.fill(KAFKA.PUB_TOPIC_INPUT, 'tls.demo.orders');
        await ctx.delay(100);
        await ctx.fill(KAFKA.PUB_BODY_TEXTAREA, '{"tlsTest":true,"cluster":"SCRAM-256+TLS"}');
        await ctx.delay(200);
      },
      action: async (ctx) => {
        await ctx.click(KAFKA.PUB_SEND_BTN);
        // Wait for either a success result or an error banner — whichever appears first.
        await ctx.waitFor(`${KAFKA.PUB_RESULT}, ${KAFKA.PUB_ERROR}`, 15000);
        await ctx.delay(400);
      },
    },
  ],
};
