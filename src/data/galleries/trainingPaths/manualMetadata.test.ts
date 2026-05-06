import { describe, it, expect } from 'vitest';
import { manualMetadata, metadataByPath, getManualMetadata } from './manualMetadata';

describe('manualMetadata', () => {
  it('exposes a Map with one entry per manual', () => {
    expect(metadataByPath.size).toBe(manualMetadata.length);
  });

  it('getManualMetadata returns metadata for known paths', () => {
    const meta = getManualMetadata('requests/get-all-users-easy.html');
    expect(meta).toBeDefined();
    expect(meta!.manualPath).toBe('requests/get-all-users-easy.html');
    expect(typeof meta!.addedAt).toBe('number');
  });

  it('getManualMetadata returns undefined for unknown paths', () => {
    expect(getManualMetadata('missing/does-not-exist.html')).toBeUndefined();
  });
});
