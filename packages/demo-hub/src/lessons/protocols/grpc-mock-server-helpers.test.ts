/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mockBuilderHasDemoBodyPathRules,
  setSelectValue,
} from './grpc-mock-server-helpers';

describe('grpc-mock-server-helpers CustomSelect + demo rule detection', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('setSelectValue drives CustomSelect via custom-select:set-value', () => {
    document.body.innerHTML = `
      <div class="cs-wrapper" data-testid="grpc-mock-builder-leaf-kind-n1" data-value="method_equals"></div>
    `;
    const wrapper = document.querySelector('.cs-wrapper')!;
    const handler = vi.fn();
    wrapper.addEventListener('custom-select:set-value', (event) => {
      handler((event as CustomEvent<{ value: string }>).detail.value);
      wrapper.setAttribute('data-value', (event as CustomEvent<{ value: string }>).detail.value);
    });

    expect(() => {
      setSelectValue('[data-testid="grpc-mock-builder-leaf-kind-n1"]', 'body_path_equals');
    }).not.toThrow();

    expect(handler).toHaveBeenCalledWith('body_path_equals');
    expect(wrapper.getAttribute('data-value')).toBe('body_path_equals');
  });

  it('setSelectValue still updates native <select>', () => {
    document.body.innerHTML = `<select data-testid="native-sel"><option value="a">A</option><option value="b">B</option></select>`;
    setSelectValue('[data-testid="native-sel"]', 'b');
    expect((document.querySelector('[data-testid="native-sel"]') as HTMLSelectElement).value).toBe('b');
  });

  it('mockBuilderHasDemoBodyPathRules requires body_path predicates, not just two cards', () => {
    document.body.innerHTML = `
      <div data-testid="grpc-mock-builder-rule-a">
        <div class="cs-wrapper" data-testid="grpc-mock-builder-leaf-kind-1" data-value="method_equals"></div>
      </div>
      <div data-testid="grpc-mock-builder-rule-b">
        <div class="cs-wrapper" data-testid="grpc-mock-builder-leaf-kind-2" data-value="method_equals"></div>
      </div>
    `;
    expect(mockBuilderHasDemoBodyPathRules()).toBe(false);

    document.querySelector('[data-testid="grpc-mock-builder-leaf-kind-1"]')!
      .setAttribute('data-value', 'body_path_equals');
    document.querySelector('[data-testid="grpc-mock-builder-leaf-kind-2"]')!
      .setAttribute('data-value', 'body_path_exists');
    expect(mockBuilderHasDemoBodyPathRules()).toBe(true);
  });
});
