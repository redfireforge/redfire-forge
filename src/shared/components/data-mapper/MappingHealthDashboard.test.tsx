/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import MappingHealthDashboard from './MappingHealthDashboard';
import { computeHealthStats } from './utils/healthStats';
import { buildJsonTree } from '../../utils/jsonTreeModel';
import type { Mapping } from './types';

// ─── computeHealthStats ────────────────────────────────────

describe('computeHealthStats', () => {
  const tree = buildJsonTree({ name: 'Alice', age: 30, email: 'a@b.com' }, '', '');

  it('computes coverage when some targets are mapped', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 's1', sourcePath: 'x', targetPath: 'name' },
    ];
    const stats = computeHealthStats(mappings, tree);
    expect(stats.totalMappings).toBe(1);
    expect(stats.totalTargetFields).toBe(3);
    expect(stats.mappedTargetFields).toBe(1);
    expect(stats.coveragePercent).toBe(33);
  });

  it('computes 100% coverage when all targets mapped', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 's1', sourcePath: 'x', targetPath: 'name' },
      { id: 'm2', sourceId: 's1', sourcePath: 'y', targetPath: 'age' },
      { id: 'm3', sourceId: 's1', sourcePath: 'z', targetPath: 'email' },
    ];
    const stats = computeHealthStats(mappings, tree);
    expect(stats.coveragePercent).toBe(100);
  });

  it('computes 0% coverage with no mappings', () => {
    const stats = computeHealthStats([], tree);
    expect(stats.coveragePercent).toBe(0);
    expect(stats.totalMappings).toBe(0);
  });

  it('handles null target tree', () => {
    const stats = computeHealthStats([{ id: 'm1', sourceId: 's1', sourcePath: 'x', targetPath: 'y' }], null);
    expect(stats.totalTargetFields).toBe(0);
    expect(stats.coveragePercent).toBe(0);
    expect(stats.totalMappings).toBe(1);
  });

  it('counts drift warnings and breaking', () => {
    const driftMap = new Map([
      ['m1', 'warning' as const],
      ['m2', 'breaking' as const],
      ['m3', 'breaking' as const],
    ]);
    const stats = computeHealthStats([], null, driftMap);
    expect(stats.driftWarnings).toBe(1);
    expect(stats.driftBreaking).toBe(2);
    expect(stats.brokenCount).toBe(2);
  });

  it('passes through type mismatch count', () => {
    const stats = computeHealthStats([], null, undefined, 5);
    expect(stats.typeMismatches).toBe(5);
  });
});

// ─── MappingHealthDashboard Component ──────────────────────

describe('MappingHealthDashboard', () => {
  const tree = buildJsonTree({ name: 'Alice', age: 30 }, '', '');

  it('returns null when no mappings and no issues', () => {
    const { container } = render(
      <MappingHealthDashboard mappings={[]} targetTree={tree} typeMismatchCount={0} />,
    );
    expect(container.querySelector('.dm-health-dashboard')).toBeNull();
  });

  it('renders healthy status when mappings exist and no issues', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 's1', sourcePath: 'x', targetPath: 'name' },
    ];
    const { container } = render(
      <MappingHealthDashboard mappings={mappings} targetTree={tree} typeMismatchCount={0} />,
    );
    const dashboard = container.querySelector('.dm-health-dashboard');
    expect(dashboard).toBeTruthy();
    expect(dashboard!.classList.contains('dm-health-dashboard--healthy')).toBe(true);
    expect(container.querySelector('.dm-health-status')?.textContent).toContain('Healthy');
  });

  it('renders critical status with broken count', () => {
    const driftMap = new Map([['m1', 'breaking' as const]]);
    const { container } = render(
      <MappingHealthDashboard mappings={[]} targetTree={null} driftMappingIds={driftMap} typeMismatchCount={0} />,
    );
    const dashboard = container.querySelector('.dm-health-dashboard');
    expect(dashboard!.classList.contains('dm-health-dashboard--critical')).toBe(true);
    expect(container.querySelector('.dm-health-status')?.textContent).toContain('Broken');
    const critical = container.querySelector('.dm-health-metric--critical');
    expect(critical).toBeTruthy();
    expect(critical!.textContent).toContain('1');
    expect(critical!.textContent).toContain('broken');
  });

  it('renders warning status with type mismatches', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 's1', sourcePath: 'x', targetPath: 'name' },
    ];
    const { container } = render(
      <MappingHealthDashboard mappings={mappings} targetTree={tree} typeMismatchCount={3} />,
    );
    const dashboard = container.querySelector('.dm-health-dashboard');
    expect(dashboard!.classList.contains('dm-health-dashboard--warning')).toBe(true);
    const warning = container.querySelector('.dm-health-metric--warning');
    expect(warning).toBeTruthy();
    expect(warning!.textContent).toContain('3');
    expect(warning!.textContent).toContain('mismatches');
  });

  it('renders coverage percentage', () => {
    const mappings: Mapping[] = [
      { id: 'm1', sourceId: 's1', sourcePath: 'x', targetPath: 'name' },
    ];
    const { container } = render(
      <MappingHealthDashboard mappings={mappings} targetTree={tree} typeMismatchCount={0} />,
    );
    const coverageMetric = container.querySelector('.dm-health-metric');
    expect(coverageMetric?.textContent).toContain('50%');
    expect(coverageMetric?.textContent).toContain('coverage');
  });

  it('calls onShowDrift when broken count is clicked', () => {
    const onShowDrift = vi.fn();
    const driftMap = new Map([['m1', 'breaking' as const]]);
    const { container } = render(
      <MappingHealthDashboard mappings={[]} targetTree={null} driftMappingIds={driftMap} typeMismatchCount={0} onShowDrift={onShowDrift} />,
    );
    const brokenMetric = container.querySelector('.dm-health-metric--critical');
    expect(brokenMetric).toBeTruthy();
    fireEvent.click(brokenMetric!);
    expect(onShowDrift).toHaveBeenCalledTimes(1);
  });

  it('calls onShowDrift on Enter key on broken count', () => {
    const onShowDrift = vi.fn();
    const driftMap = new Map([['m1', 'breaking' as const]]);
    const { container } = render(
      <MappingHealthDashboard mappings={[]} targetTree={null} driftMappingIds={driftMap} typeMismatchCount={0} onShowDrift={onShowDrift} />,
    );
    const brokenMetric = container.querySelector('.dm-health-metric--critical');
    fireEvent.keyDown(brokenMetric!, { key: 'Enter' });
    expect(onShowDrift).toHaveBeenCalledTimes(1);
  });

  it('calls onShowDrift on Enter key on drift warning metric', () => {
    const onShowDrift = vi.fn();
    const driftMap = new Map([['m1', 'warning' as const]]);
    const { container } = render(
      <MappingHealthDashboard mappings={[]} targetTree={null} driftMappingIds={driftMap} typeMismatchCount={0} onShowDrift={onShowDrift} />,
    );
    const warnings = container.querySelectorAll('.dm-health-metric--warning');
    const driftMetric = Array.from(warnings).find((el) => el.textContent?.includes('drift'));
    expect(driftMetric).toBeTruthy();
    fireEvent.keyDown(driftMetric!, { key: 'Enter' });
    expect(onShowDrift).toHaveBeenCalledTimes(1);
  });

  it('does not call onShowDrift on non-Enter key for broken and drift metrics', () => {
    const onShowDrift = vi.fn();
    const driftMap = new Map([
      ['m1', 'breaking' as const],
      ['m2', 'warning' as const],
    ]);
    const { container } = render(
      <MappingHealthDashboard mappings={[]} targetTree={null} driftMappingIds={driftMap} typeMismatchCount={0} onShowDrift={onShowDrift} />,
    );
    const brokenMetric = container.querySelector('.dm-health-metric--critical');
    const warnings = container.querySelectorAll('.dm-health-metric--warning');
    const driftMetric = Array.from(warnings).find((el) => el.textContent?.includes('drift'));
    fireEvent.keyDown(brokenMetric!, { key: 'Escape' });
    fireEvent.keyDown(driftMetric!, { key: ' ' });
    expect(onShowDrift).not.toHaveBeenCalled();
  });

  it('omits button semantics on broken metric when onShowDrift is absent', () => {
    const driftMap = new Map([['m1', 'breaking' as const]]);
    const { container } = render(
      <MappingHealthDashboard mappings={[]} targetTree={null} driftMappingIds={driftMap} typeMismatchCount={0} />,
    );
    const brokenMetric = container.querySelector('.dm-health-metric--critical');
    expect(brokenMetric?.getAttribute('role')).toBeNull();
    expect(brokenMetric?.tabIndex).toBe(-1);
  });

  it('uses singular labels for one broken mapping, one drift warning, and one type mismatch', () => {
    const driftMap = new Map([['m1', 'warning' as const], ['m2', 'breaking' as const]]);
    const { container } = render(
      <MappingHealthDashboard mappings={[]} targetTree={null} driftMappingIds={driftMap} typeMismatchCount={1} />,
    );
    const brokenMetric = container.querySelector('.dm-health-metric--critical');
    const driftWarning = Array.from(container.querySelectorAll('.dm-health-metric--warning')).find((el) => el.textContent?.includes('drift'));
    const mismatchMetric = Array.from(container.querySelectorAll('.dm-health-metric--warning')).find((el) => el.textContent?.includes('mismatch'));
    expect(brokenMetric?.getAttribute('title')).toMatch(/1 mapping broken/);
    expect(driftWarning?.getAttribute('title')).toMatch(/1 drift warning$/);
    expect(mismatchMetric?.textContent).toContain('mismatch');
    expect(mismatchMetric?.textContent).not.toContain('mismatches');
  });

  it('uses plural mapping label in broken metric title when multiple are broken', () => {
    const driftMap = new Map([
      ['m1', 'breaking' as const],
      ['m2', 'breaking' as const],
    ]);
    const { container } = render(
      <MappingHealthDashboard mappings={[]} targetTree={null} driftMappingIds={driftMap} typeMismatchCount={0} />,
    );
    const brokenMetric = container.querySelector('.dm-health-metric--critical');
    expect(brokenMetric?.getAttribute('title')).toContain('2 mappings broken');
  });

  it('uses plural drift warning title when multiple drift warnings', () => {
    const driftMap = new Map([
      ['m1', 'warning' as const],
      ['m2', 'warning' as const],
    ]);
    const { container } = render(
      <MappingHealthDashboard mappings={[]} targetTree={null} driftMappingIds={driftMap} typeMismatchCount={0} />,
    );
    const driftWarning = Array.from(container.querySelectorAll('.dm-health-metric--warning')).find((el) => el.textContent?.includes('drift'));
    expect(driftWarning?.getAttribute('title')).toContain('2 drift warnings');
  });

  it('renders drift warning count', () => {
    const driftMap = new Map([['m1', 'warning' as const], ['m2', 'warning' as const]]);
    const { container } = render(
      <MappingHealthDashboard mappings={[]} targetTree={null} driftMappingIds={driftMap} typeMismatchCount={0} />,
    );
    const warnings = container.querySelectorAll('.dm-health-metric--warning');
    const driftWarning = Array.from(warnings).find((el) => el.textContent?.includes('drift'));
    expect(driftWarning).toBeTruthy();
    expect(driftWarning!.textContent).toContain('2');
  });

  it('does not render coverage when no target tree', () => {
    const driftMap = new Map([['m1', 'breaking' as const]]);
    const { container } = render(
      <MappingHealthDashboard mappings={[]} targetTree={null} driftMappingIds={driftMap} typeMismatchCount={0} />,
    );
    const allMetrics = container.querySelectorAll('.dm-health-metric');
    const coverageMetric = Array.from(allMetrics).find((el) => el.textContent?.includes('coverage'));
    expect(coverageMetric).toBeUndefined();
  });
});
