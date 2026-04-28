import type { ExpressionFunction } from './types';
import { s, n } from './helpers';

const $now: ExpressionFunction = {
  name: '$now', category: 'Date/Time',
  signature: '$now() → string',
  description: 'Return the current date/time as an ISO 8601 string.',
  args: [],
  returnType: 'string',
  examples: [{ input: '$now()', output: '2024-01-15T10:30:00.000Z' }],
  evaluate: () => new Date().toISOString(),
};

const $toIso: ExpressionFunction = {
  name: '$toIso', category: 'Date/Time',
  signature: '$toIso(timestamp) → string',
  description: 'Convert a Unix timestamp (ms) or date string to ISO 8601.',
  args: [{ name: 'timestamp', type: 'number | string', required: true, description: 'Timestamp or date string' }],
  returnType: 'string',
  examples: [{ input: '$toIso(1705312200000)', output: '2024-01-15T10:30:00.000Z' }],
  evaluate: (v) => { try { return new Date(isNaN(Number(v)) ? s(v) : Number(v)).toISOString(); } catch { return ''; } },
};

const $formatDate: ExpressionFunction = {
  name: '$formatDate', category: 'Date/Time',
  signature: '$formatDate(date, format?) → string',
  description: 'Format a date. Supports YYYY, MM, DD, HH, mm, ss tokens. Default: YYYY-MM-DD.',
  args: [
    { name: 'date', type: 'string | number', required: true, description: 'Date string or timestamp' },
    { name: 'format', type: 'string', required: false, description: 'Format pattern (default: YYYY-MM-DD)' },
  ],
  returnType: 'string',
  examples: [{ input: '$formatDate("2024-01-15T10:30:00Z", "YYYY/MM/DD")', output: '2024/01/15' }],
  evaluate: (v, fmt) => {
    try {
      const d = new Date(isNaN(Number(v)) ? s(v) : Number(v));
      if (isNaN(d.getTime())) return '';
      const pattern = fmt ? s(fmt) : 'YYYY-MM-DD';
      const pad = (x: number) => String(x).padStart(2, '0');
      return pattern
        .replace('YYYY', String(d.getUTCFullYear()))
        .replace('MM', pad(d.getUTCMonth() + 1))
        .replace('DD', pad(d.getUTCDate()))
        .replace('HH', pad(d.getUTCHours()))
        .replace('mm', pad(d.getUTCMinutes()))
        .replace('ss', pad(d.getUTCSeconds()));
    } catch { return ''; }
  },
};

const $diffMs: ExpressionFunction = {
  name: '$diffMs', category: 'Date/Time',
  signature: '$diffMs(date1, date2) → number',
  description: 'Return the difference in milliseconds between two dates (date1 - date2).',
  args: [
    { name: 'date1', type: 'string | number', required: true, description: 'First date' },
    { name: 'date2', type: 'string | number', required: true, description: 'Second date' },
  ],
  returnType: 'number',
  examples: [{ input: '$diffMs("2024-01-16", "2024-01-15")', output: '86400000' }],
  evaluate: (a, b) => {
    try {
      const d1 = new Date(isNaN(Number(a)) ? s(a) : Number(a)).getTime();
      const d2 = new Date(isNaN(Number(b)) ? s(b) : Number(b)).getTime();
      return d1 - d2;
    } catch { return 0; }
  },
};

const $addDays: ExpressionFunction = {
  name: '$addDays', category: 'Date/Time',
  signature: '$addDays(date, days) → string',
  description: 'Add `days` to a date and return ISO string.',
  args: [
    { name: 'date', type: 'string | number', required: true, description: 'Base date' },
    { name: 'days', type: 'number', required: true, description: 'Days to add (can be negative)' },
  ],
  returnType: 'string',
  examples: [{ input: '$addDays("2024-01-15", 7)', output: '2024-01-22T00:00:00.000Z' }],
  evaluate: (v, days) => {
    try {
      const d = new Date(isNaN(Number(v)) ? s(v) : Number(v));
      d.setDate(d.getDate() + n(days));
      return d.toISOString();
    } catch { return ''; }
  },
};

const $addHours: ExpressionFunction = {
  name: '$addHours', category: 'Date/Time',
  signature: '$addHours(date, hours) → string',
  description: 'Add `hours` to a date and return ISO string.',
  args: [
    { name: 'date', type: 'string | number', required: true, description: 'Base date' },
    { name: 'hours', type: 'number', required: true, description: 'Hours to add (can be negative)' },
  ],
  returnType: 'string',
  examples: [{ input: '$addHours("2024-01-15T10:00:00Z", 3)', output: '2024-01-15T13:00:00.000Z' }],
  evaluate: (v, hours) => {
    try {
      const d = new Date(isNaN(Number(v)) ? s(v) : Number(v));
      d.setTime(d.getTime() + n(hours) * 3600000);
      return d.toISOString();
    } catch { return ''; }
  },
};

const $timestamp: ExpressionFunction = {
  name: '$timestamp', category: 'Date/Time',
  signature: '$timestamp() → number',
  description: 'Return the current Unix timestamp in milliseconds.',
  args: [],
  returnType: 'number',
  examples: [{ input: '$timestamp()', output: '1705312200000' }],
  evaluate: () => Date.now(),
};

const $epoch: ExpressionFunction = {
  name: '$epoch', category: 'Date/Time',
  signature: '$epoch(date) → number',
  description: 'Convert a date string to Unix timestamp in milliseconds.',
  args: [{ name: 'date', type: 'string', required: true, description: 'Date string to convert' }],
  returnType: 'number',
  examples: [{ input: '$epoch("2024-01-15T10:30:00Z")', output: '1705314600000' }],
  evaluate: (v) => { try { const t = new Date(s(v)).getTime(); return isNaN(t) ? 0 : t; } catch { return 0; } },
};

export const dateTimeFunctions: ExpressionFunction[] = [
  $now, $toIso, $formatDate, $diffMs, $addDays,
  $addHours, $timestamp, $epoch,
];
