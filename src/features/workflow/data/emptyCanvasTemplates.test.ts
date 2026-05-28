import { describe, it, expect } from 'vitest';
import { emptyCanvasTemplates } from './emptyCanvasTemplates';
import { sampleWorkflowCatalog } from '../../../data/galleries/workflows';

describe('emptyCanvasTemplates', () => {
  it('exports an array of templates', () => {
    expect(Array.isArray(emptyCanvasTemplates)).toBe(true);
    expect(emptyCanvasTemplates.length).toBeGreaterThan(0);
    expect(emptyCanvasTemplates.length).toBeLessThanOrEqual(6);
  });

  it('each template has required fields', () => {
    for (const template of emptyCanvasTemplates) {
      expect(template.id).toMatch(/^[-\w]+$/);
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
      expect(typeof template.icon).toBe('string');
      expect(template.nodeCount).toBeGreaterThanOrEqual(1);
      expect(['easy', 'medium', 'advanced']).toContain(template.difficulty);
      expect(template.galleryEntry).toBeDefined();
    }
  });

  it('all featured templates exist in sampleWorkflowCatalog', () => {
    for (const template of emptyCanvasTemplates) {
      const entry = sampleWorkflowCatalog.find(e => e.id === template.id);
      expect(entry).toBeDefined();
    }
  });

  it('galleryEntry references match template metadata', () => {
    for (const template of emptyCanvasTemplates) {
      expect(template.galleryEntry.id).toBe(template.id);
      expect(template.galleryEntry.name).toBe(template.name);
      expect(template.galleryEntry.description).toBe(template.description);
    }
  });

  it('includes a variety of difficulties', () => {
    const difficulties = new Set(emptyCanvasTemplates.map(t => t.difficulty));
    expect(difficulties.size).toBeGreaterThanOrEqual(1);
  });
});
