/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { listBundledProtoPaths, PROTO_WKT_BUNDLE } from './protoWktBundle.js';

describe('protoWktBundle coverage gaps', () => {
  it('lists bundled proto paths in sorted order', () => {
    const paths = listBundledProtoPaths();
    expect(paths.length).toBeGreaterThan(5);
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
    expect(paths.every((path) => PROTO_WKT_BUNDLE[path]?.includes('syntax'))).toBe(true);
  });
});
