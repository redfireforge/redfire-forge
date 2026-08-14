/**
 * API Mock Studio — live scenario-state tracking in the listener (Phase 7 runtime).
 * Verifies state-mode responses advance server state + counters and that reset clears them.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { ApiMockNetworkListener } from './ApiMockNetworkListener';
import { DEFAULT_SETTINGS } from '../../src/shared/api-mock/defaults';
import type { ApiMockServerDefinitionV1 } from '../../src/shared/api-mock/contracts';

const ts = '2026-08-12T00:00:00.000Z';
let nextPort = 20_700 + Math.floor(Math.random() * 200);
const getPort = () => nextPort++;

function stateDef(port: number): ApiMockServerDefinitionV1 {
  return {
    id: 'srv-state', name: 'State', enabled: true, host: '127.0.0.1',
    port, basePath: '', folders: [], variables: [], samples: [],
    routes: [{
      id: 'r1', name: 'Advance', enabled: true, method: 'POST',
      path: { kind: 'exact', value: '/advance' }, priority: 10,
      predicates: { id: 'pg', combinator: 'all', children: [] },
      responseMode: 'state',
      responses: [{
        id: 'v1', name: 'default', enabled: true, isDefault: true, status: 200,
        headers: [], cookies: [],
        body: { kind: 'json', content: '{"ok":true}', contentType: 'application/json' },
        behavior: { delayMs: 0, jitterMs: 0 },
        transition: { targetState: 'advanced', counterUpdates: [{ key: 'hits', delta: 1 }] },
      }],
      tags: [], createdAt: ts, updatedAt: ts,
    }],
    settings: { ...DEFAULT_SETTINGS }, createdAt: ts, updatedAt: ts,
  };
}

describe('listener live scenario state', () => {
  const listeners: ApiMockNetworkListener[] = [];
  afterEach(async () => { await Promise.all(listeners.splice(0).map(l => l.stop())); });

  it('advances state and increments counters on matched state-mode requests', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({ serverId: 'srv-state', definition: stateDef(port) });
    listeners.push(listener);
    await listener.start();

    expect(listener.getScenarioState()).toEqual({ states: {}, counters: {} });

    await (await fetch(`http://127.0.0.1:${port}/advance`, { method: 'POST' })).text();
    let snap = listener.getScenarioState();
    expect(snap.states.default).toBe('advanced');
    expect(snap.counters.hits).toBe(1);

    await (await fetch(`http://127.0.0.1:${port}/advance`, { method: 'POST' })).text();
    snap = listener.getScenarioState();
    expect(snap.counters.hits).toBe(2);
  });

  it('reset clears scenario state and counters', async () => {
    const port = getPort();
    const listener = new ApiMockNetworkListener({ serverId: 'srv-state', definition: stateDef(port) });
    listeners.push(listener);
    await listener.start();

    await (await fetch(`http://127.0.0.1:${port}/advance`, { method: 'POST' })).text();
    expect(listener.getScenarioState().counters.hits).toBe(1);

    listener.resetScenario();
    expect(listener.getScenarioState()).toEqual({ states: {}, counters: {} });
  });
});
