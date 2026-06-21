import { describe, it, expect } from 'vitest';
import { resolveSaveToCollectionDefaultName } from './graphqlStudioUiUtils';

describe('resolveSaveToCollectionDefaultName', () => {
  it('prefers operation name when present', () => {
    expect(resolveSaveToCollectionDefaultName({ name: 'MyQuery', operationType: 'query' })).toBe('MyQuery');
  });

  it('falls back to operationType when name is missing', () => {
    expect(resolveSaveToCollectionDefaultName({ operationType: 'mutation' })).toBe('mutation');
  });

  it('uses Unnamed operation when both name and operationType are missing', () => {
    expect(resolveSaveToCollectionDefaultName({})).toBe('Unnamed operation');
  });
});
