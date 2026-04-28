import type { ExpressionFunction } from './types';
import { s } from './helpers';

const $base64: ExpressionFunction = {
  name: '$base64', category: 'Encoding',
  signature: '$base64(value) → string',
  description: 'Encode a string to Base64.',
  args: [{ name: 'value', type: 'string', required: true, description: 'String to encode' }],
  returnType: 'string',
  examples: [{ input: '$base64("hello")', output: 'aGVsbG8=' }],
  evaluate: (v) => { try { return btoa(s(v)); } catch { return ''; } },
};

const $base64Decode: ExpressionFunction = {
  name: '$base64Decode', category: 'Encoding',
  signature: '$base64Decode(value) → string',
  description: 'Decode a Base64 string.',
  args: [{ name: 'value', type: 'string', required: true, description: 'Base64 string to decode' }],
  returnType: 'string',
  examples: [{ input: '$base64Decode("aGVsbG8=")', output: 'hello' }],
  evaluate: (v) => { try { return atob(s(v)); } catch { return ''; } },
};

const $urlEncode: ExpressionFunction = {
  name: '$urlEncode', category: 'Encoding',
  signature: '$urlEncode(value) → string',
  description: 'URL-encode a string.',
  args: [{ name: 'value', type: 'string', required: true, description: 'String to encode' }],
  returnType: 'string',
  examples: [{ input: '$urlEncode("hello world")', output: 'hello%20world' }],
  evaluate: (v) => encodeURIComponent(s(v)),
};

const $urlDecode: ExpressionFunction = {
  name: '$urlDecode', category: 'Encoding',
  signature: '$urlDecode(value) → string',
  description: 'URL-decode a string.',
  args: [{ name: 'value', type: 'string', required: true, description: 'URL-encoded string' }],
  returnType: 'string',
  examples: [{ input: '$urlDecode("hello%20world")', output: 'hello world' }],
  evaluate: (v) => { try { return decodeURIComponent(s(v)); } catch { return s(v); } },
};

const $hash: ExpressionFunction = {
  name: '$hash', category: 'Encoding',
  signature: '$hash(value, algorithm?) → string',
  description: 'Generate a hash of a string. Supports simple djb2 hashing (synchronous). Returns hex string.',
  args: [
    { name: 'value', type: 'string', required: true, description: 'String to hash' },
    { name: 'algorithm', type: 'string', required: false, description: 'Reserved for future use' },
  ],
  returnType: 'string',
  examples: [{ input: '$hash("hello")', output: '261238937' }],
  evaluate: (v) => {
    // djb2 hash — fast, deterministic, synchronous
    const str = s(v);
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
  },
};

export const encodingFunctions: ExpressionFunction[] = [
  $base64, $base64Decode, $urlEncode, $urlDecode, $hash,
];
