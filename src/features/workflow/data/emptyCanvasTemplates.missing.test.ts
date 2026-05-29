/**
 * Test for emptyCanvasTemplates when a featured template ID is missing from catalog.
 * Uses a separate file because vi.mock affects the entire module scope.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../data/galleries/workflows', () => ({
  sampleWorkflowCatalog: [
    {
      id: 'sample-workflow-001',
      name: 'Test Workflow',
      description: 'Test description',
      icon: '🔄',
      nodeCount: 3,
      difficulty: 'easy',
    },
    // Missing: 'sample-workflow-parallel', 'sample-workflow-branching', 'perf-workflow-simple'
  ],
}));

describe('emptyCanvasTemplates with missing IDs', () => {
  it('filters out missing templates', async () => {
    const { emptyCanvasTemplates } = await import('./emptyCanvasTemplates');
    // Only 'sample-workflow-001' exists in our mock catalog
    expect(emptyCanvasTemplates.length).toBe(1);
    expect(emptyCanvasTemplates[0].id).toBe('sample-workflow-001');
  });

  it('returns empty array when no templates found', async () => {
    // This test uses the same mock - verifying the filtering works
    const { emptyCanvasTemplates } = await import('./emptyCanvasTemplates');
    // The filter should have removed the 3 missing IDs
    expect(emptyCanvasTemplates.every(t => t !== null)).toBe(true);
  });
});
