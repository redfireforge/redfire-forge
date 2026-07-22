/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ScriptTemplateGallery from './ScriptTemplateGallery';
import { scriptTemplates } from '../../engine/scriptTemplates';

describe('ScriptTemplateGallery', () => {
  const onSelect = vi.fn();
  const onClose = vi.fn();

  it('renders the gallery with all templates by default', () => {
    render(<ScriptTemplateGallery onSelect={onSelect} onClose={onClose} />);
    expect(screen.getByText('Code Templates')).toBeTruthy();
    // Should show all templates
    for (const t of scriptTemplates) {
      expect(screen.getByText(t.name)).toBeTruthy();
    }
  });

  it('renders category tabs', () => {
    render(<ScriptTemplateGallery onSelect={onSelect} onClose={onClose} />);
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Transform')).toBeTruthy();
    expect(screen.getByText('Validate')).toBeTruthy();
    expect(screen.getByText('Generate')).toBeTruthy();
    expect(screen.getByText('Utility')).toBeTruthy();
  });

  it('filters templates by category', () => {
    render(<ScriptTemplateGallery onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByText('Validate'));
    // Only validate templates should be visible
    const validateTemplates = scriptTemplates.filter(t => t.category === 'validate');
    const otherTemplates = scriptTemplates.filter(t => t.category !== 'validate');
    for (const t of validateTemplates) {
      expect(screen.getByText(t.name)).toBeTruthy();
    }
    for (const t of otherTemplates) {
      expect(screen.queryByText(t.name)).toBeNull();
    }
  });

  it('filters templates by search text', () => {
    render(<ScriptTemplateGallery onSelect={onSelect} onClose={onClose} />);
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'CSV' } });
    expect(screen.getByText('CSV to JSON')).toBeTruthy();
    // Other templates should not be visible
    expect(screen.queryByText('Parse JSON Response')).toBeNull();
  });

  it('shows empty message when no templates match', () => {
    render(<ScriptTemplateGallery onSelect={onSelect} onClose={onClose} />);
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'zzzznonexistentzzzz' } });
    expect(screen.getByText('No templates match your search.')).toBeTruthy();
  });

  it('calls onSelect when a template card is clicked', () => {
    render(<ScriptTemplateGallery onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByText('Parse JSON Response'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'parse-json-response' }),
    );
  });

  it('calls onClose when close button is clicked', () => {
    render(<ScriptTemplateGallery onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows template metadata (category and variable counts)', () => {
    render(<ScriptTemplateGallery onSelect={onSelect} onClose={onClose} />);
    // Each template card should show variable counts
    const varCounts = screen.getAllByText(/\d+ in → \d+ out/);
    expect(varCounts.length).toBe(scriptTemplates.length);
  });

  it('search is case-insensitive', () => {
    render(<ScriptTemplateGallery onSelect={onSelect} onClose={onClose} />);
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'csv' } });
    expect(screen.getByText('CSV to JSON')).toBeTruthy();
  });

  it('search matches description text', () => {
    render(<ScriptTemplateGallery onSelect={onSelect} onClose={onClose} />);
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'regular expression' } });
    expect(screen.getByText('Regex Extract')).toBeTruthy();
  });

  it('combines search and category filter', () => {
    render(<ScriptTemplateGallery onSelect={onSelect} onClose={onClose} />);
    fireEvent.click(screen.getByText('Generate'));
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'random' } });
    expect(screen.getByText('Generate Random User')).toBeTruthy();
    expect(screen.queryByText('CSV to JSON')).toBeNull();
  });
});
