/**
 * @vitest-environment jsdom
 * GqlBottomPanel.test.tsx — unit tests for the Variables/Headers bottom panel.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GqlBottomPanel } from './GqlBottomPanel';
import type { GraphqlHeaderRow } from '../../../shared/types/graphql';

vi.mock('../utils/monacoGraphqlSetup', () => ({
  buildModelUri: (id: string) => `inmemory://graphql/${id}`,
  buildVarsModelUri: (id: string) => `inmemory://graphql/vars/${id}`,
  extractOperations: vi.fn(() => []),
  deriveTabLabel: vi.fn(() => 'Untitled'),
  deriveOperationType: vi.fn(() => undefined),
  registerGraphqlLanguage: vi.fn(),
  getOrInitGraphqlMode: vi.fn(),
}));

// GraphqlVariablesPanel uses Monaco editor — mock it so DOM tests don't load Monaco.
vi.mock('./GraphqlVariablesPanel', () => ({
  GraphqlVariablesPanel: ({ onChange, defaultValue }: { onChange: (v: string) => void; defaultValue: string }) => (
    <textarea
      data-testid="gql-vars-editor"
      defaultValue={defaultValue}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

function makeHeader(id: string): GraphqlHeaderRow {
  return { id, key: 'X-Custom', value: 'test', enabled: true };
}

describe('GqlBottomPanel', () => {
  const baseProps = {
    activeTab: 'variables' as const,
    onTabChange: vi.fn(),
    varsModelPath: 'inmemory://graphql/vars/t1',
    defaultVarsValue: '{\n  \n}',
    onVariablesChange: vi.fn(),
    varsError: null,
    headers: [],
    onHeadersChange: vi.fn(),
    fileEntries: [],
    onFileEntriesChange: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders Variables tab as active', () => {
    render(<GqlBottomPanel {...baseProps} />);
    const tab = screen.getByTestId('gql-bottom-tab-variables');
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });

  it('renders Headers tab as inactive by default', () => {
    render(<GqlBottomPanel {...baseProps} />);
    expect(screen.getByTestId('gql-bottom-tab-headers').getAttribute('aria-selected')).toBe('false');
  });

  it('calls onTabChange when Headers tab is clicked', () => {
    render(<GqlBottomPanel {...baseProps} />);
    fireEvent.click(screen.getByTestId('gql-bottom-tab-headers'));
    expect(baseProps.onTabChange).toHaveBeenCalledWith('headers');
  });

  it('calls onTabChange when Variables tab is clicked', () => {
    const props = { ...baseProps, activeTab: 'headers' as const };
    render(<GqlBottomPanel {...props} />);
    fireEvent.click(screen.getByTestId('gql-bottom-tab-variables'));
    expect(props.onTabChange).toHaveBeenCalledWith('variables');
  });

  it('shows Variables editor when activeTab is variables', () => {
    render(<GqlBottomPanel {...baseProps} />);
    expect(screen.getByTestId('gql-vars-editor')).toBeTruthy();
  });

  it('does not show Variables editor when activeTab is headers', () => {
    render(<GqlBottomPanel {...baseProps} activeTab="headers" />);
    expect(screen.queryByTestId('gql-vars-editor')).toBeNull();
  });

  it('shows GraphqlHeadersPanel when activeTab is headers', () => {
    render(<GqlBottomPanel {...baseProps} activeTab="headers" />);
    expect(screen.getByTestId('gql-headers-panel')).toBeTruthy();
  });

  it('shows error banner when varsError is set', () => {
    render(<GqlBottomPanel {...baseProps} varsError="Invalid JSON" />);
    expect(screen.getByTestId('gql-vars-error-banner')).toBeTruthy();
  });

  it('does not show error banner when varsError is null', () => {
    render(<GqlBottomPanel {...baseProps} />);
    expect(screen.queryByTestId('gql-vars-error-banner')).toBeNull();
  });

  it('shows error dot on Variables tab when varsError is set', () => {
    render(<GqlBottomPanel {...baseProps} varsError="Bad JSON" />);
    const varsTab = screen.getByTestId('gql-bottom-tab-variables');
    expect(varsTab.querySelector('.gql-bottom-tab-error-dot')).toBeTruthy();
  });

  it('shows active header count badge on Headers tab', () => {
    const headers = [makeHeader('h1'), makeHeader('h2'), { ...makeHeader('h3'), enabled: false }];
    render(<GqlBottomPanel {...baseProps} headers={headers} />);
    const headersTab = screen.getByTestId('gql-bottom-tab-headers');
    expect(headersTab.textContent).toContain('2');
  });

  it('does not show badge when no active headers', () => {
    render(<GqlBottomPanel {...baseProps} headers={[]} />);
    const headersTab = screen.getByTestId('gql-bottom-tab-headers');
    expect(headersTab.querySelector('.gql-bottom-tab-badge')).toBeNull();
  });

  it('calls onVariablesChange when Variables editor fires onChange', () => {
    render(<GqlBottomPanel {...baseProps} />);
    fireEvent.change(screen.getByTestId('gql-vars-editor'), { target: { value: '{"key":"value"}' } });
    expect(baseProps.onVariablesChange).toHaveBeenCalledWith('{"key":"value"}');
  });

  // ── Files tab ───────────────────────────────────────────────────────────

  it('renders Files tab button', () => {
    render(<GqlBottomPanel {...baseProps} />);
    expect(screen.getByTestId('gql-bottom-tab-files')).toBeTruthy();
  });

  it('calls onTabChange with "files" when Files tab clicked', () => {
    render(<GqlBottomPanel {...baseProps} />);
    fireEvent.click(screen.getByTestId('gql-bottom-tab-files'));
    expect(baseProps.onTabChange).toHaveBeenCalledWith('files');
  });

  it('shows file count badge on Files tab when there are valid entries', () => {
    const fileEntries = [
      { id: '1', file: new File([''], 'a.png'), varPath: 'avatar', error: null },
    ];
    render(<GqlBottomPanel {...baseProps} activeTab="files" fileEntries={fileEntries} />);
    const filesTab = screen.getByTestId('gql-bottom-tab-files');
    expect(filesTab.querySelector('.gql-bottom-tab-badge')).toBeTruthy();
  });

  it('shows error dot on Files tab when any entry has error', () => {
    const fileEntries = [
      { id: '1', file: new File([''], 'huge.zip'), varPath: 'f', error: 'Too large' },
    ];
    render(<GqlBottomPanel {...baseProps} fileEntries={fileEntries} />);
    const filesTab = screen.getByTestId('gql-bottom-tab-files');
    expect(filesTab.querySelector('.gql-bottom-tab-error-dot')).toBeTruthy();
  });

  it('renders file upload component when Files tab is active', () => {
    render(<GqlBottomPanel {...baseProps} activeTab="files" />);
    expect(screen.getByTestId('gql-file-upload')).toBeTruthy();
  });

  // ── Sprint 8 (2E-4): upload progress banner ──────────────────────────────
  it('does not render banner when uploadProgress is null', () => {
    render(<GqlBottomPanel {...baseProps} uploadProgress={null} />);
    expect(screen.queryByTestId('gql-files-progress-banner')).not.toBeInTheDocument();
  });

  it('renders progress banner when uploading and Files tab is not active', () => {
    render(<GqlBottomPanel {...baseProps} activeTab="variables" uploadProgress={50} />);
    expect(screen.getByTestId('gql-files-progress-banner')).toBeInTheDocument();
    expect(screen.getByText(/Uploading files… 50%/)).toBeInTheDocument();
  });

  it('does not render banner when Files tab is active (progress shown inside file upload)', () => {
    render(<GqlBottomPanel {...baseProps} activeTab="files" uploadProgress={50} />);
    expect(screen.queryByTestId('gql-files-progress-banner')).not.toBeInTheDocument();
  });

  it('banner shows "Processing upload…" when progress is 98 or more', () => {
    render(<GqlBottomPanel {...baseProps} activeTab="headers" uploadProgress={98} />);
    expect(screen.getByText('Processing upload…')).toBeInTheDocument();
  });

  it('banner has correct ARIA progressbar attributes', () => {
    render(<GqlBottomPanel {...baseProps} activeTab="headers" uploadProgress={75} />);
    const progressbar = screen.getByTestId('gql-files-progress-banner').querySelector('[role="progressbar"]');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    expect(progressbar).toHaveAttribute('aria-valuenow', '75');
  });
});
