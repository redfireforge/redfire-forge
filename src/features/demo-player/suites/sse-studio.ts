/** Demo suite: SSE Studio — Server-Sent Events */
import type { DemoSuite } from '../types-v1';

export const sseStudioDemo: DemoSuite = {
  id: 'sse-studio',
  name: 'SSE Studio',
  description: 'Learn Server-Sent Events testing — subscribe to event streams, filter by type, and inspect data.',
  icon: '📡',
  estimatedMinutes: 2,
  initialTab: 'sse-studio',
  steps: [
    {
      id: 'sse-intro',
      title: 'Welcome to SSE Studio',
      description: 'Server-Sent Events (SSE) is a one-way streaming protocol — the server pushes events to the client over HTTP. SSE Studio lets you subscribe, filter, and inspect these event streams.',
      highlight: '[data-testid="sse-url"]',
    },
    {
      id: 'sse-url',
      title: 'Enter an SSE Endpoint',
      description: 'Enter the URL of an SSE endpoint. SSE endpoints use standard HTTP GET and return a text/event-stream response. The server sends events as newline-delimited text blocks.',
      highlight: '[data-testid="sse-url"]',
    },
    {
      id: 'sse-connect',
      title: 'Subscribe',
      description: 'Click Subscribe to start listening. The app opens an EventSource connection and begins receiving events. The status indicator turns green when connected.',
      highlight: '[data-testid="sse-subscribe-btn"]',
    },
    {
      id: 'sse-events',
      title: 'Event Stream',
      description: 'Events appear in real-time with their event type, data payload, and optional id. Each event row shows the timestamp, type badge, and a preview of the data. Click to expand.',
      highlight: '[data-testid="sse-events"]',
    },
    {
      id: 'sse-type-filter',
      title: 'Filter by Event Type',
      description: 'SSE events have named types (e.g., "message", "heartbeat", "update"). Use the type filter to focus on specific event types. Unknown types default to "message".',
      highlight: '[data-testid="sse-type-filter"]',
    },
    {
      id: 'sse-headers',
      title: 'Custom Headers',
      description: 'Unlike browser-native EventSource, RedfireForge supports custom request headers for SSE — useful for auth tokens. Switch the Headers tab to add Authorization or other headers.',
      highlight: '[data-testid="sse-headers-tab"]',
    },
  ],
};
