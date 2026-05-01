import { describe, expect, it } from 'vitest';
import { addMappingEntry, removeMappingEntry, updateMappingEntry } from './workflowMappingUtils';

describe('workflowMappingUtils', () => {
  it('updates a mapping field without mutating sibling entries', () => {
    const mappings = [
      { sourceExpression: '{{userId}}', targetVariable: 'user_id' },
      { sourceExpression: '{{token}}', targetVariable: 'auth_token' },
    ];

    expect(updateMappingEntry(mappings, 1, 'targetVariable', 'session_token')).toEqual([
      { sourceExpression: '{{userId}}', targetVariable: 'user_id' },
      { sourceExpression: '{{token}}', targetVariable: 'session_token' },
    ]);
  });

  it('appends a new empty mapping entry', () => {
    expect(addMappingEntry([], { sourceVariable: '', targetVariable: '' })).toEqual([
      { sourceVariable: '', targetVariable: '' },
    ]);
  });

  it('removes only the requested mapping entry', () => {
    const mappings = [
      { sourceVariable: 'first', targetVariable: 'a' },
      { sourceVariable: 'second', targetVariable: 'b' },
    ];

    expect(removeMappingEntry(mappings, 0)).toEqual([
      { sourceVariable: 'second', targetVariable: 'b' },
    ]);
  });
});