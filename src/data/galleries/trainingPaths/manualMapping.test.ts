import { describe, it, expect } from 'vitest';
import { getRelatedManuals, manualsBySampleId } from './manualMapping';

describe('manualMapping', () => {
  it('builds a non-empty sample-id index at module load', () => {
    expect(Object.keys(manualsBySampleId).length).toBeGreaterThan(0);
  });

  it('getRelatedManuals returns manuals for a known sample id', () => {
    const sampleId = Object.keys(manualsBySampleId)[0];
    expect(sampleId).toBeTruthy();
    const manuals = getRelatedManuals(sampleId!);
    expect(manuals).toBeDefined();
    expect(manuals!.length).toBeGreaterThan(0);
    expect(manuals![0]).toMatchObject({
      title: expect.any(String),
      path: expect.any(String),
    });
  });

  it('getRelatedManuals returns undefined for unknown sample ids', () => {
    expect(getRelatedManuals('__missing-sample-id__')).toBeUndefined();
  });

  it('maps each indexed manual with title, description, difficulty, and path', () => {
    for (const manuals of Object.values(manualsBySampleId)) {
      for (const manual of manuals) {
        expect(manual.title.length).toBeGreaterThan(0);
        expect(manual.path.length).toBeGreaterThan(0);
        expect(manual.difficulty).toBeTruthy();
      }
    }
  });
});
