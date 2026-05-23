import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

export function readStructuredFile(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf-8');
  const ext = filePath.toLowerCase();
  if (ext.endsWith('.yaml') || ext.endsWith('.yml')) {
    return parseYaml(content);
  }
  return JSON.parse(content);
}
