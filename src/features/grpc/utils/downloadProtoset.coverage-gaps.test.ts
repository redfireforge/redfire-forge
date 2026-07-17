/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { downloadProtosetFile } from './downloadProtoset';

describe('downloadProtoset coverage gaps', () => {
  it('downloads a protoset blob and appends .pb when needed', () => {
    const click = vi.fn();
    const anchor = {
      href: '',
      download: '',
      style: { display: '' },
      click,
      remove: vi.fn(),
    };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor as unknown as HTMLAnchorElement);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor as unknown as Node);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:protoset');

    downloadProtosetFile(btoa('abc'), 'exported');

    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(anchor.download).toBe('exported.pb');
    expect(click).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:protoset');

    createElementSpy.mockRestore();
    appendSpy.mockRestore();
    revokeSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
  });

  it('rejects invalid base64 payloads', () => {
    expect(() => downloadProtosetFile('%%%', 'broken.pb')).toThrow(/Invalid protoset payload/i);
  });

  it('preserves .protoset extension when provided', () => {
    const click = vi.fn();
    const anchor = {
      href: '',
      download: '',
      style: { display: '' },
      click,
      remove: vi.fn(),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(anchor as unknown as HTMLAnchorElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor as unknown as Node);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:protoset');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    downloadProtosetFile(btoa('abc'), 'bundle.protoset');
    expect(anchor.download).toBe('bundle.protoset');
  });
});
