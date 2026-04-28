/**
 * Shared SQL schema for correlation persistence.
 * Used by both SQLite and PostgreSQL stores.
 *
 * Tables:
 * - paused_workflows:   Active paused correlations waiting for webhooks
 * - unmatched_webhooks: Log of webhook calls that didn't match any correlation
 */

// ── DDL ──────────────────────────────────────────────

export const SCHEMA_SQLITE = `
CREATE TABLE IF NOT EXISTS paused_workflows (
  correlation_id   TEXT PRIMARY KEY,
  webhook_path     TEXT NOT NULL,
  execution_id     TEXT NOT NULL,
  workflow_id      TEXT NOT NULL,
  paused_node_id   TEXT NOT NULL,
  paused_at        INTEGER NOT NULL,
  timeout_at       INTEGER NOT NULL DEFAULT 0,
  webhook_filter   TEXT,
  correlation_source TEXT NOT NULL DEFAULT 'body',
  correlation_json_path  TEXT,
  correlation_header     TEXT,
  correlation_query_param TEXT,
  state_json       TEXT NOT NULL,
  resumed          INTEGER NOT NULL DEFAULT 0,
  webhook_data     TEXT
);

CREATE INDEX IF NOT EXISTS idx_pw_timeout ON paused_workflows(timeout_at);
CREATE INDEX IF NOT EXISTS idx_pw_webhook_path ON paused_workflows(webhook_path);
CREATE INDEX IF NOT EXISTS idx_pw_resumed ON paused_workflows(resumed);

CREATE TABLE IF NOT EXISTS unmatched_webhooks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  path        TEXT NOT NULL,
  correlation_id TEXT,
  payload     TEXT,
  received_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_uw_received ON unmatched_webhooks(received_at);
`;

export const SCHEMA_POSTGRES = `
CREATE TABLE IF NOT EXISTS paused_workflows (
  correlation_id   TEXT PRIMARY KEY,
  webhook_path     TEXT NOT NULL,
  execution_id     TEXT NOT NULL,
  workflow_id      TEXT NOT NULL,
  paused_node_id   TEXT NOT NULL,
  paused_at        BIGINT NOT NULL,
  timeout_at       BIGINT NOT NULL DEFAULT 0,
  webhook_filter   TEXT,
  correlation_source TEXT NOT NULL DEFAULT 'body',
  correlation_json_path  TEXT,
  correlation_header     TEXT,
  correlation_query_param TEXT,
  state_json       TEXT NOT NULL,
  resumed          BOOLEAN NOT NULL DEFAULT FALSE,
  webhook_data     TEXT
);

CREATE INDEX IF NOT EXISTS idx_pw_timeout ON paused_workflows(timeout_at);
CREATE INDEX IF NOT EXISTS idx_pw_webhook_path ON paused_workflows(webhook_path);
CREATE INDEX IF NOT EXISTS idx_pw_resumed ON paused_workflows(resumed);

CREATE TABLE IF NOT EXISTS unmatched_webhooks (
  id          SERIAL PRIMARY KEY,
  path        TEXT NOT NULL,
  correlation_id TEXT,
  payload     TEXT,
  received_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_uw_received ON unmatched_webhooks(received_at);
`;

// ── Row type (shared between stores) ─────────────────

export interface PausedWorkflowRow {
  correlation_id: string;
  webhook_path: string;
  execution_id: string;
  workflow_id: string;
  paused_node_id: string;
  paused_at: number;
  timeout_at: number;
  webhook_filter: string | null;
  correlation_source: string;
  correlation_json_path: string | null;
  correlation_header: string | null;
  correlation_query_param: string | null;
  state_json: string;
  resumed: number | boolean;
  webhook_data: string | null;
}

export interface UnmatchedWebhookRow {
  id: number;
  path: string;
  correlation_id: string | null;
  payload: string | null;
  received_at: number;
}
