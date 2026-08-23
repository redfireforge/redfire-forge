/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { selectOption, getCustomSelectValue, getCustomSelectOptionLabels } from '@test-utils/customSelectHelper';
import WsScenarioEditor from './WsScenarioEditor';
import type { Scenario } from '@shared/types';
import { createDefaultWsConnectAction, createDefaultWsSendAction, createDefaultWsReceiveAction } from '@shared/utils/wsScenarioDefaults';

const mockOnDraftChange = vi.fn();

function makeWsDraft(overrides: Partial<Scenario>): Scenario {
  return {
    id: 'test-1',
    name: 'WS Test',
    url: '',
    method: 'WEBSOCKET',
    headers: [],
    body: '',
    bodyType: 'none',
    bodyForm: [],
    auth: { type: 'inherit' },
    validation: { mode: 'none', expectedFields: [] },
    ...overrides,
  };
}

describe('WsScenarioEditor', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // ── wsConnect mode ──────────────────────────────────────────────────────────

  describe('wsConnect mode', () => {
    const connectDraft = makeWsDraft({
      actionType: 'wsConnect',
      wsConnectAction: createDefaultWsConnectAction('wss://test.example.com/ws'),
    });

    it('renders URL input with value', () => {
      render(<WsScenarioEditor draft={connectDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      const input = screen.getByLabelText('WebSocket URL');
      expect(input).toHaveValue('wss://test.example.com/ws');
    });

    it('renders connection ID input', () => {
      render(<WsScenarioEditor draft={connectDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Connection ID')).toBeInTheDocument();
    });

    it('renders subprotocols input', () => {
      render(<WsScenarioEditor draft={connectDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Subprotocols')).toBeInTheDocument();
    });

    it('renders timeout input with default value', () => {
      render(<WsScenarioEditor draft={connectDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      const input = screen.getByLabelText('Connect timeout');
      expect(input).toHaveValue(10000);
    });

    it('calls onDraftChange when URL changes', () => {
      render(<WsScenarioEditor draft={connectDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('WebSocket URL'), { target: { value: 'wss://new.example.com' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({ url: 'wss://new.example.com' }),
      }));
    });

    it('calls onDraftChange when connection ID changes', () => {
      render(<WsScenarioEditor draft={connectDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Connection ID'), { target: { value: 'my-conn' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({ connectionId: 'my-conn' }),
      }));
    });

    it('shows placeholder with resolvedBaseUrl', () => {
      render(<WsScenarioEditor draft={makeWsDraft({ actionType: 'wsConnect', wsConnectAction: createDefaultWsConnectAction() })} onDraftChange={mockOnDraftChange} resolvedBaseUrl="https://api.test.com" siblingTests={[]} />);
      const input = screen.getByLabelText('WebSocket URL');
      expect(input).toHaveAttribute('placeholder', 'https://api.test.com/ws');
    });

    it('renders Headers KV section', () => {
      render(<WsScenarioEditor draft={connectDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByText('Headers')).toBeInTheDocument();
    });

    it('renders Query Parameters KV section', () => {
      render(<WsScenarioEditor draft={connectDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByText('Query Parameters')).toBeInTheDocument();
    });
  });

  // ── wsSend mode ─────────────────────────────────────────────────────────────

  describe('wsSend mode', () => {
    const siblingConnectTest = makeWsDraft({
      id: 'conn-1',
      name: 'Open Chat',
      actionType: 'wsConnect',
      wsConnectAction: createDefaultWsConnectAction('wss://chat.example.com'),
    });
    siblingConnectTest.wsConnectAction!.connectionId = 'chat';

    const sendDraft = makeWsDraft({
      actionType: 'wsSend',
      wsSendAction: createDefaultWsSendAction('{"type": "hello"}'),
    });

    it('renders message textarea with value', () => {
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[sendDraft]} />);
      const textarea = screen.getByLabelText('Message body');
      expect(textarea).toHaveValue('{"type": "hello"}');
    });

    it('renders connection ref dropdown with sibling connect tests', () => {
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[siblingConnectTest, sendDraft]} />);
      const connRef = screen.getByLabelText('Connection reference').closest('.cs-wrapper')!;
      expect(connRef).toBeInTheDocument();
      expect(getCustomSelectOptionLabels(connRef)).toContain('Open Chat');
    });

    it('shows manual input warning when no connect tests exist', () => {
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[sendDraft]} />);
      expect(screen.getByText(/No wsConnect tests in this scenario/)).toBeInTheDocument();
    });

    it('renders format selector with text/binary options', () => {
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(getCustomSelectValue(screen.getByLabelText('Message type').closest('.cs-wrapper')!)).toBe('Text');
    });

    it('renders wait-for-response checkbox', () => {
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByText('Wait for response')).toBeInTheDocument();
    });

    it('shows response timeout when wait-for-response is checked', () => {
      const draftWithWait = makeWsDraft({
        actionType: 'wsSend',
        wsSendAction: { ...createDefaultWsSendAction(), waitForResponse: true },
      });
      render(<WsScenarioEditor draft={draftWithWait} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Response timeout')).toBeInTheDocument();
    });

    it('calls onDraftChange when message changes', () => {
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Message body'), { target: { value: 'new message' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsSendAction: expect.objectContaining({ message: 'new message' }),
      }));
    });
  });

  // ── wsReceive mode ──────────────────────────────────────────────────────────

  describe('wsReceive mode', () => {
    const receiveDraft = makeWsDraft({
      actionType: 'wsReceive',
      wsReceiveAction: createDefaultWsReceiveAction(),
    });

    it('renders connection ref dropdown', () => {
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Connection reference')).toBeInTheDocument();
    });

    it('renders timeout input', () => {
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Receive timeout')).toHaveValue(10000);
    });

    it('renders match criteria fieldset', () => {
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByText('Match Criteria')).toBeInTheDocument();
    });

    it('renders content contains input', () => {
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Content contains filter')).toBeInTheDocument();
    });

    it('renders content regex input', () => {
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Content regex filter')).toBeInTheDocument();
    });

    it('renders JSONPath match inputs', () => {
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('JSONPath to match')).toBeInTheDocument();
      expect(screen.getByLabelText('JSONPath expected value')).toBeInTheDocument();
    });

    it('renders frame type selector', () => {
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(getCustomSelectValue(screen.getByLabelText('Frame type filter').closest('.cs-wrapper')!)).toBe('Any');
    });

    it('calls onDraftChange when match criteria content changes', () => {
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Content contains filter'), { target: { value: 'hello' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({
          matchCriteria: expect.objectContaining({ contentContains: 'hello' }),
        }),
      }));
    });
  });

  // ── edge cases ──────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns null for non-WS action type', () => {
      const httpDraft = makeWsDraft({ actionType: 'http' as 'wsConnect' });
      const { container } = render(<WsScenarioEditor draft={httpDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(container.innerHTML).toBe('');
    });

    it('uses default config when action config is undefined', () => {
      const draft = makeWsDraft({ actionType: 'wsConnect' });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Connect timeout')).toHaveValue(10000);
    });

    it('filters self from connectionRef options', () => {
      const connectTest = makeWsDraft({
        id: 'conn-1',
        name: 'Open Chat',
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), connectionId: 'chat' },
      });
      const sendDraft = makeWsDraft({
        id: 'send-1',
        actionType: 'wsSend',
        wsSendAction: createDefaultWsSendAction(),
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[connectTest, sendDraft]} />);
      const connRef = screen.getByLabelText('Connection reference').closest('.cs-wrapper')!;
      expect(getCustomSelectOptionLabels(connRef)).toContain('Open Chat');
    });

    it('excludes connect tests without connectionId from dropdown', () => {
      const connectNoId = makeWsDraft({
        id: 'conn-no-id',
        name: 'No ID Connect',
        actionType: 'wsConnect',
        wsConnectAction: createDefaultWsConnectAction('wss://example.com'),
      });
      const sendDraft = makeWsDraft({
        id: 'send-1',
        actionType: 'wsSend',
        wsSendAction: createDefaultWsSendAction(),
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[connectNoId, sendDraft]} />);
      expect(screen.queryByText('No ID Connect')).not.toBeInTheDocument();
      expect(screen.getByText(/no Connection ID set/)).toBeInTheDocument();
    });

    it('shows "No wsConnect tests found" when no connect tests exist at all', () => {
      const sendDraft = makeWsDraft({
        id: 'send-1',
        actionType: 'wsSend',
        wsSendAction: createDefaultWsSendAction(),
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[sendDraft]} />);
      expect(screen.getByText(/No wsConnect tests in this scenario/)).toBeInTheDocument();
    });
  });

  // ── KV editor interactions ────────────────────────────────────────────────────

  describe('KV editor interactions', () => {
    it('adds a header row', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: createDefaultWsConnectAction(),
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      const addButtons = screen.getAllByText('+ Add');
      fireEvent.click(addButtons[0]); // first + Add is for headers
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({
          headers: [{ key: '', value: '' }],
        }),
      }));
    });

    it('updates a header key', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), headers: [{ key: 'Auth', value: 'token' }] },
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      const inputs = screen.getAllByPlaceholderText('name');
      fireEvent.change(inputs[0], { target: { value: 'X-Custom' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({
          headers: [{ key: 'X-Custom', value: 'token' }],
        }),
      }));
    });

    it('updates a header value', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), headers: [{ key: 'Auth', value: 'old' }] },
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      const inputs = screen.getAllByPlaceholderText('value');
      fireEvent.change(inputs[0], { target: { value: 'new' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({
          headers: [{ key: 'Auth', value: 'new' }],
        }),
      }));
    });

    it('removes a header row', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), headers: [{ key: 'A', value: '1' }, { key: 'B', value: '2' }] },
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      const removeButtons = screen.getAllByText('×');
      fireEvent.click(removeButtons[0]);
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({
          headers: [{ key: 'B', value: '2' }],
        }),
      }));
    });

    it('adds a query param row', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: createDefaultWsConnectAction(),
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      const addButtons = screen.getAllByText('+ Add');
      fireEvent.click(addButtons[1]); // second + Add is for query params
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({
          queryParams: [{ key: '', value: '' }],
        }),
      }));
    });

    it('clears headers to undefined when last row removed', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), headers: [{ key: 'A', value: '1' }] },
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      const removeButtons = screen.getAllByText('×');
      fireEvent.click(removeButtons[0]);
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({
          headers: undefined,
        }),
      }));
    });
  });

  // ── connect field interactions ────────────────────────────────────────────────

  describe('connect field interactions', () => {
    it('updates subprotocols', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: createDefaultWsConnectAction(),
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Subprotocols'), { target: { value: 'graphql-ws' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({ subprotocols: 'graphql-ws' }),
      }));
    });

    it('clears connection ID to undefined', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), connectionId: 'old' },
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Connection ID'), { target: { value: '' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({ connectionId: undefined }),
      }));
    });

    it('updates timeout', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: createDefaultWsConnectAction(),
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Connect timeout'), { target: { value: '5000' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({ timeoutMs: 5000 }),
      }));
    });
  });

  // ── send field interactions ──────────────────────────────────────────────────

  describe('send field interactions', () => {
    it('updates connection ref from dropdown', () => {
      const connectTest = makeWsDraft({
        id: 'conn-1', name: 'Open Chat',
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), connectionId: 'chat' },
      });
      const sendDraft = makeWsDraft({
        id: 'send-1',
        actionType: 'wsSend',
        wsSendAction: createDefaultWsSendAction(),
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[connectTest, sendDraft]} />);
      selectOption(screen.getByLabelText('Connection reference').closest('.cs-wrapper')!, 'Open Chat');
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsSendAction: expect.objectContaining({ connectionRef: 'chat' }),
      }));
    });

    it('updates message type to binary', () => {
      const sendDraft = makeWsDraft({
        actionType: 'wsSend',
        wsSendAction: createDefaultWsSendAction(),
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      selectOption(screen.getByLabelText('Message type').closest('.cs-wrapper')!, 'Binary');
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsSendAction: expect.objectContaining({ messageType: 'binary' }),
      }));
    });

    it('toggles wait-for-response checkbox', () => {
      const sendDraft = makeWsDraft({
        actionType: 'wsSend',
        wsSendAction: createDefaultWsSendAction(),
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsSendAction: expect.objectContaining({ waitForResponse: true }),
      }));
    });

    it('updates response timeout', () => {
      const sendDraft = makeWsDraft({
        actionType: 'wsSend',
        wsSendAction: { ...createDefaultWsSendAction(), waitForResponse: true },
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Response timeout'), { target: { value: '3000' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsSendAction: expect.objectContaining({ responseTimeoutMs: 3000 }),
      }));
    });

    it('shows manual connection ref input when no connect tests', () => {
      const sendDraft = makeWsDraft({
        actionType: 'wsSend',
        wsSendAction: createDefaultWsSendAction(),
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Manual connection reference')).toBeInTheDocument();
    });

    it('updates manual connection ref', () => {
      const sendDraft = makeWsDraft({
        actionType: 'wsSend',
        wsSendAction: createDefaultWsSendAction(),
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Manual connection reference'), { target: { value: 'my-conn' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsSendAction: expect.objectContaining({ connectionRef: 'my-conn' }),
      }));
    });
  });

  // ── receive field interactions ───────────────────────────────────────────────

  describe('receive field interactions', () => {
    it('updates connection ref from dropdown', () => {
      const connectTest = makeWsDraft({
        id: 'conn-1', name: 'Open Chat',
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), connectionId: 'chat' },
      });
      const receiveDraft = makeWsDraft({
        id: 'recv-1',
        actionType: 'wsReceive',
        wsReceiveAction: createDefaultWsReceiveAction(),
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[connectTest, receiveDraft]} />);
      selectOption(screen.getByLabelText('Connection reference').closest('.cs-wrapper')!, 'Open Chat');
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({ connectionRef: 'chat' }),
      }));
    });

    it('updates timeout', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: createDefaultWsReceiveAction(),
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Receive timeout'), { target: { value: '5000' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({ timeoutMs: 5000 }),
      }));
    });

    it('updates content regex', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: createDefaultWsReceiveAction(),
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Content regex filter'), { target: { value: '^event:' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({
          matchCriteria: expect.objectContaining({ contentRegex: '^event:' }),
        }),
      }));
    });

    it('updates jsonPathMatch', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: createDefaultWsReceiveAction(),
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('JSONPath to match'), { target: { value: '$.type' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({
          matchCriteria: expect.objectContaining({ jsonPathMatch: '$.type' }),
        }),
      }));
    });

    it('updates jsonPathValue', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: createDefaultWsReceiveAction(),
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('JSONPath expected value'), { target: { value: 'notification' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({
          matchCriteria: expect.objectContaining({ jsonPathValue: 'notification' }),
        }),
      }));
    });

    it('updates frame type to text', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: createDefaultWsReceiveAction(),
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      selectOption(screen.getByLabelText('Frame type filter').closest('.cs-wrapper')!, 'Text');
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({
          matchCriteria: expect.objectContaining({ messageType: 'text' }),
        }),
      }));
    });

    it('resets frame type to undefined when any is selected', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: { ...createDefaultWsReceiveAction(), matchCriteria: { messageType: 'text' } },
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      selectOption(screen.getByLabelText('Frame type filter').closest('.cs-wrapper')!, 'Any');
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({
          matchCriteria: expect.objectContaining({ messageType: undefined }),
        }),
      }));
    });

    it('shows manual input for receive when no connect tests', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: createDefaultWsReceiveAction(),
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Manual connection reference')).toBeInTheDocument();
    });

    it('shows warning when connect tests exist but have no ID (receive)', () => {
      const connectNoId = makeWsDraft({
        id: 'conn-1',
        actionType: 'wsConnect',
        wsConnectAction: createDefaultWsConnectAction(),
      });
      const receiveDraft = makeWsDraft({
        id: 'recv-1',
        actionType: 'wsReceive',
        wsReceiveAction: createDefaultWsReceiveAction(),
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[connectNoId, receiveDraft]} />);
      expect(screen.getByText(/no Connection ID set/)).toBeInTheDocument();
    });

    it('updates manual connection ref on receive', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: createDefaultWsReceiveAction(),
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Manual connection reference'), { target: { value: 'recv-conn' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({ connectionRef: 'recv-conn' }),
      }));
    });

    it('clears manual connection ref on receive', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: { ...createDefaultWsReceiveAction(), connectionRef: 'old' },
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Manual connection reference'), { target: { value: '' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({ connectionRef: undefined }),
      }));
    });

    it('clears match criteria fields to undefined when emptied', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: {
          ...createDefaultWsReceiveAction(),
          matchCriteria: {
            contentContains: 'x',
            contentRegex: 'y',
            jsonPathMatch: '$.a',
            jsonPathValue: 'b',
          },
        },
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Content contains filter'), { target: { value: '' } });
      fireEvent.change(screen.getByLabelText('Content regex filter'), { target: { value: '' } });
      fireEvent.change(screen.getByLabelText('JSONPath to match'), { target: { value: '' } });
      fireEvent.change(screen.getByLabelText('JSONPath expected value'), { target: { value: '' } });
      expect(mockOnDraftChange).toHaveBeenCalled();
    });
  });

  describe('additional branch coverage', () => {
    it('uses connectionId as dropdown label when connect test has no name', () => {
      const connectTest = makeWsDraft({
        id: 'conn-1',
        name: '',
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), connectionId: 'fallback-id' },
      });
      const sendDraft = makeWsDraft({
        id: 'send-1',
        actionType: 'wsSend',
        wsSendAction: createDefaultWsSendAction(),
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[connectTest, sendDraft]} />);
      expect(getCustomSelectOptionLabels(screen.getByLabelText('Connection reference').closest('.cs-wrapper')!)).toContain('fallback-id');
    });

    it('clears subprotocols to undefined', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), subprotocols: 'json' },
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Subprotocols'), { target: { value: '' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({ subprotocols: undefined }),
      }));
    });

    it('uses default timeout when timeoutMs is undefined', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), timeoutMs: undefined },
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Connect timeout')).toHaveValue(10000);
    });

    it('clears connect timeout to undefined when set to zero', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: createDefaultWsConnectAction(),
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Connect timeout'), { target: { value: '0' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({ timeoutMs: undefined }),
      }));
    });

    it('clears query params to undefined when last row removed', () => {
      const draft = makeWsDraft({
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), queryParams: [{ key: 'q', value: '1' }] },
      });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.click(screen.getAllByText('×')[0]);
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsConnectAction: expect.objectContaining({ queryParams: undefined }),
      }));
    });

    it('uses default wsSend config when undefined', () => {
      const draft = makeWsDraft({ actionType: 'wsSend' });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Message body')).toBeInTheDocument();
    });

    it('clears connection ref from send dropdown', () => {
      const connectTest = makeWsDraft({
        id: 'conn-1',
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), connectionId: 'chat' },
      });
      const sendDraft = makeWsDraft({
        id: 'send-1',
        actionType: 'wsSend',
        wsSendAction: { ...createDefaultWsSendAction(), connectionRef: 'chat' },
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[connectTest, sendDraft]} />);
      selectOption(screen.getByLabelText('Connection reference').closest('.cs-wrapper')!, '— select a connection —');
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsSendAction: expect.objectContaining({ connectionRef: undefined }),
      }));
    });

    it('clears manual send connection ref', () => {
      const sendDraft = makeWsDraft({
        actionType: 'wsSend',
        wsSendAction: { ...createDefaultWsSendAction(), connectionRef: 'old' },
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Manual connection reference'), { target: { value: '' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsSendAction: expect.objectContaining({ connectionRef: undefined }),
      }));
    });

    it('uses default messageType text when undefined', () => {
      const sendDraft = makeWsDraft({
        actionType: 'wsSend',
        wsSendAction: { ...createDefaultWsSendAction(), messageType: undefined },
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(getCustomSelectValue(screen.getByLabelText('Message type').closest('.cs-wrapper')!)).toBe('Text');
    });

    it('unchecks wait-for-response', () => {
      const sendDraft = makeWsDraft({
        actionType: 'wsSend',
        wsSendAction: { ...createDefaultWsSendAction(), waitForResponse: true },
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.click(screen.getByRole('checkbox'));
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsSendAction: expect.objectContaining({ waitForResponse: false }),
      }));
    });

    it('uses default response timeout when undefined', () => {
      const sendDraft = makeWsDraft({
        actionType: 'wsSend',
        wsSendAction: { ...createDefaultWsSendAction(), waitForResponse: true, responseTimeoutMs: undefined },
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Response timeout')).toHaveValue(5000);
    });

    it('clears response timeout to undefined when zero', () => {
      const sendDraft = makeWsDraft({
        actionType: 'wsSend',
        wsSendAction: { ...createDefaultWsSendAction(), waitForResponse: true },
      });
      render(<WsScenarioEditor draft={sendDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Response timeout'), { target: { value: '0' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsSendAction: expect.objectContaining({ responseTimeoutMs: undefined }),
      }));
    });

    it('uses default wsReceive config when undefined', () => {
      const draft = makeWsDraft({ actionType: 'wsReceive' });
      render(<WsScenarioEditor draft={draft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Receive timeout')).toHaveValue(10000);
    });

    it('clears receive connection ref from dropdown', () => {
      const connectTest = makeWsDraft({
        id: 'conn-1',
        actionType: 'wsConnect',
        wsConnectAction: { ...createDefaultWsConnectAction(), connectionId: 'chat' },
      });
      const receiveDraft = makeWsDraft({
        id: 'recv-1',
        actionType: 'wsReceive',
        wsReceiveAction: { ...createDefaultWsReceiveAction(), connectionRef: 'chat' },
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[connectTest, receiveDraft]} />);
      selectOption(screen.getByLabelText('Connection reference').closest('.cs-wrapper')!, '— select a connection —');
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({ connectionRef: undefined }),
      }));
    });

    it('uses default receive timeout when undefined', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: { ...createDefaultWsReceiveAction(), timeoutMs: undefined },
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      expect(screen.getByLabelText('Receive timeout')).toHaveValue(10000);
    });

    it('clears receive timeout to undefined when zero', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: createDefaultWsReceiveAction(),
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      fireEvent.change(screen.getByLabelText('Receive timeout'), { target: { value: '0' } });
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({ timeoutMs: undefined }),
      }));
    });

    it('updates frame type to binary', () => {
      const receiveDraft = makeWsDraft({
        actionType: 'wsReceive',
        wsReceiveAction: createDefaultWsReceiveAction(),
      });
      render(<WsScenarioEditor draft={receiveDraft} onDraftChange={mockOnDraftChange} resolvedBaseUrl="" siblingTests={[]} />);
      selectOption(screen.getByLabelText('Frame type filter').closest('.cs-wrapper')!, 'Binary');
      expect(mockOnDraftChange).toHaveBeenCalledWith(expect.objectContaining({
        wsReceiveAction: expect.objectContaining({
          matchCriteria: expect.objectContaining({ messageType: 'binary' }),
        }),
      }));
    });
  });
});
