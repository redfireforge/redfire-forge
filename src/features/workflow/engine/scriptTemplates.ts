/**
 * Script code templates for the Script/Transform node.
 * Users can pick from these templates to bootstrap common script patterns.
 */

export type ScriptTemplateCategory = 'transform' | 'validate' | 'generate' | 'utility';

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  category: ScriptTemplateCategory;
  /** The code snippet to insert */
  code: string;
  /** Suggested input variables */
  inputVariables: string[];
  /** Suggested output variables */
  outputVariables: string[];
  /** Suggested mode */
  mode: 'transform' | 'validate' | 'generate';
}

export const SCRIPT_TEMPLATE_CATEGORIES: { key: ScriptTemplateCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'transform', label: 'Transform' },
  { key: 'validate', label: 'Validate' },
  { key: 'generate', label: 'Generate' },
  { key: 'utility', label: 'Utility' },
];

export const scriptTemplates: ScriptTemplate[] = [
  {
    id: 'parse-json-response',
    name: 'Parse JSON Response',
    description: 'Parse a JSON response body and extract fields into output variables.',
    category: 'transform',
    code: `// Parse JSON response and extract fields
const data = JSON.parse(input.response_body);
output.totalItems = String(data.length || 0);
output.firstItem = JSON.stringify(data[0] || null);
`,
    inputVariables: ['response_body'],
    outputVariables: ['totalItems', 'firstItem'],
    mode: 'transform',
  },
  {
    id: 'regex-extract',
    name: 'Regex Extract',
    description: 'Extract data from a string using a regular expression.',
    category: 'transform',
    code: `// Extract data using regex
const pattern = /id["\s:=]+(\d+)/i;
const match = input.text.match(pattern);
output.extracted = match ? match[1] : '';
output.found = String(!!match);
`,
    inputVariables: ['text'],
    outputVariables: ['extracted', 'found'],
    mode: 'transform',
  },
  {
    id: 'flatten-nested-json',
    name: 'Flatten Nested JSON',
    description: 'Flatten a nested JSON object into a flat key-value structure.',
    category: 'transform',
    code: `// Flatten nested JSON
const data = JSON.parse(input.json_data);
const flat = {};
function flatten(obj, prefix) {
  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? prefix + '.' + key : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      flatten(val, path);
    } else {
      flat[path] = String(val);
    }
  }
}
flatten(data, '');
output.flat_json = JSON.stringify(flat);
output.fieldCount = String(Object.keys(flat).length);
`,
    inputVariables: ['json_data'],
    outputVariables: ['flat_json', 'fieldCount'],
    mode: 'transform',
  },
  {
    id: 'csv-to-json',
    name: 'CSV to JSON',
    description: 'Convert CSV text into a JSON array of objects.',
    category: 'transform',
    code: `// Convert CSV to JSON array
const lines = input.csv_data.split('\\n');
const headers = lines[0].split(',').map(h => h.trim());
const rows = lines.slice(1).filter(l => l.trim()).map(line => {
  const values = line.split(',');
  const obj = {};
  headers.forEach((h, i) => { obj[h] = values[i]?.trim(); });
  return obj;
});
output.json_data = JSON.stringify(rows);
output.rowCount = String(rows.length);
`,
    inputVariables: ['csv_data'],
    outputVariables: ['json_data', 'rowCount'],
    mode: 'transform',
  },
  {
    id: 'validate-schema',
    name: 'Validate Schema Keys',
    description: 'Check that a JSON response contains all expected keys.',
    category: 'validate',
    code: `// Validate that response contains expected keys
const body = JSON.parse(input.response_body);
const requiredKeys = ['id', 'name', 'email', 'status'];
const missing = requiredKeys.filter(k => !(k in body));
output.result = missing.length === 0;
output.missingKeys = JSON.stringify(missing);
`,
    inputVariables: ['response_body'],
    outputVariables: ['result', 'missingKeys'],
    mode: 'validate',
  },
  {
    id: 'validate-numeric-range',
    name: 'Validate Numeric Range',
    description: 'Check that a numeric value falls within an expected range.',
    category: 'validate',
    code: `// Validate value is within expected range
const value = Number(input.value);
const min = 0;
const max = 100;
output.result = !isNaN(value) && value >= min && value <= max;
output.message = output.result
  ? 'Value ' + value + ' is within range [' + min + ', ' + max + ']'
  : 'Value ' + value + ' is outside range [' + min + ', ' + max + ']';
`,
    inputVariables: ['value'],
    outputVariables: ['result', 'message'],
    mode: 'validate',
  },
  {
    id: 'compare-responses',
    name: 'Compare Two Responses',
    description: 'Compare two API responses for equality (deep comparison).',
    category: 'validate',
    code: `// Compare two JSON responses
const response1 = JSON.parse(input.response_a);
const response2 = JSON.parse(input.response_b);
const str1 = JSON.stringify(response1, Object.keys(response1).sort());
const str2 = JSON.stringify(response2, Object.keys(response2).sort());
output.result = str1 === str2;
output.diff = output.result ? 'Identical' : 'Responses differ';
`,
    inputVariables: ['response_a', 'response_b'],
    outputVariables: ['result', 'diff'],
    mode: 'validate',
  },
  {
    id: 'generate-random-user',
    name: 'Generate Random User',
    description: 'Generate a random user payload for testing.',
    category: 'generate',
    code: `// Generate random user payload
const id = Math.random().toString(36).substring(2, 10);
const timestamp = Date.now();
output.payload = JSON.stringify({
  id: 'user-' + id,
  name: 'Test User ' + Math.floor(Math.random() * 1000),
  email: 'test-' + id + '@example.com',
  createdAt: new Date(timestamp).toISOString(),
  active: true,
});
output.userId = 'user-' + id;
`,
    inputVariables: [],
    outputVariables: ['payload', 'userId'],
    mode: 'generate',
  },
  {
    id: 'generate-batch-data',
    name: 'Generate Batch Data',
    description: 'Generate an array of N test records.',
    category: 'generate',
    code: `// Generate batch of test records
const count = Number(input.count) || 5;
const records = [];
for (let i = 0; i < count; i++) {
  records.push({
    index: i,
    id: 'item-' + Math.random().toString(36).substring(2, 8),
    value: Math.floor(Math.random() * 1000),
  });
}
output.batch = JSON.stringify(records);
output.generatedCount = String(records.length);
`,
    inputVariables: ['count'],
    outputVariables: ['batch', 'generatedCount'],
    mode: 'generate',
  },
  {
    id: 'string-manipulation',
    name: 'String Manipulation',
    description: 'Common string operations: trim, split, encode/decode, case conversion.',
    category: 'utility',
    code: `// String manipulation utilities
const text = input.text || '';
output.trimmed = text.trim();
output.upper = text.toUpperCase();
output.lower = text.toLowerCase();
output.length = String(text.length);
output.words = String(text.trim().split(/\\s+/).length);
output.encoded = encodeURIComponent(text);
`,
    inputVariables: ['text'],
    outputVariables: ['trimmed', 'upper', 'lower', 'length', 'words', 'encoded'],
    mode: 'transform',
  },
  {
    id: 'timestamp-formatting',
    name: 'Timestamp Formatting',
    description: 'Generate and format timestamps in various formats.',
    category: 'utility',
    code: `// Generate timestamps in various formats
const now = new Date();
output.iso = now.toISOString();
output.unix = String(Math.floor(now.getTime() / 1000));
output.unixMs = String(now.getTime());
output.dateOnly = now.toISOString().split('T')[0];
output.timeOnly = now.toISOString().split('T')[1].replace('Z', '');
`,
    inputVariables: [],
    outputVariables: ['iso', 'unix', 'unixMs', 'dateOnly', 'timeOnly'],
    mode: 'generate',
  },
  {
    id: 'array-aggregation',
    name: 'Array Aggregation',
    description: 'Compute sum, average, min, max from a JSON array of numbers.',
    category: 'utility',
    code: `// Aggregate numeric array
const data = JSON.parse(input.json_array);
const nums = data.map(Number).filter(n => !isNaN(n));
output.sum = String(nums.reduce((a, b) => a + b, 0));
output.avg = String(nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : '0');
output.min = String(nums.length ? Math.min(...nums) : '0');
output.max = String(nums.length ? Math.max(...nums) : '0');
output.count = String(nums.length);
`,
    inputVariables: ['json_array'],
    outputVariables: ['sum', 'avg', 'min', 'max', 'count'],
    mode: 'transform',
  },
];

/**
 * Get templates filtered by category.
 */
export function getTemplatesByCategory(category: ScriptTemplateCategory | 'all'): ScriptTemplate[] {
  if (category === 'all') return scriptTemplates;
  return scriptTemplates.filter(t => t.category === category);
}

/**
 * Find a template by ID.
 */
export function getTemplateById(id: string): ScriptTemplate | undefined {
  return scriptTemplates.find(t => t.id === id);
}
