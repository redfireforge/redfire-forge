import { Router, type Request, type Response } from 'express';
import { kafkaService, type KafkaService } from '../kafka/kafka-service.js';
import { toErrorMessage } from '../../src/shared/utils/helpers.js';
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
  type KafkaTopicDetailRequest,
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

/** Safely extract a query parameter as a string, returning `undefined` for non-string values. */
function toStringQuery(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
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
      clusterId: toStringQuery(req.query.clusterId),
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
      clusterId: toStringQuery(req.query.clusterId),
      includeInternal,
    };

    const envelope = await service.listTopics(request);
    return sendEnvelope(res, envelope);
  });

  router.get('/api/kafka/topics/:topicName/detail', async (req: Request, res: Response) => {
    const topicName = req.params.topicName;
    const clusterId = toStringQuery(req.query.clusterId);

    try {
      const request: KafkaTopicDetailRequest = { clusterId };
      const envelope = await service.getTopicDetail(topicName, request);
      return sendEnvelope(res, envelope);
    } catch (error) {
      return sendEnvelope(res, createKafkaErrorEnvelope('topic-detail', {
        code: 'KAFKA_TOPIC_DETAIL_FAILED',
        message: toErrorMessage(error) || `Failed to fetch topic detail for '${topicName}'`,
      }));
    }
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
      clusterId: toStringQuery(req.query.clusterId),
    };

    const envelope = service.getSubscriptions(request);
    return sendEnvelope(res, envelope);
  });

  router.get('/api/kafka/subscription-messages', (req: Request, res: Response) => {
    const subscriptionId = toStringQuery(req.query.subscriptionId);
    const sinceCursorRaw = req.query.sinceCursor;
    const sinceCursor = typeof sinceCursorRaw === 'string' ? parseInt(sinceCursorRaw, 10) : undefined;

    if (!subscriptionId) {
      return sendEnvelope(res, createKafkaErrorEnvelope('subscription-messages', {
        code: 'KAFKA_INVALID_REQUEST',
        message: 'subscriptionId query parameter is required',
      }));
    }

    const envelope = service.getSubscriptionMessages({
      clusterId: toStringQuery(req.query.clusterId),
      subscriptionId,
      sinceCursor: sinceCursor !== undefined && !isNaN(sinceCursor) ? sinceCursor : undefined,
    });
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
    const message = toErrorMessage(error);
    return createKafkaErrorEnvelope(op, {
      code: 'REGISTRY_UNREACHABLE',
      message: `Schema registry error: ${message}`,
      retryable: true,
    });
  }

  /** Returns an error envelope when schemaConfig.registryUrl is missing; null otherwise. */
  function requireSchemaConfig(op: KafkaOperation, schemaConfig: unknown): KafkaRouteEnvelope<never> | null {
    if (!schemaConfig || typeof schemaConfig !== 'object' || !(schemaConfig as Record<string, unknown>).registryUrl) {
      return createKafkaErrorEnvelope(op, {
        code: 'KAFKA_INVALID_REQUEST',
        message: 'schemaConfig.registryUrl is required',
      });
    }
    return null;
  }

  /** Returns an error envelope when subject is missing or blank; null otherwise. */
  function requireSubject(op: KafkaOperation, subject: unknown): KafkaRouteEnvelope<never> | null {
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return createKafkaErrorEnvelope(op, {
        code: 'KAFKA_INVALID_REQUEST',
        message: 'subject is required',
      });
    }
    return null;
  }


  router.post('/api/kafka/schema-subjects', async (req: Request, res: Response) => {
    const bodyError = requireBodyObject(req, 'schema-subjects');
    if (bodyError) {
      return sendEnvelope(res, bodyError);
    }

    const body = req.body as KafkaSchemaSubjectsRequest;
    const schemaSubjectsConfigError = requireSchemaConfig('schema-subjects', body.schemaConfig);
    if (schemaSubjectsConfigError) return sendEnvelope(res, schemaSubjectsConfigError);

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
    const schemaVersionsConfigError = requireSchemaConfig('schema-versions', body.schemaConfig);
    if (schemaVersionsConfigError) return sendEnvelope(res, schemaVersionsConfigError);
    const schemaVersionsSubjectError = requireSubject('schema-versions', body.subject);
    if (schemaVersionsSubjectError) return sendEnvelope(res, schemaVersionsSubjectError);

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
    const schemaFetchConfigError = requireSchemaConfig('schema-fetch', body.schemaConfig);
    if (schemaFetchConfigError) return sendEnvelope(res, schemaFetchConfigError);
    const schemaFetchSubjectError = requireSubject('schema-fetch', body.subject);
    if (schemaFetchSubjectError) return sendEnvelope(res, schemaFetchSubjectError);

    try {
      const result = await fetchSchema(body.schemaConfig, body.subject, body.version);
      return sendEnvelope(res, createKafkaSuccessEnvelope('schema-fetch', result));
    } catch (error) {
      return sendEnvelope(res, toSchemaErrorEnvelope('schema-fetch', error));
    }
  });

  return router;
}
