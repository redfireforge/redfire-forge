// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';
import ThemeCustomizer from './ThemeCustomizer';
import { persistSavedThemes, type SavedCustomTheme } from './themeCustomizerUtils';

function setup(currentTheme = 'dark') {
  const onClose = vi.fn();
  const onApply = vi.fn();
  const utils = render(
    <ThemeCustomizer currentTheme={currentTheme} onClose={onClose} onApply={onApply} />,
  );
  return { ...utils, onClose, onApply };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('style');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  localStorage.clear();
});

describe('ThemeCustomizer — base rendering', () => {
  it('renders with a non-custom base theme and no saved list', () => {
    const { container } = setup('light');
    expect(container.querySelector('.tc-panel')).toBeTruthy();
    expect(container.querySelector('.tc-section-label')?.textContent).toBe('Base Theme');
    expect((container.querySelector('.tc-base-select') as HTMLSelectElement).value).toBe('light');
    expect(screen.queryByText('My Themes')).toBeNull();
  });

  it('treats the literal "custom" theme as a dark base', () => {
    const { container } = setup('custom');
    expect((container.querySelector('.tc-base-select') as HTMLSelectElement).value).toBe('dark');
  });

  it('loads an existing saved custom theme for editing', () => {
    const saved: SavedCustomTheme = {
      id: 'abc',
      name: 'Sunset',
      base: 'steel',
      overrides: { '--bg': '#102030' },
      contrast: 10,
    };
    persistSavedThemes([saved]);
    const { container } = setup('custom:abc');
    expect(screen.getByText('My Themes')).toBeTruthy();
    expect((container.querySelector('.tc-base-select') as HTMLSelectElement).value).toBe('steel');
    expect((container.querySelector('.tc-name-input') as HTMLInputElement).value).toBe('Sunset');
    // editing → "+ New" button is visible
    expect(screen.getByTitle('Save as new theme')).toBeTruthy();
  });
});

describe('ThemeCustomizer — color editing', () => {
  it('applies a color override via onChange and resets it', () => {
    const { container } = setup('dark');
    const firstInput = container.querySelector('.tc-color-input') as HTMLInputElement;
    fireEvent.change(firstInput, { target: { value: '#ff0000' } });
    const row = container.querySelector('.tc-color-row');
    expect(row?.className).toContain('modified');
    expect(within(row as HTMLElement).getByText('#ff0000')).toBeTruthy();
    // reset button now visible
    const resetBtn = container.querySelector('.tc-color-reset') as HTMLButtonElement;
    fireEvent.click(resetBtn);
    expect(container.querySelector('.tc-color-row')?.className).not.toContain('modified');
  });

  it('debounces picker input and commits the value after the timeout', () => {
    vi.useFakeTimers();
    const { container } = setup('dark');
    const firstInput = container.querySelector('.tc-color-input') as HTMLInputElement;
    // two rapid inputs exercise the clearTimeout branch
    fireEvent.input(firstInput, { target: { value: '#111111' } });
    fireEvent.input(firstInput, { target: { value: '#222222' } });
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#222222');
    act(() => { vi.advanceTimersByTime(40); });
    // committed as an override → row marked modified
    expect(container.querySelector('.tc-color-row')?.className).toContain('modified');
  });
});

describe('ThemeCustomizer — base & contrast', () => {
  it('changing the base theme resets overrides', () => {
    const { container } = setup('dark');
    const firstInput = container.querySelector('.tc-color-input') as HTMLInputElement;
    fireEvent.change(firstInput, { target: { value: '#abcdef' } });
    expect(container.querySelector('.tc-color-row.modified')).toBeTruthy();
    const select = container.querySelector('.tc-base-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'frost' } });
    expect(select.value).toBe('frost');
    expect(container.querySelector('.tc-color-row.modified')).toBeNull();
  });

  it('updates the positive contrast label', () => {
    const { container } = setup('dark');
    const slider = container.querySelector('.tc-slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '25' } });
    expect(container.querySelector('.tc-contrast-val')?.textContent).toBe('+25%');
  });

  it('updates the negative contrast label without a plus sign', () => {
    const { container } = setup('dark');
    const slider = container.querySelector('.tc-slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '-15' } });
    expect(container.querySelector('.tc-contrast-val')?.textContent).toBe('-15%');
  });

  it('Reset All clears overrides and contrast', () => {
    const { container } = setup('dark');
    const slider = container.querySelector('.tc-slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '20' } });
    fireEvent.click(screen.getByText('Reset All'));
    expect(container.querySelector('.tc-contrast-val')?.textContent).toBe('0%');
  });
});

describe('ThemeCustomizer — close paths', () => {
  it('closes via the Cancel button', () => {
    const { onClose } = setup('dark');
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes via the ✕ button', () => {
    const { container, onClose } = setup('dark');
    fireEvent.click(container.querySelector('.tc-close') as HTMLButtonElement);
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the overlay backdrop is clicked', () => {
    const { container, onClose } = setup('dark');
    fireEvent.click(container.querySelector('.tc-overlay') as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking inside the panel', () => {
    const { container, onClose } = setup('dark');
    fireEvent.click(container.querySelector('.tc-panel') as HTMLElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('starts a drag from the header without throwing', () => {
    const { container } = setup('dark');
    const header = container.querySelector('.tc-header') as HTMLElement;
    fireEvent.mouseDown(header);
    expect(header).toBeTruthy();
  });
});

describe('ThemeCustomizer — saving', () => {
  it('saves a brand new theme and applies it', () => {
    const { onApply, onClose } = setup('dark');
    fireEvent.click(screen.getByText('Save'));
    expect(onApply).toHaveBeenCalledWith(expect.stringMatching(/^custom:/));
    expect(onClose).toHaveBeenCalled();
  });

  it('updates an existing saved theme in place', () => {
    const saved: SavedCustomTheme = { id: 'abc', name: 'Sunset', base: 'dark', overrides: {}, contrast: 0 };
    persistSavedThemes([saved]);
    const { onApply } = setup('custom:abc');
    fireEvent.click(screen.getByText('Save'));
    expect(onApply).toHaveBeenCalledWith('custom:abc');
  });

  it('saves as new when the editing id no longer exists', () => {
    // editingId derived from currentTheme but not present in saved list
    const { onApply } = setup('custom:ghost');
    fireEvent.click(screen.getByText('Save'));
    expect(onApply).toHaveBeenCalledWith(expect.stringMatching(/^custom:/));
    expect(onApply).not.toHaveBeenCalledWith('custom:ghost');
  });
});

describe('ThemeCustomizer — saved theme management', () => {
  function seed() {
    const a: SavedCustomTheme = { id: 'a', name: 'Alpha', base: 'dark', overrides: { '--bg': '#010101' }, contrast: 0 };
    const b: SavedCustomTheme = { id: 'b', name: 'Beta', base: 'light', overrides: {}, contrast: 5 };
    persistSavedThemes([a, b]);
  }

  it('loads a saved theme when its row is clicked', () => {
    seed();
    const { container } = setup('dark');
    fireEvent.click(screen.getByText('Beta'));
    expect((container.querySelector('.tc-base-select') as HTMLSelectElement).value).toBe('light');
    expect((container.querySelector('.tc-name-input') as HTMLInputElement).value).toBe('Beta');
  });

  it('deletes a saved theme via its delete button', () => {
    seed();
    setup('dark');
    const deletes = screen.getAllByTitle('Delete theme');
    fireEvent.click(deletes[0]);
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('clears the editing state when deleting the active theme', () => {
    seed();
    const { container } = setup('custom:a');
    expect((container.querySelector('.tc-name-input') as HTMLInputElement).value).toBe('Alpha');
    const activeRow = container.querySelector('.tc-saved-item.active') as HTMLElement;
    fireEvent.click(within(activeRow).getByTitle('Delete theme'));
    expect((container.querySelector('.tc-name-input') as HTMLInputElement).value).toBe('My Theme');
    // "+ New" disappears because editing was cleared
    expect(screen.queryByTitle('Save as new theme')).toBeNull();
  });

  it('switches to a new-theme copy via the + New button', () => {
    const saved: SavedCustomTheme = { id: 'abc', name: 'Sunset', base: 'dark', overrides: {}, contrast: 0 };
    persistSavedThemes([saved]);
    const { container } = setup('custom:abc');
    fireEvent.click(screen.getByTitle('Save as new theme'));
    expect((container.querySelector('.tc-name-input') as HTMLInputElement).value).toBe('Sunset Copy');
    expect(screen.queryByTitle('Save as new theme')).toBeNull();
  });

  it('edits the theme name input', () => {
    const { container } = setup('dark');
    const nameInput = container.querySelector('.tc-name-input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Cool Theme' } });
    expect(nameInput.value).toBe('Cool Theme');
  });
});
