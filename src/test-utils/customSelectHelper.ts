import { fireEvent } from '@testing-library/react';

/**
 * Interact with a CustomSelect component in tests.
 *
 * Usage:
 *   selectOption(container, 'Bearer Token');           // find by displayed label
 *   selectOption(container, 'bearer', 'value');        // find by option value attr
 *   selectOptionByTestId('my-select', 'Bearer Token'); // find wrapper by data-testid
 *
 * Works by clicking the .cs-trigger to open the dropdown,
 * then clicking the matching .cs-item.
 */

/**
 * Open a CustomSelect dropdown within a container and click the matching option.
 * @param container - DOM element containing the CustomSelect (e.g. a form row or the result.container)
 * @param match - Text to match against the option label (default) or value attribute
 * @param matchBy - 'label' matches against .cs-item-label text content; 'value' matches against data attribute
 */
export function selectOption(
  container: Element | Document,
  match: string,
  matchBy: 'label' | 'value' = 'label',
): void {
  const trigger = container.querySelector('.cs-trigger');
  if (!trigger) throw new Error(`selectOption: no .cs-trigger found in container`);
  fireEvent.click(trigger);

  const wrapper = trigger.closest('.cs-wrapper') ?? container;
  const items = Array.from(wrapper.querySelectorAll<HTMLElement>('.cs-item'));

  let target: HTMLElement | undefined;
  if (matchBy === 'label') {
    const labelText = (el: HTMLElement) => (el.querySelector('.cs-item-label') ?? el).textContent ?? '';
    target = items.find(el => labelText(el) === match)
      ?? items.find(el => labelText(el).includes(match));
  } else {
    target = items.find(el => el.getAttribute('aria-selected') !== null && el.textContent?.includes(match));
  }

  if (!target) {
    const available = items.map(el => (el.querySelector('.cs-item-label') ?? el).textContent).join(', ');
    throw new Error(`selectOption: no option matching "${match}" (by ${matchBy}). Available: ${available}`);
  }
  fireEvent.click(target);
}

/**
 * Find a CustomSelect by data-testid, open it, and click the matching option.
 */
export function selectOptionByTestId(testId: string, match: string): void {
  const wrapper = document.querySelector(`[data-testid="${testId}"]`);
  if (!wrapper) throw new Error(`selectOptionByTestId: no element with data-testid="${testId}"`);
  selectOption(wrapper, match);
}

/**
 * Find the Nth CustomSelect inside a container (0-based) and select an option.
 */
export function selectOptionByIndex(container: Element | Document, index: number, match: string): void {
  const wrappers = container.querySelectorAll('.cs-wrapper');
  if (index >= wrappers.length) {
    throw new Error(`selectOptionByIndex: only ${wrappers.length} .cs-wrapper found, requested index ${index}`);
  }
  selectOption(wrappers[index], match);
}

/**
 * Get the currently displayed text of a CustomSelect trigger.
 */
/** Open dropdown and return visible option labels (closes menu after read). */
export function getCustomSelectOptionLabels(container: Element | Document, index = 0): string[] {
  const wrappers = container instanceof Element && container.classList.contains('cs-wrapper')
    ? [container]
    : Array.from(container.querySelectorAll('.cs-wrapper'));
  const wrapper = wrappers[index];
  if (!wrapper) return [];
  const trigger = wrapper.querySelector('.cs-trigger');
  if (!trigger) return [];
  fireEvent.click(trigger);
  const labels = Array.from(wrapper.querySelectorAll('.cs-item-label')).map(el => el.textContent ?? '');
  fireEvent.click(trigger);
  return labels;
}

/** Whether the CustomSelect trigger button is disabled. */
export function isCustomSelectDisabled(container: Element): boolean {
  const trigger = container.querySelector('.cs-trigger') as HTMLButtonElement | null;
  return trigger?.disabled ?? false;
}

export function getCustomSelectValue(container: Element | Document, index = 0): string {
  if (container instanceof Element && container.classList.contains('cs-wrapper')) {
    if (index === 0) {
      return container.querySelector('.cs-text')?.textContent ?? '';
    }
    const parent = container.parentElement;
    if (parent) {
      const wrappers = parent.querySelectorAll('.cs-wrapper');
      const wrapper = wrappers[index];
      return wrapper?.querySelector('.cs-text')?.textContent ?? '';
    }
  }

  const wrappers = container.querySelectorAll('.cs-wrapper');
  const wrapper = wrappers[index];
  if (!wrapper) return '';
  return wrapper.querySelector('.cs-text')?.textContent ?? '';
}
