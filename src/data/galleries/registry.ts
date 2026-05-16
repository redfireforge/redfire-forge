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
    description: 'Ready-to-run API requests against real public endpoints',
  },
  {
    key: 'catalog',
    label: 'API Catalog',
    icon: '📚',
    description: 'OpenAPI specifications you can import and explore',
  },
  {
    key: 'tests',
    label: 'Tests',
    icon: '🧪',
    description: 'Complete test scenarios with assertions and data sets',
  },
  {
    key: 'workflows',
    label: 'Workflows',
    icon: '⚡',
    description: 'Multi-step workflow templates covering common API patterns',
  },
  {
    key: 'assertions',
    label: 'Assertions',
    icon: '✅',
    description: 'Pre-built assertion sets for common validation patterns',
  },
  {
    key: 'data-mapper',
    label: 'Data Mapper',
    icon: '🔀',
    description: 'Visual mapping samples demonstrating drag-and-drop, expressions, and advanced features',
  },
];

export const galleryDomainMap = new Map(
  galleryDomains.map(d => [d.key, d]),
);
