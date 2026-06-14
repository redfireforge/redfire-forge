/** Demo suite: WebSocket Basics — connect, send, receive */
import type { DemoSuite } from '../types-v1';
import { WS } from '../../../shared/selectors';

export const websocketBasicsDemo: DemoSuite = {
  id: 'ws-basics',
  name: 'WebSocket Basics',
  description: 'Connect to a WebSocket server, send messages, and see live responses.',
  icon: '🔌',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',
  steps: [
    {
      id: 'ws-nav',
      title: 'Welcome to WebSocket Studio',
      description: 'This is the WebSocket Studio — your workspace for real-time WebSocket testing. It has a split-pane layout: setup tabs on the left, and live event monitoring on the right.',
      highlight: WS.MODE_CLIENT,
    },
    {
      id: 'ws-url',
      title: 'Enter a WebSocket URL',
      description: 'Type a WebSocket URL in the address bar. We\'ll use the built-in echo server at ws://localhost:9876 which mirrors back every message you send.',
      highlight: WS.URL_INPUT,
      action: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
    },
    {
      id: 'ws-connect',
      title: 'Connect to the Server',
      description: 'Click the Connect button. Watch the tab label change from "disconnected" to "connected" with a green indicator. The Events tab on the right will show connection lifecycle events.',
      highlight: WS.CONNECT_BTN,
    },
    {
      id: 'ws-compose',
      title: 'Compose a Message',
      description: 'Switch to the Compose tab to write messages. You can send plain text, JSON, or binary data. Try typing a simple JSON message like {"hello": "world"}.',
      highlight: WS.LEFT_TAB_COMPOSE,
      action: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_COMPOSE);
        await ctx.delay(200);
      },
    },
    {
      id: 'ws-send',
      title: 'Send Your Message',
      description: 'Click Send to transmit your message. The echo server will send it right back. Look at the Events tab — you\'ll see both a "sent" (diamond up) and "received" (diamond down) entry.',
      highlight: WS.SEND_BTN,
    },
    {
      id: 'ws-events',
      title: 'Monitor Live Events',
      description: 'The Events tab shows all WebSocket frames in real-time. Each row has a direction indicator, timestamp, size badge, and a preview of the message content. Click any row to see the full payload.',
      highlight: WS.RIGHT_TAB_EVENTS,
      action: async (ctx) => {
        await ctx.click(WS.RIGHT_TAB_EVENTS);
        await ctx.delay(200);
      },
    },
    {
      id: 'ws-tabs',
      title: 'Multiple Connections',
      description: 'You can open up to 8 connection tabs, each with its own URL, state, and message history. Click the [+] button in the tab bar to add a new connection. Each tab operates independently.',
      highlight: WS.CONN_TAB_ADD,
    },
    {
      id: 'ws-disconnect',
      title: 'Disconnect',
      description: 'When you\'re done, click Disconnect. The connection closes cleanly and the tab label updates. Your message history is preserved until you clear it.',
      highlight: WS.DISCONNECT_BTN,
      action: async (ctx) => {
        await ctx.click(WS.LEFT_TAB_CONNECT);
        await ctx.delay(200);
      },
    },
  ],
};
