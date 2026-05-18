import { describe, it, expect, vi, beforeEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';
import {
  getAppDataPath,
  readJsonFileOrDefault,
  writeJsonFile,
  getWorkflow,
  saveWorkflow,
  listWorkflows,
  saveExecutionResult,
  getExecutionHistory,
  logWebhookDelivery,
  getWebhookDeliveries,
  loadScheduleTriggers,
  saveScheduleTriggers,
  loadWebhookTriggers,
  saveWebhookTriggers,
} from './file-storage';
import type { ExecutionResult, WebhookDelivery, ScheduleTrigger, WebhookTrigger } from '../src/shared/types/server-api';

vi.mock('fs', () => {
  const actual = vi.importActual('fs');
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      appendFile: vi.fn(),
    },
  };
});

const mockFs = vi.mocked(fs);

vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return { ...actual, default: { ...(actual as Record<string, unknown>).default as Record<string, unknown>, platform: vi.fn(), homedir: vi.fn() } };
});

const mockOs = vi.mocked(os);

describe('getAppDataPath', () => {
  const origHome = '/Users/testuser';

  beforeEach(() => {
    mockOs.homedir.mockReturnValue(origHome);
  });

  it('returns macOS path on darwin', () => {
    mockOs.platform.mockReturnValue('darwin');
    const result = getAppDataPath();
    expect(result).toBe(join(origHome, 'Library/Application Support/redfireforge'));
  });

  it('returns Windows path on win32 with APPDATA', () => {
    mockOs.platform.mockReturnValue('win32');
    const origAppdata = process.env.APPDATA;
    process.env.APPDATA = 'C:\\Users\\test\\AppData\\Roaming';
    const result = getAppDataPath();
    expect(result).toBe(join('C:\\Users\\test\\AppData\\Roaming', 'redfireforge'));
    process.env.APPDATA = origAppdata;
  });

  it('returns Windows fallback path on win32 without APPDATA', () => {
    mockOs.platform.mockReturnValue('win32');
    const origAppdata = process.env.APPDATA;
    delete process.env.APPDATA;
    const result = getAppDataPath();
    expect(result).toBe(join(origHome, 'AppData/Roaming', 'redfireforge'));
    process.env.APPDATA = origAppdata;
  });

  it('returns Linux path on linux', () => {
    mockOs.platform.mockReturnValue('linux');
    const result = getAppDataPath();
    expect(result).toBe(join(origHome, '.local/share/redfireforge'));
  });

  it('contains redfireforge in the path', () => {
    mockOs.platform.mockReturnValue('darwin');
    expect(getAppDataPath()).toContain('redfireforge');
  });
});

describe('readJsonFileOrDefault', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns parsed JSON when file exists', async () => {
    mockFs.readFile.mockResolvedValue(JSON.stringify({ name: 'test' }));
    const result = await readJsonFileOrDefault('/some/file.json', null);
    expect(result).toEqual({ name: 'test' });
  });

  it('returns default value when file does not exist (ENOENT)', async () => {
    const err = new Error('not found') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockFs.readFile.mockRejectedValue(err);
    const result = await readJsonFileOrDefault('/missing.json', []);
    expect(result).toEqual([]);
  });

  it('re-throws non-ENOENT errors', async () => {
    const err = new Error('permission denied') as NodeJS.ErrnoException;
    err.code = 'EACCES';
    mockFs.readFile.mockRejectedValue(err);
    await expect(readJsonFileOrDefault('/perm.json', null)).rejects.toThrow('permission denied');
  });
});

describe('writeJsonFile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates directory and writes JSON', async () => {
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    await writeJsonFile('/data/dir/file.json', { key: 'value' });

    expect(mockFs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/data/dir/file.json',
      JSON.stringify({ key: 'value' }, null, 2)
    );
  });
});

describe('getWorkflow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns workflow data when file exists', async () => {
    const workflow = { id: 'w1', name: 'Test', nodes: [], edges: [] };
    mockFs.readFile.mockResolvedValue(JSON.stringify(workflow));
    const result = await getWorkflow('w1');
    expect(result).toEqual(workflow);
  });

  it('returns null when workflow file does not exist', async () => {
    const err = new Error('not found') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockFs.readFile.mockRejectedValue(err);
    const result = await getWorkflow('nonexistent');
    expect(result).toBeNull();
  });
});

describe('saveWorkflow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes workflow JSON file', async () => {
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    const workflow = { id: 'w1', name: 'Test', nodes: [], edges: [] } as unknown as Parameters<typeof saveWorkflow>[0];
    await saveWorkflow(workflow);

    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('w1.json'),
      expect.any(String)
    );
  });
});

describe('listWorkflows', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns workflow IDs from directory', async () => {
    mockFs.readdir.mockResolvedValue(['w1.json', 'w2.json', 'readme.txt'] as never);
    const result = await listWorkflows();
    expect(result).toEqual(['w1', 'w2']);
  });

  it('returns empty array when directory does not exist', async () => {
    const err = new Error('not found') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockFs.readdir.mockRejectedValue(err);
    const result = await listWorkflows();
    expect(result).toEqual([]);
  });

  it('re-throws non-ENOENT errors', async () => {
    const err = new Error('permission') as NodeJS.ErrnoException;
    err.code = 'EACCES';
    mockFs.readdir.mockRejectedValue(err);
    await expect(listWorkflows()).rejects.toThrow('permission');
  });
});

describe('saveExecutionResult', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes execution result to dated folder', async () => {
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    const result: ExecutionResult = {
      id: 'exec-1',
      workflowId: 'w1',
      triggerId: 'trig-1',
      triggerType: 'webhook',
      status: 'success',
      duration: 100,
      results: [],
      variables: {},
      timestamp: '2025-01-15T10:00:00Z',
    };

    await saveExecutionResult(result);

    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('exec-1.json'),
      expect.any(String)
    );
  });
});

describe('getExecutionHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns executions sorted by date (newest first)', async () => {
    mockFs.readdir
      .mockResolvedValueOnce(['2025-01-14', '2025-01-15'] as never) // date folders
      .mockResolvedValueOnce(['e1.json'] as never) // files in 2025-01-15
      .mockResolvedValueOnce(['e2.json'] as never); // files in 2025-01-14

    const exec1: ExecutionResult = {
      id: 'e1', workflowId: 'w1', triggerId: 't1', triggerType: 'webhook',
      status: 'success', duration: 100, results: [], variables: {},
      timestamp: '2025-01-15T10:00:00Z',
    };
    const exec2: ExecutionResult = {
      id: 'e2', workflowId: 'w1', triggerId: 't1', triggerType: 'schedule',
      status: 'failed', duration: 200, results: [], variables: {},
      timestamp: '2025-01-14T10:00:00Z',
    };

    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as never);
    mockFs.readFile
      .mockResolvedValueOnce(JSON.stringify(exec1))
      .mockResolvedValueOnce(JSON.stringify(exec2));

    const result = await getExecutionHistory();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('e1');
    expect(result[1].id).toBe('e2');
  });

  it('returns empty array when executions directory does not exist', async () => {
    const err = new Error('not found') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockFs.readdir.mockRejectedValue(err);
    const result = await getExecutionHistory();
    expect(result).toEqual([]);
  });

  it('filters by workflowId when provided', async () => {
    mockFs.readdir
      .mockResolvedValueOnce(['2025-01-15'] as never)
      .mockResolvedValueOnce(['e1.json', 'e2.json'] as never);

    const exec1: ExecutionResult = {
      id: 'e1', workflowId: 'w1', triggerId: 't1', triggerType: 'webhook',
      status: 'success', duration: 100, results: [], variables: {},
      timestamp: '2025-01-15T10:00:00Z',
    };
    const exec2: ExecutionResult = {
      id: 'e2', workflowId: 'w2', triggerId: 't2', triggerType: 'schedule',
      status: 'success', duration: 150, results: [], variables: {},
      timestamp: '2025-01-15T09:00:00Z',
    };

    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as never);
    mockFs.readFile
      .mockResolvedValueOnce(JSON.stringify(exec1))
      .mockResolvedValueOnce(JSON.stringify(exec2));

    const result = await getExecutionHistory('w1');
    expect(result).toHaveLength(1);
    expect(result[0].workflowId).toBe('w1');
  });

  it('respects limit parameter', async () => {
    mockFs.readdir
      .mockResolvedValueOnce(['2025-01-15'] as never)
      .mockResolvedValueOnce(['e1.json', 'e2.json'] as never);

    const exec1: ExecutionResult = {
      id: 'e1', workflowId: 'w1', triggerId: 't1', triggerType: 'webhook',
      status: 'success', duration: 100, results: [], variables: {},
      timestamp: '2025-01-15T10:00:00Z',
    };

    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as never);
    mockFs.readFile.mockResolvedValue(JSON.stringify(exec1));

    const result = await getExecutionHistory(undefined, 1);
    expect(result).toHaveLength(1);
  });

  it('skips non-json files', async () => {
    mockFs.readdir
      .mockResolvedValueOnce(['2025-01-15'] as never)
      .mockResolvedValueOnce(['.DS_Store', 'e1.json'] as never);

    const exec1: ExecutionResult = {
      id: 'e1', workflowId: 'w1', triggerId: 't1', triggerType: 'webhook',
      status: 'success', duration: 100, results: [], variables: {},
      timestamp: '2025-01-15T10:00:00Z',
    };

    mockFs.stat.mockResolvedValue({ isDirectory: () => true } as never);
    mockFs.readFile.mockResolvedValue(JSON.stringify(exec1));

    const result = await getExecutionHistory();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('e1');
  });

  it('skips non-directory entries in date folders', async () => {
    mockFs.readdir
      .mockResolvedValueOnce(['2025-01-15', 'random-file.txt'] as never)
      .mockResolvedValueOnce(['e1.json'] as never);

    const exec1: ExecutionResult = {
      id: 'e1', workflowId: 'w1', triggerId: 't1', triggerType: 'webhook',
      status: 'success', duration: 100, results: [], variables: {},
      timestamp: '2025-01-15T10:00:00Z',
    };

    mockFs.stat
      .mockResolvedValueOnce({ isDirectory: () => true } as never)
      .mockResolvedValueOnce({ isDirectory: () => false } as never);
    mockFs.readFile.mockResolvedValue(JSON.stringify(exec1));

    const result = await getExecutionHistory();
    expect(result).toHaveLength(1);
  });

  it('re-throws non-ENOENT errors', async () => {
    const err = new Error('disk error') as NodeJS.ErrnoException;
    err.code = 'EIO';
    mockFs.readdir.mockRejectedValue(err);
    await expect(getExecutionHistory()).rejects.toThrow('disk error');
  });
});

describe('logWebhookDelivery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('appends JSONL line to daily file', async () => {
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.appendFile.mockResolvedValue(undefined);

    const delivery: WebhookDelivery = {
      triggerId: 't1',
      method: 'POST',
      payload: { key: 'val' },
      status: 'success',
      duration: 50,
      timestamp: '2025-01-15T10:00:00Z',
    };

    await logWebhookDelivery(delivery);

    expect(mockFs.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(mockFs.appendFile).toHaveBeenCalledWith(
      expect.stringContaining('.jsonl'),
      expect.stringContaining('"triggerId":"t1"')
    );
  });
});

describe('getWebhookDeliveries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads and parses JSONL file', async () => {
    const d1: WebhookDelivery = {
      triggerId: 't1', method: 'POST', payload: {}, status: 'success',
      timestamp: '2025-01-15T10:00:00Z',
    };
    const d2: WebhookDelivery = {
      triggerId: 't2', method: 'GET', payload: null, status: 'failed',
      timestamp: '2025-01-15T11:00:00Z',
    };

    mockFs.readFile.mockResolvedValue(
      JSON.stringify(d1) + '\n' + JSON.stringify(d2) + '\n'
    );

    const result = await getWebhookDeliveries('2025-01-15');
    expect(result).toHaveLength(2);
    expect(result[0].triggerId).toBe('t1');
    expect(result[1].triggerId).toBe('t2');
  });

  it('returns empty array when file does not exist', async () => {
    const err = new Error('not found') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockFs.readFile.mockRejectedValue(err);
    const result = await getWebhookDeliveries('2025-01-01');
    expect(result).toEqual([]);
  });

  it('handles empty lines in JSONL', async () => {
    const d1: WebhookDelivery = {
      triggerId: 't1', method: 'POST', payload: {}, status: 'success',
      timestamp: '2025-01-15T10:00:00Z',
    };
    mockFs.readFile.mockResolvedValue(
      '\n' + JSON.stringify(d1) + '\n\n'
    );
    const result = await getWebhookDeliveries('2025-01-15');
    expect(result).toHaveLength(1);
  });

  it('re-throws non-ENOENT errors', async () => {
    const err = new Error('read error') as NodeJS.ErrnoException;
    err.code = 'EIO';
    mockFs.readFile.mockRejectedValue(err);
    await expect(getWebhookDeliveries('2025-01-15')).rejects.toThrow('read error');
  });
});

describe('loadScheduleTriggers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns triggers from file', async () => {
    const triggers: ScheduleTrigger[] = [{
      id: 's1', workflowId: 'w1', nodeId: 'n1', enabled: true,
      cronExpression: '*/5 * * * *', timezone: 'UTC',
    }];
    mockFs.readFile.mockResolvedValue(JSON.stringify(triggers));
    const result = await loadScheduleTriggers();
    expect(result).toEqual(triggers);
  });

  it('returns empty array when file missing', async () => {
    const err = new Error('not found') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockFs.readFile.mockRejectedValue(err);
    const result = await loadScheduleTriggers();
    expect(result).toEqual([]);
  });
});

describe('saveScheduleTriggers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes triggers JSON file', async () => {
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    const triggers: ScheduleTrigger[] = [{
      id: 's1', workflowId: 'w1', nodeId: 'n1', enabled: true,
      cronExpression: '*/5 * * * *', timezone: 'UTC',
    }];
    await saveScheduleTriggers(triggers);
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('schedule-triggers.json'),
      expect.any(String)
    );
  });
});

describe('loadWebhookTriggers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns triggers from file', async () => {
    const triggers: WebhookTrigger[] = [{
      id: 'wh1', workflowId: 'w1', nodeId: 'n1', enabled: true,
      method: 'POST', path: '/hook',
    }];
    mockFs.readFile.mockResolvedValue(JSON.stringify(triggers));
    const result = await loadWebhookTriggers();
    expect(result).toEqual(triggers);
  });

  it('returns empty array when file missing', async () => {
    const err = new Error('not found') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockFs.readFile.mockRejectedValue(err);
    const result = await loadWebhookTriggers();
    expect(result).toEqual([]);
  });
});

describe('saveWebhookTriggers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes triggers JSON file', async () => {
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);

    const triggers: WebhookTrigger[] = [{
      id: 'wh1', workflowId: 'w1', nodeId: 'n1', enabled: true,
      method: 'POST', path: '/hook',
    }];
    await saveWebhookTriggers(triggers);
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('webhook-triggers.json'),
      expect.any(String)
    );
  });
});
