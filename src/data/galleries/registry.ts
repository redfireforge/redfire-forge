/**
 * Unified Gallery Registry
 *
 * Central metadata for every gallery domain. UI components use this to render
 * tabs, filters, and search across all domains without hard-coding domain names.
 */

import type { GalleryDomain } from './types';

export interface GalleryDomainConfig {
  key: GalleryDomain;
  label: string;
  icon: string;
  description: string;
}

export const galleryDomains: GalleryDomainConfig[] = [
  {
    key: 'requests',
    label: 'Requests',
    icon: '📡',
    description: 'Ready-to-run API requests, assertion presets, and data mapper samples',
  },
  {
    key: 'catalog',
    label: 'API Catalog',
    icon: '📚',
    description: 'OpenAPI specifications you can import and explore',
  },
  {
    key: 'api-mock',
    label: 'API Mock',
    icon: '🧪',
    description: 'Local HTTP mock-server samples for API Mock Studio',
  },
  {
    key: 'workflows',
    label: 'Workflow',
    icon: '⚡',
    description: 'Multi-step workflow templates for HTTP API patterns, flow control, and orchestration',
  },
  {
    key: 'harness',
    label: 'Harness',
    icon: '🔬',
    description: 'Complete test scenarios with assertions and data sets for the Test Harness',
  },
  {
    key: 'kafka',
    label: 'Kafka',
    icon: '📨',
    description: 'Kafka event-driven workflow samples — produce, trigger, consume, and async correlation',
  },
  {
    key: 'websocket',
    label: 'WebSocket',
    icon: '🔌',
    description: 'WebSocket connection samples — echo, subscribe, chat, and hybrid HTTP patterns',
  },
  {
    key: 'sse',
    label: 'SSE',
    icon: '📶',
    description: 'Server-Sent Events connection samples — event streams, auth, and real-time feeds',
  },
  {
    key: 'graphql',
    label: 'GraphQL',
    icon: '🔷',
    description: 'GraphQL query, mutation, subscription, and workflow samples',
  },
  {
    key: 'grpc',
    label: 'gRPC',
    icon: '🔌',
    description: 'gRPC protocol samples — unary, streaming, health check, CRUD, and load test patterns',
  },
];

export const galleryDomainMap = new Map(
  galleryDomains.map(d => [d.key, d]),
);
