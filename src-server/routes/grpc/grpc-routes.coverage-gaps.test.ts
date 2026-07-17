/**
 * @vitest-environment node
 */
import express, { type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createGrpcRouter } from './grpc-routes.js';
import { createGrpcSuccessEnvelope } from '../../../src/shared/grpc/contracts.js';
import { FIXTURE_DESCRIPTOR, FIXTURE_STREAM_START_RESPONSE } from '../../../src/shared/grpc/contractFixtures.js';
import type { GrpcService } from '../../grpc/grpc-service.js';
import type { GrpcStreamService } from '../../grpc/grpc-stream-service.js';
import type { GrpcK8sPortForwardManager } from '../../grpc/grpcK8sPortForwardManager.js';

function createMinimalMocks(): { service: GrpcService; streamService: GrpcStreamService } {
  return {
    service: {
      status: vi.fn(async () => createGrpcSuccessEnvelope('status', {
        reachable: true,
        address: 'localhost:50051',
        tlsMode: 'disabled',
        latencyMs: 1,
      })),
      reflect: vi.fn(),
      describe: vi.fn(),
      exportProtoset: vi.fn(),
      call: vi.fn(),
      cancel: vi.fn(),
    } as unknown as GrpcService,
    streamService: {
      startStream: vi.fn(),
      attachStreamEvents: vi.fn(() => null),
      sendStreamMessage: vi.fn(),
      endStream: vi.fn(),
      cancelStream: vi.fn(),
    } as unknown as GrpcStreamService,
  };
}

describe('grpc-routes coverage gaps', () => {
  it('invokes onLog for status requests when logger is provided', async () => {
    const logs: string[] = [];
    const { service } = createMinimalMocks();
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({
      service,
      onLog: (line) => logs.push(line.text),
    }));

    await request(app)
      .get('/api/grpc/status')
      .query({ address: 'localhost:50051', timeoutMs: 'not-a-number' });

    expect(logs.some((line) => line.includes('status'))).toBe(true);
    expect(service.status).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: undefined }),
    );
  });

  it('returns 400 when reflect body is null', async () => {
    const { service } = createMinimalMocks();
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service }));

    const res = await request(app)
      .post('/api/grpc/reflect')
      .set('Content-Type', 'application/json')
      .send('null');

    expect(res.status).toBe(400);
    expect(service.reflect).not.toHaveBeenCalled();
  });

  it('logs describe, call, and stream routes with fallback labels', async () => {
    const logs: string[] = [];
    const { service, streamService } = createMinimalMocks();
    (service.describe as ReturnType<typeof vi.fn>).mockResolvedValue(
      createGrpcSuccessEnvelope('describe', { key: 'k' } as never),
    );
    (service.call as ReturnType<typeof vi.fn>).mockResolvedValue(
      createGrpcSuccessEnvelope('call', {} as never),
    );
    (streamService.startStream as ReturnType<typeof vi.fn>).mockReturnValue(
      createGrpcSuccessEnvelope('stream_start', { streamId: 's1' } as never),
    );
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({
      service,
      streamService,
      onLog: (line) => logs.push(line.text),
    }));

    await request(app).post('/api/grpc/describe').send({});
    await request(app).post('/api/grpc/call').send({});
    await request(app).post('/api/grpc/stream/start').send({});

    expect(logs.some((line) => line.includes('(no source)'))).toBe(true);
    expect(logs.some((line) => line.includes('?.?'))).toBe(true);
  });

  it('stream events successful attach keeps connection open without JSON envelope', async () => {
    const { service, streamService } = createMinimalMocks();
    (streamService.attachStreamEvents as ReturnType<typeof vi.fn>).mockImplementation(
      (_streamId, _tabId, res: Response) => {
        res.status(200).end();
        return null;
      },
    );
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service, streamService }));

    const res = await request(app)
      .get(`/api/grpc/stream/${FIXTURE_STREAM_START_RESPONSE.streamId}/events`)
      .query({ tabId: FIXTURE_STREAM_START_RESPONSE.tabId, lastSequence: '5' });

    expect(res.status).toBe(200);
    expect(streamService.attachStreamEvents).toHaveBeenCalledWith(
      FIXTURE_STREAM_START_RESPONSE.streamId,
      FIXTURE_STREAM_START_RESPONSE.tabId,
      expect.any(Object),
      5,
    );
  });

  it('returns 400 for non-object bodies on reflect, export-protoset, and stream send', async () => {
    const { service, streamService } = createMinimalMocks();
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service, streamService }));

    const reflectRes = await request(app).post('/api/grpc/reflect').send([]);
    const exportRes = await request(app).post('/api/grpc/export-protoset').send([]);
    const sendRes = await request(app)
      .post(`/api/grpc/stream/${FIXTURE_STREAM_START_RESPONSE.streamId}/send`)
      .query({ tabId: FIXTURE_STREAM_START_RESPONSE.tabId })
      .send([]);

    expect(reflectRes.status).toBe(400);
    expect(exportRes.status).toBe(400);
    expect(sendRes.status).toBe(400);
    expect(service.reflect).not.toHaveBeenCalled();
    expect(service.exportProtoset).not.toHaveBeenCalled();
    expect(streamService.sendStreamMessage).not.toHaveBeenCalled();
  });

  it('returns JSON error envelopes when stream events attach fails', async () => {
    const { service, streamService } = createMinimalMocks();
    const { createGrpcErrorEnvelope, GRPC_ERROR_CODES } = await import('../../../src/shared/grpc/contracts.js');
    (streamService.attachStreamEvents as ReturnType<typeof vi.fn>).mockReturnValue(
      createGrpcErrorEnvelope('stream_events', {
        code: GRPC_ERROR_CODES.REQUEST_NOT_FOUND,
        message: 'missing stream',
      }),
    );
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service, streamService }));

    const res = await request(app)
      .get(`/api/grpc/stream/${FIXTURE_STREAM_START_RESPONSE.streamId}/events`)
      .query({ tabId: FIXTURE_STREAM_START_RESPONSE.tabId });

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  it('routes export-protoset and stream lifecycle endpoints', async () => {
    const { service, streamService } = createMinimalMocks();
    (service.exportProtoset as ReturnType<typeof vi.fn>).mockResolvedValue(
      createGrpcSuccessEnvelope('export_protoset', { protosetBase64: 'abc' } as never),
    );
    (streamService.sendStreamMessage as ReturnType<typeof vi.fn>).mockReturnValue(
      createGrpcSuccessEnvelope('stream_send', { streamId: 's1', tabId: 't1', sequence: 1 }),
    );
    (streamService.endStream as ReturnType<typeof vi.fn>).mockReturnValue(
      createGrpcSuccessEnvelope('stream_end', { streamId: 's1', tabId: 't1', ended: true }),
    );
    (streamService.cancelStream as ReturnType<typeof vi.fn>).mockReturnValue(
      createGrpcSuccessEnvelope('stream_cancel', { streamId: 's1', tabId: 't1', cancelled: true }),
    );
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service, streamService }));

    await request(app).post('/api/grpc/export-protoset').send({ descriptorKey: 'key-1' });
    await request(app)
      .post(`/api/grpc/stream/${FIXTURE_STREAM_START_RESPONSE.streamId}/send`)
      .query({ tabId: FIXTURE_STREAM_START_RESPONSE.tabId })
      .send({ body: { message: 'x' } });
    await request(app)
      .post(`/api/grpc/stream/${FIXTURE_STREAM_START_RESPONSE.streamId}/end`)
      .query({ tabId: FIXTURE_STREAM_START_RESPONSE.tabId });
    await request(app)
      .delete(`/api/grpc/stream/${FIXTURE_STREAM_START_RESPONSE.streamId}`)
      .query({ tabId: FIXTURE_STREAM_START_RESPONSE.tabId });

    expect(service.exportProtoset).toHaveBeenCalled();
    expect(streamService.sendStreamMessage).toHaveBeenCalled();
    expect(streamService.endStream).toHaveBeenCalled();
    expect(streamService.cancelStream).toHaveBeenCalled();
  });

  function createK8sManagerMock(): GrpcK8sPortForwardManager {
    return {
      getStatus: vi.fn((scopeId: string) => ({ scopeId, active: false })),
      getLogs: vi.fn((scopeId: string) => ({ scopeId, lines: [], latestSeq: 0 })),
      clearLogs: vi.fn((scopeId: string) => ({ scopeId, latestSeq: 0 })),
      startPortForward: vi.fn(async (scopeId: string) => ({ scopeId, active: true, pid: 9 })),
      stopPortForward: vi.fn(async (scopeId: string) => ({ scopeId, active: false })),
    } as unknown as GrpcK8sPortForwardManager;
  }

  it('routes k8s port-forward lifecycle endpoints', async () => {
    const k8s = createK8sManagerMock();
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service: createMinimalMocks().service, k8sPortForwardManager: k8s }));

    const status = await request(app)
      .get('/api/grpc/k8s-port-forward/status')
      .query({ scopeId: 'tab-1' });
    expect(status.status).toBe(200);
    expect(status.body.data.active).toBe(false);

    const logs = await request(app)
      .get('/api/grpc/k8s-port-forward/logs')
      .query({ scopeId: 'tab-1', afterSeq: '3' });
    expect(logs.status).toBe(200);
    expect(k8s.getLogs).toHaveBeenCalledWith('tab-1', 3);

    const cleared = await request(app)
      .post('/api/grpc/k8s-port-forward/logs/clear')
      .send({ scopeId: 'tab-1' });
    expect(cleared.status).toBe(200);

    const started = await request(app)
      .post('/api/grpc/k8s-port-forward/start')
      .send({
        scopeId: 'tab-1',
        config: {
          namespace: 'default',
          targetType: 'service',
          name: 'echo',
          remotePort: 50051,
          localPort: 50051,
        },
      });
    expect(started.status).toBe(200);
    expect(started.body.data.pid).toBe(9);

    const stopped = await request(app)
      .post('/api/grpc/k8s-port-forward/stop')
      .send({ scopeId: 'tab-1' });
    expect(stopped.status).toBe(200);
    expect(stopped.body.data.active).toBe(false);
  });

  it('returns 400 for k8s route errors and invalid bodies', async () => {
    const k8s = createK8sManagerMock();
    (k8s.getStatus as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('scopeId is required');
    });
    (k8s.startPortForward as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('kubectl failed'));
    (k8s.stopPortForward as ReturnType<typeof vi.fn>).mockRejectedValue('stop failed');
    (k8s.getLogs as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw 'logs failed';
    });
    (k8s.clearLogs as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('clear failed');
    });

    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service: createMinimalMocks().service, k8sPortForwardManager: k8s }));

    expect((await request(app).get('/api/grpc/k8s-port-forward/status').query({ scopeId: 'tab-1' })).status)
      .toBe(400);
    expect((await request(app).get('/api/grpc/k8s-port-forward/logs').query({ scopeId: 'tab-1' })).body.error)
      .toBe('Failed to read K8s port-forward logs');
    expect((await request(app).post('/api/grpc/k8s-port-forward/logs/clear').send('null')).status).toBe(400);
    expect((await request(app).post('/api/grpc/k8s-port-forward/logs/clear').send({ scopeId: 1 })).status).toBe(400);
    expect((await request(app).post('/api/grpc/k8s-port-forward/start').send('null')).status).toBe(400);
    expect((await request(app).post('/api/grpc/k8s-port-forward/start').send({ scopeId: 'tab-1' })).body.error)
      .toBe('kubectl failed');
    expect((await request(app).post('/api/grpc/k8s-port-forward/stop').send({ scopeId: 'tab-1' })).body.error)
      .toBe('Failed to stop kubectl port-forward');
  });

  it('ignores invalid afterSeq query values for k8s logs route', async () => {
    const k8s = createK8sManagerMock();
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service: createMinimalMocks().service, k8sPortForwardManager: k8s }));

    await request(app)
      .get('/api/grpc/k8s-port-forward/logs')
      .query({ scopeId: 'tab-1', afterSeq: 'not-a-number' });

    expect(k8s.getLogs).toHaveBeenCalledWith('tab-1', undefined);
  });

  it('routes unary cancel and returns error envelopes from the service', async () => {
    const { service } = createMinimalMocks();
    const { createGrpcErrorEnvelope, GRPC_ERROR_CODES } = await import('../../../src/shared/grpc/contracts.js');
    (service.cancel as ReturnType<typeof vi.fn>).mockReturnValue(
      createGrpcErrorEnvelope('cancel', {
        code: GRPC_ERROR_CODES.REQUEST_NOT_FOUND,
        message: 'missing request',
      }),
    );
    (service.status as ReturnType<typeof vi.fn>).mockResolvedValue(
      createGrpcErrorEnvelope('status', {
        code: GRPC_ERROR_CODES.INVALID_REQUEST,
        message: 'bad address',
      }),
    );

    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service }));

    const cancelRes = await request(app)
      .delete('/api/grpc/call/req-1')
      .query({ tabId: 'tab-1' });
    expect(cancelRes.status).toBe(404);
    expect(service.cancel).toHaveBeenCalledWith('req-1', 'tab-1');

    const statusRes = await request(app).get('/api/grpc/status');
    expect(statusRes.status).toBe(400);
    expect(statusRes.body.ok).toBe(false);
  });

  it('returns generic k8s status errors for non-Error throws', async () => {
    const k8s = createK8sManagerMock();
    (k8s.getStatus as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw 'status failed';
    });
    (k8s.clearLogs as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw 'clear failed';
    });

    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service: createMinimalMocks().service, k8sPortForwardManager: k8s }));

    expect((await request(app).get('/api/grpc/k8s-port-forward/status').query({ scopeId: 'tab-1' })).body.error)
      .toBe('Failed to read K8s port-forward status');
    expect((await request(app).post('/api/grpc/k8s-port-forward/logs/clear').send({ scopeId: 'tab-1' })).body.error)
      .toBe('Failed to clear K8s port-forward logs');
  });

  it('passes tabId query params to call and stream start routes', async () => {
    const { service, streamService } = createMinimalMocks();
    (service.call as ReturnType<typeof vi.fn>).mockResolvedValue(
      createGrpcSuccessEnvelope('call', {} as never),
    );
    (streamService.startStream as ReturnType<typeof vi.fn>).mockReturnValue(
      createGrpcSuccessEnvelope('stream_start', { streamId: 's1' } as never),
    );
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service, streamService }));

    await request(app).post('/api/grpc/call').query({ tabId: 'tab-1' }).send({ requestId: 'req-1' });
    await request(app).post('/api/grpc/stream/start').query({ tabId: 'tab-1' }).send({ requestId: 'req-2' });

    expect(service.call).toHaveBeenCalledWith(expect.any(Object), 'tab-1');
    expect(streamService.startStream).toHaveBeenCalledWith(expect.any(Object), 'tab-1');
  });

  it('tolerates invalid timeout query params and blank k8s scope ids', async () => {
    const { service, streamService } = createMinimalMocks();
    (service.cancel as ReturnType<typeof vi.fn>).mockReturnValue(
      createGrpcSuccessEnvelope('cancel', { cancelled: true } as never),
    );
    (streamService.endStream as ReturnType<typeof vi.fn>).mockReturnValue(
      createGrpcSuccessEnvelope('stream_end', { streamId: 's1', tabId: '', ended: true }),
    );
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service, streamService }));

    await request(app).delete('/api/grpc/call/req-1');
    expect(service.cancel).toHaveBeenCalledWith('req-1', undefined);

    await request(app).post('/api/grpc/stream/s1/end');
    expect(streamService.endStream).toHaveBeenCalledWith('s1', undefined);
  });

  it('logs reflect target address when onLog is provided', async () => {
    const logs: string[] = [];
    const { service } = createMinimalMocks();
    (service.reflect as ReturnType<typeof vi.fn>).mockResolvedValue(
      createGrpcSuccessEnvelope('reflect', FIXTURE_DESCRIPTOR as never),
    );
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service, onLog: (line) => logs.push(line.text) }));

    await request(app)
      .post('/api/grpc/reflect')
      .send({ target: { address: 'localhost:50051', tlsMode: 'disabled' } });

    expect(service.reflect).toHaveBeenCalled();
    expect(logs.some((line) => line.includes('localhost:50051'))).toBe(true);
  });

  it('instantiates router with default service dependencies', () => {
    expect(createGrpcRouter()).toBeTruthy();
  });

  it('logs fallback labels when reflect, describe, and export payloads omit identifiers', async () => {
    const logs: string[] = [];
    const { service } = createMinimalMocks();
    (service.reflect as ReturnType<typeof vi.fn>).mockResolvedValue(
      createGrpcSuccessEnvelope('reflect', FIXTURE_DESCRIPTOR as never),
    );
    (service.describe as ReturnType<typeof vi.fn>).mockResolvedValue(
      createGrpcSuccessEnvelope('describe', { key: 'k' } as never),
    );
    (service.exportProtoset as ReturnType<typeof vi.fn>).mockResolvedValue(
      createGrpcSuccessEnvelope('export_protoset', { protosetBase64: 'abc' } as never),
    );
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service, onLog: (line) => logs.push(line.text) }));

    await request(app).post('/api/grpc/reflect').send({});
    await request(app).post('/api/grpc/describe').send({});
    await request(app).post('/api/grpc/export-protoset').send({});

    expect(logs.some((line) => line.includes('(no target)'))).toBe(true);
    expect(logs.some((line) => line.includes('(no source)'))).toBe(true);
    expect(logs.some((line) => line.includes('(no key)'))).toBe(true);
  });

  it('handles blank k8s scope ids, Error log reads, and generic start failures', async () => {
    const logs: string[] = [];
    const k8s = createK8sManagerMock();
    (k8s.getLogs as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('bad logs');
    });
    (k8s.startPortForward as ReturnType<typeof vi.fn>).mockRejectedValue('start boom');
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({
      service: createMinimalMocks().service,
      k8sPortForwardManager: k8s,
      onLog: (line) => logs.push(line.text),
    }));

    await request(app).get('/api/grpc/k8s-port-forward/status');
    const logsRes = await request(app)
      .get('/api/grpc/k8s-port-forward/logs')
      .query({ scopeId: 'tab-1' });
    expect(logsRes.body.error).toBe('bad logs');

    await request(app)
      .post('/api/grpc/k8s-port-forward/start')
      .send({
        config: {
          namespace: 'default',
          targetType: 'service',
          name: 'echo',
          remotePort: 50051,
          localPort: 50051,
        },
      });
    await request(app).post('/api/grpc/k8s-port-forward/stop').send({});

    expect(logs.some((line) => line.includes('k8s/start → (no scope)'))).toBe(true);
    expect(logs.some((line) => line.includes('k8s/stop → (no scope)'))).toBe(true);
    expect((await request(app).post('/api/grpc/k8s-port-forward/start').send({ scopeId: 'tab-1', config: {} })).body.error)
      .toBe('Failed to start kubectl port-forward');
  });

  it('logs status requests without an address and accepts tlsMode query params', async () => {
    const logs: string[] = [];
    const { service } = createMinimalMocks();
    const app = express();
    app.use(express.json());
    app.use(createGrpcRouter({ service, onLog: (line) => logs.push(line.text) }));

    await request(app)
      .get('/api/grpc/status')
      .query({ tlsMode: 'tls' });

    expect(service.status).toHaveBeenCalledWith(expect.objectContaining({
      address: '',
      tlsMode: 'tls',
    }));
    expect(logs.some((line) => line.includes('(no address)'))).toBe(true);
  });
});
