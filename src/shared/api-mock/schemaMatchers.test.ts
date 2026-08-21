import { describe, expect, it } from 'vitest';
import { sha256HexSync } from './sha256Sync';
import {
  matchBinarySha256,
  matchJsonSchema,
  matchMultipartField,
  matchMultipartFile,
  matchXmlSchema,
  parseMultipart,
  isJsonSchemaCompileable,
  xmlSafeLocalName,
  xmlSchemaRequiredNames,
} from './schemaMatchers';

const MULTIPART = [
  '------bound',
  'Content-Disposition: form-data; name="note"',
  '',
  'hello',
  '------bound',
  'Content-Disposition: form-data; name="avatar"; filename="a.png"',
  'Content-Type: image/png',
  '',
  'PNGDATA',
  '------bound--',
  '',
].join('\r\n');

describe('schemaMatchers', () => {
  it('validates JSON Schema draft objects and JSON strings', () => {
    expect(isJsonSchemaCompileable({ type: 'object' })).toBe(true);
    expect(isJsonSchemaCompileable('not-json-schema')).toBe(false);
    expect(matchJsonSchema('{"a":1}', { type: 'object', required: ['a'] })).toBe(true);
    expect(matchJsonSchema(['{"a":1}'], { type: 'object', required: ['a'] })).toBe(true);
    expect(matchJsonSchema('{"a":1}', '{"type":"object","required":["a"]}')).toBe(true);
    expect(matchJsonSchema('{"a":1}', { type: 'number' })).toBe(false);
    expect(matchJsonSchema('{bad', { type: 'object' })).toBe(false);
    expect(matchJsonSchema(null, { type: 'object' })).toBe(false);
    expect(matchJsonSchema('1', 'not-json-schema')).toBe(false);
    expect(matchJsonSchema('{"a":1}', ['nope'])).toBe(false);
    expect(matchJsonSchema([], { type: 'object' })).toBe(false);
    expect(matchJsonSchema('{"a":1}', 'null')).toBe(false);
    expect(matchJsonSchema('1', '1')).toBe(false);
    expect(matchJsonSchema('{"a":1}', { type: 'object', required: ['a'] })).toBe(true);
    expect(isJsonSchemaCompileable({ type: 'object' })).toBe(true);
    expect(matchJsonSchema('{}', {})).toBe(true);
    expect(matchJsonSchema('{}', undefined)).toBe(false);
    expect(matchJsonSchema('{}', '')).toBe(false);
    const schemaObj = { type: 'object' as const, required: ['a'] };
    const before = JSON.stringify(schemaObj);
    expect(matchJsonSchema('{"a":1}', schemaObj)).toBe(true);
    expect(JSON.stringify(schemaObj)).toBe(before);
    const schemaId = 'https://example.test/order';
    expect(matchJsonSchema('{}', { $id: schemaId, type: 'object' })).toBe(true);
    expect(matchJsonSchema('{}', { $id: schemaId, type: 'object', additionalProperties: false })).toBe(true);
    expect(isJsonSchemaCompileable({ $id: schemaId, type: 'string' })).toBe(true);
  });

  it('matches XML by well-formedness and required element names / XSD snippets', () => {
    const xml = '<Order xmlns="urn:ex"><Id>1</Id></Order>';
    expect(matchXmlSchema(xml, '')).toBe(true);
    expect(matchXmlSchema(xml, 'Order, Id')).toBe(true);
    expect(matchXmlSchema(xml, ['Order', 'Id'])).toBe(true);
    expect(matchXmlSchema(xml, '["Order","Id"]')).toBe(true);
    expect(matchXmlSchema(xml, '{"required":["Order"]}')).toBe(true);
    expect(matchXmlSchema(xml, '{"type":"object"}')).toBe(true);
    expect(matchXmlSchema(xml, '{"required":["Missing"]}')).toBe(false);
    expect(matchXmlSchema(xml, '[not-json')).toBe(false);
    expect(matchXmlSchema(xml, { required: ['Order'] })).toBe(true);
    expect(matchXmlSchema(xml, { requiredElements: ['Id'] })).toBe(true);
    expect(matchXmlSchema(xml, { elements: ['Order'] })).toBe(true);
    expect(matchXmlSchema(xml, '<xs:element name="Order"/><xs:element name="Id"/>')).toBe(true);
    expect(matchXmlSchema(xml, "<xsd:element name='Id'/>")).toBe(true);
    expect(matchXmlSchema(xml, { foo: 1 })).toBe(true);
    expect(matchXmlSchema(xml, { required: 'Order' })).toBe(true);
    expect(matchXmlSchema(xml, { required: 'Missing' })).toBe(false);
    expect(matchXmlSchema(xml, { required: [], requiredElements: ['Order'] })).toBe(true);
    expect(matchXmlSchema(xml, { required: [], requiredElements: ['Missing'] })).toBe(false);
    expect(matchXmlSchema(xml, '{"required":"Order"}')).toBe(true);
    expect(matchXmlSchema(xml, '{"required":"Missing"}')).toBe(false);
    expect(matchXmlSchema(xml, 'Missing')).toBe(false);
    expect(matchXmlSchema(xml, "Order'] | /* | //*[local-name()='Id")).toBe(false);
    expect(matchXmlSchema(xml, "Order'")).toBe(false);
    expect(matchXmlSchema('<a:Order xmlns:a="urn:ex"/>', 'a:Order')).toBe(true);
    expect(matchXmlSchema('not xml', 'Order')).toBe(false);
    expect(matchXmlSchema(null, 'Order')).toBe(false);
    expect(matchXmlSchema([''], 'Order')).toBe(false);
    expect(xmlSchemaRequiredNames('Order, Id')).toEqual(['Order', 'Id']);
    expect(xmlSchemaRequiredNames({ required: ['Order'] })).toEqual(['Order']);
    expect(xmlSafeLocalName('a:Order')).toBe('Order');
    expect(xmlSafeLocalName("Order'")).toBeUndefined();
  });

  it('parses multipart fields and files', () => {
    const ct = 'multipart/form-data; boundary=----bound';
    expect(parseMultipart(MULTIPART, ct).map(p => p.name)).toEqual(['note', 'avatar']);
    expect(parseMultipart(MULTIPART).map(p => p.name)).toEqual(['note', 'avatar']);
    expect(matchMultipartField(MULTIPART, 'note', { contentType: ct })).toBe(true);
    expect(matchMultipartField(MULTIPART, ['note', 'hello'], { contentType: ct })).toBe(true);
    expect(matchMultipartField(MULTIPART, ['note', 'nope'], { contentType: ct })).toBe(false);
    expect(matchMultipartField(MULTIPART, 'missing', { contentType: ct })).toBe(false);
    expect(matchMultipartFile(MULTIPART, ['avatar', 'a.png'], { contentType: ct })).toBe(true);
    expect(matchMultipartFile(MULTIPART, 'avatar', { contentType: ct })).toBe(true);
    expect(matchMultipartFile(MULTIPART, ['avatar', 'b.png'], { contentType: ct })).toBe(false);
    expect(matchMultipartField('plain', 'note')).toBe(false);
    expect(matchMultipartField(MULTIPART, { nope: true })).toBe(false);
    expect(matchMultipartField(null, 'note', { contentType: ct })).toBe(false);
    expect(matchMultipartField(MULTIPART, ['note'], { contentType: ct })).toBe(true);
    expect(matchMultipartField(MULTIPART, ['note', ''], { contentType: ct })).toBe(true);
    expect(matchMultipartFile(MULTIPART, ['avatar', ''], { contentType: ct })).toBe(true);
    const unquoted = [
      '--x',
      'Content-Disposition: form-data; name=note; filename=plain.txt',
      '',
      'hi',
      '--x--',
      '',
    ].join('\r\n');
    expect(parseMultipart(unquoted, 'multipart/form-data; boundary=x').map(p => [p.name, p.filename])).toEqual([['note', 'plain.txt']]);
    const singleQuoted = [
      '--x',
      "Content-Disposition: form-data; name='note'; filename='plain.txt'",
      '',
      'hi',
      '--x--',
      '',
    ].join('\r\n');
    expect(parseMultipart(singleQuoted, 'multipart/form-data; boundary=x').map(p => [p.name, p.filename])).toEqual([['note', 'plain.txt']]);
    expect(matchMultipartFile(MULTIPART, 'note', { contentType: ct })).toBe(false);
    expect(matchMultipartFile(null, 'avatar', { contentType: ct })).toBe(false);
    expect(matchMultipartFile(MULTIPART, { nope: true }, { contentType: ct })).toBe(false);
    const quoted = 'multipart/form-data; boundary="----bound"';
    expect(parseMultipart(MULTIPART, quoted).map(p => p.name)).toEqual(['note', 'avatar']);
    expect(parseMultipart('------bound\r\n\r\n------bound--', ct)).toEqual([]);
    expect(parseMultipart('--x\r\nContent-Disposition: form-data;\r\n\r\nv\r\n--x--', 'multipart/form-data; boundary=x')).toEqual([]);
    expect(parseMultipart('', ct)).toEqual([]);
  });

  it('compares SHA-256 hex of the body', () => {
    const digest = sha256HexSync('ping');
    expect(matchBinarySha256('ping', digest)).toBe(true);
    expect(matchBinarySha256('ping', digest.toUpperCase())).toBe(true);
    expect(matchBinarySha256('pong', digest)).toBe(false);
    expect(matchBinarySha256('ping', 'hash')).toBe(false);
    expect(matchBinarySha256(null, digest)).toBe(false);
    expect(matchBinarySha256('ping', null)).toBe(false);
    expect(matchBinarySha256(['ping'], digest)).toBe(true);
  });
});
