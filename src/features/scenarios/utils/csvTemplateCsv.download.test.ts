/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { downloadCsv } from './csvTemplateCsv';

describe('downloadCsv', () => {
  it('creates a blob URL, clicks a temporary anchor, then revokes the URL', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.fn();
    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement;
    const createEl = vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    vi.spyOn(document.body, 'appendChild').mockImplementation(appendChild);
    vi.spyOn(document.body, 'removeChild').mockImplementation(removeChild);

    await downloadCsv('h1,h2\na,b', 'export.csv');

    expect(createObjectURL).toHaveBeenCalled();
    expect(createEl).toHaveBeenCalledWith('a');
    expect(anchor.download).toBe('export.csv');
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
    createEl.mockRestore();
  });
});
