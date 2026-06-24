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

    it('auto-expands ancestor rows so nested selections are visible', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.selectPaths(['user.id', 'user.name', 'user.email']));
      expect(result.current.state.expandedPaths.has('user')).toBe(true);
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

    it('clears fieldAliases and fieldDirectives on reset', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.selectPaths(['user.id']));
      act(() => result.current.setFieldAlias('user.id', 'userId'));
      act(() => result.current.setFieldDirective('user.id', 'include', true, '{{show}}'));
      expect(result.current.aliasCount).toBe(1);
      expect(result.current.directiveCount).toBe(1);
      act(() => result.current.reset());
      expect(result.current.state.fieldAliases).toEqual({});
      expect(result.current.state.fieldDirectives).toEqual({});
      expect(result.current.aliasCount).toBe(0);
      expect(result.current.directiveCount).toBe(0);
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

  describe('setFieldAlias', () => {
    it('sets an alias for a field path', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldAlias('user', 'me'));
      expect(result.current.state.fieldAliases['user']).toBe('me');
    });
    it('removes alias when set to empty string', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldAlias('user', 'me'));
      act(() => result.current.setFieldAlias('user', ''));
      expect(result.current.state.fieldAliases['user']).toBeUndefined();
    });
    it('removes alias when set to whitespace-only string', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldAlias('user', 'me'));
      act(() => result.current.setFieldAlias('user', '   '));
      expect(result.current.state.fieldAliases['user']).toBeUndefined();
    });
    it('trims whitespace from alias value', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldAlias('user', '  me  '));
      expect(result.current.state.fieldAliases['user']).toBe('me');
    });
    it('counts aliasCount for non-empty aliases', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldAlias('user', 'me'));
      act(() => result.current.setFieldAlias('products', 'items'));
      expect(result.current.aliasCount).toBe(2);
    });
    it('resets aliases on RESET', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldAlias('user', 'me'));
      act(() => result.current.reset());
      expect(result.current.state.fieldAliases).toEqual({});
    });
    it('clears aliases when operation type is changed', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.selectPaths(['user.id']));
      act(() => result.current.setFieldAlias('user', 'me'));
      act(() => result.current.setOperationType('mutation'));
      expect(result.current.state.fieldAliases).toEqual({});
      expect(result.current.state.fieldDirectives).toEqual({});
    });
  });

  describe('setFieldDirective', () => {
    it('sets @include directive on a field', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldDirective('user.orders', 'include', true, '{{showOrders}}'));
      expect(result.current.state.fieldDirectives['user.orders']?.include).toEqual({
        enabled: true,
        ifVar: '{{showOrders}}',
      });
    });
    it('sets @skip directive on a field', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldDirective('user', 'skip', true, '$adminOnly'));
      expect(result.current.state.fieldDirectives['user']?.skip).toEqual({
        enabled: true,
        ifVar: '$adminOnly',
      });
    });
    it('can have both @include and @skip on same field', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldDirective('user', 'include', true, '{{show}}'));
      act(() => result.current.setFieldDirective('user', 'skip', false, '{{hide}}'));
      expect(result.current.state.fieldDirectives['user']?.include?.enabled).toBe(true);
      expect(result.current.state.fieldDirectives['user']?.skip?.enabled).toBe(false);
    });
    it('counts directiveCount for enabled directives only', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldDirective('user', 'include', true, '{{show}}'));
      act(() => result.current.setFieldDirective('products', 'skip', false, '{{hide}}'));
      expect(result.current.directiveCount).toBe(1); // only user.include is enabled
    });
    it('resets directives on RESET', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldDirective('user', 'include', true, '{{show}}'));
      act(() => result.current.reset());
      expect(result.current.state.fieldDirectives).toEqual({});
    });
  });

  describe('removeFieldDirective', () => {
    it('removes a specific directive from a field', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldDirective('user', 'include', true, '{{show}}'));
      act(() => result.current.setFieldDirective('user', 'skip', true, '{{hide}}'));
      act(() => result.current.removeFieldDirective('user', 'include'));
      expect(result.current.state.fieldDirectives['user']?.include).toBeUndefined();
      expect(result.current.state.fieldDirectives['user']?.skip).toBeDefined();
    });
    it('removes the field entry entirely when all directives removed', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      act(() => result.current.setFieldDirective('user', 'include', true, '{{show}}'));
      act(() => result.current.removeFieldDirective('user', 'include'));
      expect(result.current.state.fieldDirectives['user']).toBeUndefined();
    });

    it('keeps state unchanged when removing a directive from a missing path', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      const before = result.current.state;
      act(() => result.current.removeFieldDirective('missing.path', 'include'));
      expect(result.current.state).toBe(before);
    });
  });

  describe('fragments and spreads', () => {
    it('adds, updates, and removes a fragment', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());

      act(() => result.current.addFragment({
        name: 'UserFields',
        onType: 'User',
        fieldPaths: ['id', 'name'],
      }));
      expect(result.current.fragmentCount).toBe(1);
      expect(result.current.state.fragments.UserFields?.onType).toBe('User');

      act(() => result.current.updateFragment('UserFields', { fieldPaths: ['id', 'email'] }));
      expect(result.current.state.fragments.UserFields?.fieldPaths).toEqual(['id', 'email']);

      act(() => result.current.removeFragment('UserFields'));
      expect(result.current.fragmentCount).toBe(0);
      expect(result.current.state.fragments.UserFields).toBeUndefined();
    });

    it('ignores updateFragment for missing fragment names', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());
      const before = result.current.state;
      act(() => result.current.updateFragment('MissingFrag', { onType: 'Order' }));
      expect(result.current.state).toBe(before);
    });

    it('toggles spread membership and removes spread when fragment is deleted', () => {
      const { result } = renderHook(() => useGraphqlQueryBuilder());

      act(() => result.current.addFragment({
        name: 'OrderFields',
        onType: 'Order',
        fieldPaths: ['id'],
      }));
      act(() => result.current.toggleSpread('OrderFields'));
      expect(result.current.state.activeFragmentSpreads).toEqual(['OrderFields']);

      act(() => result.current.toggleSpread('OrderFields'));
      expect(result.current.state.activeFragmentSpreads).toEqual([]);

      act(() => result.current.toggleSpread('OrderFields'));
      expect(result.current.state.activeFragmentSpreads).toEqual(['OrderFields']);
      act(() => result.current.removeFragment('OrderFields'));
      expect(result.current.state.activeFragmentSpreads).toEqual([]);
    });
  });

  describe('persistence options', () => {
    it('restores initialState on mount', () => {
      const { result } = renderHook(() =>
        useGraphqlQueryBuilder({
          initialState: {
            operationType: 'query',
            operationName: 'SavedQuery',
            selectedFields: { health: true, 'user.id': true },
            argValues: { user: { id: 'usr-1' } },
            expandedPaths: new Set<string>(),
            searchQuery: '',
            fieldAliases: { 'user.id': 'userId' },
            fieldDirectives: { 'user.id': { include: { enabled: true, ifVar: 'true' } } },
            fragments: {},
            activeFragmentSpreads: [],
          },
        }),
      );
      expect(result.current.state.operationName).toBe('SavedQuery');
      expect(result.current.state.selectedFields).toEqual({ health: true, 'user.id': true });
      expect(result.current.state.fieldAliases['user.id']).toBe('userId');
      expect(result.current.state.fieldDirectives['user.id']?.include?.enabled).toBe(true);
      expect(result.current.selectedCount).toBe(2);
      expect(result.current.state.expandedPaths.has('user')).toBe(true);
    });

    it('calls onStateChange when selections change', () => {
      const changes: Array<Record<string, boolean>> = [];
      const { result } = renderHook(() =>
        useGraphqlQueryBuilder({
          onStateChange: (state) => changes.push({ ...state.selectedFields }),
        }),
      );
      act(() => result.current.toggleField('health'));
      expect(changes.some((fields) => fields.health === true)).toBe(true);
    });
  });
});
