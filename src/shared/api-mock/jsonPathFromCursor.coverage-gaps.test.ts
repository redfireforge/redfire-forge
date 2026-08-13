import { describe, expect, it, vi, afterEach } from 'vitest';
import { jsonPathFromCursorOffset, jsonPathFromSelection } from './jsonPathFromCursor';

describe('jsonPathFromCursor coverage gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when span walking fails despite JSON.parse succeeding', () => {
    vi.spyOn(JSON, 'parse').mockReturnValue({});
    expect(jsonPathFromCursorOffset('', 0)).toBeNull();
    expect(jsonPathFromSelection('', 0, 1)).toBeNull();
  });

  it('returns null when object keys are malformed in the source walker', () => {
    vi.spyOn(JSON, 'parse').mockReturnValue({ a: 1 });
    expect(jsonPathFromCursorOffset('{a:1}', 1)).toBeNull();
  });

  it('handles truncated unicode escapes in string literals', () => {
    vi.spyOn(JSON, 'parse').mockReturnValue({ t: 'u' });
    const json = '{"t":"\\u12"}';
    expect(jsonPathFromCursorOffset(json, json.indexOf('\\u'))).toMatchObject({
      path: '$.t',
    });
  });

  it('handles a dangling backslash before the closing quote', () => {
    vi.spyOn(JSON, 'parse').mockReturnValue({ t: 'x' });
    const json = '{"t":"x\\';
    expect(jsonPathFromCursorOffset(json, json.indexOf('x'))).toMatchObject({
      path: '$.t',
    });
  });

  it('skips a leading comma and fails a truncated object inside an array', () => {
    expect(jsonPathFromCursorOffset('[]', 0)?.path).toBe('$');
    vi.spyOn(JSON, 'parse').mockReturnValue([1]);
    expect(jsonPathFromCursorOffset('[1,]', 2)?.path).toBe('$[0]');
    expect(jsonPathFromCursorOffset('[,1]', 2)?.path).toBe('$[1]');
    vi.spyOn(JSON, 'parse').mockReturnValue([{}]);
    expect(jsonPathFromCursorOffset('[{]', 0)).toBeNull();
  });
});
