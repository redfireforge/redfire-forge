/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import {
  selectOption,
  selectOptionByTestId,
  selectOptionByIndex,
  getCustomSelectOptionLabels,
  isCustomSelectDisabled,
  getCustomSelectValue,
} from './customSelectHelper';

describe('customSelectHelper', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  function createCustomSelectHTML(testId?: string, disabled = false) {
    const wrapper = document.createElement('div');
    wrapper.className = 'cs-wrapper';
    if (testId) wrapper.setAttribute('data-testid', testId);

    const trigger = document.createElement('button');
    trigger.className = 'cs-trigger';
    trigger.textContent = 'Select';
    trigger.disabled = disabled;
    wrapper.appendChild(trigger);

    const text = document.createElement('span');
    text.className = 'cs-text';
    text.textContent = 'Current';
    trigger.appendChild(text);

    const menu = document.createElement('div');
    menu.className = 'cs-menu';
    wrapper.appendChild(menu);

    return { wrapper, trigger, menu };
  }

  function addOption(menu: HTMLElement, label: string, value?: string) {
    const item = document.createElement('div');
    item.className = 'cs-item';
    if (value) item.setAttribute('data-value', value);
    const itemLabel = document.createElement('span');
    itemLabel.className = 'cs-item-label';
    itemLabel.textContent = label;
    item.appendChild(itemLabel);
    menu.appendChild(item);
    return item;
  }

  describe('selectOption', () => {
    it('opens dropdown and selects option by label', () => {
      const { wrapper, menu } = createCustomSelectHTML();
      addOption(menu, 'Option 1');
      addOption(menu, 'Option 2');
      document.body.appendChild(wrapper);

      const clickSpy = vi.spyOn(fireEvent, 'click');

      selectOption(wrapper, 'Option 1');

      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    it('throws when no trigger found', () => {
      const container = document.createElement('div');
      expect(() => selectOption(container, 'Option')).toThrow();
    });

    it('throws when option not found', () => {
      const { wrapper, menu } = createCustomSelectHTML();
      addOption(menu, 'Option 1');
      document.body.appendChild(wrapper);

      expect(() => selectOption(wrapper, 'NonExistent')).toThrow();
    });

    it('partial matches option text', () => {
      const { wrapper, menu } = createCustomSelectHTML();
      addOption(menu, 'Long Option Name');
      document.body.appendChild(wrapper);

      const clickSpy = vi.spyOn(fireEvent, 'click');
      selectOption(wrapper, 'Option');
      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });
  });

  describe('selectOptionByTestId', () => {
    it('finds element by data-testid and selects option', () => {
      const { wrapper, menu } = createCustomSelectHTML('my-select');
      addOption(menu, 'Option 1');
      document.body.appendChild(wrapper);

      const clickSpy = vi.spyOn(fireEvent, 'click');
      selectOptionByTestId('my-select', 'Option 1');
      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    it('throws when testId not found', () => {
      expect(() => selectOptionByTestId('nonexistent', 'Option')).toThrow();
    });
  });

  describe('selectOptionByIndex', () => {
    it('selects option from Nth select by index', () => {
      const container = document.createElement('div');
      const { wrapper: wrapper1, menu: menu1 } = createCustomSelectHTML();
      const { wrapper: wrapper2, menu: menu2 } = createCustomSelectHTML();
      
      addOption(menu1, 'Option 1');
      addOption(menu2, 'Option 2');
      
      container.appendChild(wrapper1);
      container.appendChild(wrapper2);
      document.body.appendChild(container);

      const clickSpy = vi.spyOn(fireEvent, 'click');
      selectOptionByIndex(container, 1, 'Option 2');
      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    it('throws when index out of bounds', () => {
      const { wrapper, menu } = createCustomSelectHTML();
      addOption(menu, 'Option 1');
      document.body.appendChild(wrapper);

      expect(() => selectOptionByIndex(wrapper, 5, 'Option')).toThrow();
    });
  });

  describe('getCustomSelectOptionLabels', () => {
    it('returns option labels', () => {
      const { wrapper, menu } = createCustomSelectHTML();
      addOption(menu, 'Option 1');
      addOption(menu, 'Option 2');
      addOption(menu, 'Option 3');
      document.body.appendChild(wrapper);

      const labels = getCustomSelectOptionLabels(wrapper);
      expect(labels).toEqual(['Option 1', 'Option 2', 'Option 3']);
    });

    it('returns empty array when no cs-wrapper found', () => {
      const container = document.createElement('div');
      expect(getCustomSelectOptionLabels(container)).toEqual([]);
    });

    it('returns empty array when specified index is out of bounds', () => {
      const { wrapper, menu } = createCustomSelectHTML();
      addOption(menu, 'Option 1');
      document.body.appendChild(wrapper);

      expect(getCustomSelectOptionLabels(document, 5)).toEqual([]);
    });
  });

  describe('isCustomSelectDisabled', () => {
    it('returns true when trigger is disabled', () => {
      const { wrapper } = createCustomSelectHTML(undefined, true);
      document.body.appendChild(wrapper);

      expect(isCustomSelectDisabled(wrapper)).toBe(true);
    });

    it('returns false when trigger is not disabled', () => {
      const { wrapper } = createCustomSelectHTML(undefined, false);
      document.body.appendChild(wrapper);

      expect(isCustomSelectDisabled(wrapper)).toBe(false);
    });

    it('returns false when no trigger found', () => {
      const container = document.createElement('div');
      expect(isCustomSelectDisabled(container)).toBe(false);
    });
  });

  describe('getCustomSelectValue', () => {
    it('returns current select value text', () => {
      const { wrapper } = createCustomSelectHTML();
      const text = wrapper.querySelector('.cs-text');
      if (text) text.textContent = 'Bearer Token';
      document.body.appendChild(wrapper);

      expect(getCustomSelectValue(wrapper)).toBe('Bearer Token');
    });

    it('returns empty string when no cs-text found', () => {
      const { wrapper } = createCustomSelectHTML();
      const text = wrapper.querySelector('.cs-text');
      if (text) text.remove();
      document.body.appendChild(wrapper);

      expect(getCustomSelectValue(wrapper)).toBe('');
    });

    it('returns empty string for invalid index', () => {
      const { wrapper } = createCustomSelectHTML();
      document.body.appendChild(wrapper);

      expect(getCustomSelectValue(document, 99)).toBe('');
    });
  });
});
