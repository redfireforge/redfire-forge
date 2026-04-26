/**
 * DebugController — step-through execution controller for workflow Quick Test.
 *
 * When active, the graph runner pauses before each node and waits for the user
 * to click Step (per-node), Step All, or Resume All.
 *
 * At Fork nodes, multiple "threads" are spawned — each branch pauses independently
 * and can be stepped individually.  Join nodes display a "waiting (n/m)" state
 * until all incoming branches arrive.
 */

export interface DebugThread {
  id: string;
  currentNodeId: string;
  status: 'paused' | 'running' | 'completed' | 'waiting-join';
}

export type DebugStateListener = (threads: ReadonlyMap<string, DebugThread>) => void;

export class DebugController {
  private pendingResolvers = new Map<string, Set<() => void>>();
  private threads = new Map<string, DebugThread>();
  private resumed = false;
  private stopped = false;
  private listener: DebugStateListener | null = null;

  /** Register a callback that fires whenever thread state changes. */
  onStateChange(fn: DebugStateListener): void {
    this.listener = fn;
  }

  private notify(): void {
    this.listener?.(this.threads);
  }

  private addPendingResolver(nodeId: string, resolve: () => void): void {
    const resolvers = this.pendingResolvers.get(nodeId) ?? new Set<() => void>();
    resolvers.add(resolve);
    this.pendingResolvers.set(nodeId, resolvers);
  }

  private drainPendingResolvers(nodeId: string): Array<() => void> {
    const resolvers = this.pendingResolvers.get(nodeId);
    if (!resolvers) return [];
    this.pendingResolvers.delete(nodeId);
    return [...resolvers];
  }

  /**
   * Called by the graph runner before executing a node.
   * Returns a Promise that resolves when the user clicks Step for this node,
   * Step All, or Resume All.
   */
  async waitForStep(nodeId: string, threadId: string): Promise<void> {
    if (this.resumed || this.stopped) return;

    this.threads.set(threadId, { id: threadId, currentNodeId: nodeId, status: 'paused' });
    this.notify();

    return new Promise<void>((resolve) => {
      if (this.resumed || this.stopped) {
        resolve();
        return;
      }
      this.addPendingResolver(nodeId, resolve);
    });
  }

  /** Mark a thread as running (called after step resolves, before node executes). */
  markRunning(nodeId: string, threadId: string): void {
    const t = this.threads.get(threadId);
    if (t) {
      t.status = 'running';
      t.currentNodeId = nodeId;
      this.notify();
    }
  }

  /** Mark a thread as completed. */
  markCompleted(threadId: string): void {
    const t = this.threads.get(threadId);
    if (t) {
      t.status = 'completed';
      this.notify();
    }
  }

  /** Mark a thread as waiting at a Join barrier. */
  markWaitingJoin(nodeId: string, threadId: string): void {
    this.threads.set(threadId, { id: threadId, currentNodeId: nodeId, status: 'waiting-join' });
    this.notify();
  }

  /** Step a single node — resolves the Promise for that node only. */
  stepNode(nodeId: string): void {
    const resolvers = this.drainPendingResolvers(nodeId);
    for (const resolve of resolvers) {
      resolve();
    }
  }

  /** Step all currently paused nodes simultaneously. */
  stepAll(): void {
    const resolvers = [...this.pendingResolvers.values()].flatMap((group) => [...group]);
    this.pendingResolvers.clear();
    for (const resolve of resolvers) resolve();
  }

  /** Resume — all future waitForStep() calls resolve immediately. */
  resumeAll(): void {
    this.resumed = true;
    this.stepAll();
  }

  /** Stop — abort the debug session. */
  stop(): void {
    this.stopped = true;
    this.resumed = true;
    this.stepAll();
  }

  /** Check if debug was stopped (graph runner should abort). */
  get isStopped(): boolean {
    return this.stopped;
  }

  /** Check if running in resume (non-pausing) mode. */
  get isResumed(): boolean {
    return this.resumed;
  }

  /** Get the current set of paused node IDs. */
  getPausedNodeIds(): string[] {
    return [...this.threads.values()]
      .filter(t => t.status === 'paused')
      .map(t => t.currentNodeId);
  }

  /** Get all threads (read-only). */
  getThreads(): ReadonlyMap<string, DebugThread> {
    return this.threads;
  }
}
