/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SharedTlsConfigPanel } from './SharedTlsConfigPanel';

describe('SharedTlsConfigPanel', () => {
  it('renders fields, badges, and forwards changes', () => {
    const onChange = vi.fn();
    render(
      <SharedTlsConfigPanel
        values={{ skipVerify: false, caCert: 'pem', clientCert: 'cert', clientKey: 'key' }}
        onChange={onChange}
        testIdPrefix="tls"
      />,
    );

    expect(screen.getByTestId('tls-panel')).toBeInTheDocument();
    expect(screen.getAllByText('Set')).toHaveLength(3);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith({ skipVerify: true });
  });

  it('clears optional PEM fields to undefined', () => {
    const onChange = vi.fn();
    render(
      <SharedTlsConfigPanel
        values={{ skipVerify: false, caCert: 'pem', clientCert: 'cert', clientKey: 'key' }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId('tls-ca-cert'), { target: { value: 'next-pem' } });
    fireEvent.change(screen.getByTestId('tls-ca-cert'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('tls-client-cert'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('tls-client-key'), { target: { value: '' } });

    expect(onChange).toHaveBeenCalledWith({ caCert: 'next-pem' });
    expect(onChange).toHaveBeenCalledWith({ caCert: undefined });
    expect(onChange).toHaveBeenCalledWith({ clientCert: undefined });
    expect(onChange).toHaveBeenCalledWith({ clientKey: undefined });
  });

  it('sets PEM fields to string values', () => {
    const onChange = vi.fn();
    render(
      <SharedTlsConfigPanel
        values={{ skipVerify: false, caCert: '', clientCert: '', clientKey: '' }}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByTestId('tls-ca-cert'), { target: { value: 'ca-pem' } });
    fireEvent.change(screen.getByTestId('tls-client-cert'), { target: { value: 'cert-pem' } });
    fireEvent.change(screen.getByTestId('tls-client-key'), { target: { value: 'key-pem' } });

    expect(onChange).toHaveBeenCalledWith({ caCert: 'ca-pem' });
    expect(onChange).toHaveBeenCalledWith({ clientCert: 'cert-pem' });
    expect(onChange).toHaveBeenCalledWith({ clientKey: 'key-pem' });
  });

  it('handles omitted optional PEM values', () => {
    render(
      <SharedTlsConfigPanel
        values={{ skipVerify: false }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('tls-ca-cert')).toHaveValue('');
    expect(screen.queryByTestId('tls-proxy-notice')).toBeNull();
  });

  it('renders optional slots and disabled state', () => {
    render(
      <SharedTlsConfigPanel
        values={{ skipVerify: true, caCert: '', clientCert: '', clientKey: '' }}
        onChange={vi.fn()}
        disabled
        testIdPrefix="gql-tls"
        headerSlot={<div data-testid="tls-header-slot">mode</div>}
        noticeSlot="Proxy notice"
      />,
    );

    expect(screen.getByTestId('tls-header-slot')).toBeInTheDocument();
    expect(screen.getByTestId('gql-tls-proxy-notice')).toHaveTextContent('Proxy notice');
    expect(screen.getByLabelText('Warning: insecure')).toBeInTheDocument();
    expect(screen.getByTestId('gql-tls-ca-cert')).toBeDisabled();
  });
});
