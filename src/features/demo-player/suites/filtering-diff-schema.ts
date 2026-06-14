/** Demo suite: Filtering, Diff & Schema Validation */
import type { DemoSuite } from '../types-v1';

export const filteringDiffDemo: DemoSuite = {
  id: 'filtering-diff-schema',
  name: 'Filtering, Diff & Schema',
  description: 'Master search, filters, JSON diff, and schema validation on WebSocket events.',
  icon: '🔍',
  estimatedMinutes: 3,
  initialTab: 'websocket-studio',
  steps: [
    {
      id: 'filter-intro',
      title: 'Event Filtering',
      description: 'The Events tab has powerful filtering built in. You can search message content, filter by direction (sent/received), filter by type (text/binary/ping), and combine multiple filters for precise event isolation.',
      highlight: '[data-testid="right-tab-events"]',
      action: async (ctx) => {
        await ctx.click('[data-testid="right-tab-events"]');
        await ctx.delay(300);
      },
    },
    {
      id: 'filter-search',
      title: 'Text Search',
      description: 'Type in the search bar to filter events by content. The search is case-insensitive and matches against the raw message body. Matched events are highlighted, non-matches are hidden. The status bar shows "X of Y events".',
      highlight: '[data-testid="ws-events-search"]',
    },
    {
      id: 'filter-direction',
      title: 'Direction Filter',
      description: 'Toggle between All, Sent (↑), and Received (↓) to isolate traffic direction. Combined with search, you can quickly find "that specific response I received with error code 500."',
      highlight: '[data-testid="ws-events-direction"]',
    },
    {
      id: 'filter-type',
      title: 'Message Type Filter',
      description: 'Filter by frame type: text, binary, ping, pong, close, open. Most WebSocket traffic is text frames. Binary frames are common in streaming apps. Ping/pong filters help debug keepalive issues.',
      highlight: '[data-testid="ws-events-type-filter"]',
    },
    {
      id: 'filter-presets',
      title: 'Filter Presets',
      description: 'Save commonly-used filter combos as presets. Click the star icon to save the current search + direction + type combo. Presets are per-workspace and available across all connection tabs.',
      highlight: '[data-testid="ws-preset"]',
    },
    {
      id: 'diff-intro',
      title: 'Compare Events (Diff)',
      description: 'Select two events and click Compare to see a side-by-side JSON diff. Red lines were removed, green lines were added. This is invaluable for comparing request/response pairs or spotting mutations in message sequences.',
      highlight: '[data-testid="ws-compare-mode"]',
    },
    {
      id: 'schema-intro',
      title: 'JSON Schema Validation',
      description: 'Paste or import a JSON Schema in the Schema tab. When enabled, every received event is validated against the schema. Non-conforming messages get a warning badge in the Events tab, and validation details appear in the event drawer.',
      highlight: '[data-testid="left-tab-schema"]',
      action: async (ctx) => {
        await ctx.click('[data-testid="left-tab-schema"]');
        await ctx.delay(300);
      },
    },
  ],
};
