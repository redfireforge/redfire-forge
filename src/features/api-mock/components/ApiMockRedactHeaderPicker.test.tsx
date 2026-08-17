/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DEFAULT_SETTINGS } from '../../../shared/api-mock/defaults';
import { defaultRedactHeaderList } from '../../../shared/api-mock/redactHeaderCatalog';
import { ApiMockRedactHeaderPicker, redactHeaderChipTestId } from './ApiMockRedactHeaderPicker';

describe('ApiMockRedactHeaderPicker', () => {
  it('marks shipped defaults as selected and toggles a common header into the list', () => {
    const onChange = vi.fn();
    render(<ApiMockRedactHeaderPicker value={defaultRedactHeaderList()} onChange={onChange} />);

    expect(screen.getByTestId(redactHeaderChipTestId('authorization'))).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(redactHeaderChipTestId('x-csrf-token'))).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Shipped defaults')).toBeInTheDocument();
    expect(screen.getByText('Also common')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(redactHeaderChipTestId('x-csrf-token')));
    expect(onChange).toHaveBeenCalledWith(`${defaultRedactHeaderList()}, x-csrf-token`);
  });

  it('removes a selected header and restores the shipped default list', () => {
    const onChange = vi.fn();
    render(<ApiMockRedactHeaderPicker value="authorization, x-custom" onChange={onChange} />);

    fireEvent.click(screen.getByTestId(redactHeaderChipTestId('authorization')));
    expect(onChange).toHaveBeenCalledWith('x-custom');

    fireEvent.click(screen.getByTestId('api-mock-redact-headers-restore'));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_SETTINGS.redaction.headerNames.join(', '));
  });
});
