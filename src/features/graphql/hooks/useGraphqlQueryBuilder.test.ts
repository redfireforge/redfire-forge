/**
 * useGraphqlQueryBuilder.test.ts — unit tests for the builder state hook (2F-1)
 */
// @vitest-environment jsdom

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGraphqlQueryBuilder } from './useGraphqlQueryBuilder';

describe('useGraphqlQueryBuilder', () => {

  describe('initial state', () => {
    it('starts with query operation type', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      expect(result.current.state.operationType).toBe('query');
    });
    it('starts with MyQuery operation name', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      expect(result.current.state.operationName).toBe('MyQuery');
    });
    it('starts with empty selections', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      expect(result.current.state.selectedFields).toEqual({});
      expect(result.current.selectedCount).toBe(0);
    });
    it('starts with empty expanded paths', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      expect(result.current.state.expandedPaths.size).toBe(0);
    });
    it('starts with empty search query', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      expect(result.current.state.searchQuery).toBe('');
    });
  });

  describe('setOperationType', () => {
    it('changes operation type', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setOperationType('mutation'));
      expect(result.current.state.operationType).toBe('mutation');
    });
    it('resets selected fields when switching op type', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.toggleField('user.id'));
      act(() => result.current.setOperationType('mutation'));
      expect(result.current.state.selectedFields).toEqual({});
    });
    it('auto-updates operation name from MyQuery to MyMutation when switching to mutation', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      expect(result.current.state.operationName).toBe('MyQuery');
      act(() => result.current.setOperationType('mutation'));
      expect(result.current.state.operationName).toBe('MyMutation');
    });
    it('auto-updates operation name from MyMutation to MySubscription when switching to subscription', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setOperationType('mutation'));
      act(() => result.current.setOperationType('subscription'));
      expect(result.current.state.operationName).toBe('MySubscription');
    });
    it('preserves custom operation name when switching op type', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setOperationName('GetUser'));
      act(() => result.current.setOperationType('mutation'));
      // 'GetUser' is not the default name → should be preserved
      expect(result.current.state.operationName).toBe('GetUser');
    });
    it('auto-updates back to MyQuery when switching back to query from mutation', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setOperationType('mutation'));
      act(() => result.current.setOperationType('query'));
      expect(result.current.state.operationName).toBe('MyQuery');
    });
  });

  describe('setOperationName', () => {
    it('updates the operation name', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setOperationName('GetUser'));
      expect(result.current.state.operationName).toBe('GetUser');
    });
  });

  describe('toggleField', () => {
    it('selects an unselected field', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.toggleField('user.id'));
      expect(result.current.state.selectedFields['user.id']).toBe(true);
    });
    it('deselects a selected field', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.toggleField('user.id'));
      act(() => result.current.toggleField('user.id'));
      expect(result.current.state.selectedFields['user.id']).toBeUndefined();
    });
    it('updates selectedCount correctly', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.toggleField('user.id'));
      expect(result.current.selectedCount).toBe(1);
      act(() => result.current.toggleField('user.name'));
      expect(result.current.selectedCount).toBe(2);
      act(() => result.current.toggleField('user.id'));
      expect(result.current.selectedCount).toBe(1);
    });
  });

  describe('selectPaths', () => {
    it('selects multiple paths at once', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.selectPaths(['user.id', 'user.name', 'user.email']));
      expect(result.current.selectedCount).toBe(3);
      expect(result.current.state.selectedFields['user.id']).toBe(true);
      expect(result.current.state.selectedFields['user.name']).toBe(true);
    });
  });

  describe('deselectPaths', () => {
    it('deselects multiple paths at once', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.selectPaths(['user.id', 'user.name', 'user.email']));
      act(() => result.current.deselectPaths(['user.id', 'user.name']));
      expect(result.current.selectedCount).toBe(1);
      expect(result.current.state.selectedFields['user.email']).toBe(true);
      expect(result.current.state.selectedFields['user.id']).toBeUndefined();
    });
  });

  describe('setArgValue', () => {
    it('sets an arg value for a field', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setArgValue('user', 'id', 'abc123'));
      expect(result.current.state.argValues['user']?.['id']).toBe('abc123');
    });
    it('removes arg value when set to empty string', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setArgValue('user', 'id', 'abc123'));
      act(() => result.current.setArgValue('user', 'id', ''));
      expect(result.current.state.argValues['user']).toBeUndefined();
    });
    it('can set multiple args on the same field', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setArgValue('user.orders', 'first', '10'));
      act(() => result.current.setArgValue('user.orders', 'status', 'PLACED'));
      expect(result.current.state.argValues['user.orders']).toEqual({
        first: '10',
        status: 'PLACED',
      });
      expect(result.current.argsCount).toBe(1); // 1 field has args
    });
    it('cleans up field entry when all args removed', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setArgValue('user', 'id', '123'));
      act(() => result.current.setArgValue('user', 'id', ''));
      expect(result.current.state.argValues['user']).toBeUndefined();
    });
  });

  describe('toggleExpand / expandPath / collapsePath', () => {
    it('toggleExpand adds path to expandedPaths', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.toggleExpand('user.orders'));
      expect(result.current.state.expandedPaths.has('user.orders')).toBe(true);
    });
    it('toggleExpand removes path when already expanded', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.toggleExpand('user.orders'));
      act(() => result.current.toggleExpand('user.orders'));
      expect(result.current.state.expandedPaths.has('user.orders')).toBe(false);
    });
    it('expandPath adds to expanded set', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.expandPath('user'));
      expect(result.current.state.expandedPaths.has('user')).toBe(true);
    });
    it('collapsePath removes from expanded set', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.expandPath('user'));
      act(() => result.current.collapsePath('user'));
      expect(result.current.state.expandedPaths.has('user')).toBe(false);
    });
  });

  describe('setSearchQuery', () => {
    it('updates the search query', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setSearchQuery('email'));
      expect(result.current.state.searchQuery).toBe('email');
    });
  });

  describe('reset', () => {
    it('clears selected fields but keeps op type and name', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setOperationType('mutation'));
      act(() => result.current.setOperationName('UpdateUser'));
      act(() => result.current.selectPaths(['user.id', 'user.name']));
      act(() => result.current.setArgValue('user', 'id', '{{userId}}'));
      act(() => result.current.reset());
      expect(result.current.state.operationType).toBe('mutation');
      expect(result.current.state.operationName).toBe('UpdateUser');
      expect(result.current.state.selectedFields).toEqual({});
      expect(result.current.state.argValues).toEqual({});
      expect(result.current.selectedCount).toBe(0);
    });
  });

  describe('derived statistics', () => {
    it('calculates maxDepth from selected paths', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.selectPaths(['user.orders.nodes.id']));
      expect(result.current.maxDepth).toBe(4); // user.orders.nodes.id = 4 segments
    });
    it('calculates variablesCount from arg values with {{var}} patterns', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setArgValue('user', 'id', '{{userId}}'));
      act(() => result.current.setArgValue('user.orders', 'first', '{{pageSize}}'));
      expect(result.current.variablesCount).toBe(2);
    });
    it('does not count literal arg values as variables', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setArgValue('user', 'id', 'literal-value'));
      expect(result.current.variablesCount).toBe(0);
    });
    it('counts $varRef patterns as variables', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setArgValue('user', 'id', '$userId'));
      expect(result.current.variablesCount).toBe(1);
    });
  });
});
