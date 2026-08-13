/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ApiMockSchemaToolboxPanel, ApiMockXPathToolboxPanel } from './ApiMockPatternToolboxExtraPanels';

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
    fireEvent.change(screen.getByTestId('api-mock-toolbox-xpath-sample'), { target: { value: '<b/>' } });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-xpath-expr'), { target: { value: '/b' } });
    fireEvent.change(screen.getByTestId('api-mock-toolbox-xpath-value'), { target: { value: '1' } });
    expect(onXmlSample).toHaveBeenCalledWith('<b/>');
    expect(onXpathValue).toHaveBeenCalledWith('1');

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
  });
});
