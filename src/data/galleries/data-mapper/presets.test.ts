import { describe, it, expect } from 'vitest';
import {
  buildPresetScenario,
  createExtractionMappingSample,
  createValidationMappingSample,
  createBodyBuilderMappingSample,
  createMultiStepChainSample,
  createComboMapperSample,
} from './presets';
import { dataMapperSampleCatalog } from './index';

describe('Data Mapper presets', () => {
  it('buildPresetScenario defaults validation mode to none without assertions', () => {
    const scenario = buildPresetScenario({
      id: 't-none',
      name: 'No assertions',
      url: 'https://example.com/x',
      method: 'GET',
    });
    expect(scenario.validation.mode).toBe('none');
    expect(scenario.validation.assertions).toBeUndefined();
  });

  it('buildPresetScenario sets validation mode full when assertions are present', () => {
    const scenario = buildPresetScenario({
      id: 't-full',
      name: 'With assertions',
      url: 'https://example.com/y',
      method: 'GET',
      assertions: [{ type: 'status', expected: '200' }],
    });
    expect(scenario.validation.mode).toBe('full');
  });

  it('catalog has 5 entries', () => {
    expect(dataMapperSampleCatalog).toHaveLength(5);
  });

  it('all entries have domain data-mapper', () => {
    for (const entry of dataMapperSampleCatalog) {
      expect(entry.domain).toBe('data-mapper');
    }
  });

  it('all entries produce a FeatureGroup via factory', () => {
    for (const entry of dataMapperSampleCatalog) {
      const fg = entry.factory();
      expect(fg).toHaveProperty('id');
      expect(fg).toHaveProperty('name');
      expect(fg).toHaveProperty('scenarios');
      expect(fg.scenarios.length).toBeGreaterThan(0);
    }
  });

  it('entry IDs match their factory output IDs', () => {
    for (const entry of dataMapperSampleCatalog) {
      const fg = entry.factory();
      expect(fg.id).toBe(entry.id);
    }
  });

  describe('createExtractionMappingSample', () => {
    const fg = createExtractionMappingSample();

    it('has 1 test scenario with 2 requests', () => {
      expect(fg.scenarios).toHaveLength(1);
      expect(fg.scenarios[0].tests).toHaveLength(2);
    });

    it('first request has 5 extractions', () => {
      const first = fg.scenarios[0].tests[0];
      expect(first.extractions).toHaveLength(5);
    });

    it('second request uses extracted variable in URL', () => {
      const second = fg.scenarios[0].tests[1];
      expect(second.url).toContain('{{userId}}');
    });
  });

  describe('createValidationMappingSample', () => {
    const fg = createValidationMappingSample();

    it('uses selective validation mode', () => {
      const sc = fg.scenarios[0].tests[0];
      expect(sc.validation?.mode).toBe('selective');
      expect(sc.validation?.selectiveMode).toBe('include');
    });

    it('validates 5 expected fields', () => {
      const sc = fg.scenarios[0].tests[0];
      expect(sc.validation?.expectedFields).toHaveLength(5);
    });

    it('includes sampleJson for target tree', () => {
      const sc = fg.scenarios[0].tests[0];
      expect(sc.validation?.sampleJson).toBeTruthy();
      const parsed = JSON.parse(sc.validation!.sampleJson!);
      expect(parsed).toHaveProperty('title');
      expect(parsed).toHaveProperty('price');
    });
  });

  describe('createBodyBuilderMappingSample', () => {
    const fg = createBodyBuilderMappingSample();

    it('has a POST request with body template', () => {
      const tests = fg.scenarios[0].tests;
      const post = tests.find(t => t.method === 'POST');
      expect(post).toBeDefined();
      expect(post!.body).toContain('{{userName}}');
      expect(post!.body).toContain('{{userEmail}}');
    });

    it('first request extracts 6 fields for the body', () => {
      const first = fg.scenarios[0].tests[0];
      expect(first.extractions).toHaveLength(6);
    });
  });

  describe('createMultiStepChainSample', () => {
    const fg = createMultiStepChainSample();

    it('has 3 chained requests', () => {
      expect(fg.scenarios[0].tests).toHaveLength(3);
    });

    it('step 2 uses {{userId}} from step 1', () => {
      expect(fg.scenarios[0].tests[1].url).toContain('{{userId}}');
    });

    it('step 3 uses {{postId}} from step 2', () => {
      expect(fg.scenarios[0].tests[2].url).toContain('{{postId}}');
    });

    it('step 3 has a regex assertion on email', () => {
      const assertions = fg.scenarios[0].tests[2].validation?.assertions;
      const regex = assertions?.find(a => a.type === 'regex');
      expect(regex).toBeDefined();
    });
  });

  describe('createComboMapperSample', () => {
    const fg = createComboMapperSample();

    it('has 3 requests covering extract, search, and post', () => {
      expect(fg.scenarios[0].tests).toHaveLength(3);
    });

    it('first request has both extractions and selective validation', () => {
      const first = fg.scenarios[0].tests[0];
      expect(first.extractions).toBeDefined();
      expect(first.extractions!.length).toBeGreaterThan(0);
      expect(first.validation?.mode).toBe('selective');
    });

    it('POST body uses extracted variables', () => {
      const post = fg.scenarios[0].tests[2];
      expect(post.body).toContain('{{firstProductName}}');
      expect(post.body).toContain('{{firstProductId}}');
    });
  });
});
