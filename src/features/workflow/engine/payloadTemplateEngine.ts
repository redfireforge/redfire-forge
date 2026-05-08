/**
 * Payload Template Engine for Webhook Load Driver
 * 
 * Expands payload templates with dynamic generators:
 * - {{$uuid}} — random UUID v4
 * - {{$randomInt(min, max)}} — random integer in range
 * - {{$randomFloat(min, max, decimals)}} — random float
 * - {{$randomEmail}} — random email address
 * - {{$randomName}} — random first/last name
 * - {{$randomPhone}} — random phone number
 * - {{$timestamp}} — Unix timestamp (ms)
 * - {{$timestampSec}} — Unix timestamp (seconds)
 * - {{$isoDate}} — ISO 8601 date string
 * - {{$date(format)}} — formatted date (basic patterns)
 * - {{$randomChoice(a,b,c)}} — random selection from options
 * - {{$randomString(length)}} — random alphanumeric string
 * - {{$sequence}} — incrementing sequence number per request
 * - {{$requestIndex}} — 0-based request index
 */

export interface PayloadGeneratorContext {
  /** Current request index (0-based). */
  requestIndex: number;
  /** Request timestamp. */
  timestamp: number;
  /** Optional custom variables to include. */
  customVariables?: Record<string, string>;
}

// Generator pattern: {{$generatorName}} or {{$generatorName(args)}}
const GENERATOR_PATTERN = /\{\{\$(\w+)(?:\(([^)]*)\))?\}\}/g;

// Random name pools
const FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'example.com', 'test.com', 'company.org'];

/**
 * Generates a UUID v4.
 */
function generateUuid(): string {
  return crypto.randomUUID();
}

/**
 * Generates a random integer between min and max (inclusive).
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a random float between min and max with specified decimals.
 */
function randomFloat(min: number, max: number, decimals: number = 2): number {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
}

/**
 * Generates a random email address.
 */
function randomEmail(): string {
  const first = FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)].toLowerCase();
  const last = LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)].toLowerCase();
  const num = randomInt(1, 999);
  const domain = EMAIL_DOMAINS[randomInt(0, EMAIL_DOMAINS.length - 1)];
  return `${first}.${last}${num}@${domain}`;
}

/**
 * Generates a random full name.
 */
function randomName(): string {
  const first = FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)];
  const last = LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)];
  return `${first} ${last}`;
}

/**
 * Generates a random phone number.
 */
function randomPhone(): string {
  const area = randomInt(200, 999);
  const exchange = randomInt(200, 999);
  const subscriber = randomInt(1000, 9999);
  return `+1-${area}-${exchange}-${subscriber}`;
}

/**
 * Generates a random alphanumeric string.
 */
function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomInt(0, chars.length - 1));
  }
  return result;
}

/**
 * Formats a date with basic patterns.
 * Supported: YYYY, MM, DD, HH, mm, ss
 */
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * Parses comma-separated arguments, handling quoted strings.
 */
function parseArgs(argsStr: string | undefined): string[] {
  if (!argsStr) return [];
  
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  
  for (const char of argsStr) {
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      quoteChar = '';
    } else if (char === ',' && !inQuotes) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current) {
    args.push(current.trim());
  }
  
  return args;
}

/**
 * Sequence counter for {{$sequence}} generator.
 */
let sequenceCounter = 0;

/**
 * Resets the sequence counter (useful between test runs).
 */
export function resetSequence(): void {
  sequenceCounter = 0;
}

/**
 * Evaluates a single generator expression.
 */
function evaluateGenerator(name: string, argsStr: string | undefined, ctx: PayloadGeneratorContext): string {
  const args = parseArgs(argsStr);
  
  switch (name) {
    case 'uuid':
      return generateUuid();
      
    case 'randomInt': {
      const min = args[0] ? parseInt(args[0], 10) : 0;
      const max = args[1] ? parseInt(args[1], 10) : 100;
      return randomInt(min, max).toString();
    }
    
    case 'randomFloat': {
      const min = args[0] ? parseFloat(args[0]) : 0;
      const max = args[1] ? parseFloat(args[1]) : 100;
      const decimals = args[2] ? parseInt(args[2], 10) : 2;
      return randomFloat(min, max, decimals).toString();
    }
    
    case 'randomEmail':
      return randomEmail();
      
    case 'randomName':
      return randomName();
      
    case 'randomPhone':
      return randomPhone();
      
    case 'timestamp':
      return ctx.timestamp.toString();
      
    case 'timestampSec':
      return Math.floor(ctx.timestamp / 1000).toString();
      
    case 'isoDate':
      return new Date(ctx.timestamp).toISOString();
      
    case 'date': {
      const format = args[0] || 'YYYY-MM-DD';
      return formatDate(new Date(ctx.timestamp), format);
    }
    
    case 'randomChoice': {
      if (args.length === 0) return '';
      return args[randomInt(0, args.length - 1)];
    }
    
    case 'randomString': {
      const length = args[0] ? parseInt(args[0], 10) : 10;
      return randomString(length);
    }
    
    case 'sequence':
      return (sequenceCounter++).toString();
      
    case 'requestIndex':
      return ctx.requestIndex.toString();
      
    default:
      // Check custom variables
      if (ctx.customVariables && name in ctx.customVariables) {
        return ctx.customVariables[name];
      }
      // Return original expression if unknown
      return `{{$${name}${argsStr ? `(${argsStr})` : ''}}}`;
  }
}

/**
 * Expands all generator expressions in a payload template.
 */
export function expandPayloadTemplate(template: string, ctx: PayloadGeneratorContext): string {
  return template.replace(GENERATOR_PATTERN, (_, name, argsStr) => {
    const value = evaluateGenerator(name, argsStr, ctx);
    // For JSON templates, we need to handle string values correctly
    // If the generator returns a number-like string, keep it as-is
    // Otherwise, it will be inserted as-is (caller should handle quoting in template)
    return value;
  });
}

/**
 * Validates a payload template, returning any errors found.
 */
export function validatePayloadTemplate(template: string): string[] {
  const errors: string[] = [];
  
  // Check for valid JSON structure (when expanded with sample values)
  const ctx: PayloadGeneratorContext = { requestIndex: 0, timestamp: Date.now() };
  const expanded = expandPayloadTemplate(template, ctx);
  
  try {
    JSON.parse(expanded);
  } catch (err) {
    errors.push(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  
  // Check for unknown generators (those that weren't expanded)
  const unknownMatch = expanded.match(/\{\{\$\w+(?:\([^)]*\))?\}\}/g);
  if (unknownMatch) {
    for (const match of unknownMatch) {
      errors.push(`Unknown generator: ${match}`);
    }
  }
  
  return errors;
}

/**
 * Returns a list of available generators with descriptions.
 */
export function getAvailableGenerators(): Array<{ name: string; syntax: string; description: string; example: string }> {
  return [
    { name: 'uuid', syntax: '{{$uuid}}', description: 'Random UUID v4', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
    { name: 'randomInt', syntax: '{{$randomInt(min, max)}}', description: 'Random integer in range', example: '42' },
    { name: 'randomFloat', syntax: '{{$randomFloat(min, max, decimals)}}', description: 'Random float with precision', example: '3.14' },
    { name: 'randomEmail', syntax: '{{$randomEmail}}', description: 'Random email address', example: 'john.smith123@gmail.com' },
    { name: 'randomName', syntax: '{{$randomName}}', description: 'Random full name', example: 'John Smith' },
    { name: 'randomPhone', syntax: '{{$randomPhone}}', description: 'Random phone number', example: '+1-555-123-4567' },
    { name: 'timestamp', syntax: '{{$timestamp}}', description: 'Unix timestamp (ms)', example: '1714567890123' },
    { name: 'timestampSec', syntax: '{{$timestampSec}}', description: 'Unix timestamp (seconds)', example: '1714567890' },
    { name: 'isoDate', syntax: '{{$isoDate}}', description: 'ISO 8601 date string', example: '2024-05-01T12:34:56.789Z' },
    { name: 'date', syntax: '{{$date(format)}}', description: 'Formatted date (YYYY, MM, DD, HH, mm, ss)', example: '2024-05-01' },
    { name: 'randomChoice', syntax: '{{$randomChoice(a, b, c)}}', description: 'Random selection from options', example: 'b' },
    { name: 'randomString', syntax: '{{$randomString(length)}}', description: 'Random alphanumeric string', example: 'xK9mNp2qRs' },
    { name: 'sequence', syntax: '{{$sequence}}', description: 'Auto-incrementing number', example: '0, 1, 2, ...' },
    { name: 'requestIndex', syntax: '{{$requestIndex}}', description: 'Current request index (0-based)', example: '0' },
  ];
}
