import type { Scenario, BodyType, KeyValue, AuthConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { stringToBodyForm } from './bodySerializer';

export function parseCurl(curlCommand: string): Partial<Scenario> {
  // Normalize: join line continuations, collapse whitespace
  let cmd = curlCommand
    .replace(/\\\s*\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading "curl" keyword
  cmd = cmd.replace(/^curl\s+/i, '');

  const headers: KeyValue[] = [];
  let method = '';
  let url = '';
  let body = '';
  const auth: AuthConfig = { type: 'none' };
  const formFields: KeyValue[] = [];
  let hasDataUrlencode = false;

  const tokens = tokenize(cmd);
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      i++;
      if (i < tokens.length) method = tokens[i].toUpperCase();
    } else if (token === '-H' || token === '--header') {
      i++;
      if (i < tokens.length) {
        const headerStr = tokens[i];
        const colonIdx = headerStr.indexOf(':');
        if (colonIdx > 0) {
          const key = headerStr.slice(0, colonIdx).trim();
          const value = headerStr.slice(colonIdx + 1).trim();
          if (key.toLowerCase() === 'authorization') {
            if (value.toLowerCase().startsWith('basic ')) {
              try {
                const decoded = atob(value.slice(6).trim());
                const sepIdx = decoded.indexOf(':');
                auth.type = 'basic';
                auth.username = sepIdx > 0 ? decoded.slice(0, sepIdx) : decoded;
                auth.password = sepIdx > 0 ? decoded.slice(sepIdx + 1) : '';
              } catch {
                headers.push({ key, value });
              }
            } else if (value.toLowerCase().startsWith('bearer ')) {
              headers.push({ key, value });
            } else {
              headers.push({ key, value });
            }
          } else {
            headers.push({ key, value });
          }
        }
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
      i++;
      if (i < tokens.length) body = tokens[i];
    } else if (token === '--data-urlencode') {
      i++;
      if (i < tokens.length) {
        hasDataUrlencode = true;
        const field = tokens[i];
        const eqIdx = field.indexOf('=');
        if (eqIdx > 0) {
          formFields.push({ key: field.slice(0, eqIdx), value: field.slice(eqIdx + 1) });
        } else {
          body = body ? `${body}&${field}` : field;
        }
      }
    } else if (token === '-F' || token === '--form') {
      i++;
      if (i < tokens.length) {
        const field = tokens[i];
        const eqIdx = field.indexOf('=');
        if (eqIdx > 0) {
          formFields.push({ key: field.slice(0, eqIdx), value: field.slice(eqIdx + 1) });
        }
      }
    } else if (token === '--url') {
      i++;
      if (i < tokens.length) url = tokens[i];
    } else if (token === '-u' || token === '--user') {
      i++;
      if (i < tokens.length) {
        const userPass = tokens[i];
        const sepIdx = userPass.indexOf(':');
        auth.type = 'basic';
        auth.username = sepIdx > 0 ? userPass.slice(0, sepIdx) : userPass;
        auth.password = sepIdx > 0 ? userPass.slice(sepIdx + 1) : '';
      }
    } else if (token === '--compressed' || token === '-k' || token === '--insecure'
      || token === '-s' || token === '--silent' || token === '-S' || token === '--show-error'
      || token === '-i' || token === '--include' || token === '-v' || token === '--verbose'
      || token === '-L' || token === '--location') {
      // Skip known flags with no arguments
    } else if (token.startsWith('-')) {
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        i++;
      }
    } else {
      if (!url) url = token;
    }
    i++;
  }

  const hasForm = formFields.length > 0;
  if (!method) {
    method = (body || hasForm) ? 'POST' : 'GET';
  }

  // Extract a name from the URL path
  let name = '';
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    name = pathParts.slice(-2).join('/') || parsed.hostname;
  } catch {
    name = 'Imported Scenario';
  }

  if (headers.length === 0) {
    headers.push({ key: '', value: '' });
  }

  let bodyType: BodyType = body ? 'json' : 'none';
  let bodyForm: KeyValue[] | undefined;
  const ctHeader = headers.find(h => h.key.toLowerCase() === 'content-type');

  if (hasForm) {
    const ctLower = ctHeader?.value.toLowerCase() ?? '';
    if (hasDataUrlencode || ctLower.includes('application/x-www-form-urlencoded')) {
      bodyType = 'form-urlencoded';
    } else {
      bodyType = 'form-data';
    }
    bodyForm = formFields;
  } else if (ctHeader && body) {
    const ct = ctHeader.value.toLowerCase();
    if (ct.includes('application/x-www-form-urlencoded')) {
      bodyType = 'form-urlencoded';
      bodyForm = stringToBodyForm(body);
    } else if (ct.includes('multipart/form-data')) {
      bodyType = 'form-data';
      bodyForm = stringToBodyForm(body);
    } else if (ct.includes('application/xml') || ct.includes('text/xml')) {
      bodyType = 'xml';
    } else if (ct.includes('text/plain')) {
      bodyType = 'text';
    }
  }

  return {
    id: uuidv4(),
    name,
    url,
    method: (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? method : 'GET') as Scenario['method'],
    headers,
    body,
    bodyType,
    bodyForm,
    auth,
  };
}

/**
 * Tokenize a curl command string, respecting single and double quotes.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (const ch of input) {
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === '\\' && !inSingle) {
      escape = true;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === ' ' && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}
