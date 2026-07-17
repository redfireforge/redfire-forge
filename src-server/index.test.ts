import { afterEach, describe, expect, it, vi } from 'vitest';

let serverErrorHandler: ((error: NodeJS.ErrnoException) => void) | undefined;

const listenMock = vi.fn((_port: number, _host: string, onListening?: () => void) => {
  onListening?.();
  return {
    on: vi.fn((event: string, handler: (error: NodeJS.ErrnoException) => void) => {
      if (event === 'error') serverErrorHandler = handler;
    }),
    close: (done?: () => void) => done?.(),
  };
});

const initSchedulerMock = vi.fn(async () => {});
const stopSchedulerMock = vi.fn();
const setCorrelationStoreMock = vi.fn();
const createCorrelationStoreMock = vi.fn(async () => ({
  cleanupExpired: () => 0,
  close: vi.fn(async () => {}),
}));
const wsPoolStartMock = vi.fn(async () => {});
const wsPoolStopAllMock = vi.fn();
const grpcPoolStopAllMock = vi.fn();

vi.mock('./webhook-server.js', () => ({
  app: {
    listen: listenMock,
  },
}));

vi.mock('./file-storage.js', () => ({
  getAppDataPath: () => '/tmp/redfireforge-test',
}));

vi.mock('./cron-scheduler.js', () => ({
  initScheduler: initSchedulerMock,
  stopScheduler: stopSchedulerMock,
}));

vi.mock('./correlation-store-factory.js', () => ({
  createCorrelationStore: createCorrelationStoreMock,
}));

vi.mock('./correlation-handler.js', () => ({
  setCorrelationStore: setCorrelationStoreMock,
  getCorrelationStore: () => ({ close: async () => {} }),
}));

vi.mock('./websocket/websocket-mock-service.js', () => ({
  wsMockPool: {
    getOrCreate: () => ({ start: wsPoolStartMock }),
    stopAll: wsPoolStopAllMock,
  },
}));

vi.mock('./grpc/grpcMockServerPool.js', () => ({
  grpcMockServerPool: {
    stopAll: grpcPoolStopAllMock,
  },
}));

vi.mock('../src/shared/utils/helpers', () => ({
  toErrorMessage: (err: unknown) => String(err),
}));

function getLastListener(event: NodeJS.Signals | 'uncaughtException' | 'unhandledRejection') {
  const listeners = process.listeners(event);
  return listeners[listeners.length - 1] as (...args: unknown[]) => unknown;
}

describe('src-server/index startup and shutdown paths', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    serverErrorHandler = undefined;
  });

  it('starts server and initializes scheduler/correlation store on import', async () => {
    vi.resetModules();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('./index');

    expect(listenMock).toHaveBeenCalled();
    expect(initSchedulerMock).toHaveBeenCalled();
    expect(createCorrelationStoreMock).toHaveBeenCalled();
    expect(setCorrelationStoreMock).toHaveBeenCalled();
    expect(wsPoolStartMock).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(serverErrorHandler).toBeTypeOf('function');

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('uses PORT and HOST from environment when provided', async () => {
    vi.resetModules();
    const originalPort = process.env.PORT;
    const originalHost = process.env.HOST;
    process.env.PORT = '4567';
    process.env.HOST = '0.0.0.0';

    await import('./index');

    expect(listenMock).toHaveBeenCalledWith(4567, '0.0.0.0', expect.any(Function));

    if (originalPort === undefined) delete process.env.PORT;
    else process.env.PORT = originalPort;
    if (originalHost === undefined) delete process.env.HOST;
    else process.env.HOST = originalHost;
  });

  it('handles EADDRINUSE server error by exiting with code 1', async () => {
    vi.resetModules();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? ''}`);
    }) as never);

    await import('./index');
    expect(serverErrorHandler).toBeTypeOf('function');

    expect(() => {
      serverErrorHandler?.({ code: 'EADDRINUSE' } as NodeJS.ErrnoException);
    }).toThrow('exit:1');

    expect(errorSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('handles non-EADDRINUSE server error by exiting with code 1', async () => {
    vi.resetModules();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? ''}`);
    }) as never);

    await import('./index');
    expect(serverErrorHandler).toBeTypeOf('function');

    expect(() => {
      serverErrorHandler?.({ code: 'ECONNRESET' } as NodeJS.ErrnoException);
    }).toThrow('exit:1');

    expect(errorSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('runs graceful SIGINT shutdown and exits 0', async () => {
    vi.resetModules();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? ''}`);
    }) as never);

    await import('./index');

    const sigint = getLastListener('SIGINT');
    await expect(Promise.resolve(sigint())).rejects.toThrow('exit:0');
    expect(stopSchedulerMock).toHaveBeenCalled();
    expect(wsPoolStopAllMock).toHaveBeenCalled();
    expect(grpcPoolStopAllMock).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    logSpy.mockRestore();
  });

  it('runs graceful SIGTERM shutdown and exits 0', async () => {
    vi.resetModules();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? ''}`);
    }) as never);

    await import('./index');

    const sigterm = getLastListener('SIGTERM');
    await expect(Promise.resolve(sigterm())).rejects.toThrow('exit:0');
    expect(stopSchedulerMock).toHaveBeenCalled();
    expect(wsPoolStopAllMock).toHaveBeenCalled();
    expect(grpcPoolStopAllMock).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);

    logSpy.mockRestore();
  });

  it('logs cleanup message when expired correlations are removed', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    createCorrelationStoreMock.mockResolvedValueOnce({
      cleanupExpired: () => 2,
      close: vi.fn(async () => {}),
    });

    await import('./index');

    vi.advanceTimersByTime(60_000);

    expect(logSpy).toHaveBeenCalledWith('[Cleanup] Removed 2 expired correlation(s)');
  });

  it('does not log cleanup message when no expired correlations are removed', async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    createCorrelationStoreMock.mockResolvedValueOnce({
      cleanupExpired: () => 0,
      close: vi.fn(async () => {}),
    });

    await import('./index');
    vi.advanceTimersByTime(60_000);

    expect(logSpy).not.toHaveBeenCalledWith('[Cleanup] Removed 0 expired correlation(s)');
  });

  it('swallows pool stop errors during shutdown', async () => {
    vi.resetModules();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? ''}`);
    }) as never);

    wsPoolStopAllMock.mockImplementationOnce(() => {
      throw new Error('ws stop fail');
    });
    grpcPoolStopAllMock.mockImplementationOnce(() => {
      throw new Error('grpc stop fail');
    });

    await import('./index');

    const sigint = getLastListener('SIGINT');
    await expect(Promise.resolve(sigint())).rejects.toThrow('exit:0');
    expect(exitSpy).toHaveBeenCalledWith(0);

    logSpy.mockRestore();
  });

  it('treats ws EADDRINUSE mock startup as non-fatal', async () => {
    vi.resetModules();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    wsPoolStartMock.mockRejectedValueOnce(new Error('EADDRINUSE'));

    await import('./index');

    expect(logSpy).toHaveBeenCalledWith('  ⚠️  ws://127.0.0.1:9876 already in use — skipping mock server start');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns when ws mock startup fails for other errors', async () => {
    vi.resetModules();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    wsPoolStartMock.mockRejectedValueOnce(new Error('network down'));

    await import('./index');

    expect(warnSpy).toHaveBeenCalledWith('  ⚠️  WS echo mock server failed to start:', 'Error: network down');
  });

  it('logs and exits when listen throws during startup catch path', async () => {
    vi.resetModules();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    listenMock.mockImplementationOnce(() => {
      throw new Error('listen failed');
    });

    await import('./index');

    expect(errorSpy).toHaveBeenCalledWith('❌ Failed to start server:', expect.any(Error));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('handles SIGINT even when server startup failed before listen initialized', async () => {
    vi.resetModules();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    listenMock.mockImplementationOnce(() => {
      throw new Error('listen failed before server assigned');
    });

    await import('./index');

    const sigint = getLastListener('SIGINT');
    await sigint();

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('shuts down when cleanup interval was never initialized', async () => {
    vi.resetModules();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? ''}`);
    }) as never);
    vi.spyOn(globalThis, 'setInterval').mockImplementation((() => null) as never);

    await import('./index');

    const sigterm = getLastListener('SIGTERM');
    await expect(Promise.resolve(sigterm())).rejects.toThrow('exit:0');
    expect(exitSpy).toHaveBeenCalledWith(0);

    logSpy.mockRestore();
  });

  it('handles uncaughtException and unhandledRejection with exit code 1', async () => {
    vi.resetModules();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code ?? ''}`);
    }) as never);

    await import('./index');

    const uncaught = getLastListener('uncaughtException');
    expect(() => uncaught(new Error('boom'))).toThrow('exit:1');

    const unhandled = getLastListener('unhandledRejection');
    expect(() => unhandled('bad', Promise.resolve())).toThrow('exit:1');

    expect(errorSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

});
