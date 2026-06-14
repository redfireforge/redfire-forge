/** Lesson: WebSocket Basics — connect, send, receive */
import type { DemoLesson } from '../../types';
import { wsSetup, wsCleanup } from '../setup-helpers';
import { WS } from '../../../../shared/selectors';

export const wsBasicsLesson: DemoLesson = {
  id: 'ws-basics',
  domainId: 'protocols',
  category: 'websocket',
  name: 'WebSocket Basics',
  description: 'Connect to a WebSocket server, send messages, and see live responses.',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',

  setup: wsSetup,
  cleanup: wsCleanup,
  concept: {
    title: 'Understanding WebSocket',
    body: `WebSocket is a full-duplex communication protocol that enables real-time data exchange between client and server over a single, persistent TCP connection.

**How it works:**
1. The client sends an HTTP Upgrade request (the "handshake")
2. The server agrees and upgrades the connection
3. Both sides can now send messages at any time — no polling needed

**Key characteristics:**
- **Full-duplex**: Both sides send simultaneously
- **Low overhead**: After handshake, frames are tiny (2-14 bytes header)
- **Event-driven**: Open, Message, Error, Close events
- **Persistent**: Connection stays open until explicitly closed

**When to use WebSocket:**
- Chat applications
- Live dashboards & notifications
- Collaborative editing
- Game state synchronization
- IoT device communication`,
    keyTerms: [
      { term: 'Frame', definition: 'The smallest unit of data in WebSocket. Each message is one or more frames.' },
      { term: 'Handshake', definition: 'The HTTP Upgrade request/response that establishes the WebSocket connection.' },
      { term: 'Subprotocol', definition: 'An application-level protocol negotiated during handshake (e.g., graphql-ws, stomp).' },
      { term: 'Close Code', definition: 'A numeric code (1000-4999) indicating why the connection was closed.' },
    ],
    diagram: `<svg viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="40" width="100" height="40" rx="6" fill="var(--primary)" opacity="0.2" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="70" y="65" text-anchor="middle" fill="var(--text)" font-size="13" font-family="system-ui">Client</text>
  <rect x="280" y="40" width="100" height="40" rx="6" fill="var(--accent)" opacity="0.2" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="330" y="65" text-anchor="middle" fill="var(--text)" font-size="13" font-family="system-ui">Server</text>
  <line x1="120" y1="50" x2="280" y2="50" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#arrow)"/>
  <line x1="280" y1="70" x2="120" y2="70" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#arrow2)"/>
  <text x="200" y="44" text-anchor="middle" fill="var(--text-muted)" font-size="10">send messages</text>
  <text x="200" y="88" text-anchor="middle" fill="var(--text-muted)" font-size="10">receive messages</text>
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--primary)" stroke-width="1.5"/></marker>
    <marker id="arrow2" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--accent)" stroke-width="1.5"/></marker>
  </defs>
</svg>`,
  },
  steps: [
    {
      id: 'ws-nav',
      title: 'Welcome to WebSocket Studio',
      description: 'This is the WebSocket Studio — your workspace for real-time WebSocket testing. It has a split-pane layout: setup tabs on the left, and live event monitoring on the right.',
      highlight: WS.MODE_CLIENT,
    },
    {
      id: 'ws-mock',
      title: 'Start the Mock Server',
      description: 'Let\'s start the built-in Mock Server so we have an echo server to connect to. It mirrors back every message you send — perfect for testing.',
      highlight: WS.MOCK_BTN_ANY,
      preAction: async (ctx) => {
        await ctx.click(WS.MODE_MOCK);
      },
      action: async (ctx) => {
        const btn = document.querySelector(WS.MOCK_START_BTN) as HTMLButtonElement | null;
        if (btn && !btn.disabled) {
          await ctx.click(WS.MOCK_START_BTN);
        }
      },
      verify: WS.MOCK_STOP_BTN,
    },
    {
      id: 'ws-url',
      title: 'Switch to Client Mode',
      description: 'Now switch back to Client mode. We\'ll set the URL to ws://localhost:9876 to match the Mock Server port. This is where you\'ll connect and send messages.',
      highlight: WS.URL_INPUT,
      preAction: async (ctx) => {
        await ctx.click(WS.MODE_CLIENT);
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx) => {
        await ctx.fill(WS.URL_INPUT, 'ws://localhost:9876');
      },
    },
    {
      id: 'ws-connect',
      title: 'Connect to the Server',
      description: 'Click Connect to open the WebSocket connection. Watch the status indicator change from "Disconnected" (grey dot) to "Connected" (green dot). The app auto-switches to Compose once connected.',
      highlight: WS.CONNECT_BTN,
      preAction: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx) => {
        await ctx.click(WS.CONNECT_BTN);
      },
      verify: WS.STATUS_CONNECTED,
    },
    {
      id: 'ws-compose',
      title: 'Compose a Message',
      description: 'Switch to the Compose tab to write messages. You can send plain text, JSON, or binary data. The format dropdown lets you switch between Text, Hex, and Base64 encoding.',
      highlight: WS.COMPOSE_INPUT,
      preAction: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_COMPOSE);
      },
      action: async (ctx) => {
        await ctx.fill(WS.MESSAGE_INPUT, '{"hello": "world", "demo": true}');
      },
    },
    {
      id: 'ws-send',
      title: 'Send Your Message',
      description: 'Click Send to transmit the message. The mock server echoes it right back. Look at the Events panel on the right — you\'ll see both the sent (↑) and received (↓) entries appear.',
      highlight: WS.SEND_BTN,
      action: async (ctx) => {
        await ctx.click(WS.SEND_BTN);
      },
      verify: WS.MESSAGE_ROW,
    },
    {
      id: 'ws-events',
      title: 'Monitor Live Events',
      description: 'The Events tab shows all WebSocket frames in real-time. Each row has a direction indicator (↑ sent / ↓ received), timestamp, size badge, and message preview. Click any row to see the full payload.',
      highlight: WS.RIGHT_TAB_EVENTS,
      action: async (ctx) => {
        await ctx.click(WS.RIGHT_TAB_EVENTS);
      },
    },
    {
      id: 'ws-tabs',
      title: 'Multiple Connections',
      description: 'You can open up to 8 connection tabs, each with its own URL, state, and message history. Click the [+] button to add a new connection. Each tab operates independently.',
      highlight: WS.CONN_TAB_ADD,
    },
    {
      id: 'ws-disconnect',
      title: 'Disconnect',
      description: 'Click Disconnect to close the connection gracefully. Your message history is preserved. You can reconnect anytime without losing your setup.',
      highlight: WS.DISCONNECT_BTN,
      preAction: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
      },
      action: async (ctx) => {
        await ctx.click(WS.DISCONNECT_BTN);
      },
    },
  ],
};
