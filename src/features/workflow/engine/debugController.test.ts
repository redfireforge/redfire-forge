import { describe, it, expect, vi } from 'vitest';
import { DebugController } from './debugController';

describe('DebugController', () => {
  it('waitForStep pauses until stepNode is called', async () => {
    const dc = new DebugController();
    let resolved = false;
    const p = dc.waitForStep('n1', 'main').then(() => { resolved = true; });
    expect(resolved).toBe(false);
    expect(dc.getPausedNodeIds()).toEqual(['n1']);

    dc.stepNode('n1');
    await p;
    expect(resolved).toBe(true);
  });

  it('stepAll resolves all paused nodes', async () => {
    const dc = new DebugController();
    const results: string[] = [];
    const p1 = dc.waitForStep('n1', 't1').then(() => results.push('n1'));
    const p2 = dc.waitForStep('n2', 't2').then(() => results.push('n2'));

    dc.stepAll();
    await Promise.all([p1, p2]);
    expect(results.sort()).toEqual(['n1', 'n2']);
  });

  it('resumeAll makes future waitForStep resolve immediately', async () => {
    const dc = new DebugController();
    dc.resumeAll();
    await dc.waitForStep('n1', 'main'); // should not hang
    expect(dc.isResumed).toBe(true);
  });

  it('stop sets isStopped and resolves pending', async () => {
    const dc = new DebugController();
    const p = dc.waitForStep('n1', 'main');
    dc.stop();
    await p;
    expect(dc.isStopped).toBe(true);
  });

  it('markRunning updates thread status', () => {
    const dc = new DebugController();
    dc.waitForStep('n1', 'main');
    dc.markRunning('n1', 'main');
    const t = dc.getThreads().get('main');
    expect(t?.status).toBe('running');
  });

  it('markWaitingJoin updates thread status', () => {
    const dc = new DebugController();
    dc.markWaitingJoin('join1', 'branch-0');
    const t = dc.getThreads().get('branch-0');
    expect(t?.status).toBe('waiting-join');
    expect(t?.currentNodeId).toBe('join1');
  });

  it('onStateChange listener fires on state changes', async () => {
    const dc = new DebugController();
    const listener = vi.fn();
    dc.onStateChange(listener);

    dc.waitForStep('n1', 'main');
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls[0][0].get('main')?.status).toBe('paused');
  });

  it('markCompleted sets thread to completed', () => {
    const dc = new DebugController();
    dc.waitForStep('n1', 'main');
    dc.markCompleted('main');
    expect(dc.getThreads().get('main')?.status).toBe('completed');
  });
});
