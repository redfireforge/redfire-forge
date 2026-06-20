/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WebSocketMessageLog } from './WebSocketMessageLog';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    scrollToIndex: vi.fn(),
  }),
}));

function defaultProps() {
  return {
    messages: [],
    totalCount: 0,
    maxMessages: 1000,
    isMaxReached: false,
    searchText: '',
    setSearchText: vi.fn(),
    searchMode: 'text' as const,
    setSearchMode: vi.fn(),
    directionFilter: 'all' as const,
    setDirectionFilter: vi.fn(),
    sizeFilter: 'all' as const,
    setSizeFilter: vi.fn(),
    timeFilter: 'all' as const,
    setTimeFilter: vi.fn(),
    contentTypeFilter: 'all' as const,
    setContentTypeFilter: vi.fn(),
    onClear: vi.fn(),
    onSend: vi.fn(),
    isConnected: true,
    templates: [],
    onSaveTemplate: vi.fn().mockResolvedValue(undefined),
    onDeleteTemplate: vi.fn().mockResolvedValue(undefined),
    onLoadTemplate: vi.fn().mockReturnValue(null),
  };
}

describe('WebSocketMessageLog', () => {
  it('renders empty state when there are no messages', () => {
    render(<WebSocketMessageLog {...defaultProps()} />);
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('No Messages Yet')).toBeTruthy();
  });

  it('shows connect hint when disconnected and log is empty', () => {
    render(<WebSocketMessageLog {...defaultProps()} isConnected={false} />);
    expect(screen.getByText(/Connect to a WebSocket endpoint/i)).toBeTruthy();
  });
});
