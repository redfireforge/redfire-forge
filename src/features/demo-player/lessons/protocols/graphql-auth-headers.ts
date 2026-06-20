/** Lesson GQL-6: Authentication & Headers */
import type { DemoLesson } from '../../types';
import { GQL } from '../../../../shared/selectors';
import {
  GQL_DEMO_HEALTH,
  GQL_DEMO_HTTP,
  LESSON6_AUTH_TOKEN_VALUE,
  LESSON6_BEARER_TEMPLATE,
  LESSON6_PROFILE_NAME,
  ensureApiKeyAuthConfigured,
  ensureApiKeyExecutedWithMetadata,
  ensureAuthPopoverOpen,
  ensureBearerAuthConfigured,
  ensureBearerExecutedWithMetadata,
  ensureDemoEndpoint,
  ensureEnvAuthToken,
  ensureHealthQuery,
  ensureIntrospected,
  gqlAuthLessonCleanup,
  gqlAuthLessonSetup,
  selectAuthType,
} from './graphql-lesson-helpers';

export const gqlAuthHeadersLesson: DemoLesson = {
  id: 'gql-auth-headers',
  domainId: 'protocols',
  category: 'graphql',
  name: 'Authentication & Headers',
  description:
    'Configure Bearer and API Key auth, resolve secrets from environment variables, verify outgoing headers in Metadata, and save a connection profile.',
  estimatedMinutes: 3,
  initialTab: 'graphql-studio',
  allowedTabs: ['graphql-studio'],

  dockerEndpoint: GQL_DEMO_HEALTH,
  dockerCommand: 'cd docker/graphql && docker compose up -d',
  tag: '🐳 Docker',

  setup: gqlAuthLessonSetup,
  cleanup: gqlAuthLessonCleanup,

  concept: {
    title: 'Auth & Connection Profiles',
    body: `GraphQL Studio attaches credentials on the **connection bar** — not in a separate settings page.

**Auth badge** opens a popover for Bearer token, Basic auth, or API Key. Use \`{{variableName}}\` placeholders in token/header values; they resolve from your active **environment** at execute time.

After **Execute**, open the response **Metadata** tab to inspect **Request headers** — the exact \`Authorization\` or custom header sent to the server.

**Profiles** save endpoint + auth combos for one-click recall. The test server on port **4010** does not reject bad tokens — this lesson focuses on configuration and visibility.`,
    keyTerms: [
      {
        term: 'Bearer token',
        definition:
          'HTTP `Authorization: Bearer <token>` header. Common for JWT APIs. Configure in the Auth popover.',
      },
      {
        term: 'Environment variable',
        definition:
          'Named secret or URL fragment stored in the Env modal. Referenced as `{{key}}` in auth fields and endpoint URLs.',
      },
      {
        term: 'Request headers (Metadata)',
        definition:
          'Outgoing headers actually sent with the operation — shown in the Metadata tab after execute (auth + Content-Type).',
      },
      {
        term: 'Connection profile',
        definition:
          'Named snapshot of endpoint URL + auth settings. Save via the Profiles badge on the connection bar.',
      },
    ],
    diagram: `<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="30" width="75" height="55" rx="6" fill="var(--primary)" opacity="0.15" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="47" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Auth</text>
  <text x="47" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">Bearer</text>
  <rect x="95" y="30" width="75" height="55" rx="6" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="132" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Env</text>
  <text x="132" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">{{authToken}}</text>
  <rect x="180" y="30" width="75" height="55" rx="6" fill="var(--surface)" stroke="var(--border)" stroke-width="1.5"/>
  <text x="217" y="52" text-anchor="middle" fill="var(--text)" font-size="9" font-weight="600">Execute</text>
  <text x="217" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="8">health</text>
  <rect x="265" y="30" width="90" height="55" rx="6" fill="var(--primary)" opacity="0.1" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="310" y="52" text-anchor="middle" fill="var(--text)" font-size="8">Metadata</text>
  <text x="310" y="68" text-anchor="middle" fill="var(--text-muted)" font-size="7">Authorization:</text>
  <rect x="365" y="30" width="45" height="55" rx="6" fill="var(--success)" opacity="0.12" stroke="var(--success)" stroke-width="1.5"/>
  <text x="387" y="58" text-anchor="middle" fill="var(--text)" font-size="8">Profile</text>
  <text x="210" y="105" text-anchor="middle" fill="var(--text-muted)" font-size="9">Protocols → GraphQL → Authentication</text>
</svg>`,
  },

  steps: [
    {
      id: 'gql6-intro',
      title: 'Auth on the Connection Bar',
      description:
        'Credentials live on the **connection bar** — click the **Auth** badge (lock icon) to open the authentication popover. This is separate from the **Profiles** badge (saved endpoint + auth combos) and the **Env** badge (variable secrets).',
      highlight: GQL.AUTH_BADGE_BTN,
      pauseAfter: true,
    },

    {
      id: 'gql6-bearer',
      title: 'Bearer Token Auth',
      description:
        'Open the **Auth** popover → select **Bearer Token** → enter `{{authToken}}` in the token field. The preview footer shows the header that will be sent once the variable is resolved.',
      highlight: GQL.AUTH_POPOVER,
      preAction: async (ctx) => {
        await ensureDemoEndpoint(ctx);
        await ensureIntrospected(ctx);
      },
      action: async (ctx) => {
        await ensureAuthPopoverOpen(ctx);
        await selectAuthType(ctx, 'bearer');
        await ctx.fill(GQL.AUTH_BEARER_INPUT, LESSON6_BEARER_TEMPLATE);
        await ctx.delay(800);
      },
      verify: GQL.AUTH_PREVIEW,
      pauseAfter: true,
    },

    {
      id: 'gql6-env',
      title: 'Environment Variables',
      description:
        `Click the **Env** badge → add variable \`authToken\` with value \`${LESSON6_AUTH_TOKEN_VALUE}\`. Also add \`apiKey\` for the API Key step later. Active environment variables replace \`{{placeholders}}\` when you **Execute**.`,
      highlight: GQL.ENV_BADGE,
      preAction: ensureBearerAuthConfigured,
      action: async (ctx) => {
        await ensureEnvAuthToken(ctx);
        await ctx.delay(800);
      },
      verify: GQL.ENV_MODAL,
      pauseAfter: true,
    },

    {
      id: 'gql6-execute-bearer',
      title: 'Execute & Inspect Headers',
      description:
        'Ensure `query { health }` is in the editor, click **Execute**, then open the **Metadata** tab. Scroll to **Request headers** — confirm `Authorization: Bearer lesson6-demo-jwt` (env-resolved from `{{authToken}}`).',
      highlight: GQL.RV_TAB_METADATA,
      preAction: ensureEnvAuthToken,
      action: async (ctx) => {
        await ensureHealthQuery(ctx);
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(500);
        await ctx.click(GQL.RV_TAB_METADATA);
        await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
        await ctx.delay(800);
      },
      verify: GQL.RV_REQUEST_HEADERS,
      pauseAfter: true,
    },

    {
      id: 'gql6-apikey',
      title: 'Switch to API Key',
      description:
        'Re-open **Auth** → select **API Key** → header name `X-API-Key`, value `{{apiKey}}`. The preview updates to show the custom header name.',
      highlight: GQL.AUTH_TYPE_SELECT,
      preAction: ensureBearerExecutedWithMetadata,
      action: async (ctx) => {
        await ensureApiKeyAuthConfigured(ctx);
        await ctx.delay(800);
      },
      verify: GQL.AUTH_PREVIEW,
      pauseAfter: true,
    },

    {
      id: 'gql6-execute-apikey',
      title: 'Verify API Key Header',
      description:
        'Click **Execute** again → **Metadata** tab → **Request headers** now shows `X-API-Key: lesson6-secret-key` instead of `Authorization`. Same query, different auth injection.',
      highlight: GQL.RV_REQUEST_HEADERS,
      preAction: ensureApiKeyAuthConfigured,
      action: async (ctx) => {
        await ctx.click(GQL.EXECUTE_BTN);
        await ctx.waitFor(GQL.RESPONSE_VIEWER, 15000);
        await ctx.delay(500);
        await ctx.click(GQL.RV_TAB_METADATA);
        await ctx.waitFor(GQL.RV_REQUEST_HEADERS, 5000);
        await ctx.delay(800);
      },
      verify: GQL.RV_REQUEST_HEADERS,
      pauseAfter: true,
    },

    {
      id: 'gql6-profile',
      title: 'Save a Connection Profile',
      description:
        `Click **Profiles** on the connection bar → enter name **${LESSON6_PROFILE_NAME}** → **Save**. The profile captures endpoint \`${GQL_DEMO_HTTP}\` plus the current API Key auth for quick reload later.`,
      highlight: GQL.PROFILE_BADGE,
      preAction: ensureApiKeyExecutedWithMetadata,
      action: async (ctx) => {
        await ctx.click(GQL.PROFILE_BADGE);
        await ctx.waitFor(GQL.PROFILE_MODAL, 5000);
        await ctx.delay(600);
        await ctx.fill(GQL.PROFILE_NAME_INPUT, LESSON6_PROFILE_NAME);
        await ctx.delay(400);
        await ctx.click(GQL.PROFILE_SAVE_BTN);
        await ctx.delay(800);
      },
      verify: GQL.PROFILE_MODAL,
      pauseAfter: true,
    },
  ],
};
