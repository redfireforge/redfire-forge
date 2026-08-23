/**
 * @vitest-environment jsdom
 * FieldTableRow.test.tsx — unit tests for the schema explorer field table row.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldTableRow } from './FieldTableRow';
import type { GraphqlFieldNode } from '@shared/types/graphql';

function makeField(overrides: Partial<GraphqlFieldNode> = {}): GraphqlFieldNode {
  return {
    name: 'email',
    type: 'String!',
    description: 'User email address',
    ...overrides,
  };
}

const defaultProps = {
  navigableTypes: new Set<string>(['User', 'Role']),
  onSelectType: vi.fn(),
};

describe('FieldTableRow', () => {
  beforeEach(() => resetAllMocks());

  it('renders the field name', () => {
    render(
      <table><tbody>
        <FieldTableRow {...defaultProps} field={makeField()} />
      </tbody></table>,
    );
    expect(screen.getByText('email')).toBeTruthy();
  });

  it('renders the field type as plain text when not navigable', () => {
    render(
      <table><tbody>
        <FieldTableRow {...defaultProps} field={makeField({ type: 'String!' })} />
      </tbody></table>,
    );
    expect(screen.getByText('String!')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders a navigate button when type is navigable', () => {
    render(
      <table><tbody>
        <FieldTableRow {...defaultProps} field={makeField({ type: 'User!', name: 'owner' })} />
      </tbody></table>,
    );
    const btn = screen.getByLabelText(/navigate to type User/i);
    expect(btn).toBeTruthy();
  });

  it('calls onSelectType when type navigate button is clicked', () => {
    render(
      <table><tbody>
        <FieldTableRow {...defaultProps} field={makeField({ type: 'User!', name: 'owner' })} />
      </tbody></table>,
    );
    fireEvent.click(screen.getByLabelText(/navigate to type User/i));
    expect(defaultProps.onSelectType).toHaveBeenCalledWith('User');
  });

  it('shows description when present', () => {
    render(
      <table><tbody>
        <FieldTableRow {...defaultProps} field={makeField({ description: 'The user email' })} />
      </tbody></table>,
    );
    expect(screen.getByText('The user email')).toBeTruthy();
  });

  it('shows dash for args when no arguments', () => {
    render(
      <table><tbody>
        <FieldTableRow {...defaultProps} field={makeField()} />
      </tbody></table>,
    );
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders argument list when args are present', () => {
    const field = makeField({
      args: [{ name: 'first', type: 'Int', description: 'Page size' }],
    });
    render(
      <table><tbody>
        <FieldTableRow {...defaultProps} field={field} />
      </tbody></table>,
    );
    expect(screen.getByText('first')).toBeTruthy();
    expect(screen.getByText('Int')).toBeTruthy();
  });

  it('shows default value when arg has defaultValue', () => {
    const field = makeField({
      args: [{ name: 'first', type: 'Int', defaultValue: '10' }],
    });
    render(
      <table><tbody>
        <FieldTableRow {...defaultProps} field={field} />
      </tbody></table>,
    );
    expect(screen.getByText(/= 10/)).toBeTruthy();
  });

  it('shows deprecated tag for deprecated fields', () => {
    const field = makeField({ isDeprecated: true, deprecationReason: 'Use newField instead' });
    render(
      <table><tbody>
        <FieldTableRow {...defaultProps} field={field} />
      </tbody></table>,
    );
    expect(screen.getByText('@deprecated')).toBeTruthy();
  });

  it('applies deprecated CSS class for deprecated fields', () => {
    const field = makeField({ isDeprecated: true });
    render(
      <table><tbody>
        <FieldTableRow {...defaultProps} field={field} />
      </tbody></table>,
    );
    expect(screen.getByTestId('gql-field-row-email').className).toContain('gql-se-ftr--deprecated');
  });

  describe('"Try →" insert button', () => {
    it('does not render a Try button when onInsertField is not provided', () => {
      render(
        <table><tbody>
          <FieldTableRow {...defaultProps} field={makeField()} />
        </tbody></table>,
      );
      expect(screen.queryByTestId('gql-try-field-email')).toBeNull();
    });

    it('renders a Try button when onInsertField is provided', () => {
      const onInsertField = vi.fn();
      render(
        <table><tbody>
          <FieldTableRow {...defaultProps} field={makeField()} onInsertField={onInsertField} />
        </tbody></table>,
      );
      expect(screen.getByTestId('gql-try-field-email')).toBeTruthy();
    });

    it('calls onInsertField with field name, type, and hasArgs=false when clicked', () => {
      const onInsertField = vi.fn();
      render(
        <table><tbody>
          <FieldTableRow {...defaultProps} field={makeField({ name: 'email', type: 'String!' })} onInsertField={onInsertField} />
        </tbody></table>,
      );
      fireEvent.click(screen.getByTestId('gql-try-field-email'));
      expect(onInsertField).toHaveBeenCalledWith('email', 'String!', false);
    });

    it('calls onInsertField with hasArgs=true when field has arguments', () => {
      const onInsertField = vi.fn();
      const field = makeField({
        name: 'user',
        type: 'User!',
        args: [{ name: 'id', type: 'ID!' }],
      });
      render(
        <table><tbody>
          <FieldTableRow {...defaultProps} field={field} onInsertField={onInsertField} />
        </tbody></table>,
      );
      fireEvent.click(screen.getByTestId('gql-try-field-user'));
      expect(onInsertField).toHaveBeenCalledWith('user', 'User!', true);
    });

    it('Try button has correct aria-label', () => {
      const onInsertField = vi.fn();
      render(
        <table><tbody>
          <FieldTableRow {...defaultProps} field={makeField({ name: 'email' })} onInsertField={onInsertField} />
        </tbody></table>,
      );
      const btn = screen.getByTestId('gql-try-field-email');
      expect(btn.getAttribute('aria-label')).toContain('email');
    });
  });
});
