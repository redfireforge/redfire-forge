/** Lesson 1: Mock Server — zero-friction start, instant WebSocket success */
import type { DemoLesson } from '../../types';
import { switchToClientMode, disconnectWebSocket, stopMockServer } from '../setup-helpers';
import { WS } from '../../../../shared/selectors';

export const wsMockServerLesson: DemoLesson = {
  id: 'ws-mock-server',
  domainId: 'protocols',
  category: 'websocket',
  name: 'Mock Server',
  description: 'Start a built-in echo server in seconds — no setup, no Docker, just instant WebSocket.',
  estimatedMinutes: 2,
  initialTab: 'websocket-studio',

  /* No setup needed — mock server IS the setup for this lesson */
  cleanup: async (ctx) => {
    await disconnectWebSocket(ctx);
    await stopMockServer(ctx);
    await switchToClientMode(ctx);
  },

  concept: {
    title: 'Your Built-in WebSocket Server',
    body: `Most WebSocket tools require you to connect to an external server to test anything. RedFire Forge includes a **built-in Mock Server** — a local echo server that runs entirely in your browser.

**What it does:**
- **Echo mode**: Mirrors every message back to the sender
- **Broadcast mode**: Sends a message to all connected clients
- **Custom rules**: Define response patterns (coming soon)

**Why start here:**
The Mock Server is the fastest path to seeing WebSocket in action. No Docker, no terminal, no external dependencies — start it, connect, send a message, see it echoed. Done.

**Key concept — Client vs Mock mode:**
WebSocket Studio has two modes accessible via toggle buttons at the top:
- **Client mode**: Connect to any WebSocket server
- **Mock mode**: Start/stop the built-in echo server

You'll switch between them during this lesson.`,
    keyTerms: [
      { term: 'Echo', definition: 'The server sends back exactly what it received. Perfect for verifying your client is working.' },
      { term: 'Broadcast', definition: 'The server sends a message to ALL connected clients simultaneously.' },
      { term: 'Mock Server', definition: 'A lightweight WebSocket server running in your browser — no external processes needed.' },
    ],
    diagram: `<svg viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg">
  <rect x="20" y="50" width="100" height="40" rx="6" fill="var(--primary)" opacity="0.2" stroke="var(--primary)" stroke-width="1.5"/>
  <text x="70" y="75" text-anchor="middle" fill="var(--text)" font-size="13" font-family="system-ui">Client</text>
  <rect x="280" y="50" width="100" height="40" rx="6" fill="var(--accent)" opacity="0.2" stroke="var(--accent)" stroke-width="1.5"/>
  <text x="330" y="75" text-anchor="middle" fill="var(--text)" font-size="13" font-family="system-ui">Mock Server</text>
  <line x1="120" y1="60" x2="280" y2="60" stroke="var(--primary)" stroke-width="1.5" marker-end="url(#ms-arrow)"/>
  <text x="200" y="55" text-anchor="middle" fill="var(--text-muted)" font-size="10">send "hello"</text>
  <line x1="280" y1="80" x2="120" y2="80" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#ms-arrow2)"/>
  <text x="200" y="98" text-anchor="middle" fill="var(--text-muted)" font-size="10">echo "hello"</text>
  <text x="330" y="35" text-anchor="middle" fill="var(--text-muted)" font-size="10" font-style="italic">localhost:9876</text>
  <defs>
    <marker id="ms-arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--primary)" stroke-width="1.5"/></marker>
    <marker id="ms-arrow2" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="var(--accent)" stroke-width="1.5"/></marker>
  </defs>
</svg>`,
  },

  steps: [
    {
      id: 'mock-intro',
      title: 'Welcome — Meet Mock Mode',
      description: 'WebSocket Studio has two modes: Client (connect to servers) and Mock (run your own server). Click the Mock toggle to switch to Mock mode — this is where you\'ll start your server.',
      highlight: WS.MODE_MOCK,
      action: async (ctx) => {
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(400);
      },
    },
    {
      id: 'mock-start',
      title: 'Start the Mock Server',
      description: 'Click Start to launch the echo server on port 9876. It starts instantly — no Docker, no terminal, no waiting. Watch the status indicator change to "Listening".',
      highlight: WS.MOCK_START_BTN,
      action: async (ctx) => {
        const btn = document.querySelector(WS.MOCK_START_BTN) as HTMLButtonElement | null;
        if (btn && !btn.disabled) {
          await ctx.click(WS.MOCK_START_BTN);
        }
      },
      verify: WS.MOCK_STOP_BTN,
    },
    {
      id: 'mock-status',
      title: 'Server Status',
      description: 'The status indicator shows the server is Listening on port 9876 with 0 connected clients. The client count updates in real-time as connections come and go.',
      highlight: WS.MOCK_STATUS_LABEL,
    },
    {
      id: 'mock-connect',
      title: 'Connect to Your Server',
      description: 'Now switch to Client mode and connect to your mock server. The URL is pre-filled with ws://localhost:9876. Click Connect — the status dot turns green and your mock server shows "1 client".',
      highlight: WS.CONNECT_BTN,
      preAction: async (ctx) => {
        await ctx.click(WS.MODE_CLIENT);
        await ctx.delay(300);
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.fill(WS.URL_INPUT, 'ws://localhost:9876');
      },
      action: async (ctx) => {
        await ctx.click(WS.CONNECT_BTN);
      },
      verify: WS.STATUS_CONNECTED,
    },
    {
      id: 'mock-echo',
      title: 'Echo — Messages Bounce Back',
      description: 'Send any message and watch it appear twice in the Events panel: once as sent (↑) and once as received (↓). The mock server echoes every message right back — instant verification that your connection works.',
      highlight: WS.SEND_BTN,
      preAction: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_COMPOSE);
        await ctx.fill(WS.MESSAGE_INPUT, '{"greeting": "Hello from Mock Server demo!"}');
      },
      action: async (ctx) => {
        await ctx.click(WS.SEND_BTN);
      },
      verify: WS.MESSAGE_ROW,
    },
    {
      id: 'mock-broadcast',
      title: 'Broadcast Mode',
      description: 'Switch to Mock mode to see the broadcast panel. Type a message and click Broadcast — it\'s sent to ALL connected clients. This is great for simulating server-push scenarios like notifications or live updates.',
      highlight: WS.MOCK_BROADCAST_BTN,
      preAction: async (ctx) => {
        await ctx.click(WS.MODE_MOCK);
        await ctx.delay(300);
        await ctx.fill(WS.MOCK_BROADCAST_INPUT, 'Server broadcast: welcome everyone!');
      },
    },
    {
      id: 'mock-stop',
      title: 'Stop the Server',
      description: 'Click Stop to shut down the mock server. Any connected client is automatically disconnected. Your message history is preserved — you can restart and reconnect anytime.',
      highlight: WS.MOCK_STOP_BTN,
      action: async (ctx) => {
        const btn = document.querySelector(WS.MOCK_STOP_BTN) as HTMLButtonElement | null;
        if (btn && !btn.disabled) {
          await ctx.click(WS.MOCK_STOP_BTN);
        }
      },
      verify: WS.MOCK_START_BTN,
    },
  ],
};
