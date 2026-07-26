/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadWorkflowPreviews,
  saveWorkflowPreviews,
  addWorkflowPreview,
  removeWorkflowPreview,
  clearAllPreviews,
  isPreviewedEndpoint,
  getPreviewedEndpointIds,
  getPreviewEntriesForPalette,
} from './workflowPreviewStorage';
import type { WorkflowPreviewEntry, PreviewMap } from './workflowPreviewStorage';

const readKeyMock = vi.hoisted(() => vi.fn());
const writeKeyMock = vi.hoisted(() => vi.fn());

vi.mock('./storage', () => ({
  readKey: readKeyMock,
  writeKey: writeKeyMock,
}));

const makePreview = (overrides: Partial<WorkflowPreviewEntry> = {}): WorkflowPreviewEntry => ({
  entryId: 'entry1',
  endpointId: 'ep1',
  method: 'POST',
  path: '/posts',
  summary: 'Create Post',
  entryName: 'My API',
  addedAt: 1000,
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  writeKeyMock.mockResolvedValue(undefined);
});

describe('workflowPreviewStorage', () => {
  describe('loadWorkflowPreviews', () => {
    it('returns empty map when no data stored', async () => {
      readKeyMock.mockResolvedValue(null);
      expect(await loadWorkflowPreviews()).toEqual({});
    });

    it('returns empty map when stored data is invalid JSON', async () => {
      readKeyMock.mockResolvedValue('not-json');
      expect(await loadWorkflowPreviews()).toEqual({});
    });

    it('returns parsed map when valid data exists', async () => {
      const data: PreviewMap = { 'e1::ep1': makePreview() };
      readKeyMock.mockResolvedValue(JSON.stringify(data));
      const result = await loadWorkflowPreviews();
      expect(result).toEqual(data);
    });
  });

  describe('saveWorkflowPreviews', () => {
    it('writes serialized map to storage', async () => {
      const map: PreviewMap = { 'e1::ep1': makePreview() };
      await saveWorkflowPreviews(map);
      expect(writeKeyMock).toHaveBeenCalledWith(
        'perf-test-v3-workflow-previews',
        JSON.stringify(map),
      );
    });
  });

  describe('addWorkflowPreview', () => {
    it('adds a preview to existing map', async () => {
      const existing: PreviewMap = { 'e1::ep1': makePreview() };
      readKeyMock.mockResolvedValue(JSON.stringify(existing));

      const newPreview = makePreview({ entryId: 'e2', endpointId: 'ep2' });
      await addWorkflowPreview(newPreview);

      const written = JSON.parse(writeKeyMock.mock.calls[0][1]) as PreviewMap;
      expect(written['e1::ep1']).toBeDefined();
      expect(written['e2::ep2']).toEqual(newPreview);
    });

    it('adds to empty map', async () => {
      readKeyMock.mockResolvedValue(null);
      const preview = makePreview();
      await addWorkflowPreview(preview);

      const written = JSON.parse(writeKeyMock.mock.calls[0][1]) as PreviewMap;
      expect(written['entry1::ep1']).toEqual(preview);
    });
  });

  describe('removeWorkflowPreview', () => {
    it('removes the specified entry', async () => {
      const map: PreviewMap = {
        'e1::ep1': makePreview(),
        'e1::ep2': makePreview({ endpointId: 'ep2' }),
      };
      readKeyMock.mockResolvedValue(JSON.stringify(map));

      await removeWorkflowPreview('e1', 'ep1');

      const written = JSON.parse(writeKeyMock.mock.calls[0][1]) as PreviewMap;
      expect(written['e1::ep1']).toBeUndefined();
      expect(written['e1::ep2']).toBeDefined();
    });

    it('handles removing non-existent entry gracefully', async () => {
      readKeyMock.mockResolvedValue('{}');
      await removeWorkflowPreview('nope', 'nope');
      expect(writeKeyMock).toHaveBeenCalled();
    });
  });

  describe('clearAllPreviews', () => {
    it('writes empty map', async () => {
      await clearAllPreviews();
      expect(writeKeyMock).toHaveBeenCalledWith('perf-test-v3-workflow-previews', '{}');
    });
  });

  describe('isPreviewedEndpoint', () => {
    it('returns true when entry exists in map', () => {
      const map: PreviewMap = { 'e1::ep1': makePreview() };
      expect(isPreviewedEndpoint(map, 'e1', 'ep1')).toBe(true);
    });

    it('returns false when entry does not exist', () => {
      const map: PreviewMap = { 'e1::ep1': makePreview() };
      expect(isPreviewedEndpoint(map, 'e1', 'ep2')).toBe(false);
    });
  });

  describe('getPreviewedEndpointIds', () => {
    it('returns endpoint IDs for a given entry', () => {
      const map: PreviewMap = {
        'entry1::ep1': makePreview(),
        'entry1::ep2': makePreview({ endpointId: 'ep2' }),
        'e2::ep3': makePreview({ entryId: 'e2', endpointId: 'ep3' }),
      };
      const ids = getPreviewedEndpointIds(map, 'entry1');
      expect(ids).toEqual(new Set(['ep1', 'ep2']));
    });

    it('returns empty set when no previews for entry', () => {
      const ids = getPreviewedEndpointIds({}, 'e1');
      expect(ids.size).toBe(0);
    });

    it('ignores malformed composite keys without endpoint id', () => {
      const malformed = {
        'entry1::': makePreview({ entryId: 'entry1', endpointId: 'ignored' }),
      } as PreviewMap;
      const ids = getPreviewedEndpointIds(malformed, 'entry1');
      expect(ids.size).toBe(0);
    });
  });

  describe('getPreviewEntriesForPalette', () => {
    it('returns all preview entries as array', () => {
      const p1 = makePreview();
      const p2 = makePreview({ entryId: 'e2', endpointId: 'ep2' });
      const map: PreviewMap = { 'e1::ep1': p1, 'e2::ep2': p2 };
      const result = getPreviewEntriesForPalette(map);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(p1);
      expect(result).toContainEqual(p2);
    });

    it('returns empty array for empty map', () => {
      expect(getPreviewEntriesForPalette({})).toEqual([]);
    });
  });
});
