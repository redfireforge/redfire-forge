/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { downloadJson } from './csvTemplateJson';

vi.mock('../../../shared/utils/fileSaver', () => ({
  saveFile: vi.fn().mockResolvedValue(undefined),
}));

describe('downloadJson', () => {
  it('delegates saveFile with JSON blob metadata', async () => {
    const { saveFile } = await import('../../../shared/utils/fileSaver');
    await downloadJson('{"ok":true}', 'data.json');

    expect(saveFile).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({
        filename: 'data.json',
        mimeType: 'application/json',
        description: 'JSON file',
      }),
    );
  });
});
