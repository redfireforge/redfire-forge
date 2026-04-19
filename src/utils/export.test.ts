import { describe, it, expect, vi } from 'vitest';
import { escapeCsv, exportCsv, exportJson } from './export';
import * as fileSaver from './fileSaver';

vi.mock('./fileSaver', () => ({
  saveJsonFile: vi.fn(),
  saveCsvFile: vi.fn(),
  buildExportFilename: vi.fn(({ level, ext }: { level: string; ext?: string }) => `test-${level}.${ext ?? 'json'}`),
}));

describe('escapeCsv', () => {
  it('returns value as-is when no special characters', () => {
    expect(escapeCsv('hello')).toBe('hello');
  });

  it('wraps value with quotes when it contains a comma', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"');
  });

  it('wraps value with quotes when it contains a newline', () => {
    expect(escapeCsv('a\nb')).toBe('"a\nb"');
  });

  it('escapes internal double quotes', () => {
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
  });

  it('handles combined special characters', () => {
    expect(escapeCsv('a,"b"\nc')).toBe('"a,""b""\nc"');
  });

  it('returns empty string as-is', () => {
    expect(escapeCsv('')).toBe('');
  });
});

describe('exportJson', () => {
  it('calls saveJsonFile with correct filename', () => {
    const run = {
      id: '1', envName: 'dev', svcName: 'api', timestamp: Date.now(),
      results: [], totalRequests: 0, passedRequests: 0, failedRequests: 0,
      avgResponseTime: 0, scenarios: [], config: {} as any,
    };
    exportJson(run as any);
    expect(fileSaver.saveJsonFile).toHaveBeenCalledWith(run, expect.stringContaining('test-'));
  });
});

describe('exportCsv', () => {
  it('generates CSV with headers for empty results', () => {
    exportCsv([], 'dev', 'svc');
    expect(fileSaver.saveCsvFile).toHaveBeenCalledWith(
      expect.stringContaining('Scenario,URL,Method'),
      expect.any(String),
    );
  });

  it('creates row for result with no failures', () => {
    const result = {
      scenarioName: 'test', url: 'http://a.com', method: 'GET',
      httpStatus: 200, responseTimeMs: 50, validationMode: 'status',
      passed: true, failureDetails: [], errorMessage: null,
      timestamp: Date.now(),
    };
    exportCsv([result as any]);
    const call = (fileSaver.saveCsvFile as any).mock.calls.at(-1);
    expect(call[0]).toContain('test');
    expect(call[0]).toContain('200');
    expect(call[0]).toContain('true');
  });

  it('creates rows for each failure detail', () => {
    const result = {
      scenarioName: 'test', url: 'http://a.com', method: 'POST',
      httpStatus: 500, responseTimeMs: 100, validationMode: 'json',
      passed: false, timestamp: Date.now(), errorMessage: 'oops',
      failureDetails: [
        { path: '$.a', expected: '1', actual: '2' },
        { path: '$.b', expected: 'x', actual: 'y' },
      ],
    };
    exportCsv([result as any]);
    const csv: string = (fileSaver.saveCsvFile as any).mock.calls.at(-1)[0];
    const lines = csv.split('\n');
    expect(lines.length).toBe(3); // header + 2 failure rows
  });
});
