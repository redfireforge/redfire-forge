/** Demo suite: Console & Debugging */
import type { DemoSuite } from '../types-v1';

export const consoleDemo: DemoSuite = {
  id: 'console-debugging',
  name: 'Console & Debugging',
  description: 'Use the Console tab for command-line debugging and protocol inspection.',
  icon: '🖥️',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',
  steps: [
    {
      id: 'console-intro',
      title: 'The Console Tab',
      description: 'The Console is a developer-focused tool in the right pane. It logs connection lifecycle events, protocol handshakes, and lets you run commands. Think of it as DevTools for WebSockets.',
      highlight: '[data-testid="right-tab-console"]',
      action: async (ctx) => {
        await ctx.click('[data-testid="right-tab-console"]');
        await ctx.delay(300);
      },
    },
    {
      id: 'console-views',
      title: 'Structured vs Raw Views',
      description: 'Toggle between Structured (grouped by severity with expandable details) and Raw (curl-verbose style with > < * $ prefixes). Structured is great for browsing; Raw is perfect for copy-pasting into bug reports.',
      highlight: '[data-testid="ws-console-view-structured"]',
    },
    {
      id: 'console-levels',
      title: 'Filter by Severity',
      description: 'Use the level filters to focus on what matters. "Error" shows only failures. "Warn" catches protocol issues. "Info" is the default showing everything. Each level has a distinct color.',
      highlight: '[data-testid="ws-console-level-all"]',
    },
    {
      id: 'console-categories',
      title: 'Filter by Category',
      description: 'Categories organize events by type: lifecycle (connect/disconnect), handshake (protocol negotiation), protocol (frame-level), command (your /send and /ping), and system. Use the dropdown to isolate specific categories.',
      highlight: '[data-testid="ws-console-category"]',
    },
    {
      id: 'console-cmd',
      title: 'Command Line',
      description: 'The command input at the bottom accepts slash commands. Type /help to see all available commands. These let you interact with the connection without switching tabs.',
      highlight: '[data-testid="ws-console-cmd-input"]',
    },
    {
      id: 'console-commands',
      title: 'Available Commands',
      description: '/connect [url] — connect or reconnect\n/disconnect — close the connection\n/send <data> — send a message\n/ping — send a ping frame (proxy/native only)\n/template <name> — send a saved template\n/clear — clear the console\n/close [code] [reason] — close with code',
    },
    {
      id: 'console-independence',
      title: 'Console is Independent',
      description: 'Important: Console and Events are separate logs. Console search, filters, and clear only affect Console. Events search only affects Events. But /send from Console creates real WebSocket frames that DO appear in Events.',
    },
  ],
};
