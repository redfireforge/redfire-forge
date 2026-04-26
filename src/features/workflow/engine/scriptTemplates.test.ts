import { describe, it, expect } from 'vitest';
import {
  scriptTemplates,
  SCRIPT_TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  getTemplateById,
} from './scriptTemplates';

describe('scriptTemplates', () => {
  describe('scriptTemplates array', () => {
    it('has at least 10 templates', () => {
      expect(scriptTemplates.length).toBeGreaterThanOrEqual(10);
    });

    it('every template has required fields', () => {
      for (const t of scriptTemplates) {
        expect(t.id).toBeTruthy();
        expect(t.name).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(t.code).toBeTruthy();
        expect(['transform', 'validate', 'generate', 'utility']).toContain(t.category);
        expect(['transform', 'validate', 'generate']).toContain(t.mode);
        expect(Array.isArray(t.inputVariables)).toBe(true);
        expect(Array.isArray(t.outputVariables)).toBe(true);
      }
    });

    it('has unique IDs', () => {
      const ids = scriptTemplates.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('has templates in each category', () => {
      const categories = new Set(scriptTemplates.map(t => t.category));
      expect(categories.has('transform')).toBe(true);
      expect(categories.has('validate')).toBe(true);
      expect(categories.has('generate')).toBe(true);
      expect(categories.has('utility')).toBe(true);
    });
  });

  describe('SCRIPT_TEMPLATE_CATEGORIES', () => {
    it('has all category plus an "all" option', () => {
      const keys = SCRIPT_TEMPLATE_CATEGORIES.map(c => c.key);
      expect(keys).toContain('all');
      expect(keys).toContain('transform');
      expect(keys).toContain('validate');
      expect(keys).toContain('generate');
      expect(keys).toContain('utility');
    });
  });

  describe('getTemplatesByCategory', () => {
    it('returns all templates for "all"', () => {
      expect(getTemplatesByCategory('all')).toEqual(scriptTemplates);
    });

    it('returns only transform templates', () => {
      const result = getTemplatesByCategory('transform');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(t => t.category === 'transform')).toBe(true);
    });

    it('returns only validate templates', () => {
      const result = getTemplatesByCategory('validate');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(t => t.category === 'validate')).toBe(true);
    });

    it('returns only generate templates', () => {
      const result = getTemplatesByCategory('generate');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(t => t.category === 'generate')).toBe(true);
    });

    it('returns only utility templates', () => {
      const result = getTemplatesByCategory('utility');
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(t => t.category === 'utility')).toBe(true);
    });
  });

  describe('getTemplateById', () => {
    it('finds a template by ID', () => {
      const result = getTemplateById('parse-json-response');
      expect(result).toBeDefined();
      expect(result!.name).toBe('Parse JSON Response');
    });

    it('returns undefined for unknown ID', () => {
      expect(getTemplateById('non-existent')).toBeUndefined();
    });
  });
});
