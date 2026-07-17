import { describe, it, expect } from 'vitest';
import {
  ADD_ASSERTION_MENU_ROWS,
  ASSERTION_CATEGORIES,
  getTransportFilter,
  isRowVisibleForTransport,
} from './testEditorValidationAddMenu';

describe('getTransportFilter', () => {
  it('returns "http" for undefined', () => {
    expect(getTransportFilter(undefined)).toBe('http');
  });

  it('returns "http" for "http"', () => {
    expect(getTransportFilter('http')).toBe('http');
  });

  it('returns "ws" for wsConnect', () => {
    expect(getTransportFilter('wsConnect')).toBe('ws');
  });

  it('returns "ws" for wsSend', () => {
    expect(getTransportFilter('wsSend')).toBe('ws');
  });

  it('returns "ws" for wsReceive', () => {
    expect(getTransportFilter('wsReceive')).toBe('ws');
  });

  it('returns "kafka" for kafkaProduce', () => {
    expect(getTransportFilter('kafkaProduce')).toBe('kafka');
  });

  it('returns "kafka" for kafkaConsume', () => {
    expect(getTransportFilter('kafkaConsume')).toBe('kafka');
  });

  it('falls back to "http" for unsupported action types', () => {
    expect(getTransportFilter('graphql' as never)).toBe('http');
  });
});

describe('isRowVisibleForTransport', () => {
  it('always shows dividers', () => {
    expect(isRowVisibleForTransport({ kind: 'divider' }, 'http')).toBe(true);
    expect(isRowVisibleForTransport({ kind: 'divider' }, 'ws')).toBe(true);
    expect(isRowVisibleForTransport({ kind: 'divider' }, 'kafka')).toBe(true);
  });

  it('shows rows without transport filter for all transports', () => {
    const row = ADD_ASSERTION_MENU_ROWS.find(
      r => r.kind === 'item' && 'label' in r && r.label === 'Response Time SLA',
    )!;
    expect(isRowVisibleForTransport(row, 'http')).toBe(true);
    expect(isRowVisibleForTransport(row, 'ws')).toBe(true);
    expect(isRowVisibleForTransport(row, 'kafka')).toBe(true);
  });

  it('shows HTTP-only rows for HTTP', () => {
    const statusRow = ADD_ASSERTION_MENU_ROWS.find(
      r => r.kind === 'item' && 'label' in r && r.label === 'Status Code',
    )!;
    expect(isRowVisibleForTransport(statusRow, 'http')).toBe(true);
    expect(isRowVisibleForTransport(statusRow, 'ws')).toBe(false);
    expect(isRowVisibleForTransport(statusRow, 'kafka')).toBe(false);
  });

  it('shows WS-only rows for WS', () => {
    const wsRow = ADD_ASSERTION_MENU_ROWS.find(
      r => r.kind === 'item' && 'label' in r && r.label === 'WS Body',
    )!;
    expect(isRowVisibleForTransport(wsRow, 'ws')).toBe(true);
    expect(isRowVisibleForTransport(wsRow, 'http')).toBe(false);
    expect(isRowVisibleForTransport(wsRow, 'kafka')).toBe(false);
  });

  it('shows Kafka-only rows for Kafka', () => {
    const kafkaRow = ADD_ASSERTION_MENU_ROWS.find(
      r => r.kind === 'item' && 'label' in r && r.label === 'Kafka Body',
    )!;
    expect(isRowVisibleForTransport(kafkaRow, 'kafka')).toBe(true);
    expect(isRowVisibleForTransport(kafkaRow, 'http')).toBe(false);
    expect(isRowVisibleForTransport(kafkaRow, 'ws')).toBe(false);
  });

  it('applies transport filtering for regex builder rows', () => {
    const regexBuilderRow = {
      kind: 'regexBuilder' as const,
      icon: 'x',
      label: 'Regex Builder',
      desc: 'builder',
      category: 'Field Validation',
      transport: 'ws' as const,
    };
    expect(isRowVisibleForTransport(regexBuilderRow, 'ws')).toBe(true);
    expect(isRowVisibleForTransport(regexBuilderRow, 'http')).toBe(false);
    expect(isRowVisibleForTransport(regexBuilderRow, 'kafka')).toBe(false);
  });
});

describe('ASSERTION_CATEGORIES', () => {
  it('includes transport-specific categories', () => {
    expect(ASSERTION_CATEGORIES).toContain('WebSocket');
    expect(ASSERTION_CATEGORIES).toContain('Kafka');
  });

  it('includes standard categories', () => {
    expect(ASSERTION_CATEGORIES).toContain('Response');
    expect(ASSERTION_CATEGORIES).toContain('Field Validation');
    expect(ASSERTION_CATEGORIES).toContain('Array & Structure');
    expect(ASSERTION_CATEGORIES).toContain('Schema & Advanced');
  });
});

describe('ADD_ASSERTION_MENU_ROWS', () => {
  it('has 7 WS assertion presets', () => {
    const wsRows = ADD_ASSERTION_MENU_ROWS.filter(
      r => r.kind === 'item' && 'transport' in r && r.transport === 'ws',
    );
    expect(wsRows).toHaveLength(7);
  });

  it('has 3 Kafka assertion presets', () => {
    const kafkaRows = ADD_ASSERTION_MENU_ROWS.filter(
      r => r.kind === 'item' && 'transport' in r && r.transport === 'kafka',
    );
    expect(kafkaRows).toHaveLength(3);
  });

  it('has HTTP-specific rows tagged with transport: http', () => {
    const httpOnlyRows = ADD_ASSERTION_MENU_ROWS.filter(
      r => r.kind !== 'divider' && 'transport' in r && r.transport === 'http',
    );
    expect(httpOnlyRows.length).toBeGreaterThanOrEqual(3);
  });

  it('has transport-agnostic rows without transport filter', () => {
    const agnosticRows = ADD_ASSERTION_MENU_ROWS.filter(
      r => r.kind !== 'divider' && !('transport' in r && r.transport),
    );
    expect(agnosticRows.length).toBeGreaterThanOrEqual(10);
  });

  it('builds a date-precise assertion dynamically', () => {
    const datePrecise = ADD_ASSERTION_MENU_ROWS.find(
      r => r.kind === 'item' && 'label' in r && r.label === 'Date Precise',
    );
    expect(datePrecise).toBeDefined();
    if (!datePrecise || datePrecise.kind !== 'item') return;
    expect(typeof datePrecise.assertion).toBe('function');
    const built = (datePrecise.assertion as () => { type: string; reference: string; precision: string })();
    expect(built.type).toBe('datePrecise');
    expect(built.precision).toBe('second');
    expect(new Date(built.reference).toString()).not.toBe('Invalid Date');
  });
});
