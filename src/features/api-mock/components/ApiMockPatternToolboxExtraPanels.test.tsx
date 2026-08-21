/**
 * @vitest-environment jsdom
 */
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiMockSchemaToolboxPanel, ApiMockXPathToolboxPanel } from './ApiMockPatternToolboxExtraPanels';
import { SCHEMA_CURRENT_PRESET_NAME, SCHEMA_PRESETS } from './apiMockPatternToolboxConstants';

describe('ApiMockPatternToolboxExtraPanels', () => {
  it('applies XPath and schema presets and edits fields', () => {
    const onXpath = vi.fn();
    const onXmlSample = vi.fn();
    const onXpathValue = vi.fn();
    render(
      <ApiMockXPathToolboxPanel
        xmlSample="<a/>"
        xpath="/*"
        xpathValue=""
        onXmlSample={onXmlSample}
        onXpath={onXpath}
        onXpathValue={onXpathValue}
      />,
    );
    fireEvent.click(screen.getByTestId('api-mock-toolbox-xpath-preset-Root element'));
    expect(onXpath).toHaveBeenCalledWith('/*');
    expect(screen.getByTestId('api-mock-toolbox-xpath-preset-Root element').className).toContain('active');
    expect(screen.getByTestId('api-mock-toolbox-xpath-resolved').closest('.am-tool-xpath-fields')).toBeTruthy();
    expect(screen.getByTestId('api-mock-toolbox-xpath-value').closest('.am-tool-xpath-equals')).toBeTruthy();
    fireEvent.change(screen.getByTestId('api-mock-toolbox-xpath-sample'), { target: { value: '<b/>' } });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-xpath-expr'), { target: { value: '/b' } });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-xpath-value'), { target: { value: '1' } });
    expect(onXmlSample).toHaveBeenCalledWith('<b/>');
    expect(onXpathValue).toHaveBeenCalledWith('1');

    fireEvent.click(screen.getByTestId('api-mock-toolbox-xpath-sample-expand'));
    expect(screen.getByTestId('api-mock-text-expand-modal')).toBeTruthy();
    fireEvent.change(screen.getByTestId('api-mock-text-expand-editor'), {
      target: { value: '<soap:Envelope><orderId>A-1098</orderId></soap:Envelope>' },
    });
    fireEvent.click(screen.getByTestId('api-mock-text-expand-apply'));
    expect(onXmlSample).toHaveBeenCalledWith('<soap:Envelope><orderId>A-1098</orderId></soap:Envelope>');

    const onKind = vi.fn();
    const onSchema = vi.fn();
    render(<ApiMockSchemaToolboxPanel kind="json" schema="{}" onKind={onKind} onSchema={onSchema} />);
    fireEvent.click(screen.getByTestId('api-mock-toolbox-schema-kind-xml'));
    fireEvent.click(screen.getByTestId('api-mock-toolbox-schema-kind-json'));
    expect(onKind).toHaveBeenCalledWith('xml');
    expect(onKind).toHaveBeenCalledWith('json');
    fireEvent.click(screen.getByTestId('api-mock-toolbox-schema-preset-Required id'));
    fireEvent.change(screen.getByTestId('api-mock-toolbox-schema-editor'), { target: { value: '{"type":"number"}' } });
    expect(onSchema).toHaveBeenCalled();
    expect(screen.getByTestId('api-mock-toolbox-schema-status').textContent).toBe('Valid');
  });

  it('shows why a JSON Schema or XML draft cannot be applied', () => {
    const view = render(<ApiMockSchemaToolboxPanel kind="json" schema="{" onKind={vi.fn()} onSchema={vi.fn()} />);
    expect(screen.getByTestId('api-mock-toolbox-schema-status').textContent).toBe('Invalid');
    expect(screen.getByTestId('api-mock-toolbox-schema-error').textContent).toMatch(/Not valid JSON/);
    expect(screen.getByTestId('api-mock-toolbox-schema-editor').getAttribute('aria-invalid')).toBe('true');
    view.unmount();

    render(<ApiMockSchemaToolboxPanel kind="xml" schema="<xs/>" onKind={vi.fn()} onSchema={vi.fn()} />);
    expect(screen.getByTestId('api-mock-toolbox-schema-error').textContent).toMatch(/element name/);
  });

  const renderXPath = (xmlSample: string, xpath: string, xpathValue = '') => {
    const view = render(
      <ApiMockXPathToolboxPanel
        xmlSample={xmlSample}
        xpath={xpath}
        xpathValue={xpathValue}
        onXmlSample={vi.fn()}
        onXpath={vi.fn()}
        onXpathValue={vi.fn()}
      />,
    );
    return {
      resolved: screen.getByTestId('api-mock-toolbox-xpath-resolved') as HTMLInputElement,
      verdict: screen.getByTestId('api-mock-toolbox-xpath-result'),
      unmount: view.unmount,
    };
  };

  const SOAP = "<Envelope xmlns='urn:x'><orderId>A-1098</orderId></Envelope>";
  const ORDER_ID_XPATH = "//*[local-name()='orderId']/text()";

  it('resolves the expression against the sample and reports exists as the verdict', () => {
    const { resolved, verdict, unmount } = renderXPath(SOAP, ORDER_ID_XPATH);
    expect(resolved.value).toBe('A-1098');
    expect(verdict.textContent).toBe('✓');
    expect(screen.getByText(/xpath_exists/)).toBeTruthy();
    unmount();
  });

  it('compares against the equals value once one is given', () => {
    const passing = renderXPath(SOAP, ORDER_ID_XPATH, 'A-1098');
    expect(passing.verdict.textContent).toBe('✓');
    expect(screen.getByText(/xpath_equals/)).toBeTruthy();
    passing.unmount();

    const failing = renderXPath(SOAP, ORDER_ID_XPATH, 'A-9999');
    expect(failing.verdict.textContent).toBe('×');
    failing.unmount();
  });

  it('says so when the expression selects nothing, or the sample is not XML', () => {
    const noMatch = renderXPath(SOAP, "//*[local-name()='missing']");
    expect(noMatch.resolved.value).toBe('(no match)');
    expect(noMatch.verdict.textContent).toBe('×');
    noMatch.unmount();

    const notXml = renderXPath('not xml at all', '/*');
    expect(notXml.resolved.value).toBe('(not XML or invalid expression)');
    expect(notXml.verdict.textContent).toBe('×');
    expect(screen.getByTestId('api-mock-toolbox-xpath-valid').textContent).toBe('Not XML');
    notXml.unmount();
  });

  it('keeps the opened schema on Current schema after a preset overwrites the editor', () => {
    const original = '{\n  "type": "object",\n  "required": ["customer", "items"]\n}';
    function Harness() {
      const [kind, setKind] = useState<'json' | 'xml'>('json');
      const [schema, setSchema] = useState(original);
      return <ApiMockSchemaToolboxPanel kind={kind} schema={schema} onKind={setKind} onSchema={setSchema} />;
    }
    render(<Harness />);

    const current = screen.getByTestId(`api-mock-toolbox-schema-preset-${SCHEMA_CURRENT_PRESET_NAME}`);
    expect(current.className).toContain('active');
    expect((screen.getByTestId('api-mock-toolbox-schema-editor') as HTMLTextAreaElement).value).toBe(original);

    fireEvent.click(screen.getByTestId('api-mock-toolbox-schema-preset-JSON object'));
    expect((screen.getByTestId('api-mock-toolbox-schema-editor') as HTMLTextAreaElement).value).toBe(SCHEMA_PRESETS[0].value);
    expect(screen.getByTestId('api-mock-toolbox-schema-preset-JSON object').className).toContain('active');
    expect(current.className).not.toContain('active');

    fireEvent.click(current);
    expect((screen.getByTestId('api-mock-toolbox-schema-editor') as HTMLTextAreaElement).value).toBe(original);
    expect(current.className).toContain('active');
  });

  it('hides Current schema when the tab opened on a stock preset', () => {
    render(
      <ApiMockSchemaToolboxPanel
        kind="json"
        schema={SCHEMA_PRESETS[0].value}
        onKind={vi.fn()}
        onSchema={vi.fn()}
      />,
    );
    expect(screen.queryByTestId(`api-mock-toolbox-schema-preset-${SCHEMA_CURRENT_PRESET_NAME}`)).toBeNull();
    expect(screen.getByTestId('api-mock-toolbox-schema-preset-JSON object').className).toContain('active');
  });
});
