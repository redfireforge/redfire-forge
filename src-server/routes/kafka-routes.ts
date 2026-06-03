import { Router, type Request, type Response } from 'express';
import { kafkaService, type KafkaService } from '../kafka/kafka-service.js';
import {
  createKafkaErrorEnvelope,
  createKafkaSuccessEnvelope,
  type KafkaErrorEnvelope,
  type KafkaOperation,
  type KafkaRouteEnvelope,
  type KafkaSchemaFetchRequest,
  type KafkaSchemaSubjectsRequest,
  type KafkaSchemaVersionsRequest,
  type KafkaStatusRequest,
  type KafkaSubscriptionsRequest,
  type KafkaTopicsRequest,
} from '../kafka/contracts.js';
import {
  fetchSchema,
  listSubjects,
  listVersions,
  SchemaRegistryError,
} from '../kafka/schema-registry-client.js';
import type { LogLine } from '../../src/shared/types/server-api';

interface CreateKafkaRouterOptions {
  service?: KafkaService;
  onLog?: (line: LogLine) => void;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  if (value === 'true' || value === '1') {
    return true;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  return undefined;
}

function mapErrorStatus(error: KafkaErrorEnvelope['error']): number {
  if (error.code.startsWith('KAFKA_INVALID_')) {
    return 400;
  }
  if (error.code === 'REGISTRY_AUTH_FAILURE') {
    return 401;
  }
  if (error.code.includes('NOT_FOUND')) {
    return 404;
  }
  if (error.code.includes('MISMATCH')) {
    return 409;
  }
  if (
    error.code.includes('NOT_CONNECTED') ||
    error.code.includes('CONNECT_IN_PROGRESS') ||
    error.code === 'REGISTRY_UNREACHABLE'
  ) {
    return 503;
  }
  return 500;
}

function sendEnvelope<T>(res: Response, envelope: KafkaRouteEnvelope<T>) {
  if (envelope.ok) {
    return res.status(200).json(envelope);
  }
  return res.status(mapErrorStatus(envelope.error)).json(envelope);
}

function requireBodyObject(req: Request, op: KafkaOperation): KafkaRouteEnvelope<never> | null {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return createKafkaErrorEnvelope(op, {
      code: 'KAFKA_INVALID_REQUEST',
      message: 'Request body must be a JSON object',
    });
  }
  return null;
}

export function createKafkaRouter(options: CreateKafkaRouterOptions = {}): Router {
  const router = Router();
  const service = options.service ?? kafkaService;

  const log = (text: string) => {
    if (!options.onLog) {
      return;
    }
    options.onLog({
      prefix: '*',
      text: `[Kafka] ${text}`,
      ts: Date.now(),
    });
  };

  router.post('/api/kafka/connect', async (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'connect');
    if (bodyError) {
      return sendEnvelope(res, bodyError);
    }

    log('connect request');
    const envelope = await service.connect(req.body);
    return sendEnvelope(res, envelope);
  });

  router.post('/api/kafka/disconnect', async (req: Request, res: Response) => {
    if (req.body && (typeof req.body !== 'object' || Array.isArray(req.body))) {
      return sendEnvelope(res, createKafkaErrorEnvelope('disconnect', {
        code: 'KAFKA_INVALID_REQUEST',
        message: 'Request body must be a JSON object when provided',
      }));
    }

    log('disconnect request');
    const envelope = await service.disconnect(req.body);
    return sendEnvelope(res, envelope);
  });

  router.get('/api/kafka/status', (req: Request, res: Response) => {
    const request: KafkaStatusRequest = {
      clusterId: typeof req.query.clusterId === 'string' ? req.query.clusterId : undefined,
    };

    const envelope = service.getStatus(request);
    return sendEnvelope(res, envelope);
  });

  router.get('/api/kafka/topics', async (req: Request, res: Response) => {
    const includeInternal = toBoolean(req.query.includeInternal);
    if (req.query.includeInternal != null && includeInternal == null) {
      return sendEnvelope(res, createKafkaErrorEnvelope('topics', {
        code: 'KAFKA_INVALID_REQUEST',
        message: 'includeInternal must be a boolean value',
      }));
    }

    const request: KafkaTopicsRequest = {
      clusterId: typeof req.query.clusterId === 'string' ? req.query.clusterId : undefined,
      includeInternal,
    };

    const envelope = await service.listTopics(request);
    return sendEnvelope(res, envelope);
  });

  router.post('/api/kafka/produce', async (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'produce');
    if (bodyError) {
      return sendEnvelope(res, bodyError);
    }

    log('produce request');
    const envelope = await service.produce(req.body);
    return sendEnvelope(res, envelope);
  });

  router.post('/api/kafka/consume-once', async (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'consume-once');
    if (bodyError) {
      return sendEnvelope(res, bodyError);
    }

    log('consume-once request');
    const envelope = await service.consumeOnce(req.body);
    return sendEnvelope(res, envelope);
  });

  router.post('/api/kafka/subscribe', async (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'subscribe');
    if (bodyError) {
      return sendEnvelope(res, bodyError);
    }

    log('subscribe request');
    const envelope = await service.subscribe(req.body);
    return sendEnvelope(res, envelope);
  });

  router.get('/api/kafka/subscriptions', (req: Request, res: Response) => {
    const request: KafkaSubscriptionsRequest = {
      clusterId: typeof req.query.clusterId === 'string' ? req.query.clusterId : undefined,
    };

    const envelope = service.getSubscriptions(request);
    return sendEnvelope(res, envelope);
  });

  router.post('/api/kafka/unsubscribe', async (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'unsubscribe');
    if (bodyError) {
      return sendEnvelope(res, bodyError);
    }

    log('unsubscribe request');
    const envelope = await service.unsubscribe(req.body);
    return sendEnvelope(res, envelope);
  });

  // ── Phase 10 — Schema Registry routes ───────────────────────────────────────
  // All three routes are POST (not GET) because KafkaSchemaConfig.auth carries
  // credentials that must travel in the request body.  GET query params would
  // expose credentials in server logs, browser history, and referrer headers
  // (OWASP A02 — Cryptographic Failures).

  function toSchemaErrorEnvelope(op: KafkaOperation, error: unknown): KafkaRouteEnvelope<never> {
    if (error instanceof SchemaRegistryError) {
      return createKafkaErrorEnvelope(op, {
        code: error.code,
        message: error.message,
        retryable: error.code === 'REGISTRY_UNREACHABLE',
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    return createKafkaErrorEnvelope(op, {
      code: 'REGISTRY_UNREACHABLE',
      message: `Schema registry error: ${message}`,
      retryable: true,
    });
  }

  router.post('/api/kafka/schema-subjects', async (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'schema-subjects');
    if (bodyError) {
      return sendEnvelope(res, bodyError);
    }

    const body = req.body as KafkaSchemaSubjectsRequest;
    if (!body.schemaConfig || typeof body.schemaConfig !== 'object' || !body.schemaConfig.registryUrl) {
      return sendEnvelope(res, createKafkaErrorEnvelope('schema-subjects', {
        code: 'KAFKA_INVALID_REQUEST',
        message: 'schemaConfig.registryUrl is required',
      }));
    }

    try {
      const subjects = await listSubjects(body.schemaConfig);
      return sendEnvelope(res, createKafkaSuccessEnvelope('schema-subjects', { subjects }));
    } catch (error) {
      return sendEnvelope(res, toSchemaErrorEnvelope('schema-subjects', error));
    }
  });

  router.post('/api/kafka/schema-versions', async (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'schema-versions');
    if (bodyError) {
      return sendEnvelope(res, bodyError);
    }

    const body = req.body as KafkaSchemaVersionsRequest;
    if (!body.schemaConfig || !body.schemaConfig.registryUrl) {
      return sendEnvelope(res, createKafkaErrorEnvelope('schema-versions', {
        code: 'KAFKA_INVALID_REQUEST',
        message: 'schemaConfig.registryUrl is required',
      }));
    }
    if (!body.subject || typeof body.subject !== 'string' || !body.subject.trim()) {
      return sendEnvelope(res, createKafkaErrorEnvelope('schema-versions', {
        code: 'KAFKA_INVALID_REQUEST',
        message: 'subject is required',
      }));
    }

    try {
      const versions = await listVersions(body.schemaConfig, body.subject);
      return sendEnvelope(res, createKafkaSuccessEnvelope('schema-versions', {
        subject: body.subject,
        versions,
      }));
    } catch (error) {
      return sendEnvelope(res, toSchemaErrorEnvelope('schema-versions', error));
    }
  });

  router.post('/api/kafka/schema-fetch', async (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'schema-fetch');
    if (bodyError) {
      return sendEnvelope(res, bodyError);
    }

    const body = req.body as KafkaSchemaFetchRequest;
    if (!body.schemaConfig || !body.schemaConfig.registryUrl) {
      return sendEnvelope(res, createKafkaErrorEnvelope('schema-fetch', {
        code: 'KAFKA_INVALID_REQUEST',
        message: 'schemaConfig.registryUrl is required',
      }));
    }
    if (!body.subject || typeof body.subject !== 'string' || !body.subject.trim()) {
      return sendEnvelope(res, createKafkaErrorEnvelope('schema-fetch', {
        code: 'KAFKA_INVALID_REQUEST',
        message: 'subject is required',
      }));
    }

    try {
      const result = await fetchSchema(body.schemaConfig, body.subject, body.version);
      return sendEnvelope(res, createKafkaSuccessEnvelope('schema-fetch', result));
    } catch (error) {
      return sendEnvelope(res, toSchemaErrorEnvelope('schema-fetch', error));
    }
  });

  return router;
}
