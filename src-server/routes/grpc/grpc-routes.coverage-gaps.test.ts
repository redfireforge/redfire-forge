/**
 * @vitest-environment node
 */
import express, { type Response } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createGrpcRouter } from './grpc-routes.js';
import { createGrpcSuccessEnvelope } from '../../../src/shared/grpc/contracts.js';
import { FIXTURE_STREAM_START_RESPONSE } from '../../../src/shared/grpc/contractFixtures.js';
import type { GrpcService } from '../../grpc/grpc-service.js';
import type { GrpcStreamService } from '../../grpc/grpc-stream-service.js';

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
});
