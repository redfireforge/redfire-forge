/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GrpcMessageSchema } from '@shared/grpc/contracts';
import { GrpcProtoHybridNavigator } from './GrpcProtoHybridNavigator';
import { buildHybridNavigatorPaths } from './grpcProtoHybridNavigatorPaths';

const SCHEMA: GrpcMessageSchema = {
  typeName: 'demo.Request',
  fields: [
    { name: 'id', number: 1, type: 'int32', label: 'optional' },
    { name: 'tags', number: 2, type: 'string', label: 'repeated' },
    { name: 'card', number: 3, type: 'string', label: 'optional', isOneofMember: true, oneofName: 'payment' },
    { name: 'cash', number: 4, type: 'string', label: 'optional', isOneofMember: true, oneofName: 'payment' },
  ],
};

describe('GrpcProtoHybridNavigator', () => {
  it('builds field and oneof paths from schema', () => {
    expect(buildHybridNavigatorPaths(SCHEMA)).toEqual(['field:id', 'field:tags', 'oneof:payment']);
  });

  it('renders entries and supports filtering + empty state', () => {
    const onSelectPath = vi.fn();
    render(
      <GrpcProtoHybridNavigator
        schema={SCHEMA}
        selectedPath={null}
        onSelectPath={onSelectPath}
      />,
    );

    expect(screen.getByTestId('grpc-hybrid-navigator-list').textContent).toContain('id');
    expect(screen.getByTestId('grpc-hybrid-navigator-list').textContent).toContain('payment');

    fireEvent.change(screen.getByTestId('grpc-hybrid-navigator-search'), { target: { value: 'payment' } });
    expect(screen.getByTestId('grpc-hybrid-navigator-list').textContent).toContain('payment');

    fireEvent.change(screen.getByTestId('grpc-hybrid-navigator-search'), { target: { value: 'does-not-exist' } });
    expect(screen.getByTestId('grpc-hybrid-navigator-empty').textContent).toContain('No matching fields');
  });

  it('supports keyboard navigation for selection changes', () => {
    const onSelectPath = vi.fn();
    render(
      <GrpcProtoHybridNavigator
        schema={SCHEMA}
        selectedPath="field:id"
        onSelectPath={onSelectPath}
      />,
    );

    const first = screen.getByTestId('grpc-hybrid-nav-item-field-id');
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    fireEvent.keyDown(first, { key: 'End' });
    fireEvent.keyDown(first, { key: 'Home' });
    fireEvent.keyDown(first, { key: 'ArrowUp' });
    fireEvent.keyDown(first, { key: 'Escape' });

    expect(onSelectPath).toHaveBeenCalled();
  });

  it('updates aria-activedescendant when selected path is filtered out', () => {
    render(
      <GrpcProtoHybridNavigator
        schema={SCHEMA}
        selectedPath="field:id"
        onSelectPath={vi.fn()}
      />,
    );

    const list = screen.getByTestId('grpc-hybrid-navigator-list');
    expect(list.getAttribute('aria-activedescendant')).toContain('field-id');

    fireEvent.change(screen.getByTestId('grpc-hybrid-navigator-search'), { target: { value: 'payment' } });
    expect(list.getAttribute('aria-activedescendant')).toBeNull();
  });

  it('disables interactive items when navigator is disabled', () => {
    render(
      <GrpcProtoHybridNavigator
        schema={SCHEMA}
        selectedPath={null}
        disabled
        onSelectPath={vi.fn()}
      />,
    );

    const row = screen.getByTestId('grpc-hybrid-nav-item-field-id') as HTMLButtonElement;
    expect(row.disabled).toBe(true);
  });
});
