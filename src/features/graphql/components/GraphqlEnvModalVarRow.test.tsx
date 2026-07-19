/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GraphqlEnvModalVarRow } from './GraphqlEnvModalVarRow';

describe('GraphqlEnvModalVarRow', () => {
  it('renders masked row, toggles visibility, and emits patches', () => {
    const onChange = vi.fn();
    const onRemove = vi.fn();

    render(
      <GraphqlEnvModalVarRow
        variable={{ _id: 'v1', key: 'token', value: 'secret', enabled: true, masked: true }}
        onChange={onChange}
        onRemove={onRemove}
      />,
    );

    const valueInput = screen.getByLabelText('Variable value (secret)') as HTMLInputElement;
    expect(valueInput.type).toBe('password');

    fireEvent.click(screen.getByLabelText('Show value'));
    expect((screen.getByLabelText('Variable value (secret)') as HTMLInputElement).type).toBe('text');

    fireEvent.click(screen.getByLabelText('Hide value'));
    expect((screen.getByLabelText('Variable value (secret)') as HTMLInputElement).type).toBe('password');

    fireEvent.change(screen.getByLabelText('Variable key'), { target: { value: 'apiKey' } });
    fireEvent.change(screen.getByLabelText('Variable value (secret)'), { target: { value: 'updated' } });
    fireEvent.click(screen.getByLabelText('Enable variable token'));
    fireEvent.click(screen.getByLabelText('Show value in plain text (still editable)'));
    fireEvent.click(screen.getByLabelText('Remove variable token'));

    expect(onChange).toHaveBeenCalledWith({ key: 'apiKey' });
    expect(onChange).toHaveBeenCalledWith({ value: 'updated' });
    expect(onChange).toHaveBeenCalledWith({ enabled: false });
    expect(onChange).toHaveBeenCalledWith({ masked: false });
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders unmasked input and supports enabling secret mode', () => {
    const onChange = vi.fn();

    render(
      <GraphqlEnvModalVarRow
        variable={{ _id: 'v2', key: '', value: '', enabled: false, masked: false }}
        onChange={onChange}
        onRemove={() => {}}
      />,
    );

    const plainValue = screen.getByLabelText('Variable value') as HTMLInputElement;
    expect(plainValue.type).toBe('text');

    fireEvent.change(plainValue, { target: { value: 'plain' } });
    fireEvent.click(screen.getByLabelText('Hide value as secret (mask with dots)'));

    expect(onChange).toHaveBeenCalledWith({ value: 'plain' });
    expect(onChange).toHaveBeenCalledWith({ masked: true });
  });
});
