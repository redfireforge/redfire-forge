/** Demo suite: Auth & Transport — authentication and connection modes */
import type { DemoSuite } from '../types-v1';

export const authTransportDemo: DemoSuite = {
  id: 'auth-transport',
  name: 'Auth & Transport',
  description: 'Learn how authentication works with WebSocket connections and transport modes.',
  icon: '🔐',
  estimatedMinutes: 4,
  initialTab: 'websocket-studio',
  steps: [
    {
      id: 'auth-intro',
      title: 'Authentication Overview',
      description: 'WebSocket auth is tricky — browsers can\'t set custom HTTP headers on WebSocket handshakes. RedfireForge solves this with a proxy transport that relays your auth headers. Let\'s explore.',
      highlight: '[data-testid="left-tab-auth"]',
    },
    {
      id: 'auth-tab',
      title: 'Open the Auth Tab',
      description: 'The Auth tab is in the left pane. It supports Bearer Token, Basic Auth, API Key, Digest, and OAuth2. Each type shows specific fields for its credentials.',
      highlight: '[data-testid="left-tab-auth"]',
      action: async (ctx) => {
        await ctx.click('[data-testid="left-tab-auth"]');
        await ctx.delay(300);
      },
    },
    {
      id: 'auth-type-selector',
      title: 'Choose an Auth Type',
      description: 'The type dropdown controls which credentials are sent. "None" means no auth. "Inherit" pulls from a Global Auth Profile defined in Settings. The other types each have specific fields.',
      highlight: '[data-testid="ws-auth-type"], [class*="auth-type"]',
    },
    {
      id: 'auth-bearer',
      title: 'Bearer Token Auth',
      description: 'Select "Bearer Token" to see the token field. The token is sent as an Authorization header: "Bearer <token>". Notice the "WILL SEND" preview at the bottom showing the masked header value.',
      highlight: '[data-testid="ws-auth-resolved"]',
    },
    {
      id: 'auth-callout',
      title: 'Browser Transport Callout',
      description: 'See the info callout? In browser mode, WebSocket connections can\'t carry custom HTTP headers. When you use header-based auth (Bearer, Basic, etc.), the app automatically switches to Proxy transport — your backend relays the headers.',
      highlight: '[data-testid="ws-auth-callout"]',
    },
    {
      id: 'auth-connect-tab',
      title: 'Check the Connect Tab',
      description: 'Switch to the Connect tab. Notice the protocol selector (Auto-detect, Raw, Socket.IO, STOMP, GraphQL-WS) and the auto-reconnect settings. The transport mode is shown as a badge on the connection tab.',
      highlight: '[data-testid="left-tab-connect"]',
      action: async (ctx) => {
        await ctx.click('[data-testid="left-tab-connect"]');
        await ctx.delay(300);
      },
    },
    {
      id: 'auth-protocol',
      title: 'Protocol Selector',
      description: 'The protocol dropdown tells RedfireForge how to frame messages. "Auto-detect" inspects the URL and first message. Socket.IO wraps events in Engine.IO frames. STOMP uses command-based framing. GraphQL-WS uses the graphql-transport-ws protocol.',
      highlight: '[data-testid="protocol-select"], select',
    },
    {
      id: 'auth-tls',
      title: 'TLS / Security Panel',
      description: 'For secure wss:// connections, scroll down to the TLS section. You can toggle "Reject Unauthorized" for self-signed certs, or paste a custom CA certificate. TLS options require Proxy or Tauri Native transport.',
      highlight: '[data-testid="tls-panel"], [class*="tls"]',
    },
    {
      id: 'auth-transport-badge',
      title: 'Transport Modes',
      description: 'When connected, the tab badge shows the transport mode: "direct" (browser native), "proxy" (via backend), or "native" (Tauri desktop). Query-based auth (API Key in query) works on all transports without forcing proxy.',
    },
  ],
};
