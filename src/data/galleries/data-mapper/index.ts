/**
 * Data Mapper gallery entries — real end-to-end test scenarios that demonstrate
 * Data Mapper features. Users can import these and open the Data Mapper from
 * within the test editor to visually verify extraction, validation, and body mapping.
 */

import type { GalleryEntry } from '../types';
import type { FeatureGroup } from '../../../shared/types';
import {
  createExtractionMappingSample,
  createValidationMappingSample,
  createBodyBuilderMappingSample,
  createMultiStepChainSample,
  createComboMapperSample,
} from './presets';

interface DataMapperSampleEntry extends GalleryEntry<FeatureGroup> {
  scenarioCount: number;
  mapperSurfaces: string[];
}

export const dataMapperSampleCatalog: DataMapperSampleEntry[] = [
  {
    id: 'dm-extraction-mapping',
    domain: 'data-mapper',
    name: 'Extraction Mapping',
    description: 'Fetch a user, extract 5 fields, pass them to a follow-up request. Open "Map Fields" in the Extract tab.',
    icon: '🔀',
    category: 'mapping',
    difficulty: 'easy',
    tags: ['extraction', 'drag-drop', 'variables', 'jsonplaceholder'],
    liveApis: ['jsonplaceholder.typicode.com'],
    scenarioCount: 2,
    mapperSurfaces: ['extraction'],
    factory: createExtractionMappingSample,
  },
  {
    id: 'dm-validation-mapping',
    domain: 'data-mapper',
    name: 'Validation Mapping',
    description: 'Validate product fields with selective mode. Open "⚡ Visual Mapper" in the Validation tab.',
    icon: '🔀',
    category: 'mapping',
    difficulty: 'easy',
    tags: ['validation', 'selective', 'expected-fields', 'dummyjson'],
    liveApis: ['dummyjson.com'],
    scenarioCount: 1,
    mapperSurfaces: ['validation'],
    factory: createValidationMappingSample,
  },
  {
    id: 'dm-body-builder',
    domain: 'data-mapper',
    name: 'Body Builder Mapping',
    description: 'Extract user fields, then build a POST body template with {{variables}}. Open "Open Mapper" in the Body tab.',
    icon: '🔀',
    category: 'mapping',
    difficulty: 'medium',
    tags: ['body', 'template', 'post', 'variables', 'jsonplaceholder'],
    liveApis: ['jsonplaceholder.typicode.com'],
    scenarioCount: 2,
    mapperSurfaces: ['extraction', 'body'],
    factory: createBodyBuilderMappingSample,
  },
  {
    id: 'dm-multi-step-chain',
    domain: 'data-mapper',
    name: 'Multi-Step Chain',
    description: 'User → Posts → Comments chain. Each step extracts and passes variables to the next.',
    icon: '🔀',
    category: 'mapping',
    difficulty: 'medium',
    tags: ['chain', 'multi-step', 'extraction', 'variables', 'jsonplaceholder'],
    liveApis: ['jsonplaceholder.typicode.com'],
    scenarioCount: 3,
    mapperSurfaces: ['extraction'],
    factory: createMultiStepChainSample,
  },
  {
    id: 'dm-combo-mapper',
    domain: 'data-mapper',
    name: 'Full Combo — Extract + Validate + Body',
    description: 'All Data Mapper surfaces in one scenario: extraction, selective validation, and body template with mapped variables.',
    icon: '🔀',
    category: 'mapping',
    difficulty: 'advanced',
    tags: ['combo', 'extraction', 'validation', 'body', 'dummyjson'],
    liveApis: ['dummyjson.com'],
    scenarioCount: 3,
    mapperSurfaces: ['extraction', 'validation', 'body'],
    factory: createComboMapperSample,
  },
];
