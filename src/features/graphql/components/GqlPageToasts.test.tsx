/**
 * @vitest-environment jsdom
 *
 * GqlPageToasts — unit tests.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GqlPageToasts } from './GqlPageToasts';
import type { GraphqlSchemaSnapshot } from '../../../shared/types/graphql';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<GraphqlSchemaSnapshot> = {}): GraphqlSchemaSnapshot {
  return {
    id: 'snap-1',
    name: 'Snapshot 1',
    sdl: 'type Query { hello: String }',
    createdAt: Date.now(),
    endpoint: 'https://api.example.com/graphql',
    ...overrides,
  };
}

function defaultProps() {
  return {
    schemaDiffToast: false,
    snapshots: [],
    toastBaselineSnapshotId: null,
    schemaInfo: null,
    onViewDiff: vi.fn(),
    onSaveSnapshot: vi.fn(),
    onDismissSchemaDiff: vi.fn(),
    apqUnsupportedToast: false,
    onDismissApq: vi.fn(),
    batchUnsupportedToast: false,
    onDismissBatch: vi.fn(),
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GqlPageToasts — no toasts', () => {
  it('renders nothing when all toasts are false', () => {
    const { container } = render(<GqlPageToasts {...defaultProps()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('GqlPageToasts — schema diff toast', () => {
  it('renders schema change toast when schemaDiffToast=true', () => {
    render(<GqlPageToasts {...defaultProps()} schemaDiffToast={true} />);
    expect(screen.getByTestId('gql-schema-change-toast')).not.toBeNull();
    expect(screen.getByText('Schema changed')).not.toBeNull();
  });

  it('shows "Save snapshot →" when no baseline snapshot is found', () => {
    render(
      <GqlPageToasts
        {...defaultProps()}
        schemaDiffToast={true}
        snapshots={[makeSnapshot({ id: 'snap-1' })]}
        toastBaselineSnapshotId={null}
      />,
    );
    expect(screen.getByText('Save snapshot →')).not.toBeNull();
  });

  it('calls onDismissSchemaDiff and onSaveSnapshot when "Save snapshot" is clicked', () => {
    const props = defaultProps();
    render(
      <GqlPageToasts
        {...props}
        schemaDiffToast={true}
        toastBaselineSnapshotId={null}
      />,
    );
    fireEvent.click(screen.getByText('Save snapshot →'));
    expect(props.onDismissSchemaDiff).toHaveBeenCalled();
    expect(props.onSaveSnapshot).toHaveBeenCalled();
  });

  it('shows "View diff →" when baseline snapshot is found', () => {
    const snapshot = makeSnapshot({ id: 'snap-1' });
    render(
      <GqlPageToasts
        {...defaultProps()}
        schemaDiffToast={true}
        snapshots={[snapshot]}
        toastBaselineSnapshotId="snap-1"
        schemaInfo={{ sdl: 'type Query { hello: String }', types: [], queryType: 'Query', mutationType: null, subscriptionType: null }}
      />,
    );
    expect(screen.getByText('View diff →')).not.toBeNull();
  });

  it('calls onDismissSchemaDiff and onViewDiff when "View diff" is clicked', () => {
    const snapshot = makeSnapshot({ id: 'snap-1' });
    const props = defaultProps();
    render(
      <GqlPageToasts
        {...props}
        schemaDiffToast={true}
        snapshots={[snapshot]}
        toastBaselineSnapshotId="snap-1"
        schemaInfo={{ sdl: 'type Query { hello: String }', types: [], queryType: 'Query', mutationType: null, subscriptionType: null }}
      />,
    );
    fireEvent.click(screen.getByText('View diff →'));
    expect(props.onDismissSchemaDiff).toHaveBeenCalled();
    expect(props.onViewDiff).toHaveBeenCalledWith(snapshot);
  });

  it('does NOT call onViewDiff when schemaInfo.sdl is empty', () => {
    const snapshot = makeSnapshot({ id: 'snap-1' });
    const props = defaultProps();
    render(
      <GqlPageToasts
        {...props}
        schemaDiffToast={true}
        snapshots={[snapshot]}
        toastBaselineSnapshotId="snap-1"
        schemaInfo={{ sdl: '', types: [], queryType: 'Query', mutationType: null, subscriptionType: null }}
      />,
    );
    fireEvent.click(screen.getByText('View diff →'));
    expect(props.onViewDiff).not.toHaveBeenCalled();
  });

  it('calls onDismissSchemaDiff when dismiss (✕) is clicked', () => {
    const props = defaultProps();
    render(<GqlPageToasts {...props} schemaDiffToast={true} />);
    fireEvent.click(screen.getByLabelText('Dismiss schema change notification'));
    expect(props.onDismissSchemaDiff).toHaveBeenCalled();
  });
});

describe('GqlPageToasts — APQ unsupported toast', () => {
  it('renders APQ toast when apqUnsupportedToast=true', () => {
    render(<GqlPageToasts {...defaultProps()} apqUnsupportedToast={true} />);
    expect(screen.getByTestId('gql-apq-unsupported-toast')).not.toBeNull();
    expect(screen.getByText(/does not support APQ/)).not.toBeNull();
  });

  it('calls onDismissApq when dismiss is clicked', () => {
    const props = defaultProps();
    render(<GqlPageToasts {...props} apqUnsupportedToast={true} />);
    fireEvent.click(screen.getByLabelText('Dismiss APQ unsupported notification'));
    expect(props.onDismissApq).toHaveBeenCalled();
  });

  it('does not render APQ toast when apqUnsupportedToast=false', () => {
    render(<GqlPageToasts {...defaultProps()} />);
    expect(screen.queryByTestId('gql-apq-unsupported-toast')).toBeNull();
  });
});

describe('GqlPageToasts — batch unsupported toast', () => {
  it('renders batch toast when batchUnsupportedToast=true', () => {
    render(<GqlPageToasts {...defaultProps()} batchUnsupportedToast={true} />);
    expect(screen.getByTestId('gql-batch-unsupported-toast')).not.toBeNull();
    expect(screen.getByText(/does not support query batching/)).not.toBeNull();
  });

  it('calls onDismissBatch when dismiss is clicked', () => {
    const props = defaultProps();
    render(<GqlPageToasts {...props} batchUnsupportedToast={true} />);
    fireEvent.click(screen.getByLabelText('Dismiss batch unsupported notification'));
    expect(props.onDismissBatch).toHaveBeenCalled();
  });

  it('renders multiple toasts simultaneously', () => {
    render(
      <GqlPageToasts
        {...defaultProps()}
        schemaDiffToast={true}
        apqUnsupportedToast={true}
        batchUnsupportedToast={true}
      />,
    );
    expect(screen.getByTestId('gql-schema-change-toast')).not.toBeNull();
    expect(screen.getByTestId('gql-apq-unsupported-toast')).not.toBeNull();
    expect(screen.getByTestId('gql-batch-unsupported-toast')).not.toBeNull();
  });
});
