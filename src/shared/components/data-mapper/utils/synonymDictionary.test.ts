import { describe, it, expect } from 'vitest';
import { areSynonyms, getSynonyms, BUILT_IN_SYNONYM_GROUPS } from './synonymDictionary';

describe('synonymDictionary', () => {
  describe('areSynonyms', () => {
    it('returns true for exact same word', () => {
      expect(areSynonyms('email', 'email')).toBe(true);
    });

    it('returns true for known synonym pair', () => {
      expect(areSynonyms('qty', 'quantity')).toBe(true);
      expect(areSynonyms('quantity', 'qty')).toBe(true);
    });

    it('returns true for fname ↔ firstname', () => {
      expect(areSynonyms('fname', 'firstname')).toBe(true);
    });

    it('returns true for lname ↔ surname', () => {
      expect(areSynonyms('lname', 'surname')).toBe(true);
    });

    it('returns true for dob ↔ dateofbirth', () => {
      expect(areSynonyms('dob', 'dateofbirth')).toBe(true);
    });

    it('returns true for addr ↔ address', () => {
      expect(areSynonyms('addr', 'address')).toBe(true);
    });

    it('returns true for tel ↔ phone', () => {
      expect(areSynonyms('tel', 'phone')).toBe(true);
    });

    it('returns true for img ↔ image', () => {
      expect(areSynonyms('img', 'image')).toBe(true);
    });

    it('returns true for msrp ↔ price', () => {
      expect(areSynonyms('msrp', 'price')).toBe(true);
    });

    it('returns true for desc ↔ description', () => {
      expect(areSynonyms('desc', 'description')).toBe(true);
    });

    it('returns false for unrelated words', () => {
      expect(areSynonyms('email', 'phone')).toBe(false);
    });

    it('returns false for unknown word', () => {
      expect(areSynonyms('xyzzy', 'plugh')).toBe(false);
    });

    it('handles timestamp ↔ ts', () => {
      expect(areSynonyms('timestamp', 'ts')).toBe(true);
    });

    it('handles latitude ↔ lat', () => {
      expect(areSynonyms('latitude', 'lat')).toBe(true);
    });

    it('does not cross-match "state" (geographic) with "status"', () => {
      expect(areSynonyms('state', 'status')).toBe(false);
    });

    it('does not cross-match "num" (quantity) with "number"', () => {
      expect(areSynonyms('num', 'number')).toBe(false);
    });

    it('synonym lookups are symmetric', () => {
      const pairs: [string, string][] = [
        ['qty', 'quantity'], ['fname', 'firstname'], ['tel', 'phone'],
        ['addr', 'address'], ['img', 'image'], ['desc', 'description'],
        ['lat', 'latitude'], ['ts', 'timestamp'], ['msrp', 'price'],
      ];
      for (const [a, b] of pairs) {
        expect(areSynonyms(a, b)).toBe(true);
        expect(areSynonyms(b, a)).toBe(true);
      }
    });
  });

  describe('getSynonyms', () => {
    it('returns set containing all group members', () => {
      const syns = getSynonyms('phone');
      expect(syns).toBeDefined();
      expect(syns!.has('tel')).toBe(true);
      expect(syns!.has('mobile')).toBe(true);
      expect(syns!.has('phone')).toBe(true);
    });

    it('returns undefined for unknown word', () => {
      expect(getSynonyms('xyznonexistent')).toBeUndefined();
    });

    it('all words in a group share the same Set instance', () => {
      const phoneSet = getSynonyms('phone');
      const telSet = getSynonyms('tel');
      expect(phoneSet).toBe(telSet);
    });
  });

  describe('BUILT_IN_SYNONYM_GROUPS', () => {
    it('is a non-empty array', () => {
      expect(BUILT_IN_SYNONYM_GROUPS.length).toBeGreaterThan(10);
    });

    it('every group has at least 2 members', () => {
      for (const group of BUILT_IN_SYNONYM_GROUPS) {
        expect(group.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('all entries are lowercase', () => {
      for (const group of BUILT_IN_SYNONYM_GROUPS) {
        for (const word of group) {
          expect(word).toBe(word.toLowerCase());
        }
      }
    });

    it('no word appears in multiple groups', () => {
      const seen = new Map<string, number>();
      for (let i = 0; i < BUILT_IN_SYNONYM_GROUPS.length; i++) {
        for (const word of BUILT_IN_SYNONYM_GROUPS[i]) {
          expect(seen.has(word)).toBe(false);
          seen.set(word, i);
        }
      }
    });
  });
});
