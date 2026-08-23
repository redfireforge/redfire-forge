import { describe, it, expect } from 'vitest';
import { formatTransportStatus, getTransportMethodLabel, isHttpResult, getTransportFamily } from './transportStatus';
import type { RequestResult } from '@shared/types';
import { makeResult as _makeResult } from '@test-utils/factories';

const makeResult = (overrides: Partial<RequestResult> = {}): RequestResult =>
  _makeResult({
    id: 'r1',
    scenarioName: 'Test',
    method: 'GET',
    url: '/test',
    ...overrides,
  });

describe('formatTransportStatus', () => {
  it('returns HTTP status code for http transport (default)', () => {
    expect(formatTransportStatus(makeResult({ httpStatus: 200 }))).toBe('200');
    expect(formatTransportStatus(makeResult({ httpStatus: 404 }))).toBe('404');
    expect(formatTransportStatus(makeResult({ httpStatus: 500 }))).toBe('500');
  });

  it('returns ERR when httpStatus is 0 or falsy', () => {
    expect(formatTransportStatus(makeResult({ httpStatus: 0 }))).toBe('ERR');
  });

  it('returns PRODUCE for kafkaProduce transport', () => {
    expect(formatTransportStatus(makeResult({ transportType: 'kafkaProduce' }))).toBe('PRODUCE');
  });

  it('returns CONSUME for kafkaConsume transport', () => {
    expect(formatTransportStatus(makeResult({ transportType: 'kafkaConsume' }))).toBe('CONSUME');
  });

  it('returns CONNECT for wsConnect transport', () => {
    expect(formatTransportStatus(makeResult({ transportType: 'wsConnect' }))).toBe('CONNECT');
  });

  it('returns SEND for wsSend transport', () => {
    expect(formatTransportStatus(makeResult({ transportType: 'wsSend' }))).toBe('SEND');
  });

  it('returns RECEIVE for wsReceive transport', () => {
    expect(formatTransportStatus(makeResult({ transportType: 'wsReceive' }))).toBe('RECEIVE');
  });

  it('returns TRIGGER for wsTrigger transport', () => {
    expect(formatTransportStatus(makeResult({ transportType: 'wsTrigger' }))).toBe('TRIGGER');
  });

  it('defaults to http when transportType is undefined', () => {
    expect(formatTransportStatus(makeResult({ transportType: undefined, httpStatus: 201 }))).toBe('201');
  });
});

describe('getTransportMethodLabel', () => {
  it('returns HTTP method for http transport', () => {
    expect(getTransportMethodLabel(makeResult({ method: 'GET' }))).toBe('GET');
    expect(getTransportMethodLabel(makeResult({ method: 'POST' }))).toBe('POST');
    expect(getTransportMethodLabel(makeResult({ method: 'DELETE' }))).toBe('DELETE');
  });

  it('returns CONNECT for wsConnect transport', () => {
    expect(getTransportMethodLabel(makeResult({ transportType: 'wsConnect', method: 'WEBSOCKET' }))).toBe('CONNECT');
  });

  it('returns SEND for wsSend transport', () => {
    expect(getTransportMethodLabel(makeResult({ transportType: 'wsSend', method: 'WEBSOCKET' }))).toBe('SEND');
  });

  it('returns RECEIVE for wsReceive transport', () => {
    expect(getTransportMethodLabel(makeResult({ transportType: 'wsReceive', method: 'WEBSOCKET' }))).toBe('RECEIVE');
  });

  it('returns PRODUCE for kafkaProduce transport', () => {
    expect(getTransportMethodLabel(makeResult({ transportType: 'kafkaProduce', method: 'KAFKA' }))).toBe('PRODUCE');
  });

  it('returns CONSUME for kafkaConsume transport', () => {
    expect(getTransportMethodLabel(makeResult({ transportType: 'kafkaConsume', method: 'KAFKA' }))).toBe('CONSUME');
  });

  it('defaults to HTTP method when transportType is undefined', () => {
    expect(getTransportMethodLabel(makeResult({ transportType: undefined, method: 'PUT' }))).toBe('PUT');
  });
});

describe('isHttpResult', () => {
  it('returns true for http transport', () => {
    expect(isHttpResult(makeResult())).toBe(true);
    expect(isHttpResult(makeResult({ transportType: undefined }))).toBe(true);
  });

  it('returns false for non-http transports', () => {
    expect(isHttpResult(makeResult({ transportType: 'wsConnect' }))).toBe(false);
    expect(isHttpResult(makeResult({ transportType: 'kafkaProduce' }))).toBe(false);
  });
});

describe('getTransportFamily', () => {
  it('returns http for http or undefined', () => {
    expect(getTransportFamily('http')).toBe('http');
    expect(getTransportFamily(undefined)).toBe('http');
  });

  it('returns ws for WS types', () => {
    expect(getTransportFamily('wsConnect')).toBe('ws');
    expect(getTransportFamily('wsSend')).toBe('ws');
    expect(getTransportFamily('wsReceive')).toBe('ws');
    expect(getTransportFamily('wsTrigger')).toBe('ws');
  });

  it('returns kafka for Kafka types', () => {
    expect(getTransportFamily('kafkaProduce')).toBe('kafka');
    expect(getTransportFamily('kafkaConsume')).toBe('kafka');
  });
});
