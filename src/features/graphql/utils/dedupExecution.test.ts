/**
 * dedupExecution.test.ts — Phase 3F unit tests
 *
 * Tests for:
 *   - djb2: basic hash properties
 *   - buildDedupKey: key construction, variable ordering
 *   - registerInFlight / getInFlight / removeInFlight
 *   - handleDedupGuard: no-duplicate, wait, cancel, sendAnyway
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  djb2,
  buildDedupKey,
  registerInFlight,
  getInFlight,
  removeInFlight,
  handleDedupGuard,
  _clearInFlightMap,
  _inFlightCount,
} from './dedupExecution';
import type { GraphqlResponse } from '@shared/types/graphql';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(resolveValue?: Partial<GraphqlResponse>) {
  const controller = new AbortController();
  const response: GraphqlResponse = {
    httpStatus: 200,
    httpHeaders: {},
    latencyMs: 10,
    timestamp: Date.now(),
    data: { ok: true },
    ...resolveValue,
  };
  const promise = Promise.resolve(response);
  return { controller, promise, response };
}

// ─── djb2 ────────────────────────────────────────────────────────────────────

describe('djb2', () => {
  it('returns a hexadecimal string', () => {
    expect(djb2('hello')).toMatch(/^[0-9a-f]+$/);
  });

  it('same input → same hash', () => {
    expect(djb2('abc')).toBe(djb2('abc'));
  });

  it('different inputs → different hashes (for typical strings)', () => {
    expect(djb2('hello')).not.toBe(djb2('world'));
  });

  it('empty string does not throw and returns a string', () => {
    expect(typeof djb2('')).toBe('string');
  });

  it('handles long strings without throwing', () => {
    const long = 'x'.repeat(50000);
    expect(typeof djb2(long)).toBe('string');
  });
});

// ─── buildDedupKey ────────────────────────────────────────────────────────────

describe('buildDedupKey', () => {
  it('returns a string', () => {
    expect(typeof buildDedupKey('conn1', '{ hello }', {})).toBe('string');
  });

  it('same inputs → same key', () => {
    const k1 = buildDedupKey('conn1', '{ hello }', { id: '1' });
    const k2 = buildDedupKey('conn1', '{ hello }', { id: '1' });
    expect(k1).toBe(k2);
  });

  it('variable key order does not affect the key', () => {
    const k1 = buildDedupKey('conn1', '{ hello }', { a: 1, b: 2 });
    const k2 = buildDedupKey('conn1', '{ hello }', { b: 2, a: 1 });
    expect(k1).toBe(k2);
  });

  it('different connectionId → different key (prevents cross-endpoint collision)', () => {
    const k1 = buildDedupKey('conn1', '{ hello }', {});
    const k2 = buildDedupKey('conn2', '{ hello }', {});
    expect(k1).not.toBe(k2);
  });

  it('different query → different key', () => {
    const k1 = buildDedupKey('conn1', '{ hello }', {});
    const k2 = buildDedupKey('conn1', '{ world }', {});
    expect(k1).not.toBe(k2);
  });

  it('different variables → different key', () => {
    const k1 = buildDedupKey('conn1', '{ hello }', { id: '1' });
    const k2 = buildDedupKey('conn1', '{ hello }', { id: '2' });
    expect(k1).not.toBe(k2);
  });

  it('normalises query whitespace — same logical query → same key', () => {
    const k1 = buildDedupKey('conn1', '{ hello }', {});
    const k2 = buildDedupKey('conn1', '{  hello  }', {});
    expect(k1).toBe(k2);
  });

  it('falls back gracefully on invalid query syntax', () => {
    // Should not throw; uses raw string as fallback
    expect(() => buildDedupKey('conn1', 'NOT VALID %%%', {})).not.toThrow();
  });
});

// ─── registerInFlight / getInFlight / removeInFlight ─────────────────────────

describe('in-flight store', () => {
  beforeEach(() => { _clearInFlightMap(); });

  it('registerInFlight makes an entry findable via getInFlight', () => {
    const { controller, promise } = makeEntry();
    registerInFlight('key1', { controller, promise });
    const found = getInFlight('key1');
    expect(found).toBeDefined();
    expect(found?.controller).toBe(controller);
    expect(found?.promise).toBe(promise);
  });

  it('removeInFlight deletes the entry', () => {
    const { controller, promise } = makeEntry();
    registerInFlight('key2', { controller, promise });
    removeInFlight('key2');
    expect(getInFlight('key2')).toBeUndefined();
  });

  it('_inFlightCount reflects store size', () => {
    const e1 = makeEntry();
    const e2 = makeEntry();
    registerInFlight('a', { controller: e1.controller, promise: e1.promise });
    registerInFlight('b', { controller: e2.controller, promise: e2.promise });
    expect(_inFlightCount()).toBe(2);
    removeInFlight('a');
    expect(_inFlightCount()).toBe(1);
  });

  it('getInFlight returns undefined for missing key', () => {
    expect(getInFlight('nonexistent')).toBeUndefined();
  });
});

// ─── handleDedupGuard ────────────────────────────────────────────────────────

describe('handleDedupGuard', () => {
  beforeEach(() => { _clearInFlightMap(); });

  it('no duplicate → isDuplicate=false, waitPromise=undefined', () => {
    const result = handleDedupGuard('missing-key', 'wait');
    expect(result.isDuplicate).toBe(false);
    expect(result.waitPromise).toBeUndefined();
  });

  it('wait choice → isDuplicate=true, returns the existing promise without aborting', () => {
    const { controller, promise } = makeEntry();
    registerInFlight('dup1', { controller, promise });

    const result = handleDedupGuard('dup1', 'wait');

    expect(result.isDuplicate).toBe(true);
    expect(result.waitPromise).toBe(promise);
    // Controller should NOT be aborted
    expect(controller.signal.aborted).toBe(false);
    // Entry still in map (wait does not remove it)
    expect(getInFlight('dup1')).toBeDefined();
  });

  it('cancel choice → isDuplicate=true, aborts controller, removes entry', () => {
    const { controller, promise } = makeEntry();
    registerInFlight('dup2', { controller, promise });

    const result = handleDedupGuard('dup2', 'cancel');

    expect(result.isDuplicate).toBe(true);
    expect(result.waitPromise).toBeUndefined(); // caller fires fresh
    expect(controller.signal.aborted).toBe(true);
    expect(getInFlight('dup2')).toBeUndefined();
  });

  it('sendAnyway choice → isDuplicate=true, does NOT abort, entry stays', () => {
    const { controller, promise } = makeEntry();
    registerInFlight('dup3', { controller, promise });

    const result = handleDedupGuard('dup3', 'sendAnyway');

    expect(result.isDuplicate).toBe(true);
    expect(result.waitPromise).toBeUndefined();
    expect(controller.signal.aborted).toBe(false);
    expect(getInFlight('dup3')).toBeDefined();
  });

  it('default choice is wait', () => {
    const { controller, promise } = makeEntry();
    registerInFlight('dup4', { controller, promise });

    // Call without second argument → defaults to 'wait'
    const result = handleDedupGuard('dup4');

    expect(result.isDuplicate).toBe(true);
    expect(result.waitPromise).toBe(promise);
    expect(controller.signal.aborted).toBe(false);
  });

  it('wait: AbortController isolation — waiter cannot cancel the shared controller', async () => {
    // The caller receives the shared promise. They must manage their own abort
    // via their own AbortController; aborting their controller should not affect
    // the shared one (since wait just returns the reference to the promise, not
    // the controller). Verify by checking the shared controller stays unaborted.
    const { controller, promise } = makeEntry();
    registerInFlight('dup5', { controller, promise });

    const result = handleDedupGuard('dup5', 'wait');
    expect(result.waitPromise).toBe(promise);

    // Waiter creates its own independent controller
    const waiterCtrl = new AbortController();
    waiterCtrl.abort(); // aborts the waiter's own request

    // Shared controller stays alive
    expect(controller.signal.aborted).toBe(false);
  });

  it('_clearInFlightMap removes all entries', () => {
    registerInFlight('x', makeEntry());
    registerInFlight('y', makeEntry());
    _clearInFlightMap();
    expect(_inFlightCount()).toBe(0);
  });

  it('rejection propagation: all waiters receive the shared rejection', async () => {
    // When the original request rejects, all waiters that received the shared promise
    // (via 'wait' choice) should also reject.
    let rejectOriginal!: (err: unknown) => void;
    const promise = new Promise<GraphqlResponse>((_, rej) => { rejectOriginal = rej; });
    const controller = new AbortController();
    registerInFlight('reject-test', { controller, promise });

    // Two waiters subscribe to the shared promise
    const result1 = handleDedupGuard('reject-test', 'wait');
    const result2 = handleDedupGuard('reject-test', 'wait');

    // Reject the original
    const err = new Error('network failure');
    rejectOriginal(err);

    // Both waiters should get the same rejection
    await expect(result1.waitPromise).rejects.toThrow('network failure');
    await expect(result2.waitPromise).rejects.toThrow('network failure');
  });

  it('within-tab isolation: different keys do not cross-deduplicate', () => {
    // Two different queries (different keys) should never interfere.
    const entry1 = makeEntry();
    const entry2 = makeEntry();
    registerInFlight('key-A', entry1);
    registerInFlight('key-B', entry2);

    // Looking up key-A should NOT return entry2
    expect(getInFlight('key-A')).toBe(entry1);
    expect(getInFlight('key-B')).toBe(entry2);
    expect(getInFlight('key-A')).not.toBe(entry2);
  });

  it('connectionId in key: same query to two different connections produces different keys', () => {
    const query = '{ user { id } }';
    const vars = {};
    const keyA = buildDedupKey('conn-alpha', query, vars);
    const keyB = buildDedupKey('conn-beta', query, vars);

    // Different connectionIds MUST produce different keys to prevent cross-connection dedup
    expect(keyA).not.toBe(keyB);
  });

  it('operationName in key: same document with different named operations produces different keys', () => {
    // Multi-operation document — only the operationName differs
    const doc = '{ userA: user { id } } { userB: user { name } }';
    const vars = {};
    const keyA = buildDedupKey('conn1', doc, vars, 'GetUserA');
    const keyB = buildDedupKey('conn1', doc, vars, 'GetUserB');

    expect(keyA).not.toBe(keyB);
  });

  it('omitting operationName produces same key as null operationName', () => {
    const query = '{ hello }';
    const keyNoOp = buildDedupKey('conn1', query, {});
    const keyNullOp = buildDedupKey('conn1', query, {}, null);

    expect(keyNoOp).toBe(keyNullOp);
  });

  it('cancel-then-replace: replacement promise identity check prevents original finally from clobbering replacement entry', () => {
    // Regression test for the bug where the original request's finally block ran
    // removeInFlight() AFTER the replacement registered under the same key, causing
    // the replacement's dedup entry to be deleted prematurely.
    //
    // The fix in useGraphqlExecution.ts: in the finally block, only call removeInFlight
    // if getInFlight(dedupKey) returns undefined (already removed) OR its promise is
    // the original's own promise.
    //
    // This test validates the in-flight map primitives behave correctly for that pattern.

    const key = buildDedupKey('conn1', '{ users { id } }', {});

    // Step 1: Original registers
    const origEntry = makeEntry();
    registerInFlight(key, { controller: origEntry.controller, promise: origEntry.promise });
    expect(getInFlight(key)?.promise).toBe(origEntry.promise);

    // Step 2: 'cancel' choice — handleDedupGuard removes original entry and aborts it
    handleDedupGuard(key, 'cancel');
    expect(getInFlight(key)).toBeUndefined();

    // Step 3: Replacement registers under the same key
    const replEntry = makeEntry();
    registerInFlight(key, { controller: replEntry.controller, promise: replEntry.promise });
    expect(getInFlight(key)?.promise).toBe(replEntry.promise);

    // Step 4: Original's finally runs — ownership check: entry.promise !== origEntry.promise
    const currentEntry = getInFlight(key);
    const isOriginalOwner = !currentEntry || currentEntry.promise === origEntry.promise;
    // The original does NOT own the entry any more → must NOT remove it
    expect(isOriginalOwner).toBe(false);

    // Verify the replacement entry is still intact after the original skips its removal
    expect(getInFlight(key)?.promise).toBe(replEntry.promise);

    // Step 5: Replacement's finally runs — ownership check: entry.promise === replEntry.promise
    const currentEntry2 = getInFlight(key);
    const isReplacementOwner = !currentEntry2 || currentEntry2.promise === replEntry.promise;
    expect(isReplacementOwner).toBe(true);
    removeInFlight(key); // replacement correctly removes its own entry
    expect(getInFlight(key)).toBeUndefined();
  });
});
