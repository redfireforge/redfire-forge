/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ValidationContractPanel from './ValidationContractPanel';
import type { DataSource } from '../../../shared/types';

const createMockDataSource = (arrayValidationMode?: Record<string, 'ordered' | 'unordered'>): DataSource => ({
  columns: [],
  rows: [],
  source: { type: 'inline' },
  arrayValidationMode,
});

describe('ValidationContractPanel', () => {
  const defaultProps = {
    dataSource: createMockDataSource(),
    contractPatterns: [] as { pattern: string; count: number; isDynamic: boolean }[],
    toggleContractPattern: vi.fn(),
    removeContractPattern: vi.fn(),
    toggleArrayMode: vi.fn(),
  };

  it('renders header', () => {
    render(<ValidationContractPanel {...defaultProps} />);
    expect(screen.getByText('Validation Contract')).toBeInTheDocument();
  });

  it('shows empty state when no patterns', () => {
    render(<ValidationContractPanel {...defaultProps} />);
    expect(screen.getByText(/No array validate columns found/)).toBeInTheDocument();
  });

  it('renders contract patterns', () => {
    render(
      <ValidationContractPanel
        {...defaultProps}
        contractPatterns={[
          { pattern: 'offers[*].code', count: 3, isDynamic: true },
          { pattern: 'items[*].name', count: 2, isDynamic: false },
        ]}
      />
    );
    expect(screen.getByText('offers[*].code')).toBeInTheDocument();
    expect(screen.getByText('items[*].name')).toBeInTheDocument();
    expect(screen.getByText('3 cols')).toBeInTheDocument();
    expect(screen.getByText('2 cols')).toBeInTheDocument();
  });

  it('shows dynamic badge for dynamic patterns', () => {
    render(
      <ValidationContractPanel
        {...defaultProps}
        contractPatterns={[{ pattern: 'offers[*].code', count: 3, isDynamic: true }]}
      />
    );
    expect(screen.getByText('⚡ dynamic')).toBeInTheDocument();
  });

  it('shows fixed badge for fixed patterns', () => {
    render(
      <ValidationContractPanel
        {...defaultProps}
        contractPatterns={[{ pattern: 'items[*].name', count: 2, isDynamic: false }]}
      />
    );
    expect(screen.getByText('📌 fixed')).toBeInTheDocument();
  });

  it('calls toggleContractPattern when mode button clicked', () => {
    const toggleContractPattern = vi.fn();
    render(
      <ValidationContractPanel
        {...defaultProps}
        toggleContractPattern={toggleContractPattern}
        contractPatterns={[{ pattern: 'offers[*].code', count: 3, isDynamic: true }]}
      />
    );
    fireEvent.click(screen.getByText('⚡ dynamic'));
    expect(toggleContractPattern).toHaveBeenCalledWith('offers[*].code', false);
  });

  it('calls toggleContractPattern to make dynamic', () => {
    const toggleContractPattern = vi.fn();
    render(
      <ValidationContractPanel
        {...defaultProps}
        toggleContractPattern={toggleContractPattern}
        contractPatterns={[{ pattern: 'items[*].name', count: 2, isDynamic: false }]}
      />
    );
    fireEvent.click(screen.getByText('📌 fixed'));
    expect(toggleContractPattern).toHaveBeenCalledWith('items[*].name', true);
  });

  it('calls removeContractPattern when × clicked', () => {
    const removeContractPattern = vi.fn();
    render(
      <ValidationContractPanel
        {...defaultProps}
        removeContractPattern={removeContractPattern}
        contractPatterns={[{ pattern: 'offers[*].code', count: 1, isDynamic: true }]}
      />
    );
    fireEvent.click(screen.getByText('×'));
    expect(removeContractPattern).toHaveBeenCalledWith('offers[*].code');
  });

  it('shows ordered/unordered toggle for array prefixes', () => {
    render(
      <ValidationContractPanel
        {...defaultProps}
        contractPatterns={[{ pattern: 'offers[*].code', count: 3, isDynamic: true }]}
      />
    );
    expect(screen.getByText('↕ ordered')).toBeInTheDocument();
  });

  it('shows unordered when array mode is unordered', () => {
    render(
      <ValidationContractPanel
        {...defaultProps}
        dataSource={createMockDataSource({ 'offers[*]': 'unordered' })}
        contractPatterns={[{ pattern: 'offers[*].code', count: 3, isDynamic: true }]}
      />
    );
    expect(screen.getByText('⟳ unordered')).toBeInTheDocument();
  });

  it('calls toggleArrayMode when array mode button clicked', () => {
    const toggleArrayMode = vi.fn();
    render(
      <ValidationContractPanel
        {...defaultProps}
        toggleArrayMode={toggleArrayMode}
        contractPatterns={[{ pattern: 'offers[*].code', count: 3, isDynamic: true }]}
      />
    );
    fireEvent.click(screen.getByText('↕ ordered'));
    expect(toggleArrayMode).toHaveBeenCalledWith('offers[*]');
  });

  it('shows singular col text for count 1', () => {
    render(
      <ValidationContractPanel
        {...defaultProps}
        contractPatterns={[{ pattern: 'items[*].id', count: 1, isDynamic: false }]}
      />
    );
    expect(screen.getByText('1 col')).toBeInTheDocument();
  });

  it('renders hint text', () => {
    render(<ValidationContractPanel {...defaultProps} />);
    expect(screen.getByText(/Dynamic fields auto-expand/)).toBeInTheDocument();
  });
});
