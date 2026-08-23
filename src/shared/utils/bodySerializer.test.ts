import { describe, it, expect, vi, afterEach } from 'vitest';
import { Scenario, KeyValue } from '../types';
import { getEffectiveBodyType, serializeWithContentType, serializeBody, getContentType, bodyFormToString, stringToBodyForm, } from './bodySerializer';
import { makeScenario as _makeScenario } from '@test-utils/factories';

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return _makeScenario({
    id: 's1',
    url: 'https://example.com',
    method: 'POST',
    ...overrides,
  });
}

describe('getEffectiveBodyType', () => {
  it('returns none for GET requests', () => {
    expect(getEffectiveBodyType(makeScenario({ method: 'GET', body: '{}' }))).toBe('none');
  });

  it('uses explicit bodyType when set', () => {
    expect(getEffectiveBodyType(makeScenario({ bodyType: 'xml', body: '<x/>' }))).toBe('xml');
  });

  it('defaults to json when body is present and bodyType not set', () => {
    expect(getEffectiveBodyType(makeScenario({ body: '{}' }))).toBe('json');
  });

  it('defaults to none when no body and no bodyType', () => {
    expect(getEffectiveBodyType(makeScenario())).toBe('none');
  });

  it('treats explicit bodyType none even when body is present', () => {
    expect(getEffectiveBodyType(makeScenario({ body: '{}', bodyType: 'none' }))).toBe('none');
  });

  it('defaults to none when body is empty string and bodyType unset', () => {
    expect(getEffectiveBodyType(makeScenario({ body: '', method: 'POST' }))).toBe('none');
  });
});

describe('serializeWithContentType', () => {
  it('returns undefined body and null contentType for none', () => {
    const result = serializeWithContentType(makeScenario({ method: 'GET' }));
    expect(result.body).toBeUndefined();
    expect(result.contentType).toBeNull();
  });

  it('serializes JSON body', () => {
    const result = serializeWithContentType(makeScenario({ body: '{"a":1}', bodyType: 'json' }));
    expect(result.body).toBe('{"a":1}');
    expect(result.contentType).toBe('application/json');
  });

  it('serializes XML body', () => {
    const result = serializeWithContentType(makeScenario({ body: '<root/>', bodyType: 'xml' }));
    expect(result.body).toBe('<root/>');
    expect(result.contentType).toBe('application/xml');
  });

  it('serializes text body', () => {
    const result = serializeWithContentType(makeScenario({ body: 'hello', bodyType: 'text' }));
    expect(result.body).toBe('hello');
    expect(result.contentType).toBe('text/plain');
  });

  it('serializes form-urlencoded', () => {
    const form: KeyValue[] = [{ key: 'name', value: 'test' }, { key: 'age', value: '30' }];
    const result = serializeWithContentType(makeScenario({ bodyType: 'form-urlencoded', bodyForm: form }));
    expect(result.contentType).toBe('application/x-www-form-urlencoded');
    expect(result.body).toBe('name=test&age=30');
  });

  it('skips empty form fields in form-urlencoded', () => {
    const form: KeyValue[] = [{ key: '', value: 'skip' }, { key: 'name', value: 'ok' }];
    const result = serializeWithContentType(makeScenario({ bodyType: 'form-urlencoded', bodyForm: form }));
    expect(result.body).toBe('name=ok');
  });

  it('trims keys for form-urlencoded', () => {
    const form: KeyValue[] = [{ key: '  name  ', value: 'ok' }];
    const result = serializeWithContentType(makeScenario({ bodyType: 'form-urlencoded', bodyForm: form }));
    expect(result.body).toBe('name=ok');
  });

  it('serializes form-data with boundary', () => {
    const form: KeyValue[] = [{ key: 'field1', value: 'val1' }];
    const result = serializeWithContentType(makeScenario({ bodyType: 'form-data', bodyForm: form }));
    expect(result.contentType).toContain('multipart/form-data; boundary=');
    expect(result.body).toContain('Content-Disposition: form-data; name="field1"');
    expect(result.body).toContain('val1');
  });

  it('form-data skips empty key fields', () => {
    const form: KeyValue[] = [{ key: '', value: 'skip' }, { key: 'ok', value: 'val' }];
    const result = serializeWithContentType(makeScenario({ bodyType: 'form-data', bodyForm: form }));
    expect(result.body).not.toContain('skip');
    expect(result.body).toContain('ok');
  });

  it('trims keys for form-data', () => {
    const form: KeyValue[] = [{ key: '  field  ', value: 'v' }];
    const result = serializeWithContentType(makeScenario({ bodyType: 'form-data', bodyForm: form }));
    expect(result.body).toContain('name="field"');
  });

  it('handles empty body returning undefined', () => {
    const result = serializeWithContentType(makeScenario({ body: '', bodyType: 'json' }));
    expect(result.body).toBeUndefined();
    expect(result.contentType).toBe('application/json');
  });

  it('handles file bodyType', () => {
    const result = serializeWithContentType(makeScenario({ body: 'data', bodyType: 'file' }));
    expect(result.contentType).toBe('application/octet-stream');
    expect(result.body).toBe('data');
  });
});

describe('serializeBody', () => {
  it('delegates to serializeWithContentType', () => {
    expect(serializeBody(makeScenario({ body: '{}', bodyType: 'json' }))).toBe('{}');
    expect(serializeBody(makeScenario({ method: 'GET' }))).toBeUndefined();
  });

  it('returns undefined for none body type explicitly', () => {
    expect(serializeBody(makeScenario({ bodyType: 'none', body: 'ignored' }))).toBeUndefined();
  });
});

describe('getContentType', () => {
  it('returns correct content type', () => {
    expect(getContentType(makeScenario({ body: '{}', bodyType: 'json' }))).toBe('application/json');
    expect(getContentType(makeScenario({ method: 'GET' }))).toBeNull();
  });
});

describe('bodyFormToString', () => {
  it('converts form to string', () => {
    const form: KeyValue[] = [{ key: 'a', value: '1' }, { key: 'b', value: '2' }];
    expect(bodyFormToString(form)).toBe('a=1&b=2');
  });

  it('skips empty key fields', () => {
    const form: KeyValue[] = [{ key: '', value: 'x' }, { key: 'a', value: '1' }];
    expect(bodyFormToString(form)).toBe('a=1');
  });

  it('returns empty string for empty form', () => {
    expect(bodyFormToString([])).toBe('');
  });

  it('keeps original key spacing in bodyFormToString output', () => {
    const form: KeyValue[] = [{ key: '  spaced  ', value: 'v' }];
    expect(bodyFormToString(form)).toBe('  spaced  =v');
  });
});

describe('stringToBodyForm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses query string into form fields', () => {
    const result = stringToBodyForm('name=test&age=30');
    expect(result).toEqual([{ key: 'name', value: 'test' }, { key: 'age', value: '30' }]);
  });

  it('returns empty entry for blank string', () => {
    expect(stringToBodyForm('')).toEqual([{ key: '', value: '' }]);
    expect(stringToBodyForm('   ')).toEqual([{ key: '', value: '' }]);
  });

  it('handles single param', () => {
    const result = stringToBodyForm('key=val');
    expect(result).toEqual([{ key: 'key', value: 'val' }]);
  });

  it('handles URL-encoded values', () => {
    const result = stringToBodyForm('q=hello%20world');
    expect(result[0].value).toBe('hello world');
  });

  it('returns empty entry when parse yields no key-value pairs', () => {
    expect(stringToBodyForm('&&')).toEqual([{ key: '', value: '' }]);
    expect(stringToBodyForm('?')).toEqual([{ key: '', value: '' }]);
  });

  it('parses key with empty value', () => {
    expect(stringToBodyForm('k=')).toEqual([{ key: 'k', value: '' }]);
  });

  it('returns empty entry when URLSearchParams throws', () => {
    vi.spyOn(globalThis, 'URLSearchParams').mockImplementation(() => {
      throw new Error('parse failure');
    });
    expect(stringToBodyForm('a=b')).toEqual([{ key: '', value: '' }]);
  });
});

describe('serializeWithContentType — missing bodyForm', () => {
  it('serializes form-urlencoded with undefined bodyForm', () => {
    const scenario = {
      id: '1', name: 't', url: 'http://x', method: 'POST' as const,
      headers: [], body: '', auth: { type: 'none' as const },
      bodyType: 'form-urlencoded' as const,
      validation: { mode: 'none' as const },
    };
    const result = serializeWithContentType(scenario);
    expect(result.contentType).toBe('application/x-www-form-urlencoded');
    expect(result.body).toBe('');
  });

  it('serializes form-data with undefined bodyForm', () => {
    const scenario = {
      id: '1', name: 't', url: 'http://x', method: 'POST' as const,
      headers: [], body: '', auth: { type: 'none' as const },
      bodyType: 'form-data' as const,
      validation: { mode: 'none' as const },
    };
    const result = serializeWithContentType(scenario);
    expect(result.contentType).toContain('multipart/form-data');
  });
});
