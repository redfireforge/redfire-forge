/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGalleryMigration } from './useGalleryMigration';
import type { Environment, Microservice } from '@shared/types';

const makeEnv = (overrides: Partial<Environment> = {}): Environment => ({
  id: 'env-1',
  name: 'Gallery Samples',
  ...overrides,
});

const makeSvc = (overrides: Partial<Microservice> = {}): Microservice => ({
  id: 'svc-1',
  name: 'Gallery Samples',
  baseUrls: {},
  ...overrides,
});

describe('useGalleryMigration', () => {
  let setMicroservices: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setMicroservices = vi.fn();
  });

  it('does nothing while loading is true', () => {
    const env = makeEnv();
    const svc = makeSvc();
    renderHook(() =>
      useGalleryMigration({
        loading: true,
        environments: [env],
        microservices: [svc],
        setMicroservices,
      }),
    );
    expect(setMicroservices).not.toHaveBeenCalled();
  });

  it('does nothing when Gallery Samples environment is missing', () => {
    const svc = makeSvc();
    renderHook(() =>
      useGalleryMigration({
        loading: false,
        environments: [makeEnv({ name: 'Other' })],
        microservices: [svc],
        setMicroservices,
      }),
    );
    expect(setMicroservices).not.toHaveBeenCalled();
  });

  it('does nothing when Gallery Samples microservice is missing', () => {
    const env = makeEnv();
    renderHook(() =>
      useGalleryMigration({
        loading: false,
        environments: [env],
        microservices: [makeSvc({ name: 'Other' })],
        setMicroservices,
      }),
    );
    expect(setMicroservices).not.toHaveBeenCalled();
  });

  it('does nothing when baseUrl entry already exists for gallery env', () => {
    const env = makeEnv();
    const svc = makeSvc({ baseUrls: { 'env-1': 'http://example.com' } });
    renderHook(() =>
      useGalleryMigration({
        loading: false,
        environments: [env],
        microservices: [svc],
        setMicroservices,
      }),
    );
    expect(setMicroservices).not.toHaveBeenCalled();
  });

  it('calls setMicroservices when gallery env entry is missing', () => {
    const env = makeEnv();
    const svc = makeSvc({ baseUrls: {} });
    renderHook(() =>
      useGalleryMigration({
        loading: false,
        environments: [env],
        microservices: [svc],
        setMicroservices,
      }),
    );
    expect(setMicroservices).toHaveBeenCalledOnce();

    // Verify the updater adds the baseUrl entry
    const updater = setMicroservices.mock.calls[0][0] as (prev: Microservice[]) => Microservice[];
    const updated = updater([svc]);
    expect(updated[0].baseUrls['env-1']).toBe('');
  });

  it('runs only once even if props re-render', () => {
    const env = makeEnv();
    const svc = makeSvc({ baseUrls: {} });
    const { rerender } = renderHook(
      ({ loading }) =>
        useGalleryMigration({
          loading,
          environments: [env],
          microservices: [svc],
          setMicroservices,
        }),
      { initialProps: { loading: false } },
    );
    rerender({ loading: false });
    rerender({ loading: false });
    expect(setMicroservices).toHaveBeenCalledOnce();
  });
});
