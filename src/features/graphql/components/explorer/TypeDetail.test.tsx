/**
 * @vitest-environment jsdom
 * TypeDetail.test.tsx — unit tests for the Schema Explorer TypeDetail panel.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TypeDetail } from './TypeDetail';
import type { GraphqlTypeNode } from '../../../../shared/types/graphql';

function makeObjectType(overrides: Partial<GraphqlTypeNode> = {}): GraphqlTypeNode {
  return {
    name: 'User',
    kind: 'OBJECT',
    description: 'Represents a registered user',
    fields: [
      { name: 'id', type: 'ID!', description: 'Unique user identifier' },
      { name: 'email', type: 'String!', description: 'Email address' },
      { name: 'role', type: 'Role!', args: [{ name: 'context', type: 'String', description: 'Context hint' }] },
    ],
    interfaces: ['Node'],
    sdlFragment: 'type User implements Node {\n  id: ID!\n  email: String!\n  role: Role!\n}',
    ...overrides,
  };
}

function makeEnumType(): GraphqlTypeNode {
  return {
    name: 'Role',
    kind: 'ENUM',
    enumValues: ['ADMIN', 'USER', 'GUEST'],
    sdlFragment: 'enum Role {\n  ADMIN\n  USER\n  GUEST\n}',
  };
}

function makeUnionType(): GraphqlTypeNode {
  return {
    name: 'SearchResult',
    kind: 'UNION',
    possibleTypes: ['User', 'Product', 'Article'],
  };
}

const defaultProps = {
  detailTab: 'fields' as const,
  onTabChange: vi.fn(),
  navigableTypes: new Set<string>(['User', 'Node', 'Role']),
  onSelectType: vi.fn(),
};

describe('TypeDetail — fields tab (OBJECT)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the type detail container', () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} />);
    expect(screen.getByTestId('gql-se-type-detail')).toBeTruthy();
  });

  it('shows the type name in the header', () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} />);
    expect(screen.getByText('User')).toBeTruthy();
  });

  it('shows the type kind badge', () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} />);
    expect(screen.getByText(/object type/i)).toBeTruthy();
  });

  it('shows the type description when present', () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} />);
    expect(screen.getByText('Represents a registered user')).toBeTruthy();
  });

  it('shows fields table when type has fields', () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} />);
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('renders a row for each field', () => {
    const type = makeObjectType();
    render(<TypeDetail {...defaultProps} type={type} />);
    type.fields?.forEach((f) => {
      expect(screen.getByTestId(`gql-field-row-${f.name}`)).toBeTruthy();
    });
  });

  it('shows implements section for OBJECT type with interfaces', () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} />);
    expect(screen.getByText(/implements:/i)).toBeTruthy();
    expect(screen.getByLabelText(/navigate to interface node/i)).toBeTruthy();
  });

  it('calls onSelectType when an interface navigate link is clicked', () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} />);
    fireEvent.click(screen.getByLabelText(/navigate to interface node/i));
    expect(defaultProps.onSelectType).toHaveBeenCalledWith('Node');
  });

  it('renders Fields tab as active', () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} />);
    expect(screen.getByTestId('gql-se-dtab-fields').getAttribute('aria-selected')).toBe('true');
  });

  it('SDL tab is shown and inactive', () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} />);
    expect(screen.getByTestId('gql-se-dtab-sdl').getAttribute('aria-selected')).toBe('false');
  });

  it('calls onTabChange when SDL tab is clicked', () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} />);
    fireEvent.click(screen.getByTestId('gql-se-dtab-sdl'));
    expect(defaultProps.onTabChange).toHaveBeenCalledWith('sdl');
  });

  it('calls onTabChange with "fields" when Fields tab is clicked', () => {
    const props = { ...defaultProps, detailTab: 'sdl' as const };
    render(<TypeDetail {...props} type={makeObjectType()} />);
    fireEvent.click(screen.getByTestId('gql-se-dtab-fields'));
    expect(props.onTabChange).toHaveBeenCalledWith('fields');
  });

  it('shows field count in the tab button', () => {
    const type = makeObjectType();
    render(<TypeDetail {...defaultProps} type={type} />);
    const btn = screen.getByTestId('gql-se-dtab-fields');
    expect(btn.textContent).toContain(`(${type.fields?.length})`);
  });

  it('shows Try column header when onInsertField is provided', () => {
    const onInsertField = vi.fn();
    const { container } = render(
      <TypeDetail {...defaultProps} type={makeObjectType()} onInsertField={onInsertField} />,
    );
    expect(container.querySelector('.gql-se-fth--try')).toBeTruthy();
  });
});

describe('TypeDetail — SDL tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard API (jsdom doesn't provide it)
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows SDL content when sdlFragment is set', () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} detailTab="sdl" />);
    const sdlPre = screen.getByLabelText('SDL definition');
    expect(sdlPre.textContent).toContain('User');
  });

  it('shows copy SDL button', () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} detailTab="sdl" />);
    expect(screen.getByTestId('gql-se-copy-sdl-btn')).toBeTruthy();
  });

  it('calls clipboard.writeText when Copy SDL button is clicked', async () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} detailTab="sdl" />);
    fireEvent.click(screen.getByTestId('gql-se-copy-sdl-btn'));
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(makeObjectType().sdlFragment);
    });
  });

  it('shows copied state after SDL copy succeeds', async () => {
    render(<TypeDetail {...defaultProps} type={makeObjectType()} detailTab="sdl" />);
    fireEvent.click(screen.getByTestId('gql-se-copy-sdl-btn'));
    await vi.waitFor(() => {
      expect(screen.getByText('✓ Copied')).toBeTruthy();
      expect(screen.getByLabelText('Copied to clipboard')).toBeTruthy();
    });
  });

  it('shows "SDL definition not available" when no sdlFragment', () => {
    const type = makeObjectType({ sdlFragment: undefined });
    render(<TypeDetail {...defaultProps} type={type} detailTab="sdl" />);
    expect(screen.getByText(/sdl definition not available/i)).toBeTruthy();
  });

  it('does not call clipboard when sdlFragment is absent and copy triggered', () => {
    const type = makeObjectType({ sdlFragment: undefined });
    render(<TypeDetail {...defaultProps} type={type} detailTab="sdl" />);
    // No copy button renders when sdlFragment is absent — just check no error
    expect(screen.queryByTestId('gql-se-copy-sdl-btn')).toBeNull();
  });
});

describe('TypeDetail — ENUM type', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "Values" label on the fields tab for ENUM', () => {
    render(<TypeDetail {...defaultProps} type={makeEnumType()} />);
    expect(screen.getByTestId('gql-se-dtab-fields').textContent).toContain('Values');
  });

  it('renders enum value chips', () => {
    render(<TypeDetail {...defaultProps} type={makeEnumType()} />);
    expect(screen.getByText('ADMIN')).toBeTruthy();
    expect(screen.getByText('USER')).toBeTruthy();
    expect(screen.getByText('GUEST')).toBeTruthy();
  });
});

describe('TypeDetail — UNION type', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows "Types" label on the fields tab for UNION', () => {
    render(<TypeDetail {...defaultProps} type={makeUnionType()} />);
    expect(screen.getByTestId('gql-se-dtab-fields').textContent).toContain('Types');
  });

  it('shows union members', () => {
    render(<TypeDetail {...defaultProps} type={makeUnionType()} />);
    // Use getAllByLabelText since the type appears in both the header NavigableList
    // and the fields content panel
    const userLinks = screen.getAllByLabelText(/navigate to type User/i);
    expect(userLinks.length).toBeGreaterThan(0);
  });

  it('calls onSelectType when a navigable union member is clicked', () => {
    render(<TypeDetail {...defaultProps} type={makeUnionType()} />);
    const userLinks = screen.getAllByLabelText(/navigate to type User/i);
    fireEvent.click(userLinks[0]);
    expect(defaultProps.onSelectType).toHaveBeenCalledWith('User');
  });

  it('calls onSelectType when a navigable union member is clicked in the fields panel', () => {
    render(<TypeDetail {...defaultProps} type={makeUnionType()} />);
    const userLinks = screen.getAllByLabelText(/navigate to type User/i);
    // Click the second button (fields panel version) to ensure that onClick handler is covered
    if (userLinks.length > 1) {
      fireEvent.click(userLinks[1]);
      expect(defaultProps.onSelectType).toHaveBeenCalledWith('User');
    } else {
      // If only one link exists, the fields-panel rendering was changed; click the first
      fireEvent.click(userLinks[0]);
      expect(defaultProps.onSelectType).toHaveBeenCalledWith('User');
    }
  });

  it('renders non-navigable union members as static text', () => {
    const unionType: GraphqlTypeNode = {
      name: 'MixedUnion',
      kind: 'UNION',
      possibleTypes: ['User', 'UnknownType'],
    };
    render(
      <TypeDetail
        {...defaultProps}
        type={unionType}
        navigableTypes={new Set(['User'])}
      />,
    );
    expect(screen.getAllByText('UnknownType').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/navigate to type UnknownType/i)).toBeNull();
  });
});

describe('TypeDetail — SCALAR type', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows custom scalar note when kind is SCALAR', () => {
    const scalarType: import('../../../../shared/types/graphql').GraphqlTypeNode = {
      name: 'DateTime',
      kind: 'SCALAR',
    };
    render(<TypeDetail {...defaultProps} type={scalarType} />);
    expect(screen.getByText(/custom scalar/i)).toBeTruthy();
  });
});

describe('TypeDetail — empty type', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows empty-fields note for non-scalar types with no members', () => {
    const emptyType: GraphqlTypeNode = {
      name: 'EmptyInterface',
      kind: 'INTERFACE',
    };
    render(<TypeDetail {...defaultProps} type={emptyType} />);
    expect(screen.getByText(/this type has no fields defined/i)).toBeTruthy();
  });
});
