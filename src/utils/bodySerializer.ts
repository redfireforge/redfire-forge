import type { Scenario, BodyType, KeyValue } from '../types';

const CONTENT_TYPE_MAP: Record<BodyType, string | null> = {
  'none': null,
  'json': 'application/json',
  'xml': 'application/xml',
  'text': 'text/plain',
  'form-urlencoded': 'application/x-www-form-urlencoded',
  'form-data': null,
  'file': 'application/octet-stream',
};

export function getEffectiveBodyType(scenario: Scenario): BodyType {
  if (scenario.method === 'GET') return 'none';
  return scenario.bodyType ?? (scenario.body ? 'json' : 'none');
}

export interface SerializedBody {
  body: string | undefined;
  contentType: string | null;
}

/**
 * Serialize the request body and compute the matching Content-Type in one pass
 * so the multipart boundary is always consistent.
 */
export function serializeWithContentType(scenario: Scenario): SerializedBody {
  const bt = getEffectiveBodyType(scenario);
  if (bt === 'none') return { body: undefined, contentType: null };

  if (bt === 'form-urlencoded') {
    const params = new URLSearchParams();
    for (const kv of scenario.bodyForm ?? []) {
      if (kv.key.trim()) params.append(kv.key.trim(), kv.value);
    }
    return { body: params.toString(), contentType: 'application/x-www-form-urlencoded' };
  }

  if (bt === 'form-data') {
    const boundary = '----RedfireForge' + Date.now().toString(36);
    const parts: string[] = [];
    for (const kv of scenario.bodyForm ?? []) {
      if (!kv.key.trim()) continue;
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${kv.key.trim()}"\r\n\r\n${kv.value}`);
    }
    parts.push(`--${boundary}--`);
    return {
      body: parts.join('\r\n'),
      contentType: `multipart/form-data; boundary=${boundary}`,
    };
  }

  return {
    body: scenario.body || undefined,
    contentType: CONTENT_TYPE_MAP[bt],
  };
}

export function serializeBody(scenario: Scenario): string | undefined {
  return serializeWithContentType(scenario).body;
}

export function getContentType(scenario: Scenario): string | null {
  return serializeWithContentType(scenario).contentType;
}

export function bodyFormToString(form: KeyValue[]): string {
  return form.filter(kv => kv.key.trim()).map(kv => `${kv.key}=${kv.value}`).join('&');
}

export function stringToBodyForm(str: string): KeyValue[] {
  if (!str.trim()) return [{ key: '', value: '' }];
  try {
    const params = new URLSearchParams(str);
    const result: KeyValue[] = [];
    params.forEach((value, key) => result.push({ key, value }));
    if (result.length === 0) return [{ key: '', value: '' }];
    return result;
  } catch {
    return [{ key: '', value: '' }];
  }
}
