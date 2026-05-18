/** @vitest-environment jsdom */

import '@testing-library/jest-dom';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PathParamsEditor } from './PathParamsEditor';

afterEach(() => {
  cleanup();
});

describe('PathParamsEditor', () => {
  it('renders rows and propagates immutable updates', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PathParamsEditor
        params={[
          { key: 'id', value: '', description: 'primary', required: true },
          { key: 'slug', value: '' },
        ]}
        onChange={onChange}
      />,
    );

    expect(screen.getByText('PATH PARAMETERS')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText(/^Enter/).length).toBe(2);
    expect(screen.getByText('*')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Enter id'), { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ key: 'id', value: '12' }),
      expect.objectContaining({ key: 'slug', value: '' }),
    ]);

    rerender(<PathParamsEditor params={[]} onChange={() => {}} />);
    expect(screen.queryByText('PATH PARAMETERS')).toBeNull();
  });
});
