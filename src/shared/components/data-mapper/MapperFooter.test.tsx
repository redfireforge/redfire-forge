/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import MapperFooter from './MapperFooter';
import type { Mapping } from './types';
import type { ArrayMappingInfo } from './utils/arrayMapping';
import type { TypeMismatch } from './utils/typeMismatch';

function baseMapping(overrides: Partial<Mapping> = {}): Mapping {
  return {
    id: 'm1',
    sourcePath: '$.a',
    sourceId: 's1',
    targetPath: '$.b',
    ...overrides,
  };
}

function renderFooter(
  overrides?: Partial<{
    mappings: Mapping[];
    arrayMappingInfos: ArrayMappingInfo[];
    typeMismatches: TypeMismatch[];
  }>,
) {
  const mappings = overrides?.mappings ?? [];
  const arrayMappingInfos = overrides?.arrayMappingInfos ?? [];
  const typeMismatches = overrides?.typeMismatches ?? [];
  return render(
    <MapperFooter
      mappings={mappings}
      arrayMappingInfos={arrayMappingInfos}
      typeMismatches={typeMismatches}
    />,
  );
}

describe('MapperFooter', () => {
  it('renders mapped count', () => {
    renderFooter({
      mappings: [baseMapping({ id: 'a' }), baseMapping({ id: 'b' })],
    });
    const status = screen.getByRole('status');
    expect(within(status).getByText('2', { selector: '.dm-stat-value--mapped' })).toBeInTheDocument();
    expect(status.textContent).toMatch(/2\s+mapped/);
  });

  it('renders expression count when > 0', () => {
    renderFooter({
      mappings: [
        baseMapping({ id: 'a', expression: '$.x' }),
        baseMapping({ id: 'b', expression: '$.y' }),
      ],
    });
    const status = screen.getByRole('status');
    expect(within(status).getByText('2', { selector: '.dm-stat-value--expression' })).toBeInTheDocument();
    expect(status.textContent).toContain('expressions');
  });

  it('hides expression count when 0', () => {
    renderFooter({
      mappings: [baseMapping(), baseMapping({ id: 'm2' })],
    });
    const status = screen.getByRole('status');
    expect(within(status).queryByText(/^expressions?$/)).toBeNull();
    expect(status.querySelector('.dm-stat-value--expression')).toBeNull();
  });

  it('does not count empty expression as an expression stat', () => {
    renderFooter({
      mappings: [baseMapping({ expression: '' })],
    });
    expect(screen.getByRole('status').querySelector('.dm-stat-value--expression')).toBeNull();
  });

  it('renders loop count when > 0', () => {
    renderFooter({
      arrayMappingInfos: [
        {
          mappingId: 'x',
          kind: 'loop',
          sourceArrayPath: '$.items',
          targetArrayPath: '$.out',
        },
      ],
    });
    const status = screen.getByRole('status');
    expect(within(status).getByText('1', { selector: '.dm-stat-value--loop' })).toBeInTheDocument();
    expect(status.textContent).toMatch(/1\s+loop\b/);
  });

  it('renders aggregate count when > 0', () => {
    renderFooter({
      arrayMappingInfos: [
        {
          mappingId: 'x',
          kind: 'aggregate',
          sourceArrayPath: '$.items',
          targetArrayPath: '$.sum',
        },
      ],
    });
    const status = screen.getByRole('status');
    expect(within(status).getByText('1', { selector: '.dm-stat-value--aggregate' })).toBeInTheDocument();
    expect(status.textContent).toMatch(/1\s+aggregate\b/);
  });

  it('renders mismatch count when > 0', () => {
    renderFooter({
      typeMismatches: [
        {
          mappingId: 'm1',
          sourceType: 'number',
          targetType: 'string',
          sourcePath: '$.n',
          targetPath: '$.s',
        },
      ],
    });
    const status = screen.getByRole('status');
    expect(within(status).getByText('1', { selector: '.dm-stat-value--mismatch' })).toBeInTheDocument();
    expect(status.textContent).toMatch(/1\s+mismatch\b/);
  });

  it('uses singular labels for 1 expression, 1 loop, 1 aggregate, 1 mismatch', () => {
    renderFooter({
      mappings: [baseMapping({ expression: 'x' })],
      arrayMappingInfos: [
        {
          mappingId: 'a',
          kind: 'loop',
          sourceArrayPath: '$.a',
          targetArrayPath: '$.b',
        },
        {
          mappingId: 'b',
          kind: 'aggregate',
          sourceArrayPath: '$.c',
          targetArrayPath: '$.d',
        },
      ],
      typeMismatches: [
        {
          mappingId: 'm',
          sourceType: 'string',
          targetType: 'number',
          sourcePath: '$.p',
          targetPath: '$.q',
        },
      ],
    });
    const status = screen.getByRole('status');
    const norm = (el: Element | null | undefined) =>
      (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    expect(norm(status.querySelector('.dm-stat-value--mapped')?.parentElement)).toBe('1 mapped');
    expect(norm(status.querySelector('.dm-stat-value--expression')?.parentElement)).toBe('1 expression');
    expect(norm(status.querySelector('.dm-stat-value--loop')?.parentElement)).toBe('1 loop');
    expect(norm(status.querySelector('.dm-stat-value--aggregate')?.parentElement)).toBe('1 aggregate');
    expect(norm(status.querySelector('.dm-stat-value--mismatch')?.parentElement)).toBe('1 mismatch');
  });

  it('uses plural labels for multiple expressions, loops, aggregates, mismatches', () => {
    renderFooter({
      mappings: [
        baseMapping({ id: 'a', expression: '1' }),
        baseMapping({ id: 'b', expression: '2' }),
      ],
      arrayMappingInfos: [
        {
          mappingId: 'l1',
          kind: 'loop',
          sourceArrayPath: '$.x',
          targetArrayPath: '$.y',
        },
        {
          mappingId: 'l2',
          kind: 'loop',
          sourceArrayPath: '$.x',
          targetArrayPath: '$.z',
        },
        {
          mappingId: 'g1',
          kind: 'aggregate',
          sourceArrayPath: '$.a',
          targetArrayPath: '$.b',
        },
        {
          mappingId: 'g2',
          kind: 'aggregate',
          sourceArrayPath: '$.c',
          targetArrayPath: '$.d',
        },
      ],
      typeMismatches: [
        {
          mappingId: '1',
          sourceType: 'string',
          targetType: 'number',
          sourcePath: '$.p',
          targetPath: '$.q',
        },
        {
          mappingId: '2',
          sourceType: 'object',
          targetType: 'string',
          sourcePath: '$.r',
          targetPath: '$.s',
        },
      ],
    });
    const status = screen.getByRole('status');
    const text = status.textContent ?? '';
    expect(text).toContain('2 expressions');
    expect(text).toContain('2 loops');
    expect(text).toContain('2 aggregates');
    expect(text).toContain('2 mismatches');
  });

  it('renders keyboard shortcuts', () => {
    renderFooter();
    const footer = screen.getByRole('status');
    expect(within(footer).getByText('Search')).toBeInTheDocument();
    expect(within(footer).getByText('Delete')).toBeInTheDocument();
    expect(within(footer).getByText('Undo')).toBeInTheDocument();
    expect(within(footer).getByText('Switch panel')).toBeInTheDocument();
    expect(footer.querySelector('.dm-shortcut kbd.dm-kbd')?.textContent).toBeTruthy();
  });

  it('with all zero stats shows only mapped (and shortcuts)', () => {
    renderFooter({
      mappings: [],
      arrayMappingInfos: [],
      typeMismatches: [],
    });
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/0\s+mapped/);
    expect(status.querySelector('.dm-stat-value--expression')).toBeNull();
    expect(status.querySelector('.dm-stat-value--loop')).toBeNull();
    expect(status.querySelector('.dm-stat-value--aggregate')).toBeNull();
    expect(status.querySelector('.dm-stat-value--mismatch')).toBeNull();
    expect(within(status).getByText('Search')).toBeInTheDocument();
  });

  it('scalar-to-array array info does not increment loop or aggregate counts', () => {
    renderFooter({
      arrayMappingInfos: [
        {
          mappingId: 's',
          kind: 'scalar-to-array',
          sourceArrayPath: '$.x',
          targetArrayPath: '$.y',
        },
      ],
    });
    const status = screen.getByRole('status');
    expect(status.querySelector('.dm-stat-value--loop')).toBeNull();
    expect(status.querySelector('.dm-stat-value--aggregate')).toBeNull();
  });

  it('renders nothing in compact mode when all mapping stats are zero', () => {
    const { container } = render(
      <MapperFooter
        mappings={[]}
        arrayMappingInfos={[]}
        typeMismatches={[]}
        compactMode
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows unresolved stats when overridden counts say so', () => {
    render(
      <MapperFooter
        mappings={[baseMapping(), baseMapping({ id: 'x' })]}
        arrayMappingInfos={[]}
        typeMismatches={[]}
        resolvedCount={1}
        unresolvedCount={3}
      />,
    );
    const status = screen.getByRole('status');
    expect(within(status).getByText('3', { selector: '.dm-stat-value--mismatch' })).toBeInTheDocument();
    expect(status.textContent).toContain('unresolved');
  });

  it('shows verify passed/failed when verify completes', () => {
    const onFilterFailed = vi.fn();
    render(
      <MapperFooter
        mappings={[]}
        arrayMappingInfos={[]}
        typeMismatches={[]}
        verifyStatus="complete"
        verifyPassedCount={2}
        verifyFailedCount={1}
        onFilterFailed={onFilterFailed}
      />,
    );
    const status = screen.getByRole('status');
    expect(within(status).getByText('2', { selector: '.dm-stat-value--verify-pass' })).toBeInTheDocument();
    expect(within(status).getByText('1', { selector: '.dm-stat-value--verify-fail' })).toBeInTheDocument();
    const failBtn = within(status).getByRole('button', { name: /failed/i });
    failBtn.click();
    expect(onFilterFailed).toHaveBeenCalledTimes(1);
  });

  it('hides verify passed row when count is intentionally undefined after complete', () => {
    render(
      <MapperFooter
        mappings={[]}
        arrayMappingInfos={[]}
        typeMismatches={[]}
        verifyStatus="complete"
        verifyPassedCount={undefined}
        verifyFailedCount={0}
      />,
    );
    expect(screen.queryByText('passed')).toBeNull();
  });

  it('does not render failed clickable row when failure count is zero', () => {
    render(
      <MapperFooter
        mappings={[]}
        arrayMappingInfos={[]}
        typeMismatches={[]}
        verifyStatus="complete"
        verifyPassedCount={1}
        verifyFailedCount={0}
      />,
    );
    expect(screen.queryByRole('button', { name: /failed/i })).toBeNull();
  });
});
