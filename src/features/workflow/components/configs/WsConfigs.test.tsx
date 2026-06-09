/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WsSendConfig from './WsSendConfig';
import WsConnectConfig from './WsConnectConfig';
import WsReceiveConfig from './WsReceiveConfig';
import WsTriggerConfig from './WsTriggerConfig';
import { createWsHeaderRow, createWsExtractionRule } from './wsConfigFactories';
import type {
  WsConnectNodeData,
  WsSendNodeData,
  WsReceiveNodeData,
  WsTriggerNodeData,
} from '../../types/workflow';

vi.mock('../expression/InsertVarField', () => ({
  default: ({ children, onInsert }: { children: React.ReactNode; onInsert?: (snippet: string) => void }) => (
    <div data-testid="insert-var-field">
      {children}
      {onInsert && <button data-testid="insert-var-btn" onClick={() => onInsert('{{var}}')} />}
    </div>
  ),
}));
vi.mock('../expression/ExpressionInput', () => ({
  default: ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid="expression-input" />
  ),
}));
vi.mock('../expression/AvailableVariables', () => ({
  default: () => <div data-testid="available-variables" />,
}));

// ── wsConfigFactories ──

describe('wsConfigFactories', () => {
  it('createWsHeaderRow creates a row with empty key/value and enabled=true', () => {
    const row = createWsHeaderRow();
    expect(row.id).toBeTruthy();
    expect(row.key).toBe('');
    expect(row.value).toBe('');
    expect(row.enabled).toBe(true);
  });

  it('createWsExtractionRule creates a rule with empty variableName and jsonPath', () => {
    const rule = createWsExtractionRule();
    expect(rule.variableName).toBe('');
    expect(rule.jsonPath).toBe('');
  });

  it('createWsHeaderRow generates unique ids', () => {
    const a = createWsHeaderRow();
    const b = createWsHeaderRow();
    expect(a.id).not.toBe(b.id);
  });
});

// ── WsConnectConfig ──

describe('WsConnectConfig', () => {
  function makeData(overrides?: Partial<WsConnectNodeData>): WsConnectNodeData {
    return {
      label: 'WS Connect',
      url: 'ws://localhost:8765',
      headers: [],
      queryParams: [],
      subprotocols: [],
      connectionId: 'ws1',
      timeoutMs: 10000,
      outputBindings: [],
      ...overrides,
    } as WsConnectNodeData;
  }

  it('renders label and calls onChange when label changes', () => {
    const onChange = vi.fn();
    render(<WsConnectConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('WS Connect'), { target: { value: 'New Label' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'New Label' }));
  });

  it('renders connection ID and updates it', () => {
    const onChange = vi.fn();
    render(<WsConnectConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('ws1'), { target: { value: 'conn2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'conn2' }));
  });

  it('updates timeout', () => {
    const onChange = vi.fn();
    render(<WsConnectConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('10000'), { target: { value: '5000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 5000 }));
  });

  it('renders available variables section', () => {
    render(<WsConnectConfig data={makeData()} onChange={vi.fn()} variableHints={[{ ref: 'x', label: 'X' }]} />);
    expect(screen.getByTestId('available-variables')).toBeTruthy();
  });

  it('updates URL via expression input', () => {
    const onChange = vi.fn();
    render(<WsConnectConfig data={makeData()} onChange={onChange} />);
    const urlInput = screen.getByDisplayValue('ws://localhost:8765');
    fireEvent.change(urlInput, { target: { value: 'wss://new.host/ws' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ url: 'wss://new.host/ws' }));
  });

  it('updates subprotocols', () => {
    const onChange = vi.fn();
    render(<WsConnectConfig data={makeData()} onChange={onChange} />);
    const subInput = screen.getByPlaceholderText('graphql-ws, mqtt');
    fireEvent.change(subInput, { target: { value: 'graphql-ws, mqtt' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ subprotocols: ['graphql-ws', 'mqtt'] }));
  });

  it('adds and interacts with headers', () => {
    const onChange = vi.fn();
    const { rerender } = render(<WsConnectConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Header'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      headers: [expect.objectContaining({ key: '', value: '', enabled: true })],
    }));
    // Re-render with a header to test interactions
    const withHeader = makeData({
      headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer token', enabled: true }],
    });
    rerender(<WsConnectConfig data={withHeader} onChange={onChange} />);
    // Update header key
    fireEvent.change(screen.getByDisplayValue('Authorization'), { target: { value: 'X-Custom' } });
    expect(onChange).toHaveBeenCalled();
    // Update header value via ExpressionInput
    fireEvent.change(screen.getByDisplayValue('Bearer token'), { target: { value: 'NewVal' } });
    expect(onChange).toHaveBeenCalled();
    // Toggle enabled checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalled();
    // Remove header
    fireEvent.click(screen.getByText('×'));
    expect(onChange).toHaveBeenCalled();
  });

  it('adds and interacts with query params', () => {
    const onChange = vi.fn();
    const withParam = makeData({
      queryParams: [{ id: 'p1', key: 'token', value: 'abc', enabled: true }],
    });
    render(<WsConnectConfig data={withParam} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('token'), { target: { value: 'key' } });
    expect(onChange).toHaveBeenCalled();
    // Update param value via ExpressionInput
    fireEvent.change(screen.getByDisplayValue('abc'), { target: { value: 'xyz' } });
    expect(onChange).toHaveBeenCalled();
    // Toggle param enabled checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalled();
    // Remove param
    fireEvent.click(screen.getByText('×'));
    expect(onChange).toHaveBeenCalled();
    fireEvent.click(screen.getByText('+ Add Parameter'));
    expect(onChange).toHaveBeenCalled();
  });

  it('adds and interacts with output bindings', () => {
    const onChange = vi.fn();
    const { rerender } = render(<WsConnectConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Binding'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      outputBindings: [expect.objectContaining({ field: 'protocol', variableName: '', enabled: true })],
    }));
    const withBinding = makeData({
      outputBindings: [{ field: 'protocol' as const, variableName: 'proto', enabled: true }],
    });
    rerender(<WsConnectConfig data={withBinding} onChange={onChange} />);
    // Change variable name
    fireEvent.change(screen.getByDisplayValue('proto'), { target: { value: 'myProto' } });
    expect(onChange).toHaveBeenCalled();
    // Change field select
    const select = screen.getByDisplayValue('protocol');
    fireEvent.change(select, { target: { value: 'extensions' } });
    expect(onChange).toHaveBeenCalled();
    // Toggle binding enabled
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalled();
    // Remove binding
    fireEvent.click(screen.getByText('×'));
    expect(onChange).toHaveBeenCalled();
  });

  it('renders with undefined headers/queryParams/outputBindings', () => {
    const data = { label: 'Test', url: 'ws://x', connectionId: 'c1', timeoutMs: 5000 } as WsConnectNodeData;
    render(<WsConnectConfig data={data} onChange={vi.fn()} />);
    expect(screen.getByTestId('ws-connect-config')).toBeTruthy();
  });

  it('triggers InsertVarField onInsert for URL', () => {
    const onChange = vi.fn();
    render(<WsConnectConfig data={makeData()} onChange={onChange} />);
    const insertBtns = screen.getAllByTestId('insert-var-btn');
    fireEvent.click(insertBtns[0]); // URL InsertVarField
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ url: 'ws://localhost:8765{{var}}' }));
  });

  it('triggers InsertVarField onInsert for header value', () => {
    const onChange = vi.fn();
    const data = makeData({
      headers: [{ id: 'h1', key: 'Auth', value: 'Bearer ', enabled: true }],
    });
    render(<WsConnectConfig data={data} onChange={onChange} />);
    const insertBtns = screen.getAllByTestId('insert-var-btn');
    // Second InsertVarField is for header value
    fireEvent.click(insertBtns[1]);
    expect(onChange).toHaveBeenCalled();
  });

  it('triggers InsertVarField onInsert for query param value', () => {
    const onChange = vi.fn();
    const data = makeData({
      queryParams: [{ id: 'p1', key: 'tok', value: '', enabled: true }],
    });
    render(<WsConnectConfig data={data} onChange={onChange} />);
    const insertBtns = screen.getAllByTestId('insert-var-btn');
    // Last InsertVarField is for param value
    fireEvent.click(insertBtns[insertBtns.length - 1]);
    expect(onChange).toHaveBeenCalled();
  });
});

// ── WsSendConfig ──

describe('WsSendConfig', () => {
  function makeData(overrides?: Partial<WsSendNodeData>): WsSendNodeData {
    return {
      label: 'WS Send',
      connectionId: 'ws1',
      message: '{"action":"ping"}',
      messageType: 'text',
      waitForResponse: false,
      responseTimeoutMs: 5000,
      outputBindings: [],
      ...overrides,
    } as WsSendNodeData;
  }

  it('renders and updates label', () => {
    const onChange = vi.fn();
    render(<WsSendConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('WS Send'), { target: { value: 'Send Msg' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Send Msg' }));
  });

  it('updates message type via select', () => {
    const onChange = vi.fn();
    render(<WsSendConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Text'), { target: { value: 'binary' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ messageType: 'binary' }));
  });

  it('updates waitForResponse checkbox', () => {
    const onChange = vi.fn();
    render(<WsSendConfig data={makeData()} onChange={onChange} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ waitForResponse: true }));
  });

  it('shows response timeout when waitForResponse is true', () => {
    render(<WsSendConfig data={makeData({ waitForResponse: true })} onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('5000')).toBeTruthy();
  });

  it('shows connection dropdown when availableConnectionIds provided', () => {
    const onChange = vi.fn();
    render(<WsSendConfig data={makeData()} onChange={onChange} availableConnectionIds={['ws1', 'ws2']} />);
    const select = screen.getByDisplayValue('ws1');
    fireEvent.change(select, { target: { value: 'ws2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'ws2' }));
  });

  it('shows custom input when "__custom__" selected', () => {
    const onChange = vi.fn();
    render(<WsSendConfig data={makeData()} onChange={onChange} availableConnectionIds={['ws1']} />);
    const select = screen.getByDisplayValue('ws1');
    fireEvent.change(select, { target: { value: '__custom__' } });
    // After selecting custom, the text input should appear
    expect(screen.getByPlaceholderText('ws1')).toBeTruthy();
  });

  it('updates message textarea', () => {
    const onChange = vi.fn();
    render(<WsSendConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('{"action":"ping"}'), { target: { value: '{"action":"pong"}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ message: '{"action":"pong"}' }));
  });

  it('updates response timeout when waitForResponse is true', () => {
    const onChange = vi.fn();
    render(<WsSendConfig data={makeData({ waitForResponse: true })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('5000'), { target: { value: '10000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ responseTimeoutMs: 10000 }));
  });

  it('renders output bindings when waitForResponse is true', () => {
    const onChange = vi.fn();
    const data = makeData({
      waitForResponse: true,
      outputBindings: [{ field: 'responseBody' as const, variableName: 'body', enabled: true }],
    });
    render(<WsSendConfig data={data} onChange={onChange} />);
    expect(screen.getByDisplayValue('body')).toBeTruthy();
    // Change binding variable name
    fireEvent.change(screen.getByDisplayValue('body'), { target: { value: 'respBody' } });
    expect(onChange).toHaveBeenCalled();
    // Toggle binding enabled
    const checkboxes = screen.getAllByRole('checkbox');
    const bindingCheckbox = checkboxes.find(cb => cb !== screen.getByRole('checkbox', { name: /wait/i }));
    if (bindingCheckbox) fireEvent.click(bindingCheckbox);
    // Change binding field
    fireEvent.change(screen.getByDisplayValue('responseBody'), { target: { value: 'latencyMs' } });
    expect(onChange).toHaveBeenCalled();
    // Remove binding
    fireEvent.click(screen.getByText('×'));
    expect(onChange).toHaveBeenCalled();
  });

  it('adds output binding', () => {
    const onChange = vi.fn();
    render(<WsSendConfig data={makeData({ waitForResponse: true })} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Binding'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      outputBindings: [expect.objectContaining({ field: 'responseBody', variableName: '', enabled: true })],
    }));
  });

  it('renders custom connection input when connectionId not in list', () => {
    render(<WsSendConfig data={makeData({ connectionId: 'unknown' })} onChange={vi.fn()} availableConnectionIds={['ws1', 'ws2']} />);
    expect(screen.getByDisplayValue('unknown')).toBeTruthy();
  });

  it('selects back from custom to known connection', () => {
    const onChange = vi.fn();
    render(<WsSendConfig data={makeData({ connectionId: 'unknown' })} onChange={onChange} availableConnectionIds={['ws1', 'ws2']} />);
    // The select shows __custom__ since unknown is not in list
    const select = screen.getByDisplayValue('(custom)');
    fireEvent.change(select, { target: { value: 'ws2' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'ws2' }));
  });

  it('renders with undefined outputBindings', () => {
    const data = { label: 'S', connectionId: 'c1', message: '', messageType: 'text', waitForResponse: false, responseTimeoutMs: 5000 } as WsSendNodeData;
    render(<WsSendConfig data={data} onChange={vi.fn()} />);
    expect(screen.getByTestId('ws-send-config')).toBeTruthy();
  });

  it('triggers InsertVarField onInsert for message', () => {
    const onChange = vi.fn();
    render(<WsSendConfig data={makeData()} onChange={onChange} />);
    const insertBtns = screen.getAllByTestId('insert-var-btn');
    fireEvent.click(insertBtns[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ message: '{"action":"ping"}{{var}}' }));
  });
});

// ── WsReceiveConfig ──

describe('WsReceiveConfig', () => {
  function makeData(overrides?: Partial<WsReceiveNodeData>): WsReceiveNodeData {
    return {
      label: 'WS Receive',
      connectionId: 'ws1',
      timeoutMs: 5000,
      matchCriteria: {},
      extractionRules: [],
      outputBindings: [],
      ...overrides,
    } as WsReceiveNodeData;
  }

  it('renders and updates label', () => {
    const onChange = vi.fn();
    render(<WsReceiveConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('WS Receive'), { target: { value: 'Receive Msg' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'Receive Msg' }));
  });

  it('updates timeout', () => {
    const onChange = vi.fn();
    render(<WsReceiveConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('5000'), { target: { value: '10000' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 10000 }));
  });

  it('shows connection dropdown with custom option', () => {
    const onChange = vi.fn();
    render(<WsReceiveConfig data={makeData()} onChange={onChange} availableConnectionIds={['ws1', 'ws2']} />);
    const select = screen.getByDisplayValue('ws1');
    fireEvent.change(select, { target: { value: '__custom__' } });
    expect(screen.getByPlaceholderText('ws1')).toBeTruthy();
  });

  it('renders available variables', () => {
    render(<WsReceiveConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByTestId('available-variables')).toBeTruthy();
  });

  it('updates match criteria - message type', () => {
    const onChange = vi.fn();
    render(<WsReceiveConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Any'), { target: { value: 'text' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ messageType: 'text' }),
    }));
  });

  it('updates content regex', () => {
    const onChange = vi.fn();
    render(<WsReceiveConfig data={makeData()} onChange={onChange} />);
    const regexInput = screen.getByPlaceholderText('Regular expression pattern');
    fireEvent.change(regexInput, { target: { value: '.*order.*' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ contentRegex: '.*order.*' }),
    }));
  });

  it('clears content regex when empty', () => {
    const onChange = vi.fn();
    render(<WsReceiveConfig data={makeData({ matchCriteria: { contentRegex: 'test' } })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('test'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ contentRegex: undefined }),
    }));
  });

  it('updates jsonPathMatch and shows jsonPathValue', () => {
    const onChange = vi.fn();
    const { rerender } = render(<WsReceiveConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('$.event.type'), { target: { value: '$.status' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ jsonPathMatch: '$.status' }),
    }));
    // Re-render with jsonPathMatch to show expected value field
    rerender(<WsReceiveConfig data={makeData({ matchCriteria: { jsonPathMatch: '$.status' } })} onChange={onChange} />);
    const valueInput = screen.getByPlaceholderText('Expected value at JSONPath');
    fireEvent.change(valueInput, { target: { value: 'active' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('adds and modifies extraction rules', () => {
    const onChange = vi.fn();
    const { rerender } = render(<WsReceiveConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Extraction'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      extractionRules: [expect.objectContaining({ variableName: '', jsonPath: '' })],
    }));
    const withRules = makeData({
      extractionRules: [{ variableName: 'myVar', jsonPath: '$.data' }],
    });
    rerender(<WsReceiveConfig data={withRules} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('myVar'), { target: { value: 'newVar' } });
    expect(onChange).toHaveBeenCalled();
    fireEvent.change(screen.getByDisplayValue('$.data'), { target: { value: '$.result' } });
    expect(onChange).toHaveBeenCalled();
    // Remove extraction rule
    fireEvent.click(screen.getByText('×'));
    expect(onChange).toHaveBeenCalled();
  });

  it('adds and interacts with output bindings', () => {
    const onChange = vi.fn();
    const { rerender } = render(<WsReceiveConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Binding'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      outputBindings: [expect.objectContaining({ field: 'messageBody', variableName: '', enabled: true })],
    }));
    const withBinding = makeData({
      outputBindings: [{ field: 'messageBody' as const, variableName: 'msg', enabled: true }],
    });
    rerender(<WsReceiveConfig data={withBinding} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('msg'), { target: { value: 'body' } });
    expect(onChange).toHaveBeenCalled();
    fireEvent.change(screen.getByDisplayValue('messageBody'), { target: { value: 'latencyMs' } });
    expect(onChange).toHaveBeenCalled();
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalled();
    fireEvent.click(screen.getByText('×'));
    expect(onChange).toHaveBeenCalled();
  });

  it('renders with no availableConnectionIds (text input only)', () => {
    render(<WsReceiveConfig data={makeData()} onChange={vi.fn()} availableConnectionIds={[]} />);
    expect(screen.getByDisplayValue('ws1')).toBeTruthy();
  });

  it('renders with undefined optional fields', () => {
    const data = { label: 'R', connectionId: 'c1', timeoutMs: 5000 } as WsReceiveNodeData;
    render(<WsReceiveConfig data={data} onChange={vi.fn()} />);
    expect(screen.getByTestId('ws-receive-config')).toBeTruthy();
  });

  it('triggers InsertVarField onInsert for contentContains', () => {
    const onChange = vi.fn();
    render(<WsReceiveConfig data={makeData()} onChange={onChange} />);
    const insertBtns = screen.getAllByTestId('insert-var-btn');
    // First insert-var-btn is for contentContains
    fireEvent.click(insertBtns[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ contentContains: '{{var}}' }),
    }));
  });

  it('triggers InsertVarField onInsert for jsonPathValue', () => {
    const onChange = vi.fn();
    render(<WsReceiveConfig data={makeData({ matchCriteria: { jsonPathMatch: '$.type' } })} onChange={onChange} />);
    const insertBtns = screen.getAllByTestId('insert-var-btn');
    // Second insert-var-btn is for jsonPathValue
    fireEvent.click(insertBtns[1]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ jsonPathValue: '{{var}}' }),
    }));
  });

  it('updates contentContains via ExpressionInput', () => {
    const onChange = vi.fn();
    render(<WsReceiveConfig data={makeData()} onChange={onChange} />);
    const input = screen.getByPlaceholderText('Substring to match');
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ contentContains: 'hello' }),
    }));
  });
});

// ── WsTriggerConfig ──

describe('WsTriggerConfig', () => {
  function makeData(overrides?: Partial<WsTriggerNodeData>): WsTriggerNodeData {
    return {
      label: 'WS Trigger',
      url: 'ws://localhost:8765',
      connectionId: 'ws1',
      matchCriteria: {},
      extractionRules: [],
      ...overrides,
    } as WsTriggerNodeData;
  }

  it('renders and updates label', () => {
    const onChange = vi.fn();
    render(<WsTriggerConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('WS Trigger'), { target: { value: 'My Trigger' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ label: 'My Trigger' }));
  });

  it('updates connection ID', () => {
    const onChange = vi.fn();
    render(<WsTriggerConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('ws1'), { target: { value: 'conn-abc' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'conn-abc' }));
  });

  it('renders available variables', () => {
    render(<WsTriggerConfig data={makeData()} onChange={vi.fn()} />);
    expect(screen.getByTestId('available-variables')).toBeTruthy();
  });

  it('updates URL', () => {
    const onChange = vi.fn();
    render(<WsTriggerConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('ws://localhost:8765'), { target: { value: 'wss://new.host' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ url: 'wss://new.host' }));
  });

  it('updates match criteria - message type', () => {
    const onChange = vi.fn();
    render(<WsTriggerConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('Any'), { target: { value: 'binary' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ messageType: 'binary' }),
    }));
  });

  it('updates content regex', () => {
    const onChange = vi.fn();
    render(<WsTriggerConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('Regular expression pattern'), { target: { value: '^ok$' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ contentRegex: '^ok$' }),
    }));
  });

  it('updates jsonPathMatch and shows jsonPathValue', () => {
    const onChange = vi.fn();
    const { rerender } = render(<WsTriggerConfig data={makeData()} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('$.event.type'), { target: { value: '$.action' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ jsonPathMatch: '$.action' }),
    }));
    rerender(<WsTriggerConfig data={makeData({ matchCriteria: { jsonPathMatch: '$.action' } })} onChange={onChange} />);
    const valueInput = screen.getByPlaceholderText('Expected value at JSONPath');
    fireEvent.change(valueInput, { target: { value: 'trigger' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('adds and modifies extraction rules', () => {
    const onChange = vi.fn();
    const { rerender } = render(<WsTriggerConfig data={makeData()} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add Variable'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      extractionRules: [expect.objectContaining({ variableName: '', jsonPath: '' })],
    }));
    const withRules = makeData({
      extractionRules: [{ variableName: 'orderId', jsonPath: '$.orderId' }],
    });
    rerender(<WsTriggerConfig data={withRules} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('orderId'), { target: { value: 'newId' } });
    expect(onChange).toHaveBeenCalled();
    fireEvent.change(screen.getByDisplayValue('$.orderId'), { target: { value: '$.id' } });
    expect(onChange).toHaveBeenCalled();
    // Remove
    fireEvent.click(screen.getByText('×'));
    expect(onChange).toHaveBeenCalled();
  });

  it('updates sample payload', () => {
    const onChange = vi.fn();
    render(<WsTriggerConfig data={makeData()} onChange={onChange} />);
    const textarea = screen.getByPlaceholderText(/order\.created/);
    fireEvent.change(textarea, { target: { value: '{"event":"test"}' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ samplePayload: '{"event":"test"}' }));
  });

  it('clears sample payload when empty', () => {
    const onChange = vi.fn();
    render(<WsTriggerConfig data={makeData({ samplePayload: '{"a":1}' })} onChange={onChange} />);
    fireEvent.change(screen.getByDisplayValue('{"a":1}'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ samplePayload: undefined }));
  });

  it('renders with undefined optional fields', () => {
    const data = { label: 'T', url: 'ws://x', connectionId: 'c1' } as WsTriggerNodeData;
    render(<WsTriggerConfig data={data} onChange={vi.fn()} />);
    expect(screen.getByTestId('ws-trigger-config')).toBeTruthy();
  });

  it('triggers InsertVarField onInsert for URL', () => {
    const onChange = vi.fn();
    render(<WsTriggerConfig data={makeData()} onChange={onChange} />);
    const insertBtns = screen.getAllByTestId('insert-var-btn');
    fireEvent.click(insertBtns[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ url: 'ws://localhost:8765{{var}}' }));
  });

  it('triggers InsertVarField onInsert for contentContains', () => {
    const onChange = vi.fn();
    render(<WsTriggerConfig data={makeData()} onChange={onChange} />);
    const insertBtns = screen.getAllByTestId('insert-var-btn');
    // Second insert-var-btn is for contentContains
    fireEvent.click(insertBtns[1]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ contentContains: '{{var}}' }),
    }));
  });

  it('triggers InsertVarField onInsert for jsonPathValue', () => {
    const onChange = vi.fn();
    render(<WsTriggerConfig data={makeData({ matchCriteria: { jsonPathMatch: '$.x' } })} onChange={onChange} />);
    const insertBtns = screen.getAllByTestId('insert-var-btn');
    // Third insert-var-btn is for jsonPathValue
    fireEvent.click(insertBtns[2]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ jsonPathValue: '{{var}}' }),
    }));
  });

  it('updates contentContains via ExpressionInput', () => {
    const onChange = vi.fn();
    render(<WsTriggerConfig data={makeData()} onChange={onChange} />);
    const input = screen.getByPlaceholderText('Substring to match');
    fireEvent.change(input, { target: { value: 'ping' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ contentContains: 'ping' }),
    }));
  });

  it('clears contentContains when empty', () => {
    const onChange = vi.fn();
    render(<WsTriggerConfig data={makeData({ matchCriteria: { contentContains: 'test' } })} onChange={onChange} />);
    const input = screen.getByDisplayValue('test');
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      matchCriteria: expect.objectContaining({ contentContains: undefined }),
    }));
  });
});
