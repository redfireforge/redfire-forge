/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import JsonPreview, { buildJTree, nodeMatches, collectMatchNodes, type JNode } from './JsonTreePreview';

// Mock scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('JsonTreePreview', () => {
  describe('buildJTree', () => {
    it('builds tree for null value', () => {
      const tree = buildJTree(null, 'root');
      expect(tree.type).toBe('null');
      expect(tree.value).toBeNull();
    });

    it('builds tree for undefined value', () => {
      const tree = buildJTree(undefined, 'root');
      expect(tree.type).toBe('null');
    });

    it('builds tree for string value', () => {
      const tree = buildJTree('hello', 'greeting');
      expect(tree.type).toBe('string');
      expect(tree.value).toBe('hello');
      expect(tree.key).toBe('greeting');
    });

    it('builds tree for number value', () => {
      const tree = buildJTree(42, 'count');
      expect(tree.type).toBe('number');
      expect(tree.value).toBe(42);
    });

    it('builds tree for boolean value', () => {
      const tree = buildJTree(true, 'active');
      expect(tree.type).toBe('boolean');
      expect(tree.value).toBe(true);
    });

    it('builds tree for array value', () => {
      const tree = buildJTree([1, 2, 3], 'items');
      expect(tree.type).toBe('array');
      expect(tree.children).toHaveLength(3);
      expect(tree.children?.[0].key).toBe('0');
      expect(tree.children?.[0].value).toBe(1);
    });

    it('builds tree for object value', () => {
      const tree = buildJTree({ name: 'Alice', age: 30 }, 'user');
      expect(tree.type).toBe('object');
      expect(tree.children).toHaveLength(2);
      expect(tree.children?.find(c => c.key === 'name')?.value).toBe('Alice');
      expect(tree.children?.find(c => c.key === 'age')?.value).toBe(30);
    });

    it('builds nested tree', () => {
      const data = {
        users: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      };
      const tree = buildJTree(data, '');
      expect(tree.type).toBe('object');
      expect(tree.children?.[0].type).toBe('array');
      expect(tree.children?.[0].children?.[0].type).toBe('object');
    });
  });

  describe('nodeMatches', () => {
    it('returns false for empty search term', () => {
      const node = buildJTree('test', 'key');
      expect(nodeMatches(node, '')).toBe(false);
    });

    it('matches on key', () => {
      const node = buildJTree('value', 'username');
      expect(nodeMatches(node, 'user')).toBe(true);
    });

    it('matches on string value', () => {
      const node = buildJTree('hello world', 'greeting');
      expect(nodeMatches(node, 'world')).toBe(true);
    });

    it('matches on number value', () => {
      const node = buildJTree(12345, 'id');
      expect(nodeMatches(node, '123')).toBe(true);
    });

    it('matches on nested children', () => {
      const node = buildJTree({ nested: { deep: 'findme' } }, 'root');
      expect(nodeMatches(node, 'findme')).toBe(true);
    });

    it('is case insensitive', () => {
      const node = buildJTree('UPPERCASE', 'key');
      expect(nodeMatches(node, 'uppercase')).toBe(true);
    });

    it('does not match object/array values directly', () => {
      const node = buildJTree({ a: 1 }, 'obj');
      expect(nodeMatches(node, '[object')).toBe(false);
    });
  });

  describe('collectMatchNodes', () => {
    it('collects nothing for empty search', () => {
      const node = buildJTree({ a: 1, b: 2 }, '');
      const results: JNode[] = [];
      collectMatchNodes(node, '', results);
      expect(results).toHaveLength(0);
    });

    it('collects matching nodes', () => {
      const node = buildJTree({ userId: 123, userName: 'Alice', email: 'alice@test.com' }, '');
      const results: JNode[] = [];
      collectMatchNodes(node, 'user', results);
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.key === 'userId')).toBe(true);
      expect(results.some(r => r.key === 'userName')).toBe(true);
    });

    it('collects nested matches', () => {
      const node = buildJTree({ level1: { level2: { target: 'found' } } }, '');
      const results: JNode[] = [];
      collectMatchNodes(node, 'found', results);
      expect(results).toHaveLength(1);
      expect(results[0].value).toBe('found');
    });
  });

  describe('JsonPreview component', () => {
    const defaultProps = {
      body: '{"name":"Alice","age":30}',
      collapsedSet: new Set<string>(),
      onToggle: vi.fn(),
    };

    it('renders JSON tree', () => {
      render(<JsonPreview {...defaultProps} />);
      expect(screen.getByText(/"name"/)).toBeInTheDocument();
      expect(screen.getByText(/"Alice"/)).toBeInTheDocument();
    });

    it('renders error message when error prop is provided', () => {
      render(<JsonPreview {...defaultProps} error="Parse error" />);
      expect(screen.getByText('Parse error')).toBeInTheDocument();
    });

    it('renders empty message when body is empty', () => {
      render(<JsonPreview {...defaultProps} body="" />);
      expect(screen.getByText('(empty response)')).toBeInTheDocument();
    });

    it('renders raw body when JSON is invalid', () => {
      render(<JsonPreview {...defaultProps} body="not valid json" />);
      expect(screen.getByText('not valid json')).toBeInTheDocument();
    });

    it('highlights search matches', () => {
      render(<JsonPreview {...defaultProps} search="Alice" />);
      const highlights = document.querySelectorAll('.req-search-highlight');
      expect(highlights.length).toBeGreaterThan(0);
    });

    it('calls onMatchCountChange when matches change', () => {
      const onMatchCountChange = vi.fn();
      render(
        <JsonPreview
          {...defaultProps}
          search="Alice"
          onMatchCountChange={onMatchCountChange}
        />
      );
      expect(onMatchCountChange).toHaveBeenCalledWith(1);
    });

    it('uses prebuilt tree when provided', () => {
      const prebuiltTree = buildJTree({ custom: 'data' }, '');
      const { container } = render(<JsonPreview {...defaultProps} body="" prebuiltTree={prebuiltTree} />);
      // The prebuilt tree should render the tree structure
      expect(container.querySelector('.req-json-preview-wrapper')).toBeInTheDocument();
    });

    it('renders raw body for prebuiltTree=null', () => {
      const { container } = render(<JsonPreview {...defaultProps} body="raw text here" prebuiltTree={null} />);
      expect(container.querySelector('.jt-raw')).toBeInTheDocument();
    });

    it('renders tree structure with toggle buttons', () => {
      const { container } = render(
        <JsonPreview
          body='{"nested":{"inner":"value"}}'
          collapsedSet={new Set<string>()}
          onToggle={vi.fn()}
        />
      );
      const toggles = container.querySelectorAll('.jt-toggle');
      expect(toggles.length).toBeGreaterThan(0);
    });

    it('respects collapsed set in render', () => {
      const collapsedSet = new Set(['/nested']);
      const { container } = render(
        <JsonPreview
          body='{"nested":{"inner":"value"}}'
          collapsedSet={collapsedSet}
          onToggle={vi.fn()}
        />
      );
      // Should render the wrapper
      expect(container.querySelector('.req-json-preview-wrapper')).toBeInTheDocument();
    });

    it('handles deep nesting', () => {
      const deepJson = JSON.stringify({
        l1: { l2: { l3: { l4: { l5: 'deep' } } } },
      });
      render(<JsonPreview {...defaultProps} body={deepJson} />);
      expect(screen.getByText(/"deep"/)).toBeInTheDocument();
    });

    it('handles arrays in JSON', () => {
      const arrayJson = JSON.stringify({ items: [1, 2, 3] });
      render(<JsonPreview {...defaultProps} body={arrayJson} />);
      expect(screen.getByText(/"items"/)).toBeInTheDocument();
    });

    it('handles boolean values', () => {
      const boolJson = JSON.stringify({ active: true, deleted: false });
      render(<JsonPreview {...defaultProps} body={boolJson} />);
      expect(screen.getByText('true')).toBeInTheDocument();
      expect(screen.getByText('false')).toBeInTheDocument();
    });

    it('handles null values', () => {
      const nullJson = JSON.stringify({ value: null });
      render(<JsonPreview {...defaultProps} body={nullJson} />);
      expect(screen.getByText('null')).toBeInTheDocument();
    });
  });
});
