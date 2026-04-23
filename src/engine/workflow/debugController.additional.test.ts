import { describe, it, expect, vi } from 'vitest';
import { DebugController } from './debugController';

describe('DebugController - Additional Coverage', () => {
  it('waitForStep resolves immediately if already resumed when Promise is created', async () => {
    const dc = new DebugController();
    dc.resumeAll();
    
    // This should resolve immediately without hanging
    const start = Date.now();
    await dc.waitForStep('n1', 'thread1');
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeLessThan(100); // Should be instant
    expect(dc.getPausedNodeIds()).toEqual([]);
  });

  it('waitForStep resolves immediately if stopped before Promise is created', async () => {
    const dc = new DebugController();
    dc.stop();
    
    // Should resolve immediately
    await dc.waitForStep('n1', 'thread1');
    expect(dc.isStopped).toBe(true);
  });

  it('stepNode does nothing if nodeId is not in pendingResolvers', () => {
    const dc = new DebugController();
    // Don't call waitForStep, so pendingResolvers is empty
    
    // Should not throw
    expect(() => dc.stepNode('nonexistent')).not.toThrow();
  });

  it('markRunning does nothing if thread does not exist', () => {
    const dc = new DebugController();
    const listener = vi.fn();
    dc.onStateChange(listener);
    
    // Call markRunning for a thread that was never created
    dc.markRunning('node1', 'nonexistent-thread');
    
    // Listener should not be called since no state changed
    expect(listener).not.toHaveBeenCalled();
  });

  it('markCompleted does nothing if thread does not exist', () => {
    const dc = new DebugController();
    const listener = vi.fn();
    dc.onStateChange(listener);
    
    // Call markCompleted for a thread that was never created
    dc.markCompleted('nonexistent-thread');
    
    // Listener should not be called since no state changed
    expect(listener).not.toHaveBeenCalled();
  });

  it('markRunning updates existing thread status and notifies', () => {
    const dc = new DebugController();
    const listener = vi.fn();
    dc.onStateChange(listener);
    
    // Create a thread by calling waitForStep
    dc.waitForStep('node1', 'thread1');
    listener.mockClear();
    
    // Mark it as running
    dc.markRunning('node1', 'thread1');
    
    expect(listener).toHaveBeenCalled();
    const thread = dc.getThreads().get('thread1');
    expect(thread?.status).toBe('running');
    expect(thread?.currentNodeId).toBe('node1');
  });

  it('markCompleted updates existing thread status and notifies', () => {
    const dc = new DebugController();
    const listener = vi.fn();
    dc.onStateChange(listener);
    
    // Create a thread
    dc.waitForStep('node1', 'thread1');
    listener.mockClear();
    
    // Mark it as completed
    dc.markCompleted('thread1');
    
    expect(listener).toHaveBeenCalled();
    const thread = dc.getThreads().get('thread1');
    expect(thread?.status).toBe('completed');
  });

  it('stepAll clears all pending resolvers', async () => {
    const dc = new DebugController();
    const results: string[] = [];
    
    // Create multiple pending nodes
    const p1 = dc.waitForStep('n1', 't1').then(() => results.push('n1'));
    const p2 = dc.waitForStep('n2', 't2').then(() => results.push('n2'));
    const p3 = dc.waitForStep('n3', 't3').then(() => results.push('n3'));
    
    // Step all at once
    dc.stepAll();
    
    await Promise.all([p1, p2, p3]);
    expect(results.sort()).toEqual(['n1', 'n2', 'n3']);
  });

  it('resumeAll sets resumed flag and resolves all pending', async () => {
    const dc = new DebugController();
    const results: string[] = [];
    
    // Create pending nodes
    const p1 = dc.waitForStep('n1', 't1').then(() => results.push('n1'));
    const p2 = dc.waitForStep('n2', 't2').then(() => results.push('n2'));
    
    expect(dc.isResumed).toBe(false);
    
    // Resume all
    dc.resumeAll();
    
    await Promise.all([p1, p2]);
    expect(dc.isResumed).toBe(true);
    expect(results.sort()).toEqual(['n1', 'n2']);
  });

  it('stop sets both stopped and resumed flags', () => {
    const dc = new DebugController();
    expect(dc.isStopped).toBe(false);
    expect(dc.isResumed).toBe(false);
    
    dc.stop();
    
    expect(dc.isStopped).toBe(true);
    expect(dc.isResumed).toBe(true);
  });

  it('getPausedNodeIds filters only paused threads', () => {
    const dc = new DebugController();
    
    // Create threads with different statuses
    dc.waitForStep('n1', 't1'); // paused
    dc.markWaitingJoin('n2', 't2'); // waiting-join
    dc.markCompleted('t3'); // completed (no paused thread)
    
    const pausedIds = dc.getPausedNodeIds();
    expect(pausedIds).toEqual(['n1']);
  });

  it('getThreads returns read-only map of all threads', () => {
    const dc = new DebugController();
    
    dc.waitForStep('n1', 't1');
    dc.markWaitingJoin('n2', 't2');
    
    const threads = dc.getThreads();
    expect(threads.size).toBe(2);
    expect(threads.get('t1')?.status).toBe('paused');
    expect(threads.get('t2')?.status).toBe('waiting-join');
  });

  it('onStateChange listener can be set multiple times', () => {
    const dc = new DebugController();
    const listener1 = vi.fn();
    const listener2 = vi.fn();
    
    dc.onStateChange(listener1);
    dc.waitForStep('n1', 't1');
    
    expect(listener1).toHaveBeenCalled();
    listener1.mockClear();
    
    // Replace listener
    dc.onStateChange(listener2);
    dc.markRunning('n1', 't1');
    
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalled();
  });

  it('handles multiple waitForStep calls for the same thread', async () => {
    const dc = new DebugController();
    
    // First wait
    const p1 = dc.waitForStep('n1', 'thread1');
    dc.stepNode('n1');
    await p1;
    
    // Second wait on same thread (updates node)
    const p2 = dc.waitForStep('n2', 'thread1');
    dc.stepNode('n2');
    await p2;
    
    const thread = dc.getThreads().get('thread1');
    expect(thread?.currentNodeId).toBe('n2');
  });
});
