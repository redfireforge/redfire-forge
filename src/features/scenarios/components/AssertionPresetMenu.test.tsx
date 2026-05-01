/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AssertionPresetMenu from './AssertionPresetMenu';
import { assertionPresetCatalog } from '../../../data/galleries/assertion-presets';

describe('AssertionPresetMenu', () => {
  it('renders the Presets button', () => {
    render(<AssertionPresetMenu onImport={() => {}} />);
    expect(screen.getByText(/Presets/)).toBeDefined();
  });

  it('opens popover on click', () => {
    render(<AssertionPresetMenu onImport={() => {}} />);
    fireEvent.click(screen.getByText(/Presets/));
    expect(screen.getByText('Assertion Presets')).toBeDefined();
    expect(screen.getByText('Import a ready-made assertion set')).toBeDefined();
  });

  it('shows all category tabs', () => {
    render(<AssertionPresetMenu onImport={() => {}} />);
    fireEvent.click(screen.getByText(/Presets/));
    expect(screen.getByText('All')).toBeDefined();
    expect(screen.getByText('API Validation')).toBeDefined();
    expect(screen.getByText('Data Quality')).toBeDefined();
    expect(screen.getByText('Security')).toBeDefined();
  });

  it('shows all 5 preset cards in All tab', () => {
    render(<AssertionPresetMenu onImport={() => {}} />);
    fireEvent.click(screen.getByText(/Presets/));
    for (const entry of assertionPresetCatalog) {
      expect(screen.getByText(entry.name)).toBeDefined();
    }
  });

  it('filters by category when tab clicked', () => {
    render(<AssertionPresetMenu onImport={() => {}} />);
    fireEvent.click(screen.getByText(/Presets/));
    fireEvent.click(screen.getByText('Security'));
    // Token Expiry is the only security preset
    expect(screen.getByText('Token Expiry Guard')).toBeDefined();
    // API Health Check is api-validation, should not be visible
    expect(screen.queryByText('API Health Check')).toBeNull();
  });

  it('filters Data Quality category', () => {
    render(<AssertionPresetMenu onImport={() => {}} />);
    fireEvent.click(screen.getByText(/Presets/));
    fireEvent.click(screen.getByText('Data Quality'));
    expect(screen.getByText('E-commerce Price Guard')).toBeDefined();
    expect(screen.queryByText('Token Expiry Guard')).toBeNull();
  });

  it('calls onImport with factory output when preset clicked', () => {
    const onImport = vi.fn();
    render(<AssertionPresetMenu onImport={onImport} />);
    fireEvent.click(screen.getByText(/Presets/));
    fireEvent.click(screen.getByText('API Health Check'));
    expect(onImport).toHaveBeenCalledTimes(1);
    const imported = onImport.mock.calls[0][0];
    expect(imported).toHaveLength(2);
    expect(imported[0].type).toBe('status');
    expect(imported[1].type).toBe('arrayLength');
  });

  it('closes menu after selecting a preset', () => {
    render(<AssertionPresetMenu onImport={() => {}} />);
    fireEvent.click(screen.getByText(/Presets/));
    expect(screen.getByText('Assertion Presets')).toBeDefined();
    fireEvent.click(screen.getByText('API Health Check'));
    expect(screen.queryByText('Assertion Presets')).toBeNull();
  });

  it('closes menu on click outside', () => {
    render(<div data-testid="outside"><AssertionPresetMenu onImport={() => {}} /></div>);
    fireEvent.click(screen.getByText(/Presets/));
    expect(screen.getByText('Assertion Presets')).toBeDefined();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('Assertion Presets')).toBeNull();
  });

  it('toggles menu open/closed on repeated button clicks', () => {
    render(<AssertionPresetMenu onImport={() => {}} />);
    const btn = screen.getByText(/Presets/);
    fireEvent.click(btn);
    expect(screen.getByText('Assertion Presets')).toBeDefined();
    fireEvent.click(btn);
    expect(screen.queryByText('Assertion Presets')).toBeNull();
  });

  it('shows difficulty badges on cards', () => {
    render(<AssertionPresetMenu onImport={() => {}} />);
    fireEvent.click(screen.getByText(/Presets/));
    // All difficulties should be shown
    expect(screen.getAllByText('easy').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('medium').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('advanced').length).toBeGreaterThanOrEqual(1);
  });

  it('shows assertion count on cards', () => {
    render(<AssertionPresetMenu onImport={() => {}} />);
    fireEvent.click(screen.getByText(/Presets/));
    expect(screen.getByText('2 assertions')).toBeDefined();
    expect(screen.getAllByText('3 assertions').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('5 assertions')).toBeDefined();
  });

  it('shows assertion types on cards', () => {
    render(<AssertionPresetMenu onImport={() => {}} />);
    fireEvent.click(screen.getByText(/Presets/));
    expect(screen.getByText('status, arrayLength')).toBeDefined();
    expect(screen.getByText('regex, date, numeric')).toBeDefined();
  });
});
