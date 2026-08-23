/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GrpcFieldSchema } from '@shared/grpc/contracts';
import { GrpcProtoFormBuilder } from './GrpcProtoFormBuilder';

vi.mock('../utils/grpcProtoFormValues', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/grpcProtoFormValues')>();
  return {
    ...actual,
    groupMessageFields: vi.fn(() => ({
      regular: [] as GrpcFieldSchema[],
      oneofGroups: new Map<string, GrpcFieldSchema[]>([['orphan', []]]),
    })),
  };
});

describe('GrpcProtoFormBuilder empty oneof branch', () => {
  it('renders nothing for oneof groups without members', () => {
    render(
      <GrpcProtoFormBuilder
        schema={{ typeName: 'demo.EmptyOneof', fields: [] }}
        body={{}}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('grpc-proto-oneof-orphan')).toBeNull();
    expect(screen.getByTestId('grpc-proto-form')).toBeTruthy();
  });
});
