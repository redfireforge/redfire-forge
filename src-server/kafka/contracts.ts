export type KafkaOperation =
  | 'connect'
  | 'disconnect'
  | 'status'
  | 'topics'
  | 'produce'
  | 'consume-once'
  | 'subscribe'
  | 'subscriptions'
  | 'unsubscribe';

export type KafkaServiceState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type KafkaAuthMode = 'none' | 'plain' | 'scram-sha-256' | 'scram-sha-512';

export interface KafkaAuthConfig {
  mode: KafkaAuthMode;
  username?: string;
  password?: string;
}

export interface KafkaTlsConfig {
  enabled: boolean;
  rejectUnauthorized?: boolean;
  serverName?: string;
  caPem?: string;
  certPem?: string;
  keyPem?: string;
  passphrase?: string;
}

export interface KafkaConnectionConfig {
  clusterId: string;
  clientId: string;
  brokers: string[];
  connectionTimeoutMs?: number;
  requestTimeoutMs?: number;
  auth?: KafkaAuthConfig;
  tls?: KafkaTlsConfig;
}

export interface KafkaConnectRequest {
  connection: KafkaConnectionConfig;
}

export interface KafkaDisconnectRequest {
  clusterId?: string;
}

export interface KafkaStatusRequest {
  clusterId?: string;
}

export interface KafkaTopicsRequest {
  clusterId?: string;
  includeInternal?: boolean;
}

export interface KafkaProduceMessage {
  key?: string;
  value: string;
  headers?: Record<string, string>;
  partition?: number;
  timestamp?: string;
}

export interface KafkaProduceRequest {
  clusterId?: string;
  topic: string;
  messages: KafkaProduceMessage[];
  acks?: number;
  timeoutMs?: number;
}

export interface KafkaProduceRecordResult {
  partition: number;
  offset: string;
  timestamp?: string;
}

export interface KafkaProduceResult {
  clusterId?: string;
  topic: string;
  sentCount: number;
  records: KafkaProduceRecordResult[];
}

export interface KafkaMessageFilter {
  keyEquals?: string;
  headersMatch?: Record<string, string>;
  jsonPath?: string;
  jsonEquals?: string;
}

export interface KafkaConsumeOnceRequest {
  clusterId?: string;
  topic: string;
  groupId?: string;
  fromBeginning?: boolean;
  timeoutMs?: number;
  maxMessages?: number;
  filter?: KafkaMessageFilter;
}

export interface KafkaSubscribeRequest {
  clusterId?: string;
  topic: string;
  groupId?: string;
  fromBeginning?: boolean;
  filter?: KafkaMessageFilter;
  maxInMemoryMessages?: number;
}

export interface KafkaSubscriptionsRequest {
  clusterId?: string;
}

export interface KafkaUnsubscribeRequest {
  clusterId?: string;
  subscriptionId: string;
}

export interface KafkaServiceStatus {
  state: KafkaServiceState;
  clusterId?: string;
  connectedAt?: string;
  lastError?: string;
  subscriptionCount?: number;
}

export interface KafkaConnectResult {
  status: KafkaServiceStatus;
  reusedExistingConnection: boolean;
}

export interface KafkaDisconnectResult {
  status: KafkaServiceStatus;
  disconnected: boolean;
  cleanedSubscriptions: number;
}

export interface KafkaTopicSummary {
  name: string;
  partitions: number;
  isInternal: boolean;
}

export interface KafkaTopicsResult {
  clusterId?: string;
  topics: KafkaTopicSummary[];
}

export interface KafkaConsumeRecord {
  topic: string;
  partition: number;
  offset: string;
  timestamp?: string;
  key?: string;
  value: string;
  headers?: Record<string, string>;
}

export interface KafkaConsumeResult {
  messageCount: number;
  messages: KafkaConsumeRecord[];
  timedOut: boolean;
}

export interface KafkaSubscribeInfo {
  subscriptionId: string;
  topic: string;
  groupId: string;
  createdAt: string;
}

export interface KafkaSubscribeResult {
  clusterId?: string;
  subscription: KafkaSubscribeInfo;
}

export interface KafkaSubscriptionsResult {
  clusterId?: string;
  subscriptions: KafkaSubscribeInfo[];
}

export interface KafkaUnsubscribeResult {
  clusterId?: string;
  subscriptionId: string;
  unsubscribed: boolean;
}

export interface KafkaEnvelopeMeta {
  requestId?: string;
  durationMs?: number;
  timestamp: string;
}

export interface KafkaSuccessEnvelope<TData> {
  ok: true;
  op: KafkaOperation;
  data: TData;
  meta: KafkaEnvelopeMeta;
}

export interface KafkaErrorBody {
  code: string;
  message: string;
  retryable?: boolean;
  details?: unknown;
}

export interface KafkaErrorEnvelope {
  ok: false;
  op: KafkaOperation;
  error: KafkaErrorBody;
  meta: KafkaEnvelopeMeta;
}

export type KafkaRouteEnvelope<TData> = KafkaSuccessEnvelope<TData> | KafkaErrorEnvelope;

export function createKafkaSuccessEnvelope<TData>(
  op: KafkaOperation,
  data: TData,
  meta?: Partial<KafkaEnvelopeMeta>,
): KafkaSuccessEnvelope<TData> {
  return {
    ok: true,
    op,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

export function createKafkaErrorEnvelope(
  op: KafkaOperation,
  error: KafkaErrorBody,
  meta?: Partial<KafkaEnvelopeMeta>,
): KafkaErrorEnvelope {
  return {
    ok: false,
    op,
    error,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}