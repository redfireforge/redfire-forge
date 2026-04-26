/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { downloadCsv } from './csvTemplateCsv';

describe('downloadCsv', () => {
  it('creates a blob URL, clicks a temporary anchor, then revokes the URL', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.fn();
    const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement;
    const createEl = vi.spyOn(document, 'createElement').mockReturnValue(anchor);

    downloadCsv('h1,h2\na,b', 'export.csv');

    expect(createObjectURL).toHaveBeenCalled();
    expect(createEl).toHaveBeenCalledWith('a');
    expect(anchor.download).toBe('export.csv');
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    createEl.mockRestore();
  });
});
