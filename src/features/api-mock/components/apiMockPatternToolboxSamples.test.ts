import { describe, expect, it, beforeEach } from 'vitest';
import { DEFAULT_JSON_SAMPLE } from './apiMockPatternToolboxConstants';
import {
  DEFAULT_XPATH_SAMPLE,
  clearToolboxBodySamples,
  initialToolboxJsonSample,
  initialToolboxXmlSample,
  recallToolboxBodySample,
  rememberToolboxBodySample,
  toolboxBodySampleKey,
} from './apiMockPatternToolboxSamples';

const SOAP = '<soap:Envelope><orderId>A-1098</orderId></soap:Envelope>';

describe('apiMockPatternToolboxSamples', () => {
  beforeEach(() => {
    clearToolboxBodySamples();
  });

  it('keys samples by kind and route path', () => {
    expect(toolboxBodySampleKey('xml', '/soap/orders')).toBe('xml:/soap/orders');
    expect(toolboxBodySampleKey('json', '')).toBe('json:/');
  });

  it('remembers an XML sample for the same path and forgets a blank one', () => {
    expect(initialToolboxXmlSample('/soap/orders')).toBe(DEFAULT_XPATH_SAMPLE);
    rememberToolboxBodySample('xml', '/soap/orders', SOAP);
    expect(initialToolboxXmlSample('/soap/orders')).toBe(SOAP);
    expect(initialToolboxXmlSample('/upload')).toBe(DEFAULT_XPATH_SAMPLE);
    rememberToolboxBodySample('xml', '/soap/orders', '   ');
    expect(recallToolboxBodySample('xml', '/soap/orders', DEFAULT_XPATH_SAMPLE)).toBe(DEFAULT_XPATH_SAMPLE);
  });

  it('remembers a JSON sample independently of the XML slot', () => {
    const json = '{"orderId":"A-1098"}';
    rememberToolboxBodySample('json', '/soap/orders', json);
    rememberToolboxBodySample('xml', '/soap/orders', SOAP);
    expect(initialToolboxJsonSample('/soap/orders')).toBe(json);
    expect(initialToolboxXmlSample('/soap/orders')).toBe(SOAP);
    expect(initialToolboxJsonSample('/other')).toBe(JSON.stringify(DEFAULT_JSON_SAMPLE, null, 2));
  });
});
