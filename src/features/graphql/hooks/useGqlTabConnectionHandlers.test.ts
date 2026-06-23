/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGqlTabConnectionHandlers } from './useGqlTabConnectionHandlers';

describe('useGqlTabConnectionHandlers', () => {
  const base = {
    tabsLength: 1,
    hasActiveTabEndpointOverride: false,
    hasActiveTabProfileLink: false,
    hasActiveTabAuthOverride: false,
    hasActiveTabConnectionId: false,
    hasActiveTabSkipTlsOverride: false,
    hasActiveTabTlsCertOverride: false,
    hasActiveTabPollingOverride: false,
    setEndpoint: vi.fn(),
    updateActiveTabEndpoint: vi.fn(),
    handleSkipTlsVerifyChange: vi.fn(),
    handleTlsCertsChange: vi.fn(),
    updateActiveTabSkipTlsVerify: vi.fn(),
    updateActiveTabTlsSettings: vi.fn(),
    handlePollingChange: vi.fn(),
    updateActiveTabPolling: vi.fn(),
    handleAuthChange: vi.fn(),
    updateActiveTabAuth: vi.fn(),
  };

  it('routes endpoint change to page default for single inheriting tab (Phase 6 PT-6)', () => {
    const setEndpoint = vi.fn();
    const updateActiveTabEndpoint = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      setEndpoint,
      updateActiveTabEndpoint,
    }));

    act(() => { result.current.handleConnectionEndpointChange('  https://new.example.com  '); });
    expect(setEndpoint).toHaveBeenCalledWith('https://new.example.com');
    expect(updateActiveTabEndpoint).not.toHaveBeenCalled();
  });

  it('routes endpoint change to tab override for multi-tab session', () => {
    const setEndpoint = vi.fn();
    const updateActiveTabEndpoint = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      tabsLength: 2,
      setEndpoint,
      updateActiveTabEndpoint,
    }));

    act(() => { result.current.handleConnectionEndpointChange('https://staging.example.com'); });
    expect(updateActiveTabEndpoint).toHaveBeenCalledWith('https://staging.example.com');
    expect(setEndpoint).not.toHaveBeenCalled();
  });

  it('routes endpoint change to tab override when single tab already has override', () => {
    const updateActiveTabEndpoint = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      hasActiveTabEndpointOverride: true,
      updateActiveTabEndpoint,
    }));

    act(() => { result.current.handleConnectionEndpointChange('https://staging.example.com'); });
    expect(updateActiveTabEndpoint).toHaveBeenCalledWith('https://staging.example.com');
  });

  it('routes endpoint change to tab override when single tab is profile-linked (Phase 6F)', () => {
    const updateActiveTabEndpoint = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      hasActiveTabProfileLink: true,
      updateActiveTabEndpoint,
    }));

    act(() => { result.current.handleConnectionEndpointChange('https://staging.example.com'); });
    expect(updateActiveTabEndpoint).toHaveBeenCalledWith('https://staging.example.com');
  });

  it('Phase 6H: routes auth change to page default for single inheriting tab', () => {
    const handleAuthChange = vi.fn();
    const updateActiveTabAuth = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      handleAuthChange,
      updateActiveTabAuth,
    }));

    act(() => { result.current.handleConnectionAuthChange({ type: 'bearer', token: 'x' }); });
    expect(handleAuthChange).toHaveBeenCalledWith({ type: 'bearer', token: 'x' });
    expect(updateActiveTabAuth).not.toHaveBeenCalled();
  });

  it('Phase 6H: routes auth change to tab override for multi-tab session', () => {
    const handleAuthChange = vi.fn();
    const updateActiveTabAuth = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      tabsLength: 2,
      handleAuthChange,
      updateActiveTabAuth,
    }));

    act(() => { result.current.handleConnectionAuthChange({ type: 'bearer', token: 'tab' }); });
    expect(updateActiveTabAuth).toHaveBeenCalledWith(
      { type: 'bearer', token: 'tab' },
      { clearProfileLink: false },
    );
    expect(handleAuthChange).not.toHaveBeenCalled();
  });

  it('Phase 6H: routes auth change to tab override when single tab already has auth override', () => {
    const handleAuthChange = vi.fn();
    const updateActiveTabAuth = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      hasActiveTabAuthOverride: true,
      handleAuthChange,
      updateActiveTabAuth,
    }));

    act(() => { result.current.handleConnectionAuthChange({ type: 'bearer', token: 'tab' }); });
    expect(updateActiveTabAuth).toHaveBeenCalledWith(
      { type: 'bearer', token: 'tab' },
      { clearProfileLink: false },
    );
    expect(handleAuthChange).not.toHaveBeenCalled();
  });

  it('Phase 6H: auth change unlinks profile before updating tab auth when profile-linked', () => {
    const handleAuthChange = vi.fn();
    const updateActiveTabAuth = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      hasActiveTabProfileLink: true,
      hasActiveTabConnectionId: true,
      handleAuthChange,
      updateActiveTabAuth,
    }));

    act(() => { result.current.handleConnectionAuthChange({ type: 'bearer', token: 'x' }); });
    expect(updateActiveTabAuth).toHaveBeenCalledWith(
      { type: 'bearer', token: 'x' },
      { clearProfileLink: true },
    );
    expect(handleAuthChange).not.toHaveBeenCalled();
  });

  it('Phase 6H: inherit-global auth edit keeps profile link when profile-linked', () => {
    const handleAuthChange = vi.fn();
    const updateActiveTabAuth = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      hasActiveTabProfileLink: true,
      hasActiveTabConnectionId: true,
      handleAuthChange,
      updateActiveTabAuth,
    }));

    act(() => {
      result.current.handleConnectionAuthChange({
        type: 'inherit',
        globalProfileId: 'catalog-prof-2',
      });
    });
    expect(updateActiveTabAuth).toHaveBeenCalledWith(
      { type: 'inherit', globalProfileId: 'catalog-prof-2' },
      { clearProfileLink: false },
    );
    expect(handleAuthChange).not.toHaveBeenCalled();
  });

  it('Phase 6H: auth change does not unlink when routing to page default', () => {
    const handleAuthChange = vi.fn();
    const updateActiveTabAuth = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      handleAuthChange,
      updateActiveTabAuth,
    }));

    act(() => { result.current.handleConnectionAuthChange({ type: 'bearer', token: 'x' }); });
    expect(updateActiveTabAuth).not.toHaveBeenCalled();
    expect(handleAuthChange).toHaveBeenCalledWith({ type: 'bearer', token: 'x' });
  });

  it('routes TLS change to page default for single inheriting tab', () => {
    const handleSkipTlsVerifyChange = vi.fn();
    const updateActiveTabSkipTlsVerify = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      handleSkipTlsVerifyChange,
      updateActiveTabSkipTlsVerify,
    }));

    act(() => { result.current.handleConnectionSkipTlsChange(true); });
    expect(handleSkipTlsVerifyChange).toHaveBeenCalledWith(true);
    expect(updateActiveTabSkipTlsVerify).not.toHaveBeenCalled();
  });

  it('routes TLS change to tab override when single tab already has override', () => {
    const updateActiveTabSkipTlsVerify = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      hasActiveTabSkipTlsOverride: true,
      updateActiveTabSkipTlsVerify,
    }));

    act(() => { result.current.handleConnectionSkipTlsChange(true); });
    expect(updateActiveTabSkipTlsVerify).toHaveBeenCalledWith(true);
  });

  it('routes TLS change to tab override for multi-tab session', () => {
    const updateActiveTabSkipTlsVerify = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      tabsLength: 2,
      updateActiveTabSkipTlsVerify,
    }));

    act(() => { result.current.handleConnectionSkipTlsChange(true); });
    expect(updateActiveTabSkipTlsVerify).toHaveBeenCalledWith(true);
  });

  it('routes CA cert patch to page storage for single inheriting tab', () => {
    const handleTlsCertsChange = vi.fn();
    const updateActiveTabTlsSettings = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      handleTlsCertsChange,
      updateActiveTabTlsSettings,
    }));

    act(() => { result.current.handleConnectionTlsChange({ caCert: 'pem-data' }); });
    expect(handleTlsCertsChange).toHaveBeenCalledWith({ caCert: 'pem-data' });
    expect(updateActiveTabTlsSettings).not.toHaveBeenCalled();
  });

  it('routes CA cert patch to tab override when tab already has cert override', () => {
    const handleTlsCertsChange = vi.fn();
    const updateActiveTabTlsSettings = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      hasActiveTabTlsCertOverride: true,
      handleTlsCertsChange,
      updateActiveTabTlsSettings,
    }));

    act(() => { result.current.handleConnectionTlsChange({ caCert: 'pem-data' }); });
    expect(updateActiveTabTlsSettings).toHaveBeenCalledWith({ caCert: 'pem-data' });
    expect(handleTlsCertsChange).not.toHaveBeenCalled();
  });

  it('routes skipTlsVerify through page default when single inheriting tab', () => {
    const handleSkipTlsVerifyChange = vi.fn();
    const handleTlsCertsChange = vi.fn();
    const updateActiveTabTlsSettings = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      handleSkipTlsVerifyChange,
      handleTlsCertsChange,
      updateActiveTabTlsSettings,
    }));

    act(() => { result.current.handleConnectionTlsChange({ skipTlsVerify: true, caCert: 'pem' }); });
    expect(handleSkipTlsVerifyChange).toHaveBeenCalledWith(true);
    expect(handleTlsCertsChange).toHaveBeenCalledWith({ caCert: 'pem' });
    expect(updateActiveTabTlsSettings).not.toHaveBeenCalled();
  });

  it('routes polling change to page default for single inheriting tab (Phase 6F)', () => {
    const handlePollingChange = vi.fn();
    const updateActiveTabPolling = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      handlePollingChange,
      updateActiveTabPolling,
    }));

    act(() => { result.current.handleConnectionPollingChange(true, 45); });
    expect(handlePollingChange).toHaveBeenCalledWith(true, 45);
    expect(updateActiveTabPolling).not.toHaveBeenCalled();
  });

  it('routes polling change to tab override for multi-tab session (Phase 6F)', () => {
    const handlePollingChange = vi.fn();
    const updateActiveTabPolling = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      tabsLength: 2,
      handlePollingChange,
      updateActiveTabPolling,
    }));

    act(() => { result.current.handleConnectionPollingChange(true, 60); });
    expect(updateActiveTabPolling).toHaveBeenCalledWith(true, 60);
    expect(handlePollingChange).not.toHaveBeenCalled();
  });

  it('clamps polling interval before routing (Phase 6F)', () => {
    const handlePollingChange = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      handlePollingChange,
    }));

    act(() => { result.current.handleConnectionPollingChange(true, 5); });
    expect(handlePollingChange).toHaveBeenCalledWith(true, 10);
  });

  it('routes polling change to tab override when single tab already has override (Phase 6F)', () => {
    const updateActiveTabPolling = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      hasActiveTabPollingOverride: true,
      updateActiveTabPolling,
    }));

    act(() => { result.current.handleConnectionPollingChange(false, 30); });
    expect(updateActiveTabPolling).toHaveBeenCalledWith(false, 30);
  });

  it('routes client cert patch to tab override for multi-tab session', () => {
    const handleTlsCertsChange = vi.fn();
    const updateActiveTabTlsSettings = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      tabsLength: 2,
      handleTlsCertsChange,
      updateActiveTabTlsSettings,
    }));

    act(() => {
      result.current.handleConnectionTlsChange({
        clientCert: 'cert-pem',
        clientKey: 'key-pem',
      });
    });
    expect(updateActiveTabTlsSettings).toHaveBeenCalledWith({
      clientCert: 'cert-pem',
      clientKey: 'key-pem',
    });
    expect(handleTlsCertsChange).not.toHaveBeenCalled();
  });

  it('handleConnectionTlsChange ignores skipTlsVerify-only patch for cert routing', () => {
    const handleSkipTlsVerifyChange = vi.fn();
    const handleTlsCertsChange = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      handleSkipTlsVerifyChange,
      handleTlsCertsChange,
    }));

    act(() => { result.current.handleConnectionTlsChange({ skipTlsVerify: true }); });
    expect(handleSkipTlsVerifyChange).toHaveBeenCalledWith(true);
    expect(handleTlsCertsChange).not.toHaveBeenCalled();
  });

  it('routes caCert patch to tab override when multi-tab even without cert override flag', () => {
    const updateActiveTabTlsSettings = vi.fn();
    const { result } = renderHook(() => useGqlTabConnectionHandlers({
      ...base,
      tabsLength: 3,
      updateActiveTabTlsSettings,
    }));

    act(() => { result.current.handleConnectionTlsChange({ caCert: 'ca-data' }); });
    expect(updateActiveTabTlsSettings).toHaveBeenCalledWith({ caCert: 'ca-data' });
  });
});
