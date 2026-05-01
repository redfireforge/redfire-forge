import { describe, it, expect } from 'vitest';
import {
  PARAM_PREFIX,
  PATH_PREFIX,
  VALIDATE_PREFIX,
  META_LINE_PREFIX,
} from './csvTemplateTypes';

describe('csvTemplateTypes constants', () => {
  describe('PARAM_PREFIX', () => {
    it('has correct value for query parameter columns', () => {
      expect(PARAM_PREFIX).toBe('param:');
    });

    it('ends with colon', () => {
      expect(PARAM_PREFIX.endsWith(':')).toBe(true);
    });
  });

  describe('PATH_PREFIX', () => {
    it('has correct value for path variable columns', () => {
      expect(PATH_PREFIX).toBe('path:');
    });

    it('ends with colon', () => {
      expect(PATH_PREFIX.endsWith(':')).toBe(true);
    });
  });

  describe('VALIDATE_PREFIX', () => {
    it('has correct value for validation columns', () => {
      expect(VALIDATE_PREFIX).toBe('validate:');
    });

    it('ends with colon', () => {
      expect(VALIDATE_PREFIX.endsWith(':')).toBe(true);
    });
  });

  describe('META_LINE_PREFIX', () => {
    it('has correct value for metadata comment line', () => {
      expect(META_LINE_PREFIX).toBe('#META:');
    });

    it('starts with hash', () => {
      expect(META_LINE_PREFIX.startsWith('#')).toBe(true);
    });

    it('ends with colon', () => {
      expect(META_LINE_PREFIX.endsWith(':')).toBe(true);
    });
  });

  describe('prefix uniqueness', () => {
    it('all prefixes are unique', () => {
      const prefixes = [PARAM_PREFIX, PATH_PREFIX, VALIDATE_PREFIX, META_LINE_PREFIX];
      const uniquePrefixes = new Set(prefixes);
      expect(uniquePrefixes.size).toBe(prefixes.length);
    });

    it('no prefix is substring of another', () => {
      const prefixes = [PARAM_PREFIX, PATH_PREFIX, VALIDATE_PREFIX];
      for (let i = 0; i < prefixes.length; i++) {
        for (let j = 0; j < prefixes.length; j++) {
          if (i !== j) {
            expect(prefixes[i].includes(prefixes[j])).toBe(false);
            expect(prefixes[j].includes(prefixes[i])).toBe(false);
          }
        }
      }
    });
  });

  describe('column prefix usage', () => {
    it('can identify param columns by prefix', () => {
      const columnName = 'param:channel';
      expect(columnName.startsWith(PARAM_PREFIX)).toBe(true);
    });

    it('can identify path columns by prefix', () => {
      const columnName = 'path:vin';
      expect(columnName.startsWith(PATH_PREFIX)).toBe(true);
    });

    it('can identify validate columns by prefix', () => {
      const columnName = 'validate:$.offers[0].name';
      expect(columnName.startsWith(VALIDATE_PREFIX)).toBe(true);
    });

    it('can extract mapping from param column', () => {
      const columnName = 'param:channel';
      const mapping = columnName.substring(PARAM_PREFIX.length);
      expect(mapping).toBe('channel');
    });

    it('can extract mapping from path column', () => {
      const columnName = 'path:userId';
      const mapping = columnName.substring(PATH_PREFIX.length);
      expect(mapping).toBe('userId');
    });

    it('can extract mapping from validate column', () => {
      const columnName = 'validate:$.status';
      const mapping = columnName.substring(VALIDATE_PREFIX.length);
      expect(mapping).toBe('$.status');
    });
  });

  describe('metadata line identification', () => {
    it('can identify metadata comment line', () => {
      const line = '#META:{"version":1,"method":"GET"}';
      expect(line.startsWith(META_LINE_PREFIX)).toBe(true);
    });

    it('can extract metadata JSON from line', () => {
      const line = '#META:{"version":1}';
      const json = line.substring(META_LINE_PREFIX.length);
      expect(json).toBe('{"version":1}');
    });

    it('distinguishes metadata from regular comments', () => {
      const metaLine = '#META:{}';
      const commentLine = '# This is a comment';
      expect(metaLine.startsWith(META_LINE_PREFIX)).toBe(true);
      expect(commentLine.startsWith(META_LINE_PREFIX)).toBe(false);
    });
  });
});
